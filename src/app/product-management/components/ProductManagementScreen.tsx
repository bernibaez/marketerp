'use client';
import React, { useState, useEffect, useCallback } from 'react';
import ProductsHeader from './ProductsHeader';
import ProductsToolbar from './ProductsToolbar';
import ProductFormModal from './ProductFormModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, ToggleLeft, ToggleRight, Printer } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  supplier: string;
  costPrice: number;
  salePrice: number;
  wholesalePrice: number;
  tax: number;
  minStock: number;
  currentStock: number;
  image: string;
  expiryDate: string | null;
  warranty: string;
  status: 'active' | 'inactive' | 'discontinued';
  stockStatus: 'normal' | 'low' | 'out';
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
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

function mapDbProduct(p: any): Product {
  const stock = Number(p.current_stock ?? 0);
  const minStock = Number(p.min_stock ?? 0);
  let stockStatus: Product['stockStatus'] = 'normal';
  if (stock === 0) stockStatus = 'out';
  else if (stock <= minStock) stockStatus = 'low';
  return {
    id: p.id,
    barcode: p.barcode ?? '',
    sku: p.code ?? '',
    name: p.name ?? '',
    category: p.categories?.name ?? '',
    brand: p.brands?.name ?? '',
    unit: p.units?.name ?? '',
    supplier: '',
    costPrice: Number(p.cost_price ?? 0),
    salePrice: Number(p.sale_price ?? 0),
    wholesalePrice: Number(p.sale_price ?? 0),
    tax: 0,
    minStock,
    currentStock: stock,
    image: p.image_url ?? '',
    expiryDate: p.expiry_date ?? null,
    warranty: 'N/A',
    status: p.is_active ? 'active' : 'inactive',
    stockStatus,
  };
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
  return sortDir === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />;
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

export default function ProductManagementScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('products')
        .select('*, categories(name), brands(name), units(name)')
        .order('name');
      if (err) throw err;
      setProducts((data || []).map(mapDbProduct));
    } catch (e: any) {
      setError(e.message || 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products
    .filter((p) => {
      const matchSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.includes(search);
      const matchCat = filterCategory === 'all' || p.category === filterCategory;
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      const matchStock = filterStock === 'all' || p.stockStatus === filterStock;
      return matchSearch && matchCat && matchStatus && matchStock;
    })
    .sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });

  const handleSort = (field: keyof Product) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  const handleSaveProduct = async (product: Product) => {
    const supabase = createClient();
    const isEdit = products.find(p => p.id === product.id);
    const payload = {
      code: product.sku,
      barcode: product.barcode || null,
      name: product.name,
      cost_price: product.costPrice,
      sale_price: product.salePrice,
      min_stock: product.minStock,
      current_stock: product.currentStock,
      is_active: product.status === 'active',
      expiry_date: product.expiryDate || null,
    };
    if (isEdit) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', product.id);
      if (err) { toast.error(err.message); return; }
      toast.success(`Producto "${product.name}" actualizado`);
    } else {
      const { error: err } = await supabase.from('products').insert(payload);
      if (err) { toast.error(err.message); return; }
      toast.success(`Producto "${product.name}" creado`);
    }
    setAddModalOpen(false);
    setEditProduct(null);
    fetchProducts();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const name = products.find(p => p.id === deleteId)?.name;
    const { error: err } = await supabase.from('products').delete().eq('id', deleteId);
    if (err) { toast.error(err.message); setDeleteLoading(false); return; }
    setDeleteId(null);
    setDeleteLoading(false);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteId); return n; });
    toast.success(`Producto "${name}" eliminado`);
    fetchProducts();
  };

  const handleBulkDelete = async () => {
    const supabase = createClient();
    const ids = Array.from(selectedIds);
    const count = ids.length;
    await supabase.from('products').delete().in('id', ids);
    setSelectedIds(new Set());
    toast.success(`${count} productos eliminados`);
    fetchProducts();
  };

  const handleToggleStatus = async (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const supabase = createClient();
    const newActive = p.status !== 'active';
    await supabase.from('products').update({ is_active: newActive }).eq('id', id);
    toast.success(`Producto marcado como ${newActive ? 'activo' : 'inactivo'}`);
    fetchProducts();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return d;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <ProductsHeader onAdd={() => { setEditProduct(null); setAddModalOpen(true); }} totalProducts={0} activeProducts={0} lowStockCount={0} />
        <div className="card p-12 text-center text-muted-foreground">
          <div className="w-10 h-10 rounded-full bg-secondary animate-pulse mx-auto mb-3" />
          <p>Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}
      <ProductsHeader
        onAdd={() => { setEditProduct(null); setAddModalOpen(true); }}
        totalProducts={products.length}
        activeProducts={products.filter(p => p.status === 'active').length}
        lowStockCount={products.filter(p => p.stockStatus === 'low' || p.stockStatus === 'out').length}
      />

      <ProductsToolbar
        search={search}
        onSearch={setSearch}
        filterCategory={filterCategory}
        onFilterCategory={setFilterCategory}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        filterStock={filterStock}
        onFilterStock={setFilterStock}
        selectedCount={selectedIds.size}
        onBulkDelete={handleBulkDelete}
        onAdd={() => { setEditProduct(null); setAddModalOpen(true); }}
        totalFiltered={filtered.length}
      />

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-2xl text-muted-foreground/40">P</span>
            </div>
            <p className="text-base font-semibold text-foreground">No se encontraron productos</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Ajusta los filtros de búsqueda o crea un nuevo producto.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 w-12" />
                  {columns.map(col => (
                    <th
                      key={`th-${col.key}`}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        ${col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}
                      `}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                        {col.label}
                        {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-24 text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product, rowIdx) => {
                  const isSelected = selectedIds.has(product.id);
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
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                          className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      {/* Initial Avatar instead of image */}
                      <td className="px-3 py-2">
                        <InitialAvatar name={product.name} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-foreground truncate max-w-40">{product.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">{product.barcode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-neutral">{product.category || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{product.brand || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums text-sm text-muted-foreground">RD$ {product.costPrice.toLocaleString('es-DO')}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums text-sm font-semibold text-foreground">RD$ {product.salePrice.toLocaleString('es-DO')}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {stockBadge(product.stockStatus, product.currentStock)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatDate(product.expiryDate)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(product.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1 justify-end transition-opacity duration-150 ${hoveredRow === product.id ? 'opacity-100' : 'opacity-0'}`}>
                          <button onClick={() => { setEditProduct(product); setAddModalOpen(true); }} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title={`Editar ${product.name}`}>
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleToggleStatus(product.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                            {product.status === 'active' ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                          </button>
                          <button className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Imprimir etiqueta">
                            <Printer size={14} />
                          </button>
                          <button onClick={() => setDeleteId(product.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors" title={`Eliminar ${product.name}`}>
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
        )}
      </div>

      <ProductFormModal
        open={addModalOpen}
        onClose={() => { setAddModalOpen(false); setEditProduct(null); }}
        product={editProduct}
        onSave={handleSaveProduct}
      />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar Producto"
        description={`¿Estás seguro de que deseas eliminar "${products.find(p => p.id === deleteId)?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar Producto"
        loading={deleteLoading}
      />
    </div>
  );
}