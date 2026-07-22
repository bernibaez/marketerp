'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Shield, Plus, Search, Trash2, CheckCircle, XCircle, AlertTriangle, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Warranty {
  id: string;
  code: string;
  product_id: string | null;
  sale_id: string | null;
  client_id: string | null;
  serial_number: string | null;
  warranty_months: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  products?: { name: string; code: string } | null;
  contacts?: { name: string } | null;
  sales?: { code: string } | null;
}

interface Contact { id: string; name: string; }
interface Product { id: string; name: string; code: string; }
interface Sale { id: string; code: string; }

type Tab = 'warranties';

const warrantyStatusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  activa: { label: 'Activa', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  vencida: { label: 'Vencida', cls: 'bg-secondary text-muted-foreground', icon: <Calendar size={13} /> },
  reclamada: { label: 'Reclamada', cls: 'bg-warning/10 text-warning', icon: <AlertTriangle size={13} /> },
  anulada: { label: 'Anulada', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

export default function GarantiasPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    product_id: '', sale_id: '', client_id: '', serial_number: '',
    warranty_months: 12, start_date: new Date().toISOString().slice(0, 10), notes: '',
  });

  const fetchData = async () => {
    setLoading(true); setError(null);
    const [warRes, contactRes, prodRes, saleRes] = await Promise.all([
      supabase.from('warranties').select('*, products(name, code), contacts(name), sales(code)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, code').eq('is_active', true).order('name'),
      supabase.from('sales').select('id, code').order('created_at', { ascending: false }).limit(50),
    ]);
    if (warRes.error) setError(warRes.error.message);
    else setWarranties(warRes.data || []);
    if (contactRes.data) setContacts(contactRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (saleRes.data) setSales(saleRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = warranties.filter(w =>
    w.code.toLowerCase().includes(search.toLowerCase()) ||
    (w.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.contacts?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.product_id) { setError('Selecciona un producto'); return; }
    if (!formData.client_id) { setError('Selecciona un cliente'); return; }
    setSaving(true); setError(null);
    const code = `GAR-${Date.now().toString().slice(-5)}`;
    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + formData.warranty_months);
    const { error: err } = await supabase.from('warranties').insert({
      code, product_id: formData.product_id || null,
      sale_id: formData.sale_id || null, client_id: formData.client_id,
      serial_number: formData.serial_number || null,
      warranty_months: formData.warranty_months,
      start_date: formData.start_date,
      end_date: endDate.toISOString().slice(0, 10),
      status: 'activa', notes: formData.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowForm(false);
    setFormData({ product_id: '', sale_id: '', client_id: '', serial_number: '', warranty_months: 12, start_date: new Date().toISOString().slice(0, 10), notes: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('warranties').delete().eq('id', id);
    if (error) setError(error.message);
    else setWarranties(prev => prev.filter(w => w.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('warranties').update({ status: newStatus }).eq('id', id);
    if (error) setError(error.message);
    else setWarranties(prev => prev.map(w => w.id === id ? { ...w, status: newStatus } : w));
  };

  if (showForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Garantía</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar garantía de producto</p>
            </div>
            <button onClick={() => setShowForm(false)} className="btn-secondary">← Volver</button>
          </div>
          {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Información de la Garantía</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura de Venta</label>
                  <select className="input-field" value={formData.sale_id} onChange={e => setFormData(f => ({ ...f, sale_id: e.target.value }))}>
                    <option value="">Seleccionar factura...</option>
                    {sales.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto *</label>
                  <select className="input-field" value={formData.product_id} onChange={e => setFormData(f => ({ ...f, product_id: e.target.value }))}>
                    <option value="">Seleccionar producto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
                  <select className="input-field" value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))}>
                    <option value="">Seleccionar cliente...</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Duración (meses) *</label>
                  <select className="input-field" value={formData.warranty_months} onChange={e => setFormData(f => ({ ...f, warranty_months: Number(e.target.value) }))}>
                    {[6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Inicio *</label>
                  <input type="date" className="input-field" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">No. de Serie</label>
                  <input className="input-field" placeholder="SN-XXXXXXXXXX" value={formData.serial_number} onChange={e => setFormData(f => ({ ...f, serial_number: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Condiciones / Notas</label>
                  <textarea className="input-field resize-none" rows={3} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Condiciones de la garantía, exclusiones, etc." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Registrar Garantía'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </div>
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Garantías Recientes</h3>
              <div className="space-y-3">
                {warranties.slice(0, 4).map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Shield size={16} className="text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{w.products?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{w.contacts?.name || '—'} · {w.warranty_months} meses</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${warrantyStatusConfig[w.status]?.cls || 'bg-secondary text-muted-foreground'}`}>
                      {warrantyStatusConfig[w.status]?.label || w.status}
                    </span>
                  </div>
                ))}
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
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Shield size={24} className="text-primary" />Garantías</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de garantías de productos</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Nueva Garantía</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Garantías Activas', value: warranties.filter(w => w.status === 'activa').length, icon: <Shield size={18} />, color: 'text-success' },
            { label: 'Vencidas', value: warranties.filter(w => w.status === 'vencida').length, icon: <Calendar size={18} />, color: 'text-muted-foreground' },
            { label: 'Reclamadas', value: warranties.filter(w => w.status === 'reclamada').length, icon: <AlertTriangle size={18} />, color: 'text-warning' },
            { label: 'Total', value: warranties.length, icon: <CheckCircle size={18} />, color: 'text-primary' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-muted-foreground">{s.label}</span><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código, producto o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando garantías...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50"><tr>
                  {['Código', 'Producto', 'Cliente', 'Factura', 'Inicio', 'Vencimiento', 'Duración', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No hay garantías</td></tr>
                  ) : filtered.map(w => (
                    <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{w.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{w.products?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.contacts?.name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.sales?.code || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.start_date}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.end_date || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.warranty_months} meses</td>
                      <td className="px-4 py-3">
                        <select value={w.status} onChange={e => handleStatusChange(w.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${warrantyStatusConfig[w.status]?.cls || 'bg-secondary text-muted-foreground'}`}>
                          {Object.entries(warrantyStatusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
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
