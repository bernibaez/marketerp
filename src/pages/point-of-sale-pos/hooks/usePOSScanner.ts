import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { DELETE_SKU } from '@/lib/posStore';
import { initialProducts } from '@/lib/initialProducts';
import { parseScaleBarcode } from '../utils/scaleUtils';
import {
  decodeVariableWeightBarcode,
  isVariableWeightBarcode,
  productMatchesScanCode,
} from '@/lib/scaleBarcode';
import { buscarProductoPorCodigoEscaneado, productoAUi } from '@/services/productos.service';
import { checkComboStockAvailability } from '@/lib/comboStore';
import type { CartItem } from '../components/POSTerminal';

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
  combos: any[];
  orderCompleted: boolean;
  paymentOpen: boolean;
  setPaymentOpen: (open: boolean) => void;
  openPayment: (method?: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => void;
  clearCart: () => void;
}

export function usePOSScanner({
  enabled = true,
  cart,
  addToCart,
  deductOrRemoveFromCart,
  awaitingDeleteScan,
  toggleDeleteMode,
  handleCancelDeleteMode,
  productosUi,
  combos,
  orderCompleted,
  paymentOpen,
  setPaymentOpen,
  openPayment,
  clearCart,
}: UsePOSScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const realScaleCatalog = useMemo(() => {
    const storeProducts = productosUi.map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode || '',
      plu: p.plu || '',
      name: p.name,
      price: p.salePrice,
      wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
      cost: p.costPrice,
      stock: p.currentStock,
      unit: p.unit,
      tax: p.tax,
      image: p.image,
      outOfStock: p.stockStatus === 'out',
      isWeighted:
        p.isWeightProduct ||
        p.saleType === 'weight' ||
        p.saleType === 'both' ||
        p.unit.toLowerCase().includes('lb') ||
        p.unit.toLowerCase().includes('kg'),
      saleType: p.saleType,
    }));

    const storeSkus = new Set(storeProducts.map((p) => p.sku.toLowerCase()));
    const demoExtras = initialProducts
      .filter((ip) => !storeSkus.has(ip.sku.toLowerCase()))
      .map((ip) => ({
        id: ip.id,
        sku: ip.sku,
        barcode: ip.barcode || '',
        plu: ip.plu || '',
        name: ip.name,
        price: ip.salePrice,
        wholesalePrice: ip.wholesalePrice ? Number(ip.wholesalePrice) : undefined,
        cost: ip.costPrice,
        stock: ip.currentStock,
        unit: ip.unit,
        tax: ip.tax,
        image: ip.image,
        outOfStock: ip.stockStatus === 'out',
        isWeighted:
          ip.isWeightProduct ||
          ip.saleType === 'weight' ||
          ip.saleType === 'both' ||
          ip.unit.toLowerCase().includes('lb') ||
          ip.unit.toLowerCase().includes('kg'),
        saleType: ip.saleType,
      }));

    const allProds = [...storeProducts, ...demoExtras];

    return allProds.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      plu: p.plu || '',
      price: p.price,
      wholesalePrice: p.wholesalePrice,
      cost: p.cost,
      tax: p.tax,
      unit: p.unit || 'lb',
      barcode: p.barcode || '',
      category: '',
      image: p.image,
      isWeightProduct: p.isWeighted,
    }));
  }, [productosUi]);

  const handleSearchSubmit = useCallback(
    async (rawQuery: string): Promise<boolean> => {
      const q = rawQuery.trim();
      if (!q) return false;

      const keepCodeSelected = () => {
        setSearchQuery(q);
        requestAnimationFrame(() => selectPosBarcodeInput());
        return false;
      };

      if (
        q.toUpperCase() === DELETE_SKU ||
        q.toUpperCase() === 'ELIMINAR' ||
        q.toUpperCase() === 'QUITAR'
      ) {
        toggleDeleteMode();
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      }

      // Modo quitar / restar
      if (awaitingDeleteScan) {
        const qLower = q.toLowerCase();

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
          } catch {
            // continuar
          }
        }

        const storeProducts = productosUi.map((p) => ({
          id: p.id,
          sku: p.sku,
          barcode: p.barcode || '',
          name: p.name,
          price: p.salePrice,
          cost: p.costPrice,
          stock: p.currentStock,
          unit: p.unit,
          tax: p.tax,
          image: p.image,
          outOfStock: p.stockStatus === 'out',
          plu: p.plu || '',
          isWeighted:
            p.isWeightProduct ||
            p.saleType === 'weight' ||
            p.saleType === 'both' ||
            p.unit.toLowerCase().includes('lb') ||
            p.unit.toLowerCase().includes('kg'),
          saleType: p.saleType,
        }));
        const storeSkus = new Set(storeProducts.map((p) => p.sku.toLowerCase()));
        const demoExtras = initialProducts
          .filter((ip) => !storeSkus.has(ip.sku.toLowerCase()))
          .map((ip) => ({
            id: ip.id,
            sku: ip.sku,
            barcode: ip.barcode || '',
            plu: ip.plu || '',
            name: ip.name,
            price: ip.salePrice,
            cost: ip.costPrice,
            stock: ip.currentStock,
            unit: ip.unit,
            tax: ip.tax,
            image: ip.image,
            outOfStock: ip.stockStatus === 'out',
            isWeighted:
              ip.isWeightProduct ||
              ip.saleType === 'weight' ||
              ip.saleType === 'both' ||
              ip.unit.toLowerCase().includes('lb') ||
              ip.unit.toLowerCase().includes('kg'),
            saleType: ip.saleType,
          }));
        const allProds = [...storeProducts, ...demoExtras];

        let matchedProd = allProds.find((p) => productMatchesScanCode(p, q));
        if (!matchedProd) {
          matchedProd = allProds.find((p) => p.name.toLowerCase() === qLower);
        }
        if (!matchedProd) {
          matchedProd = allProds.find(
            (p) =>
              p.barcode.toLowerCase().includes(qLower) ||
              p.sku.toLowerCase().includes(qLower) ||
              (p.plu && p.plu.toLowerCase().includes(qLower)) ||
              p.name.toLowerCase().includes(qLower)
          );
        }

        if (matchedProd) {
          const inCart = cart.find(
            (i) =>
              i.productId === matchedProd.id ||
              i.sku.toLowerCase() === matchedProd.sku.toLowerCase()
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
          } else {
            toast.error(`"${matchedProd.name}" no está en el carrito de compras`);
            return keepCodeSelected();
          }
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
          } else {
            toast.error(`El combo "${matchedCombo.name}" no está en el carrito`);
            return keepCodeSelected();
          }
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
        const scaleStock = productosUi.find((p) => p.id === scaleParsed.product.productId);
        if (scaleStock && scaleStock.currentStock <= 0) {
          toast.error(`Producto agotado: ${scaleParsed.product.name}`);
          return keepCodeSelected();
        }
        return addWeightedFromScale(scaleParsed.product, scaleParsed.weight);
      }

      if (isVariableWeightBarcode(q)) {
        try {
          const fromDb = await buscarProductoPorCodigoEscaneado(q);
          if (fromDb) {
            const ui = productoAUi(fromDb);
            if (ui.currentStock <= 0) {
              toast.error(`Producto agotado: ${ui.name}`);
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
        } catch {
          // Continúa con la búsqueda local
        }
      }

      const storeProducts = productosUi.map((p) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode || '',
        name: p.name,
        price: p.salePrice,
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
        cost: p.costPrice,
        stock: p.currentStock,
        unit: p.unit,
        tax: p.tax,
        image: p.image,
        outOfStock: p.stockStatus === 'out',
        plu: p.plu || '',
        isWeighted:
          p.isWeightProduct ||
          p.saleType === 'weight' ||
          p.saleType === 'both' ||
          p.unit.toLowerCase().includes('lb') ||
          p.unit.toLowerCase().includes('kg'),
        saleType: p.saleType,
      }));

      const storeSkus = new Set(storeProducts.map((p) => p.sku.toLowerCase()));
      const demoExtras = initialProducts
        .filter((ip) => !storeSkus.has(ip.sku.toLowerCase()))
        .map((ip) => ({
          id: ip.id,
          sku: ip.sku,
          barcode: ip.barcode || '',
          plu: ip.plu || '',
          name: ip.name,
          price: ip.salePrice,
          wholesalePrice: ip.wholesalePrice ? Number(ip.wholesalePrice) : undefined,
          cost: ip.costPrice,
          stock: ip.currentStock,
          unit: ip.unit,
          tax: ip.tax,
          image: ip.image,
          outOfStock: ip.stockStatus === 'out',
          isWeighted:
            ip.isWeightProduct ||
            ip.saleType === 'weight' ||
            ip.saleType === 'both' ||
            ip.unit.toLowerCase().includes('lb') ||
            ip.unit.toLowerCase().includes('kg'),
          saleType: ip.saleType,
        }));

      const allProds = [...storeProducts, ...demoExtras];
      const qLower = q.toLowerCase();

      let matchedProd = allProds.find((p) => productMatchesScanCode(p, q));

      if (!matchedProd) {
        matchedProd = allProds.find((p) => p.name.toLowerCase() === qLower);
      }

      if (!matchedProd) {
        matchedProd = allProds.find(
          (p) =>
            p.barcode.toLowerCase().includes(qLower) ||
            p.sku.toLowerCase().includes(qLower) ||
            (p.plu && p.plu.toLowerCase().includes(qLower)) ||
            p.name.toLowerCase().includes(qLower)
        );
      }

      if (matchedProd) {
        if (matchedProd.outOfStock) {
          toast.error(`Producto sin stock disponible: ${matchedProd.name}`);
          return keepCodeSelected();
        }

        addToCart({
          id: `cart-${matchedProd.id}-${Date.now()}`,
          productId: matchedProd.id,
          name: matchedProd.name,
          sku: matchedProd.sku,
          barcode: matchedProd.barcode,
          price: matchedProd.price,
          regularPrice: matchedProd.price,
          wholesalePrice: matchedProd.wholesalePrice,
          isWholesale: false,
          cost: matchedProd.cost,
          tax: matchedProd.tax,
          image: matchedProd.image || '',
          unit: matchedProd.unit || 'ud',
          isWeighted: matchedProd.isWeighted,
        });
        toast.success(`Producto agregado: ${matchedProd.name}`);
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
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
        const stockCheck = checkComboStockAvailability(matchedCombo, 1, productosUi as any);
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

      toast.error(`No se encontró producto ni combo con SKU o código: "${q}"`);
      return keepCodeSelected();
    },
    [
      addToCart,
      productosUi,
      combos,
      realScaleCatalog,
      awaitingDeleteScan,
      cart,
      deductOrRemoveFromCart,
      toggleDeleteMode,
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

      if (e.key === 'F6') {
        e.preventDefault();
        openPayment('cash');
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        openPayment('card');
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        openPayment('transfer');
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        openPayment('split');
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (paymentOpen) setPaymentOpen(false);
        else openPayment('cash');
        return;
      }
      if (e.key === 'F12' && orderCompleted) {
        e.preventDefault();
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          clearCart();
          setPaymentOpen(false);
        };
        window.addEventListener('afterprint', finish, { once: true });
        window.print();
        window.setTimeout(finish, 1200);
        return;
      }
      if (e.key === 'F2' && orderCompleted) {
        e.preventDefault();
        clearCart();
        setPaymentOpen(false);
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
          setPaymentOpen(false);
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
    awaitingDeleteScan,
    toggleDeleteMode,
    handleCancelDeleteMode,
    setPaymentOpen,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    realScaleCatalog,
    handleSearchSubmit,
  };
}
