import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import {
  getHeldSales,
  removeHeldSale,
  saveHeldSale,
  clearHeldSales,
  type HeldSale,
} from '@/lib/posStore';
import type { CartItem, Customer } from '../components/POSTerminal';

interface UsePOSHeldSalesProps {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  globalDiscount: number;
  setCart: (cart: CartItem[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setGlobalDiscount: (discount: number) => void;
  clearCart: () => void;
}

export function usePOSHeldSales({
  cart,
  selectedCustomer,
  globalDiscount,
  setCart,
  setSelectedCustomer,
  setGlobalDiscount,
  clearCart,
}: UsePOSHeldSalesProps) {
  const [holdOpen, setHoldOpen] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => getHeldSales());

  const refreshHeld = useCallback(() => {
    setHeldSales(getHeldSales());
  }, []);

  const holdCurrentSale = useCallback(
    (label: string) => {
      if (cart.length === 0) {
        toast.error('No hay productos para pausar');
        return;
      }
      const sale: HeldSale = {
        id: `hold-${Date.now()}`,
        label: label || `Venta ${new Date().toLocaleTimeString('es-DO')}`,
        cart,
        customer: selectedCustomer,
        globalDiscount,
        savedAt: new Date().toISOString(),
      };
      saveHeldSale(sale);
      refreshHeld();
      clearCart();
      setHoldOpen(false);
      toast.success('Venta pausada y guardada');
    },
    [cart, selectedCustomer, globalDiscount, clearCart, refreshHeld]
  );

  const resumeHeldSale = useCallback(
    (sale: HeldSale) => {
      if (cart.length > 0) {
        toast.error('Limpia o pausa la venta actual antes de retomar otra');
        return;
      }
      setCart(sale.cart as CartItem[]);
      setSelectedCustomer(sale.customer as Customer | null);
      setGlobalDiscount(sale.globalDiscount);
      removeHeldSale(sale.id);
      refreshHeld();
      setHoldOpen(false);
      toast.success(`Retomada: ${sale.label}`);
    },
    [cart.length, setCart, setSelectedCustomer, setGlobalDiscount, refreshHeld]
  );

  const deleteHeldSale = useCallback(
    (id: string) => {
      removeHeldSale(id);
      refreshHeld();
      toast.success('Venta pausada eliminada');
    },
    [refreshHeld]
  );

  const clearAllHeld = useCallback(() => {
    clearHeldSales();
    refreshHeld();
  }, [refreshHeld]);

  return {
    holdOpen,
    setHoldOpen,
    heldSales,
    refreshHeld,
    holdCurrentSale,
    resumeHeldSale,
    deleteHeldSale,
    clearAllHeld,
  };
}
