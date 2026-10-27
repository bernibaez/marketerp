import React from 'react';
import { RotateCcw, Printer, Shield, XCircle, CheckCircle } from 'lucide-react';
import type { PosReturn } from '@/lib/posStore';
import PrintableReturnReceipt from '@/components/printing/PrintableReturnReceipt';
import { methodLabel, typeLabel } from '../returnsShared';
import { StatusBadge } from './StatusBadge';

interface ReturnDetailViewProps {
  selectedReturn: PosReturn;
  onBack: () => void;
  onApprove: (r: PosReturn) => void;
  onOpenRejectModal: (r: PosReturn) => void;
  processing: boolean;
}

export default function ReturnDetailView({
  selectedReturn,
  onBack,
  onApprove,
  onOpenRejectModal,
  processing,
}: ReturnDetailViewProps) {
  return (
    <div className="space-y-6 slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center font-bold">
            <RotateCcw size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Devolución {selectedReturn.code}
              </h1>
              <StatusBadge status={selectedReturn.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Factura de referencia: <strong className="font-mono text-primary">{selectedReturn.saleCode}</strong> · Cajero solicitante:{' '}
              <strong>{selectedReturn.user}</strong> ({selectedReturn.cashier})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-xs font-semibold py-2.5 px-3 flex items-center gap-1.5"
          >
            <Printer size={15} /> Imprimir Comprobante
          </button>
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary text-xs font-bold py-2.5 px-4 flex items-center gap-2 shadow-xs"
          >
            ← Volver a Devoluciones
          </button>
        </div>
      </div>

      {/* Printable Receipt (Print only) */}
      <div className="hidden print:block printable-document">
        <PrintableReturnReceipt
          data={{
            code: selectedReturn.code,
            originalInvoiceCode: selectedReturn.saleCode,
            date: selectedReturn.date,
            customerName: selectedReturn.customer,
            cashierName: selectedReturn.cashier,
            reason: selectedReturn.reason,
            items: (selectedReturn.items ?? selectedReturn.products ?? []).map((p) => ({
              name: p.name,
              qty: p.qty,
              price: p.price,
              subtotal: p.subtotal ?? p.qty * p.price,
            })),
            totalAmount: selectedReturn.total,
          }}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <div className="lg:col-span-2 space-y-6">
          {/* Status Alert Banner */}
          {selectedReturn.status === 'pending' ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm">
                  <Shield size={20} />
                  <span>Solicitud de Devolución por Cajero (Pendiente de tu Aprobación)</span>
                </div>
                <StatusBadge status={selectedReturn.status} />
              </div>
              <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                El cajero <strong>{selectedReturn.user}</strong> (<i>{selectedReturn.cashier}</i>) solicita tu aprobación como Administrador para procesar una devolución por{' '}
                <strong className="text-danger font-mono">
                  RD$ {selectedReturn.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </strong>{' '}
                sobre la factura <strong>{selectedReturn.saleCode}</strong>.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenRejectModal(selectedReturn)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <XCircle size={16} /> Rechazar Devolución
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(selectedReturn)}
                  disabled={processing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle size={16} /> Aprobar Devolución
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-4 flex justify-between items-center bg-secondary/30">
              <span className="text-muted-foreground font-semibold text-sm">Estado de la Solicitud:</span>
              <StatusBadge status={selectedReturn.status} />
            </div>
          )}

          {/* Items Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <RotateCcw size={16} className="text-danger" />
                Productos a Devolver ({selectedReturn.products.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-semibold">Producto</th>
                    <th className="text-center px-4 py-3 font-semibold">Cantidad</th>
                    <th className="text-right px-4 py-3 font-semibold">Precio</th>
                    <th className="text-right px-4 py-3 font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturn.products.map((p, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.name}
                        {p.sku && <span className="text-xs text-muted-foreground block font-mono">{p.sku}</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-foreground">{p.qty}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        RD$ {p.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        RD$ {(p.qty * p.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-foreground text-sm border-b border-border pb-2">
              Información de la Devolución
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Factura Original:</span>
                <span className="font-mono font-bold text-primary text-sm">{selectedReturn.saleCode}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cliente:</span>
                <span className="font-semibold text-foreground">{selectedReturn.customer}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Fecha / Hora:</span>
                <span className="font-medium text-foreground">{selectedReturn.date} {selectedReturn.time}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cajero:</span>
                <span className="font-medium text-foreground">{selectedReturn.user} ({selectedReturn.cashier})</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Motivo:</span>
                <span className="font-medium text-foreground">{selectedReturn.reason}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Método de Reembolso:</span>
                <span className="font-semibold text-foreground">{methodLabel[selectedReturn.method]}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tipo:</span>
                <span className="font-medium text-foreground">{typeLabel[selectedReturn.type]}</span>
              </div>
              {selectedReturn.reviewedBy && (
                <div className="border-t border-border pt-2">
                  <span className="text-muted-foreground block">Revisado por Admin:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedReturn.reviewedBy}</span>
                </div>
              )}
              {selectedReturn.rejectionReason && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400">
                  <strong>Motivo del Rechazo:</strong> {selectedReturn.rejectionReason}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-muted-foreground">Total Reembolso:</span>
                <span className="text-danger font-mono text-xl font-black">
                  RD$ {selectedReturn.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className="btn-secondary w-full text-xs font-bold py-2.5"
              >
                ← Volver a Devoluciones
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
