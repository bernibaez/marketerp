'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { BarChart2, TrendingUp, TrendingDown, Package, ShoppingCart, ShoppingBag, DollarSign, Users, FileText, Download, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface ReportStats {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  netProfit: number;
  salesCount: number;
  purchasesCount: number;
  lowStockCount: number;
  clientsCount: number;
}

interface MonthlyData {
  month: string;
  ventas: number;
  compras: number;
  ganancias: number;
}

interface TopProduct {
  name: string;
  sold: number;
  revenue: number;
}

const reportTypes = [
  { id: 'profit-loss', label: 'Ganancias y Pérdidas', icon: <TrendingUp size={18} />, color: 'text-success' },
  { id: 'sales', label: 'Ventas', icon: <ShoppingCart size={18} />, color: 'text-info' },
  { id: 'purchases', label: 'Compras', icon: <ShoppingBag size={18} />, color: 'text-warning' },
  { id: 'stock', label: 'Inventario', icon: <Package size={18} />, color: 'text-primary' },
  { id: 'expenses', label: 'Gastos', icon: <DollarSign size={18} />, color: 'text-danger' },
  { id: 'customers', label: 'Clientes', icon: <Users size={18} />, color: 'text-info' },
  { id: 'fiscal', label: 'Informe Fiscal DGII', icon: <FileText size={18} />, color: 'text-warning' },
  { id: 'cashier', label: 'Informe de Caja', icon: <DollarSign size={18} />, color: 'text-success' },
];

const categoryColors = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#64748b'];

export default function ReportsPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [activeReport, setActiveReport] = useState('profit-loss');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState<ReportStats>({ totalSales: 0, totalPurchases: 0, totalExpenses: 0, netProfit: 0, salesCount: 0, purchasesCount: 0, lowStockCount: 0, clientsCount: 0 });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    const [salesRes, purchasesRes, expensesRes, productsRes, contactsRes, saleItemsRes] = await Promise.all([
      supabase.from('sales').select('total, created_at').gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59'),
      supabase.from('purchases').select('total, created_at').gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59'),
      supabase.from('expenses').select('amount, created_at').gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59'),
      supabase.from('products').select('id, name, current_stock, min_stock, categories(name)').eq('is_active', true),
      supabase.from('contacts').select('id').eq('is_active', true).eq('type', 'cliente'),
      supabase.from('sale_items').select('quantity, unit_price, subtotal, products(name)').limit(200),
    ]);

    const totalSales = (salesRes.data || []).reduce((s, r) => s + Number(r.total), 0);
    const totalPurchases = (purchasesRes.data || []).reduce((s, r) => s + Number(r.total), 0);
    const totalExpenses = (expensesRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
    const lowStockCount = (productsRes.data || []).filter(p => Number(p.current_stock) <= Number(p.min_stock)).length;

    setStats({
      totalSales, totalPurchases, totalExpenses,
      netProfit: totalSales - totalPurchases - totalExpenses,
      salesCount: salesRes.data?.length || 0,
      purchasesCount: purchasesRes.data?.length || 0,
      lowStockCount,
      clientsCount: contactsRes.data?.length || 0,
    });

    // Build monthly data from sales
    const monthMap: Record<string, { ventas: number; compras: number }> = {};
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    (salesRes.data || []).forEach(s => {
      const m = months[new Date(s.created_at).getMonth()];
      if (!monthMap[m]) monthMap[m] = { ventas: 0, compras: 0 };
      monthMap[m].ventas += Number(s.total);
    });
    (purchasesRes.data || []).forEach(p => {
      const m = months[new Date(p.created_at).getMonth()];
      if (!monthMap[m]) monthMap[m] = { ventas: 0, compras: 0 };
      monthMap[m].compras += Number(p.total);
    });
    const mData = Object.entries(monthMap).map(([month, d]) => ({ month, ventas: d.ventas, compras: d.compras, ganancias: d.ventas - d.compras }));
    setMonthlyData(mData.length > 0 ? mData : [{ month: 'Sin datos', ventas: 0, compras: 0, ganancias: 0 }]);

    // Top products from sale items
    const prodMap: Record<string, { sold: number; revenue: number }> = {};
    (saleItemsRes.data || []).forEach((item: any) => {
      const name = item.products?.name || 'Desconocido';
      if (!prodMap[name]) prodMap[name] = { sold: 0, revenue: 0 };
      prodMap[name].sold += Number(item.quantity);
      prodMap[name].revenue += Number(item.subtotal);
    });
    const top = Object.entries(prodMap).sort((a, b) => b[1].sold - a[1].sold).slice(0, 5).map(([name, d]) => ({ name, ...d }));
    setTopProducts(top);

    // Category distribution
    const catMap: Record<string, number> = {};
    (productsRes.data || []).forEach((p: any) => {
      const cat = p.categories?.name || 'Sin categoría';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const total = Object.values(catMap).reduce((s, v) => s + v, 0);
    const catData = Object.entries(catMap).slice(0, 5).map(([name, count], i) => ({
      name, value: total > 0 ? Math.round((count / total) * 100) : 0, color: categoryColors[i % categoryColors.length],
    }));
    setCategoryData(catData);
    setLoading(false);
  };

  useEffect(() => { fetchReportData(); }, []);

  const margin = stats.totalSales > 0 ? ((stats.netProfit / stats.totalSales) * 100).toFixed(1) : '0.0';

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Informes</h1>
            <p className="text-sm text-muted-foreground mt-1">Análisis y reportes del negocio</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex items-center gap-2"><Download size={16} />Exportar PDF</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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

          <div className="lg:col-span-3 space-y-4">
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label><input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label><input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
              <button onClick={fetchReportData} className="btn-primary flex items-center gap-2"><Filter size={16} />Generar</button>
            </div>

            {loading ? (
              <div className="card p-8 text-center text-muted-foreground">Cargando datos del informe...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs text-muted-foreground">Ingresos</p><TrendingUp size={16} className="text-success" /></div>
                    <p className="text-xl font-bold text-foreground">RD$ {formatNumber(stats.totalSales)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.salesCount} ventas</p>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs text-muted-foreground">Compras</p><TrendingDown size={16} className="text-warning" /></div>
                    <p className="text-xl font-bold text-foreground">RD$ {formatNumber(stats.totalPurchases)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats.purchasesCount} órdenes</p>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs text-muted-foreground">Ganancia Neta</p><BarChart2 size={16} className="text-primary" /></div>
                    <p className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>RD$ {formatNumber(stats.netProfit)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Gastos: RD$ {formatNumber(stats.totalExpenses)}</p>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs text-muted-foreground">Margen</p><TrendingUp size={16} className="text-info" /></div>
                    <p className="text-xl font-bold text-foreground">{margin}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Stock bajo: {stats.lowStockCount}</p>
                  </div>
                </div>

                <div className="card p-5">
                  <h3 className="font-semibold text-foreground mb-4">Ventas vs Compras vs Ganancias</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => `RD$ ${formatNumber(v)}`} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="ventas" fill="var(--info)" radius={[4, 4, 0, 0]} name="Ventas" />
                      <Bar dataKey="compras" fill="var(--warning)" radius={[4, 4, 0, 0]} name="Compras" />
                      <Bar dataKey="ganancias" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Ganancias" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="font-semibold text-foreground mb-4">Productos más vendidos</h3>
                    {topProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sin datos de ventas en el período</p>
                    ) : (
                      <div className="space-y-3">
                        {topProducts.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                              <div className="h-1.5 bg-secondary rounded-full mt-1">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${topProducts[0].sold > 0 ? (p.sold / topProducts[0].sold) * 100 : 0}%` }} />
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-semibold text-foreground">{p.sold} uds</p>
                              <p className="text-xs text-muted-foreground">RD$ {formatNumber(p.revenue)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card p-5">
                    <h3 className="font-semibold text-foreground mb-4">Productos por categoría</h3>
                    {categoryData.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sin datos de categorías</p>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={140} height={140}>
                          <PieChart>
                            <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                              {categoryData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
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
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
