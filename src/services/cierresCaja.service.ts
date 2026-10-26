import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { CIERRE_COLUMNS, type CierreCaja } from '@/types/database';
import { getCashClosures, saveCashClosure, type CashClosure } from '@/lib/cashClosureStore';
import { obtenerCajas } from './cajas.service';
import { obtenerVentasTurno } from './ventas.service';
import { obtenerMovimientosCaja } from './movimientosCaja.service';

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
  c: CierreCaja,
  extra?: Partial<Pick<CashClosure, 'userName' | 'username' | 'cashRegisterLabel' | 'notes' | 'baseCash'>>
): CashClosure {
  const local = getCashClosures().find((x) => x.id === c.id);
  const closedAt = c.cerrada_en || local?.closedAt || '';
  return {
    id: c.id,
    code: c.codigo,
    userId: c.cajero_id ?? local?.userId ?? '',
    username: extra?.username || local?.username || '',
    userName: extra?.userName || local?.userName || '',
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
  extra?: Partial<Pick<CashClosure, 'userName' | 'username' | 'cashRegisterLabel' | 'notes'>>
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

export async function obtenerCierresCaja(params?: {
  signal?: AbortSignal;
}): Promise<CierreCaja[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    return getCashClosures().map(localToDb);
  }
  let query = sb
    .from('cierres_caja')
    .select(CIERRE_COLUMNS)
    .order('abierta_en', { ascending: false })
    .limit(100);
  if (params?.signal) query = query.abortSignal(params.signal);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CierreCaja[];
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
  if (!isSupabaseConfigured()) {
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
      notes: datos.notes,
    };
    saveCashClosure(closure);
    return localToDb(closure);
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('cierres_caja')
    .insert({
      codigo: datos.codigo,
      caja_id: datos.caja_id,
      cajero_id: datos.cajero_id ?? null,
      sucursal_id: datos.sucursal_id ?? null,
      monto_apertura: datos.monto_apertura,
      monto_esperado: datos.monto_esperado,
      monto_real: datos.monto_real,
      monto_diferencia: datos.monto_diferencia,
      total_ventas: datos.total_ventas ?? 0,
      total_efectivo: datos.total_efectivo ?? 0,
      total_tarjeta: datos.total_tarjeta ?? 0,
      total_transferencia: datos.total_transferencia ?? 0,
      estado: datos.estado,
      cerrada_en: datos.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .select(CIERRE_COLUMNS)
    .single();
  if (error) throw error;
  persistirRegistroCierre(data as CierreCaja, {
    userName: datos.cajero_nombre,
    username: datos.cajero_username,
    cashRegisterLabel: datos.caja_label,
    notes: datos.notes,
  });
  return data as CierreCaja;
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
};

export async function iniciarCaja(datos: NuevoInicioCajaInput): Promise<CierreCaja> {
  await cerrarSesionesAbiertasDeCaja(datos.caja_id).catch(() => 0);
  const code = datos.codigo || `AP-${Date.now().toString().slice(-6)}`;
  return guardarCierreCaja({
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
}

async function listarSesionesAbiertas(): Promise<CierreCaja[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    return getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
  }
  const { data, error } = await sb
    .from('cierres_caja')
    .select(CIERRE_COLUMNS)
    .eq('estado', 'abierta')
    .order('abierta_en', { ascending: false })
    .limit(50);
  if (error) throw error;
  const remote = (data ?? []) as CierreCaja[];
  const local = getCashClosures().map(localToDb).filter((c) => isOpenStatus(c.estado));
  const seen = new Set(remote.map((c) => c.id));
  return [...remote, ...local.filter((c) => !seen.has(c.id))];
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
  const sb = tryGetSupabase();
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

export async function obtenerCajaAbierta(cajaId?: string, cajeroId?: string): Promise<CierreCaja | null> {
  const ids = await expandCajaIds(cajaId);
  const sb = tryGetSupabase();

  const pickMatch = (list: CierreCaja[]): CierreCaja | null => {
    const abiertas = list.filter((c) => isOpenStatus(c.estado));
    if (abiertas.length === 0) return null;
    if (ids.size > 0) {
      const byCaja = abiertas.find((c) => ids.has(String(c.caja_id)));
      if (byCaja) return byCaja;
    }
    if (cajeroId) {
      const byCajero = abiertas.find((c) => c.cajero_id === cajeroId);
      if (byCajero) return byCajero;
    }
    return ids.size > 0 ? null : abiertas[0];
  };

  if (!sb) {
    return pickMatch(getCashClosures().map(localToDb));
  }

  let query = sb
    .from('cierres_caja')
    .select(CIERRE_COLUMNS)
    .eq('estado', 'abierta')
    .order('abierta_en', { ascending: false })
    .limit(20);

  const { data, error } = await query;
  if (error) throw error;
  const matched = pickMatch((data ?? []) as CierreCaja[]);
  if (matched) return matched;

  return pickMatch(getCashClosures().map(localToDb));
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
  const apertura = Number(abierta?.monto_apertura ?? 0);
  const desde = abierta?.abierta_en || new Date().toISOString().slice(0, 10);

  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalTransferencia = 0;
  let totalOtros = 0;

  try {
    const searchCajaIds = Array.from(ids);
    const ventas = await obtenerVentasTurno({
      cajaId: searchCajaIds.length > 0 ? searchCajaIds : cajaId,
      desde,
      limite: 1000,
    });
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
  try {
    const movimientos = await obtenerMovimientosCaja(abierta?.id, abierta?.caja_id || cajaId);
    const desdeTime = desde ? new Date(desde).getTime() : 0;
    for (const m of movimientos) {
      if (desdeTime > 0 && m.creado_en) {
        const mt = new Date(m.creado_en).getTime();
        if (!isNaN(mt) && mt < desdeTime - 5000) continue;
      }
      const monto = Number(m.monto || 0);
      if (m.tipo === 'entrada' || m.tipo === 'aporte') {
        totalEntradas += monto;
      } else if (m.tipo === 'salida' || m.tipo === 'retiro' || m.tipo === 'gasto') {
        totalRetiros += monto;
      }
    }
  } catch {
    // Ignorar si falla la carga de movimientos
  }

  const totalDevoluciones = 0;
  const montoEsperado = apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones;

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
  try {
    const abierta =
    (input.cierre_id
      ? ({ id: input.cierre_id } as Pick<CierreCaja, 'id'>)
      : null) || (await obtenerCajaAbierta(input.caja_id, input.cajero_id ?? undefined));

  const now = new Date().toISOString();
  const closureCode = `CC-${Date.now().toString().slice(-8)}`;
  const extraUi = {
    userName: input.cajero_nombre,
    username: input.cajero_username,
    cashRegisterLabel: input.caja_label,
    notes: input.notes,
  };
  const updateFields = {
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
      const existing = current.find((c) => c.id === abierta.id) ?? current.find((c) => c.status === 'abierta');
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
        return localToDb(closed);
      }
    } else {
      const sb = getSupabase();
      let { data, error } = await sb
        .from('cierres_caja')
        .update(updateFields)
        .eq('id', abierta.id)
        .select(CIERRE_COLUMNS)
        .single();
      if (error) {
        const { codigo: _omitCodigo, ...withoutCode } = updateFields;
        const retry = await sb
          .from('cierres_caja')
          .update(withoutCode)
          .eq('id', abierta.id)
          .select(CIERRE_COLUMNS)
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      persistirRegistroCierre(data as CierreCaja, extraUi);
      return data as CierreCaja;
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
  return saved;
  } finally {
    await cerrarSesionesAbiertasDeCaja(input.caja_id).catch(() => 0);
  }
}


