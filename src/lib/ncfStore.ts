/** Local persistence & validation for Dominican Republic DGII Fiscal Invoicing (NCF) */

export type NCFType = 'B01' | 'B02' | 'B14' | 'B15' | 'B04';

export interface NCFTypeInfo {
  type: NCFType;
  name: string;
  description: string;
  requiresRnc: boolean;
}

export const NCF_TYPES: Record<NCFType, NCFTypeInfo> = {
  B01: {
    type: 'B01',
    name: 'Factura de Crédito Fiscal (B01)',
    description: 'Ventas a empresas registradas válidas para crédito fiscal de ISR e ITBIS',
    requiresRnc: true,
  },
  B02: {
    type: 'B02',
    name: 'Factura de Consumo (B02)',
    description: 'Ventas a consumidores finales sin crédito fiscal',
    requiresRnc: false,
  },
  B14: {
    type: 'B14',
    name: 'Regímenes Especiales de Pago (B14)',
    description: 'Ventas a zonas francas o entidades con exención tributaria',
    requiresRnc: true,
  },
  B15: {
    type: 'B15',
    name: 'Comprobante Gubernamental (B15)',
    description: 'Ventas a instituciones del Estado Dominicano',
    requiresRnc: true,
  },
  B04: {
    type: 'B04',
    name: 'Nota de Crédito (B04)',
    description: 'Modificación o anulación de comprobantes emitidos previamente',
    requiresRnc: false,
  },
};

export interface NCFRange {
  id: string;
  type: NCFType;
  prefix: string;
  currentNumber: number;
  maxNumber: number;
  expirationDate: string;
  active: boolean;
}

export interface FiscalInvoiceRecord {
  id: string;
  numero_factura?: string;
  ncf: string;
  ncfType: NCFType;
  rncClient?: string;
  companyName?: string;
  issueDate: string;
  issueTime: string;
  subtotal: number;
  itbis: number;
  total: number;
  paymentMethod: string;
  cashier: string;
  expirationDate: string;
  items: {
    sku: string;
    name: string;
    qty: number;
    price: number;
    itbis: number;
    subtotal: number;
  }[];
}

const STORAGE_KEYS = {
  ranges: 'mercato_ncf_ranges',
  history: 'mercato_fiscal_invoices',
};

const DEFAULT_RANGES: NCFRange[] = [
  {
    id: 'ncf-b01',
    type: 'B01',
    prefix: 'B01',
    currentNumber: 46,
    maxNumber: 1000,
    expirationDate: '2027-12-31',
    active: true,
  },
  {
    id: 'ncf-b02',
    type: 'B02',
    prefix: 'B02',
    currentNumber: 128,
    maxNumber: 5000,
    expirationDate: '2027-12-31',
    active: true,
  },
  {
    id: 'ncf-b14',
    type: 'B14',
    prefix: 'B14',
    currentNumber: 12,
    maxNumber: 500,
    expirationDate: '2027-12-31',
    active: true,
  },
  {
    id: 'ncf-b15',
    type: 'B15',
    prefix: 'B15',
    currentNumber: 8,
    maxNumber: 500,
    expirationDate: '2027-12-31',
    active: true,
  },
  {
    id: 'ncf-b04',
    type: 'B04',
    prefix: 'B04',
    currentNumber: 5,
    maxNumber: 500,
    expirationDate: '2027-12-31',
    active: true,
  },
];

export function getNCFRanges(): NCFRange[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ranges);
    return raw ? JSON.parse(raw) : DEFAULT_RANGES;
  } catch {
    return DEFAULT_RANGES;
  }
}

export function saveNCFRanges(ranges: NCFRange[]) {
  localStorage.setItem(STORAGE_KEYS.ranges, JSON.stringify(ranges));
}

export function generateNextNCF(type: NCFType): { ncf: string; expirationDate: string } {
  const ranges = getNCFRanges();
  const rangeIdx = ranges.findIndex((r) => r.type === type && r.active);

  if (rangeIdx === -1) {
    // Fallback if no active range found
    return {
      ncf: `${type}00000001`,
      expirationDate: '2027-12-31',
    };
  }

  const range = ranges[rangeIdx];
  const nextNum = range.currentNumber + 1;
  const formattedNum = String(nextNum).padStart(8, '0');
  const ncf = `${range.prefix}${formattedNum}`;

  // Update current stored number
  ranges[rangeIdx].currentNumber = nextNum;
  saveNCFRanges(ranges);

  return {
    ncf,
    expirationDate: range.expirationDate,
  };
}

/**
 * Validates Dominican Republic RNC (9 digits) or Cédula (11 digits) using Modulo 11
 */
export function validateRNC(input: string): { valid: boolean; type: 'RNC' | 'Cédula' | 'Inválido'; message: string } {
  const clean = input.replace(/\D/g, '');

  if (clean.length === 9) {
    // RNC 9 digits validation
    const weights = [7, 9, 8, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(clean[i], 10) * weights[i];
    }
    const remainder = sum % 11;
    let digit = 11 - remainder;
    if (digit === 10) digit = 1;
    if (digit === 11) digit = 2;

    const lastDigit = parseInt(clean[8], 10);
    const valid = digit === lastDigit;

    return {
      valid,
      type: 'RNC',
      message: valid ? 'RNC Validador DGII correcto' : 'Díptico verificador de RNC inválido',
    };
  }

  if (clean.length === 11) {
    // Cédula 11 digits validation
    const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let prod = parseInt(clean[i], 10) * weights[i];
      if (prod >= 10) prod = Math.floor(prod / 10) + (prod % 10);
      sum += prod;
    }
    const remainder = (10 - (sum % 10)) % 10;
    const lastDigit = parseInt(clean[10], 10);
    const valid = remainder === lastDigit;

    return {
      valid,
      type: 'Cédula',
      message: valid ? 'Cédula Validador DGII correcta' : 'Díptico verificador de Cédula inválido',
    };
  }

  return {
    valid: false,
    type: 'Inválido',
    message: 'El RNC debe contener 9 dígitos y la Cédula 11 dígitos.',
  };
}

export function getFiscalInvoices(): FiscalInvoiceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFiscalInvoice(invoice: FiscalInvoiceRecord) {
  const history = getFiscalInvoices();
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([invoice, ...history]));
}
