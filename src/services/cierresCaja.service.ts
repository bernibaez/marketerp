<<<<<<< HEAD
import {
  getSafeSupabaseClient,
  isSafeSupabaseConfigured,
} from './supabaseSafeClient';
import {
  CIERRE_COLUMNS,
  CIERRE_COLUMNS_LEGACY,
  type CierreCaja,
} from '@/types/database';
import {
  getCashClosures,
  removeCashClosure,
  saveCashClosure,
  type CashClosure,
} from '@/lib/cashClosureStore';
import { obtenerCajas } from './cajas.service';
import { obtenerVentasTurno } from './ventas.service';
=======
import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { CIERRE_COLUMNS, type CierreCaja } from '@/types/database';
import { getCashClosures, removeCashClosure, saveCashClosure, type CashClosure } from '@/lib/cashClosureStore';
import { isSameCashierName } from '@/lib/cashRegisters';
import { obtenerCajas } from './cajas.service';
import { obtenerUsuarios } from './usuarios.service';
import {
  obtenerVentasTurno,
  getLocalVentas,
  calcularEfectivoNetoVenta,
  type VentaConDetalle,
} from './ventas.service';
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
import { obtenerMovimientosCaja } from './movimientosCaja.service';

const openLocks = new Map<string, Promise<unknown>>();
const closeLocks = new Map<string, Promise<unknown>>();

async function withKeyLock<T>(
  locks: Map<string, Promise<unknown>>,
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.catch(() => undefined).then(() => gate);
  locks.set(key, chained);

  await prev.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === chained) {
      locks.delete(key);
    }
  }
}

function round2(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isFiniteMetric(value: unknown): boolean {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function esUuid(value: string | undefined | null): boolean {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function createUniqueId(prefix = ''): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return prefix ? `${prefix}-${crypto.randomUUID()}` : crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix || 'id'}-${Date.now()}-${rand}`;
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
  if (!raw) return ids;
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

function matchesSameUser(
  session: Pick<CierreCaja, 'cajero_id'> & { cajero_nombre?: string | null; userName?: string | null },
  cajeroId?: string | null,
  cajeroNombre?: string | null
): boolean {
  const sId = session.cajero_id ? String(session.cajero_id).trim() : '';
  const uId = cajeroId ? String(cajeroId).trim() : '';
  if (sId && uId) {
    return sId === uId;
  }
  const sName = String(session.cajero_nombre || session.userName || '').trim().toLowerCase();
  const uName = String(cajeroNombre || '').trim().toLowerCase();
  if (sName && uName) {
    return sName === uName;
  }
  return false;
}

export function evaluarConsistenciaCierre(
  c: CierreCaja & {
    total_otros?: number | null;
    total_entradas?: number | null;
    total_retiros?: number | null;
    total_devoluciones?: number | null;
  }
): { isInconsistent: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!isFiniteMetric(c.monto_apertura)) reasons.push('Falta monto de apertura');
  if (!isFiniteMetric(c.monto_esperado)) reasons.push('Falta efectivo esperado');
  if (!isFiniteMetric(c.monto_real)) reasons.push('Falta efectivo contado');
  if (!isFiniteMetric(c.monto_diferencia)) reasons.push('Falta diferencia calculada');
  if (!isFiniteMetric(c.total_ventas)) reasons.push('Falta total de ventas');
  if (!isFiniteMetric(c.total_efectivo)) reasons.push('Falta total de efectivo');
  if (!isFiniteMetric(c.total_tarjeta)) reasons.push('Falta total de tarjeta');
  if (!isFiniteMetric(c.total_transferencia)) reasons.push('Falta total de transferencia');
  if (!c.cerrada_en && String(c.estado || '').toLowerCase() === 'cerrada') {
    reasons.push('Falta fecha/hora de cierre');
  }

  const hasMissingMetrics = reasons.length > 0;

  const apertura = Number(c.monto_apertura ?? 0);
  const esperado = Number(c.monto_esperado ?? 0);
  const real = Number(c.monto_real ?? 0);
  const diferencia = Number(c.monto_diferencia ?? 0);
  const ventas = Number(c.total_ventas ?? 0);
  const efectivo = Number(c.total_efectivo ?? 0);
  const tarjeta = Number(c.total_tarjeta ?? 0);
  const transferencia = Number(c.total_transferencia ?? 0);
  const credito = Number(c.total_otros ?? 0);

  if (
    !hasMissingMetrics &&
    (ventas < 0 || efectivo < 0 || tarjeta < 0 || transferencia < 0 || credito < 0)
  ) {
    reasons.push('Importes de ventas negativos persistidos');
  }

  if (!hasMissingMetrics && ventas === 0 && round2(efectivo + tarjeta + transferencia + credito) > 0.02) {
    reasons.push('Existen cobros por método de pago con total de ventas en 0');
  }

  if (!hasMissingMetrics && Math.abs(round2(real - esperado) - round2(diferencia)) > 0.02) {
    reasons.push('La diferencia persistida no coincide con (contado - esperado)');
  }

  const hasAllCashBreakdown =
    isFiniteMetric(c.total_entradas) &&
    isFiniteMetric(c.total_retiros) &&
    isFiniteMetric(c.total_devoluciones);

  if (!hasMissingMetrics && hasAllCashBreakdown) {
    const formulaEsperado = round2(
      apertura +
        efectivo +
        Number(c.total_entradas) -
        Number(c.total_retiros) -
        Number(c.total_devoluciones)
    );
    if (Math.abs(formulaEsperado - round2(esperado)) > 0.02) {
      reasons.push('El efectivo esperado persistido no coincide con la fórmula contable');
    }
  }

  return {
    isInconsistent: reasons.length > 0,
    reasons,
  };
}

function localToDb(c: CashClosure): CierreCaja {
  return {
    id: String(c.id),
    codigo: c.code,
    caja_id: String(c.cashRegisterId),
<<<<<<< HEAD
    caja_label: c.cashRegisterLabel ?? null,
    cajero_id: c.userId ? String(c.userId) : null,
    cajero_nombre: c.userName || null,
    cajero_username: c.username || null,
=======
    cajero_id: String(c.userId),
    cajero_nombre: c.userName || undefined,
    cajero_username: c.username || undefined,
    caja_label: c.cashRegisterLabel || undefined,
    notes: c.notes || undefined,
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    sucursal_id: null,
    monto_apertura: c.baseCash ?? 0,
    monto_esperado: c.expectedCash,
    monto_real: c.countedCash,
    monto_diferencia: c.difference,
    total_ventas: c.totalSales ?? 0,
    total_efectivo: c.totalCash ?? 0,
    total_tarjeta: c.totalCard ?? 0,
    total_transferencia: c.totalTransfer ?? 0,
    total_otros: c.totalCredit ?? 0,
    total_entradas: c.totalEntradas ?? 0,
    total_retiros: c.totalRetiros ?? 0,
    total_devoluciones: c.totalDevoluciones ?? 0,
    notes: c.notes ?? null,
    estado: c.status ?? (c.closedAt ? 'cerrada' : 'abierta'),
    abierta_en: c.openedAt,
    cerrada_en: c.closedAt || null,
  };
}

<<<<<<< HEAD
/**
 * Mapea estrictamente los importes persistidos sin recalcular ni sobreescribir
 * con valores de localStorage cuando el registro proviene del servidor.
 */
export function cierreDbARegistro(
  c: CierreCaja & { cajero_nombre?: string | null; cajero_username?: string | null },
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  extra?: Partial<Pick<CashClosure, 'userName' | 'username' | 'cashRegisterLabel' | 'notes' | 'baseCash'>>
): CashClosure {
  const closedAt = c.cerrada_en || '';
  const consistency = evaluarConsistenciaCierre(c);

  return {
    id: c.id,
    code: c.codigo,
    userId: c.cajero_id ?? '',
    username: extra?.username || c.cajero_username || '',
    userName: extra?.userName || c.cajero_nombre || 'Cajero',
    openedAt: c.abierta_en || '',
    closedAt,
    date: (closedAt || c.abierta_en || new Date().toISOString()).slice(0, 10),
    cashRegisterId: c.caja_id,
<<<<<<< HEAD
    cashRegisterLabel: extra?.cashRegisterLabel || c.caja_label || `Caja ${c.caja_id}`,
    totalSales: Number(c.total_ventas ?? 0),
    totalCash: Number(c.total_efectivo ?? 0),
    totalCard: Number(c.total_tarjeta ?? 0),
    cardCount: 0,
    totalTransfer: Number(c.total_transferencia ?? 0),
    transferCount: 0,
    totalCheque: 0,
    chequeCount: 0,
    totalCredit: Number(c.total_otros ?? 0),
    creditCount: 0,
    totalEntradas: Number(c.total_entradas ?? 0),
    totalRetiros: Number(c.total_retiros ?? 0),
    totalDevoluciones: Number(c.total_devoluciones ?? 0),
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    expectedCash: Number(c.monto_esperado ?? 0),
    countedCash: Number(c.monto_real ?? 0),
    difference: Number(c.monto_diferencia ?? 0),
    baseCash: extra?.baseCash ?? Number(c.monto_apertura ?? 0),
    status: c.estado,
    notes: extra?.notes ?? c.notes ?? undefined,
    isInconsistent: consistency.isInconsistent,
    inconsistencyReasons: consistency.reasons,
  };
}

/**
 * Historial de cierres estrictamente de solo lectura respecto a importes contables.
 * Nunca recalcula ni reconstruye importes históricos; marca registros incompletos
 * como inconsistentes y evita duplicados o cierres temporales locales cuando Supabase está activo.
 */
export async function obtenerRegistrosCierreCaja(): Promise<CashClosure[]> {
<<<<<<< HEAD
  const rows = await obtenerCierresCaja();
  const dedupById = new Map<string, CashClosure>();

  for (const row of rows) {
    if (String(row.estado || '').toLowerCase() !== 'cerrada') continue;
    const id = String(row.id);
    if (!dedupById.has(id)) {
      dedupById.set(id, cierreDbARegistro(row));
    }
  }

  return Array.from(dedupById.values()).sort((a, b) => {
    const ka = a.closedAt || a.openedAt || '';
    const kb = b.closedAt || b.openedAt || '';
    return ka < kb ? 1 : -1;
  });
}

function mapCierreRowWithPerfil(
  row: any
): CierreCaja & { cajero_nombre?: string | null; cajero_username?: string | null } {
  const perfil = Array.isArray(row?.perfiles) ? row.perfiles[0] : row?.perfiles;
  const cajeroNombre = perfil?.nombre_completo || row?.cajero_nombre || null;
  const cajeroUsername = perfil?.correo || row?.cajero_username || null;
  const { perfiles: _omitPerfiles, ...rest } = row || {};
  return {
    ...(rest as CierreCaja),
    cajero_nombre: cajeroNombre,
    cajero_username: cajeroUsername,
=======
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
            sumCash += calcularEfectivoNetoVenta(v);
            sumCard += Number(v.monto_tarjeta || 0);
            sumTransfer += Number(v.monto_transferencia || 0);
            sumCredit += Number(v.monto_credito || 0);
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

const GENERIC_BOX_TERMS = new Set([
  'principal',
  'general',
  'central',
  'administracion',
  'administrador',
  'pos',
  'express',
  'rapida',
  'secundaria',
  'auxiliar',
  'caja',
  'registradora',
  'punto de venta',
  'sucursal',
  'almacen',
  'tienda',
  'supermercado',
]);

export function extractCashierFromCajaLabel(label?: string | null): string | undefined {
  if (!label) return undefined;
  const parts = String(label).split('-');
  const suffix = (parts.length > 1 ? parts.slice(1).join('-') : '').trim();
  if (!suffix || /\d/.test(suffix)) return undefined;
  const norm = suffix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!norm || norm.length < 2 || GENERIC_BOX_TERMS.has(norm)) return undefined;
  for (const term of GENERIC_BOX_TERMS) {
    if (norm.includes(term)) return undefined;
  }
  return suffix;
}

function mapCierreRowWithPerfil(
  row: any,
  userMap?: Map<string, { nombre: string; username: string }>,
  cajaLabelMap?: Map<string, string>
): CierreCaja {
  const perfil = Array.isArray(row?.perfiles) ? row.perfiles[0] : row?.perfiles;
  const local = getCashClosures().find((x) => x.id === row?.id);
  const uFromMap = row?.cajero_id && userMap ? userMap.get(String(row.cajero_id)) : undefined;
  const cajaLabel =
    (row?.caja_id && cajaLabelMap ? cajaLabelMap.get(String(row.caja_id)) : undefined) ||
    row?.caja_label ||
    local?.cashRegisterLabel ||
    undefined;
  const localUserName =
    local?.userName && local.userName.trim().toLowerCase() !== 'cajero'
      ? local.userName
      : undefined;
  const cajeroNombre =
    perfil?.nombre_completo ||
    uFromMap?.nombre ||
    row?.cajero_nombre ||
    localUserName ||
    extractCashierFromCajaLabel(cajaLabel) ||
    local?.userName ||
    undefined;
  const rawCorreo = perfil?.correo || uFromMap?.username || row?.cajero_username || local?.username || undefined;
  const cajeroUsername = rawCorreo ? String(rawCorreo).split('@')[0] : undefined;
  const { perfiles: _omitPerfiles, ...rest } = row || {};
  return {
    ...(rest as CierreCaja),
    ...(cajeroNombre ? { cajero_nombre: cajeroNombre } : {}),
    ...(cajeroUsername ? { cajero_username: cajeroUsername } : {}),
    ...(cajaLabel ? { caja_label: cajaLabel } : {}),
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  };
}

export async function obtenerCierresCaja(params?: {
  signal?: AbortSignal;
}): Promise<CierreCaja[]> {
<<<<<<< HEAD
  const sb = getSafeSupabaseClient();
  if (!sb || !isSafeSupabaseConfigured()) {
    const seen = new Set<string>();
    const localRows: CierreCaja[] = [];
    for (const c of getCashClosures()) {
      const id = String(c.id);
      if (seen.has(id)) continue;
      seen.add(id);
      localRows.push(localToDb(c));
    }
    return localRows;
=======
  const local = getCashClosures().map(localToDb);
  const sb = getSafeSupabase();
  if (!sb) {
    return depurarSesionesAbiertasObsoletas(local, null);
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  }

  try {
<<<<<<< HEAD
    const pageSize = 500;
    const allRemote: CierreCaja[] = [];
    let selectMode: 'full' | 'cols' | 'legacy' = 'full';

    for (let page = 0; page < 40; page++) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const runPage = async (mode: 'full' | 'cols' | 'legacy') => {
        const cols =
          mode === 'full'
            ? `${CIERRE_COLUMNS}, perfiles!cajero_id(nombre_completo, correo)`
            : mode === 'cols'
              ? CIERRE_COLUMNS
              : CIERRE_COLUMNS_LEGACY;
        let q = sb
          .from('cierres_caja')
          .select(cols)
          .order('abierta_en', { ascending: false })
          .range(from, to);
        if (params?.signal) q = q.abortSignal(params.signal);
        return await q;
      };

      let res = await runPage(selectMode);
      if (res.error && selectMode === 'full') {
        selectMode = 'cols';
        res = await runPage(selectMode);
      }
      if (res.error && selectMode === 'cols') {
        selectMode = 'legacy';
        res = await runPage(selectMode);
      }
      if (res.error) {
        throw res.error;
      }

      const batch = (res.data ?? []).map(mapCierreRowWithPerfil);
      allRemote.push(...batch);
      if (batch.length < pageSize) break;
    }

    // Supabase es la fuente única contable cuando está disponible (cero mezcla con localStorage)
    const seen = new Set<string>();
    return allRemote.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    console.warn('Error cargando cierres desde Supabase; usando respaldo local offline:', err);
    return getCashClosures().map(localToDb);
  }
}

export async function obtenerCierrePorId(cierreId: string): Promise<CierreCaja | null> {
  if (!cierreId) return null;
  const sb = getSafeSupabaseClient();
  if (!sb || !isSafeSupabaseConfigured()) {
    const found = getCashClosures().find((c) => c.id === cierreId);
    return found ? localToDb(found) : null;
  }

  try {
    const primaryRes = await sb
      .from('cierres_caja')
      .select(`${CIERRE_COLUMNS}, perfiles!cajero_id(nombre_completo, correo)`)
      .eq('id', cierreId)
      .maybeSingle();
    let data: any = primaryRes.data;
    let error: any = primaryRes.error;

    if (error) {
      const retryCols = await sb
        .from('cierres_caja')
        .select(CIERRE_COLUMNS)
        .eq('id', cierreId)
        .maybeSingle();
      if (!retryCols.error) {
        data = retryCols.data;
        error = null;
      } else {
        const retryLegacy = await sb
          .from('cierres_caja')
          .select(CIERRE_COLUMNS_LEGACY)
          .eq('id', cierreId)
          .maybeSingle();
        data = retryLegacy.data;
        error = retryLegacy.error;
      }
    }

    if (error || !data) return null;
    return mapCierreRowWithPerfil(data);
  } catch {
    return null;
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
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
  total_otros?: number;
  total_entradas?: number;
  total_retiros?: number;
  total_devoluciones?: number;
  estado: 'abierta' | 'cerrada';
  notes?: string;
};

export async function guardarCierreCaja(datos: NuevoCierreInput): Promise<CierreCaja> {
  const now = new Date();
<<<<<<< HEAD
  const id = createUniqueId();
  const sb = getSafeSupabaseClient();

  if (sb && isSafeSupabaseConfigured()) {
    const cajeroUuid = esUuid(datos.cajero_id) ? datos.cajero_id : null;
=======
  const closure: CashClosure = {
    id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    let cajeroUuid = esUuid(datos.cajero_id) ? datos.cajero_id : null;
    if (!cajeroUuid && (datos.cajero_nombre || datos.cajero_username)) {
      try {
        const usuarios = await obtenerUsuarios();
        const targetUser = (datos.cajero_username || '').split('@')[0].trim().toLowerCase();
        const match = usuarios.find((u) => {
          if (!esUuid(u.id)) return false;
          if (datos.cajero_nombre && u.nombre_completo && isSameCashierName(u.nombre_completo, datos.cajero_nombre)) {
            return true;
          }
          const uPrefix = (u.correo || '').split('@')[0].trim().toLowerCase();
          return Boolean(targetUser && uPrefix && uPrefix === targetUser);
        });
        if (match?.id) cajeroUuid = match.id;
      } catch {
        // ignore
      }
    }
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    const sucursalUuid = esUuid(datos.sucursal_id) ? datos.sucursal_id : null;

    const insertPayload: Record<string, unknown> = {
      id,
      codigo: datos.codigo,
      caja_id: datos.caja_id,
      cajero_id: cajeroUuid || (datos.cajero_id ? String(datos.cajero_id) : null),
      cajero_nombre: datos.cajero_nombre || null,
      cajero_username: datos.cajero_username || null,
      caja_label: datos.caja_label || null,
      notes: datos.notes || null,
      sucursal_id: sucursalUuid,
      monto_apertura: round2(datos.monto_apertura),
      monto_esperado: round2(datos.monto_esperado),
      monto_real: round2(datos.monto_real),
      monto_diferencia: round2(datos.monto_diferencia),
      total_ventas: round2(datos.total_ventas ?? 0),
      total_efectivo: round2(datos.total_efectivo ?? 0),
      total_tarjeta: round2(datos.total_tarjeta ?? 0),
      total_transferencia: round2(datos.total_transferencia ?? 0),
      total_otros: round2(datos.total_otros ?? 0),
      total_entradas: round2(datos.total_entradas ?? 0),
      total_retiros: round2(datos.total_retiros ?? 0),
      total_devoluciones: round2(datos.total_devoluciones ?? 0),
      estado: datos.estado,
      abierta_en: now.toISOString(),
      cerrada_en: datos.estado === 'cerrada' ? now.toISOString() : null,
    };

    const primaryInsert = await sb
      .from('cierres_caja')
      .insert(insertPayload)
      .select('*')
      .single();
    let data: any = primaryInsert.data;
    let error: any = primaryInsert.error;

    if (error) {
      const fallbackPayload = {
        id,
        codigo: datos.codigo,
        caja_id: datos.caja_id,
        cajero_id: cajeroUuid,
        sucursal_id: sucursalUuid,
        monto_apertura: round2(datos.monto_apertura),
        monto_esperado: round2(datos.monto_esperado),
        monto_real: round2(datos.monto_real),
        monto_diferencia: round2(datos.monto_diferencia),
        total_ventas: round2(datos.total_ventas ?? 0),
        total_efectivo: round2(datos.total_efectivo ?? 0),
        total_tarjeta: round2(datos.total_tarjeta ?? 0),
        total_transferencia: round2(datos.total_transferencia ?? 0),
        estado: datos.estado,
        abierta_en: now.toISOString(),
        cerrada_en: datos.estado === 'cerrada' ? now.toISOString() : null,
      };
      const retry = await sb
        .from('cierres_caja')
        .insert(fallbackPayload)
        .select(CIERRE_COLUMNS_LEGACY)
        .single();
      data = retry.data;
      error = retry.error;
    }

<<<<<<< HEAD
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo persistir el cierre en PostgreSQL.');
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    }

    // No dejar copias locales temporales cuando Supabase persiste correctamente
    removeCashClosure(id);
    return mapCierreRowWithPerfil(data);
  }

  const closure: CashClosure = {
    id,
    code: datos.codigo,
    cashRegisterId: datos.caja_id,
    cashRegisterLabel: datos.caja_label ?? `Caja ${datos.caja_id}`,
    userId: String(datos.cajero_id ?? '0'),
    username: datos.cajero_username ?? '',
    userName: datos.cajero_nombre ?? '',
    expectedCash: round2(datos.monto_esperado),
    countedCash: round2(datos.monto_real),
    difference: round2(datos.monto_diferencia),
    totalSales: round2(datos.total_ventas ?? 0),
    totalCash: round2(datos.total_efectivo ?? 0),
    totalCard: round2(datos.total_tarjeta ?? 0),
    totalTransfer: round2(datos.total_transferencia ?? 0),
    cardCount: 0,
    transferCount: 0,
    totalCheque: 0,
    chequeCount: 0,
    totalCredit: round2(datos.total_otros ?? 0),
    creditCount: 0,
    totalEntradas: round2(datos.total_entradas ?? 0),
    totalRetiros: round2(datos.total_retiros ?? 0),
    totalDevoluciones: round2(datos.total_devoluciones ?? 0),
    openedAt: now.toISOString(),
    closedAt: datos.estado === 'cerrada' ? now.toISOString() : '',
    date: now.toISOString().slice(0, 10),
    baseCash: round2(datos.monto_apertura),
    status: datos.estado,
    notes: datos.notes,
  };

  saveCashClosure(closure);
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
<<<<<<< HEAD
  return abiertas.find((c) => matchesSameUser(c, cajeroId, cajeroNombre)) || null;
=======

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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
}

export async function iniciarCaja(datos: NuevoInicioCajaInput): Promise<CierreCaja> {
  const ids = await expandCajaIds(datos.caja_id);
  const lockKey = `open:${String(datos.caja_id).trim() || '1'}`;

<<<<<<< HEAD
  return await withKeyLock(openLocks, lockKey, async () => {
    const sb = getSafeSupabaseClient();

    if (sb && isSafeSupabaseConfigured()) {
      const { data: rpcRes, error: rpcErr } = await sb.rpc('iniciar_caja_transaccional', {
        p_caja_id: datos.caja_id,
        p_caja_label: datos.caja_label || `Caja ${datos.caja_id}`,
        p_cajero_id: datos.cajero_id || null,
        p_cajero_nombre: datos.cajero_nombre || null,
        p_cajero_username: datos.cajero_username || null,
        p_monto_apertura: round2(datos.monto_apertura),
        p_notes: datos.notes || null,
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      });

      const rpcMissing =
        rpcErr &&
        (rpcErr.code === 'PGRST202' ||
          rpcErr.code === '42883' ||
          String(rpcErr.message || '').toLowerCase().includes('could not find the function'));

      if (rpcErr && !rpcMissing) {
        throw new Error(rpcErr.message || 'No se pudo iniciar la sesión de caja en PostgreSQL.');
      }

      if (!rpcErr && rpcRes) {
        if (!rpcRes.ok || !rpcRes.cierre) {
          throw new Error(rpcRes.error || 'No se pudo iniciar la sesión de caja.');
        }
        const openedDb = mapCierreRowWithPerfil(rpcRes.cierre);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
        }
        return openedDb;
      }
      // Si la RPC aún no estaba desplegada, continuar con validación segura por caja exacta (sin cerrar otras sesiones).
    }

    // Validar únicamente las sesiones abiertas de ESTA caja registradora (nunca cerrar ni robar sesiones de otras cajas)
    const abiertas = await listarSesionesAbiertas();
<<<<<<< HEAD
    const abiertaEnEstaCaja = abiertas.find((c) => ids.has(String(c.caja_id)));

    if (abiertaEnEstaCaja) {
      const mismaPersona = matchesSameUser(
        abiertaEnEstaCaja,
        datos.cajero_id,
        datos.cajero_nombre
      );

      if (!mismaPersona) {
        const nombreOtro =
          abiertaEnEstaCaja.cajero_nombre || 'otro cajero';
        throw new Error(
          `La registradora seleccionada ya se encuentra en uso por ${nombreOtro}. Debe cerrar el turno actual antes de iniciar uno nuevo.`
        );
      }

      // Recuperar sesión activa propia en esta caja sin resetear fondo ni abrir duplicados
      return abiertaEnEstaCaja;
    }

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
      monto_real: 0,
      monto_diferencia: 0,
      total_ventas: 0,
      total_efectivo: 0,
      total_tarjeta: 0,
      total_transferencia: 0,
      total_otros: 0,
      total_entradas: 0,
      total_retiros: 0,
      total_devoluciones: 0,
      estado: 'abierta',
      notes: datos.notes,
=======
    const ocupadaPorOtro = abiertas.find((c) => {
      if (!ids.has(String(c.caja_id))) return false;
      const isMe =
        (datos.cajero_id && c.cajero_id && String(c.cajero_id) === String(datos.cajero_id)) ||
        (datos.cajero_nombre &&
          (c as any).cajero_nombre &&
          isSameCashierName((c as any).cajero_nombre, datos.cajero_nombre));
      return !isMe;
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
    }

<<<<<<< HEAD
    return saved;
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  });
}

async function listarSesionesAbiertas(): Promise<CierreCaja[]> {
<<<<<<< HEAD
  const sb = getSafeSupabaseClient();
  if (!sb || !isSafeSupabaseConfigured()) {
    return getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
  }
  try {
    const primaryOpen = await sb
      .from('cierres_caja')
      .select(`${CIERRE_COLUMNS}, perfiles!cajero_id(nombre_completo, correo)`)
      .eq('estado', 'abierta')
      .order('abierta_en', { ascending: false })
      .limit(100);
    let data: any = primaryOpen.data;
    let error: any = primaryOpen.error;

    if (error) {
      const retry = await sb
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
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
<<<<<<< HEAD
        .limit(100);
      if (!retry.error) {
        data = retry.data;
        error = null;
      } else {
        const legacy = await sb
          .from('cierres_caja')
          .select(CIERRE_COLUMNS_LEGACY)
          .eq('estado', 'abierta')
          .order('abierta_en', { ascending: false })
          .limit(100);
        data = legacy.data;
        error = legacy.error;
      }
    }

    if (error) throw error;
    return (data ?? []).map(mapCierreRowWithPerfil);
  } catch (err) {
    console.warn('Error listando sesiones abiertas en Supabase:', err);
    return getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  }
}

/**
 * Cierra sesiones abiertas de una caja específica solo cuando se invoca de forma explícita
 * (no se invoca automáticamente desde iniciarCaja ni cierra sesiones de otras cajas).
 */
export async function cerrarSesionesAbiertasDeCaja(cajaId?: string): Promise<number> {
  if (!cajaId) return 0;
  const ids = await expandCajaIds(cajaId);
  const abiertas = await listarSesionesAbiertas();
  const toClose = abiertas.filter((c) => ids.has(String(c.caja_id)));
  if (toClose.length === 0) return 0;

  let closedCount = 0;
  for (const row of toClose) {
    try {
      await cerrarTurnoCaja({
        cierre_id: row.id,
        caja_id: row.caja_id,
        cajero_id: row.cajero_id,
        cajero_nombre: row.cajero_nombre || undefined,
        monto_apertura: Number(row.monto_apertura || 0),
        monto_esperado: Number(row.monto_apertura || 0),
        monto_real: Number(row.monto_apertura || 0),
        monto_diferencia: 0,
        notes: 'Cierre administrativo explícito de caja',
      });
      closedCount += 1;
    } catch {
      // ignore if already closed concurrently
    }
  }
  return closedCount;
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

<<<<<<< HEAD
  // Cuando se solicita una caja específica, NUNCA devolver sesiones abiertas de otras cajas
  if (ids.size > 0) {
    const enCaja = abiertas.filter((c) => ids.has(String(c.caja_id)));
    if (enCaja.length === 0) return null;

    if (cajeroId || cajeroNombre) {
      const ownInCaja = enCaja.find((c) => matchesSameUser(c, cajeroId, cajeroNombre));
      return ownInCaja || null;
    }

    return enCaja[0] || null;
  }

  // Solo si NO se especificó cajaId, buscar la sesión abierta del usuario
  if (cajeroId || cajeroNombre) {
    return abiertas.find((c) => matchesSameUser(c, cajeroId, cajeroNombre)) || null;
=======
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

  // 2. Coincidencia por la caja solicitada (si la caja tiene un turno activo, devolver ese turno sin mezclar con otra caja)
  if (ids.size > 0) {
    const matchCaja = abiertas.find((c) => ids.has(String(c.caja_id)));
    if (matchCaja) return matchCaja;
  }

  // 3. Coincidencia por cajero (solo si la caja solicitada no tenía sesión abierta o no se especificó caja)
  if (cajeroId || cajeroNombre) {
    const matchUser = abiertas.find((c) => {
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchName = Boolean(cajeroNombre && rowNombre && isSameCashierName(rowNombre, cajeroNombre));
      return matchId || matchName;
    });
    if (matchUser) return matchUser;
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
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

<<<<<<< HEAD
export function calcularEfectivoNetoVenta(v: {
  monto_total?: number | null;
  monto_efectivo?: number | null;
  monto_tarjeta?: number | null;
  monto_transferencia?: number | null;
  monto_credito?: number | null;
  devuelta_entregada?: number | null;
}): number {
  const eff = Math.max(0, Number(v.monto_efectivo ?? 0));
  const card = Math.max(0, Number(v.monto_tarjeta ?? 0));
  const transfer = Math.max(0, Number(v.monto_transferencia ?? 0));
  const credit = Math.max(0, Number(v.monto_credito ?? 0));
  const total = Math.max(0, Number(v.monto_total ?? 0));
  const change = Math.max(0, Number(v.devuelta_entregada ?? 0));

  const sumComponents = eff + card + transfer + credit;
  const overTendered = Math.max(0, round2(sumComponents - total));
  const changeToDeduct = Math.min(change, overTendered);
  return Math.max(0, round2(eff - changeToDeduct));
}

export async function calcularResumenCajaAbierta(
  cajaId: string,
  cajeroId?: string,
  cierreId?: string
): Promise<ResumenCajaAbierta> {
  const ids = await expandCajaIds(cajaId);
  const abierta = cierreId
    ? await obtenerCierrePorId(cierreId)
    : await obtenerCajaAbierta(cajaId, cajeroId);

=======
export async function calcularResumenCajaAbierta(
  cajaId: string,
  cajeroId?: string,
  cajeroNombre?: string,
  cierreId?: string
): Promise<ResumenCajaAbierta> {
  let ids = await expandCajaIds(cajaId);
  let abierta = await obtenerCajaAbierta(cajaId, cajeroId, cajeroNombre, cierreId);
  if (!abierta && !cajaId && (cajeroId || cajeroNombre)) {
    abierta = await obtenerSesionAbiertaDeUsuario(cajeroId, cajeroNombre);
  }
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  if (abierta?.caja_id) {
    // Aislar estrictamente los IDs a la caja de la sesión abierta (NUNCA unir dos cajas distintas)
    ids = await expandCajaIds(abierta.caja_id);
  }
<<<<<<< HEAD

  const apertura = round2(abierta?.monto_apertura ?? 0);
  const desde = abierta?.abierta_en || new Date().toISOString().slice(0, 10);
  const effectiveCajeroId = abierta ? (abierta.cajero_id ?? undefined) : cajeroId;
=======
  const apertura = Number(abierta?.monto_apertura ?? 0);
  const abiertaId = abierta?.cajero_id || undefined;
  const abiertaNombre =
    (abierta as (CierreCaja & { cajero_nombre?: string }) | null)?.cajero_nombre ||
    extractCashierFromCajaLabel(abierta?.caja_label) ||
    undefined;

  const callerMatchesAbierta =
    !abierta ||
    (!abiertaId && !abiertaNombre) ||
    Boolean(cajeroId && abiertaId && String(cajeroId) === String(abiertaId)) ||
    Boolean(cajeroNombre && abiertaNombre && isSameCashierName(cajeroNombre, abiertaNombre));

  const effectiveCajeroId = abierta
    ? abiertaId || (callerMatchesAbierta ? cajeroId || undefined : undefined)
    : cajeroId;
  const effectiveCajeroNombre = abierta
    ? abiertaNombre || (callerMatchesAbierta ? cajeroNombre || undefined : undefined)
    : cajeroNombre;

  // Determinar el inicio exacto del turno y evitar que entren ventas de turnos ya cerrados hoy
  let lastClosedTime = 0;
  try {
    const localClosures = getCashClosures();
    for (const cl of localClosures) {
      if (abierta?.id && cl.id === abierta.id) continue;
      if (cl.status !== 'cerrada' && !cl.closedAt) continue;
      const closedMs = cl.closedAt ? new Date(cl.closedAt).getTime() : 0;
      if (!closedMs || isNaN(closedMs)) continue;
      const sameUser =
        (effectiveCajeroId && cl.userId && String(cl.userId) === String(effectiveCajeroId)) ||
        (effectiveCajeroNombre && cl.userName && isSameCashierName(cl.userName, effectiveCajeroNombre));
      const sameBox = Boolean(cl.cashRegisterId && ids.has(String(cl.cashRegisterId)));
      if (sameUser || sameBox) {
        if (closedMs > lastClosedTime) lastClosedTime = closedMs;
      }
    }
  } catch {
    // ignore
  }

  const rawDesde = abierta?.abierta_en || `${new Date().toISOString().slice(0, 10)}T00:00:00`;
  const rawDesdeMs = new Date(rawDesde).getTime();
  const effectiveDesdeMs =
    !isNaN(rawDesdeMs) && rawDesdeMs > 0
      ? lastClosedTime > rawDesdeMs
        ? lastClosedTime
        : rawDesdeMs
      : lastClosedTime;
  const desde =
    effectiveDesdeMs > 0 ? new Date(effectiveDesdeMs).toISOString() : rawDesde;
  const desdeTime = effectiveDesdeMs > 0 ? effectiveDesdeMs : 0;
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencia = 0;
  let totalOtros = 0;

  try {
    const searchCajaIds = Array.from(ids);
<<<<<<< HEAD
    const ventas = await obtenerVentasTurno({
      cierreId: abierta?.id,
      cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
      cajeroId: effectiveCajeroId,
      desde,
      incluirLegacySinCierreId: true,
      omitirDetalles: true,
      todasPaginas: true,
    });

    const desdeTime = abierta?.abierta_en ? new Date(abierta.abierta_en).getTime() : 0;
    const hastaTime = abierta?.cerrada_en ? new Date(abierta.cerrada_en).getTime() : 0;

    for (const v of ventas) {
      if (String(v.estado || '').toLowerCase() === 'anulada') continue;

      if (abierta?.id) {
        if (v.cierre_id != null && String(v.cierre_id).trim() !== '') {
          if (String(v.cierre_id) !== String(abierta.id)) continue;
        } else {
          // Ventas legacy sin cierre_id: exigir misma caja y timestamp dentro del turno exacto
          if (v.caja_id && !ids.has(String(v.caja_id))) continue;
          if (!v.caja_id) continue;
          if (abierta.cajero_id && v.cajero_id && String(v.cajero_id) !== String(abierta.cajero_id)) {
            continue;
          }
          if (desdeTime > 0 && v.creado_en) {
            const vt = new Date(v.creado_en).getTime();
            if (!isNaN(vt) && vt < desdeTime) continue;
            if (hastaTime > 0 && !isNaN(vt) && vt > hastaTime) continue;
          }
        }
      } else {
        if (!ids.has(String(v.caja_id ?? ''))) continue;
        if (cajeroId && v.cajero_id && String(v.cajero_id) !== String(cajeroId)) continue;
      }

      totalVentas = round2(totalVentas + Number(v.monto_total || 0));
      totalEfectivo = round2(totalEfectivo + calcularEfectivoNetoVenta(v));
      totalTarjeta = round2(totalTarjeta + Number(v.monto_tarjeta || 0));
      totalTransferencia = round2(totalTransferencia + Number(v.monto_transferencia || 0));
      totalOtros = round2(totalOtros + Number(v.monto_credito || 0));
=======
    const [ventasPorCaja, ventasPorCajero] = await Promise.all([
      obtenerVentasTurno({
        cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
        desde,
        limite: 1000,
      }).catch((): VentaConDetalle[] => []),
      effectiveCajeroId || effectiveCajeroNombre
        ? obtenerVentasTurno({
            cajeroId: effectiveCajeroId,
            cajeroNombre: effectiveCajeroNombre,
            desde,
            limite: 1000,
          }).catch((): VentaConDetalle[] => [])
        : Promise.resolve([] as VentaConDetalle[]),
    ]);

    const seenVentaIds = new Set<string>();
    const ventas: VentaConDetalle[] = [];
    const targetNameNorm = (effectiveCajeroNombre || '').trim().toLowerCase();

    const shouldIncludeSale = (v: VentaConDetalle): boolean => {
      if (v.estado === 'anulada' || (v.estado as string) === 'cancelled') return false;
      if (desdeTime > 0 && v.creado_en) {
        const vt = new Date(v.creado_en).getTime();
        if (!isNaN(vt) && vt < desdeTime - 5_000) return false;
      }
      if (lastClosedTime > 0 && v.creado_en) {
        const vt = new Date(v.creado_en).getTime();
        if (!isNaN(vt) && vt <= lastClosedTime) return false;
      }

      const saleCajaId = String(v.caja_id ?? '').trim();
      const matchesBox = saleCajaId ? ids.has(saleCajaId) : false;

      // Regla estricta multi-caja: si la venta tiene una caja asignada distinta a esta caja, NUNCA mezclarla
      if (saleCajaId && ids.size > 0 && !matchesBox) {
        return false;
      }

      const rowCajeroId = v.cajero_id || (v as any).usuario_id;
      const matchesId = Boolean(
        effectiveCajeroId && rowCajeroId && String(rowCajeroId) === String(effectiveCajeroId)
      );
      const rowName = (v.cajero_nombre || '').trim();
      const rowNameLower = rowName.toLowerCase();
      const hasSpecificRowName =
        Boolean(rowNameLower) &&
        rowNameLower !== 'cajero' &&
        rowNameLower !== 'cajera' &&
        rowNameLower !== 'no especificado';
      const matchesName = Boolean(
        targetNameNorm && hasSpecificRowName && isSameCashierName(rowName, effectiveCajeroNombre)
      );

      if (effectiveCajeroId || targetNameNorm) {
        // Si la venta tiene un nombre de cajero específico distinto al dueño del turno, NO mezclarla
        if (targetNameNorm && hasSpecificRowName && !matchesName) return false;
        // Si la venta tiene un ID de cajero distinto al dueño del turno (y no coincide por nombre), NO mezclarla
        if (
          effectiveCajeroId &&
          rowCajeroId &&
          String(rowCajeroId) !== String(effectiveCajeroId) &&
          !matchesName
        ) {
          return false;
        }
        if (matchesId || matchesName) return true;
        // Solo incluir por caja si la venta pertenece a esta caja y no contradice al cajero del turno
        return matchesBox && !hasSpecificRowName && !rowCajeroId;
      }

      return matchesBox;
    };

    for (const v of [...ventasPorCaja, ...ventasPorCajero]) {
      if (seenVentaIds.has(v.id)) continue;
      if (shouldIncludeSale(v)) {
        ventas.push(v);
        seenVentaIds.add(v.id);
      }
    }

    // Complementar con ventas locales de espejo que coincidan con la caja o el cajero
    try {
      const localVentas = getLocalVentas();
      for (const lv of localVentas) {
        if (seenVentaIds.has(lv.id)) continue;
        if (shouldIncludeSale(lv)) {
          ventas.push(lv);
          seenVentaIds.add(lv.id);
        }
      }
    } catch {
      // ignore
    }

    for (const v of ventas) {
      totalVentas += Number(v.monto_total) || 0;
      totalEfectivo += calcularEfectivoNetoVenta(v);
      totalTarjeta += Number(v.monto_tarjeta) || 0;
      totalTransferencia += Number(v.monto_transferencia) || 0;
      totalOtros += Number(v.monto_credito) || 0;
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
    }
    totalVentas = Math.round(totalVentas * 100) / 100;
    totalEfectivo = Math.round(totalEfectivo * 100) / 100;
    totalTarjeta = Math.round(totalTarjeta * 100) / 100;
    totalTransferencia = Math.round(totalTransferencia * 100) / 100;
    totalOtros = Math.round(totalOtros * 100) / 100;
  } catch {
    totalVentas = round2(abierta?.total_ventas ?? 0);
    totalEfectivo = round2(abierta?.total_efectivo ?? 0);
    totalTarjeta = round2(abierta?.total_tarjeta ?? 0);
    totalTransferencia = round2(abierta?.total_transferencia ?? 0);
    totalOtros = round2(abierta?.total_otros ?? 0);
  }

  let totalEntradas = 0;
  let totalRetiros = 0;
  let totalDevoluciones = 0;
<<<<<<< HEAD

  try {
    // Fuente única de movimientos: tabla/colección movimientos_caja vinculada por cierre_id
    const movimientos = await obtenerMovimientosCaja(
      abierta?.id,
      abierta?.caja_id || cajaId,
      {
        incluirLegacySinCierreId: true,
        desde: abierta?.abierta_en,
      }
    );

    const desdeTime = abierta?.abierta_en ? new Date(abierta.abierta_en).getTime() : 0;
    const hastaTime = abierta?.cerrada_en ? new Date(abierta.cerrada_en).getTime() : 0;
    const seenMovIds = new Set<string>();

    for (const m of movimientos) {
      if (m.id && seenMovIds.has(String(m.id))) continue;
      if (m.id) seenMovIds.add(String(m.id));

      if (abierta?.id) {
        if (m.cierre_id != null && String(m.cierre_id).trim() !== '') {
          if (String(m.cierre_id) !== String(abierta.id)) continue;
        } else {
          if (!m.caja_id || !ids.has(String(m.caja_id))) continue;
          if (abierta.cajero_id && m.cajero_id && String(m.cajero_id) !== String(abierta.cajero_id)) {
            continue;
          }
          if (desdeTime > 0 && m.creado_en) {
            const mt = new Date(m.creado_en).getTime();
            if (!isNaN(mt) && mt < desdeTime) continue;
            if (hastaTime > 0 && !isNaN(mt) && mt > hastaTime) continue;
=======
  const countedMovementKeys = new Set<string>();
  const makeExpenseKey = (monto: number, concepto?: string | null) =>
    `gasto-${Number(monto || 0).toFixed(2)}-${(concepto || '').trim().toLowerCase()}`;

  const matchesShiftMovement = (
    itemCajaId?: string | null,
    itemCierreId?: string | null,
    itemCajeroName?: string | null
  ): boolean => {
    if (abierta?.id && itemCierreId) {
      return String(itemCierreId) === String(abierta.id);
    }
    const cleanCajaId = String(itemCajaId ?? '').trim();
    const cleanItemName = (itemCajeroName || '').trim();
    const hasSpecificItemName =
      Boolean(cleanItemName) &&
      !['cajero', 'cajera', 'administrador', 'usuario', 'no especificado'].includes(
        cleanItemName.toLowerCase()
      );

    // Si el movimiento o gasto tiene una caja asignada, debe coincidir estrictamente con esta caja
    if (cleanCajaId) {
      if (!ids.has(cleanCajaId)) return false;
      if (effectiveCajeroNombre && hasSpecificItemName) {
        return isSameCashierName(cleanItemName, effectiveCajeroNombre);
      }
      return true;
    }

    // Los gastos generales de administración sin caja_id ni cierre_id NO deben restarse de una caja registradora POS
    return false;
  };

  try {
    const movimientos = await obtenerMovimientosCaja(abierta?.id, Array.from(ids));
    for (const m of movimientos) {
      if (!matchesShiftMovement(m.caja_id, m.cierre_id, m.cajero_nombre)) continue;
      if (desdeTime > 0 && m.creado_en) {
        const mt = new Date(m.creado_en).getTime();
        if (!isNaN(mt) && mt < desdeTime - 5000) continue;
      }
      if (lastClosedTime > 0 && m.creado_en) {
        const mt = new Date(m.creado_en).getTime();
        if (!isNaN(mt) && mt <= lastClosedTime) continue;
      }
      const monto = Number(m.monto || 0);
      if (m.tipo === 'entrada' || m.tipo === 'aporte') {
        const key = `entrada-${monto.toFixed(2)}-${(m.concepto || '').trim().toLowerCase()}`;
        if (!countedMovementKeys.has(key)) {
          totalEntradas += monto;
          countedMovementKeys.add(key);
        }
      } else if (m.tipo === 'salida' || m.tipo === 'retiro' || m.tipo === 'gasto') {
        if (m.categoria === 'Devolución' || m.concepto?.toLowerCase().includes('devolución')) {
          const key = `salida-${monto.toFixed(2)}-devolución`;
          if (!countedMovementKeys.has(key)) {
            totalDevoluciones += monto;
            countedMovementKeys.add(key);
          }
        } else {
          const key = makeExpenseKey(monto, m.concepto);
          if (!countedMovementKeys.has(key)) {
            totalRetiros += monto;
            countedMovementKeys.add(key);
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
          }
        }
      } else {
        if (!ids.has(String(m.caja_id ?? ''))) continue;
        if (cajeroId && m.cajero_id && String(m.cajero_id) !== String(cajeroId)) continue;
      }

      const monto = round2(m.monto || 0);
      const tipo = String(m.tipo || '').toLowerCase();
      const cat = String(m.categoria || '').toLowerCase();
      const concepto = String(m.concepto || '').toLowerCase();

      if (tipo === 'entrada' || tipo === 'aporte') {
        totalEntradas = round2(totalEntradas + monto);
      } else if (
        (tipo === 'salida' || tipo === 'retiro') &&
        (cat.includes('devoluci') || concepto.includes('devoluci'))
      ) {
        totalDevoluciones = round2(totalDevoluciones + monto);
      } else if (tipo === 'salida' || tipo === 'retiro' || tipo === 'gasto') {
        totalRetiros = round2(totalRetiros + monto);
      }
    }
  } catch {
    // ignore movement query error
  }

<<<<<<< HEAD
  // Fórmula contable única:
  // Fondo inicial + ventas netas en efectivo + entradas en efectivo - retiros y gastos - devoluciones en efectivo
  const montoEsperado = round2(
    apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones
  );
=======
  // Complementar con gastos locales y de POS para que nunca falte un gasto registrado
  const desdeDate = desde ? desde.slice(0, 10) : new Date().toISOString().slice(0, 10);

  try {
    const rawPosExp = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_pos_expenses') : null;
    if (rawPosExp) {
      const posExps = JSON.parse(rawPosExp) as any[];
      for (const exp of posExps) {
        if (!matchesShiftMovement(exp.cajaId, exp.cierreId, exp.user)) continue;
        if (desdeTime > 0 && exp.created_at) {
          const et = new Date(exp.created_at).getTime();
          if (!isNaN(et) && et < desdeTime - 5000) continue;
        } else if (exp.date && exp.date < desdeDate) {
          continue;
        }
        const monto = Number(exp.amount || 0);
        const key = makeExpenseKey(monto, exp.description);
        if (!countedMovementKeys.has(key)) {
          totalRetiros += monto;
          countedMovementKeys.add(key);
        }
      }
    }

    const rawGastos = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_gastos_local') : null;
    if (rawGastos) {
      const localGastos = JSON.parse(rawGastos) as any[];
      for (const g of localGastos) {
        if (!matchesShiftMovement(g.caja_id, g.cierre_id, g.responsible || g.responsable_nombre)) continue;
        if (desdeTime > 0 && (g.created_at || g.creado_en)) {
          const gt = new Date(g.created_at || g.creado_en).getTime();
          if (!isNaN(gt) && gt < desdeTime - 5000) continue;
        } else if (g.date && g.date < desdeDate) {
          continue;
        }
        const method = String(g.paymentMethod ?? g.metodo_pago ?? 'efectivo').toLowerCase();
        if (g.status !== 'rejected' && (method === 'efectivo' || method === 'caja_chica')) {
          const monto = Number((g.monto ?? g.amount) || 0);
          const key = makeExpenseKey(monto, g.descripcion || g.description);
          if (!countedMovementKeys.has(key)) {
            totalRetiros += monto;
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
          const monto = Number(dev.monto_total || 0);
          const key = `salida-${monto.toFixed(2)}-devolución`;
          if (!countedMovementKeys.has(key)) {
            totalDevoluciones += monto;
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
        .select('id, descripcion, monto, metodo_pago, creado_en, caja_id, responsable_nombre')
        .neq('estado', 'rechazado')
        .gte('creado_en', `${desdeDate}T00:00:00`);

      for (const g of remoteGastos ?? []) {
        if (!matchesShiftMovement(g.caja_id, null, (g as any).responsable_nombre)) continue;
        if (desdeTime > 0 && g.creado_en) {
          const gt = new Date(g.creado_en).getTime();
          if (!isNaN(gt) && gt < desdeTime - 5000) continue;
        }
        const method = String(g.metodo_pago ?? 'efectivo').toLowerCase();
        if (method === 'efectivo' || method === 'caja_chica') {
          const monto = Number(g.monto || 0);
          const key = makeExpenseKey(monto, g.descripcion);
          if (!countedMovementKeys.has(key)) {
            totalRetiros += monto;
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
        if (d.caja_id && !ids.has(String(d.caja_id))) continue;
        if (desdeTime > 0 && d.creado_en) {
          const dt = new Date(d.creado_en).getTime();
          if (!isNaN(dt) && dt < desdeTime - 5000) continue;
        }
        const m = String(d.metodo_reembolso ?? '').toLowerCase();
        if (m === 'efectivo' || m === 'cash') {
          const monto = Number(d.monto_total || 0);
          const key = `salida-${monto.toFixed(2)}-devolución`;
          if (!countedMovementKeys.has(key)) {
            totalDevoluciones += monto;
            countedMovementKeys.add(key);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  totalEntradas = Math.round(totalEntradas * 100) / 100;
  totalRetiros = Math.round(totalRetiros * 100) / 100;
  totalDevoluciones = Math.round(totalDevoluciones * 100) / 100;
  const montoEsperado =
    Math.round((apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones) * 100) / 100;
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  return {
    cierre_id: abierta?.id,
    caja_id: abierta?.caja_id || cajaId,
    caja_label: abierta?.caja_label || `Caja #${abierta?.caja_id || cajaId}`,
<<<<<<< HEAD
    cajero_id: abierta?.cajero_id ?? null,
    cajero_nombre: abierta?.cajero_nombre ?? undefined,
    cajero_username: abierta?.cajero_username ?? undefined,
=======
    cajero_id: effectiveCajeroId ?? abierta?.cajero_id,
    cajero_nombre: effectiveCajeroNombre || (abierta as CierreCaja & { cajero_nombre?: string })?.cajero_nombre,
    cajero_username: (abierta as CierreCaja & { cajero_username?: string })?.cajero_username,
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
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
    estado: abierta ? abierta.estado : 'en_curso',
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
<<<<<<< HEAD
  const lockKey = input.cierre_id
    ? `close:${input.cierre_id}`
    : `close:caja:${String(input.caja_id)}`;
=======
  const todas = await obtenerCierresCaja();
  let cajaIds = await expandCajaIds(input.caja_id);
  let abierta: CierreCaja | null = null;
  if (input.cierre_id) {
    abierta = todas.find((c) => c.id === input.cierre_id) || null;
  }
  if (!abierta) {
    abierta = await obtenerCajaAbierta(input.caja_id, input.cajero_id ?? undefined, input.cajero_nombre);
  }
  if (abierta?.caja_id) {
    cajaIds = await expandCajaIds(abierta.caja_id);
  }
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  return await withKeyLock(closeLocks, lockKey, async () => {
    let abierta: CierreCaja | null = null;
    if (input.cierre_id) {
      abierta = await obtenerCierrePorId(input.cierre_id);
      if (!abierta) {
        const all = await obtenerCierresCaja();
        abierta = all.find((c) => c.id === input.cierre_id) || null;
      }
      if (!abierta) {
        throw new Error(`No se encontró la sesión de caja (${input.cierre_id}) para cerrar.`);
      }
    } else {
      abierta = await obtenerCajaAbierta(
        input.caja_id,
        input.cajero_id ?? undefined,
        input.cajero_nombre
      );
      if (!abierta) {
        throw new Error('No se encontró un turno abierto en la caja seleccionada.');
      }
    }

<<<<<<< HEAD
    if (String(abierta.estado).toLowerCase() === 'cerrada') {
      throw new Error('Esta sesión de caja ya fue cerrada previamente.');
    }

    const sb = getSafeSupabaseClient();
    if (sb && isSafeSupabaseConfigured()) {
      const { data: rpcRes, error: rpcErr } = await sb.rpc('cerrar_caja_transaccional', {
        p_cierre_id: abierta.id,
        p_caja_id: abierta.caja_id || input.caja_id,
        p_cajero_id: input.usuario_cierre_id || input.cajero_id || null,
        p_cajero_nombre: input.usuario_cierre_nombre || input.cajero_nombre || null,
        p_monto_real: round2(input.monto_real),
        p_notes: input.notes || null,
      });

      if (rpcErr) {
        throw new Error(
          rpcErr.message || 'Error transaccional en PostgreSQL al cerrar el turno de caja.'
        );
      }

      if (!rpcRes || !rpcRes.ok || !rpcRes.cierre) {
        throw new Error(
          rpcRes?.error || 'PostgreSQL rechazó el cierre de caja o la sesión ya fue cerrada.'
        );
      }

      const cerradaDb = mapCierreRowWithPerfil(rpcRes.cierre);
      // Limpiar cualquier copia temporal local del turno cerrado una vez persistido en Postgres
      removeCashClosure(abierta.id);

=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
      }
      return cerradaDb;
    }

<<<<<<< HEAD
    // Modo offline/local: re-verificar atomicidad por ID y recalcular exclusivamente sobre esa sesión
    const current = getCashClosures();
    const existing = current.find((c) => c.id === abierta!.id);
    if (!existing) {
      throw new Error(`No se encontró la sesión local (${abierta.id}) para cerrar.`);
    }
    if (String(existing.status || '').toLowerCase() === 'cerrada') {
      throw new Error('Esta sesión de caja ya fue cerrada previamente.');
    }

    const resumen = await calcularResumenCajaAbierta(
      existing.cashRegisterId,
      existing.userId,
      existing.id
    );

    const now = new Date().toISOString();
    const closureCode = existing.code || `CC-${Date.now().toString().slice(-6)}`;
    const expectedCash = resumen.monto_esperado;
    const countedCash = round2(input.monto_real);
    const difference = round2(countedCash - expectedCash);

    const closed: CashClosure = {
      ...existing,
      code: closureCode,
      baseCash: resumen.monto_apertura,
      expectedCash,
      countedCash,
      difference,
      totalSales: resumen.total_ventas,
      totalCash: resumen.total_efectivo,
      totalCard: resumen.total_tarjeta,
      totalTransfer: resumen.total_transferencia,
      totalCredit: resumen.total_otros,
      totalEntradas: resumen.total_entradas,
      totalRetiros: resumen.total_retiros,
      totalDevoluciones: resumen.total_devoluciones,
      status: 'cerrada',
      closedAt: now,
      date: now.slice(0, 10),
      notes: input.notes ?? existing.notes,
      userName: existing.userName || input.cajero_nombre || 'Cajero',
      username: existing.username || input.cajero_username || '',
      cashRegisterLabel:
        existing.cashRegisterLabel || input.caja_label || `Caja ${existing.cashRegisterId}`,
    };

    saveCashClosure(closed);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
    }

    return localToDb(closed);
=======
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
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  });
}

// Exponer helper solo por compatibilidad con utilidades legacy; el historial nunca usa localStorage en Supabase
export function getSupabaseClientSafe() {
  return getSafeSupabaseClient();
}
