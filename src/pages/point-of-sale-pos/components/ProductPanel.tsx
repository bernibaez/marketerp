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
  isWeighted?: boolean;
  saleType?: SaleType;
  weightUnit?: WeightUnit;
}

interface ProductPanelProps {
  onAddToCart: (product: Omit<CartItem, 'qty' | 'discount'>, qty?: number) => void;
  onOpenScale?: (productId?: string, weight?: number, product?: any) => void;
  awaitingDelete?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function ProductPanel({
  onAddToCart,
  onOpenScale,
  awaitingDelete = false,
  searchQuery = '',
}: ProductPanelProps) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertComboName, setAlertComboName] = useState('');
  const [missingItems, setMissingItems] = useState<{ productId: string; sku: string; name: string; required: number; available: number }[]>([]);

  const catalogSearch = useMemo(() => {
    const term = searchQuery.trim();
    if (isVariableWeightBarcode(term)) return extractPluFromCode(term);
    return term;
  }, [searchQuery]);

  const { productosUi } = useProductos({ pagina: 1, limite: 500, busqueda: catalogSearch, estado: 'todos' });
  const { combos } = useCombos(true);

  const products: Product[] = useMemo(() => {
    const fromStore = productosUi.map((p): Product => {
      const isWeight =
        p.isWeightProduct ||
        p.saleType === 'weight' ||
        p.saleType === 'both' ||
        p.unit.toLowerCase().includes('lb') ||
        p.unit.toLowerCase().includes('kg');
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
        stock: p.currentStock,
        unit: p.unit,
        tax: p.tax,
        image: p.image,
        lowStock: p.stockStatus === 'low',
        outOfStock: p.stockStatus === 'out',
        isWeighted: isWeight,
        saleType: p.saleType ?? (isWeight ? 'weight' : 'unit'),
        weightUnit: p.weightUnit ?? 'lb',
      };
    });

    if (fromStore.length > 0) {
      return fromStore;
    }

    const demoExtras: Product[] = initialProducts
      .map((ip) => {
        const isWeight =
          ip.isWeightProduct ||
          ip.saleType === 'weight' ||
          ip.saleType === 'both' ||
          ip.unit.toLowerCase().includes('lb') ||
          ip.unit.toLowerCase().includes('kg');
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
          stock: ip.currentStock,
          unit: ip.unit,
          tax: ip.tax,
          image: ip.image,
          lowStock: ip.stockStatus === 'low',
          outOfStock: ip.stockStatus === 'out',
          isWeighted: isWeight,
          saleType: ip.saleType ?? (isWeight ? 'weight' : 'unit'),
          weightUnit: ip.weightUnit ?? 'lb',
        };
      });

    return [...fromStore, ...demoExtras];
  }, [productosUi]);

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

    if (p.outOfStock) {
      toast.error(`Producto agotado: ${p.name}`);
      return;
    }

    if (
      (p.saleType === 'weight' ||
        p.isWeighted ||
        p.unit.toLowerCase() === 'libra' ||
        p.unit.toLowerCase() === 'lb' ||
        p.unit.toLowerCase() === 'kg') &&
      onOpenScale
    ) {
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

    const stockCheck = checkComboStockAvailability(combo, 1, productosUi as any);
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