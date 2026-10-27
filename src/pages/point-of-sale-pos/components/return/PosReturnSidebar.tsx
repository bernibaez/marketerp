import React from 'react';
import { ChevronDown, Shield, RotateCcw } from 'lucide-react';

interface PosReturnSidebarProps {
  customer: string;
  setCustomer: (c: string) => void;
  reason: string;
  setReason: (r: string) => void;
  method: 'cash' | 'card' | 'credit_note' | 'exchange';
  setMethod: (m: 'cash' | 'card' | 'credit_note' | 'exchange') => void;
  isFullReturn: boolean;
  selectedItemsCount: number;
  totalReturnAmount: number;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  bottomBackLabel?: string;
}

export const PosReturnSidebar: React.FC<PosReturnSidebarProps> = ({
  customer,
  setCustomer,
  reason,
  setReason,
  method,
  setMethod,
  isFullReturn,
  selectedItemsCount,
  totalReturnAmount,
  submitting,
  canSubmit,
  onSubmit,
  onClose,
  bottomBackLabel,
}) => {
  return (
    <div className="space-y-6">
      {/* CARD 1: INFORMACIÓN DE DEVOLUCIÓN */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase">
            INFORMACIÓN DE DEVOLUCIÓN
          </h3>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cliente</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition"
            placeholder="Nombre del cliente"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Motivo de Devolución</label>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 pr-9 text-xs text-slate-800 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition cursor-pointer font-medium"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="Producto defectuoso">Producto defectuoso</option>
              <option value="Error de cobro">Error de cobro</option>
              <option value="Cliente arrepentido">Cliente arrepentido</option>
              <option value="Producto equivocado">Producto equivocado</option>
              <option value="Fecha vencimiento próxima">Fecha vencimiento próxima</option>
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Método de Reembolso</label>
          <div className="relative">
            <select
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 pr-9 text-xs text-slate-800 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition cursor-pointer font-medium"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              <option value="cash">Efectivo</option>
              <option value="card">Reembolso a Tarjeta</option>
              <option value="credit_note">Nota de Crédito</option>
              <option value="exchange">Cambio por otro Producto</option>
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* CARD 2: RESUMEN DE REEMBOLSO */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-1">
          <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase">
            RESUMEN DE REEMBOLSO
          </h3>
          <span className="text-xs text-slate-400 font-medium">Paso Final</span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-500 font-medium">Tipo de Devolución</span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
            {isFullReturn ? 'Devolución Total' : 'Devolución Parcial'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Productos a devolver</span>
          <span className="font-bold text-slate-800">{selectedItemsCount} producto(s)</span>
        </div>

        {/* Total Box */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            TOTAL REEMBOLSO
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-[#e11d48]">RD$</span>
            <span className="text-3xl font-black text-[#e11d48] font-mono tracking-tight">
              {totalReturnAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Admin approval warning box */}
        <div className="bg-[#fef9c3]/70 border border-[#fef08a] rounded-xl p-3 flex items-center gap-2.5">
          <Shield size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-900">
            Requiere aprobación del administrador
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={onSubmit}
            className="w-full bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} className={submitting ? 'animate-spin' : ''} />
            <span>{submitting ? 'Enviando Solicitud…' : 'Solicitar Devolución'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/90 py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
          >
            {bottomBackLabel || '← Volver a Ventas'}
          </button>
        </div>
      </div>
    </div>
  );
};
