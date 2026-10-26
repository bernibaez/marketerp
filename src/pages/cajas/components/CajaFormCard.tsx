import React from 'react';
import { Monitor, X, CheckCircle } from 'lucide-react';
import type { Caja } from '@/types/database';

export interface CajaFormData {
  codigo: string;
  nombre: string;
  descripcion: string;
  es_caja_principal: boolean;
  activa: boolean;
}

interface CajaFormCardProps {
  editingCaja: Caja | null;
  form: CajaFormData;
  setForm: React.Dispatch<React.SetStateAction<CajaFormData>>;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const CajaFormCard: React.FC<CajaFormCardProps> = ({
  editingCaja,
  form,
  setForm,
  saving,
  onSave,
  onClose,
}) => {
  return (
    <div className="p-5 rounded-2xl border-2 border-primary/40 bg-card shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
          <Monitor size={20} className="text-primary" />
          <span>{editingCaja ? 'Editar Caja Registradora' : 'Nueva Caja Registradora'}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Código
            </label>
            <input
              type="text"
              required
              className="input-field font-mono font-bold w-full"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
              Nombre de Caja
            </label>
            <input
              type="text"
              required
              className="input-field font-bold w-full"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Caja #1 - Administrador"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Descripción (Opcional)
          </label>
          <textarea
            rows={2}
            className="input-field resize-none text-xs w-full"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Ej: Ubicada en mostrador principal..."
          />
        </div>

        <div className="flex flex-wrap gap-6 pt-1">
          <label className="flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.es_caja_principal}
              onChange={(e) => setForm({ ...form, es_caja_principal: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Marcar como Caja Principal del sistema</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Caja activa y disponible para el POS</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            className="btn-secondary text-xs py-2 px-4"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary text-xs font-bold py-2 px-5 flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle size={15} />
            <span>{saving ? 'Guardando…' : editingCaja ? 'Guardar Cambios' : 'Crear Caja'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
