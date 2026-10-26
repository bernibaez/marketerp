import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import type { ProveedorOpcion } from '@/services/cxp.service';
import { ButtonSpinner } from '@/components/ui/LoadingSkeleton';

interface CxpCreateViewProps {
  proveedores: ProveedorOpcion[];
  onSave: (payload: {
    proveedor_id: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const CxpCreateView: React.FC<CxpCreateViewProps> = ({
  proveedores,
  onSave,
  onClose,
}) => {
  const [formProveedor, setFormProveedor] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formEmision, setFormEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [formVence, setFormVence] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formProveedor || !formMonto) return;
    setSaving(true);
    try {
      await onSave({
        proveedor_id: formProveedor,
        monto_total: parseFloat(formMonto) || 0,
        fecha_emision: formEmision,
        fecha_vencimiento: formVence,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="text-warning" size={24} />
            Nueva Cuenta por Pagar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra una factura de proveedor con emisión y vencimiento
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
          ← Volver a Cuentas por Pagar
        </button>
      </div>

      <div className="card p-5 sm:p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor *</label>
            <select
              className="input-field"
              value={formProveedor}
              onChange={(e) => setFormProveedor(e.target.value)}
            >
              <option value="">Seleccionar proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Monto Total *</label>
            <input
              className="input-field"
              type="number"
              placeholder="0.00"
              value={formMonto}
              onChange={(e) => setFormMonto(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Emisión</label>
            <input
              className="input-field"
              type="date"
              value={formEmision}
              onChange={(e) => setFormEmision(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vencimiento</label>
            <input
              className="input-field"
              type="date"
              value={formVence}
              onChange={(e) => setFormVence(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            disabled={saving || !formProveedor || !formMonto}
            onClick={handleSubmit}
          >
            {saving ? <ButtonSpinner /> : null}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};
