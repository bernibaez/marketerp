export type PeriodoInforme = {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
};

export function rangoFin(hasta: string) {
  return `${hasta}T23:59:59.999`;
}

export function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-DO');
  } catch {
    return iso.slice(0, 10);
  }
}

export function labelPago(m: string | null | undefined) {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    credito: 'Crédito',
    mixto: 'Mixto',
    cheque: 'Cheque',
  };
  return map[(m ?? '').toLowerCase()] ?? m ?? '—';
}

export const PAY_COLORS: Record<string, string> = {
  Efectivo: '#16a34a',
  Tarjeta: '#2563eb',
  Transferencia: '#d97706',
  Crédito: '#dc2626',
  Mixto: '#7c3aed',
  Cheque: '#64748b',
};
