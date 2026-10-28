import { useState, useCallback } from 'react';
import { toast } from '@/lib/toast';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { getCombos, recordComboSale } from '@/lib/comboStore';
import { procesarVenta } from '@/services/ventas.service';
import { registrarFacturaFiscal } from '@/services/ncf.service';
import { crearCotizacion } from '@/services/cotizaciones.service';
import type { MetodoPago } from '@/types/database';
import type { FiscalInvoiceRecord, NCFType } from '@/lib/ncfStore';
import type { PaymentSplit } from '@/lib/posStore';
import type { CashRegisterId } from '@/lib/cashRegisters';
import type { CartItem, Customer } from '../components/POSTerminal';

interface UsePOSCheckoutProps {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  subtotal: number;
  taxTotal: number;
  globalDiscountAmount: number;
  total: number;
  fiscalEnabled: boolean;
  setFiscalEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  selectedNcfType: NCFType;
  setSelectedNcfType: (t: NCFType) => void;
  cashIsOpen: boolean;
  activeCashId: CashRegisterId;
  activeCashLabel: string;
  user: { id?: string; name?: string } | null;
  clearCart: () => void;
  navigate: (to: string) => void;
}

export function usePOSCheckout({
  cart,
  selectedCustomer,
  subtotal,
  taxTotal,
  globalDiscountAmount,
  total,
  fiscalEnabled,
  setFiscalEnabled,
  selectedNcfType,
  setSelectedNcfType,
  cashIsOpen,
  activeCashId,
  activeCashLabel,
  user,
  clearCart,
  navigate,
}: UsePOSCheckoutProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preferredPayMethod, setPreferredPayMethod] = useState<
    'cash' | 'card' | 'transfer' | 'credit' | 'split' | undefined
  >();
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [, setLastPayments] = useState<PaymentSplit | null>(null);
  const [, setLastSaleResult] = useState<{
    venta_id: string;
    numero_factura: string;
    ncf?: string | null;
  } | null>(null);
  const [lastFiscalInvoice, setLastFiscalInvoice] = useState<FiscalInvoiceRecord | null>(null);

  const openPayment = useCallback(
    (method?: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => {
      if (!cashIsOpen) {
        toast.error('Inicia la caja antes de realizar ventas');
        return;
      }
      if (cart.length === 0) {
        toast.error('El carrito está vacío — agrega productos primero');
        return;
      }
      setOrderCompleted(false);
      setLastPayments(null);
      setLastSaleResult(null);
      setLastFiscalInvoice(null);
      setPreferredPayMethod(method ?? 'cash');
      setPaymentOpen(true);
    },
    [cashIsOpen, cart.length]
  );

  const closePayment = useCallback(() => {
    if (orderCompleted) {
      clearCart();
    }
    setOrderCompleted(false);
    setLastPayments(null);
    setLastSaleResult(null);
    setLastFiscalInvoice(null);
    setPaymentOpen(false);
  }, [orderCompleted, clearCart]);

  const handleQuickCashSale = useCallback(() => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío — agrega productos primero');
      return;
    }
    openPayment('cash');
  }, [cart.length, openPayment]);

  const handleCreateQuote = useCallback(async () => {
    if (cart.length === 0) {
      toast.error('Agrega productos para crear una cotización');
      return;
    }
    try {
      const cot = await crearCotizacion({
        cliente_id: selectedCustomer?.id ?? null,
        vendedor_id: user?.id ?? null,
        subtotal,
        monto_impuesto: taxTotal,
        monto_total: total,
        items: cart.map((item) => ({
          producto_id: item.isCombo ? null : item.productId,
          nombre_item: item.name,
          precio_unitario: item.price,
          cantidad: item.qty,
          subtotal: item.price * item.qty * (1 - item.discount / 100),
        })),
      });
      toast.success(`Cotización ${cot.codigo} creada`);
      navigate('/sales');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la cotización');
    }
  }, [cart, selectedCustomer, user, subtotal, taxTotal, total, navigate]);

  const paymentProps = {
    total,
    subtotal,
    taxTotal,
    discountTotal: globalDiscountAmount,
    registerNumber: activeCashLabel,
    cart,
    customer: selectedCustomer,
    orderCompleted,
    fiscalEnabled,
    initialMethod: preferredPayMethod,
    initialNcfType: selectedNcfType,
    onToggleFiscal: (val: boolean) => setFiscalEnabled(val),
    onSelectNcfType: (t: NCFType) => setSelectedNcfType(t),
    onComplete: async (_payments: PaymentSplit, fiscalInvoice?: FiscalInvoiceRecord) => {
      if (!cashIsOpen) {
        toast.error('Inicia la caja antes de realizar ventas');
        return;
      }

      const activeItems = cart.filter((i) => i.qty > 0);
      if (activeItems.length === 0) {
        toast.error('Agrega productos con cantidad mayor a 0 antes de procesar el pago');
        return;
      }

      const metodo: MetodoPago =
        [_payments.cash, _payments.card, _payments.transfer, _payments.credit].filter((v) => v > 0)
          .length > 1
          ? 'mixto'
          : _payments.cash > 0
            ? 'efectivo'
            : _payments.card > 0
              ? 'tarjeta'
              : _payments.transfer > 0
                ? 'transferencia'
                : _payments.credit > 0
                  ? 'credito'
                  : 'efectivo';

      const costoTotal = activeItems.reduce((s, i) => s + i.cost * i.qty, 0);
      const montoPagado =
        _payments.cash + _payments.card + _payments.transfer + _payments.credit;

      try {
        const effectiveNcfType =
          fiscalInvoice?.ncfType ?? (fiscalEnabled ? selectedNcfType : null);
        const resultado = await procesarVenta({
          cajero_id: user?.id ?? null,
          cliente_id: selectedCustomer?.id ?? null,
          caja_id: String(activeCashId),
          subtotal,
          monto_impuesto: taxTotal,
          monto_descuento: globalDiscountAmount,
          monto_total: total,
          costo_total: costoTotal,
          metodo_pago: metodo,
          monto_pagado: montoPagado,
          monto_efectivo: _payments.cash,
          monto_tarjeta: _payments.card,
          monto_transferencia: _payments.transfer,
          monto_credito: _payments.credit,
          devuelta_entregada: Math.max(0, montoPagado - total),
          ncf: isSupabaseConfigured() ? null : (fiscalInvoice?.ncf ?? null),
          tipo_ncf: effectiveNcfType,
          items: activeItems.map((item) => ({
            producto_id: item.isCombo ? null : item.productId,
            combo_id: item.comboId ?? null,
            tipo_item: item.isCombo ? 'combo' : 'producto',
            nombre_item: item.name,
            precio_unitario: item.price,
            costo_unitario: item.cost,
            cantidad: item.qty,
            porcentaje_impuesto: item.tax,
            subtotal: item.price * item.qty * (1 - item.discount / 100),
          })),
        });

        if (!isSupabaseConfigured()) {
          activeItems.forEach((cartItem) => {
            if (cartItem.isCombo && cartItem.comboId) {
              const combo = getCombos().find((c) => c.id === cartItem.comboId);
              if (combo) {
                recordComboSale(combo, cartItem.qty, activeCashLabel);
              }
            }
          });
        }

        setLastPayments(_payments);
        setLastSaleResult(resultado);

        if (fiscalInvoice || fiscalEnabled) {
          const finalInvoice: FiscalInvoiceRecord = {
            id: fiscalInvoice?.id || `inv-${Date.now()}`,
            numero_factura: resultado.numero_factura,
            ncf: resultado.ncf || fiscalInvoice?.ncf || '',
            ncfType: fiscalInvoice?.ncfType || selectedNcfType,
            rncClient: fiscalInvoice?.rncClient || selectedCustomer?.rnc_cedula || undefined,
            companyName: fiscalInvoice?.companyName || selectedCustomer?.name || 'Consumidor Final',
            issueDate: fiscalInvoice?.issueDate || new Date().toLocaleDateString('es-DO'),
            issueTime:
              fiscalInvoice?.issueTime ||
              new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
            subtotal,
            itbis: taxTotal,
            total,
            paymentMethod: metodo,
            cashier: user?.name || 'Cajero POS',
            expirationDate: fiscalInvoice?.expirationDate || '2027-12-31',
            items: activeItems.map((item) => ({
              sku: item.sku,
              name: item.name,
              qty: item.qty,
              price: item.price,
              itbis: Math.round((item.price - item.price / 1.18) * item.qty * 100) / 100,
              subtotal: item.price * item.qty,
            })),
          };

          try {
            if (finalInvoice.ncf) {
              await registrarFacturaFiscal({
                ...finalInvoice,
                venta_id: resultado.venta_id,
              });
            }
          } catch {
            /* no bloquear venta */
          }
          toast.success(
            `Venta completada — Factura: ${resultado.numero_factura} ${
              finalInvoice.ncf ? `(NCF: ${finalInvoice.ncf})` : ''
            }`
          );
        } else {
          toast.success(`Venta completada — Factura: ${resultado.numero_factura}`);
        }

        setOrderCompleted(true);
        return resultado;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al registrar la venta');
        return;
      }
    },
    onNewSale: () => {
      clearCart();
      setOrderCompleted(false);
      setLastPayments(null);
      setLastSaleResult(null);
      setLastFiscalInvoice(null);
      setPaymentOpen(false);
    },
  };

  const resetOrderState = useCallback(() => {
    setPaymentOpen(false);
    setOrderCompleted(false);
    setLastPayments(null);
    setLastFiscalInvoice(null);
  }, []);

  return {
    paymentOpen,
    setPaymentOpen,
    preferredPayMethod,
    setPreferredPayMethod,
    orderCompleted,
    setOrderCompleted,
    lastFiscalInvoice,
    setLastFiscalInvoice,
    openPayment,
    closePayment,
    handleQuickCashSale,
    handleCreateQuote,
    paymentProps,
    resetOrderState,
  };
}
