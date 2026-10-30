import React, { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { DollarSign, Tag, Plus, Search, Download, Check, X, Trash2, Edit2, Eye, Calendar, CreditCard, User } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import { toast } from '@/lib/toast';
import { useGastos } from '@/hooks/useGastos';
import { useAuth } from '@/context/AuthContext';
import type { GastoStatusUi, GastoUi } from '@/services/gastos.service';
import {
  InlineLoader,
  KpiGridSkeleton,
  PageContentSkeleton,
  Skeleton,
} from '@/components/ui/LoadingSkeleton';
import ModalShell from '@/components/ui/ModalShell';

type Tab = 'list' | 'categories';

const statusMap: Record<GastoStatusUi, { label: string; cls: string }> = {
  approved: { label: 'Aprobado', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  rejected: { label: 'Rechazado', cls: 'badge-danger' },
};

const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia bancaria' },
  { id: 'tarjeta', label: 'Tarjeta de débito/crédito' },
  { id: 'caja_chica', label: 'Caja chica' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'otro', label: 'Otro' },
];

const formatMetodoPago = (val?: string) => {
  if (!val) return 'Efectivo';
  const m = val.toLowerCase();
  if (m === 'efectivo') return 'Efectivo';
  if (m === 'transferencia') return 'Transferencia';
  if (m === 'tarjeta') return 'Tarjeta';
  if (m === 'caja_chica') return 'Caja chica';
  if (m === 'cheque') return 'Cheque';
  return val.charAt(0).toUpperCase() + val.slice(1);
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const {
    gastos,
    categorias,
    loading,
    error,
    crear,
    actualizar,
    crearCategoria,
    cambiarEstado,
    eliminar,
    eliminarCategoria,
  } = useGastos();

  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoUi | null>(null);
  const [viewingGasto, setViewingGasto] = useState<GastoUi | null>(null);

  const [catId, setCatId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [responsableNombre, setResponsableNombre] = useState('');
  const [tieneRecibo, setTieneRecibo] = useState(false);

  const [catNombre, setCatNombre] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPresupuesto, setCatPresupuesto] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return gastos.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.paymentMethod && e.paymentMethod.toLowerCase().includes(q)) ||
        (e.responsible && e.responsible.toLowerCase().includes(q))
    );
  }, [gastos, search]);

  const totalSpent = gastos.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);

  const handleExportPdf = () => {
    if (tab === 'list') {
      exportTableToPdf({
        title: 'Listado de Gastos',
        filename: 'gastos',
        headers: ['Código', 'Fecha', 'Categoría', 'Descripción', 'Método', 'Responsable', 'Monto', 'Recibo', 'Estado'],
        rows: filtered.map((e) => [
          e.code,
          e.date,
          e.category,
          e.description,
          formatMetodoPago(e.paymentMethod),
          e.responsible,
          formatMoneyPdf(e.amount),
          e.receipt ? 'Sí' : 'No',
          statusMap[e.status]?.label ?? e.status,
        ]),
        landscape: true,
      });
      return;
    }
    exportTableToPdf({
      title: 'Categorías de Gastos',
      filename: 'categorias-gastos',
      headers: ['Categoría', 'Descripción', 'Presupuesto', 'Gastado', 'Disponible'],
      rows: categorias.map((c) => [
        c.name, c.description, formatMoneyPdf(c.budget), formatMoneyPdf(c.spent), formatMoneyPdf(c.budget - c.spent),
      ]),
    });
  };

  const resetModal = () => {
    setCatId('');
    setDescripcion('');
    setMonto('');
    setFecha(new Date().toISOString().slice(0, 10));
    setMetodoPago('efectivo');
    setResponsableNombre(user?.name || '');
    setTieneRecibo(false);
    setCatNombre('');
    setCatDesc('');
    setCatPresupuesto('');
    setEditingGasto(null);
  };

  const openCreateModal = () => {
    resetModal();
    setResponsableNombre(user?.name || '');
    setShowModal(true);
  };

  const openEditGasto = (gasto: GastoUi) => {
    setEditingGasto(gasto);
    setCatId(gasto.categoryId ?? '');
    setDescripcion(gasto.description);
    setMonto(String(gasto.amount));
    setFecha(gasto.date || new Date().toISOString().slice(0, 10));
    setMetodoPago(gasto.paymentMethod || 'efectivo');
    setResponsableNombre(gasto.responsible || user?.name || '');
    setTieneRecibo(gasto.receipt);
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    resetModal();
  };

  const handleSave = async () => {
    if (tab === 'list') {
      if (!catId) {
        toast.error('Selecciona una categoría');
        return;
      }
      if (!descripcion.trim()) {
        toast.error('La descripción es obligatoria');
        return;
      }
      const m = parseFloat(monto);
      if (!(m > 0)) {
        toast.error('El monto debe ser mayor a 0');
        return;
      }
    } else if (!catNombre.trim()) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }

    setSaving(true);
    try {
      if (tab === 'list') {
        const m = parseFloat(monto);
        const respFinal = responsableNombre.trim() || user?.name || 'Administración';
        if (editingGasto) {
          await actualizar(editingGasto.id, {
            categoria_id: catId,
            descripcion: descripcion.trim(),
            monto: m,
            fecha,
            metodo_pago: metodoPago,
            responsable_nombre: respFinal,
            tiene_recibo: tieneRecibo,
          });
          toast.success('Gasto actualizado');
        } else {
          await crear({
            categoria_id: catId,
            descripcion: descripcion.trim(),
            monto: m,
            fecha,
            metodo_pago: metodoPago,
            responsable_nombre: respFinal,
            tiene_recibo: tieneRecibo,
            estado: 'aprobado',
          });
          toast.success('Gasto registrado con éxito');
        }
      } else {
        await crearCategoria({
          nombre: catNombre,
          descripcion: catDesc,
          presupuesto_mensual: parseFloat(catPresupuesto) || 0,
        });
        toast.success('Categoría creada');
      }
      closeFormModal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading && gastos.length === 0) {
    return (
      <AppLayout>
        <PageContentSkeleton kpiCount={4} tableCols={9} tableRows={6} />
      </AppLayout>
    );
  }

  if (showModal) {
    const formTitle =
      tab === 'list' ? (editingGasto ? 'Editar Gasto' : 'Nuevo Gasto') : 'Nueva Categoría';
    const formSubtitle =
      tab === 'list'
        ? editingGasto
          ? `Actualiza los datos de ${editingGasto.code}`
          : 'Registra un gasto operativo'
        : 'Define una categoría con presupuesto mensual';

    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{formTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">{formSubtitle}</p>
            </div>
            <button type="button" onClick={closeFormModal} className="btn-secondary" disabled={saving}>
              ← Volver a Gastos
            </button>
          </div>

          <div className="card p-5 sm:p-6 space-y-4 max-w-3xl">
            {tab === 'list' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Categoría *</label>
                  <select
                    className="input-field"
                    value={catId}
                    onChange={(e) => setCatId(e.target.value)}
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descripción *</label>
                  <input
                    className="input-field"
                    placeholder="Ej: Pago de electricidad, flete o compra de insumos"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Monto (RD$) *</label>
                  <input
                    className="input-field"
                    placeholder="Monto (RD$)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fecha del Gasto *</label>
                  <input
                    className="input-field"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Método de Pago *</label>
                  <select
                    className="input-field"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Usuario / Responsable</label>
                  <input
                    className="input-field"
                    placeholder="Nombre del responsable"
                    value={responsableNombre}
                    onChange={(e) => setResponsableNombre(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 pt-1">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tieneRecibo}
                      onChange={(e) => setTieneRecibo(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span>Tiene factura física o comprobante con soporte</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  className="input-field"
                  placeholder="Nombre de la categoría"
                  value={catNombre}
                  onChange={(e) => setCatNombre(e.target.value)}
                />
                <textarea
                  className="input-field"
                  placeholder="Descripción"
                  rows={3}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="Presupuesto mensual (RD$)"
                  type="number"
                  value={catPresupuesto}
                  onChange={(e) => setCatPresupuesto(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-border">
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={saving}
                onClick={closeFormModal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {!viewingGasto && (
        <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
            <p className="text-sm text-muted-foreground mt-1">Control de gastos operativos y categorías</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Plus size={16} />
            {tab === 'list' ? 'Nuevo Gasto' : 'Nueva Categoría'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {loading ? (
          <KpiGridSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Gastos del mes</p>
            <p className="text-2xl font-bold text-foreground mt-1">RD$ {totalSpent.toLocaleString()}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Registros</p>
            <p className="text-2xl font-bold text-info mt-1">{gastos.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-bold text-warning mt-1">
              {gastos.filter((e) => e.status === 'pending').length}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Categorías</p>
            <p className="text-2xl font-bold text-primary mt-1">{categorias.length}</p>
          </div>
        </div>
        )}

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[
            { id: 'list' as Tab, label: 'Lista de Gastos', icon: <DollarSign size={16} /> },
            { id: 'categories' as Tab, label: 'Categorías', icon: <Tag size={16} /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-9"
              placeholder="Buscar gastos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" onClick={handleExportPdf} className="btn-secondary flex items-center gap-2">
            <Download size={16} />
            Exportar PDF
          </button>
        </div>

        {tab === 'list' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Método</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Responsable</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Monto</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden xl:table-cell">Comprobante</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <InlineLoader colSpan={10} message="Cargando gastos…" />}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No hay gastos registrados</td>
                    </tr>
                  )}
                  {filtered.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
                    >
                      <td className="px-4 py-3 font-mono text-primary font-medium">{e.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{e.description}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="badge-neutral">{e.category}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="badge-info text-xs">{formatMetodoPago(e.paymentMethod)}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{e.responsible}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{e.date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {e.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {e.receipt ? <span className="badge-success">Sí</span> : <span className="badge-danger">No</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusMap[e.status].cls}>{statusMap[e.status].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Ver"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setViewingGasto(e)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => openEditGasto(e)}
                          >
                            <Edit2 size={14} />
                          </button>
                          {e.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                title="Aprobar"
                                className="p-1.5 rounded-lg hover:bg-secondary text-success"
                                onClick={async () => {
                                  try {
                                    await cambiarEstado(e.id, 'aprobado');
                                    toast.success('Gasto aprobado');
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : 'Error');
                                  }
                                }}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                title="Rechazar"
                                className="p-1.5 rounded-lg hover:bg-secondary text-danger"
                                onClick={async () => {
                                  try {
                                    await cambiarEstado(e.id, 'rechazado');
                                    toast.success('Gasto rechazado');
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : 'Error');
                                  }
                                }}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            title="Eliminar"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger"
                            onClick={async () => {
                              if (!confirm(`¿Eliminar ${e.code}?`)) return;
                              try {
                                await eliminar(e.id);
                                toast.success('Gasto eliminado');
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Solo admin puede eliminar');
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
              Mostrando {filtered.length} de {gastos.length} gastos
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading &&
              Array.from({ length: 3 }, (_, i) => (
                <div key={`cat-skel-${i}`} className="card p-5 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            {!loading && categorias.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
                No hay categorías. Crea la primera con «Nueva Categoría».
              </p>
            )}
            {categorias.map((cat) => {
              const pct = cat.budget > 0 ? Math.min(100, Math.round((cat.spent / cat.budget) * 100)) : 0;
              const color = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-primary';
              return (
                <div key={cat.id} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{cat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description || '—'}</p>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger"
                      onClick={async () => {
                        if (!confirm(`¿Desactivar categoría ${cat.name}?`)) return;
                        try {
                          await eliminarCategoria(cat.id);
                          toast.success('Categoría desactivada');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Error');
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Gastado</span>
                      <span className="font-semibold text-foreground">
                        RD$ {cat.spent.toLocaleString()} / {cat.budget.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={pct >= 90 ? 'text-danger font-medium' : 'text-muted-foreground'}>
                        {pct}% utilizado
                      </span>
                      <span className="text-muted-foreground">
                        Disponible: RD$ {(cat.budget - cat.spent).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>
        )}
      </div>

      <ModalShell
        open={!!viewingGasto}
        onClose={() => setViewingGasto(null)}
        size="md"
        className="p-6"
      >
        {viewingGasto && (
          <>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-bold text-foreground">Detalle del Gasto</h2>
              <button
                type="button"
                onClick={() => setViewingGasto(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Código</span>
                <span className="font-mono font-medium text-primary">{viewingGasto.code}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Estado</span>
                <span className={statusMap[viewingGasto.status].cls}>
                  {statusMap[viewingGasto.status].label}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground block">Descripción</span>
                <span className="font-medium text-foreground">{viewingGasto.description}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Categoría</span>
                <span className="text-foreground">{viewingGasto.category}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Monto</span>
                <span className="font-bold text-foreground">
                  RD$ {viewingGasto.amount.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Método de Pago</span>
                <span className="text-foreground font-medium">{formatMetodoPago(viewingGasto.paymentMethod)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Responsable</span>
                <span className="text-foreground">{viewingGasto.responsible}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Fecha</span>
                <span className="text-foreground">{viewingGasto.date}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Comprobante</span>
                {viewingGasto.receipt ? (
                  <span className="badge-success">Sí</span>
                ) : (
                  <span className="badge-danger">No</span>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setViewingGasto(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  const g = viewingGasto;
                  setViewingGasto(null);
                  if (g) openEditGasto(g);
                }}
              >
                Editar
              </button>
            </div>
          </>
        )}
      </ModalShell>
    </AppLayout>
  );
}
