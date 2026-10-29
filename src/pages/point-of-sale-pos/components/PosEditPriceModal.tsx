import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, Check, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { CartItem } from './POSTerminal';

interface PosEditPriceModalProps {
  open: boolean;
  onClose: () => void;
  item: CartItem | null;
  onConfirm: (cartItemId: string, newPrice: number, reason?: string) => void;
  authorizedBy?: string;
}

const PRESET_REASONS = [
  'Ajuste comercial',
  'Producto averiado / empaque dañado',
  'Precio negociado / cliente especial',
  'Error en etiqueta de góndola',
  'Promoción especial',
];

export default function PosEditPriceModal({
  open,
  onClose,
  item,
  onConfirm,
  authorizedBy,
}: PosEditPriceModalProps) {
  const [priceInput, setPriceInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && item) {
      setPriceInput(item.price.toFixed(2));
      setReason(item.priceChangeReason || '');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [open, item]);

  if (!open || !item) return null;

  const currentPrice = item.price;
  const regularPrice = item.regularPrice ?? item.price;
  const numericPrice = parseFloat(priceInput);
  const safeNewPrice = isNaN(numericPrice) || numericPrice < 0 ? 0 : Math.round(numericPrice * 100) / 100;
  const qty = item.qty || 1;

  const oldSubtotal = currentPrice * qty;
  const newSubtotal = safeNewPrice * qty;
  const diff = newSubtotal - oldSubtotal;

  const handleApplyPresetPct = (pct: number) => {
    const base = regularPrice > 0 ? regularPrice : currentPrice;
    const calculated = Math.max(0, Math.round(base * (1 + pct / 100) * 100) / 100);
    setPriceInput(calculated.toFixed(2));
  };

  const handleRestoreRegular = () => {
    setPriceInput(regularPrice.toFixed(2));
    setReason('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numericPrice) || numericPrice < 0) {
      return;
    }
    onConfirm(item.id, safeNewPrice, reason.trim() || undefined);
    onClose();
  };

  const fmt = (v: number) =>
    `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
              <DollarSign size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Cambiar Precio de Producto</h3>
                {authorizedBy && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck size={12} />
                    {authorizedBy}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-xs sm:max-w-sm mt-0.5">
                {item.name} {item.sku ? `· ${item.sku}` : ''}
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Precios de referencia */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Precio Catálogo:</span>
              <span className="font-bold text-foreground text-sm tabular-nums">{fmt(regularPrice)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Precio Actual en Carrito:</span>
              <span className="font-bold text-foreground text-sm tabular-nums">{fmt(currentPrice)}</span>
            </div>
          </div>

          {/* Campo: Nuevo Precio */}
          <div>
            <label htmlFor="modal-edit-price-input" className="text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Nuevo Precio Unitario (RD$)</span>
              {safeNewPrice !== regularPrice && (
                <button
                  type="button"
                  onClick={handleRestoreRegular}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RotateCcw size={11} />
                  Restaurar catálogo ({fmt(regularPrice)})
                </button>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                RD$
              </span>
              <input
                ref={inputRef}
                id="modal-edit-price-input"
                type="number"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full pl-12 pr-4 h-12 text-lg font-black tabular-nums bg-background border-2 border-border focus:border-blue-500 rounded-xl focus:outline-none transition-colors"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Botones de ajuste rápido (% de descuento o aumento) */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
              Ajustes rápidos sobre precio base:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[-20, -15, -10, -5, 5, 10, 20].map((pct) => (
                <button
                  key={`pct-${pct}`}
                  type="button"
                  onClick={() => handleApplyPresetPct(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    pct < 0
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo del cambio (Opcional) */}
          <div>
            <label htmlFor="modal-edit-price-reason" className="text-xs font-bold text-foreground mb-1 block">
              Motivo del cambio de precio (Opcional):
            </label>
            <input
              id="modal-edit-price-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente frecuente, daño menor, etc."
              className="w-full px-3 h-9 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {PRESET_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Alerta de precio 0 */}
          {safeNewPrice === 0 && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <strong>Atención:</strong> El precio unitario es RD$ 0.00. El producto pasará sin costo.
              </span>
            </div>
          )}

          {/* Resumen del impacto en vivo */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Cantidad en línea:</span>
              <span className="font-bold tabular-nums text-foreground">
                {qty} {item.unit || 'uds'}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal anterior:</span>
              <span className="font-semibold tabular-nums line-through">{fmt(oldSubtotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-border">
              <span className="font-bold text-foreground">Nuevo Subtotal:</span>
              <div className="text-right">
                <span className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  {fmt(newSubtotal)}
                </span>
                {diff !== 0 && (
                  <span
                    className={`block text-[11px] font-bold tabular-nums ${
                      diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {diff < 0 ? `Ahorro: -${fmt(Math.abs(diff))}` : `Diferencia: +${fmt(diff)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
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
              className="btn-primary !h-10 px-5 text-xs font-bold flex items-center gap-1.5 shadow-md bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check size={16} />
              Confirmar Precio
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

