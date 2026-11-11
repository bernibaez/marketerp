import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { ShoppingCart, Receipt, CreditCard, BarChart2 } from 'lucide-react';
import { KpiCard, ReportTable, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeVentas, type InformeVentas } from '@/services/informes.service';

export default function SalesReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeVentas({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar ventas');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas del periodo" value={formatRD(data.totalVentas)} trend="Desde Supabase" icon={<ShoppingCart size={16} className="text-info" />} />
        <KpiCard label="Tickets / facturas" value={String(data.tickets)} trend="Ventas registradas" icon={<Receipt size={16} className="text-primary" />} />
        <KpiCard label="Ticket promedio" value={formatRD(data.ticketPromedio)} trend="Promedio por factura" icon={<BarChart2 size={16} className="text-success" />} />
        <KpiCard label="ITBIS cobrado" value={formatRD(data.itbis)} trend="Impuesto del periodo" icon={<CreditCard size={16} className="text-warning" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-foreground mb-4">Ventas diarias</h3>
          {data.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No hay ventas en este periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
                <Bar dataKey="ventas" fill="var(--info)" radius={[4, 4, 0, 0]} name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-foreground mb-4">Métodos de pago</h3>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sin datos</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={data.payments} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {data.payments.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {data.payments.map((m) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                      <span className="text-muted-foreground">{m.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{m.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Detalle de ventas</h3>
        <ReportTable
          headers={['Factura', 'Fecha', 'Cliente', 'Ítems', 'Pago', 'Agente', 'Total']}
          rows={data.rows}
          searchPlaceholder="Buscar por factura, cliente o agente…"
          itemLabel="facturas"
        />
      </div>
    </div>
  );
}
