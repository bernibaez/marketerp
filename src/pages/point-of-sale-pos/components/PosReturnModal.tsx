import React, { useEffect, useState } from 'react';
import {
  Upload,
  Search,
  Clock,
  RotateCcw,
  Shield,
  ChevronDown,
  Printer,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { logAuditEvent } from '@/lib/auditStore';
import {
  obtenerVentaPorNumeroFactura,
  obtenerUltimasVentasParaDevolucion,
  type VentaConDetalle,
} from '@/services/ventas.service';
import { crearDevolucion } from '@/services/devoluciones.service';
import { useAuth } from '@/context/AuthContext';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import PrintableReturnReceipt from '@/components/printing/PrintableReturnReceipt';

interface SaleItem {
  producto_id: string | null;
  sku: string;
  name: string;
  price: number;
  cost: number;
  maxQty: number;
}

interface SaleLookup {
  ventaId: string;
  code: string;
  customer: string;
  clienteId: string | null;
  date: string;
  items: SaleItem[];
}

export interface PosReturnModalProps {
  onClose: () => void;
  initialSaleCode?: string;
  initialSale?: VentaConDetalle | null;
  onSuccess?: () => void;
  mode?: 'modal' | 'page';
  backLabel?: string;
  bottomBackLabel?: string;
  activeCashLabel?: string;
}

export default function PosReturnModal({
  onClose,
  initialSaleCode,
  initialSale,
  onSuccess,
  mode = 'modal',
  backLabel,
  bottomBackLabel,
  activeCashLabel,
}: PosReturnModalProps) {
  const { user } = useAuth();
  const { registers } = useCashRegisters();

  const [searchCode, setSearchCode] = useState(initialSaleCode || '');
  const [loadedSale, setLoadedSale] = useState<SaleLookup | null>(null);
  const [customer, setCustomer] = useState('');
  const [reason, setReason] = useState('Producto defectuoso');
  const [method, setMethod] = useState<'cash' | 'card' | 'credit_note' | 'exchange'>('cash');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [registeredReturnCode, setRegisteredReturnCode] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentSales, setRecentSales] = useState<VentaConDetalle[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Determine connected cashier/box label
  const openRegister = registers.find((r) => r.open) || registers[0];
  const cashLabel =
    activeCashLabel ||
    (openRegister?.label ? `${openRegister.label} Conectada` : 'Caja 01 Conectada');

  const convertVentaToLookup = (venta: VentaConDetalle): SaleLookup | null => {
    const items: SaleItem[] = (venta.detalle_ventas ?? []).map((d) => ({
      producto_id: d.producto_id,
      sku: d.producto_id ? d.nombre_item.slice(0, 12) : d.nombre_item,
      name: d.nombre_item,
      price: d.precio_unitario,
      cost: d.costo_unitario,
      maxQty: d.cantidad,
    }));
    if (items.length === 0) return null;
    return {
      ventaId: venta.id,
      code: venta.numero_factura,
      customer: venta.cliente_nombre ?? 'Cliente general',
      clienteId: venta.cliente_id,
      date: venta.creado_en ? venta.creado_en.slice(0, 10) : new Date().toISOString().slice(0, 10),
      items,
    };
  };

  const applyVenta = (venta: VentaConDetalle) => {
    const sale = convertVentaToLookup(venta);
    if (!sale) {
      toast.error('La factura no tiene productos válidos para devolución');
      return;
    }
    setLoadedSale(sale);
    setSearchCode(sale.code);
    setCustomer(sale.customer);
    setQty({});
    toast.success(`Factura ${sale.code} cargada`);
  };

  useEffect(() => {
    if (initialSale) {
      applyVenta(initialSale);
    } else if (initialSaleCode) {
      void handleLookupCode(initialSaleCode);
    }
  }, [initialSale, initialSaleCode]);

  useEffect(() => {
    let active = true;
    setLoadingRecent(true);
    obtenerUltimasVentasParaDevolucion(6)
      .then((res) => {
        if (active) setRecentSales(res);
      })
      .finally(() => {
        if (active) setLoadingRecent(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLookupCode = async (codeToSearch: string) => {
    const codeKey = codeToSearch.trim();
    if (!codeKey) {
      toast.error('Ingresa el número de factura o NCF');
      return;
    }
    setLookingUp(true);
    try {
      const venta = await obtenerVentaPorNumeroFactura(codeKey);
      if (!venta || venta.estado === 'anulada') {
        setLoadedSale(null);
        toast.error(`No se encontró la factura "${codeKey}". Verifica el número o NCF impreso.`);
        return;
      }
      applyVenta(venta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al buscar la factura');
    } finally {
      setLookingUp(false);
    }
  };

  const handleLookup = () => handleLookupCode(searchCode);

  const currentItems = loadedSale?.items ?? [];

  const selectedItems = currentItems
    .map((l, idx) => ({ ...l, key: `${l.sku}-${idx}`, qty: qty[`${l.sku}-${idx}`] || 0 }))
    .filter((l) => l.qty > 0);

  const totalReturnAmount = selectedItems.reduce((s, l) => s + l.qty * l.price, 0);
  const isFullReturn =
    currentItems.length > 0 &&
    currentItems.every((item, idx) => (qty[`${item.sku}-${idx}`] || 0) === item.maxQty);

  const methodDb =
    method === 'cash'
      ? 'efectivo'
      : method === 'card'
        ? 'tarjeta'
        : method === 'credit_note'
          ? 'nota_credito'
          : 'cambio';

  const handleProcessReturn = async () => {
    if (!loadedSale) {
      toast.error('Carga una factura primero');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Selecciona al menos un producto e indica la cantidad a devolver');
      return;
    }

    setSubmitting(true);
    try {
      const dev = await crearDevolucion({
        venta_id: loadedSale.ventaId,
        numero_factura: loadedSale.code,
        cliente_id: loadedSale.clienteId,
        cajero_id: user?.id ?? null,
        monto_total: totalReturnAmount,
        motivo: reason,
        metodo_reembolso: methodDb,
        tipo: isFullReturn ? 'total' : 'parcial',
        items: selectedItems.map((l) => ({
          producto_id: l.producto_id,
          sku: l.sku,
          nombre_item: l.name,
          cantidad: l.qty,
          precio_unitario: l.price,
          subtotal: l.qty * l.price,
        })),
      });

      logAuditEvent({
        user: user?.name || user?.email || 'Cajero POS',
        role: 'Cajero',
        action: 'Devolución',
        module: 'Devoluciones',
        details: `Solicitud de devolución ${dev.codigo} (Pendiente) por RD$ ${totalReturnAmount.toLocaleString()} sobre factura ${loadedSale.code}`,
        before: { invoice: loadedSale.code, customer },
        after: { returnCode: dev.codigo, status: 'pendiente', total: totalReturnAmount },
      });

      setRegisteredReturnCode(dev.codigo);
      onSuccess?.();
      toast.info(`Solicitud ${dev.codigo} enviada para aprobación del administrador`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar la devolución');
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // SUB-VIEW: COMPLETED RETURN (RECEIPT / CONFIRMATION)
  // ----------------------------------------------------
  if (registeredReturnCode) {
    const confirmationContent = (
      <div className="space-y-6">
        {/* COMPROBANTE OFICIAL PARA IMPRESIÓN (SOLO PRINT) */}
        <div className="hidden print:block printable-document">
          <PrintableReturnReceipt
            data={{
              code: registeredReturnCode,
              originalInvoiceCode: loadedSale?.code || '',
              date: new Date().toLocaleDateString('es-DO'),
              customerName: customer || 'Consumidor Final',
              cashierName: user?.name || 'Cajero',
              reason,
              items: selectedItems.map((it) => ({
                name: it.name,
                qty: it.qty,
                price: it.price,
                subtotal: it.qty * it.price,
              })),
              totalAmount: totalReturnAmount,
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-1 print:hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#007052] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="8" y1="13" x2="16" y2="13"></line>
                <line x1="8" y1="17" x2="16" y2="17"></line>
                <line x1="12" y1="13" x2="12" y2="17"></line>
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                Módulo de Devoluciones
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Punto de Venta · Sucursal Principal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{cashLabel}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-slate-50"
            >
              {backLabel || '← Regresar a Facturación'}
            </button>
          </div>
        </div>

        {/* Confirmation Card */}
        <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-8 space-y-5 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <Clock size={34} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Solicitud de Devolución Enviada</h2>
            <p className="text-base font-mono text-[#007052] font-bold mt-1">{registeredReturnCode}</p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
            <Clock size={14} />
            <span>Pendiente de Aprobación por Administrador</span>
          </div>

          <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-2.5 text-left">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              La solicitud fue registrada exitosamente. Se ha enviado al módulo de <strong>Devoluciones</strong> donde un administrador podrá aprobarla o rechazarla.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2 text-left border border-slate-200/70">
            <div className="flex justify-between">
              <span className="text-slate-500">Factura Original:</span>
              <span className="font-semibold text-slate-800">{loadedSale?.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-semibold text-slate-800">{customer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Motivo:</span>
              <span className="font-semibold text-slate-800">{reason}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
              <span className="text-slate-700">Total Solicitado:</span>
              <span className="text-[#e11d48] font-mono">
                RD$ {totalReturnAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Printer size={15} /> Imprimir Comprobante
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#007052] hover:bg-[#005c43] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
            >
              {bottomBackLabel || '← Volver a Ventas'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 pb-2 print:hidden">
          <p className="text-[11px] text-slate-400 font-medium">
            Sistema POS & Facturación Electrónica · Cumplimiento DGII República Dominicana
          </p>
        </div>
      </div>
    );

    if (mode === 'page') {
      return (
        <div className="min-h-screen bg-[#eaeff2] p-3 sm:p-6 md:p-8 flex items-center justify-center">
          <div className="max-w-7xl w-full bg-[#f4f6f8] text-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/90 space-y-6">
            {confirmationContent}
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="max-w-7xl w-full bg-[#f4f6f8] text-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/90 my-auto space-y-6 max-h-[96vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {confirmationContent}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN VIEW: NUEVA DEVOLUCIÓN (MATCHES ATTACHED IMAGE)
  // ----------------------------------------------------
  const mainContent = (
    <div className="space-y-6 font-sans">
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        {/* Left: Icon + Title + Subtitle */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#007052] flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="8" y1="13" x2="16" y2="13"></line>
              <line x1="8" y1="17" x2="16" y2="17"></line>
              <line x1="12" y1="13" x2="12" y2="17"></line>
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
              Módulo de Devoluciones
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Punto de Venta · Sucursal Principal
            </p>
          </div>
        </div>

        {/* Right: Cashier status pill + Back action */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{cashLabel}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-2xs cursor-pointer hover:bg-slate-50"
          >
            {backLabel || '← Regresar a Facturación'}
          </button>
        </div>
      </div>

      {/* 2. TWO-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (approx 65% width) */}
        <div className="lg:col-span-8 space-y-6">
          {/* CARD 1: Buscar Factura Original */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Buscar Factura Original</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Introduce el identificador de venta o NCF fiscal impreso en el comprobante
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 whitespace-nowrap">
                NCF Formato e-CF / B02
              </span>
            </div>

            {/* Search Input Row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none font-mono transition"
                  placeholder="Ej: FAC-20261021-... o B02..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLookup();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={lookingUp}
                className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Upload size={15} />
                <span>{lookingUp ? 'Buscando…' : 'Cargar Factura'}</span>
              </button>
            </div>

            {/* Recent Sales Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <Clock size={13} className="text-slate-400" />
                  <span>O SELECCIONA UNA VENTA RECIENTE</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Últimas 24 horas</span>
              </div>

              {/* 6 Recent Sales Grid (2 cols x 3 rows) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentSales.slice(0, 6).map((vs) => {
                  const isCurrent = loadedSale?.ventaId === vs.id;
                  return (
                    <div
                      key={vs.id}
                      onClick={() => applyVenta(vs)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'border-[#007052] bg-emerald-50/40 ring-1 ring-[#007052]'
                          : 'border-slate-200/90 bg-white hover:border-[#007052]/60 hover:shadow-xs'
                      }`}
                    >
                      <div className="min-w-0 mr-2">
                        <p className="font-mono font-bold text-xs text-slate-800 group-hover:text-[#007052] truncate transition-colors">
                          {vs.numero_factura}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {vs.cliente_nombre || 'Cliente general'}
                          {vs.ncf ? ` · ${vs.ncf}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-bold text-xs text-slate-900">
                          RD$ {vs.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[11px] font-bold text-[#007052] flex items-center justify-end gap-0.5 mt-0.5 group-hover:translate-x-0.5 transition-transform">
                          Cargar →
                        </span>
                      </div>
                    </div>
                  );
                })}

                {recentSales.length === 0 && !loadingRecent && (
                  <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                    No hay ventas registradas recientemente
                  </div>
                )}
                {loadingRecent && recentSales.length === 0 && (
                  <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                    Cargando ventas recientes…
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARD 2: Productos de la Factura */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-base">Productos de la Factura</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecciona y ajusta las unidades exactas a devolver
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400">
                {currentItems.length} {currentItems.length === 1 ? 'item cargado' : 'items cargados'}
              </span>
            </div>

            {/* Empty State vs Loaded Items */}
            {currentItems.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100/90 border border-slate-200/60 flex items-center justify-center mx-auto mb-3.5 text-slate-400">
                  <RotateCcw size={22} className="text-slate-400" />
                </div>
                <p className="font-bold text-slate-800 text-sm mb-1">No hay factura cargada</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Busca por número de factura o NCF arriba, o bien selecciona una venta reciente del listado para comenzar el proceso.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="font-mono font-bold text-[#007052]">
                    Factura: {loadedSale?.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = currentItems.every((it, idx) => (qty[`${it.sku}-${idx}`] || 0) === it.maxQty);
                      const nextQty: Record<string, number> = {};
                      if (!allSelected) {
                        currentItems.forEach((it, idx) => {
                          nextQty[`${it.sku}-${idx}`] = it.maxQty;
                        });
                      }
                      setQty(nextQty);
                    }}
                    className="text-xs font-bold text-[#007052] hover:underline cursor-pointer"
                  >
                    {isFullReturn ? 'Desmarcar Todos' : 'Devolver Todos los Items'}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Comprados</th>
                        <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                        <th className="py-2.5 px-3 text-center w-36">Cant. a Devolver</th>
                        <th className="py-2.5 px-3 text-right">Subtotal Devolución</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentItems.map((l, idx) => {
                        const key = `${l.sku}-${idx}`;
                        const returnQty = qty[key] ?? 0;
                        return (
                          <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-800 text-xs">{l.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{l.sku}</p>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                              {l.maxQty}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                              RD$ {l.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQty((q) => ({
                                      ...q,
                                      [key]: Math.max(0, returnQty - 1),
                                    }))
                                  }
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                                  title="Disminuir"
                                >
                                  <Minus size={12} />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={l.maxQty}
                                  className="w-14 py-1 px-1 text-center font-bold text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#007052] outline-none"
                                  value={returnQty}
                                  onChange={(e) =>
                                    setQty((q) => ({
                                      ...q,
                                      [key]: Math.min(l.maxQty, Math.max(0, parseInt(e.target.value, 10) || 0)),
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQty((q) => ({
                                      ...q,
                                      [key]: Math.min(l.maxQty, returnQty + 1),
                                    }))
                                  }
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                                  title="Aumentar"
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQty((q) => ({
                                      ...q,
                                      [key]: returnQty === l.maxQty ? 0 : l.maxQty,
                                    }))
                                  }
                                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                  title="Devolver todo"
                                >
                                  Todo
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              RD$ {(returnQty * l.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (approx 35% width) */}
        <div className="lg:col-span-4 space-y-6">
          {/* CARD 1: INFORMACIÓN DE DEVOLUCIÓN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase">
                INFORMACIÓN DE DEVOLUCIÓN
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Cliente</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition"
                placeholder="Nombre del cliente"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Motivo de Devolución</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 pr-9 text-xs text-slate-800 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition cursor-pointer font-medium"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="Producto defectuoso">Producto defectuoso</option>
                  <option value="Error de cobro">Error de cobro</option>
                  <option value="Cliente arrepentido">Cliente arrepentido</option>
                  <option value="Producto equivocado">Producto equivocado</option>
                  <option value="Fecha vencimiento próxima">Fecha vencimiento próxima</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Método de Reembolso</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 pr-9 text-xs text-slate-800 focus:bg-white focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition cursor-pointer font-medium"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Reembolso a Tarjeta</option>
                  <option value="credit_note">Nota de Crédito</option>
                  <option value="exchange">Cambio por otro Producto</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* CARD 2: RESUMEN DE REEMBOLSO */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase">
                RESUMEN DE REEMBOLSO
              </h3>
              <span className="text-xs text-slate-400 font-medium">Paso Final</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 font-medium">Tipo de Devolución</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                {isFullReturn ? 'Devolución Total' : 'Devolución Parcial'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Productos a devolver</span>
              <span className="font-bold text-slate-800">{selectedItems.length} producto(s)</span>
            </div>

            {/* Total Box */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex items-center justify-between mt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                TOTAL REEMBOLSO
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold text-[#e11d48]">RD$</span>
                <span className="text-3xl font-black text-[#e11d48] font-mono tracking-tight">
                  {totalReturnAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Admin approval warning box */}
            <div className="bg-[#fef9c3]/70 border border-[#fef08a] rounded-xl p-3 flex items-center gap-2.5">
              <Shield size={16} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs font-medium text-amber-900">
                Requiere aprobación del administrador
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={submitting || !loadedSale || selectedItems.length === 0}
                onClick={() => void handleProcessReturn()}
                className="w-full bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={16} className={submitting ? 'animate-spin' : ''} />
                <span>{submitting ? 'Enviando Solicitud…' : 'Solicitar Devolución'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/90 py-2.5 rounded-xl font-semibold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
              >
                {bottomBackLabel || '← Volver a Ventas'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FOOTER */}
      <div className="text-center pt-8 pb-3">
        <p className="text-[11px] text-slate-400 font-medium">
          Sistema POS & Facturación Electrónica · Cumplimiento DGII República Dominicana
        </p>
      </div>
    </div>
  );

  if (mode === 'page') {
    return (
      <div className="min-h-screen bg-[#eaeff2] p-3 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="max-w-7xl w-full bg-[#f4f6f8] text-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/90 space-y-6">
          {mainContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="max-w-7xl w-full bg-[#f4f6f8] text-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/90 my-auto space-y-6 max-h-[96vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {mainContent}
      </div>
    </div>
  );
}
