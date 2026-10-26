import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { VENTA_COLUMNS, type MetodoPago, type Venta, type DetalleVenta } from '@/types/database';
import { updateProductStockInStore } from '@/lib/productStore';
import { crearCxcDesdeVenta } from './cxc.service';

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
  cliente_id?: string | null;
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
      precio_unitario: it.precio_unitario,
      costo_unitario: it.costo_unitario,
      cantidad: it.cantidad,
      porcentaje_impuesto: it.porcentaje_impuesto ?? 18,
      subtotal: it.subtotal,
    }));

    const venta: VentaConDetalle = {
      id,
      numero_factura: numero,
      ncf: payload.ncf ?? null,
      tipo_ncf: payload.tipo_ncf ?? null,
      sucursal_id: payload.sucursal_id ?? null,
      cajero_id: payload.cajero_id ?? null,
      cliente_id: payload.cliente_id ?? null,
      caja_id: payload.caja_id ?? null,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_descuento: payload.monto_descuento,
      monto_total: payload.monto_total,
      costo_total: payload.costo_total,
      metodo_pago: payload.metodo_pago,
      monto_pagado: payload.monto_pagado,
      monto_efectivo: payload.monto_efectivo ?? 0,
      monto_tarjeta: payload.monto_tarjeta ?? 0,
      monto_transferencia: payload.monto_transferencia ?? 0,
      monto_credito: payload.monto_credito ?? 0,
      devuelta_entregada: payload.devuelta_entregada ?? 0,
      estado: 'completada',
      creado_en: new Date().toISOString(),
      cliente_nombre: 'Cliente General',
      cajero_nombre: 'Cajero',
      detalle_ventas: items,
    };

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

  const sanitizedPayload: PayloadVenta = {
    ...payload,
    sucursal_id: isUUID(payload.sucursal_id) ? payload.sucursal_id : null,
    cajero_id: isUUID(payload.cajero_id) ? payload.cajero_id : null,
    cliente_id: isUUID(payload.cliente_id) ? payload.cliente_id : null,
    items: payload.items.map((it) => ({
      ...it,
      producto_id: isUUID(it.producto_id) ? it.producto_id : null,
      combo_id: isUUID(it.combo_id) ? it.combo_id : null,
    })),
  };

  const sb = getSupabase();
  const { data, error } = await sb.rpc('procesar_venta_pos', { p_payload: sanitizedPayload });
  if (error) throw error;
  const resultado = data as ResultadoVenta;

  const credito = Number(payload.monto_credito ?? 0);
  if (credito > 0 || payload.metodo_pago === 'credito') {
    try {
      await crearCxcDesdeVenta({
        venta_id: resultado.venta_id,
        numero_factura: resultado.numero_factura,
        cliente_id: payload.cliente_id,
        monto_credito: credito > 0 ? credito : payload.monto_total,
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
    let list = getLocalVentas();
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.numero_factura.toLowerCase().includes(q) ||
          (v.ncf ?? '').toLowerCase().includes(q) ||
          (v.cliente_nombre ?? '').toLowerCase().includes(q)
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

  let query = sb
    .from('ventas')
    .select('*, clientes(nombre), perfiles!cajero_id(nombre_completo)', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range(desde, hasta);

  if (params.busqueda?.trim()) {
    const q = params.busqueda.trim();
    query = query.or(`numero_factura.ilike."%${q}%",ncf.ilike."%${q}%"`);
  }
  if (params.fechaInicio) query = query.gte('creado_en', params.fechaInicio);
  if (params.fechaFin) query = query.lte('creado_en', params.fechaFin + 'T23:59:59');
  if (params.cajaId) {
    if (Array.isArray(params.cajaId)) {
      if (params.cajaId.length === 1) {
        query = query.eq('caja_id', params.cajaId[0]);
      } else if (params.cajaId.length > 1) {
        query = query.in('caja_id', params.cajaId);
      }
    } else {
      query = query.eq('caja_id', params.cajaId);
    }
  }
  if (params.cajeroId) query = query.eq('cajero_id', params.cajeroId);
  if (params.excluirAnuladas) query = query.neq('estado', 'anulada');
  if (params.signal) query = query.abortSignal(params.signal);

  const { data, error, count } = await query;
  if (error) throw error;

  const datos: VentaConDetalle[] = (data ?? []).map((row: any) => ({
    id: row.id,
    numero_factura: row.numero_factura,
    ncf: row.ncf,
    tipo_ncf: row.tipo_ncf,
    sucursal_id: row.sucursal_id,
    cajero_id: row.cajero_id,
    cliente_id: row.cliente_id,
    caja_id: row.caja_id,
    subtotal: Number(row.subtotal),
    monto_impuesto: Number(row.monto_impuesto),
    monto_descuento: Number(row.monto_descuento),
    monto_total: Number(row.monto_total),
    costo_total: Number(row.costo_total),
    metodo_pago: row.metodo_pago,
    monto_pagado: Number(row.monto_pagado),
    monto_efectivo: Number(row.monto_efectivo || 0),
    monto_tarjeta: Number(row.monto_tarjeta || 0),
    monto_transferencia: Number(row.monto_transferencia || 0),
    monto_credito: Number(row.monto_credito || 0),
    devuelta_entregada: Number(row.devuelta_entregada || 0),
    estado: row.estado,
    creado_en: row.creado_en,
    cliente_nombre: row.clientes?.nombre ?? 'Cliente general',
    cajero_nombre: row.perfiles?.nombre_completo ?? 'Cajero',
  }));

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

  const ids = filtradas.map((v) => v.id);
  const { data: detalles } = await sb.from('detalle_ventas').select('*').in('venta_id', ids);
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
    detalle_ventas: byVenta.get(v.id) ?? [],
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
  if (!sb) {
    const list = getLocalVentas();
    return list.find((v) => v.id === ventaId) ?? null;
  }

  const { data: venta, error: vErr } = await sb
    .from('ventas')
    .select('*, clientes(nombre, rnc_cedula), perfiles!cajero_id(nombre_completo)')
    .eq('id', ventaId)
    .single();

  if (vErr || !venta) return null;

  const { data: detalle } = await sb
    .from('detalle_ventas')
    .select('*')
    .eq('venta_id', ventaId);

  return {
    id: venta.id,
    numero_factura: venta.numero_factura,
    ncf: venta.ncf,
    tipo_ncf: venta.tipo_ncf,
    sucursal_id: venta.sucursal_id,
    cajero_id: venta.cajero_id,
    cliente_id: venta.cliente_id,
    caja_id: venta.caja_id,
    subtotal: Number(venta.subtotal),
    monto_impuesto: Number(venta.monto_impuesto),
    monto_descuento: Number(venta.monto_descuento),
    monto_total: Number(venta.monto_total),
    costo_total: Number(venta.costo_total),
    metodo_pago: venta.metodo_pago,
    monto_pagado: Number(venta.monto_pagado),
    monto_efectivo: Number(venta.monto_efectivo || 0),
    monto_tarjeta: Number(venta.monto_tarjeta || 0),
    monto_transferencia: Number(venta.monto_transferencia || 0),
    monto_credito: Number(venta.monto_credito || 0),
    devuelta_entregada: Number(venta.devuelta_entregada || 0),
    estado: venta.estado,
    creado_en: venta.creado_en,
    cliente_nombre: venta.clientes?.nombre ?? 'Cliente general',
    cajero_nombre: venta.perfiles?.nombre_completo ?? 'Cajero',
    detalle_ventas: (detalle ?? []).map((d: any) => ({
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
    })),
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
  estado?: Venta['estado'];
};

export async function actualizarVenta(
  ventaId: string,
  payload: ActualizarVentaPayload
): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) {
    const list = getLocalVentas().map((v) =>
      v.id === ventaId ? { ...v, ...payload } : v
    );
    saveLocalVentas(list);
    return;
  }

  const { error } = await sb
    .from('ventas')
    .update(payload)
    .eq('id', ventaId);

  if (error) throw error;
}

