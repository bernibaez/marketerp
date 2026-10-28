import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { WeightUnit } from '@/types/database';
import {
  calculateWeightSubtotal,
  validateWeightValue,
  formatWeightUnitLabel,
} from './WeightCalculator';

export interface WeightInputProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  tax: number;
  image?: string;
  unit?: WeightUnit | string;
  minWeight?: number;
  maxWeight?: number;
  allowDecimal?: boolean;
}

interface WeightInputModalProps {
  open?: boolean;
  product: WeightInputProduct;
  initialWeight?: number;
  onClose: () => void;
  onConfirm: (weight: number, subtotal: number) => void;
}

export default function WeightInputModal({
  open = true,
  product,
  initialWeight,
  onClose,
  onConfirm,
}: WeightInputModalProps) {
  const unitLabel = formatWeightUnitLabel(product.unit);
  const minW = product.minWeight ?? 0.01;
  const maxW = product.maxWeight ?? 999.99;
  const allowDec = product.allowDecimal ?? true;

  const [weightStr, setWeightStr] = useState<string>(
    initialWeight != null && initialWeight > 0 ? String(initialWeight) : ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus automatically on open
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 80);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const numericWeight = parseFloat(weightStr);
  const validation = validateWeightValue(numericWeight, minW, maxW, allowDec);
  const subtotal = calculateWeightSubtotal(numericWeight, product.price);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!weightStr.trim()) {
      toast.error('Por favor ingresa el peso.');
      inputRef.current?.focus();
      return;
    }

    if (!validation.isValid) {
      toast.error(validation.error || 'Peso no válido');
      inputRef.current?.focus();
      return;
    }

    onConfirm(numericWeight, subtotal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const modalContent = (
    <div
      className="dialog-inline-host !z-[9999]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight">
                Ingresar Peso
              </h3>
              <p className="text-xs text-slate-400 font-medium">Balanza manual / POS</p>
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

        {/* Product Details Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Producto</p>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
              {product.name}
            </h4>
            <p className="text-xs font-mono text-slate-500">{product.sku}</p>
          </div>
          <div className="text-right flex-shrink-0 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Precio / {unitLabel}</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              RD$ {product.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Peso en {unitLabel.toUpperCase()}
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Rango: {minW} a {maxW} {unitLabel}
              </span>
            </div>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                step={allowDec ? '0.001' : '1'}
                min={minW}
                max={maxW}
                placeholder="0.000"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                className={`w-full text-center text-3xl font-black tabular-nums h-16 rounded-2xl border-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none ${
                  weightStr && !validation.isValid
                    ? 'border-red-500 focus:ring-4 focus:ring-red-500/20'
                    : 'border-emerald-500/40 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 pointer-events-none">
                {unitLabel}
              </span>
            </div>

            {weightStr && !validation.isValid && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold mt-2 px-1">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{validation.error}</span>
              </div>
            )}
          </div>

          {/* Real-time Subtotal */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
              Subtotal Calculado
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Quick Buttons for Weight preset (1lb, 2lb, 5lb) */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[0.5, 1, 2, 5].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setWeightStr(String(preset))}
                className="py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                + {preset} {unitLabel}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={!weightStr || !validation.isValid}
              className="flex-1 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>Agregar Al Carrito (Enter)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
