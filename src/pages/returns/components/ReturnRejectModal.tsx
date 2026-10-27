import React from 'react';
import { X, XCircle } from 'lucide-react';
import type { PosReturn } from '@/lib/posStore';

interface ReturnRejectModalProps {
  returnItem: PosReturn;
  reasonInput: string;
  onReasonChange: (val: string) => void;
  onClose: () => void;
  onConfirm: (e: React.FormEvent) => void;
}

const PRESET_REASONS = [
  'No cumple políticas de tienda',
  'Producto deteriorado o usado',
  'Fuera del plazo permitido (30 días)',
  'Falta comprobante fiscal original',
  'Error en la solicitud del cajero',
];

export default function ReturnRejectModal({
  returnItem,
  reasonInput,
  onReasonChange,
  onClose,
  onConfirm,
}: ReturnRejectModalProps) {
  return (
    <div className="dialog-inline-host" onClick={onClose}>
      <form
        onSubmit={onConfirm}
        className="card w-full max-w-md p-6 space-y-4 shadow-2xl border-rose-500/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <XCircle size={24} />
            <h3 className="font-extrabold text-foreground text-lg">Rechazar Solicitud de Devolución</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Por favor especifica o selecciona el motivo por el cual estás rechazando la devolución{' '}
          <strong className="font-mono text-foreground">{returnItem.code}</strong> (
          <strong className="text-danger">RD$ {returnItem.total.toLocaleString()}</strong>).
        </p>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
            Motivo del Rechazo
          </label>
          <textarea
            rows={3}
            required
            autoFocus
            className="input-field text-xs py-2 w-full focus:ring-rose-500"
            placeholder="Escribe el motivo del rechazo..."
            value={reasonInput}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>

        {/* Quick Option Pills */}
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
            Opciones rápidas de motivo:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onReasonChange(preset)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  reasonInput === preset
                    ? 'bg-rose-600 text-white border-rose-700 font-bold shadow-xs'
                    : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button type="button" className="btn-secondary text-xs py-2" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 font-bold"
          >
            <XCircle size={15} /> Confirmar Rechazo
          </button>
        </div>
      </form>
    </div>
  );
}
