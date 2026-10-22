import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  ShoppingCart,
  FileText,
  RotateCcw,
  Plus,
  Search,
  Download,
  Eye,
  Trash2,
  Printer,
  X,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightLeft,
  AlertTriangle,
  User,
  Package,
  Edit,
  ChevronDown,
  Receipt,
  Banknote,
  CreditCard,
  Smartphone,
  Split,
  Layers,
  MoreVertical,
  ChevronLeft,
} from 'lucide-react';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { toast } from '@/lib/toast';
import { useVentas } from '@/hooks/useVentas';
import { useCotizaciones } from '@/hooks/useCotizaciones';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import { obtenerClientes } from '@/services/clientes.service';
import { obtenerProductos } from '@/services/productos.service';
import type { Cliente, Producto, MetodoPago } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';
import PrintableInvoice from '@/components/PrintableInvoice';
import { getInvoiceSettings } from '@/lib/invoiceSettingsStore';
import {
  obtenerDetalleCotizacion,
  type CotizacionConDetalle,
} from '@/services/cotizaciones.service';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissionsStore';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';

type Tab = 'sales' | 'quotes' | 'returns';

const saleStatusMap: Record<string, { label: string; cls: string }> = {
  completada: { label: 'Completada', cls: 'badge-success' },
  paid: { label: 'Pagada', cls: 'badge-success' },
  anulada: { label: 'Anulada', cls: 'badge-danger' },
  cancelled: { label: 'Cancelada', cls: 'badge-danger' },
  reembolsada: { label: 'Reembolsada', cls: 'badge-warning' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobada: { label: 'Aprobada', cls: 'badge-success' },
  approved: { label: 'Aprobada', cls: 'badge-success' },
  rechazada: { label: 'Rechazada', cls: 'badge-danger' },
  rejected: { label: 'Rechazada', cls: 'badge-danger' },
  convertida: { label: 'Convertida', cls: 'badge-info' },
  converted: { label: 'Convertida', cls: 'badge-info' },
};

const metodoLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
  mixto: 'Mixto',
  nota_credito: 'Nota de crédito',
  cambio: 'Cambio',
};

interface CartItem {
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
}

function formatCleanDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${day}/${month}/${year} · ${h12}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

export default function SalesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('sales');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isAdmin = user?.role === 'Administrador';
  const canSeeAllSales = isAdmin || user?.role === 'Contador';
  const canEditSales = hasPermission(user?.role ?? 'Cajero', 'ventas', 'editar');
  const canDeleteSales = hasPermission(user?.role ?? 'Cajero', 'ventas', 'eliminar');
  const canCreateSales = hasPermission(user?.role ?? 'Cajero', 'ventas', 'crear');
  const canExportSales = hasPermission(user?.role ?? 'Cajero', 'ventas', 'exportar');
  const ownCajeroId = !canSeeAllSales ? user?.id : undefined;

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Inline forms (reemplazan la lista, como en Compras) & modals de confirmación
  const [showAddSaleForm, setShowAddSaleForm] = useState(false);
  const [showAddQuoteForm, setShowAddQuoteForm] = useState(false);

  const [viewingSale, setViewingSale] = useState<VentaConDetalle | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);

  const [anulandoSale, setAnulandoSale] = useState<VentaConDetalle | null>(null);
  const [anularMotivo, setAnularMotivo] = useState('Anulación por error de facturación');

  const [viewingQuote, setViewingQuote] = useState<CotizacionConDetalle | null>(null);
  const [loadingQuoteDetail, setLoadingQuoteDetail] = useState(false);
  const [convertQuote, setConvertQuote] = useState<CotizacionConDetalle | null>(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<MetodoPago>('efectivo');

  const [rejectingReturnId, setRejectingReturnId] = useState<string | null>(null);
  const [rejectReturnReason, setRejectReturnReason] = useState('No cumple con las políticas de devolución');

  // Actions dropdown state
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  // Edit Sale modal state
  const [editingSale, setEditingSale] = useState<VentaConDetalle | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<MetodoPago>('efectivo');
  const [editTipoNcf, setEditTipoNcf] = useState<string>('B02');
  const [editNcf, setEditNcf] = useState<string>('');
  const [editMontoDescuento, setEditMontoDescuento] = useState<number>(0);
  const [editEstado, setEditEstado] = useState<string>('completada');

  // Print Sale modal state
  const [printingSale, setPrintingSale] = useState<VentaConDetalle | null>(null);
  const [loadingPrintDetail, setLoadingPrintDetail] = useState(false);
  const [printFormat, setPrintFormat] = useState<'ticket' | 'a4'>(() => {
    return getInvoiceSettings().printFormat === 'full_page' ? 'a4' : 'ticket';
  });

  // Return modal state
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [returnSale, setReturnSale] = useState<VentaConDetalle | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, tab]);

  // Supabase hooks
  const {
    ventas,
    total: totalVentas,
    loading: loadingVentas,
    error: errorVentas,
    cobrar,
    obtenerDetalle,
    anular,
    actualizar,
    refetch: refetchVentas,
  } = useVentas({
    pagina: page,
    limite: limit,
    busqueda: search,
    fechaInicio: dateFrom || undefined,
    fechaFin: dateTo || undefined,
    cajeroId: ownCajeroId,
  });

  const {
    cotizaciones,
    loading: loadingCotizaciones,
    guardarCotizacion,
    cambiarEstado: cambiarEstadoCotizacion,
    convertirAVenta,
  } = useCotizaciones({
    busqueda: tab === 'quotes' ? search : undefined,
  });

  const {
    devoluciones,
    loading: loadingDevoluciones,
    registrarDevolucion,
    procesarEstado: procesarEstadoDevolucion,
    refetch: refetchDevoluciones,
  } = useDevoluciones({
    busqueda: tab === 'returns' ? search : undefined,
  });

  // DB Data for creation modals
  const [dbClientes, setDbClientes] = useState<Cliente[]>([]);
  const [dbProductos, setDbProductos] = useState<Producto[]>([]);

  useEffect(() => {
    let active = true;
    obtenerClientes({ limite: 100 }).then((res) => {
      if (active) setDbClientes(res.datos);
    });
    obtenerProductos({ limite: 100 }).then((res) => {
      if (active) setDbProductos(res.datos);
    });
    return () => {
      active = false;
    };
  }, []);

  // Nueva Venta form state
  const [saleCustomerId, setSaleCustomerId] = useState<string>('');
  const [salePaymentMethod, setSalePaymentMethod] = useState<MetodoPago>('efectivo');
  const [saleTipoNcf, setSaleTipoNcf] = useState<string>('B02');
  const [saleCart, setSaleCart] = useState<CartItem[]>([]);
  const [saleMontoPagado, setSaleMontoPagado] = useState<number>(0);
  const [saleSearchProd, setSaleSearchProd] = useState('');

  // Nueva Cotización form state
  const [quoteCustomerId, setQuoteCustomerId] = useState<string>('');
  const [quoteValidaHasta, setQuoteValidaHasta] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [quoteCart, setQuoteCart] = useState<CartItem[]>([]);

  const closeSaleForm = () => {
    setShowAddSaleForm(false);
    setSaleCart([]);
    setSaleMontoPagado(0);
    setSaleSearchProd('');
    setSaleCustomerId('');
    setSalePaymentMethod('efectivo');
    setSaleTipoNcf('B02');
  };

  const closeQuoteForm = () => {
    setShowAddQuoteForm(false);
    setQuoteCart([]);
    setQuoteCustomerId('');
    setQuoteValidaHasta(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  };

  // Open Sale Detail modal with live items
  const handleOpenSaleDetail = async (v: VentaConDetalle) => {
    setViewingSale(v);
    setLoadingSaleDetail(true);
    try {
      const full = await obtenerDetalle(v.id);
      if (full) setViewingSale(full);
    } catch {
      // Keep initial summary
    } finally {
      setLoadingSaleDetail(false);
    }
  };

  const handleOpenQuoteDetail = async (q: CotizacionConDetalle) => {
    setViewingQuote(q);
    setLoadingQuoteDetail(true);
    try {
      const full = await obtenerDetalleCotizacion(q.id);
      if (full) setViewingQuote(full);
    } catch {
      // Keep list summary if detail fails
    } finally {
      setLoadingQuoteDetail(false);
    }
  };

  // Void Sale
  const handleConfirmAnular = async () => {
    if (!anulandoSale) return;
    if (!canDeleteSales) {
      toast.error('Solo un administrador puede anular o eliminar facturas');
      return;
    }
    try {
      await anular(anulandoSale.id, anularMotivo);
      toast.success(`Factura ${anulandoSale.numero_factura} anulada exitosamente`);
      setAnulandoSale(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al anular la venta');
    }
  };

  // Open Edit Sale Modal
  const handleOpenEditSale = (s: VentaConDetalle) => {
    if (!canEditSales) {
      toast.error('Solo un administrador puede editar facturas');
      return;
    }
    setEditingSale(s);
    setEditCustomerId(s.cliente_id || '');
    setEditPaymentMethod(s.metodo_pago || 'efectivo');
    setEditTipoNcf(s.tipo_ncf || 'B02');
    setEditNcf(s.ncf || '');
    setEditMontoDescuento(s.monto_descuento || 0);
    setEditEstado(s.estado || 'completada');
  };

  // Save Edited Sale
  const handleSaveEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    if (!canEditSales) {
      toast.error('Solo un administrador puede editar facturas');
      return;
    }
    try {
      await actualizar(editingSale.id, {
        cliente_id: editCustomerId || null,
        metodo_pago: editPaymentMethod,
        tipo_ncf: editTipoNcf || null,
        ncf: editNcf || null,
        monto_descuento: Number(editMontoDescuento),
        estado: editEstado as any,
      });
      toast.success(`Factura ${editingSale.numero_factura} actualizada exitosamente`);
      setEditingSale(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar la factura');
    }
  };

  // Open Print Sale Modal
  const handleOpenPrintSale = async (s: VentaConDetalle) => {
    setPrintingSale(s);
    setLoadingPrintDetail(true);
    try {
      const full = await obtenerDetalle(s.id);
      if (full) setPrintingSale(full);
    } catch {
      // Keep summary if detail fails
    } finally {
      setLoadingPrintDetail(false);
    }
  };

  // Add Item to New Sale Cart
  const handleAddProductToSaleCart = (p: Producto) => {
    setSaleCart((prev) => {
      const idx = prev.findIndex((item) => item.producto.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].cantidad += 1;
        return next;
      }
      return [...prev, { producto: p, cantidad: 1, precio_unitario: p.precio_venta }];
    });
  };

  // Calculations for New Sale Cart
  const saleSubtotal = useMemo(
    () => saleCart.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0),
    [saleCart]
  );
  const saleTax = useMemo(() => Math.round(saleSubtotal * 0.18 * 100) / 100, [saleSubtotal]);
  const saleTotal = useMemo(() => saleSubtotal + saleTax, [saleSubtotal]);
  const saleCostoTotal = useMemo(
    () => saleCart.reduce((sum, item) => sum + item.cantidad * (item.producto.precio_costo || 0), 0),
    [saleCart]
  );
  const saleDevuelta = useMemo(() => Math.max(0, saleMontoPagado - saleTotal), [saleMontoPagado, saleTotal]);

  // Submit New Sale
  const handleCreateSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleCart.length === 0) {
      toast.error('Agrega al menos un producto al carrito');
      return;
    }

    try {
      const payload = {
        cliente_id: saleCustomerId || null,
        tipo_ncf: saleTipoNcf,
        subtotal: saleSubtotal,
        monto_impuesto: saleTax,
        monto_descuento: 0,
        monto_total: saleTotal,
        costo_total: saleCostoTotal,
        metodo_pago: salePaymentMethod,
        monto_pagado: salePaymentMethod === 'efectivo' ? (saleMontoPagado || saleTotal) : saleTotal,
        devuelta_entregada: saleDevuelta,
        items: saleCart.map((item) => ({
          producto_id: item.producto.id,
          tipo_item: 'producto' as const,
          nombre_item: item.producto.nombre,
          precio_unitario: item.precio_unitario,
          costo_unitario: item.producto.precio_costo || 0,
          cantidad: item.cantidad,
          porcentaje_impuesto: item.producto.porcentaje_impuesto || 18,
          subtotal: item.cantidad * item.precio_unitario,
        })),
      };

      const res = await cobrar(payload);
      toast.success(`¡Venta procesada con éxito! Factura: ${res.numero_factura}`);
      closeSaleForm();
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar la venta');
    }
  };

  // Calculations for New Quote Cart
  const quoteSubtotal = useMemo(
    () => quoteCart.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0),
    [quoteCart]
  );
  const quoteTax = useMemo(() => Math.round(quoteSubtotal * 0.18 * 100) / 100, [quoteSubtotal]);
  const quoteTotal = useMemo(() => quoteSubtotal + quoteTax, [quoteSubtotal]);

  // Submit New Quote
  const handleCreateQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteCart.length === 0) {
      toast.error('Agrega al menos un producto a la cotización');
      return;
    }

    try {
      const cot = await guardarCotizacion({
        cliente_id: quoteCustomerId || null,
        subtotal: quoteSubtotal,
        monto_impuesto: quoteTax,
        monto_total: quoteTotal,
        valida_hasta: quoteValidaHasta,
        items: quoteCart.map((it) => ({
          producto_id: it.producto.id,
          nombre_item: it.producto.nombre,
          precio_unitario: it.precio_unitario,
          cantidad: it.cantidad,
          subtotal: it.cantidad * it.precio_unitario,
        })),
      });

      toast.success(`Cotización ${cot.codigo} guardada exitosamente`);
      closeQuoteForm();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear la cotización');
    }
  };

  // Convert Quote to Sale
  const handleConfirmConvertQuote = async () => {
    if (!convertQuote) return;
    try {
      const res = await convertirAVenta(convertQuote.id, convertPaymentMethod);
      toast.success(`Cotización convertida a factura: ${res.numero_factura}`);
      setConvertQuote(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al convertir la cotización');
    }
  };

  // Export PDF & Excel
  const handleExportPdf = () => {
    if (tab === 'sales') {
      exportTableToPdf({
        title: 'Historial Detallado de Ventas (Supabase)',
        filename: 'historial-ventas',
        headers: [
          'Factura',
          'NCF',
          'Fecha/Hora',
          'Cliente',
          'Cajero',
          'Pago',
          'Subtotal',
          'ITBIS (18%)',
          'Total',
          'Ganancia',
          'Estado',
        ],
        rows: ventas.map((v) => [
          v.numero_factura,
          v.ncf || '—',
          new Date(v.creado_en).toLocaleString('es-DO'),
          v.cliente_nombre || 'General',
          v.cajero_nombre || 'Cajero',
          metodoLabel[v.metodo_pago] || v.metodo_pago,
          formatMoneyPdf(v.subtotal),
          formatMoneyPdf(v.monto_impuesto),
          formatMoneyPdf(v.monto_total),
          formatMoneyPdf(v.monto_total - v.costo_total),
          saleStatusMap[v.estado]?.label ?? v.estado,
        ]),
        landscape: true,
      });
      return;
    }
    if (tab === 'quotes') {
      exportTableToPdf({
        title: 'Listado de Cotizaciones',
        filename: 'cotizaciones',
        headers: ['Código', 'Cliente', 'Fecha Emisión', 'Válida hasta', 'Total', 'Estado'],
        rows: cotizaciones.map((q) => [
          q.codigo,
          q.cliente_nombre || 'General',
          new Date(q.creado_en).toLocaleDateString('es-DO'),
          q.valida_hasta || '—',
          formatMoneyPdf(q.monto_total),
          saleStatusMap[q.estado]?.label ?? q.estado,
        ]),
      });
      return;
    }
    exportTableToPdf({
      title: 'Historial de Devoluciones de Venta',
      filename: 'devoluciones-venta',
      headers: ['Código', 'Factura Ref.', 'Cliente', 'Fecha', 'Total Reembolso', 'Motivo', 'Estado'],
      rows: devoluciones.map((r) => [
        r.codigo,
        r.numero_factura || '—',
        r.cliente_nombre || 'General',
        new Date(r.creado_en).toLocaleString('es-DO'),
        formatMoneyPdf(r.monto_total),
        r.motivo,
        saleStatusMap[r.estado]?.label ?? r.estado,
      ]),
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Historial Detallado de Ventas',
      filename: 'historial-ventas',
      headers: [
        'Factura',
        'NCF',
        'Fecha',
        'Cliente',
        'Cajero',
        'Método Pago',
        'Subtotal',
        'ITBIS (18%)',
        'Descuento',
        'Total Factura',
        'Costo Total',
        'Ganancia Bruta',
        'Estado',
      ],
      rows: ventas.map((v) => [
        v.numero_factura,
        v.ncf || '',
        new Date(v.creado_en).toLocaleString('es-DO'),
        v.cliente_nombre || 'General',
        v.cajero_nombre || 'Cajero',
        metodoLabel[v.metodo_pago] || v.metodo_pago,
        v.subtotal,
        v.monto_impuesto,
        v.monto_descuento,
        v.monto_total,
        v.costo_total,
        v.monto_total - v.costo_total,
        saleStatusMap[v.estado]?.label ?? v.estado,
      ]),
    });
  };

  if (showAddSaleForm) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ShoppingCart className="text-primary" size={26} />
                Nueva Venta
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Registrar factura con ITBIS 18% transparentado y actualizar inventario
              </p>
            </div>
            <button type="button" onClick={closeSaleForm} className="btn-secondary">
              ← Volver a Ventas
            </button>
          </div>

          <form onSubmit={handleCreateSaleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Venta</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
                    <select
                      className="input-field"
                      value={saleCustomerId}
                      onChange={(e) => setSaleCustomerId(e.target.value)}
                    >
                      <option value="">Cliente General (Contado)</option>
                      {dbClientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.rnc_cedula ? `(${c.rnc_cedula})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo Comprobante (NCF)</label>
                    <select
                      className="input-field"
                      value={saleTipoNcf}
                      onChange={(e) => setSaleTipoNcf(e.target.value)}
                    >
                      <option value="B02">Factura Consumo (B02)</option>
                      <option value="B01">Crédito Fiscal (B01)</option>
                      <option value="B14">Gubernamental (B14)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                    <select
                      className="input-field"
                      value={salePaymentMethod}
                      onChange={(e) => setSalePaymentMethod(e.target.value as MetodoPago)}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                      <option value="transferencia">Transferencia Bancaria</option>
                      <option value="credito">Crédito (A pagar)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Productos</h3>
                  <p className="text-xs text-muted-foreground">Busca y agrega ítems al carrito de la venta</p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="input-field !pl-10"
                    placeholder="Buscar producto por nombre o código..."
                    value={saleSearchProd}
                    onChange={(e) => setSaleSearchProd(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border text-sm">
                  {dbProductos
                    .filter((p) => p.nombre.toLowerCase().includes(saleSearchProd.toLowerCase()))
                    .slice(0, 10)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductToSaleCart(p)}
                        className="px-3.5 py-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center transition-colors gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground block truncate">{p.nombre}</span>
                          <span className="text-xs text-muted-foreground">
                            Stock: {p.stock_actual} {p.unidad}
                          </span>
                        </div>
                        <span className="font-bold text-primary whitespace-nowrap">
                          RD$ {p.precio_venta.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Producto</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Precio</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Cant.</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Subtotal</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {saleCart.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            El carrito de ventas está vacío. Selecciona productos arriba.
                          </td>
                        </tr>
                      ) : (
                        saleCart.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2.5 font-medium">{item.producto.nombre}</td>
                            <td className="px-3 py-2.5">RD$ {item.precio_unitario.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.cantidad}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value) || 1);
                                  setSaleCart((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, cantidad: val } : c))
                                  );
                                }}
                                className="input-field text-center w-16 py-1.5 text-sm inline-block"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              RD$ {(item.cantidad * item.precio_unitario).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setSaleCart((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5 space-y-3.5 bg-secondary/20 sticky top-4">
                <h4 className="font-bold text-foreground border-b border-border pb-2.5">Resumen de Factura</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal Neto</span>
                  <span className="font-mono font-medium">
                    RD$ {saleSubtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ITBIS Transparentado (18%)</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    RD$ {saleTax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between font-black text-foreground text-lg">
                  <span>Total Venta</span>
                  <span className="text-primary font-mono">
                    RD$ {saleTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {salePaymentMethod === 'efectivo' && (
                  <div className="pt-2 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground block">Monto Recibido</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="input-field font-mono"
                      value={saleMontoPagado || ''}
                      onChange={(e) => setSaleMontoPagado(Number(e.target.value))}
                    />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Devuelta / Cambio:</span>
                      <span className="text-emerald-600 font-mono">
                        RD$ {saleDevuelta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saleCart.length === 0}
                    className="btn-primary w-full py-3 font-bold shadow-md disabled:opacity-50"
                  >
                    Procesar y Guardar
                  </button>
                  <button type="button" onClick={closeSaleForm} className="btn-secondary w-full">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </AppLayout>
    );
  }

  if (showAddQuoteForm) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="text-primary" size={26} />
                Nueva Cotización
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Crear cotización comercial con validez y productos del catálogo
              </p>
            </div>
            <button type="button" onClick={closeQuoteForm} className="btn-secondary">
              ← Volver a Ventas
            </button>
          </div>

          <form onSubmit={handleCreateQuoteSubmit} className="space-y-4">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Información de la Cotización</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
                  <select
                    className="input-field"
                    value={quoteCustomerId}
                    onChange={(e) => setQuoteCustomerId(e.target.value)}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {dbClientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Válida Hasta</label>
                  <input
                    type="date"
                    className="input-field"
                    value={quoteValidaHasta}
                    onChange={(e) => setQuoteValidaHasta(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">Productos</h3>
                <p className="text-xs text-muted-foreground">Selecciona productos para agregarlos a la cotización</p>
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border text-sm">
                {dbProductos.slice(0, 12).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setQuoteCart((prev) => {
                        const idx = prev.findIndex((item) => item.producto.id === p.id);
                        if (idx >= 0) {
                          const next = [...prev];
                          next[idx].cantidad += 1;
                          return next;
                        }
                        return [...prev, { producto: p, cantidad: 1, precio_unitario: p.precio_venta }];
                      });
                    }}
                    className="px-3.5 py-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center transition-colors gap-3"
                  >
                    <span className="font-semibold text-foreground truncate">{p.nombre}</span>
                    <span className="font-bold text-primary whitespace-nowrap">
                      RD$ {p.precio_venta.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Producto</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Precio</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Cant.</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Subtotal</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quoteCart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          Selecciona productos arriba para agregarlos a la cotización
                        </td>
                      </tr>
                    ) : (
                      quoteCart.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2.5 font-medium">{item.producto.nombre}</td>
                          <td className="px-3 py-2.5">RD$ {item.precio_unitario.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                setQuoteCart((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, cantidad: val } : c))
                                );
                              }}
                              className="input-field text-center w-16 py-1.5 text-sm inline-block"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold">
                            RD$ {(item.cantidad * item.precio_unitario).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setQuoteCart((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 text-rose-500 rounded hover:bg-rose-500/10"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="font-bold text-base">
                  Total Cotización:{' '}
                  <span className="text-primary font-mono text-lg">
                    RD$ {quoteTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={closeQuoteForm} className="btn-secondary">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={quoteCart.length === 0}
                    className="btn-primary font-bold disabled:opacity-50"
                  >
                    Guardar Cotización
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </AppLayout>
    );
  }

  if (creatingReturn || returnSale) {
    return (
      <AppLayout>
        <PosReturnModal
          mode="page"
          backLabel="← Volver a Ventas"
          initialSale={returnSale}
          initialSaleCode={returnSale?.numero_factura}
          onClose={() => {
            setCreatingReturn(false);
            setReturnSale(null);
          }}
          onSuccess={() => {
            refetchDevoluciones();
            refetchVentas();
            setCreatingReturn(false);
            setReturnSale(null);
          }}
        />
      </AppLayout>
    );
  }

  if (viewingSale) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="text-primary" size={26} />
                Detalle de Factura {viewingSale.numero_factura}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {viewingSale.ncf ? `Comprobante Fiscal: ${viewingSale.ncf}` : 'Factura de Venta'} · Emitida el {new Date(viewingSale.creado_en).toLocaleString('es-DO')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const s = viewingSale;
                  setViewingSale(null);
                  setPrintingSale(s);
                }}
                className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
              >
                <Printer size={15} /> Imprimir Factura
              </button>
              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
              >
                ← Volver a Ventas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Ítems de Facturación ({viewingSale.detalle_ventas?.length || 0})
                </h3>
                {loadingSaleDetail ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Cargando productos de factura...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground bg-secondary/30">
                          <th className="text-left py-2 px-3">Producto</th>
                          <th className="text-center py-2 px-3">Cantidad</th>
                          <th className="text-right py-2 px-3">Precio Unit.</th>
                          <th className="text-right py-2 px-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(viewingSale.detalle_ventas || []).map((item) => (
                          <tr key={item.id} className="hover:bg-secondary/20">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-foreground text-sm">{item.nombre_item}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-foreground">
                              {item.cantidad}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              RD$ {item.precio_unitario.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                              RD$ {item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Información General
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{viewingSale.cliente_nombre || 'Cliente general'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fecha:</span><span>{new Date(viewingSale.creado_en).toLocaleString('es-DO')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cajero:</span><span>{viewingSale.cajero_nombre || 'Cajero'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Método:</span><span className="badge-neutral font-medium">{metodoLabel[viewingSale.metodo_pago] || viewingSale.metodo_pago}</span></div>
                  {viewingSale.ncf && <div className="flex justify-between"><span className="text-muted-foreground">NCF:</span><span className="font-mono font-bold">{viewingSale.ncf}</span></div>}
                </div>
              </div>

              <div className="card p-5 space-y-3 bg-card border border-border shadow-sm text-xs">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Totales de la Factura
                </h3>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal Neto:</span><span className="font-mono">RD$ {viewingSale.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Descuento:</span><span className="font-mono text-emerald-600">- RD$ {viewingSale.monto_descuento.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-muted-foreground">ITBIS (18%):</span><span className="font-mono text-amber-600 dark:text-amber-400">RD$ {viewingSale.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-black text-base text-foreground"><span>Total:</span><span className="text-primary font-mono">RD$ {viewingSale.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const s = viewingSale;
                    setViewingSale(null);
                    setReturnSale(s);
                  }}
                  className="btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-300"
                >
                  <RotateCcw size={14} /> Hacer Devolución sobre esta Factura
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSale(null)}
                  className="btn-secondary w-full py-2.5 text-xs font-bold"
                >
                  ← Volver a Ventas
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (editingSale) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Edit className="text-amber-500" size={26} />
                Editar Factura {editingSale.numero_factura}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Actualizar información de cliente, comprobante fiscal o método de pago
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingSale(null)}
              className="btn-secondary flex items-center gap-1.5 font-bold"
            >
              ← Volver a Ventas
            </button>
          </div>

          <div className="card p-6 space-y-5">
            <form onSubmit={handleSaveEditSale} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">Cliente</label>
                  <select
                    className="input-field w-full"
                    value={editCustomerId}
                    onChange={(e) => setEditCustomerId(e.target.value)}
                  >
                    <option value="">Cliente General (Contado)</option>
                    {dbClientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} {c.rnc_cedula ? `(${c.rnc_cedula})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">Método de Pago</label>
                  <select
                    className="input-field w-full"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as MetodoPago)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">Tipo de NCF</label>
                  <select
                    className="input-field w-full"
                    value={editTipoNcf}
                    onChange={(e) => setEditTipoNcf(e.target.value)}
                  >
                    <option value="B02">Factura Consumo (B02)</option>
                    <option value="B01">Crédito Fiscal (B01)</option>
                    <option value="B14">Gubernamental (B14)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">NCF Fiscal</label>
                  <input
                    type="text"
                    className="input-field w-full font-mono"
                    placeholder="Ej: B0200000001"
                    value={editNcf}
                    onChange={(e) => setEditNcf(e.target.value)}
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">Descuento Aplicado (RD$)</label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    className="input-field w-full font-mono"
                    value={editMontoDescuento}
                    onChange={(e) => setEditMontoDescuento(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground mb-1 block">Estado de Factura</label>
                  <select
                    className="input-field w-full"
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value)}
                  >
                    <option value="completada">Completada / Pagada</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="anulada">Anulada</option>
                  </select>
                </div>
              </div>

              <div className="bg-secondary/30 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Monto Total Actual:</span>
                  <span className="font-bold text-foreground font-mono">
                    RD$ {editingSale.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Fecha Emisión:</span>
                  <span>{new Date(editingSale.creado_en).toLocaleString('es-DO')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="btn-secondary text-xs py-2.5 px-4 font-bold"
                >
                  ← Volver a Ventas
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2.5 px-5 font-bold flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle size={15} /> Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (viewingQuote) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="text-primary" size={26} />
                Detalle de Cotización {viewingQuote.codigo}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Estado: {saleStatusMap[viewingQuote.estado]?.label ?? viewingQuote.estado} · Válida hasta {viewingQuote.valida_hasta || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConvertQuote(viewingQuote)}
                className="btn-primary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
              >
                <ArrowRightLeft size={14} /> Facturar Cotización
              </button>
              <button
                type="button"
                onClick={() => setViewingQuote(null)}
                className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
              >
                ← Volver a Cotizaciones
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Ítems de Cotización ({viewingQuote.items?.length || 0})
                </h3>
                {loadingQuoteDetail ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Cargando ítems...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground bg-secondary/30">
                          <th className="text-left py-2 px-3">Producto</th>
                          <th className="text-center py-2 px-3">Cantidad</th>
                          <th className="text-right py-2 px-3">Precio Unit.</th>
                          <th className="text-right py-2 px-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(viewingQuote.items || []).map((item) => (
                          <tr key={item.id} className="hover:bg-secondary/20">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-foreground text-sm">{item.nombre_item}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-foreground">
                              {item.cantidad}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              RD$ {item.precio_unitario.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                              RD$ {item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Información de Cotización
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{viewingQuote.cliente_nombre || 'Cliente general'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fecha emisión:</span><span>{new Date(viewingQuote.creado_en).toLocaleString('es-DO')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Válida hasta:</span><span className="font-mono">{viewingQuote.valida_hasta || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Vendedor:</span><span>{viewingQuote.vendedor_nombre || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estado:</span><span className={saleStatusMap[viewingQuote.estado]?.cls ?? 'badge-neutral'}>{saleStatusMap[viewingQuote.estado]?.label ?? viewingQuote.estado}</span></div>
                </div>
              </div>

              <div className="card p-5 space-y-3 bg-card border border-border shadow-sm text-xs">
                <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
                  Totales
                </h3>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-mono">RD$ {viewingQuote.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-muted-foreground">ITBIS:</span><span className="font-mono text-amber-600 dark:text-amber-400">RD$ {viewingQuote.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-black text-base text-foreground"><span>Total:</span><span className="text-primary font-mono">RD$ {viewingQuote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setConvertQuote(viewingQuote)}
                  className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                >
                  <ArrowRightLeft size={15} /> Convertir a Venta
                </button>
                <button
                  type="button"
                  onClick={() => setViewingQuote(null)}
                  className="btn-secondary w-full py-2.5 text-xs font-bold"
                >
                  ← Volver a Cotizaciones
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (convertQuote) {
    return (
      <AppLayout>
        <div className="space-y-6 slide-up max-w-xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="text-primary" size={26} />
                Convertir Cotización a Venta
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Generar factura a partir de la cotización {convertQuote.codigo}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConvertQuote(null)}
              className="btn-secondary flex items-center gap-1.5 font-bold"
            >
              ← Volver a Cotizaciones
            </button>
          </div>

          <div className="card p-6 space-y-5 shadow-lg border-primary/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estás a punto de procesar la cotización <strong className="font-mono text-foreground font-bold">{convertQuote.codigo}</strong> por el monto total de{' '}
              <strong className="text-primary font-mono text-base font-black">
                RD$ {convertQuote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </strong>
              . Se creará una factura formal y se descontará el stock en la base de datos.
            </p>

            <div className="bg-secondary/30 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{convertQuote.cliente_nombre || 'Cliente General'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Ítems:</span><span className="font-bold">{convertQuote.items?.length || 0} producto(s)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monto Total:</span><span className="font-mono font-bold">RD$ {convertQuote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Seleccionar Método de Pago</label>
              <select
                className="input-field text-sm py-2.5 w-full font-semibold"
                value={convertPaymentMethod}
                onChange={(e) => setConvertPaymentMethod(e.target.value as MetodoPago)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div className="flex gap-3 pt-3 border-t border-border">
              <button type="button" onClick={() => setConvertQuote(null)} className="flex-1 btn-secondary text-sm py-2.5 font-bold">
                ← Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertQuote}
                className="flex-1 btn-primary text-sm py-2.5 font-bold flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle size={16} /> Confirmar y Facturar
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="text-primary" size={26} />
              Módulo de Ventas y Gestión Comercial
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canSeeAllSales
                ? 'Control de ventas, facturación con ITBIS 18% transparentado, cotizaciones y devoluciones'
                : 'Consulta las ventas que realizaste. Editar o anular requiere permiso de administrador'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'returns' ? (
              <button
                type="button"
                onClick={() => setCreatingReturn(true)}
                className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>Nueva Devolución</span>
              </button>
            ) : tab === 'quotes' ? (
              <>
                {canCreateSales && (
                  <button
                    type="button"
                    onClick={() => setShowAddQuoteForm(true)}
                    className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus size={15} /> Nueva Cotización
                  </button>
                )}
                {canCreateSales && (
                  <button
                    type="button"
                    onClick={() => setShowAddSaleForm(true)}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ShoppingCart size={14} /> Nueva Venta
                  </button>
                )}
              </>
            ) : (
              <>
                {canCreateSales && (
                  <button
                    type="button"
                    onClick={() => setShowAddQuoteForm(true)}
                    className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText size={14} /> Nueva Cotización
                  </button>
                )}
                {canCreateSales && (
                  <button
                    type="button"
                    onClick={() => setShowAddSaleForm(true)}
                    className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus size={15} /> Nueva Venta
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Live Key Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tab === 'returns' ? (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Reembolsado</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD$ {devoluciones.reduce((s, x) => s + Number(x.monto_total || 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aprobadas</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {devoluciones.filter((d) => d.estado === 'aprobada').length} {devoluciones.filter((d) => d.estado === 'aprobada').length === 1 ? 'aprobada' : 'aprobadas'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pendientes de Revisión</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
                  {devoluciones.filter((d) => d.estado === 'pendiente').length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Solicitudes Registradas</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {devoluciones.length} {devoluciones.length === 1 ? 'devolución' : 'devoluciones'}
                </p>
              </div>
            </>
          ) : tab === 'quotes' ? (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Monto Cotizado</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD$ {cotizaciones.reduce((s, x) => s + Number(x.monto_total || 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Convertidas a Venta</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {cotizaciones.filter((c) => c.estado === 'convertida').length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cotizaciones Pendientes</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
                  {cotizaciones.filter((c) => c.estado === 'pendiente').length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cotizaciones</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {cotizaciones.length} {cotizaciones.length === 1 ? 'cotización' : 'cotizaciones'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ventas Totales</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD$ {ventas.reduce((s, x) => s + x.monto_total, 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ganancia Bruta Estimada</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD${' '}
                  {ventas
                    .reduce((s, x) => s + (x.monto_total - x.costo_total), 0)
                    .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">ITBIS (18% Transparentado)</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD$ {ventas.reduce((s, x) => s + x.monto_impuesto, 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Facturas Emitidas</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  {totalVentas} {totalVentas === 1 ? 'factura' : 'facturas'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl w-fit flex-wrap border border-slate-200/70 dark:border-slate-700/60">
          {[
            { id: 'sales' as Tab, label: 'Todas las Ventas', icon: <ShoppingCart size={15} />, count: totalVentas },
            { id: 'quotes' as Tab, label: 'Cotizaciones', icon: <FileText size={15} />, count: cotizaciones.length },
            { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={15} />, count: devoluciones.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
              <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Integrated Filter Toolbar */}
        <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#007052] focus:ring-1 focus:ring-[#007052] outline-none transition"
                placeholder={
                  tab === 'returns'
                    ? 'Buscar por código, factura o cliente...'
                    : 'Buscar por número de factura, NCF o cliente...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Date Range Inline */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-medium hidden sm:inline">Desde</span>
              <input
                type="date"
                title="Fecha desde"
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 outline-none"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-slate-400 text-xs">—</span>
              <span className="text-[11px] font-medium hidden sm:inline">Hasta</span>
              <input
                type="date"
                title="Fecha hasta"
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 outline-none"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
              {tab === 'sales' ? ventas.length : tab === 'quotes' ? cotizaciones.length : devoluciones.length}{' '}
              {(() => {
                const count = tab === 'sales' ? ventas.length : tab === 'quotes' ? cotizaciones.length : devoluciones.length;
                return count === 1 ? 'registro' : 'registros';
              })()}
            </span>
            <div className="flex items-center gap-1.5">
              {canExportSales && (
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Download size={13} /> PDF
                </button>
              )}
              {canExportSales && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet size={13} /> Excel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB 1: TODAS LAS VENTAS */}
        {tab === 'sales' && (
          <div className="card overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            {errorVentas && (
              <div className="px-5 py-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold border-b border-rose-200 dark:border-rose-900">
                {errorVentas}
              </div>
            )}
            {!canSeeAllSales && (
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-xs font-medium border-b border-slate-200 dark:border-slate-800">
                Mostrando solo tus ventas. Para editar o anular una factura, solicita permiso a un administrador.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="text-left px-5 py-3.5">Factura / NCF</th>
                    <th className="text-left px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <span>Fecha / Hora</span>
                        <ArrowRightLeft size={12} className="rotate-90 text-slate-400" />
                      </div>
                    </th>
                    <th className="text-left px-4 py-3.5">Cliente</th>
                    <th className="text-left px-4 py-3.5">Cajero</th>
                    <th className="text-center px-4 py-3.5">Método de Pago</th>
                    <th className="text-right px-5 py-3.5">Total</th>
                    <th className="text-right px-5 py-3.5">Ganancia Bruta</th>
                    <th className="text-center px-4 py-3.5">Estado</th>
                    <th className="text-right px-5 py-3.5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingVentas ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Cargando ventas desde Supabase...
                      </td>
                    </tr>
                  ) : ventas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        No se encontraron ventas registradas
                      </td>
                    </tr>
                  ) : (
                    ventas.map((s, i) => {
                      const openUpward = i >= ventas.length - 2 || (ventas.length > 3 && i >= ventas.length / 2);
                      const ganancia = s.monto_total - s.costo_total;
                      const marginPct = s.monto_total > 0 ? ((ganancia / s.monto_total) * 100).toFixed(1) : '0.0';

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Factura / NCF */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                <FileText size={18} />
                              </div>
                              <div>
                                <div className="font-mono text-slate-900 dark:text-white font-bold text-xs">
                                  {s.numero_factura}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                  <span>{s.ncf ? `NCF: ${s.ncf}` : 'Factura Simple'}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Fecha / Hora */}
                          <td className="px-4 py-3.5 text-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {new Date(s.creado_en).toLocaleDateString('es-DO')}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">
                              {new Date(s.creado_en).toLocaleTimeString('es-DO', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-xs text-slate-900 dark:text-white">
                              {s.cliente_nombre || 'Cliente general'}
                            </div>
                          </td>

                          {/* Cajero */}
                          <td className="px-4 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {s.cajero_nombre || 'super admin'}
                          </td>

                          {/* Método de Pago */}
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                s.metodo_pago === 'efectivo'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                                  : s.metodo_pago === 'tarjeta'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800'
                                    : s.metodo_pago === 'transferencia'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                                      : s.metodo_pago === 'credito'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {s.metodo_pago === 'efectivo' && <Banknote size={14} />}
                              {s.metodo_pago === 'tarjeta' && <CreditCard size={14} />}
                              {s.metodo_pago === 'transferencia' && <Smartphone size={14} />}
                              {s.metodo_pago === 'credito' && <Split size={14} />}
                              {s.metodo_pago === 'mixto' && <Layers size={14} />}
                              <span className="capitalize">{metodoLabel[s.metodo_pago] || s.metodo_pago}</span>
                            </span>
                          </td>

                          {/* Total */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="font-extrabold text-xs tabular-nums text-slate-900 dark:text-white">
                              RD$ {s.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                              RD$ {s.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} + ITBIS RD$ {s.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </div>
                          </td>

                          {/* Ganancia Bruta */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="font-extrabold text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                              RD$ {ganancia.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                              {marginPct}%
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                                (s.estado as string) === 'anulada' || (s.estado as string) === 'cancelled'
                                  ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                              }`}
                            >
                              {(s.estado as string) === 'anulada' || (s.estado as string) === 'cancelled' ? (
                                <>
                                  <XCircle size={13} />
                                  <span>Anulada</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={13} />
                                  <span>Completada</span>
                                </>
                              )}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="relative inline-block text-left">
                              <button
                                type="button"
                                onClick={() => setOpenActionsId(openActionsId === s.id ? null : s.id)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                              >
                                <span>Acciones</span>
                                <MoreVertical size={14} className="text-slate-400" />
                              </button>

                              {openActionsId === s.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setOpenActionsId(null)}
                                  />
                                  <div
                                    className={`absolute right-0 ${
                                      openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                    } w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-40 py-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in zoom-in-95`}
                                  >
                                    <div className="py-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionsId(null);
                                          void handleOpenSaleDetail(s);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                      >
                                        <Eye size={15} className="text-emerald-600" />
                                        <span>Ver Detalle</span>
                                      </button>
                                      {canEditSales && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsId(null);
                                            handleOpenEditSale(s);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                        >
                                          <Edit size={15} className="text-amber-500" />
                                          <span>Editar Factura</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionsId(null);
                                          void handleOpenPrintSale(s);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                      >
                                        <Printer size={15} className="text-blue-500" />
                                        <span>Imprimir Factura</span>
                                      </button>
                                      {s.estado !== 'anulada' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsId(null);
                                            setReturnSale(s);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                        >
                                          <RotateCcw size={15} />
                                          <span>Hacer Devolución</span>
                                        </button>
                                      )}
                                    </div>
                                    {canDeleteSales && s.estado !== 'anulada' && (
                                      <div className="py-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsId(null);
                                            setAnulandoSale(s);
                                          }}
                                          className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                        >
                                          <Trash2 size={15} />
                                          <span>Eliminar / Anular</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Pagination Bar */}
            {(() => {
              const totalCount = totalVentas || ventas.length;
              const totalPages = Math.max(1, Math.ceil(totalCount / limit));
              const startRecord = totalCount > 0 ? (page - 1) * limit + 1 : 0;
              const endRecord = Math.min(totalCount, page * limit);

              const getPageNumbers = () => {
                const pages: (number | string)[] = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  if (page <= 3) {
                    pages.push(1, 2, 3, '...', totalPages);
                  } else if (page >= totalPages - 2) {
                    pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
                  } else {
                    pages.push(1, '...', page, '...', totalPages);
                  }
                }
                return pages;
              };

              return (
                <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                  <div>
                    Mostrando {startRecord} a {endRecord} de {totalCount.toLocaleString()} ventas
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Rows Per Page selector */}
                    <div className="flex items-center gap-2">
                      <span>Mostrar</span>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setPage(1);
                        }}
                        className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                      </select>
                      <span>por página</span>
                    </div>

                    {/* Pagination Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      {getPageNumbers().map((pNum, pIdx) =>
                        typeof pNum === 'number' ? (
                          <button
                            key={`pnum-${pNum}`}
                            type="button"
                            onClick={() => setPage(pNum)}
                            className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                              page === pNum
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {pNum}
                          </button>
                        ) : (
                          <span key={`pdots-${pIdx}`} className="px-1 text-slate-400">
                            ...
                          </span>
                        )
                      )}

                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <ChevronDown size={16} className="-rotate-90" />
                      </button>
                    </div>

                    {/* Direct Jump to Page */}
                    <div className="flex items-center gap-2">
                      <span>Ir a</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={page}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 1 && val <= totalPages) setPage(val);
                        }}
                        className="w-14 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold text-slate-800 dark:text-slate-200"
                      />
                      <span>de {totalPages}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: COTIZACIONES */}
        {tab === 'quotes' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                      Fecha Emisión
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                      Válida hasta
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCotizaciones ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        Cargando cotizaciones desde Supabase...
                      </td>
                    </tr>
                  ) : cotizaciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        No hay cotizaciones registradas
                      </td>
                    </tr>
                  ) : (
                    cotizaciones.map((q, i) => (
                      <tr
                        key={q.id}
                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-secondary/10'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-primary font-bold">{q.codigo}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{q.cliente_nombre || 'Cliente general'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                          {new Date(q.creado_en).toLocaleDateString('es-DO')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs font-mono">
                          {q.valida_hasta || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          RD$ {q.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={saleStatusMap[q.estado]?.cls ?? 'badge-neutral'}>
                            {saleStatusMap[q.estado]?.label ?? q.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {q.estado === 'pendiente' && (
                              <button
                                onClick={() => setConvertQuote(q)}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs font-bold flex items-center gap-1 transition-all"
                                title="Convertir a Factura"
                              >
                                <ArrowRightLeft size={13} /> Convertir Venta
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleOpenQuoteDetail(q)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver Detalle Cotización"
                            >
                              <Eye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: DEVOLUCIONES */}
        {tab === 'returns' && (
          <div className="card overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RotateCcw size={15} className="text-[#007052]" />
                  Devoluciones y Reembolsos Registrados
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historial de solicitudes de devolución y notas de crédito emitidas
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Factura Ref.</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Cliente</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Fecha</th>
                    <th className="px-4 py-3 text-right">Total Reembolso</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Motivo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingDevoluciones ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs">
                        Cargando devoluciones...
                      </td>
                    </tr>
                  ) : devoluciones.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs">
                        No hay devoluciones registradas
                      </td>
                    </tr>
                  ) : (
                    devoluciones.map((r) => {
                      const isGenericClient =
                        !r.cliente_nombre ||
                        r.cliente_nombre.trim() === 'Cliente general' ||
                        r.cliente_nombre.trim() === 'Consumidor Final';

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Código */}
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {r.codigo}
                          </td>

                          {/* Factura Ref. */}
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 text-xs">
                            {r.numero_factura || '—'}
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            {isGenericClient ? (
                              <span className="text-slate-400 text-xs italic">Consumidor Final</span>
                            ) : (
                              <span className="text-slate-800 dark:text-slate-200 font-medium text-xs">
                                {r.cliente_nombre}
                              </span>
                            )}
                          </td>

                          {/* Fecha */}
                          <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs whitespace-nowrap">
                            {formatCleanDateTime(r.creado_en)}
                          </td>

                          {/* Total Reembolso */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                            RD$ {Number(r.monto_total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Motivo */}
                          <td
                            className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell text-xs max-w-[180px] truncate"
                            title={r.motivo}
                          >
                            {r.motivo}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3 text-center">
                            {r.estado === 'aprobada' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <CheckCircle size={12} /> Aprobada
                              </span>
                            ) : r.estado === 'rechazada' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                <XCircle size={12} /> Rechazada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                <Clock size={12} /> Pendiente
                              </span>
                            )}
                          </td>

                          {/* Acciones Admin */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.estado === 'pendiente' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      procesarEstadoDevolucion(r.id, 'aprobada');
                                      toast.success(`Devolución ${r.codigo} aprobada exitosamente`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <CheckCircle size={13} /> Aprobar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectingReturnId(r.id)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <XCircle size={13} /> Rechazar
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                  ✓ Procesado
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 5: ANULAR FACTURA */}
        {anulandoSale &&
          createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setAnulandoSale(null)}
            >
              <div
                className="card w-full max-w-md my-auto max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border-rose-500/30 bg-white dark:bg-slate-900 rounded-2xl border"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={24} />
                    <h3 className="font-extrabold text-foreground text-lg">Anular Factura de Venta</h3>
                  </div>
                  <button type="button" onClick={() => setAnulandoSale(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  ¿Estás seguro de anular la factura <strong className="font-mono text-foreground">{anulandoSale.numero_factura}</strong> por{' '}
                  <strong className="text-rose-600 font-bold">
                    RD$ {anulandoSale.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </strong>
                  ? El estado de la factura cambiará a &quot;Anulada&quot; y el stock será restaurado en la base de datos.
                </p>

                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Motivo de Anulación</label>
                  <input
                    className="input-field text-xs py-2 w-full rounded-xl"
                    value={anularMotivo}
                    onChange={(e) => setAnularMotivo(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button type="button" onClick={() => setAnulandoSale(null)} className="btn-secondary text-xs py-2">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAnular}
                    className="btn-primary text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs"
                  >
                    <Trash2 size={14} /> Confirmar Anulación
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* MODAL: IMPRIMIR FACTURA */}
        {printingSale &&
          createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden print:p-0 print:bg-white print:static"
              onClick={() => setPrintingSale(null)}
            >
              <div
                className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:p-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header (Fixed at top) */}
                <div className="flex items-center justify-between border-b border-border p-5 flex-shrink-0 print:hidden">
                  <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                      <Printer size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base leading-tight">
                        Imprimir Factura {printingSale.numero_factura}
                      </h3>
                      {printingSale.ncf && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">NCF: {printingSale.ncf}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex p-0.5 bg-secondary rounded-lg text-xs font-semibold border border-border">
                      <button
                        type="button"
                        onClick={() => setPrintFormat('a4')}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          printFormat === 'a4'
                            ? 'bg-card text-foreground font-bold shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <FileText size={12} /> Hoja A4
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintFormat('ticket')}
                        className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          printFormat === 'ticket'
                            ? 'bg-card text-foreground font-bold shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Receipt size={12} /> Ticket 80mm
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintingSale(null)}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Body (Scrollable invoice preview) */}
                <div className="flex-1 overflow-y-auto p-5 min-h-0 printable-document scrollbar-thin">
                  {loadingPrintDetail ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Cargando información de impresión...
                    </div>
                  ) : (
                    <PrintableInvoice
                      invoiceData={{
                        invoiceNumber: printingSale.numero_factura,
                        isFiscal: Boolean(printingSale.ncf),
                        ncf: printingSale.ncf || undefined,
                        ncfType: printingSale.ncf ? printingSale.ncf.slice(0, 3) : undefined,
                        issueDate: new Date(printingSale.creado_en).toLocaleDateString('es-DO'),
                        issueTime: new Date(printingSale.creado_en).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
                        cashier: printingSale.cajero_nombre || 'Cajero',
                        customerName: printingSale.cliente_nombre || dbClientes.find((c) => c.id === printingSale.cliente_id)?.nombre || 'Consumidor Final',
                        customerRnc: dbClientes.find((c) => c.id === printingSale.cliente_id)?.rnc_cedula || undefined,
                        customerPhone: dbClientes.find((c) => c.id === printingSale.cliente_id)?.telefono || undefined,
                        customerAddress: dbClientes.find((c) => c.id === printingSale.cliente_id)?.direccion || undefined,
                        items: (printingSale.detalle_ventas || []).map((it) => ({
                          sku: it.producto_id || undefined,
                          name: it.nombre_item,
                          qty: it.cantidad,
                          price: it.precio_unitario,
                          subtotal: it.subtotal,
                          itbis: (it.precio_unitario - it.precio_unitario / 1.18) * it.cantidad,
                        })),
                        subtotal: printingSale.subtotal,
                        discount: printingSale.monto_descuento || undefined,
                        itbis: printingSale.monto_impuesto,
                        total: printingSale.monto_total,
                        paymentMethod: printingSale.metodo_pago,
                      }}
                      formatOverride={printFormat === 'ticket' ? 'ticket_80mm' : 'full_page'}
                    />
                  )}
                </div>

                {/* Footer Buttons (Fixed at bottom) */}
                <div className="flex justify-end gap-2.5 p-4 border-t border-border flex-shrink-0 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-2xl print:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      exportTableToPdf({
                        title: `FACTURA FISCAL - ${printingSale.numero_factura}`,
                        subtitle: `Cliente: ${printingSale.cliente_nombre || 'Consumidor Final'} | NCF: ${printingSale.ncf || 'N/A'}`,
                        filename: `factura-${printingSale.numero_factura}`,
                        headers: ['Producto', 'Cant.', 'Precio Unit.', 'Subtotal'],
                        rows: (printingSale.detalle_ventas || []).map((it) => [
                          it.nombre_item,
                          it.cantidad,
                          formatMoneyPdf(it.precio_unitario),
                          formatMoneyPdf(it.subtotal),
                        ]),
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Download size={14} /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-[#007052] hover:bg-[#005c43] text-white text-xs py-2 px-4 rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Printer size={15} /> Imprimir Ahora
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}


      </div>
    </AppLayout>
  );
}
