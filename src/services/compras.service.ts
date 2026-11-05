import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { actualizarProducto } from './productos.service';
import { crearCxpDesdeCompra } from './cxp.service';
import { movimientoInventarioPresentacion } from './presentaciones.service';
import { updateProductPurchaseDataInStore } from '@/lib/productStore';

export function isUuid(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());
}

const LOCAL_COMPRAS_KEY = 'mercato_compras_local';
const LOCAL_DETALLES_KEY = 'mercato_detalle_compras_local';

interface CompraLocalItem {
  id: string;
  codigo: string;
  proveedor: string;
  proveedor_id: string | null;
  fecha: string;
  items: number;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: CompraLista['estado'];
  metodo_pago: string;
  notas?: string | null;
  creado_en?: string;
  lineas?: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    precio_costo: number;
    precio_venta: number;
    subtotal: number;
    producto_id?: string | null;
  }>;
}

function getLocalCompras(): CompraLocalItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMPRAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCompras(list: CompraLocalItem[]): void {
  try {
    localStorage.setItem(LOCAL_COMPRAS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error saving local compras to localStorage', err);
  }
}

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
  const localList = getLocalCompras();
  const localMap = new Map<string, CompraLista>();
  localList.forEach((lc) => {
    localMap.set(lc.id, {
      id: lc.id,
      codigo: lc.codigo,
      proveedor: lc.proveedor,
      proveedor_id: lc.proveedor_id,
      fecha: lc.fecha,
      items: lc.items,
      subtotal: lc.subtotal,
      impuesto: lc.impuesto,
      total: lc.total,
      estado: lc.estado,
      metodo_pago: lc.metodo_pago,
    });
  });

  const sb = tryGetSupabase();
  if (!sb) {
    return Array.from(localMap.values()).sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  try {
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

    if (error) {
      console.warn('Error fetching compras from Supabase, using local:', error);
      return Array.from(localMap.values());
    }

    const remoteRows: CompraLista[] = (data ?? []).map((row: Record<string, unknown>) => {
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

    // Fusionar: compras remotas + compras locales que aún no estén en remoto
    const seenIds = new Set(remoteRows.map((r) => r.id));
    const merged: CompraLista[] = [...remoteRows];
    for (const [id, localItem] of localMap.entries()) {
      if (!seenIds.has(id)) {
        merged.push(localItem);
      }
    }

    return merged.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  } catch (err) {
    console.warn('Excepción al obtener compras de Supabase:', err);
    return Array.from(localMap.values());
  }
}

export async function crearCompra(input: NuevaCompraInput): Promise<CompraLista> {
  if (!input.lineas || !input.lineas.length) {
    throw new Error('La compra no tiene líneas de productos');
  }

  const subtotal = input.lineas.reduce((s, l) => s + l.cantidad * l.precio_costo, 0);
  const impuesto = input.lineas.reduce(
    (s, l) => s + l.cantidad * l.precio_costo * ((l.porcentaje_impuesto || 0) / 100),
    0
  );
  const total = subtotal + impuesto;
  const codigo =
    input.codigo?.trim() ||
    `FAC-COMP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const rawProvId = typeof input.proveedor_id === 'string' && input.proveedor_id.trim() ? input.proveedor_id.trim() : null;
  const cleanProveedorId: string | null = rawProvId && isUuid(rawProvId) ? rawProvId : null;
  const provNombre =
    input.proveedor_nombre?.trim() ||
    (!cleanProveedorId && rawProvId ? rawProvId : '') ||
    'Sin proveedor';

  // 1. Siempre actualizar inventario y costos localmente en productStore
  for (const linea of input.lineas) {
    const prodKey = linea.producto_id || linea.nombre;
    if (prodKey) {
      updateProductPurchaseDataInStore(
        prodKey,
        linea.cantidad,
        linea.precio_costo,
        linea.precio_venta
      );
    }
  }

  // 2. Si Supabase está disponible, intentar guardar remotamente con saneamiento estricto de tipos UUID
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      let resolvedProveedorId: string | null = cleanProveedorId;

      // Si no tenemos UUID de proveedor pero sí el nombre, buscarlo o crearlo en Supabase
      if (!resolvedProveedorId && provNombre && provNombre !== 'Sin proveedor') {
        try {
          const { data: existing } = await sb
            .from('proveedores')
            .select('id')
            .ilike('nombre', provNombre)
            .maybeSingle();
          if (existing?.id && isUuid(existing.id)) {
            resolvedProveedorId = existing.id;
          } else {
            const { data: created, error: provErr } = await sb
              .from('proveedores')
              .insert({
                codigo: `PROV-${Date.now().toString(36).toUpperCase()}`,
                nombre: provNombre,
                activo: true,
              })
              .select('id')
              .single();
            if (!provErr && created?.id && isUuid(created.id)) {
              resolvedProveedorId = created.id;
            }
          }
        } catch (provLookupErr) {
          console.warn('No se pudo asociar proveedor en Supabase, se guardará sin referencia foránea:', provLookupErr);
        }
      }

      // Inserción en compras
      const { data: compra, error } = await sb
        .from('compras')
        .insert({
          codigo,
          proveedor_id: resolvedProveedorId,
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

      // Inserción en detalle_compras saneando producto_id a null si no es UUID válido
      const detalles = input.lineas.map((l) => ({
        compra_id: compra.id,
        producto_id: isUuid(l.producto_id) ? l.producto_id : null,
        nombre_item: l.nombre,
        cantidad: l.cantidad,
        cantidad_recibida: l.cantidad,
        precio_costo: l.precio_costo,
        precio_venta: l.precio_venta,
        porcentaje_impuesto: l.porcentaje_impuesto || 0,
        subtotal: l.cantidad * l.precio_costo,
      }));

      const { error: detErr } = await sb.from('detalle_compras').insert(detalles);
      if (detErr) throw detErr;

      // Actualizar stock y precios en Supabase para aquellos productos con UUID válido
      for (const linea of input.lineas) {
        const prodId = typeof linea.producto_id === 'string' && isUuid(linea.producto_id) ? linea.producto_id : null;
        if (!prodId) continue;
        try {
          const { data: prod } = await sb
            .from('productos')
            .select('stock_actual, producto_base_id, factor_conversion')
            .eq('id', prodId)
            .maybeSingle();

          const movimiento = movimientoInventarioPresentacion(
            {
              id: prodId,
              producto_base_id: (prod as { producto_base_id?: string | null } | null)?.producto_base_id,
              factor_conversion: (prod as { factor_conversion?: number } | null)?.factor_conversion,
            },
            linea.cantidad
          );
          const targetProdId = movimiento.productoId;
          const addQty = movimiento.cantidad;

          if (isUuid(targetProdId)) {
            const { data: targetProd } = await sb
              .from('productos')
              .select('stock_actual')
              .eq('id', targetProdId)
              .maybeSingle();

            const currentBaseStock = Number(targetProd?.stock_actual ?? 0);
            await actualizarProducto(targetProdId, {
              stock_actual: currentBaseStock + addQty,
            });
          }

          await actualizarProducto(prodId, {
            precio_costo: linea.precio_costo,
            precio_venta: linea.precio_venta,
            ...(linea.precio_mayorista !== undefined ? { precio_mayorista: linea.precio_mayorista } : {}),
          });
        } catch (stockErr) {
          console.warn(`No se pudo sincronizar stock en Supabase para producto ${prodId}:`, stockErr);
        }
      }

      // Registro en CxP si el pago es a crédito
      const metodo = mapMetodoPago(input.metodo_pago);
      if (metodo === 'credito' && compra.proveedor_id) {
        try {
          await crearCxpDesdeCompra({
            compra_id: compra.id,
            compra_codigo: compra.codigo,
            proveedor_id: compra.proveedor_id,
            proveedor_nombre: provNombre,
            monto_total: Number(compra.monto_total),
          });
        } catch {
          // No bloquear compra si CxP falla
        }
      }

      return {
        id: compra.id,
        codigo: compra.codigo,
        proveedor: provNombre,
        proveedor_id: compra.proveedor_id,
        fecha: String(compra.creado_en).slice(0, 10),
        items: input.lineas.reduce((s, l) => s + l.cantidad, 0),
        subtotal: Number(compra.subtotal),
        impuesto: Number(compra.monto_impuesto),
        total: Number(compra.monto_total),
        estado: compra.estado,
        metodo_pago: compra.metodo_pago,
      };
    } catch (supabaseError) {
      console.warn('Error al guardar compra en Supabase, realizando respaldo local seguro:', supabaseError);
    }
  }

  // 3. Respaldo Local (Offline / Fallback ante error o no conexión)
  const localId = `compra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const localCompra: CompraLocalItem = {
    id: localId,
    codigo,
    proveedor: provNombre,
    proveedor_id: cleanProveedorId,
    fecha: fechaHoy,
    items: input.lineas.reduce((s, l) => s + l.cantidad, 0),
    subtotal,
    impuesto,
    total,
    estado: input.estado ?? 'recibida',
    metodo_pago: mapMetodoPago(input.metodo_pago),
    notas: input.notas ?? null,
    creado_en: new Date().toISOString(),
    lineas: input.lineas.map((l, idx) => ({
      id: `${localId}-item-${idx + 1}`,
      nombre: l.nombre,
      cantidad: l.cantidad,
      precio_costo: l.precio_costo,
      precio_venta: l.precio_venta,
      subtotal: l.cantidad * l.precio_costo,
      producto_id: l.producto_id,
    })),
  };

  const existingLocal = getLocalCompras();
  saveLocalCompras([localCompra, ...existingLocal]);

  return {
    id: localCompra.id,
    codigo: localCompra.codigo,
    proveedor: localCompra.proveedor,
    proveedor_id: localCompra.proveedor_id,
    fecha: localCompra.fecha,
    items: localCompra.items,
    subtotal: localCompra.subtotal,
    impuesto: localCompra.impuesto,
    total: localCompra.total,
    estado: localCompra.estado,
    metodo_pago: localCompra.metodo_pago,
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
  // 1. Intentar primero en Supabase si es UUID
  const sb = tryGetSupabase();
  if (sb && isUuid(id)) {
    try {
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

      if (!error && data) {
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
    } catch (err) {
      console.warn('Error al buscar detalle en Supabase, verificando respaldo local:', err);
    }
  }

  // 2. Buscar en almacenamiento local
  const localList = getLocalCompras();
  const found = localList.find((c) => c.id === id || c.codigo === id);
  if (found) {
    return {
      id: found.id,
      codigo: found.codigo,
      proveedor: found.proveedor,
      proveedor_id: found.proveedor_id,
      fecha: found.fecha,
      items: found.items,
      subtotal: found.subtotal,
      impuesto: found.impuesto,
      total: found.total,
      estado: found.estado,
      metodo_pago: found.metodo_pago,
      notas: found.notas ?? null,
      lineas: (found.lineas || []).map((l) => ({
        id: l.id,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_costo: l.precio_costo,
        precio_venta: l.precio_venta,
        subtotal: l.subtotal,
      })),
    };
  }

  return null;
}

export async function anularCompra(id: string): Promise<void> {
  let updatedInSupabase = false;
  if (isSupabaseConfigured() && isUuid(id)) {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('compras').update({ estado: 'anulada' }).eq('id', id);
      if (!error) updatedInSupabase = true;
    } catch {
      // Ignorar para permitir anulación local
    }
  }

  // Anular también localmente si existe
  const localList = getLocalCompras();
  const updatedLocal = localList.map((c) =>
    c.id === id || c.codigo === id ? { ...c, estado: 'anulada' as const } : c
  );
  saveLocalCompras(updatedLocal);

  if (!updatedInSupabase && !localList.some((c) => c.id === id || c.codigo === id)) {
    // Si no existió en local y falló Supabase, lanzar error
    if (!isSupabaseConfigured()) {
      throw new Error('Compra no encontrada');
    }
  }
}
