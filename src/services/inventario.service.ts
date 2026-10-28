import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { AJUSTE_COLUMNS, type AjusteStock, type TipoAjuste } from '@/types/database';
import {
  createBlockStockAdjustment,
  getStoredAdjustments,
} from '@/lib/stockAdjustmentStore';
import { initialProducts } from '@/lib/initialProducts';
import { updateProductStockInStore, getStoredProducts } from '@/lib/productStore';

export type AjusteItemPayload = {
  producto_id: string;
  tipo_ajuste: TipoAjuste;
  cantidad_nueva?: number;
  cantidad_variacion?: number;
  motivo: string;
  responsable_id?: string | null;
  codigo?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function procesarAjusteStockBloque(
  items: AjusteItemPayload[]
): Promise<{ ajustes: number; ids: string[] }> {
  if (!isSupabaseConfigured()) {
    const products = getStoredProducts();
    const mapped = items
      .map((it) => {
        const product = products.find((p) => p.id === it.producto_id);
        if (!product) return null;
        const newQty =
          it.cantidad_nueva != null
            ? it.cantidad_nueva
            : it.tipo_ajuste === 'entrada'
              ? product.currentStock + (it.cantidad_variacion ?? 0)
              : Math.max(0, product.currentStock - Math.abs(it.cantidad_variacion ?? 0));
        return { product, newQty, reason: it.motivo };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const result = createBlockStockAdjustment(mapped, 'Sistema');
    return { ajustes: result.length, ids: result.map((r) => r.id) };
  }

  const validUuidItems = items
    .filter((it) => UUID_RE.test(it.producto_id))
    .map((it) => ({
      ...it,
      cantidad_nueva: it.cantidad_nueva != null ? Math.round(it.cantidad_nueva) : undefined,
      cantidad_variacion: it.cantidad_variacion != null ? Math.round(it.cantidad_variacion) : undefined,
    }));
  const nonUuidItems = items.filter((it) => !UUID_RE.test(it.producto_id));

  let dbCount = 0;
  let dbIds: string[] = [];

  if (validUuidItems.length > 0) {
    const sb = getSupabase();
    const { data, error } = await sb.rpc('procesar_ajuste_stock_bloque', {
      p_items: validUuidItems,
    });
    if (error) throw error;
    if (data) {
      const res = data as { ajustes?: number; ids?: string[] };
      dbCount = res.ajustes ?? 0;
      dbIds = res.ids ?? [];
    }
  }

  if (nonUuidItems.length > 0) {
    nonUuidItems.forEach((it) => {
      const demoProd = initialProducts.find((p) => p.id === it.producto_id || p.sku === it.producto_id);
      if (demoProd && it.cantidad_nueva != null) {
        const delta = it.cantidad_nueva - demoProd.currentStock;
        updateProductStockInStore(demoProd.id, delta);
        demoProd.currentStock = it.cantidad_nueva;
      }
    });
  }

  // Sincronizar el store local de productos para mantener la UI al día
  items.forEach((it) => {
    if (it.cantidad_nueva != null) {
      const stored = getStoredProducts().find((p) => p.id === it.producto_id || p.sku === it.producto_id);
      if (stored) {
        const delta = it.cantidad_nueva - stored.currentStock;
        updateProductStockInStore(stored.id, delta);
      }
    }
  });

  return { ajustes: dbCount + nonUuidItems.length, ids: dbIds };
}

export async function obtenerHistorialAjustes(params: {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  tipo?: TipoAjuste | 'todos';
  signal?: AbortSignal;
}): Promise<{ datos: AjusteStock[]; total: number }> {
  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 20;
  const desde = (pagina - 1) * limite;
  const hasta = desde + limite - 1;

  const sb = tryGetSupabase();
  if (!sb) {
    let list = getStoredAdjustments().map(
      (a): AjusteStock => ({
        id: a.id,
        codigo: a.code,
        producto_id: a.productId,
        tipo_ajuste: a.type,
        cantidad_anterior: a.previousQty,
        cantidad_nueva: a.newQty,
        cantidad_variacion: a.type === 'entrada' ? a.qty : -Math.abs(a.qty),
        motivo: a.reason,
        responsable_id: null,
        creado_en: a.date,
        productos: {
          id: a.productId,
          nombre: a.productName,
          sku: a.sku,
          categoria: a.category,
        },
      })
    );
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.codigo.toLowerCase().includes(q) ||
          a.motivo.toLowerCase().includes(q) ||
          (a.productos?.nombre && a.productos.nombre.toLowerCase().includes(q)) ||
          (a.productos?.sku && a.productos.sku.toLowerCase().includes(q))
      );
    }
    if (params.tipo && params.tipo !== 'todos') {
      list = list.filter((a) => a.tipo_ajuste === params.tipo);
    }
    return { datos: list.slice(desde, hasta + 1), total: list.length };
  }

  let query = sb
    .from('ajustes_stock')
    .select(
      `
      id, codigo, producto_id, tipo_ajuste, cantidad_anterior, cantidad_nueva, cantidad_variacion, motivo, responsable_id, creado_en,
      productos ( id, nombre, sku, categoria, unidad )
    `,
      { count: 'exact' }
    )
    .order('creado_en', { ascending: false })
    .range(desde, hasta);

  if (params.busqueda?.trim()) {
    const q = params.busqueda.trim();
    query = query.or(`codigo.ilike.%${q}%,motivo.ilike.%${q}%`);
  }
  if (params.tipo && params.tipo !== 'todos') {
    query = query.eq('tipo_ajuste', params.tipo);
  }
  if (params.signal) query = query.abortSignal(params.signal);

  const { data, error, count } = await query;
  if (error) {
    // Si falla el join por restricciones de RLS, reintentar con columnas simples
    const fallbackQuery = sb
      .from('ajustes_stock')
      .select(AJUSTE_COLUMNS, { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(desde, hasta);
    if (params.busqueda?.trim()) {
      const q = params.busqueda.trim();
      fallbackQuery.or(`codigo.ilike.%${q}%,motivo.ilike.%${q}%`);
    }
    if (params.tipo && params.tipo !== 'todos') {
      fallbackQuery.eq('tipo_ajuste', params.tipo);
    }
    const { data: fbData, error: fbErr, count: fbCount } = await fallbackQuery;
    if (fbErr) throw fbErr;
    return { datos: (fbData ?? []) as AjusteStock[], total: fbCount ?? 0 };
  }

  const datos = (data ?? []).map((row: any): AjusteStock => {
    const prod = Array.isArray(row.productos) ? row.productos[0] : row.productos;
    return {
      id: row.id,
      codigo: row.codigo,
      producto_id: row.producto_id,
      tipo_ajuste: row.tipo_ajuste,
      cantidad_anterior: Number(row.cantidad_anterior ?? 0),
      cantidad_nueva: Number(row.cantidad_nueva ?? 0),
      cantidad_variacion: Number(row.cantidad_variacion ?? 0),
      motivo: row.motivo ?? '',
      responsable_id: row.responsable_id ?? null,
      creado_en: row.creado_en,
      productos: prod
        ? {
            id: prod.id,
            nombre: prod.nombre,
            sku: prod.sku,
            categoria: prod.categoria,
            unidad: prod.unidad,
          }
        : null,
    };
  });

  return { datos, total: count ?? 0 };
}
