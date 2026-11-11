import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingBag, Truck, Package, AlertTriangle } from 'lucide-react';
import { KpiCard, ReportTable, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeCompras, type InformeCompras } from '@/services/informes.service';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Recibida: 'badge-success',
    Parcial: 'badge-warning',
    Pendiente: 'badge-info',
    Anulada: 'badge-danger',
  };
  return <span className={map[status] || 'badge-info'}>{status}</span>;
};

export default function PurchasesReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeCompras | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeCompras({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar compras');
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
    const byDay = new Map<string, number>();
    for (const r of data.rows) {
      const day = String(r[1]);
      const montoStr = String(r[5]).replace(/[^\d.-]/g, '');
      byDay.set(day, (byDay.get(day) ?? 0) + Number(montoStr || 0));
    }
    return [...byDay.entries()].map(([day, compras]) => ({ day, compras }));
  }, [data]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  const proveedores = new Set(data.rows.map((r) => String(r[2]))).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Compras del periodo" value={formatRD(data.total)} trend={`${dateFrom} → ${dateTo}`} icon={<ShoppingBag size={16} className="text-warning" />} />
        <KpiCard label="Órdenes emitidas" value={String(data.ordenes)} trend="Desde Supabase" icon={<Truck size={16} className="text-info" />} />
        <KpiCard label="Proveedores" value={String(proveedores)} trend="En el periodo" icon={<Package size={16} className="text-primary" />} />
        <KpiCard label="Pendientes de recibir" value={formatRD(data.pendientesMonto)} trend={`${data.pendientes} órdenes abiertas`} trendPositive={false} icon={<AlertTriangle size={16} className="text-danger" />} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-foreground mb-4">Compras por fecha</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No hay compras en este periodo</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="compras" fill="var(--warning)" radius={[4, 4, 0, 0]} name="Compras" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Detalle de órdenes de compra</h3>
        <ReportTable
          headers={['Orden', 'Fecha', 'Proveedor', 'Estado', 'Ítems', 'Total']}
          rows={data.rows.map((r) => [r[0], r[1], r[2], statusBadge(String(r[3])), r[4], r[5]])}
          searchPlaceholder="Buscar por orden, proveedor o estado…"
          itemLabel="órdenes"
        />
      </div>
    </div>
  );
}
