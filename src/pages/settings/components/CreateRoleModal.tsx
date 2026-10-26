import React from 'react';
import { Plus, X, Check } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  nombre: string;
  setNombre: (v: string) => void;
  codigo: string;
  setCodigo: (v: string) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
  template: string;
  setTemplate: (v: string) => void;
  submitting: boolean;
}

export function CreateRoleModal({
  open,
  onClose,
  onSubmit,
  nombre,
  setNombre,
  codigo,
  setCodigo,
  descripcion,
  setDescripcion,
  template,
  setTemplate,
  submitting,
}: CreateRoleModalProps) {
  return (
    <ModalShell open={open} onClose={() => !submitting && onClose()} size="md">
      <form onSubmit={onSubmit} className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Plus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Crear Nuevo Rol</h3>
              <p className="text-xs text-muted-foreground">Define un nuevo rol y personaliza sus permisos</p>
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
              placeholder="Ej: Supervisor de Turno, Auditor, etc."
              value={nombre}
              onChange={(e) => {
                const val = e.target.value;
                setNombre(val);
                if (!codigo || codigo === nombre.toLowerCase().replace(/[^a-z0-9_]+/g, '_')) {
                  setCodigo(val.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Código identificador (sistema) <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              className="input-field text-xs font-mono w-full"
              placeholder="ej: supervisor_turno"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
            />
            <span className="text-[11px] text-muted-foreground">Solo letras minúsculas, números y guiones bajos</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Descripción (opcional)
            </label>
            <textarea
              rows={2}
              className="input-field text-xs w-full resize-none"
              placeholder="Describe la responsabilidad o propósito de este rol..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Plantilla base de permisos
            </label>
            <select
              className="input-field text-xs w-full cursor-pointer"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="cajero">Cajero (3 áreas: POS, ventas y caja)</option>
              <option value="vendedor">Vendedor (8 áreas: ventas, clientes, CxC)</option>
              <option value="almacen">Almacenista (8 áreas: inventario, transferencias, compras)</option>
              <option value="contable">Contador (10 áreas: finanzas, informes, auditoría)</option>
              <option value="admin">Administrador (Acceso total)</option>
              <option value="empty">Sin accesos (empezar en blanco)</option>
            </select>
            <span className="text-[11px] text-muted-foreground">
              El nuevo rol heredará estos permisos como punto de partida y podrás afinarlos de inmediato.
            </span>
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
            {submitting ? (
              <span>Creando…</span>
            ) : (
              <>
                <Check size={14} />
                <span>Crear y Configurar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
