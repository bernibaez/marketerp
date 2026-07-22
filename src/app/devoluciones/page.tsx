'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { RotateCcw, Plus, Search, Trash2, ShoppingCart, ShoppingBag, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Return {
  id: string;
  code: string;
  return_type: string;
  contact_id: string | null;
  status: string;
  total: number;
  refund_method: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  contacts?: { name: string } | null;
}

interface Contact { id: string; name: string; }

type Tab = 'ventas' | 'compras';

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  aprobado: { label: 'Aprobado', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  pendiente: { label: 'Pendiente', cls: 'bg-warning/10 text-warning', icon: <Clock size={13} /> },
  rechazado: { label: 'Rechazado', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

export default function DevolucionesPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('ventas');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [returns, setReturns] = useState<Return[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ contact_id: '', reason: 'Producto defectuoso', notes: '', refund_method: 'efectivo', total: '' });

  const fetchData = async () => {
    setLoading(true); setError(null);
    const [retRes, contactRes] = await Promise.all([
      supabase.from('returns').select('*, contacts(name)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (retRes.error) setError(retRes.error.message);
    else setReturns(retRes.data || []);
    if (contactRes.data) setContacts(contactRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const saleReturns = returns.filter(r => r.return_type === 'venta');
  const purchaseReturns = returns.filter(r => r.return_type === 'compra');
  const displayed = tab === 'ventas' ? saleReturns : purchaseReturns;

  const filtered = displayed.filter(r => {
    const name = r.contacts?.name || '';
    return r.code.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
  });

  const handleSave = async () => {
    if (!formData.contact_id) { setError('Selecciona un contacto'); return; }
    if (!formData.total || isNaN(Number(formData.total))) { setError('Ingresa un monto válido'); return; }
    setSaving(true); setError(null);
    const code = `DEV-${tab === 'ventas' ? 'V' : 'C'}${Date.now().toString().slice(-5)}`;
    const { error: err } = await supabase.from('returns').insert({
      code, return_type: tab === 'ventas' ? 'venta' : 'compra',
      contact_id: formData.contact_id, status: 'pendiente',
      total: Number(formData.total), refund_method: formData.refund_method,
      reason: formData.reason, notes: formData.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowForm(false);
    setFormData({ contact_id: '', reason: 'Producto defectuoso', notes: '', refund_method: 'efectivo', total: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('returns').delete().eq('id', id);
    if (error) setError(error.message);
    else setReturns(prev => prev.filter(r => r.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('returns').update({ status: newStatus }).eq('id', id);
    if (error) setError(error.message);
    else setReturns(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const totalVentas = saleReturns.reduce((s, r) => s + r.total, 0);
  const totalCompras = purchaseReturns.reduce((s, r) => s + r.total, 0);
  const pendingCount = returns.filter(r => r.status === 'pendiente').length;

  if (showForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Devolución de {tab === 'ventas' ? 'Venta' : 'Compra'}</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar devolución de mercancía</p>
            </div>
            <button onClick={() => setShowForm(false)} className="btn-secondary">← Volver</button>
          </div>
          {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Devolución</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{tab === 'ventas' ? 'Cliente *' : 'Proveedor *'}</label>
                    <select className="input-field" value={formData.contact_id} onChange={e => setFormData(f => ({ ...f, contact_id: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Monto Total *</label>
                    <input type="number" className="input-field" placeholder="0.00" value={formData.total} onChange={e => setFormData(f => ({ ...f, total: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo de Devolución *</label>
                    <select className="input-field" value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))}>
                      <option>Producto defectuoso</option>
                      <option>Producto incorrecto</option>
                      <option>Producto vencido</option>
                      <option>Daño en tránsito</option>
                      <option>Exceso de inventario</option>
                      <option>Cambio de producto</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Observaciones</label>
                    <textarea className="input-field resize-none" rows={3} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Detalles adicionales..." />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Método de Reembolso</h3>
                <div className="space-y-2">
                  {[['credito', 'Nota de crédito'], ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia bancaria']].map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input type="radio" name="refund" className="accent-primary" checked={formData.refund_method === val} onChange={() => setFormData(f => ({ ...f, refund_method: val }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'Guardando...' : 'Registrar Devolución'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary w-full">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RotateCcw size={24} className="text-primary" />Devoluciones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de devoluciones de ventas y compras</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Nueva Devolución</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Dev. de Ventas', value: saleReturns.length, sub: `RD$ ${formatNumber(totalVentas)}`, icon: <ShoppingCart size={18} />, color: 'text-primary' },
            { label: 'Dev. de Compras', value: purchaseReturns.length, sub: `RD$ ${formatNumber(totalCompras)}`, icon: <ShoppingBag size={18} />, color: 'text-info' },
            { label: 'Pendientes', value: pendingCount, sub: 'Requieren acción', icon: <Clock size={18} />, color: 'text-warning' },
            { label: 'Aprobadas', value: returns.filter(r => r.status === 'aprobado').length, sub: 'Total', icon: <CheckCircle size={18} />, color: 'text-success' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-muted-foreground">{s.label}</span><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: 'ventas', label: 'Devoluciones de Ventas', icon: <ShoppingCart size={15} /> },
              { key: 'compras', label: 'Devoluciones de Compras', icon: <ShoppingBag size={15} /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código o contacto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando devoluciones...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50"><tr>
                  {['Código', 'Contacto', 'Fecha', 'Motivo', 'Total', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay devoluciones</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.contacts?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.created_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.reason || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">RD$ {formatNumber(r.total)}</td>
                      <td className="px-4 py-3">
                        <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${statusConfig[r.status]?.cls || 'bg-warning/10 text-warning'}`}>
                          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
