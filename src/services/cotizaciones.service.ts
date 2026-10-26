import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import type { Cotizacion, EstadoCotizacion } from '@/types/database';
import { procesarVenta } from './ventas.service';

export interface ItemCotizacionPayload {
  producto_id?: string | null;
  nombre_item: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface PayloadCotizacion {
  cliente_id?: string | null;
  vendedor_id?: string | null;
  subtotal: number;
  monto_impuesto: number;
  monto_total: number;
  valida_hasta?: string | null;
  items: ItemCotizacionPayload[];
}

export interface CotizacionConDetalle extends Cotizacion {
  cliente_nombre?: string;
  vendedor_nombre?: string;
  items?: {
    id: string;
    producto_id?: string | null;
    nombre_item: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}

const LOCAL_COTIZACIONES_KEY = 'mercato_cotizaciones_local';

function getLocalCotizaciones(): CotizacionConDetalle[] {
  try {
    const raw = localStorage.getItem(LOCAL_COTIZACIONES_KEY);
    return raw ? (JSON.parse(raw) as CotizacionConDetalle[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCotizaciones(data: CotizacionConDetalle[]) {
  localStorage.setItem(LOCAL_COTIZACIONES_KEY, JSON.stringify(data));
}

export async function obtenerCotizaciones(params: {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  estado?: EstadoCotizacion;
  signal?: AbortSignal;
} = {}): Promise<{ datos: CotizacionConDetalle[]; total: number }> {
  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 50;
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  const sb = tryGetSupabase();
  if (!sb) {
    let list = getLocalCotizaciones();
    if (params.estado) {
      list = list.filter((c) => c.estado === params.estado);
    }
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.codigo.toLowerCase().includes(q) ||
          (c.cliente_nombre ?? '').toLowerCase().includes(q)
      );
    }
    return { datos: list.slice(desde, hasta + 1), total: list.length };
  }

  let query = sb
    .from('cotizaciones')
    .select('*, clientes(nombre), perfiles(nombre_completo)', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range(desde, hasta);

  if (params.estado) {
    query = query.eq('estado', params.estado);
  }
  if (params.busqueda?.trim()) {
    const q = params.busqueda.trim();
    query = query.or(`codigo.ilike.%${q}%`);
  }
  if (params.signal) {
    query = query.abortSignal(params.signal);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const datos: CotizacionConDetalle[] = (data ?? []).map((row: any) => ({
    id: row.id,
    codigo: row.codigo,
    cliente_id: row.cliente_id,
    vendedor_id: row.vendedor_id,
    subtotal: Number(row.subtotal),
    monto_impuesto: Number(row.monto_impuesto),
    monto_total: Number(row.monto_total),
    estado: row.estado,
    valida_hasta: row.valida_hasta,
    creado_en: row.creado_en,
    cliente_nombre: row.clientes?.nombre ?? 'Cliente general',
    vendedor_nombre: row.perfiles?.nombre_completo ?? 'Sistema',
  }));

  return { datos, total: count ?? 0 };
}

export async function crearCotizacion(payload: PayloadCotizacion): Promise<CotizacionConDetalle> {
  const sb = tryGetSupabase();
  const codigo = `COT-${Date.now().toString(36).toUpperCase()}`;

  if (!sb) {
    const id = crypto.randomUUID();
    const cot: CotizacionConDetalle = {
      id,
      codigo,
      cliente_id: payload.cliente_id ?? null,
      vendedor_id: payload.vendedor_id ?? null,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_total: payload.monto_total,
      estado: 'pendiente',
      valida_hasta: payload.valida_hasta ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      creado_en: new Date().toISOString(),
      cliente_nombre: 'Cliente',
      vendedor_nombre: 'Vendedor',
      items: payload.items.map((it) => ({
        id: crypto.randomUUID(),
        producto_id: it.producto_id,
        nombre_item: it.nombre_item,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal,
      })),
    };
    saveLocalCotizaciones([cot, ...getLocalCotizaciones()]);
    return cot;
  }

  const { data: cotData, error: cotErr } = await sb
    .from('cotizaciones')
    .insert({
      codigo,
      cliente_id: payload.cliente_id ?? null,
      vendedor_id: payload.vendedor_id ?? null,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_total: payload.monto_total,
      estado: 'pendiente',
      valida_hasta: payload.valida_hasta ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    })
    .select('*, clientes(nombre), perfiles(nombre_completo)')
    .single();

  if (cotErr) throw cotErr;

  const itemsInsert = payload.items.map((it) => ({
    cotizacion_id: cotData.id,
    producto_id: it.producto_id ?? null,
    nombre_item: it.nombre_item,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    subtotal: it.subtotal,
  }));

  if (itemsInsert.length > 0) {
    const { error: itemErr } = await sb.from('detalle_cotizaciones').insert(itemsInsert);
    if (itemErr) console.warn('Error al guardar detalle de cotización:', itemErr);
  }

  return {
    id: cotData.id,
    codigo: cotData.codigo,
    cliente_id: cotData.cliente_id,
    vendedor_id: cotData.vendedor_id,
    subtotal: Number(cotData.subtotal),
    monto_impuesto: Number(cotData.monto_impuesto),
    monto_total: Number(cotData.monto_total),
    estado: cotData.estado,
    valida_hasta: cotData.valida_hasta,
    creado_en: cotData.creado_en,
    cliente_nombre: cotData.clientes?.nombre ?? 'Cliente',
    vendedor_nombre: cotData.perfiles?.nombre_completo ?? 'Sistema',
  };
}

export async function obtenerDetalleCotizacion(id: string): Promise<CotizacionConDetalle | null> {
  const sb = tryGetSupabase();
  if (!sb) {
    return getLocalCotizaciones().find((c) => c.id === id) ?? null;
  }

  const { data, error } = await sb
    .from('cotizaciones')
    .select('*, clientes(nombre), perfiles(nombre_completo), detalle_cotizaciones(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const items = ((data as any).detalle_cotizaciones ?? []).map((it: any) => ({
    id: String(it.id),
    producto_id: it.producto_id,
    nombre_item: String(it.nombre_item),
    cantidad: Number(it.cantidad),
    precio_unitario: Number(it.precio_unitario),
    subtotal: Number(it.subtotal),
  }));

  return {
    id: data.id,
    codigo: data.codigo,
    cliente_id: data.cliente_id,
    vendedor_id: data.vendedor_id,
    subtotal: Number(data.subtotal),
    monto_impuesto: Number(data.monto_impuesto),
    monto_total: Number(data.monto_total),
    estado: data.estado,
    valida_hasta: data.valida_hasta,
    creado_en: data.creado_en,
    cliente_nombre: (data as any).clientes?.nombre ?? 'Cliente general',
    vendedor_nombre: (data as any).perfiles?.nombre_completo ?? 'Sistema',
    items,
  };
}

export async function actualizarEstadoCotizacion(
  cotizacionId: string,
  nuevoEstado: EstadoCotizacion
): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) {
    const local = getLocalCotizaciones().map((c) =>
      c.id === cotizacionId ? { ...c, estado: nuevoEstado } : c
    );
    saveLocalCotizaciones(local);
    return;
  }

  const { error } = await sb
    .from('cotizaciones')
    .update({ estado: nuevoEstado })
    .eq('id', cotizacionId);

  if (error) throw error;
}

export async function convertirCotizacionAVenta(
  cotizacionId: string,
  metodoPago: string = 'efectivo'
): Promise<{ venta_id: string; numero_factura: string }> {
  const sb = tryGetSupabase();
  if (!sb) {
    const local = getLocalCotizaciones();
    const cot = local.find((c) => c.id === cotizacionId);
    if (!cot) throw new Error('Cotización no encontrada');
    
    // Crear venta local
    const res = await procesarVenta({
      cliente_id: cot.cliente_id,
      subtotal: cot.subtotal,
      monto_impuesto: cot.monto_impuesto,
      monto_descuento: 0,
      monto_total: cot.monto_total,
      costo_total: 0,
      metodo_pago: metodoPago as any,
      monto_pagado: cot.monto_total,
      items: (cot.items ?? []).map((it) => ({
        producto_id: it.producto_id,
        tipo_item: 'producto',
        nombre_item: it.nombre_item,
        precio_unitario: it.precio_unitario,
        costo_unitario: 0,
        cantidad: it.cantidad,
        subtotal: it.subtotal,
      })),
    });

    await actualizarEstadoCotizacion(cotizacionId, 'convertida');
    return res;
  }

  // En Supabase llamamos RPC o fallback directo
  try {
    const { data, error } = await sb.rpc('convertir_cotizacion_pos', {
      p_cotizacion_id: cotizacionId,
      p_metodo_pago: metodoPago,
    });
    if (!error && data) {
      return data;
    }
  } catch {
    // Si falla RPC, hacerlo por tablas
  }

  // Fetch cotizacion + detalle
  const { data: cot, error: fetchErr } = await sb
    .from('cotizaciones')
    .select('*, detalle_cotizaciones(*)')
    .eq('id', cotizacionId)
    .single();

  if (fetchErr || !cot) throw new Error('Error al cargar la cotización para conversión');

  const res = await procesarVenta({
    cliente_id: cot.cliente_id,
    cajero_id: cot.vendedor_id,
    subtotal: Number(cot.subtotal),
    monto_impuesto: Number(cot.monto_impuesto),
    monto_descuento: 0,
    monto_total: Number(cot.monto_total),
    costo_total: 0,
    metodo_pago: metodoPago as any,
    monto_pagado: Number(cot.monto_total),
    items: (cot.detalle_cotizaciones ?? []).map((it: any) => ({
      producto_id: it.producto_id,
      tipo_item: 'producto',
      nombre_item: it.nombre_item,
      precio_unitario: Number(it.precio_unitario),
      costo_unitario: 0,
      cantidad: Number(it.cantidad),
      subtotal: Number(it.subtotal),
    })),
  });

  await actualizarEstadoCotizacion(cotizacionId, 'convertida');
  return res;
}
