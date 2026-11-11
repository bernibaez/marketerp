import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { KpiCard, ReportTable, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeCombos, type InformeCombos } from '@/services/informes.service';

const COLOR_PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

function parseMoney(v: string | number) {
  return Number(String(v).replace(/[^\d.-]/g, '') || 0);
}

export default function CombosReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeCombos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeCombos({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar combos');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  const chartData = useMemo(() => {
    if (!data?.rows.length) return [];
    return data.rows
      .map((r) => ({
        code: String(r[0]),
        name: String(r[1]),
        qty: Number(r[3] ?? 0),
        revenue: parseMoney(r[5]),
      }))
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [data]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Combos en catálogo" value={String(data.totalCombos)} trend="Activos e inactivos" icon={<Boxes size={16} className="text-primary" />} />
        <KpiCard label="Unidades vendidas" value={String(data.vendidos)} trend={`${dateFrom} → ${dateTo}`} icon={<TrendingUp size={16} className="text-info" />} />
        <KpiCard label="Ingreso por combos" value={formatRD(data.ingreso)} trend="Ventas del periodo" icon={<DollarSign size={16} className="text-success" />} />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <BarChart2 size={18} className="text-primary" /> Combos más vendidos
          </h3>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No hay ventas de combos en este periodo</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="code" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'revenue' ? formatRD(value) : `${value} unds`
                }
                contentStyle={chartTooltipStyle}
              />
              <Bar dataKey="qty" radius={[4, 4, 0, 0]} name="Unidades">
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Detalle de combos</h3>
        <ReportTable
          headers={['Código', 'Nombre', 'Estado', 'Vendidos', 'Precio', 'Ingreso periodo']}
          rows={data.rows}
          searchPlaceholder="Buscar por código o nombre de combo…"
          itemLabel="combos"
        />
      </div>
    </div>
  );
}
