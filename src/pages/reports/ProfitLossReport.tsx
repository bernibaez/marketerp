import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart2, DollarSign } from 'lucide-react';
import {
  KpiCard,
  chartTooltipStyle,
  formatRD,
  ReportLoading,
  ReportError,
  type ReportPeriodProps,
} from './shared';
import { informeGananciasPerdidas, type InformeGanancias } from '@/services/informes.service';

export default function ProfitLossReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeGanancias | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    informeGananciasPerdidas({ desde: dateFrom, hasta: dateTo })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  const chartData = [
    { name: 'Ventas', monto: data.ventas, fill: 'var(--info)' },
    { name: 'Costo', monto: data.costo, fill: 'var(--danger)' },
    { name: 'ITBIS', monto: data.itbis, fill: 'var(--warning)' },
    { name: 'Gan. Bruta', monto: data.gananciaBruta, fill: 'var(--primary)' },
    { name: 'Gan. Neta', monto: data.gananciaNeta, fill: 'var(--success)' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Ventas Totales" value={formatRD(data.ventas)} trend={`${dateFrom} → ${dateTo}`} icon={<TrendingUp size={16} className="text-info" />} />
        <KpiCard label="Costo de Ventas" value={formatRD(data.costoVentas || data.costo)} trend="Inv. Ini + Comp − Inv. Fin" trendPositive={false} icon={<TrendingDown size={16} className="text-danger" />} />
        <KpiCard label="Ganancia Bruta" value={formatRD(data.gananciaBruta)} trend="Ventas − Costo" icon={<BarChart2 size={16} className="text-primary" />} />
        <KpiCard label="ITBIS" value={formatRD(data.itbis)} trend="Impuestos" icon={<DollarSign size={16} className="text-warning" />} />
        <KpiCard label="Ganancia Neta" value={formatRD(data.gananciaNeta)} trend="Resultado" icon={<TrendingUp size={16} className="text-success" />} />
      </div>

      {/* Estructura Contable del Costo de Ventas e Inventarios */}
      <div className="card p-5 border border-border shadow-sm">
        <h3 className="font-bold text-foreground mb-3 text-sm flex items-center justify-between">
          <span>Determinación del Costo de Ventas e Inventarios (Valuados al Costo)</span>
          <span className="text-xs text-muted-foreground font-normal">Período: {dateFrom} → {dateTo}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-secondary/20 p-3.5 rounded-xl border border-border">
            <p className="text-xs text-muted-foreground font-semibold">1. Inventario Inicial</p>
            <p className="text-lg font-extrabold text-foreground font-mono mt-1">{formatRD(data.inventarioInicial)}</p>
            <p className="text-[11px] text-muted-foreground">Valor al costo al inicio del período</p>
          </div>
          <div className="bg-success/10 p-3.5 rounded-xl border border-success/20">
            <p className="text-xs text-success font-semibold">(+) Compras / Entradas</p>
            <p className="text-lg font-extrabold text-success font-mono mt-1">+{formatRD(data.comprasPeriodo)}</p>
            <p className="text-[11px] text-muted-foreground">Mercancía adquirida en el período</p>
          </div>
          <div className="bg-danger/10 p-3.5 rounded-xl border border-danger/20">
            <p className="text-xs text-danger font-semibold">(-) Inventario Final</p>
            <p className="text-lg font-extrabold text-danger font-mono mt-1">-{formatRD(data.inventarioFinal)}</p>
            <p className="text-[11px] text-muted-foreground">Existencias al costo al cierre</p>
          </div>
          <div className="bg-primary/10 p-3.5 rounded-xl border border-primary/20">
            <p className="text-xs text-primary font-bold">(=) Costo de Ventas</p>
            <p className="text-lg font-black text-primary font-mono mt-1">{formatRD(data.costoVentas || data.costo)}</p>
            <p className="text-[11px] text-muted-foreground">Inv. Inicial + Compras − Inv. Final</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-semibold text-foreground mb-4">Resumen financiero</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatRD(v)} contentStyle={chartTooltipStyle} />
              <Bar dataKey="monto" radius={[6, 6, 0, 0]} name="Monto">
                {chartData.map((e) => (
                  <Cell key={e.name} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-foreground mb-4">Métodos de pago</h3>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Sin ventas en el periodo</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={data.payments} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                    {data.payments.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {data.payments.map((m) => (
                  <div key={m.name} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{m.name}</span>
                    <span className="font-bold">{formatRD(m.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 pt-4 border-t border-border space-y-1 text-xs text-muted-foreground">
            <p>Unidades vendidas: <strong className="text-foreground">{data.qtySold}</strong></p>
            <p>Productos distintos: <strong className="text-foreground">{data.prodsSold}</strong></p>
            <p>Clientes: <strong className="text-foreground">{data.customers}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
