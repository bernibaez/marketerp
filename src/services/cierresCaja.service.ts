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
    caja_label: c.cashRegisterLabel ?? null,
    cajero_id: c.userId ? String(c.userId) : null,
    cajero_nombre: c.userName || null,
    cajero_username: c.username || null,
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

/**
 * Mapea estrictamente los importes persistidos sin recalcular ni sobreescribir
 * con valores de localStorage cuando el registro proviene del servidor.
 */
export function cierreDbARegistro(
  c: CierreCaja & { cajero_nombre?: string | null; cajero_username?: string | null },
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
  };
}

export async function obtenerCierresCaja(params?: {
  signal?: AbortSignal;
}): Promise<CierreCaja[]> {
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
  }

  try {
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
  const id = createUniqueId();
  const sb = getSafeSupabaseClient();

  if (sb && isSafeSupabaseConfigured()) {
    const cajeroUuid = esUuid(datos.cajero_id) ? datos.cajero_id : null;
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
      .select(CIERRE_COLUMNS)
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

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo persistir el cierre en PostgreSQL.');
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
  cajeroNombre?: string | null
): Promise<CierreCaja | null> {
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;
  return abiertas.find((c) => matchesSameUser(c, cajeroId, cajeroNombre)) || null;
}

export async function iniciarCaja(datos: NuevoInicioCajaInput): Promise<CierreCaja> {
  const ids = await expandCajaIds(datos.caja_id);
  const lockKey = `open:${String(datos.caja_id).trim() || '1'}`;

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
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
    }

    return saved;
  });
}

async function listarSesionesAbiertas(): Promise<CierreCaja[]> {
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
        .from('cierres_caja')
        .select(CIERRE_COLUMNS)
        .eq('estado', 'abierta')
        .order('abierta_en', { ascending: false })
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
  cajeroNombre?: string
): Promise<CierreCaja | null> {
  const ids = await expandCajaIds(cajaId);
  const abiertas = await listarSesionesAbiertas();
  if (abiertas.length === 0) return null;

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

  if (abierta?.caja_id) {
    const extraIds = await expandCajaIds(abierta.caja_id);
    extraIds.forEach((x) => ids.add(x));
  }

  const apertura = round2(abierta?.monto_apertura ?? 0);
  const desde = abierta?.abierta_en || new Date().toISOString().slice(0, 10);
  const effectiveCajeroId = abierta ? (abierta.cajero_id ?? undefined) : cajeroId;

  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencia = 0;
  let totalOtros = 0;

  try {
    const searchCajaIds = Array.from(ids);
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
    }
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

  // Fórmula contable única:
  // Fondo inicial + ventas netas en efectivo + entradas en efectivo - retiros y gastos - devoluciones en efectivo
  const montoEsperado = round2(
    apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones
  );

  return {
    cierre_id: abierta?.id,
    caja_id: abierta?.caja_id || cajaId,
    caja_label: abierta?.caja_label || `Caja #${abierta?.caja_id || cajaId}`,
    cajero_id: abierta?.cajero_id ?? null,
    cajero_nombre: abierta?.cajero_nombre ?? undefined,
    cajero_username: abierta?.cajero_username ?? undefined,
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
  const lockKey = input.cierre_id
    ? `close:${input.cierre_id}`
    : `close:caja:${String(input.caja_id)}`;

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

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mercato_cash_closures_updated'));
      }
      return cerradaDb;
    }

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
  });
}

// Exponer helper solo por compatibilidad con utilidades legacy; el historial nunca usa localStorage en Supabase
export function getSupabaseClientSafe() {
  return getSafeSupabaseClient();
}
