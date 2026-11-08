import { useState, useEffect } from 'react';
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

import {
  findCashRegister,
  getCashRegister,
  doesRegisterMatchUser,
  isSameCashierName,
  type CashRegisterId,
  type CashRegisterSession,
} from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import { obtenerSesionAbiertaDeUsuario } from '@/services/cierresCaja.service';
import type { NCFType } from '@/lib/ncfStore';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProductos } from '@/hooks/useProductos';
import { actualizarProducto } from '@/services/productos.service';
import { useCombos } from '@/hooks/useCombos';
import { syncInvoiceSettingsFromSupabase } from '@/lib/invoiceSettingsStore';

const ADMIN_OWN_CASH: CashRegisterId = '1';

function resolvePreferredBoxId(
  regs: CashRegisterSession[],
  isAdmin: boolean,
  uName?: string,
  uId?: string,
  currentId?: string,
  uUsername?: string
): CashRegisterId {
  if (regs.length === 0) return (currentId as CashRegisterId) || '1';

  // 1. Si el usuario ya tiene un turno abierto en cualquier caja, seleccionar esa primero
  const openBox = regs.find(
    (c) =>
      c.open &&
      ((c.cashierId && uId && String(c.cashierId) === String(uId)) ||
        isSameCashierName(c.cashier, uName) ||
        doesRegisterMatchUser(c.label, uName, uUsername))
  );
  if (openBox) return openBox.id;

  // 2. Si el nombre del usuario coincide con una caja
  if (uName || uUsername) {
    const byName = regs.find((c) => !c.isAdminBox && doesRegisterMatchUser(c.label, uName, uUsername));
    if (byName) return byName.id;
  }

  // 3. Si es admin, seleccionar caja de administración o primera abierta
  if (isAdmin) {
    const adminBox = regs.find((c) => c.isAdminBox || c.label.toLowerCase().includes('admin'));
    if (adminBox) return adminBox.id;
  }

  // 4. Primera caja operativa libre que no tenga el nombre propio de otra cajera
  const KNOWN_NAMES = ['keila', 'keyla', 'valentina', 'cheila', 'sheila', 'eroly', 'beiliz', 'beilis', 'elizabeth'];
  const genericFree = regs.find(
    (c) => !c.isAdminBox && !c.open && !KNOWN_NAMES.some((n) => doesRegisterMatchUser(c.label, n))
  );
  if (genericFree) return genericFree.id;

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
  const { registers, loading: registersLoading, refetch: refetchRegisters, markRegisterClosed } = useCashRegisters();

  // 1. Data Catalogs
  const { productosUi, refetch: refetchProductos } = useProductos({ pagina: 1, limite: 5000, estado: 'activo' });
  const { combos } = useCombos(true);

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
  const [pendingPostLoginOpen, setPendingPostLoginOpen] = useState(() => {
    try {
      return sessionStorage.getItem('mercato_pending_cash_open') === 'true';
    } catch {
      return false;
    }
  });
  const [shiftOpenedLocally, setShiftOpenedLocally] = useState(() => {
    try {
      return sessionStorage.getItem('mercato_cash_opened_at_login') === 'true';
    } catch {
      return false;
    }
  });
  const [shiftClosedLocally, setShiftClosedLocally] = useState(false);
  const [checkingExistingSession, setCheckingExistingSession] = useState(true);

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase();
  }, []);

  useEffect(() => {
    if (registers.length === 0) return;
    const targetId = resolvePreferredBoxId(
      registers,
      isAdminUser,
      user?.name,
      user?.id,
      activeCashId,
      user?.username || user?.email
    );
    if (targetId && targetId !== activeCashId) {
      setActiveCashId(targetId);
    }
  }, [isAdminUser, registers, user?.id, user?.name, user?.username, user?.email]);

  const userOpenRegister = registers.find(
    (c) =>
      c.open &&
      ((c.cashierId && user?.id && String(c.cashierId) === String(user.id)) ||
        isSameCashierName(c.cashier, user?.name) ||
        doesRegisterMatchUser(c.label, user?.name, user?.username || user?.email))
  );

  // Si el usuario ya tiene un turno abierto hoy (ej. cambió de máquina o se apagó y prendió la PC),
  // recuperar automáticamente su turno activo sin volver a pedir el fondo inicial (4,000).
  useEffect(() => {
    if (shiftClosedLocally) {
      setCheckingExistingSession(false);
      return;
    }
    if (userOpenRegister) {
      if (userOpenRegister.id !== activeCashId) {
        setActiveCashId(userOpenRegister.id);
      }
      setPendingPostLoginOpen(false);
      setShiftOpenedLocally(true);
      setCheckingExistingSession(false);
      try {
        sessionStorage.removeItem('mercato_pending_cash_open');
        sessionStorage.setItem('mercato_cash_opened_at_login', 'true');
      } catch {
        /* ignore */
      }
      return;
    }

    if (registersLoading) return;

    let alive = true;
    (async () => {
      try {
        const sesionRemota = await obtenerSesionAbiertaDeUsuario(
          user?.id,
          user?.name,
          user?.username || user?.email
        );
        if (!alive) return;
        if (sesionRemota) {
          const matchedReg = findCashRegister(registers, sesionRemota.caja_id);
          if (matchedReg) {
            setActiveCashId(matchedReg.id);
          } else if (sesionRemota.caja_id) {
            setActiveCashId(String(sesionRemota.caja_id));
          }
          setPendingPostLoginOpen(false);
          setShiftOpenedLocally(true);
          try {
            sessionStorage.removeItem('mercato_pending_cash_open');
            sessionStorage.setItem('mercato_cash_opened_at_login', 'true');
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setCheckingExistingSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    registersLoading,
    userOpenRegister?.id,
    user?.id,
    user?.name,
    user?.username,
    user?.email,
    shiftClosedLocally,
  ]);

  const activeCashSession = findCashRegister(registers, activeCashId);
  const activeCash = activeCashSession || getCashRegister(activeCashId);

  // Determinar si la sesión de la caja activa pertenece al usuario actual
  const isMyOpenSession = Boolean(
    userOpenRegister ||
      (activeCashSession?.open &&
        ((activeCashSession.cashierId && user?.id && String(activeCashSession.cashierId) === String(user.id)) ||
          isSameCashierName(activeCashSession.cashier, user?.name) ||
          doesRegisterMatchUser(activeCashSession.label, user?.name, user?.username || user?.email)))
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
    (isMyOpenSession ||
      (!pendingPostLoginOpen &&
        (shiftOpenedLocally || (isAdminUser && Boolean(activeCashSession?.open)))));
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

  // 5. Checkout & Payment Hook
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
    activeCashCashierId: activeCashSession?.open ? activeCashSession.cashierId : undefined,
    activeCashCashierName: activeCashSession?.open ? activeCashSession.cashier : undefined,
    user,
    clearCart,
    navigate,
    onSaleSuccess: () => {
      void refetchRegisters();
      void refetchProductos();
    },
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

  const handleOpenScale = (productId?: string | any, weight?: number, product?: any, replaceExisting?: boolean) => {
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
      ? cart.find(
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
  };

  // 7. Scanner, Scale Parser & Global Keyboard Shortcuts Hook
  const { searchQuery, setSearchQuery, realScaleCatalog, handleSearchSubmit } = usePOSScanner({
    enabled: cashIsOpen,
    cart,
    addToCart,
    isWholesaleMode,
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

  const handleRequestPriceChange = (item: CartItem) => {
    if (!isAdminUser && !canChangePrice(user)) {
      toast.error('Acceso denegado: Solo el Administrador o Super Administrador pueden cambiar precios de productos.');
      return;
    }
    setAuthorizedSupervisor(user);
    setPriceEditTargetItem(item);
    setPriceEditModalOpen(true);
  };

  const handleOpenCartItemDiscount = (item: CartItem) => {
    if (isAdminUser) {
      setDiscountTargetProduct(item);
      setDiscountModalOpen(true);
    } else {
      setPendingSupervisorAction({ type: 'discount', item });
      setSupervisorAuthModalOpen(true);
    }
  };

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

  const handleConfirmPriceChange = (
    cartItemId: string,
    newPrice: number,
    reason?: string,
    persistToCatalog = true
  ) => {
    if (!isAdminUser && !canChangePrice(user) && !canChangePrice(authorizedSupervisor)) {
      toast.error('No tienes permiso para modificar precios.');
      return;
    }
    const item = cart.find((i) => i.id === cartItemId);
    const oldPrice = item ? item.price : 0;

    updateItemPrice(cartItemId, newPrice, reason);

    if (persistToCatalog && item?.productId && !item.isCombo && newPrice > 0) {
      void actualizarProducto(item.productId, {
        nombre: item.name,
        sku: item.sku,
        codigo_barras: item.barcode,
        precio_venta: newPrice,
        price_per_weight: newPrice,
      })
        .then(() => {
          void refetchProductos();
        })
        .catch((err) => {
          console.warn('No se pudo persistir el cambio de precio en catálogo:', err);
        });
    }

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
          cartCount={cart.reduce((s, i) => s + i.qty, 0)}
          total={total}
          heldCount={heldSales.length}
          awaitingDelete={awaitingDeleteScan}
          onToggleDeleteMode={toggleDeleteMode}
          cashLabel={activeCash.label}
          cashierName={user?.name || activeCash.cashier || 'Cajero'}
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
              onEditWeight={(item) => handleOpenScale(item.productId, item.qty, item, true)}
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
              isWholesaleMode={isWholesaleMode}
              onOpenDiscountModal={handleOpenCartItemDiscount}
              onOpenPriceModal={handleRequestPriceChange}
              isAdmin={isAdminUser}
              catalogProducts={productosUi}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col overflow-hidden h-full">
            <ProductPanel
              onAddToCart={addToCart}
              onOpenScale={handleOpenScale}
              awaitingDelete={awaitingDeleteScan}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              catalogProducts={productosUi}
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
      </div>

      {/* 2. Pantalla de Verificación o Modal Obligatorio de Apertura de Caja */}
      {(registersLoading || checkingExistingSession) && !shiftOpenedLocally && !isMyOpenSession ? (
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
              setPendingPostLoginOpen(false);
              setShiftClosedLocally(false);
              setShiftOpenedLocally(true);
              try {
                sessionStorage.removeItem('mercato_pending_cash_open');
                sessionStorage.setItem('mercato_cash_opened_at_login', 'true');
              } catch { /* ignore */ }
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
          try {
            sessionStorage.setItem('mercato_cash_opened_at_login', 'true');
          } catch { /* ignore */ }
          if (cierre?.caja_id) setActiveCashId(cierre.caja_id);
          void refetchRegisters();
        }}

        closeCashModalOpen={closeCashModalOpen}
        onCloseCloseCash={() => setCloseCashModalOpen(false)}
        onSuccessCloseCash={() => {
          setShiftOpenedLocally(false);
          setShiftClosedLocally(true);
          try {
            sessionStorage.removeItem('mercato_cash_opened_at_login');
          } catch { /* ignore */ }
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

