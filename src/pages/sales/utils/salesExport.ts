import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import type { VentaConDetalle } from '@/services/ventas.service';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';
import type { DevolucionConDetalle } from '@/services/devoluciones.service';
import { saleStatusMap, metodoLabel } from '../types';

export function exportSalesPdf(ventas: VentaConDetalle[]) {
  exportTableToPdf({
    title: 'Historial Detallado de Ventas (Supabase)',
    filename: 'historial-ventas',
    headers: [
      'Factura',
      'NCF',
      'Fecha/Hora',
      'Cliente',
      'Cajero',
      'Pago',
      'Subtotal',
      'ITBIS (18%)',
      'Total',
      'Ganancia',
      'Estado',
    ],
    rows: ventas.map((v) => [
      v.numero_factura,
      v.ncf || '—',
      new Date(v.creado_en).toLocaleString('es-DO'),
      v.cliente_nombre || 'General',
      v.cajero_nombre || 'Cajero',
      metodoLabel[v.metodo_pago] || v.metodo_pago,
      formatMoneyPdf(v.subtotal),
      formatMoneyPdf(v.monto_impuesto),
      formatMoneyPdf(v.monto_total),
      formatMoneyPdf(v.monto_total - v.costo_total),
      saleStatusMap[v.estado]?.label ?? v.estado,
    ]),
    landscape: true,
  });
}

export function exportQuotesPdf(cotizaciones: CotizacionConDetalle[]) {
  exportTableToPdf({
    title: 'Listado de Cotizaciones',
    filename: 'cotizaciones',
    headers: ['Código', 'Cliente', 'Fecha Emisión', 'Válida hasta', 'Total', 'Estado'],
    rows: cotizaciones.map((q) => [
      q.codigo,
      q.cliente_nombre || 'General',
      new Date(q.creado_en).toLocaleDateString('es-DO'),
      q.valida_hasta || '—',
      formatMoneyPdf(q.monto_total),
      saleStatusMap[q.estado]?.label ?? q.estado,
    ]),
  });
}

export function exportReturnsPdf(devoluciones: DevolucionConDetalle[]) {
  exportTableToPdf({
    title: 'Historial de Devoluciones de Venta',
    filename: 'devoluciones-venta',
    headers: ['Código', 'Factura Ref.', 'Cliente', 'Fecha', 'Total Reembolso', 'Motivo', 'Estado'],
    rows: devoluciones.map((r) => [
      r.codigo,
      r.numero_factura || '—',
      r.cliente_nombre || 'General',
      new Date(r.creado_en).toLocaleString('es-DO'),
      formatMoneyPdf(r.monto_total),
      r.motivo,
      saleStatusMap[r.estado]?.label ?? r.estado,
    ]),
  });
}

export function exportSalesExcel(ventas: VentaConDetalle[]) {
  exportTableToExcel({
    title: 'Historial Detallado de Ventas',
    filename: 'historial-ventas',
    headers: [
      'Factura',
      'NCF',
      'Fecha',
      'Cliente',
      'Cajero',
      'Método Pago',
      'Subtotal',
      'ITBIS (18%)',
      'Descuento',
      'Total Factura',
      'Costo Total',
      'Ganancia Bruta',
      'Estado',
    ],
    rows: ventas.map((v) => [
      v.numero_factura,
      v.ncf || '',
      new Date(v.creado_en).toLocaleString('es-DO'),
      v.cliente_nombre || 'General',
      v.cajero_nombre || 'Cajero',
      metodoLabel[v.metodo_pago] || v.metodo_pago,
      v.subtotal,
      v.monto_impuesto,
      v.monto_descuento,
      v.monto_total,
      v.costo_total,
      v.monto_total - v.costo_total,
      saleStatusMap[v.estado]?.label ?? v.estado,
    ]),
  });
}
