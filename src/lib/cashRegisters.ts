export type CashRegisterId = string;

export type CashRegisterSession = {
  id: CashRegisterId;
  dbId?: string;
  codigo?: string;
  label: string;
  cashier: string;
  cashierId?: string;
  cierreId?: string;
  role: string;
  isAdminBox?: boolean;
  open: boolean;
  openedAt: string;
  openedAtIso?: string;
  baseCash?: number;
  cashSales?: number;
  cardSales?: number;
  transferSales?: number;
  expectedCash?: number;
  salesToday: number;
  tickets: number;
  cartItems: number;
  currentTotal: number;
  movements: { time: string; type: string; detail: string; amount: number }[];
};

export const CASH_REGISTERS: CashRegisterSession[] = [
  {
    id: '1',
    label: 'Caja #1 - Administrador',
    cashier: 'Sin turno activo',
    role: 'Administrador General',
    isAdminBox: true,
    open: false,
    openedAt: '—',
    salesToday: 0,
    tickets: 0,
    cartItems: 0,
    currentTotal: 0,
    movements: [],
  },
  {
    id: '2',
    label: 'Caja #2 - Mostrador Principal',
    cashier: 'Sin turno activo',
    role: 'Cajero Senior',
    isAdminBox: false,
    open: false,
    openedAt: '—',
    salesToday: 0,
    tickets: 0,
    cartItems: 0,
    currentTotal: 0,
    movements: [],
  },
  {
    id: '3',
    label: 'Caja #3 - Servicio Rápido / Express',
    cashier: 'Sin turno activo',
    role: 'Cajero POS',
    isAdminBox: false,
    open: false,
    openedAt: '—',
    salesToday: 0,
    tickets: 0,
    cartItems: 0,
    currentTotal: 0,
    movements: [],
  },
  {
    id: '4',
    label: 'Caja #4 - Sucursal Remanente',
    cashier: 'Disponible / Sin asignar',
    role: 'Turno Tarde',
    isAdminBox: false,
    open: false,
    openedAt: '—',
    salesToday: 0,
    tickets: 0,
    cartItems: 0,
    currentTotal: 0,
    movements: [],
  },
];

export function getCashRegister(id: CashRegisterId) {
  return findCashRegister(CASH_REGISTERS, id) || CASH_REGISTERS[0];
}

export function registerMatchesId(
  reg: Pick<CashRegisterSession, 'id' | 'dbId' | 'codigo'>,
  id?: string | null
): boolean {
  if (!id) return false;
  const target = String(id).trim();
  return [reg.id, reg.dbId, reg.codigo].some((v) => v != null && String(v).trim() === target);
}

export function findCashRegister(
  registers: CashRegisterSession[],
  id?: string | null
): CashRegisterSession | undefined {
  if (!id) return undefined;
  return registers.find((r) => registerMatchesId(r, id));
}

function normalizeNameText(val?: string | null): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bkeyla\b/g, 'keila')
    .replace(/\bcheila\b/g, 'sheila')
    .replace(/\bbeiliz\b/g, 'beilis');
}

const GENERIC_REGISTER_WORDS = new Set([
  'caja',
  'cajero',
  'cajera',
  'principal',
  'mostrador',
  'servicio',
  'rapido',
  'express',
  'sucursal',
  'remanente',
  'administrador',
  'admin',
  'general',
  'disponible',
  'turno',
  'activo',
]);

export function extractUserNameTokens(userName?: string | null, username?: string | null): string[] {
  const tokens = new Set<string>();
  const normName = normalizeNameText(userName);
  for (const part of normName.split(/[^a-z0-9]+/)) {
    if (part.length >= 3 && !GENERIC_REGISTER_WORDS.has(part)) {
      tokens.add(part);
    }
  }
  const normUser = normalizeNameText(String(username || '').split('@')[0]);
  for (const part of normUser.split(/[^a-z0-9]+/)) {
    if (part.length >= 3 && !GENERIC_REGISTER_WORDS.has(part)) {
      tokens.add(part);
    }
  }
  return Array.from(tokens);
}

export function isSameCashierName(a?: string | null, b?: string | null): boolean {
  const na = normalizeNameText(a);
  const nb = normalizeNameText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tokensA = extractUserNameTokens(a);
  const tokensB = extractUserNameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  // Primer nombre coincide
  return tokensA[0] === tokensB[0];
}

export function doesRegisterMatchUser(
  registerLabel?: string | null,
  userName?: string | null,
  username?: string | null
): boolean {
  const normLabel = normalizeNameText(registerLabel);
  if (!normLabel) return false;
  const labelTokens = normLabel
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !GENERIC_REGISTER_WORDS.has(p));
  if (labelTokens.length === 0) return false;
  const userTokens = extractUserNameTokens(userName, username);
  if (userTokens.length === 0) return false;
  return userTokens.some((ut) => labelTokens.includes(ut));
}

