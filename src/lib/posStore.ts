/** Local persistence for POS / caja features (no backend). */

export type PaymentSplit = {
  cash: number;
  card: number;
  transfer: number;
  credit: number;
};

export type HeldSale = {
  id: string;
  label: string;
  cart: unknown[];
  customer: unknown | null;
  globalDiscount: number;
  savedAt: string;
  cashierId?: string;
  cashierName?: string;
  cajaId?: string;
  cajaLabel?: string;
  total?: number;
};

export type PosReturnStatus = 'pending' | 'approved' | 'rejected';

export type ReturnReceiptItem = {
  sku: string;
  name: string;
  qty: number;
  price: number;
  subtotal?: number;
};

export type PosReturn = {
  id: string;
  code: string;
  saleCode: string;
  customer: string;
  date: string;
  time: string;
  user: string;
  cashier: string;
  products: ReturnReceiptItem[];
  items?: ReturnReceiptItem[];
  total: number;
  reason: string;
  method: 'cash' | 'card' | 'credit_note' | 'exchange';
  type: 'partial' | 'full';
  status: PosReturnStatus;
  authorizedBy?: string;
  reviewedBy?: string;
  reviewDate?: string;
  rejectionReason?: string;
};

export type CashExpense = {
  id: string;
  code: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  time: string;
  user: string;
  cashier: string;
  cajaId?: string;
  cierreId?: string;
  created_at?: string;
};

export type MaletaCut = {
  id: string;
  cutNumber: string;
  date: string;
  time: string;
  user: string;
  cashier: string;
  branch: string;
  expectedCash: number;
  bagAmount: number;
  remainingCash: number;
  salesTotal: number;
  expensesTotal: number;
  refundsTotal: number;
  payments: PaymentSplit;
  productsSold: { sku: string; barcode: string; name: string; qty: number; total: number }[];
  brandsSold: { brand: string; qty: number; total: number }[];
  status: 'completed' | 'void';
};

export type ScaleDevice = {
  id: string;
  name: string;
  ip: string;
  port: string;
  active: boolean;
  lastSync: string | null;
};

const KEYS = {
  held: 'mercato_held_sales',
  returns: 'mercato_pos_returns',
  expenses: 'mercato_pos_expenses',
  maleta: 'mercato_maleta_cuts',
  scales: 'mercato_scales',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const DELETE_SKU = 'SKU-ELIMINAR';

export function getHeldSales(): HeldSale[] {
  return read(KEYS.held, []);
}

export function saveHeldSale(sale: HeldSale) {
  const list = getHeldSales().filter((s) => s.id !== sale.id);
  write(KEYS.held, [sale, ...list]);
}

export function removeHeldSale(id: string) {
  write(
    KEYS.held,
    getHeldSales().filter((s) => s.id !== id)
  );
}

export function clearHeldSales() {
  write(KEYS.held, [] as HeldSale[]);
}

export function getPosReturns(): PosReturn[] {
  return read(KEYS.returns, []);
}

export function addPosReturn(item: PosReturn) {
  write(KEYS.returns, [item, ...getPosReturns()]);
}

export function updatePosReturnStatus(id: string, status: PosReturnStatus, reviewerName: string, rejectionReason?: string) {
  const list = getPosReturns().map((r) => {
    if (r.id === id) {
      return {
        ...r,
        status,
        reviewedBy: reviewerName,
        authorizedBy: status === 'approved' ? reviewerName : r.authorizedBy,
        reviewDate: new Date().toISOString().slice(0, 10),
        rejectionReason: rejectionReason || r.rejectionReason,
      };
    }
    return r;
  });
  write(KEYS.returns, list);
}

export function getCashExpenses(): CashExpense[] {
  return read(KEYS.expenses, []);
}

export function addCashExpense(item: CashExpense) {
  write(KEYS.expenses, [item, ...getCashExpenses()]);
}

export function getMaletaCuts(): MaletaCut[] {
  return read(KEYS.maleta, []);
}

export function addMaletaCut(item: MaletaCut) {
  write(KEYS.maleta, [item, ...getMaletaCuts()]);
}

export function getScales(): ScaleDevice[] {
  const defaults: ScaleDevice[] = [
    { id: 'sc-1', name: 'Balanza Carnes', ip: '192.168.1.50', port: '4001', active: true, lastSync: null },
    { id: 'sc-2', name: 'Balanza Frutas', ip: '192.168.1.51', port: '4001', active: false, lastSync: null },
  ];
  const stored = read<ScaleDevice[] | null>(KEYS.scales, null);
  return stored ?? defaults;
}

export function saveScales(list: ScaleDevice[]) {
  write(KEYS.scales, list);
}

export function nextCode(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}
