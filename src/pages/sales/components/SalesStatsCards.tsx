import React from 'react';
import type { VentaConDetalle } from '@/services/ventas.service';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';
import type { DevolucionConDetalle } from '@/services/devoluciones.service';
import type { SalesTab } from '../types';

interface SalesStatsCardsProps {
  tab: SalesTab;
  ventas: VentaConDetalle[];
  totalVentas: number;
  cotizaciones: CotizacionConDetalle[];
  devoluciones: DevolucionConDetalle[];
}

export function SalesStatsCards({
  tab,
  ventas,
  totalVentas,
  cotizaciones,
  devoluciones,
}: SalesStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tab === 'returns' ? (
        <>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Reembolsos
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              RD${' '}
              {devoluciones
                .reduce((s, x) => s + Number(x.monto_total || 0), 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aprobadas
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
              {devoluciones.filter((d) => d.estado === 'aprobada').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pendientes
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
              {devoluciones.filter((d) => d.estado === 'pendiente').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Solicitudes
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              {devoluciones.length} {devoluciones.length === 1 ? 'devolución' : 'devoluciones'}
            </p>
          </div>
        </>
      ) : tab === 'quotes' ? (
        <>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monto Cotizado
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              RD${' '}
              {cotizaciones
                .reduce((s, x) => s + Number(x.monto_total || 0), 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Convertidas a Venta
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              {cotizaciones.filter((c) => c.estado === 'convertida').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cotizaciones Pendientes
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
              {cotizaciones.filter((c) => c.estado === 'pendiente').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Cotizaciones
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              {cotizaciones.length} {cotizaciones.length === 1 ? 'cotización' : 'cotizaciones'}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ventas Totales
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              RD${' '}
              {ventas
                .reduce((s, x) => s + x.monto_total, 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ganancia Bruta Estimada
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              RD${' '}
              {ventas
                .reduce((s, x) => s + (x.monto_total - x.costo_total), 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ITBIS (18% Transparentado)
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              RD${' '}
              {ventas
                .reduce((s, x) => s + x.monto_impuesto, 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Facturas Emitidas
            </p>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
              {totalVentas} {totalVentas === 1 ? 'factura' : 'facturas'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
