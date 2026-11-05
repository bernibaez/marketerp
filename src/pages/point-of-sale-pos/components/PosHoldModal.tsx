import React, { useState } from 'react';
import { X, Pause, Play, Trash2 } from 'lucide-react';
import type { HeldSale } from '@/lib/posStore';

interface Props {
  heldSales: HeldSale[];
  canHold: boolean;
  onHold: (label: string) => void;
  onResume: (sale: HeldSale) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function PosHoldModal({ heldSales, canHold, onHold, onResume, onDelete, onClose }: Props) {
  const [label, setLabel] = useState('');

  return (
    <div className="dialog-inline-host" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Pausar / Retomar ventas</h3>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {canHold && (
          <div className="space-y-2 border border-border rounded-xl p-3">
            <p className="text-sm font-medium text-foreground">Pausar venta actual</p>
            <input
              className="input-field"
              placeholder="Etiqueta (opcional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => onHold(label)}>
              <Pause size={16} /> Guardar y pausar
            </button>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-foreground mb-2">Ventas pausadas ({heldSales.length})</p>
          {heldSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay ventas guardadas</p>
          ) : (
            <div className="space-y-2">
              {heldSales.map((s) => (
                <div key={s.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-3 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{s.label}</p>
                      {s.total != null && s.total > 0 && (
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          RD$ {Number(s.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(s.cart as unknown[]).length} ítem(s) · {new Date(s.savedAt).toLocaleString('es-DO')}
                      {s.cashierName && <span> · Por: <strong className="text-foreground">{s.cashierName}</strong></span>}
                      {s.cajaLabel && <span> ({s.cajaLabel})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" className="btn-primary text-xs py-1.5 px-2.5 flex items-center gap-1 cursor-pointer" onClick={() => onResume(s)}>
                      <Play size={12} /> Retomar
                    </button>
                    <button type="button" className="p-1.5 text-muted-foreground hover:text-danger rounded-lg transition cursor-pointer" title="Eliminar venta en espera" onClick={() => onDelete(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
