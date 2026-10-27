import React, { useState } from 'react';
import { Package, Search, RefreshCw, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { ComboItem } from '@/lib/comboStore';
import type { ProductItem } from '@/lib/productStore';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface ComboItemsCardProps {
  items: ComboItem[];
  availableProducts: ProductItem[];
  loadingProducts: boolean;
  productsError: string | null;
  refetchProducts: () => Promise<void>;
  onAddItem: (prod: ProductItem) => void;
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemoveItem: (itemId: string) => void;
  totalCost: number;
  normalPrice: number;
}

export const ComboItemsCard: React.FC<ComboItemsCardProps> = ({
  items,
  availableProducts,
  loadingProducts,
  productsError,
  refetchProducts,
  onAddItem,
  onUpdateQty,
  onRemoveItem,
  totalCost,
  normalPrice,
}) => {
  const [prodSearchTerm, setProdSearchTerm] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState('all');

  const prodCategoriesList = Array.from(
    new Set(availableProducts.map((p) => p.category))
  ).filter(Boolean);

  const filteredAvailableProducts = availableProducts.filter((p) => {
    const matchSearch =
      !prodSearchTerm.trim() ||
      p.name.toLowerCase().includes(prodSearchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(prodSearchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(prodSearchTerm.toLowerCase()) ||
      p.barcode.includes(prodSearchTerm);

    const matchCat = prodCategoryFilter === 'all' || p.category === prodCategoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground">2. Productos del Combo</h3>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg">
          {items.length} Componente{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Interactive Product Search & Quick-Add List */}
      <div className="space-y-3 p-4 bg-secondary/30 rounded-2xl border border-border/60">
        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              placeholder="Buscar producto por nombre (ej. arroz, aceite), SKU o categoría..."
              value={prodSearchTerm}
              onChange={(e) => setProdSearchTerm(e.target.value)}
              className="input-field pl-10 h-10 text-xs font-bold w-full"
            />
          </div>

          <select
            aria-label="Filtrar por categoría"
            value={prodCategoryFilter}
            onChange={(e) => setProdCategoryFilter(e.target.value)}
            className="input-field h-10 text-xs font-bold w-full sm:w-auto"
          >
            <option value="all">Todas las Categorías ({availableProducts.length})</option>
            {prodCategoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Live Matching Products List */}
        <div className="max-h-48 overflow-y-auto scrollbar-thin border border-border/60 rounded-xl divide-y divide-border/60 bg-card">
          {loadingProducts ? (
            <div className="p-4 text-center text-xs text-muted-foreground font-semibold">
              Cargando productos del catálogo…
            </div>
          ) : productsError ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-danger font-semibold">{productsError}</p>
              <button
                type="button"
                onClick={() => void refetchProducts()}
                className="btn-secondary text-xs font-bold inline-flex items-center gap-1"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
            </div>
          ) : filteredAvailableProducts.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
              {availableProducts.length === 0 ? (
                <>
                  <p className="font-semibold">No hay productos en el catálogo.</p>
                  <p>Crea productos en Productos para poder armar combos.</p>
                </>
              ) : (
                <p>
                  No se encontraron productos coincidentes
                  {prodSearchTerm.trim() ? ` con "${prodSearchTerm}"` : ''}.
                </p>
              )}
            </div>
          ) : (
            filteredAvailableProducts.map((p) => {
              const isAdded = items.some((i) => i.productId === p.id);
              return (
                <div key={p.id} className="p-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon category={p.category} name={p.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-xs truncate">{p.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {p.sku} | Costo: RD$ {p.costPrice} | Venta: RD$ {p.salePrice} | Stock: {p.currentStock} {p.unit}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAddItem(p)}
                    disabled={isAdded}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-colors flex-shrink-0 ${
                      isAdded
                        ? 'bg-emerald-500/10 text-emerald-600 cursor-not-allowed border border-emerald-500/20'
                        : 'btn-primary shadow-2xs'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 size={13} /> Agregado
                      </>
                    ) : (
                      <>
                        <Plus size={13} /> Agregar
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="p-8 border-2 border-dashed border-border/70 rounded-xl text-center text-muted-foreground text-xs font-semibold">
          No has agregado productos a este combo todavía. Usa el selector arriba para añadir productos.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground font-black uppercase tracking-wider">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3">Código</th>
                <th className="p-3 text-center">Stock Disp.</th>
                <th className="p-3 text-center">Cantidad</th>
                <th className="p-3 text-right">Costo Unit.</th>
                <th className="p-3 text-right">Venta Unit.</th>
                <th className="p-3 text-right">Subtotal Costo</th>
                <th className="p-3 text-right">Subtotal Venta</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((item) => {
                const prod = availableProducts.find((p) => p.id === item.productId || p.sku === item.sku);
                const currentStock = prod ? prod.currentStock : 0;
                return (
                  <tr key={item.id} className="hover:bg-secondary/20">
                    <td className="p-3 font-extrabold text-foreground">{item.name}</td>
                    <td className="p-3 font-mono text-muted-foreground">{item.sku}</td>
                    <td className="p-3 text-center font-bold">
                      <span className={currentStock < item.quantity ? 'text-danger font-black' : 'text-emerald-600'}>
                        {currentStock}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => onUpdateQty(item.id, parseInt(e.target.value, 10) || 1)}
                        className="w-16 input-field text-center font-bold text-xs p-1"
                      />
                    </td>
                    <td className="p-3 text-right font-semibold text-muted-foreground">RD$ {item.costPrice.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">RD$ {item.unitPrice.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-slate-600 dark:text-slate-300">
                      RD$ {(item.costPrice * item.quantity).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-black text-foreground">
                      RD$ {item.subtotal.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 text-muted-foreground hover:text-danger rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-secondary/40 font-extrabold border-t border-border/80 text-xs">
              <tr>
                <td colSpan={6} className="p-3 text-right uppercase tracking-wider text-muted-foreground">
                  Totales Componentes (Costo vs Venta Normal):
                </td>
                <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">
                  RD$ {totalCost.toFixed(2)}
                </td>
                <td className="p-3 text-right font-black text-foreground">
                  RD$ {normalPrice.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
