import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { CIERRE_COLUMNS, type CierreCaja } from '@/types/database';
import { getCashClosures, removeCashClosure, saveCashClosure, type CashClosure } from '@/lib/cashClosureStore';
import { isSameCashierName } from '@/lib/cashRegisters';
import { obtenerCajas } from './cajas.service';
import { obtenerUsuarios } from './usuarios.service';
import { obtenerVentasTurno, getLocalVentas, type VentaConDetalle } from './ventas.service';
import { obtenerMovimientosCaja } from './movimientosCaja.service';

const isTestEnv =
  typeof process !== 'undefined' &&
  Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID
  );

function getSafeSupabase() {
  if (isTestEnv) return null;
  return tryGetSupabase();
}

function esUuid(value: string | undefined | null): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toLocalDateStr(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate).slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function expandCajaIds(cajaId?: string): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!cajaId) return ids;
  const raw = String(cajaId).trim();
  ids.add(raw);
  if (raw.toLowerCase().startsWith('caja-')) {
    ids.add(raw.slice(5));
  } else if (/^\d+$/.test(raw)) {
    ids.add(`caja-${raw}`);
  }
  try {
    const cajas = await obtenerCajas({ soloActivas: false }).catch(() => []);
    for (const caja of cajas) {
      const keys = [
        caja.id,
        caja.codigo,
        caja.nombre,
        `Caja #${caja.codigo}`,
        `Caja ${caja.codigo}`,
      ]
        .filter(Boolean)
        .map(String);
      if (keys.some((k) => ids.has(k) || k.toLowerCase() === raw.toLowerCase())) {
        keys.forEach((k) => ids.add(k));
      }
    }
  } catch {
    // ignore
  }
  return ids;
}

function isOpenStatus(estado?: string | null): boolean {
  return String(estado || '').toLowerCase() === 'abierta';
}

function localToDb(c: CashClosure): CierreCaja {
  return {
    id: String(c.id),
    codigo: c.code,
    caja_id: String(c.cashRegisterId),
    cajero_id: String(c.userId),
    cajero_nombre: c.userName || undefined,
    cajero_username: c.username || undefined,
    caja_label: c.cashRegisterLabel || undefined,
    notes: c.notes || undefined,
    sucursal_id: null,
    monto_apertura: c.baseCash ?? 0,
    monto_esperado: c.expectedCash,
    monto_real: c.countedCash,
    monto_diferencia: c.difference,
    total_ventas: c.totalSales ?? 0,
    total_efectivo: c.totalCash ?? 0,
    total_tarjeta: c.totalCard ?? 0,
    total_transferencia: c.totalTransfer ?? 0,
    estado: c.status ?? (c.closedAt ? 'cerrada' : 'abierta'),
    abierta_en: c.openedAt,
    cerrada_en: c.closedAt || null,
  };
}

function sameSessionOwnerOrBox(a: CierreCaja, b: CierreCaja): boolean {
  if (a.cajero_id && b.cajero_id && String(a.cajero_id) !== '0' && String(a.cajero_id) === String(b.cajero_id)) {
    return true;
  }
  const nameA = a.cajero_nombre || (a as any).userName;
  const nameB = b.cajero_nombre || (b as any).userName;
  if (nameA && nameB && isSameCashierName(nameA, nameB)) {
    return true;
  }
  if (a.caja_id && b.caja_id && String(a.caja_id) === String(b.caja_id)) {
    return true;
  }
  return false;
}

/**
 * Detecta y cierra automáticamente sesiones que quedaron colgadas como 'abierta'
 * de días anteriores, sesiones duplicadas más antiguas o registros temporales 'cc-...' huérfanos.
 * Mantiene intactas las sesiones abiertas del día de hoy para que el cajero pueda cambiar de máquina o reiniciar sin volver a abrir caja.
 */
function depurarSesionesAbiertasObsoletas(
  rows: CierreCaja[],
  sb: ReturnType<typeof getSafeSupabase>
): CierreCaja[] {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const todayLocal = toLocalDateStr(nowIso);

  const openRows = rows.filter((r) => isOpenStatus(r.estado));
  if (openRows.length === 0) return rows;

  const closedRows = rows.filter((r) => !isOpenStatus(r.estado));
  const staleIds = new Set<string>();
  const orphanLocalIds = new Set<string>();

  // 1. Primero identificar sesiones de días anteriores (> 8 horas de antigüedad y fecha distinta a hoy)
  //    o sesiones temporales locales 'cc-...' huérfanas cuando Supabase está activo,
  //    o sesiones que ya tienen un cierre posterior registrado.
  for (const op of openRows) {
    const openedMs = op.abierta_en ? new Date(op.abierta_en).getTime() : 0;
    const openedLocalDay = toLocalDateStr(op.abierta_en);

    // a) Sin fecha válida o abierta en un día calendario anterior (y hace más de 8 horas)
    const isPastDay =
      !openedMs ||
      isNaN(openedMs) ||
      (openedLocalDay !== todayLocal && nowMs - openedMs > 8 * 3600 * 1000);

    if (isPastDay) {
      staleIds.add(op.id);
      continue;
    }

    // b) Registro local temporal 'cc-...' cuando Supabase está configurado
    if (sb && isSupabaseConfigured() && String(op.id).startsWith('cc-')) {
      const hasRemoteMatch = openRows.some((other) => esUuid(other.id) && sameSessionOwnerOrBox(op, other));
      const isOlderThan2Min = nowMs - openedMs > 2 * 60 * 1000;
      if (hasRemoteMatch || isOlderThan2Min) {
        staleIds.add(op.id);
        orphanLocalIds.add(op.id);
        continue;
      }
    }

    // c) Ya existe un registro cerrado posterior para el mismo cajero o la misma caja
    const supersededByClose = closedRows.some((cl) => {
      if (!sameSessionOwnerOrBox(op, cl)) return false;
      const clTime = cl.cerrada_en
        ? new Date(cl.cerrada_en).getTime()
        : cl.abierta_en
          ? new Date(cl.abierta_en).getTime()
          : 0;
      return clTime > 0 && clTime >= openedMs;
    });

    if (supersededByClose) {
      staleIds.add(op.id);
    }
  }

  // 2. Entre las sesiones que siguen abiertas hoy, si un mismo cajero o caja tiene más de una abierta,
  //    conservar únicamente la más reciente y cerrar las anteriores.
  const remainingOpen = openRows.filter((r) => !staleIds.has(r.id));
  for (const op of remainingOpen) {
    const openedMs = op.abierta_en ? new Date(op.abierta_en).getTime() : 0;
    const hasNewerOpen = remainingOpen.some((other) => {
      if (other.id === op.id || staleIds.has(other.id)) return false;
      if (!sameSessionOwnerOrBox(op, other)) return false;
      const otherMs = other.abierta_en ? new Date(other.abierta_en).getTime() : 0;
      return otherMs > openedMs;
    });
    if (hasNewerOpen) {
      staleIds.add(op.id);
    }
  }

  if (staleIds.size === 0) return rows;

  // Limpiar en localStorage
  try {
    for (const oId of orphanLocalIds) {
      removeCashClosure(oId);
    }
    const localList = getCashClosures();
    for (const loc of localList) {
      if (staleIds.has(loc.id) && !orphanLocalIds.has(loc.id) && loc.status === 'abierta') {
        saveCashClosure({
          ...loc,
          status: 'cerrada',
          closedAt: loc.closedAt || nowIso,
        });
      }
    }
  } catch {
    // ignore
  }

  // Limpiar en Supabase de forma asíncrona
  if (sb && isSupabaseConfigured()) {
    const uuidsToClose = Array.from(staleIds).filter(esUuid);
    if (uuidsToClose.length > 0) {
      void sb
        .from('cierres_caja')
        .update({ estado: 'cerrada', cerrada_en: nowIso })
        .in('id', uuidsToClose)
        .eq('estado', 'abierta')
        .then(() => {});
    }
  }

  return rows
    .filter((r) => !orphanLocalIds.has(r.id))
    .map((r) => (staleIds.has(r.id) ? { ...r, estado: 'cerrada', cerrada_en: r.cerrada_en || nowIso } : r));
}


export function cierreDbARegistro(
  c: CierreCaja,
  extra?: Partial<Pick<CashClosure, 'userName' | 'username' | 'cashRegisterLabel' | 'notes' | 'baseCash'>>
): CashClosure {
  const local = getCashClosures().find((x) => x.id === c.id);
  const closedAt = c.cerrada_en || local?.closedAt || '';
  return {
    id: c.id,
    code: c.codigo,
    userId: c.cajero_id ?? local?.userId ?? '',
    username: extra?.username || c.cajero_username || local?.username || '',
    userName: extra?.userName || c.cajero_nombre || local?.userName || 'Cajero',
    openedAt: c.abierta_en || local?.openedAt || '',
    closedAt,
    date: (closedAt || c.abierta_en || new Date().toISOString()).slice(0, 10),
    cashRegisterId: c.caja_id,
    cashRegisterLabel: extra?.cashRegisterLabel || c.caja_label || local?.cashRegisterLabel || `Caja ${c.caja_id}`,
    totalSales: Number(c.total_ventas ?? local?.totalSales ?? 0),
    totalCash: Number(c.total_efectivo ?? local?.totalCash ?? 0),
    totalCard: Number(c.total_tarjeta ?? local?.totalCard ?? 0),
    cardCount: local?.cardCount ?? 0,
    totalTransfer: Number(c.total_transferencia ?? local?.totalTransfer ?? 0),
    transferCount: local?.transferCount ?? 0,
    totalCheque: local?.totalCheque ?? 0,
    chequeCount: local?.chequeCount ?? 0,
    totalCredit: local?.totalCredit ?? 0,
    creditCount: local?.creditCount ?? 0,
    expectedCash: Number(c.monto_esperado ?? 0),
    countedCash: Number(c.monto_real ?? 0),
    difference: Number(c.monto_diferencia ?? 0),
    baseCash: extra?.baseCash ?? Number(c.monto_apertura ?? local?.baseCash ?? 0),
    status: c.estado,
    notes: extra?.notes || local?.notes,
  };
}

function persistirRegistroCierre(
  db: CierreCaja,
  extra?: Partial<Pick<CashClosure, 'userName' | 'username' | 'cashRegisterLabel' | 'notes' | 'baseCash'>>
): CashClosure {
  const registro = cierreDbARegistro(db, extra);
  saveCashClosure(registro);
  return registro;
}

/** Historial de cierres ya cerrados para la pantalla Cierre de Caja. */
export async function obtenerRegistrosCierreCaja(): Promise<CashClosure[]> {
  const [rows, usuarios, cajasDb] = await Promise.all([
    obtenerCierresCaja(),
    obtenerUsuarios().catch(() => []),
    obtenerCajas({ soloActivas: false }).catch(() => []),
  ]);

  const userMap = new Map<string, { nombre: string; username: string }>();
  for (const u of usuarios) {
    if (u.id) {
      userMap.set(String(u.id), {
        nombre: u.nombre_completo || 'Cajero',
        username: (u.correo || '').split('@')[0] || 'cajero',
      });
    }
  }

  const cajaLabelMap = new Map<string, string>();
  for (const cj of cajasDb) {
    const label = cj.nombre?.toUpperCase().includes('CAJA')
      ? cj.nombre
      : `Caja #${cj.codigo || cj.id} - ${cj.nombre}`;
    if (cj.id) cajaLabelMap.set(String(cj.id), label);
    if (cj.codigo) {
      cajaLabelMap.set(String(cj.codigo), label);
      cajaLabelMap.set(`caja-${cj.codigo}`, label);
    }
  }

  const cerrados = rows.filter((c) => String(c.estado).toLowerCase() === 'cerrada');
  const mapped = cerrados.map((c) => {
    const uInfo = c.cajero_id ? userMap.get(String(c.cajero_id)) : undefined;
    const cLabel = c.caja_id ? cajaLabelMap.get(String(c.caja_id)) : undefined;
    return cierreDbARegistro(c, {
      userName: (c as any).cajero_nombre || uInfo?.nombre,
      username: (c as any).cajero_username || uInfo?.username,
      cashRegisterLabel: (c as any).caja_label || cLabel,
    });
  });

  const seen = new Set(mapped.map((c) => c.id));
  const locales = getCashClosures()
    .filter((c) => (c.status === 'cerrada' || !!c.closedAt) && !seen.has(c.id))
    .map((c) => {
      const uInfo = c.userId ? userMap.get(String(c.userId)) : undefined;
      const cLabel = c.cashRegisterId ? cajaLabelMap.get(String(c.cashRegisterId)) : undefined;
      return {
        ...c,
        userName: c.userName && c.userName !== 'Cajero' ? c.userName : uInfo?.nombre || c.userName || 'Cajero',
        username: c.username || uInfo?.username || '',
        cashRegisterLabel: cLabel || c.cashRegisterLabel || `Caja #${c.cashRegisterId}`,
      };
    });

  // Recalcular/verificar ventas exactas si un cierre quedó con totalSales === 0 pero tuvo ventas en su turno
  const allClosures = [...mapped, ...locales];
  const needsSalesCheck = allClosures.some((c) => c.totalSales === 0 && c.openedAt);
  if (needsSalesCheck) {
    try {
      const oldestOpen = allClosures
        .map((c) => c.openedAt)
        .filter(Boolean)
        .sort()[0];
      const ventasRecientes = await obtenerVentasTurno({
        desde: oldestOpen || undefined,
        limite: 1000,
      }).catch((): VentaConDetalle[] => []);
      const localVentas = getLocalVentas();
      const todasVentasMap = new Map<string, VentaConDetalle>();
      for (const v of [...ventasRecientes, ...localVentas]) {
        if (v.id && v.estado !== 'anulada') todasVentasMap.set(v.id, v);
      }
      const todasVentas = Array.from(todasVentasMap.values());

      for (const cl of allClosures) {
        if (cl.totalSales > 0) continue;
        const tStart = cl.openedAt ? new Date(cl.openedAt).getTime() : 0;
        const tEnd = cl.closedAt ? new Date(cl.closedAt).getTime() : Date.now();
        if (!tStart || isNaN(tStart)) continue;

        const ventasDelTurno = todasVentas.filter((v) => {
          const vt = v.creado_en ? new Date(v.creado_en).getTime() : 0;
          if (!vt || vt < tStart - 10_000 || (tEnd > 0 && vt > tEnd + 10_000)) return false;
          const matchUser = cl.userId && v.cajero_id && String(v.cajero_id) === String(cl.userId);
          const matchName =
            cl.userName &&
            v.cajero_nombre &&
            v.cajero_nombre.trim().toLowerCase() === cl.userName.trim().toLowerCase();
          const matchBox =
            cl.cashRegisterId &&
            v.caja_id &&
            String(v.caja_id) === String(cl.cashRegisterId);
          return matchUser || matchName || (!cl.userId && matchBox);
        });

        if (ventasDelTurno.length > 0) {
          let sumSales = 0;
          let sumCash = 0;
          let sumCard = 0;
          let sumTransfer = 0;
          let sumCredit = 0;
          for (const v of ventasDelTurno) {
            const monto = Number(v.monto_total || 0);
            sumSales += monto;
            const m = String(v.metodo_pago || 'efectivo').toLowerCase();
            if (m === 'efectivo' || m === 'cash') sumCash += monto;
            else if (m === 'tarjeta' || m === 'card') sumCard += monto;
            else if (m === 'transferencia' || m === 'transfer') sumTransfer += monto;
            else if (m === 'credito' || m === 'credit') sumCredit += monto;
          }
          cl.totalSales = Math.round(sumSales * 100) / 100;
          cl.totalCash = Math.round(sumCash * 100) / 100;
          cl.totalCard = Math.round(sumCard * 100) / 100;
          cl.totalTransfer = Math.round(sumTransfer * 100) / 100;
          cl.totalCredit = Math.round(sumCredit * 100) / 100;
          if (cl.expectedCash === 0 || cl.expectedCash === (cl.baseCash ?? 0)) {
            cl.expectedCash = Math.round(((cl.baseCash ?? 0) + cl.totalCash) * 100) / 100;
            cl.difference = Math.round((cl.countedCash - cl.expectedCash) * 100) / 100;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return allClosures.sort((a, b) => ((a.closedAt || a.openedAt) < (b.closedAt || b.openedAt) ? 1 : -1));
}

function mapCierreRowWithPerfil(
  row: any,
  userMap?: Map<string, { nombre: string; username: string }>,
  cajaLabelMap?: Map<string, string>
): CierreCaja {
  const perfil = Array.isArray(row?.perfiles) ? row.perfiles[0] : row?.perfiles;
  const local = getCashClosures().find((x) => x.id === row?.id);
  const uFromMap = row?.cajero_id && userMap ? userMap.get(String(row.cajero_id)) : undefined;
  const cajeroNombre =
    perfil?.nombre_completo ||
    uFromMap?.nombre ||
    row?.cajero_nombre ||
    local?.userName ||
    undefined;
  const rawCorreo = perfil?.correo || uFromMap?.username || row?.cajero_username || local?.username || undefined;
  const cajeroUsername = rawCorreo ? String(rawCorreo).split('@')[0] : undefined;
  const cajaLabel =
    (row?.caja_id && cajaLabelMap ? cajaLabelMap.get(String(row.caja_id)) : undefined) ||
    row?.caja_label ||
    local?.cashRegisterLabel ||
    undefined;
  const { perfiles: _omitPerfiles, ...rest } = row || {};
  return {
    ...(rest as CierreCaja),
    ...(cajeroNombre ? { cajero_nombre: cajeroNombre } : {}),
    ...(cajeroUsername ? { cajero_username: cajeroUsername } : {}),
    ...(cajaLabel ? { caja_label: cajaLabel } : {}),
  };
}

export async function obtenerCierresCaja(params?: {
  signal?: AbortSignal;
}): Promise<CierreCaja[]> {
  const local = getCashClosures().map(localToDb);
  const sb = getSafeSupabase();
  if (!sb) {
    return depurarSesionesAbiertasObsoletas(local, null);
  }
  try {
    const [usuarios, cajasDb] = await Promise.all([
      obtenerUsuarios().catch(() => []),
      obtenerCajas({ soloActivas: false }).catch(() => []),
    ]);
    const userMap = new Map<string, { nombre: string; username: string }>();
    for (const u of usuarios) {
      if (u.id) {
        userMap.set(String(u.id), {
          nombre: u.nombre_completo || 'Cajero',
          username: (u.correo || '').split('@')[0] || 'cajero',
        });
      }
    }
    const cajaLabelMap = new Map<string, string>();
    for (const cj of cajasDb) {
      const label = cj.nombre?.toUpperCase().includes('CAJA')
        ? cj.nombre
        : `Caja #${cj.codigo || cj.id} - ${cj.nombre}`;
      if (cj.id) cajaLabelMap.set(String(cj.id), label);
      if (cj.codigo) {
        cajaLabelMap.set(String(cj.codigo), label);
        cajaLabelMap.set(`caja-${cj.codigo}`, label);
      }
    }

    const buildQuery = (cols: string) => {
      let q = sb
        .from('cierres_caja')
        .select(cols)
        .order('abierta_en', { ascending: false })
        .limit(150);
      if (params?.signal) q = q.abortSignal(params.signal);
      return q;
    };
    let { data, error } = await buildQuery('*, perfiles!cajero_id(nombre_completo, correo)');
    if (error) {
      const fallbackStar = await buildQuery('*');
      if (!fallbackStar.error) {
        data = fallbackStar.data;
        error = null;
      } else {
        const fallbackCols = await buildQuery(CIERRE_COLUMNS);
        if (!fallbackCols.error) {
          data = fallbackCols.data;
          error = null;
        }
      }
    }
    const remote = (data ?? []).map((r) => mapCierreRowWithPerfil(r, userMap, cajaLabelMap));
    const seen = new Set(remote.map((r) => r.id));
    const merged = [...remote, ...local.filter((l) => !seen.has(l.id))];
    return depurarSesionesAbiertasObsoletas(merged, sb);
  } catch {
    return depurarSesionesAbiertasObsoletas(local, null);
  }
}

export type NuevoCierreInput = {
  codigo: string;
  caja_id: string;
  cajero_id?: string | null;
  cajero_nombre?: string;
  cajero_username?: string;
  caja_label?: string;
  sucursal_id?: string | null;
  monto_apertura: number;
  monto_esperado: number;
  monto_real: number;
  monto_diferencia: number;
  total_ventas?: number;
  total_efectivo?: number;
  total_tarjeta?: number;
  total_transferencia?: number;
  estado: 'abierta' | 'cerrada';
  notes?: string;
};

export async function guardarCierreCaja(datos: NuevoCierreInput): Promise<CierreCaja> {
  const now = new Date();
  const closure: CashClosure = {
    id: `cc-${Date.now()}`,
    code: datos.codigo,
    cashRegisterId: datos.caja_id,
    cashRegisterLabel: datos.caja_label ?? `Caja ${datos.caja_id}`,
    userId: String(datos.cajero_id ?? '0'),
    username: datos.cajero_username ?? '',
    userName: datos.cajero_nombre ?? '',
    expectedCash: datos.monto_esperado,
    countedCash: datos.monto_real,
    difference: datos.monto_diferencia,
    totalSales: datos.total_ventas ?? 0,
    totalCash: datos.total_efectivo ?? 0,
    totalCard: datos.total_tarjeta ?? 0,
    totalTransfer: datos.total_transferencia ?? 0,
    cardCount: 0,
    transferCount: 0,
    totalCheque: 0,
    chequeCount: 0,
    totalCredit: 0,
    creditCount: 0,
    openedAt: now.toISOString(),
    closedAt: datos.estado === 'cerrada' ? now.toISOString() : '',
    date: now.toISOString().slice(0, 10),
    baseCash: datos.monto_apertura,
    status: datos.estado,
    notes: datos.notes,
  };

  // Guardar SIEMPRE en almacenamiento local primero para garantizar cero pérdida de datos
  saveCashClosure(closure);

  if (isTestEnv || !isSupabaseConfigured()) {
    return localToDb(closure);
  }

  try {
    const sb = getSupabase();
    const cajeroUuid = esUuid(datos.cajero_id) ? datos.cajero_id : null;
    const sucursalUuid = esUuid(datos.sucursal_id) ? datos.sucursal_id : null;

    const insertPayload: Record<string, unknown> = {
      codigo: datos.codigo,
      caja_id: datos.caja_id,
      cajero_id: cajeroUuid || (datos.cajero_id ? String(datos.cajero_id) : null),
      cajero_nombre: datos.cajero_nombre || null,
      cajero_username: datos.cajero_username || null,
      caja_label: datos.caja_label || null,
      notes: datos.notes || null,
      sucursal_id: sucursalUuid,
      monto_apertura: datos.monto_apertura,
      monto_esperado: datos.monto_esperado,
      monto_real: datos.monto_real,
      monto_diferencia: datos.monto_diferencia,
      total_ventas: datos.total_ventas ?? 0,
      total_efectivo: datos.total_efectivo ?? 0,
      total_tarjeta: datos.total_tarjeta ?? 0,
      total_transferencia: datos.total_transferencia ?? 0,
      estado: datos.estado,
      cerrada_en: datos.estado === 'cerrada' ? now.toISOString() : null,
    };

    let { data, error } = await sb
      .from('cierres_caja')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      const fallbackPayload = {
        codigo: datos.codigo,
        caja_id: datos.caja_id,
        cajero_id: cajeroUuid,
        sucursal_id: sucursalUuid,
        monto_apertura: datos.monto_apertura,
        monto_esperado: datos.monto_esperado,
        monto_real: datos.monto_real,
        monto_diferencia: datos.monto_diferencia,
        total_ventas: datos.total_ventas ?? 0,
        total_efectivo: datos.total_efectivo ?? 0,
        total_tarjeta: datos.total_tarjeta ?? 0,
        total_transferencia: datos.total_transferencia ?? 0,
        estado: datos.estado,
        cerrada_en: datos.estado === 'cerrada' ? now.toISOString() : null,
      };
      const retry = await sb.from('cierres_caja').insert(fallbackPayload).select(CIERRE_COLUMNS).single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      // Eliminar el registro temporal 'cc-...' para que nunca quede huérfano como sesión abierta
      removeCashClosure(closure.id);
      const enrichedData: CierreCaja = {
        ...(data as CierreCaja),
        cajero_nombre: (data as CierreCaja).cajero_nombre || datos.cajero_nombre,
        cajero_username: (data as CierreCaja).cajero_username || datos.cajero_username,
        caja_label: (data as CierreCaja).caja_label || datos.caja_label,
        notes: (data as CierreCaja).notes || datos.notes,
      };
      persistirRegistroCierre(enrichedData, {
        userName: datos.cajero_nombre,
        username: datos.cajero_username,
        cashRegisterLabel: datos.caja_label,
        notes: datos.notes,
        baseCash: datos.monto_apertura,
      });
      return enrichedData;
    }
  } catch (err) {
    console.warn('Advertencia al insertar cierre en Supabase (manteniendo respaldo local):', err);
  }

  return localToDb(closure);
}

export type NuevoInicioCajaInput = {
  codigo?: string;
  caja_id: string;
  caja_label?: string;
  cajero_id?: string | null;
  cajero_nombre?: string;
  cajero_username?: string;
  sucursal_id?: string | null;
  monto_apertura: number;
  notes?: string;
  forzarNueva?: boolean;
};

export async function obtenerSesionAbiertaDeUsuario(
  cajeroId?: string | null,
  cajeroNombre?: string | null,
  cajeroUsername?: string | null
): Promise<CierreCaja | null> {
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;

  const targetUserPrefix = cajeroUsername ? String(cajeroUsername).split('@')[0].trim().toLowerCase() : '';

  return (
    abiertas.find((c) => {
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchNombre = Boolean(cajeroNombre && rowNombre && isSameCashierName(rowNombre, cajeroNombre));
      const rowUsername = String((c as any).cajero_username || (c as any).username || '').split('@')[0].trim().toLowerCase();
      const matchUsername = Boolean(targetUserPrefix && rowUsername && targetUserPrefix === rowUsername);
      return matchId || matchNombre || matchUsername;
    }) || null
  );
}

export async function iniciarCaja(datos: NuevoInicioCajaInput): Promise<CierreCaja> {
  const ids = await expandCajaIds(datos.caja_id);

  // 1. Si no se fuerza nueva apertura, verificar si este usuario ya tiene una sesión abierta activa hoy
  if (!datos.forzarNueva) {
    const sesionPropia = await obtenerSesionAbiertaDeUsuario(
      datos.cajero_id,
      datos.cajero_nombre,
      datos.cajero_username
    );
    if (sesionPropia) {
      persistirRegistroCierre(sesionPropia, {
        userName: datos.cajero_nombre || sesionPropia.cajero_nombre || undefined,
        username: datos.cajero_username || sesionPropia.cajero_username || undefined,
        cashRegisterLabel: datos.caja_label || sesionPropia.caja_label || undefined,
        notes: datos.notes,
        baseCash: sesionPropia.monto_apertura,
      });
      return sesionPropia;
    }

    const abiertas = await listarSesionesAbiertas();
    const ocupadaPorOtro = abiertas.find((c) => {
      if (!ids.has(String(c.caja_id))) return false;
      const isMe =
        (datos.cajero_id && c.cajero_id && String(c.cajero_id) === String(datos.cajero_id)) ||
        (datos.cajero_nombre &&
          (c as any).cajero_nombre &&
          isSameCashierName((c as any).cajero_nombre, datos.cajero_nombre));
      return !isMe;
    });

    if (ocupadaPorOtro) {
      const nombreOtro = (ocupadaPorOtro as any).cajero_nombre || 'otro cajero';
      throw new Error(`La registradora seleccionada ya se encuentra en uso por ${nombreOtro}.`);
    }
  }

  // 2. Cerrar únicamente sesiones abiertas previas que pertenezcan a este mismo cajero
  const sb = getSafeSupabase();
  if (sb && isSupabaseConfigured()) {
    try {
      const nowIso = new Date().toISOString();
      if (datos.cajero_id && esUuid(datos.cajero_id)) {
        await sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: nowIso })
          .eq('cajero_id', datos.cajero_id)
          .eq('estado', 'abierta');
      }
      if (datos.cajero_nombre) {
        await sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: nowIso })
          .ilike('cajero_nombre', datos.cajero_nombre.trim())
          .eq('estado', 'abierta');
      }
    } catch {
      // ignore
    }
  }

  // Cerrar en localStorage sesiones previas abiertas de este mismo cajero
  try {
    const nowIso = new Date().toISOString();
    const currentLocal = getCashClosures();
    for (const loc of currentLocal) {
      if (loc.status !== 'abierta') continue;
      const sameId = datos.cajero_id && loc.userId && String(loc.userId) === String(datos.cajero_id);
      const sameName = Boolean(
        datos.cajero_nombre && loc.userName && isSameCashierName(loc.userName, datos.cajero_nombre)
      );
      if (sameId || sameName) {
        saveCashClosure({
          ...loc,
          status: 'cerrada',
          closedAt: nowIso,
        });
      }
    }
  } catch {
    // ignore
  }

  // 4. Guardar directamente en Supabase y localmente con el monto exacto ingresado
  const code = datos.codigo || `AP-${Date.now().toString().slice(-6)}`;
  const saved = await guardarCierreCaja({
    codigo: code,
    caja_id: datos.caja_id,
    cajero_id: datos.cajero_id,
    cajero_nombre: datos.cajero_nombre,
    cajero_username: datos.cajero_username,
    caja_label: datos.caja_label,
    sucursal_id: datos.sucursal_id,
    monto_apertura: datos.monto_apertura,
    monto_esperado: datos.monto_apertura,
    monto_real: datos.monto_apertura,
    monto_diferencia: 0,
    total_ventas: 0,
    total_efectivo: 0,
    total_tarjeta: 0,
    total_transferencia: 0,
    estado: 'abierta',
    notes: datos.notes,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
  }

  return saved;
}

async function listarSesionesAbiertas(): Promise<CierreCaja[]> {
  const sb = getSafeSupabase();
  if (!sb) {
    const localAll = depurarSesionesAbiertasObsoletas(getCashClosures().map(localToDb), null);
    return localAll.filter((c) => isOpenStatus(c.estado));
  }
  try {
    const [usuarios, cajasDb, queryRes] = await Promise.all([
      obtenerUsuarios().catch(() => []),
      obtenerCajas({ soloActivas: false }).catch(() => []),
      sb
        .from('cierres_caja')
        .select('*, perfiles!cajero_id(nombre_completo, correo)')
        .eq('estado', 'abierta')
        .order('abierta_en', { ascending: false })
        .limit(50),
    ]);

    const userMap = new Map<string, { nombre: string; username: string }>();
    for (const u of usuarios) {
      if (u.id) {
        userMap.set(String(u.id), {
          nombre: u.nombre_completo || 'Cajero',
          username: (u.correo || '').split('@')[0] || 'cajero',
        });
      }
    }
    const cajaLabelMap = new Map<string, string>();
    for (const cj of cajasDb) {
      const label = cj.nombre?.toUpperCase().includes('CAJA')
        ? cj.nombre
        : `Caja #${cj.codigo || cj.id} - ${cj.nombre}`;
      if (cj.id) cajaLabelMap.set(String(cj.id), label);
      if (cj.codigo) {
        cajaLabelMap.set(String(cj.codigo), label);
        cajaLabelMap.set(`caja-${cj.codigo}`, label);
      }
    }

    let rows: any[] = queryRes.data ?? [];
    if (queryRes.error) {
      const fallbackStar = await sb
        .from('cierres_caja')
        .select('*')
        .eq('estado', 'abierta')
        .order('abierta_en', { ascending: false })
        .limit(50);
      if (!fallbackStar.error) {
        rows = fallbackStar.data ?? [];
      } else {
        const fallbackCols = await sb
          .from('cierres_caja')
          .select(CIERRE_COLUMNS)
          .eq('estado', 'abierta')
          .order('abierta_en', { ascending: false })
          .limit(50);
        rows = fallbackCols.data ?? [];
      }
    }

    const remote = rows.map((r) => mapCierreRowWithPerfil(r, userMap, cajaLabelMap));
    const local = getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
    const seen = new Set(remote.map((c) => c.id));
    const merged = [...remote, ...local.filter((c) => !seen.has(c.id))];
    const cleaned = depurarSesionesAbiertasObsoletas(merged, sb);
    return cleaned.filter((c) => isOpenStatus(c.estado));
  } catch {
    const localAll = depurarSesionesAbiertasObsoletas(getCashClosures().map(localToDb), null);
    return localAll.filter((c) => isOpenStatus(c.estado));
  }
}

/** Cierra todos los turnos abiertos de una caja (código o UUID). */
export async function cerrarSesionesAbiertasDeCaja(cajaId?: string): Promise<number> {
  const ids = await expandCajaIds(cajaId);
  const abiertas = await listarSesionesAbiertas();
  const toClose = abiertas.filter((c) => {
    if (ids.size === 0) return true;
    return ids.has(String(c.caja_id));
  });
  if (toClose.length === 0) return 0;

  const now = new Date().toISOString();
  const sb = getSafeSupabase();
  if (sb) {
    const uuids = toClose.map((c) => c.id).filter(esUuid);
    if (uuids.length > 0) {
      const { error } = await sb
        .from('cierres_caja')
        .update({ estado: 'cerrada', cerrada_en: now })
        .in('id', uuids)
        .eq('estado', 'abierta');
      if (error) throw error;
    }
  }

  for (const row of toClose) {
    const existing = getCashClosures().find((c) => c.id === row.id);
    if (existing) {
      saveCashClosure({
        ...existing,
        status: 'cerrada',
        closedAt: now,
      });
    }
  }
  return toClose.length;
}

export async function obtenerCajaAbierta(
  cajaId?: string,
  cajeroId?: string,
  cajeroNombre?: string,
  cierreId?: string
): Promise<CierreCaja | null> {
  const ids = await expandCajaIds(cajaId);
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;

  // 0. Si se especificó el ID exacto del turno abierto (cierreId), priorizarlo
  if (cierreId) {
    const byCierre = abiertas.find((c) => String(c.id) === String(cierreId));
    if (byCierre) return byCierre;
  }

  // 1. Coincidencia estricta: misma caja y mismo cajero (por ID o por nombre)
  if (ids.size > 0 && (cajeroId || cajeroNombre)) {
    const matchExact = abiertas.find((c) => {
      const matchCaja = ids.has(String(c.caja_id));
      if (!matchCaja) return false;
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchName = Boolean(cajeroNombre && rowNombre && isSameCashierName(rowNombre, cajeroNombre));
      return matchId || matchName;
    });
    if (matchExact) return matchExact;
  }

  // 2. Coincidencia por cajero (si el usuario ya tiene su caja abierta en cualquier registradora)
  if (cajeroId || cajeroNombre) {
    const matchUser = abiertas.find((c) => {
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchName = Boolean(cajeroNombre && rowNombre && isSameCashierName(rowNombre, cajeroNombre));
      return matchId || matchName;
    });
    if (matchUser) return matchUser;
  }

  // 3. Coincidencia por caja (permite al administrador consultar o cerrar cualquier caja activa)
  if (ids.size > 0) {
    const matchCaja = abiertas.find((c) => ids.has(String(c.caja_id)));
    if (matchCaja) return matchCaja;
  }

  return null;
}

export interface ResumenCajaAbierta {
  cierre_id?: string;
  caja_id: string;
  caja_label: string;
  cajero_id?: string | null;
  cajero_nombre?: string;
  cajero_username?: string;
  abierta_en: string;
  monto_apertura: number;
  total_ventas: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_transferencia: number;
  total_otros: number;
  total_entradas: number;
  total_retiros: number;
  total_devoluciones: number;
  monto_esperado: number;
  estado: string;
}

export async function calcularResumenCajaAbierta(
  cajaId: string,
  cajeroId?: string,
  cajeroNombre?: string,
  cierreId?: string
): Promise<ResumenCajaAbierta> {
  const ids = await expandCajaIds(cajaId);
  const abierta = await obtenerCajaAbierta(cajaId, cajeroId, cajeroNombre, cierreId);
  if (abierta?.caja_id) {
    const extraIds = await expandCajaIds(abierta.caja_id);
    extraIds.forEach((x) => ids.add(x));
  }
  const apertura = Number(abierta?.monto_apertura ?? 0);
  const desde = abierta?.abierta_en || `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const effectiveCajeroId = abierta ? abierta.cajero_id || undefined : cajeroId;
  const effectiveCajeroNombre = abierta
    ? (abierta as (CierreCaja & { cajero_nombre?: string }) | null)?.cajero_nombre || undefined
    : cajeroNombre;

  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencia = 0;
  let totalOtros = 0;

  try {
    const searchCajaIds = Array.from(ids);
    const [ventasPorCaja, ventasPorCajero] = await Promise.all([
      obtenerVentasTurno({
        cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
        desde,
        limite: 1000,
      }).catch((): VentaConDetalle[] => []),
      effectiveCajeroId
        ? obtenerVentasTurno({
            cajeroId: effectiveCajeroId,
            desde,
            limite: 1000,
          }).catch((): VentaConDetalle[] => [])
        : Promise.resolve([] as VentaConDetalle[]),
    ]);

    const seenVentaIds = new Set<string>();
    const ventas: VentaConDetalle[] = [];
    const targetNameNorm = (effectiveCajeroNombre || '').trim().toLowerCase();

    for (const v of [...ventasPorCaja, ...ventasPorCajero]) {
      if (seenVentaIds.has(v.id)) continue;
      const matchesBox = ids.has(String(v.caja_id ?? ''));
      const matchesId =
        effectiveCajeroId && v.cajero_id && String(v.cajero_id) === String(effectiveCajeroId);
      const matchesName =
        targetNameNorm &&
        v.cajero_nombre &&
        v.cajero_nombre.trim().toLowerCase() === targetNameNorm;

      // Si el turno tiene un cajero específico, priorizar sus propias ventas o las de su caja
      if (effectiveCajeroId || targetNameNorm) {
        if (matchesId || matchesName || (matchesBox && !v.cajero_id)) {
          ventas.push(v);
          seenVentaIds.add(v.id);
        } else if (matchesBox && ventasPorCajero.length === 0) {
          ventas.push(v);
          seenVentaIds.add(v.id);
        }
      } else if (matchesBox) {
        ventas.push(v);
        seenVentaIds.add(v.id);
      }
    }

    // Complementar con ventas locales de espejo que coincidan con la caja o el cajero
    try {
      const localVentas = getLocalVentas();
      const desdeTime = desde ? new Date(desde).getTime() : 0;
      for (const lv of localVentas) {
        if (seenVentaIds.has(lv.id)) continue;
        if (lv.estado === 'anulada' || (lv.estado as string) === 'cancelled') continue;
        const matchesBox = ids.has(String(lv.caja_id ?? ''));
        const matchesId =
          effectiveCajeroId && lv.cajero_id && String(lv.cajero_id) === String(effectiveCajeroId);
        const matchesName =
          targetNameNorm &&
          lv.cajero_nombre &&
          lv.cajero_nombre.trim().toLowerCase() === targetNameNorm;
        if (!matchesBox && !matchesId && !matchesName) continue;
        if (desdeTime > 0 && lv.creado_en) {
          const lt = new Date(lv.creado_en).getTime();
          if (!isNaN(lt) && lt < desdeTime - 60_000) continue;
        }
        ventas.push(lv);
        seenVentaIds.add(lv.id);
      }
    } catch {
      // ignore
    }

    for (const v of ventas) {
      totalVentas += Number(v.monto_total) || 0;
      totalEfectivo += Number(v.monto_efectivo) || 0;
      totalTarjeta += Number(v.monto_tarjeta) || 0;
      totalTransferencia += Number(v.monto_transferencia) || 0;
      totalOtros += Number(v.monto_credito) || 0;
    }
  } catch {
    totalVentas = Number(abierta?.total_ventas ?? 0);
    totalEfectivo = Number(abierta?.total_efectivo ?? 0);
    totalTarjeta = Number(abierta?.total_tarjeta ?? 0);
    totalTransferencia = Number(abierta?.total_transferencia ?? 0);
  }

  let totalEntradas = 0;
  let totalRetiros = 0;
  let totalDevoluciones = 0;
  const countedMovementKeys = new Set<string>();

  try {
    const movimientos = await obtenerMovimientosCaja(abierta?.id, abierta?.caja_id || cajaId);
    const desdeTime = desde ? new Date(desde).getTime() : 0;
    for (const m of movimientos) {
      if (abierta?.id && m.cierre_id && String(m.cierre_id) !== String(abierta.id)) continue;
      if (m.caja_id && !ids.has(String(m.caja_id))) continue;
      if (desdeTime > 0 && m.creado_en) {
        const mt = new Date(m.creado_en).getTime();
        if (!isNaN(mt) && mt < desdeTime - 5000) continue;
      }
      const monto = Number(m.monto || 0);
      if (m.concepto) {
        countedMovementKeys.add(`${m.tipo}-${monto}-${m.concepto.trim().toLowerCase()}`);
      }
      if (m.tipo === 'entrada' || m.tipo === 'aporte') {
        totalEntradas += monto;
      } else if (m.tipo === 'salida' || m.tipo === 'retiro' || m.tipo === 'gasto') {
        if (m.categoria === 'Devolución' || m.concepto?.toLowerCase().includes('devolución')) {
          totalDevoluciones += monto;
        } else {
          totalRetiros += monto;
        }
      }
    }
  } catch {
    // Ignorar si falla la carga de movimientos
  }

  // Complementar con gastos locales y de POS para que nunca falte un gasto registrado
  const desdeTime = desde ? new Date(desde).getTime() : 0;
  const desdeDate = desde ? desde.slice(0, 10) : new Date().toISOString().slice(0, 10);

  try {
    const rawPosExp = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_pos_expenses') : null;
    if (rawPosExp) {
      const posExps = JSON.parse(rawPosExp) as any[];
      for (const exp of posExps) {
        if (!exp.cajaId || !ids.has(String(exp.cajaId))) continue;
        if (desdeTime > 0 && exp.created_at) {
          const et = new Date(exp.created_at).getTime();
          if (!isNaN(et) && et < desdeTime - 5000) continue;
        } else if (exp.date && exp.date < desdeDate) {
          continue;
        }
        const key = `gasto-${exp.amount}-${(exp.description || '').trim().toLowerCase()}`;
        if (!countedMovementKeys.has(key)) {
          totalRetiros += Number(exp.amount || 0);
          countedMovementKeys.add(key);
        }
      }
    }

    const rawGastos = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_gastos_local') : null;
    if (rawGastos) {
      const localGastos = JSON.parse(rawGastos) as any[];
      for (const g of localGastos) {
        if (!g.caja_id || !ids.has(String(g.caja_id))) continue;
        if (desdeTime > 0 && (g.created_at || g.creado_en)) {
          const gt = new Date(g.created_at || g.creado_en).getTime();
          if (!isNaN(gt) && gt < desdeTime - 5000) continue;
        } else if (g.date && g.date < desdeDate) {
          continue;
        }
        if (
          g.status !== 'rejected' &&
          (g.paymentMethod?.toLowerCase() === 'efectivo' || g.paymentMethod?.toLowerCase() === 'caja_chica')
        ) {
          const key = `gasto-${g.monto ?? g.amount}-${(g.descripcion || g.description || '').trim().toLowerCase()}`;
          if (!countedMovementKeys.has(key)) {
            totalRetiros += Number((g.monto ?? g.amount) || 0);
            countedMovementKeys.add(key);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Complementar con devoluciones de venta en efectivo del período
  try {
    const rawDevs = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_devoluciones_local') : null;
    if (rawDevs) {
      const localDevs = JSON.parse(rawDevs) as any[];
      for (const dev of localDevs) {
        if (dev.caja_id && !ids.has(String(dev.caja_id))) continue;
        if (dev.estado !== 'rechazada' && (dev.metodo_reembolso === 'efectivo' || dev.metodo_reembolso === 'cash')) {
          const devTime = dev.creado_en ? new Date(dev.creado_en).getTime() : 0;
          if (desdeTime > 0 && devTime > 0 && devTime < desdeTime - 5000) continue;
          const key = `salida-${dev.monto_total}-devolución`;
          if (!countedMovementKeys.has(key)) {
            totalDevoluciones += Number(dev.monto_total || 0);
            countedMovementKeys.add(key);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Si Supabase está configurado, consultar también gastos y devoluciones en servidor para sincronización multi-caja
  const sbCierre = getSafeSupabase();
  if (sbCierre && isSupabaseConfigured()) {
    try {
      const { data: remoteGastos } = await sbCierre
        .from('gastos')
        .select('id, descripcion, monto, metodo_pago, creado_en, caja_id')
        .eq('estado', 'aprobado')
        .gte('creado_en', `${desdeDate}T00:00:00`);

      for (const g of remoteGastos ?? []) {
        // Solo considerar si el gasto pertenece explícitamente a esta caja y ocurrió dentro del turno
        if (!g.caja_id || !ids.has(String(g.caja_id))) continue;
        if (desdeTime > 0 && g.creado_en) {
          const gt = new Date(g.creado_en).getTime();
          if (!isNaN(gt) && gt < desdeTime - 5000) continue;
        }
        const method = String(g.metodo_pago ?? 'efectivo').toLowerCase();
        if (method === 'efectivo' || method === 'caja_chica') {
          const key = `gasto-${g.monto}-${(g.descripcion || '').trim().toLowerCase()}`;
          if (!countedMovementKeys.has(key)) {
            totalRetiros += Number(g.monto || 0);
            countedMovementKeys.add(key);
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const { data: remoteDevs } = await sbCierre
        .from('devoluciones')
        .select('id, monto_total, metodo_reembolso, estado, creado_en, caja_id')
        .neq('estado', 'rechazada')
        .gte('creado_en', `${desdeDate}T00:00:00`);

      for (const d of remoteDevs ?? []) {
        // Solo considerar si la devolución no pertenece a otra caja y ocurrió dentro del turno
        if (d.caja_id && !ids.has(String(d.caja_id))) continue;
        if (desdeTime > 0 && d.creado_en) {
          const dt = new Date(d.creado_en).getTime();
          if (!isNaN(dt) && dt < desdeTime - 5000) continue;
        }
        const m = String(d.metodo_reembolso ?? '').toLowerCase();
        if (m === 'efectivo' || m === 'cash') {
          const key = `salida-${d.monto_total}-devolución`;
          if (!countedMovementKeys.has(key)) {
            totalDevoluciones += Number(d.monto_total || 0);
            countedMovementKeys.add(key);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const montoEsperado = Math.round((apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones) * 100) / 100;

  return {
    cierre_id: abierta?.id,
    caja_id: abierta?.caja_id || cajaId,
    caja_label: `Caja #${abierta?.caja_id || cajaId}`,
    cajero_id: abierta?.cajero_id,
    cajero_nombre: (abierta as CierreCaja & { cajero_nombre?: string })?.cajero_nombre,
    cajero_username: (abierta as CierreCaja & { cajero_username?: string })?.cajero_username,
    abierta_en: abierta?.abierta_en || new Date().toISOString(),
    monto_apertura: apertura,
    total_ventas: totalVentas,
    total_efectivo: totalEfectivo,
    total_tarjeta: totalTarjeta,
    total_transferencia: totalTransferencia,
    total_otros: totalOtros,
    total_entradas: totalEntradas,
    total_retiros: totalRetiros,
    total_devoluciones: totalDevoluciones,
    monto_esperado: montoEsperado,
    estado: abierta ? 'abierta' : 'en_curso',
  };
}

export interface CerrarTurnoInput {
  cierre_id?: string;
  caja_id: string;
  caja_label?: string;
  cajero_id?: string | null;
  cajero_nombre?: string;
  cajero_username?: string;
  usuario_cierre_id?: string | null;
  usuario_cierre_nombre?: string;
  monto_apertura: number;
  monto_esperado: number;
  monto_real: number;
  monto_diferencia: number;
  total_ventas?: number;
  total_efectivo?: number;
  total_tarjeta?: number;
  total_transferencia?: number;
  total_otros?: number;
  total_entradas?: number;
  total_retiros?: number;
  total_devoluciones?: number;
  notes?: string;
}

export async function cerrarTurnoCaja(input: CerrarTurnoInput): Promise<CierreCaja> {
  const todas = await obtenerCierresCaja();
  const cajaIds = await expandCajaIds(input.caja_id);
  let abierta: CierreCaja | null = null;
  if (input.cierre_id) {
    abierta = todas.find((c) => c.id === input.cierre_id) || null;
  }
  if (!abierta) {
    abierta = await obtenerCajaAbierta(input.caja_id, input.cajero_id ?? undefined, input.cajero_nombre);
  }
  if (abierta?.caja_id) {
    const extraBoxIds = await expandCajaIds(abierta.caja_id);
    extraBoxIds.forEach((x) => cajaIds.add(x));
  }

  // Prevenir cierres duplicados
  if (abierta && abierta.estado === 'cerrada') {
    throw new Error('Esta sesión de caja ya fue cerrada previamente.');
  }

  const now = new Date().toISOString();
  const closureCode = `CC-${Date.now().toString().slice(-8)}`;
  const extraUi = {
    userName: input.cajero_nombre,
    username: input.cajero_username,
    cashRegisterLabel: input.caja_label,
    notes: input.notes,
    baseCash: input.monto_apertura,
  };

  const updateFields: Record<string, unknown> = {
    codigo: closureCode,
    monto_apertura: input.monto_apertura,
    monto_esperado: input.monto_esperado,
    monto_real: input.monto_real,
    monto_diferencia: input.monto_diferencia,
    total_ventas: input.total_ventas ?? 0,
    total_efectivo: input.total_efectivo ?? 0,
    total_tarjeta: input.total_tarjeta ?? 0,
    total_transferencia: input.total_transferencia ?? 0,
    estado: 'cerrada' as const,
    cerrada_en: now,
  };

  // Cerrar cualquier sesión local abierta de este cajero o caja
  const closeLocalOpenSessions = () => {
    try {
      const current = getCashClosures();
      for (const c of current) {
        if (c.status !== 'abierta') continue;
        const matchId = abierta?.id && c.id === abierta.id;
        const matchUser =
          input.cajero_id && c.userId && String(c.userId) === String(input.cajero_id);
        const matchName = Boolean(
          input.cajero_nombre && c.userName && isSameCashierName(c.userName, input.cajero_nombre)
        );
        const matchBox = Boolean(c.cashRegisterId && cajaIds.has(String(c.cashRegisterId)));
        if (matchId || matchUser || matchName || matchBox) {
          if (String(c.id).startsWith('cc-') && abierta?.id && esUuid(abierta.id)) {
            removeCashClosure(c.id);
          } else {
            saveCashClosure({
              ...c,
              status: 'cerrada',
              closedAt: now,
              expectedCash: input.monto_esperado,
              countedCash: input.monto_real,
              difference: input.monto_diferencia,
              totalSales: input.total_ventas ?? c.totalSales,
              totalCash: input.total_efectivo ?? c.totalCash,
              totalCard: input.total_tarjeta ?? c.totalCard,
              totalTransfer: input.total_transferencia ?? c.totalTransfer,
              baseCash: input.monto_apertura,
              notes: input.notes || c.notes,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  };

  // Cerrar sesiones abiertas residuales de este cajero o de esta caja en Supabase
  const closeRemoteResidualSessions = async (excludeId?: string) => {
    const sb = getSafeSupabase();
    if (!sb || !isSupabaseConfigured()) return;
    try {
      if (input.cajero_id && esUuid(input.cajero_id)) {
        let q = sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: now })
          .eq('cajero_id', input.cajero_id)
          .eq('estado', 'abierta');
        if (excludeId && esUuid(excludeId)) q = q.neq('id', excludeId);
        await q;
      }
      if (input.cajero_nombre) {
        let q = sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: now })
          .ilike('cajero_nombre', input.cajero_nombre.trim())
          .eq('estado', 'abierta');
        if (excludeId && esUuid(excludeId)) q = q.neq('id', excludeId);
        await q;
      }
      if (cajaIds.size > 0) {
        let q = sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: now })
          .in('caja_id', Array.from(cajaIds))
          .eq('estado', 'abierta');
        if (excludeId && esUuid(excludeId)) q = q.neq('id', excludeId);
        await q;
      }
    } catch {
      // ignore
    }
  };

  if (abierta?.id) {
    if (!isSupabaseConfigured() || !esUuid(abierta.id)) {
      await closeRemoteResidualSessions();
      closeLocalOpenSessions();
      const current = getCashClosures();
      const existing = current.find((c) => c.id === abierta.id);
      if (existing) {
        const closed: CashClosure = {
          ...existing,
          code: closureCode,
          expectedCash: input.monto_esperado,
          countedCash: input.monto_real,
          difference: input.monto_diferencia,
          totalSales: input.total_ventas ?? existing.totalSales,
          totalCash: input.total_efectivo ?? existing.totalCash,
          totalCard: input.total_tarjeta ?? existing.totalCard,
          totalTransfer: input.total_transferencia ?? existing.totalTransfer,
          status: 'cerrada',
          closedAt: now,
          notes: input.notes,
          userName: input.cajero_nombre || existing.userName,
          username: input.cajero_username || existing.username,
          cashRegisterLabel: input.caja_label || existing.cashRegisterLabel,
          baseCash: input.monto_apertura,
        };
        saveCashClosure(closed);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
        }
        return localToDb(closed);
      }
    } else {
      try {
        const sbClient = getSupabase();
        let { data, error } = await sbClient
          .from('cierres_caja')
          .update(updateFields)
          .eq('id', abierta.id)
          .select('*')
          .single();
        if (error) {
          const { codigo: _omitCodigo, ...withoutCode } = updateFields;
          const retry = await sbClient
            .from('cierres_caja')
            .update(withoutCode)
            .eq('id', abierta.id)
            .select(CIERRE_COLUMNS)
            .single();
          data = retry.data;
          error = retry.error;
        }
        await closeRemoteResidualSessions(abierta.id);
        closeLocalOpenSessions();
        if (!error && data) {
          persistirRegistroCierre(data as CierreCaja, extraUi);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
          }
          return data as CierreCaja;
        }
      } catch (err) {
        console.warn('Error al actualizar cierre en Supabase (usando cierre local):', err);
      }

      // Si falló Supabase, cerrar en memoria local para la sesión exacta
      closeLocalOpenSessions();
      const current = getCashClosures();
      const existing = current.find((c) => c.id === abierta.id);
      const closed: CashClosure = {
        id: abierta.id,
        code: closureCode,
        cashRegisterId: input.caja_id,
        cashRegisterLabel: input.caja_label || existing?.cashRegisterLabel || `Caja ${input.caja_id}`,
        userId: String(input.cajero_id ?? existing?.userId ?? '0'),
        username: input.cajero_username || existing?.username || '',
        userName: input.cajero_nombre || existing?.userName || 'Cajero',
        expectedCash: input.monto_esperado,
        countedCash: input.monto_real,
        difference: input.monto_diferencia,
        totalSales: input.total_ventas ?? existing?.totalSales ?? 0,
        totalCash: input.total_efectivo ?? existing?.totalCash ?? 0,
        totalCard: input.total_tarjeta ?? existing?.totalCard ?? 0,
        totalTransfer: input.total_transferencia ?? existing?.totalTransfer ?? 0,
        cardCount: existing?.cardCount ?? 0,
        transferCount: existing?.transferCount ?? 0,
        totalCheque: existing?.totalCheque ?? 0,
        chequeCount: existing?.chequeCount ?? 0,
        totalCredit: existing?.totalCredit ?? 0,
        creditCount: existing?.creditCount ?? 0,
        status: 'cerrada',
        openedAt: existing?.openedAt || abierta.abierta_en || now,
        closedAt: now,
        date: now.slice(0, 10),
        notes: input.notes,
        baseCash: input.monto_apertura,
      };
      saveCashClosure(closed);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
      }
      return localToDb(closed);
    }
  }

  await closeRemoteResidualSessions();
  closeLocalOpenSessions();
  const saved = await guardarCierreCaja({
    codigo: closureCode,
    caja_id: input.caja_id,
    caja_label: input.caja_label,
    cajero_id: input.cajero_id,
    cajero_nombre: input.cajero_nombre,
    cajero_username: input.cajero_username,
    monto_apertura: input.monto_apertura,
    monto_esperado: input.monto_esperado,
    monto_real: input.monto_real,
    monto_diferencia: input.monto_diferencia,
    total_ventas: input.total_ventas ?? 0,
    total_efectivo: input.total_efectivo ?? 0,
    total_tarjeta: input.total_tarjeta ?? 0,
    total_transferencia: input.total_transferencia ?? 0,
    estado: 'cerrada',
    notes: input.notes,
  });
  persistirRegistroCierre(saved, extraUi);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
  }
  return saved;
}


