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

import { usePOSCart } from '../hooks/usePOSCart';
import { usePOSHeldSales } from '../hooks/usePOSHeldSales';
import { usePOSCheckout } from '../hooks/usePOSCheckout';
import { usePOSScanner } from '../hooks/usePOSScanner';

import { findCashRegister, getCashRegister, type CashRegisterId } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import type { NCFType } from '@/lib/ncfStore';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProductos } from '@/hooks/useProductos';
import { useCombos } from '@/hooks/useCombos';
import { syncInvoiceSettingsFromSupabase } from '@/lib/invoiceSettingsStore';

const ADMIN_OWN_CASH: CashRegisterId = '1';
const DEFAULT_CASHIER_CASH: CashRegisterId = '2';

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
  const roleNorm = (user?.role || '').trim().toLowerCase();
  const isAdminUser =
    roleNorm === 'administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'superadmin' ||
    user?.role === 'Administrador';
  const { registers, loading: registersLoading, refetch: refetchRegisters, markRegisterClosed } = useCashRegisters();

  // 1. Data Catalogs
  const { productosUi } = useProductos({ pagina: 1, limite: 500, estado: 'todos' });
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
    updateItemDiscountAndPrice,
    removeFromCart,
    clearCart,
    toggleWholesalePrice,
    toggleAllWholesale,
    subtotal,
    globalDiscountAmount,
    taxTotal,
    total,
  } = usePOSCart();

  // 3. Cash Session State
  const [activeCashId, setActiveCashId] = useState<CashRegisterId>(() =>
    isAdminUser ? ADMIN_OWN_CASH : DEFAULT_CASHIER_CASH
  );
  const [shiftOpenedLocally, setShiftOpenedLocally] = useState(false);
  const [shiftClosedLocally, setShiftClosedLocally] = useState(false);

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase();
  }, []);

  useEffect(() => {
    if (registers.length === 0) return;

    // 1. Si este cajero ya tiene una caja abierta registrada a su nombre, seleccionarla automáticamente
    const userOpenRegister = registers.find(
      (c) => c.open && c.cashierId && user?.id && c.cashierId === user.id && (isAdminUser || !c.isAdminBox)
    );
    if (userOpenRegister) {
      if (activeCashId !== userOpenRegister.id) {
        setActiveCashId(userOpenRegister.id);
      }
      return;
    }

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
  }, [isAdminUser, registers, activeCashId, user?.id]);

  const activeCashSession = findCashRegister(registers, activeCashId);
  const activeCash = activeCashSession || getCashRegister(activeCashId);

  // Para cajero regular: si la caja activa pertenece a otro cajero, no se considera abierta para el usuario actual
  const isCajaBelongingToOtherCashier =
    !isAdminUser &&
    Boolean(activeCashSession?.open) &&
    Boolean(activeCashSession?.cashierId) &&
    Boolean(user?.id) &&
    activeCashSession?.cashierId !== user?.id &&
    !shiftOpenedLocally;

  const cashIsOpen =
    !shiftClosedLocally &&
    !isCajaBelongingToOtherCashier &&
    (Boolean(activeCashSession?.open) || shiftOpenedLocally);
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
    },
  });

  // 6. Auxiliary Modals State
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleParams, setScaleParams] = useState<{
    productId?: string;
    weight?: number;
    product?: any;
  } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [registerDetailsOpen, setRegisterDetailsOpen] = useState(false);
  const [cashSwitchOpen, setCashSwitchOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [closeCashModalOpen, setCloseCashModalOpen] = useState(false);
  const [weightScanOpen, setWeightScanOpen] = useState(false);

  const handleOpenScale = (productId?: string, weight?: number, product?: any) => {
    const existingInCart = productId
      ? cart.find(
          (i) =>
            i.productId === productId ||
            (product?.sku && i.sku && i.sku.toLowerCase() === String(product.sku).toLowerCase())
        )
      : undefined;
    const effectiveWeight = weight !== undefined ? weight : existingInCart?.qty ?? 1.0;
    const effectiveProduct = product || existingInCart;
    setScaleParams(
      productId || effectiveWeight || effectiveProduct
        ? { productId, weight: effectiveWeight, product: effectiveProduct }
        : null
    );
    setScaleOpen(true);
  };

  // 7. Scanner, Scale Parser & Global Keyboard Shortcuts Hook
  const { searchQuery, setSearchQuery, realScaleCatalog, handleSearchSubmit } = usePOSScanner({
    enabled: cashIsOpen,
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
    closePayment,
    onOpenScale: handleOpenScale,
    clearCart,
  });

<<<<<<< HEAD
  // 7. Auxiliary Modals State
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleParams, setScaleParams] = useState<{
    productId?: string;
    weight?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    product?: any;
    replaceExisting?: boolean;
  } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [registerDetailsOpen, setRegisterDetailsOpen] = useState(false);
  const [cashSwitchOpen, setCashSwitchOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [closeCashModalOpen, setCloseCashModalOpen] = useState(false);
  const [weightScanOpen, setWeightScanOpen] = useState(false);

=======
>>>>>>> a6ff56f7f6787114b3968b75bb3719634a5ba97c
  // Modal de Descuento Manual para producto en carrito
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountTargetProduct, setDiscountTargetProduct] = useState<CartItem | null>(null);

  const handleOpenCartItemDiscount = (item: CartItem) => {
    if (!isAdminUser) {
      toast.error('Solo los administradores pueden aplicar descuentos manuales o modificar precios');
      return;
    }
    setDiscountTargetProduct(item);
    setDiscountModalOpen(true);
  };

  const handleConfirmDiscount = (data: PosProductDiscountData) => {
    if (!isAdminUser) {
      toast.error('Solo los administradores pueden aplicar descuentos manuales');
      setDiscountModalOpen(false);
      setDiscountTargetProduct(null);
      return;
    }
    if (!discountTargetProduct) return;

    updateItemDiscountAndPrice(discountTargetProduct.id, {
      price: data.price,
      qty: data.qty,
      discountType: data.discountType,
      discountValue: data.discountValue,
      professionalDiscount: data.professionalDiscount,
    });
    toast.success(`Descuento actualizado para "${discountTargetProduct.name}"`);
    setDiscountModalOpen(false);
    setDiscountTargetProduct(null);
  };

<<<<<<< HEAD
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOpenScale = (productId?: string, weight?: number, product?: any, replaceExisting?: boolean) => {
    setScaleParams(
      productId || weight || product
        ? { productId, weight, product, replaceExisting }
        : null
    );
    setScaleOpen(true);
  };

=======
>>>>>>> a6ff56f7f6787114b3968b75bb3719634a5ba97c
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
<<<<<<< HEAD
              onEditWeight={(item) => handleOpenScale(item.productId, item.qty, item, true)}
=======
              onEditWeight={(item) => handleOpenScale(item.productId, item.qty, item)}
>>>>>>> a6ff56f7f6787114b3968b75bb3719634a5ba97c
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
              onOpenDiscountModal={isAdminUser ? handleOpenCartItemDiscount : undefined}
              isAdmin={isAdminUser}
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
            onExit={() => navigate('/dashboard')}
            onClose={() => {}}
            onSuccess={(cierre) => {
              setShiftClosedLocally(false);
              setShiftOpenedLocally(true);
              if (cierre?.caja_id) setActiveCashId(cierre.caja_id);
              void refetchRegisters();
              toast.success('¡Caja abierta exitosamente! Listo para facturar.');
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
            <PaymentPanel {...paymentProps} onClose={closePayment} />
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
        onDeleteHeld={deleteHeldSale}

        scaleOpen={scaleOpen}
        onCloseScale={() => setScaleOpen(false)}
        scaleParams={scaleParams}
        onConfirmScale={(item, qty) => {
<<<<<<< HEAD
          addToCart(item, qty, Boolean(scaleParams?.replaceExisting));
=======
          addToCart(item, qty, true);
>>>>>>> a6ff56f7f6787114b3968b75bb3719634a5ba97c
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
    </div>
  );
}

