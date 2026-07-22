'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { ShoppingCart, FileText, RotateCcw, Plus, Search, Filter, Download, Eye, Trash2, Printer } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Sale {
  id: string;
  code: string;
  client_id: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  sale_date: string;
  created_at: string;
  contacts?: { name: string } | null;
}

interface Quotation {
  id: string;
  code: string;
  client_id: string | null;
  status: string;
  total: number;
  valid_until: string | null;
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

type Tab = 'sales' | 'quotes' | 'returns';

const saleStatusMap: Record<string, { label: string; cls: string }> = {
  completado: { label: 'Pagado', cls: 'badge-success' },
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  cancelado: { label: 'Cancelado', cls: 'badge-danger' },
  aprobado: { label: 'Aprobado', cls: 'badge-success' },
  rechazado: { label: 'Rechazado', cls: 'badge-danger' },
  convertido: { label: 'Convertido', cls: 'badge-info' },
  borrador: { label: 'Borrador', cls: 'badge-neutral' },
};

function getStatusBadge(status: string) {
  return saleStatusMap[status] ?? { label: status, cls: 'badge-neutral' };
}

export default function SalesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('sales');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Track which tabs have been loaded to avoid re-fetching
  const loadedTabs = useRef<Set<Tab>>(new Set());

  const fetchSales = useCallback(async () => {
    if (loadedTabs.current.has('sales')) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const res = await supabase
        .from('sales')
        .select('id, code, client_id, status, subtotal, tax_amount, discount_amount, total, payment_method, payment_status, sale_date, created_at, contacts(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      setSales(res.data || []);
      loadedTabs.current.add('sales');
    } catch (e: any) {
      setError(e.message || 'Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuotations = useCallback(async () => {
    if (loadedTabs.current.has('quotes')) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const res = await supabase
        .from('quotations')
        .select('id, code, client_id, status, total, valid_until, created_at, contacts(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      setQuotations(res.data || []);
      loadedTabs.current.add('quotes');
    } catch (e: any) {
      setError(e.message || 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReturns = useCallback(async () => {
    if (loadedTabs.current.has('returns')) return;
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const res = await supabase
        .from('returns')
        .select('id, code, return_type, contact_id, status, total, reason, created_at, contacts(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      setReturns(res.data || []);
      loadedTabs.current.add('returns');
    } catch (e: any) {
      setError(e.message || 'Error al cargar devoluciones');
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch the active tab's data
  useEffect(() => {
    if (tab === 'sales') fetchSales();
    else if (tab === 'quotes') fetchQuotations();
    else if (tab === 'returns') fetchReturns();
  }, [tab, fetchSales, fetchQuotations, fetchReturns]);

  const handleDeleteSale = async (id: string) => {
    const supabase = createClient();
    await supabase.from('sales').delete().eq('id', id);
    loadedTabs.current.delete('sales');
    fetchSales();
  };

  const filteredSales = sales.filter(s =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    (s.contacts?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalToday: sales.filter(s => s.sale_date === new Date().toISOString().split('T')[0]).reduce((sum, s) => sum + s.total, 0),
    totalSales: sales.length,
    pending: sales.filter(s => s.status === 'pendiente').length,
    totalReturns: returns.length,
  };

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Venta</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar factura de venta</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>
          <div className="card p-8 text-center text-muted-foreground">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Usa el módulo de Punto de Venta (POS) para registrar ventas</p>
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
            <h1 className="text-2xl font-bold text-foreground">Ventas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona facturas, cotizaciones y devoluciones</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} />Nueva Venta
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Ventas del día</p><p className="text-2xl font-bold text-foreground mt-1">RD$ {formatNumber(stats.totalToday)}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Facturas totales</p><p className="text-2xl font-bold text-info mt-1">{stats.totalSales}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes de cobro</p><p className="text-2xl font-bold text-warning mt-1">{stats.pending}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Devoluciones</p><p className="text-2xl font-bold text-danger mt-1">{stats.totalReturns}</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit flex-wrap">
          {[
            { id: 'sales' as Tab, label: 'Todas las Ventas', icon: <ShoppingCart size={16} /> },
            { id: 'quotes' as Tab, label: 'Cotizaciones', icon: <FileText size={16} /> },
            { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={16} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar por código o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {loading && (
          <div className="card p-12 text-center text-muted-foreground">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
            <p>Cargando...</p>
          </div>
        )}

        {!loading && tab === 'sales' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Factura</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Pago</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((s, i) => {
                    const badge = getStatusBadge(s.status);
                    return (
                      <tr key={s.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-mono text-primary font-medium">{s.code}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{s.contacts?.name ?? 'Cliente general'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.sale_date}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell capitalize">{s.payment_method ?? '—'}</td>
                        <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(s.total)}</td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className={badge.cls}>{badge.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                            <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Printer size={14} /></button>
                            <button onClick={() => handleDeleteSale(s.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSales.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron ventas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
              <span>Mostrando {filteredSales.length} de {sales.length} ventas</span>
            </div>
          </div>
        )}

        {!loading && tab === 'quotes' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Válida hasta</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q, i) => {
                    const badge = getStatusBadge(q.status);
                    return (
                      <tr key={q.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-mono text-primary font-medium">{q.code}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{q.contacts?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{q.valid_until ?? '—'}</td>
                        <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(q.total)}</td>
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
                  {quotations.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron cotizaciones</td></tr>
                  )}
                </tbody>
              </table>
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
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Contacto</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Tipo</th>
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
                        <td className="px-4 py-3 font-medium text-foreground">{r.contacts?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell capitalize">{r.return_type}</td>
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
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron devoluciones</td></tr>
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
