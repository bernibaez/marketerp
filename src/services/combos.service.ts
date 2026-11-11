import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { COMBO_COLUMNS, type Combo, type ComboItem, type TipoDescuento } from '@/types/database';
import { trackPosCacheHit, trackPosNetworkRequest } from '@/lib/posPerfMetrics';
import {
  getCombos as getLocalCombos,
  saveOrUpdateCombo,
  deleteCombo as deleteLocalCombo,
  getComboById as getLocalComboById,
  type Combo as UiCombo,
  type ComboItem as UiComboItem,
  type PricingMode,
} from '@/lib/comboStore';

const DESC_UI_A_DB: Record<PricingMode, TipoDescuento> = {
  fixed: 'fijo',
  percent: 'porcentaje',
  amount: 'monto',
};

const DESC_DB_A_UI: Record<TipoDescuento, PricingMode> = {
  fijo: 'fixed',
  porcentaje: 'percent',
  monto: 'amount',
};

export type ComboConItems = Combo & { items: ComboItem[] };

type ItemConMeta = ComboItem & { _nombre?: string; _sku?: string };

export function comboDbAUi(c: Combo, items: ComboItem[] = []): UiCombo {
  const normal = Number(c.precio_normal);
  const price = Number(c.precio_venta);
  const savingsAmount = Math.max(0, normal - price);
  const savingsPercent = normal > 0 ? (savingsAmount / normal) * 100 : 0;
  return {
    id: c.id,
    name: c.nombre,
    code: c.codigo,
    barcode: c.codigo_barras ?? '',
    description: c.descripcion ?? '',
    category: c.categoria,
    price,
    totalCost: Number(c.precio_costo_total),
    normalPrice: normal,
    discountType: c.tipo_descuento ? DESC_DB_A_UI[c.tipo_descuento] : 'fixed',
    discountValue: Number(c.valor_descuento),
    savingsAmount,
    savingsPercent,
    marginPercent: Number(c.porcentaje_margen),
    active: c.activo,
    visibleInPos: c.visible_en_pos,
    allowSaleWithoutStock: c.permitir_venta_sin_stock,
    applyTax: false,
    allBranches: true,
    branches: [],
    startDate: c.fecha_inicio ?? '',
    endDate: c.fecha_fin ?? '',
    startTime: '00:00',
    endTime: '23:59',
    image: c.imagen_url ?? '',
    items: items.map((it): UiComboItem => {
      const meta = it as ItemConMeta;
      return {
        id: it.id,
        productId: it.producto_id,
        sku: meta._sku ?? '',
        name: meta._nombre ?? '',
        quantity: it.cantidad,
        unitPrice: Number(it.precio_unitario),
        costPrice: Number(it.costo_unitario),
        subtotal: Number(it.subtotal),
      };
    }),
    createdAt: c.creado_en ?? new Date().toISOString(),
    updatedAt: c.actualizado_en ?? new Date().toISOString(),
  };
}

export function uiComboADb(c: UiCombo): { combo: Partial<Combo>; items: Omit<ComboItem, 'id'>[] } {
  return {
    combo: {
      codigo: c.code,
      codigo_barras: c.barcode || null,
      nombre: c.name,
      descripcion: c.description || null,
      categoria: c.category,
      precio_venta: c.price,
      precio_costo_total: c.totalCost ?? 0,
      precio_normal: c.normalPrice,
      tipo_descuento: DESC_UI_A_DB[c.discountType],
      valor_descuento: c.discountValue,
      porcentaje_margen: c.marginPercent,
      activo: c.active,
      visible_en_pos: c.visibleInPos,
      permitir_venta_sin_stock: c.allowSaleWithoutStock,
      fecha_inicio: c.startDate || null,
      fecha_fin: c.endDate || null,
      imagen_url: c.image || null,
    },
    items: c.items.map((it) => ({
      combo_id: c.id,
      producto_id: it.productId,
      cantidad: it.quantity,
      costo_unitario: it.costPrice,
      precio_unitario: it.unitPrice,
      subtotal: it.subtotal,
    })),
  };
}

const COMBOS_CACHE_TTL = 5 * 60_000;
const combosCache = new Map<'activos' | 'todos', { timestamp: number; data: ComboConItems[] }>();
const combosInFlight = new Map<'activos' | 'todos', Promise<ComboConItems[]>>();

export function invalidarCacheCombos(): void {
  combosCache.clear();
  combosInFlight.clear();
}

export function obtenerComboDesdeCachePorId(id: string): ComboConItems | null {
  const cleanId = (id || '').trim();
  if (!cleanId) return null;
  for (const entry of combosCache.values()) {
    const found = entry.data.find((c) => c.id === cleanId);
    if (found) return found;
  }
  return null;
}

export async function obtenerCombos(opts?: {
  soloActivos?: boolean;
  signal?: AbortSignal;
}): Promise<ComboConItems[]> {
  if (opts?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const key: 'activos' | 'todos' = opts?.soloActivos ? 'activos' : 'todos';
  const now = Date.now();

  const cached = combosCache.get(key);
  if (cached && now - cached.timestamp < COMBOS_CACHE_TTL) {
    trackPosCacheHit('combos');
    return [...cached.data];
  }
  if (key === 'activos') {
    const allCached = combosCache.get('todos');
    if (allCached && now - allCached.timestamp < COMBOS_CACHE_TTL) {
      const filtered = allCached.data.filter((c) => c.activo);
      combosCache.set('activos', { timestamp: allCached.timestamp, data: filtered });
      trackPosCacheHit('combos');
      return [...filtered];
    }
  }

  if (!opts?.signal) {
    const inFlight = combosInFlight.get(key);
    if (inFlight) return inFlight;
  }

  const run = async (): Promise<ComboConItems[]> => {
    const sb = tryGetSupabase();
    if (!sb) {
      const localList = getLocalCombos()
        .filter((c) => !opts?.soloActivos || c.active)
        .map((c) => {
          const { combo } = uiComboADb(c);
          return {
            ...(combo as Combo),
            id: c.id,
            items: c.items.map((it) => ({
              id: it.id,
              combo_id: c.id,
              producto_id: it.productId,
              cantidad: it.quantity,
              costo_unitario: it.costPrice,
              precio_unitario: it.unitPrice,
              subtotal: it.subtotal,
              _nombre: it.name,
              _sku: it.sku,
            })) as ComboItem[],
          };
        });
      combosCache.set(key, { timestamp: Date.now(), data: localList });
      return localList;
    }

    trackPosNetworkRequest('combos');
    let query = sb.from('combos').select(COMBO_COLUMNS).order('nombre');
    if (opts?.soloActivos) query = query.eq('activo', true);
    if (opts?.signal) query = query.abortSignal(opts.signal);
    const { data, error } = await query;
    if (error) throw error;

    const combos = (data ?? []) as Combo[];
    if (combos.length === 0) {
      if (!opts?.signal?.aborted) {
        combosCache.set(key, { timestamp: Date.now(), data: [] });
      }
      return [];
    }

    const ids = combos.map((c) => c.id);
    const { data: items, error: itemsErr } = await sb
      .from('combo_items')
      .select('id, combo_id, producto_id, cantidad, costo_unitario, precio_unitario, subtotal')
      .in('combo_id', ids);
    if (itemsErr) throw itemsErr;

    const byCombo = new Map<string, ItemConMeta[]>();
    for (const it of (items ?? []) as ComboItem[]) {
      const arr = byCombo.get(it.combo_id) ?? [];
      arr.push(it);
      byCombo.set(it.combo_id, arr);
    }

    const productIds = [...new Set(((items ?? []) as ComboItem[]).map((it) => it.producto_id).filter(Boolean))];
    const productMeta = new Map<string, { nombre: string; sku: string }>();
    if (productIds.length > 0) {
      const { data: prods } = await sb.from('productos').select('id, nombre, sku').in('id', productIds);
      for (const p of prods ?? []) {
        productMeta.set(String((p as { id: string }).id), {
          nombre: String((p as { nombre: string }).nombre ?? ''),
          sku: String((p as { sku: string }).sku ?? ''),
        });
      }
    }

    const result = combos.map((c) => ({
      ...c,
      items: (byCombo.get(c.id) ?? []).map((it) => ({
        ...it,
        _nombre: productMeta.get(it.producto_id)?.nombre ?? '',
        _sku: productMeta.get(it.producto_id)?.sku ?? '',
      })),
    }));

    if (!opts?.signal?.aborted) {
      combosCache.set(key, { timestamp: Date.now(), data: result });
    }
    return result;
  };

  if (!opts?.signal) {
    const promise = run().finally(() => {
      combosInFlight.delete(key);
    });
    combosInFlight.set(key, promise);
    return promise;
  }

  return run();
}

export async function obtenerComboPorId(id: string): Promise<ComboConItems | null> {
  const all = await obtenerCombos();
  return all.find((c) => c.id === id) ?? null;
}

export async function guardarCombo(uiCombo: UiCombo): Promise<string> {
  if (!isSupabaseConfigured()) {
    saveOrUpdateCombo(uiCombo);
    invalidarCacheCombos();
    return uiCombo.id;
  }

  const sb = getSupabase();
  const { combo, items } = uiComboADb(uiCombo);
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // IDs temporales del formulario (cmb-*, new-*, etc.) no son UUID de Supabase.
  const isNew = !uiCombo.id || !uuidRe.test(uiCombo.id);

  let comboId = uiCombo.id;
  if (isNew) {
    const { data, error } = await sb
      .from('combos')
      .insert({ ...combo, actualizado_en: new Date().toISOString() })
      .select('id')
      .single();
    if (error) throw error;
    comboId = data.id as string;
  } else {
    const { error } = await sb
      .from('combos')
      .update({ ...combo, actualizado_en: new Date().toISOString() })
      .eq('id', comboId);
    if (error) throw error;
    await sb.from('combo_items').delete().eq('combo_id', comboId);
  }

  if (items.length > 0) {
    const { error: itemsError } = await sb.from('combo_items').insert(
      items.map((it) => ({ ...it, combo_id: comboId }))
    );
    if (itemsError) throw itemsError;
  }

  invalidarCacheCombos();
  return comboId;
}

export async function eliminarCombo(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteLocalCombo(id);
    invalidarCacheCombos();
    return;
  }
  const sb = getSupabase();
  const { error } = await sb.from('combos').delete().eq('id', id);
  if (error) throw error;
  invalidarCacheCombos();
}

export { getLocalComboById, comboDbAUi as mapComboToUi };
