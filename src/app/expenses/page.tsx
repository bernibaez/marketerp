'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { DollarSign, Tag, Plus, Search, Filter, Download, Eye, Edit2, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Expense {
  id: string;
  code: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string | null;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

type Tab = 'list' | 'categories';

const statusMap: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprobado', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  rejected: { label: 'Rechazado', cls: 'badge-danger' },
};

const categoryLabels: Record<string, string> = {
  nomina: 'Nómina',
  alquiler: 'Alquiler',
  servicios: 'Servicios',
  suministros: 'Suministros',
  mantenimiento: 'Mantenimiento',
  marketing: 'Marketing',
  transporte: 'Transporte',
  impuestos: 'Impuestos',
  otros: 'Otros',
};

export default function ExpensesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'otros', description: '', amount: '', payment_method: 'efectivo' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setExpenses(data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const code = `GAS-${Date.now().toString().slice(-6)}`;
      const { error: err } = await supabase.from('expenses').insert({
        code,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
      });
      if (err) throw err;
      setShowModal(false);
      setForm({ category: 'otros', description: '', amount: '', payment_method: 'efectivo' });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('expenses').delete().eq('id', id);
    fetchData();
  };

  const filtered = expenses.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    e.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category for categories tab
  const categoryStats = Object.entries(
    expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([cat, spent]) => ({ cat, spent }));

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
            <p className="text-sm text-muted-foreground mt-1">Control de gastos operativos y categorías</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} />{tab === 'list' ? 'Nuevo Gasto' : 'Nueva Categoría'}
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Gastos totales</p><p className="text-2xl font-bold text-foreground mt-1">RD$ {formatNumber(totalSpent)}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Registros</p><p className="text-2xl font-bold text-info mt-1">{expenses.length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Categorías</p><p className="text-2xl font-bold text-primary mt-1">{categoryStats.length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Este mes</p><p className="text-2xl font-bold text-warning mt-1">{expenses.filter(e => e.expense_date?.startsWith(new Date().toISOString().slice(0, 7))).length}</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[
            { id: 'list' as Tab, label: 'Lista de Gastos', icon: <DollarSign size={16} /> },
            { id: 'categories' as Tab, label: 'Por Categoría', icon: <Tag size={16} /> },
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
            <input className="input-field pl-9" placeholder="Buscar gastos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {loading && (
          <div className="card p-12 text-center text-muted-foreground">
            <DollarSign size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
            <p>Cargando gastos...</p>
          </div>
        )}

        {!loading && tab === 'list' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Monto</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Pago</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{e.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{e.description}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-neutral">{categoryLabels[e.category] ?? e.category}</span></td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{e.expense_date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(e.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell capitalize">{e.payment_method ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron gastos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
              <span>Mostrando {filtered.length} de {expenses.length} gastos</span>
            </div>
          </div>
        )}

        {!loading && tab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {categoryStats.length === 0 && (
              <div className="col-span-3 card p-8 text-center text-muted-foreground">No hay gastos registrados</div>
            )}
            {categoryStats.map(({ cat, spent }) => {
              const pct = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
              const color = pct >= 40 ? 'bg-danger' : pct >= 20 ? 'bg-warning' : 'bg-primary';
              return (
                <div key={cat} className="card p-5 space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{categoryLabels[cat] ?? cat}</h3>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Gastado</span>
                      <span className="font-semibold text-foreground">RD$ {formatNumber(spent)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{pct}% del total</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 w-full max-w-md mx-4 slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">Nuevo Gasto</h2>
            <div className="space-y-3">
              <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className="input-field" placeholder="Descripción del gasto *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input-field" placeholder="Monto (RD$) *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <select className="input-field" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || !form.description || !form.amount}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
