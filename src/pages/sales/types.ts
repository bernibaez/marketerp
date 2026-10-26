import type { Producto } from '@/types/database';

export interface CartItem {
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
}

export const saleStatusMap: Record<string, { label: string; cls: string }> = {
  completada: { label: 'Completada', cls: 'badge-success' },
  paid: { label: 'Pagada', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
  cancelled: { label: 'Cancelada', cls: 'badge-danger' },
  reembolsada: { label: 'Reembolsada', cls: 'badge-warning' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobada: { label: 'Aprobada', cls: 'badge-success' },
  approved: { label: 'Aprobada', cls: 'badge-success' },
  rechazada: { label: 'Rechazada', cls: 'badge-danger' },
  rejected: { label: 'Rechazada', cls: 'badge-danger' },
  convertida: { label: 'Convertida', cls: 'badge-info' },
  converted: { label: 'Convertida', cls: 'badge-info' },
};

export const metodoLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
  mixto: 'Mixto',
  nota_credito: 'Nota de crédito',
  cambio: 'Cambio',
};

export function formatCleanDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${day}/${month}/${year} · ${h12}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}
