import React from 'react';
import { createPortal } from 'react-dom';
import {
  PackagePlus,
  ShoppingCart,
  X,
  CheckCircle2,
  Search,
  Plus,
  Loader2,
  Package,
  Minus,
} from 'lucide-react';
import type { ProductItem } from '@/lib/productStore';

interface PurchaseProductModalProps {
  open: boolean;
  onClose: () => void;
  purchaseItemsCount: number;
  lastAddedNotice: string | null;
  onClearNotice: () => void;
  modalTab: 'catalog' | 'new';
  setModalTab: (tab: 'catalog' | 'new') => void;
  modalSearch: string;
  setModalSearch: (v: string) => void;
  debouncedSearch: string;
  setDebouncedSearch: (v: string) => void;
  catalogProducts: ProductItem[];
  catalogTotal: number;
  catalogLoading: boolean;
  loadingMore: boolean;
  catalogPage: number;
  fetchCatalog: (query: string, page?: number, append?: boolean) => Promise<void>;
  selectedProduct: ProductItem | null;
  setSelectedProduct: (p: ProductItem | null) => void;
  modalQty: number;
  setModalQty: React.Dispatch<React.SetStateAction<number>>;
  modalPrice: number;
  setModalPrice: (v: number) => void;
  modalSalePrice: number;
  setModalSalePrice: (v: number) => void;
  modalWholesalePrice: number;
  setModalWholesalePrice: (v: number) => void;
  newName: string;
  setNewName: (v: string) => void;
  newSku: string;
  setNewSku: (v: string) => void;
  newBarcode: string;
  setNewBarcode: (v: string) => void;
  newCategory: string;
  setNewCategory: (v: string) => void;
  newUnit: string;
  setNewUnit: (v: string) => void;
  newTax: number;
  setNewTax: (v: number) => void;
  categories: string[];
  onAddProduct: (closeModal?: boolean) => void;
}

export function PurchaseProductModal({
  open,
  onClose,
  purchaseItemsCount,
  lastAddedNotice,
  onClearNotice,
  modalTab,
  setModalTab,
  modalSearch,
  setModalSearch,
  debouncedSearch,
  setDebouncedSearch,
  catalogProducts,
  catalogTotal,
  catalogLoading,
  loadingMore,
  catalogPage,
  fetchCatalog,
  selectedProduct,
  setSelectedProduct,
  modalQty,
  setModalQty,
  modalPrice,
  setModalPrice,
  modalSalePrice,
  setModalSalePrice,
  modalWholesalePrice,
  setModalWholesalePrice,
  newName,
  setNewName,
  newSku,
  setNewSku,
  newBarcode,
  setNewBarcode,
  newCategory,
  setNewCategory,
  newUnit,
  setNewUnit,
  newTax,
  setNewTax,
  categories,
  onAddProduct,
}: PurchaseProductModalProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-panel my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 bg-primary/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold flex-shrink-0">
              <PackagePlus size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-foreground text-xl">Agregar Productos a la Compra</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Actualiza el costo y precio de venta al registrar la entrada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-sm font-black border border-emerald-500/20">
              <ShoppingCart size={16} />
              <span>{purchaseItemsCount} en orden</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Toast/Notice Banner */}
        {lastAddedNotice && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-3 flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300 font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <span>{lastAddedNotice}</span>
            </div>
            <button
              type="button"
              onClick={onClearNotice}
              className="text-emerald-700 hover:text-emerald-900 font-black p-1 flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin">
          {/* Tabs: Catálogo / Nuevo */}
          <div className="flex gap-1.5 p-1.5 bg-secondary rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setModalTab('catalog');
                setSelectedProduct(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                modalTab === 'catalog'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search size={16} />
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTab('new');
                setSelectedProduct(null);
                setModalSearch('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                modalTab === 'new'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package size={16} />
              Producto nuevo
            </button>
          </div>

          {modalTab === 'catalog' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-muted-foreground">
                    Buscar en base de datos
                  </label>
                  {catalogLoading && (
                    <span className="text-xs text-primary font-semibold flex items-center gap-1.5 animate-pulse">
                      <Loader2 size={13} className="animate-spin" /> Buscando en base de datos…
                    </span>
                  )}
                </div>
                <div className="relative">
                  {catalogLoading ? (
                    <Loader2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                  ) : (
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                  )}
                  <input
                    type="text"
                    placeholder="Escribe el nombre, SKU, código de barras o PLU…"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="input-field !pl-11 !pr-10 h-12 text-base font-medium"
                    autoFocus
                  />
                  {modalSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalSearch('');
                        setDebouncedSearch('');
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-0.5">
                  <span>
                    {debouncedSearch
                      ? `Coincidencias en base de datos para "${debouncedSearch}"`
                      : 'Catálogo de productos (carga optimizada bajo demanda)'}
                  </span>
                  {catalogTotal > 0 && (
                    <span className="font-mono font-bold text-foreground">
                      {catalogProducts.length} de {catalogTotal} productos
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {debouncedSearch ? 'Resultados' : 'Productos'} ({catalogTotal})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalTab('new');
                      if (modalSearch.trim()) setNewName(modalSearch.trim());
                    }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> + Crear producto nuevo
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-secondary/10 scrollbar-thin">
                  {catalogLoading && catalogProducts.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                      <Loader2 size={24} className="animate-spin text-primary mx-auto" />
                      <p className="font-medium">Consultando productos en la base de datos…</p>
                    </div>
                  ) : catalogProducts.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
                      <p className="text-foreground font-semibold">
                        {debouncedSearch
                          ? `No se encontró ningún producto con "${debouncedSearch}"`
                          : 'No hay productos disponibles en la base de datos'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Puedes registrarlo de inmediato para añadirlo a esta compra
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setModalTab('new');
                          if (modalSearch.trim()) setNewName(modalSearch.trim());
                        }}
                        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus size={14} />
                        Crear “{modalSearch.trim() || 'nuevo producto'}”
                      </button>
                    </div>
                  ) : (
                    <>
                      {catalogProducts.map((p) => {
                        const isSelected = selectedProduct?.id === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProduct(p);
                              setModalPrice(p.costPrice || 0);
                              setModalSalePrice(p.salePrice || 0);
                              setModalWholesalePrice(p.wholesalePrice || p.salePrice || 0);
                            }}
                            className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all gap-3 ${
                              isSelected
                                ? 'bg-primary/15 border-l-4 border-primary text-foreground'
                                : 'hover:bg-secondary/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-extrabold truncate">{p.name}</p>
                                {isSelected && (
                                  <span className="text-[10px] font-black uppercase bg-primary text-white px-1.5 py-0.5 rounded">
                                    Seleccionado
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                                SKU: <strong className="text-foreground">{p.sku}</strong>
                                {p.barcode && <span> · Barra: {p.barcode}</span>}
                                <span> · Stock: <strong>{p.currentStock}</strong> {p.unit}</span>
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 space-y-0.5">
                              <p className="text-xs font-black tabular-nums text-foreground">
                                Costo: RD$ {(p.costPrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                                Venta: RD$ {(p.salePrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                                Mayor: RD$ {(p.wholesalePrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {catalogProducts.length < catalogTotal && (
                        <div className="p-3 bg-secondary/30 text-center">
                          <button
                            type="button"
                            onClick={() => fetchCatalog(debouncedSearch, catalogPage + 1, true)}
                            disabled={loadingMore}
                            className="text-xs font-bold text-primary hover:text-primary/80 py-2 px-4 rounded-xl bg-card border border-border shadow-2xs hover:bg-secondary transition flex items-center justify-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Cargando más productos…
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                Cargar más productos ({catalogProducts.length} de {catalogTotal})
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {modalTab === 'new' && (
            <div className="space-y-4 rounded-2xl border border-border bg-secondary/20 p-5">
              <div className="flex items-center gap-2 text-base font-bold text-foreground">
                <Package size={18} className="text-primary" />
                Registrar producto nuevo en catálogo
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                    Nombre <span className="text-danger">*</span>
                  </label>
                  <input
                    className="input-field h-12 text-base"
                    placeholder="Ej. Leche Evaporada 410g"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                    SKU <span className="text-danger">*</span>
                  </label>
                  <input
                    className="input-field h-12 text-base font-mono uppercase"
                    placeholder="Ej. LEC-EVA-410"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-1.5">
                    Código de barras
                  </label>
                  <input
                    className="input-field h-12 text-base font-mono"
                    placeholder="Opcional"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-muted-foreground mb-1.5">Categoría</label>
                  <input
                    className="input-field h-12 text-base"
                    list="purchase-categories"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <datalist id="purchase-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-muted-foreground mb-1.5">Unidad</label>
                    <select
                      className="input-field h-12 text-base cursor-pointer"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                    >
                      {['Unidad', 'Libra', 'Kg', 'Caja', 'Paquete', 'Galón', 'Litro'].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-muted-foreground mb-1.5">ITBIS %</label>
                    <select
                      className="input-field h-12 text-base cursor-pointer"
                      value={newTax}
                      onChange={(e) => setNewTax(Number(e.target.value))}
                    >
                      <option value={0}>0%</option>
                      <option value={16}>16%</option>
                      <option value={18}>18%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cantidad y precios editables */}
          <div className="bg-secondary/30 p-5 rounded-2xl border border-border space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cantidad y precios (editables)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">
                  Cantidad <span className="text-danger">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    className="w-11 h-12 rounded-xl bg-secondary hover:bg-border flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min={0.001}
                    step="0.001"
                    value={modalQty}
                    onChange={(e) => setModalQty(parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="input-field text-lg font-black text-center h-12 flex-1 tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setModalQty((q) => q + 1)}
                    className="w-11 h-12 rounded-xl bg-secondary hover:bg-border flex items-center justify-center font-bold cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2.5">
                  {[1, 5, 10, 24, 50, 100].map((preset) => (
                    <button
                      key={`preset-${preset}`}
                      type="button"
                      onClick={() => setModalQty(preset)}
                      className="flex-1 py-2 text-xs font-bold bg-card border border-border hover:bg-primary/10 hover:text-primary rounded-lg tabular-nums cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">
                  Precio de compra / costo <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    RD$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={modalPrice || ''}
                    onChange={(e) => setModalPrice(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="input-field text-base font-black text-right h-12 tabular-nums pl-14"
                  />
                </div>
                {selectedProduct && (
                  <span className="text-xs text-muted-foreground mt-1.5 block text-right">
                    Catálogo: RD$ {(selectedProduct.costPrice || 0).toLocaleString('es-DO')}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
                  Precio de venta <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600/70">
                    RD$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={modalSalePrice || ''}
                    onChange={(e) => setModalSalePrice(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="input-field text-base font-black text-right h-12 tabular-nums pl-14 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                {selectedProduct && (
                  <span className="text-xs text-muted-foreground mt-1.5 block text-right">
                    Catálogo: RD$ {(selectedProduct.salePrice || 0).toLocaleString('es-DO')}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-amber-600 dark:text-amber-400 mb-1.5">
                  Precio al por mayor <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600/70">
                    RD$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={modalWholesalePrice || ''}
                    onChange={(e) => setModalWholesalePrice(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.00"
                    className="input-field text-base font-black text-right h-12 tabular-nums pl-14 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  />
                </div>
                {selectedProduct && (
                  <span className="text-xs text-muted-foreground mt-1.5 block text-right">
                    Catálogo: RD$ {(selectedProduct.wholesalePrice || 0).toLocaleString('es-DO')}
                  </span>
                )}
              </div>
            </div>

            {modalPrice > 0 && (
              <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-muted-foreground">Sugerir venta por margen:</span>
                  <div className="flex items-center gap-1.5">
                    {[20, 30, 35, 40, 50].map((pct) => (
                      <button
                        key={`margin-${pct}`}
                        type="button"
                        onClick={() => setModalSalePrice(Math.round(modalPrice * (1 + pct / 100)))}
                        className="px-2.5 py-1.5 text-xs font-extrabold bg-secondary hover:bg-emerald-500/15 hover:text-emerald-600 rounded-lg border border-border tabular-nums cursor-pointer"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">
                    Ganancia/und:{' '}
                    <strong
                      className={
                        modalSalePrice - modalPrice >= 0
                          ? 'text-emerald-600'
                          : 'text-danger'
                      }
                    >
                      RD$ {(modalSalePrice - modalPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-sm font-black tabular-nums ${
                      modalSalePrice - modalPrice >= 0
                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                        : 'bg-danger-bg text-danger border border-danger/30'
                    }`}
                  >
                    {modalPrice > 0
                      ? (((modalSalePrice - modalPrice) / modalPrice) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            )}

            {(selectedProduct || (modalTab === 'new' && newName.trim())) && modalPrice > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex justify-between items-center text-sm">
                <span className="font-bold text-foreground">Total línea (cantidad × costo):</span>
                <span className="font-black text-lg text-primary tabular-nums">
                  RD$ {(modalQty * modalPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border flex flex-wrap items-center justify-end gap-3 bg-secondary/20">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-sm px-5 py-3 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Listo / Finalizar</span>
          </button>

          <button
            type="button"
            onClick={() => onAddProduct(false)}
            disabled={
              modalTab === 'catalog'
                ? !selectedProduct
                : !newName.trim() || !newSku.trim() || modalPrice <= 0 || modalSalePrice <= 0
            }
            className="btn-primary text-sm px-5 py-3 font-black flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Plus size={16} />
            {modalTab === 'new' ? 'Crear y añadir a la compra' : 'Añadir y seguir agregando'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
