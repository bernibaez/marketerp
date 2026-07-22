'use client';
import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, Eye, Printer, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Product } from './ProductManagementScreen';
import StatusBadge from '@/components/ui/StatusBadge';

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
}

const stockBadge = (status: Product['stockStatus'], stock: number) => {
  if (status === 'out') return <span className="badge-danger">Sin Stock</span>;
  if (status === 'low') return <span className="badge-warning">Bajo ({stock})</span>;
  return <span className="badge-success">Normal ({stock})</span>;
};

const statusBadge = (status: Product['status']) => {
  if (status === 'active') return <StatusBadge variant="success" label="Activo" />;
  if (status === 'inactive') return <StatusBadge variant="neutral" label="Inactivo" />;
  return <StatusBadge variant="danger" label="Descontinuado" />;
};

function SortIcon({ field, sortField, sortDir }: { field: keyof Product; sortField: keyof Product; sortDir: 'asc' | 'desc' }) {
  if (field !== sortField) return <ArrowUpDown size={12} className="text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ArrowUp size={12} className="text-primary" />
    : <ArrowDown size={12} className="text-primary" />;
}

const columns: { key: keyof Product; label: string; sortable?: boolean; align?: string }[] = [
  { key: 'name', label: 'Producto', sortable: true },
  { key: 'barcode', label: 'Código', sortable: false },
  { key: 'category', label: 'Categoría', sortable: true },
  { key: 'brand', label: 'Marca', sortable: true },
  { key: 'costPrice', label: 'Costo', sortable: true, align: 'right' },
  { key: 'salePrice', label: 'Precio Venta', sortable: true, align: 'right' },
  { key: 'currentStock', label: 'Stock', sortable: true, align: 'center' },
  { key: 'expiryDate', label: 'Vencimiento', sortable: true },
  { key: 'status', label: 'Estado', sortable: true },
];

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  const colors = [
    'bg-primary/20 text-primary',
    'bg-info/20 text-info',
    'bg-success/20 text-success',
    'bg-warning/20 text-warning',
    'bg-danger/20 text-danger',
  ];
  const colorIdx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${colors[colorIdx]}`}>
      {initials}
    </div>
  );
}

export default function ProductsTable({
  products, selectedIds, onToggleSelect, onSelectAll,
  sortField, sortDir, onSort, onEdit, onDelete, onToggleStatus,
}: ProductsTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    const [yr, mo, day] = parts;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const expiry = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(day));
    const today = new Date(2026, 6, 21);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = `${day} ${months[parseInt(mo) - 1]} ${yr}`;
    if (diffDays <= 0) return { text: formatted, color: 'text-danger font-semibold' };
    if (diffDays <= 7) return { text: `${formatted} (${diffDays}d)`, color: 'text-danger font-semibold' };
    if (diffDays <= 30) return { text: `${formatted} (${diffDays}d)`, color: 'text-warning font-medium' };
    return { text: formatted, color: 'text-muted-foreground' };
  };

  if (products.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Eye size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-foreground">No se encontraron productos</p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Ajusta los filtros de búsqueda o crea un nuevo producto para comenzar a gestionar tu inventario.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              {/* Checkbox */}
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  aria-label="Seleccionar todos los productos"
                />
              </th>
              {/* Image */}
              <th className="px-3 py-3 w-12" />
              {columns.map((col) => (
                <th
                  key={`th-${col.key}`}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    ${col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}
                  `}
                  onClick={col.sortable ? () => onSort(col.key) : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, rowIdx) => {
              const isSelected = selectedIds.has(product.id);
              const dateResult = formatDate(product.expiryDate);
              const dateText = typeof dateResult === 'string' ? dateResult : dateResult.text;
              const dateColor = typeof dateResult === 'string' ? 'text-muted-foreground' : dateResult.color;

              return (
                <tr
                  key={product.id}
                  onMouseEnter={() => setHoveredRow(product.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={`border-b border-border/50 transition-colors
                    ${isSelected ? 'bg-primary/5' : rowIdx % 2 === 0 ? 'bg-card' : 'bg-secondary/10'}
                    ${hoveredRow === product.id ? 'bg-muted/40' : ''}
                  `}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(product.id)}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      aria-label={`Seleccionar ${product.name}`}
                    />
                  </td>

                  {/* Avatar */}
                  <td className="px-3 py-2">
                    <InitialAvatar name={product.name} />
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-foreground truncate max-w-40">{product.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
                    </div>
                  </td>

                  {/* Barcode */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{product.barcode}</span>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="badge-neutral">{product.category}</span>
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{product.brand}</td>

                  {/* Cost */}
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-sm text-muted-foreground">
                      RD$ {product.costPrice.toLocaleString('es-DO')}
                    </span>
                  </td>

                  {/* Sale Price */}
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-sm font-semibold text-foreground">
                      RD$ {product.salePrice.toLocaleString('es-DO')}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-center">
                    {stockBadge(product.stockStatus, product.currentStock)}
                  </td>

                  {/* Expiry */}
                  <td className="px-4 py-3">
                    <span className={`text-xs whitespace-nowrap ${dateColor}`}>{dateText}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {statusBadge(product.status)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div
                      className={`flex items-center gap-1 justify-end transition-opacity duration-150 ${
                        hoveredRow === product.id || actionMenuId === product.id ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <button
                        onClick={() => onEdit(product)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        title={`Editar ${product.name}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => onToggleStatus(product.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        title={product.status === 'active' ? 'Desactivar producto' : 'Activar producto'}
                      >
                        {product.status === 'active'
                          ? <ToggleRight size={14} className="text-success" />
                          : <ToggleLeft size={14} />
                        }
                      </button>
                      <button
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        title="Imprimir etiqueta con código de barras"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(product.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-danger-bg hover:text-danger transition-colors"
                        title={`Eliminar ${product.name} — esta acción no se puede deshacer`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filas por página:</span>
          <select className="input-field h-7 w-16 text-xs py-0">
            {[10, 25, 50, 100].map((n) => (
              <option key={`page-size-${n}`} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            1–{Math.min(10, products.length)} de {products.length}
          </span>
          {[1, 2].map((p) => (
            <button
              key={`page-${p}`}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                p === 1
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}