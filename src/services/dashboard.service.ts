import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import type { MetricasDashboard } from '@/types/database';
import { getLocalVentas } from './ventas.service';
import { getStoredProducts } from '@/lib/productStore';

export const emptyMetricas = (periodo: MetricasDashboard['periodo']): MetricasDashboard => ({
  periodo,
  desde: new Date().toISOString(),
  ventas_total: 0,
  ventas_count: 0,
  ticket_promedio: 0,
  costo_total: 0,
  ganancia_bruta: 0,
  productos_stock_bajo: 0,
  productos_activos: 0,
});

export function getRangoFechasPeriodo(periodo: 'hoy' | 'semana' | 'mes'): { desde: Date; hasta: Date } {
  const now = new Date();
  const hasta = new Date(now);

  if (periodo === 'hoy') {
    // 00:00:00.000 del día local en la zona horaria del usuario (evita truncados UTC a las 8 p.m.)
    const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { desde, hasta };
  }

  if (periodo === 'semana') {
    // Lunes de la semana actual
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
    return { desde, hasta };
  }

  // 'mes': Primer día del mes actual a las 00:00:00
  const desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { desde, hasta };
}

export function getEffectiveSaleTotal(v: any): number {
  const monto = Number(v.monto_total ?? 0);
  if (monto > 0) return monto;

  const sub = Number(v.subtotal ?? 0);
  const tax = Number(v.monto_impuesto ?? 0);
  const desc = Number(v.monto_descuento ?? 0);
  const fromParts = Math.max(0, sub + tax - desc);
  if (fromParts > 0) return fromParts;

  const pagado = Number(v.monto_pagado ?? 0);
  if (pagado > 0) return pagado;

  const sumPaymentMethods =
    Number(v.monto_efectivo ?? 0) +
    Number(v.monto_tarjeta ?? 0) +
    Number(v.monto_transferencia ?? 0) +
    Number(v.monto_credito ?? 0);
  if (sumPaymentMethods > 0) return sumPaymentMethods;

  return 0;
}

export async function obtenerMetricasDashboard(
  periodo: 'hoy' | 'semana' | 'mes' = 'hoy',
  signal?: AbortSignal
): Promise<MetricasDashboard> {
  const sb = tryGetSupabase();
  const { desde, hasta } = getRangoFechasPeriodo(periodo);
  const desdeIso = desde.toISOString();

  let remoteRows: any[] = [];
  let rpcData: Partial<MetricasDashboard> | null = null;

  // 1. Intentar llamar al RPC optimizado de Supabase
  if (sb) {
    try {
      let rpc = sb.rpc('obtener_metricas_dashboard', { p_periodo: periodo, p_desde: desdeIso });
      if (signal) rpc = rpc.abortSignal(signal);
      const { data, error } = await rpc;
      if (!error && data) {
        rpcData = data as MetricasDashboard;
      }
    } catch {
      try {
        let rpc = sb.rpc('obtener_metricas_dashboard', { p_periodo: periodo });
        if (signal) rpc = rpc.abortSignal(signal);
        const { data, error } = await rpc;
        if (!error && data) {
          rpcData = data as MetricasDashboard;
        }
      } catch {
        // Fallback a consulta directa
      }
    }

    // 2. Consultar directamente ventas para garantizar inclusión de ventas diurnas y estados variados
    try {
      let query = sb
        .from('ventas')
        .select(
          'id, numero_factura, monto_total, subtotal, monto_impuesto, monto_descuento, costo_total, monto_efectivo, monto_tarjeta, monto_transferencia, monto_credito, monto_pagado, estado, creado_en'
        )
        .gte('creado_en', desdeIso)
        .neq('estado', 'anulada');
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        remoteRows = data;
      }
    } catch {
      // Ignorar error de consulta
    }
  }

  // 3. Obtener ventas locales de respaldo / espejo
  let localList: any[] = [];
  try {
    localList = getLocalVentas();
  } catch {
    localList = [];
  }

  // 4. Consolidar ventas únicas
  const remoteIds = new Set(remoteRows.map((r) => String(r.id)));
  const mergedVentas: any[] = [...remoteRows];

  const desdeMs = desde.getTime();
  const hastaMs = hasta.getTime() + 1000;

  for (const lv of localList) {
    if (remoteIds.has(String(lv.id))) continue;
    if (lv.estado === 'anulada' || (lv.estado as string) === 'cancelled') continue;
    const time = lv.creado_en ? new Date(lv.creado_en).getTime() : 0;
    if (time >= desdeMs && time <= hastaMs) {
      mergedVentas.push(lv);
      remoteIds.add(String(lv.id));
    }
  }

  // 5. Calcular métricas consolidadas
  let calcVentasTotal = 0;
  let calcCostoTotal = 0;
  let calcVentasCount = 0;

  for (const v of mergedVentas) {
    if (v.estado === 'anulada' || (v.estado as string) === 'cancelled') continue;
    const total = getEffectiveSaleTotal(v);
    calcVentasTotal += total;
    calcCostoTotal += Number(v.costo_total ?? 0);
    calcVentasCount += 1;
  }

  calcVentasTotal = Math.round(calcVentasTotal * 100) / 100;
  calcCostoTotal = Math.round(calcCostoTotal * 100) / 100;

  // Si el RPC contiene más ventas o montos consolidados, tomar el mayor
  const finalVentasTotal = Math.max(calcVentasTotal, Number(rpcData?.ventas_total || 0));
  const finalVentasCount = Math.max(calcVentasCount, Number(rpcData?.ventas_count || 0));
  const finalCostoTotal = Math.max(calcCostoTotal, Number(rpcData?.costo_total || 0));
  const finalGananciaBruta = Math.round((finalVentasTotal - finalCostoTotal) * 100) / 100;
  const finalTicketPromedio =
    finalVentasCount > 0 ? Math.round((finalVentasTotal / finalVentasCount) * 100) / 100 : 0;

  // 6. Productos activos y stock bajo
  let productosActivos = Number(rpcData?.productos_activos || 0);
  let productosStockBajo = Number(rpcData?.productos_stock_bajo || 0);

  if (productosActivos === 0) {
    try {
      const stored = getStoredProducts();
      productosActivos =
        stored.filter((p) => p.status === 'active' || (p as any).estado === 'activo').length ||
        stored.length;
      productosStockBajo = stored.filter((p) => {
        const actual = Number(p.currentStock ?? (p as any).stock_actual ?? 0);
        const minimo = Number(p.minStock ?? (p as any).stock_minimo ?? 0);
        return actual <= minimo;
      }).length;
    } catch {
      // ignore
    }
  }

  return {
    periodo,
    desde: desdeIso,
    ventas_total: finalVentasTotal,
    ventas_count: finalVentasCount,
    ticket_promedio: finalTicketPromedio,
    costo_total: finalCostoTotal,
    ganancia_bruta: finalGananciaBruta,
    productos_stock_bajo: productosStockBajo,
    productos_activos: productosActivos,
  };
}

export async function obtenerAlertasStock(signal?: AbortSignal) {
  if (!isSupabaseConfigured()) {
    try {
      const stored = getStoredProducts();
      return stored
        .filter((p) => {
          const actual = Number(p.currentStock ?? (p as any).stock_actual ?? 0);
          const minimo = Number(p.minStock ?? (p as any).stock_minimo ?? 0);
          return actual <= minimo;
        })
        .map((p) => ({
          id: p.id,
          sku: p.sku || '',
          nombre: p.name,
          stock_actual: Number(p.currentStock ?? 0),
          stock_minimo: Number(p.minStock ?? 0),
          nivel_alerta: Number(p.currentStock ?? 0) <= 0 ? 'agotado' : 'bajo',
        }));
    } catch {
      return [];
    }
  }
  const sb = getSupabase();
  let query = sb
    .from('alertas_stock')
    .select('id, sku, nombre, stock_actual, stock_minimo, nivel_alerta')
    .limit(20);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) {
    try {
      const stored = getStoredProducts();
      return stored
        .filter((p) => {
          const actual = Number(p.currentStock ?? (p as any).stock_actual ?? 0);
          const minimo = Number(p.minStock ?? (p as any).stock_minimo ?? 0);
          return actual <= minimo;
        })
        .map((p) => ({
          id: p.id,
          sku: p.sku || '',
          nombre: p.name,
          stock_actual: Number(p.currentStock ?? 0),
          stock_minimo: Number(p.minStock ?? 0),
          nivel_alerta: Number(p.currentStock ?? 0) <= 0 ? 'agotado' : 'bajo',
        }));
    } catch {
      return [];
    }
  }
  return data ?? [];
}

export type PuntoTendenciaVenta = { day: string; ventas: number };
export type ProductoTopVenta = { name: string; ventas: number };
export type PuntoComprasVsVentas = { mes: string; compras: number; ventas: number; ganancia: number };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function labelDia(d: Date) {
  return d.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric' });
}

function labelMes(d: Date) {
  return d.toLocaleDateString('es-DO', { month: 'short' });
}

/** Ventas diarias de los últimos N días (Supabase + Local). */
export async function obtenerTendenciaVentas(
  dias: 7 | 30 = 7,
  signal?: AbortSignal
): Promise<PuntoTendenciaVenta[]> {
  const sb = tryGetSupabase();
  const points: PuntoTendenciaVenta[] = [];
  const today = startOfDay(new Date());

  // Claves de fecha en formato local YYYY-MM-DD
  const dateKeys: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateKeys.push(key);
    points.push({ day: labelDia(d), ventas: 0 });
  }

  const desde = new Date(today);
  desde.setDate(today.getDate() - (dias - 1));
  const desdeIso = desde.toISOString();

  let remoteRows: any[] = [];
  if (sb) {
    try {
      let query = sb
        .from('ventas')
        .select(
          'id, monto_total, subtotal, monto_impuesto, monto_descuento, monto_efectivo, monto_tarjeta, monto_transferencia, monto_credito, monto_pagado, creado_en, estado'
        )
        .gte('creado_en', desdeIso)
        .neq('estado', 'anulada');
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        remoteRows = data;
      }
    } catch {
      // Ignorar error de red
    }
  }

  let localList: any[] = [];
  try {
    localList = getLocalVentas();
  } catch {
    localList = [];
  }

  const remoteIds = new Set(remoteRows.map((r) => String(r.id)));
  const allRows: any[] = [...remoteRows];
  for (const lv of localList) {
    if (remoteIds.has(String(lv.id))) continue;
    if (lv.estado === 'anulada' || (lv.estado as string) === 'cancelled') continue;
    allRows.push(lv);
  }

  const byKey = new Map<string, number>();
  for (const row of allRows) {
    if (row.estado === 'anulada' || (row.estado as string) === 'cancelled') continue;
    const rowDate = new Date(row.creado_en);
    if (isNaN(rowDate.getTime())) continue;
    const key = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}-${String(rowDate.getDate()).padStart(2, '0')}`;
    const tot = getEffectiveSaleTotal(row);
    byKey.set(key, (byKey.get(key) ?? 0) + tot);
  }

  return points.map((p, idx) => {
    const key = dateKeys[idx];
    return { day: p.day, ventas: Math.round((byKey.get(key) ?? 0) * 100) / 100 };
  });
}

/** Top productos por ingresos (Supabase + Local). */
export async function obtenerTopProductosVendidos(
  limite = 8,
  signal?: AbortSignal
): Promise<ProductoTopVenta[]> {
  const sb = tryGetSupabase();
  const tally = new Map<string, number>();

  if (sb) {
    try {
      let query = sb
        .from('detalle_ventas')
        .select('nombre_item, subtotal, ventas!inner(estado)')
        .neq('ventas.estado', 'anulada')
        .limit(2000);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const name = String((row as { nombre_item: string }).nombre_item || 'Producto');
          tally.set(
            name,
            (tally.get(name) ?? 0) + Number((row as { subtotal: number }).subtotal ?? 0)
          );
        }
      } else {
        let q2 = sb.from('detalle_ventas').select('nombre_item, subtotal').limit(2000);
        if (signal) q2 = q2.abortSignal(signal);
        const res = await q2;
        if (!res.error && Array.isArray(res.data)) {
          for (const row of res.data) {
            const name = String((row as { nombre_item: string }).nombre_item || 'Producto');
            tally.set(
              name,
              (tally.get(name) ?? 0) + Number((row as { subtotal: number }).subtotal ?? 0)
            );
          }
        }
      }
    } catch {
      // Ignorar fallback
    }
  }

  // Complementar con ventas locales
  try {
    const localList = getLocalVentas();
    for (const v of localList) {
      if (v.estado === 'anulada' || (v.estado as string) === 'cancelled') continue;
      for (const d of v.detalle_ventas ?? []) {
        const name = String(d.nombre_item || 'Producto');
        const subt = Number(
          Number(d.subtotal) > 0 ? d.subtotal : Number(d.precio_unitario || 0) * Number(d.cantidad || 0)
        );
        tally.set(name, (tally.get(name) ?? 0) + subt);
      }
    }
  } catch {
    // Ignorar
  }

  return [...tally.entries()]
    .map(([name, ventas]) => ({ name, ventas: Math.round(ventas * 100) / 100 }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, limite);
}

/** Comparativo mensual compras vs ventas (últimos N meses). */
export async function obtenerComprasVsVentasMensual(
  meses = 7,
  signal?: AbortSignal
): Promise<PuntoComprasVsVentas[]> {
  const sb = tryGetSupabase();
  const today = new Date();
  const buckets: PuntoComprasVsVentas[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    buckets.push({ mes: labelMes(d), compras: 0, ventas: 0, ganancia: 0 });
  }

  const desde = new Date(today.getFullYear(), today.getMonth() - (meses - 1), 1);

  let remoteVentas: any[] = [];
  let remoteCompras: any[] = [];

  if (sb) {
    try {
      let vQuery = sb
        .from('ventas')
        .select(
          'id, monto_total, subtotal, monto_impuesto, monto_descuento, costo_total, creado_en, estado'
        )
        .gte('creado_en', desde.toISOString())
        .neq('estado', 'anulada');
      if (signal) vQuery = vQuery.abortSignal(signal);
      const { data: ventas } = await vQuery;
      if (Array.isArray(ventas)) remoteVentas = ventas;

      let cQuery = sb
        .from('compras')
        .select('monto_total, creado_en, estado')
        .gte('creado_en', desde.toISOString())
        .neq('estado', 'anulada');
      if (signal) cQuery = cQuery.abortSignal(signal);
      const { data: compras } = await cQuery;
      if (Array.isArray(compras)) remoteCompras = compras;
    } catch {
      // Ignorar error de red
    }
  }

  // Complementar ventas con ventas locales
  try {
    const localList = getLocalVentas();
    const remoteIds = new Set(remoteVentas.map((r) => String(r.id)));
    for (const lv of localList) {
      if (remoteIds.has(String(lv.id))) continue;
      if (lv.estado === 'anulada' || (lv.estado as string) === 'cancelled') continue;
      remoteVentas.push(lv);
    }
  } catch {
    // Ignorar
  }

  const idxFor = (iso: string) => {
    const d = new Date(iso);
    const m = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
    const idx = meses - 1 - m;
    return idx >= 0 && idx < meses ? idx : -1;
  };

  for (const row of remoteVentas) {
    const idx = idxFor(String((row as { creado_en: string }).creado_en));
    if (idx < 0) continue;
    const total = getEffectiveSaleTotal(row);
    const costo = Number((row as { costo_total: number }).costo_total ?? 0);
    buckets[idx].ventas += total;
    buckets[idx].ganancia += total - costo;
  }
  for (const row of remoteCompras) {
    const idx = idxFor(String((row as { creado_en: string }).creado_en));
    if (idx < 0) continue;
    buckets[idx].compras += Number((row as { monto_total: number }).monto_total ?? 0);
  }

  return buckets.map((b) => ({
    ...b,
    ventas: Math.round(b.ventas * 100) / 100,
    compras: Math.round(b.compras * 100) / 100,
    ganancia: Math.round(b.ganancia * 100) / 100,
  }));
}
