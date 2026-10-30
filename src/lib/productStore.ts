import { initialProducts, type Product as PMProduct } from '@/lib/initialProducts';
import { isSupabaseConfigured } from '@/services/clienteSupabase';

export type ProductItem = PMProduct;

const STORAGE_KEY = 'mercato_products_store';
const DELETED_KEYS_STORAGE = 'mercato_deleted_product_keys';

export function getDeletedProductKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEYS_STORAGE);
    if (!raw) return new Set(['prod-00132', 'que-che-lb', '00132']);
    const parsed = JSON.parse(raw);
    const set = new Set<string>(
      Array.isArray(parsed) ? parsed.map((s) => String(s).toLowerCase().trim()) : []
    );
    // Asegurar que el queso cheddar demo eliminado quede siempre registrado
    set.add('prod-00132');
    set.add('que-che-lb');
    set.add('00132');
    return set;
  } catch {
    return new Set(['prod-00132', 'que-che-lb', '00132']);
  }
}

export function markProductAsDeleted(key: string): void {
  if (!key) return;
  try {
    const set = getDeletedProductKeys();
    set.add(key.toLowerCase().trim());
    localStorage.setItem(DELETED_KEYS_STORAGE, JSON.stringify([...set]));
  } catch (e) {
    console.error('Error saving deleted product key to localStorage', e);
  }
}

export function getStoredProducts(): ProductItem[] {
  // Con Supabase activo no devolvemos catálogo demo local.
  if (isSupabaseConfigured()) return [];

  const deletedKeys = getDeletedProductKeys();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const filtered = initialProducts.filter(
        (p) =>
          !deletedKeys.has(p.id.toLowerCase()) &&
          !deletedKeys.has((p.sku || '').toLowerCase()) &&
          !(p.barcode && deletedKeys.has(p.barcode.toLowerCase()))
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    }
    const parsed = JSON.parse(raw);
    const list: ProductItem[] = Array.isArray(parsed) && parsed.length > 0 ? parsed : initialProducts;
    return list.filter(
      (p) =>
        !deletedKeys.has(p.id.toLowerCase()) &&
        !deletedKeys.has((p.sku || '').toLowerCase()) &&
        !(p.barcode && deletedKeys.has(p.barcode.toLowerCase()))
    );
  } catch {
    return [];
  }
}

export function saveStoredProducts(products: ProductItem[]): void {
  try {
    const deletedKeys = getDeletedProductKeys();
    const filtered = products.filter(
      (p) =>
        !deletedKeys.has(p.id.toLowerCase()) &&
        !deletedKeys.has((p.sku || '').toLowerCase()) &&
        !(p.barcode && deletedKeys.has(p.barcode.toLowerCase()))
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error saving products to localStorage', e);
  }
}

export function addProductToStore(
  input: Omit<ProductItem, 'id' | 'stockStatus'> & { id?: string }
): ProductItem {
  const products = getStoredProducts();
  const stock = Math.max(0, input.currentStock ?? 0);
  let stockStatus: ProductItem['stockStatus'] = 'normal';
  if (stock === 0) stockStatus = 'out';
  else if (stock <= (input.minStock ?? 10)) stockStatus = 'low';

  const product: ProductItem = {
    id: input.id ?? `prod-${Date.now()}`,
    barcode: input.barcode || `GEN-${Date.now().toString().slice(-8)}`,
    sku: input.sku,
    name: input.name,
    category: input.category || 'General',
    brand: input.brand || '',
    unit: input.unit || 'Unidad',
    supplier: input.supplier || '',
    costPrice: input.costPrice ?? 0,
    salePrice: input.salePrice ?? 0,
    wholesalePrice: input.wholesalePrice ?? input.salePrice ?? 0,
    tax: input.tax ?? 0,
    minStock: input.minStock ?? 10,
    currentStock: stock,
    image: input.image || '',
    expiryDate: input.expiryDate ?? null,
    warranty: input.warranty || 'N/A',
    status: input.status ?? 'active',
    stockStatus,
    producto_base_id: input.producto_base_id ?? null,
    factor_conversion: input.factor_conversion ?? 1,
    unidad_base: input.unidad_base,
  };

  saveStoredProducts([product, ...products]);
  return product;
}

export function updateProductStockInStore(productIdOrSku: string, deltaQty: number): ProductItem[] {
  return updateProductPurchaseDataInStore(productIdOrSku, deltaQty);
}

export function updateProductPurchaseDataInStore(
  productIdOrSku: string,
  deltaQty: number,
  newCostPrice?: number,
  newSalePrice?: number
): ProductItem[] {
  const products = getStoredProducts();
  const updated = products.map((p) => {
    if (p.id === productIdOrSku || p.sku === productIdOrSku || p.barcode === productIdOrSku) {
      const rawStock = p.currentStock + deltaQty;
      const newStock = Math.max(0, Math.round(rawStock * 1000) / 1000);
      let stockStatus: 'normal' | 'low' | 'out' = 'normal';
      if (newStock === 0) stockStatus = 'out';
      else if (newStock <= p.minStock) stockStatus = 'low';

      return {
        ...p,
        currentStock: newStock,
        stockStatus,
        ...(newCostPrice !== undefined && newCostPrice > 0 ? { costPrice: newCostPrice } : {}),
        ...(newSalePrice !== undefined && newSalePrice > 0 ? { salePrice: newSalePrice } : {}),
      };
    }
    return p;
  });
  saveStoredProducts(updated);
  return updated;
}

