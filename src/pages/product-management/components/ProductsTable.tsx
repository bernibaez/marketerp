import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  Eye,
  Printer,
  ToggleLeft,
  ToggleRight,
  MoreHorizontal,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Product } from './ProductManagementScreen';
import CategoryIcon from '@/components/ui/CategoryIcon';
import WeightBadge from '@/components/weight/WeightBadge';

interface ProductsTableProps {
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  sortField: keyof Product;
  sortDir: 'asc' | 'desc';
  onSort: (field: keyof Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onView?: (p: Product) => void;
  onPrintLabel?: (products: Product[]) => void;
  onUpdateProduct?: (product: Product) => void;
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: keyof Product;
  sortField: keyof Product;
  sortDir: 'asc' | 'desc';
}) {
  if (field !== sortField) return <ArrowUpDown size={12} className="text-muted-foreground/40" />;
  return sortDir === 'asc' ? (
    <ArrowUp size={12} className="text-primary" />
  ) : (
    <ArrowDown size={12} className="text-primary" />
  );
}

export default function ProductsTable({
  products,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  sortField,
  sortDir,
  onSort,
  onEdit,
  onDelete,
  onToggleStatus,
  onView,
  onPrintLabel,
}: ProductsTableProps) {
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Reset pagination when product list or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [products.length, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  const formatDate = (d: string | null) => {
    if (!d) return { text: '—', badge: false, color: '' };
    const parts = d.split('-');
    if (parts.length !== 3) return { text: d, badge: false, color: '' };
    const [yr, mo, day] = parts;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const expiry = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(day));
    const today = new Date(2026, 6, 21);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = `${day} ${months[parseInt(mo) - 1]}`;
    if (diffDays <= 0)
      return {
        text: `${formatted} (Vencido)`,
        badge: true,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      };
    if (diffDays <= 7)
      return {
        text: `${formatted} (${diffDays}d)`,
        badge: true,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      };
    if (diffDays <= 30)
      return {
        text: `${formatted} (${diffDays}d)`,
        badge: true,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      };
    return { text: formatted, badge: false, color: '' };
  };

  const handleToggleActions = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openActionsId === id) {
      setOpenActionsId(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(10, rect.right - 180);
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 210;
    let top = rect.bottom + 6;

    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight - 6;
    }

    setMenuPos({ top, left });
    setOpenActionsId(id);
  };

  if (products.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center text-muted-foreground mb-3">
          <Package size={22} />
        </div>
        <p className="text-sm font-semibold text-foreground">No se encontraron productos</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Prueba cambiando el término de búsqueda o seleccionando otra categoría.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
              <th className="px-4 py-3 w-10 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  aria-label="Seleccionar todos"
                />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => onSort('name')}>
                <div className="flex items-center gap-1.5">
                  <span>Producto</span>
                  <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => onSort('category')}>
                <div className="flex items-center gap-1.5">
                  <span>Categoría</span>
                  <SortIcon field="category" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => onSort('salePrice')}>
                <div className="flex items-center gap-1.5 justify-end">
                  <span>Precio</span>
                  <SortIcon field="salePrice" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => onSort('currentStock')}>
                <div className="flex items-center gap-1.5">
                  <span>Stock</span>
                  <SortIcon field="currentStock" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => onSort('status')}>
                <div className="flex items-center gap-1.5 justify-center">
                  <span>Estado</span>
                  <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </div>
              </th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedProducts.map((product) => {
              const isSelected = selectedIds.has(product.id);
              const expiryInfo = formatDate(product.expiryDate);

              return (
                <tr
                  key={product.id}
                  className={`hover:bg-secondary/40 transition-colors ${
                    isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(product.id)}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      aria-label={`Seleccionar ${product.name}`}
                    />
                  </td>

                  {/* Producto / Nombre / SKU */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/70 border border-border flex items-center justify-center text-primary flex-shrink-0">
                        <CategoryIcon category={product.category} name={product.name} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onView && onView(product)}
                            className="font-medium text-xs text-foreground hover:text-primary transition-colors text-left truncate max-w-[280px] cursor-pointer"
                            title={product.name}
                          >
                            {product.name}
                          </button>
                          <WeightBadge
                            saleType={product.saleType}
                            weightUnit={product.weightUnit}
                            isWeighted={product.isWeightProduct}
                            size="sm"
                          />
                          {product.plu && (
                            <span className="px-1.5 py-0.2 rounded bg-secondary text-[10px] text-muted-foreground font-mono">
                              PLU: {product.plu}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{product.sku}</span>
                          {product.brand && product.brand !== 'Genérico' && product.brand !== '—' && (
                            <>
                              <span>•</span>
                              <span>{product.brand}</span>
                            </>
                          )}
                          {expiryInfo.badge && (
                            <>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${expiryInfo.color}`}>
                                <Calendar size={10} />
                                {expiryInfo.text}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="truncate max-w-[150px] inline-block font-medium">
                      {product.category}
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-2.5 text-right">
                    <div className="font-semibold text-xs tabular-nums text-foreground">
                      RD$ {product.salePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      {(product.saleType === 'weight' || product.saleType === 'both') && (
                        <span className="text-[10px] text-primary font-normal ml-0.5">/{product.weightUnit || 'lb'}</span>
                      )}
                    </div>
                    {product.wholesalePrice > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        Mayor: RD$ {product.wholesalePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>

                  {/* Stock (Clean minimal dot status) */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          product.stockStatus === 'out'
                            ? 'bg-rose-500'
                            : product.stockStatus === 'low'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-foreground">
                        {product.stockStatus === 'out'
                          ? 'Agotado'
                          : `${product.currentStock} unids`}
                      </span>
                      {product.stockStatus === 'low' && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          (Bajo)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        product.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : product.status === 'inactive'
                            ? 'bg-secondary text-muted-foreground'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}
                    >
                      {product.status === 'active'
                        ? 'Activo'
                        : product.status === 'inactive'
                          ? 'Inactivo'
                          : 'Descontinuado'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onView && (
                        <button
                          type="button"
                          onClick={() => onView(product)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded-md transition-colors cursor-pointer"
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleToggleActions(product.id, e)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors cursor-pointer"
                        title="Más opciones"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-secondary/15 text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            Mostrando <strong className="text-foreground">{startIndex + 1}</strong>–
            <strong className="text-foreground">
              {Math.min(startIndex + itemsPerPage, products.length)}
            </strong>{' '}
            de <strong className="text-foreground">{products.length}</strong>
          </span>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[11px]">Por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 px-1.5 rounded-md border border-border bg-background text-xs cursor-pointer outline-hidden"
            >
              <option value={10}>10</option>
              <option value={12}>12</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((pageNum, idx, arr) => (
                <React.Fragment key={`page-${pageNum}`}>
                  {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                    <span className="px-1 text-muted-foreground/40">...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      currentPage === pageNum
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
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Action Menu Portal */}
      {openActionsId && menuPos && (() => {
        const product = products.find((p) => p.id === openActionsId);
        if (!product) return null;

        return createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => {
                setOpenActionsId(null);
                setMenuPos(null);
              }}
            />
            <div
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
              className="fixed w-44 rounded-xl bg-card border border-border shadow-xl z-[9999] py-1 text-xs animate-in fade-in zoom-in-95"
            >
              {onView && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionsId(null);
                    setMenuPos(null);
                    onView(product);
                  }}
                  className="w-full text-left px-3 py-1.5 text-foreground hover:bg-secondary flex items-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <Eye size={14} className="text-muted-foreground" />
                  <span>Ver Detalle</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenActionsId(null);
                  setMenuPos(null);
                  onEdit(product);
                }}
                className="w-full text-left px-3 py-1.5 text-foreground hover:bg-secondary flex items-center gap-2 font-medium transition-colors cursor-pointer"
              >
                <Edit size={14} className="text-muted-foreground" />
                <span>Editar Producto</span>
              </button>
              {onPrintLabel && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionsId(null);
                    setMenuPos(null);
                    onPrintLabel([product]);
                  }}
                  className="w-full text-left px-3 py-1.5 text-foreground hover:bg-secondary flex items-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <Printer size={14} className="text-muted-foreground" />
                  <span>Imprimir Etiqueta</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenActionsId(null);
                  setMenuPos(null);
                  onToggleStatus(product.id);
                }}
                className="w-full text-left px-3 py-1.5 text-foreground hover:bg-secondary flex items-center gap-2 font-medium transition-colors cursor-pointer"
              >
                {product.status === 'active' ? (
                  <>
                    <ToggleRight size={14} className="text-amber-500" />
                    <span>Desactivar</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft size={14} className="text-emerald-500" />
                    <span>Activar</span>
                  </>
                )}
              </button>

              <div className="my-1 border-t border-border" />

              <button
                type="button"
                onClick={() => {
                  setOpenActionsId(null);
                  setMenuPos(null);
                  onDelete(product.id);
                }}
                className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 font-medium transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Eliminar</span>
              </button>
            </div>
          </>,
          document.body
        );
      })()}
    </div>
  );
}