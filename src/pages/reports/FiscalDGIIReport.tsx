import React, { useState, useEffect } from 'react';
import { FileText, Receipt, Percent, Building2 } from 'lucide-react';
import { KpiCard, ReportTable, ReportSectionTabs, formatRD, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeFiscal, type InformeFiscal } from '@/services/informes.service';

type FiscalTab = 'ncf' | '606' | '607';

export default function FiscalDGIIReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeFiscal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FiscalTab>('ncf');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeFiscal({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar informe fiscal');
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

  const itbisSummary: [string, string][] = [
    ['ITBIS cobrado en ventas', formatRD(data.itbisCobrado)],
    ['ITBIS crédito fiscal (compras)', formatRD(data.itbisCredito)],
    ['ITBIS neto a pagar (estimado)', formatRD(data.itbisNeto)],
    ['Ventas gravadas (subtotal)', formatRD(data.ventasGravadas)],
  ];

  const tabs: { id: FiscalTab; label: string; count: number }[] = [
    { id: 'ncf', label: 'NCF / Facturas', count: data.ncfRows.length },
    { id: '606', label: 'Formato 606 (Compras)', count: data.form606.length },
    { id: '607', label: 'Formato 607 (Ventas)', count: data.form607.length },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-warning/5 border-warning/20">
        <div className="flex items-start gap-3">
          <Building2 size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Informe Fiscal DGII — {dateFrom} → {dateTo}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Resumen preliminar para formatos 606 (compras) y 607 (ventas) desde Supabase.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas gravadas" value={formatRD(data.ventasGravadas)} trend="Subtotal del periodo" icon={<Receipt size={16} className="text-info" />} />
        <KpiCard label="ITBIS cobrado" value={formatRD(data.itbisCobrado)} trend="Impuesto en ventas" icon={<Percent size={16} className="text-warning" />} />
        <KpiCard label="ITBIS crédito fiscal" value={formatRD(data.itbisCredito)} trend="Compras" icon={<FileText size={16} className="text-primary" />} />
        <KpiCard label="ITBIS neto a pagar" value={formatRD(data.itbisNeto)} trend="Estimado del periodo" trendPositive={false} icon={<Building2 size={16} className="text-danger" />} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Resumen ITBIS</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {itbisSummary.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 text-xs border-b border-border/60 last:border-b-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <ReportSectionTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'ncf' && (
        <div>
          <h3 className="font-semibold text-foreground mb-2.5 text-sm">NCF / Facturas fiscales</h3>
          <ReportTable
            headers={['NCF', 'Tipo', 'Fecha', 'Cliente', 'RNC', 'Monto']}
            rows={data.ncfRows}
            searchPlaceholder="Buscar por NCF, cliente o RNC…"
            itemLabel="comprobantes"
          />
        </div>
      )}

      {activeTab === '606' && (
        <div>
          <h3 className="font-semibold text-foreground mb-2.5 text-sm">Formato 606 — Compras</h3>
          <ReportTable
            headers={['Código', 'Fecha', 'RNC', 'Proveedor', 'Monto', 'ITBIS']}
            rows={data.form606}
            searchPlaceholder="Buscar por código, RNC o proveedor…"
            itemLabel="compras"
          />
        </div>
      )}

      {activeTab === '607' && (
        <div>
          <h3 className="font-semibold text-foreground mb-2.5 text-sm">Formato 607 — Ventas</h3>
          <ReportTable
            headers={['NCF/Factura', 'Fecha', 'RNC/Cédula', 'Cliente', 'Monto', 'ITBIS']}
            rows={data.form607}
            searchPlaceholder="Buscar por NCF, cliente o RNC…"
            itemLabel="ventas"
          />
        </div>
      )}
    </div>
  );
}
