import React from 'react';
import {
  ShoppingCart,
  FileText,
  RotateCcw,
  Search,
  Download,
  FileSpreadsheet,
  Pause,
  Calendar,
  X,
} from 'lucide-react';
import type { SalesTab } from '../types';

interface SalesFilterToolbarProps {
  tab: SalesTab;
  onTabChange: (tab: SalesTab) => void;
  counts: {
    sales: number;
    quotes: number;
    returns: number;
    held?: number;
  };
  search: string;
  onSearchChange: (val: string) => void;
  singleDate?: string;
  onSingleDateChange?: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  currentCount: number;
  canExportSales: boolean;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export function SalesFilterToolbar({
  tab,
  onTabChange,
  counts,
  search,
  onSearchChange,
  singleDate = '',
  onSingleDateChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  currentCount,
  canExportSales,
  onExportPdf,
  onExportExcel,
}: SalesFilterToolbarProps) {
  const tabs = [
    { id: 'sales' as SalesTab, label: 'Todas las Ventas', icon: <ShoppingCart size={15} />, count: counts.sales },
    { id: 'quotes' as SalesTab, label: 'Cotizaciones', icon: <FileText size={15} />, count: counts.quotes },
    { id: 'returns' as SalesTab, label: 'Devoluciones', icon: <RotateCcw size={15} />, count: counts.returns },
    { id: 'held' as SalesTab, label: 'Ventas Suspendidas', icon: <Pause size={15} />, count: counts.held ?? 0 },
  ];

  const hasDateFilter = Boolean(singleDate || dateFrom || dateTo);

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit flex-wrap border border-slate-200/70 dark:border-slate-700/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Integrated Filter Toolbar */}
      <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition"
              placeholder={
                tab === 'returns'
                  ? 'Buscar por código, factura o cliente...'
                  : 'Buscar por número de factura, NCF o cliente...'
              }
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {onSingleDateChange && (
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span className="text-[11px] font-semibold">Fecha:</span>
                <input
                  type="date"
                  title="Buscar por fecha específica"
                  className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 outline-none"
                  value={singleDate}
                  onChange={(e) => {
                    onSingleDateChange(e.target.value);
                    onDateFromChange('');
                    onDateToChange('');
                  }}
                />
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold">Desde:</span>
              <input
                type="date"
                title="Fecha desde"
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 outline-none"
                value={dateFrom}
                onChange={(e) => {
                  onDateFromChange(e.target.value);
                  onSingleDateChange?.('');
                }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold">Hasta:</span>
              <input
                type="date"
                title="Fecha hasta"
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 outline-none"
                value={dateTo}
                onChange={(e) => {
                  onDateToChange(e.target.value);
                  onSingleDateChange?.('');
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const today = new Date().toLocaleDateString('en-CA');
                if (onSingleDateChange) {
                  onSingleDateChange(today);
                  onDateFromChange('');
                  onDateToChange('');
                } else {
                  onDateFromChange(today);
                  onDateToChange(today);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Hoy
            </button>

            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  onSingleDateChange?.('');
                  onDateFromChange('');
                  onDateToChange('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <X size={13} />
                Limpiar fechas
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between xl:justify-end gap-3 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
            {currentCount} {currentCount === 1 ? 'registro' : 'registros'}
          </span>
          <div className="flex items-center gap-1.5">
            {canExportSales && (
              <button
                type="button"
                onClick={onExportPdf}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Download size={13} /> PDF
              </button>
            )}
            {canExportSales && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
