import React from 'react';
import { DollarSign, Percent, Sparkles } from 'lucide-react';
import type { PricingMode } from '@/lib/comboStore';

interface ComboPricingCardProps {
  formId: string;
  discountType: PricingMode;
  setDiscountType: (type: PricingMode) => void;
  totalCost: number;
  finalPrice: number;
  priceInput: number;
  setPriceInput: (val: number) => void;
  percentInput: number;
  setPercentInput: (val: number) => void;
  amountInput: number;
  setAmountInput: (val: number) => void;
  profitMargin: number;
}

export const ComboPricingCard: React.FC<ComboPricingCardProps> = ({
  formId,
  discountType,
  setDiscountType,
  totalCost,
  finalPrice,
  priceInput,
  setPriceInput,
  percentInput,
  setPercentInput,
  amountInput,
  setAmountInput,
  profitMargin,
}) => {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <DollarSign size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">3. Precio y Margen</h3>
      </div>

      {/* Pricing Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setDiscountType('fixed')}
          className={`p-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1 ${
            discountType === 'fixed'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign size={18} />
          <span>Precio Venta Fijo Directo</span>
        </button>

        <button
          type="button"
          onClick={() => setDiscountType('percent')}
          className={`p-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1 ${
            discountType === 'percent'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent size={18} />
          <span>% Descuento s/Venta Normal</span>
        </button>

        <button
          type="button"
          onClick={() => setDiscountType('amount')}
          className={`p-3 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-1 ${
            discountType === 'amount'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-secondary/40 border-border/80 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles size={18} />
          <span>Monto Descuento en RD$</span>
        </button>
      </div>

      {/* Inputs & Cost/Sale Breakdown */}
      <div className="space-y-4 bg-secondary/30 p-4 rounded-xl border border-border/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cost Price Info */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">
              Precio Costo (RD$)
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={`RD$ ${totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}
                className="input-field text-base font-black bg-secondary/60 cursor-not-allowed text-foreground"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block font-medium">
                Suma del costo de adquisición de los componentes
              </span>
            </div>
          </div>

          {/* Sale Price Input */}
          {discountType === 'fixed' && (
            <div>
              <label htmlFor={`${formId}-price-fixed`} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 block">
                Precio de Venta (RD$) *
              </label>
              <input
                id={`${formId}-price-fixed`}
                type="number"
                min={0}
                step={1}
                value={priceInput}
                onChange={(e) => setPriceInput(parseFloat(e.target.value) || 0)}
                className="input-field text-base font-black text-emerald-600 dark:text-emerald-400 border-emerald-500/40 focus:border-emerald-500"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block font-medium">
                Precio de venta final que pagará el cliente
              </span>
            </div>
          )}

          {discountType === 'percent' && (
            <div>
              <label htmlFor={`${formId}-price-percent`} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 block">
                Porcentaje de Descuento (%)
              </label>
              <input
                id={`${formId}-price-percent`}
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={percentInput}
                onChange={(e) => setPercentInput(parseFloat(e.target.value) || 0)}
                className="input-field text-base font-black text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block font-medium">
                Precio de Venta calculado: RD$ {finalPrice.toFixed(2)}
              </span>
            </div>
          )}

          {discountType === 'amount' && (
            <div>
              <label htmlFor={`${formId}-price-amount`} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1 block">
                Monto de Descuento en RD$
              </label>
              <input
                id={`${formId}-price-amount`}
                type="number"
                min={0}
                step={5}
                value={amountInput}
                onChange={(e) => setAmountInput(parseFloat(e.target.value) || 0)}
                className="input-field text-base font-black text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block font-medium">
                Precio de Venta calculado: RD$ {finalPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Real-time Financial Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-border/50">
          <div className="bg-card p-3 rounded-xl border border-border/80">
            <span className="text-[10px] text-muted-foreground font-bold block uppercase">Precio Costo</span>
            <span className="font-extrabold text-foreground text-sm">RD$ {totalCost.toFixed(2)}</span>
          </div>
          <div className="bg-card p-3 rounded-xl border border-border/80">
            <span className="text-[10px] text-emerald-600 font-bold block uppercase">Precio de Venta</span>
            <span className="font-black text-emerald-600 text-sm">RD$ {finalPrice.toFixed(2)}</span>
          </div>
          <div className="bg-card p-3 rounded-xl border border-border/80">
            <span className="text-[10px] text-purple-600 font-bold block uppercase">Ganancia Neta</span>
            <span className="font-extrabold text-purple-600 text-sm">
              RD$ {(finalPrice - totalCost).toFixed(2)}
            </span>
          </div>
          <div className="bg-card p-3 rounded-xl border border-border/80">
            <span className="text-[10px] text-purple-600 font-bold block uppercase">Margen Ganancia %</span>
            <span className="font-extrabold text-purple-600 text-sm">{profitMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
