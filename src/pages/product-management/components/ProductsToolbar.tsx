import React, { useState } from 'react';
import { Search, Filter, Trash2, X, ChevronDown, Printer, Download, FileSpreadsheet } from 'lucide-react';

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
  onAdd: () => void;
  totalFiltered: number;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
}

const DEFAULT_CATEGORIES = ['all', 'Abarrotes y Granos', 'Lácteos y Huevos', 'Carnes y Embutidos', 'Bebidas y Refrescos', 'Limpieza y Hogar', 'Panadería y Repostería', 'Frutas y Vegetales', 'Snacks y Golosinas', 'Cuidado Personal'];

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
  search, onSearch, filterCategory, onFilterCategory, categoriesList,
  filterStatus, onFilterStatus, filterStock, onFilterStock,
  selectedCount, onBulkDelete, onPrintSelectedLabels, totalFiltered,
  onExportPdf, onExportExcel,
}: ProductsToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const availableCategories = categoriesList && categoriesList.length > 0
    ? ['all', ...categoriesList.filter((c) => c !== 'all')]
    : DEFAULT_CATEGORIES;

  const activeFilters = [
    filterCategory !== 'all' && filterCategory,
    filterStatus !== 'all' && statuses.find((s) => s.value === filterStatus)?.label,
    filterStock !== 'all' && stockStatuses.find((s) => s.value === filterStock)?.label,
  ].filter(Boolean) as string[];

  return (
    <div className="card p-4 space-y-3">
      {/* Main filter grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Buscar producto</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nombre, SKU, código de barras..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="input-field !pl-9"
            />
            {search && (
              <button onClick={() => onSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Categoría</label>
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => onFilterCategory(e.target.value)}
              className="input-field pr-8 appearance-none"
            >
              {availableCategories.map((cat) => (
                <option key={`cat-filter-${cat}`} value={cat}>
                  {cat === 'all' ? 'Todas las categorías' : cat}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Estado</label>
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatus(e.target.value)}
              className="input-field pr-8 appearance-none"
            >
              {statuses.map((s) => (
                <option key={`status-filter-${s.value}`} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Second row: stock filter + extra filters toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={filterStock}
            onChange={(e) => onFilterStock(e.target.value)}
            className="input-field !h-9 !py-1 pr-8 text-xs appearance-none min-w-36"
          >
            {stockStatuses.map((s) => (
              <option key={`stock-filter-${s.value}`} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <button
          onClick={() => setFiltersOpen((p) => !p)}
          className={`flex items-center gap-2 !h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
            filtersOpen || activeFilters.length > 0
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          <Filter size={13} />
          Filtros avanzados
          {activeFilters.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
              {activeFilters.length}
            </span>
          )}
        </button>

        {activeFilters.length > 0 && (
          <button
            onClick={() => { onFilterCategory('all'); onFilterStatus('all'); onFilterStock('all'); }}
            className="text-xs text-danger hover:underline flex items-center gap-1"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((f) => (
            <span key={`chip-${f}`} className="badge-info flex items-center gap-1">
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: results count + export buttons */}
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground font-medium">
          Mostrando {totalFiltered} producto{totalFiltered !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download size={14} /> PDF
            </button>
          )}
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="btn-secondary flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg slide-up">
          <span className="text-xs font-semibold text-primary">{selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={onPrintSelectedLabels}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors px-2.5 py-1 rounded-lg"
            >
              <Printer size={13} />
              Imprimir etiquetas
            </button>
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-1.5 text-xs font-medium text-danger hover:bg-danger-bg transition-colors px-2 py-1 rounded-lg"
            >
              <Trash2 size={13} />
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}