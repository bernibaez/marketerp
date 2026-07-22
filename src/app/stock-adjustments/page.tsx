'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Adjustment {
  id: string;
  code: string;
  reason: string;
  status: string;
  notes: string | null;
  created_at: string;
  user_profiles?: { full_name: string } | null;
  branches?: { name: string } | null;
}

interface Product { id: string; name: string; code: string; current_stock: number; }
interface Branch { id: string; name: string; }

const statusMap: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobado: { label: 'Aprobado', cls: 'badge-success' },
  rechazado: { label: 'Rechazado', cls: 'badge-danger' },
  completado: { label: 'Completado', cls: 'badge-info' },
};

export default function StockAdjustmentsPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ reason: '', notes: '', branch_id: '', product_id: '', expected_qty: 0, actual_qty: 0 });

  const fetchData = async () => {
    setLoading(true); setError(null);
    const [adjRes, prodRes, branchRes] = await Promise.all([
      supabase.from('stock_adjustments').select('*, user_profiles(full_name), branches(name)').order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, code, current_stock').eq('is_active', true).order('name'),
      supabase.from('branches').select('id, name').eq('is_active', true),
    ]);
    if (adjRes.error) setError(adjRes.error.message);
    else setAdjustments(adjRes.data || []);
    if (prodRes.data) setProducts(prodRes.data);
    if (branchRes.data) setBranches(branchRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = adjustments.filter(a =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.reason.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.reason) { setError('Ingresa el motivo del ajuste'); return; }
    setSaving(true); setError(null);
    const code = `AJU-${Date.now().toString().slice(-5)}`;
    const { data: adj, error: adjErr } = await supabase.from('stock_adjustments').insert({
      code, reason: formData.reason, status: 'pendiente',
      branch_id: formData.branch_id || null, notes: formData.notes || null,
    }).select().single();
    if (adjErr) { setError(adjErr.message); setSaving(false); return; }
    if (formData.product_id) {
      await supabase.from('stock_adjustment_items').insert({
        adjustment_id: adj.id, product_id: formData.product_id,
        expected_qty: formData.expected_qty, actual_qty: formData.actual_qty,
      });
    }
    setSaving(false);
    setShowModal(false);
    setFormData({ reason: '', notes: '', branch_id: '', product_id: '', expected_qty: 0, actual_qty: 0 });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('stock_adjustment_items').delete().eq('adjustment_id', id);
    const { error } = await supabase.from('stock_adjustments').delete().eq('id', id);
    if (error) setError(error.message);
    else setAdjustments(prev => prev.filter(a => a.id !== id));
  };

  const entradas = adjustments.filter(a => a.status === 'aprobado').length;
  const pendientes = adjustments.filter(a => a.status === 'pendiente').length;
  const rechazados = adjustments.filter(a => a.status === 'rechazado').length;

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ajuste de Stock</h1>
            <p className="text-sm text-muted-foreground mt-1">Registra entradas, salidas y pérdidas de inventario</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit"><Plus size={16} />Nuevo Ajuste</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Aprobados</p><p className="text-2xl font-bold text-success mt-1">{entradas}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">{pendientes}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Rechazados</p><p className="text-2xl font-bold text-danger mt-1">{rechazados}</p></div>
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="input-field pl-9" placeholder="Buscar ajustes..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando ajustes...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Motivo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Sucursal</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay ajustes de stock</td></tr>
                  ) : filtered.map((a, i) => (
                    <tr key={a.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{a.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{a.reason}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{a.branches?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{a.created_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3"><span className={statusMap[a.status]?.cls || 'badge-warning'}>{statusMap[a.status]?.label || a.status}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
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
          <div className="card p-6 w-full max-w-md mx-4 slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Nuevo Ajuste de Stock</h2>
            {error && <div className="p-3 mb-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal</label>
                <select className="input-field" value={formData.branch_id} onChange={e => setFormData(f => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">Seleccionar sucursal...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo *</label>
                <input className="input-field" placeholder="Ej: Corrección de inventario" value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>
                <select className="input-field" value={formData.product_id} onChange={e => setFormData(f => ({ ...f, product_id: e.target.value }))}>
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>)}
                </select>
              </div>
              {formData.product_id && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cant. Esperada</label>
                    <input type="number" className="input-field" value={formData.expected_qty} onChange={e => setFormData(f => ({ ...f, expected_qty: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cant. Real</label>
                    <input type="number" className="input-field" value={formData.actual_qty} onChange={e => setFormData(f => ({ ...f, actual_qty: Number(e.target.value) }))} />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
                <textarea className="input-field" rows={3} value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Describe el motivo del ajuste..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Ajuste'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
