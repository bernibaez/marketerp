import { useState, useCallback, useEffect } from 'react';
import { toast } from '@/lib/toast';
import {
  obtenerVentasSuspendidas,
  guardarVentaSuspendida,
  eliminarVentaSuspendida,
  limpiarTodasVentasSuspendidas,
  type HeldSale,
} from '@/services/ventasSuspendidas.service';
import { getHeldSales } from '@/lib/posStore';
import type { CartItem, Customer } from '../components/POSTerminal';

interface UsePOSHeldSalesProps {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  globalDiscount: number;
  total?: number;
  user?: { id?: string; name?: string } | null;
  activeCashRegister?: { id: string; label: string } | null;
  setCart: (cart: CartItem[]) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setGlobalDiscount: (discount: number) => void;
  clearCart: () => void;
}

export function usePOSHeldSales({
  cart,
  selectedCustomer,
  globalDiscount,
  total,
  user,
  activeCashRegister,
  setCart,
  setSelectedCustomer,
  setGlobalDiscount,
  clearCart,
}: UsePOSHeldSalesProps) {
  const [holdOpen, setHoldOpen] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => getHeldSales());

  const refreshHeld = useCallback(async () => {
    try {
      const sales = await obtenerVentasSuspendidas();
      setHeldSales(sales);
    } catch {
      setHeldSales(getHeldSales());
    }
  }, []);

  useEffect(() => {
    void refreshHeld();

    const handleUpdate = () => {
      void refreshHeld();
    };
    window.addEventListener('mercato_held_sales_updated', handleUpdate);
    return () => {
      window.removeEventListener('mercato_held_sales_updated', handleUpdate);
    };
  }, [refreshHeld]);

  const holdCurrentSale = useCallback(
    async (label: string) => {
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
        cashierId: user?.id,
        cashierName: user?.name || 'Cajero',
        cajaId: activeCashRegister?.id,
        cajaLabel: activeCashRegister?.label || 'Caja POS',
        total: total || cart.reduce((acc, it) => acc + (it.price * it.qty), 0),
      };
      await guardarVentaSuspendida(sale);
      await refreshHeld();
      clearCart();
      setHoldOpen(false);
      toast.success('Venta pausada y guardada en el sistema');
    },
    [cart, selectedCustomer, globalDiscount, total, user, activeCashRegister, clearCart, refreshHeld]
  );

  const resumeHeldSale = useCallback(
    async (sale: HeldSale) => {
      if (cart.length > 0) {
        toast.error('Limpia o pausa la venta actual antes de retomar otra');
        return;
      }
      setCart(sale.cart as CartItem[]);
      setSelectedCustomer(sale.customer as Customer | null);
      setGlobalDiscount(sale.globalDiscount);
      await eliminarVentaSuspendida(sale.id);
      await refreshHeld();
      setHoldOpen(false);
      toast.success(`Retomada: ${sale.label}`);
    },
    [cart.length, setCart, setSelectedCustomer, setGlobalDiscount, refreshHeld]
  );

  const deleteHeldSale = useCallback(
    async (id: string) => {
      await eliminarVentaSuspendida(id);
      await refreshHeld();
      toast.success('Venta pausada eliminada');
    },
    [refreshHeld]
  );

  const clearAllHeld = useCallback(async () => {
    await limpiarTodasVentasSuspendidas();
    await refreshHeld();
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
