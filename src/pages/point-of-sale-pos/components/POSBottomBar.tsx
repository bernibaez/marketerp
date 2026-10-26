import React from 'react';
import {
  FileText,
  Pause,
  CheckCircle,
  CreditCard,
  ShoppingBag,
  Banknote,
  XCircle,
} from 'lucide-react';
import type { Customer } from './POSTerminal';

interface POSBottomBarProps {
  total: number;
  cartCount: number;
  selectedCustomer: Customer | null;
  fiscalEnabled: boolean;
  onToggleFiscal: () => void;
  onQuickCash: () => void;
  onCardPayment: () => void;
  onSplitPayment: () => void;
  onCreditPayment: () => void;
  onClearCart: () => void;
  onOpenHold: () => void;
  onCreateQuote: () => void;
  onCreatePreSale: () => void;
}

export const POSBottomBar: React.FC<POSBottomBarProps> = ({
  total,
  fiscalEnabled,
  onToggleFiscal,
  onQuickCash,
  onCardPayment,
  onSplitPayment,
  onCreditPayment,
  onClearCart,
  onOpenHold,
  onCreateQuote,
  onCreatePreSale,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md px-4 py-2.5 mt-2.5 flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
      {/* Left Action Shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        <button
          type="button"
          onClick={onCreatePreSale}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FileText size={15} className="text-sky-500" strokeWidth={2.3} />
          <span>Preventa</span>
        </button>

        <button
          type="button"
          onClick={onCreateQuote}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FileText size={15} className="text-amber-500" strokeWidth={2.3} />
          <span>Cotización</span>
        </button>

        <button
          type="button"
          onClick={onOpenHold}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Pause size={15} className="text-red-500" strokeWidth={2.5} />
          <span>Suspender</span>
        </button>

        <button
          type="button"
          onClick={onCreditPayment}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <CheckCircle size={15} className="text-indigo-600" strokeWidth={2.3} />
          <span>Venta a crédito</span>
        </button>

        <button
          type="button"
          onClick={onCardPayment}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <CreditCard size={15} className="text-pink-500" strokeWidth={2.3} />
          <span>Tarjeta</span>
        </button>
      </div>

      {/* Center Main Payment Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Pago múltiple (Dark Navy) */}
        <button
          type="button"
          onClick={onSplitPayment}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0e2942] hover:bg-[#081d30] text-white font-extrabold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <ShoppingBag size={16} strokeWidth={2.3} />
          <span>Pago múltiple</span>
        </button>

        {/* Efectivo (Green) */}
        <button
          type="button"
          onClick={onQuickCash}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Banknote size={17} strokeWidth={2.3} />
          <span>Efectivo</span>
        </button>

        {/* Factura Fiscal Button */}
        <button
          type="button"
          onClick={onToggleFiscal}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border cursor-pointer ${
            fiscalEnabled
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
          }`}
          title={fiscalEnabled ? 'NCF Activado' : 'NCF Desactivado'}
        >
          <FileText size={15} className={fiscalEnabled ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />
          <span className="hidden sm:inline">NCF</span>
          <span className={`px-1 py-0.2 text-[9px] rounded font-black ${fiscalEnabled ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {fiscalEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Cancelar (Red) */}
        <button
          type="button"
          onClick={onClearCart}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white font-extrabold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <XCircle size={16} strokeWidth={2.3} />
          <span>Cancelar</span>
        </button>
      </div>

      {/* Right Total Payable */}
      <div className="flex items-center gap-3 pl-3">
        <div className="flex flex-col text-right leading-tight">
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Total</span>
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Payable:</span>
        </div>
        <span className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white tracking-tight">
          {total.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
