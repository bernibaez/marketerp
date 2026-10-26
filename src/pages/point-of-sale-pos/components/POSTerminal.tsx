import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { RefreshCw, Banknote, CreditCard, XCircle, Pause, CheckCircle, FileText, ShoppingBag } from 'lucide-react';
import POSHeader from './POSHeader';
import ProductPanel from './ProductPanel';
import CartPanel from './CartPanel';
import PaymentPanel from './PaymentPanel';
import PosExpenseModal from './PosExpenseModal';
import PosHoldModal from './PosHoldModal';
import PosScaleModal from './PosScaleModal';
import PosReturnModal from './PosReturnModal';
import PosCashSwitchModal from './PosCashSwitchModal';
import RegisterDetailsModal from './RegisterDetailsModal';
import PosCashOpenModal from './PosCashOpenModal';
import PosCashCloseModal from './PosCashCloseModal';
import FiscalInvoiceModal from '@/components/FiscalInvoiceModal';
import { findCashRegister, getCashRegister, type CashRegisterId } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import {
  DELETE_SKU,
  getHeldSales,
  removeHeldSale,
  saveHeldSale,
  clearHeldSales,
  type HeldSale,
  type PaymentSplit,
} from '@/lib/posStore';
import type { FiscalInvoiceRecord, NCFType } from '@/lib/ncfStore';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { getCombos, recordComboSale, checkComboStockAvailability } from '@/lib/comboStore';
import { procesarVenta } from '@/services/ventas.service';
import { registrarFacturaFiscal } from '@/services/ncf.service';
import { crearCotizacion } from '@/services/cotizaciones.service';
import type { MetodoPago } from '@/types/database';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProductos } from '@/hooks/useProductos';
import { useCombos } from '@/hooks/useCombos';
import { initialProducts } from '@/pages/product-management/components/ProductManagementScreen';
import { parseScaleBarcode } from '../utils/scaleUtils';
import { decodeVariableWeightBarcode, isVariableWeightBarcode, productMatchesScanCode } from '@/lib/scaleBarcode';
import { buscarProductoPorCodigoEscaneado, productoAUi } from '@/services/productos.service';
import PosWeightScanModal from './PosWeightScanModal';

const ADMIN_OWN_CASH: CashRegisterId = '1';
const DEFAULT_CASHIER_CASH: CashRegisterId = '2';

/**
 * Enfoca el input de código de barras y selecciona todo el texto.
 * Usado cuando el código no se encontró, para que el próximo escaneo
 * reemplace el código anterior sin concatenarlo.
 */
function selectPosBarcodeInput() {
  const el = document.getElementById('pos-barcode-search-input') as HTMLInputElement | null;
  if (!el) return;
  el.focus();
  if (el.value.length > 0) {
    el.select();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      // Algunos inputs no permiten setSelectionRange
    }
  }
}

/**
 * Enfoca el input de código de barras con el campo vacío.
 * Usado después de un escaneo exitoso para recibir el siguiente código.
 */
function focusPosBarcodeInput() {
  const el = document.getElementById('pos-barcode-search-input') as HTMLInputElement | null;
  if (!el) return;
  el.focus();
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  regularPrice?: number;
  wholesalePrice?: number;
  isWholesale?: boolean;
  cost: number;
  qty: number;
  discount: number;
  tax: number;
  image: string;
  unit: string;
  isWeighted?: boolean;
  isCombo?: boolean;
  comboId?: string;
  comboItems?: any[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  credit: number;
  rnc_cedula?: string | null;
  direccion?: string | null;
  tipo_cliente?: string | null;
  tipo_ncf?: string | null;
}

export default function POSTerminal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdminUser = user?.role === 'Administrador';
  const { registers, refetch: refetchRegisters, markRegisterClosed } = useCashRegisters();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preferredPayMethod, setPreferredPayMethod] = useState<'cash' | 'card' | 'transfer' | 'credit' | 'split' | undefined>();
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [lastPayments, setLastPayments] = useState<PaymentSplit | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleParams, setScaleParams] = useState<{ productId?: string; weight?: number } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [registerDetailsOpen, setRegisterDetailsOpen] = useState(false);
  const [lastFiscalInvoice, setLastFiscalInvoice] = useState<FiscalInvoiceRecord | null>(null);
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  const [selectedNcfType, setSelectedNcfType] = useState<NCFType>('B02');
  const [lastSaleResult, setLastSaleResult] = useState<{ venta_id: string; numero_factura: string; ncf?: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenScale = (productId?: string, weight?: number) => {
    setScaleParams(productId || weight ? { productId, weight } : null);
    setScaleOpen(true);
  };
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => getHeldSales());
  const [awaitingDeleteScan, setAwaitingDeleteScan] = useState(false);
  const [activeCashId, setActiveCashId] = useState<CashRegisterId>(() =>
    user?.role === 'Administrador' ? ADMIN_OWN_CASH : DEFAULT_CASHIER_CASH
  );
  const [cashSwitchOpen, setCashSwitchOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [closeCashModalOpen, setCloseCashModalOpen] = useState(false);
  const [shiftOpenedLocally, setShiftOpenedLocally] = useState(false);
  const [shiftClosedLocally, setShiftClosedLocally] = useState(false);
  const [weightScanOpen, setWeightScanOpen] = useState(false);

  const activeCashSession = findCashRegister(registers, activeCashId);
  const activeCash = activeCashSession || getCashRegister(activeCashId);
  const cashIsOpen =
    !shiftClosedLocally && (Boolean(activeCashSession?.open) || shiftOpenedLocally);
  const isRemoteAdmin = isAdminUser && !activeCash.isAdminBox;

  const openPayment = useCallback(
    (method?: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => {
      if (!cashIsOpen) {
        toast.error('Inicia la caja antes de realizar ventas');
        return;
      }
      if (method) setPreferredPayMethod(method);
      setPaymentOpen(true);
    },
    [cashIsOpen]
  );

  useEffect(() => {
    if (registers.length === 0) return;

    const current = findCashRegister(registers, activeCashId);
    if (current) {
      if (current.id !== activeCashId) setActiveCashId(current.id);
      if (!isAdminUser && current.isAdminBox) {
        const fallback = registers.find((c) => !c.isAdminBox);
        if (fallback) setActiveCashId(fallback.id);
      }
      return;
    }

    const preferred = isAdminUser
      ? registers.find((c) => c.isAdminBox) || registers[0]
      : registers.find((c) => !c.isAdminBox) || registers[0];
    if (preferred) setActiveCashId(preferred.id);
  }, [isAdminUser, registers, activeCashId]);

  const refreshHeld = () => setHeldSales(getHeldSales());

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

        // Restar 1 unidad por cada escaneo (y eliminarlo si la cantidad llega a 0 o es producto por peso)
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
    (product: Omit<CartItem, 'qty' | 'discount'>, qty = 1) => {
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

      setCart((prev) => {
        const existing = prev.find(
          (item) => item.productId === product.productId || item.sku === product.sku
        );
        if (existing) {
          return prev.map((item) =>
            item.productId === product.productId || item.sku === product.sku
              ? { ...item, qty: Math.round((item.qty + qty) * 100) / 100 }
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
            qty,
            discount: 0,
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

  const removeFromCart = useCallback((cartId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setGlobalDiscount(0);
    setOrderCompleted(false);
    setLastPayments(null);
    setAwaitingDeleteScan(false);
    setFiscalEnabled(false);
  }, []);

  const holdCurrentSale = (label: string) => {
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
  };

  const resumeHeldSale = (sale: HeldSale) => {
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
  };

  const subtotal = cart.reduce((sum, item) => {
    const lineTotal = item.price * item.qty;
    const lineDiscount = lineTotal * (item.discount / 100);
    return sum + lineTotal - lineDiscount;
  }, 0);

  const globalDiscountAmount = subtotal * (globalDiscount / 100);
  const afterDiscount = subtotal - globalDiscountAmount;
  const taxTotal = cart
    .filter((i) => i.tax > 0)
    .reduce((sum, item) => {
      const lineTotal = item.price * item.qty * (1 - item.discount / 100);
      return sum + lineTotal * (item.tax / 100);
    }, 0);
  const total = afterDiscount + taxTotal;



  const { productosUi } = useProductos({ pagina: 1, limite: 500, estado: 'todos' });
  const { combos } = useCombos(true);

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
        // Restaura el código en el estado y luego selecciona todo el texto
        // después del render de React, para que el próximo escaneo reemplace
        // el código anterior en lugar de concatenarse.
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

      // ── MODO QUITAR / RESTAR ACTIVO ──────────────────────────────────────────
      if (awaitingDeleteScan) {
        const qLower = q.toLowerCase();

        // 1. Coincidencia directa con algún ítem ya presente en el carrito
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

        // 2. Balanza EAN-13
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

        // 3. Peso variable
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

        // 4. Catálogo de productos
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
            (i) => i.productId === matchedProd.id || i.sku.toLowerCase() === matchedProd.sku.toLowerCase()
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

        // 5. Combos
        const activeCombos = combos.filter((c) => c.active);
        let matchedCombo = activeCombos.find(
          (c) => c.code.toLowerCase() === qLower || (c.barcode && c.barcode.toLowerCase() === qLower)
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
            (i) => i.productId === matchedCombo.id || i.sku.toLowerCase() === matchedCombo.code.toLowerCase()
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
        if (
          matchedProd.sku !== DELETE_SKU &&
          (matchedProd.outOfStock || Number(matchedProd.stock) <= 0)
        ) {
          toast.error(`Producto agotado: ${matchedProd.name}`);
          return keepCodeSelected();
        }

        if (
          matchedProd.isWeighted ||
          matchedProd.saleType === 'weight' ||
          matchedProd.unit.toLowerCase().includes('lb') ||
          matchedProd.unit.toLowerCase().includes('kg')
        ) {
          handleOpenScale(matchedProd.id, 1.000);
          setSearchQuery('');
          focusPosBarcodeInput();
          return true;
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
          image: matchedProd.image,
          unit: matchedProd.unit,
          isWeighted: false,
        });
        toast.success(`Agregado: ${matchedProd.name} (${matchedProd.sku || matchedProd.barcode})`);
        setSearchQuery('');
        focusPosBarcodeInput();
        return true;
      }

      // 3. Search combos
      const activeCombos = combos.filter((c) => c.active);
      let matchedCombo = activeCombos.find(
        (c) => c.code.toLowerCase() === qLower || (c.barcode && c.barcode.toLowerCase() === qLower)
      );

      if (!matchedCombo) {
        matchedCombo = activeCombos.find(
          (c) =>
            c.name.toLowerCase().includes(qLower) ||
            c.code.toLowerCase().includes(qLower) ||
            (c.barcode && c.barcode.toLowerCase().includes(qLower))
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
      handleOpenScale,
      productosUi,
      combos,
      realScaleCatalog,
      awaitingDeleteScan,
      cart,
      deductOrRemoveFromCart,
      toggleDeleteMode,
    ]
  );

  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const onGlobalKeyDown = (e: KeyboardEvent) => {
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

      // Ignore scans if user is editing inside another text field/modal
      if (isModalOrOtherInput) return;

      // Si el foco ya está en el input de código de barras, el input maneja
      // los caracteres directamente a través de onChange. Solo redirigimos
      // el buffer global cuando el foco está en otro lugar.
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
    handleSearchSubmit,
    orderCompleted,
    paymentOpen,
    clearCart,
    openPayment,
    awaitingDeleteScan,
    toggleDeleteMode,
    handleCancelDeleteMode,
  ]);

  const handleQuickCashSale = () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío — agrega productos primero');
      return;
    }
    openPayment('cash');
  };

  const paymentProps = {
    total,
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
        const effectiveNcfType = fiscalInvoice?.ncfType ?? (fiscalEnabled ? selectedNcfType : null);
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
          // Con Supabase el RPC asigna NCF si hay tipo_ncf; no pasar NCF previo.
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

        // Contador local de ventas de combo solo en modo offline
        if (!isSupabaseConfigured()) {
          activeItems.forEach((cartItem) => {
            if (cartItem.isCombo && cartItem.comboId) {
              const combo = getCombos().find((c) => c.id === cartItem.comboId);
              if (combo) {
                recordComboSale(combo, cartItem.qty, activeCash.label);
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
            issueTime: fiscalInvoice?.issueTime || new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
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
            /* no bloquear venta si falla el registro fiscal auxiliar */
          }
          setLastFiscalInvoice(finalInvoice);
          toast.success(`Venta completada — Factura: ${resultado.numero_factura} ${finalInvoice.ncf ? `(NCF: ${finalInvoice.ncf})` : ''}`);
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
    onNewSale: clearCart,
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 dark:bg-slate-950 p-2 sm:p-3 overflow-y-auto">
      {!(
        paymentOpen ||
        expenseOpen ||
        holdOpen ||
        scaleOpen ||
        returnOpen ||
        cashSwitchOpen ||
        registerDetailsOpen ||
        openCashModalOpen ||
        closeCashModalOpen ||
        weightScanOpen ||
        lastFiscalInvoice
      ) && (
      <>
      {/* Top Header */}
      <POSHeader
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        total={total}
        heldCount={heldSales.length}
        awaitingDelete={awaitingDeleteScan}
        onToggleDeleteMode={toggleDeleteMode}
        cashLabel={activeCash.label}
        cashierName={activeCash.cashier}
        isRemoteAdmin={isRemoteAdmin}
        onClear={clearCart}
        onHold={() => setHoldOpen(true)}
        onExpense={() => setExpenseOpen(true)}
        onReturn={() => setReturnOpen(true)}
        onCancelDelete={handleCancelDeleteMode}
        onSwitchCash={() => setCashSwitchOpen(true)}
        onOpenRegisterDetails={() => setRegisterDetailsOpen(true)}
        cashIsOpen={cashIsOpen}
        onOpenCash={() => setOpenCashModalOpen(true)}
        onCloseCash={() => setCloseCashModalOpen(true)}
      />

      {/* Main Grid: Left Panel (Cart) & Right Panel (Products Catalog) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
        {/* Left Column: Cart & Input Area (58% / 7 cols) */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden h-full">
          <CartPanel
            cart={cart}
            customer={selectedCustomer}
            onSetCustomer={(c) => {
              setSelectedCustomer(c);
              if (c?.tipo_ncf) {
                setSelectedNcfType(c.tipo_ncf as NCFType);
              } else if (c?.rnc_cedula) {
                setSelectedNcfType('B01');
              }
            }}
            selectedNcfType={selectedNcfType}
            onSelectNcfType={(t) => {
              setSelectedNcfType(t);
              setFiscalEnabled(true);
            }}
            onUpdateQty={updateQty}
            onUpdateDiscount={updateDiscount}
            onRemove={removeFromCart}
            onEditWeight={(item) => handleOpenScale(item.productId, item.qty)}
            onOpenWeightScan={() => setWeightScanOpen(true)}
            globalDiscount={globalDiscount}
            onSetGlobalDiscount={setGlobalDiscount}
            subtotal={subtotal}
            taxTotal={taxTotal}
            globalDiscountAmount={globalDiscountAmount}
            total={total}
            onCheckout={() => openPayment()}
            fiscalEnabled={fiscalEnabled}
            onToggleFiscal={() => setFiscalEnabled((prev) => !prev)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            onAddToCart={addToCart}
            awaitingDelete={awaitingDeleteScan}
            onToggleDeleteMode={toggleDeleteMode}
            onCancelDelete={handleCancelDeleteMode}
            onToggleWholesale={toggleWholesalePrice}
            onToggleAllWholesale={toggleAllWholesale}
          />
        </div>

        {/* Right Column: Products Catalog (42% / 5 cols) */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden h-full">
          <ProductPanel
            onAddToCart={addToCart}
            onOpenScale={handleOpenScale}
            awaitingDelete={awaitingDeleteScan}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* Bottom Bar: Supermarket Sticky Payment Bar (Matches Reference Image) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md px-4 py-2.5 mt-2.5 flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Left Action Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => {
              if (cart.length === 0) {
                toast.error('Agrega productos para crear una preventa');
                return;
              }
              setHoldOpen(true);
              toast.info('Guarda la preventa como venta suspendida');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <FileText size={15} className="text-sky-500" strokeWidth={2.3} />
            <span>Preventa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void (async () => {
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
              })();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <FileText size={15} className="text-amber-500" strokeWidth={2.3} />
            <span>Cotización</span>
          </button>

          <button
            type="button"
            onClick={() => setHoldOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Pause size={15} className="text-red-500" strokeWidth={2.5} />
            <span>Suspender</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cart.length === 0) {
                toast.error('El carrito está vacío');
                return;
              }
              if (!selectedCustomer) {
                toast.error('Selecciona un cliente para venta a crédito');
                return;
              }
              setPreferredPayMethod('credit');
              openPayment('credit');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CheckCircle size={15} className="text-indigo-600" strokeWidth={2.3} />
            <span>Venta a crédito</span>
          </button>

          <button
            type="button"
            onClick={() => openPayment('card')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CreditCard size={15} className="text-pink-500" strokeWidth={2.3} />
            <span>Tarjeta</span>
          </button>
        </div>

        {/* Center Main Payment Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Pago múltiple (Dark Navy) */}
          <button
            type="button"
            onClick={() => openPayment('split')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0e2942] hover:bg-[#081d30] text-white font-extrabold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <ShoppingBag size={16} strokeWidth={2.3} />
            <span>Pago múltiple</span>
          </button>

          {/* Efectivo (Green) */}
          <button
            type="button"
            onClick={handleQuickCashSale}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Banknote size={17} strokeWidth={2.3} />
            <span>Efectivo</span>
          </button>

          {/* Factura Fiscal Button */}
          <button
            type="button"
            onClick={() => {
              const next = !fiscalEnabled;
              setFiscalEnabled(next);
              if (next) {
                toast.info('Factura Fiscal (NCF) activada para esta venta');
              } else {
                toast.info('Factura Fiscal desactivada');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border cursor-pointer ${
              fiscalEnabled
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
            title={fiscalEnabled ? 'NCF Activado' : 'NCF Desactivado'}
          >
            <FileText size={15} className={fiscalEnabled ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'} />
            <span className="hidden sm:inline">NCF</span>
            <span className={`px-1 py-0.2 text-[9px] rounded font-black ${fiscalEnabled ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {fiscalEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Cancelar (Red) */}
          <button
            type="button"
            onClick={clearCart}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] text-white font-extrabold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <XCircle size={16} strokeWidth={2.3} />
            <span>Cancelar</span>
          </button>
        </div>

        {/* Right Total Payable (Matches Reference UI) */}
        <div className="flex items-center gap-3 pl-3">
          <div className="flex flex-col text-right leading-tight">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Total</span>
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Payable:</span>
          </div>
          <span className="text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white tracking-tight">
            {total.toFixed(2)}
          </span>
        </div>
      </div>

      </>
      )}

      {/* Payment Drawer / Modal when clicking Efectivo or Pago Múltiple */}
      {paymentOpen && (
        <div className="dialog-inline-host">
          <div
            className={`w-full ${
              orderCompleted ? 'max-w-4xl' : 'max-w-2xl'
            } bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden max-h-[94vh] flex flex-col transition-all duration-300`}
          >
            <PaymentPanel {...paymentProps} onClose={() => setPaymentOpen(false)} />
          </div>
        </div>
      )}

      {expenseOpen && (
        <PosExpenseModal
          onClose={() => setExpenseOpen(false)}
          cajaId={String(activeCashId)}
          cashierLabel={activeCash.label}
        />
      )}
      {holdOpen && (
        <PosHoldModal
          heldSales={heldSales}
          canHold={cart.length > 0}
          onHold={holdCurrentSale}
          onResume={resumeHeldSale}
          onDelete={(id) => {
            removeHeldSale(id);
            refreshHeld();
            toast.success('Venta pausada eliminada');
          }}
          onClose={() => setHoldOpen(false)}
        />
      )}
      {scaleOpen && (
        <PosScaleModal
          initialProductId={scaleParams?.productId}
          initialWeight={scaleParams?.weight}
          onClose={() => setScaleOpen(false)}
          onConfirm={(item, qty) => {
            addToCart(item, qty);
            setScaleOpen(false);
          }}
        />
      )}
      {returnOpen && <PosReturnModal onClose={() => setReturnOpen(false)} />}
      {cashSwitchOpen && (
        <PosCashSwitchModal
          currentId={activeCashId}
          onSelect={(id) => {
            const target = registers.find((c) => c.id === id);
            if (!isAdminUser && target?.isAdminBox) {
              toast.error('Solo el administrador puede entrar a la caja principal');
              return;
            }
            setActiveCashId(id);
            void refetchRegisters();
          }}
          onClose={() => {
            setCashSwitchOpen(false);
            void refetchRegisters();
          }}
        />
      )}
      {registerDetailsOpen && (
        <RegisterDetailsModal
          onClose={() => setRegisterDetailsOpen(false)}
          cajaId={String(activeCashId)}
          cajaLabel={activeCash.label}
          includeUserSales={isAdminUser}
        />
      )}
      {lastFiscalInvoice && (
        <FiscalInvoiceModal
          invoice={lastFiscalInvoice}
          onClose={() => setLastFiscalInvoice(null)}
        />
      )}
      {openCashModalOpen && (
        <PosCashOpenModal
          initialCajaId={String(activeCash.dbId || activeCashId)}
          onSuccess={(cierre) => {
            setShiftClosedLocally(false);
            setShiftOpenedLocally(true);
            if (cierre?.caja_id) setActiveCashId(cierre.caja_id);
            void refetchRegisters();
          }}
          onClose={() => setOpenCashModalOpen(false)}
        />
      )}
      {closeCashModalOpen && (
        <PosCashCloseModal
          initialCajaId={String(activeCash.dbId || activeCashId)}
          onSuccess={() => {
            setShiftOpenedLocally(false);
            setShiftClosedLocally(true);
            markRegisterClosed(String(activeCash.dbId || activeCashId));
            clearCart();
            setPaymentOpen(false);
            setOrderCompleted(false);
            setLastPayments(null);
            setLastFiscalInvoice(null);
            clearHeldSales();
            refreshHeld();
            void refetchRegisters();
            toast.success('Cierre registrado. Ya puedes iniciar caja de nuevo.');
          }}
          onClose={() => setCloseCashModalOpen(false)}
        />
      )}
      {weightScanOpen && (
        <PosWeightScanModal
          catalog={realScaleCatalog}
          onConfirm={(matchedProduct, weight) => {
            addToCart(
              {
                id: `cart-${matchedProduct.productId}-${Date.now()}`,
                productId: matchedProduct.productId,
                name: matchedProduct.name,
                sku: matchedProduct.sku,
                price: matchedProduct.price,
                regularPrice: matchedProduct.price,
                wholesalePrice: matchedProduct.wholesalePrice,
                isWholesale: false,
                cost: matchedProduct.cost,
                tax: matchedProduct.tax,
                image: matchedProduct.image || '',
                unit: matchedProduct.unit || 'lb',
                isWeighted: true,
              },
              weight
            );
          }}
          onClose={() => setWeightScanOpen(false)}
        />
      )}
    </div>
  );
}
