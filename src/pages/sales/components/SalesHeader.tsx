import React from 'react';
import { ShoppingCart, RotateCcw, Plus } from 'lucide-react';
import type { SalesTab } from '../types';

interface SalesHeaderProps {
  tab: SalesTab;
  canSeeAllSales: boolean;
  canCreateSales: boolean;
  onNewSale: () => void;
  onNewQuote: () => void;
  onNewReturn: () => void;
}

export function SalesHeader({
  tab,
  canSeeAllSales,
  canCreateSales,
  onNewSale,
  onNewQuote,
  onNewReturn,
}: SalesHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="text-primary" size={26} />
          Módulo de Ventas y Gestión Comercial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canSeeAllSales
            ? 'Control de ventas, facturación con ITBIS 18% transparentado, cotizaciones y devoluciones'
            : 'Consulta las ventas que realizaste. Editar o anular requiere permiso de administrador'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {tab === 'returns' ? (
          <button
            type="button"
            onClick={onNewReturn}
            className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Nueva Devolución</span>
          </button>
        ) : tab === 'quotes' ? (
          <>
            {canCreateSales && (
              <button
                type="button"
                onClick={onNewQuote}
                className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={15} /> Nueva Cotización
              </button>
            )}
            {canCreateSales && (
              <button
                type="button"
                onClick={onNewSale}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <ShoppingCart size={14} /> Nueva Venta
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onNewReturn}
              className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-900/30 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw size={14} /> Devolución
            </button>
            {canCreateSales && (
              <button
                type="button"
                onClick={onNewSale}
                className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>Nueva Venta</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
