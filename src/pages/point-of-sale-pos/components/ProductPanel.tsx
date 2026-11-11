import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Search, Image as ImageIcon, Scale, Boxes, Loader2 } from 'lucide-react';
import type { CartItem } from './POSTerminal';
import { checkComboStockAvailability, type Combo } from '@/lib/comboStore';
import ComboStockAlertModal from '@/pages/combos/components/ComboStockAlertModal';
import { toast } from '@/lib/toast';
import { useProductos } from '@/hooks/useProductos';
import { useCombos } from '@/hooks/useCombos';
import { extractPluFromCode, isVariableWeightBarcode } from '@/lib/scaleBarcode';
import {
  buildPosCatalogIndex,
  searchPosCatalog,
  type PosCatalogIndex,
  type PosCatalogProduct,
} from '../utils/posCatalogIndex';
import type { POSSearchStore } from '../utils/posSearchStore';

const GRID_COLS = 4;
const ROW_HEIGHT = 118;
const ROW_GAP = 8;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const OVERSCAN_ROWS = 3;
const DEFAULT_VIEWPORT_HEIGHT = 600;

const NOOP_SUBSCRIBE = () => () => {};
const EMPTY_REMOTE_STATE = { query: '', results: [] as any[] };

interface ProductPanelProps {
  onAddToCart: (product: Omit<CartItem, 'qty' | 'discount'>, qty?: number) => void;
  onOpenScale?: (productId?: string, weight?: number, product?: any) => void;
  awaitingDelete?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  catalogProducts?: any[];
  catalogIndex?: PosCatalogIndex;
  combos?: Combo[];
  searchStore?: POSSearchStore;
  catalogLoading?: boolean;
}

type GridEntry =
  | { kind: 'product'; data: PosCatalogProduct }
  | { kind: 'combo'; data: Combo };

function ProductPanelInner({
  onAddToCart,
  onOpenScale,
  awaitingDelete = false,
  searchQuery: propSearchQuery = '',
  catalogProducts,
  catalogIndex: providedIndex,
  combos: providedCombos,
  searchStore,
  catalogLoading = false,
}: ProductPanelProps) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertComboName, setAlertComboName] = useState('');
  const [missingItems, setMissingItems] = useState<
    { productId: string; sku: string; name: string; required: number; available: number }[]
  >([]);

  const getQuerySnapshot = searchStore ? searchStore.getQuery : () => propSearchQuery;
  const subscribedQuery = useSyncExternalStore(
    searchStore ? searchStore.subscribe : NOOP_SUBSCRIBE,
    getQuerySnapshot,
    getQuerySnapshot
  );
  const getRemoteSnapshot = searchStore ? searchStore.getRemoteState : () => EMPTY_REMOTE_STATE;
  const remoteState = useSyncExternalStore(
    searchStore ? searchStore.subscribe : NOOP_SUBSCRIBE,
    getRemoteSnapshot,
    getRemoteSnapshot
  );
  const effectiveSearchQuery = searchStore ? subscribedQuery : propSearchQuery;
  const deferredSearch = useDeferredValue(effectiveSearchQuery);

  const catalogSearch = useMemo(() => {
    const term = deferredSearch.trim();
    if (isVariableWeightBarcode(term)) return extractPluFromCode(term);
    return term;
  }, [deferredSearch]);

  const shouldFetchStandaloneProducts =
    !providedIndex && catalogProducts === undefined;
  const { productosUi: standaloneProductosUi } = useProductos({
    pagina: 1,
    limite: 100,
    busqueda: catalogSearch,
    estado: 'activo',
    enabled: shouldFetchStandaloneProducts,
  });

  const { combos: standaloneCombos } = useCombos(true, {
    enabled: providedCombos === undefined,
  });
  const combos = providedCombos ?? standaloneCombos;

  const fallbackIndex = useMemo(() => {
    if (providedIndex) return null;
    const source =
      catalogProducts !== undefined ? catalogProducts : standaloneProductosUi;
    const allowDemo = !(catalogLoading && source.length === 0);
    return buildPosCatalogIndex(source, allowDemo);
  }, [providedIndex, catalogProducts, standaloneProductosUi, catalogLoading]);

  const effectiveIndex = providedIndex ?? fallbackIndex!;

  const allCombos = useMemo(
    () => combos.filter((c) => c.active && c.visibleInPos),
    [combos]
  );

  const localFilteredProducts = useMemo(
    () =>
      searchPosCatalog(effectiveIndex, deferredSearch, {
        excludeDeleteSku: true,
        includeCategory: true,
      }),
    [effectiveIndex, deferredSearch]
  );

  const filteredProducts = useMemo(() => {
    if (localFilteredProducts.length > 0) return localFilteredProducts;
    const cleanQ = deferredSearch.trim().toLowerCase();
    if (!cleanQ || remoteState.query !== cleanQ || remoteState.results.length === 0) {
      return localFilteredProducts;
    }
    return buildPosCatalogIndex(remoteState.results, false).panelItems;
  }, [localFilteredProducts, deferredSearch, remoteState]);

  const gridEntries = useMemo<GridEntry[]>(() => {
    const list: GridEntry[] = new Array(filteredProducts.length + allCombos.length);
    for (let i = 0; i < filteredProducts.length; i++) {
      list[i] = { kind: 'product', data: filteredProducts[i] };
    }
    const offset = filteredProducts.length;
    for (let j = 0; j < allCombos.length; j++) {
      list[offset + j] = { kind: 'combo', data: allCombos[j] };
    }
    return list;
  }, [filteredProducts, allCombos]);

  const totalRows = Math.ceil(gridEntries.length / GRID_COLS);
  const totalHeight =
    totalRows > 0 ? totalRows * ROW_HEIGHT + (totalRows - 1) * ROW_GAP : 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [rowWindow, setRowWindow] = useState<{ startRow: number; endRow: number }>(() => ({
    startRow: 0,
    endRow: Math.ceil(DEFAULT_VIEWPORT_HEIGHT / ROW_STRIDE) + OVERSCAN_ROWS * 2,
  }));

  const computeRowWindow = useCallback(
    (scrollTop: number, viewHeight: number, rowsTotal: number) => {
      const effectiveHeight = viewHeight > 0 ? viewHeight : DEFAULT_VIEWPORT_HEIGHT;
      const startRow = Math.max(0, Math.floor(scrollTop / ROW_STRIDE) - OVERSCAN_ROWS);
      const visibleCount = Math.ceil(effectiveHeight / ROW_STRIDE) + OVERSCAN_ROWS * 2;
      const endRow = Math.min(rowsTotal, startRow + visibleCount);
      return { startRow, endRow };
    },
    []
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight > 0 ? el.clientHeight : DEFAULT_VIEWPORT_HEIGHT;
      setViewportHeight((prev) => (prev === h ? prev : h));
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop !== 0) {
      el.scrollTop = 0;
    }
    const next = computeRowWindow(0, viewportHeight, totalRows);
    setRowWindow((prev) =>
      prev.startRow === next.startRow && prev.endRow === next.endRow ? prev : next
    );
  }, [deferredSearch, totalRows, viewportHeight, computeRowWindow]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const next = computeRowWindow(
        e.currentTarget.scrollTop,
        viewportHeight,
        totalRows
      );
      setRowWindow((prev) =>
        prev.startRow === next.startRow && prev.endRow === next.endRow ? prev : next
      );
    },
    [computeRowWindow, viewportHeight, totalRows]
  );

  const visibleStartIdx = rowWindow.startRow * GRID_COLS;
  const visibleEndIdx = Math.min(gridEntries.length, rowWindow.endRow * GRID_COLS);
  const visibleEntries = useMemo(
    () => gridEntries.slice(visibleStartIdx, visibleEndIdx),
    [gridEntries, visibleStartIdx, visibleEndIdx]
  );

  const handleProductClick = useCallback(
    (p: PosCatalogProduct) => {
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
    },
    [awaitingDelete, onAddToCart, onOpenScale]
  );

  const handleComboClick = useCallback(
    (combo: Combo) => {
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

      const stockCheck = checkComboStockAvailability(
        combo,
        1,
        effectiveIndex.items as any
      );
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
    },
    [awaitingDelete, effectiveIndex.items, onAddToCart]
  );

  const isInitialLoading =
    catalogLoading &&
    effectiveIndex.panelItems.length === 0 &&
    allCombos.length === 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-2.5 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pr-1 scrollbar-thin"
      >
        {isInitialLoading ? (
          <div className="flex flex-col items-center justify-center h-56 gap-2 text-slate-400">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-xs font-semibold">Cargando catálogo...</p>
          </div>
        ) : gridEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-2 text-slate-400">
            <Search size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold">No se encontraron productos</p>
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              className="grid grid-cols-4 gap-2"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${rowWindow.startRow * ROW_STRIDE}px)`,
              }}
            >
              {visibleEntries.map((entry) => {
                if (entry.kind === 'combo') {
                  const c = entry.data;
                  return (
                    <button
                      key={`combo-${c.id}`}
                      type="button"
                      onClick={() => handleComboClick(c)}
                      className="group flex flex-col items-center justify-between text-center bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/50 rounded-xl p-2 transition-all hover:shadow-md hover:border-purple-400 cursor-pointer h-[118px]"
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
                  );
                }

                const p = entry.data;
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
                    className={`group flex flex-col items-center justify-between text-center bg-white dark:bg-slate-850 border rounded-xl p-2 transition-all hover:shadow-md cursor-pointer h-[118px]
                      ${awaitingDelete
                        ? 'border-rose-300 dark:border-rose-800 hover:border-rose-500 hover:bg-rose-50/20'
                        : p.outOfStock
                          ? 'opacity-45 border-slate-200 cursor-not-allowed'
                          : 'border-slate-200/80 dark:border-slate-700/70 hover:border-blue-400 dark:hover:border-blue-500'
                      }
                    `}
                  >
                    <div className="w-full h-12 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center overflow-hidden mb-1 relative">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
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

                    <p
                      className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full truncate"
                      title={p.name}
                    >
                      {p.name}
                    </p>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full mt-0.5">
                      {displayCode ? `(${displayCode})` : '--'}
                    </p>

                    <p className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 truncate w-full mt-0.5">
                      {p.outOfStock ? 'Agotado' : stockText}
                    </p>
                  </button>
                );
              })}
            </div>
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

const ProductPanel = memo(ProductPanelInner);
export default ProductPanel;
