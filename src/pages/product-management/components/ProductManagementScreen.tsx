import React, { useState } from 'react';
import ProductsHeader from './ProductsHeader';
import ProductsToolbar from './ProductsToolbar';
import ProductsTable from './ProductsTable';
import ProductFormModal from './ProductFormModal';
import PriceLabelModal from './PriceLabelModal';
import ProductImportModal from './ProductImportModal';
import ModalShell from '@/components/ui/ModalShell';
import { X, Package, Scale, ShoppingCart, Edit, Printer, Calendar, CheckCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import { useProductos } from '@/hooks/useProductos';
import {
  actualizarProducto,
  crearProducto,
  obtenerProductos,
  productoAUi,
  uiAProductoInsert,
  upsertProductoImportacion,
} from '@/services/productos.service';
import { normalizePlu } from '@/lib/scaleBarcode';
import { findExistingImportProduct, isGenericScaleItemCode } from '@/lib/scaleImport';

import type { SaleType, WeightUnit } from '@/types/database';

export { initialProducts, type Product } from '@/lib/initialProducts';
import type { Product } from '@/lib/initialProducts';


export default function ProductManagementScreen() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [productTypeTab, setProductTypeTab] = useState<'all' | 'normal' | 'balanza'>('all');
  const [isNewScaleProductMode, setIsNewScaleProductMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importIsScaleMode, setImportIsScaleMode] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [labelModalProducts, setLabelModalProducts] = useState<Product[] | null>(null);

  const estadoDb =
    filterStatus === 'active'
      ? ('activo' as const)
      : filterStatus === 'inactive'
        ? ('inactivo' as const)
        : filterStatus === 'discontinued'
          ? ('descontinuado' as const)
          : ('todos' as const);

  const { productosUi, crear, actualizar, eliminar, refetch } = useProductos({
    pagina: 1,
    limite: 2000,
    busqueda: search,
    categoria: filterCategory === 'all' ? undefined : filterCategory,
    estado: estadoDb,
  });

  const products = productosUi;

  const isVariableWeight = (p: Product) =>
    Boolean(p.isWeightProduct || p.saleType === 'weight' || p.saleType === 'both');

  const normalCount = products.filter((p) => !isVariableWeight(p)).length;

  const scaleCount = products.filter((p) => isVariableWeight(p)).length;

  const filtered = products
    .filter((p) => {
      const isScale = isVariableWeight(p);
      if (productTypeTab === 'normal') return !isScale;
      if (productTypeTab === 'balanza') return isScale;
      return true;
    })
    .filter((p) => filterStock === 'all' || p.stockStatus === filterStock)
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
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleSaveProduct = async (product: Product) => {
    try {
      const existsRemote = products.some((p) => p.id === product.id);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        product.id
      );
      if (existsRemote && isUuid) {
        await actualizar(product.id, product);
        toast.success(`Producto "${product.name}" actualizado correctamente`);
      } else {
        const { id: _localId, ...rest } = product;
        await crear(rest);
        toast.success(`Producto "${product.name}" creado correctamente`);
      }
      setAddModalOpen(false);
      setEditProduct(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar producto');
    }
  };

  const handleBatchImport = async (productsToImport: Product[]) => {
    const catalogRes = await obtenerProductos({ pagina: 1, limite: 5000, estado: 'todos' });
    const catalog = catalogRes.datos.map(productoAUi);
    let created = 0;
    let updated = 0;

    for (const item of productsToImport) {
      const plu = normalizePlu(item.plu || '');
      const existing = findExistingImportProduct(catalog, {
        id: item.id,
        plu,
        barcode: item.barcode,
        sku: item.sku,
      });

      const payload = existing
        ? uiAProductoInsert({
          ...existing,
          name: item.name,
          salePrice: item.salePrice,
          wholesalePrice: item.wholesalePrice || item.salePrice,
          costPrice: item.costPrice > 0 ? item.costPrice : existing.costPrice,
          pricePerWeight: item.salePrice,
          plu: plu || existing.plu,
          barcode: isGenericScaleItemCode(existing.barcode)
            ? item.barcode || existing.barcode
            : existing.barcode || item.barcode,
          sku: isGenericScaleItemCode(existing.sku)
            ? item.sku || existing.sku
            : existing.sku || item.sku,
          isWeightProduct: true,
          saleType: existing.saleType === 'both' ? 'both' : 'weight',
          generateScaleBarcode: true,
          unit: existing.unit && existing.unit !== 'Unidad' ? existing.unit : 'Libra',
          weightUnit: existing.weightUnit || 'lb',
          currentStock: existing.currentStock,
          minStock: existing.minStock,
          status: existing.status,
          category: existing.category || item.category,
          brand: existing.brand || item.brand,
        })
        : (() => {
          const { id: _localId, ...rest } = item;
          return uiAProductoInsert(rest);
        })();

      const result = existing
        ? { data: await actualizarProducto(existing.id, payload), created: false }
        : await upsertProductoImportacion(payload);

      if (result.created) {
        created += 1;
        catalog.push(productoAUi(result.data));
      } else {
        updated += 1;
        const idx = catalog.findIndex((p) => p.id === result.data.id);
        if (idx >= 0) catalog[idx] = productoAUi(result.data);
        else catalog.push(productoAUi(result.data));
      }
    }

    await refetch();
    toast.success(
      `Balanza sincronizada: ${created} producto(s) nuevo(s) y ${updated} actualizado(s). El stock no se modificó.`
    );
  };

  const handleDelete = async (id: string) => {
    if (deleteBusyId) return;
    setDeleteBusyId(id);
    try {
      const name = products.find((p) => p.id === id)?.name;
      await eliminar(id);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success(`Producto "${name}" eliminado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      await Promise.all([...selectedIds].map((id) => eliminar(id)));
      setSelectedIds(new Set());
      toast.success(`${count} productos eliminados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
      await refetch();
    }
  };

  const handleToggleStatus = async (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const newStatus = p.status === 'active' ? 'inactive' : 'active';
    try {
      await actualizar(id, { ...p, status: newStatus });
      toast.success(`Producto marcado como ${newStatus === 'active' ? 'activo' : 'inactivo'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar estado');
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Catálogo de Productos',
      filename: 'productos',
      headers: ['SKU', 'Nombre', 'Categoría', 'Marca', 'Stock', 'Costo', 'Precio', 'Estado'],
      rows: filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.brand,
        p.currentStock,
        formatMoneyPdf(p.costPrice),
        formatMoneyPdf(p.salePrice),
        p.status === 'active' ? 'Activo' : p.status === 'inactive' ? 'Inactivo' : 'Descontinuado',
      ]),
      landscape: true,
    });
  };

  if (addModalOpen) {
    return (
      <>
        <ProductFormModal
          open={addModalOpen}
          onClose={() => {
            setAddModalOpen(false);
            setEditProduct(null);
            setIsNewScaleProductMode(false);
          }}
          product={editProduct}
          allProducts={products}
          defaultIsScaleProduct={isNewScaleProductMode || productTypeTab === 'balanza'}
          onSave={handleSaveProduct}
          onPrintLabel={(p) => setLabelModalProducts([p])}
        />
        {labelModalProducts && (
          <PriceLabelModal
            products={labelModalProducts}
            onClose={() => setLabelModalProducts(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
          <ProductsHeader
            onAdd={() => {
              setEditProduct(null);
              setIsNewScaleProductMode(productTypeTab === 'balanza');
              setAddModalOpen(true);
            }}
            onExport={handleExportPdf}
            onImport={() => {
              setImportIsScaleMode(true);
              setImportModalOpen(true);
            }}
            totalProducts={products.length}
            activeProducts={products.filter((p) => p.status === 'active').length}
            lowStockCount={products.filter((p) => p.stockStatus === 'low' || p.stockStatus === 'out').length}
          />

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 hover:border-primary/40 transition-all">
              <p className="text-xs text-muted-foreground font-medium">Productos en Catálogo</p>
              <p className="text-2xl font-bold text-foreground mt-1">{products.length} productos</p>
            </div>
            <div className="card p-4 hover:border-emerald-500/40 transition-all">
              <p className="text-xs text-muted-foreground font-medium">Productos Activos</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {products.filter((p) => p.status === 'active').length}
              </p>
            </div>
            <div className="card p-4 hover:border-amber-500/40 transition-all">
              <p className="text-xs text-muted-foreground font-medium">Con Stock Bajo / Agotado</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {products.filter((p) => p.stockStatus === 'low' || p.stockStatus === 'out').length}
              </p>
            </div>
            <div className="card p-4 hover:border-blue-500/40 transition-all">
              <p className="text-xs text-muted-foreground font-medium">Valor en Inventario</p>
              <p className="text-2xl font-bold text-info mt-1">
                RD$ {products.reduce((s, p) => s + p.costPrice * p.currentStock, 0).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Sección de pestañas de productos: Normales vs Balanza */}
          <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setProductTypeTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition-all border-b-2 ${productTypeTab === 'all'
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
            >
              <Package size={16} />
              <span>Todos los Productos</span>
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold">
                {products.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductTypeTab('normal')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition-all border-b-2 ${productTypeTab === 'normal'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
            >
              <ShoppingCart size={16} />
              <span>Productos Estándar (Unidades)</span>
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold">
                {normalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductTypeTab('balanza')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs transition-all border-b-2 ${productTypeTab === 'balanza'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
            >
              <Scale size={16} />
              <span>Productos de Balanza (mscale / PLU)</span>
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold">
                {scaleCount}
              </span>
            </button>
          </div>


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
            onPrintSelectedLabels={() => {
              const selected = products.filter((p) => selectedIds.has(p.id));
              if (selected.length > 0) setLabelModalProducts(selected);
            }}
            onAdd={() => {
              setEditProduct(null);
              setIsNewScaleProductMode(productTypeTab === 'balanza');
              setAddModalOpen(true);
            }}
            totalFiltered={filtered.length}
            onExportPdf={handleExportPdf}
          />

          <ProductsTable
            products={filtered}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onView={(p) => setViewingProduct(p)}
            onEdit={(p) => { setEditProduct(p); setAddModalOpen(true); }}
            onDelete={(id) => handleDelete(id)}
            onToggleStatus={handleToggleStatus}
            onPrintLabel={(prods) => setLabelModalProducts(prods)}
            onUpdateProduct={async (p) => {
              try {
                await actualizar(p.id, p);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error al actualizar');
                await refetch();
              }
            }}
          />

      <ModalShell
        open={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        size="lg"
        className="p-6 max-h-[90vh] overflow-y-auto"
      >
        {viewingProduct && (() => {
          const marginVal = viewingProduct.salePrice - viewingProduct.costPrice;
          const marginPct = viewingProduct.salePrice > 0 ? ((marginVal / viewingProduct.salePrice) * 100).toFixed(1) : '0';

          const getExpiryTag = (d: string | null) => {
            if (!d) return { text: 'Sin fecha asignada', badge: false, color: 'text-slate-400' };
            const parts = d.split('-');
            if (parts.length !== 3) return { text: d, badge: false, color: 'text-slate-600' };
            const [yr, mo, day] = parts;
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const expiry = new Date(parseInt(yr), parseInt(mo) - 1, parseInt(day));
            const today = new Date();
            const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const formatted = `${day} ${months[parseInt(mo) - 1]} ${yr}`;
            if (diffDays < 0) {
              return { text: `${formatted} (Vencido hace ${Math.abs(diffDays)}d)`, badge: true, color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' };
            }
            if (diffDays <= 7) {
              return { text: `${formatted} (Vence en ${diffDays}d)`, badge: true, color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' };
            }
            if (diffDays <= 30) {
              return { text: `${formatted} (Vence en ${diffDays}d)`, badge: true, color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' };
            }
            return { text: formatted, badge: false, color: 'text-slate-700 dark:text-slate-300' };
          };

          const expiryTag = getExpiryTag(viewingProduct.expiryDate);

          return (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                    <Package size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      Vista Previa del Producto
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Especificaciones completas y datos técnicos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Main Product Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                      {viewingProduct.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {viewingProduct.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-mono text-xs text-slate-500 font-semibold">SKU: {viewingProduct.sku}</span>
                      {viewingProduct.brand && viewingProduct.brand !== 'Genérico' && viewingProduct.brand !== '—' && (
                        <span className="text-xs text-slate-500 font-medium">• Marca: {viewingProduct.brand}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${viewingProduct.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}>
                      {viewingProduct.status === 'active' ? <CheckCircle size={13} /> : <X size={13} />}
                      <span className="capitalize">{viewingProduct.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                    </span>

                    {(viewingProduct.isWeightProduct || viewingProduct.saleType === 'weight' || viewingProduct.saleType === 'both') && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <Scale size={13} />
                        <span>Balanza ({viewingProduct.weightUnit || 'lb'})</span>
                      </span>
                    )}

                    {viewingProduct.plu && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                        PLU {viewingProduct.plu}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sección 1: Precios y Rentabilidad */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Precios y Rentabilidad
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Precio Venta</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                        RD$ {viewingProduct.salePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Precio Costo</span>
                      <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        RD$ {viewingProduct.costPrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Margen Bruto</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {marginPct}% (RD$ {marginVal.toFixed(2)})
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Al por Mayor</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {viewingProduct.wholesalePrice > 0
                          ? `RD$ ${viewingProduct.wholesalePrice.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sección 2: Inventario y Control */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Inventario y Control
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Stock Actual</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {viewingProduct.currentStock} {viewingProduct.unit || 'unidades'}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Stock Mínimo</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        {viewingProduct.minStock} {viewingProduct.unit || 'unidades'}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Vencimiento</span>
                      {expiryTag.badge ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border text-xs ${expiryTag.color}`}>
                          <Calendar size={12} />
                          {expiryTag.text}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium ${expiryTag.color}`}>{expiryTag.text}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sección 3: Códigos y Clasificación */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Identificación & Códigos
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Código de Barras</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 inline-block text-[11px]">
                        {viewingProduct.barcode || 'Sin Código'}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">PLU Balanza</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {viewingProduct.plu || '—'}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10.5px] text-slate-400 font-bold block uppercase mb-0.5">Proveedor</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {viewingProduct.supplier || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="btn-secondary text-xs font-semibold px-4 py-2 cursor-pointer"
                  onClick={() => setViewingProduct(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = viewingProduct;
                    setViewingProduct(null);
                    setLabelModalProducts([prod]);
                  }}
                  className="btn-secondary text-xs font-semibold px-4 py-2 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} className="text-purple-600" />
                  <span>Imprimir Etiqueta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const prod = viewingProduct;
                    setViewingProduct(null);
                    setEditProduct(prod);
                    setAddModalOpen(true);
                  }}
                  className="btn-primary text-xs font-bold px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit size={14} />
                  <span>Editar Producto</span>
                </button>
              </div>
            </>
          );
        })()}
      </ModalShell>

      {importModalOpen && (
        <ProductImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          existingProducts={products}
          onImport={handleBatchImport}
          defaultIsScaleMode={importIsScaleMode}
        />
      )}

      {labelModalProducts && (
        <PriceLabelModal
          products={labelModalProducts}
          onClose={() => setLabelModalProducts(null)}
        />
      )}
    </div>
  );
}