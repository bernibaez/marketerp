import React from 'react';
import AppLayout from '@/components/AppLayout';
import { ShoppingBag, Download } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import type { CompraDetalle } from '@/services/compras.service';

const statusMap: Record<string, { label: string; cls: string }> = {
  received: { label: 'Recibido', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  approved: { label: 'Aprobado', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
};

function mapEstadoUi(estado: string): string {
  if (estado === 'recibida') return 'received';
  if (estado === 'parcial') return 'partial';
  if (estado === 'anulada') return 'anulada';
  return 'pending';
}

interface PurchaseDetailViewProps {
  viewingPurchase: CompraDetalle | null;
  loadingPurchaseDetail: boolean;
  onBack: () => void;
}

export function PurchaseDetailView({
  viewingPurchase,
  loadingPurchaseDetail,
  onBack,
}: PurchaseDetailViewProps) {
  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Header with back button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShoppingBag size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  Detalle de Compra {viewingPurchase?.codigo || ''}
                </h1>
                {viewingPurchase && (
                  <span className={statusMap[mapEstadoUi(viewingPurchase.estado)]?.cls ?? 'badge-neutral'}>
                    {statusMap[mapEstadoUi(viewingPurchase.estado)]?.label ?? viewingPurchase.estado}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Vista detallada y desglose fiscal de la orden de compra registrada
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="btn-secondary text-xs font-bold py-2.5 px-4 flex items-center gap-2 self-start sm:self-auto shadow-xs cursor-pointer"
          >
            ← Volver a Compras
          </button>
        </div>

        {loadingPurchaseDetail && !viewingPurchase ? (
          <div className="card p-12 text-center text-sm text-muted-foreground">
            Cargando detalle de la compra…
          </div>
        ) : viewingPurchase ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Proveedor</span>
                <p className="text-lg font-black text-foreground truncate">{viewingPurchase.proveedor}</p>
              </div>
              <div className="card p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Fecha de Orden</span>
                <p className="text-lg font-bold font-mono text-foreground">{viewingPurchase.fecha}</p>
              </div>
              <div className="card p-4 space-y-1">
                <span className="text-xs text-muted-foreground font-semibold">Método de Pago</span>
                <p className="text-lg font-bold text-foreground">{viewingPurchase.metodo_pago || 'Contado'}</p>
              </div>
              <div className="card p-4 space-y-1 bg-primary/5 border-primary/20">
                <span className="text-xs text-muted-foreground font-semibold">Monto Total Compra</span>
                <p className="text-xl font-black text-primary font-mono">
                  RD$ {viewingPurchase.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {viewingPurchase.notas && (
              <div className="card p-4 bg-secondary/30 text-xs">
                <span className="font-bold text-muted-foreground block mb-1">Notas u Observaciones:</span>
                <p className="text-foreground">{viewingPurchase.notas}</p>
              </div>
            )}

            {/* Items Table */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border bg-secondary/40 flex justify-between items-center">
                <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">
                  Productos de la Orden ({viewingPurchase.lineas.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Producto / Descripción</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Cantidad</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Costo Unit.</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewingPurchase.lineas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No hay productos registrados en esta compra
                        </td>
                      </tr>
                    ) : (
                      viewingPurchase.lineas.map((line, idx) => (
                        <tr key={line.id || idx} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{line.nombre}</td>
                          <td className="px-4 py-3 text-center font-mono font-bold">{line.cantidad}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                            RD$ {line.precio_costo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-foreground">
                            RD$ {line.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Fiscal Totals Footer */}
              <div className="p-4 border-t border-border bg-secondary/20 flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    exportTableToPdf({
                      title: `ORDEN DE COMPRA - ${viewingPurchase.codigo}`,
                      subtitle: `Proveedor: ${viewingPurchase.proveedor} | Fecha: ${viewingPurchase.fecha}`,
                      filename: `compra-${viewingPurchase.codigo}`,
                      headers: ['#', 'Producto', 'Cant.', 'Precio Costo', 'Subtotal'],
                      rows: viewingPurchase.lineas.map((line, idx) => [
                        idx + 1,
                        line.nombre,
                        line.cantidad,
                        formatMoneyPdf(line.precio_costo),
                        formatMoneyPdf(line.subtotal),
                      ]),
                    });
                  }}
                  className="btn-secondary text-xs py-2 px-3 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Exportar PDF
                </button>

                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal Neto:</span>
                    <span className="font-mono font-medium">
                      RD$ {viewingPurchase.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                    <span>ITBIS (Impuesto):</span>
                    <span className="font-mono">
                      RD$ {viewingPurchase.impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
                    <span>Total General:</span>
                    <span className="text-primary font-mono">
                      RD$ {viewingPurchase.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
