import React, { useMemo } from 'react';
import {
  ShoppingCart,
  Receipt,
  Coins,
  Package,
  Calendar,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Activity,
} from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

function fmt(n: number) {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardBentoGrid() {
  const { metricas, alertas, loading } = useDashboard('hoy');

  const m = metricas;

  // Calculos para métricas
  const ventasTotal = m?.ventas_total ?? 0;
  const ventasCount = m?.ventas_count ?? 0;
  const ticketPromedio = m?.ticket_promedio ?? 0;
  const gananciaBruta = m?.ganancia_bruta ?? 0;
  const stockBajoCount = alertas?.length ?? (m?.productos_stock_bajo ?? 0);
  const agotadosCount = alertas?.filter((a) => a.stock_actual <= 0).length ?? 0;

  const margenPct = ventasTotal > 0 ? (gananciaBruta / ventasTotal) * 100 : 16.7;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Ventas del día (Verde / Emerald) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={22} strokeWidth={2.2} />
            </div>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
              <Activity size={13} />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ventas del día
          </p>

          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            {loading ? <Skeleton className="h-8 w-28" /> : fmt(ventasTotal)}
          </div>

          <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>↑ 12% vs. ayer</span>
          </div>
        </div>

        {/* Sparkline Decorativo */}
        <div className="absolute right-3 bottom-9 w-24 h-10 pointer-events-none opacity-80">
          <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
            <path
              d="M0,35 Q20,32 35,22 T70,18 T100,5"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0,35 Q20,32 35,22 T70,18 T100,5 L100,40 L0,40 Z"
              fill="url(#emeraldCardGrad)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="emeraldCardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Receipt size={14} className="text-slate-400" />
          <span>{ventasCount} transacciones</span>
        </div>
      </div>

      {/* 2. Ticket promedio (Azul / Sky) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
              <Receipt size={22} strokeWidth={2.2} />
            </div>
            <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-600 flex items-center justify-center">
              <Activity size={13} />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ticket promedio
          </p>

          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            {loading ? <Skeleton className="h-8 w-28" /> : fmt(ticketPromedio)}
          </div>

          <div className="flex items-center gap-1 mt-1 text-xs font-bold text-sky-600 dark:text-sky-400">
            <span>↑ 8% vs. ayer</span>
          </div>
        </div>

        {/* Sparkline Decorativo */}
        <div className="absolute right-3 bottom-9 w-24 h-10 pointer-events-none opacity-80">
          <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
            <path
              d="M0,38 Q25,36 45,26 T75,20 T100,8"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0,38 Q25,36 45,26 T75,20 T100,8 L100,40 L0,40 Z"
              fill="url(#skyCardGrad)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="skyCardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Calendar size={14} className="text-slate-400" />
          <span>Hoy</span>
        </div>
      </div>

      {/* 3. Ganancias brutas (Violeta / Purple) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Coins size={22} strokeWidth={2.2} />
            </div>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center">
              <Activity size={13} />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Ganancias brutas
          </p>

          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            {loading ? <Skeleton className="h-8 w-28" /> : fmt(gananciaBruta)}
          </div>

          <div className="flex items-center gap-1 mt-1 text-xs font-bold text-purple-600 dark:text-purple-400">
            <span>↑ 5% vs. ayer</span>
          </div>
        </div>

        {/* Sparkline Decorativo */}
        <div className="absolute right-3 bottom-9 w-24 h-10 pointer-events-none opacity-80">
          <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
            <path
              d="M0,36 Q30,32 50,22 T80,16 T100,6"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0,36 Q30,32 50,22 T80,16 T100,6 L100,40 L0,40 Z"
              fill="url(#purpleCardGrad)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="purpleCardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <TrendingUp size={14} className="text-slate-400" />
          <span>Margen: {margenPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* 4. Stock bajo (Naranja / Amber) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Package size={22} strokeWidth={2.2} />
            </div>
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
              <Activity size={13} />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Stock bajo
          </p>

          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
            {loading ? <Skeleton className="h-8 w-16" /> : stockBajoCount}
          </div>

          <div className="flex items-center gap-1 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <span>{agotadosCount} agotados</span>
          </div>
        </div>

        {/* Sparkline Decorativo */}
        <div className="absolute right-3 bottom-9 w-24 h-10 pointer-events-none opacity-80">
          <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
            <path
              d="M0,35 Q25,35 50,30 T80,24 T100,18"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M0,35 Q25,35 50,30 T80,24 T100,18 L100,40 L0,40 Z"
              fill="url(#amberCardGrad)"
              opacity="0.25"
            />
            <defs>
              <linearGradient id="amberCardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <AlertTriangle size={14} className="text-slate-400" />
          <span>{stockBajoCount === 0 ? 'Sin cambios' : 'Requiere revisión'}</span>
        </div>
      </div>
    </div>
  );
}
