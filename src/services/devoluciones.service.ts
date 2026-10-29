import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import type { Devolucion, EstadoDevolucion } from '@/types/database';
import { updateProductStockInStore } from '@/lib/productStore';

export interface ItemDevolucionPayload {
  producto_id?: string | null;
  sku?: string | null;
  nombre_item: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PayloadDevolucion {
  venta_id?: string | null;
  numero_factura?: string | null;
  cliente_id?: string | null;
  cajero_id?: string | null;
  monto_total: number;
  motivo: string;
  metodo_reembolso: 'efectivo' | 'tarjeta' | 'nota_credito' | 'cambio';
  tipo: 'parcial' | 'total';
  items: ItemDevolucionPayload[];
}

export interface DevolucionConDetalle extends Devolucion {
  cliente_nombre?: string;
  cajero_nombre?: string;
  revisado_por_nombre?: string;
  motivo_rechazo?: string | null;
  revisado_por?: string | null;
  items?: {
    id: string;
    producto_id?: string | null;
    sku?: string | null;
    nombre_item: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }[];
}

const LOCAL_DEVOLUCIONES_KEY = 'mercato_devoluciones_local';

function getLocalDevoluciones(): DevolucionConDetalle[] {
  try {
    const raw = localStorage.getItem(LOCAL_DEVOLUCIONES_KEY);
    return raw ? (JSON.parse(raw) as DevolucionConDetalle[]) : [];
  } catch {
    return [];
  }
}

function saveLocalDevoluciones(data: DevolucionConDetalle[]) {
  localStorage.setItem(LOCAL_DEVOLUCIONES_KEY, JSON.stringify(data));
}

export async function obtenerDevoluciones(params: {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  estado?: EstadoDevolucion;
  signal?: AbortSignal;
} = {}): Promise<{ datos: DevolucionConDetalle[]; total: number }> {
  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 50;
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  const sb = tryGetSupabase();
  if (!sb) {
    let list = getLocalDevoluciones();
    if (params.estado) {
      list = list.filter((d) => d.estado === params.estado);
    }
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim().toLowerCase();
      const coreQ = q.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
      list = list.filter((d) => {
        const num = (d.numero_factura ?? '').toLowerCase();
        const numCore = num.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
        return (
          d.codigo.toLowerCase().includes(q) ||
          num.includes(q) ||
          (coreQ.length >= 2 && numCore.includes(coreQ)) ||
          (d.cliente_nombre ?? '').toLowerCase().includes(q)
        );
      });
    }
    return { datos: list.slice(desde, hasta + 1), total: list.length };
  }

  let query = sb
    .from('devoluciones')
    .select('*, clientes(nombre), perfiles!cajero_id(nombre_completo)', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range(desde, hasta);

  if (params.estado) {
    query = query.eq('estado', params.estado);
  }
  if (params.busqueda?.trim()) {
    const rawQ = params.busqueda.trim();
    const safeQ = rawQ.replace(/[,()"]/g, '').trim();
    const coreQ = safeQ.replace(/^(?:fac|ven|vnt|vta|fact|factura|inv|doc)[-_:\s]*/i, '').trim();
    const orClauses = [`codigo.ilike.%${safeQ}%`, `numero_factura.ilike.%${safeQ}%`];
    if (coreQ && coreQ !== safeQ && coreQ.length >= 2) {
      orClauses.push(`numero_factura.ilike.%${coreQ}%`);
    }
    query = query.or(orClauses.join(','));
  }
  if (params.signal) {
    query = query.abortSignal(params.signal);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const datos: DevolucionConDetalle[] = (data ?? []).map((row: any) => ({
    id: row.id,
    codigo: row.codigo,
    venta_id: row.venta_id,
    numero_factura: row.numero_factura,
    cliente_id: row.cliente_id,
    cajero_id: row.cajero_id,
    monto_total: Number(row.monto_total),
    motivo: row.motivo,
    metodo_reembolso: row.metodo_reembolso,
    tipo: row.tipo,
    estado: row.estado,
    motivo_rechazo: row.motivo_rechazo,
    revisado_por: row.revisado_por,
    creado_en: row.creado_en,
    cliente_nombre: row.clientes?.nombre ?? 'Cliente general',
    cajero_nombre: row.perfiles?.nombre_completo ?? 'Cajero',
  }));

  if (datos.length > 0) {
    const ids = datos.map((d) => d.id);
    const { data: det } = await sb
      .from('detalle_devoluciones')
      .select('id, devolucion_id, producto_id, sku, nombre_item, cantidad, precio_unitario, subtotal')
      .in('devolucion_id', ids);
    const byDev = new Map<string, NonNullable<DevolucionConDetalle['items']>>();
    for (const row of det ?? []) {
      const list = byDev.get(String(row.devolucion_id)) ?? [];
      list.push({
        id: String(row.id),
        producto_id: row.producto_id,
        sku: row.sku,
        nombre_item: row.nombre_item,
        cantidad: Number(row.cantidad),
        precio_unitario: Number(row.precio_unitario),
        subtotal: Number(row.subtotal),
      });
      byDev.set(String(row.devolucion_id), list);
    }
    for (const d of datos) {
      d.items = byDev.get(d.id) ?? [];
    }
  }

  return { datos, total: count ?? 0 };
}

export async function crearDevolucion(payload: PayloadDevolucion): Promise<DevolucionConDetalle> {
  const sb = tryGetSupabase();
  const codigo = `DEV-${Date.now().toString(36).toUpperCase()}`;

  if (!sb) {
    const id = crypto.randomUUID();
    const dev: DevolucionConDetalle = {
      id,
      codigo,
      venta_id: payload.venta_id ?? null,
      numero_factura: payload.numero_factura ?? null,
      cliente_id: payload.cliente_id ?? null,
      cajero_id: payload.cajero_id ?? null,
      monto_total: payload.monto_total,
      motivo: payload.motivo,
      metodo_reembolso: payload.metodo_reembolso,
      tipo: payload.tipo,
      estado: 'pendiente',
      creado_en: new Date().toISOString(),
      cliente_nombre: 'Cliente',
      cajero_nombre: 'Cajero',
      items: payload.items.map((it) => ({
        id: crypto.randomUUID(),
        producto_id: it.producto_id,
        sku: it.sku,
        nombre_item: it.nombre_item,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.subtotal,
      })),
    };
    saveLocalDevoluciones([dev, ...getLocalDevoluciones()]);
    return dev;
  }

  const { data: devData, error: devErr } = await sb
    .from('devoluciones')
    .insert({
      codigo,
      venta_id: payload.venta_id ?? null,
      numero_factura: payload.numero_factura ?? null,
      cliente_id: payload.cliente_id ?? null,
      cajero_id: payload.cajero_id ?? null,
      monto_total: payload.monto_total,
      motivo: payload.motivo,
      metodo_reembolso: payload.metodo_reembolso,
      tipo: payload.tipo,
      estado: 'pendiente',
    })
    .select('*, clientes(nombre)')
    .single();

  if (devErr) throw devErr;

  const itemsInsert = payload.items.map((it) => ({
    devolucion_id: devData.id,
    producto_id: it.producto_id ?? null,
    sku: it.sku ?? null,
    nombre_item: it.nombre_item,
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    subtotal: it.subtotal,
  }));

  if (itemsInsert.length > 0) {
    const { error: itemErr } = await sb.from('detalle_devoluciones').insert(itemsInsert);
    if (itemErr) console.warn('Error al guardar detalle de devolución:', itemErr);
  }

  return {
    id: devData.id,
    codigo: devData.codigo,
    venta_id: devData.venta_id,
    numero_factura: devData.numero_factura,
    cliente_id: devData.cliente_id,
    cajero_id: devData.cajero_id,
    monto_total: Number(devData.monto_total),
    motivo: devData.motivo,
    metodo_reembolso: devData.metodo_reembolso,
    tipo: devData.tipo,
    estado: devData.estado,
    creado_en: devData.creado_en,
    cliente_nombre: devData.clientes?.nombre ?? 'Cliente',
  };
}

export async function cambiarEstadoDevolucion(
  devolucionId: string,
  nuevoEstado: EstadoDevolucion,
  motivoRechazo?: string
): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) {
    const local = getLocalDevoluciones().map((d) => {
      if (d.id === devolucionId) {
        return {
          ...d,
          estado: nuevoEstado,
          motivo_rechazo: motivoRechazo ?? d.motivo_rechazo,
        };
      }
      return d;
    });
    saveLocalDevoluciones(local);

    // Si se aprueba localmente, devolver stock
    if (nuevoEstado === 'aprobada') {
      const target = getLocalDevoluciones().find((d) => d.id === devolucionId);
      if (target?.items) {
        for (const item of target.items) {
          if (item.producto_id) {
            updateProductStockInStore(item.producto_id, Math.ceil(item.cantidad));
          }
        }
      }
    }
    return;
  }

  // En Supabase llamamos RPC o realizamos fallback manual
  try {
    const { error } = await sb.rpc('procesar_devolucion_pos', {
      p_devolucion_id: devolucionId,
      p_nuevo_estado: nuevoEstado,
      p_motivo_rechazo: motivoRechazo ?? null,
    });
    if (!error) return;
  } catch {
    // Fallback directo a tablas
  }

  const { error } = await sb
    .from('devoluciones')
    .update({
      estado: nuevoEstado,
      revisado_en: new Date().toISOString(),
      motivo_rechazo: motivoRechazo ?? null,
    })
    .eq('id', devolucionId);

  if (error) throw error;

  if (nuevoEstado === 'aprobada') {
    const { data: items } = await sb
      .from('detalle_devoluciones')
      .select('producto_id, cantidad')
      .eq('devolucion_id', devolucionId);

    if (items) {
      for (const item of items) {
        if (item.producto_id) {
          const { data: prod } = await sb
            .from('productos')
            .select('stock_actual')
            .eq('id', item.producto_id)
            .single();

          if (prod) {
            await sb
              .from('productos')
              .update({ stock_actual: (prod.stock_actual || 0) + Math.ceil(Number(item.cantidad)) })
              .eq('id', item.producto_id);
          }
        }
      }
    }
  }
}
