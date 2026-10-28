import React from 'react';
import { Search, X, ChevronDown, Printer, Trash2 } from 'lucide-react';

interface ProductsToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  filterCategory: string;
  onFilterCategory: (v: string) => void;
  categoriesList?: string[];
  filterStatus: string;
  onFilterStatus: (v: string) => void;
  filterStock: string;
  onFilterStock: (v: string) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  onPrintSelectedLabels?: () => void;
  onAdd?: () => void;
  totalFiltered: number;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
}

const statuses = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'discontinued', label: 'Descontinuado' },
];

const stockStatuses = [
  { value: 'all', label: 'Todo el stock' },
  { value: 'normal', label: 'Stock normal' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'out', label: 'Sin stock' },
];

export default function ProductsToolbar({
  search,
  onSearch,
  filterCategory,
  onFilterCategory,
  categoriesList,
  filterStatus,
  onFilterStatus,
  filterStock,
  onFilterStock,
  selectedCount,
  onBulkDelete,
  onPrintSelectedLabels,
  totalFiltered,
}: ProductsToolbarProps) {
  const availableCategories =
    categoriesList && categoriesList.length > 0
      ? ['all', ...categoriesList.filter((c) => c !== 'all')]
      : ['all'];

  const hasActiveFilters =
    search.trim() !== '' ||
    filterCategory !== 'all' ||
    filterStatus !== 'all' ||
    filterStock !== 'all';

  const handleClearFilters = () => {
    onSearch('');
    onFilterCategory('all');
    onFilterStatus('all');
    onFilterStock('all');
  };

  return (
    <div className="space-y-2">
      {/* Sleek single-line / responsive toolbar */}
      <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU, código..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-8 text-xs bg-secondary/50 hover:bg-secondary/80 focus:bg-background border border-border focus:border-primary rounded-lg transition-all outline-hidden text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters and Counter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => onFilterCategory(e.target.value)}
              className="h-9 pl-3 pr-7 text-xs bg-secondary/50 hover:bg-secondary/80 focus:bg-background border border-border focus:border-primary rounded-lg appearance-none cursor-pointer transition-all text-foreground font-medium outline-hidden"
            >
              {availableCategories.map((cat) => (
                <option key={`cat-${cat}`} value={cat}>
                  {cat === 'all' ? 'Categoría: Todas' : cat}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* Stock Filter */}
          <div className="relative">
            <select
              value={filterStock}
              onChange={(e) => onFilterStock(e.target.value)}
              className="h-9 pl-3 pr-7 text-xs bg-secondary/50 hover:bg-secondary/80 focus:bg-background border border-border focus:border-primary rounded-lg appearance-none cursor-pointer transition-all text-foreground font-medium outline-hidden"
            >
              {stockStatuses.map((s) => (
                <option key={`stock-${s.value}`} value={s.value}>
                  {s.value === 'all' ? 'Stock: Todos' : s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatus(e.target.value)}
              className="h-9 pl-3 pr-7 text-xs bg-secondary/50 hover:bg-secondary/80 focus:bg-background border border-border focus:border-primary rounded-lg appearance-none cursor-pointer transition-all text-foreground font-medium outline-hidden"
            >
              {statuses.map((s) => (
                <option key={`status-${s.value}`} value={s.value}>
                  {s.value === 'all' ? 'Estado: Todos' : s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Restablecer filtros"
            >
              <X size={13} />
              <span>Limpiar</span>
            </button>
          )}

          {/* Counter pill */}
          <div className="hidden lg:flex items-center pl-2 ml-auto border-l border-border text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground font-semibold">{totalFiltered}</strong> productos
            </span>
          </div>
        </div>
      </div>

      {/* Floating / Compact Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              {selectedCount} producto{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onPrintSelectedLabels && (
              <button
                type="button"
                onClick={onPrintSelectedLabels}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <Printer size={13} />
                <span>Imprimir Etiquetas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBulkDelete}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}