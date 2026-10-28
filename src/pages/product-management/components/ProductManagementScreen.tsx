import React, { useState } from 'react';
import ProductsHeader from './ProductsHeader';
import ProductsToolbar from './ProductsToolbar';
import ProductsTable from './ProductsTable';
import ProductFormModal from './ProductFormModal';
import PriceLabelModal from './PriceLabelModal';
import ProductImportModal from './ProductImportModal';
import { Package, ShoppingCart, Scale } from 'lucide-react';
import { toast } from '@/lib/toast';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import { useProductos } from '@/hooks/useProductos';
import {
  actualizarProducto,
  obtenerProductos,
  productoAUi,
  uiAProductoInsert,
  upsertProductoImportacion,
} from '@/services/productos.service';
import { normalizePlu } from '@/lib/scaleBarcode';
import { findExistingImportProduct, isGenericScaleItemCode } from '@/lib/scaleImport';
import type { Product } from '@/lib/initialProducts';
export type { Product };
import { ProductDetailModal } from './ProductDetailModal';
import OperationProgressModal, { type OperationProgressState } from './OperationProgressModal';
import CategoryManagementModal from './CategoryManagementModal';
import BrandManagementModal from './BrandManagementModal';
import { useCategorias } from '@/hooks/useCategorias';

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
  const [operationProgress, setOperationProgress] = useState<OperationProgressState | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const { categorias } = useCategorias();

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
    setImportModalOpen(false);
    const totalCount = productsToImport.length;

    setOperationProgress({
      open: true,
      title: importIsScaleMode
        ? 'Sincronizando Productos con la Balanza'
        : 'Importando Catálogo de Productos',
      subtitle: importIsScaleMode
        ? 'Procesando códigos PLU, precios y pesaje...'
        : 'Validando e importando productos al inventario...',
      current: 0,
      total: totalCount,
      currentItemName: 'Consultando catálogo existente...',
      variant: 'emerald',
      iconType: importIsScaleMode ? 'scale' : 'sync',
      stats: {
        successLabel: 'Nuevos',
        successCount: 0,
        warningLabel: 'Actualizados',
        warningCount: 0,
      },
      isFinished: false,
    });

    try {
      const catalogRes = await obtenerProductos({ pagina: 1, limite: 5000, estado: 'todos' });
      const catalog = catalogRes.datos.map(productoAUi);
      let created = 0;
      let updated = 0;
      let processed = 0;

      for (const item of productsToImport) {
        processed += 1;
        setOperationProgress((prev) =>
          prev
            ? {
                ...prev,
                current: processed,
                currentItemName: `${item.name} ${item.plu ? `(PLU ${item.plu})` : ''}`,
                stats: {
                  ...prev.stats,
                  successCount: created,
                  warningCount: updated,
                },
              }
            : null
        );

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

        setOperationProgress((prev) =>
          prev
            ? {
                ...prev,
                current: processed,
                stats: {
                  ...prev.stats,
                  successCount: created,
                  warningCount: updated,
                },
              }
            : null
        );
      }

      await refetch();

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              current: totalCount,
              isFinished: true,
              subtitle: `Sincronización finalizada: ${created} nuevo(s) y ${updated} actualizado(s).`,
              currentItemName: '¡Todos los productos fueron procesados con éxito!',
              stats: {
                ...prev.stats,
                successCount: created,
                warningCount: updated,
              },
              onClose: () => setOperationProgress(null),
            }
          : null
      );

      toast.success(
        `Balanza sincronizada: ${created} producto(s) nuevo(s) y ${updated} actualizado(s).`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar productos');
      setOperationProgress(null);
    }
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
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const totalCount = ids.length;

    setOperationProgress({
      open: true,
      title: 'Eliminando Productos Seleccionados',
      subtitle: 'Comprobando dependencias históricas y eliminando registros...',
      current: 0,
      total: totalCount,
      currentItemName: 'Iniciando proceso...',
      variant: 'rose',
      iconType: 'trash',
      stats: {
        successLabel: 'Eliminados',
        successCount: 0,
        warningLabel: 'Protegidos (ventas)',
        warningCount: 0,
      },
      isFinished: false,
    });

    let deletedCount = 0;
    let conflictCount = 0;
    let processed = 0;

    for (const id of ids) {
      processed += 1;
      const targetProduct = products.find((p) => p.id === id);
      const name = targetProduct?.name || id;

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              current: processed,
              currentItemName: `Eliminando: ${name}`,
              stats: {
                ...prev.stats,
                successCount: deletedCount,
                warningCount: conflictCount,
              },
            }
          : null
      );

      try {
        await eliminar(id);
        deletedCount++;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch {
        conflictCount++;
      }

      setOperationProgress((prev) =>
        prev
          ? {
              ...prev,
              current: processed,
              stats: {
                ...prev.stats,
                successCount: deletedCount,
                warningCount: conflictCount,
              },
            }
          : null
      );
    }

    await refetch();

    setOperationProgress((prev) =>
      prev
        ? {
            ...prev,
            current: totalCount,
            isFinished: true,
            subtitle:
              conflictCount > 0
                ? `${deletedCount} eliminados exitosamente, ${conflictCount} protegidos por tener ventas registradas.`
                : `${deletedCount} productos eliminados exitosamente.`,
            currentItemName: 'Proceso de eliminación finalizado.',
            onClose: () => setOperationProgress(null),
          }
        : null
    );

    if (deletedCount > 0) {
      toast.success(`${deletedCount} producto(s) eliminado(s) exitosamente`);
    }
    if (conflictCount > 0) {
      toast.warning(
        `${conflictCount} producto(s) no se pudieron borrar por tener ventas asociadas. Márcalos como inactivos.`
      );
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
        onManageCategories={() => setCategoryModalOpen(true)}
        onManageBrands={() => setBrandModalOpen(true)}
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
        categoriesList={categorias.map((c) => c.nombre)}
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

      <ProductDetailModal
        product={viewingProduct}
        onClose={() => setViewingProduct(null)}
        onEdit={(prod) => {
          setViewingProduct(null);
          setEditProduct(prod);
          setAddModalOpen(true);
        }}
        onPrintLabel={(prod) => {
          setViewingProduct(null);
          setLabelModalProducts([prod]);
        }}
      />

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

      {operationProgress && (
        <OperationProgressModal
          {...operationProgress}
          onClose={() => setOperationProgress(null)}
        />
      )}

      {categoryModalOpen && (
        <CategoryManagementModal
          open={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
        />
      )}

      {brandModalOpen && (
        <BrandManagementModal
          open={brandModalOpen}
          onClose={() => setBrandModalOpen(false)}
        />
      )}
    </div>
  );
}