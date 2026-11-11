import { tryGetSupabase } from '../clienteSupabase';
import { obtenerProductos } from '../productos.service';
import { getStoredAdjustments } from '@/lib/stockAdjustmentStore';
import { type PeriodoInforme, rangoFin, fmtFecha } from './informesShared';

export type InformeInventario = {
  valor: number;
  skus: number;
  bajos: number;
  agotados: number;
  rows: (string | number)[][];
};

export async function informeInventario(): Promise<InformeInventario> {
  const res = await obtenerProductos({ pagina: 1, limite: 10000, estado: 'todos' });
  const prods = res.datos ?? [];
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
      p.sku || '—',
      p.nombre,
      p.categoria || 'General',
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
  const sb = tryGetSupabase();
  const rowsMap = new Map<string, InformeAjustes['rows'][number]>();

  if (sb) {
    try {
      const { data, error } = await sb
        .from('ajustes_stock')
        .select(
          `
          id, codigo, tipo_ajuste, cantidad_anterior, cantidad_nueva, motivo, creado_en,
          productos ( nombre, sku )
        `
        )
        .gte('creado_en', p.desde)
        .lte('creado_en', rangoFin(p.hasta))
        .order('creado_en', { ascending: false })
        .limit(1000);

      if (!error && data) {
        for (const a of data as Record<string, unknown>[]) {
          const tipo = String(a.tipo_ajuste);
          const prod = a.productos as { nombre?: string; sku?: string } | null;
          const code = String(a.codigo || a.id);
          const sku = prod?.sku ?? '—';
          rowsMap.set(`${code}::${sku}`, {
            code,
            productName: prod?.nombre ?? 'Producto',
            sku,
            type: tipo,
            previousQty: Number(a.cantidad_anterior ?? 0),
            newQty: Number(a.cantidad_nueva ?? 0),
            reason: String(a.motivo ?? ''),
            date: fmtFecha(String(a.creado_en)),
          });
        }
      }
    } catch {
      // Fallback a local
    }
  }

  for (const localAdj of getStoredAdjustments()) {
    if (localAdj.date >= p.desde && localAdj.date <= p.hasta) {
      const key = `${localAdj.code}::${localAdj.sku || localAdj.productId}`;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          code: localAdj.code,
          productName: localAdj.productName,
          sku: localAdj.sku || '—',
          type: localAdj.type,
          previousQty: localAdj.previousQty,
          newQty: localAdj.newQty,
          reason: localAdj.reason,
          date: fmtFecha(localAdj.date),
        });
      }
    }
  }

  const rows = Array.from(rowsMap.values());
  let entradas = 0;
  let salidas = 0;
  for (const r of rows) {
    if (r.type === 'entrada') entradas += 1;
    else salidas += 1;
  }

  return { total: rows.length, entradas, salidas, rows };
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
  const res = await obtenerProductos({ pagina: 1, limite: 10000, estado: 'todos' });
  return (res.datos ?? []).map((p) => ({
    id: p.id,
    name: p.nombre,
    sku: p.sku || '—',
    category: p.categoria || 'General',
    stock: Number(p.stock_actual ?? 0),
    min: Number(p.stock_minimo ?? 0),
    value: Number(p.stock_actual ?? 0) * Number(p.precio_costo ?? 0),
  }));
}
