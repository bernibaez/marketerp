import { getStoredProducts, updateProductStockInStore } from './productStore';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import type { ProductItem } from './productStore';

export interface ComboItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
}

export type PricingMode = 'fixed' | 'percent' | 'amount';

export interface Combo {
  id: string;
  name: string;
  code: string;
  barcode: string;
  description: string;
  category: string;
  price: number; // Precio Venta del Combo
  totalCost?: number; // Precio Costo Total del Combo (componentes)
  normalPrice: number; // Precio Normal Suministros
  discountType: PricingMode;
  discountValue: number;
  savingsAmount: number;
  savingsPercent: number;
  marginPercent: number;
  active: boolean;
  visibleInPos: boolean;
  allowSaleWithoutStock: boolean;
  applyTax: boolean;
  allBranches: boolean;
  branches: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  image: string;
  items: ComboItem[];
  createdAt: string;
  updatedAt: string;
  salesCount?: number;
}

export interface ComboSaleRecord {
  id: string;
  comboId: string;
  comboName: string;
  comboCode: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  savingsGiven: number;
  profitGenerated: number;
  date: string;
  time: string;
  branch: string;
  items: { productId: string; name: string; qty: number }[];
}

const COMBOS_KEY = 'mercato_combos_list';
const COMBO_SALES_KEY = 'mercato_combo_sales_history';

export const DEFAULT_COMBOS: Combo[] = [
  {
    id: 'cmb-001',
    name: 'Combo Desayuno Familiar',
    code: 'CMB-DES-01',
    barcode: '7892000100101',
    description: 'Desayuno completo con Pan de Agua, Huevos x12, Jugo de Naranja y Leche Evaporada.',
    category: 'Desayunos & Ofertas',
    price: 399,
    totalCost: 260,
    normalPrice: 467,
    discountType: 'fixed',
    discountValue: 399,
    savingsAmount: 68,
    savingsPercent: 14.56,
    marginPercent: 34.8,
    active: true,
    visibleInPos: true,
    allowSaleWithoutStock: false,
    applyTax: false,
    allBranches: true,
    branches: ['Sucursal Principal', 'Sucursal Norte', 'Sucursal Este'],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    startTime: '06:00',
    endTime: '12:00',
    image: '',
    items: [
      { id: 'ci-1', productId: 'prod-007', sku: 'PAN-AGU-UN', name: 'Pan de Agua', quantity: 2, unitPrice: 12, costPrice: 7, subtotal: 24 },
      { id: 'ci-2', productId: 'prod-006', sku: 'HUE-X12', name: 'Huevos x12', quantity: 1, unitPrice: 165, costPrice: 120, subtotal: 165 },
      { id: 'ci-3', productId: 'prod-010', sku: 'JUG-NAR-1L', name: 'Jugo Naranja 1L', quantity: 1, unitPrice: 145, costPrice: 105, subtotal: 145 },
      { id: 'ci-4', productId: 'prod-004', sku: 'LEC-EVA-410', name: 'Leche Evaporada 410g', quantity: 1, unitPrice: 133, costPrice: 108, subtotal: 133 },
    ],
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    salesCount: 142,
  },
  {
    id: 'cmb-002',
    name: 'Pack Granos del Mes',
    code: 'CMB-GRA-02',
    barcode: '7892000200102',
    description: 'Paquete de despensa esencial con Arroz Selecto 5lb, Habichuelas Negras, Aceite y Azúcar.',
    category: 'Despensa',
    price: 999,
    totalCost: 874,
    normalPrice: 1195,
    discountType: 'percent',
    discountValue: 16.4,
    savingsAmount: 196,
    savingsPercent: 16.4,
    marginPercent: 28.5,
    active: true,
    visibleInPos: true,
    allowSaleWithoutStock: false,
    applyTax: false,
    allBranches: true,
    branches: ['Sucursal Principal', 'Sucursal Norte', 'Sucursal Este'],
    startDate: '2026-02-01',
    endDate: '2026-12-31',
    startTime: '00:00',
    endTime: '23:59',
    image: '',
    items: [
      { id: 'ci-5', productId: 'prod-001', sku: 'ARR-SEL-5LB', name: 'Arroz Selecto 5lb', quantity: 2, unitPrice: 285, costPrice: 210, subtotal: 570 },
      { id: 'ci-6', productId: 'prod-008', sku: 'HAB-NEG-1LB', name: 'Habichuelas Negras 1lb', quantity: 3, unitPrice: 85, costPrice: 62, subtotal: 255 },
      { id: 'ci-7', productId: 'prod-002', sku: 'ACE-VEG-1L', name: 'Aceite Vegetal 1L', quantity: 1, unitPrice: 195, costPrice: 140, subtotal: 195 },
      { id: 'ci-8', productId: 'prod-005', sku: 'AZU-BLA-5LB', name: 'Azúcar Blanca 5lb', quantity: 1, unitPrice: 175, costPrice: 128, subtotal: 175 },
    ],
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-06-15T11:00:00.000Z',
    salesCount: 218,
  },
  {
    id: 'cmb-003',
    name: 'Combo Limpieza Total',
    code: 'CMB-LIM-03',
    barcode: '7892000300103',
    description: 'Ahorro especial en Detergente Líquido y Papel Higiénico para el hogar.',
    category: 'Hogar & Limpieza',
    price: 820,
    totalCost: 666,
    normalPrice: 960,
    discountType: 'amount',
    discountValue: 140,
    savingsAmount: 140,
    savingsPercent: 14.58,
    marginPercent: 32.1,
    active: true,
    visibleInPos: true,
    allowSaleWithoutStock: true,
    applyTax: true,
    allBranches: false,
    branches: ['Sucursal Principal', 'Sucursal Norte'],
    startDate: '2026-03-01',
    endDate: '2026-11-30',
    startTime: '08:00',
    endTime: '20:00',
    image: '',
    items: [
      { id: 'ci-9', productId: 'prod-011', sku: 'DET-LIQ-1.5', name: 'Detergente Líq. 1.5L', quantity: 2, unitPrice: 285, costPrice: 195, subtotal: 570 },
      { id: 'ci-10', productId: 'prod-013', sku: 'PAP-HIG-X4', name: 'Papel Higiénico x4', quantity: 2, unitPrice: 195, costPrice: 138, subtotal: 390 },
    ],
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-07-02T14:30:00.000Z',
    salesCount: 89,
  },
  {
    id: 'cmb-004',
    name: 'Combo Snack & Bebida',
    code: 'CMB-SNA-04',
    barcode: '7892000400104',
    description: 'Combina tus papitas Lay\'s preferidas con Jugo de Naranja y Yogur Griego.',
    category: 'Meriendas',
    price: 415,
    totalCost: 349,
    normalPrice: 490,
    discountType: 'percent',
    discountValue: 15,
    savingsAmount: 75,
    savingsPercent: 15.3,
    marginPercent: 30.2,
    active: false,
    visibleInPos: false,
    allowSaleWithoutStock: false,
    applyTax: true,
    allBranches: true,
    branches: ['Sucursal Principal', 'Sucursal Norte', 'Sucursal Este', 'Sucursal Sur'],
    startDate: '2026-04-01',
    endDate: '2026-08-31',
    startTime: '10:00',
    endTime: '18:00',
    image: '',
    items: [
      { id: 'ci-11', productId: 'prod-016', sku: 'CHI-LAY-42', name: 'Chips Lay\'s 42g', quantity: 2, unitPrice: 75, costPrice: 52, subtotal: 150 },
      { id: 'ci-12', productId: 'prod-010', sku: 'JUG-NAR-1L', name: 'Jugo Naranja 1L', quantity: 1, unitPrice: 145, costPrice: 105, subtotal: 145 },
      { id: 'ci-13', productId: 'prod-012', sku: 'YOG-GRI-500', name: 'Yogur Griego 500g', quantity: 1, unitPrice: 195, costPrice: 140, subtotal: 195 },
    ],
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-07-10T16:00:00.000Z',
    salesCount: 45,
  },
];

export const DEFAULT_COMBO_SALES: ComboSaleRecord[] = [
  {
    id: 'csal-001',
    comboId: 'cmb-001',
    comboName: 'Combo Desayuno Familiar',
    comboCode: 'CMB-DES-01',
    qty: 3,
    unitPrice: 399,
    totalAmount: 1197,
    savingsGiven: 204,
    profitGenerated: 417,
    date: new Date().toISOString().slice(0, 10),
    time: '09:30',
    branch: 'Sucursal Principal',
    items: [
      { productId: 'prod-007', name: 'Pan de Agua', qty: 6 },
      { productId: 'prod-006', name: 'Huevos x12', qty: 3 },
      { productId: 'prod-010', name: 'Jugo Naranja 1L', qty: 3 },
      { productId: 'prod-004', name: 'Leche Evaporada 410g', qty: 3 },
    ],
  },
  {
    id: 'csal-002',
    comboId: 'cmb-002',
    comboName: 'Pack Granos del Mes',
    comboCode: 'CMB-GRA-02',
    qty: 2,
    unitPrice: 999,
    totalAmount: 1998,
    savingsGiven: 392,
    profitGenerated: 570,
    date: new Date().toISOString().slice(0, 10),
    time: '11:15',
    branch: 'Sucursal Norte',
    items: [
      { productId: 'prod-001', name: 'Arroz Selecto 5lb', qty: 4 },
      { productId: 'prod-008', name: 'Habichuelas Negras 1lb', qty: 6 },
      { productId: 'prod-002', name: 'Aceite Vegetal 1L', qty: 2 },
      { productId: 'prod-005', name: 'Azúcar Blanca 5lb', qty: 2 },
    ],
  },
];

export function getCombos(): Combo[] {
  // Con Supabase activo no sembramos catálogo demo local.
  if (isSupabaseConfigured()) return [];

  try {
    const raw = localStorage.getItem(COMBOS_KEY);
    if (!raw) {
      localStorage.setItem(COMBOS_KEY, JSON.stringify(DEFAULT_COMBOS));
      return DEFAULT_COMBOS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((c: Combo) => ({
        ...c,
        totalCost: c.totalCost ?? (c.items ? c.items.reduce((s, i) => s + (i.costPrice || 0) * (i.quantity || 1), 0) : 0),
      }));
    }
    return DEFAULT_COMBOS;
  } catch {
    return DEFAULT_COMBOS;
  }
}

export function saveCombos(combos: Combo[]): void {
  try {
    localStorage.setItem(COMBOS_KEY, JSON.stringify(combos));
  } catch (e) {
    console.error('Error writing combos to localStorage', e);
  }
}

export function getComboById(id: string): Combo | undefined {
  return getCombos().find((c) => c.id === id || c.code === id || c.barcode === id);
}

export function saveOrUpdateCombo(combo: Combo): Combo[] {
  const current = getCombos();
  const index = current.findIndex((c) => c.id === combo.id);
  let updated: Combo[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...combo, updatedAt: new Date().toISOString() };
  } else {
    updated = [{ ...combo, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...current];
  }
  saveCombos(updated);
  return updated;
}

export function deleteCombo(id: string): Combo[] {
  const updated = getCombos().filter((c) => c.id !== id);
  saveCombos(updated);
  return updated;
}

export function duplicateCombo(id: string): { updatedList: Combo[]; newCombo: Combo } | null {
  const target = getComboById(id);
  if (!target) return null;
  const count = getCombos().length + 1;
  const newCombo: Combo = {
    ...target,
    id: `cmb-${Date.now()}`,
    name: `${target.name} (Copia)`,
    code: `CMB-${String(count).padStart(3, '0')}`,
    barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    salesCount: 0,
  };
  const updatedList = [newCombo, ...getCombos()];
  saveCombos(updatedList);
  return { updatedList, newCombo };
}

export function toggleComboStatus(id: string): Combo[] {
  const updated = getCombos().map((c) => (c.id === id ? { ...c, active: !c.active } : c));
  saveCombos(updated);
  return updated;
}

export function getComboSalesHistory(): ComboSaleRecord[] {
  try {
    const raw = localStorage.getItem(COMBO_SALES_KEY);
    if (!raw) {
      localStorage.setItem(COMBO_SALES_KEY, JSON.stringify(DEFAULT_COMBO_SALES));
      return DEFAULT_COMBO_SALES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_COMBO_SALES;
  } catch {
    return DEFAULT_COMBO_SALES;
  }
}

export function recordComboSale(
  combo: Combo,
  qty: number,
  branch: string = 'Sucursal Principal',
  deductStock: boolean = false
): { success: boolean; error?: string } {
  // Check stock requirement for each component item
  const products = getStoredProducts();
  const missingItems: { name: string; required: number; available: number }[] = [];

  for (const item of combo.items) {
    const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
    const requiredTotal = item.quantity * qty;
    const available = prod ? prod.currentStock : 0;
    if (!combo.allowSaleWithoutStock && available < requiredTotal) {
      missingItems.push({
        name: item.name,
        required: requiredTotal,
        available,
      });
    }
  }

  if (missingItems.length > 0) {
    const details = missingItems.map((m) => `${m.name} (Requiere ${m.required}, Stock: ${m.available})`).join(', ');
    return {
      success: false,
      error: `Stock insuficiente para componer el combo: ${details}`,
    };
  }

  // Deduct inventory for EACH component product ONLY if deductStock is requested
  // (In normal sales checkout, ventas.service.ts already handles the exact deduction and Kardex to prevent duplicate deductions)
  if (deductStock) {
    for (const item of combo.items) {
      const requiredTotal = item.quantity * qty;
      updateProductStockInStore(item.productId || item.sku, -requiredTotal);
    }
  }

  // Calculate profit and savings
  const totalCost = combo.items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0) * qty;
  const totalSale = combo.price * qty;
  const profitGenerated = Math.max(0, totalSale - totalCost);
  const savingsGiven = Math.max(0, combo.savingsAmount * qty);

  const saleRecord: ComboSaleRecord = {
    id: `csal-${Date.now()}`,
    comboId: combo.id,
    comboName: combo.name,
    comboCode: combo.code,
    qty,
    unitPrice: combo.price,
    totalAmount: totalSale,
    savingsGiven,
    profitGenerated,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    branch,
    items: combo.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.quantity * qty })),
  };

  const currentHistory = getComboSalesHistory();
  localStorage.setItem(COMBO_SALES_KEY, JSON.stringify([saleRecord, ...currentHistory]));

  // Increment sales count on the combo
  const updatedCombos = getCombos().map((c) =>
    c.id === combo.id ? { ...c, salesCount: (c.salesCount || 0) + qty } : c
  );
  saveCombos(updatedCombos);

  return { success: true };
}

/** Check if combo has enough stock in components */
export function checkComboStockAvailability(
  combo: Combo,
  qtyMultiplier: number = 1,
  catalog?: ProductItem[]
): {
  available: boolean;
  missingItems: { productId: string; sku: string; name: string; required: number; available: number }[];
} {
  const products = catalog ?? (isSupabaseConfigured() ? [] : getStoredProducts());
  const missingItems: { productId: string; sku: string; name: string; required: number; available: number }[] = [];

  for (const item of combo.items) {
    const prod = products.find((p) => p.id === item.productId || p.sku === item.sku);
    const required = item.quantity * qtyMultiplier;
    const available = prod ? prod.currentStock : 0;
    if (available < required) {
      missingItems.push({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        required,
        available,
      });
    }
  }

  return {
    available: missingItems.length === 0 || combo.allowSaleWithoutStock,
    missingItems,
  };
}
