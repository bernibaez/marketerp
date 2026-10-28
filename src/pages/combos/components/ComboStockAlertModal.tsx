import React from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, X, PackageX, Lock } from 'lucide-react';

interface MissingStockItem {
  productId: string;
  sku: string;
  name: string;
  required: number;
  available: number;
}

interface ComboStockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  comboName: string;
  missingItems: MissingStockItem[];
}

export default function ComboStockAlertModal({
  isOpen,
  onClose,
  comboName,
  missingItems,
}: ComboStockAlertModalProps) {
  if (!isOpen) return null;

  const modalContent = (
    <div className="dialog-inline-host !z-[9999]" onClick={onClose}>
      <div
        className="bg-card w-full max-w-md rounded-3xl border border-danger/40 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-danger/10 p-6 border-b border-danger/20 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-danger/20 text-danger flex items-center justify-center mx-auto shadow-xs">
            <AlertOctagon size={32} />
          </div>
          <h2 className="text-lg font-black text-foreground">Stock Insuficiente en Componentes</h2>
          <p className="text-xs font-semibold text-muted-foreground">
            No es posible vender el combo <span className="font-extrabold text-foreground">"{comboName}"</span> debido a falta de existencias.
          </p>
        </div>

        {/* Missing items list */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
            <PackageX size={16} className="text-danger" /> Productos Agotados o Insuficientes:
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {missingItems.map((item) => (
              <div
                key={item.sku}
                className="p-3 bg-secondary/40 rounded-xl border border-border/80 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-extrabold text-foreground">{item.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">SKU: {item.sku}</p>
                </div>
                <div className="text-right">
                  <span className="text-danger font-black block">Disponible: {item.available}</span>
                  <span className="text-muted-foreground font-semibold text-[11px]">
                    Requerido: {item.required}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300 font-medium">
            <Lock size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              La venta está bloqueada. Para permitir vender sin existencias, habilita la casilla{' '}
              <strong>"Permitir venta sin stock"</strong> en la configuración del combo.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/80 bg-card flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary bg-danger hover:bg-danger/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
