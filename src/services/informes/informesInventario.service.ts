import { tryGetSupabase } from '../clienteSupabase';
import { type PeriodoInforme, rangoFin, fmtFecha } from './informesShared';

export type InformeInventario = {
  valor: number;
  skus: number;
  bajos: number;
  agotados: number;
  rows: (string | number)[][];
};

export async function informeInventario(): Promise<InformeInventario> {
  const empty: InformeInventario = { valor: 0, skus: 0, bajos: 0, agotados: 0, rows: [] };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('productos')
    .select('sku, nombre, categoria, stock_actual, stock_minimo, precio_costo, estado')
    .eq('estado', 'activo')
    .order('nombre')
    .limit(2000);

  if (error) throw error;
  const prods = data ?? [];
  let valor = 0;
  let bajos = 0;
  let agotados = 0;

  const rows = prods.map((p) => {
    const stock = Number(p.stock_actual ?? 0);
    const min = Number(p.stock_minimo ?? 0);
    const val = stock * Number(p.precio_costo ?? 0);
    valor += val;
    if (stock <= 0) agotados += 1;
    else if (stock <= min) bajos += 1;
    const estado = stock <= 0 ? 'Agotado' : stock <= min ? 'Bajo' : 'OK';
    return [
      p.sku,
      p.nombre,
      p.categoria,
      stock,
      min,
      `RD$ ${val.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      estado,
    ];
  });

  return { valor, skus: prods.length, bajos, agotados, rows };
}

export type InformeAjustes = {
  total: number;
  entradas: number;
  salidas: number;
  rows: {
    code: string;
    productName: string;
    sku: string;
    type: string;
    previousQty: number;
    newQty: number;
    reason: string;
    date: string;
  }[];
};

export async function informeAjustes(p: PeriodoInforme): Promise<InformeAjustes> {
  const empty: InformeAjustes = { total: 0, entradas: 0, salidas: 0, rows: [] };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('ajustes_stock')
    .select(
      `
      codigo, tipo_ajuste, cantidad_anterior, cantidad_nueva, motivo, creado_en,
      productos ( nombre, sku )
    `
    )
    .gte('creado_en', p.desde)
    .lte('creado_en', rangoFin(p.hasta))
    .order('creado_en', { ascending: false })
    .limit(500);

  if (error) throw error;
  const list = data ?? [];
  let entradas = 0;
  let salidas = 0;
  const rows = list.map((a: Record<string, unknown>) => {
    const tipo = String(a.tipo_ajuste);
    if (tipo === 'entrada') entradas += 1;
    else salidas += 1;
    const prod = a.productos as { nombre?: string; sku?: string } | null;
    return {
      code: String(a.codigo),
      productName: prod?.nombre ?? 'Producto',
      sku: prod?.sku ?? '—',
      type: tipo,
      previousQty: Number(a.cantidad_anterior),
      newQty: Number(a.cantidad_nueva),
      reason: String(a.motivo ?? ''),
      date: fmtFecha(String(a.creado_en)),
    };
  });
  return { total: list.length, entradas, salidas, rows };
}

export type StockDetalleItem = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  min: number;
  value: number;
};

export async function informeStockDetalle(): Promise<StockDetalleItem[]> {
  const sb = tryGetSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('productos')
    .select('id, sku, nombre, categoria, stock_actual, stock_minimo, precio_costo')
    .eq('estado', 'activo')
    .order('nombre')
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.nombre,
    sku: p.sku,
    category: p.categoria,
    stock: Number(p.stock_actual),
    min: Number(p.stock_minimo),
    value: Number(p.stock_actual) * Number(p.precio_costo),
  }));
}
