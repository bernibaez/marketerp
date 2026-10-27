import { tryGetSupabase } from '../clienteSupabase';
import { type PeriodoInforme, rangoFin, fmtFecha, labelPago } from './informesShared';

export type InformeClientes = {
  total: number;
  cxcPendiente: number;
  ticketPromedio: number;
  rows: (string | number)[][];
  pendingRows: (string | number)[][];
};

export async function informeClientes(p: PeriodoInforme): Promise<InformeClientes> {
  const empty: InformeClientes = {
    total: 0,
    cxcPendiente: 0,
    ticketPromedio: 0,
    rows: [],
    pendingRows: [],
  };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const [cliRes, cxcRes, ventRes] = await Promise.all([
    sb.from('clientes').select('id, codigo, nombre, telefono, balance_actual, activo').eq('activo', true).order('nombre').limit(500),
    sb
      .from('cuentas_por_cobrar')
      .select('codigo, numero_factura, saldo, fecha_vencimiento, estado, clientes(nombre)')
      .in('estado', ['pendiente', 'parcial', 'vencida'])
      .limit(200),
    sb
      .from('ventas')
      .select('cliente_id, monto_total, creado_en, numero_factura, clientes(nombre)')
      .gte('creado_en', p.desde)
      .lte('creado_en', rangoFin(p.hasta))
      .neq('estado', 'anulada')
      .limit(1000),
  ]);

  if (cliRes.error) throw cliRes.error;
  const clientes = cliRes.data ?? [];
  const cxc = cxcRes.data ?? [];
  const ventas = ventRes.data ?? [];

  const cxcPendiente = cxc.reduce((s, c) => s + Number(c.saldo ?? 0), 0);
  const ventasSum = ventas.reduce((s, v) => s + Number(v.monto_total ?? 0), 0);

  const byClient = new Map<string, { nombre: string; total: number; last: string; factura: string }>();
  for (const v of ventas as Record<string, unknown>[]) {
    const id = String(v.cliente_id ?? 'sin');
    const cli = v.clientes as { nombre?: string } | null;
    const cur = byClient.get(id) ?? {
      nombre: cli?.nombre ?? 'Cliente general',
      total: 0,
      last: String(v.creado_en),
      factura: String(v.numero_factura ?? ''),
    };
    cur.total += Number(v.monto_total ?? 0);
    if (String(v.creado_en) > cur.last) {
      cur.last = String(v.creado_en);
      cur.factura = String(v.numero_factura ?? '');
    }
    byClient.set(id, cur);
  }

  const rows = clientes.map((c) => {
    const stats = byClient.get(c.id);
    return [
      c.codigo,
      c.nombre,
      c.telefono ?? '—',
      `RD$ ${Number(c.balance_actual ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      stats ? `RD$ ${stats.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}` : 'RD$ 0.00',
    ];
  });

  const pendingRows = cxc.map((c: Record<string, unknown>) => {
    const cli = c.clientes as { nombre?: string } | null;
    return [
      String(c.codigo),
      cli?.nombre ?? '—',
      String(c.numero_factura ?? '—'),
      String(c.fecha_vencimiento ?? ''),
      `RD$ ${Number(c.saldo).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      String(c.estado),
    ];
  });

  return {
    total: clientes.length,
    cxcPendiente,
    ticketPromedio: ventas.length ? ventasSum / ventas.length : 0,
    rows,
    pendingRows,
  };
}

export type InformeAgentes = {
  activos: number;
  rows: (string | number)[][];
};

export async function informeAgentes(): Promise<InformeAgentes> {
  const sb = tryGetSupabase();
  if (!sb) return { activos: 0, rows: [] };

  const { data, error } = await sb
    .from('agentes_comerciales')
    .select('nombre, correo, telefono, porcentaje_comision, activo')
    .order('nombre')
    .limit(200);

  if (error) throw error;
  const list = data ?? [];
  return {
    activos: list.filter((a) => a.activo).length,
    rows: list.map((a) => [
      a.nombre,
      a.correo ?? '—',
      a.telefono ?? '—',
      `${Number(a.porcentaje_comision).toFixed(2)}%`,
      a.activo ? 'Activo' : 'Inactivo',
    ]),
  };
}

export type InformeCaja = {
  efectivo: number;
  tarjeta: number;
  diferencia: number;
  fondo: number;
  sessions: (string | number)[][];
  movements: (string | number)[][];
};

export async function informeCaja(p: PeriodoInforme): Promise<InformeCaja> {
  const empty: InformeCaja = {
    efectivo: 0,
    tarjeta: 0,
    diferencia: 0,
    fondo: 0,
    sessions: [],
    movements: [],
  };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const [cierresRes, ventasRes] = await Promise.all([
    sb
      .from('cierres_caja')
      .select('*')
      .gte('abierta_en', p.desde)
      .lte('abierta_en', rangoFin(p.hasta))
      .order('abierta_en', { ascending: false })
      .limit(100),
    sb
      .from('ventas')
      .select('numero_factura, creado_en, metodo_pago, monto_total, monto_efectivo, monto_tarjeta')
      .gte('creado_en', p.desde)
      .lte('creado_en', rangoFin(p.hasta))
      .neq('estado', 'anulada')
      .order('creado_en', { ascending: false })
      .limit(200),
  ]);

  if (cierresRes.error) throw cierresRes.error;
  const cierres = cierresRes.data ?? [];
  const ventas = ventasRes.data ?? [];

  const efectivo = cierres.reduce((s, c) => s + Number(c.total_efectivo ?? 0), 0);
  const tarjeta = cierres.reduce((s, c) => s + Number(c.total_tarjeta ?? 0), 0);
  const diferencia = cierres.reduce((s, c) => s + Number(c.monto_diferencia ?? 0), 0);
  const fondo = cierres.reduce((s, c) => s + Number(c.monto_apertura ?? 0), 0);

  const sessions = cierres.map((c) => [
    c.codigo,
    fmtFecha(c.abierta_en),
    c.caja_id,
    `RD$ ${Number(c.total_ventas).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    `RD$ ${Number(c.total_efectivo).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    `RD$ ${Number(c.monto_esperado).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    `RD$ ${Number(c.monto_real).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    `RD$ ${Number(c.monto_diferencia).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
  ]);

  const movements = ventas.slice(0, 50).map((v) => [
    new Date(v.creado_en).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    'Venta',
    `${v.numero_factura} · ${labelPago(v.metodo_pago)}`,
    `RD$ ${Number(v.monto_efectivo ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    `RD$ ${Number(v.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
  ]);

  return { efectivo, tarjeta, diferencia, fondo, sessions, movements };
}

export type InformeFiscal = {
  ventasGravadas: number;
  itbisCobrado: number;
  itbisCredito: number;
  itbisNeto: number;
  ncfRows: (string | number)[][];
  form606: (string | number)[][];
  form607: (string | number)[][];
};

export async function informeFiscal(p: PeriodoInforme): Promise<InformeFiscal> {
  const empty: InformeFiscal = {
    ventasGravadas: 0,
    itbisCobrado: 0,
    itbisCredito: 0,
    itbisNeto: 0,
    ncfRows: [],
    form606: [],
    form607: [],
  };
  const sb = tryGetSupabase();
  if (!sb) return empty;

  const [fiscalRes, comprasRes, ventasRes] = await Promise.all([
    sb
      .from('facturas_fiscales')
      .select('ncf, tipo_ncf, rnc_cliente, nombre_cliente, subtotal, itbis, monto_total, emitida_en')
      .gte('emitida_en', p.desde)
      .lte('emitida_en', rangoFin(p.hasta))
      .order('emitida_en', { ascending: false })
      .limit(500),
    sb
      .from('compras')
      .select('codigo, monto_total, monto_impuesto, creado_en, proveedores(nombre, rnc)')
      .gte('creado_en', p.desde)
      .lte('creado_en', rangoFin(p.hasta))
      .limit(500),
    sb
      .from('ventas')
      .select('numero_factura, ncf, tipo_ncf, subtotal, monto_impuesto, monto_total, creado_en, clientes(nombre, rnc_cedula)')
      .gte('creado_en', p.desde)
      .lte('creado_en', rangoFin(p.hasta))
      .neq('estado', 'anulada')
      .limit(500),
  ]);

  const fiscales = fiscalRes.data ?? [];
  const compras = comprasRes.data ?? [];
  const ventas = ventasRes.data ?? [];

  const itbisCobrado =
    fiscales.reduce((s, f) => s + Number(f.itbis ?? 0), 0) ||
    ventas.reduce((s, v) => s + Number(v.monto_impuesto ?? 0), 0);
  const ventasGravadas =
    fiscales.reduce((s, f) => s + Number(f.subtotal ?? 0), 0) ||
    ventas.reduce((s, v) => s + Number(v.subtotal ?? 0), 0);
  const itbisCredito = compras.reduce((s, c) => s + Number(c.monto_impuesto ?? 0), 0);

  const ncfRows = (fiscales.length ? fiscales : ventas).map((f: Record<string, unknown>) => {
    const cli = f.clientes as { nombre?: string; rnc_cedula?: string } | null;
    return [
      String(f.ncf ?? f.numero_factura ?? '—'),
      String(f.tipo_ncf ?? '—'),
      fmtFecha(String(f.emitida_en ?? f.creado_en)),
      String(f.nombre_cliente ?? cli?.nombre ?? '—'),
      String(f.rnc_cliente ?? cli?.rnc_cedula ?? '—'),
      `RD$ ${Number(f.monto_total ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ];
  });

  const form606 = compras.map((c: Record<string, unknown>) => {
    const prov = c.proveedores as { nombre?: string; rnc?: string } | null;
    return [
      String(c.codigo),
      fmtFecha(String(c.creado_en)),
      prov?.rnc ?? '—',
      prov?.nombre ?? '—',
      `RD$ ${Number(c.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      `RD$ ${Number(c.monto_impuesto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ];
  });

  const form607 = ventas.map((v: Record<string, unknown>) => {
    const cli = v.clientes as { nombre?: string; rnc_cedula?: string } | null;
    return [
      String(v.ncf ?? v.numero_factura ?? '—'),
      fmtFecha(String(v.creado_en)),
      cli?.rnc_cedula ?? '—',
      cli?.nombre ?? 'Consumidor final',
      `RD$ ${Number(v.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      `RD$ ${Number(v.monto_impuesto).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
    ];
  });

  return {
    ventasGravadas,
    itbisCobrado,
    itbisCredito,
    itbisNeto: itbisCobrado - itbisCredito,
    ncfRows,
    form606,
    form607,
  };
}
