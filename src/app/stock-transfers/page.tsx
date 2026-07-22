'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Transfer {
  id: string;
  code: string;
  status: string;
  notes: string | null;
  created_at: string;
  from_branch?: { name: string } | null;
  to_branch?: { name: string } | null;
  stock_transfer_items?: { id: string }[];
}

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; code: string; }

const statusMap: Record<string, { label: string; cls: string }> = {
  completado: { label: 'Completado', cls: 'badge-success' },
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobado: { label: 'Aprobado', cls: 'badge-info' },
  cancelado: { label: 'Cancelado', cls: 'badge-danger' },
};

export default function StockTransfersPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ from_branch_id: '', to_branch_id: '', notes: '', product_id: '', quantity: 1 });

  const fetchData = async () => {
    setLoading(true); setError(null);
    const [trsRes, branchRes, prodRes] = await Promise.all([
      supabase.from('stock_transfers')
        .select('*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), stock_transfer_items(id)')
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('products').select('id, name, code').eq('is_active', true).order('name'),
    ]);
    if (trsRes.error) setError(trsRes.error.message);
    else setTransfers(trsRes.data || []);
    if (branchRes.data) setBranches(branchRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = transfers.filter(t =>
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    (t.from_branch?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.to_branch?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.from_branch_id || !formData.to_branch_id) { setError('Selecciona sucursal origen y destino'); return; }
    if (formData.from_branch_id === formData.to_branch_id) { setError('Origen y destino deben ser diferentes'); return; }
    setSaving(true); setError(null);
    const code = `TRF-${Date.now().toString().slice(-5)}`;
    const { data: trf, error: trsErr } = await supabase.from('stock_transfers').insert({
      code, from_branch_id: formData.from_branch_id, to_branch_id: formData.to_branch_id,
      status: 'pendiente', notes: formData.notes || null,
    }).select().single();
    if (trsErr) { setError(trsErr.message); setSaving(false); return; }
    if (formData.product_id) {
      await supabase.from('stock_transfer_items').insert({
        transfer_id: trf.id, product_id: formData.product_id, quantity: formData.quantity,
      });
    }
    setSaving(false);
    setShowModal(false);
    setFormData({ from_branch_id: '', to_branch_id: '', notes: '', product_id: '', quantity: 1 });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('stock_transfer_items').delete().eq('transfer_id', id);
    const { error } = await supabase.from('stock_transfers').delete().eq('id', id);
    if (error) setError(error.message);
    else setTransfers(prev => prev.filter(t => t.id !== id));
  };

  const totalMonth = transfers.length;
  const pending = transfers.filter(t => t.status === 'pendiente').length;
  const completed = transfers.filter(t => t.status === 'completado').length;

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transferencia de Stock</h1>
            <p className="text-sm text-muted-foreground mt-1">Mueve productos entre sucursales</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit"><Plus size={16} />Nueva Transferencia</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Total Transferencias</p><p className="text-2xl font-bold text-foreground mt-1">{totalMonth}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">{pending}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Completadas</p><p className="text-2xl font-bold text-success mt-1">{completed}</p></div>
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="input-field pl-9" placeholder="Buscar transferencias..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando transferencias...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Origen</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Destino</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Productos</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay transferencias</td></tr>
                  ) : filtered.map((t, i) => (
                    <tr key={t.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{t.code}</td>
                      <td className="px-4 py-3 text-foreground">{t.from_branch?.name || '—'}</td>
                      <td className="px-4 py-3 text-foreground">{t.to_branch?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.created_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{t.stock_transfer_items?.length || 0} items</td>
                      <td className="px-4 py-3"><span className={statusMap[t.status]?.cls || 'badge-warning'}>{statusMap[t.status]?.label || t.status}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 w-full max-w-lg mx-4 slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Nueva Transferencia</h2>
            {error && <div className="p-3 mb-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal Origen *</label>
                <select className="input-field" value={formData.from_branch_id} onChange={e => setFormData(f => ({ ...f, from_branch_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal Destino *</label>
                <select className="input-field" value={formData.to_branch_id} onChange={e => setFormData(f => ({ ...f, to_branch_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>
                <select className="input-field" value={formData.product_id} onChange={e => setFormData(f => ({ ...f, product_id: e.target.value }))}>
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {formData.product_id && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cantidad</label>
                  <input type="number" min={1} className="input-field" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: Number(e.target.value) }))} />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
                <textarea className="input-field" placeholder="Notas u observaciones..." rows={3} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Crear Transferencia'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
