import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DollarSign, Receipt, Tag, TrendingUp } from 'lucide-react';
import { KpiCard, ReportTable, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeGastos, type InformeGastos } from '@/services/informes.service';

const CAT_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#64748b', '#0891b2', '#be185d'];

const statusBadge = (s: string) => {
  const lower = s.toLowerCase();
  if (lower === 'aprobado') return <span className="badge-success">Aprobado</span>;
  if (lower === 'pendiente') return <span className="badge-warning">Pendiente</span>;
  return <span className="badge-info">{s}</span>;
};

export default function ExpensesReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeGastos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeGastos({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar gastos');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  const byCategory = useMemo(() => {
    if (!data?.rows.length) return [];
    const map = new Map<string, number>();
    for (const r of data.rows) {
      const cat = String(r[2] ?? 'Otros');
      const raw = String(r[4]).replace(/[^\d.-]/g, '');
      map.set(cat, (map.get(cat) ?? 0) + Number(raw || 0));
    }
    return [...map.entries()].map(([name, value], i) => ({
      name,
      value,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }));
  }, [data]);

  const byDay = useMemo(() => {
    if (!data?.rows.length) return [];
    const map = new Map<string, number>();
    for (const r of data.rows) {
      const day = String(r[1]);
      const raw = String(r[4]).replace(/[^\d.-]/g, '');
      map.set(day, (map.get(day) ?? 0) + Number(raw || 0));
    }
    return [...map.entries()].map(([day, monto]) => ({ day, monto }));
  }, [data]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Gastos del periodo" value={formatRD(data.total)} trend={`${dateFrom} → ${dateTo}`} trendPositive={false} icon={<DollarSign size={16} className="text-danger" />} />
        <KpiCard label="Gastos aprobados" value={formatRD(data.aprobados)} trend="Aprobados" icon={<Receipt size={16} className="text-success" />} />
        <KpiCard label="Pendientes" value={formatRD(data.pendientes)} trend="Por aprobar" trendPositive={false} icon={<Tag size={16} className="text-warning" />} />
        <KpiCard label="Registros" value={String(data.rows.length)} trend="Comprobantes" icon={<TrendingUp size={16} className="text-info" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-foreground mb-4">Gastos por categoría</h3>
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin gastos en el periodo</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={byCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {byCategory.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{formatRD(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-foreground mb-4">Gastos por fecha</h3>
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
                <Bar dataKey="monto" fill="var(--danger)" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Detalle de gastos</h3>
        <ReportTable
          headers={['Código', 'Fecha', 'Categoría', 'Descripción', 'Monto', 'Estado']}
          rows={data.rows.map((r) => [r[0], r[1], r[2], r[3], r[4], statusBadge(String(r[5]))])}
          searchPlaceholder="Buscar por código, categoría o descripción…"
          itemLabel="gastos"
        />
      </div>
    </div>
  );
}
