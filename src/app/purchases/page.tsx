'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { ShoppingBag, RotateCcw, Plus, Search, Filter, Download, Eye, Edit2, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Purchase {
  id: string;
  code: string;
  supplier_id: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  purchase_date: string;
  invoice_number: string | null;
  created_at: string;
  contacts?: { name: string } | null;
}

interface Return {
  id: string;
  code: string;
  return_type: string;
  contact_id: string | null;
  status: string;
  total: number;
  reason: string | null;
  created_at: string;
  contacts?: { name: string } | null;
}

type Tab = 'list' | 'returns';

const statusMap: Record<string, { label: string; cls: string }> = {
  completado: { label: 'Recibido', cls: 'badge-success' },
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobado: { label: 'Aprobado', cls: 'badge-success' },
  rechazado: { label: 'Rechazado', cls: 'badge-danger' },
  cancelado: { label: 'Cancelado', cls: 'badge-danger' },
  borrador: { label: 'Borrador', cls: 'badge-neutral' },
};

function getStatusBadge(status: string) {
  return statusMap[status] ?? { label: status, cls: 'badge-neutral' };
}

export default function PurchasesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [purchasesRes, returnsRes] = await Promise.all([
        supabase.from('purchases').select('id, code, supplier_id, status, subtotal, tax_amount, discount_amount, total, payment_method, payment_status, purchase_date, invoice_number, created_at, contacts(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('returns').select('id, code, return_type, contact_id, status, total, reason, created_at, contacts(name)').eq('return_type', 'compra').order('created_at', { ascending: false }).limit(200),
      ]);
      if (purchasesRes.error) throw purchasesRes.error;
      if (returnsRes.error) throw returnsRes.error;
      setPurchases(purchasesRes.data || []);
      setReturns(returnsRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('purchases').delete().eq('id', id);
    fetchData();
  };

  const filtered = purchases.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.contacts?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalMonth: purchases.reduce((s, p) => s + p.total, 0),
    total: purchases.length,
    pending: purchases.filter(p => p.status === 'pendiente').length,
    totalReturns: returns.length,
  };

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Compra</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar orden de compra</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Compra</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor *</label>
                    <select className="input-field"><option>Seleccionar proveedor...</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                    <select className="input-field"><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>Crédito</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">No. Factura Proveedor</label>
                    <input className="input-field" placeholder="FAC-0001" />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Notas</h3>
                <textarea className="input-field" rows={4} placeholder="Observaciones..." />
              </div>
              <button className="btn-primary w-full py-3">Guardar Compra</button>
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
            <h1 className="text-2xl font-bold text-foreground">Compras</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona órdenes de compra y devoluciones</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} />Nueva Compra
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Compras totales</p><p className="text-2xl font-bold text-foreground mt-1">RD$ {formatNumber(stats.totalMonth)}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Órdenes totales</p><p className="text-2xl font-bold text-info mt-1">{stats.total}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">{stats.pending}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Devoluciones</p><p className="text-2xl font-bold text-danger mt-1">{stats.totalReturns}</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[{ id: 'list' as Tab, label: 'Lista de Compras', icon: <ShoppingBag size={16} /> }, { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={16} /> }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar por código o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {loading && (
          <div className="card p-12 text-center text-muted-foreground">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
            <p>Cargando compras...</p>
          </div>
        )}

        {!loading && tab === 'list' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">ITBIS</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const badge = getStatusBadge(p.status);
                    return (
                      <tr key={p.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-mono text-primary font-medium">{p.code}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{p.contacts?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.purchase_date}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">RD$ {formatNumber(p.tax_amount)}</td>
                        <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(p.total)}</td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className={badge.cls}>{badge.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron compras</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
              <span>Mostrando {filtered.length} de {purchases.length} compras</span>
            </div>
          </div>
        )}

        {!loading && tab === 'returns' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Motivo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r, i) => {
                    const badge = getStatusBadge(r.status);
                    return (
                      <tr key={r.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-mono text-danger font-medium">{r.code}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.contacts?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(r.total)}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{r.reason ?? '—'}</td>
                        <td className="px-4 py-3"><span className={badge.cls}>{badge.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {returns.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron devoluciones de compras</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
