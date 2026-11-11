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
  cliente_nombre?: string;
  vendedor_id?: string | null;
  vendedor_nombre?: string;
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

function esUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val));
}

function getLocalCotizaciones(): CotizacionConDetalle[] {
  try {
    const raw = localStorage.getItem(LOCAL_COTIZACIONES_KEY);
    return raw ? (JSON.parse(raw) as CotizacionConDetalle[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCotizaciones(data: CotizacionConDetalle[]) {
  try {
    localStorage.setItem(LOCAL_COTIZACIONES_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
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
  const localList = getLocalCotizaciones();

  const sb = tryGetSupabase();
  if (!sb) {
    let list = localList;
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

  const buildQuery = (cols: string) => {
    let query = sb
      .from('cotizaciones')
      .select(cols, { count: 'exact' })
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
    return query;
  };

  let { data, error, count } = await buildQuery('*, clientes(nombre), perfiles(nombre_completo)');
  if (error) {
    const fallback = await buildQuery('*');
    data = fallback.data;
    error = fallback.error;
    count = fallback.count;
  }
  if (error) {
    return { datos: localList.slice(desde, hasta + 1), total: localList.length };
  }

  const datosRemotos: CotizacionConDetalle[] = (data ?? []).map((row: any) => {
    const localMatch = localList.find((l) => l.id === row.id || l.codigo === row.codigo);
    return {
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
      cliente_nombre: row.clientes?.nombre ?? localMatch?.cliente_nombre ?? 'Cliente general',
      vendedor_nombre: row.perfiles?.nombre_completo ?? localMatch?.vendedor_nombre ?? 'Cajero',
      items: localMatch?.items,
    };
  });

  const seenIds = new Set(datosRemotos.map((d) => d.id));
  const seenCodes = new Set(datosRemotos.map((d) => d.codigo));
  const extrasLocal = localList.filter((l) => !seenIds.has(l.id) && !seenCodes.has(l.codigo));
  const merged = [...datosRemotos, ...extrasLocal];

  return { datos: merged, total: Math.max(count ?? 0, merged.length) };
}

export async function crearCotizacion(payload: PayloadCotizacion): Promise<CotizacionConDetalle> {
  const sb = tryGetSupabase();
  const codigo = `COT-${Date.now().toString(36).toUpperCase()}`;
  const validaHasta = payload.valida_hasta ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const mappedItems = payload.items.map((it, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    producto_id: it.producto_id,
    nombre_item: it.nombre_item,
    cantidad: Number(it.cantidad),
    precio_unitario: Number(it.precio_unitario),
    subtotal: Number(it.subtotal),
  }));

  if (!sb) {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cot-${Date.now()}`;
    const cot: CotizacionConDetalle = {
      id,
      codigo,
      cliente_id: payload.cliente_id ?? null,
      vendedor_id: payload.vendedor_id ?? null,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_total: payload.monto_total,
      estado: 'pendiente',
      valida_hasta: validaHasta,
      creado_en: new Date().toISOString(),
      cliente_nombre: payload.cliente_nombre || 'Cliente general',
      vendedor_nombre: payload.vendedor_nombre || 'Cajero',
      items: mappedItems,
    };
    saveLocalCotizaciones([cot, ...getLocalCotizaciones()]);
    return cot;
  }

  const clienteUuid = esUuid(payload.cliente_id) ? payload.cliente_id : null;
  const vendedorUuid = esUuid(payload.vendedor_id) ? payload.vendedor_id : null;

  let { data: cotData, error: cotErr } = await sb
    .from('cotizaciones')
    .insert({
      codigo,
      cliente_id: clienteUuid,
      vendedor_id: vendedorUuid,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_total: payload.monto_total,
      estado: 'pendiente',
      valida_hasta: validaHasta,
    })
    .select('*, clientes(nombre), perfiles(nombre_completo)')
    .single();

  if (cotErr) {
    const fallback = await sb
      .from('cotizaciones')
      .insert({
        codigo,
        cliente_id: clienteUuid,
        vendedor_id: vendedorUuid,
        subtotal: payload.subtotal,
        monto_impuesto: payload.monto_impuesto,
        monto_total: payload.monto_total,
        estado: 'pendiente',
        valida_hasta: validaHasta,
      })
      .select('*')
      .single();
    cotData = fallback.data;
    cotErr = fallback.error;
  }

  if (cotErr || !cotData) {
    // Fallback local para nunca perder la cotización
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cot-${Date.now()}`;
    const cotLocal: CotizacionConDetalle = {
      id,
      codigo,
      cliente_id: payload.cliente_id ?? null,
      vendedor_id: payload.vendedor_id ?? null,
      subtotal: payload.subtotal,
      monto_impuesto: payload.monto_impuesto,
      monto_total: payload.monto_total,
      estado: 'pendiente',
      valida_hasta: validaHasta,
      creado_en: new Date().toISOString(),
      cliente_nombre: payload.cliente_nombre || 'Cliente general',
      vendedor_nombre: payload.vendedor_nombre || 'Cajero',
      items: mappedItems,
    };
    saveLocalCotizaciones([cotLocal, ...getLocalCotizaciones()]);
    return cotLocal;
  }

  const itemsInsert = payload.items.map((it) => ({
    cotizacion_id: cotData.id,
    producto_id: esUuid(it.producto_id) ? it.producto_id : null,
    nombre_item: it.nombre_item,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    subtotal: it.subtotal,
  }));

  if (itemsInsert.length > 0) {
    const { error: itemErr } = await sb.from('detalle_cotizaciones').insert(itemsInsert);
    if (itemErr) console.warn('Error al guardar detalle de cotización:', itemErr);
  }

  const result: CotizacionConDetalle = {
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
    cliente_nombre: (cotData as any).clientes?.nombre ?? payload.cliente_nombre ?? 'Cliente general',
    vendedor_nombre: (cotData as any).perfiles?.nombre_completo ?? payload.vendedor_nombre ?? 'Cajero',
    items: mappedItems,
  };

  saveLocalCotizaciones([result, ...getLocalCotizaciones().filter((c) => c.id !== result.id)]);
  return result;
}

export async function obtenerDetalleCotizacion(id: string): Promise<CotizacionConDetalle | null> {
  const localMatch = getLocalCotizaciones().find((c) => c.id === id);
  const sb = tryGetSupabase();
  if (!sb || !esUuid(id)) {
    return localMatch ?? null;
  }

  let { data, error } = await sb
    .from('cotizaciones')
    .select('*, clientes(nombre), perfiles(nombre_completo), detalle_cotizaciones(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const fallback = await sb
      .from('cotizaciones')
      .select('*, detalle_cotizaciones(*)')
      .eq('id', id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) return localMatch ?? null;

  const remoteItems = ((data as any).detalle_cotizaciones ?? []).map((it: any) => ({
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
    cliente_nombre: (data as any).clientes?.nombre ?? localMatch?.cliente_nombre ?? 'Cliente general',
    vendedor_nombre: (data as any).perfiles?.nombre_completo ?? localMatch?.vendedor_nombre ?? 'Cajero',
    items: remoteItems.length > 0 ? remoteItems : (localMatch?.items ?? []),
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
