import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { actualizarProducto } from './productos.service';
import { crearCxpDesdeCompra } from './cxp.service';
import { movimientoInventarioPresentacion } from './presentaciones.service';

export type CompraLista = {
  id: string;
  codigo: string;
  proveedor: string;
  proveedor_id: string | null;
  fecha: string;
  items: number;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: 'pendiente' | 'parcial' | 'recibida' | 'anulada';
  metodo_pago: string;
};

export type CompraLineaInput = {
  producto_id: string | null;
  nombre: string;
  cantidad: number;
  precio_costo: number;
  precio_venta: number;
  precio_mayorista?: number;
  porcentaje_impuesto: number;
};

export type NuevaCompraInput = {
  codigo?: string;
  proveedor_id?: string | null;
  proveedor_nombre?: string;
  metodo_pago: string;
  estado?: CompraLista['estado'];
  notas?: string;
  lineas: CompraLineaInput[];
};

function mapMetodoPago(pago: string): string {
  const p = pago.toLowerCase();
  if (p.includes('efectivo')) return 'efectivo';
  if (p.includes('tarjeta')) return 'tarjeta';
  if (p.includes('transfer')) return 'transferencia';
  if (p.includes('cheque')) return 'cheque';
  if (p.includes('crédit') || p.includes('credit')) return 'credito';
  return 'mixto';
}

export async function obtenerCompras(): Promise<CompraLista[]> {
  const sb = tryGetSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('compras')
    .select(
      `
      id, codigo, proveedor_id, subtotal, monto_impuesto, monto_total,
      metodo_pago, estado, creado_en,
      proveedores ( nombre ),
      detalle_compras ( id, cantidad )
    `
    )
    .order('creado_en', { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const proveedor = row.proveedores as { nombre?: string } | null;
    const detalle = (row.detalle_compras as { cantidad?: number }[] | null) ?? [];
    const items = detalle.reduce((s, d) => s + Number(d.cantidad ?? 0), 0);
    return {
      id: String(row.id),
      codigo: String(row.codigo),
      proveedor: proveedor?.nombre ?? 'Sin proveedor',
      proveedor_id: row.proveedor_id ? String(row.proveedor_id) : null,
      fecha: String(row.creado_en).slice(0, 10),
      items,
      subtotal: Number(row.subtotal ?? 0),
      impuesto: Number(row.monto_impuesto ?? 0),
      total: Number(row.monto_total ?? 0),
      estado: row.estado as CompraLista['estado'],
      metodo_pago: String(row.metodo_pago ?? ''),
    };
  });
}

export async function crearCompra(input: NuevaCompraInput): Promise<CompraLista> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado');
  }
  if (!input.lineas.length) {
    throw new Error('La compra no tiene líneas');
  }

  const sb = getSupabase();
  const subtotal = input.lineas.reduce((s, l) => s + l.cantidad * l.precio_costo, 0);
  const impuesto = input.lineas.reduce(
    (s, l) => s + l.cantidad * l.precio_costo * ((l.porcentaje_impuesto || 0) / 100),
    0
  );
  const total = subtotal + impuesto;
  const codigo = input.codigo || `OC-${Date.now().toString(36).toUpperCase()}`;

  let proveedorId = input.proveedor_id ?? null;
  if (!proveedorId && input.proveedor_nombre?.trim()) {
    const nombre = input.proveedor_nombre.trim();
    const { data: existing } = await sb
      .from('proveedores')
      .select('id')
      .ilike('nombre', nombre)
      .maybeSingle();
    if (existing?.id) {
      proveedorId = existing.id;
    } else {
      const { data: created, error: provErr } = await sb
        .from('proveedores')
        .insert({
          codigo: `PROV-${Date.now().toString(36).toUpperCase()}`,
          nombre,
          activo: true,
        })
        .select('id')
        .single();
      if (provErr) throw provErr;
      proveedorId = created.id;
    }
  }

  const { data: compra, error } = await sb
    .from('compras')
    .insert({
      codigo,
      proveedor_id: proveedorId,
      subtotal,
      monto_impuesto: impuesto,
      monto_total: total,
      metodo_pago: mapMetodoPago(input.metodo_pago),
      estado: input.estado ?? 'recibida',
      notas: input.notas ?? null,
      recibido_en: new Date().toISOString(),
    })
    .select('id, codigo, proveedor_id, subtotal, monto_impuesto, monto_total, metodo_pago, estado, creado_en')
    .single();
  if (error) throw error;

  const detalles = input.lineas.map((l) => ({
    compra_id: compra.id,
    producto_id: l.producto_id,
    nombre_item: l.nombre,
    cantidad: l.cantidad,
    cantidad_recibida: l.cantidad,
    precio_costo: l.precio_costo,
    precio_venta: l.precio_venta,
    porcentaje_impuesto: l.porcentaje_impuesto,
    subtotal: l.cantidad * l.precio_costo,
  }));

  const { error: detErr } = await sb.from('detalle_compras').insert(detalles);
  if (detErr) throw detErr;

  // Actualiza stock y precios en productos (considerando factores de conversión a unidad base)
  for (const linea of input.lineas) {
    if (!linea.producto_id) continue;
    const { data: prod } = await sb
      .from('productos')
      .select('stock_actual, producto_base_id, factor_conversion')
      .eq('id', linea.producto_id)
      .maybeSingle();

    const movimiento = movimientoInventarioPresentacion(
      {
        id: linea.producto_id,
        producto_base_id: (prod as { producto_base_id?: string | null } | null)?.producto_base_id,
        factor_conversion: (prod as { factor_conversion?: number } | null)?.factor_conversion,
      },
      linea.cantidad
    );
    const targetProdId = movimiento.productoId;
    const addQty = movimiento.cantidad;

    const { data: targetProd } = await sb
      .from('productos')
      .select('stock_actual')
      .eq('id', targetProdId)
      .maybeSingle();

    const currentBaseStock = Number(targetProd?.stock_actual ?? 0);
    await actualizarProducto(targetProdId, {
      stock_actual: currentBaseStock + addQty,
    });

    // Actualizar precios de la presentación o producto comprado
    await actualizarProducto(linea.producto_id, {
      precio_costo: linea.precio_costo,
      precio_venta: linea.precio_venta,
      ...(linea.precio_mayorista !== undefined ? { precio_mayorista: linea.precio_mayorista } : {}),
    });
  }

  const metodo = mapMetodoPago(input.metodo_pago);
  if (metodo === 'credito' && compra.proveedor_id) {
    try {
      await crearCxpDesdeCompra({
        compra_id: compra.id,
        proveedor_id: compra.proveedor_id,
        monto_total: Number(compra.monto_total),
      });
    } catch {
      // No bloquear la compra si CxP falla
    }
  }

  return {
    id: compra.id,
    codigo: compra.codigo,
    proveedor: input.proveedor_nombre ?? 'Sin proveedor',
    proveedor_id: compra.proveedor_id,
    fecha: String(compra.creado_en).slice(0, 10),
    items: input.lineas.reduce((s, l) => s + l.cantidad, 0),
    subtotal: Number(compra.subtotal),
    impuesto: Number(compra.monto_impuesto),
    total: Number(compra.monto_total),
    estado: compra.estado,
    metodo_pago: compra.metodo_pago,
  };
}

export type CompraDetalle = CompraLista & {
  notas: string | null;
  lineas: {
    id: string;
    nombre: string;
    cantidad: number;
    precio_costo: number;
    precio_venta: number;
    subtotal: number;
  }[];
};

export async function obtenerDetalleCompra(id: string): Promise<CompraDetalle | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('compras')
    .select(
      `
      id, codigo, proveedor_id, subtotal, monto_impuesto, monto_total,
      metodo_pago, estado, notas, creado_en,
      proveedores ( nombre ),
      detalle_compras ( id, nombre_item, cantidad, precio_costo, precio_venta, subtotal )
    `
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const proveedor = data.proveedores as { nombre?: string } | null;
  const detalle = (data.detalle_compras as Record<string, unknown>[] | null) ?? [];

  return {
    id: String(data.id),
    codigo: String(data.codigo),
    proveedor: proveedor?.nombre ?? 'Sin proveedor',
    proveedor_id: data.proveedor_id ? String(data.proveedor_id) : null,
    fecha: String(data.creado_en).slice(0, 10),
    items: detalle.reduce((s, d) => s + Number(d.cantidad ?? 0), 0),
    subtotal: Number(data.subtotal ?? 0),
    impuesto: Number(data.monto_impuesto ?? 0),
    total: Number(data.monto_total ?? 0),
    estado: data.estado as CompraLista['estado'],
    metodo_pago: String(data.metodo_pago ?? ''),
    notas: data.notas ? String(data.notas) : null,
    lineas: detalle.map((d) => ({
      id: String(d.id),
      nombre: String(d.nombre_item ?? ''),
      cantidad: Number(d.cantidad ?? 0),
      precio_costo: Number(d.precio_costo ?? 0),
      precio_venta: Number(d.precio_venta ?? 0),
      subtotal: Number(d.subtotal ?? 0),
    })),
  };
}

export async function anularCompra(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  const sb = getSupabase();
  const { error } = await sb.from('compras').update({ estado: 'anulada' }).eq('id', id);
  if (error) throw error;
}
