'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { DollarSign, Tag, Plus, Search, Filter, Download, Eye, Edit2, Trash2, Upload } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface Expense {
  id: number; code: string; category: string; description: string; amount: number;
  responsible: string; date: string; receipt: boolean; status: 'approved' | 'pending' | 'rejected';
}
interface ExpenseCategory {
  id: number; name: string; description: string; budget: number; spent: number;
}

const mockExpenses: Expense[] = [
  { id: 1, code: 'GAS-001', category: 'Servicios', description: 'Pago de electricidad enero', amount: 8500, responsible: 'Admin General', date: '2024-01-15', receipt: true, status: 'approved' },
  { id: 2, code: 'GAS-002', category: 'Mantenimiento', description: 'Reparación de refrigerador', amount: 3200, responsible: 'Carlos López', date: '2024-01-14', receipt: true, status: 'approved' },
  { id: 3, code: 'GAS-003', category: 'Transporte', description: 'Combustible para entregas', amount: 1800, responsible: 'Pedro Sánchez', date: '2024-01-14', receipt: false, status: 'pending' },
  { id: 4, code: 'GAS-004', category: 'Limpieza', description: 'Productos de limpieza mensual', amount: 2400, responsible: 'María García', date: '2024-01-13', receipt: true, status: 'approved' },
  { id: 5, code: 'GAS-005', category: 'Publicidad', description: 'Anuncios en redes sociales', amount: 5000, responsible: 'Admin General', date: '2024-01-12', receipt: true, status: 'approved' },
  { id: 6, code: 'GAS-006', category: 'Servicios', description: 'Internet y teléfono', amount: 2800, responsible: 'Admin General', date: '2024-01-10', receipt: false, status: 'rejected' },
];

const mockCategories: ExpenseCategory[] = [
  { id: 1, name: 'Servicios', description: 'Electricidad, agua, internet', budget: 15000, spent: 11300 },
  { id: 2, name: 'Mantenimiento', description: 'Reparaciones y mantenimiento', budget: 8000, spent: 3200 },
  { id: 3, name: 'Transporte', description: 'Combustible y fletes', budget: 5000, spent: 1800 },
  { id: 4, name: 'Limpieza', description: 'Productos e insumos de limpieza', budget: 3000, spent: 2400 },
  { id: 5, name: 'Publicidad', description: 'Marketing y publicidad', budget: 10000, spent: 5000 },
  { id: 6, name: 'Nómina', description: 'Salarios y beneficios', budget: 80000, spent: 80000 },
];

type Tab = 'list' | 'categories';

const statusMap: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprobado', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  rejected: { label: 'Rechazado', cls: 'badge-danger' },
};

export default function ExpensesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filtered = mockExpenses.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    e.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalSpent = mockExpenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);

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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Gastos del mes</p><p className="text-2xl font-bold text-foreground mt-1">RD$ {formatNumber(totalSpent)}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Registros</p><p className="text-2xl font-bold text-info mt-1">{mockExpenses.length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">{mockExpenses.filter(e => e.status === 'pending').length}</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Categorías</p><p className="text-2xl font-bold text-primary mt-1">{mockCategories.length}</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[
            { id: 'list' as Tab, label: 'Lista de Gastos', icon: <DollarSign size={16} /> },
            { id: 'categories' as Tab, label: 'Categorías', icon: <Tag size={16} /> },
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

        {tab === 'list' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Responsable</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Monto</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Comprobante</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{e.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{e.description}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-neutral">{e.category}</span></td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{e.responsible}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{e.date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(e.amount)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {e.receipt ? <span className="badge-success">Sí</span> : <span className="badge-danger">No</span>}
                      </td>
                      <td className="px-4 py-3"><span className={statusMap[e.status].cls}>{statusMap[e.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Mostrando {filtered.length} de {mockExpenses.length} gastos</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Anterior</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">1</button>
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Siguiente</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mockCategories.map(cat => {
              const pct = Math.min(100, Math.round((cat.spent / cat.budget) * 100));
              const color = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-primary';
              return (
                <div key={cat.id} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{cat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                      <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Gastado</span>
                      <span className="font-semibold text-foreground">RD$ {formatNumber(cat.spent)} / {formatNumber(cat.budget)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={pct >= 90 ? 'text-danger font-medium' : 'text-muted-foreground'}>{pct}% utilizado</span>
                      <span className="text-muted-foreground">Disponible: RD$ {formatNumber(cat.budget - cat.spent)}</span>
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
            <h2 className="text-lg font-bold text-foreground mb-4">{tab === 'list' ? 'Nuevo Gasto' : 'Nueva Categoría'}</h2>
            <div className="space-y-3">
              {tab === 'list' ? <>
                <select className="input-field">
                  <option>Seleccionar categoría...</option>
                  {mockCategories.map(c => <option key={c.id}>{c.name}</option>)}
                </select>
                <input className="input-field" placeholder="Descripción del gasto" />
                <input className="input-field" placeholder="Monto (RD$)" type="number" />
                <input className="input-field" placeholder="Responsable" />
                <input className="input-field" type="date" />
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload size={20} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Subir comprobante</p>
                </div>
              </> : <>
                <input className="input-field" placeholder="Nombre de la categoría" />
                <textarea className="input-field" placeholder="Descripción" rows={3} />
                <input className="input-field" placeholder="Presupuesto mensual (RD$)" type="number" />
              </>}
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
