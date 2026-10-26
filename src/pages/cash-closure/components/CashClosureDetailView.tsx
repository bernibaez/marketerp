import React from 'react';
import {
  ArrowLeft, Printer, Download, ShieldCheck, CheckCircle2, AlertTriangle, User, Calendar, Clock, DollarSign, CreditCard, Smartphone,
} from 'lucide-react';
import type { CashClosure } from '@/lib/cashClosureStore';
import PrintableCashClosure from '@/components/printing/PrintableCashClosure';

interface CashClosureDetailViewProps {
  closure: CashClosure;
  onBack: () => void;
  onExportPdf: (closure: CashClosure) => void;
}

export const CashClosureDetailView: React.FC<CashClosureDetailViewProps> = ({
  closure,
  onBack,
  onExportPdf,
}) => {
  return (
    <>
      {/* COMPROBANTE OFICIAL PARA IMPRESIÓN (SOLO VISIBLE EN PRINT) */}
      <div className="hidden print:block printable-document">
        <PrintableCashClosure closure={closure} />
      </div>

      {/* VISTA PREVIA INLINE COMPLETA DEL CIERRE DE CAJA (OCULTA EN PRINT) */}
      <div className="print:hidden space-y-6 slide-up pb-12">
        {/* Top Navigation / Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center gap-2 text-xs font-bold w-fit px-4 py-2"
          >
            <ArrowLeft size={16} />
            <span>Volver al listado de cierres</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-1.5 text-xs font-bold py-2 px-3.5"
            >
              <Printer size={15} /> Imprimir Comprobante
            </button>
            <button
              type="button"
              onClick={() => onExportPdf(closure)}
              className="btn-primary flex items-center gap-1.5 text-xs font-bold py-2 px-4"
            >
              <Download size={15} /> Exportar PDF
            </button>
          </div>
        </div>

        {/* Header Banner */}
        <div className="card p-6 border-l-4 border-l-primary bg-linear-to-r from-card via-card to-primary/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck size={32} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-black text-foreground tracking-tight">
                    Cierre de Caja {closure.code}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                    Turno Cerrado
                  </span>
                </div>
                <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                  {closure.cashRegisterLabel || `Caja #${closure.cashRegisterId}`} · Fecha {closure.date}
                </p>
              </div>
            </div>

            {/* Difference Highlight */}
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              closure.difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : closure.difference > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
              {closure.difference === 0 ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block opacity-90">
                  {closure.difference === 0
                    ? 'Cuadre Exacto'
                    : closure.difference > 0
                      ? 'Sobrante en Caja'
                      : 'Faltante en Caja'}
                </span>
                <span className="text-lg font-black tabular-nums">
                  {closure.difference >= 0
                    ? `+RD$ ${closure.difference.toFixed(2)}`
                    : `-RD$ ${Math.abs(closure.difference).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User & Shift Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <User size={14} className="text-primary" /> Cajero Responsable
            </span>
            <p className="text-base font-bold text-foreground truncate">{closure.userName}</p>
            <p className="text-xs text-muted-foreground">@{closure.username || 'usuario'}</p>
          </div>

          <div className="card p-4 space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar size={14} className="text-primary" /> Fecha de Operación
            </span>
            <p className="text-base font-bold text-foreground">{closure.date}</p>
            <p className="text-xs text-muted-foreground">Turno concluido</p>
          </div>

          <div className="card p-4 space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Clock size={14} className="text-primary" /> Horario del Turno
            </span>
            <p className="text-base font-bold text-foreground font-mono">
              {closure.openedAt.split(' ')[1] || closure.openedAt} — {closure.closedAt.split(' ')[1] || closure.closedAt}
            </p>
            <p className="text-xs text-muted-foreground">Apertura y Cierre</p>
          </div>

          <div className="card p-4 space-y-1">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign size={14} className="text-primary" /> Fondo Inicial
            </span>
            <p className="text-base font-bold text-foreground">
              RD$ {(closure.baseCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">Monto base asignado</p>
          </div>
        </div>

        {/* Financial Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Breakdown by Payment Method */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground border-b border-border pb-2">
              Desglose de Ventas por Método de Pago
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign size={16} className="text-emerald-500" />
                  Ventas en Efectivo
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  RD$ {(closure.totalCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard size={16} className="text-blue-500" />
                  Ventas con Tarjeta (POS/Datafono)
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  RD$ {(closure.totalCard ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Smartphone size={16} className="text-indigo-500" />
                  Ventas por Transferencia Bancaria
                </span>
                <span className="font-bold text-foreground tabular-nums">
                  RD$ {(closure.totalTransfer ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {(closure.totalCredit ?? 0) > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User size={16} className="text-amber-500" />
                    Ventas a Crédito (CxC)
                  </span>
                  <span className="font-bold text-foreground tabular-nums">
                    RD$ {(closure.totalCredit ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 bg-primary/5 p-3 rounded-xl border border-primary/20">
                <span className="font-extrabold text-foreground">TOTAL VENDIDO EN TURNO</span>
                <span className="text-xl font-black text-primary tabular-nums">
                  RD$ {closure.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Reconciliation Box */}
          <div className="card p-5 space-y-4 bg-secondary/20">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
              Conciliación y Arqueo de Efectivo
            </h3>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Efectivo Físico Esperado en Caja
              </span>
              <span className="text-2xl font-black text-foreground tabular-nums block">
                RD$ {closure.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-muted-foreground">
                (Fondo Inicial RD$ {(closure.baseCash ?? 0).toLocaleString()} + Ventas Efectivo RD$ {(closure.totalCash ?? 0).toLocaleString()})
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Efectivo Físico Real Contado
              </span>
              <span className="text-2xl font-black text-primary tabular-nums block">
                RD$ {closure.countedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-muted-foreground">Monto reportado en el conteo de billetes y monedas</p>
            </div>

            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              closure.difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : closure.difference > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
              <span className="text-xs font-extrabold uppercase tracking-wider">Diferencia Final:</span>
              <span className="text-lg font-black tabular-nums">
                {closure.difference >= 0 ? `+RD$ ${closure.difference.toFixed(2)}` : `-RD$ ${Math.abs(closure.difference).toFixed(2)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        {closure.notes && (
          <div className="card p-4 space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
              Observaciones y Notas del Cierre
            </span>
            <p className="text-sm text-foreground font-medium">{closure.notes}</p>
          </div>
        )}

        {/* Footer Back Button */}
        <div className="flex justify-start pt-2">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary flex items-center gap-2 text-xs font-bold px-6 py-2.5"
          >
            <ArrowLeft size={16} />
            <span>Volver a la lista de cierres</span>
          </button>
        </div>
      </div>
    </>
  );
};
