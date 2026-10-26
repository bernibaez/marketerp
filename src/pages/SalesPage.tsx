import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  ShoppingCart,
  FileText,
  RotateCcw,
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  ArrowRightLeft,
} from 'lucide-react';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { toast } from '@/lib/toast';
import { useVentas } from '@/hooks/useVentas';
import { useCotizaciones } from '@/hooks/useCotizaciones';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import { obtenerClientes } from '@/services/clientes.service';
import { obtenerProductos } from '@/services/productos.service';
import type { Cliente, Producto, MetodoPago, EstadoVenta } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';
import { obtenerDetalleCotizacion, type CotizacionConDetalle } from '@/services/cotizaciones.service';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissionsStore';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';

import { saleStatusMap, metodoLabel } from './sales/types';
import { SaleDetailView } from './sales/components/SaleDetailView';
import { SaleEditView } from './sales/components/SaleEditView';
import { QuoteDetailView } from './sales/components/QuoteDetailView';
import { QuoteConvertView } from './sales/components/QuoteConvertView';
import { SaleCreateView } from './sales/components/SaleCreateView';
import { QuoteCreateView } from './sales/components/QuoteCreateView';
import { SaleAnularModal } from './sales/components/SaleAnularModal';
import { SalePrintModal } from './sales/components/SalePrintModal';
import { SalesTable } from './sales/components/SalesTable';
import { QuotesTable } from './sales/components/QuotesTable';
import { ReturnsTable } from './sales/components/ReturnsTable';

type Tab = 'sales' | 'quotes' | 'returns';

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

  // Views & Modals state
  const [showAddSaleForm, setShowAddSaleForm] = useState(false);
  const [showAddQuoteForm, setShowAddQuoteForm] = useState(false);

  const [viewingSale, setViewingSale] = useState<VentaConDetalle | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);

  const [anulandoSale, setAnulandoSale] = useState<VentaConDetalle | null>(null);
  const [anularMotivo, setAnularMotivo] = useState('Anulación por error de facturación');

  const [viewingQuote, setViewingQuote] = useState<CotizacionConDetalle | null>(null);
  const [loadingQuoteDetail, setLoadingQuoteDetail] = useState(false);
  const [convertQuote, setConvertQuote] = useState<CotizacionConDetalle | null>(null);

  const [editingSale, setEditingSale] = useState<VentaConDetalle | null>(null);

  const [printingSale, setPrintingSale] = useState<VentaConDetalle | null>(null);
  const [loadingPrintDetail, setLoadingPrintDetail] = useState(false);

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
    convertirAVenta,
  } = useCotizaciones({
    busqueda: tab === 'quotes' ? search : undefined,
  });

  const {
    devoluciones,
    loading: loadingDevoluciones,
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

  // Handlers for Sale detail & modals
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
      // Keep list summary
    } finally {
      setLoadingQuoteDetail(false);
    }
  };

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al anular la venta');
    }
  };

  const handleSaveEditSale = async (data: {
    cliente_id: string | null;
    metodo_pago: MetodoPago;
    tipo_ncf: string | null;
    ncf: string | null;
    monto_descuento: number;
    estado: string;
  }) => {
    if (!editingSale) return;
    if (!canEditSales) {
      toast.error('Solo un administrador puede editar facturas');
      return;
    }
    try {
      await actualizar(editingSale.id, {
        cliente_id: data.cliente_id,
        metodo_pago: data.metodo_pago,
        tipo_ncf: data.tipo_ncf,
        ncf: data.ncf,
        monto_descuento: data.monto_descuento,
        estado: data.estado as EstadoVenta,
      });
      toast.success(`Factura ${editingSale.numero_factura} actualizada exitosamente`);
      setEditingSale(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar la factura');
    }
  };

  const handleOpenPrintSale = async (s: VentaConDetalle) => {
    setPrintingSale(s);
    setLoadingPrintDetail(true);
    try {
      const full = await obtenerDetalle(s.id);
      if (full) setPrintingSale(full);
    } catch {
      // Keep summary
    } finally {
      setLoadingPrintDetail(false);
    }
  };

  const handleCreateSaleSubmit = async (payload: Parameters<typeof cobrar>[0]) => {
    try {
      const res = await cobrar(payload);
      toast.success(`¡Venta procesada con éxito! Factura: ${res.numero_factura}`);
      setShowAddSaleForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la venta');
    }
  };

  const handleCreateQuoteSubmit = async (payload: Parameters<typeof guardarCotizacion>[0]) => {
    try {
      const cot = await guardarCotizacion(payload);
      toast.success(`Cotización ${cot.codigo} guardada exitosamente`);
      setShowAddQuoteForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la cotización');
    }
  };

  const handleConfirmConvertQuote = async (paymentMethod: MetodoPago) => {
    if (!convertQuote) return;
    try {
      const res = await convertirAVenta(convertQuote.id, paymentMethod);
      toast.success(`Cotización convertida a factura: ${res.numero_factura}`);
      setConvertQuote(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al convertir la cotización');
    }
  };

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

  // Full-page Views
  if (showAddSaleForm) {
    return (
      <AppLayout>
        <SaleCreateView
          clients={dbClientes}
          products={dbProductos}
          onSubmit={handleCreateSaleSubmit}
          onClose={() => setShowAddSaleForm(false)}
        />
      </AppLayout>
    );
  }

  if (showAddQuoteForm) {
    return (
      <AppLayout>
        <QuoteCreateView
          clients={dbClientes}
          products={dbProductos}
          onSubmit={handleCreateQuoteSubmit}
          onClose={() => setShowAddQuoteForm(false)}
        />
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
        <SaleDetailView
          sale={viewingSale}
          loadingDetail={loadingSaleDetail}
          onPrint={(s) => {
            setViewingSale(null);
            void handleOpenPrintSale(s);
          }}
          onReturn={(s) => {
            setViewingSale(null);
            setReturnSale(s);
          }}
          onClose={() => setViewingSale(null)}
        />
      </AppLayout>
    );
  }

  if (editingSale) {
    return (
      <AppLayout>
        <SaleEditView
          sale={editingSale}
          clients={dbClientes}
          onSave={handleSaveEditSale}
          onClose={() => setEditingSale(null)}
        />
      </AppLayout>
    );
  }

  if (viewingQuote) {
    return (
      <AppLayout>
        <QuoteDetailView
          quote={viewingQuote}
          loadingDetail={loadingQuoteDetail}
          onConvert={(q) => setConvertQuote(q)}
          onClose={() => setViewingQuote(null)}
        />
      </AppLayout>
    );
  }

  if (convertQuote) {
    return (
      <AppLayout>
        <QuoteConvertView
          quote={convertQuote}
          onConfirm={handleConfirmConvertQuote}
          onClose={() => setConvertQuote(null)}
        />
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
                <button
                  type="button"
                  onClick={() => setCreatingReturn(true)}
                  className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-900/30 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <RotateCcw size={14} /> Devolución
                </button>
                {canCreateSales && (
                  <button
                    type="button"
                    onClick={() => setShowAddSaleForm(true)}
                    className="bg-[#007052] hover:bg-[#005c43] active:bg-[#004733] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Nueva Venta</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tab === 'returns' ? (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Reembolsos</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                  RD$ {devoluciones.reduce((s, x) => s + Number(x.monto_total || 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Aprobadas</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {devoluciones.filter((d) => d.estado === 'aprobada').length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pendientes</p>
                <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-0.5">
                  {devoluciones.filter((d) => d.estado === 'pendiente').length}
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Solicitudes</p>
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

        {/* Tab 1: Sales Table */}
        {tab === 'sales' && (
          <SalesTable
            sales={ventas}
            totalSales={totalVentas}
            loading={loadingVentas}
            error={errorVentas}
            canSeeAllSales={canSeeAllSales}
            canEditSales={canEditSales}
            canDeleteSales={canDeleteSales}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(lim) => {
              setLimit(lim);
              setPage(1);
            }}
            onViewDetail={(s) => void handleOpenSaleDetail(s)}
            onEditSale={(s) => setEditingSale(s)}
            onPrintSale={(s) => void handleOpenPrintSale(s)}
            onReturnSale={(s) => setReturnSale(s)}
            onAnularSale={(s) => setAnulandoSale(s)}
          />
        )}

        {/* Tab 2: Quotes Table */}
        {tab === 'quotes' && (
          <QuotesTable
            quotes={cotizaciones}
            loading={loadingCotizaciones}
            onConvert={(q) => setConvertQuote(q)}
            onViewDetail={(q) => void handleOpenQuoteDetail(q)}
          />
        )}

        {/* Tab 3: Returns Table */}
        {tab === 'returns' && (
          <ReturnsTable
            returns={devoluciones}
            loading={loadingDevoluciones}
            onApprove={(id, codigo) => {
              procesarEstadoDevolucion(id, 'aprobada');
              toast.success(`Devolución ${codigo} aprobada exitosamente`);
            }}
            onReject={(id) => {
              procesarEstadoDevolucion(id, 'rechazada');
              toast.success('Devolución rechazada');
            }}
          />
        )}

        {/* Modals */}
        {anulandoSale && (
          <SaleAnularModal
            sale={anulandoSale}
            motivo={anularMotivo}
            onMotivoChange={setAnularMotivo}
            onConfirm={handleConfirmAnular}
            onClose={() => setAnulandoSale(null)}
          />
        )}

        {printingSale && (
          <SalePrintModal
            sale={printingSale}
            clients={dbClientes}
            loadingPrintDetail={loadingPrintDetail}
            onClose={() => setPrintingSale(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
