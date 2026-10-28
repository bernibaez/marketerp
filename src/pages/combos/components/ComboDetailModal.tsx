import React from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Package } from 'lucide-react';
import { Combo } from '@/lib/comboStore';

interface ComboDetailModalProps {
  combo: Combo | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (combo: Combo) => void;
}

export default function ComboDetailModal({
  combo,
  isOpen,
  onClose,
  onEdit,
}: ComboDetailModalProps) {
  if (!isOpen || !combo) return null;

  const formatCurrency = (val: number) =>
    `RD$ ${val.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  const costVal = combo.totalCost ?? combo.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
  const profitVal = combo.price - costVal;

  const modalContent = (
    <div className="dialog-inline-host !z-[9999]" onClick={onClose}>
      <div
        className="card w-full max-w-xl my-auto max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border-primary/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
              <Layers className="text-primary" size={20} />
              Detalle de Combo
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {combo.code}
              {combo.barcode ? ` · ${combo.barcode}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 bg-secondary/30 rounded-xl p-3">
            <div>
              <span className="text-muted-foreground block">Nombre:</span>
              <span className="font-bold text-foreground">{combo.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Categoría:</span>
              <span className="font-semibold text-foreground">{combo.category}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Estado:</span>
              <span className={combo.active ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {combo.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Vigencia:</span>
              <span>
                {combo.startDate || '—'} → {combo.endDate || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Visible en POS:</span>
              <span>{combo.visibleInPos ? 'Sí' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Sucursales:</span>
              <span>{combo.allBranches ? 'Todas' : combo.branches.join(', ') || '—'}</span>
            </div>
          </div>

          {combo.description ? (
            <div className="bg-secondary/20 rounded-xl p-3">
              <span className="text-muted-foreground block mb-1">Descripción:</span>
              <p className="text-foreground font-medium">{combo.description}</p>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Package size={12} /> Componentes ({combo.items.length})
            </p>
            <div className="bg-secondary/40 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
              {combo.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center border-b border-border/40 pb-1.5 last:border-none"
                >
                  <div>
                    <span className="font-semibold text-foreground">{item.name || 'Producto'}</span>
                    <span className="text-[11px] text-muted-foreground block font-mono">
                      {item.quantity}x @ {formatCurrency(item.unitPrice)}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </span>
                  </div>
                  <span className="font-bold font-mono text-foreground">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
              Precios y margen
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo componentes:</span>
              <span className="font-mono">{formatCurrency(costVal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio normal:</span>
              <span className="font-mono line-through text-muted-foreground">
                {formatCurrency(combo.normalPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ahorro cliente:</span>
              <span className="font-mono text-emerald-600">
                {formatCurrency(combo.savingsAmount)} (−{combo.savingsPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">Ganancia:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                {formatCurrency(profitVal)} ({combo.marginPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
              <span className="text-foreground">Precio de venta:</span>
              <span className="font-mono text-foreground">{formatCurrency(combo.price)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(combo);
              }}
              className="btn-secondary text-xs py-2"
            >
              Editar Combo
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-primary text-xs py-2">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
