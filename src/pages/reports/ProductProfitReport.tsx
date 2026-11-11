import React, { useEffect, useMemo, useState } from 'react';
import { Search, Download, FileSpreadsheet, Package, X } from 'lucide-react';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { formatRD, ReportLoading, ReportError, ReportPagination, type ReportPeriodProps } from './shared';
import { informeGananciasProducto, type ProductoGanancia } from '@/services/informes.service';

export default function ProductProfitReport({ dateFrom, dateTo }: ReportPeriodProps) {
  const [items, setItems] = useState<ProductoGanancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    informeGananciasProducto({ desde: dateFrom, hasta: dateTo })
      .then((d) => {
        if (alive) setItems(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Error al cargar ganancias por producto');
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
  }, [search, category, dateFrom, dateTo]);

  const categories = useMemo(() => {
    const set = new Set(items.map((p) => p.category).filter(Boolean));
    return ['all', ...[...set].sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchCat = category === 'all' || p.category === category;
      return matchSearch && matchCat;
    });
  }, [items, search, category]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalSalesAcc = filtered.reduce((s, p) => s + p.totalSales, 0);
  const totalProfitAcc = filtered.reduce((s, p) => s + p.profit, 0);
  const avgMargin = totalSalesAcc > 0 ? ((totalProfitAcc / totalSalesAcc) * 100).toFixed(1) : '0.0';

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Reporte de Ganancias por Producto',
      subtitle: `Periodo: ${dateFrom} — ${dateTo}`,
      filename: `ganancias-por-producto-${dateFrom}-${dateTo}`,
      headers: ['SKU', 'Producto', 'Categoría', 'Cant. Vendida', 'Costo Total', 'Venta Total', 'Ganancia', 'Margen %'],
      rows: filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        `${p.qty % 1 === 0 ? p.qty.toFixed(0) : p.qty.toFixed(2)} ${p.unit || 'uds'}`,
        formatMoneyPdf(p.totalCost),
        formatMoneyPdf(p.totalSales),
        formatMoneyPdf(p.profit),
        `${p.margin.toFixed(1)}%`,
      ]),
      landscape: true,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Reporte de Ganancias por Producto',
      filename: `ganancias-por-producto-${dateFrom}-${dateTo}`,
      headers: ['SKU', 'Producto', 'Categoría', 'Cantidad Vendida', 'Costo Total', 'Venta Total', 'Ganancia Bruta', 'Margen Porcentaje'],
      rows: filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        `${p.qty % 1 === 0 ? p.qty.toFixed(0) : p.qty.toFixed(2)} ${p.unit || 'uds'}`,
        p.totalCost,
        p.totalSales,
        p.profit,
        p.margin,
      ]),
    });
  };

  if (loading) return <ReportLoading />;
  if (error) return <ReportError error={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Productos Evaluados</p>
          <p className="text-xl font-bold text-foreground mt-1">{filtered.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Venta Total Acumulada</p>
          <p className="text-xl font-bold text-info mt-1">{formatRD(totalSalesAcc)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Ganancia Total</p>
          <p className="text-xl font-bold text-success mt-1">{formatRD(totalProfitAcc)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Margen Promedio %</p>
          <p className="text-xl font-bold text-primary mt-1">{avgMargin}%</p>
        </div>
      </div>

      <div className="card p-3 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-8 pr-7 py-1.5 text-xs w-full"
              placeholder="Buscar producto o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

          <select className="input-field py-1.5 px-2.5 text-xs w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={`cat-${c}`} value={c}>
                {c === 'all' ? 'Todas las categorías' : c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5">
          <button type="button" onClick={handleExportPdf} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5">
            <Download size={13} /> PDF
          </button>
          <button type="button" onClick={handleExportExcel} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2.5">
            <FileSpreadsheet size={13} /> Excel
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Producto / SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoría</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cant. Vendida</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Costo Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venta Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ganancia</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Package size={28} className="mx-auto mb-2 opacity-30" />
                    Sin datos en el periodo
                  </td>
                </tr>
              ) : (
                paginated.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/10'}`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{p.sku}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="badge-neutral text-xs">{p.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">
                      {p.qty % 1 === 0 ? p.qty.toFixed(0) : p.qty.toFixed(2)} {p.unit || 'uds'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">{formatRD(p.totalCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground whitespace-nowrap">{formatRD(p.totalSales)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-success whitespace-nowrap">{formatRD(p.profit)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-success-bg text-success font-bold text-xs">
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
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
          itemLabel="productos"
        />
      </div>
    </div>
  );
}
