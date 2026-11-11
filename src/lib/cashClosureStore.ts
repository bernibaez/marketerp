/** Persistence and state management for Daily Cash Closures (Cierre de Caja Diario) */

export type CashClosure = {
  id: string;
  code: string;
  userId: string;
  username: string;
  userName: string;
  openedAt: string; // ISO or YYYY-MM-DD HH:mm
  closedAt: string; // ISO or YYYY-MM-DD HH:mm
  date: string; // YYYY-MM-DD
  cashRegisterId: string;
  cashRegisterLabel: string;
  
  totalSales: number;
  
  totalCash: number;
  totalCard: number;
  cardCount: number;
  
  totalTransfer: number;
  transferCount: number;
  
  totalCheque: number;
  chequeCount: number;

  totalCredit: number;
  creditCount: number;
  
  expectedCash: number;
  countedCash: number;
  difference: number; // countedCash - expectedCash
  
  baseCash?: number;
  totalEntradas?: number;
  totalRetiros?: number;
  totalDevoluciones?: number;
  status?: 'abierta' | 'cerrada';
  notes?: string;
  isInconsistent?: boolean;
  inconsistencyReasons?: string[];
};

const STORAGE_KEY = 'mercato_cash_closures';

const INITIAL_CLOSURES: CashClosure[] = [];

export function getCashClosures(): CashClosure[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCashClosure(closure: CashClosure): CashClosure[] {
  const current = getCashClosures();
  const updated = [closure, ...current.filter((c) => c.id !== closure.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeCashClosure(id: string): CashClosure[] {
  const current = getCashClosures();
  const updated = current.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
<<<<<<< HEAD
=======

>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
