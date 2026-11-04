import React, { useState, useMemo } from 'react';
import { Search, Image as ImageIcon, Scale, Boxes } from 'lucide-react';
import type { CartItem } from './POSTerminal';
import { DELETE_SKU } from '@/lib/posStore';
import { checkComboStockAvailability, type Combo } from '@/lib/comboStore';
import ComboStockAlertModal from '@/pages/combos/components/ComboStockAlertModal';
import { toast } from '@/lib/toast';
import { useProductos } from '@/hooks/useProductos';
import { useCombos } from '@/hooks/useCombos';
import { initialProducts } from '@/lib/initialProducts';
import { extractPluFromCode, isVariableWeightBarcode, productMatchesScanCode } from '@/lib/scaleBarcode';
import type { SaleType, WeightUnit } from '@/types/database';

interface Product {
  id: string;
  sku: string;
  barcode: string;
  plu?: string;
  name: string;
  category: string;
  price: number;
  wholesalePrice?: number;
  cost: number;
  stock: number;
  unit: string;
  tax: number;
  image: string;
  lowStock: boolean;
  outOfStock: boolean;
  status?: 'active' | 'inactive' | 'discontinued';
  isWeighted?: boolean;
  saleType?: SaleType;
  weightUnit?: WeightUnit;
  producto_base_id?: string | null;
  factor_conversion?: number;
  unidad_base?: string;
  composite_items?: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
  }>;
}

interface ProductPanelProps {
  onAddToCart: (product: Omit<CartItem, 'qty' | 'discount'>, qty?: number) => void;
  onOpenScale?: (productId?: string, weight?: number, product?: any) => void;
  awaitingDelete?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  catalogProducts?: any[];
}

export default function ProductPanel({
  onAddToCart,
  onOpenScale,
  awaitingDelete = false,
  searchQuery = '',
  catalogProducts,
}: ProductPanelProps) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertComboName, setAlertComboName] = useState('');
  const [missingItems, setMissingItems] = useState<{ productId: string; sku: string; name: string; required: number; available: number }[]>([]);

  const catalogSearch = useMemo(() => {
    const term = searchQuery.trim();
    if (isVariableWeightBarcode(term)) return extractPluFromCode(term);
    return term;
  }, [searchQuery]);

  // Filtrado en memoria ultra rápido (0 ms, 0 egress) cuando se pasa el catálogo compartido
  const localFilteredCatalog = useMemo(() => {
    if (!catalogProducts || catalogProducts.length === 0) return null;
    if (!catalogSearch) return catalogProducts;
    const q = catalogSearch.toLowerCase();
    return catalogProducts.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.plu && p.plu.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [catalogProducts, catalogSearch]);

  const { productosUi: fallbackProductosUi } = useProductos(
    catalogProducts && catalogProducts.length > 0
      ? { pagina: 1, limite: 1 }
      : { pagina: 1, limite: 100, busqueda: catalogSearch, estado: 'activo' }
  );

  const effectiveProductosUi = localFilteredCatalog || fallbackProductosUi;
  const { combos } = useCombos(true);

  const products: Product[] = useMemo(() => {
    const fromStore = effectiveProductosUi
      .filter((p) => p.status === 'active' || p.status === undefined)
      .map((p): Product => {
        const isWeight =
          Boolean(p.isWeightProduct) ||
          Boolean((p as any).es_pesado) ||
          p.saleType === 'weight' ||
          p.saleType === 'both';
        const resolvedUnit = isWeight
          ? (p.unit && !['unidad', 'ud', 'und', 'unidades'].includes(p.unit.toLowerCase()) ? p.unit : (p.weightUnit || 'lb'))
          : (p.unit || 'Und');

        let effectiveStock = Number(p.currentStock ?? 0);
        const pUnitLower = (p.unit || '').toLowerCase();
        const pNameLower = (p.name || '').toLowerCase();
        const isSixPack = pUnitLower.includes('six') || pNameLower.includes('six');

        if (p.producto_base_id) {
          const base = effectiveProductosUi.find((x) => x.id === p.producto_base_id);
          const factor = Number(p.factor_conversion || 1) > 0 ? Number(p.factor_conversion) : (isSixPack ? 6 : 1);
          if (base) {
            const derived = Math.floor(Number(base.currentStock || 0) / factor);
            if (derived > effectiveStock) effectiveStock = derived;
          }
        } else if (Array.isArray(p.composite_items) && p.composite_items.length > 0) {
          const compStocks = p.composite_items.map((ci: any) => {
            const cp = effectiveProductosUi.find((x) => x.id === ci.product_id);
            const q = Math.max(1, Number(ci.quantity || 1));
            return cp ? Math.floor(Number(cp.currentStock || 0) / q) : 0;
          });
          if (compStocks.length > 0) {
            const derived = Math.min(...compStocks);
            if (derived > effectiveStock) effectiveStock = derived;
          }
        } else if (isSixPack && effectiveStock <= 0) {
          const baseName = pNameLower.replace(/six\s*pack/gi, '').replace(/sixpack/gi, '').trim();
          if (baseName.length >= 3) {
            const base = effectiveProductosUi.find(
              (x) => x.id !== p.id && x.name.toLowerCase().includes(baseName) && !x.name.toLowerCase().includes('six')
            );
            if (base && Number(base.currentStock || 0) >= 6) {
              effectiveStock = Math.floor(Number(base.currentStock) / 6);
            }
          }
        }

        const isOutOfStock = effectiveStock <= 0;

        return {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode,
          plu: p.plu,
          name: p.name,
          category: p.category,
          price: p.salePrice,
          wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
          cost: p.costPrice,
          stock: effectiveStock,
          unit: resolvedUnit,
          tax: p.tax,
          image: p.image,
          lowStock: !isOutOfStock && effectiveStock <= (p.minStock ?? 5),
          outOfStock: isOutOfStock,
          status: p.status,
          isWeighted: isWeight,
          saleType: p.saleType ?? (isWeight ? 'weight' : 'unit'),
          weightUnit: p.weightUnit ?? 'lb',
          producto_base_id: p.producto_base_id,
          factor_conversion: p.factor_conversion,
          unidad_base: p.unidad_base,
          composite_items: p.composite_items,
        };
      });

    if (fromStore.length > 0) {
      return fromStore;
    }

    const demoExtras: Product[] = initialProducts
      .filter((ip) => ip.status !== 'inactive' && ip.status !== 'discontinued')
      .map((ip) => {
        const isWeight =
          ip.isWeightProduct ||
          ip.saleType === 'weight' ||
          ip.saleType === 'both' ||
          ip.unit.toLowerCase().includes('lb') ||
          ip.unit.toLowerCase().includes('kg');
        const resolvedUnit = isWeight
          ? (ip.unit && !['unidad', 'ud', 'und', 'unidades'].includes(ip.unit.toLowerCase()) ? ip.unit : (ip.weightUnit || 'lb'))
          : (ip.unit || 'Und');

        let effectiveStock = Number(ip.currentStock ?? 0);
        const pUnitLower = (ip.unit || '').toLowerCase();
        const pNameLower = (ip.name || '').toLowerCase();
        const isSixPack = pUnitLower.includes('six') || pNameLower.includes('six');

        if (ip.producto_base_id) {
          const base = initialProducts.find((x) => x.id === ip.producto_base_id);
          const factor = Number(ip.factor_conversion || 1) > 0 ? Number(ip.factor_conversion) : (isSixPack ? 6 : 1);
          if (base) {
            const derived = Math.floor(Number(base.currentStock || 0) / factor);
            if (derived > effectiveStock) effectiveStock = derived;
          }
        } else if (Array.isArray(ip.composite_items) && ip.composite_items.length > 0) {
          const compStocks = ip.composite_items.map((ci: any) => {
            const cp = initialProducts.find((x) => x.id === ci.product_id);
            const q = Math.max(1, Number(ci.quantity || 1));
            return cp ? Math.floor(Number(cp.currentStock || 0) / q) : 0;
          });
          if (compStocks.length > 0) {
            const derived = Math.min(...compStocks);
            if (derived > effectiveStock) effectiveStock = derived;
          }
        }

        const isOutOfStock = effectiveStock <= 0;

        return {
          id: ip.id,
          sku: ip.sku,
          barcode: ip.barcode,
          plu: ip.plu,
          name: ip.name,
          category: ip.category,
          price: ip.salePrice,
          wholesalePrice: ip.wholesalePrice ? Number(ip.wholesalePrice) : undefined,
          cost: ip.costPrice,
          stock: effectiveStock,
          unit: resolvedUnit,
          tax: ip.tax,
          image: ip.image,
          lowStock: !isOutOfStock && effectiveStock <= (ip.minStock ?? 5),
          outOfStock: isOutOfStock,
          status: ip.status,
          isWeighted: isWeight,
          saleType: ip.saleType ?? (isWeight ? 'weight' : 'unit'),
          weightUnit: ip.weightUnit ?? 'lb',
          producto_base_id: ip.producto_base_id,
          factor_conversion: ip.factor_conversion,
          unidad_base: ip.unidad_base,
          composite_items: ip.composite_items,
        };
      });

    return [...fromStore, ...demoExtras];
  }, [effectiveProductosUi]);

  const allCombos = combos.filter((c) => c.active && c.visibleInPos);

  const filteredProducts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (p.sku === DELETE_SKU) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.plu && p.plu.toLowerCase().includes(term)) ||
        productMatchesScanCode(p, searchQuery.trim())
      );
    });
  }, [products, searchQuery]);

  const handleProductClick = (p: Product) => {
    if (awaitingDelete) {
      onAddToCart({
        id: `cart-${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || '',
        price: p.price,
        cost: p.cost,
        tax: p.tax,
        image: p.image,
        unit: p.unit,
        isWeighted: p.isWeighted,
      });
      return;
    }

    if (p.status === 'inactive' || p.status === 'discontinued') {
      toast.error(`El producto "${p.name}" está inactivo y no se puede vender`);
      return;
    }

    if (p.outOfStock && (p.stock === undefined || p.stock <= 0)) {
      toast.error(`Producto sin existencias: ${p.name}`);
      return;
    }

    if ((p.saleType === 'weight' || p.isWeighted) && onOpenScale) {
      onOpenScale(p.id, 1.0, p);
      return;
    }

    onAddToCart({
      id: `cart-${p.id}-${Date.now()}`,
      productId: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      price: p.price,
      regularPrice: p.price,
      wholesalePrice: p.wholesalePrice,
      isWholesale: false,
      cost: p.cost,
      tax: p.tax,
      image: p.image,
      unit: p.unit,
      isWeighted: false,
      stock: p.stock,
      currentStock: p.stock,
      producto_base_id: p.producto_base_id,
      factor_conversion: p.factor_conversion,
      composite_items: p.composite_items,
    });
  };

  const handleComboClick = (combo: Combo) => {
    if (awaitingDelete) {
      onAddToCart({
        id: `cart-combo-${combo.id}-${Date.now()}`,
        productId: combo.id,
        name: combo.name,
        sku: combo.code,
        barcode: combo.barcode || '',
        price: combo.price,
        cost: Math.round(combo.normalPrice * 0.7),
        tax: combo.applyTax ? 18 : 0,
        image: combo.image || '',
        unit: 'Combo',
        isCombo: true,
        comboId: combo.id,
        comboItems: combo.items,
      });
      return;
    }

    const stockCheck = checkComboStockAvailability(combo, 1, effectiveProductosUi as any);
    if (!stockCheck.available) {
      setAlertComboName(combo.name);
      setMissingItems(stockCheck.missingItems);
      setAlertOpen(true);
      return;
    }

    onAddToCart({
      id: `cart-combo-${combo.id}-${Date.now()}`,
      productId: combo.id,
      name: combo.name,
      sku: combo.code,
      price: combo.price,
      cost: Math.round(combo.normalPrice * 0.7),
      tax: combo.applyTax ? 18 : 0,
      image: combo.image || '',
      unit: 'Combo',
      isCombo: true,
      comboId: combo.id,
      comboItems: combo.items,
    });
    toast.success(`Combo agregado: ${combo.name}`);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-2.5 overflow-hidden">
      {/* 4-Column Product Grid with vertical scrollbar matching reference UI */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {filteredProducts.length === 0 && allCombos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-2 text-slate-400">
            <Search size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {/* Products list rendered as 4-column cards */}
            {filteredProducts.map((p) => {
              const displayCode = p.barcode || p.sku || '';
              const stockText =
                p.stock !== undefined && p.stock !== null
                  ? `${Number(p.stock).toFixed(2)} ${p.unit || 'Und'} en stock`
                  : '--';

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProductClick(p)}
                  disabled={awaitingDelete ? false : p.outOfStock}
                  className={`group flex flex-col items-center justify-between text-center bg-white dark:bg-slate-850 border rounded-xl p-2 transition-all hover:shadow-md cursor-pointer min-h-[110px]
                    ${
                      awaitingDelete
                        ? 'border-rose-300 dark:border-rose-800 hover:border-rose-500 hover:bg-rose-50/20'
                        : p.outOfStock
                          ? 'opacity-45 border-slate-200 cursor-not-allowed'
                          : 'border-slate-200/80 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500'
                    }
                  `}
                >
                  {/* Top Image Placeholder Box with ImageIcon */}
                  <div className="w-full h-12 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center overflow-hidden mb-1 relative">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-contain p-0.5"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon size={20} className="text-slate-300 dark:text-slate-600" />
                    )}

                    {p.isWeighted && (
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                        <Scale size={9} />
                      </div>
                    )}
                  </div>

                  {/* Product Title (truncated) */}
                  <p
                    className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full truncate"
                    title={p.name}
                  >
                    {p.name}
                  </p>

                  {/* SKU/Barcode in parenthesis */}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">
                    {displayCode ? `(${displayCode})` : '--'}
                  </p>

                  {/* Stock label */}
                  <p className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 truncate w-full mt-0.5">
                    {p.outOfStock ? 'Agotado' : stockText}
                  </p>
                </button>
              );
            })}

            {/* Combos list rendered seamlessly */}
            {allCombos.map((c) => (
              <button
                key={`combo-${c.id}`}
                type="button"
                onClick={() => handleComboClick(c)}
                className="group flex flex-col items-center justify-between text-center bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/50 rounded-xl p-2 transition-all hover:shadow-md hover:border-purple-400 cursor-pointer min-h-[110px]"
              >
                <div className="w-full h-12 rounded-lg bg-purple-100/70 dark:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800 flex items-center justify-center mb-1">
                  <Boxes size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full truncate">
                  {c.name}
                </p>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold truncate w-full mt-0.5">
                  ({c.code})
                </p>
                <p className="text-[9.5px] font-bold text-slate-600 dark:text-slate-300 truncate w-full mt-0.5">
                  RD$ {c.price.toLocaleString('es-DO')}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <ComboStockAlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        comboName={alertComboName}
        missingItems={missingItems}
      />
    </div>
  );
}