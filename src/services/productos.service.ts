import { tryGetSupabase, isSupabaseConfigured, getSupabase } from './clienteSupabase';
import { type EstadoProducto, type Producto } from '@/types/database';
import { getStoredProducts, saveStoredProducts, getDeletedProductKeys, markProductAsDeleted } from '@/lib/productStore';
import { initialProducts, type Product } from '@/lib/initialProducts';
import {
  decodeVariableWeightBarcode,
  extractPluFromCode,
  normalizePlu,
  pluSearchVariants,
  productMatchesScanCode,
} from '@/lib/scaleBarcode';
import { isAbortError } from '@/lib/isAbortError';
import { calcularStockPresentacion } from './presentaciones.service';

export type ProductosFiltro = {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  categoria?: string;
  estado?: EstadoProducto | 'todos';
  signal?: AbortSignal;
};

export type ProductosResultado = {
  datos: Producto[];
  total: number;
  pagina: number;
  limite: number;
};

/** Evita 400 de PostgREST por caracteres especiales en filtros `.or()`. */
function sanitizarBusquedaPostgrest(raw: string): string {
  return raw.replace(/[%_,.()"'\\*]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isUniqueConflictError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; status?: number; message?: string; details?: string };
  return (
    e.code === '23505' ||
    e.status === 409 ||
    (typeof e.message === 'string' &&
      (e.message.toLowerCase().includes('duplicate') ||
        e.message.toLowerCase().includes('unique') ||
        e.message.toLowerCase().includes('conflict')))
  );
}

function errorSupabase(error: unknown): Error {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; details?: string; hint?: string; code?: string; status?: number };
    if (isUniqueConflictError(e)) {
      const combined = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase();
      if (combined.includes('codigo_barras') || combined.includes('codigo_barras_key')) {
        return new Error('Ya existe un producto registrado con este Código de Barras.');
      }
      if (combined.includes('sku') || combined.includes('sku_key')) {
        return new Error('Ya existe un producto registrado con este SKU.');
      }
      if (combined.includes('plu') || combined.includes('plu_key')) {
        return new Error('Ya existe un producto registrado con este PLU.');
      }
      return new Error('Ya existe un producto registrado con esos datos (Código de barras, SKU o PLU duplicado).');
    }
    if (
      e.code === '23503' ||
      e.status === 409 ||
      String(e.message || '').includes('foreign key') ||
      String(e.details || '').includes('referenced from table')
    ) {
      return new Error(
        'No se puede eliminar este producto porque ya tiene ventas, compras o movimientos de inventario registrados. Para mantener la integridad fiscal y contable, márcalo como "Inactivo".'
      );
    }
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    return new Error(parts.join(' — ') || 'Error de Supabase');
  }
  return error instanceof Error ? error : new Error('Error de Supabase');
}

const EXTENDED_PRODUCTO_COLUMNS = [
  'plu',
  'sale_type',
  'weight_unit',
  'price_per_weight',
  'allow_decimal',
  'min_weight',
  'max_weight',
  'generate_scale_barcode',
  'is_weight_product',
] as const;

/** Columnas que PostgREST reportó ausentes en este proyecto (cache de sesión). */
const missingProductoColumns = new Set<string>();

function isSchemaColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (isUniqueConflictError(error)) return false;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  const combined = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''} ${e.code ?? ''}`.toLowerCase();
  return (
    e.code === 'PGRST204' ||
    e.code === '42703' ||
    combined.includes('schema cache') ||
    combined.includes('could not find the') ||
    combined.includes('does not exist')
  );
}

function rememberMissingColumnsFromError(error: unknown): void {
  if (!error || typeof error !== 'object') return;
  const e = error as { message?: string; details?: string; hint?: string };
  const combined = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`;
  for (const match of combined.matchAll(/Could not find the '([^']+)' column/gi)) {
    if (match[1]) missingProductoColumns.add(match[1]);
  }
  for (const col of EXTENDED_PRODUCTO_COLUMNS) {
    if (new RegExp(`\\b${col}\\b`, 'i').test(combined)) {
      missingProductoColumns.add(col);
    }
  }
}

function stripExtendedColumns(payload: Record<string, any>): Record<string, any> {
  const next = { ...payload };
  for (const col of EXTENDED_PRODUCTO_COLUMNS) {
    delete next[col];
  }
  return next;
}

function omitMissingProductoColumns(payload: Record<string, any>): Record<string, any> {
  if (missingProductoColumns.size === 0) return payload;
  const next = { ...payload };
  for (const col of missingProductoColumns) {
    delete next[col];
  }
  return next;
}

async function writeProducto(
  action: 'insert' | 'update',
  payload: Record<string, any>,
  id?: string
): Promise<{ data: Producto | null; error: unknown }> {
  const sb = getSupabase();
  const coerced =
    payload.producto_base_id != null && !esUuid(String(payload.producto_base_id))
      ? { ...payload, producto_base_id: null, factor_conversion: 1 }
      : payload;
  const body = omitMissingProductoColumns(coerced);
  const run = async (row: Record<string, any>) => {
    if (action === 'insert') {
      return sb.from('productos').insert(row).select('*').single();
    }
    return sb.from('productos').update(row).eq('id', id!).select('*').single();
  };

  const first = await run(body);
  if (!first.error) return { data: first.data as Producto, error: null };
  if (!isSchemaColumnError(first.error)) return { data: null, error: first.error };

  rememberMissingColumnsFromError(first.error);
  const retryBody = omitMissingProductoColumns(stripExtendedColumns(coerced));
  const retry = await run(retryBody);
  if (!retry.error) return { data: retry.data as Producto, error: null };
  return { data: null, error: retry.error };
}

export function sanitizePayloadForPostgres<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const cleaned = value.replace(/[\u0000\0]/g, '').trim();
      if (
        (key === 'fecha_vencimiento' ||
          key === 'proveedor_id' ||
          key === 'imagen_url' ||
          key === 'garantia' ||
          key === 'plu') &&
        !cleaned
      ) {
        result[key] = null;
      } else {
        result[key] = cleaned;
      }
    } else if (typeof value === 'number') {
      result[key] = Number.isNaN(value) || !Number.isFinite(value) ? 0 : value;
    } else if (value === undefined) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/** Mapeo DB → UI Product Management / POS */
export function productoAUi(p: Producto): Product {
  let stockStatus: Product['stockStatus'] = 'normal';
  if (p.stock_actual <= 0) stockStatus = 'out';
  else if (p.stock_actual <= p.stock_minimo) stockStatus = 'low';

  const estadoMap: Record<EstadoProducto, Product['status']> = {
    activo: 'active',
    inactivo: 'inactive',
    descontinuado: 'discontinued',
  };

  const isWeight = p.is_weight_product || p.es_pesado || p.sale_type === 'weight' || p.sale_type === 'both';
  const rawUnit = p.unidad?.trim();
  const rawWeightUnit = p.weight_unit?.trim();

  let resolvedUnit = 'Unidad';
  if (isWeight) {
    if (rawWeightUnit) {
      resolvedUnit = rawWeightUnit.toLowerCase() === 'kg' ? 'kg' : 'lb';
    } else if (rawUnit && !['unidad', 'ud', 'und', 'unidades'].includes(rawUnit.toLowerCase())) {
      resolvedUnit = rawUnit;
    } else {
      resolvedUnit = 'lb';
    }
  } else {
    resolvedUnit = rawUnit || 'Unidad';
  }

  return {
    id: p.id,
    barcode: p.codigo_barras ?? '',
    sku: p.sku ?? '',
    plu:
      normalizePlu(p.plu) ||
      p.plu ||
      normalizePlu(p.codigo_barras) ||
      normalizePlu(String(p.sku ?? '').replace(/^PLU-/i, '')) ||
      '',
    name: p.nombre ?? '',
    category: p.categoria ?? 'General',
    brand: p.marca ?? '',
    unit: resolvedUnit,
    supplier: '',
    costPrice: Number(p.precio_costo ?? 0),
    salePrice: Number(p.precio_venta ?? 0),
    wholesalePrice: Number(p.precio_mayorista ?? 0),
    tax: Number(p.porcentaje_impuesto ?? 0),
    minStock: p.stock_minimo ?? 10,
    currentStock: Number(p.stock_actual ?? 0),
    image: p.imagen_url ?? '',
    expiryDate: p.fecha_vencimiento ?? null,
    warranty: p.garantia ?? 'N/A',
    status: estadoMap[p.estado] ?? 'active',
    stockStatus,
    saleType: p.sale_type ?? (p.es_pesado ? 'weight' : 'unit'),
    weightUnit: p.weight_unit ?? 'lb',
    pricePerWeight: p.price_per_weight ? Number(p.price_per_weight) : Number(p.precio_venta ?? 0),
    allowDecimal: p.allow_decimal ?? true,
    minWeight: p.min_weight != null ? Number(p.min_weight) : 0.01,
    maxWeight: p.max_weight != null ? Number(p.max_weight) : 999.99,
    generateScaleBarcode: p.generate_scale_barcode ?? false,
    isWeightProduct: isWeight,
    producto_base_id: (p as any).producto_base_id ?? null,
    factor_conversion: (p as any).factor_conversion ?? 1,
    unidad_base: (p as any).unidad_base ?? null,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esUuid(value: string | undefined | null): value is string {
  return !!value && UUID_RE.test(value);
}

export function uiAProductoInsert(p: Omit<Product, 'id' | 'stockStatus'> & { id?: string }): Partial<Producto> {
  const estadoMap: Record<Product['status'], EstadoProducto> = {
    active: 'activo',
    inactive: 'inactivo',
    discontinued: 'descontinuado',
  };
  const isWeight = p.saleType === 'weight' || p.saleType === 'both' || !!p.isWeightProduct;
  return {
    ...(esUuid(p.id) ? { id: p.id } : {}),
    codigo_barras: p.barcode,
    sku: p.sku,
    plu: normalizePlu(p.plu) || p.plu || null,
    nombre: p.name,
    categoria: p.category,
    marca: p.brand || null,
    unidad: p.unit || 'Unidad',
    precio_costo: p.costPrice,
    precio_venta: p.salePrice,
    precio_mayorista: p.wholesalePrice,
    porcentaje_impuesto: p.tax,
    stock_minimo: p.minStock,
    stock_actual: p.currentStock,
    es_pesado: isWeight,
    sale_type: p.saleType ?? (isWeight ? 'weight' : 'unit'),
    weight_unit: p.weightUnit ?? 'lb',
    price_per_weight: p.pricePerWeight ?? p.salePrice,
    allow_decimal: p.allowDecimal ?? true,
    min_weight: p.minWeight ?? 0.01,
    max_weight: p.maxWeight ?? 999.99,
    generate_scale_barcode: p.generateScaleBarcode ?? false,
    is_weight_product: isWeight,
    fecha_vencimiento: p.expiryDate,
    garantia: p.warranty,
    imagen_url: p.image || null,
    estado: estadoMap[p.status],
    // Vínculo de presentación (fardo, cartón, etc.) con su producto base.
    // Solo se envía cuando viene definido para no borrar vínculos existentes
    // en flujos que no manejan estos campos (p. ej. importación masiva).
    ...(p.producto_base_id !== undefined
      ? {
          producto_base_id: p.producto_base_id || null,
          factor_conversion: p.producto_base_id
            ? Math.max(1, Number(p.factor_conversion) || 1)
            : 1,
        }
      : {}),
    ...(p.unidad_base ? { unidad_base: p.unidad_base } : {}),
  };
}

function demoAsProductos(): Producto[] {
  const deletedKeys = getDeletedProductKeys();
  return initialProducts
    .filter(
      (p) =>
        !deletedKeys.has(p.id.toLowerCase()) &&
        !deletedKeys.has((p.sku || '').toLowerCase()) &&
        !(p.barcode && deletedKeys.has(p.barcode.toLowerCase()))
    )
    .map((p) => {
    const isWeight = p.saleType === 'weight' || p.saleType === 'both' || !!p.isWeightProduct;
    return {
      id: p.id,
      codigo_barras: p.barcode,
      sku: p.sku,
      plu: normalizePlu(p.plu) || p.plu || null,
      nombre: p.name,
      categoria: p.category,
      marca: p.brand || null,
      unidad: p.unit || 'Unidad',
      proveedor_id: null,
      precio_costo: Number(p.costPrice ?? 0),
      precio_venta: Number(p.salePrice ?? 0),
      precio_mayorista: Number(p.wholesalePrice ?? 0),
      porcentaje_impuesto: Number(p.tax ?? 0),
      stock_minimo: p.minStock ?? 10,
      stock_actual: Number(p.currentStock ?? 0),
      es_pesado: isWeight,
      sale_type: p.saleType ?? (isWeight ? 'weight' : 'unit'),
      weight_unit: p.weightUnit ?? 'lb',
      price_per_weight: p.pricePerWeight ? Number(p.pricePerWeight) : Number(p.salePrice ?? 0),
      allow_decimal: p.allowDecimal ?? true,
      min_weight: p.minWeight ?? 0.01,
      max_weight: p.maxWeight ?? 999.99,
      generate_scale_barcode: p.generateScaleBarcode ?? false,
      is_weight_product: isWeight,
      fecha_vencimiento: p.expiryDate ?? null,
      garantia: p.warranty || null,
      imagen_url: p.image || null,
      estado: (p.status === 'active' ? 'activo' : p.status === 'inactive' ? 'inactivo' : 'descontinuado') as EstadoProducto,
      producto_base_id: p.producto_base_id ?? null,
      factor_conversion: Number(p.factor_conversion ?? 1),
      unidad_base: p.unidad_base,
    };
  });
}

function localAsProductos(): Producto[] {
  return getStoredProducts().map((p) => {
    const isWeight = p.saleType === 'weight' || p.saleType === 'both' || !!p.isWeightProduct;
    return {
      id: p.id,
      codigo_barras: p.barcode,
      sku: p.sku,
      plu: normalizePlu(p.plu) || p.plu || null,
      nombre: p.name,
      categoria: p.category,
      marca: p.brand || null,
      unidad: p.unit || 'Unidad',
      proveedor_id: null,
      precio_costo: Number(p.costPrice ?? 0),
      precio_venta: Number(p.salePrice ?? 0),
      precio_mayorista: Number(p.wholesalePrice ?? 0),
      porcentaje_impuesto: Number(p.tax ?? 0),
      stock_minimo: p.minStock ?? 10,
      stock_actual: Number(p.currentStock ?? 0),
      es_pesado: isWeight,
      sale_type: p.saleType ?? (isWeight ? 'weight' : 'unit'),
      weight_unit: p.weightUnit ?? 'lb',
      price_per_weight: p.pricePerWeight ? Number(p.pricePerWeight) : Number(p.salePrice ?? 0),
      allow_decimal: p.allowDecimal ?? true,
      min_weight: p.minWeight ?? 0.01,
      max_weight: p.maxWeight ?? 999.99,
      generate_scale_barcode: p.generateScaleBarcode ?? false,
      is_weight_product: isWeight,
      fecha_vencimiento: p.expiryDate ?? null,
      garantia: p.warranty || null,
      imagen_url: p.image || null,
      estado: (p.status === 'active' ? 'activo' : p.status === 'inactive' ? 'inactivo' : 'descontinuado') as EstadoProducto,
      producto_base_id: p.producto_base_id ?? null,
      factor_conversion: Number(p.factor_conversion ?? 1),
      unidad_base: p.unidad_base,
    };
  });
}

const PRODUCTOS_CACHE_TTL = 10 * 60_000; // 10 minutos de cache para evitar consumo excesivo de egress en Supabase
const productosCache = new Map<string, { timestamp: number; result: ProductosResultado }>();
const inFlightRequests = new Map<string, Promise<ProductosResultado>>();

interface MasterCatalogEntry {
  timestamp: number;
  data: Producto[];
  total: number;
}
const masterCatalogCache = new Map<string, MasterCatalogEntry>();

export function invalidarCacheProductos(): void {
  productosCache.clear();
  inFlightRequests.clear();
  masterCatalogCache.clear();
}

export function applyPresentationConversions(
  products: Producto[],
  extraCatalog: Producto[] = []
): Producto[] {
  const byId = new Map<string, Producto>();
  const bySku = new Map<string, Producto>();
  const index = (p: Producto) => {
    if (p.id) byId.set(p.id, p);
    if (p.sku) bySku.set(p.sku.toLowerCase().trim(), p);
    if (p.codigo_barras) bySku.set(p.codigo_barras.toLowerCase().trim(), p);
  };
  for (const entry of masterCatalogCache.values()) {
    for (const p of entry.data) index(p);
  }
  for (const p of extraCatalog) index(p);
  for (const p of products) index(p);

  return products.map((p) => {
    let baseProd: Producto | undefined;
    let factor = Number(p.factor_conversion || 1);

    if (p.producto_base_id) {
      baseProd = byId.get(p.producto_base_id);
    }

    const nameLower = (p.nombre || '').toLowerCase();
    const skuClean = (p.sku || '').toLowerCase().trim();

    if (!baseProd) {
      if (skuClean === '23653' || nameLower.includes('fardo de agua pureza sana')) {
        baseProd = bySku.get('7461136665069') || [...byId.values()].find((x) => x.nombre.toLowerCase().includes('botella de agua pureza sana'));
        factor = 20;
      } else if (skuClean === '0686' || nameLower === 'huevos 1 carton') {
        baseProd = bySku.get('0685') || [...byId.values()].find((x) => x.nombre.toLowerCase().includes('huevos medio carton'));
        factor = 2;
      } else if (skuClean === '0875' || nameLower === 'huevo 1 carton') {
        baseProd = bySku.get('0874') || [...byId.values()].find((x) => x.nombre.toLowerCase() === 'huevo medio carton');
        factor = 2;
      }
    }

    if (baseProd && factor > 1) {
      return {
        ...p,
        producto_base_id: baseProd.id,
        factor_conversion: factor,
        unidad_base: baseProd.unidad || 'unidad',
        stock_actual: calcularStockPresentacion(Number(baseProd.stock_actual || 0), factor),
      };
    }

    return p;
  });
}

export async function resolveSingleProductPresentation(prod: Producto, sbClient?: any): Promise<Producto> {
  const nameLower = (prod.nombre || '').toLowerCase();
  const skuClean = (prod.sku || '').toLowerCase().trim();
  let baseId = (prod as any).producto_base_id;
  let factor = Number((prod as any).factor_conversion || 1);

  if (!baseId) {
    if (skuClean === '23653' || nameLower.includes('fardo de agua pureza sana')) {
      factor = 20;
    } else if (skuClean === '0686' || nameLower === 'huevos 1 carton') {
      factor = 2;
    } else if (skuClean === '0875' || nameLower === 'huevo 1 carton') {
      factor = 2;
    }
  }

  if (factor > 1) {
    if (baseId) {
      for (const entry of masterCatalogCache.values()) {
        const b = entry.data.find((x) => x.id === baseId);
        if (b) {
          return {
            ...prod,
            producto_base_id: baseId,
            factor_conversion: factor,
            stock_actual: Math.floor(Number(b.stock_actual || 0) / factor),
          } as Producto;
        }
      }
    }

    if (sbClient) {
      try {
        let baseQuery;
        if (baseId) {
          baseQuery = sbClient.from('productos').select('id, stock_actual, unidad').eq('id', baseId).single();
        } else if (skuClean === '23653' || nameLower.includes('fardo de agua pureza sana')) {
          baseQuery = sbClient.from('productos').select('id, stock_actual, unidad').eq('sku', '7461136665069').single();
        } else if (skuClean === '0686' || nameLower === 'huevos 1 carton') {
          baseQuery = sbClient.from('productos').select('id, stock_actual, unidad').eq('sku', '0685').single();
        } else if (skuClean === '0875' || nameLower === 'huevo 1 carton') {
          baseQuery = sbClient.from('productos').select('id, stock_actual, unidad').eq('sku', '0874').single();
        }

        if (baseQuery) {
          const { data: bData } = await baseQuery;
          if (bData) {
            return {
              ...prod,
              producto_base_id: bData.id,
              factor_conversion: factor,
              unidad_base: bData.unidad || 'unidad',
              stock_actual: Math.floor(Number(bData.stock_actual || 0) / factor),
            } as Producto;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return prod;
}

export async function buscarProductoPorCodigo(codigo: string): Promise<Producto | null> {
  const code = (codigo || '').trim().toLowerCase();
  if (!code) return null;

  // 1. Buscar en el catalogo maestro en memoria (0 ms, 0 egress)
  for (const entry of masterCatalogCache.values()) {
    const found = entry.data.find(
      (p) =>
        (p.codigo_barras && p.codigo_barras.toLowerCase() === code) ||
        (p.sku && p.sku.toLowerCase() === code) ||
        (p.plu && p.plu.toLowerCase() === code)
    );
    if (found) return found;
  }

  // 2. Buscar en caché reciente
  for (const entry of productosCache.values()) {
    const found = entry.result.datos.find(
      (p) =>
        (p.codigo_barras && p.codigo_barras.toLowerCase() === code) ||
        (p.sku && p.sku.toLowerCase() === code) ||
        (p.plu && p.plu.toLowerCase() === code)
    );
    if (found) return found;
  }

  const sb = tryGetSupabase();
  if (!sb) {
    const local = applyPresentationConversions(demoAsProductos());
    return (
      local.find(
        (p) =>
          (p.codigo_barras && p.codigo_barras.toLowerCase() === code) ||
          (p.sku && p.sku.toLowerCase() === code)
      ) ?? null
    );
  }

  // 3. Consulta puntual a Supabase (solo 1 fila con maybeSingle, ~0.2 KB en vez de descargar 2 MB)
  try {
    const { data, error } = await sb
      .from('productos')
      .select('*')
      .or(`codigo_barras.eq."${codigo.trim()}",sku.eq."${codigo.trim()}",plu.eq."${codigo.trim()}"`)
      .maybeSingle();

    if (!error && data) {
      return await resolveSingleProductPresentation(data as Producto, sb);
    }
  } catch (err) {
    console.warn('Error buscando producto por código:', err);
  }

  return null;
}

export async function obtenerProductos(params: ProductosFiltro = {}): Promise<ProductosResultado> {
  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 5000;
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  // Cache hit para navegación instantánea entre módulos sin recargar de red
  const cacheKey = JSON.stringify({
    p: pagina,
    l: limite,
    b: (params.busqueda || '').trim().toLowerCase(),
    c: params.categoria || '',
    e: params.estado || '',
  });

  if (!params.signal) {
    const cached = productosCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRODUCTOS_CACHE_TTL) {
      return {
        ...cached.result,
        datos: [...cached.result.datos],
      };
    }

    // Si ya existe una petición idéntica en vuelo, reutilizarla (Deduplicación de peticiones)
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    // Servir desde el Catálogo Maestro en memoria si ya fue descargado previamente (0 egress a Supabase!)
    const estadoKey = params.estado || 'todos';
    const masterEntry = masterCatalogCache.get(estadoKey) || (estadoKey !== 'todos' ? masterCatalogCache.get('todos') : null);
    if (masterEntry && Date.now() - masterEntry.timestamp < PRODUCTOS_CACHE_TTL) {
      let filtered = masterEntry.data;
      if (params.estado && params.estado !== 'todos') {
        filtered = filtered.filter((p) => p.estado === params.estado);
      }
      if (params.categoria && params.categoria !== 'Todas') {
        filtered = filtered.filter((p) => p.categoria === params.categoria);
      }
      if (params.busqueda && params.busqueda.trim()) {
        const q = params.busqueda.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.nombre && p.nombre.toLowerCase().includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
            (p.plu && p.plu.toLowerCase().includes(q)) ||
            (p.categoria && p.categoria.toLowerCase().includes(q)) ||
            (p.marca && p.marca.toLowerCase().includes(q))
        );
      }

      const total = filtered.length;
      const datos = filtered.slice(desde, desde + limite);
      const res: ProductosResultado = { datos, total, pagina, limite };
      productosCache.set(cacheKey, { timestamp: Date.now(), result: res });
      return res;
    }
  }

  const runQuery = async (): Promise<ProductosResultado> => {
    const sb = tryGetSupabase();
  let dbProducts: Producto[] = [];
  let dbCount = 0;
  let supabaseFailed = false;

  if (sb) {
    try {
      let query = sb
        .from('productos')
        .select('*', { count: 'exact' })
        .order('nombre');

      const q = params.busqueda?.trim() ? sanitizarBusquedaPostgrest(params.busqueda) : '';
      if (q) {
        query = query.or(
          `nombre.ilike."%${q}%",sku.ilike."%${q}%",codigo_barras.ilike."%${q}%",plu.ilike."%${q}%",categoria.ilike."%${q}%",marca.ilike."%${q}%"`
        );
      }
      if (params.categoria && params.categoria !== 'Todas') {
        query = query.eq('categoria', params.categoria);
      }
      if (params.estado && params.estado !== 'todos') {
        query = query.eq('estado', params.estado);
      }
      if (params.signal) query = query.abortSignal(params.signal);

      let { data, error, count } = await query.range(desde, hasta);
      if (error && q && isSchemaColumnError(error)) {
        let fallbackQuery = sb
          .from('productos')
          .select('*', { count: 'exact' })
          .order('nombre')
          .range(desde, hasta);
        fallbackQuery = fallbackQuery.or(`nombre.ilike."%${q}%",sku.ilike."%${q}%",codigo_barras.ilike."%${q}%"`);
        if (params.categoria && params.categoria !== 'Todas') {
          fallbackQuery = fallbackQuery.eq('categoria', params.categoria);
        }
        if (params.estado && params.estado !== 'todos') {
          fallbackQuery = fallbackQuery.eq('estado', params.estado);
        }
        if (params.signal) fallbackQuery = fallbackQuery.abortSignal(params.signal);

        const retry = await fallbackQuery;
        data = retry.data;
        error = retry.error;
        count = retry.count;
      }

      if (!error && data) {
        dbProducts = data as Producto[];
        dbCount = count ?? dbProducts.length;

        // Si la base de datos tiene más de 1,000 productos, paginar lotes para cargar todos
        if (dbCount > dbProducts.length && hasta >= 1000 && dbProducts.length === 1000) {
          let currentOffset = 1000;
          while (currentOffset < dbCount && currentOffset <= hasta) {
            const nextHasta = Math.min(hasta, currentOffset + 999);
            let nextQuery = sb
              .from('productos')
              .select('*')
              .order('nombre')
              .range(currentOffset, nextHasta);
            if (q) {
              nextQuery = nextQuery.or(
                `nombre.ilike."%${q}%",sku.ilike."%${q}%",codigo_barras.ilike."%${q}%",plu.ilike."%${q}%",categoria.ilike."%${q}%",marca.ilike."%${q}%"`
              );
            }
            if (params.categoria && params.categoria !== 'Todas') {
              nextQuery = nextQuery.eq('categoria', params.categoria);
            }
            if (params.estado && params.estado !== 'todos') {
              nextQuery = nextQuery.eq('estado', params.estado);
            }
            if (params.signal) nextQuery = nextQuery.abortSignal(params.signal);

            const nextBatch = await nextQuery;
            if (nextBatch.data && nextBatch.data.length > 0) {
              dbProducts.push(...(nextBatch.data as Producto[]));
              currentOffset += nextBatch.data.length;
            } else {
              break;
            }
          }
        }
      } else if (error) {
        console.warn('Error al consultar productos de Supabase:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      console.warn('Fallo de conexión o consulta Supabase productos:', err);
      supabaseFailed = true;
    }
  }

  // Obtenemos los productos de demostración/catálogo base
  let fallbackList = demoAsProductos();
  // Si no hay Supabase o falló, unimos también los productos locales
  if (!sb || supabaseFailed) {
    const local = localAsProductos();
    const localSkus = new Set(local.map((p) => (p.sku || '').toLowerCase()));
    const extras = fallbackList.filter((f) => !localSkus.has((f.sku || '').toLowerCase()));
    fallbackList = [...local, ...extras];
  }

  // Filtrar catálogo base según los parámetros solicitados
  if (params.busqueda?.trim()) {
    const q = params.busqueda.trim().toLowerCase();
    fallbackList = fallbackList.filter(
      (p) =>
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(q)) ||
        (p.categoria && p.categoria.toLowerCase().includes(q)) ||
        (p.marca && p.marca.toLowerCase().includes(q)) ||
        (p.plu && p.plu.toLowerCase().includes(q))
    );
  }
  if (params.categoria && params.categoria !== 'Todas') {
    fallbackList = fallbackList.filter((p) => p.categoria === params.categoria);
  }
  if (params.estado && params.estado !== 'todos') {
    fallbackList = fallbackList.filter((p) => p.estado === params.estado);
  }

  // Excluir productos del catálogo base que ya existan en Supabase (por SKU o código de barras)
  const dbSkus = new Set(dbProducts.map((p) => (p.sku || '').toLowerCase()));
  const dbBarcodes = new Set(dbProducts.map((p) => (p.codigo_barras || '').toLowerCase()));
  const deletedKeys = getDeletedProductKeys();
  const missingFromDb = fallbackList.filter(
    (p) =>
      !deletedKeys.has(p.id.toLowerCase()) &&
      !deletedKeys.has((p.sku || '').toLowerCase()) &&
      !(p.codigo_barras && deletedKeys.has(p.codigo_barras.toLowerCase())) &&
      !dbSkus.has((p.sku || '').toLowerCase()) &&
      (!p.codigo_barras || !dbBarcodes.has(p.codigo_barras.toLowerCase()))
  );

  const catalogForConversion = [...dbProducts, ...missingFromDb];
  let extraBases: Producto[] = [];
  if (sb && !supabaseFailed) {
    const knownIds = new Set(catalogForConversion.map((p) => p.id));
    const missingBaseIds = [
      ...new Set(
        catalogForConversion
          .map((p) => p.producto_base_id)
          .filter((id): id is string => Boolean(id) && !knownIds.has(id!) && esUuid(id!))
      ),
    ];
    if (missingBaseIds.length > 0) {
      try {
        const { data: bases } = await sb.from('productos').select('*').in('id', missingBaseIds);
        extraBases = (bases as Producto[]) || [];
      } catch {
        extraBases = [];
      }
    }
  }
  const combined = applyPresentationConversions(catalogForConversion, extraBases);
  const total = dbCount + missingFromDb.length;

  const result: ProductosResultado = {
    datos: combined.slice(0, limite),
    total,
    pagina,
    limite,
  };

  if (!params.signal) {
    productosCache.set(cacheKey, { timestamp: Date.now(), result });
    // Si fue una carga masiva sin filtros, registrarla como Catálogo Maestro en memoria
    if (limite >= 1000 && !params.busqueda && (!params.categoria || params.categoria === 'Todas')) {
      masterCatalogCache.set(params.estado || 'todos', {
        timestamp: Date.now(),
        data: combined,
        total,
      });
    }
  }

  return result;
  };

  if (!params.signal) {
    const promise = runQuery().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return runQuery();
}


export async function crearProducto(datos: Partial<Producto>): Promise<Producto> {
  if (!isSupabaseConfigured()) {
    const products = getStoredProducts();
    const ui = productoAUi({
      id: `prod-${Date.now()}`,
      codigo_barras: datos.codigo_barras!,
      sku: datos.sku!,
      nombre: datos.nombre!,
      categoria: datos.categoria!,
      marca: datos.marca ?? null,
      unidad: datos.unidad ?? 'Unidad',
      proveedor_id: null,
      precio_costo: Number(datos.precio_costo ?? 0),
      precio_venta: Number(datos.precio_venta ?? 0),
      precio_mayorista: Number(datos.precio_mayorista ?? 0),
      porcentaje_impuesto: Number(datos.porcentaje_impuesto ?? 0),
      stock_minimo: datos.stock_minimo ?? 10,
      stock_actual: datos.stock_actual ?? 0,
      es_pesado: false,
      fecha_vencimiento: datos.fecha_vencimiento ?? null,
      garantia: datos.garantia ?? null,
      imagen_url: datos.imagen_url ?? null,
      estado: (datos.estado as EstadoProducto) ?? 'activo',
      producto_base_id: datos.producto_base_id ?? null,
      factor_conversion: Number(datos.factor_conversion ?? 1),
      unidad_base: datos.unidad_base,
    });
    saveStoredProducts([ui, ...products]);
    invalidarCacheProductos();
    return localAsProductos().find((p) => p.sku === datos.sku)!;
  }

  const { id, creado_en, actualizado_en, ...rest } = datos;
  const cleanBarcode = rest.codigo_barras?.trim();
  const cleanSku = rest.sku?.trim();
  const payload = sanitizePayloadForPostgres({
    ...rest,
    ...(esUuid(id) ? { id } : {}),
    codigo_barras: cleanBarcode || `GEN-${Date.now()}`,
    sku: cleanSku || `SKU-${Date.now()}`,
    nombre: rest.nombre?.trim() || 'Sin nombre',
    categoria: rest.categoria || 'General',
    unidad: rest.unidad || 'Unidad',
    precio_costo: Number(rest.precio_costo ?? 0),
    precio_venta: Number(rest.precio_venta ?? 0),
    precio_mayorista: Number(rest.precio_mayorista ?? 0),
    porcentaje_impuesto: Number(rest.porcentaje_impuesto ?? 0),
    stock_minimo: rest.stock_minimo ?? 10,
    stock_actual: rest.stock_actual ?? 0,
    es_pesado: rest.es_pesado ?? false,
    fecha_vencimiento: rest.fecha_vencimiento || null,
    estado: rest.estado ?? 'activo',
  });
  const { data, error } = await writeProducto('insert', payload as Record<string, any>);
  if (error) throw errorSupabase(error);
  invalidarCacheProductos();
  return data as Producto;
}

export async function actualizarProducto(id: string, datos: Partial<Producto>): Promise<Producto> {
  if (!isSupabaseConfigured()) {
    const products = getStoredProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Producto no encontrado');
    const base = products[idx];
    const uiNext: Product = {
      ...base,
      barcode: datos.codigo_barras ?? base.barcode,
      sku: datos.sku ?? base.sku,
      name: datos.nombre ?? base.name,
      category: datos.categoria ?? base.category,
      brand: datos.marca ?? base.brand,
      unit: datos.unidad ?? base.unit,
      costPrice: datos.precio_costo != null ? Number(datos.precio_costo) : base.costPrice,
      salePrice: datos.precio_venta != null ? Number(datos.precio_venta) : base.salePrice,
      wholesalePrice: datos.precio_mayorista != null ? Number(datos.precio_mayorista) : base.wholesalePrice,
      tax: datos.porcentaje_impuesto != null ? Number(datos.porcentaje_impuesto) : base.tax,
      minStock: datos.stock_minimo ?? base.minStock,
      currentStock: datos.stock_actual ?? base.currentStock,
      image: datos.imagen_url ?? base.image,
      expiryDate: datos.fecha_vencimiento !== undefined ? datos.fecha_vencimiento : base.expiryDate,
      warranty: datos.garantia ?? base.warranty,
      status:
        datos.estado === 'activo'
          ? 'active'
          : datos.estado === 'inactivo'
            ? 'inactive'
            : datos.estado === 'descontinuado'
              ? 'discontinued'
              : base.status,
      stockStatus: 'normal',
      producto_base_id:
        datos.producto_base_id !== undefined ? datos.producto_base_id : base.producto_base_id,
      factor_conversion:
        datos.factor_conversion !== undefined
          ? Number(datos.factor_conversion)
          : base.factor_conversion,
      unidad_base: datos.unidad_base !== undefined ? datos.unidad_base : base.unidad_base,
    };
    if (uiNext.currentStock <= 0) uiNext.stockStatus = 'out';
    else if (uiNext.currentStock <= uiNext.minStock) uiNext.stockStatus = 'low';
    const nextList = [...products];
    nextList[idx] = uiNext;
    saveStoredProducts(nextList);
    invalidarCacheProductos();
    return localAsProductos().find((p) => p.id === id)!;
  }

  if (!esUuid(id)) {
    // Si el ID no es un UUID válido (es id local o demo) y Supabase está activo:
    // 1. Buscamos si ya existe en Supabase por PLU, código de barras o SKU
    const existingInDb = await buscarProductoExistenteParaImport(datos);
    if (existingInDb && esUuid(existingInDb.id)) {
      markProductAsDeleted(id);
      return actualizarProducto(existingInDb.id, datos);
    }

    // 2. Si no existe en Supabase, lo creamos para que quede sincronizado en la nube
    const demoOrLocal =
      localAsProductos().find((p) => p.id === id) ||
      demoAsProductos().find((p) => p.id === id);

    const merged = {
      ...(demoOrLocal ? demoOrLocal : {}),
      ...datos,
      nombre: datos.nombre || demoOrLocal?.nombre || 'Producto',
    };
    const nuevo = await crearProducto(merged);
    markProductAsDeleted(id);
    return nuevo;
  }
  const { id: _omitId, creado_en: _c, ...rest } = datos;
  const updatePayload = sanitizePayloadForPostgres({
    ...rest,
    fecha_vencimiento: rest.fecha_vencimiento || null,
    actualizado_en: new Date().toISOString(),
  });
  const { data, error } = await writeProducto('update', updatePayload as Record<string, any>, id);
  if (error) throw errorSupabase(error);
  invalidarCacheProductos();
  return data as Producto;
}

async function buscarProductoExistenteParaImport(datos: Partial<Producto>): Promise<Producto | null> {
  const sb = tryGetSupabase();
  if (!sb) {
    const plu = normalizePlu(datos.plu);
    return (
      localAsProductos().find((p) => {
        if (datos.codigo_barras && p.codigo_barras === datos.codigo_barras) return true;
        if (datos.sku && p.sku === datos.sku) return true;
        if (plu && normalizePlu(p.plu) === plu) return true;
        if (plu && normalizePlu(p.codigo_barras) === plu) return true;
        return false;
      }) ?? null
    );
  }

  const orParts = new Set<string>();
  if (datos.codigo_barras?.trim()) orParts.add(`codigo_barras.eq.${datos.codigo_barras.trim()}`);
  if (datos.sku?.trim()) orParts.add(`sku.eq.${datos.sku.trim()}`);
  const plu = normalizePlu(datos.plu);
  if (plu) {
    for (const v of pluSearchVariants(plu)) {
      if (!missingProductoColumns.has('plu')) orParts.add(`plu.eq.${v}`);
      orParts.add(`codigo_barras.eq.${v}`);
      orParts.add(`sku.eq.${v}`);
      orParts.add(`sku.eq.PLU-${v}`);
    }
  }
  if (orParts.size === 0) return null;

  const run = async (parts: string[]) =>
    sb.from('productos').select('*').or(parts.join(',')).limit(5);

  let { data, error } = await run([...orParts]);
  if (error && isSchemaColumnError(error)) {
    rememberMissingColumnsFromError(error);
    const fallback = [...orParts].filter((p) => !p.startsWith('plu.'));
    if (fallback.length === 0) return null;
    const retry = await run(fallback);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw errorSupabase(error);
  const rows = (data ?? []) as Producto[];
  if (rows.length === 0) return null;
  if (plu) {
    const byPlu = rows.find(
      (p) =>
        normalizePlu(p.plu) === plu ||
        normalizePlu(p.codigo_barras) === plu ||
        normalizePlu(String(p.sku || '').replace(/^PLU-/i, '')) === plu
    );
    if (byPlu) return byPlu;
  }
  return rows[0];
}

/** Crea o actualiza por PLU/SKU/barcode. No pisa el stock existente. */
export async function upsertProductoImportacion(
  datos: Partial<Producto>
): Promise<{ data: Producto; created: boolean }> {
  const existing = await buscarProductoExistenteParaImport(datos);
  if (existing) {
    const updated = await actualizarProducto(existing.id, {
      ...datos,
      stock_actual: existing.stock_actual,
      stock_minimo: datos.stock_minimo ?? existing.stock_minimo,
    });
    return { data: updated, created: false };
  }

  try {
    const created = await crearProducto(datos);
    return { data: created, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : '';
    if (!msg.includes('ya existe') && !isUniqueConflictError(e)) throw e;
    const again = await buscarProductoExistenteParaImport(datos);
    if (!again) throw e;
    const updated = await actualizarProducto(again.id, {
      ...datos,
      stock_actual: again.stock_actual,
    });
    return { data: updated, created: false };
  }
}

export async function eliminarProducto(id: string): Promise<void> {
  const cleanId = id.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

  // Registrar en la lista de eliminados para que no resucite del demo ni de localStorage
  markProductAsDeleted(cleanId);

  const matchedDemo = initialProducts.find((p) => p.id === cleanId || p.sku === cleanId || p.barcode === cleanId);
  if (matchedDemo) {
    if (matchedDemo.id) markProductAsDeleted(matchedDemo.id);
    if (matchedDemo.sku) markProductAsDeleted(matchedDemo.sku);
    if (matchedDemo.barcode) markProductAsDeleted(matchedDemo.barcode);
  }

  saveStoredProducts(getStoredProducts().filter((p) => p.id !== cleanId && p.sku !== cleanId));
  invalidarCacheProductos();

  if (!isUuid || !isSupabaseConfigured()) {
    return;
  }

  const sb = getSupabase();
  const { error } = await sb.from('productos').delete().eq('id', cleanId);
  if (error) {
    if (
      error.code === '23503' ||
      (error as { status?: number }).status === 409 ||
      String(error.message || '').includes('foreign key') ||
      String(error.details || '').includes('referenced from table')
    ) {
      // Como tiene ventas/movimientos históricos, cambiar automáticamente a inactivo
      try {
        await sb.from('productos').update({ estado: 'inactivo' }).eq('id', cleanId);
      } catch {
        // Continuar si falla la actualización
      }
      throw new Error(
        'Este producto tiene ventas o movimientos registrados. Por seguridad contable no se puede borrar su historial, pero se ha cambiado automáticamente a estado "Inactivo".'
      );
    }
    throw errorSupabase(error);
  }

  saveStoredProducts(getStoredProducts().filter((p) => p.id !== cleanId && p.sku !== cleanId));
}

export async function obtenerProductoPorCodigoBarras(
  codigo: string,
  signal?: AbortSignal
): Promise<Producto | null> {
  const sb = tryGetSupabase();
  if (!sb) {
    return localAsProductos().find((p) => p.codigo_barras === codigo) ?? null;
  }
  let query = sb.from('productos').select('*').eq('codigo_barras', codigo);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw errorSupabase(error);
  return data as Producto | null;
}

function productoCoincideConCodigo(p: Producto, codigo: string): boolean {
  const isWeight =
    Boolean(p.es_pesado) ||
    Boolean((p as any).is_weight_product) ||
    p.sale_type === 'weight' ||
    p.sale_type === 'both' ||
    ['lb', 'libra', 'kg', 'kilogramo'].includes((p.unidad || '').toLowerCase());

  return productMatchesScanCode(
    {
      plu: p.plu,
      barcode: p.codigo_barras,
      sku: p.sku,
      es_pesado: Boolean(p.es_pesado),
      sale_type: p.sale_type,
      saleType: p.sale_type,
      isWeightProduct: isWeight,
      unit: p.unidad,
    },
    codigo
  );
}

/** Busca un producto por código de barras, SKU, PLU o etiqueta variable de balanza. */
export async function buscarProductoPorCodigoEscaneado(
  codigo: string,
  signal?: AbortSignal
): Promise<Producto | null> {
  const clean = codigo.trim();
  if (!clean) return null;

  const decoded = decodeVariableWeightBarcode(clean);
  const plu = decoded.isVariableWeight ? decoded.plu : extractPluFromCode(clean);
  const variants = plu ? pluSearchVariants(plu) : [];

  const isProdWeighted = (p: Producto) =>
    Boolean(p.es_pesado) ||
    Boolean((p as any).is_weight_product) ||
    p.sale_type === 'weight' ||
    p.sale_type === 'both' ||
    ['lb', 'libra', 'kg', 'kilogramo'].includes((p.unidad || '').toLowerCase());

  const matchesLocal = (list: Producto[]) => {
    if (decoded.isVariableWeight) {
      const weightedMatch = list.find((p) => isProdWeighted(p) && productoCoincideConCodigo(p, clean));
      if (weightedMatch) return weightedMatch;
    }
    return list.find((p) => productoCoincideConCodigo(p, clean)) ?? null;
  };

  const sb = tryGetSupabase();

  // 1. Revisar primero si coincide en el catálogo maestro en memoria (0 ms de respuesta, 0 egress)
  for (const entry of masterCatalogCache.values()) {
    if (decoded.isVariableWeight) {
      const weightedMatch = entry.data.find((p) => isProdWeighted(p) && productoCoincideConCodigo(p, clean));
      if (weightedMatch) return await resolveSingleProductPresentation(weightedMatch, sb);
    }
    const found = entry.data.find((p) => productoCoincideConCodigo(p, clean));
    if (found) return await resolveSingleProductPresentation(found, sb);
  }

  if (!sb) {
    return matchesLocal(localAsProductos());
  }

  const orParts = new Set<string>([`codigo_barras.eq.${clean}`, `sku.eq.${clean}`]);

  // Soporte para equivalencias UPC (12 dígitos) y EAN-13 (13 dígitos) y ceros iniciales
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 2) {
    if (digits.length === 12) {
      orParts.add(`codigo_barras.eq.0${digits}`);
      orParts.add(`sku.eq.0${digits}`);
    } else if (digits.length === 13 && digits.startsWith('0')) {
      orParts.add(`codigo_barras.eq.${digits.slice(1)}`);
      orParts.add(`sku.eq.${digits.slice(1)}`);
    }
    const noZeros = digits.replace(/^0+/, '');
    if (noZeros.length >= 3 && noZeros !== digits) {
      orParts.add(`codigo_barras.eq.${noZeros}`);
      orParts.add(`sku.eq.${noZeros}`);
    }
  }

  if (plu) {
    for (const v of variants) {
      orParts.add(`plu.eq.${v}`);
      orParts.add(`codigo_barras.eq.${v}`);
      orParts.add(`sku.eq.${v}`);
      orParts.add(`sku.eq.PLU-${v}`);
    }
    orParts.add(`codigo_barras.eq.20${plu}`);
    orParts.add(`codigo_barras.eq.21${plu}`);
  }

  let query = sb.from('productos').select('*').or([...orParts].join(',')).limit(20);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error && isSchemaColumnError(error)) {
    const fallback = await obtenerProductoPorCodigoBarras(clean, signal);
    if (fallback) return fallback;
    return null;
  }
  if (error) throw errorSupabase(error);

  const rows = (data ?? []) as Producto[];
  const upper = clean.toUpperCase();
  const exactMatch = rows.find(
    (p) =>
      (p.codigo_barras && p.codigo_barras.trim().toUpperCase() === upper) ||
      (p.sku && p.sku.trim().toUpperCase() === upper)
  );
  if (exactMatch) return await resolveSingleProductPresentation(exactMatch, sb);

  const found = matchesLocal(rows);
  if (found) return await resolveSingleProductPresentation(found, sb);

  // Fallback con búsqueda ilike por si hay espacios o variaciones guardadas en BD (no aplicable a etiquetas de balanza)
  if (clean.length >= 2 && !decoded.isVariableWeight) {
    const sanitized = sanitizarBusquedaPostgrest(clean);
    if (sanitized) {
      const fallbackQuery = await sb
        .from('productos')
        .select('*')
        .or(`codigo_barras.ilike.%${sanitized}%,sku.ilike.%${sanitized}%,nombre.ilike.%${sanitized}%`)
        .limit(10);
      if (!fallbackQuery.error && fallbackQuery.data && fallbackQuery.data.length > 0) {
        const rows = fallbackQuery.data as Producto[];
        const cleanLower = clean.toLowerCase();
        // 1. Coincidencia exacta de nombre
        const exactName = rows.find((p) => (p.nombre || '').trim().toLowerCase() === cleanLower);
        if (exactName) return await resolveSingleProductPresentation(exactName, sb);
        // 2. Coincidencia por inicio de nombre
        const startName = rows.find((p) => (p.nombre || '').trim().toLowerCase().startsWith(cleanLower));
        if (startName) return await resolveSingleProductPresentation(startName, sb);
        // 3. Coincidencia local o primer resultado
        const finalCandidate = matchesLocal(rows) ?? rows[0];
        if (finalCandidate) return await resolveSingleProductPresentation(finalCandidate, sb);
      }
    }
  }

  return null;
}

export async function obtenerProductoPorId(id: string, signal?: AbortSignal): Promise<Producto | null> {
  const cleanId = (id || '').trim();
  if (!cleanId) return null;

  for (const entry of masterCatalogCache.values()) {
    const found = entry.data.find((p) => p.id === cleanId);
    if (found) return found;
  }
  for (const entry of productosCache.values()) {
    const found = entry.result.datos.find((p) => p.id === cleanId);
    if (found) return found;
  }

  const sb = tryGetSupabase();
  if (!sb) {
    return demoAsProductos().find((p) => p.id === cleanId) ?? null;
  }

  try {
    let query = sb.from('productos').select('*').eq('id', cleanId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (!error && data) {
      return await resolveSingleProductPresentation(data as Producto, sb);
    }
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.warn('Error en obtenerProductoPorId:', err);
  }

  return null;
}

export async function buscarProductosParaVinculacion(
  busqueda: string,
  excludeId?: string,
  signal?: AbortSignal
): Promise<Producto[]> {
  const qClean = (busqueda || '').trim();
  const qTokens = qClean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // 1. Revisar si tenemos productos en catálogo maestro
  let masterList: Producto[] = [];
  for (const entry of masterCatalogCache.values()) {
    if (entry.data && entry.data.length > masterList.length) {
      masterList = entry.data;
    }
  }

  if (masterList.length > 0) {
    let filtered = masterList.filter((p) => !excludeId || p.id !== excludeId);
    if (qTokens.length > 0) {
      filtered = filtered.filter((p) => {
        const normName = (p.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const normSku = (p.sku || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const normBar = (p.codigo_barras || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const normCat = (p.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return qTokens.every(
          (t) => normName.includes(t) || normSku.includes(t) || normBar.includes(t) || normCat.includes(t)
        );
      });
    }
    if (filtered.length > 0) {
      return filtered.slice(0, 60);
    }
    if (!qClean && masterList.length >= 1000) {
      return filtered.slice(0, 60);
    }
  }

  // 2. Consulta directa a Supabase
  const sb = tryGetSupabase();
  if (!sb) {
    const demo = demoAsProductos().filter((p) => !excludeId || p.id !== excludeId);
    if (qTokens.length === 0) return demo.slice(0, 50);
    return demo.filter((p) => {
      const normName = (p.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normSku = (p.sku || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return qTokens.every((t) => normName.includes(t) || normSku.includes(t));
    }).slice(0, 50);
  }

  try {
    let query = sb
      .from('productos')
      .select('*')
      .order('nombre');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const sanitized = sanitizarBusquedaPostgrest(busqueda || '');
    const tokens = sanitized.split(' ').filter(Boolean);

    if (tokens.length === 1) {
      const t = tokens[0];
      query = query.or(`nombre.ilike.%${t}%,sku.ilike.%${t}%,codigo_barras.ilike.%${t}%,categoria.ilike.%${t}%`);
    } else if (tokens.length > 1) {
      for (const t of tokens) {
        query = query.or(`nombre.ilike.%${t}%,sku.ilike.%${t}%,codigo_barras.ilike.%${t}%`);
      }
    }

    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query.limit(60);
    if (!error && data) {
      return (data as Producto[]) ?? [];
    }
  } catch (err) {
    if (isAbortError(err)) throw err;
    console.warn('Error en buscarProductosParaVinculacion:', err);
  }

  return [];
}

