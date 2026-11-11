import { DELETE_SKU } from '@/lib/posStore';
import { initialProducts } from '@/lib/initialProducts';
import {
  extractPluFromCode,
  isVariableWeightBarcode,
  pluSearchVariants,
  productMatchesScanCode,
} from '@/lib/scaleBarcode';
import type { ScaleProduct } from './scaleUtils';
import type { SaleType, WeightUnit } from '@/types/database';

export interface PosCatalogProduct {
  id: string;
  sku: string;
  barcode: string;
  plu: string;
  name: string;
  category: string;
  price: number;
  salePrice: number;
  wholesalePrice?: number;
  cost: number;
  costPrice: number;
  stock: number;
  currentStock: number;
  minStock: number;
  stockStatus: 'normal' | 'low' | 'out';
  unit: string;
  tax: number;
  image: string;
  lowStock: boolean;
  outOfStock: boolean;
  status: 'active' | 'inactive' | 'discontinued';
  isWeighted: boolean;
  isWeightProduct: boolean;
  saleType: SaleType;
  weightUnit: WeightUnit;
  pricePerWeight: number;
  producto_base_id?: string | null;
  factor_conversion?: number;
  unidad_base?: string | null;
  composite_items?: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
  }>;
  nameLower: string;
  skuLower: string;
  barcodeLower: string;
  pluLower: string;
  categoryLower: string;
  scaleProduct: ScaleProduct;
}

export interface PosCatalogIndex {
  items: PosCatalogProduct[];
  panelItems: PosCatalogProduct[];
  byId: Map<string, PosCatalogProduct>;
  bySkuLower: Map<string, PosCatalogProduct>;
  byBarcodeLower: Map<string, PosCatalogProduct>;
  byPluLower: Map<string, PosCatalogProduct>;
  scaleCatalog: ScaleProduct[];
}

export function buildPosCatalogIndex(
  catalogProducts?: any[],
  allowDemoFallback = true
): PosCatalogIndex {
  const hasStore = Array.isArray(catalogProducts) && catalogProducts.length > 0;
  const rawSource = hasStore
    ? catalogProducts
    : allowDemoFallback
      ? initialProducts
      : [];

  const activeRaw: any[] = [];
  const rawById = new Map<string, any>();
  const nonSixRaw: Array<{ item: any; nameLower: string }> = [];

  for (let i = 0; i < rawSource.length; i++) {
    const p = rawSource[i];
    if (!p) continue;
    if (p.status !== 'active' && p.status !== undefined) continue;
    activeRaw.push(p);
    if (p.id) rawById.set(String(p.id), p);
    const nl = String(p.name || '').toLowerCase();
    if (!nl.includes('six')) {
      nonSixRaw.push({ item: p, nameLower: nl });
    }
  }

  const items: PosCatalogProduct[] = [];
  const panelItems: PosCatalogProduct[] = [];
  const byId = new Map<string, PosCatalogProduct>();
  const bySkuLower = new Map<string, PosCatalogProduct>();
  const byBarcodeLower = new Map<string, PosCatalogProduct>();
  const byPluLower = new Map<string, PosCatalogProduct>();
  const scaleCatalog: ScaleProduct[] = [];

  for (let i = 0; i < activeRaw.length; i++) {
    const p = activeRaw[i];
    const pUnit = String(p.unit || '');
    const pName = String(p.name || '');
    const pUnitLower = pUnit.toLowerCase();
    const pNameLower = pName.toLowerCase();

    const isWeighted =
      Boolean(p.isWeightProduct) ||
      Boolean(p.es_pesado) ||
      p.saleType === 'weight' ||
      p.saleType === 'both' ||
      (!hasStore && (pUnitLower.includes('lb') || pUnitLower.includes('kg')));

    const resolvedUnit = isWeighted
      ? pUnit && !['unidad', 'ud', 'und', 'unidades'].includes(pUnitLower)
        ? pUnit
        : p.weightUnit || 'lb'
      : pUnit || 'Und';

    let effectiveStock = Number(p.currentStock ?? 0);
    const isSixPack = pUnitLower.includes('six') || pNameLower.includes('six');

    if (p.producto_base_id) {
      const base = rawById.get(String(p.producto_base_id));
      const rawFactor = Number(p.factor_conversion || 1);
      const factor = rawFactor > 0 ? rawFactor : isSixPack ? 6 : 1;
      if (base) {
        const derived = Math.floor(Number(base.currentStock || 0) / factor);
        if (derived > effectiveStock) effectiveStock = derived;
      }
    } else if (Array.isArray(p.composite_items) && p.composite_items.length > 0) {
      let minDerived = Infinity;
      for (let j = 0; j < p.composite_items.length; j++) {
        const ci = p.composite_items[j];
        const compId = ci?.product_id || ci?.productId;
        const cp = compId ? rawById.get(String(compId)) : undefined;
        const q = Math.max(1, Number(ci?.quantity || 1));
        const val = cp ? Math.floor(Number(cp.currentStock || 0) / q) : 0;
        if (val < minDerived) minDerived = val;
      }
      if (minDerived !== Infinity && minDerived > effectiveStock) {
        effectiveStock = minDerived;
      }
    } else if (isSixPack && effectiveStock <= 0) {
      const baseName = pNameLower.replace(/six\s*pack/gi, '').replace(/sixpack/gi, '').trim();
      if (baseName.length >= 3) {
        for (let k = 0; k < nonSixRaw.length; k++) {
          const entry = nonSixRaw[k];
          if (entry.item.id !== p.id && entry.nameLower.includes(baseName)) {
            const baseStock = Number(entry.item.currentStock || 0);
            if (baseStock >= 6) {
              effectiveStock = Math.floor(baseStock / 6);
            }
            break;
          }
        }
      }
    }

    const outOfStock = effectiveStock <= 0;
    const minStock = Number(p.minStock ?? 5);
    const lowStock = !outOfStock && effectiveStock <= minStock;
    const stockStatus: 'normal' | 'low' | 'out' = outOfStock
      ? 'out'
      : lowStock
        ? 'low'
        : 'normal';

    const salePrice = Number(p.salePrice ?? p.price ?? 0);
    const wholesalePrice = p.wholesalePrice ? Number(p.wholesalePrice) : undefined;
    const costPrice = Number(p.costPrice ?? p.cost ?? 0);
    const sku = String(p.sku ?? '');
    const barcode = String(p.barcode ?? '');
    const plu = String(p.plu ?? '');
    const category = String(p.category ?? '');
    const image = String(p.image ?? '');

    const scaleProduct: ScaleProduct = {
      productId: String(p.id),
      name: pName,
      sku,
      plu,
      price: salePrice,
      wholesalePrice,
      cost: costPrice,
      tax: Number(p.tax ?? 0),
      unit: resolvedUnit || 'lb',
      barcode,
      category,
      image,
      isWeightProduct: isWeighted,
    };

    const indexed: PosCatalogProduct = {
      id: String(p.id),
      sku,
      barcode,
      plu,
      name: pName,
      category,
      price: salePrice,
      salePrice,
      wholesalePrice,
      cost: costPrice,
      costPrice,
      stock: effectiveStock,
      currentStock: effectiveStock,
      minStock,
      stockStatus,
      unit: resolvedUnit,
      tax: Number(p.tax ?? 0),
      image,
      lowStock,
      outOfStock,
      status: (p.status ?? 'active') as 'active' | 'inactive' | 'discontinued',
      isWeighted,
      isWeightProduct: isWeighted,
      saleType: (p.saleType ?? (isWeighted ? 'weight' : 'unit')) as SaleType,
      weightUnit: (p.weightUnit ?? 'lb') as WeightUnit,
      pricePerWeight: Number(p.pricePerWeight ?? salePrice),
      producto_base_id: p.producto_base_id ?? null,
      factor_conversion: p.factor_conversion,
      unidad_base: p.unidad_base ?? null,
      composite_items: p.composite_items,
      nameLower: pNameLower,
      skuLower: sku.toLowerCase(),
      barcodeLower: barcode.toLowerCase(),
      pluLower: plu.toLowerCase(),
      categoryLower: category.toLowerCase(),
      scaleProduct,
    };

    items.push(indexed);
    if (indexed.sku !== DELETE_SKU) {
      panelItems.push(indexed);
    }
    scaleCatalog.push(scaleProduct);

    byId.set(indexed.id, indexed);
    const skuKey = indexed.skuLower.trim();
    if (skuKey && !bySkuLower.has(skuKey)) {
      bySkuLower.set(skuKey, indexed);
    }
    const barKey = indexed.barcodeLower.trim();
    if (barKey && !byBarcodeLower.has(barKey)) {
      byBarcodeLower.set(barKey, indexed);
    }
    const pluKey = indexed.pluLower.trim();
    if (pluKey && !byPluLower.has(pluKey)) {
      byPluLower.set(pluKey, indexed);
    }
  }

  return {
    items,
    panelItems,
    byId,
    bySkuLower,
    byBarcodeLower,
    byPluLower,
    scaleCatalog,
  };
}

export function findExactScanProduct(
  index: PosCatalogIndex,
  rawQuery: string
): PosCatalogProduct | undefined {
  const q = rawQuery.trim();
  if (!q) return undefined;
  const qLower = q.toLowerCase();

  const direct = index.byBarcodeLower.get(qLower) ?? index.bySkuLower.get(qLower);
  if (direct) return direct;

  if (/^\d+$/.test(q) && q.length <= 5) {
    const variants = pluSearchVariants(q);
    for (const v of variants) {
      const hit = index.byPluLower.get(v.toLowerCase());
      if (hit) return hit;
    }
  } else {
    const pluHit = index.byPluLower.get(qLower);
    if (pluHit) return pluHit;
  }

  return index.items.find((p) => productMatchesScanCode(p, q));
}

export function searchPosCatalog(
  index: PosCatalogIndex,
  rawQuery: string,
  options?: {
    excludeDeleteSku?: boolean;
    includeCategory?: boolean;
    ranked?: boolean;
    limit?: number;
  }
): PosCatalogProduct[] {
  const trimmed = rawQuery.trim();
  const baseList = options?.excludeDeleteSku ? index.panelItems : index.items;

  if (!trimmed) {
    if (options?.limit !== undefined && options.limit >= 0) {
      return baseList.slice(0, options.limit);
    }
    return baseList;
  }

  const effectiveTerm = isVariableWeightBarcode(trimmed)
    ? extractPluFromCode(trimmed)
    : trimmed;
  const q = effectiveTerm.toLowerCase();
  const includeCategory = Boolean(options?.includeCategory);
  const checkNumericScan = q.length >= 4 && /^\d+$/.test(trimmed);

  if (!options?.ranked) {
    const matches: PosCatalogProduct[] = [];
    const maxItems = options?.limit ?? Infinity;
    for (let i = 0; i < baseList.length; i++) {
      const p = baseList[i];
      if (
        p.nameLower.includes(q) ||
        p.barcodeLower.includes(q) ||
        p.skuLower.includes(q) ||
        (p.pluLower && p.pluLower.includes(q)) ||
        (includeCategory && p.categoryLower.includes(q)) ||
        (checkNumericScan && productMatchesScanCode(p, trimmed))
      ) {
        matches.push(p);
        if (matches.length >= maxItems) break;
      }
    }
    return matches;
  }

  // Búsqueda rankeada: 5 cubetas por relevancia para evitar ordenar todo el catálogo
  const buckets: [
    PosCatalogProduct[],
    PosCatalogProduct[],
    PosCatalogProduct[],
    PosCatalogProduct[],
    PosCatalogProduct[],
  ] = [[], [], [], [], []];

  for (let i = 0; i < baseList.length; i++) {
    const p = baseList[i];
    const nameMatch = p.nameLower.includes(q);
    const barcodeMatch = p.barcodeLower.includes(q);
    const skuMatch = p.skuLower.includes(q);
    const pluMatch = p.pluLower ? p.pluLower.includes(q) : false;
    const catMatch = includeCategory && p.categoryLower.includes(q);
    const scanMatch = !nameMatch && !barcodeMatch && !skuMatch && !pluMatch && checkNumericScan && productMatchesScanCode(p, trimmed);

    if (!nameMatch && !barcodeMatch && !skuMatch && !pluMatch && !catMatch && !scanMatch) {
      continue;
    }

    const n = p.nameLower.trim();
    const b = p.barcodeLower.trim();
    const s = p.skuLower.trim();

    if (n === q || b === q || s === q) {
      buckets[0].push(p);
    } else if (n.startsWith(q)) {
      buckets[1].push(p);
    } else if (b.startsWith(q) || s.startsWith(q)) {
      buckets[2].push(p);
    } else if (nameMatch) {
      buckets[3].push(p);
    } else {
      buckets[4].push(p);
    }
  }

  const limit = options?.limit ?? 30;
  const result: PosCatalogProduct[] = [];
  for (let b = 0; b < buckets.length && result.length < limit; b++) {
    const bucket = buckets[b];
    if (bucket.length === 0) continue;
    bucket.sort((a, z) => (a.nameLower < z.nameLower ? -1 : a.nameLower > z.nameLower ? 1 : 0));
    const remaining = limit - result.length;
    if (bucket.length <= remaining) {
      result.push(...bucket);
    } else {
      result.push(...bucket.slice(0, remaining));
    }
  }
  return result;
}

