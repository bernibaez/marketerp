import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import POSHeader from './POSHeader';
import ProductPanel from './ProductPanel';
import CartPanel from './CartPanel';
import PaymentPanel from './PaymentPanel';
import { POSBottomBar } from './POSBottomBar';
import { POSModals } from './POSModals';
import { usePOSCart } from '../hooks/usePOSCart';

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
import { initialProducts } from '@/lib/initialProducts';
import { parseScaleBarcode } from '../utils/scaleUtils';
import { decodeVariableWeightBarcode, isVariableWeightBarcode, productMatchesScanCode } from '@/lib/scaleBarcode';
import { buscarProductoPorCodigoEscaneado, productoAUi } from '@/services/productos.service';

const ADMIN_OWN_CASH: CashRegisterId = '1';
const DEFAULT_CASHIER_CASH: CashRegisterId = '2';

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

  // Cart & calculations hook
  const {
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
    removeFromCart,
    clearCart,
    toggleWholesalePrice,
    toggleAllWholesale,
    subtotal,
    globalDiscountAmount,
    taxTotal,
    total,
  } = usePOSCart();

  // Payment Drawer state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [preferredPayMethod, setPreferredPayMethod] = useState<'cash' | 'card' | 'transfer' | 'credit' | 'split' | undefined>();
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [, setLastPayments] = useState<PaymentSplit | null>(null);
  const [, setLastSaleResult] = useState<{ venta_id: string; numero_factura: string; ncf?: string | null } | null>(null);

  // Modals state
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleParams, setScaleParams] = useState<{ productId?: string; weight?: number } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [registerDetailsOpen, setRegisterDetailsOpen] = useState(false);
  const [lastFiscalInvoice, setLastFiscalInvoice] = useState<FiscalInvoiceRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenScale = (productId?: string, weight?: number) => {
    setScaleParams(productId || weight ? { productId, weight } : null);
    setScaleOpen(true);
  };

  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => getHeldSales());
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

  // Keyboard Shortcuts Listener
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

  const handleCreateQuote = async () => {
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
            /* no bloquear venta */
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

  const isAnyModalOpen =
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
    Boolean(lastFiscalInvoice);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 dark:bg-slate-950 p-2 sm:p-3 overflow-y-auto">
      {!isAnyModalOpen && (
        <>
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

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
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

          <POSBottomBar
            total={total}
            cartCount={cart.reduce((s, i) => s + i.qty, 0)}
            selectedCustomer={selectedCustomer}
            fiscalEnabled={fiscalEnabled}
            onToggleFiscal={() => {
              const next = !fiscalEnabled;
              setFiscalEnabled(next);
              if (next) {
                toast.info('Factura Fiscal (NCF) activada para esta venta');
              } else {
                toast.info('Factura Fiscal desactivada');
              }
            }}
            onQuickCash={handleQuickCashSale}
            onCardPayment={() => openPayment('card')}
            onSplitPayment={() => openPayment('split')}
            onCreditPayment={() => {
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
            onClearCart={clearCart}
            onOpenHold={() => setHoldOpen(true)}
            onCreateQuote={handleCreateQuote}
            onCreatePreSale={() => {
              if (cart.length === 0) {
                toast.error('Agrega productos para crear una preventa');
                return;
              }
              setHoldOpen(true);
              toast.info('Guarda la preventa como venta suspendida');
            }}
          />
        </>
      )}

      {/* Payment Drawer */}
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

      {/* Auxiliary Modals */}
      <POSModals
        expenseOpen={expenseOpen}
        onCloseExpense={() => setExpenseOpen(false)}
        activeCashId={activeCashId}
        activeCashLabel={activeCash.label}
        activeCashDbId={activeCash.dbId}

        holdOpen={holdOpen}
        onCloseHold={() => setHoldOpen(false)}
        heldSales={heldSales}
        canHold={cart.length > 0}
        onHoldCurrent={holdCurrentSale}
        onResumeHeld={resumeHeldSale}
        onDeleteHeld={(id) => {
          removeHeldSale(id);
          refreshHeld();
          toast.success('Venta pausada eliminada');
        }}

        scaleOpen={scaleOpen}
        onCloseScale={() => setScaleOpen(false)}
        scaleParams={scaleParams}
        onConfirmScale={(item, qty) => {
          addToCart(item, qty);
          setScaleOpen(false);
        }}

        returnOpen={returnOpen}
        onCloseReturn={() => setReturnOpen(false)}

        cashSwitchOpen={cashSwitchOpen}
        onCloseCashSwitch={() => {
          setCashSwitchOpen(false);
          void refetchRegisters();
        }}
        onSelectCashRegister={(id) => {
          const target = registers.find((c) => c.id === id);
          if (!isAdminUser && target?.isAdminBox) {
            toast.error('Solo el administrador puede entrar a la caja principal');
            return;
          }
          setActiveCashId(id);
          void refetchRegisters();
        }}
        registers={registers}
        isAdminUser={isAdminUser}

        registerDetailsOpen={registerDetailsOpen}
        onCloseRegisterDetails={() => setRegisterDetailsOpen(false)}

        lastFiscalInvoice={lastFiscalInvoice}
        onCloseFiscalInvoice={() => setLastFiscalInvoice(null)}

        openCashModalOpen={openCashModalOpen}
        onCloseOpenCash={() => setOpenCashModalOpen(false)}
        onSuccessOpenCash={(cierre) => {
          setShiftClosedLocally(false);
          setShiftOpenedLocally(true);
          if (cierre?.caja_id) setActiveCashId(cierre.caja_id);
          void refetchRegisters();
        }}

        closeCashModalOpen={closeCashModalOpen}
        onCloseCloseCash={() => setCloseCashModalOpen(false)}
        onSuccessCloseCash={() => {
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

        weightScanOpen={weightScanOpen}
        onCloseWeightScan={() => setWeightScanOpen(false)}
        realScaleCatalog={realScaleCatalog}
        onConfirmWeightScan={(matchedProduct, weight) => {
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
      />
    </div>
  );
}
