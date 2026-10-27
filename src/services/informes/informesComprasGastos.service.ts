import { tryGetSupabase } from '../clienteSupabase';
import { type PeriodoInforme, rangoFin, fmtFecha } from './informesShared';

export type InformeCompras = {
  total: number;
  ordenes: number;
  pendientes: number;
  pendientesMonto: number;
  rows: (string | number)[][];
};

export async function informeCompras(p: PeriodoInforme): Promise<InformeCompras> {
  const empty: InformeCompras = { total: 0, ordenes: 0, pendientes: 0, pendientesMonto: 0, rows: [] };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('compras')
    .select(
      `
      codigo, creado_en, estado, monto_total,
      proveedores ( nombre ),
      detalle_compras ( cantidad )
    `
    )
    .gte('creado_en', p.desde)
    .lte('creado_en', rangoFin(p.hasta))
    .order('creado_en', { ascending: false })
    .limit(500);

  if (error) throw error;
  const rowsRaw = data ?? [];
  let total = 0;
  let pendientes = 0;
  let pendientesMonto = 0;

  const estadoLabel: Record<string, string> = {
    recibida: 'Recibida',
    pendiente: 'Pendiente',
    parcial: 'Parcial',
    anulada: 'Anulada',
  };

  const rows = rowsRaw.map((c: Record<string, unknown>) => {
    const monto = Number(c.monto_total ?? 0);
    total += monto;
    if (c.estado === 'pendiente' || c.estado === 'parcial') {
      pendientes += 1;
      pendientesMonto += monto;
    }
    const prov = c.proveedores as { nombre?: string } | null;
    const items = ((c.detalle_compras as { cantidad?: number }[]) ?? []).reduce(
      (s, d) => s + Number(d.cantidad ?? 0),
      0
    );
    return [
      String(c.codigo),
      fmtFecha(String(c.creado_en)),
      prov?.nombre ?? 'Sin proveedor',
      estadoLabel[String(c.estado)] ?? String(c.estado),
      items,
      `RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ];
  });

  return { total, ordenes: rowsRaw.length, pendientes, pendientesMonto, rows };
}

export type InformeGastos = {
  aprobados: number;
  pendientes: number;
  total: number;
  rows: (string | number)[][];
};

export async function informeGastos(p: PeriodoInforme): Promise<InformeGastos> {
  const empty: InformeGastos = { aprobados: 0, pendientes: 0, total: 0, rows: [] };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const { data, error } = await sb
    .from('gastos')
    .select(
      `
      codigo, descripcion, monto, estado, creado_en,
      categorias_gasto ( nombre )
    `
    )
    .gte('creado_en', p.desde)
    .lte('creado_en', rangoFin(p.hasta))
    .order('creado_en', { ascending: false })
    .limit(500);

  if (error) throw error;
  const list = data ?? [];
  let aprobados = 0;
  let pendientes = 0;
  let total = 0;

  const rows = list.map((g: Record<string, unknown>) => {
    const monto = Number(g.monto ?? 0);
    total += monto;
    if (g.estado === 'aprobado') aprobados += monto;
    if (g.estado === 'pendiente') pendientes += monto;
    const cat = g.categorias_gasto as { nombre?: string } | null;
    return [
      String(g.codigo),
      fmtFecha(String(g.creado_en)),
      cat?.nombre ?? 'Sin categoría',
      String(g.descripcion),
      `RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      String(g.estado),
    ];
  });

  return { aprobados, pendientes, total, rows };
}

export type InformeProveedores = {
  total: number;
  cxpPendiente: number;
  rows: (string | number)[][];
  purchaseRows: (string | number)[][];
};

export async function informeProveedores(p: PeriodoInforme): Promise<InformeProveedores> {
  const empty: InformeProveedores = { total: 0, cxpPendiente: 0, rows: [], purchaseRows: [] };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const [provRes, cxpRes, compRes] = await Promise.all([
    sb.from('proveedores').select('id, codigo, nombre, telefono, activo').eq('activo', true).order('nombre').limit(500),
    sb
      .from('cuentas_por_pagar')
      .select('codigo, saldo, estado, proveedores(nombre)')
      .in('estado', ['pendiente', 'parcial', 'vencida'])
      .limit(200),
    sb
      .from('compras')
      .select('codigo, creado_en, monto_total, estado, proveedores(nombre)')
      .gte('creado_en', p.desde)
      .lte('creado_en', rangoFin(p.hasta))
      .order('creado_en', { ascending: false })
      .limit(200),
  ]);

  if (provRes.error) throw provRes.error;
  const proveedores = provRes.data ?? [];
  const cxp = cxpRes.data ?? [];
  const compras = compRes.data ?? [];
  const cxpPendiente = cxp.reduce((s, c) => s + Number(c.saldo ?? 0), 0);

  const rows = proveedores.map((p) => [
    p.codigo,
    p.nombre,
    p.telefono ?? '—',
    p.activo ? 'Activo' : 'Inactivo',
  ]);

  const purchaseRows = compras.map((c: Record<string, unknown>) => {
    const prov = c.proveedores as { nombre?: string } | null;
    return [
      String(c.codigo),
      fmtFecha(String(c.creado_en)),
      prov?.nombre ?? '—',
      `RD$ ${Number(c.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      String(c.estado),
    ];
  });

  return { total: proveedores.length, cxpPendiente, rows, purchaseRows };
}
