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
    cashier: 'Sra. Alba Iris Martinez',
    role: 'Administrador General',
    isAdminBox: true,
    open: true,
    openedAt: '07:30 AM',
    salesToday: 132660.16,
    tickets: 85,
    cartItems: 4,
    currentTotal: 1850.00,
    movements: [
      { time: '07:30 AM', type: 'Apertura', detail: 'Fondo de caja inicial', amount: 10000 },
      { time: '09:15 AM', type: 'Venta', detail: 'FAC-00101 · Efectivo', amount: 12500 },
      { time: '10:40 AM', type: 'Venta', detail: 'FAC-00102 · Tarjeta', amount: 43200 },
      { time: '11:05 AM', type: 'Gasto', detail: 'Insumos de empaque', amount: -1500 },
      { time: '12:30 PM', type: 'Venta', detail: 'FAC-00103 · Transferencia', amount: 68460.16 },
      { time: 'Ahora', type: 'En curso', detail: 'Carrito activo · 4 ítems', amount: 1850 },
    ],
  },
  {
    id: '2',
    label: 'Caja #2 - Mostrador Principal',
    cashier: 'Luisa Fernández',
    role: 'Cajero Senior',
    isAdminBox: false,
    open: true,
    openedAt: '08:00 AM',
    salesToday: 45600.00,
    tickets: 52,
    cartItems: 2,
    currentTotal: 940.00,
    movements: [
      { time: '08:00 AM', type: 'Apertura', detail: 'Fondo inicial', amount: 5000 },
      { time: '09:50 AM', type: 'Venta', detail: 'FAC-00201 · Efectivo', amount: 3920 },
      { time: '11:20 AM', type: 'Devolución', detail: 'DEV-0014', amount: -450 },
      { time: '01:00 PM', type: 'Venta', detail: 'FAC-00205 · Tarjeta', amount: 12500 },
      { time: 'Ahora', type: 'En curso', detail: 'Carrito activo · 2 ítems', amount: 940 },
    ],
  },
  {
    id: '3',
    label: 'Caja #3 - Servicio Rápido / Express',
    cashier: 'Carlos López',
    role: 'Cajero POS',
    isAdminBox: false,
    open: true,
    openedAt: '08:30 AM',
    salesToday: 28400.00,
    tickets: 41,
    cartItems: 0,
    currentTotal: 0,
    movements: [
      { time: '08:30 AM', type: 'Apertura', detail: 'Fondo inicial', amount: 3000 },
      { time: '10:15 AM', type: 'Venta', detail: 'FAC-00301 · Efectivo', amount: 8400 },
      { time: '12:00 PM', type: 'Venta', detail: 'FAC-00304 · Tarjeta', amount: 17000 },
    ],
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
    movements: [
      { time: 'Ayer', type: 'Cierre', detail: 'Turno finalizado', amount: 0 },
    ],
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
