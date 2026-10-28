import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, Edit2, Trash2, Tag, Check, AlertCircle } from 'lucide-react';
import { useCategorias } from '@/hooks/useCategorias';
import { toast } from '@/lib/toast';
import type { Categoria } from '@/services/categorias.service';

interface CategoryManagementModalProps {
  open: boolean;
  onClose: () => void;
  onCategorySelected?: (categoryName: string) => void;
}

export default function CategoryManagementModal({
  open,
  onClose,
  onCategorySelected,
}: CategoryManagementModalProps) {
  const [search, setSearch] = useState('');
  const { categorias, loading, crear, actualizar, eliminar } = useCategorias(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!open) return null;

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setNombre('');
    setCodigo(`CAT-${Date.now().toString(36).toUpperCase().slice(-4)}`);
    setDescripcion('');
    setFormOpen(true);
  };

  const handleOpenEdit = (cat: Categoria) => {
    setEditingCategory(cat);
    setNombre(cat.nombre);
    setCodigo(cat.codigo || '');
    setDescripcion(cat.descripcion || '');
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        await actualizar(editingCategory.id, {
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          descripcion: descripcion.trim() || null,
        });
        toast.success(`Categoría "${nombre.trim()}" actualizada`);
      } else {
        const created = await crear({
          nombre: nombre.trim(),
          codigo: codigo.trim() || undefined,
          descripcion: descripcion.trim() || null,
        });
        toast.success(`Categoría "${created.nombre}" creada con éxito`);
        if (onCategorySelected) {
          onCategorySelected(created.nombre);
        }
      }
      setFormOpen(false);
      setEditingCategory(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: Categoria) => {
    try {
      await eliminar(cat.id);
      toast.success(`Categoría "${cat.nombre}" eliminada`);
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar categoría');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Gestión de Categorías de Productos</h2>
              <p className="text-xs text-muted-foreground">
                Configura categorías reales para organizar y clasificar tus productos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {/* Top Actions: Search + New Category Button */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field !pl-9 !h-9 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-primary text-xs flex items-center gap-1.5 px-3 py-2"
            >
              <Plus size={15} /> Nueva Categoría
            </button>
          </div>

          {/* Inline Form (Create / Edit) */}
          {formOpen && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <Tag size={13} />
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h4>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Nombre <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Abarrotes, Bebidas, Lácteos..."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="input-field !h-9 text-xs"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Código</label>
                  <input
                    type="text"
                    placeholder="Ej. CAT-001"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    className="input-field !h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Descripción (Opcional)</label>
                <input
                  type="text"
                  placeholder="Breve descripción de los productos incluidos..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="input-field !h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="btn-secondary !h-8 text-xs px-3"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary !h-8 text-xs px-4 flex items-center gap-1.5 font-bold"
                  disabled={submitting}
                >
                  <Check size={14} />
                  {submitting ? 'Guardando...' : editingCategory ? 'Actualizar' : 'Guardar Categoría'}
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
                    <th className="px-4 py-2.5">Código</th>
                    <th className="px-4 py-2.5">Nombre</th>
                    <th className="px-4 py-2.5">Descripción</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        Cargando categorías...
                      </td>
                    </tr>
                  ) : categorias.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No se encontraron categorías registradas.
                      </td>
                    </tr>
                  ) : (
                    categorias.map((cat) => (
                      <tr key={cat.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-muted-foreground font-medium">
                          {cat.codigo || '-'}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-foreground">
                          {cat.nombre}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                          {cat.descripcion || 'Sin descripción'}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {deleteConfirmId === cat.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] text-danger font-bold flex items-center gap-1">
                                <AlertCircle size={12} /> ¿Eliminar?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDelete(cat)}
                                className="px-2 py-1 bg-danger text-white rounded text-[11px] font-bold hover:bg-danger/90"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-muted text-foreground rounded text-[11px]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(cat)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                                title="Editar categoría"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(cat.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                                title="Eliminar categoría"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total: <strong>{categorias.length}</strong> categorías disponibles</span>
          <button type="button" onClick={onClose} className="btn-secondary !h-8 px-4 text-xs">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
