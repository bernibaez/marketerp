import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Truck, FileText, Package, CreditCard } from 'lucide-react';
import { KpiCard, ReportTable, ReportSectionTabs, formatRD, chartTooltipStyle, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeProveedores, type InformeProveedores } from '@/services/informes.service';

function parseMoney(v: string | number) {
  return Number(String(v).replace(/[^\d.-]/g, '') || 0);
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    recibida: 'badge-success',
    Recibida: 'badge-success',
    parcial: 'badge-warning',
    Parcial: 'badge-warning',
    pendiente: 'badge-info',
    Pendiente: 'badge-info',
    anulada: 'badge-danger',
    Anulada: 'badge-danger',
    Activo: 'badge-success',
    Inactivo: 'badge-danger',
  };
  return <span className={map[status] || 'badge-info'}>{status}</span>;
};

type SuppliersTab = 'purchases' | 'catalog';

export default function SuppliersReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeProveedores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SuppliersTab>('purchases');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeProveedores({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar proveedores');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  const topSuppliers = useMemo(() => {
    if (!data?.purchaseRows.length) return [];
    const map = new Map<string, number>();
    for (const r of data.purchaseRows) {
      const name = String(r[2]);
      map.set(name, (map.get(name) ?? 0) + parseMoney(r[3]));
    }
    return [...map.entries()]
      .map(([name, compras]) => ({ name, compras }))
      .sort((a, b) => b.compras - a.compras)
      .slice(0, 8);
  }, [data]);

  const comprasPeriodo = useMemo(
    () => (data?.purchaseRows ?? []).reduce((s, r) => s + parseMoney(r[3]), 0),
    [data]
  );

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Compras del periodo" value={formatRD(comprasPeriodo)} trend={`${dateFrom} → ${dateTo}`} icon={<Truck size={16} className="text-warning" />} />
        <KpiCard label="Saldo por pagar" value={formatRD(data.cxpPendiente)} trend="CxP abierta" trendPositive={false} icon={<CreditCard size={16} className="text-danger" />} />
        <KpiCard label="Órdenes en periodo" value={String(data.purchaseRows.length)} trend="Compras registradas" icon={<FileText size={16} className="text-info" />} />
        <KpiCard label="Proveedores activos" value={String(data.total)} trend="Catálogo" icon={<Package size={16} className="text-primary" />} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-foreground mb-4">Top proveedores por compras</h3>
        {topSuppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Sin compras en el periodo</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topSuppliers} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="compras" fill="var(--warning)" radius={[0, 4, 4, 0]} name="Compras" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <ReportSectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'purchases', label: 'Compras por proveedor', count: data.purchaseRows.length, icon: <FileText size={13} /> },
          { id: 'catalog', label: 'Proveedores', count: data.rows.length, icon: <Truck size={13} /> },
        ]}
      />

      {activeTab === 'purchases' ? (
        <ReportTable
          key="suppliers-purchases"
          headers={['Orden', 'Fecha', 'Proveedor', 'Total', 'Estado']}
          rows={data.purchaseRows.map((r) => [r[0], r[1], r[2], r[3], statusBadge(String(r[4]))])}
          searchPlaceholder="Buscar por orden o proveedor…"
          itemLabel="órdenes"
        />
      ) : (
        <ReportTable
          key="suppliers-catalog"
          headers={['Código', 'Proveedor', 'Teléfono', 'Estado']}
          rows={data.rows.map((r) => [r[0], r[1], r[2], statusBadge(String(r[3]))])}
          searchPlaceholder="Buscar proveedor…"
          itemLabel="proveedores"
        />
      )}
    </div>
  );
}
