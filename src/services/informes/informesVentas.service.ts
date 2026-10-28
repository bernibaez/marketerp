import { tryGetSupabase } from '../clienteSupabase';
import {
  type PeriodoInforme,
  rangoFin,
  fmtFecha,
  labelPago,
  PAY_COLORS,
} from './informesShared';

export type InformeVentas = {
  totalVentas: number;
  tickets: number;
  ticketPromedio: number;
  itbis: number;
  daily: { day: string; ventas: number; tickets: number }[];
  payments: { name: string; value: number; color: string }[];
  rows: (string | number)[][];
};

export async function informeVentas(p: PeriodoInforme): Promise<InformeVentas> {
  const empty: InformeVentas = {
    totalVentas: 0,
    tickets: 0,
    ticketPromedio: 0,
    itbis: 0,
    daily: [],
    payments: [],
    rows: [],
  };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('ventas')
    .select(
      `
      id, numero_factura, creado_en, monto_total, monto_impuesto, metodo_pago, cliente_id, cajero_id,
      clientes ( nombre ),
      perfiles!cajero_id ( nombre_completo ),
      detalle_ventas ( id )
    `
    )
    .gte('creado_en', p.desde)
    .lte('creado_en', rangoFin(p.hasta))
    .neq('estado', 'anulada')
    .order('creado_en', { ascending: false })
    .limit(1000);

  if (error) throw error;
  const ventas = data ?? [];

  let totalVentas = 0;
  let itbis = 0;
  const byDay = new Map<string, { ventas: number; tickets: number }>();
  const byPay = new Map<string, number>();

  const rows = ventas.map((v: Record<string, unknown>) => {
    const total = Number(v.monto_total ?? 0);
    const tax = Number(v.monto_impuesto ?? 0);
    totalVentas += total;
    itbis += tax;
    const day = String(v.creado_en).slice(0, 10);
    const cur = byDay.get(day) ?? { ventas: 0, tickets: 0 };
    cur.ventas += total;
    cur.tickets += 1;
    byDay.set(day, cur);
    const pago = labelPago(v.metodo_pago as string);
    byPay.set(pago, (byPay.get(pago) ?? 0) + total);
    const cliente = v.clientes as { nombre?: string } | null;
    const perfilRaw = v.perfiles as { nombre_completo?: string } | { nombre_completo?: string }[] | null;
    const cajeroNombre = Array.isArray(perfilRaw)
      ? perfilRaw[0]?.nombre_completo
      : perfilRaw?.nombre_completo;
    const items = (v.detalle_ventas as unknown[] | null)?.length ?? 0;
    return [
      String(v.numero_factura ?? ''),
      fmtFecha(String(v.creado_en)),
      cliente?.nombre ?? 'Cliente general',
      items,
      pago,
      cajeroNombre || 'Cajero',
      total,
    ];
  });

  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({ day: day.slice(5), ventas: d.ventas, tickets: d.tickets }));

  const payTotal = [...byPay.values()].reduce((s, n) => s + n, 0) || 1;
  const payments = [...byPay.entries()].map(([name, amount]) => ({
    name,
    value: Math.round((amount / payTotal) * 100),
    color: PAY_COLORS[name] ?? '#64748b',
  }));

  return {
    totalVentas,
    tickets: ventas.length,
    ticketPromedio: ventas.length ? totalVentas / ventas.length : 0,
    itbis,
    daily,
    payments,
    rows: rows.map((r) => [
      r[0],
      r[1],
      r[2],
      r[3],
      r[4],
      r[5],
      `RD$ ${Number(r[6]).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ]),
  };
}

export type InformeGanancias = {
  ventas: number;
  costo: number;
  gananciaBruta: number;
  itbis: number;
  gananciaNeta: number;
  qtySold: number;
  prodsSold: number;
  customers: number;
  payments: { name: string; value: number; color: string }[];
};

export async function informeGananciasPerdidas(p: PeriodoInforme): Promise<InformeGanancias> {
  const empty: InformeGanancias = {
    ventas: 0,
    costo: 0,
    gananciaBruta: 0,
    itbis: 0,
    gananciaNeta: 0,
    qtySold: 0,
    prodsSold: 0,
    customers: 0,
    payments: [],
  };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('ventas')
    .select('monto_total, monto_impuesto, costo_total, metodo_pago, cliente_id, detalle_ventas(cantidad, producto_id)')
    .gte('creado_en', p.desde)
    .lte('creado_en', rangoFin(p.hasta))
    .neq('estado', 'anulada')
    .limit(2000);

  if (error) throw error;
  const ventas = data ?? [];
  let ventasSum = 0;
  let costo = 0;
  let itbis = 0;
  let qtySold = 0;
  const prods = new Set<string>();
  const clients = new Set<string>();
  const byPay = new Map<string, number>();

  for (const v of ventas as Record<string, unknown>[]) {
    ventasSum += Number(v.monto_total ?? 0);
    costo += Number(v.costo_total ?? 0);
    itbis += Number(v.monto_impuesto ?? 0);
    if (v.cliente_id) clients.add(String(v.cliente_id));
    const pago = labelPago(v.metodo_pago as string);
    byPay.set(pago, (byPay.get(pago) ?? 0) + Number(v.monto_total ?? 0));
    for (const d of (v.detalle_ventas as { cantidad?: number; producto_id?: string }[]) ?? []) {
      qtySold += Number(d.cantidad ?? 0);
      if (d.producto_id) prods.add(d.producto_id);
    }
  }

  const gananciaBruta = ventasSum - costo;
  const payments = [...byPay.entries()].map(([name, value]) => ({
    name,
    value,
    color: PAY_COLORS[name] ?? '#64748b',
  }));

  return {
    ventas: ventasSum,
    costo,
    gananciaBruta,
    itbis,
    gananciaNeta: gananciaBruta - itbis * 0, // neto operativo ≈ bruta (ITBIS es passthrough)
    qtySold,
    prodsSold: prods.size,
    customers: clients.size,
    payments,
  };
}

export type ProductoGanancia = {
  id: string;
  name: string;
  sku: string;
  category: string;
  qty: number;
  unit?: string;
  saleType?: string;
  weightUnit?: string;
  isWeightProduct?: boolean;
  totalCost: number;
  totalSales: number;
  profit: number;
  margin: number;
};

export async function informeGananciasProducto(p: PeriodoInforme): Promise<ProductoGanancia[]> {
  const sb = tryGetSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('detalle_ventas')
    .select(
      `
      nombre_item, cantidad, precio_unitario, costo_unitario, subtotal, producto_id,
      ventas!inner ( creado_en, estado ),
      productos ( sku, categoria, nombre, unidad, sale_type, weight_unit, is_weight_product, es_pesado )
    `
    )
    .gte('ventas.creado_en', p.desde)
    .lte('ventas.creado_en', rangoFin(p.hasta))
    .neq('ventas.estado', 'anulada')
    .limit(5000);

  if (error) {
    const ventas = await informeVentas(p);
    void ventas;
    throw error;
  }

  const map = new Map<string, ProductoGanancia>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const prod = row.productos as {
      sku?: string;
      categoria?: string;
      nombre?: string;
      unidad?: string;
      sale_type?: string;
      weight_unit?: string;
      is_weight_product?: boolean;
      es_pesado?: boolean;
    } | null;
    const key = String(row.producto_id ?? row.nombre_item);
    const qty = Number(row.cantidad ?? 0);
    const sales = Number(row.subtotal ?? qty * Number(row.precio_unitario ?? 0));
    const cost = qty * Number(row.costo_unitario ?? 0);
    const isWeight =
      prod?.is_weight_product ||
      prod?.es_pesado ||
      prod?.sale_type === 'weight' ||
      prod?.sale_type === 'both';
    const cur = map.get(key) ?? {
      id: key,
      name: prod?.nombre ?? String(row.nombre_item ?? 'Producto'),
      sku: prod?.sku ?? '—',
      category: prod?.categoria ?? 'General',
      qty: 0,
      unit: prod?.unidad ?? prod?.weight_unit ?? (isWeight ? 'lb' : 'Unidad'),
      saleType: prod?.sale_type ?? (isWeight ? 'weight' : 'unit'),
      weightUnit: prod?.weight_unit ?? 'lb',
      isWeightProduct: isWeight,
      totalCost: 0,
      totalSales: 0,
      profit: 0,
      margin: 0,
    };
    cur.qty += qty;
    cur.totalCost += cost;
    cur.totalSales += sales;
    cur.profit = cur.totalSales - cur.totalCost;
    cur.margin = cur.totalSales > 0 ? (cur.profit / cur.totalSales) * 100 : 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

export type InformeCombos = {
  totalCombos: number;
  vendidos: number;
  ingreso: number;
  rows: (string | number)[][];
};

export async function informeCombos(p: PeriodoInforme): Promise<InformeCombos> {
  const sb = tryGetSupabase();
  if (!sb) return { totalCombos: 0, vendidos: 0, ingreso: 0, rows: [] };

  const [combosRes, detRes] = await Promise.all([
    sb.from('combos').select('id, codigo, nombre, precio_venta, activo').order('nombre').limit(200),
    sb
      .from('detalle_ventas')
      .select('combo_id, nombre_item, cantidad, subtotal, ventas!inner(creado_en, estado)')
      .not('combo_id', 'is', null)
      .gte('ventas.creado_en', p.desde)
      .lte('ventas.creado_en', rangoFin(p.hasta))
      .neq('ventas.estado', 'anulada')
      .limit(2000),
  ]);

  if (combosRes.error) throw combosRes.error;
  const combos = combosRes.data ?? [];
  const dets = detRes.data ?? [];

  const byCombo = new Map<string, { qty: number; ingreso: number; name: string }>();
  for (const d of dets as Record<string, unknown>[]) {
    const id = String(d.combo_id);
    const cur = byCombo.get(id) ?? { qty: 0, ingreso: 0, name: String(d.nombre_item) };
    cur.qty += Number(d.cantidad ?? 0);
    cur.ingreso += Number(d.subtotal ?? 0);
    byCombo.set(id, cur);
  }

  let vendidos = 0;
  let ingreso = 0;
  const rows = combos.map((c) => {
    const stats = byCombo.get(c.id) ?? { qty: 0, ingreso: 0, name: c.nombre };
    vendidos += stats.qty;
    ingreso += stats.ingreso;
    return [
      c.codigo,
      c.nombre,
      c.activo ? 'Activo' : 'Inactivo',
      stats.qty,
      `RD$ ${Number(c.precio_venta).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      `RD$ ${stats.ingreso.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ];
  });

  return { totalCombos: combos.length, vendidos, ingreso, rows };
}
