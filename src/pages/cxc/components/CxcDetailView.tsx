import React, { useState } from 'react';
import { FileText, HandCoins, Printer } from 'lucide-react';
import type { CuentaCobrarUi } from '@/services/cxc.service';
import type { Cliente } from '@/types/database';
import { ButtonSpinner } from '@/components/ui/LoadingSkeleton';
import PrintableAccountStatement from '@/components/printing/PrintableAccountStatement';
import { toast } from '@/lib/toast';

interface CxcDetailViewProps {
  selected: CuentaCobrarUi;
  clientes: Cliente[];
  onClose: () => void;
  onProcessPayment: (amount: number, method: string, note: string) => Promise<void>;
}

export const CxcDetailView: React.FC<CxcDetailViewProps> = ({
  selected,
  clientes,
  onClose,
  onProcessPayment,
}) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido para el cobro/abono');
      return;
    }
    setSaving(true);
    try {
      await onProcessPayment(amount, paymentMethod, paymentNote);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* COMPROBANTE OFICIAL PARA IMPRESIÓN (SOLO VISIBLE EN PRINT) */}
      <div className="hidden print:block printable-document">
        <PrintableAccountStatement
          type="receivable"
          code={selected.id}
          name={selected.customer}
          phone={clientes.find((c) => c.id === selected.customerId)?.telefono || undefined}
          invoiceCode={selected.invoice}
          totalAmount={selected.total}
          paidAmount={selected.paid}
          pendingBalance={selected.balance}
          dueDate={selected.dueDate}
          payments={selected.payments.map((p) => ({
            date: p.date,
            amount: p.amount,
            method: p.method,
            note: p.note,
          }))}
        />
      </div>

      {/* VISTA INTERACTIVA WEB (OCULTA EN PRINT) */}
      <div className="print:hidden space-y-6 slide-up">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="text-primary" size={24} />
              Estado de Cuenta — {selected.customer}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consulta saldo, registra cobros/abonos y revisa el historial
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            ← Volver a Cuentas por Cobrar
          </button>
        </div>

        <div className="card p-5 sm:p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-secondary/40 rounded-xl p-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Factura</span>
              <span className="font-bold text-primary">{selected.invoice}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Monto Total</span>
              <span className="font-bold text-foreground">RD$ {selected.total.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Saldo Pendiente</span>
              <span className="font-bold text-danger">RD$ {selected.balance.toLocaleString()}</span>
            </div>
          </div>

          {selected.balance > 0 && (
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Registrar Pago / Abono Parcial o Total
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Monto a Cobrar (RD$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field font-bold tabular-nums"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Método de Pago</label>
                  <select
                    className="input-field text-xs"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia Banco</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nota / Referencia
                </label>
                <input
                  className="input-field text-xs"
                  placeholder="Ej: Depósito #98721 o recibo..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handlePay}
                className="btn-primary w-full py-2 font-bold flex items-center justify-center gap-1.5"
              >
                {saving ? <ButtonSpinner /> : <HandCoins size={16} />}
                {saving ? 'Registrando…' : `Confirmar Cobro de RD$ ${parseFloat(paymentAmount) || 0}`}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Historial de Abonos / Pagos Registrados
            </p>
            {selected.payments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No hay pagos previos para este documento.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {selected.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center bg-card border border-border p-2 rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-bold text-foreground">{p.date}</span> ·{' '}
                      <span className="text-muted-foreground">{p.method}</span>
                      <p className="text-[11px] text-muted-foreground">{p.note}</p>
                    </div>
                    <span className="font-bold text-success text-sm">+ RD$ {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Printer size={14} /> Imprimir Estado de Cuenta
            </button>
            <button type="button" disabled={saving} onClick={onClose} className="btn-primary text-xs">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
