import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Plus, Search, Download, Eye } from 'lucide-react';
import { exportTableToPdf } from '@/lib/exportPdf';
import { toast } from '@/lib/toast';
import {
  crearTransferencia,
  obtenerSucursales,
  obtenerTransferencias,
  type SucursalUi,
  type TransferenciaUi,
} from '@/services/transferencias.service';
import { useProductos } from '@/hooks/useProductos';

const statusMap: Record<
  TransferenciaUi['estado'],
  { label: string; cls: string }
> = {
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  en_transito: { label: 'En tránsito', cls: 'badge-info' },
  recibida: { label: 'Recibida', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
};

export default function StockTransfersPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [transfers, setTransfers] = useState<TransferenciaUi[]>([]);
  const [sucursales, setSucursales] = useState<SucursalUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');

  const { productosUi } = useProductos({ pagina: 1, limite: 5000, estado: 'activo' });

  const reload = async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([obtenerTransferencias(), obtenerSucursales()]);
      setTransfers(t);
      setSucursales(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar transferencias');
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transfers.filter(
      (t) =>
        t.codigo.toLowerCase().includes(q) ||
        t.origen.toLowerCase().includes(q) ||
        t.destino.toLowerCase().includes(q)
    );
  }, [transfers, search]);

  const mesActual = new Date().toISOString().slice(0, 7);
  const delMes = transfers.filter((t) => t.fecha.startsWith(mesActual));
  const pendientes = transfers.filter((t) => t.estado === 'pendiente' || t.estado === 'en_transito').length;
  const completadas = transfers.filter((t) => t.estado === 'recibida').length;

  const closeForm = () => {
    setShowForm(false);
    setOrigenId('');
    setDestinoId('');
    setMotivo('');
    setProductoId('');
    setCantidad('1');
  };

  const handleCreate = async () => {
    const qty = Number(cantidad);
    if (!origenId || !destinoId) {
      toast.error('Selecciona origen y destino');
      return;
    }
    if (!productoId || !qty || qty <= 0) {
      toast.error('Selecciona un producto y cantidad válida');
      return;
    }
    setSaving(true);
    try {
      await crearTransferencia({
        sucursal_origen_id: origenId,
        sucursal_destino_id: destinoId,
        motivo: motivo.trim() || undefined,
        lineas: [{ producto_id: productoId, cantidad: qty }],
      });
      toast.success('Transferencia registrada');
      closeForm();
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la transferencia');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Transferencias de Stock',
      filename: 'transferencias-stock',
      headers: ['Código', 'Origen', 'Destino', 'Fecha', 'Ítems', 'Estado'],
      rows: filtered.map((t) => [
        t.codigo,
        t.origen,
        t.destino,
        t.fecha,
        t.items,
        statusMap[t.estado]?.label ?? t.estado,
      ]),
    });
  };

  if (showForm) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Transferencia</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Mueve productos entre sucursales registradas en la base de datos
              </p>
            </div>
            <button type="button" onClick={closeForm} className="btn-secondary" disabled={saving}>
              ← Volver a Transferencias
            </button>
          </div>

          <div className="card p-5 sm:p-6 space-y-4 max-w-2xl">
            {sucursales.length < 2 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Necesitas al menos 2 sucursales activas en Supabase para crear transferencias.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal Origen *</label>
                <select className="input-field" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal Destino *</label>
                <select className="input-field" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto *</label>
                <select className="input-field" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                  <option value="">Seleccionar producto…</option>
                  {productosUi.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — stock {p.currentStock}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad *</label>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo</label>
                <input
                  className="input-field"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" className="btn-secondary" disabled={saving} onClick={closeForm}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={handleCreate}>
                {saving ? 'Guardando…' : 'Crear Transferencia'}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transferencia de Stock</h1>
            <p className="text-sm text-muted-foreground mt-1">Mueve productos entre sucursales</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Plus size={16} />
            Nueva Transferencia
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Transferencias del mes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{delMes.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-2xl font-bold text-warning mt-1">{pendientes}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground">Completadas</p>
            <p className="text-2xl font-bold text-success mt-1">{completadas}</p>
          </div>
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-9"
              placeholder="Buscar transferencias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" onClick={handleExportPdf} className="btn-secondary flex items-center gap-2">
            <Download size={16} />
            Exportar PDF
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Origen</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Destino</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                    Productos
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No hay transferencias registradas en la base de datos
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, i) => (
                    <tr
                      key={t.id}
                      className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                        i % 2 === 0 ? '' : 'bg-secondary/10'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-primary font-medium">{t.codigo}</td>
                      <td className="px-4 py-3 text-foreground">{t.origen}</td>
                      <td className="px-4 py-3 text-foreground">{t.destino}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.fecha}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.items} items</td>
                      <td className="px-4 py-3">
                        <span className={statusMap[t.estado].cls}>{statusMap[t.estado].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title={t.motivo || 'Sin motivo'}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
