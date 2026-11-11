import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

export type ReportPeriodProps = {
  dateFrom: string;
  dateTo: string;
};

export function formatRD(value: number) {
  return `RD$ ${value.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function ReportLoading({ message = 'Cargando informe…' }: { message?: string }) {
  return (
    <div className="card p-12 flex flex-col items-center justify-center gap-3 text-center fade-in" role="status">
      <span
        className="inline-block h-8 w-8 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="w-full max-w-md grid grid-cols-3 gap-3 mt-2">
        <div className="skeleton-shimmer h-16 rounded-xl" />
        <div className="skeleton-shimmer h-16 rounded-xl" />
        <div className="skeleton-shimmer h-16 rounded-xl" />
      </div>
      <div className="w-full max-w-md skeleton-shimmer h-40 rounded-xl mt-1" />
    </div>
  );
}

export function ReportError({ error }: { error: string }) {
  return (
    <div className="card p-8 text-center text-danger text-sm">{error}</div>
  );
}

export function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `RD$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `RD$ ${(value / 1_000).toFixed(0)}K`;
  return formatRD(value);
}

interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  icon: React.ReactNode;
}

export function KpiCard({ label, value, trend, trendPositive = true, icon }: KpiCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {trend && (
        <p className={`text-xs mt-1 ${trendPositive ? 'text-success' : 'text-danger'}`}>{trend}</p>
      )}
    </div>
  );
}

export interface ReportPaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function ReportPagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'registros',
}: ReportPaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-secondary/15 text-xs print:hidden">
      <div className="flex items-center flex-wrap gap-3 text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground">{startIndex + 1}</strong>–
          <strong className="text-foreground">{endIndex}</strong> de{' '}
          <strong className="text-foreground">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && totalItems > Math.min(...pageSizeOptions) && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]">Por pág:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Registros por página"
              className="h-7 px-1.5 rounded-md border border-border bg-background text-xs cursor-pointer outline-hidden"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((pageNum, idx, arr) => (
              <React.Fragment key={`page-${pageNum}`}>
                {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                  <span className="px-1 text-muted-foreground/50">…</span>
                )}
                <button
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[1.75rem] h-7 px-1.5 rounded-md text-xs font-medium transition-all ${
                    safePage === pageNum
                      ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {pageNum}
                </button>
              </React.Fragment>
            ))}
          </div>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function extractNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractNodeText(node.props?.children);
  }
  return '';
}

interface ReportTableProps {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  emptyMessage?: string;
  defaultPageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  itemLabel?: string;
}

export function ReportTable({
  headers,
  rows,
  emptyMessage = 'Sin datos en el periodo',
  defaultPageSize = 10,
  searchable,
  searchPlaceholder = 'Buscar en la tabla…',
  itemLabel = 'registros',
}: ReportTableProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const showSearch = searchable ?? rows.length > 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [rows, search]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.some((cell) => extractNodeText(cell).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + pageSize),
    [filteredRows, startIndex, pageSize]
  );

  return (
    <div className="card overflow-hidden">
      {showSearch && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-secondary/20 print:hidden">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-field pl-8 pr-7 py-1 text-xs w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {search.trim()
              ? `${filteredRows.length} coincidencia(s) de ${rows.length}`
              : `${rows.length} ${itemLabel}`}
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">
                  {search.trim() ? 'No se encontraron coincidencias para tu búsqueda.' : emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, i) => (
                <tr key={startIndex + i} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 text-foreground whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        totalItems={filteredRows.length}
        currentPage={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel={itemLabel}
      />
    </div>
  );
}

export interface ReportTabOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function ReportSectionTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ReportTabOption<T>[];
  activeTab: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2 print:hidden">
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              active
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  active ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const chartTooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
};
