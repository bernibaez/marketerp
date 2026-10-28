import { useState, useCallback, useMemo } from 'react';
import { toast } from '@/lib/toast';
import { DELETE_SKU } from '@/lib/posStore';
import type { NCFType } from '@/lib/ncfStore';
import type { CartItem, Customer } from '../components/POSTerminal';
import { calculateCartTotals } from '@/lib/cartCalculations';

export function usePOSCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  const [selectedNcfType, setSelectedNcfType] = useState<NCFType>('B02');
  const [awaitingDeleteScan, setAwaitingDeleteScan] = useState(false);

  const focusPosBarcodeInput = () => {
    const el = document.getElementById('pos-barcode-search-input') as HTMLInputElement | null;
    if (!el) return;
    el.focus();
  };

  const handleCancelDeleteMode = useCallback(() => {
    setAwaitingDeleteScan(false);
    toast.info('Modo venta normal activado');
    setTimeout(focusPosBarcodeInput, 50);
  }, []);

  const toggleDeleteMode = useCallback(() => {
    if (cart.length === 0 && !awaitingDeleteScan) {
      toast.error('El carrito está vacío');
      return;
    }
    setAwaitingDeleteScan((prev) => {
      const next = !prev;
      if (next) {
        toast.info('Modo quitar activado: escanea los productos a descontar o quitar del carrito');
      } else {
        toast.info('Modo venta normal activado');
      }
      setTimeout(focusPosBarcodeInput, 50);
      return next;
    });
  }, [cart.length, awaitingDeleteScan]);

  const deductOrRemoveFromCart = useCallback(
    (product: { productId?: string; sku?: string; barcode?: string; name?: string }) => {
      setCart((prev) => {
        const prodSku = (product.sku || '').toLowerCase();
        const prodBarcode = (product.barcode || '').toLowerCase();
        const prodName = (product.name || '').toLowerCase();

        const idxReversed = [...prev].reverse().findIndex((item) => {
          if (product.productId && item.productId === product.productId) return true;
          if (prodSku && item.sku && item.sku.toLowerCase() === prodSku) return true;
          if (prodBarcode && item.barcode && item.barcode.toLowerCase() === prodBarcode) return true;
          if (prodBarcode && item.sku && item.sku.toLowerCase() === prodBarcode) return true;
          if (prodSku && item.barcode && item.barcode.toLowerCase() === prodSku) return true;
          if (prodName && item.name.toLowerCase() === prodName) return true;
          return false;
        });

        if (idxReversed === -1) {
          toast.error(
            `"${product.name || product.sku || product.barcode || 'Producto'}" no está en el carrito`
          );
          return prev;
        }

        const realIdx = prev.length - 1 - idxReversed;
        const currentItem = prev[realIdx];

        if (currentItem.qty > 1 && !currentItem.isWeighted) {
          const newQty = Math.round((currentItem.qty - 1) * 100) / 100;
          toast.info(`Restada 1 unidad de "${currentItem.name}" (Quedan ${newQty})`);
          return prev.map((item, i) => (i === realIdx ? { ...item, qty: newQty } : item));
        } else {
          toast.success(`Eliminado del carrito: "${currentItem.name}"`);
          const nextCart = prev.filter((_, i) => i !== realIdx);
          if (nextCart.length === 0) {
            toast.info('Carrito vacío. Modo quitar desactivado.');
            setAwaitingDeleteScan(false);
          }
          return nextCart;
        }
      });
    },
    []
  );

  const addToCart = useCallback(
    (
      product: Omit<CartItem, 'qty' | 'discount'> & {
        discount?: number;
        discountType?: 'fixed' | 'percentage';
        discountValue?: number;
        professionalDiscount?: number;
      },
      qty = 1,
      replaceQty = false
    ) => {
      if (
        product.sku.toUpperCase() === DELETE_SKU ||
        product.sku.toUpperCase() === 'ELIMINAR' ||
        product.sku.toUpperCase() === 'QUITAR'
      ) {
        toggleDeleteMode();
        return;
      }

      if (awaitingDeleteScan) {
        deductOrRemoveFromCart({
          productId: product.productId,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
        });
        return;
      }

      const safeQty = Math.round((Number(qty) || 0) * 1000) / 1000;

      setCart((prev) => {
        const existing = prev.find(
          (item) =>
            (product.productId && item.productId === product.productId) ||
            (product.sku && item.sku && item.sku.toLowerCase() === product.sku.toLowerCase())
        );
        if (existing) {
          return prev.map((item) =>
            (product.productId && item.productId === product.productId) ||
            (product.sku && item.sku && item.sku.toLowerCase() === product.sku.toLowerCase())
              ? {
                  ...item,
                  qty: replaceQty
                    ? safeQty
                    : Math.round((item.qty + safeQty) * 1000) / 1000,
                  price: product.price ?? item.price,
                  discount: product.discount !== undefined ? product.discount : item.discount,
                  discountType: product.discountType ?? item.discountType,
                  discountValue: product.discountValue ?? item.discountValue,
                  professionalDiscount: product.professionalDiscount ?? item.professionalDiscount,
                }
              : item
          );
        }
        const regularPrice = product.regularPrice ?? product.price;
        const wholesalePrice =
          product.wholesalePrice && product.wholesalePrice > 0
            ? Number(product.wholesalePrice)
            : undefined;
        return [
          ...prev,
          {
            ...product,
            regularPrice,
            wholesalePrice,
            isWholesale: product.isWholesale ?? false,
            qty: safeQty,
            discount: product.discount ?? 0,
            discountType: product.discountType ?? 'fixed',
            discountValue: product.discountValue ?? (product.discount ? (product.discount * product.price) / 100 : 0),
            professionalDiscount: product.professionalDiscount ?? 0,
          },
        ];
      });
    },
    [awaitingDeleteScan, deductOrRemoveFromCart, toggleDeleteMode]
  );


  const toggleWholesalePrice = useCallback((cartId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartId) return item;
        const wholesale = item.wholesalePrice;
        if (!wholesale || wholesale <= 0) {
          toast.error(`"${item.name}" no tiene precio al por mayor configurado`);
          return item;
        }

        const willBeWholesale = !item.isWholesale;
        const regular = item.regularPrice ?? item.price;
        const newPrice = willBeWholesale ? wholesale : regular;

        if (willBeWholesale) {
          toast.success(`"${item.name}" cambiado a precio al por mayor (RD$ ${wholesale.toFixed(2)})`);
        } else {
          toast.info(`"${item.name}" restaurado a precio normal (RD$ ${regular.toFixed(2)})`);
        }

        return {
          ...item,
          regularPrice: regular,
          wholesalePrice: wholesale,
          isWholesale: willBeWholesale,
          price: newPrice,
        };
      })
    );
  }, []);

  const toggleAllWholesale = useCallback(() => {
    setCart((prev) => {
      const eligible = prev.filter((i) => i.wholesalePrice && i.wholesalePrice > 0);
      if (eligible.length === 0) {
        toast.info('Ningún producto en el carrito tiene precio al por mayor configurado');
        return prev;
      }

      const allAlreadyWholesale = eligible.every((i) => i.isWholesale);
      const targetState = !allAlreadyWholesale;

      const updated = prev.map((item) => {
        if (!item.wholesalePrice || item.wholesalePrice <= 0) return item;
        const regular = item.regularPrice ?? item.price;
        const newPrice = targetState ? item.wholesalePrice : regular;
        return {
          ...item,
          regularPrice: regular,
          isWholesale: targetState,
          price: newPrice,
        };
      });

      if (targetState) {
        toast.success(`Precio al por mayor aplicado a ${eligible.length} producto(s)`);
      } else {
        toast.info('Precio normal restaurado en todos los productos');
      }

      return updated;
    });
  }, []);

  const updateQty = useCallback((cartId: string, qty: number) => {
    const safeQty = Math.max(0, isNaN(qty) ? 0 : qty);
    setCart((prev) => prev.map((item) => (item.id === cartId ? { ...item, qty: safeQty } : item)));
  }, []);

  const updateDiscount = useCallback((cartId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === cartId ? { ...item, discount: Math.min(100, Math.max(0, discount)) } : item
      )
    );
  }, []);

  const updateItemDiscountAndPrice = useCallback(
    (
      cartId: string,
      details: {
        price?: number;
        qty?: number;
        discountType: 'fixed' | 'percentage';
        discountValue: number;
        professionalDiscount?: number;
      }
    ) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== cartId) return item;
          const price = details.price !== undefined ? Math.max(0, details.price) : item.price;
          const qty = details.qty !== undefined ? Math.max(0, details.qty) : item.qty;
          const discountValue = Math.max(0, details.discountValue || 0);
          const professionalDiscount = Math.max(0, details.professionalDiscount || 0);

          let effectivePct = 0;
          if (details.discountType === 'percentage') {
            effectivePct = Math.min(100, Math.max(0, discountValue));
          } else {
            effectivePct = price > 0 ? Math.min(100, Math.max(0, (discountValue / price) * 100)) : 0;
          }

          return {
            ...item,
            price,
            qty,
            discount: effectivePct,
            discountType: details.discountType,
            discountValue,
            professionalDiscount,
          };
        })
      );
    },
    []
  );

  const removeFromCart = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setGlobalDiscount(0);
    setAwaitingDeleteScan(false);
    setFiscalEnabled(false);
  }, []);

  const totals = useMemo(
    () => calculateCartTotals(cart, globalDiscount),
    [cart, globalDiscount]
  );

  const subtotal = totals.subtotal;
  const globalDiscountAmount = totals.globalDiscountAmount;
  const taxTotal = totals.taxTotal;
  const total = totals.total;

  return {
    cart,
    setCart,
    selectedCustomer,
    setSelectedCustomer,
    globalDiscount,
    setGlobalDiscount,
    fiscalEnabled,
    setFiscalEnabled,
    selectedNcfType,
    setSelectedNcfType,
    awaitingDeleteScan,
    toggleDeleteMode,
    handleCancelDeleteMode,
    addToCart,
    deductOrRemoveFromCart,
    updateQty,
    updateDiscount,
    updateItemDiscountAndPrice,
    removeFromCart,
    clearCart,
    toggleWholesalePrice,
    toggleAllWholesale,
    subtotal,
    globalDiscountAmount,
    taxTotal,
    total,
  };
}
