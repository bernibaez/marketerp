import React from 'react';
import { Edit2, X } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

interface EditRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  nombre: string;
  setNombre: (v: string) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
  submitting: boolean;
}

export function EditRoleModal({
  open,
  onClose,
  onSubmit,
  nombre,
  setNombre,
  descripcion,
  setDescripcion,
  submitting,
}: EditRoleModalProps) {
  return (
    <ModalShell open={open} onClose={() => !submitting && onClose()} size="md">
      <form onSubmit={onSubmit} className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Edit2 size={16} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Editar Información del Rol</h3>
              <p className="text-xs text-muted-foreground">Modifica el nombre o descripción del rol</p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Nombre del Rol <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              className="input-field text-sm w-full"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Descripción
            </label>
            <textarea
              rows={3}
              className="input-field text-xs w-full resize-none"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="btn-secondary text-xs py-2 px-4 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !nombre.trim()}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {submitting ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
