import type { PosReturn, PosReturnStatus } from '@/lib/posStore';
import type { DevolucionConDetalle } from '@/services/devoluciones.service';

export const methodLabel: Record<PosReturn['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit_note: 'Nota de crédito',
  exchange: 'Cambio',
};

export const typeLabel: Record<PosReturn['type'], string> = {
  partial: 'Parcial',
  full: 'Total',
};

export function mapDevolucionToPosReturn(d: DevolucionConDetalle): PosReturn {
  const creado = new Date(d.creado_en);
  const methodMap: Record<string, PosReturn['method']> = {
    efectivo: 'cash',
    tarjeta: 'card',
    nota_credito: 'credit_note',
    cambio: 'exchange',
  };
  const statusMap: Record<string, PosReturnStatus> = {
    pendiente: 'pending',
    aprobada: 'approved',
    rechazada: 'rejected',
  };
  return {
    id: d.id,
    code: d.codigo,
    saleCode: d.numero_factura ?? '—',
    customer: d.cliente_nombre ?? 'Cliente',
    date: creado.toISOString().slice(0, 10),
    time: creado.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    user: d.cajero_nombre ?? 'Cajero',
    cashier: d.cajero_nombre ?? 'Caja',
    products: (d.items ?? []).map((i) => ({
      sku: i.sku ?? '',
      name: i.nombre_item,
      qty: i.cantidad,
      price: i.precio_unitario,
      subtotal: i.cantidad * i.precio_unitario,
    })),
    items: (d.items ?? []).map((i) => ({
      sku: i.sku ?? '',
      name: i.nombre_item,
      qty: i.cantidad,
      price: i.precio_unitario,
      subtotal: i.cantidad * i.precio_unitario,
    })),
    total: Number(d.monto_total),
    reason: d.motivo,
    method: methodMap[d.metodo_reembolso] ?? 'cash',
    type: d.tipo === 'total' ? 'full' : 'partial',
    status: statusMap[d.estado] ?? 'pending',
    reviewedBy: d.revisado_por_nombre,
    rejectionReason: d.motivo_rechazo ?? undefined,
  };
}
