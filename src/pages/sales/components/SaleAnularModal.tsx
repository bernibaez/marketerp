import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { VentaConDetalle } from '@/services/ventas.service';

interface SaleAnularModalProps {
  sale: VentaConDetalle;
  motivo: string;
  onMotivoChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const SaleAnularModal: React.FC<SaleAnularModalProps> = ({
  sale,
  motivo,
  onMotivoChange,
  onConfirm,
  onClose,
}) => {
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md my-auto max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border-rose-500/30 bg-white dark:bg-slate-900 rounded-2xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={24} />
            <h3 className="font-extrabold text-foreground text-lg">Anular Factura de Venta</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          ¿Estás seguro de anular la factura <strong className="font-mono text-foreground">{sale.numero_factura}</strong> por{' '}
          <strong className="text-rose-600 font-bold">
            RD$ {sale.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </strong>
          ? El estado de la factura cambiará a &quot;Anulada&quot; y el stock será restaurado en la base de datos.
        </p>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">Motivo de Anulación</label>
          <input
            className="input-field text-xs py-2 w-full rounded-xl"
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs py-2">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs"
          >
            <Trash2 size={14} /> Confirmar Anulación
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
