import React, { useEffect, useState } from 'react';
import { Banknote, CreditCard, ArrowLeftRight, Wallet } from 'lucide-react';
import { KpiCard, ReportTable, ReportSectionTabs, formatRD, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeCaja, type InformeCaja } from '@/services/informes.service';

const diffBadge = (v: string) => {
  const n = Number(String(v).replace(/[^\d.-]/g, '') || 0);
  if (n < 0) return <span className="badge-danger">{v}</span>;
  if (n === 0) return <span className="badge-success">{v}</span>;
  return <span className="badge-warning">{v}</span>;
};

type CashierTab = 'sessions' | 'movements';

export default function CashierReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeCaja | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CashierTab>('sessions');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeCaja({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar caja');
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
        <KpiCard label="Efectivo declarado" value={formatRD(data.efectivo)} trend={`${data.sessions.length} sesiones`} icon={<Banknote size={16} className="text-success" />} />
        <KpiCard label="Ventas en tarjeta" value={formatRD(data.tarjeta)} trend="Cierres del periodo" icon={<CreditCard size={16} className="text-info" />} />
        <KpiCard label="Diferencia de arqueo" value={formatRD(data.diferencia)} trend="Suma de diferencias" icon={<ArrowLeftRight size={16} className="text-warning" />} />
        <KpiCard label="Fondo de caja" value={formatRD(data.fondo)} trend="Aperturas" icon={<Wallet size={16} className="text-primary" />} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Resumen de arqueo</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {[
            { label: 'Efectivo (cierres)', value: formatRD(data.efectivo) },
            { label: 'Tarjeta (cierres)', value: formatRD(data.tarjeta) },
            { label: 'Fondo apertura', value: formatRD(data.fondo) },
            { label: 'Diferencia total', value: formatRD(data.diferencia) },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-border/60 last:border-b-0">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold text-foreground font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <ReportSectionTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'sessions', label: 'Sesiones de caja', count: data.sessions.length },
          { id: 'movements', label: 'Movimientos (ventas del periodo)', count: data.movements.length },
        ]}
      />

      {activeTab === 'sessions' ? (
        <ReportTable
          key="cashier-sessions"
          headers={['Sesión', 'Apertura', 'Caja', 'Ventas', 'Efectivo', 'Esperado', 'Contado', 'Dif.']}
          rows={data.sessions.map((r) => [...r.slice(0, 7), diffBadge(String(r[7]))])}
          searchPlaceholder="Buscar sesión o caja…"
          itemLabel="sesiones"
        />
      ) : (
        <ReportTable
          key="cashier-movements"
          headers={['Hora', 'Tipo', 'Detalle', 'Efectivo', 'Total']}
          rows={data.movements}
          searchPlaceholder="Buscar factura o método…"
          itemLabel="movimientos"
        />
      )}
    </div>
  );
}
