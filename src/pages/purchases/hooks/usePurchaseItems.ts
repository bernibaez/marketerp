import { useState, useMemo } from 'react';
import type { ProductItem } from '@/lib/productStore';
import { toast } from '@/lib/toast';
import type { PurchaseLineItem } from '../components/PurchaseCreateView';

export function usePurchaseItems() {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([]);

  const subtotal = useMemo(
    () => purchaseItems.reduce((sum, item) => sum + item.qty * item.price, 0),
    [purchaseItems]
  );

  const taxTotal = useMemo(
    () =>
      purchaseItems.reduce((sum, item) => {
        if (item.taxPercent > 0) {
          return sum + item.qty * item.price * (item.taxPercent / 100);
        }
        return sum;
      }, 0),
    [purchaseItems]
  );

  const grandTotal = subtotal + taxTotal;

  const handleUpdateLineQty = (id: string, qty: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
    );
  };

  const handleUpdateLinePrice = (id: string, price: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price: Math.max(0, price) } : item))
    );
  };

  const handleUpdateLineSalePrice = (id: string, salePrice: number) => {
    setPurchaseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, salePrice: Math.max(0, salePrice) } : item))
    );
  };

  const handleRemoveLine = (id: string) => {
    setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
    toast.info('Producto removido de la orden');
  };

  const addProductDirectlyToPurchase = (
    product: ProductItem,
    qty = 1,
    customPrice?: number,
    customSalePrice?: number,
    customTax?: number
  ) => {
    const costPrice = customPrice !== undefined && customPrice > 0 ? customPrice : product.costPrice || 0;
    const salePrice =
      customSalePrice !== undefined && customSalePrice > 0 ? customSalePrice : product.salePrice || 0;
    const taxPercent = customTax !== undefined ? customTax : product.tax ?? 18;

    setPurchaseItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === product.id || (product.sku && i.sku === product.sku)
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const newQty = copy[existingIdx].qty + qty;
        copy[existingIdx] = {
          ...copy[existingIdx],
          qty: newQty,
          price: costPrice > 0 ? costPrice : copy[existingIdx].price,
          salePrice: salePrice > 0 ? salePrice : copy[existingIdx].salePrice,
          taxPercent,
        };
        toast.success(`+${qty} "${product.name}" (Total en orden: ${newQty})`);
        return copy;
      }

      const newItem: PurchaseLineItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        qty,
        price: costPrice,
        salePrice: salePrice,
        taxPercent,
      };
      toast.success(`"${product.name}" agregado a la compra`);
      return [...prev, newItem];
    });
  };

  const clearItems = () => setPurchaseItems([]);

  return {
    purchaseItems,
    setPurchaseItems,
    subtotal,
    taxTotal,
    grandTotal,
    handleUpdateLineQty,
    handleUpdateLinePrice,
    handleUpdateLineSalePrice,
    handleRemoveLine,
    addProductDirectlyToPurchase,
    clearItems,
  };
}
