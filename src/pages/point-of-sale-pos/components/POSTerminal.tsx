import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from '@/lib/toast';
import { RotateCcw } from 'lucide-react';
import POSHeader from './POSHeader';
import ProductPanel from './ProductPanel';
import CartPanel from './CartPanel';
import PaymentPanel from './PaymentPanel';
import { POSBottomBar } from './POSBottomBar';
import { POSModals } from './POSModals';
import PosCashOpenModal from './PosCashOpenModal';
import PosProductDiscountModal, { type PosProductDiscountData } from './PosProductDiscountModal';
import PosEditPriceModal from './PosEditPriceModal';
import SupervisorAuthModal from './SupervisorAuthModal';
import { isAdminOrSuperAdmin, canChangePrice, type AuthUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/auditStore';

import { usePOSCart } from '../hooks/usePOSCart';
import { usePOSHeldSales } from '../hooks/usePOSHeldSales';
import { usePOSCheckout } from '../hooks/usePOSCheckout';
import { usePOSScanner } from '../hooks/usePOSScanner';

import { findCashRegister, getCashRegister, type CashRegisterId, type CashRegisterSession } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import type { NCFType } from '@/lib/ncfStore';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProductos } from '@/hooks/useProductos';
import { useCombos } from '@/hooks/useCombos';
import { syncInvoiceSettingsFromSupabase } from '@/lib/invoiceSettingsStore';
import { buildPosCatalogIndex } from '../utils/posCatalogIndex';
import { createPOSSearchStore } from '../utils/posSearchStore';
import { hayCatalogoProductosEnCache, type StockDelta } from '@/services/productos.service';
import {
  markPosOpenReady,
  markPosOpenStart,
  posPerfNow,
  recordPostSaleReady,
} from '@/lib/posPerfMetrics';

const ADMIN_OWN_CASH: CashRegisterId = '1';

function resolvePreferredBoxId(
  regs: CashRegisterSession[],
  isAdmin: boolean,
  uName?: string,
  uId?: string,
  currentId?: string
): CashRegisterId {
  if (regs.length === 0) return (currentId as CashRegisterId) || '1';

  // 1. Si es admin, seleccionar caja de administración
  if (isAdmin) {
    const adminBox = regs.find((c) => c.isAdminBox || c.label.toLowerCase().includes('admin'));
    if (adminBox) return adminBox.id;
  }

  // 2. Si el nombre del usuario coincide con una caja (ej: Cheila, Valentina, Eroly, Beiliz, Elizabeth, Keyla)
  if (uName) {
    const norm = uName.trim().toLowerCase();
    const byName = regs.find((c) => !c.isAdminBox && (
      c.label.toLowerCase().includes(norm) || norm.includes(c.label.toLowerCase())
    ));
    if (byName) return byName.id;
  }

  // 3. Si el usuario ya tiene un turno abierto
  const openBox = regs.find(
    (c) =>
      c.open &&
      !c.isAdminBox &&
      ((c.cashierId && uId && String(c.cashierId) === String(uId)) ||
        (c.cashier && uName && c.cashier.trim().toLowerCase() === uName.trim().toLowerCase()))
  );
  if (openBox) return openBox.id;

  // 4. Si la caja actual es operativa y válida, conservarla
  if (currentId) {
    const curr = regs.find((c) => c.id === currentId);
    if (curr && !curr.isAdminBox) return curr.id;
  }

  // 5. Primera caja operativa disponible (no admin)
  const firstFree = regs.find((c) => !c.isAdminBox && !c.open);
  if (firstFree) return firstFree.id;

  const firstNonAdmin = regs.find((c) => !c.isAdminBox);
  return firstNonAdmin?.id || regs[0]?.id || '1';
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
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  professionalDiscount?: number;
  tax: number;
  image: string;
  unit: string;
  isWeighted?: boolean;
  isCombo?: boolean;
  comboId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comboItems?: any[];
  stock?: number;
  currentStock?: number;
  producto_base_id?: string | null;
  factor_conversion?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composite_items?: any[];
  isCustomPrice?: boolean;
  originalPrice?: number;
  priceChangeReason?: string;
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdminUser = isAdminOrSuperAdmin(user);
  const [wasCatalogCacheHit] = useState<boolean>(() => {
    markPosOpenStart();
    return hayCatalogoProductosEnCache('activo');
  });
  const { registers, loading: registersLoading, refetch: refetchRegisters, markRegisterClosed, recordSaleOnRegister } = useCashRegisters();

  // 1. Data Catalogs (carga inicial rápida progresiva + índice O(n) + store externo)
  const { productosUi, loading: productosLoading, applyStockDeltas } = useProductos({
    pagina: 1,
    limite: 5000,
    progressiveInitialLimit: 250,
    estado: 'activo',
  });
  const { combos } = useCombos(true);
  const catalogIndex = useMemo(
    () => buildPosCatalogIndex(productosUi, !productosLoading),
    [productosUi, productosLoading]
  );
  const searchStore = useMemo(() => createPOSSearchStore(), []);

  useEffect(() => {
    if (!registersLoading && !productosLoading) {
      markPosOpenReady({
        catalogCount: productosUi.length,
        cacheHit: wasCatalogCacheHit,
      });
    }
  }, [registersLoading, productosLoading, productosUi.length, wasCatalogCacheHit]);

  // 2. Cart & Calculations Hook
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
    updateItemPrice,
    updateItemDiscountAndPrice,
    removeFromCart,
    clearCart,
    toggleWholesalePrice,
    toggleAllWholesale,
    isWholesaleMode,
    subtotal,
    globalDiscountAmount,
    taxTotal,
    total,
  } = usePOSCart();

  // 3. Cash Session State
  const [activeCashId, setActiveCashId] = useState<CashRegisterId>(() =>
    isAdminUser ? '4' : '1'
  );
  const [shiftOpenedLocally, setShiftOpenedLocally] = useState(false);
  const [shiftClosedLocally, setShiftClosedLocally] = useState(false);

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase();
  }, []);

  useEffect(() => {
    if (registers.length === 0) return;
    const targetId = resolvePreferredBoxId(registers, isAdminUser, user?.name, user?.id, activeCashId);
    if (targetId && targetId !== activeCashId) {
      setActiveCashId(targetId);
    }
  }, [isAdminUser, registers, user?.id, user?.name]);

  const activeCashSession = findCashRegister(registers, activeCashId);
  const activeCash = activeCashSession || getCashRegister(activeCashId);

  // Determinar si la sesión de la caja activa pertenece al usuario actual
  const isMyOpenSession = Boolean(
    activeCashSession?.open &&
      ((activeCashSession.cashierId && user?.id && String(activeCashSession.cashierId) === String(user.id)) ||
        (user?.name &&
          activeCashSession.cashier &&
          activeCashSession.cashier.trim().toLowerCase() === user.name.trim().toLowerCase()))
  );

  // Para cajero regular: si la caja activa pertenece a otro cajero, no se considera abierta para el usuario actual
  const isCajaBelongingToOtherCashier =
    !isAdminUser &&
    Boolean(activeCashSession?.open) &&
    !isMyOpenSession &&
    !shiftOpenedLocally;

  const cashIsOpen =
    !shiftClosedLocally &&
    !isCajaBelongingToOtherCashier &&
    (isMyOpenSession || shiftOpenedLocally || (isAdminUser && Boolean(activeCashSession?.open)));
  const isRemoteAdmin = isAdminUser && !activeCash.isAdminBox;

  // 4. Held Sales Hook
  const {
    holdOpen,
    setHoldOpen,
    heldSales,
    refreshHeld,
    holdCurrentSale,
    resumeHeldSale,
    deleteHeldSale,
    clearAllHeld,
  } = usePOSHeldSales({
    cart,
    selectedCustomer,
    globalDiscount,
    total,
    user,
    activeCashRegister: activeCash ? { id: activeCash.id, label: activeCash.label } : null,
    setCart,
    setSelectedCustomer,
    setGlobalDiscount,
    clearCart,
  });

  // 5. Checkout & Payment Hook (actualización incremental post-venta sin recargar 5,000 productos ni 500 ventas)
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const selectedCustomerRef = useRef(selectedCustomer);
  selectedCustomerRef.current = selectedCustomer;
  const fiscalEnabledRef = useRef(fiscalEnabled);
  fiscalEnabledRef.current = fiscalEnabled;

  const handleSaleSuccess = useCallback(
    ({ saleTotal, stockDeltas }: { saleTotal: number; stockDeltas: StockDelta[] }) => {
      const t0 = posPerfNow();
      recordSaleOnRegister(activeCashId, activeCash.cierreId, saleTotal);
      applyStockDeltas(stockDeltas);
      recordPostSaleReady(posPerfNow() - t0, {
        deltaCount: stockDeltas.length,
        skippedFullCatalogReload: true,
        skippedFullRegisterReload: true,
      });
    },
    [recordSaleOnRegister, activeCashId, activeCash.cierreId, applyStockDeltas]
  );

  const {
    paymentOpen,
    setPaymentOpen,
    setPreferredPayMethod,
    orderCompleted,
    lastFiscalInvoice,
    setLastFiscalInvoice,
    openPayment,
    closePayment,
    handleQuickCashSale,
    handleCreateQuote,
    paymentProps,
    resetOrderState,
  } = usePOSCheckout({
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
    activeCashLabel: activeCash.label,
    activeCashSessionId: activeCash.cierreId,
    activeCashCashierId: activeCashSession?.open ? activeCashSession.cashierId : undefined,
    activeCashCashierName: activeCashSession?.open ? activeCashSession.cashier : undefined,
    user,
    combos,
    clearCart,
    navigate,
    onSaleSuccess: handleSaleSuccess,
  });

  // 6. Auxiliary Modals State
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleParams, setScaleParams] = useState<{
    productId?: string;
    weight?: number;
    product?: any;
    replaceExisting?: boolean;
  } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [registerDetailsOpen, setRegisterDetailsOpen] = useState(false);
  const [cashSwitchOpen, setCashSwitchOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [closeCashModalOpen, setCloseCashModalOpen] = useState(false);
  const [weightScanOpen, setWeightScanOpen] = useState(false);

  const handleOpenScale = useCallback(
    (productId?: string | any, weight?: number, product?: any, replaceExisting?: boolean) => {
      let actualProductId = typeof productId === 'string' ? productId : undefined;
      let actualProduct = product;
      let actualWeight = weight;
      let actualReplace = replaceExisting;

      if (productId && typeof productId === 'object') {
        actualProduct = productId;
        actualProductId = productId.productId || productId.id;
        actualWeight = weight !== undefined ? weight : (productId.qty ?? 1.0);
        actualReplace = replaceExisting !== undefined ? replaceExisting : true;
      }

      const existingInCart = actualProductId
        ? cartRef.current.find(
            (i) =>
              i.productId === actualProductId ||
              (actualProduct?.sku && i.sku && i.sku.toLowerCase() === String(actualProduct.sku).toLowerCase())
          )
        : undefined;
      const effectiveWeight = actualWeight !== undefined ? actualWeight : existingInCart?.qty ?? 1.0;
      const effectiveProduct = actualProduct || existingInCart;
      setScaleParams(
        actualProductId || effectiveWeight || effectiveProduct
          ? {
              productId: actualProductId,
              weight: effectiveWeight,
              product: effectiveProduct,
              replaceExisting: actualReplace !== undefined ? actualReplace : Boolean(existingInCart),
            }
          : null
      );
      setScaleOpen(true);
    },
    []
  );

  // 7. Scanner, Scale Parser & Global Keyboard Shortcuts Hook
  const { realScaleCatalog, handleSearchSubmit } = usePOSScanner({
    enabled: cashIsOpen,
    cart,
    addToCart,
    isWholesaleMode,
    deductOrRemoveFromCart,
    awaitingDeleteScan,
    toggleDeleteMode,
    handleCancelDeleteMode,
    productosUi,
    catalogIndex,
    searchStore,
    combos,
    orderCompleted,
    paymentOpen,
    setPaymentOpen,
    openPayment,
    closePayment,
    onOpenScale: handleOpenScale,
    clearCart,
  });

  // Modales de Modificación de Precio, Descuento y Autorización de Supervisor
  const [priceEditModalOpen, setPriceEditModalOpen] = useState(false);
  const [priceEditTargetItem, setPriceEditTargetItem] = useState<CartItem | null>(null);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountTargetProduct, setDiscountTargetProduct] = useState<CartItem | null>(null);
  const [supervisorAuthModalOpen, setSupervisorAuthModalOpen] = useState(false);
  const [pendingSupervisorAction, setPendingSupervisorAction] = useState<{
    type: 'price' | 'discount';
    item: CartItem;
  } | null>(null);
  const [authorizedSupervisor, setAuthorizedSupervisor] = useState<AuthUser | null>(null);

  const handleRequestPriceChange = useCallback(
    (item: CartItem) => {
      if (!isAdminUser && !canChangePrice(user)) {
        toast.error('Acceso denegado: Solo el Administrador o Super Administrador pueden cambiar precios de productos.');
        return;
      }
      setAuthorizedSupervisor(user);
      setPriceEditTargetItem(item);
      setPriceEditModalOpen(true);
    },
    [isAdminUser, user]
  );

  const handleOpenCartItemDiscount = useCallback(
    (item: CartItem) => {
      if (isAdminUser) {
        setDiscountTargetProduct(item);
        setDiscountModalOpen(true);
      } else {
        setPendingSupervisorAction({ type: 'discount', item });
        setSupervisorAuthModalOpen(true);
      }
    },
    [isAdminUser]
  );

  const handleSupervisorAuthorized = (adminUser: AuthUser) => {
    setAuthorizedSupervisor(adminUser);
    if (!pendingSupervisorAction) return;

    if (pendingSupervisorAction.type === 'price') {
      setPriceEditTargetItem(pendingSupervisorAction.item);
      setPriceEditModalOpen(true);
    } else if (pendingSupervisorAction.type === 'discount') {
      setDiscountTargetProduct(pendingSupervisorAction.item);
      setDiscountModalOpen(true);
    }
    setPendingSupervisorAction(null);
  };

  const handleConfirmPriceChange = (cartItemId: string, newPrice: number, reason?: string) => {
    if (!isAdminUser && !canChangePrice(user) && !canChangePrice(authorizedSupervisor)) {
      toast.error('No tienes permiso para modificar precios.');
      return;
    }
    const item = cart.find((i) => i.id === cartItemId);
    const oldPrice = item ? item.price : 0;

    updateItemPrice(cartItemId, newPrice, reason);

    const supervisorName = authorizedSupervisor?.name || user?.name || 'Administrador';
    const supervisorRole = authorizedSupervisor?.role || user?.role || 'Administrador';

    toast.success(`Precio de "${item?.name || 'producto'}" actualizado a RD$ ${newPrice.toFixed(2)}`);

    logAuditEvent({
      user: supervisorName,
      role: supervisorRole,
      action: 'Cambio de precio',
      module: 'POS',
      details: `Modificación de precio en POS: "${item?.name}" (SKU: ${item?.sku}) de RD$ ${oldPrice.toFixed(2)} a RD$ ${newPrice.toFixed(2)}${
        reason ? ` | Motivo: ${reason}` : ''
      }${authorizedSupervisor && authorizedSupervisor.id !== user?.id ? ` | Autorizado por: ${authorizedSupervisor.name}` : ''}`,
      before: { price: oldPrice },
      after: { price: newPrice, reason },
    });

    setPriceEditModalOpen(false);
    setPriceEditTargetItem(null);
  };

  const handleConfirmDiscount = (data: PosProductDiscountData) => {
    if (!discountTargetProduct) return;

    updateItemDiscountAndPrice(discountTargetProduct.id, {
      price: data.price,
      qty: data.qty,
      discountType: data.discountType,
      discountValue: data.discountValue,
      professionalDiscount: data.professionalDiscount,
    });
    toast.success(`Descuento y precio actualizados para "${discountTargetProduct.name}"`);
    setDiscountModalOpen(false);
    setDiscountTargetProduct(null);
  };

  const handleOpenHold = useCallback(() => setHoldOpen(true), []);
  const handleOpenExpense = useCallback(() => setExpenseOpen(true), []);
  const handleOpenReturn = useCallback(() => setReturnOpen(true), []);
  const handleSwitchCash = useCallback(() => setCashSwitchOpen(true), []);
  const handleOpenRegisterDetails = useCallback(() => setRegisterDetailsOpen(true), []);
  const handleOpenCash = useCallback(() => setOpenCashModalOpen(true), []);
  const handleCloseCash = useCallback(() => setCloseCashModalOpen(true), []);
  const handleOpenWeightScan = useCallback(() => setWeightScanOpen(true), []);

  const handleSetCustomer = useCallback(
    (c: Customer | null) => {
      setSelectedCustomer(c);
      if (c?.tipo_ncf) {
        setSelectedNcfType(c.tipo_ncf as NCFType);
      } else if (c?.rnc_cedula) {
        setSelectedNcfType('B01');
      }
    },
    [setSelectedCustomer, setSelectedNcfType]
  );

  const handleSelectNcfType = useCallback(
    (t: NCFType) => {
      setSelectedNcfType(t);
      setFiscalEnabled(true);
    },
    [setSelectedNcfType, setFiscalEnabled]
  );

  const handleEditWeight = useCallback(
    (item: CartItem) => handleOpenScale(item.productId, item.qty, item, true),
    [handleOpenScale]
  );

  const handleOpenCheckout = useCallback(() => openPayment(), [openPayment]);
  const handleToggleFiscal = useCallback(() => setFiscalEnabled((prev) => !prev), [setFiscalEnabled]);

  const handleToggleFiscalToast = useCallback(() => {
    const next = !fiscalEnabledRef.current;
    setFiscalEnabled(next);
    if (next) {
      toast.info('Factura Fiscal (NCF) activada para esta venta');
    } else {
      toast.info('Factura Fiscal desactivada');
    }
  }, [setFiscalEnabled]);

  const handleCardPayment = useCallback(() => openPayment('card'), [openPayment]);
  const handleSplitPayment = useCallback(() => openPayment('split'), [openPayment]);
  const handleCreditPayment = useCallback(() => {
    if (cartRef.current.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }
    if (!selectedCustomerRef.current) {
      toast.error('Selecciona un cliente para venta a crédito');
      return;
    }
    setPreferredPayMethod('credit');
    openPayment('credit');
  }, [setPreferredPayMethod, openPayment]);

  const handleCreatePreSale = useCallback(() => {
    if (cartRef.current.length === 0) {
      toast.error('Agrega productos para crear una preventa');
      return;
    }
    setHoldOpen(true);
    toast.info('Guarda la preventa como venta suspendida');
  }, []);

  const cartItemsCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

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
    discountModalOpen ||
    priceEditModalOpen ||
    supervisorAuthModalOpen ||
    Boolean(lastFiscalInvoice);

  return (
    <div className="relative flex flex-col h-screen w-full bg-slate-100 dark:bg-slate-950 p-2 sm:p-3 overflow-hidden select-none">
      {/* 1. Interfaz Principal del POS (se desenfoca y atenúa cuando la caja no está abierta o hay un modal) */}
      <div
        className={`flex flex-col h-full w-full transition-all duration-500 ease-out ${
          !cashIsOpen || isAnyModalOpen
            ? 'filter blur-md pointer-events-none opacity-40 scale-[0.99] grayscale-[15%]'
            : ''
        }`}
        aria-hidden={!cashIsOpen || isAnyModalOpen}
      >
        <POSHeader
          cartCount={cartItemsCount}
          total={total}
          heldCount={heldSales.length}
          awaitingDelete={awaitingDeleteScan}
          onToggleDeleteMode={toggleDeleteMode}
          cashLabel={activeCash.label}
          cashierName={user?.name || activeCash.cashier || 'Cajero'}
          isRemoteAdmin={isRemoteAdmin}
          onClear={clearCart}
          onHold={handleOpenHold}
          onExpense={handleOpenExpense}
          onReturn={handleOpenReturn}
          onCancelDelete={handleCancelDeleteMode}
          onSwitchCash={handleSwitchCash}
          onOpenRegisterDetails={handleOpenRegisterDetails}
          cashIsOpen={cashIsOpen}
          onOpenCash={handleOpenCash}
          onCloseCash={handleCloseCash}
        />

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden min-h-0">
          <div className="lg:col-span-7 flex flex-col overflow-hidden h-full">
            <CartPanel
              cart={cart}
              customer={selectedCustomer}
              onSetCustomer={handleSetCustomer}
              selectedNcfType={selectedNcfType}
              onSelectNcfType={handleSelectNcfType}
              onUpdateQty={updateQty}
              onUpdateDiscount={updateDiscount}
              onRemove={removeFromCart}
              onEditWeight={handleEditWeight}
              onOpenWeightScan={handleOpenWeightScan}
              globalDiscount={globalDiscount}
              onSetGlobalDiscount={setGlobalDiscount}
              subtotal={subtotal}
              taxTotal={taxTotal}
              globalDiscountAmount={globalDiscountAmount}
              total={total}
              onCheckout={handleOpenCheckout}
              fiscalEnabled={fiscalEnabled}
              onToggleFiscal={handleToggleFiscal}
              onSearchSubmit={handleSearchSubmit}
              onAddToCart={addToCart}
              awaitingDelete={awaitingDeleteScan}
              onToggleDeleteMode={toggleDeleteMode}
              onCancelDelete={handleCancelDeleteMode}
              onToggleWholesale={toggleWholesalePrice}
              onToggleAllWholesale={toggleAllWholesale}
              isWholesaleMode={isWholesaleMode}
              onOpenDiscountModal={handleOpenCartItemDiscount}
              onOpenPriceModal={handleRequestPriceChange}
              isAdmin={isAdminUser}
              catalogProducts={productosUi}
              catalogIndex={catalogIndex}
              searchStore={searchStore}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col overflow-hidden h-full">
            <ProductPanel
              onAddToCart={addToCart}
              onOpenScale={handleOpenScale}
              awaitingDelete={awaitingDeleteScan}
              catalogIndex={catalogIndex}
              combos={combos}
              searchStore={searchStore}
              catalogLoading={productosLoading}
            />
          </div>
        </div>

        <POSBottomBar
          total={total}
          cartCount={cartItemsCount}
          selectedCustomer={selectedCustomer}
          fiscalEnabled={fiscalEnabled}
          onToggleFiscal={handleToggleFiscalToast}
          onQuickCash={handleQuickCashSale}
          onCardPayment={handleCardPayment}
          onSplitPayment={handleSplitPayment}
          onCreditPayment={handleCreditPayment}
          onClearCart={clearCart}
          onOpenHold={handleOpenHold}
          onCreateQuote={handleCreateQuote}
          onCreatePreSale={handleCreatePreSale}
        />
      </div>

      {/* 2. Pantalla de Verificación o Modal Obligatorio de Apertura de Caja */}
      {registersLoading && !shiftOpenedLocally ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-spin">
              <RotateCcw size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Verificando Turno de Caja</h3>
              <p className="text-xs text-slate-400 mt-1">Comprobando turnos operativos y sesiones...</p>
            </div>
          </div>
        </div>
      ) : !cashIsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-fadeIn">
          <PosCashOpenModal
            isMandatory={true}
            initialCajaId={String(activeCash.dbId || activeCashId)}
            onExit={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            onClose={() => {}}
            onSuccess={(cierre) => {
              setShiftClosedLocally(false);
              setShiftOpenedLocally(true);
              if (cierre?.caja_id) setActiveCashId(cierre.caja_id);
              void refetchRegisters();
            }}
          />
        </div>
      ) : null}

      {/* Payment Drawer */}
      {paymentOpen && (
        <div className="dialog-inline-host">
          <div
            className={`w-full ${
              orderCompleted ? 'max-w-4xl' : 'max-w-2xl'
            } bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden max-h-[94vh] flex flex-col transition-all duration-300`}
          >
            <PaymentPanel key={paymentProps.checkoutSessionId} {...paymentProps} onClose={closePayment} />
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
        activeCashCierreId={activeCash.cierreId}

        holdOpen={holdOpen}
        onCloseHold={() => setHoldOpen(false)}
        heldSales={heldSales}
        canHold={cart.length > 0}
        onHoldCurrent={holdCurrentSale}
        onResumeHeld={resumeHeldSale}
        onDeleteHeld={deleteHeldSale}

        scaleOpen={scaleOpen}
        onCloseScale={() => setScaleOpen(false)}
        scaleParams={scaleParams}
        onConfirmScale={(item, qty) => {
          addToCart(item, qty, scaleParams?.replaceExisting ?? true);
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
        catalogProducts={productosUi}

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
          resetOrderState();
          clearAllHeld();
          refreshHeld();
          void refetchRegisters();
          toast.success('Cierre registrado. Ya puedes iniciar caja de nuevo.');
        }}

        weightScanOpen={weightScanOpen}
        onCloseWeightScan={() => setWeightScanOpen(false)}
        realScaleCatalog={realScaleCatalog}
        onConfirmWeightScan={(matchedProduct, weight) => {
          const shouldWholesale = isWholesaleMode && (matchedProduct.wholesalePrice || 0) > 0;
          const itemPrice = shouldWholesale ? Number(matchedProduct.wholesalePrice) : matchedProduct.price;
          const resolvedUnit = matchedProduct.unit && !['unidad', 'ud', 'und', 'unidades'].includes(matchedProduct.unit.toLowerCase()) ? matchedProduct.unit : 'lb';
          addToCart(
            {
              id: `cart-${matchedProduct.productId}-${Date.now()}`,
              productId: matchedProduct.productId,
              name: matchedProduct.name,
              sku: matchedProduct.sku,
              price: itemPrice,
              regularPrice: matchedProduct.price,
              wholesalePrice: matchedProduct.wholesalePrice,
              isWholesale: shouldWholesale,
              cost: matchedProduct.cost,
              tax: matchedProduct.tax,
              image: matchedProduct.image || '',
              unit: resolvedUnit,
              isWeighted: true,
            },
            weight
          );
        }}
      />

      <PosProductDiscountModal
        open={discountModalOpen}
        onClose={() => {
          setDiscountModalOpen(false);
          setDiscountTargetProduct(null);
        }}
        product={discountTargetProduct}
        onConfirm={handleConfirmDiscount}
        isExistingCartItem={true}
      />

      <PosEditPriceModal
        open={priceEditModalOpen}
        onClose={() => {
          setPriceEditModalOpen(false);
          setPriceEditTargetItem(null);
        }}
        item={priceEditTargetItem}
        onConfirm={handleConfirmPriceChange}
        authorizedBy={authorizedSupervisor?.name}
      />

      <SupervisorAuthModal
        open={supervisorAuthModalOpen}
        onClose={() => {
          setSupervisorAuthModalOpen(false);
          setPendingSupervisorAction(null);
        }}
        onAuthorized={handleSupervisorAuthorized}
        actionDescription={
          pendingSupervisorAction?.type === 'price'
            ? `Cambiar precio de "${pendingSupervisorAction.item.name}"`
            : pendingSupervisorAction?.type === 'discount'
              ? `Aplicar descuento a "${pendingSupervisorAction.item.name}"`
              : undefined
        }
      />
    </div>
  );
}

