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
