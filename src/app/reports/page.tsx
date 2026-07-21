'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { BarChart2, TrendingUp, TrendingDown, Package, ShoppingCart, ShoppingBag, DollarSign, Users, FileText, Download, Printer, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatNumber } from '@/lib/formatNumber';

const salesData = [
  { month: 'Ago', ventas: 145000, compras: 98000, ganancias: 47000 },
  { month: 'Sep', ventas: 162000, compras: 110000, ganancias: 52000 },
  { month: 'Oct', ventas: 138000, compras: 95000, ganancias: 43000 },
  { month: 'Nov', ventas: 175000, compras: 118000, ganancias: 57000 },
  { month: 'Dic', ventas: 210000, compras: 140000, ganancias: 70000 },
  { month: 'Ene', ventas: 185000, compras: 125000, ganancias: 60000 },
];

const topProducts = [
  { name: 'Arroz Selecto 5lb', sold: 450, revenue: 126000 },
  { name: 'Aceite Vegetal 1L', sold: 320, revenue: 112000 },
  { name: 'Azúcar Blanca 2lb', sold: 280, revenue: 56000 },
  { name: 'Leche Entera 1L', sold: 260, revenue: 78000 },
  { name: 'Pollo Entero', sold: 180, revenue: 90000 },
];

const categoryData = [
  { name: 'Alimentos', value: 45, color: '#16a34a' },
  { name: 'Bebidas', value: 20, color: '#2563eb' },
  { name: 'Lácteos', value: 15, color: '#d97706' },
  { name: 'Carnes', value: 12, color: '#dc2626' },
  { name: 'Otros', value: 8, color: '#64748b' },
];

const reportTypes = [
  { id: 'profit-loss', label: 'Ganancias y Pérdidas', icon: <TrendingUp size={18} />, color: 'text-success' },
  { id: 'sales', label: 'Ventas', icon: <ShoppingCart size={18} />, color: 'text-info' },
  { id: 'purchases', label: 'Compras', icon: <ShoppingBag size={18} />, color: 'text-warning' },
  { id: 'stock', label: 'Inventario', icon: <Package size={18} />, color: 'text-primary' },
  { id: 'expenses', label: 'Gastos', icon: <DollarSign size={18} />, color: 'text-danger' },
  { id: 'customers', label: 'Clientes', icon: <Users size={18} />, color: 'text-info' },
  { id: 'agents', label: 'Agentes', icon: <Users size={18} />, color: 'text-primary' },
  { id: 'fiscal', label: 'Informe Fiscal DGII', icon: <FileText size={18} />, color: 'text-warning' },
  { id: 'cashier', label: 'Informe de Caja', icon: <DollarSign size={18} />, color: 'text-success' },
];

export default function ReportsPage() {
  const pathname = usePathname();
  const [activeReport, setActiveReport] = useState('profit-loss');
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2024-01-31');

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Informes</h1>
            <p className="text-sm text-muted-foreground mt-1">Análisis y reportes del negocio</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Printer size={16} />Imprimir</button>
            <button className="btn-primary flex items-center gap-2"><Download size={16} />Exportar PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Reports */}
          <div className="card p-3 space-y-1 h-fit">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Tipo de Informe</p>
            {reportTypes.map(r => (
              <button key={r.id} onClick={() => setActiveReport(r.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${activeReport === r.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <span className={activeReport === r.id ? 'text-primary' : r.color}>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Report Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Filters */}
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
                <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
                <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal</label>
                <select className="input-field">
                  <option>Todas las sucursales</option>
                  <option>Sucursal Principal</option>
                  <option>Sucursal Norte</option>
                </select>
              </div>
              <button className="btn-primary flex items-center gap-2"><Filter size={16} />Generar</button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <TrendingUp size={16} className="text-success" />
                </div>
                <p className="text-xl font-bold text-foreground">RD$ 185K</p>
                <p className="text-xs text-success mt-1">+12.5% vs mes anterior</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <TrendingDown size={16} className="text-danger" />
                </div>
                <p className="text-xl font-bold text-foreground">RD$ 125K</p>
                <p className="text-xs text-danger mt-1">+8.2% vs mes anterior</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Ganancia Neta</p>
                  <BarChart2 size={16} className="text-primary" />
                </div>
                <p className="text-xl font-bold text-success">RD$ 60K</p>
                <p className="text-xs text-success mt-1">+18.3% vs mes anterior</p>
              </div>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Margen</p>
                  <TrendingUp size={16} className="text-info" />
                </div>
                <p className="text-xl font-bold text-foreground">32.4%</p>
                <p className="text-xs text-success mt-1">+2.1% vs mes anterior</p>
              </div>
            </div>

            {/* Main Chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-foreground mb-4">Ventas vs Compras vs Ganancias (últimos 6 meses)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={salesData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => `RD$ ${formatNumber(v)}`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="ventas" fill="var(--info)" radius={[4,4,0,0]} name="Ventas" />
                  <Bar dataKey="compras" fill="var(--warning)" radius={[4,4,0,0]} name="Compras" />
                  <Bar dataKey="ganancias" fill="var(--primary)" radius={[4,4,0,0]} name="Ganancias" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Products */}
              <div className="card p-5">
                <h3 className="font-semibold text-foreground mb-4">Productos más vendidos</h3>
                <div className="space-y-3">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <div className="h-1.5 bg-secondary rounded-full mt-1">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(p.sold / 450) * 100}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-foreground">{p.sold} uds</p>
                        <p className="text-xs text-muted-foreground">RD$ {(p.revenue/1000).toFixed(0)}K</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Distribution */}
              <div className="card p-5">
                <h3 className="font-semibold text-foreground mb-4">Ventas por categoría</h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                        {categoryData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {categoryData.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-muted-foreground">{c.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
