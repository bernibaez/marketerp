import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Printer,
  X,
  Plus,
  FileText,
  Check,
  ChevronRight,
  Info,
  Send,
  Clock,
  Store,
  Lightbulb,
  Layers,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { CartItem, Customer } from './POSTerminal';
import type { PaymentSplit } from '@/lib/posStore';
import { logAuditEvent } from '@/lib/auditStore';
import { validateRNC, NCF_TYPES, type NCFType, type FiscalInvoiceRecord } from '@/lib/ncfStore';
import { generarSiguienteNcf } from '@/services/ncf.service';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import PrintableInvoice from '@/components/PrintableInvoice';
import { useAuth } from '@/context/AuthContext';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit' | 'split';

interface PaymentPanelProps {
  total: number;
  subtotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  registerNumber?: string;
  cart: CartItem[];
  customer: Customer | null;
  onComplete: (payments: PaymentSplit, fiscalInvoice?: FiscalInvoiceRecord) => any;
  orderCompleted: boolean;
  fiscalEnabled?: boolean;
  onToggleFiscal?: (enabled: boolean) => void;
  initialNcfType?: NCFType;
  onSelectNcfType?: (t: NCFType) => void;
  onClose?: () => void;
  onNewSale?: () => void;
  initialMethod?: PaymentMethod;
}

const paymentMethods = [
  { id: 'cash' as PaymentMethod, label: 'Efectivo', icon: <Banknote size={20} /> },
  { id: 'card' as PaymentMethod, label: 'Tarjeta', icon: <CreditCard size={20} /> },
  { id: 'transfer' as PaymentMethod, label: 'Transf.', icon: <Smartphone size={20} /> },
  { id: 'credit' as PaymentMethod, label: 'Crédito', icon: <Split size={20} /> },
  { id: 'split' as PaymentMethod, label: 'Múltiple', icon: <Layers size={20} /> },
];

const quickCashPresets = [50, 100, 200, 500, 1000];

export default function PaymentPanel({
  total,
  subtotal,
  taxTotal,
  discountTotal,
  registerNumber,
  cart,
  customer,
  onComplete,
  orderCompleted,
  fiscalEnabled = false,
  onToggleFiscal,
  initialNcfType,
  onSelectNcfType,
  onClose,
  onNewSale,
  initialMethod,
}: PaymentPanelProps) {
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>(initialMethod ?? 'cash');
  const [cashReceived, setCashReceived] = useState('');
  const [processing, setProcessing] = useState(false);
  const [split, setSplit] = useState({ cash: '', card: '', transfer: '', credit: '' });
  const [lastChange, setLastChange] = useState(0);
  const [completedSaleResult, setCompletedSaleResult] = useState<{
    numero_factura: string;
    ncf?: string | null;
  } | null>(null);
  const cashInputRef = React.useRef<HTMLInputElement>(null);

  // Fiscal Invoice (NCF) State
  const [ncfType, setNcfType] = useState<NCFType>(
    initialNcfType || (customer?.tipo_ncf as NCFType) || (customer?.rnc_cedula ? 'B01' : 'B02')
  );
  const [rncClient, setRncClient] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showFiscalDetails, setShowFiscalDetails] = useState(false);

  React.useEffect(() => {
    if (initialMethod) setMethod(initialMethod);
  }, [initialMethod]);

  React.useEffect(() => {
    if (!orderCompleted) {
      setCashReceived('');
      setLastChange(0);
      setCompletedSaleResult(null);
      setSplit({ cash: '', card: '', transfer: '', credit: '' });
    }
  }, [orderCompleted]);

  React.useEffect(() => {
    if (!orderCompleted && method === 'cash') {
      const t = setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [orderCompleted, method]);

  React.useEffect(() => {
    if (initialNcfType) {
      setNcfType(initialNcfType);
    }
  }, [initialNcfType]);

  React.useEffect(() => {
    if (customer) {
      if (customer.rnc_cedula) {
        setRncClient(customer.rnc_cedula);
        setNcfType((customer.tipo_ncf as NCFType) || 'B01');
      } else if (customer.phone && !rncClient) {
        setRncClient(customer.phone);
      }
      if (customer.name && !companyName) {
        setCompanyName(customer.name);
      }
    }
  }, [customer]);

  const fmt = (v: number) =>
    `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = method === 'cash' ? Math.max(0, cashAmount - total) : 0;
  const isCashInsufficient = method === 'cash' && cashAmount < total && cart.length > 0;

  const splitNums = useMemo(
    () => ({
      cash: parseFloat(split.cash) || 0,
      card: parseFloat(split.card) || 0,
      transfer: parseFloat(split.transfer) || 0,
      credit: parseFloat(split.credit) || 0,
    }),
    [split]
  );
  const splitTotal = splitNums.cash + splitNums.card + splitNums.transfer + splitNums.credit;
  const splitDiff = Math.round((splitTotal - total) * 100) / 100;

  const buildPayments = (): PaymentSplit | null => {
    if (method === 'split') {
      if (Math.abs(splitDiff) > 0.01) {
        toast.error(`La suma de pagos debe igualar el total. Diferencia: ${fmt(splitDiff)}`);
        return null;
      }
      if (splitNums.credit > 0 && !customer) {
        toast.error('Selecciona un cliente para usar crédito');
        return null;
      }
      return splitNums;
    }
    if (method === 'cash') {
      if (cashAmount < total) {
        toast.error('Monto recibido insuficiente para cubrir el total');
        return null;
      }
      return { cash: total, card: 0, transfer: 0, credit: 0 };
    }
    if (method === 'card') return { cash: 0, card: total, transfer: 0, credit: 0 };
    if (method === 'transfer') return { cash: 0, card: 0, transfer: total, credit: 0 };
    if (method === 'credit') {
      if (!customer) {
        toast.error('Se requiere un cliente para crédito');
        return null;
      }
      if (total > customer.credit) {
        toast.error('Crédito insuficiente');
        return null;
      }
      return { cash: 0, card: 0, transfer: 0, credit: total };
    }
    return null;
  };

  const handleProcess = async () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    if (fiscalEnabled) {
      const ncfSpec = NCF_TYPES[ncfType];
      if (ncfSpec.requiresRnc) {
        if (!rncClient.trim()) {
          toast.error('Debes ingresar el RNC o Cédula para este tipo de comprobante fiscal');
          return;
        }
        const valResult = validateRNC(rncClient);
        if (!valResult.valid) {
          toast.error(`RNC/Cédula no válido: ${valResult.message}`);
          return;
        }
        if (!companyName.trim()) {
          toast.error('Debes ingresar la Razón Social / Nombre Comercial del cliente');
          return;
        }
      }
    }

    const payments = buildPayments();
    if (!payments) return;

    setProcessing(true);
    const computedChange =
      method === 'cash'
        ? change
        : method === 'split'
          ? Math.max(0, splitNums.cash - (payments.cash || 0))
          : 0;
    setLastChange(computedChange);

    try {
      const parts = [
        payments.cash > 0 ? `Efectivo ${fmt(payments.cash)}` : null,
        payments.card > 0 ? `Tarjeta ${fmt(payments.card)}` : null,
        payments.transfer > 0 ? `Transferencia ${fmt(payments.transfer)}` : null,
        payments.credit > 0 ? `Crédito ${fmt(payments.credit)}` : null,
      ].filter(Boolean);

      let fiscalInvoice: FiscalInvoiceRecord | undefined;

      if (fiscalEnabled) {
        const now = new Date();
        const subtotalNet = total / 1.18;
        const totalItbis = total - subtotalNet;

        let ncf = '';
        let expirationDate = '2027-12-31';
        if (!isSupabaseConfigured()) {
          const gen = await generarSiguienteNcf(ncfType);
          ncf = gen.ncf;
          expirationDate = gen.expirationDate;
        }

        fiscalInvoice = {
          id: `inv-${Date.now()}`,
          ncf,
          ncfType,
          rncClient: rncClient.trim() || customer?.phone || undefined,
          companyName: companyName.trim() || customer?.name || 'Consumidor Final',
          issueDate: now.toLocaleDateString('es-DO'),
          issueTime: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
          subtotal: Math.round(subtotalNet * 100) / 100,
          itbis: Math.round(totalItbis * 100) / 100,
          total,
          paymentMethod: parts.join(' · '),
          cashier: 'Caja #1 (Admin)',
          expirationDate,
          items: cart.map((item) => {
            const itemNet = item.price / 1.18;
            const itemItbis = item.price - itemNet;
            return {
              sku: item.sku,
              name: item.name,
              qty: item.qty,
              price: item.price,
              itbis: Math.round(itemItbis * item.qty * 100) / 100,
              subtotal: item.price * item.qty,
            };
          }),
        };
      }

      logAuditEvent({
        user: 'Admin General',
        role: 'Administrador',
        action: 'Venta',
        module: 'POS',
        details: fiscalInvoice
          ? `Factura Fiscal (${fiscalInvoice.ncfType}) por ${fmt(total)} (${parts.join(' · ')})`
          : `Venta procesada por ${fmt(total)} (${parts.join(' · ')})`,
        after: { total, payments, ncfType: fiscalInvoice?.ncfType, change: computedChange, cartCount: cart.length },
      });

      const res = await Promise.resolve(onComplete(payments, fiscalInvoice));
      if (res && typeof res === 'object' && (res as any).numero_factura) {
        setCompletedSaleResult(res as any);
      }
      if (!fiscalEnabled) {
        toast.success(`Venta completada — ${fmt(total)} (Sin Comprobante Fiscal)`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al procesar el pago');
    } finally {
      setProcessing(false);
    }
  };

  // ----------------------------------------------------
  // VIEW 2: ORDER COMPLETED (¡VENTA COMPLETADA!)
  // ----------------------------------------------------
  if (orderCompleted) {
    const now = new Date();
    const computedSubtotal =
      typeof subtotal === 'number'
        ? subtotal
        : cart.reduce((s, item) => s + item.price * item.qty * (1 - (item.discount || 0) / 100), 0);
    const computedTax =
      typeof taxTotal === 'number'
        ? taxTotal
        : Math.max(0, total - computedSubtotal + (discountTotal || 0));

    const actualInvoiceNumber =
      completedSaleResult?.numero_factura ||
      `FAC-${Date.now().toString().slice(-6)}`;

    const actualNcf =
      completedSaleResult?.ncf ||
      (fiscalEnabled ? (ncfType === 'B01' ? 'B0100000001' : 'B0200000001') : null);

    const completedInvoiceData = {
      invoiceNumber: actualInvoiceNumber,
      isFiscal: fiscalEnabled || Boolean(actualNcf),
      ncf: actualNcf,
      ncfType: fiscalEnabled ? ncfType : null,
      ncfTypeName: fiscalEnabled && ncfType ? NCF_TYPES[ncfType]?.name : null,
      expirationDate: '31/12/2027',
      issueDate: now.toLocaleDateString('es-DO'),
      issueTime: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
      cashier: user?.name || user?.username || 'Caja POS',
      registerNumber: registerNumber || 'POS-01',
      customerName: customer?.name || (companyName.trim() || 'Consumidor Final'),
      customerRnc: customer?.rnc_cedula || rncClient.trim() || undefined,
      customerPhone: customer?.phone || undefined,
      items: cart
        .filter((item) => item.qty > 0)
        .map((item) => {
          const lineNet = item.price * item.qty * (1 - (item.discount || 0) / 100);
          return {
            sku: item.sku,
            name: item.name,
            qty: item.qty,
            price: item.price,
            subtotal: lineNet,
            itbis: (lineNet * (item.tax || 0)) / 100,
          };
        }),
      subtotal: Math.round(computedSubtotal * 100) / 100,
      discount: discountTotal ? Math.round(discountTotal * 100) / 100 : undefined,
      itbis: Math.round(computedTax * 100) / 100,
      total,
      paymentMethod: method,
      cashReceived: cashAmount || total,
      change: lastChange || 0,
    };

    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-y-auto">
        {/* DOCUMENTO OFICIAL PARA IMPRESIÓN (SOLO VISIBLE EN PRINT) */}
        <div className="hidden print:block printable-document">
          <PrintableInvoice
            invoiceData={completedInvoiceData}
          />
        </div>

        {/* CONTENIDO INTERACTIVO EN PANTALLA (OCULTO EN PRINT) */}
        <div className="print:hidden flex flex-col flex-1">
          {/* Top Banner */}
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-6 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md mb-2">
            <Check size={26} strokeWidth={3} />
          </div>
          <h2 className="text-xl font-black tracking-wide text-slate-800 dark:text-white uppercase">
            ¡VENTA COMPLETADA!
          </h2>
          <p className="text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {fmt(total)}
          </p>
        </div>

        {/* Body 2 columns */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-start">
          {/* Left Column: Summary & Actions */}
          <div className="space-y-5">
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                RESUMEN DE LA VENTA
              </p>

              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{fmt(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Método de pago</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 capitalize">
                    {method === 'cash'
                      ? 'Efectivo'
                      : method === 'card'
                        ? 'Tarjeta'
                        : method === 'transfer'
                          ? 'Transferencia'
                          : method === 'credit'
                            ? 'Crédito'
                            : 'Múltiple'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Dinero recibido</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{fmt(cashAmount || total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Cambio entregado</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(lastChange)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <div className="flex justify-between">
                  <span>Venta #{completedInvoiceData.invoiceNumber.replace('FAC-', '')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha</span>
                  <span>{completedInvoiceData.issueDate} {completedInvoiceData.issueTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cajero</span>
                  <span>{completedInvoiceData.cashier}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  let closed = false;
                  const finish = () => {
                    if (closed) return;
                    closed = true;
                    onNewSale?.();
                    onClose?.();
                  };
                  window.addEventListener('afterprint', finish, { once: true });
                  window.print();
                  // Fallback por si el navegador no dispara afterprint
                  window.setTimeout(finish, 1200);
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
              >
                <Printer size={18} />
                <span>IMPRIMIR FACTURA</span>
                <span className="bg-emerald-700/60 text-white text-[10px] px-2 py-0.5 rounded font-mono ml-auto">F12</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNewSale?.();
                  onClose?.();
                }}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
              >
                <Plus size={16} />
                <span>NUEVA VENTA</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded font-mono ml-auto">F2</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info('Enviando o guardando comprobante...')}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Send size={16} />
                  <span>ENVIAR / GUARDAR</span>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Progress / Auto-redirect banner */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
              <Clock size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] mb-1">Serás redirigido a nueva venta en 3 segundos...</p>
                <div className="w-full bg-emerald-200 dark:bg-emerald-900/50 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full w-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Receipt Preview */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              VISTA PREVIA DEL COMPROBANTE
            </p>

            <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-sm p-1">
              <PrintableInvoice
                invoiceData={completedInvoiceData}
              />
            </div>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/60 dark:border-slate-800 px-6 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Lightbulb size={16} className="text-amber-500" />
          <span>
            Consejo: Presiona <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F2</span> para nueva venta o <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F12</span> para imprimir
          </span>
        </div>
      </div>
    </div>
  );
  }

  // ----------------------------------------------------
  // VIEW 1: PAYMENT FORM (PAGO EN CAJA)
  // ----------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-black tracking-wide text-slate-800 dark:text-white uppercase">
          PAGO EN CAJA
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* TOTAL A PAGAR Banner */}
        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 text-center shadow-2xs">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            TOTAL A PAGAR
          </p>
          <p className="text-4xl sm:text-5xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {fmt(total)}
          </p>
        </div>

        {/* 1. FORMA DE PAGO */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            1. FORMA DE PAGO
          </p>
          <div className="grid grid-cols-5 gap-2.5">
            {paymentMethods.map((m) => {
              const isSelected = method === m.id;
              return (
                <button
                  key={`pm-${m.id}`}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 text-center min-h-[82px] cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40 font-extrabold shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 font-semibold'
                  }`}
                >
                  <div
                    className={`mb-1.5 p-2 rounded-xl ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.icon}
                  </div>
                  <span className="text-xs">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. DINERO RECIBIDO & 3. CAMBIO */}
        {method === 'cash' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 2. DINERO RECIBIDO */}
            <div className="md:col-span-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. DINERO RECIBIDO
              </p>
              <div>
                <input
                  ref={cashInputRef}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !processing && cashAmount >= total && cart.length > 0) {
                      e.preventDefault();
                      void handleProcess();
                    }
                  }}
                  className={`w-full text-center text-3xl font-extrabold tabular-nums h-16 rounded-xl border bg-white dark:bg-slate-900 px-4 focus:outline-none focus:ring-2 ${
                    isCashInsufficient && cashAmount > 0
                      ? 'border-rose-500 text-rose-600 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:ring-emerald-500'
                  }`}
                />
                <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium mt-1.5 flex items-center justify-center gap-1.5">
                  <FileText size={12} className="text-slate-400" />
                  <span>Ingrese el monto recibido o use los botones rápidos</span>
                </div>
              </div>
            </div>

            {/* 3. CAMBIO */}
            <div className="md:col-span-1 flex flex-col justify-between bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                3. CAMBIO
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs">
                  <Banknote size={24} />
                </div>
                <p className="text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmt(change)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mode Multiple / Split */}
        {method === 'split' && (
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs">
            <p className="font-black uppercase text-slate-500 tracking-wider">Desglose de Pago Múltiple</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['cash', 'Efectivo'],
                  ['card', 'Tarjeta'],
                  ['transfer', 'Transferencia'],
                  ['credit', 'Crédito'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={split[key]}
                    onChange={(e) => setSplit((s) => ({ ...s, [key]: e.target.value }))}
                    className="w-full text-xs font-bold h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 tabular-nums"
                  />
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-between font-bold text-xs">
              <span>Suma total: {fmt(splitTotal)}</span>
              <span className={Math.abs(splitDiff) < 0.01 ? 'text-emerald-600' : 'text-rose-500'}>
                Diferencia: {fmt(splitDiff)}
              </span>
            </div>
          </div>
        )}

        {/* 4. MONTO RÁPIDO */}
        {method === 'cash' && (
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              4. MONTO RÁPIDO
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setCashReceived(String(total))}
                className="py-2.5 px-2 rounded-xl border border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100 transition-all font-bold text-center active:scale-95 cursor-pointer"
              >
                <div className="text-[9px] uppercase font-extrabold tracking-wider">EXACTO</div>
                <div className="text-xs font-extrabold tabular-nums">{fmt(total)}</div>
              </button>
              {quickCashPresets.map((v) => (
                <button
                  key={`quick-${v}`}
                  type="button"
                  onClick={() => setCashReceived(v.toString())}
                  className="py-3 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all font-extrabold text-xs text-center active:scale-95 tabular-nums flex items-center justify-center cursor-pointer"
                >
                  RD$ {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* COMPROBANTE FISCAL Block */}
        <div className="border border-slate-200/80 dark:border-slate-700/70 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
          <div
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
            onClick={() => setShowFiscalDetails((prev) => !prev)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 tracking-wide">
                  COMPROBANTE FISCAL
                </p>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {fiscalEnabled ? `Factura Fiscal (${ncfType})` : 'Factura Simple (Sin NCF)'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleFiscal) onToggleFiscal(!fiscalEnabled);
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
                  fiscalEnabled
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {fiscalEnabled ? 'NCF ACTIVADO' : 'ACTIVAR NCF'}
              </button>
              <ChevronRight
                size={18}
                className={`text-slate-400 transition-transform ${showFiscalDetails ? 'rotate-90' : ''}`}
              />
            </div>
          </div>

          {/* Expanded Fiscal Options */}
          {(showFiscalDetails || fiscalEnabled) && (
            <div className="p-3.5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2">
                {(['B02', 'B01', 'B15', 'B14'] as NCFType[]).map((t) => (
                  <button
                    key={`ncf-btn-${t}`}
                    type="button"
                    onClick={() => {
                      if (!fiscalEnabled && onToggleFiscal) onToggleFiscal(true);
                      setNcfType(t);
                    }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                      fiscalEnabled && ncfType === t
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'B02' && 'B02 · Consumo'}
                    {t === 'B01' && 'B01 · Crédito'}
                    {t === 'B15' && 'B15 · Gobierno'}
                    {t === 'B14' && 'B14 · Especial'}
                  </button>
                ))}
              </div>

              {fiscalEnabled && NCF_TYPES[ncfType].requiresRnc && (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                      RNC / Cédula del Cliente *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 131456789 o 00112345678"
                      value={rncClient}
                      onChange={(e) => setRncClient(e.target.value)}
                      className="w-full text-xs font-mono h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                      Razón Social / Nombre Comercial *
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre oficial registrado en DGII"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full text-xs h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-white dark:bg-slate-900">
        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Cancelar</span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">
            ESC
          </span>
        </button>

        {/* Status Info */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
          <Info size={14} className={cashAmount >= total || method !== 'cash' ? 'text-emerald-500' : 'text-amber-500'} />
          <span>
            {method !== 'cash'
              ? 'Listo para procesar'
              : cashAmount >= total
                ? 'Falta recibir RD$ 0,00 · El pago está completo'
                : `Falta recibir ${fmt(total - cashAmount)}`}
          </span>
        </div>

        {/* Finalize button */}
        <button
          type="button"
          onClick={handleProcess}
          disabled={processing || cart.length === 0 || (method === 'cash' && cashAmount < total)}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <Check size={13} strokeWidth={3} />
          </div>
          <span>FINALIZAR (F9)</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Footer */}
      <div className="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200/60 dark:border-slate-800 px-6 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F6</span>
            Efectivo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F7</span>
            Tarjeta
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F8</span>
            Transf.
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F5</span>
            Múltiple
          </span>
        </div>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">F9</span>
          Finalizar
        </span>
      </div>
    </div>
  );
}
