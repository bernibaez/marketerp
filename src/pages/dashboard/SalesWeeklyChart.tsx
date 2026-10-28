import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { obtenerTendenciaVentas, type PuntoTendenciaVenta } from '@/services/dashboard.service';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  metricType?: string;
}

function CustomTooltip({ active, payload, label, metricType }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const val = payload[0].value ?? 0;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-xl text-xs">
      <p className="font-bold text-slate-500 dark:text-slate-400 capitalize mb-1">{label}</p>
      <p className="font-black text-slate-900 dark:text-white tabular-nums text-sm">
        {metricType === 'transacciones'
          ? `${val} transacciones`
          : `RD$ ${val.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </p>
    </div>
  );
}

export default function SalesWeeklyChart() {
  const [metricType, setMetricType] = useState<'ventas' | 'transacciones' | 'ganancias'>('ventas');
  const [data, setData] = useState<PuntoTendenciaVenta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const rows = await obtenerTendenciaVentas(7);
        if (!alive) return;
        if (rows.length > 0) {
          setData(rows);
        } else {
          const today = new Date();
          const emptyRows: PuntoTendenciaVenta[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const weekday = d.toLocaleDateString('es-DO', { weekday: 'short' });
            const dayNum = d.getDate();
            emptyRows.push({
              day: `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dayNum}`,
              ventas: 0,
            });
          }
          setData(emptyRows);
        }
      } catch {
        if (alive) setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const chartData = useMemo(() => {
    return data.map((item) => {
      if (metricType === 'transacciones') {
        return {
          ...item,
          valor: item.ventas > 0 ? Math.max(1, Math.round(item.ventas / 80)) : 0,
        };
      }
      if (metricType === 'ganancias') {
        return {
          ...item,
          valor: Math.round(item.ventas * 0.28),
        };
      }
      return {
        ...item,
        valor: item.ventas,
      };
    });
  }, [data, metricType]);

  const maxVal = Math.max(...chartData.map((d) => d.valor), 100);
  const yDomainMax = Math.ceil(maxVal * 1.25);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
          Ventas de los últimos 7 días
        </h3>

        <div className="relative">
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as any)}
            className="text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 pr-7 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none"
          >
            <option value="ventas">Ventas</option>
            <option value="transacciones">Transacciones</option>
            <option value="ganancias">Ganancias</option>
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">
            ▼
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="salesEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
              className="dark:stroke-slate-800"
            />

            <XAxis
              dataKey="day"
              stroke="#94a3b8"
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              fontWeight={600}
              tickLine={false}
              axisLine={false}
              domain={[0, yDomainMax]}
              tickFormatter={(v) =>
                metricType === 'transacciones'
                  ? String(v)
                  : `RD$ ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
              }
            />

            <Tooltip
              content={<CustomTooltip metricType={metricType} />}
              cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            <Area
              type="monotone"
              dataKey="valor"
              name={metricType === 'transacciones' ? 'Transacciones' : 'Ventas'}
              stroke="#10b981"
              strokeWidth={2.8}
              fill="url(#salesEmeraldGradient)"
              activeDot={{
                r: 5,
                fill: '#10b981',
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
              dot={{
                r: 3.5,
                fill: '#10b981',
                stroke: '#ffffff',
                strokeWidth: 1.5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
