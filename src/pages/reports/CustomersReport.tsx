import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, CreditCard, Star, Clock } from 'lucide-react';
import { KpiCard, ReportTable, ReportSectionTabs, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeClientes, type InformeClientes } from '@/services/informes.service';

function parseMoney(v: string | number) {
  return Number(String(v).replace(/[^\d.-]/g, '') || 0);
}

type CustomersTab = 'list' | 'pending';

export default function CustomersReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeClientes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CustomersTab>('list');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeClientes({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar clientes');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  const topCustomers = useMemo(() => {
    if (!data?.rows.length) return [];
    return data.rows
      .map((r) => ({ name: String(r[1]), total: parseMoney(r[4]) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [data]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Clientes activos" value={String(data.total)} trend="Registro activo" icon={<Users size={16} className="text-info" />} />
        <KpiCard label="CxC pendiente" value={formatRD(data.cxcPendiente)} trend="Cuentas por cobrar" trendPositive={false} icon={<CreditCard size={16} className="text-warning" />} />
        <KpiCard label="Ticket promedio" value={formatRD(data.ticketPromedio)} trend={`${dateFrom} → ${dateTo}`} icon={<Star size={16} className="text-success" />} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-foreground mb-4">Top clientes por facturación</h3>
        {topCustomers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Sin ventas a clientes en el periodo</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCustomers} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="total" fill="var(--info)" radius={[0, 4, 4, 0]} name="Facturado" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <ReportSectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'list', label: 'Detalle de clientes', count: data.rows.length, icon: <Users size={13} /> },
          { id: 'pending', label: 'Balance pendiente (CxC)', count: data.pendingRows.length, icon: <Clock size={13} /> },
        ]}
      />

      {activeTab === 'list' ? (
        <div>
          <ReportTable
            key="customers-list"
            headers={['Código', 'Cliente', 'Teléfono', 'Saldo', 'Total periodo']}
            rows={data.rows}
            searchPlaceholder="Buscar por código, cliente o teléfono…"
            itemLabel="clientes"
          />
        </div>
      ) : (
        <div>
          <ReportTable
            key="customers-pending"
            headers={['Código', 'Cliente', 'Factura', 'Vencimiento', 'Saldo', 'Estado']}
            rows={data.pendingRows}
            searchPlaceholder="Buscar por cliente o factura…"
            itemLabel="cuentas"
          />
        </div>
      )}
    </div>
  );
}
