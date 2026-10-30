import { tryGetSupabase } from './clienteSupabase';

export interface PresentacionProducto {
  id: string;
  producto_base_id: string;
  nombre_presentacion: string;
  codigo_barras?: string | null;
  sku?: string | null;
  factor_conversion: number;
  precio_venta: number;
  precio_costo: number;
  precio_mayorista?: number;
  unidad_medida: string;
  es_principal?: boolean;
  activo: boolean;
}

export interface NuevaPresentacionInput {
  producto_base_id: string;
  nombre_presentacion: string;
  codigo_barras?: string | null;
  sku?: string | null;
  factor_conversion: number;
  precio_venta: number;
  precio_costo?: number;
  precio_mayorista?: number;
  unidad_medida?: string;
  es_principal?: boolean;
}

const STORAGE_KEY = 'mercato_presentaciones_local';

export const PRESENTACIONES_DEFAULT: PresentacionProducto[] = [
  {
    id: 'pres-fardo-pureza-sana',
    producto_base_id: '81e6bc06-de76-4ff5-8ada-50fa961ef542', // Botella De Agua Pureza Sana
    nombre_presentacion: 'Fardo De Agua Pureza Sana',
    codigo_barras: '23653',
    sku: '23653',
    factor_conversion: 20,
    precio_venta: 125,
    precio_costo: 107.14,
    precio_mayorista: 120,
    unidad_medida: 'Fardo (20 unidades)',
    es_principal: false,
    activo: true,
  },
  {
    id: 'pres-huevo-carton-0686',
    producto_base_id: '08fa89bf-4252-41ee-9bb4-4261eb856a15', // HUEVOS MEDIO CARTON (43 en stock)
    nombre_presentacion: 'HUEVOS 1 CARTON',
    codigo_barras: '0686',
    sku: '0686',
    factor_conversion: 2,
    precio_venta: 205,
    precio_costo: 170,
    precio_mayorista: 195,
    unidad_medida: 'Cartón (2 medios cartones)',
    es_principal: false,
    activo: true,
  },
  {
    id: 'pres-huevo-carton-0875',
    producto_base_id: '05241bcd-43a5-4c4c-821d-acabdb827566', // Huevo Medio Carton (224 en stock)
    nombre_presentacion: 'Huevo 1 carton',
    codigo_barras: '0875',
    sku: '0875',
    factor_conversion: 2,
    precio_venta: 210,
    precio_costo: 175,
    precio_mayorista: 200,
    unidad_medida: 'Cartón (2 medios cartones)',
    es_principal: false,
    activo: true,
  },
];

export function getLocalPresentaciones(): PresentacionProducto[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return PRESENTACIONES_DEFAULT;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PRESENTACIONES_DEFAULT;
  } catch {
    return PRESENTACIONES_DEFAULT;
  }
}

export function saveLocalPresentaciones(data: PresentacionProducto[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

/**
 * Calcula las existencias disponibles de una presentación comercial a partir del stock base.
 * Evita fracciones erróneas redondeando hacia abajo (piso).
 */
export function calcularStockPresentacion(stockBase: number, factorConversion: number): number {
  if (factorConversion <= 0) return 0;
  return Math.floor(Math.max(0, stockBase) / factorConversion);
}

/**
 * Convierte una cantidad de presentación comprada/vendida a la unidad base.
 */
export function convertirAUnidadBase(cantidadPresentacion: number, factorConversion: number): number {
  return Math.round((Number(cantidadPresentacion || 0) * (factorConversion || 1)) * 1000) / 1000;
}

export function esPresentacionVinculada(producto: {
  producto_base_id?: string | null;
  factor_conversion?: number | null;
}): boolean {
  return Boolean(producto.producto_base_id) && Number(producto.factor_conversion || 1) > 1;
}

/** Al vender/comprar un fardo o cartón vinculado, el movimiento va al producto contenido. */
export function movimientoInventarioPresentacion(
  producto: {
    id: string;
    producto_base_id?: string | null;
    factor_conversion?: number | null;
  },
  cantidad: number
): { productoId: string; cantidad: number } {
  if (esPresentacionVinculada(producto) && producto.producto_base_id) {
    return {
      productoId: producto.producto_base_id,
      cantidad: convertirAUnidadBase(cantidad, Number(producto.factor_conversion)),
    };
  }
  return { productoId: producto.id, cantidad: Number(cantidad || 0) };
}

export async function obtenerPresentaciones(productoBaseId?: string): Promise<PresentacionProducto[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    const local = getLocalPresentaciones();
    return productoBaseId ? local.filter((p) => p.producto_base_id === productoBaseId && p.activo) : local;
  }

  try {
    let query = sb
      .from('presentaciones_producto')
      .select('*')
      .eq('activo', true)
      .order('nombre_presentacion');

    if (productoBaseId) {
      query = query.eq('producto_base_id', productoBaseId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      const local = getLocalPresentaciones();
      return productoBaseId ? local.filter((p) => p.producto_base_id === productoBaseId && p.activo) : local;
    }

    return data.map((r: any) => ({
      id: r.id,
      producto_base_id: r.producto_base_id,
      nombre_presentacion: r.nombre_presentacion,
      codigo_barras: r.codigo_barras,
      sku: r.sku,
      factor_conversion: Number(r.factor_conversion || 1),
      precio_venta: Number(r.precio_venta || 0),
      precio_costo: Number(r.precio_costo || 0),
      precio_mayorista: Number(r.precio_mayorista || 0),
      unidad_medida: r.unidad_medida || 'unidad',
      es_principal: Boolean(r.es_principal),
      activo: Boolean(r.activo),
    }));
  } catch {
    const local = getLocalPresentaciones();
    return productoBaseId ? local.filter((p) => p.producto_base_id === productoBaseId && p.activo) : local;
  }
}

export async function buscarPresentacionPorCodigo(codigo: string): Promise<PresentacionProducto | null> {
  const clean = codigo.trim().toLowerCase();
  const list = await obtenerPresentaciones();
  return (
    list.find(
      (p) =>
        (p.codigo_barras && p.codigo_barras.toLowerCase() === clean) ||
        (p.sku && p.sku.toLowerCase() === clean)
    ) ?? null
  );
}

export async function crearPresentacion(input: NuevaPresentacionInput): Promise<PresentacionProducto> {
  const newPres: PresentacionProducto = {
    id: `pres-${Date.now()}`,
    producto_base_id: input.producto_base_id,
    nombre_presentacion: input.nombre_presentacion.trim(),
    codigo_barras: input.codigo_barras?.trim() || null,
    sku: input.sku?.trim() || null,
    factor_conversion: Math.max(1, Number(input.factor_conversion || 1)),
    precio_venta: Number(input.precio_venta || 0),
    precio_costo: Number(input.precio_costo || 0),
    precio_mayorista: Number(input.precio_mayorista || 0),
    unidad_medida: input.unidad_medida || 'unidad',
    es_principal: Boolean(input.es_principal),
    activo: true,
  };

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('presentaciones_producto')
        .insert({
          producto_base_id: newPres.producto_base_id,
          nombre_presentacion: newPres.nombre_presentacion,
          codigo_barras: newPres.codigo_barras,
          sku: newPres.sku,
          factor_conversion: newPres.factor_conversion,
          precio_venta: newPres.precio_venta,
          precio_costo: newPres.precio_costo,
          precio_mayorista: newPres.precio_mayorista,
          unidad_medida: newPres.unidad_medida,
          es_principal: newPres.es_principal,
          activo: true,
        })
        .select()
        .single();

      if (!error && data) {
        newPres.id = data.id;
      }
    } catch {
      // Local fallback
    }
  }

  const current = getLocalPresentaciones();
  saveLocalPresentaciones([newPres, ...current]);
  return newPres;
}
