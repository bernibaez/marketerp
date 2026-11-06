import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { CIERRE_COLUMNS, type CierreCaja } from '@/types/database';
import { getCashClosures, saveCashClosure, type CashClosure } from '@/lib/cashClosureStore';
import { obtenerCajas } from './cajas.service';
import { obtenerVentasTurno, getLocalVentas } from './ventas.service';
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

export function cierreDbARegistro(
  c: CierreCaja & { cajero_nombre?: string; cajero_username?: string },
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
    cashRegisterLabel: extra?.cashRegisterLabel || local?.cashRegisterLabel || `Caja ${c.caja_id}`,
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
  const rows = await obtenerCierresCaja();
  const cerrados = rows.filter((c) => String(c.estado).toLowerCase() === 'cerrada');
  const mapped = cerrados.map((c) => cierreDbARegistro(c));
  const seen = new Set(mapped.map((c) => c.id));
  const locales = getCashClosures().filter(
    (c) => (c.status === 'cerrada' || !!c.closedAt) && !seen.has(c.id)
  );
  return [...mapped, ...locales].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
}

function mapCierreRowWithPerfil(row: any): CierreCaja & { cajero_nombre?: string; cajero_username?: string } {
  const perfil = Array.isArray(row?.perfiles) ? row.perfiles[0] : row?.perfiles;
  const local = getCashClosures().find((x) => x.id === row?.id);
  const cajeroNombre = perfil?.nombre_completo || row?.cajero_nombre || local?.userName || undefined;
  const cajeroUsername = perfil?.correo || row?.cajero_username || local?.username || undefined;
  const { perfiles: _omitPerfiles, ...rest } = row || {};
  return {
    ...(rest as CierreCaja),
    ...(cajeroNombre ? { cajero_nombre: cajeroNombre } : {}),
    ...(cajeroUsername ? { cajero_username: cajeroUsername } : {}),
  };
}

export async function obtenerCierresCaja(params?: {
  signal?: AbortSignal;
}): Promise<CierreCaja[]> {
  const local = getCashClosures().map(localToDb);
  const sb = getSafeSupabase();
  if (!sb) {
    return local;
  }
  try {
    const buildQuery = (cols: string) => {
      let q = sb
        .from('cierres_caja')
        .select(cols)
        .order('abierta_en', { ascending: false })
        .limit(100);
      if (params?.signal) q = q.abortSignal(params.signal);
      return q;
    };
    let { data, error } = await buildQuery(`${CIERRE_COLUMNS}, perfiles!cajero_id(nombre_completo, correo)`);
    if (error) {
      const fallback = await buildQuery(CIERRE_COLUMNS);
      if (!fallback.error) {
        data = fallback.data;
      }
    }
    const remote = (data ?? []).map(mapCierreRowWithPerfil);
    const seen = new Set(remote.map((r) => r.id));
    return [...remote, ...local.filter((l) => !seen.has(l.id))];
  } catch {
    return local;
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
      .select(CIERRE_COLUMNS)
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
      persistirRegistroCierre(data as CierreCaja, {
        userName: datos.cajero_nombre,
        username: datos.cajero_username,
        cashRegisterLabel: datos.caja_label,
        notes: datos.notes,
        baseCash: datos.monto_apertura,
      });
      return data as CierreCaja;
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
  cajeroNombre?: string | null
): Promise<CierreCaja | null> {
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;

  return (
    abiertas.find((c) => {
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchNombre =
        cajeroNombre &&
        rowNombre &&
        String(rowNombre).trim().toLowerCase() === String(cajeroNombre).trim().toLowerCase();
      return matchId || matchNombre;
    }) || null
  );
}

export async function iniciarCaja(datos: NuevoInicioCajaInput): Promise<CierreCaja> {
  const ids = await expandCajaIds(datos.caja_id);

  // 1. Si no se fuerza nueva apertura, verificar si este usuario ya tiene una sesión abierta activa
  if (!datos.forzarNueva) {
    const sesionPropia = await obtenerSesionAbiertaDeUsuario(datos.cajero_id, datos.cajero_nombre);
    if (sesionPropia) {
      persistirRegistroCierre(sesionPropia, {
        userName: datos.cajero_nombre,
        username: datos.cajero_username,
        cashRegisterLabel: datos.caja_label,
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
          String((c as any).cajero_nombre).trim().toLowerCase() === String(datos.cajero_nombre).trim().toLowerCase());
      return !isMe;
    });

    if (ocupadaPorOtro) {
      const nombreOtro = (ocupadaPorOtro as any).cajero_nombre || 'otro cajero';
      throw new Error(`La registradora seleccionada ya se encuentra en uso por ${nombreOtro}.`);
    }
  }

  // 2. Si la caja tenía turnos anteriores abiertos o sesiones pendientes, cerrarlas limpiamente
  try {
    await cerrarSesionesAbiertasDeCaja(datos.caja_id);
  } catch {
    // ignore
  }

  // 3. Cerrar en Supabase cualquier sesión abierta residual en esta registradora o de este cajero
  const sb = getSafeSupabase();
  if (sb && isSupabaseConfigured()) {
    try {
      const nowIso = new Date().toISOString();
      const searchIds = Array.from(ids);
      if (searchIds.length > 0) {
        await sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: nowIso })
          .in('caja_id', searchIds)
          .eq('estado', 'abierta');
      }
      if (datos.cajero_nombre) {
        await sb
          .from('cierres_caja')
          .update({ estado: 'cerrada', cerrada_en: nowIso })
          .ilike('cajero_nombre', datos.cajero_nombre)
          .eq('estado', 'abierta');
      }
    } catch {
      // ignore
    }
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
    return getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
  }
  try {
    const { data, error } = await sb
      .from('cierres_caja')
      .select(`${CIERRE_COLUMNS}, perfiles!cajero_id(nombre_completo, correo)`)
      .eq('estado', 'abierta')
      .order('abierta_en', { ascending: false })
      .limit(50);

    let rows: any[] = data ?? [];
    if (error) {
      const fallback = await sb
        .from('cierres_caja')
        .select(CIERRE_COLUMNS)
        .eq('estado', 'abierta')
        .order('abierta_en', { ascending: false })
        .limit(50);
      rows = fallback.data ?? [];
    }

    const remote = rows.map(mapCierreRowWithPerfil);
    const local = getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
    const seen = new Set(remote.map((c) => c.id));
    return [...remote, ...local.filter((c) => !seen.has(c.id))];
  } catch {
    return getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
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
  cajeroNombre?: string
): Promise<CierreCaja | null> {
  const ids = await expandCajaIds(cajaId);
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;

  // 1. Coincidencia estricta: misma caja y mismo cajero (por ID o por nombre)
  if (ids.size > 0 && (cajeroId || cajeroNombre)) {
    const matchExact = abiertas.find((c) => {
      const matchCaja = ids.has(String(c.caja_id));
      if (!matchCaja) return false;
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchName =
        cajeroNombre &&
        rowNombre &&
        String(rowNombre).trim().toLowerCase() === String(cajeroNombre).trim().toLowerCase();
      return matchId || matchName;
    });
    if (matchExact) return matchExact;
  }

  // 2. Coincidencia por cajero (si el usuario ya tiene su caja abierta en cualquier registradora)
  if (cajeroId || cajeroNombre) {
    const matchUser = abiertas.find((c) => {
      const matchId = cajeroId && c.cajero_id && String(c.cajero_id) === String(cajeroId);
      const rowNombre = (c as any).cajero_nombre || (c as any).userName;
      const matchName =
        cajeroNombre &&
        rowNombre &&
        String(rowNombre).trim().toLowerCase() === String(cajeroNombre).trim().toLowerCase();
      return matchId || matchName;
    });
    if (matchUser) return matchUser;
  }

  // 3. Coincidencia por caja (solo si no se especificó un cajero)
  if (ids.size > 0 && !cajeroId && !cajeroNombre) {
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

export async function calcularResumenCajaAbierta(cajaId: string, cajeroId?: string): Promise<ResumenCajaAbierta> {
  const ids = await expandCajaIds(cajaId);
  const abierta = await obtenerCajaAbierta(cajaId, cajeroId);
  if (abierta?.caja_id) {
    const extraIds = await expandCajaIds(abierta.caja_id);
    extraIds.forEach((x) => ids.add(x));
  }
  const apertura = Number(abierta?.monto_apertura ?? 0);
  const desde = abierta?.abierta_en || new Date().toISOString().slice(0, 10);

  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencia = 0;
  let totalOtros = 0;

  try {
    const searchCajaIds = Array.from(ids);
    let ventas = await obtenerVentasTurno({
      cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
      cajeroId: abierta?.cajero_id || cajeroId,
      desde,
      limite: 1000,
    });

    // Respaldo de seguridad: si no trajo ventas pero la caja tuvo ventas registradas hoy
    if (ventas.length === 0) {
      const fallbackVentas = await obtenerVentasTurno({
        cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
        desde,
        limite: 1000,
      });
      if (fallbackVentas.length > 0) {
        ventas = fallbackVentas;
      }
    }

    // Complementar con ventas locales de espejo que coincidan con la caja
    try {
      const localVentas = getLocalVentas();
      const desdeTime = desde ? new Date(desde).getTime() : 0;
      const seenIds = new Set(ventas.map((v) => v.id));
      for (const lv of localVentas) {
        if (seenIds.has(lv.id)) continue;
        const matchesBox = ids.has(String(lv.caja_id ?? ''));
        if (!matchesBox) continue;
        if (desdeTime > 0 && lv.creado_en) {
          const lt = new Date(lv.creado_en).getTime();
          if (!isNaN(lt) && lt < desdeTime - 60_000) continue;
        }
        ventas.push(lv);
        seenIds.add(lv.id);
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
  let abierta: CierreCaja | null = null;
  if (input.cierre_id) {
    abierta = todas.find((c) => c.id === input.cierre_id) || null;
  }
  if (!abierta) {
    abierta = await obtenerCajaAbierta(input.caja_id, input.cajero_id ?? undefined, input.cajero_nombre);
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
  };

  // 1. Intentar cerrar mediante RPC transaccional en Supabase
  const sb = getSafeSupabase();
  if (sb && isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error: rpcErr } = await sb.rpc('cerrar_caja_transaccional', {
        p_cierre_id: abierta?.id || input.cierre_id || null,
        p_caja_id: input.caja_id,
        p_cajero_id: input.cajero_id || null,
        p_cajero_nombre: input.cajero_nombre || null,
        p_monto_real: input.monto_real,
        p_notes: input.notes || null,
      });

      if (!rpcErr && rpcRes && rpcRes.ok && rpcRes.cierre) {
        const cerradaDb = rpcRes.cierre as CierreCaja;
        persistirRegistroCierre(cerradaDb, extraUi);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
        }
        return cerradaDb;
      }
    } catch {
      // Fallback a cierre local/directo
    }
  }

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

  if (abierta?.id) {
    if (!isSupabaseConfigured() || !esUuid(abierta.id)) {
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
          .select(CIERRE_COLUMNS)
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
        openedAt: existing?.openedAt || now,
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


