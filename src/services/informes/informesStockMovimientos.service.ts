import { tryGetSupabase } from '../clienteSupabase';
import { getStoredProducts } from '@/lib/productStore';
import { initialProducts } from '@/lib/initialProducts';
import { getStoredAdjustments } from '@/lib/stockAdjustmentStore';
import { obtenerProductos } from '../productos.service';
import { getLocalMovimientosInventario } from '../movimientosInventarioCentral.service';

export interface MovimientoStockItem {
  id: string;
  producto_id?: string;
  producto_sku?: string;
  producto_nombre?: string;
  tipo:
    | 'Ventas'
    | 'Compras'
    | 'Ajuste de Stock'
    | 'Devolución de Venta'
    | 'Devolución de Compra'
    | 'Transferencia'
    | 'Anulación'
    | 'Edición de factura';
  cambio_cantidad: number; // Negativo para salidas, positivo para entradas
  nueva_cantidad: number;  // Saldo / existencia tras este movimiento (stock resultante)
  cantidad_entrada: number;
  cantidad_salida: number;
  stock_anterior: number;
  stock_resultante: number;
  fecha: string;           // ISO
  fecha_formateada: string; // DD-MM-YYYY hh:mm A
  numero_referencia: string; // NCF, FAC-..., VEN-..., COM-..., AJU-...
  cliente_proveedor_info: string; // Nombre del cliente, proveedor o responsable
  notas?: string | null;
}

export interface StockGeneralItem {
  id: string;
  sku: string;
  codigo_barras: string;
  nombre: string;
  unidad: string;
  categoria: string;
  ubicacion: string;
  precio_venta: number;
  precio_costo: number;
  stock_actual: number;
  stock_minimo: number;
  valor_compra: number;
  valor_venta: number;
  estado: 'Agotado' | 'Bajo' | 'OK';
  es_pesado: boolean;
  producto_base_id: string | null;
  factor_conversion: number;
  // Resumen y detalle de movimientos del producto
  stock_apertura: number;
  total_comprado: number;
  total_vendido: number;
  total_devuelto: number;
  total_ajustado_entrada: number;
  total_ajustado_salida: number;
  total_entradas: number;
  total_salidas: number;
  cantidad_movimientos: number;
  movimientos: MovimientoStockItem[];
}

export interface ResumenStockGeneral {
  stock_cierre_compra: number;
  stock_cierre_venta: number;
  beneficio_potencial: number;
  profit_margin_pct: number;
  total_productos: number;
  total_agotados: number;
  total_bajos: number;
  total_movimientos_global: number;
  items: StockGeneralItem[];
}

export interface ResumenKardexProducto {
  cantidades_en: {
    compra_total: number;
    stock_apertura: number;
    total_devolucion_venta: number;
    transferencias_en: number;
  };
  cantidades_fuera: {
    total_vendido: number;
    ajuste_total: number;
    total_devolucion_compra: number;
    transferencias_afuera: number;
  };
  totales: {
    stock_actual: number;
  };
}

export interface HistorialMovimientosProductoResult {
  producto: StockGeneralItem;
  resumen: ResumenKardexProducto;
  movimientos: MovimientoStockItem[];
}

export function formatFechaKardex(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${day}-${month}-${year} ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return String(isoString);
  }
}

<<<<<<< HEAD
function mapProductoToStockItem(p: Producto): StockGeneralItem {
  const stock = Number(p.stock_actual ?? 0);
  const min = Number(p.stock_minimo ?? 0);
  const costo = Number(p.precio_costo ?? 0);
  const venta = Number(p.precio_venta ?? 0);

  const valor_compra = Math.round(stock * costo * 100) / 100;
  const valor_venta = Math.round(stock * venta * 100) / 100;

  let estado: 'Agotado' | 'Bajo' | 'OK' = 'OK';
  if (stock <= 0) {
    estado = 'Agotado';
  } else if (stock <= min) {
    estado = 'Bajo';
  }

  return {
    id: p.id,
    sku: p.sku || '—',
    codigo_barras: p.codigo_barras || '',
    nombre: p.nombre,
    unidad: p.unidad || 'Unidad',
    categoria: p.categoria || 'Sin categoría',
    ubicacion: 'SUPERMERCADO REMANENTE',
    precio_venta: venta,
    precio_costo: costo,
    stock_actual: stock,
    stock_minimo: min,
    valor_compra,
    valor_venta,
    estado,
    es_pesado: Boolean(p.es_pesado),
    producto_base_id: (p as any).producto_base_id ?? null,
    factor_conversion: Number((p as any).factor_conversion ?? 1),
  };
}

/**
 * Obtiene el informe general de stock con valoraciones por costo y por venta,
 * beneficio potencial y margen de beneficio global.
 */
export async function obtenerInformeStockGeneral(): Promise<ResumenStockGeneral> {
  const sb = tryGetSupabase();
  let rawProds: Producto[] = [];
=======
interface RawMovEntry {
  tipo: MovimientoStockItem['tipo'];
  cantidad: number; // + entrada, - salida
  fecha: string;
  referencia: string;
  entidad: string;
  notas?: string | null;
}
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

function normalizeRef(ref?: string | null): string {
  return String(ref || '')
    .trim()
    .toUpperCase()
    .replace(/^(?:FAC|VEN|VNT|VTA|FACT|FACTURA|INV|DOC)[-_:\s]*/i, '');
}

function normalizeKey(str?: string | null): string {
  return String(str || '').trim().toLowerCase();
}

/**
 * Construye un índice de búsqueda rápida para vincular cualquier movimiento
 * (por UUID, ID local/demo, SKU, código de barras o nombre de ítem) a su producto.
 */
function buildProductMatcher(items: StockGeneralItem[]) {
  const byId = new Map<string, StockGeneralItem>();
  const bySku = new Map<string, StockGeneralItem>();
  const byBarcode = new Map<string, StockGeneralItem>();
  const byName = new Map<string, StockGeneralItem>();

  for (const item of items) {
    if (item.id) byId.set(normalizeKey(item.id), item);
    if (item.sku && item.sku !== '—') bySku.set(normalizeKey(item.sku), item);
    if (item.codigo_barras) byBarcode.set(normalizeKey(item.codigo_barras), item);
    if (item.nombre) byName.set(normalizeKey(item.nombre), item);
  }

  // Vincular también IDs de initialProducts y getStoredProducts() por SKU / código de barras / nombre
  for (const dp of initialProducts) {
    const match =
      byId.get(normalizeKey(dp.id)) ||
      (dp.sku ? bySku.get(normalizeKey(dp.sku)) : undefined) ||
      (dp.barcode ? byBarcode.get(normalizeKey(dp.barcode)) : undefined) ||
      byName.get(normalizeKey(dp.name));
    if (match) {
      byId.set(normalizeKey(dp.id), match);
      if (dp.sku) bySku.set(normalizeKey(dp.sku), match);
      if (dp.barcode) byBarcode.set(normalizeKey(dp.barcode), match);
    }
  }

  try {
    for (const sp of getStoredProducts()) {
      const match =
        byId.get(normalizeKey(sp.id)) ||
        (sp.sku ? bySku.get(normalizeKey(sp.sku)) : undefined) ||
        (sp.barcode ? byBarcode.get(normalizeKey(sp.barcode)) : undefined) ||
        byName.get(normalizeKey(sp.name));
      if (match) {
        byId.set(normalizeKey(sp.id), match);
        if (sp.sku) bySku.set(normalizeKey(sp.sku), match);
        if (sp.barcode) byBarcode.set(normalizeKey(sp.barcode), match);
      }
    }
  } catch {
    // ignore
  }

  return (opts: { id?: string | null; sku?: string | null; name?: string | null }): StockGeneralItem | undefined => {
    const idK = normalizeKey(opts.id);
    if (idK) {
      const found = byId.get(idK) || bySku.get(idK) || byBarcode.get(idK);
      if (found) return found;
    }
    const skuK = normalizeKey(opts.sku);
    if (skuK) {
      const found = bySku.get(skuK) || byBarcode.get(skuK) || byId.get(skuK);
      if (found) return found;
    }
    const nameK = normalizeKey(opts.name);
    if (nameK) {
      const found = byName.get(nameK);
      if (found) return found;
    }
    return undefined;
  };
}

/**
 * Carga en lote todos los movimientos de inventario (Ventas, Compras, Ajustes,
 * Devoluciones, Anulaciones, Ediciones) desde Supabase y almacenamiento local,
 * asociándolos a cada producto del catálogo.
 */
async function poblarMovimientosDeProductos(items: StockGeneralItem[]): Promise<number> {
  const matchProduct = buildProductMatcher(items);
  const rawByProduct = new Map<string, RawMovEntry[]>();
  const seenKeysByProduct = new Map<string, Set<string>>();

  for (const item of items) {
    rawByProduct.set(item.id, []);
    seenKeysByProduct.set(item.id, new Set());
  }

  const addMovement = (prod: StockGeneralItem | undefined, entry: RawMovEntry, dedupType?: string) => {
    if (!prod || !entry.cantidad || Math.abs(entry.cantidad) < 0.0001) return;
    const seen = seenKeysByProduct.get(prod.id)!;
    const normRef = normalizeRef(entry.referencia);
    const key = `${dedupType || entry.tipo}::${normRef}::${Math.round(entry.cantidad * 100)}`;
    if (normRef && normRef !== 'SIN-REF' && seen.has(key)) {
      return;
    }
    if (normRef && normRef !== 'SIN-REF') {
      seen.add(key);
    }
    rawByProduct.get(prod.id)!.push(entry);
  };

  const sb = tryGetSupabase();

  // Ejecutar consultas a Supabase en paralelo
  const [salesRows, purchaseRows, adjRows, devRows, centralDbRows] = await Promise.all([
    // 1. Ventas desde Supabase (sin pedir cliente_nombre directamente en ventas, que no existe en el esquema SQL)
    (async () => {
      if (!sb) return [];
      try {
        const { data, error } = await sb
          .from('detalle_ventas')
          .select(`
            id, venta_id, producto_id, nombre_item, cantidad,
            ventas (
              id, numero_factura, ncf, estado, creado_en,
              clientes ( nombre )
            )
          `)
          .order('id', { ascending: false })
          .limit(3000);
        if (!error && data) return data as any[];

        const fallback = await sb
          .from('detalle_ventas')
          .select(`
            id, venta_id, producto_id, nombre_item, cantidad,
            ventas (
              id, numero_factura, ncf, estado, creado_en
            )
          `)
          .order('id', { ascending: false })
          .limit(3000);
        return (fallback.data as any[]) || [];
      } catch {
        return [];
      }
    })(),

    // 2. Compras desde Supabase
    (async () => {
      if (!sb) return [];
      try {
        const { data, error } = await sb
          .from('detalle_compras')
          .select(`
            id, compra_id, producto_id, nombre_item, cantidad,
            compras (
              id, codigo, estado, creado_en,
              proveedores ( nombre )
            )
          `)
          .order('id', { ascending: false })
          .limit(2000);
        if (!error && data) return data as any[];

        const fallback = await sb
          .from('detalle_compras')
          .select(`
            id, compra_id, producto_id, nombre_item, cantidad,
            compras (
              id, codigo, estado, creado_en
            )
          `)
          .order('id', { ascending: false })
          .limit(2000);
        return (fallback.data as any[]) || [];
      } catch {
        return [];
      }
    })(),

    // 3. Ajustes de stock desde Supabase
    (async () => {
      if (!sb) return [];
      try {
        const { data } = await sb
          .from('ajustes_stock')
          .select('id, codigo, producto_id, tipo_ajuste, cantidad_anterior, cantidad_nueva, cantidad_variacion, motivo, creado_en')
          .order('creado_en', { ascending: false })
          .limit(2000);
        return (data as any[]) || [];
      } catch {
        return [];
      }
    })(),

    // 4. Devoluciones desde Supabase
    (async () => {
      if (!sb) return [];
      try {
        const { data, error } = await sb
          .from('detalle_devoluciones')
          .select(`
            id, devolucion_id, producto_id, sku, nombre_item, cantidad,
            devoluciones (
              id, codigo, numero_factura, estado, motivo, creado_en,
              clientes ( nombre )
            )
          `)
          .order('id', { ascending: false })
          .limit(1000);
        if (!error && data) return data as any[];

        const fallback = await sb
          .from('detalle_devoluciones')
          .select(`
            id, devolucion_id, producto_id, sku, nombre_item, cantidad,
            devoluciones (
              id, codigo, numero_factura, estado, motivo, creado_en
            )
          `)
          .order('id', { ascending: false })
          .limit(1000);
        return (fallback.data as any[]) || [];
      } catch {
        return [];
      }
    })(),

    // 5. Tabla movimientos_inventario en Supabase (si existe)
    (async () => {
      if (!sb) return [];
      try {
        const { data } = await sb
          .from('movimientos_inventario')
          .select('*')
          .order('creado_en', { ascending: false })
          .limit(3000);
        return (data as any[]) || [];
      } catch {
        return [];
      }
    })(),
  ]);

  // A. Procesar Ventas de Supabase
  let metaMap: Record<string, any> = {};
  try {
    const rawMeta = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_ventas_meta_map') : null;
    if (rawMeta) metaMap = JSON.parse(rawMeta) || {};
  } catch {
    metaMap = {};
  }

  for (const row of salesRows) {
    const venta = Array.isArray(row.ventas) ? row.ventas[0] : row.ventas;
    const cant = Number(row.cantidad || 0);
    if (cant <= 0) continue;
    const prod = matchProduct({ id: row.producto_id, name: row.nombre_item });
    if (!prod) continue;

    const ventaId = String(venta?.id || row.venta_id || '');
    const meta = metaMap[ventaId];
    const clienteJoined = Array.isArray(venta?.clientes) ? venta.clientes[0]?.nombre : venta?.clientes?.nombre;
    const clienteNombre = clienteJoined || meta?.cliente_nombre || 'Cliente Contado';
    const ref = venta?.ncf || venta?.numero_factura || meta?.ncf || meta?.numero_factura || 'FAC-POS';
    const fecha = venta?.creado_en || new Date().toISOString();

    addMovement(
      prod,
      {
        tipo: 'Ventas',
        cantidad: -cant,
        fecha,
        referencia: ref,
        entidad: clienteNombre,
      },
      'VENTA'
    );

    if (venta?.estado === 'anulada') {
      addMovement(
        prod,
        {
          tipo: 'Anulación',
          cantidad: cant,
          fecha,
          referencia: ref,
          entidad: `Factura anulada (${clienteNombre})`,
          notas: 'Restauración por anulación de factura',
        },
        'ANULACION'
      );
    }
  }

  // B. Procesar Ventas Locales (mercato_ventas_local, mercato_ventas_meta_map y mercato_detalle_ventas_local)
  try {
    const rawLocalVentas = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_ventas_local') : null;
    const rawLocalItems = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_detalle_ventas_local') : null;
    const localVentasList: any[] = rawLocalVentas ? JSON.parse(rawLocalVentas) : [];
    const ventasById = new Map<string, any>();

    for (const v of localVentasList) {
      if (!v?.id) continue;
      ventasById.set(String(v.id), v);
      const meta = metaMap[String(v.id)];
      const itemsList: any[] =
        Array.isArray(v.detalle_ventas) && v.detalle_ventas.length > 0
          ? v.detalle_ventas
          : Array.isArray(meta?.detalle_ventas)
            ? meta.detalle_ventas
            : [];

      const ref = v.ncf || v.numero_factura || meta?.ncf || meta?.numero_factura || 'FAC-LOCAL';
      const clienteNombre = v.cliente_nombre || meta?.cliente_nombre || 'Cliente Contado';
      const fecha = v.creado_en || new Date().toISOString();

      for (const it of itemsList) {
        const cant = Number(it.cantidad || 0);
        if (cant <= 0) continue;
        const prod = matchProduct({ id: it.producto_id, sku: it.sku, name: it.nombre_item });
        addMovement(
          prod,
          {
            tipo: 'Ventas',
            cantidad: -cant,
            fecha,
            referencia: ref,
            entidad: clienteNombre,
          },
          'VENTA'
        );

        if (v.estado === 'anulada') {
          addMovement(
            prod,
            {
              tipo: 'Anulación',
              cantidad: cant,
              fecha,
              referencia: ref,
              entidad: `Factura anulada (${clienteNombre})`,
              notas: 'Restauración por anulación de factura',
            },
            'ANULACION'
          );
        }
      }
    }

    if (rawLocalItems) {
      const looseItems: any[] = JSON.parse(rawLocalItems);
      for (const it of looseItems) {
        const cant = Number(it.cantidad || 0);
        if (cant <= 0) continue;
        const v = ventasById.get(String(it.venta_id));
        const meta = metaMap[String(it.venta_id)];
        const ref = v?.ncf || v?.numero_factura || meta?.ncf || meta?.numero_factura || 'FAC-LOCAL';
        const clienteNombre = v?.cliente_nombre || meta?.cliente_nombre || 'Cliente Contado';
        const fecha = v?.creado_en || new Date().toISOString();
        const prod = matchProduct({ id: it.producto_id, sku: it.sku, name: it.nombre_item });
        addMovement(
          prod,
          {
            tipo: 'Ventas',
            cantidad: -cant,
            fecha,
            referencia: ref,
            entidad: clienteNombre,
          },
          'VENTA'
        );
      }
    }
  } catch (e) {
    console.warn('Error al consolidar ventas locales en informe de stock:', e);
  }

  // C. Procesar Compras de Supabase
  for (const row of purchaseRows) {
    const c = Array.isArray(row.compras) ? row.compras[0] : row.compras;
    if (c?.estado === 'anulada') continue;
    const cant = Number(row.cantidad || 0);
    if (cant <= 0) continue;
    const prod = matchProduct({ id: row.producto_id, name: row.nombre_item });
    if (!prod) continue;

    const provJoined = Array.isArray(c?.proveedores) ? c.proveedores[0]?.nombre : c?.proveedores?.nombre;
    const provName = provJoined || 'Proveedor Registrado';
    const ref = c?.codigo || 'COM-REC';
    const fecha = c?.creado_en || new Date().toISOString();

    addMovement(
      prod,
      {
        tipo: 'Compras',
        cantidad: cant,
        fecha,
        referencia: ref,
        entidad: provName,
      },
      'COMPRA'
    );
  }

  // D. Procesar Compras Locales (mercato_compras_local)
  try {
    const rawLocalCompras = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_compras_local') : null;
    if (rawLocalCompras) {
      const localCompras: any[] = JSON.parse(rawLocalCompras);
      for (const c of localCompras) {
        if (c?.estado === 'anulada') continue;
        const ref = c.codigo || 'COM-LOCAL';
        const provName = c.proveedor || 'Proveedor Registrado';
        const fecha = c.creado_en || (c.fecha ? `${c.fecha}T12:00:00.000Z` : new Date().toISOString());
        for (const l of c.lineas || []) {
          const cant = Number(l.cantidad || 0);
          if (cant <= 0) continue;
          const prod = matchProduct({ id: l.producto_id, name: l.nombre });
          addMovement(
            prod,
            {
              tipo: 'Compras',
              cantidad: cant,
              fecha,
              referencia: ref,
              entidad: provName,
            },
            'COMPRA'
          );
        }
      }
    }
  } catch (e) {
    console.warn('Error al consolidar compras locales en informe de stock:', e);
  }

  // E. Procesar Ajustes de Stock de Supabase
  for (const a of adjRows) {
    const prod = matchProduct({ id: a.producto_id });
    if (!prod) continue;
    const isEntrada = a.tipo_ajuste === 'entrada';
    const diff = Math.abs(
      Number(a.cantidad_variacion ?? (Number(a.cantidad_nueva || 0) - Number(a.cantidad_anterior || 0)))
    );
    if (diff <= 0) continue;
    addMovement(
      prod,
      {
        tipo: 'Ajuste de Stock',
        cantidad: isEntrada ? diff : -diff,
        fecha: a.creado_en || new Date().toISOString(),
        referencia: a.codigo || 'AJU-STK',
        entidad: a.motivo || 'Ajuste manual de inventario',
        notas: a.motivo,
      },
      'AJUSTE'
    );
  }

  // F. Procesar Ajustes de Stock Locales (mercato_stock_adjustments)
  try {
    const localAdjs = getStoredAdjustments();
    for (const a of localAdjs) {
      const prod = matchProduct({ id: a.productId, sku: a.sku, name: a.productName });
      if (!prod) continue;
      const isEntrada = a.type === 'entrada';
      const diff = Math.abs(Number(a.qty || (a.newQty - a.previousQty) || 0));
      if (diff <= 0) continue;
      const fechaIso = a.date ? `${a.date}T${a.time && a.time.length === 5 ? `${a.time}:00` : '12:00:00'}` : new Date().toISOString();
      addMovement(
        prod,
        {
          tipo: 'Ajuste de Stock',
          cantidad: isEntrada ? diff : -diff,
          fecha: fechaIso,
          referencia: a.code || 'AJU-LOCAL',
          entidad: a.reason || a.responsible || 'Ajuste de inventario',
          notas: a.reason,
        },
        'AJUSTE'
      );
    }
  } catch (e) {
    console.warn('Error al consolidar ajustes locales:', e);
  }

  // G. Procesar Devoluciones de Supabase
  for (const row of devRows) {
    const dev = Array.isArray(row.devoluciones) ? row.devoluciones[0] : row.devoluciones;
    if (dev?.estado === 'rechazada') continue;
    const cant = Number(row.cantidad || 0);
    if (cant <= 0) continue;
    const prod = matchProduct({ id: row.producto_id, sku: row.sku, name: row.nombre_item });
    if (!prod) continue;
    const cliJoined = Array.isArray(dev?.clientes) ? dev.clientes[0]?.nombre : dev?.clientes?.nombre;
    const cliName = cliJoined || 'Cliente Devolución';
    addMovement(
      prod,
      {
        tipo: 'Devolución de Venta',
        cantidad: cant,
        fecha: dev?.creado_en || new Date().toISOString(),
        referencia: dev?.numero_factura || dev?.codigo || 'DEV-FAC',
        entidad: cliName,
        notas: dev?.motivo,
      },
      'DEVOLUCION'
    );
  }

  // H. Procesar Devoluciones Locales (mercato_devoluciones_local)
  try {
    const rawLocalDevs = typeof localStorage !== 'undefined' ? localStorage.getItem('mercato_devoluciones_local') : null;
    if (rawLocalDevs) {
      const localDevs: any[] = JSON.parse(rawLocalDevs);
      for (const dev of localDevs) {
        if (dev?.estado === 'rechazada') continue;
        const ref = dev.numero_factura || dev.codigo || 'DEV-LOCAL';
        const cliName = dev.cliente_nombre || 'Cliente Devolución';
        const fecha = dev.creado_en || new Date().toISOString();
        for (const it of dev.items || []) {
          const cant = Number(it.cantidad || 0);
          if (cant <= 0) continue;
          const prod = matchProduct({ id: it.producto_id, sku: it.sku, name: it.nombre_item });
          addMovement(
            prod,
            {
              tipo: 'Devolución de Venta',
              cantidad: cant,
              fecha,
              referencia: ref,
              entidad: cliName,
              notas: dev.motivo,
            },
            'DEVOLUCION'
          );
        }
      }
    }
  } catch (e) {
    console.warn('Error al consolidar devoluciones locales:', e);
  }

  // I. Procesar Movimientos Centralizados (Local y Supabase)
  const mapCentralType = (rawTipo: string): { tipo: MovimientoStockItem['tipo']; dedup: string } => {
    if (rawTipo === 'Venta' || rawTipo === 'Ventas') return { tipo: 'Ventas', dedup: 'VENTA' };
    if (rawTipo === 'Compra' || rawTipo === 'Compras') return { tipo: 'Compras', dedup: 'COMPRA' };
    if (rawTipo === 'Ajuste de inventario' || rawTipo === 'Ajuste de Stock') return { tipo: 'Ajuste de Stock', dedup: 'AJUSTE' };
    if (rawTipo === 'Devolución' || rawTipo === 'Devolución de Venta') return { tipo: 'Devolución de Venta', dedup: 'DEVOLUCION' };
    if (rawTipo === 'Anulación') return { tipo: 'Anulación', dedup: 'ANULACION' };
    if (rawTipo === 'Edición de factura') return { tipo: 'Edición de factura', dedup: 'EDICION' };
    return { tipo: 'Transferencia', dedup: 'TRANSFERENCIA' };
  };

  try {
    const localCentral = getLocalMovimientosInventario();
    for (const cm of localCentral) {
      const prod = matchProduct({ id: cm.producto_id, name: cm.producto_nombre });
      if (!prod) continue;
      const { tipo, dedup } = mapCentralType(cm.tipo);
      const netAmount = Number(cm.cantidad_entrada || 0) > 0 ? Number(cm.cantidad_entrada) : -Number(cm.cantidad_salida || 0);
      addMovement(
        prod,
        {
          tipo,
          cantidad: netAmount,
          fecha: cm.fecha,
          referencia: cm.documento_referencia || 'SIN-REF',
          entidad: cm.motivo || cm.usuario || 'Sistema',
          notas: cm.motivo,
        },
        dedup
      );
    }
  } catch {
    // ignore
  }

  for (const dbm of centralDbRows) {
    const prod = matchProduct({ id: dbm.producto_id, name: dbm.producto_nombre });
    if (!prod) continue;
    const { tipo, dedup } = mapCentralType(String(dbm.tipo_movimiento || 'Venta'));
    const netAmount = Number(dbm.cantidad_entrada || 0) > 0 ? Number(dbm.cantidad_entrada) : -Number(dbm.cantidad_salida || 0);
    addMovement(
      prod,
      {
        tipo,
        cantidad: netAmount,
        fecha: dbm.creado_en || new Date().toISOString(),
        referencia: dbm.documento_referencia || 'SIN-REF',
        entidad: dbm.motivo || dbm.usuario || 'Sistema',
        notas: dbm.motivo,
      },
      dedup
    );
  }

  // J. Calcular saldos continuos y métricas para cada producto
  let totalMovimientosGlobal = 0;

  for (const prod of items) {
    const rawMovs = rawByProduct.get(prod.id) || [];

    // Ordenar del más antiguo al más reciente
    rawMovs.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Trabajar desde el stock actual hacia atrás para exactitud matemática
    let running = prod.stock_actual;
    const withBalances: MovimientoStockItem[] = [];

    for (let i = rawMovs.length - 1; i >= 0; i--) {
      const m = rawMovs[i];
      const isEntrada = m.cantidad > 0;
      const stockResultante = Math.round(running * 100) / 100;
      const stockAnterior = Math.round((running - m.cantidad) * 100) / 100;

      withBalances.unshift({
        id: `mov-${prod.id}-${i}`,
        producto_id: prod.id,
        producto_sku: prod.sku,
        producto_nombre: prod.nombre,
        tipo: m.tipo,
        cambio_cantidad: Math.round(m.cantidad * 100) / 100,
        nueva_cantidad: stockResultante,
        cantidad_entrada: isEntrada ? Math.round(Math.abs(m.cantidad) * 100) / 100 : 0,
        cantidad_salida: isEntrada ? 0 : Math.round(Math.abs(m.cantidad) * 100) / 100,
        stock_anterior: Math.max(0, stockAnterior),
        stock_resultante: Math.max(0, stockResultante),
        fecha: m.fecha,
        fecha_formateada: formatFechaKardex(m.fecha),
        numero_referencia: m.referencia,
        cliente_proveedor_info: m.entidad,
        notas: m.notas,
      });

      running = stockAnterior;
    }

    const stockApertura = Math.max(0, Math.round(running * 100) / 100);

    // Si el producto tenía existencia inicial antes de los movimientos (o no tiene transacciones previas pero tiene existencia > 0),
    // agregar el registro de Apertura de Inventario al inicio del Kardex para que cada producto muestre su origen completo.
    if (stockApertura > 0) {
      const oldestDate =
        withBalances.length > 0
          ? new Date(Math.max(0, new Date(withBalances[0].fecha).getTime() - 60_000)).toISOString()
          : new Date(Date.now() - 30 * 86400000).toISOString();

      withBalances.unshift({
        id: `mov-${prod.id}-apertura`,
        producto_id: prod.id,
        producto_sku: prod.sku,
        producto_nombre: prod.nombre,
        tipo: 'Compras',
        cambio_cantidad: stockApertura,
        nueva_cantidad: stockApertura,
        cantidad_entrada: stockApertura,
        cantidad_salida: 0,
        stock_anterior: 0,
        stock_resultante: stockApertura,
        fecha: oldestDate,
        fecha_formateada: formatFechaKardex(oldestDate),
        numero_referencia: 'APERTURA-INV',
        cliente_proveedor_info: 'Inventario Inicial / Apertura de Stock',
        notas: 'Existencia inicial registrada en el catálogo',
      });
    }

    let totalComprado = 0;
    let totalVendido = 0;
    let totalDevuelto = 0;
    let totalAjustadoEntrada = 0;
    let totalAjustadoSalida = 0;

    for (const m of withBalances) {
      if (m.numero_referencia === 'APERTURA-INV') continue;
      if (m.tipo === 'Compras' || m.tipo === 'Anulación') {
        totalComprado += m.cantidad_entrada;
      } else if (m.tipo === 'Devolución de Venta') {
        totalDevuelto += m.cantidad_entrada;
      } else if (m.tipo === 'Ventas') {
        totalVendido += m.cantidad_salida;
      } else if (m.tipo === 'Ajuste de Stock') {
        if (m.cantidad_entrada > 0) totalAjustadoEntrada += m.cantidad_entrada;
        if (m.cantidad_salida > 0) totalAjustadoSalida += m.cantidad_salida;
      } else if (m.tipo === 'Edición de factura') {
        if (m.cantidad_entrada > 0) totalDevuelto += m.cantidad_entrada;
        if (m.cantidad_salida > 0) totalVendido += m.cantidad_salida;
      }
    }

    const totalEntradas = Math.round((stockApertura + totalComprado + totalDevuelto + totalAjustadoEntrada) * 100) / 100;
    const totalSalidas = Math.round((totalVendido + totalAjustadoSalida) * 100) / 100;

    // Mostrar los movimientos más recientes primero
    const sortedMovsDesc = [...withBalances].reverse();

    prod.stock_apertura = stockApertura;
    prod.total_comprado = Math.round(totalComprado * 100) / 100;
    prod.total_vendido = Math.round(totalVendido * 100) / 100;
    prod.total_devuelto = Math.round(totalDevuelto * 100) / 100;
    prod.total_ajustado_entrada = Math.round(totalAjustadoEntrada * 100) / 100;
    prod.total_ajustado_salida = Math.round(totalAjustadoSalida * 100) / 100;
    prod.total_entradas = totalEntradas;
    prod.total_salidas = totalSalidas;
    prod.cantidad_movimientos = sortedMovsDesc.length;
    prod.movimientos = sortedMovsDesc;

    totalMovimientosGlobal += sortedMovsDesc.length;
  }

  return totalMovimientosGlobal;
}

/**
 * Obtiene el informe general de stock con TODOS los productos del catálogo,
 * valoraciones por costo y por venta, y el historial de movimientos de cada uno.
 */
export async function obtenerInformeStockGeneral(): Promise<ResumenStockGeneral> {
  // Obtener el catálogo completo (paginando todos los lotes de Supabase + productos locales + catálogo base)
  const resultado = await obtenerProductos({ pagina: 1, limite: 10000, estado: 'todos' });
  const allProducts = [...(resultado.datos || [])].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
  );

  let stock_cierre_compra = 0;
  let stock_cierre_venta = 0;
  let total_agotados = 0;
  let total_bajos = 0;

<<<<<<< HEAD
  const items: StockGeneralItem[] = converted.map((p) => {
    const item = mapProductoToStockItem(p);
    stock_cierre_compra += item.valor_compra;
    stock_cierre_venta += item.valor_venta;
    if (item.estado === 'Agotado') total_agotados += 1;
    else if (item.estado === 'Bajo') total_bajos += 1;
    return item;
=======
  const items: StockGeneralItem[] = allProducts.map((p) => {
    const stock = Number(p.stock_actual ?? 0);
    const min = Number(p.stock_minimo ?? 0);
    const costo = Number(p.precio_costo ?? 0);
    const venta = Number(p.precio_venta ?? 0);

    const valor_compra = Math.round(stock * costo * 100) / 100;
    const valor_venta = Math.round(stock * venta * 100) / 100;

    stock_cierre_compra += valor_compra;
    stock_cierre_venta += valor_venta;

    let estado: 'Agotado' | 'Bajo' | 'OK' = 'OK';
    if (stock <= 0) {
      estado = 'Agotado';
      total_agotados += 1;
    } else if (stock <= min) {
      estado = 'Bajo';
      total_bajos += 1;
    }

    return {
      id: p.id,
      sku: p.sku || '—',
      codigo_barras: p.codigo_barras || '',
      nombre: p.nombre || 'Sin nombre',
      unidad: p.unidad || 'Unidad',
      categoria: p.categoria || 'General',
      ubicacion: 'SUPERMERCADO REMANENTE',
      precio_venta: venta,
      precio_costo: costo,
      stock_actual: stock,
      stock_minimo: min,
      valor_compra,
      valor_venta,
      estado,
      es_pesado: Boolean(p.es_pesado),
      producto_base_id: (p as any).producto_base_id ?? null,
      factor_conversion: Number((p as any).factor_conversion ?? 1),
      stock_apertura: 0,
      total_comprado: 0,
      total_vendido: 0,
      total_devuelto: 0,
      total_ajustado_entrada: 0,
      total_ajustado_salida: 0,
      total_entradas: 0,
      total_salidas: 0,
      cantidad_movimientos: 0,
      movimientos: [],
    };
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
  });

  const total_movimientos_global = await poblarMovimientosDeProductos(items);

  const beneficio_potencial = Math.round((stock_cierre_venta - stock_cierre_compra) * 100) / 100;
  const profit_margin_pct =
    stock_cierre_venta > 0
      ? Math.round(((stock_cierre_venta - stock_cierre_compra) / stock_cierre_venta) * 10000) / 100
      : 0;

  return {
    stock_cierre_compra: Math.round(stock_cierre_compra * 100) / 100,
    stock_cierre_venta: Math.round(stock_cierre_venta * 100) / 100,
    beneficio_potencial,
    profit_margin_pct,
    total_productos: items.length,
    total_agotados,
    total_bajos,
    total_movimientos_global,
    items,
  };
}

/**
 * Obtiene el historial completo de movimientos (Kardex) para un producto específico.
 */
export async function obtenerHistorialMovimientosProducto(
  productoId: string,
  preloadedProducto?: StockGeneralItem
): Promise<HistorialMovimientosProductoResult> {
<<<<<<< HEAD
  const sb = tryGetSupabase();
  let producto: StockGeneralItem | undefined = preloadedProducto;

  // Evita recargar los 3,000 productos si ya tenemos el ítem o es un producto simple en BD
  if (!producto && sb) {
    try {
      const { data } = await sb
        .from('productos')
        .select('*')
        .eq('id', productoId)
        .maybeSingle();
      const row = data as (Producto & { composite_items?: unknown[] }) | null;
      if (row && !row.producto_base_id && (!Array.isArray(row.composite_items) || row.composite_items.length === 0)) {
        producto = mapProductoToStockItem(row);
      }
    } catch {
      // fallback a obtenerInformeStockGeneral
    }
  }

  if (!producto) {
    const general = await obtenerInformeStockGeneral();
    producto = general.items.find((p) => p.id === productoId);
  }
=======
  const general = await obtenerInformeStockGeneral();
  const producto =
    general.items.find((p) => p.id === productoId) ||
    general.items.find((p) => p.sku.toLowerCase() === productoId.toLowerCase());
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  if (!producto) {
    throw new Error(`Producto con ID ${productoId} no encontrado`);
  }
<<<<<<< HEAD
  const rawMovements: {
    tipo: MovimientoStockItem['tipo'];
    cantidad: number;
    fecha: string;
    referencia: string;
    entidad: string;
    notas?: string | null;
  }[] = [];

  // 1. VENTAS desde Supabase y Local
  if (sb) {
    try {
      const { data: salesData } = await sb
        .from('detalle_ventas')
        .select(`
          id, cantidad,
          ventas (
            id, numero_factura, ncf, cliente_nombre, creado_en
          )
        `)
        .eq('producto_id', productoId)
        .limit(1000);

      for (const row of (salesData as any[]) || []) {
        const venta = row.ventas;
        const cant = Number(row.cantidad || 0);
        if (cant > 0) {
          rawMovements.push({
            tipo: 'Ventas',
            cantidad: -cant, // Salida
            fecha: venta?.creado_en || new Date().toISOString(),
            referencia: venta?.ncf || venta?.numero_factura || 'FAC-POS',
            entidad: venta?.cliente_nombre || 'Cliente Contado',
          });
        }
      }
    } catch (e) {
      console.warn('Error al obtener ventas de producto:', e);
    }
  }

  // Ventas locales (fallback o transacciones offline recientes)
  try {
    const rawLocalVentas = localStorage.getItem('mercato_ventas_local');
    const rawLocalItems = localStorage.getItem('mercato_detalle_ventas_local');
    if (rawLocalVentas && rawLocalItems) {
      const ventasMap = new Map<string, any>();
      for (const v of JSON.parse(rawLocalVentas)) {
        ventasMap.set(v.id, v);
      }
      for (const it of JSON.parse(rawLocalItems)) {
        if (it.producto_id === productoId) {
          const v = ventasMap.get(it.venta_id);
          const cant = Number(it.cantidad || 0);
          const ref = v?.ncf || v?.numero_factura || 'FAC-LOCAL';
          // Evitar duplicar si ya vino de Supabase con el mismo número
          if (!rawMovements.some((m) => m.referencia === ref && m.tipo === 'Ventas')) {
            rawMovements.push({
              tipo: 'Ventas',
              cantidad: -cant,
              fecha: v?.creado_en || new Date().toISOString(),
              referencia: ref,
              entidad: v?.cliente_nombre || 'Cliente Contado',
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error al leer ventas locales:', e);
  }

  // 2. COMPRAS desde Supabase
  if (sb) {
    try {
      const { data: purchaseData } = await sb
        .from('detalle_compras')
        .select(`
          id, cantidad,
          compras (
            id, codigo, creado_en,
            proveedores ( nombre )
          )
        `)
        .eq('producto_id', productoId)
        .limit(1000);

      for (const row of (purchaseData as any[]) || []) {
        const c = row.compras;
        const cant = Number(row.cantidad || 0);
        if (cant > 0) {
          const provName = c?.proveedores?.nombre || 'Proveedor Registrado';
          rawMovements.push({
            tipo: 'Compras',
            cantidad: cant, // Entrada
            fecha: c?.creado_en || new Date().toISOString(),
            referencia: c?.codigo || 'COM-REC',
            entidad: provName,
          });
        }
      }
    } catch (e) {
      console.warn('Error al obtener compras de producto:', e);
    }
  }

  // 3. AJUSTES DE STOCK desde Supabase y Local
  if (sb) {
    try {
      const { data: adjData } = await sb
        .from('ajustes_stock')
        .select('*')
        .eq('producto_id', productoId)
        .limit(500);

      for (const a of (adjData as any[]) || []) {
        const isEntrada = a.tipo_ajuste === 'entrada';
        const diff = Number(a.cantidad_variacion ?? Math.abs((a.cantidad_nueva || 0) - (a.cantidad_anterior || 0)));
        rawMovements.push({
          tipo: 'Ajuste de Stock',
          cantidad: isEntrada ? diff : -diff,
          fecha: a.creado_en || new Date().toISOString(),
          referencia: a.codigo || 'AJU-STK',
          entidad: a.motivo || 'Ajuste manual de inventario',
          notas: a.motivo,
        });
      }
    } catch (e) {
      console.warn('Error al obtener ajustes de stock:', e);
    }
  }

  // 4. DEVOLUCIONES DE VENTA (Reingreso a almacén)
  if (sb) {
    try {
      const { data: devData } = await sb
        .from('detalle_devoluciones')
        .select(`
          id, cantidad,
          devoluciones (
            id, codigo, numero_factura, creado_en, cliente_id,
            clientes ( nombre )
          )
        `)
        .eq('producto_id', productoId)
        .limit(500);

      for (const row of (devData as any[]) || []) {
        const dev = row.devoluciones;
        const cant = Number(row.cantidad || 0);
        if (cant > 0) {
          const cliName = dev?.clientes?.nombre || 'Cliente Devolución';
          rawMovements.push({
            tipo: 'Devolución de Venta',
            cantidad: cant, // Entrada
            fecha: dev?.creado_en || new Date().toISOString(),
            referencia: dev?.numero_factura || dev?.codigo || 'DEV-FAC',
            entidad: cliName,
          });
        }
      }
    } catch (e) {
      console.warn('Error al obtener devoluciones de producto:', e);
    }
  }

  // 5. MOVIMIENTOS CENTRALIZADOS REGISTRADOS (Ventas, Compras, Ajustes, Anulaciones, Edición de Facturas)
  try {
    const centralMovements = obtenerMovimientosProductoCentral(productoId);
    for (const cm of centralMovements) {
      let tipoM: MovimientoStockItem['tipo'] = 'Ventas';
      if (cm.tipo === 'Venta') tipoM = 'Ventas';
      else if (cm.tipo === 'Compra') tipoM = 'Compras';
      else if (cm.tipo === 'Ajuste de inventario') tipoM = 'Ajuste de Stock';
      else if (cm.tipo === 'Devolución') tipoM = 'Devolución de Venta';
      else if (cm.tipo === 'Anulación') tipoM = 'Anulación';
      else if (cm.tipo === 'Edición de factura') tipoM = 'Edición de factura';
      else if (cm.tipo === 'Transferencia') tipoM = 'Transferencia';

      const netAmount = cm.cantidad_entrada > 0 ? cm.cantidad_entrada : -cm.cantidad_salida;
      if (!rawMovements.some((m) => m.referencia === cm.documento_referencia && m.tipo === tipoM)) {
        rawMovements.push({
          tipo: tipoM,
          cantidad: netAmount,
          fecha: cm.fecha,
          referencia: cm.documento_referencia,
          entidad: cm.motivo || cm.usuario || 'Sistema',
          notas: cm.motivo,
        });
      }
    }
  } catch (e) {
    console.warn('Error al leer movimientos centralizados:', e);
  }

  // Si no había ningún movimiento histórico en BD pero el producto tiene stock actual,
  // registrar movimiento inicial de apertura para que el Kardex refleje el origen
  if (rawMovements.length === 0 && producto.stock_actual > 0) {
    rawMovements.push({
      tipo: 'Compras',
      cantidad: producto.stock_actual,
      fecha: new Date(Date.now() - 30 * 86400000).toISOString(),
      referencia: 'APERTURA-INV',
      entidad: 'Inventario Inicial',
      notas: 'Stock de apertura registrado en sistema',
    });
  }

  // Ordenar cronológicamente (del más antiguo al más reciente) para calcular saldos
  rawMovements.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  // Calcular balance continuo anclado al stock actual real trabajando hacia atrás
  // para consistencia matemática absoluta
  let running = producto.stock_actual;
  const withBalances: MovimientoStockItem[] = [];

  for (let i = rawMovements.length - 1; i >= 0; i--) {
    const m = rawMovements[i];
    const isEntrada = m.cantidad > 0;
    const stockResultante = Math.round(running * 100) / 100;
    const stockAnterior = Math.round((running - m.cantidad) * 100) / 100;

    withBalances.unshift({
      id: `mov-${i}-${Date.now()}`,
      tipo: m.tipo,
      cambio_cantidad: m.cantidad,
      nueva_cantidad: stockResultante,
      cantidad_entrada: isEntrada ? Math.abs(m.cantidad) : 0,
      cantidad_salida: isEntrada ? 0 : Math.abs(m.cantidad),
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
      producto_nombre: producto.nombre,
      fecha: m.fecha,
      fecha_formateada: formatFechaKardex(m.fecha),
      numero_referencia: m.referencia,
      cliente_proveedor_info: m.entidad,
      notas: m.notas,
    });
    // Saldo anterior antes de este movimiento
    running = stockAnterior;
  }

  const stock_apertura = Math.max(0, running);

  // Calcular totales de resumen
  let compra_total = 0;
  let total_devolucion_venta = 0;
  let total_vendido = 0;
  let ajuste_total = 0;
  let total_devolucion_compra = 0;

  for (const m of withBalances) {
    if (m.tipo === 'Compras' || m.tipo === 'Anulación') compra_total += Math.abs(m.cantidad_entrada);
    else if (m.tipo === 'Devolución de Venta') total_devolucion_venta += Math.abs(m.cantidad_entrada);
    else if (m.tipo === 'Ventas') total_vendido += Math.abs(m.cantidad_salida);
    else if (m.tipo === 'Ajuste de Stock' && m.cambio_cantidad < 0) ajuste_total += Math.abs(m.cantidad_salida);
    else if (m.tipo === 'Devolución de Compra') total_devolucion_compra += Math.abs(m.cantidad_salida);
    else if (m.tipo === 'Edición de factura') {
      if (m.cantidad_entrada > 0) total_devolucion_venta += m.cantidad_entrada;
      if (m.cantidad_salida > 0) total_vendido += m.cantidad_salida;
    }
  }
=======
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762

  const resumen: ResumenKardexProducto = {
    cantidades_en: {
      compra_total: producto.total_comprado,
      stock_apertura: producto.stock_apertura,
      total_devolucion_venta: producto.total_devuelto,
      transferencias_en: producto.total_ajustado_entrada,
    },
    cantidades_fuera: {
      total_vendido: producto.total_vendido,
      ajuste_total: producto.total_ajustado_salida,
      total_devolucion_compra: 0,
      transferencias_afuera: 0,
    },
    totales: {
      stock_actual: producto.stock_actual,
    },
  };

  return {
    producto,
    resumen,
    movimientos: producto.movimientos,
  };
}

/**
 * Exporta el informe general de stock y todos los movimientos de cada producto a Excel (.xlsx)
 */
export async function exportarStockGeneralAExcel(
  items: StockGeneralItem[],
  filename = 'informe-stock-general.xlsx'
) {
  const XLSX = await import('xlsx');
  const rows = items.map((p) => ({
    SKU: p.sku,
    'Código de Barras': p.codigo_barras,
    Producto: p.nombre,
    Unidad: p.unidad,
    Categoría: p.categoria,
    'Precio Compra (RD$)': p.precio_costo,
    'Precio Venta (RD$)': p.precio_venta,
    'Stock Apertura': p.stock_apertura,
    'Compras (+)': p.total_comprado,
    'Devoluciones (+)': p.total_devuelto,
    'Ventas (-)': p.total_vendido,
    'Ajustes (-)': p.total_ajustado_salida,
    'Stock Actual': p.stock_actual,
    'Valor Stock Compra (RD$)': p.valor_compra,
    'Valor Stock Venta (RD$)': p.valor_venta,
    Estado: p.estado,
    'Total Movimientos': p.cantidad_movimientos,
  }));

  const movRows: Record<string, string | number>[] = [];
  for (const p of items) {
    for (const m of p.movimientos) {
      movRows.push({
        SKU: p.sku,
        Producto: p.nombre,
        'Fecha y Hora': m.fecha_formateada,
        'Tipo de Movimiento': m.tipo,
        'Documento / Referencia': m.numero_referencia,
        'Entrada (+)': m.cantidad_entrada,
        'Salida (-)': m.cantidad_salida,
        'Stock Anterior': m.stock_anterior,
        'Stock Resultante': m.stock_resultante,
        'Cliente / Proveedor / Detalle': m.cliente_proveedor_info,
        Notas: m.notas || '',
      });
    }
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos y Stock');

  if (movRows.length > 0) {
    const movSheet = XLSX.utils.json_to_sheet(movRows);
    XLSX.utils.book_append_sheet(workbook, movSheet, 'Movimientos por Producto');
  }

  XLSX.writeFile(workbook, filename);
}

/**
 * Exporta el historial de movimientos / Kardex de un producto a Excel (.xlsx)
 */
export async function exportarKardexAExcel(
  movimientos: MovimientoStockItem[],
  productoNombre: string,
  filename = 'historial-movimientos-stock.xlsx'
) {
  const XLSX = await import('xlsx');
  const rows = movimientos.map((m) => ({
    Producto: productoNombre,
    'Fecha y Hora': m.fecha_formateada,
    Tipo: m.tipo,
    'Documento / Referencia': m.numero_referencia,
    'Entrada (+)': m.cantidad_entrada,
    'Salida (-)': m.cantidad_salida,
    'Stock Anterior': m.stock_anterior,
    'Stock Resultante': m.stock_resultante,
    'Cliente / Proveedor / Info': m.cliente_proveedor_info,
    Notas: m.notas || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kardex de Movimientos');
  XLSX.writeFile(workbook, filename);
}

/**
 * Exporta a CSV con codificación UTF-8 con BOM
 */
export function exportarACSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
