import type { Customer } from '@/pages/point-of-sale-pos/components/POSTerminal';

const STORAGE_KEY = 'mercato_pos_customers';

const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 'cust-001', name: 'Rosa Martínez', phone: '809-555-0142', credit: 5000 },
  { id: 'cust-002', name: 'Pedro Sánchez', phone: '829-555-0287', credit: 12000 },
  { id: 'cust-003', name: 'María Torres', phone: '849-555-0398', credit: 2500 },
  { id: 'cust-004', name: 'Fernando Díaz', phone: '809-555-0511', credit: 8000 },
  { id: 'cust-005', name: 'Josefa Guerrero', phone: '829-555-0623', credit: 3500 },
];

export function getPosCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOMERS));
      return [...DEFAULT_CUSTOMERS];
    }
    const parsed = JSON.parse(raw) as Customer[];
    return Array.isArray(parsed) ? parsed : [...DEFAULT_CUSTOMERS];
  } catch {
    return [...DEFAULT_CUSTOMERS];
  }
}

export function savePosCustomers(customers: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

export function addPosCustomer(input: {
  name: string;
  phone?: string;
  credit?: number;
  rnc_cedula?: string | null;
  direccion?: string | null;
  tipo_cliente?: string | null;
  tipo_ncf?: string | null;
}): Customer {
  const customers = getPosCustomers();
  const customer: Customer = {
    id: `cust-${Date.now()}`,
    name: input.name.trim(),
    phone: (input.phone ?? '').trim(),
    credit: Math.max(0, Number(input.credit) || 0),
    rnc_cedula: input.rnc_cedula?.trim() || null,
    direccion: input.direccion?.trim() || null,
    tipo_cliente: input.tipo_cliente || 'final',
    tipo_ncf: input.tipo_ncf || null,
  };
  const next = [customer, ...customers];
  savePosCustomers(next);
  return customer;
}
