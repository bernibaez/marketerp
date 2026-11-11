import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, AlertTriangle, Layers, TrendingDown } from 'lucide-react';
import { KpiCard, ReportTable, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeInventario, type InformeInventario } from '@/services/informes.service';

const stockBadge = (estado: string) => {
  if (estado === 'Agotado') return <span className="badge-danger">Agotado</span>;
  if (estado === 'Bajo') return <span className="badge-warning">Bajo</span>;
  return <span className="badge-success">OK</span>;
};

export default function InventoryReport({ dateFrom: _dateFrom, dateTo: _dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'OK' | 'Bajo' | 'Agotado'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeInventario()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar inventario');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    if (!data?.rows.length) return [];
    const set = new Set(data.rows.map((r) => String(r[2] ?? 'Otros')).filter(Boolean));
    return [...set].sort();
  }, [data]);

  const categoryStock = useMemo(() => {
    if (!data?.rows.length) return [];
    const map = new Map<string, number>();
    for (const r of data.rows) {
      const cat = String(r[2] ?? 'Otros');
      const raw = String(r[5]).replace(/[^\d.-]/g, '');
      map.set(cat, (map.get(cat) ?? 0) + Number(raw || 0));
    }
    const sorted = [...map.entries()]
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor);
    if (sorted.length <= 10) return sorted;
    const top = sorted.slice(0, 9);
    const othersVal = sorted.slice(9).reduce((s, c) => s + c.valor, 0);
    return [...top, { name: 'Otras', valor: othersVal }];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data?.rows.length) return [];
    return data.rows.filter((r) => {
      const matchStatus = statusFilter === 'all' || String(r[6]) === statusFilter;
      const matchCat = categoryFilter === 'all' || String(r[2] ?? 'Otros') === categoryFilter;
      return matchStatus && matchCat;
    });
  }, [data, statusFilter, categoryFilter]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Valor de inventario" value={formatRD(data.valor)} trend={`${data.skus} SKUs activos`} icon={<Package size={16} className="text-primary" />} />
        <KpiCard label="Stock bajo" value={String(data.bajos)} trend="Requieren reposición" trendPositive={false} icon={<AlertTriangle size={16} className="text-warning" />} />
        <KpiCard label="Productos agotados" value={String(data.agotados)} trend="Sin existencia" trendPositive={false} icon={<TrendingDown size={16} className="text-danger" />} />
        <KpiCard label="Categorías" value={String(categories.length)} trend="Snapshot actual" icon={<Layers size={16} className="text-info" />} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-foreground mb-4">
          Valor de inventario por categoría {categories.length > 10 ? '(Top 9 + Otras)' : ''}
        </h3>
        {categoryStock.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Sin productos activos</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryStock} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="valor" fill="var(--primary)" radius={[0, 4, 4, 0]} name="Valor" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-foreground">Estado de inventario</h3>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field py-1 px-2.5 text-xs w-44"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'OK' | 'Bajo' | 'Agotado')}
              className="input-field py-1 px-2.5 text-xs w-36"
            >
              <option value="all">Todos los estados</option>
              <option value="OK">OK</option>
              <option value="Bajo">Stock Bajo</option>
              <option value="Agotado">Agotados</option>
            </select>
          </div>
        </div>
        <ReportTable
          headers={['SKU', 'Producto', 'Categoría', 'Stock', 'Mín.', 'Valor', 'Estado']}
          rows={filteredRows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], stockBadge(String(r[6]))])}
          searchPlaceholder="Buscar por SKU, producto o categoría…"
          itemLabel="productos"
        />
      </div>
    </div>
  );
}
