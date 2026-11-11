import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { DELETE_SKU } from '@/lib/posStore';
import { parseScaleBarcode } from '../utils/scaleUtils';
import {
  decodeVariableWeightBarcode,
  isVariableWeightBarcode,
} from '@/lib/scaleBarcode';
import { buscarProductoPorCodigoEscaneado, productoAUi } from '@/services/productos.service';
import { checkComboStockAvailability } from '@/lib/comboStore';
import {
  buildPosCatalogIndex,
  findExactScanProduct,
  type PosCatalogIndex,
  type PosCatalogProduct,
} from '../utils/posCatalogIndex';
import type { POSSearchStore } from '../utils/posSearchStore';
import type { CartItem } from '../components/POSTerminal';
import { posPerfNow, recordCodeSearch } from '@/lib/posPerfMetrics';

function selectPosBarcodeInput() {
  const el = document.getElementById('pos-barcode-search-input') as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  if (el.value.length > 0) {
    el.select();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      // Ignorar si el navegador no soporta setSelectionRange
    }
  }
}

function focusPosBarcodeInput() {
  const el = document.getElementById('pos-barcode-search-input') as HTMLInputElement | null;
  if (!el) return;
  el.focus();
}

interface UsePOSScannerProps {
  enabled?: boolean;
  cart: CartItem[];
  addToCart: (item: any, qty?: number) => void;
  isWholesaleMode?: boolean;
  deductOrRemoveFromCart: (item: {
    productId: string;
    sku?: string;
    barcode?: string;
    name: string;
  }) => void;
  awaitingDeleteScan: boolean;
  toggleDeleteMode: () => void;
  handleCancelDeleteMode: () => void;
  productosUi: any[];
  catalogIndex?: PosCatalogIndex;
  searchStore?: POSSearchStore;
  combos: any[];
  orderCompleted: boolean;
  paymentOpen: boolean;
  setPaymentOpen: (open: boolean) => void;
  openPayment: (method?: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => void;
  closePayment?: () => void;
  onOpenScale?: (productId?: string, weight?: number, product?: any) => void;
  clearCart: () => void;
}

function findSingleTextMatch(
  items: PosCatalogProduct[],
  qLower: string
): { matched?: PosCatalogProduct; ambiguousCount: number; kind: 'exact' | 'prefix' | 'partial' | null } {
  const exactNameMatches: PosCatalogProduct[] = [];
  const prefixMatches: PosCatalogProduct[] = [];
  const partialMatches: PosCatalogProduct[] = [];

  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const nameTrimLower = p.nameLower.trim();
    if (nameTrimLower === qLower) {
      exactNameMatches.push(p);
      continue;
    }
    if (p.nameLower.startsWith(qLower)) {
      prefixMatches.push(p);
      continue;
    }
    if (
      p.nameLower.includes(qLower) ||
      (p.barcodeLower && p.barcodeLower.includes(qLower)) ||
      (p.skuLower && p.skuLower.includes(qLower)) ||
      (p.pluLower && p.pluLower.includes(qLower))
    ) {
      partialMatches.push(p);
    }
  }

  if (exactNameMatches.length === 1) return { matched: exactNameMatches[0], ambiguousCount: 0, kind: 'exact' };
  if (exactNameMatches.length > 1) return { ambiguousCount: exactNameMatches.length, kind: 'exact' };

  if (prefixMatches.length === 1) return { matched: prefixMatches[0], ambiguousCount: 0, kind: 'prefix' };
  if (prefixMatches.length > 1) return { ambiguousCount: prefixMatches.length, kind: 'prefix' };

  if (partialMatches.length === 1) return { matched: partialMatches[0], ambiguousCount: 0, kind: 'partial' };
  if (partialMatches.length > 1) return { ambiguousCount: partialMatches.length, kind: 'partial' };

  return { ambiguousCount: 0, kind: null };
}

export function usePOSScanner({
  enabled = true,
  cart,
  addToCart,
  isWholesaleMode = false,
  deductOrRemoveFromCart,
  awaitingDeleteScan,
  toggleDeleteMode,
  handleCancelDeleteMode,
  productosUi,
  catalogIndex: providedCatalogIndex,
  searchStore,
  combos,
  orderCompleted,
  paymentOpen,
  setPaymentOpen,
  openPayment,
  closePayment,
  onOpenScale,
  clearCart,
}: UsePOSScannerProps) {
  const [fallbackSearchQuery, setFallbackSearchQuery] = useState('');

  const setSearchQuery = useCallback(
    (next: string) => {
      if (searchStore) {
        searchStore.setQuery(next);
      } else {
        setFallbackSearchQuery(next);
      }
    },
    [searchStore]
  );

  const fallbackIndex = useMemo(
    () => (providedCatalogIndex ? null : buildPosCatalogIndex(productosUi)),
    [providedCatalogIndex, productosUi]
  );
  const catalogIndex = providedCatalogIndex ?? fallbackIndex!;
  const realScaleCatalog = catalogIndex.scaleCatalog;

  const handleSearchSubmit = useCallback(
    async (rawQuery: string): Promise<boolean> => {
      const q = rawQuery.trim();
      if (!q) return false;

      const keepCodeSelected = () => {
        setSearchQuery(q);
        requestAnimationFrame(() => selectPosBarcodeInput());
        return false;
      };

      const qUpper = q.toUpperCase();
      if (qUpper === DELETE_SKU || qUpper === 'ELIMINAR' || qUpper === 'QUITAR') {
        toggleDeleteMode();
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      }

      const qLower = q.toLowerCase();

      // Modo quitar / restar
      if (awaitingDeleteScan) {
        const directCartItem = cart.find(
          (item) =>
            (item.barcode && item.barcode.toLowerCase() === qLower) ||
            (item.sku && item.sku.toLowerCase() === qLower) ||
            item.productId === q ||
            item.name.toLowerCase() === qLower
        );

        if (directCartItem) {
          deductOrRemoveFromCart({
            productId: directCartItem.productId,
            sku: directCartItem.sku,
            barcode: directCartItem.barcode,
            name: directCartItem.name,
          });
          setSearchQuery('');
          focusPosBarcodeInput();
          return true;
        }

        const scaleParsed = parseScaleBarcode(q, realScaleCatalog);
        if (scaleParsed) {
          const inCart = cart.find(
            (i) =>
              i.productId === scaleParsed.product.productId ||
              i.sku.toLowerCase() === scaleParsed.product.sku.toLowerCase()
          );
          if (inCart) {
            deductOrRemoveFromCart({
              productId: scaleParsed.product.productId,
              sku: scaleParsed.product.sku,
              barcode: scaleParsed.product.barcode,
              name: scaleParsed.product.name,
            });
            setSearchQuery('');
            focusPosBarcodeInput();
            return true;
          }
        }

        if (isVariableWeightBarcode(q)) {
          try {
            const fromDb = await buscarProductoPorCodigoEscaneado(q);
            if (fromDb) {
              const ui = productoAUi(fromDb);
              const isWeight =
                Boolean(ui.isWeightProduct) ||
                Boolean(fromDb.es_pesado) ||
                fromDb.sale_type === 'weight' ||
                fromDb.sale_type === 'both';

              if (isWeight) {
                const inCart = cart.find(
                  (i) => i.productId === ui.id || i.sku.toLowerCase() === ui.sku.toLowerCase()
                );
                if (inCart) {
                  deductOrRemoveFromCart({
                    productId: ui.id,
                    sku: ui.sku,
                    barcode: ui.barcode || '',
                    name: ui.name,
                  });
                  setSearchQuery('');
                  focusPosBarcodeInput();
                  return true;
                }
              }
            }
          } catch {
            // continuar
          }
        }

        let matchedProd: PosCatalogProduct | undefined = findExactScanProduct(catalogIndex, q);
        if (!matchedProd) {
          matchedProd =
            catalogIndex.items.find((p) => p.nameLower === qLower) ||
            catalogIndex.items.find(
              (p) =>
                p.barcodeLower.includes(qLower) ||
                p.skuLower.includes(qLower) ||
                (p.pluLower && p.pluLower.includes(qLower)) ||
                p.nameLower.includes(qLower)
            );
        }

        if (matchedProd) {
          const inCart = cart.find(
            (i) =>
              i.productId === matchedProd!.id ||
              i.sku.toLowerCase() === matchedProd!.skuLower
          );
          if (inCart) {
            deductOrRemoveFromCart({
              productId: matchedProd.id,
              sku: matchedProd.sku,
              barcode: matchedProd.barcode,
              name: matchedProd.name,
            });
            setSearchQuery('');
            focusPosBarcodeInput();
            return true;
          }
          toast.error(`"${matchedProd.name}" no está en el carrito de compras`);
          return keepCodeSelected();
        }

        try {
          const fromDb = await buscarProductoPorCodigoEscaneado(q);
          if (fromDb) {
            const ui = productoAUi(fromDb);
            const inCart = cart.find(
              (i) => i.productId === ui.id || i.sku.toLowerCase() === ui.sku.toLowerCase()
            );
            if (inCart) {
              deductOrRemoveFromCart({
                productId: ui.id,
                sku: ui.sku,
                barcode: ui.barcode || '',
                name: ui.name,
              });
              setSearchQuery('');
              focusPosBarcodeInput();
              return true;
            }
            toast.error(`"${ui.name}" no está en el carrito de compras`);
            return keepCodeSelected();
          }
        } catch {
          // continuar
        }

        const activeCombos = combos.filter((c) => c.active);
        let matchedCombo = activeCombos.find(
          (c) =>
            c.code.toLowerCase() === qLower ||
            (c.barcode && c.barcode.toLowerCase() === qLower)
        );
        if (!matchedCombo) {
          matchedCombo = activeCombos.find(
            (c) =>
              c.name.toLowerCase().includes(qLower) ||
              c.code.toLowerCase().includes(qLower) ||
              (c.barcode && c.barcode.toLowerCase() === qLower)
          );
        }

        if (matchedCombo) {
          const inCart = cart.find(
            (i) =>
              i.productId === matchedCombo.id ||
              i.sku.toLowerCase() === matchedCombo.code.toLowerCase()
          );
          if (inCart) {
            deductOrRemoveFromCart({
              productId: matchedCombo.id,
              sku: matchedCombo.code,
              name: matchedCombo.name,
            });
            setSearchQuery('');
            focusPosBarcodeInput();
            return true;
          }
          toast.error(`El combo "${matchedCombo.name}" no está en el carrito`);
          return keepCodeSelected();
        }

        toast.error(`No se encontró ningún producto con código: "${q}"`);
        return keepCodeSelected();
      }

      const addWeightedFromScale = (
        product: {
          productId: string;
          name: string;
          sku: string;
          price: number;
          wholesalePrice?: number;
          cost: number;
          tax: number;
          image?: string;
          unit: string;
        },
        weight: number
      ) => {
        const indexedProd = catalogIndex.byId.get(product.productId);
        addToCart(
          {
            id: `cart-${product.productId}-${Date.now()}`,
            productId: product.productId,
            name: product.name,
            sku: product.sku,
            price: product.price,
            regularPrice: product.price,
            wholesalePrice: product.wholesalePrice,
            isWholesale: false,
            cost: product.cost,
            tax: product.tax,
            image: product.image || '',
            unit: product.unit || 'lb',
            isWeighted: true,
            producto_base_id: indexedProd?.producto_base_id,
            factor_conversion: indexedProd?.factor_conversion,
          },
          weight
        );
        toast.success(
          `Producto balanza agregado: ${product.name} (${weight} ${product.unit || 'lb'})`
        );
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      };

      const scaleParsed = parseScaleBarcode(q, realScaleCatalog);
      if (scaleParsed?.isFromEan13) {
        const scaleStock = catalogIndex.byId.get(scaleParsed.product.productId);
        if (scaleStock) {
          if (scaleStock.status === 'inactive' || scaleStock.status === 'discontinued') {
            toast.error(`El producto "${scaleParsed.product.name}" está inactivo y no se puede vender`);
            return keepCodeSelected();
          }
          if (scaleStock.currentStock <= 0 || scaleStock.stockStatus === 'out') {
            toast.error(`Producto sin existencias: ${scaleParsed.product.name}`);
            return keepCodeSelected();
          }
        }
        return addWeightedFromScale(scaleParsed.product, scaleParsed.weight);
      }

      if (isVariableWeightBarcode(q)) {
        try {
          const fromDb = await buscarProductoPorCodigoEscaneado(q);
          if (fromDb) {
            const ui = productoAUi(fromDb);
            const isWeight =
              Boolean(ui.isWeightProduct) ||
              Boolean(fromDb.es_pesado) ||
              fromDb.sale_type === 'weight' ||
              fromDb.sale_type === 'both';

            if (isWeight) {
              if (ui.status === 'inactive' || ui.status === 'discontinued' || fromDb.estado === 'inactivo') {
                toast.error(`"${ui.name}" está INACTIVO en el sistema. Debes activarlo en Gestión de Productos para poder venderlo.`, { duration: 4000 });
                return keepCodeSelected();
              }
              if (ui.currentStock <= 0 || ui.stockStatus === 'out') {
                toast.error(`Producto sin existencias: ${ui.name}`);
                return keepCodeSelected();
              }
              const decoded = decodeVariableWeightBarcode(q);
              return addWeightedFromScale(
                {
                  productId: ui.id,
                  name: ui.name,
                  sku: ui.sku,
                  price: ui.salePrice,
                  wholesalePrice: ui.wholesalePrice ? Number(ui.wholesalePrice) : undefined,
                  cost: ui.costPrice,
                  tax: ui.tax,
                  image: ui.image,
                  unit: ui.unit || ui.weightUnit || 'lb',
                },
                decoded.weight
              );
            }
            const cleanUpperQ = qUpper;
            const isCommercialMatch =
              (ui.barcode && ui.barcode.trim().toUpperCase() === cleanUpperQ) ||
              (ui.sku && ui.sku.trim().toUpperCase() === cleanUpperQ);

            if (!isCommercialMatch) {
              return false;
            }
            if (ui.status === 'inactive' || ui.status === 'discontinued' || fromDb.estado === 'inactivo') {
              toast.error(`"${ui.name}" está INACTIVO en el sistema. Debes activarlo en Gestión de Productos para poder venderlo.`, { duration: 4000 });
              return keepCodeSelected();
            }
            if (ui.stockStatus === 'out' || ui.currentStock <= 0) {
              toast.error(`Producto sin existencias: ${ui.name}`);
              return keepCodeSelected();
            }
            const shouldWholesale = isWholesaleMode && (ui.wholesalePrice || 0) > 0;
            const itemPrice = shouldWholesale ? Number(ui.wholesalePrice) : ui.salePrice;

            addToCart({
              id: `cart-${ui.id}-${Date.now()}`,
              productId: ui.id,
              name: ui.name,
              sku: ui.sku,
              barcode: ui.barcode || '',
              price: itemPrice,
              regularPrice: ui.salePrice,
              wholesalePrice: ui.wholesalePrice ? Number(ui.wholesalePrice) : undefined,
              isWholesale: shouldWholesale,
              cost: ui.costPrice,
              tax: ui.tax,
              image: ui.image || '',
              unit: ui.unit || 'ud',
              isWeighted: false,
              status: ui.status,
              outOfStock: false,
              stock: ui.currentStock,
              currentStock: ui.currentStock,
              producto_base_id: ui.producto_base_id,
              factor_conversion: ui.factor_conversion,
              composite_items: ui.composite_items,
            });
            toast.success(`Producto agregado: ${ui.name}${shouldWholesale ? ' (Al por mayor)' : ''}`);
            setSearchQuery('');
            focusPosBarcodeInput();
            return true;
          }
        } catch {
          // Continúa con la búsqueda local
        }
      }

      // 1. Búsqueda O(1) por código de barras, SKU o PLU exacto
      const scanStartedAt = posPerfNow();
      let matchedProd = findExactScanProduct(catalogIndex, q);

      // 2. Búsqueda de texto en una sola pasada si no hubo match exacto por código
      if (!matchedProd) {
        const textResult = findSingleTextMatch(catalogIndex.items, qLower);
        if (textResult.matched) {
          matchedProd = textResult.matched;
        } else if (textResult.ambiguousCount > 1) {
          recordCodeSearch(posPerfNow() - scanStartedAt, { cacheHit: true, remoteFallback: false });
          const msg =
            textResult.kind === 'exact'
              ? `Se encontraron ${textResult.ambiguousCount} productos con "${q}". Selecciona el producto deseado en el catálogo.`
              : `Se encontraron ${textResult.ambiguousCount} productos que coinciden con "${q}". Selecciona uno en el catálogo.`;
          toast.info(msg);
          setSearchQuery(q);
          return false;
        }
      }

      if (matchedProd) {
        recordCodeSearch(posPerfNow() - scanStartedAt, { cacheHit: true, remoteFallback: false });
        if (matchedProd.status === 'inactive' || matchedProd.status === 'discontinued') {
          toast.error(`"${matchedProd.name}" está INACTIVO en el sistema. Debes activarlo en Gestión de Productos para poder venderlo.`, { duration: 4000 });
          return keepCodeSelected();
        }

        if (matchedProd.outOfStock || matchedProd.stock <= 0) {
          toast.error(`Producto sin existencias: ${matchedProd.name}`);
          return keepCodeSelected();
        }

        if (matchedProd.isWeighted && onOpenScale) {
          setSearchQuery('');
          onOpenScale(matchedProd.id, undefined, matchedProd);
          return true;
        }

        const shouldWholesale = isWholesaleMode && (matchedProd.wholesalePrice || 0) > 0;
        const itemPrice = shouldWholesale ? Number(matchedProd.wholesalePrice) : matchedProd.price;

        addToCart({
          id: `cart-${matchedProd.id}-${Date.now()}`,
          productId: matchedProd.id,
          name: matchedProd.name,
          sku: matchedProd.sku,
          barcode: matchedProd.barcode,
          price: itemPrice,
          regularPrice: matchedProd.price,
          wholesalePrice: matchedProd.wholesalePrice,
          isWholesale: shouldWholesale,
          cost: matchedProd.cost,
          tax: matchedProd.tax,
          image: matchedProd.image || '',
          unit: matchedProd.unit || 'ud',
          isWeighted: matchedProd.isWeighted,
          status: matchedProd.status,
          outOfStock: false,
          stock: matchedProd.stock,
          currentStock: matchedProd.stock,
          producto_base_id: matchedProd.producto_base_id,
          factor_conversion: matchedProd.factor_conversion,
          composite_items: matchedProd.composite_items,
        });
        toast.success(`Producto agregado: ${matchedProd.name}${shouldWholesale ? ' (Al por mayor)' : ''}`);
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      }

      // Si no se encontró en memoria local, buscar directamente en Supabase / BD
      try {
        const remoteStartedAt = posPerfNow();
        const fromDb = await buscarProductoPorCodigoEscaneado(q);
        recordCodeSearch(posPerfNow() - remoteStartedAt, { cacheHit: false, remoteFallback: true });
        if (fromDb) {
          const ui = productoAUi(fromDb);
          if (ui.status === 'inactive' || ui.status === 'discontinued' || fromDb.estado === 'inactivo') {
            toast.error(`"${ui.name}" está INACTIVO en el sistema. Debes activarlo en Gestión de Productos para poder venderlo.`, { duration: 4000 });
            return keepCodeSelected();
          }

          if (ui.stockStatus === 'out' || ui.currentStock <= 0) {
            toast.error(`Producto sin existencias: ${ui.name}`);
            return keepCodeSelected();
          }

          const isWeighted =
            Boolean(ui.isWeightProduct) ||
            Boolean(fromDb.es_pesado) ||
            ui.saleType === 'weight' ||
            ui.saleType === 'both';

          if (isWeighted && onOpenScale) {
            setSearchQuery('');
            onOpenScale(ui.id, undefined, ui);
            return true;
          }

          const shouldWholesale = isWholesaleMode && (ui.wholesalePrice || 0) > 0;
          const itemPrice = shouldWholesale ? Number(ui.wholesalePrice) : ui.salePrice;

          addToCart({
            id: `cart-${ui.id}-${Date.now()}`,
            productId: ui.id,
            name: ui.name,
            sku: ui.sku,
            barcode: ui.barcode || '',
            price: itemPrice,
            regularPrice: ui.salePrice,
            wholesalePrice: ui.wholesalePrice ? Number(ui.wholesalePrice) : undefined,
            isWholesale: shouldWholesale,
            cost: ui.costPrice,
            tax: ui.tax,
            image: ui.image || '',
            unit: ui.unit || 'ud',
            isWeighted,
            status: ui.status,
            outOfStock: false,
            stock: ui.currentStock,
            currentStock: ui.currentStock,
            producto_base_id: ui.producto_base_id,
            factor_conversion: ui.factor_conversion,
            composite_items: ui.composite_items,
          });
          toast.success(`Producto agregado: ${ui.name}${shouldWholesale ? ' (Al por mayor)' : ''}`);
          setSearchQuery('');
          focusPosBarcodeInput();
          return true;
        }
      } catch (err) {
        console.warn('Error consultando producto escaneado en Supabase:', err);
      }

      const activeCombos = combos.filter((c) => c.active);
      let matchedCombo = activeCombos.find(
        (c) =>
          c.code.toLowerCase() === qLower ||
          (c.barcode && c.barcode.toLowerCase() === qLower)
      );

      if (!matchedCombo) {
        const comboMatches = activeCombos.filter(
          (c) =>
            c.name.toLowerCase().includes(qLower) ||
            c.code.toLowerCase().includes(qLower) ||
            (c.barcode && c.barcode.toLowerCase() === qLower)
        );
        if (comboMatches.length === 1) {
          matchedCombo = comboMatches[0];
        } else if (comboMatches.length > 1) {
          toast.info(
            `Se encontraron ${comboMatches.length} combos que coinciden con "${q}". Selecciona uno en el catálogo.`
          );
          setSearchQuery(q);
          return false;
        }
      }

      if (matchedCombo) {
        const stockCheck = checkComboStockAvailability(matchedCombo, 1, catalogIndex.items as any);
        if (!stockCheck.available) {
          toast.error(`Stock insuficiente para combo ${matchedCombo.name}`);
          return keepCodeSelected();
        }

        addToCart({
          id: `cart-combo-${matchedCombo.id}-${Date.now()}`,
          productId: matchedCombo.id,
          name: matchedCombo.name,
          sku: matchedCombo.code,
          price: matchedCombo.price,
          cost: Math.round(matchedCombo.normalPrice * 0.7),
          tax: matchedCombo.applyTax ? 18 : 0,
          image: matchedCombo.image || '',
          unit: 'Combo',
          isCombo: true,
          comboId: matchedCombo.id,
          comboItems: matchedCombo.items,
        });
        toast.success(`Combo agregado: ${matchedCombo.name}`);
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      }

      toast.error(`No se encontró ningún producto ni combo con: "${q}"`);
      return keepCodeSelected();
    },
    [
      addToCart,
      catalogIndex,
      combos,
      realScaleCatalog,
      awaitingDeleteScan,
      cart,
      deductOrRemoveFromCart,
      toggleDeleteMode,
      onOpenScale,
      isWholesaleMode,
      setSearchQuery,
    ]
  );

  // Global Keyboard Shortcuts & Physical Barcode Scanner Buffer
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement;
      const isModalOrOtherInput =
        (target.tagName === 'INPUT' && target.id !== 'pos-barcode-search-input') ||
        target.tagName === 'TEXTAREA';

      if (e.key === 'F6' && !paymentOpen) {
        e.preventDefault();
        openPayment('cash');
        return;
      }
      if (e.key === 'F7' && !paymentOpen) {
        e.preventDefault();
        openPayment('card');
        return;
      }
      if (e.key === 'F8' && !paymentOpen) {
        e.preventDefault();
        openPayment('transfer');
        return;
      }
      if (e.key === 'F5' && !paymentOpen) {
        e.preventDefault();
        openPayment('split');
        return;
      }
      if (e.key === 'F9' && !paymentOpen) {
        e.preventDefault();
        openPayment();
        return;
      }
      if (e.key === 'F12' && orderCompleted) {
        e.preventDefault();
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          if (closePayment) {
            closePayment();
          } else {
            clearCart();
            setPaymentOpen(false);
          }
        };
        window.addEventListener('afterprint', finish, { once: true });
        window.print();
        window.setTimeout(finish, 1200);
        return;
      }
      if (e.key === 'F2' && orderCompleted) {
        e.preventDefault();
        if (closePayment) {
          closePayment();
        } else {
          clearCart();
          setPaymentOpen(false);
        }
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        toggleDeleteMode();
        return;
      }
      if (e.key === 'Escape') {
        if (paymentOpen) {
          e.preventDefault();
          if (closePayment) closePayment();
          else setPaymentOpen(false);
          return;
        }
        if (awaitingDeleteScan) {
          e.preventDefault();
          handleCancelDeleteMode();
          return;
        }
      }

      if (isModalOrOtherInput) return;
      if (target.id === 'pos-barcode-search-input') return;

      const now = Date.now();
      if (now - lastKeyTime > 80) {
        scanBuffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (scanBuffer.trim().length >= 2) {
          e.preventDefault();
          void handleSearchSubmit(scanBuffer).then((added) => {
            if (added) setSearchQuery('');
          });
        }
        scanBuffer = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [
    enabled,
    handleSearchSubmit,
    orderCompleted,
    paymentOpen,
    clearCart,
    openPayment,
    closePayment,
    awaitingDeleteScan,
    toggleDeleteMode,
    handleCancelDeleteMode,
    setPaymentOpen,
    setSearchQuery,
  ]);

  return {
    searchQuery: fallbackSearchQuery,
    setSearchQuery,
    realScaleCatalog,
    handleSearchSubmit,
  };
}
