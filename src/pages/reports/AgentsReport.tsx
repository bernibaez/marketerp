import React, { useEffect, useState } from 'react';
import { UserCheck, Percent } from 'lucide-react';
import { KpiCard, ReportTable, ReportLoading, ReportError, type ReportPeriodProps } from './shared';
import { informeAgentes, type InformeAgentes } from '@/services/informes.service';

export default function AgentsReport({ dateFrom: _dateFrom, dateTo: _dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeAgentes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeAgentes()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar agentes');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  const statusRows = data.rows.map((r) => [
    r[0],
    r[1],
    r[2],
    r[3],
    <span key={String(r[0])} className={String(r[4]) === 'Activo' ? 'badge-success' : 'badge-danger'}>
      {String(r[4])}
    </span>,
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <KpiCard label="Agentes activos" value={String(data.activos)} trend="Equipo comercial" icon={<UserCheck size={16} className="text-primary" />} />
        <KpiCard label="Total registrados" value={String(data.rows.length)} trend="Catálogo de agentes" icon={<Percent size={16} className="text-warning" />} />
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-3">Agentes comerciales</h3>
        <ReportTable
          headers={['Agente', 'Correo', 'Teléfono', 'Comisión %', 'Estado']}
          rows={statusRows}
          searchPlaceholder="Buscar agente, correo o teléfono…"
          itemLabel="agentes"
        />
      </div>
    </div>
  );
}
