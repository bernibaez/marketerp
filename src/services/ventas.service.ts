import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { VENTA_COLUMNS, type MetodoPago, type Venta, type DetalleVenta, type TipoItemVenta } from '@/types/database';
import { updateProductStockInStore, getStoredProducts } from '@/lib/productStore';
import { getCashClosures } from '@/lib/cashClosureStore';
import { crearCxcDesdeVenta } from './cxc.service';
import { AUTH_ACCOUNTS } from '@/lib/auth';
import { isAbortError } from '@/lib/isAbortError';
import { logAuditEvent } from '@/lib/auditStore';

function isUUID(str: string | null | undefined): boolean {
  return Boolean(
    str && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
  );
}

const INVALID_CASHIER_NAMES = new Set([
  'cajero',
  'cajero activo',
  'usuario',
  'sin turno activo',
  'disponible / sin turno activo',
  'sra. alba iris martinez',
  'luisa fernández',
  'luisa fernandez',
  'no especificado',
]);

function isValidCashierName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !INVALID_CASHIER_NAMES.has(trimmed.toLowerCase());
}

export type ItemVentaPayload = {
  producto_id?: string | null;
  combo_id?: string | null;
  tipo_item: 'producto' | 'combo';
  nombre_item: string;
  sku?: string | null;
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
  numero_factura?: string;
  ncf?: string | null;
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
  detalle_ventas?: Array<DetalleVenta & { sku?: string | null }>;
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
  if (!cajeroId || !isValidCashierName(cajeroNombre)) return;
  const trimmed = cajeroNombre!.trim();
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
  if (isValidCashierName(joinedPerfil)) {
    if (row.cajero_id) rememberCajeroNombre(String(row.cajero_id), joinedPerfil);
    return joinedPerfil!.trim();
  }

  // 2. Nombre guardado en metadatos de la venta al momento de facturar
  if (isValidCashierName(meta?.cajero_nombre)) {
    return meta!.cajero_nombre!.trim();
  }

  // 3. Buscar por cajero_id en el directorio de perfiles (Supabase + local + cierres)
  const cajeroId = row.cajero_id || meta?.cajero_id;
  if (cajeroId) {
    const byId = perfilesMap.get(String(cajeroId));
    if (isValidCashierName(byId)) return byId!.trim();
  }

  // 4. Si la fila ya trae cajero_nombre válido
  if (isValidCashierName(row.cajero_nombre)) {
    return row.cajero_nombre.trim();
  }

  // 5. Buscar por sesión de caja (caja_id) en cierres locales
  const cajaId = row.caja_id || meta?.caja_id;
  if (cajaId) {
    const closures = getCashClosures();
    const rowTime = row.creado_en ? new Date(row.creado_en).getTime() : 0;
    const matchingClosure = closures.find((c) => {
      const sameBox =
        String(c.cashRegisterId) === String(cajaId) ||
        String(c.cashRegisterLabel || '').toLowerCase().includes(String(cajaId).toLowerCase());
      if (!sameBox || !isValidCashierName(c.userName)) return false;
      if (!rowTime || !c.openedAt) return true;
      const openTime = new Date(c.openedAt).getTime();
      const closeTime = c.closedAt ? new Date(c.closedAt).getTime() : Date.now() + 86_400_000;
      return rowTime >= openTime - 60_000 && rowTime <= closeTime + 60_000;
    });
    if (matchingClosure?.userName) return matchingClosure.userName.trim();
  }

  // 6. Usuario autenticado actual
  const authUser = getCurrentAuthUser();
  if (authUser?.name && isValidCashierName(authUser.name)) {
    if (!cajeroId || String(authUser.id) === String(cajeroId)) {
      return authUser.name.trim();
    }
  }

  return (meta?.cajero_nombre && meta.cajero_nombre.trim()) || authUser?.name || 'Cajero';
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
  const effectiveCajeroId = authUser?.id || payload.cajero_id || null;
  const perfilesLocales = getLocalPerfilesMap();
  const payloadCajeroValido = isValidCashierName(payload.cajero_nombre)
    ? payload.cajero_nombre!.trim()
    : '';
  const effectiveCajeroNombre =
    (authUser?.name && isValidCashierName(authUser.name) ? authUser.name.trim() : '') ||
    payloadCajeroValido ||
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

    const items: Array<DetalleVenta & { sku?: string | null }> = payload.items.map((it) => ({
      id: crypto.randomUUID(),
      venta_id: id,
      producto_id: it.producto_id ?? null,
      combo_id: it.combo_id ?? null,
      tipo_item: it.tipo_item,
      nombre_item: it.nombre_item,
      sku: it.sku ?? null,
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
      numero_factura: numero,
      ncf: payload.ncf ?? null,
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
      detalle_ventas: items,
    });
    saveLocalVentas([venta, ...getLocalVentas().filter((v) => v.id !== id)]);

    // Descontar stock local (soporta cantidades fraccionarias exactas y presentaciones)
    for (const item of payload.items) {
      if (item.tipo_item === 'producto' && item.producto_id) {
        let deductId = item.producto_id;
        let deductQty = item.cantidad;
        const stored = getStoredProducts().find((p) => p.id === item.producto_id);
        const baseId = (stored as any)?.producto_base_id;
        const factor = Number((stored as any)?.factor_conversion || 1);
        if (baseId && factor > 1) {
          deductId = baseId;
          deductQty = item.cantidad * factor;
        }
        updateProductStockInStore(deductId, -deductQty);
      }
    }

    return { venta_id: id, numero_factura: numero, ncf: payload.ncf ?? null };
  }

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
    const localItems: Array<DetalleVenta & { sku?: string | null }> = payload.items.map((it, idx) => ({
      id: `${resultado.venta_id}-item-${idx + 1}`,
      venta_id: resultado.venta_id,
      producto_id: it.producto_id ?? null,
      combo_id: it.combo_id ?? null,
      tipo_item: it.tipo_item,
      nombre_item: it.nombre_item,
      sku: it.sku ?? null,
      precio_unitario: round2(it.precio_unitario),
      costo_unitario: round2(it.costo_unitario),
      cantidad: Number(it.cantidad),
      porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 0),
      subtotal: round2(
        Number(it.subtotal) > 0 ? it.subtotal : it.precio_unitario * it.cantidad
      ),
    }));

    saveVentaMeta(resultado.venta_id, {
      numero_factura: resultado.numero_factura,
      ncf: resultado.ncf ?? payload.ncf ?? null,
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
      detalle_ventas: localItems,
    });

    try {
      const mirroredVenta: VentaConDetalle = {
        id: resultado.venta_id,
        numero_factura: resultado.numero_factura,
        ncf: resultado.ncf ?? payload.ncf ?? null,
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
        detalle_ventas: localItems,
      };
      const existingLocal = getLocalVentas().filter((v) => v.id !== resultado.venta_id);
      saveLocalVentas([mirroredVenta, ...existingLocal].slice(0, 300));
    } catch {
      // ignore local mirror error
    }
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
      const coreQ = q.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
      list = list.filter((v) => {
        const num = (v.numero_factura || '').toLowerCase();
        const numCore = num.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
        return (
          num.includes(q) ||
          (coreQ.length >= 2 && numCore.includes(coreQ)) ||
          (v.ncf ?? '').toLowerCase().includes(q) ||
          (v.cliente_nombre ?? '').toLowerCase().includes(q) ||
          (v.cajero_nombre ?? '').toLowerCase().includes(q)
        );
      });
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

  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const cajeroIdIsUuid = Boolean(params.cajeroId && isUUID(params.cajeroId));

  const buildQuery = (selectClause: string) => {
    let q = sb
      .from('ventas')
      .select(selectClause, { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(desde, hasta);

    if (params.busqueda?.trim()) {
      const term = params.busqueda.trim().replace(/[%,"']/g, '');
      const coreTerm = term.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
      if (term) {
        const orClauses = [`numero_factura.ilike.%${term}%`, `ncf.ilike.%${term}%`];
        if (coreTerm && coreTerm !== term && coreTerm.length >= 2) {
          orClauses.push(`numero_factura.ilike.%${coreTerm}%`);
        }
        q = q.or(orClauses.join(','));
      }
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
    if (params.cajeroId && cajeroIdIsUuid) {
      q = q.eq('cajero_id', params.cajeroId);
    }
    if (params.excluirAnuladas) q = q.neq('estado', 'anulada');
    if (params.signal) q = q.abortSignal(params.signal);
    return q;
  };

  let { data, error, count } = await buildQuery(
    '*, clientes(nombre), perfiles!cajero_id(nombre_completo), detalle_ventas(*)'
  );
  if (error) {
    if (params.signal?.aborted || isAbortError(error)) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const fallback1 = await buildQuery('*, detalle_ventas(*)');
    if (!fallback1.error) {
      data = fallback1.data;
      count = fallback1.count;
      error = null;
    } else {
      if (params.signal?.aborted || isAbortError(fallback1.error)) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      const fallback2 = await buildQuery('*');
      if (!fallback2.error) {
        data = fallback2.data;
        count = fallback2.count;
        error = null;
      } else {
        if (params.signal?.aborted || isAbortError(fallback2.error)) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const localFallback = getLocalVentas();
        data = localFallback as any[];
        count = localFallback.length;
        error = null;
      }
    }
  }

  if (params.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const [perfilesMap] = await Promise.all([fetchPerfilesDirectory()]);
  const metaMap = getVentasMetaMap();
  const localVentasMap = new Map<string, VentaConDetalle>(
    getLocalVentas().map((lv) => [String(lv.id), lv])
  );

  const rowsList: any[] = data ?? [];
  const missingDetalleIds = rowsList
    .filter((r) => !Array.isArray(r.detalle_ventas) || r.detalle_ventas.length === 0)
    .map((r) => String(r.id))
    .filter((id) => isUUID(id));

  const extraDetallesByVenta = new Map<string, DetalleVenta[]>();
  if (missingDetalleIds.length > 0) {
    try {
      const { data: extraDetalles } = await sb
        .from('detalle_ventas')
        .select('*')
        .in('venta_id', missingDetalleIds);
      for (const d of extraDetalles ?? []) {
        const vid = String((d as any).venta_id);
        const arr = extraDetallesByVenta.get(vid) ?? [];
        arr.push(d as DetalleVenta);
        extraDetallesByVenta.set(vid, arr);
      }
    } catch {
      // ignore if RLS or network fails; metaMap/localVentasMap will provide fallback
    }
  }

  let datos: VentaConDetalle[] = rowsList.map((row: any) => {
    const rowId = String(row.id);
    const meta = metaMap[rowId];
    const localMirror = localVentasMap.get(rowId);
    const sourceDetalles =
      Array.isArray(row.detalle_ventas) && row.detalle_ventas.length > 0
        ? row.detalle_ventas
        : extraDetallesByVenta.get(rowId) && extraDetallesByVenta.get(rowId)!.length > 0
          ? extraDetallesByVenta.get(rowId)!
          : Array.isArray(meta?.detalle_ventas) && meta.detalle_ventas.length > 0
            ? meta.detalle_ventas
            : Array.isArray(localMirror?.detalle_ventas)
              ? localMirror.detalle_ventas
              : [];

    const rawDetalles: DetalleVenta[] = sourceDetalles.map((d: any, idx: number) => {
      const metaItem = meta?.detalle_ventas?.[idx];
      return {
        id: d.id || `${rowId}-item-${idx + 1}`,
        venta_id: d.venta_id || rowId,
        producto_id: d.producto_id ?? metaItem?.producto_id ?? null,
        combo_id: d.combo_id ?? metaItem?.combo_id ?? null,
        tipo_item: d.tipo_item || metaItem?.tipo_item || 'producto',
        nombre_item: d.nombre_item || metaItem?.nombre_item || 'Producto',
        ...(d.sku || metaItem?.sku ? { sku: d.sku || metaItem?.sku } : {}),
        precio_unitario: Number(d.precio_unitario ?? metaItem?.precio_unitario ?? 0),
        costo_unitario: Number(d.costo_unitario ?? metaItem?.costo_unitario ?? 0),
        cantidad: Number(d.cantidad ?? metaItem?.cantidad ?? 1),
        porcentaje_impuesto: Number(d.porcentaje_impuesto ?? metaItem?.porcentaje_impuesto ?? 0),
        subtotal: Number(
          d.subtotal ??
            metaItem?.subtotal ??
            Number(d.precio_unitario || 0) * Number(d.cantidad || 1)
        ),
      };
    });

    const amounts = normalizeVentaAmounts(row, rawDetalles, meta);
    const clienteJoined = extractJoinedName(row.clientes, 'nombre');

    return {
      id: row.id,
      numero_factura: row.numero_factura || meta?.numero_factura || localMirror?.numero_factura || `FAC-${rowId.slice(0, 8)}`,
      ncf: row.ncf ?? meta?.ncf ?? localMirror?.ncf ?? null,
      tipo_ncf: row.tipo_ncf ?? localMirror?.tipo_ncf ?? null,
      sucursal_id: row.sucursal_id,
      cajero_id: row.cajero_id ?? meta?.cajero_id ?? localMirror?.cajero_id ?? null,
      cliente_id: row.cliente_id ?? meta?.cliente_id ?? localMirror?.cliente_id ?? null,
      caja_id: row.caja_id ?? meta?.caja_id ?? localMirror?.caja_id ?? null,
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
      cliente_nombre:
        clienteJoined ||
        meta?.cliente_nombre ||
        localMirror?.cliente_nombre ||
        'Cliente general',
      cajero_nombre: resolveCajeroForRow(row, perfilesMap, metaMap),
      detalle_ventas: rawDetalles,
    };
  });

  if (params.cajeroId && !cajeroIdIsUuid) {
    datos = datos.filter((v) => String(v.cajero_id ?? '') === String(params.cajeroId));
    return { datos, total: datos.length };
  }

  return { datos, total: count ?? datos.length };
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

export interface NormalizedInvoiceLookup {
  raw: string;
  cleanUpper: string;
  coreCode: string;
  candidates: string[];
}

/**
 * Normaliza cualquier formato de identificador de factura (de venta, POS, NCF, etc.)
 * Remueve prefijos decorativos (#, No., Factura:), extrae el cuerpo central y genera
 * candidatos cruzados (ej: busca FAC-..., VEN-..., o sin prefijo).
 */
export function normalizeInvoiceLookupKey(rawInput: string): NormalizedInvoiceLookup {
  const raw = (rawInput || '').trim();
  if (!raw) {
    return { raw: '', cleanUpper: '', coreCode: '', candidates: [] };
  }

  // 1. Quitar prefijos decorativos comunes (#, No., Factura:, Fact:)
  const unadorned = raw
    .replace(/^[#\s]+/, '')
    .replace(/^(?:No\.?|Num\.?|Número|Numero|Factura:?|Fact:?)\s*/i, '')
    .trim();

  const cleanUpper = unadorned.toUpperCase();

  // 2. Extraer el código central despojando prefijos de sistema conocidos (FAC-, VEN-, VNT-, VTA-, FACT-, etc.)
  const coreCode = cleanUpper
    .replace(/^(?:FAC|VEN|VNT|VTA|FACT|FACTURA|INV|DOC)[-_:\s]*/i, '')
    .trim();

  // 3. Generar variantes cruzadas para buscar indistintamente número de factura POS o de venta
  const set = new Set<string>();
  if (cleanUpper) set.add(cleanUpper);

  if (coreCode) {
    set.add(coreCode);
    set.add(`FAC-${coreCode}`);
    set.add(`VEN-${coreCode}`);
    set.add(`VNT-${coreCode}`);
    set.add(`VTA-${coreCode}`);

    // Si tiene segmentos (ej: 20261029-4F901A1C o 20261029-0001), agregar el sufijo final
    const parts = coreCode.split('-');
    if (parts.length > 1) {
      const suffix = parts[parts.length - 1].trim();
      if (suffix.length >= 2) set.add(suffix);
    }
  }

  // Si tiene formato NCF (ej: B02-00000001 o B02 00000001)
  const ncfClean = cleanUpper.replace(/[\s-]+/g, '');
  if (/^[BE]\d{8,11}$/i.test(ncfClean)) {
    set.add(ncfClean);
  }

  return {
    raw,
    cleanUpper,
    coreCode,
    candidates: Array.from(set),
  };
}

/**
 * Calcula la puntuación de coincidencia de una venta contra el identificador buscado.
 * Prioriza coincidencias exactas y variantes cruzadas (FAC vs VEN).
 */
export function scoreVentaMatch(
  venta: { id?: string; numero_factura?: string; ncf?: string | null },
  lookup: NormalizedInvoiceLookup
): number {
  if (!venta || !lookup.raw) return 0;

  const num = (venta.numero_factura || '').toUpperCase().trim();
  const ncf = (venta.ncf || '').toUpperCase().trim();
  const id = (venta.id || '').toLowerCase().trim();
  const rawLower = lookup.raw.toLowerCase();
  const targetUpper = lookup.cleanUpper;
  const core = lookup.coreCode;

  // 1. Coincidencia id / uuid exacto
  if (id && id === rawLower) return 100;
  if (id && targetUpper.length >= 8 && id.startsWith(targetUpper.toLowerCase())) return 96;

  // 2. Coincidencia exacta directa con numero_factura o ncf
  if (num && num === targetUpper) return 100;
  if (ncf && ncf === targetUpper) return 100;
  if (ncf && targetUpper.replace(/[\s-]+/g, '') === ncf) return 98;

  // 3. Coincidencia exacta con candidatos generados (ej: buscar VEN-XXXX contra FAC-XXXX)
  for (const cand of lookup.candidates) {
    if (num && num === cand) return 95;
    if (ncf && ncf === cand) return 95;
  }

  // 4. Coincidencia del core code contra el core del numero_factura
  const numCore = num.replace(/^(?:FAC|VEN|VNT|VTA|FACT|FACTURA|INV|DOC)[-_:\s]*/i, '').trim();
  if (core && numCore && numCore === core) return 92;

  // 5. numero_factura termina con el core (ej: numero_factura="FAC-20261029-0001" y core="0001")
  if (core && core.length >= 2) {
    if (num.endsWith(`-${core}`) || num.endsWith(core)) return 85;
    if (numCore.endsWith(`-${core}`) || numCore.endsWith(core)) return 85;
  }

  // 6. Contención parcial
  if (core && core.length >= 3) {
    if (num.includes(core)) return 75;
    if (ncf && ncf.includes(core)) return 70;
  }
  if (targetUpper.length >= 3) {
    if (num.includes(targetUpper)) return 65;
    if (ncf && ncf.includes(targetUpper)) return 60;
  }

  return 0;
}

function sanitizePostgrestFilterTerm(term: string): string {
  return term.replace(/[,()"]/g, '').trim();
}

export async function obtenerVentaPorNumeroFactura(
  numeroFactura: string
): Promise<VentaConDetalle | null> {
  const lookup = normalizeInvoiceLookupKey(numeroFactura);
  if (!lookup.raw) return null;

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const filterTerms = new Set<string>();
      const safeTarget = sanitizePostgrestFilterTerm(lookup.cleanUpper);
      if (safeTarget) filterTerms.add(safeTarget);

      const safeCore = sanitizePostgrestFilterTerm(lookup.coreCode);
      if (safeCore) {
        filterTerms.add(safeCore);
        filterTerms.add(`FAC-${safeCore}`);
        filterTerms.add(`VEN-${safeCore}`);
        const parts = safeCore.split('-');
        if (parts.length > 1) {
          const last = sanitizePostgrestFilterTerm(parts[parts.length - 1]);
          if (last.length >= 2) filterTerms.add(last);
        }
      }

      const orParts: string[] = [];
      for (const t of filterTerms) {
        if (!t) continue;
        orParts.push(`numero_factura.ilike.%${t}%`);
        orParts.push(`ncf.ilike.%${t}%`);
      }
      if (isUUID(lookup.cleanUpper)) {
        orParts.push(`id.eq.${lookup.cleanUpper.toLowerCase()}`);
      }

      if (orParts.length > 0) {
        const { data: ventas, error } = await sb
          .from('ventas')
          .select('id, numero_factura, ncf, creado_en')
          .or(orParts.join(','))
          .order('creado_en', { ascending: false })
          .limit(15);

        if (!error && ventas && ventas.length > 0) {
          const scored = ventas
            .map((v) => ({
              v,
              score: scoreVentaMatch(v, lookup),
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => {
              if (b.score !== a.score) return b.score - a.score;
              return new Date(b.v.creado_en).getTime() - new Date(a.v.creado_en).getTime();
            });

          if (scored.length > 0) {
            const best = scored[0].v;
            const full = await obtenerVentaPorId(String(best.id));
            if (full) return full;
          }
        }
      }
    } catch {
      // Continuar con fallback local
    }
  }

  // 2. Fallback a ventas locales (offline o cache local)
  const list = getLocalVentas();
  const scoredLocal = list
    .map((v) => ({
      v,
      score: scoreVentaMatch(v, lookup),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.v.creado_en).getTime() - new Date(a.v.creado_en).getTime();
    });

  return scoredLocal.length > 0 ? scoredLocal[0].v : null;
}

export async function obtenerUltimasVentasParaDevolucion(limite = 8): Promise<VentaConDetalle[]> {
  const localList = getLocalVentas().filter((v) => v.estado !== 'anulada');
  const sb = tryGetSupabase();
  if (!sb) {
    return localList.slice(0, limite);
  }

  try {
    const { data, error } = await sb
      .from('ventas')
      .select('id')
      .neq('estado', 'anulada')
      .order('creado_en', { ascending: false })
      .limit(limite);

    if (error || !data || data.length === 0) {
      return localList.slice(0, limite);
    }

    const ventas = await Promise.all(
      data.map((row) => obtenerVentaPorId(String(row.id)))
    );
    const valid = ventas.filter(Boolean) as VentaConDetalle[];
    if (valid.length === 0) return localList.slice(0, limite);
    return valid;
  } catch {
    return localList.slice(0, limite);
  }
}

export async function obtenerVentaPorId(ventaId: string): Promise<VentaConDetalle | null> {
  const sb = tryGetSupabase();
  const metaMap = getVentasMetaMap();
  const localFound = getLocalVentas().find((v) => v.id === ventaId);
  if (!sb) {
    const perfilesMap = getLocalPerfilesMap();
    if (!localFound) return null;
    const meta = metaMap[localFound.id];
    const detalles =
      Array.isArray(localFound.detalle_ventas) && localFound.detalle_ventas.length > 0
        ? localFound.detalle_ventas
        : meta?.detalle_ventas ?? [];
    const amounts = normalizeVentaAmounts(localFound, detalles, meta);
    return {
      ...localFound,
      ...amounts,
      detalle_ventas: detalles,
      cajero_nombre: resolveCajeroForRow(localFound, perfilesMap, metaMap),
      cliente_nombre: localFound.cliente_nombre || meta?.cliente_nombre || 'Cliente general',
    };
  }

  let [{ data: venta, error: vErr }, { data: detalle }, perfilesMap] = await Promise.all([
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

  if (vErr || !venta) {
    const fallbackVenta = await sb.from('ventas').select('*').eq('id', ventaId).single();
    if (!fallbackVenta.error && fallbackVenta.data) {
      venta = fallbackVenta.data;
      vErr = null;
    } else if (localFound) {
      const meta = metaMap[localFound.id];
      const amounts = normalizeVentaAmounts(localFound, localFound.detalle_ventas ?? [], meta);
      return {
        ...localFound,
        ...amounts,
        cajero_nombre: resolveCajeroForRow(localFound, perfilesMap, metaMap),
        cliente_nombre: localFound.cliente_nombre || meta?.cliente_nombre || 'Cliente general',
      };
    } else {
      return null;
    }
  }

  const meta = metaMap[String(venta.id)];
  const sourceDetalle =
    Array.isArray(detalle) && detalle.length > 0
      ? detalle
      : Array.isArray(meta?.detalle_ventas) && meta.detalle_ventas.length > 0
        ? meta.detalle_ventas
        : Array.isArray(localFound?.detalle_ventas)
          ? localFound.detalle_ventas
          : [];

  const detalleMapped: DetalleVenta[] = sourceDetalle.map((d: any, idx: number) => {
    const metaItem = meta?.detalle_ventas?.[idx];
    return {
      id: d.id || `${venta.id}-item-${idx + 1}`,
      venta_id: d.venta_id || venta.id,
      producto_id: d.producto_id ?? metaItem?.producto_id ?? null,
      combo_id: d.combo_id ?? metaItem?.combo_id ?? null,
      tipo_item: d.tipo_item || metaItem?.tipo_item || 'producto',
      nombre_item: d.nombre_item || metaItem?.nombre_item || 'Producto',
      ...(d.sku || metaItem?.sku ? { sku: d.sku || metaItem?.sku } : {}),
      precio_unitario: Number(d.precio_unitario ?? metaItem?.precio_unitario ?? 0),
      costo_unitario: Number(d.costo_unitario ?? metaItem?.costo_unitario ?? 0),
      cantidad: Number(d.cantidad ?? metaItem?.cantidad ?? 1),
      porcentaje_impuesto: Number(d.porcentaje_impuesto ?? metaItem?.porcentaje_impuesto ?? 0),
      subtotal: Number(
        d.subtotal ??
          metaItem?.subtotal ??
          Number(d.precio_unitario || 0) * Number(d.cantidad || 1)
      ),
    };
  });

  const amounts = normalizeVentaAmounts(venta, detalleMapped, meta);
  const clienteJoined = extractJoinedName(venta.clientes, 'nombre');

  return {
    id: venta.id,
    numero_factura: venta.numero_factura || meta?.numero_factura || localFound?.numero_factura,
    ncf: venta.ncf ?? meta?.ncf ?? localFound?.ncf ?? null,
    tipo_ncf: venta.tipo_ncf ?? localFound?.tipo_ncf ?? null,
    sucursal_id: venta.sucursal_id,
    cajero_id: venta.cajero_id ?? meta?.cajero_id ?? localFound?.cajero_id ?? null,
    cliente_id: venta.cliente_id ?? meta?.cliente_id ?? localFound?.cliente_id ?? null,
    caja_id: venta.caja_id ?? meta?.caja_id ?? localFound?.caja_id ?? null,
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
    cliente_nombre:
      clienteJoined ||
      meta?.cliente_nombre ||
      localFound?.cliente_nombre ||
      'Cliente general',
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

export interface EditarVentaItem {
  id?: string;
  producto_id: string | null;
  combo_id?: string | null;
  tipo_item: TipoItemVenta;
  nombre_item: string;
  sku?: string | null;
  precio_unitario: number;
  costo_unitario: number;
  cantidad: number;
  porcentaje_impuesto: number;
  subtotal: number;
}

export type ActualizarVentaPayload = {
  cliente_id?: string | null;
  cliente_nombre?: string;
  metodo_pago?: MetodoPago;
  tipo_ncf?: string | null;
  ncf?: string | null;
  subtotal?: number;
  monto_impuesto?: number;
  monto_descuento?: number;
  monto_total?: number;
  costo_total?: number;
  estado?: Venta['estado'];
  items?: EditarVentaItem[];
  usuario_modificador_id?: string | null;
  usuario_modificador_nombre?: string;
};

export async function actualizarVenta(
  ventaId: string,
  payload: ActualizarVentaPayload
): Promise<void> {
  const sb = tryGetSupabase();

  // 1. Obtener la venta actual antes de modificaciones para calcular deltas y auditoría
  let currentSale: VentaConDetalle | null = null;
  try {
    currentSale = await obtenerVentaPorId(ventaId);
  } catch {
    // ignore
  }

  const oldItems = currentSale?.detalle_ventas ?? [];

  // 2. Calcular deltas de inventario si se proporcionaron items
  const deltas: Array<{ producto_id: string; delta: number }> = [];
  if (payload.items && payload.items.length > 0) {
    const oldQtyByProd = new Map<string, number>();
    for (const it of oldItems) {
      if (it.tipo_item === 'producto' && it.producto_id) {
        oldQtyByProd.set(it.producto_id, (oldQtyByProd.get(it.producto_id) || 0) + Number(it.cantidad || 0));
      }
    }
    const newQtyByProd = new Map<string, number>();
    for (const it of payload.items) {
      if (it.tipo_item === 'producto' && it.producto_id) {
        newQtyByProd.set(it.producto_id, (newQtyByProd.get(it.producto_id) || 0) + Number(it.cantidad || 0));
      }
    }
    const allProdIds = new Set([...oldQtyByProd.keys(), ...newQtyByProd.keys()]);
    for (const prodId of allProdIds) {
      const oldQty = oldQtyByProd.get(prodId) || 0;
      const newQty = newQtyByProd.get(prodId) || 0;
      const delta = round2(newQty - oldQty);
      if (Math.abs(delta) > 0.0001) {
        deltas.push({ producto_id: prodId, delta });
      }
    }

    // Actualizar inventario local para cada producto modificado (-delta)
    for (const d of deltas) {
      updateProductStockInStore(d.producto_id, -d.delta);
    }
  }

  // 3. Si Supabase está disponible, intentar RPC transaccional o actualización directa
  if (sb) {
    let rpcSuccess = false;
    if (payload.items && payload.items.length > 0) {
      try {
        const rpcPayload = {
          cliente_id: isUUID(payload.cliente_id) ? payload.cliente_id : null,
          metodo_pago: payload.metodo_pago,
          tipo_ncf: payload.tipo_ncf,
          ncf: payload.ncf,
          subtotal: payload.subtotal,
          monto_impuesto: payload.monto_impuesto,
          monto_descuento: payload.monto_descuento,
          monto_total: payload.monto_total,
          costo_total: payload.costo_total,
          estado: payload.estado,
          usuario_modificador_id: isUUID(payload.usuario_modificador_id) ? payload.usuario_modificador_id : null,
          usuario_modificador_nombre: payload.usuario_modificador_nombre || 'Administrador',
          items: payload.items.map((it) => ({
            producto_id: isUUID(it.producto_id) ? it.producto_id : null,
            combo_id: isUUID(it.combo_id) ? it.combo_id : null,
            tipo_item: it.tipo_item,
            nombre_item: it.nombre_item,
            sku: it.sku ?? null,
            precio_unitario: round2(it.precio_unitario),
            costo_unitario: round2(it.costo_unitario),
            cantidad: Number(it.cantidad),
            porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 18),
            subtotal: round2(it.subtotal),
          })),
        };
        const { error: rpcErr } = await sb.rpc('editar_venta_pos', {
          p_venta_id: ventaId,
          p_payload: rpcPayload,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }
    }

    if (!rpcSuccess) {
      // Actualización directa si el RPC aún no está desplegado en base remota
      const updateData: Record<string, unknown> = {
        actualizado_en: new Date().toISOString(),
      };
      if (payload.cliente_id !== undefined) updateData.cliente_id = isUUID(payload.cliente_id) ? payload.cliente_id : null;
      if (payload.metodo_pago !== undefined) updateData.metodo_pago = payload.metodo_pago;
      if (payload.tipo_ncf !== undefined) updateData.tipo_ncf = payload.tipo_ncf;
      if (payload.ncf !== undefined) updateData.ncf = payload.ncf;
      if (payload.subtotal !== undefined) updateData.subtotal = payload.subtotal;
      if (payload.monto_impuesto !== undefined) updateData.monto_impuesto = payload.monto_impuesto;
      if (payload.monto_descuento !== undefined) updateData.monto_descuento = payload.monto_descuento;
      if (payload.monto_total !== undefined) updateData.monto_total = payload.monto_total;
      if (payload.costo_total !== undefined) updateData.costo_total = payload.costo_total;
      if (payload.estado !== undefined) updateData.estado = payload.estado;

      const { error: updateErr } = await sb.from('ventas').update(updateData).eq('id', ventaId);
      if (updateErr) throw updateErr;

      // Actualizar detalle_ventas en Supabase si se pasaron items
      if (payload.items && payload.items.length > 0) {
        try {
          await sb.from('detalle_ventas').delete().eq('venta_id', ventaId);
          await sb.from('detalle_ventas').insert(
            payload.items.map((it, idx) => ({
              id: `${ventaId}-item-${Date.now()}-${idx + 1}`,
              venta_id: ventaId,
              producto_id: isUUID(it.producto_id) ? it.producto_id : null,
              combo_id: isUUID(it.combo_id) ? it.combo_id : null,
              tipo_item: it.tipo_item,
              nombre_item: it.nombre_item,
              precio_unitario: round2(it.precio_unitario),
              costo_unitario: round2(it.costo_unitario),
              cantidad: Number(it.cantidad),
              porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 18),
              subtotal: round2(it.subtotal),
            }))
          );
        } catch {
          // ignore if table constraints prevent direct delete/insert
        }
      }

      // Actualizar stock en Supabase para cada delta
      for (const d of deltas) {
        try {
          const { data: pData } = await sb.from('productos').select('stock_actual').eq('id', d.producto_id).single();
          if (pData) {
            await sb.from('productos').update({
              stock_actual: Number(pData.stock_actual || 0) - d.delta,
              actualizado_en: new Date().toISOString(),
            }).eq('id', d.producto_id);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // 4. Actualizar metadata y almacenamiento local
  const effectiveItems = payload.items && payload.items.length > 0
    ? payload.items.map((it, idx) => ({
        id: it.id || `${ventaId}-item-${idx + 1}`,
        venta_id: ventaId,
        producto_id: it.producto_id,
        combo_id: it.combo_id ?? null,
        tipo_item: it.tipo_item,
        nombre_item: it.nombre_item,
        sku: it.sku ?? null,
        precio_unitario: round2(it.precio_unitario),
        costo_unitario: round2(it.costo_unitario),
        cantidad: Number(it.cantidad),
        porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 18),
        subtotal: round2(it.subtotal),
      }))
    : currentSale?.detalle_ventas;

  saveVentaMeta(ventaId, {
    ...(payload.cliente_id !== undefined ? { cliente_id: payload.cliente_id } : {}),
    ...(payload.cliente_nombre !== undefined ? { cliente_nombre: payload.cliente_nombre } : {}),
    ...(payload.metodo_pago !== undefined ? { metodo_pago: payload.metodo_pago } : {}),
    ...(payload.tipo_ncf !== undefined ? { tipo_ncf: payload.tipo_ncf } : {}),
    ...(payload.ncf !== undefined ? { ncf: payload.ncf } : {}),
    ...(payload.subtotal !== undefined ? { subtotal: payload.subtotal } : {}),
    ...(payload.monto_impuesto !== undefined ? { monto_impuesto: payload.monto_impuesto } : {}),
    ...(payload.monto_descuento !== undefined ? { monto_descuento: payload.monto_descuento } : {}),
    ...(payload.monto_total !== undefined ? { monto_total: payload.monto_total } : {}),
    ...(effectiveItems ? { detalle_ventas: effectiveItems } : {}),
  });

  const updatedLocal = getLocalVentas().map((v) => {
    if (v.id !== ventaId) return v;
    return {
      ...v,
      ...(payload.cliente_id !== undefined ? { cliente_id: payload.cliente_id } : {}),
      ...(payload.cliente_nombre !== undefined ? { cliente_nombre: payload.cliente_nombre } : {}),
      ...(payload.metodo_pago !== undefined ? { metodo_pago: payload.metodo_pago } : {}),
      ...(payload.tipo_ncf !== undefined ? { tipo_ncf: payload.tipo_ncf } : {}),
      ...(payload.ncf !== undefined ? { ncf: payload.ncf } : {}),
      ...(payload.subtotal !== undefined ? { subtotal: payload.subtotal } : {}),
      ...(payload.monto_impuesto !== undefined ? { monto_impuesto: payload.monto_impuesto } : {}),
      ...(payload.monto_descuento !== undefined ? { monto_descuento: payload.monto_descuento } : {}),
      ...(payload.monto_total !== undefined ? { monto_total: payload.monto_total } : {}),
      ...(payload.estado !== undefined ? { estado: payload.estado } : {}),
      ...(effectiveItems ? { detalle_ventas: effectiveItems } : {}),
    };
  });
  saveLocalVentas(updatedLocal);

  // 5. Registrar evento en la auditoría con usuario, fecha/hora y detalle
  try {
    const userMod = payload.usuario_modificador_nombre || 'Administrador';
    const numFact = currentSale?.numero_factura || ventaId;
    logAuditEvent({
      action: 'Edición de venta',
      module: 'Ventas',
      user: userMod,
      role: 'Administrador',
      details: `Factura ${numFact} editada por ${userMod}. ${payload.items ? `${payload.items.length} productos, ` : ''}Total RD$ ${(payload.monto_total ?? currentSale?.monto_total ?? 0).toLocaleString('es-DO')}. Inventario recalculado y actualizado.`,
      before: currentSale
        ? {
            numero_factura: currentSale.numero_factura,
            cliente: currentSale.cliente_nombre,
            total: currentSale.monto_total,
            items: currentSale.detalle_ventas?.length ?? 0,
          }
        : null,
      after: {
        numero_factura: numFact,
        cliente: payload.cliente_nombre || payload.cliente_id,
        total: payload.monto_total,
        items: payload.items?.length ?? currentSale?.detalle_ventas?.length ?? 0,
      },
    });
  } catch {
    // Non-blocking audit log
  }
}
