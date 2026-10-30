import { tryGetSupabase } from '../clienteSupabase';
import { getStoredProducts } from '@/lib/productStore';
import { applyPresentationConversions } from '../productos.service';
import type { Producto } from '@/types/database';

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
}

export interface ResumenStockGeneral {
  stock_cierre_compra: number;
  stock_cierre_venta: number;
  beneficio_potencial: number;
  profit_margin_pct: number;
  total_productos: number;
  total_agotados: number;
  total_bajos: number;
  items: StockGeneralItem[];
}

export interface MovimientoStockItem {
  id: string;
  tipo: 'Ventas' | 'Compras' | 'Ajuste de Stock' | 'Devolución de Venta' | 'Devolución de Compra' | 'Transferencia';
  cambio_cantidad: number; // Negativo para salidas, positivo para entradas
  nueva_cantidad: number;  // Saldo / existencia tras este movimiento
  fecha: string;          // ISO
  fecha_formateada: string; // DD-MM-YYYY hh:mm A
  numero_referencia: string; // NCF, FAC-..., VEN-..., COM-..., AJU-...
  cliente_proveedor_info: string; // Nombre del cliente o proveedor
  notas?: string | null;
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

function formatFechaKardex(isoString?: string | null): string {
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

/**
 * Obtiene el informe general de stock con valoraciones por costo y por venta,
 * beneficio potencial y margen de beneficio global.
 */
export async function obtenerInformeStockGeneral(): Promise<ResumenStockGeneral> {
  const sb = tryGetSupabase();
  let rawProds: Producto[] = [];

  if (sb) {
    try {
      const { data, error } = await sb
        .from('productos')
        .select('*')
        .eq('estado', 'activo')
        .order('nombre')
        .limit(3000);
      if (!error && data && data.length > 0) {
        rawProds = data as Producto[];
      }
    } catch (e) {
      console.warn('Fallo al consultar productos en Supabase, recurriendo a local:', e);
    }
  }

  if (rawProds.length === 0) {
    const stored = getStoredProducts();
    rawProds = stored.filter((p) => p.status === 'active').map((p) => ({
      id: p.id,
      sku: p.sku || '',
      codigo_barras: p.barcode || '',
      nombre: p.name,
      categoria: p.category || 'General',
      marca: p.brand || null,
      unidad: p.unit || 'Unidad',
      precio_costo: Number(p.costPrice || 0),
      precio_venta: Number(p.salePrice || 0),
      precio_mayorista: Number(p.wholesalePrice || 0),
      stock_actual: Number(p.currentStock || 0),
      stock_minimo: Number(p.minStock || 0),
      porcentaje_impuesto: Number(p.tax || 0),
      es_pesado: Boolean(p.isWeightProduct),
      estado: (p.status === 'active' ? 'activo' : p.status === 'inactive' ? 'inactivo' : 'descontinuado') as 'activo' | 'inactivo' | 'descontinuado',
      producto_base_id: p.producto_base_id || null,
      factor_conversion: Number(p.factor_conversion || 1),
      proveedor_id: null,
      fecha_vencimiento: p.expiryDate || null,
      garantia: p.warranty || null,
      imagen_url: p.image || null,
    }));
  }

  // Aplicar conversiones dinámicas (ej: Fardo de agua, Cartón de huevos)
  const converted = applyPresentationConversions(rawProds);

  let stock_cierre_compra = 0;
  let stock_cierre_venta = 0;
  let total_agotados = 0;
  let total_bajos = 0;

  const items: StockGeneralItem[] = converted.map((p) => {
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
  });

  const beneficio_potencial = Math.round((stock_cierre_venta - stock_cierre_compra) * 100) / 100;
  const profit_margin_pct = stock_cierre_venta > 0
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
    items,
  };
}

/**
 * Obtiene el historial completo de movimientos (Kardex) para un producto específico,
 * consolidando ventas, compras, ajustes de stock y devoluciones con saldos continuos.
 */
export async function obtenerHistorialMovimientosProducto(
  productoId: string
): Promise<HistorialMovimientosProductoResult> {
  const general = await obtenerInformeStockGeneral();
  const producto = general.items.find((p) => p.id === productoId);

  if (!producto) {
    throw new Error(`Producto con ID ${productoId} no encontrado`);
  }

  const sb = tryGetSupabase();
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
    withBalances.unshift({
      id: `mov-${i}-${Date.now()}`,
      tipo: m.tipo,
      cambio_cantidad: m.cantidad,
      nueva_cantidad: Math.round(running * 100) / 100,
      fecha: m.fecha,
      fecha_formateada: formatFechaKardex(m.fecha),
      numero_referencia: m.referencia,
      cliente_proveedor_info: m.entidad,
      notas: m.notas,
    });
    // Saldo anterior antes de este movimiento
    running = Math.round((running - m.cantidad) * 100) / 100;
  }

  const stock_apertura = Math.max(0, running);

  // Calcular totales de resumen
  let compra_total = 0;
  let total_devolucion_venta = 0;
  let total_vendido = 0;
  let ajuste_total = 0;
  let total_devolucion_compra = 0;

  for (const m of withBalances) {
    if (m.tipo === 'Compras') compra_total += Math.abs(m.cambio_cantidad);
    else if (m.tipo === 'Devolución de Venta') total_devolucion_venta += Math.abs(m.cambio_cantidad);
    else if (m.tipo === 'Ventas') total_vendido += Math.abs(m.cambio_cantidad);
    else if (m.tipo === 'Ajuste de Stock' && m.cambio_cantidad < 0) ajuste_total += Math.abs(m.cambio_cantidad);
    else if (m.tipo === 'Devolución de Compra') total_devolucion_compra += Math.abs(m.cambio_cantidad);
  }

  const resumen: ResumenKardexProducto = {
    cantidades_en: {
      compra_total: Math.round(compra_total * 100) / 100,
      stock_apertura: Math.round(stock_apertura * 100) / 100,
      total_devolucion_venta: Math.round(total_devolucion_venta * 100) / 100,
      transferencias_en: 0,
    },
    cantidades_fuera: {
      total_vendido: Math.round(total_vendido * 100) / 100,
      ajuste_total: Math.round(ajuste_total * 100) / 100,
      total_devolucion_compra: Math.round(total_devolucion_compra * 100) / 100,
      transferencias_afuera: 0,
    },
    totales: {
      stock_actual: producto.stock_actual,
    },
  };

  // Retornar en orden cronológico inverso (los movimientos más recientes primero, como en Imagen 2)
  return {
    producto,
    resumen,
    movimientos: withBalances.reverse(),
  };
}

/**
 * Exporta el informe general de stock a formato Excel (.xlsx) nativo
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
    Ubicación: p.ubicacion,
    'Precio Venta (RD$)': p.precio_venta,
    'Precio Compra (RD$)': p.precio_costo,
    'Stock Actual': p.stock_actual,
    'Stock Mínimo': p.stock_minimo,
    'Valor Stock Compra (RD$)': p.valor_compra,
    'Valor Stock Venta (RD$)': p.valor_venta,
    Estado: p.estado,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Informe de Stock');
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
    Tipo: m.tipo,
    'Cambio de Cantidad': m.cambio_cantidad,
    'Nueva Cantidad (Saldo)': m.nueva_cantidad,
    Fecha: m.fecha_formateada,
    'Número de Referencia o NCF': m.numero_referencia,
    'Cliente / Proveedor / Info': m.cliente_proveedor_info,
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

