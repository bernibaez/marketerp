import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, Edit2, Trash2, Scale, Check, AlertCircle, Box, Layers } from 'lucide-react';
import { useUnidadesMedida } from '@/hooks/useUnidadesMedida';
import { toast } from '@/lib/toast';
import type { UnidadMedida, TipoUnidadMedida } from '@/services/unidadesMedida.service';

interface UnitManagementModalProps {
  open: boolean;
  onClose: () => void;
  onUnitSelected?: (unitName: string) => void;
}

const TIPO_LABELS: Record<TipoUnidadMedida, { label: string; color: string; badge: string }> = {
  unidad: {
    label: 'Unidad simple',
    color: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  peso: {
    label: 'Peso / Balanza',
    color: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  volumen: {
    label: 'Volumen / Líquido',
    color: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  empaque: {
    label: 'Empaque / Paquete / Fardo',
    color: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
};

export default function UnitManagementModal({
  open,
  onClose,
  onUnitSelected,
}: UnitManagementModalProps) {
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoUnidadMedida | 'todos'>('todos');
  const { unidades, loading, crear, actualizar, eliminar } = useUnidadesMedida({
    search,
    tipo: filterTipo,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnidadMedida | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [abreviatura, setAbreviatura] = useState('');
  const [tipo, setTipo] = useState<TipoUnidadMedida>('unidad');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!open) return null;

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setNombre('');
    setCodigo(`UND-${Date.now().toString(36).toUpperCase().slice(-4)}`);
    setAbreviatura('');
    setTipo('unidad');
    setDescripcion('');
    setFormOpen(true);
  };

  const handleOpenEdit = (unit: UnidadMedida) => {
    setEditingUnit(unit);
    setNombre(unit.nombre);
    setCodigo(unit.codigo || '');
    setAbreviatura(unit.abreviatura || '');
    setTipo(unit.tipo || 'unidad');
    setDescripcion(unit.descripcion || '');
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre de la unidad de medida es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUnit) {
        await actualizar(editingUnit.id, {
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          abreviatura: abreviatura.trim() || undefined,
          tipo,
          descripcion: descripcion.trim() || null,
        });
        toast.success(`Unidad "${nombre.trim()}" actualizada con éxito`);
      } else {
        const created = await crear({
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          abreviatura: abreviatura.trim() || undefined,
          tipo,
          descripcion: descripcion.trim() || null,
        });
        toast.success(`Unidad "${created.nombre}" creada con éxito`);
        if (onUnitSelected) {
          onUnitSelected(created.nombre);
        }
      }
      setFormOpen(false);
      setEditingUnit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la unidad de medida');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (unit: UnidadMedida) => {
    try {
      await eliminar(unit.id);
      toast.success(`Unidad "${unit.nombre}" eliminada`);
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar unidad');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Gestión de Unidades de Medida</h2>
              <p className="text-xs text-muted-foreground">
                Configura unidades, empaques, cartones, combos y pesos para tu catálogo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Top Actions: Search + Filter Tabs + New Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar unidad (ej: cartón, combo, libra, fardo)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field !pl-9 !h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as TipoUnidadMedida | 'todos')}
                className="input-field !h-9 text-xs py-1 px-2.5 font-medium"
              >
                <option value="todos">Todos los tipos</option>
                <option value="unidad">Unidades</option>
                <option value="empaque">Empaques / Fardos / Cartones</option>
                <option value="peso">Peso / Balanza</option>
                <option value="volumen">Volumen</option>
              </select>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn-primary text-xs flex items-center gap-1.5 px-3 py-2 shrink-0 cursor-pointer"
              >
                <Plus size={15} /> Nueva Unidad
              </button>
            </div>
          </div>

          {/* Inline Form (Create / Edit) */}
          {formOpen && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <Scale size={13} />
                  {editingUnit ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida'}
                </h4>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Nombre de la Unidad <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Cartón, Combo, Libra, Kilogramo, Fardo..."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="input-field !h-9 text-xs"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Tipo de Unidad <span className="text-danger">*</span>
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoUnidadMedida)}
                    className="input-field !h-9 text-xs"
                  >
                    <option value="unidad">Unidad simple (unidad, combo, docena)</option>
                    <option value="empaque">Empaque múltiple (cartón, fardo, caja, paquete)</option>
                    <option value="peso">Peso / Balanza (libra, kilogramo, gramo)</option>
                    <option value="volumen">Volumen / Líquido (litro, galón, botella)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Abreviatura / Símbolo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. ctn, cmb, lb, kg, ud, fdo..."
                    value={abreviatura}
                    onChange={(e) => setAbreviatura(e.target.value)}
                    className="input-field !h-9 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Código</label>
                  <input
                    type="text"
                    placeholder="Ej. UND-001"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="input-field !h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Presentación de 30 huevos, caja por 24 unidades, etc."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="input-field !h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="btn-secondary !h-8 text-xs px-3 cursor-pointer"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary !h-8 text-xs px-4 flex items-center gap-1.5 font-bold cursor-pointer"
                  disabled={submitting}
                >
                  <Check size={14} />
                  {submitting ? 'Guardando...' : editingUnit ? 'Actualizar' : 'Guardar Unidad'}
                </button>
              </div>
            </form>
          )}

          {/* List Table */}
          <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Código / Abrev.</th>
                    <th className="px-4 py-2.5">Nombre</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Descripción</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Cargando unidades de medida...
                      </td>
                    </tr>
                  ) : unidades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No se encontraron unidades de medida.
                      </td>
                    </tr>
                  ) : (
                    unidades.map((unit) => {
                      const tipoConfig = TIPO_LABELS[unit.tipo] || TIPO_LABELS.unidad;
                      return (
                        <tr key={unit.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-muted-foreground font-medium">
                            <span className="font-bold text-foreground mr-1.5">
                              {unit.abreviatura || '-'}
                            </span>
                            {unit.codigo && (
                              <span className="text-[10px] text-muted-foreground/70">
                                ({unit.codigo})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-foreground">
                            {unit.nombre}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${tipoConfig.badge}`}
                            >
                              {unit.tipo === 'empaque' ? (
                                <Box size={11} />
                              ) : unit.tipo === 'peso' ? (
                                <Scale size={11} />
                              ) : (
                                <Layers size={11} />
                              )}
                              {tipoConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                            {unit.descripcion || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {onUnitSelected && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUnitSelected(unit.nombre);
                                    onClose();
                                  }}
                                  className="btn-secondary !h-7 px-2 text-[11px] font-medium text-primary hover:text-primary-foreground hover:bg-primary cursor-pointer mr-1"
                                  title="Seleccionar unidad"
                                >
                                  Usar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(unit)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Editar unidad"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(unit.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                title="Eliminar unidad"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {unidades.length} {unidades.length === 1 ? 'unidad configurada' : 'unidades configuradas'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary !h-8 text-xs px-4 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border p-5 shadow-2xl space-y-3">
            <div className="flex items-center gap-2 text-danger">
              <AlertCircle size={18} />
              <h4 className="text-sm font-bold">¿Eliminar unidad de medida?</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Los productos existentes que ya tengan esta unidad asignada conservarán el texto.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-secondary !h-8 text-xs px-3 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const toDelete = unidades.find((u) => u.id === deleteConfirmId);
                  if (toDelete) handleDelete(toDelete);
                }}
                className="btn-danger !h-8 text-xs px-3 font-bold cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

