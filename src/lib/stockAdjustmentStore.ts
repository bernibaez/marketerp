import { getStoredProducts, updateProductStockInStore, ProductItem } from './productStore';

export interface StockAdjustmentItem {
  id: string;
  code: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  type: 'entrada' | 'salida' | 'perdida';
  previousQty: number;
  newQty: number;
  qty: number; // Variación absoluta
  unitPrice?: number;
  totalLoss?: number;
  reason: string;
  date: string;
  time: string;
  responsible: string;
}

const STORAGE_KEY = 'mercato_stock_adjustments';

export const INITIAL_ADJUSTMENTS: StockAdjustmentItem[] = [];

export function getStoredAdjustments(): StockAdjustmentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAdjustments(adjustments: StockAdjustmentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adjustments));
  } catch (e) {
    console.error('Error writing stock adjustments to localStorage', e);
  }
}

export function createBlockStockAdjustment(
  adjustmentsToApply: {
    product: ProductItem;
    newQty: number;
    reason: string;
    unitPrice?: number;
    code?: string;
  }[],
  responsibleUser: string = 'Admin General',
  batchCode?: string
): StockAdjustmentItem[] {
  const currentHistory = getStoredAdjustments();
  const newEntries: StockAdjustmentItem[] = [];
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const defaultSeq = String(currentHistory.length + 1).padStart(3, '0');
  const sharedCode = batchCode || `AJU-${defaultSeq}`;

  adjustmentsToApply.forEach((adj, index) => {
    const delta = adj.newQty - adj.product.currentStock;
    if (delta === 0) return; // No change

    const type: 'entrada' | 'salida' | 'perdida' = delta > 0 ? 'entrada' : (adj.reason.toLowerCase().includes('perd') || adj.reason.toLowerCase().includes('venc') ? 'perdida' : 'salida');
    const entryCode = adj.code || sharedCode;
    const unitPrice = adj.unitPrice ?? adj.product.costPrice ?? adj.product.salePrice ?? 0;
    const absQty = Math.abs(delta);
    const totalLoss = type !== 'entrada' ? Math.round(absQty * unitPrice * 100) / 100 : 0;

    const entry: StockAdjustmentItem = {
      id: `adj-${Date.now()}-${index}`,
      code: entryCode,
      productId: adj.product.id,
      productName: adj.product.name,
      sku: adj.product.sku,
      category: adj.product.category,
      type,
      previousQty: adj.product.currentStock,
      newQty: adj.newQty,
      qty: absQty,
      unitPrice,
      totalLoss,
      reason: adj.reason || 'Ajuste de inventario en bloque',
      date: dateStr,
      time: timeStr,
      responsible: responsibleUser,
    };

    // Update stock in product store
    updateProductStockInStore(adj.product.id, delta);
    newEntries.push(entry);
  });

  const updatedHistory = [...newEntries, ...currentHistory];
  saveStoredAdjustments(updatedHistory);
  return updatedHistory;
}
