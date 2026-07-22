'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Truck, Plus, Search, Eye, Edit2, Trash2, Package, Clock, CheckCircle, XCircle } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

interface Shipment {
  id: string;
  code: string;
  sale_id: string | null;
  client_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  status: string;
  estimated_delivery: string | null;
  delivered_at: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  contacts?: { name: string } | null;
  sales?: { code: string } | null;
}

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  entregado: { label: 'Entregado', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  en_transito: { label: 'En Tránsito', cls: 'bg-info/10 text-info', icon: <Truck size={13} /> },
  pendiente: { label: 'Pendiente', cls: 'bg-warning/10 text-warning', icon: <Clock size={13} /> },
  fallido: { label: 'Fallido', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

function getStatusConfig(status: string) {
  return statusConfig[status] ?? { label: status, cls: 'bg-secondary text-muted-foreground', icon: <Package size={13} /> };
}

interface ShipmentFormProps {
  onClose: () => void;
  onSaved: () => void;
}

function ShipmentForm({ onClose, onSaved }: ShipmentFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sales, setSales] = useState<{ id: string; code: string; contacts: { name: string } | null }[]>([]);
  const [form, setForm] = useState({
    sale_id: '',
    carrier: 'Caribe Express',
    tracking_number: '',
    status: 'pendiente',
    estimated_delivery: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.from('sales').select('id, code, contacts(name)').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setSales(data as any); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const selectedSale = sales.find(s => s.id === form.sale_id);
      const client_id = selectedSale ? (selectedSale as any).client_id ?? null : null;
      const code = `ENV-${Date.now().toString().slice(-6)}`;
      const { error: err } = await supabase.from('shipments').insert({
        code,
        sale_id: form.sale_id || null,
        carrier: form.carrier || null,
        tracking_number: form.tracking_number || null,
        status: form.status,
        estimated_delivery: form.estimated_delivery || null,
        address: form.address || null,
        notes: form.notes || null,
      });
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Envío</h1>
          <p className="text-sm text-muted-foreground mt-1">Registrar envío de mercancía</p>
        </div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información del Envío</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura de Referencia</label>
                <select className="input-field" value={form.sale_id} onChange={e => setForm(f => ({ ...f, sale_id: e.target.value }))}>
                  <option value="">Sin factura...</option>
                  {sales.map(s => <option key={s.id} value={s.id}>{s.code}{s.contacts ? ` - ${s.contacts.name}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Transportista *</label>
                <select className="input-field" value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}>
                  <option>Caribe Express</option>
                  <option>Vimenpaq</option>
                  <option>Domex</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">No. de Seguimiento</label>
                <input className="input-field" placeholder="CE-2024-XXX" value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
                <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_transito">En Tránsito</option>
                  <option value="entregado">Entregado</option>
                  <option value="fallido">Fallido</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Estimada</label>
                <input type="date" className="input-field" value={form.estimated_delivery} onChange={e => setForm(f => ({ ...f, estimated_delivery: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección de Entrega</label>
                <input className="input-field" placeholder="Calle, número, ciudad, provincia..." value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Instrucciones para el transportista..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar Envío'}
            </button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnviosPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('shipments')
        .select('*, contacts(name), sales(code)')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setShipments(data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('shipments').delete().eq('id', id);
    fetchShipments();
  };

  const filtered = shipments.filter(s => {
    const clientName = s.contacts?.name ?? '';
    const refCode = s.sales?.code ?? '';
    const matchSearch = s.code.toLowerCase().includes(search.toLowerCase()) ||
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      (s.tracking_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      refCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: shipments.length,
    delivered: shipments.filter(s => s.status === 'entregado').length,
    inTransit: shipments.filter(s => s.status === 'en_transito').length,
    pending: shipments.filter(s => s.status === 'pendiente').length,
  };

  if (showForm) {
    return <AppLayout currentPath={pathname}><ShipmentForm onClose={() => setShowForm(false)} onSaved={fetchShipments} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck size={24} className="text-primary" />
              Envíos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión y seguimiento de envíos</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Envío
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Envíos', value: stats.total, icon: <Package size={18} />, color: 'text-primary' },
            { label: 'Entregados', value: stats.delivered, icon: <CheckCircle size={18} />, color: 'text-success' },
            { label: 'En Tránsito', value: stats.inTransit, icon: <Truck size={18} />, color: 'text-info' },
            { label: 'Pendientes', value: stats.pending, icon: <Clock size={18} />, color: 'text-warning' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código, cliente o tracking..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="entregado">Entregado</option>
              <option value="en_transito">En Tránsito</option>
              <option value="pendiente">Pendiente</option>
              <option value="fallido">Fallido</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="font-medium">Cargando envíos...</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Código', 'Referencia', 'Cliente', 'Transportista', 'Tracking', 'Entrega Est.', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(s => {
                    const cfg = getStatusConfig(s.status);
                    return (
                      <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{s.code}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.sales?.code ?? '—'}</td>
                        <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{s.contacts?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.carrier ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.tracking_number ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.estimated_delivery ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cfg.cls}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Truck size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontraron envíos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
