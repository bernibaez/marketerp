import React from 'react';

interface PosReturnHeaderProps {
  cashLabel: string;
  onClose: () => void;
  backLabel?: string;
}

export const PosReturnHeader: React.FC<PosReturnHeaderProps> = ({
  cashLabel,
  onClose,
  backLabel,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap pb-1 print:hidden">
      {/* Left: Icon + Title + Subtitle */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#007052] flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
            <line x1="12" y1="13" x2="12" y2="17" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
            Módulo de Devoluciones
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Punto de Venta · Sucursal Principal
          </p>
        </div>
      </div>

      {/* Right: Cashier status pill + Back action */}
      <div className="flex items-center gap-3">
        <div className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{cashLabel}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-slate-50"
        >
          {backLabel || '← Regresar a Facturación'}
        </button>
      </div>
    </div>
  );
};
