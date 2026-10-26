import React, { useState } from 'react';
import { HandCoins } from 'lucide-react';
import type { Cliente } from '@/types/database';
import { ButtonSpinner } from '@/components/ui/LoadingSkeleton';

interface CxcCreateViewProps {
  clientes: Cliente[];
  onSave: (payload: {
    cliente_id: string;
    factura_id?: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const CxcCreateView: React.FC<CxcCreateViewProps> = ({
  clientes,
  onSave,
  onClose,
}) => {
  const [formCliente, setFormCliente] = useState('');
  const [formFactura, setFormFactura] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formEmision, setFormEmision] = useState(() => new Date().toISOString().slice(0, 10));
  const [formVence, setFormVence] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!formCliente || !formMonto) return;
    setSaving(true);
    try {
      await onSave({
        cliente_id: formCliente,
        factura_id: formFactura || undefined,
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
            <HandCoins className="text-primary" size={24} />
            Nueva Cuenta por Cobrar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra un crédito a cliente con factura, emisión y vencimiento
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
          ← Volver a Cuentas por Cobrar
        </button>
      </div>

      <div className="card p-5 sm:p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
            <select
              className="input-field"
              value={formCliente}
              onChange={(e) => setFormCliente(e.target.value)}
            >
              <option value="">Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura</label>
            <input
              className="input-field"
              placeholder="FAC-000"
              value={formFactura}
              onChange={(e) => setFormFactura(e.target.value)}
            />
          </div>
          <div>
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
          <button type="button" disabled={saving} onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !formCliente || !formMonto}
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <ButtonSpinner /> : null}
            {saving ? 'Guardando…' : 'Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
};
