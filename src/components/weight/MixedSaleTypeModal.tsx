import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Scale, Layers } from 'lucide-react';
import type { WeightUnit } from '@/types/database';
import { formatWeightUnitLabel } from './WeightCalculator';

interface MixedSaleTypeModalProps {
  open?: boolean;
  productName: string;
  productSku?: string;
  price: number;
  weightUnit?: WeightUnit | string;
  onClose: () => void;
  onSelectUnit: () => void;
  onSelectWeight: () => void;
}

export default function MixedSaleTypeModal({
  open = true,
  productName,
  productSku,
  price,
  weightUnit = 'lb',
  onClose,
  onSelectUnit,
  onSelectWeight,
}: MixedSaleTypeModalProps) {
  const unitLabel = formatWeightUnitLabel(weightUnit);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!open) return null;

  const modalContent = (
    <div
      className="dialog-inline-host !z-[9999]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Layers size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight">
                Producto Mixto
              </h3>
              <p className="text-xs text-slate-400 font-medium">Seleccionar modalidad de venta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Product Details */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center">
          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
            {productName}
          </h4>
          {productSku && <p className="text-xs font-mono text-slate-400 mt-0.5">{productSku}</p>}
          <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">
            RD$ {price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 font-semibold mt-2">
            ¿Cómo desea vender este producto?
          </p>
        </div>

        {/* Options Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSelectUnit}
            className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
              Por Unidad
            </span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5">
              1 Unidad fija
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectWeight}
            className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Scale size={24} />
            </div>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
              Por Peso
            </span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5">
              Ingresar peso ({unitLabel})
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors"
          >
            Cancelar (Esc)
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
