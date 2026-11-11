import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sliders, X } from 'lucide-react';
import { KpiCard, ReportLoading, ReportError, ReportPagination, type ReportPeriodProps } from './shared';
import { informeAjustes, type InformeAjustes } from '@/services/informes.service';

export default function AdjustmentsReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [data, setData] = useState<InformeAjustes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'salida'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeAjustes({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar ajustes');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter((a) => {
      const matchType =
        typeFilter === 'all' ||
        (typeFilter === 'entrada' ? a.type === 'entrada' : a.type !== 'entrada');
      if (!matchType) return false;
      if (!q) return true;
      return (
        a.code.toLowerCase().includes(q) ||
        a.productName.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q) ||
        a.date.includes(q) ||
        a.type.toLowerCase().includes(q)
      );
    });
  }, [data, search, typeFilter]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportError error="Sin datos" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Total ajustes" value={String(data.total)} trend={`${dateFrom} → ${dateTo}`} icon={<Sliders size={16} className="text-primary" />} />
        <KpiCard label="Entradas" value={String(data.entradas)} trend="Incrementos" icon={<Sliders size={16} className="text-success" />} />
        <KpiCard label="Salidas" value={String(data.salidas)} trend="Disminuciones" trendPositive={false} icon={<Sliders size={16} className="text-danger" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 print:hidden">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-field pl-9 pr-7 py-1.5 text-xs w-full"
            placeholder="Buscar por código, producto o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'entrada' | 'salida')}
          className="input-field py-1.5 px-2.5 text-xs w-40"
        >
          <option value="all">Todos los tipos</option>
          <option value="entrada">Entradas (+)</option>
          <option value="salida">Salidas / Pérdidas (-)</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Anterior</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Nueva</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diferencia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Sin datos en el periodo
                  </td>
                </tr>
              ) : (
                paginated.map((a, idx) => {
                  const diff = a.newQty - a.previousQty;
                  return (
                    <tr key={`${a.code}-${a.sku}-${idx}`} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{a.code}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{a.date}</td>
                      <td className="px-4 py-2.5 text-foreground">{a.productName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell font-mono text-xs whitespace-nowrap">{a.sku}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">{a.previousQty}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">{a.newQty}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={diff >= 0 ? 'badge-success' : 'badge-danger'}>
                          {diff >= 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">{a.reason}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ReportPagination
          totalItems={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="ajustes"
        />
      </div>
    </div>
  );
}
