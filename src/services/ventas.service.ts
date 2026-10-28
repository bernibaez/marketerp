import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { VENTA_COLUMNS, type MetodoPago, type Venta, type DetalleVenta } from '@/types/database';
import { updateProductStockInStore } from '@/lib/productStore';
import { getCashClosures } from '@/lib/cashClosureStore';
import { crearCxcDesdeVenta } from './cxc.service';
import { AUTH_ACCOUNTS } from '@/lib/auth';

export type ItemVentaPayload = {
  producto_id?: string | null;
  combo_id?: string | null;
  tipo_item: 'producto' | 'combo';
  nombre_item: string;
  precio_unitario: number;
  costo_unitario: number;
  cantidad: number;
  porcentaje_impuesto?: number;
  subtotal: number;
};

export type PayloadVenta = {
  numero_factura?: string;
  ncf?: string | null;
  tipo_ncf?: string | null;
  sucursal_id?: string | null;
  cajero_id?: string | null;
  cajero_nombre?: string | null;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  caja_id?: string | null;
  subtotal: number;
  monto_impuesto: number;
  monto_descuento: number;
  monto_total: number;
  costo_total: number;
  metodo_pago: MetodoPago;
  monto_pagado: number;
  monto_efectivo?: number;
  monto_tarjeta?: number;
  monto_transferencia?: number;
  monto_credito?: number;
  devuelta_entregada?: number;
  items: ItemVentaPayload[];
};

export type ResultadoVenta = {
  venta_id: string;
  numero_factura: string;
  ncf: string | null;
};

export interface VentaConDetalle extends Venta {
  cliente_nombre?: string;
  cajero_nombre?: string;
  detalle_ventas?: DetalleVenta[];
}

const LOCAL_VENTAS_KEY = 'mercato_ventas_local';
const LOCAL_DETALLE_KEY = 'mercato_detalle_ventas_local';
const LOCAL_VENTAS_META_KEY = 'mercato_ventas_meta_map';
const LOCAL_CAJEROS_MAP_KEY = 'mercato_cajeros_nombre_map';

type VentaMetaInfo = {
  cajero_id?: string | null;
  cajero_nombre?: string | null;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  caja_id?: string | null;
  subtotal?: number;
  monto_impuesto?: number;
  monto_descuento?: number;
  monto_total?: number;
  costo_total?: number;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getVentasMetaMap(): Record<string, VentaMetaInfo> {
  try {
    const raw = localStorage.getItem(LOCAL_VENTAS_META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VentaMetaInfo>) : {};
  } catch {
    return {};
  }
}

function saveVentaMeta(ventaId: string, meta: VentaMetaInfo) {
  if (!ventaId) return;
  try {
    const map = getVentasMetaMap();
    map[ventaId] = { ...(map[ventaId] || {}), ...meta };
    localStorage.setItem(LOCAL_VENTAS_META_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function getCajerosNombreMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_CAJEROS_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberCajeroNombre(cajeroId?: string | null, cajeroNombre?: string | null) {
  if (!cajeroId || !cajeroNombre) return;
  const trimmed = cajeroNombre.trim();
  if (!trimmed || trimmed.toLowerCase() === 'cajero' || trimmed.toLowerCase() === 'usuario') return;
  try {
    const map = getCajerosNombreMap();
    map[String(cajeroId)] = trimmed;
    localStorage.setItem(LOCAL_CAJEROS_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getCurrentAuthUser(): { id?: string; name?: string; username?: string } | null {
  try {
    const raw = localStorage.getItem('mercato_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalPerfilesMap(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    for (const acc of AUTH_ACCOUNTS) {
      if (acc.id && acc.name) map.set(String(acc.id), acc.name);
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem('mercato_local_perfiles');
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{ id?: string; nombre_completo?: string }>;
      for (const p of parsed) {
        if (p?.id && p?.nombre_completo) {
          map.set(String(p.id), p.nombre_completo);
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    const closures = getCashClosures();
    for (const c of closures) {
      if (c.userId && c.userName && c.userName.trim()) {
        map.set(String(c.userId), c.userName.trim());
      }
    }
  } catch {
    // ignore
  }
  const cajerosMap = getCajerosNombreMap();
  for (const [k, v] of Object.entries(cajerosMap)) {
    if (k && v) map.set(k, v);
  }
  const authUser = getCurrentAuthUser();
  if (authUser?.id && authUser?.name) {
    map.set(String(authUser.id), authUser.name);
  }
  return map;
}

function extractJoinedName(rel: any, field: string): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    const first = rel[0];
    const val = first?.[field];
    return typeof val === 'string' && val.trim() ? val.trim() : null;
  }
  if (typeof rel === 'object') {
    const val = rel[field];
    return typeof val === 'string' && val.trim() ? val.trim() : null;
  }
  return null;
}

let cachedPerfilesPromise: Promise<Map<string, string>> | null = null;
let cachedPerfilesTimestamp = 0;

async function fetchPerfilesDirectory(): Promise<Map<string, string>> {
  const map = getLocalPerfilesMap();
  const sb = tryGetSupabase();
  if (!sb) return map;

  const now = Date.now();
  if (cachedPerfilesPromise && now - cachedPerfilesTimestamp < 15_000) {
    const remoteMap = await cachedPerfilesPromise;
    for (const [k, v] of remoteMap.entries()) map.set(k, v);
    return map;
  }

  cachedPerfilesTimestamp = now;
  cachedPerfilesPromise = (async () => {
    const remote = new Map<string, string>();
    try {
      const { data } = await sb.from('perfiles').select('id, nombre_completo, correo');
      for (const row of data ?? []) {
        const r = row as { id?: string; nombre_completo?: string; correo?: string };
        if (r.id) {
          const name = (r.nombre_completo || r.correo || '').trim();
          if (name) {
            remote.set(String(r.id), name);
            rememberCajeroNombre(String(r.id), name);
          }
        }
      }
    } catch {
      // ignore RLS or network error
    }
    return remote;
  })();

  const remoteMap = await cachedPerfilesPromise;
  for (const [k, v] of remoteMap.entries()) map.set(k, v);
  return map;
}

function resolveCajeroForRow(
  row: any,
  perfilesMap: Map<string, string>,
  metaMap: Record<string, VentaMetaInfo>
): string {
  const ventaId = String(row.id || '');
  const meta = metaMap[ventaId];

  // 1. Nombre directo desde el join de perfiles en Supabase
  const joinedPerfil = extractJoinedName(row.perfiles, 'nombre_completo');
  if (joinedPerfil) {
    if (row.cajero_id) rememberCajeroNombre(String(row.cajero_id), joinedPerfil);
    return joinedPerfil;
  }

  // 2. Nombre guardado en metadatos de la venta al momento de facturar
  if (meta?.cajero_nombre && meta.cajero_nombre.trim() && meta.cajero_nombre !== 'Cajero') {
    return meta.cajero_nombre.trim();
  }

  // 3. Buscar por cajero_id en el directorio de perfiles (Supabase + local + cierres)
  const cajeroId = row.cajero_id || meta?.cajero_id;
  if (cajeroId) {
    const byId = perfilesMap.get(String(cajeroId));
    if (byId && byId.trim()) return byId.trim();
  }

  // 4. Buscar por sesión de caja (caja_id) en cierres locales
  const cajaId = row.caja_id || meta?.caja_id;
  if (cajaId) {
    const closures = getCashClosures();
    const rowTime = row.creado_en ? new Date(row.creado_en).getTime() : 0;
    const matchingClosure = closures.find((c) => {
      const sameBox =
        String(c.cashRegisterId) === String(cajaId) ||
        String(c.cashRegisterLabel || '').toLowerCase().includes(String(cajaId).toLowerCase());
      if (!sameBox || !c.userName) return false;
      if (!rowTime || !c.openedAt) return true;
      const openTime = new Date(c.openedAt).getTime();
      const closeTime = c.closedAt ? new Date(c.closedAt).getTime() : Date.now() + 86_400_000;
      return rowTime >= openTime - 60_000 && rowTime <= closeTime + 60_000;
    });
    if (matchingClosure?.userName) return matchingClosure.userName;
  }

  // 5. Si la fila ya trae cajero_nombre válido
  if (typeof row.cajero_nombre === 'string' && row.cajero_nombre.trim() && row.cajero_nombre !== 'Cajero') {
    return row.cajero_nombre.trim();
  }

  // 6. Usuario autenticado actual si coincide su ID
  const authUser = getCurrentAuthUser();
  if (authUser?.id && cajeroId && String(authUser.id) === String(cajeroId) && authUser.name) {
    return authUser.name;
  }

  return meta?.cajero_nombre || 'No especificado';
}

function normalizeVentaAmounts(row: any, detalles: DetalleVenta[], meta?: VentaMetaInfo) {
  const hasDetalles = Array.isArray(detalles) && detalles.length > 0;
  const itemsSubtotal = hasDetalles
    ? round2(
        detalles.reduce(
          (sum, d) =>
            sum +
            (Number(d.subtotal) > 0
              ? Number(d.subtotal)
              : round2(Number(d.precio_unitario || 0) * Number(d.cantidad || 0))),
          0
        )
      )
    : 0;
  const itemsCosto = hasDetalles
    ? round2(
        detalles.reduce(
          (sum, d) => sum + Number(d.costo_unitario || 0) * Number(d.cantidad || 0),
          0
        )
      )
    : 0;

  let subtotal = round2(Number(row.subtotal ?? meta?.subtotal ?? 0));
  if (subtotal <= 0 && itemsSubtotal > 0) {
    subtotal = itemsSubtotal;
  }

  const montoImpuesto = round2(Number(row.monto_impuesto ?? meta?.monto_impuesto ?? 0));
  const montoDescuento = round2(Number(row.monto_descuento ?? meta?.monto_descuento ?? 0));

  let montoTotal = round2(Number(row.monto_total ?? meta?.monto_total ?? 0));
  const expectedTotalFromParts = round2(Math.max(0, subtotal + montoImpuesto - montoDescuento));

  if (montoTotal <= 0 && expectedTotalFromParts > 0) {
    montoTotal = expectedTotalFromParts;
  } else if (
    montoDescuento > 0 &&
    Math.abs(montoTotal - round2(subtotal + montoImpuesto)) < 0.02 &&
    expectedTotalFromParts !== montoTotal
  ) {
    montoTotal = expectedTotalFromParts;
  }

  let costoTotal = round2(Number(row.costo_total ?? meta?.costo_total ?? 0));
  if (costoTotal <= 0 && itemsCosto > 0) {
    costoTotal = itemsCosto;
  }

  return {
    subtotal,
    monto_impuesto: montoImpuesto,
    monto_descuento: montoDescuento,
    monto_total: montoTotal,
    costo_total: costoTotal,
  };
}

function getLocalVentas(): VentaConDetalle[] {
  try {
    const raw = localStorage.getItem(LOCAL_VENTAS_KEY);
    return raw ? (JSON.parse(raw) as VentaConDetalle[]) : [];
  } catch {
    return [];
  }
}

function saveLocalVentas(ventas: VentaConDetalle[]) {
  localStorage.setItem(LOCAL_VENTAS_KEY, JSON.stringify(ventas));
}

export async function procesarVenta(payload: PayloadVenta): Promise<ResultadoVenta> {
  const authUser = getCurrentAuthUser();
  const effectiveCajeroId = payload.cajero_id || authUser?.id || null;
  const perfilesLocales = getLocalPerfilesMap();
  const effectiveCajeroNombre =
    (payload.cajero_nombre && payload.cajero_nombre.trim()) ||
    (effectiveCajeroId ? perfilesLocales.get(String(effectiveCajeroId)) : undefined) ||
    authUser?.name ||
    'Cajero';
  const effectiveClienteNombre =
    (payload.cliente_nombre && payload.cliente_nombre.trim()) || 'Cliente General';

  if (effectiveCajeroId && effectiveCajeroNombre) {
    rememberCajeroNombre(effectiveCajeroId, effectiveCajeroNombre);
  }

  const exactItemsSubtotal = round2(
    payload.items.reduce(
      (sum, it) =>
        sum +
        (Number(it.subtotal) > 0
          ? Number(it.subtotal)
          : round2(Number(it.precio_unitario || 0) * Number(it.cantidad || 0))),
      0
    )
  );
  const exactSubtotal = round2(Number(payload.subtotal) > 0 ? payload.subtotal : exactItemsSubtotal);
  const exactTax = round2(Number(payload.monto_impuesto || 0));
  const exactDiscount = round2(Number(payload.monto_descuento || 0));
  const exactTotal = round2(
    Number(payload.monto_total) > 0
      ? payload.monto_total
      : Math.max(0, exactSubtotal + exactTax - exactDiscount)
  );
  const exactCostoTotal = round2(
    Number(payload.costo_total) > 0
      ? payload.costo_total
      : payload.items.reduce((s, it) => s + Number(it.costo_unitario || 0) * Number(it.cantidad || 0), 0)
  );

  if (!isSupabaseConfigured()) {
    const id = crypto.randomUUID();
    const numero =
      payload.numero_factura ??
      `FAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 8)}`;

    const items: DetalleVenta[] = payload.items.map((it) => ({
      id: crypto.randomUUID(),
      venta_id: id,
      producto_id: it.producto_id ?? null,
      combo_id: it.combo_id ?? null,
      tipo_item: it.tipo_item,
      nombre_item: it.nombre_item,
      precio_unitario: round2(it.precio_unitario),
      costo_unitario: round2(it.costo_unitario),
      cantidad: Number(it.cantidad),
      porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 0),
      subtotal: round2(
        Number(it.subtotal) > 0 ? it.subtotal : it.precio_unitario * it.cantidad
      ),
    }));

    const venta: VentaConDetalle = {
      id,
      numero_factura: numero,
      ncf: payload.ncf ?? null,
      tipo_ncf: payload.tipo_ncf ?? null,
      sucursal_id: payload.sucursal_id ?? null,
      cajero_id: effectiveCajeroId,
      cliente_id: payload.cliente_id ?? null,
      caja_id: payload.caja_id ?? null,
      subtotal: exactSubtotal,
      monto_impuesto: exactTax,
      monto_descuento: exactDiscount,
      monto_total: exactTotal,
      costo_total: exactCostoTotal,
      metodo_pago: payload.metodo_pago,
      monto_pagado: round2(payload.monto_pagado || exactTotal),
      monto_efectivo: round2(payload.monto_efectivo ?? 0),
      monto_tarjeta: round2(payload.monto_tarjeta ?? 0),
      monto_transferencia: round2(payload.monto_transferencia ?? 0),
      monto_credito: round2(payload.monto_credito ?? 0),
      devuelta_entregada: round2(payload.devuelta_entregada ?? 0),
      estado: 'completada',
      creado_en: new Date().toISOString(),
      cliente_nombre: effectiveClienteNombre,
      cajero_nombre: effectiveCajeroNombre,
      detalle_ventas: items,
    };

    saveVentaMeta(id, {
      cajero_id: effectiveCajeroId,
      cajero_nombre: effectiveCajeroNombre,
      cliente_id: payload.cliente_id ?? null,
      cliente_nombre: effectiveClienteNombre,
      caja_id: payload.caja_id ?? null,
      subtotal: exactSubtotal,
      monto_impuesto: exactTax,
      monto_descuento: exactDiscount,
      monto_total: exactTotal,
      costo_total: exactCostoTotal,
    });
    saveLocalVentas([venta, ...getLocalVentas()]);

    // Descontar stock local (soporta cantidades fraccionarias exactas)
    for (const item of payload.items) {
      if (item.tipo_item === 'producto' && item.producto_id) {
        updateProductStockInStore(item.producto_id, -item.cantidad);
      }
    }

    return { venta_id: id, numero_factura: numero, ncf: payload.ncf ?? null };
  }

  const isUUID = (str: string | null | undefined): boolean =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str));

  const sanitizedPayload = {
    ...payload,
    subtotal: exactSubtotal,
    monto_impuesto: exactTax,
    monto_descuento: exactDiscount,
    monto_total: exactTotal,
    costo_total: exactCostoTotal,
    sucursal_id: isUUID(payload.sucursal_id) ? payload.sucursal_id : null,
    cajero_id: isUUID(effectiveCajeroId) ? effectiveCajeroId : null,
    cliente_id: isUUID(payload.cliente_id) ? payload.cliente_id : null,
    items: payload.items.map((it) => ({
      ...it,
      precio_unitario: round2(it.precio_unitario),
      costo_unitario: round2(it.costo_unitario),
      cantidad: Number(it.cantidad),
      porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 0),
      subtotal: round2(
        Number(it.subtotal) > 0 ? it.subtotal : it.precio_unitario * it.cantidad
      ),
      producto_id: isUUID(it.producto_id) ? it.producto_id : null,
      combo_id: isUUID(it.combo_id) ? it.combo_id : null,
    })),
  };

  const sb = getSupabase();
  const { data, error } = await sb.rpc('procesar_venta_pos', { p_payload: sanitizedPayload });
  if (error) throw error;
  const resultado = data as ResultadoVenta;

  if (resultado?.venta_id) {
    saveVentaMeta(resultado.venta_id, {
      cajero_id: effectiveCajeroId,
      cajero_nombre: effectiveCajeroNombre,
      cliente_id: payload.cliente_id ?? null,
      cliente_nombre: effectiveClienteNombre,
      caja_id: payload.caja_id ?? null,
      subtotal: exactSubtotal,
      monto_impuesto: exactTax,
      monto_descuento: exactDiscount,
      monto_total: exactTotal,
      costo_total: exactCostoTotal,
    });
  }

  const credito = Number(payload.monto_credito ?? 0);
  if (credito > 0 || payload.metodo_pago === 'credito') {
    try {
      await crearCxcDesdeVenta({
        venta_id: resultado.venta_id,
        numero_factura: resultado.numero_factura,
        cliente_id: payload.cliente_id,
        monto_credito: credito > 0 ? credito : exactTotal,
      });
    } catch {
      // No bloquear si CxC falla
    }
  }

  return resultado;
}

export async function obtenerHistorialVentas(params: {
  pagina?: number;
  limite?: number;
  fechaInicio?: string;
  fechaFin?: string;
  busqueda?: string;
  cajaId?: string | string[];
  cajeroId?: string;
  excluirAnuladas?: boolean;
  signal?: AbortSignal;
}): Promise<{ datos: VentaConDetalle[]; total: number }> {
  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 50;
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  const sb = tryGetSupabase();
  if (!sb) {
    const perfilesMap = getLocalPerfilesMap();
    const metaMap = getVentasMetaMap();
    let list = getLocalVentas().map((v) => {
      const meta = metaMap[v.id];
      const amounts = normalizeVentaAmounts(v, v.detalle_ventas ?? [], meta);
      return {
        ...v,
        ...amounts,
        cajero_nombre: resolveCajeroForRow(v, perfilesMap, metaMap),
        cliente_nombre: v.cliente_nombre || meta?.cliente_nombre || 'Cliente general',
      };
    });
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.numero_factura.toLowerCase().includes(q) ||
          (v.ncf ?? '').toLowerCase().includes(q) ||
          (v.cliente_nombre ?? '').toLowerCase().includes(q) ||
          (v.cajero_nombre ?? '').toLowerCase().includes(q)
      );
    }
    if (params.fechaInicio) {
      list = list.filter((v) => v.creado_en >= params.fechaInicio!);
    }
    if (params.fechaFin) {
      list = list.filter((v) => v.creado_en <= params.fechaFin! + 'T23:59:59');
    }
    if (params.cajaId) {
      if (Array.isArray(params.cajaId)) {
        const allowed = new Set(params.cajaId.map(String));
        list = list.filter((v) => allowed.has(String(v.caja_id ?? '')));
      } else {
        list = list.filter((v) => String(v.caja_id ?? '') === String(params.cajaId));
      }
    }
    if (params.cajeroId) {
      list = list.filter((v) => String(v.cajero_id ?? '') === String(params.cajeroId));
    }
    if (params.excluirAnuladas) {
      list = list.filter((v) => v.estado !== 'anulada' && (v.estado as string) !== 'cancelled');
    }
    return { datos: list.slice(desde, hasta + 1), total: list.length };
  }

  const buildQuery = (selectClause: string) => {
    let q = sb
      .from('ventas')
      .select(selectClause, { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(desde, hasta);

    if (params.busqueda?.trim()) {
      const term = params.busqueda.trim();
      q = q.or(`numero_factura.ilike."%${term}%",ncf.ilike."%${term}%"`);
    }
    if (params.fechaInicio) q = q.gte('creado_en', params.fechaInicio);
    if (params.fechaFin) q = q.lte('creado_en', params.fechaFin + 'T23:59:59');
    if (params.cajaId) {
      if (Array.isArray(params.cajaId)) {
        if (params.cajaId.length === 1) {
          q = q.eq('caja_id', params.cajaId[0]);
        } else if (params.cajaId.length > 1) {
          q = q.in('caja_id', params.cajaId);
        }
      } else {
        q = q.eq('caja_id', params.cajaId);
      }
    }
    if (params.cajeroId) q = q.eq('cajero_id', params.cajeroId);
    if (params.excluirAnuladas) q = q.neq('estado', 'anulada');
    if (params.signal) q = q.abortSignal(params.signal);
    return q;
  };

  let { data, error, count } = await buildQuery(
    '*, clientes(nombre), perfiles!cajero_id(nombre_completo), detalle_ventas(*)'
  );
  if (error) {
    const fallback = await buildQuery('*, clientes(nombre), perfiles!cajero_id(nombre_completo)');
    if (fallback.error) throw fallback.error;
    data = fallback.data;
    count = fallback.count;
  }

  const [perfilesMap] = await Promise.all([fetchPerfilesDirectory()]);
  const metaMap = getVentasMetaMap();

  const datos: VentaConDetalle[] = (data ?? []).map((row: any) => {
    const meta = metaMap[String(row.id)];
    const rawDetalles: DetalleVenta[] = Array.isArray(row.detalle_ventas)
      ? row.detalle_ventas.map((d: any) => ({
          id: d.id,
          venta_id: d.venta_id,
          producto_id: d.producto_id,
          combo_id: d.combo_id,
          tipo_item: d.tipo_item,
          nombre_item: d.nombre_item,
          precio_unitario: Number(d.precio_unitario),
          costo_unitario: Number(d.costo_unitario),
          cantidad: Number(d.cantidad),
          porcentaje_impuesto: Number(d.porcentaje_impuesto || 0),
          subtotal: Number(d.subtotal),
        }))
      : [];

    const amounts = normalizeVentaAmounts(row, rawDetalles, meta);
    const clienteJoined = extractJoinedName(row.clientes, 'nombre');

    return {
      id: row.id,
      numero_factura: row.numero_factura,
      ncf: row.ncf,
      tipo_ncf: row.tipo_ncf,
      sucursal_id: row.sucursal_id,
      cajero_id: row.cajero_id ?? meta?.cajero_id ?? null,
      cliente_id: row.cliente_id ?? meta?.cliente_id ?? null,
      caja_id: row.caja_id ?? meta?.caja_id ?? null,
      subtotal: amounts.subtotal,
      monto_impuesto: amounts.monto_impuesto,
      monto_descuento: amounts.monto_descuento,
      monto_total: amounts.monto_total,
      costo_total: amounts.costo_total,
      metodo_pago: row.metodo_pago,
      monto_pagado: round2(Number(row.monto_pagado || amounts.monto_total)),
      monto_efectivo: round2(Number(row.monto_efectivo || 0)),
      monto_tarjeta: round2(Number(row.monto_tarjeta || 0)),
      monto_transferencia: round2(Number(row.monto_transferencia || 0)),
      monto_credito: round2(Number(row.monto_credito || 0)),
      devuelta_entregada: round2(Number(row.devuelta_entregada || 0)),
      estado: row.estado,
      creado_en: row.creado_en,
      cliente_nombre: clienteJoined || meta?.cliente_nombre || 'Cliente general',
      cajero_nombre: resolveCajeroForRow(row, perfilesMap, metaMap),
      ...(rawDetalles.length > 0 ? { detalle_ventas: rawDetalles } : {}),
    };
  });

  return { datos, total: count ?? 0 };
}

/** Ventas del turno (caja/cajero) con detalle de ítems — para resumen POS / admin. */
export async function obtenerVentasTurno(params: {
  cajaId?: string | string[];
  cajeroId?: string;
  desde?: string;
  limite?: number;
}): Promise<VentaConDetalle[]> {
  const { datos } = await obtenerHistorialVentas({
    pagina: 1,
    limite: params.limite ?? 500,
    cajaId: params.cajaId,
    cajeroId: params.cajeroId,
    fechaInicio: params.desde?.slice(0, 10),
    excluirAnuladas: true,
  });

  if (datos.length === 0) return [];

  // Filtrar por hora exacta de apertura comparando timestamps numéricos
  const desdeTime = params.desde ? new Date(params.desde).getTime() : 0;
  const filtradas = desdeTime > 0
    ? datos.filter((v) => {
        const t = new Date(v.creado_en).getTime();
        return !isNaN(t) ? t >= desdeTime - 5000 : true;
      })
    : datos;

  const sb = tryGetSupabase();
  if (!sb) {
    return filtradas.map((v) => {
      const local = getLocalVentas().find((x) => x.id === v.id);
      return local ?? v;
    });
  }

  // Si obtenerHistorialVentas ya trajo detalle_ventas, solo consultar las que falten
  const missingIds = filtradas
    .filter((v) => !Array.isArray(v.detalle_ventas) || v.detalle_ventas.length === 0)
    .map((v) => v.id);

  if (missingIds.length === 0) {
    return filtradas;
  }

  const { data: detalles } = await sb.from('detalle_ventas').select('*').in('venta_id', missingIds);
  const byVenta = new Map<string, DetalleVenta[]>();
  for (const d of detalles ?? []) {
    const row = d as DetalleVenta;
    const arr = byVenta.get(row.venta_id) ?? [];
    arr.push({
      ...row,
      precio_unitario: Number(row.precio_unitario),
      costo_unitario: Number(row.costo_unitario),
      cantidad: Number(row.cantidad),
      porcentaje_impuesto: Number(row.porcentaje_impuesto || 0),
      subtotal: Number(row.subtotal),
    });
    byVenta.set(row.venta_id, arr);
  }

  return filtradas.map((v) => ({
    ...v,
    detalle_ventas:
      Array.isArray(v.detalle_ventas) && v.detalle_ventas.length > 0
        ? v.detalle_ventas
        : (byVenta.get(v.id) ?? []),
  }));
}

export async function obtenerVentaPorNumeroFactura(
  numeroFactura: string
): Promise<VentaConDetalle | null> {
  const raw = (numeroFactura || '').trim();
  if (!raw) return null;

  // Normalizar: remover prefijos como "No.", "#", espacios
  const codigo = raw.replace(/^[#\s]+/, '').replace(/^No\.?\s*/i, '');
  const codigoUpper = codigo.toUpperCase();
  const cleanCode = codigoUpper.replace(/^FAC-?/i, '');

  const sb = tryGetSupabase();
  if (sb) {
    try {
      // 1. Búsqueda directa o flexible en Supabase (por numero_factura exacto, NCF exacto, o coincidencias parciales)
      const { data: ventas, error } = await sb
        .from('ventas')
        .select('id, numero_factura, ncf, creado_en')
        .or(`numero_factura.ilike.${codigo},ncf.ilike.${codigo},numero_factura.ilike.%${cleanCode}%,ncf.ilike.%${codigo}%`)
        .order('creado_en', { ascending: false })
        .limit(5);

      if (!error && ventas && ventas.length > 0) {
        // Priorizar coincidencia exacta
        const exact =
          ventas.find(
            (v) =>
              (v.numero_factura && v.numero_factura.toUpperCase() === codigoUpper) ||
              (v.ncf && v.ncf.toUpperCase() === codigoUpper)
          ) || ventas[0];

        const full = await obtenerVentaPorId(String(exact.id));
        if (full) return full;
      }
    } catch {
      // Continuar con fallback local
    }
  }

  // 2. Fallback a ventas locales (offline o guardadas localmente)
  const list = getLocalVentas();
  const found = list.find((v) => {
    const num = (v.numero_factura || '').toUpperCase();
    const ncf = (v.ncf || '').toUpperCase();
    return (
      num === codigoUpper ||
      ncf === codigoUpper ||
      (cleanCode && num.includes(cleanCode)) ||
      (codigoUpper && ncf.includes(codigoUpper)) ||
      (v.id && v.id.toLowerCase() === codigo.toLowerCase())
    );
  });

  return found ?? null;
}

export async function obtenerUltimasVentasParaDevolucion(limite = 8): Promise<VentaConDetalle[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    return getLocalVentas()
      .filter((v) => v.estado !== 'anulada')
      .slice(0, limite);
  }

  try {
    const { data, error } = await sb
      .from('ventas')
      .select('id')
      .neq('estado', 'anulada')
      .order('creado_en', { ascending: false })
      .limit(limite);

    if (error || !data) return getLocalVentas().slice(0, limite);

    const ventas = await Promise.all(
      data.map((row) => obtenerVentaPorId(String(row.id)))
    );
    return ventas.filter(Boolean) as VentaConDetalle[];
  } catch {
    return getLocalVentas().slice(0, limite);
  }
}

export async function obtenerVentaPorId(ventaId: string): Promise<VentaConDetalle | null> {
  const sb = tryGetSupabase();
  const metaMap = getVentasMetaMap();
  if (!sb) {
    const perfilesMap = getLocalPerfilesMap();
    const list = getLocalVentas();
    const found = list.find((v) => v.id === ventaId);
    if (!found) return null;
    const meta = metaMap[found.id];
    const amounts = normalizeVentaAmounts(found, found.detalle_ventas ?? [], meta);
    return {
      ...found,
      ...amounts,
      cajero_nombre: resolveCajeroForRow(found, perfilesMap, metaMap),
      cliente_nombre: found.cliente_nombre || meta?.cliente_nombre || 'Cliente general',
    };
  }

  const [{ data: venta, error: vErr }, { data: detalle }, perfilesMap] = await Promise.all([
    sb
      .from('ventas')
      .select('*, clientes(nombre, rnc_cedula), perfiles!cajero_id(nombre_completo)')
      .eq('id', ventaId)
      .single(),
    sb
      .from('detalle_ventas')
      .select('*')
      .eq('venta_id', ventaId),
    fetchPerfilesDirectory(),
  ]);

  if (vErr || !venta) return null;

  const detalleMapped: DetalleVenta[] = (detalle ?? []).map((d: any) => ({
    id: d.id,
    venta_id: d.venta_id,
    producto_id: d.producto_id,
    combo_id: d.combo_id,
    tipo_item: d.tipo_item,
    nombre_item: d.nombre_item,
    precio_unitario: Number(d.precio_unitario),
    costo_unitario: Number(d.costo_unitario),
    cantidad: Number(d.cantidad),
    porcentaje_impuesto: Number(d.porcentaje_impuesto || 0),
    subtotal: Number(d.subtotal),
  }));

  const meta = metaMap[String(venta.id)];
  const amounts = normalizeVentaAmounts(venta, detalleMapped, meta);
  const clienteJoined = extractJoinedName(venta.clientes, 'nombre');

  return {
    id: venta.id,
    numero_factura: venta.numero_factura,
    ncf: venta.ncf,
    tipo_ncf: venta.tipo_ncf,
    sucursal_id: venta.sucursal_id,
    cajero_id: venta.cajero_id ?? meta?.cajero_id ?? null,
    cliente_id: venta.cliente_id ?? meta?.cliente_id ?? null,
    caja_id: venta.caja_id ?? meta?.caja_id ?? null,
    subtotal: amounts.subtotal,
    monto_impuesto: amounts.monto_impuesto,
    monto_descuento: amounts.monto_descuento,
    monto_total: amounts.monto_total,
    costo_total: amounts.costo_total,
    metodo_pago: venta.metodo_pago,
    monto_pagado: round2(Number(venta.monto_pagado || amounts.monto_total)),
    monto_efectivo: round2(Number(venta.monto_efectivo || 0)),
    monto_tarjeta: round2(Number(venta.monto_tarjeta || 0)),
    monto_transferencia: round2(Number(venta.monto_transferencia || 0)),
    monto_credito: round2(Number(venta.monto_credito || 0)),
    devuelta_entregada: round2(Number(venta.devuelta_entregada || 0)),
    estado: venta.estado,
    creado_en: venta.creado_en,
    cliente_nombre: clienteJoined || meta?.cliente_nombre || 'Cliente general',
    cajero_nombre: resolveCajeroForRow(venta, perfilesMap, metaMap),
    detalle_ventas: detalleMapped,
  };
}

export async function anularVenta(ventaId: string, motivo: string = 'Anulación'): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) {
    const list = getLocalVentas().map((v) =>
      v.id === ventaId ? { ...v, estado: 'anulada' as const } : v
    );
    saveLocalVentas(list);
    return;
  }

  try {
    const { error } = await sb.rpc('anular_venta_pos', {
      p_venta_id: ventaId,
      p_motivo: motivo,
    });
    if (!error) return;
  } catch {
    // Fallback a actualización directa
  }

  const { error } = await sb
    .from('ventas')
    .update({ estado: 'anulada' })
    .eq('id', ventaId);

  if (error) throw error;
}

export type ActualizarVentaPayload = {
  cliente_id?: string | null;
  metodo_pago?: MetodoPago;
  tipo_ncf?: string | null;
  ncf?: string | null;
  monto_descuento?: number;
  monto_total?: number;
  estado?: Venta['estado'];
};

export async function actualizarVenta(
  ventaId: string,
  payload: ActualizarVentaPayload
): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) {
    const list = getLocalVentas().map((v) => {
      if (v.id !== ventaId) return v;
      const nextDescuento =
        payload.monto_descuento !== undefined ? Number(payload.monto_descuento) : v.monto_descuento;
      const nextTotal =
        payload.monto_total !== undefined
          ? Number(payload.monto_total)
          : payload.monto_descuento !== undefined
            ? round2(Math.max(0, v.subtotal + v.monto_impuesto - nextDescuento))
            : v.monto_total;
      return {
        ...v,
        ...payload,
        monto_descuento: nextDescuento,
        monto_total: nextTotal,
      };
    });
    saveLocalVentas(list);
    return;
  }

  const updateData: ActualizarVentaPayload = { ...payload };
  if (payload.monto_descuento !== undefined && payload.monto_total === undefined) {
    try {
      const { data: current } = await sb
        .from('ventas')
        .select('subtotal, monto_impuesto')
        .eq('id', ventaId)
        .single();
      if (current) {
        updateData.monto_total = round2(
          Math.max(
            0,
            Number(current.subtotal || 0) +
              Number(current.monto_impuesto || 0) -
              Number(payload.monto_descuento || 0)
          )
        );
      }
    } catch {
      // ignore
    }
  }

  const { error } = await sb
    .from('ventas')
    .update(updateData)
    .eq('id', ventaId);

  if (error) throw error;

  if (updateData.monto_descuento !== undefined || updateData.monto_total !== undefined) {
    saveVentaMeta(ventaId, {
      ...(updateData.monto_descuento !== undefined ? { monto_descuento: updateData.monto_descuento } : {}),
      ...(updateData.monto_total !== undefined ? { monto_total: updateData.monto_total } : {}),
    });
  }
}
