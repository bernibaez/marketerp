import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, DollarSign, Percent, Check, AlertCircle, ShoppingCart } from 'lucide-react';

export interface PosProductDiscountData {
  price: number;
  qty: number;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  professionalDiscount: number;
}

interface PosProductDiscountModalProps {
  open: boolean;
  onClose: () => void;
  product: {
    id?: string;
    productId?: string;
    name: string;
    sku?: string;
    barcode?: string;
    price: number;
    qty?: number;
    discount?: number;
    discountType?: 'fixed' | 'percentage';
    discountValue?: number;
    professionalDiscount?: number;
    unit?: string;
  } | null;
  onConfirm: (data: PosProductDiscountData) => void;
  isExistingCartItem?: boolean;
}

export default function PosProductDiscountModal({
  open,
  onClose,
  product,
  onConfirm,
  isExistingCartItem = false,
}: PosProductDiscountModalProps) {
  const [unitPrice, setUnitPrice] = useState<number>(190);
  const [qty, setQty] = useState<number>(1);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [professionalDiscount, setProfessionalDiscount] = useState<number>(0);

  useEffect(() => {
    if (product) {
      const basePrice = Number(product.price) || 0;
      setUnitPrice(basePrice);
      setQty(Number(product.qty) > 0 ? Number(product.qty) : 1);
      setDiscountType(product.discountType || 'fixed');

      if (product.discountValue !== undefined && product.discountValue > 0) {
        setDiscountAmount(Number(product.discountValue));
      } else if (product.discount !== undefined && product.discount > 0) {
        if (product.discountType === 'percentage') {
          setDiscountAmount(Number(product.discount));
        } else {
          setDiscountAmount(Math.round(((basePrice * product.discount) / 100) * 100) / 100);
        }
      } else {
        setDiscountAmount(0);
      }

      setProfessionalDiscount(Number(product.professionalDiscount) || 0);
    }
  }, [product, open]);

  if (!open || !product) return null;

  // Calculos en tiempo real
  const safePrice = Math.max(0, isNaN(unitPrice) ? 0 : unitPrice);
  const safeQty = Math.max(0.01, isNaN(qty) ? 1 : qty);
  const safeDiscount = Math.max(0, isNaN(discountAmount) ? 0 : discountAmount);
  const safeProfDiscount = Math.max(0, isNaN(professionalDiscount) ? 0 : professionalDiscount);

  // Descuento por unidad
  let unitDiscount = 0;
  if (discountType === 'fixed') {
    unitDiscount = safeDiscount;
  } else {
    unitDiscount = (safePrice * safeDiscount) / 100;
  }

  // Sumar descuento profesional si aplica
  const totalUnitDiscount = Math.min(safePrice, unitDiscount + safeProfDiscount);
  const finalUnitPrice = Math.max(0, safePrice - totalUnitDiscount);
  const lineSubtotal = safePrice * safeQty;
  const lineTotalDiscount = totalUnitDiscount * safeQty;
  const lineFinalTotal = finalUnitPrice * safeQty;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      price: safePrice,
      qty: safeQty,
      discountType,
      discountValue: safeDiscount,
      professionalDiscount: safeProfDiscount,
    });
    onClose();
  };

  const handleReset = () => {
    setDiscountAmount(0);
    setProfessionalDiscount(0);
    if (product) {
      setUnitPrice(Number(product.price) || 0);
    }
  };

  const fmt = (v: number) =>
    `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isExistingCartItem ? 'Modificar Precio y Descuento' : 'Descuento de Producto'}
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm">
                {product.name} {product.sku ? `· ${product.sku}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Precio Unitario */}
            <div>
              <label htmlFor="modal-unit-price" className="text-xs font-bold text-foreground mb-1 block">
                Precio unitario (RD$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  RD$
                </span>
                <input
                  id="modal-unit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                  className="input-field !pl-11 !h-10 text-sm font-bold tabular-nums"
                  placeholder="190.00"
                  required
                />
              </div>
            </div>

            {/* Campo: Cantidad */}
            <div>
              <label htmlFor="modal-qty" className="text-xs font-bold text-foreground mb-1 block">
                Cantidad {product.unit ? `(${product.unit})` : ''}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center justify-center cursor-pointer border border-border"
                >
                  -
                </button>
                <input
                  id="modal-qty"
                  type="number"
                  step="any"
                  min="0.01"
                  value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                  className="input-field !h-10 text-sm font-bold text-center tabular-nums flex-1"
                  required
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold flex items-center justify-center cursor-pointer border border-border"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Campo: Tipo de Descuento */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">
              Tipo de descuento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  discountType === 'fixed'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <DollarSign size={15} />
                <span>Fijo (Monto RD$)</span>
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  discountType === 'percentage'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <Percent size={15} />
                <span>Porcentaje (%)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Importe de descuento */}
            <div>
              <label htmlFor="modal-discount-amount" className="text-xs font-bold text-foreground mb-1 block">
                Importe de descuento {discountType === 'fixed' ? '(RD$)' : '(%)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  {discountType === 'fixed' ? 'RD$' : '%'}
                </span>
                <input
                  id="modal-discount-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={discountType === 'percentage' ? 100 : safePrice}
                  value={discountAmount === 0 ? '' : discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="input-field !pl-11 !h-10 text-sm font-bold tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Campo: Descuento profesional */}
            <div>
              <label htmlFor="modal-prof-discount" className="text-xs font-bold text-foreground mb-1 block">
                Descuento profesional (RD$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  RD$
                </span>
                <input
                  id="modal-prof-discount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={safePrice}
                  value={professionalDiscount === 0 ? '' : professionalDiscount}
                  onChange={(e) => setProfessionalDiscount(parseFloat(e.target.value) || 0)}
                  className="input-field !pl-11 !h-10 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Quick Discount Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Atajos:</span>
            {[5, 10, 15, 20, 25].map((pct) => (
              <button
                key={`preset-${pct}`}
                type="button"
                onClick={() => {
                  setDiscountType('percentage');
                  setDiscountAmount(pct);
                }}
                className="px-2 py-0.5 rounded-lg text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border"
              >
                {pct}%
              </button>
            ))}
            {(discountAmount > 0 || professionalDiscount > 0) && (
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-0.5 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-auto"
              >
                Limpiar descuento
              </button>
            )}
          </div>

          {/* Live Preview Calculation Box */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Precio base unitario:</span>
              <span className="font-semibold tabular-nums">{fmt(safePrice)}</span>
            </div>
            {totalUnitDiscount > 0 && (
              <div className="flex justify-between text-danger font-semibold">
                <span>Descuento por unidad ({discountType === 'percentage' ? `${safeDiscount}%` : fmt(unitDiscount)}):</span>
                <span className="tabular-nums">- {fmt(totalUnitDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-foreground font-bold">
              <span>Precio unitario final:</span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-extrabold">
                {fmt(finalUnitPrice)}
              </span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between items-center text-sm font-extrabold text-foreground">
              <span>Subtotal línea ({safeQty} {product.unit || 'uds'}):</span>
              <span className="tabular-nums text-base text-primary font-black">
                {fmt(lineFinalTotal)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary !h-10 px-4 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary !h-10 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Check size={16} />
              {isExistingCartItem ? 'Actualizar Producto' : 'Agregar con Descuento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
