import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { toast } from '@/lib/toast';
import { useVentas } from '@/hooks/useVentas';
import { useCotizaciones } from '@/hooks/useCotizaciones';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import { useAuth } from '@/context/AuthContext';
import { isAdminOrSuperAdmin, normalizeRole, shouldHideProfit } from '@/lib/auth';
import { hasPermission } from '@/lib/permissionsStore';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';
import { syncInvoiceSettingsFromSupabase } from '@/lib/invoiceSettingsStore';
import { HeldSalesTable } from './sales/components/HeldSalesTable';
import { obtenerVentasSuspendidas, type HeldSale } from '@/services/ventasSuspendidas.service';

import type { SalesTab } from './sales/types';
import { SaleDetailView } from './sales/components/SaleDetailView';
import { SaleEditView } from './sales/components/SaleEditView';
import { QuoteDetailView } from './sales/components/QuoteDetailView';
import { QuoteConvertView } from './sales/components/QuoteConvertView';
import { SaleCreateView } from './sales/components/SaleCreateView';
import { QuoteCreateView } from './sales/components/QuoteCreateView';
import { SaleAnularModal } from './sales/components/SaleAnularModal';
import { SalePrintModal } from './sales/components/SalePrintModal';
import { QuotePrintModal } from './sales/components/QuotePrintModal';
import { SalesTable } from './sales/components/SalesTable';
import { QuotesTable } from './sales/components/QuotesTable';
import { ReturnsTable } from './sales/components/ReturnsTable';

import { SalesHeader } from './sales/components/SalesHeader';
import { SalesStatsCards } from './sales/components/SalesStatsCards';
import { SalesFilterToolbar } from './sales/components/SalesFilterToolbar';
import { useSalesModals } from './sales/hooks/useSalesModals';
import { exportSalesPdf, exportQuotesPdf, exportReturnsPdf, exportSalesExcel } from './sales/utils/salesExport';

export default function SalesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<SalesTab>('sales');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [singleDate, setSingleDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const effectiveDateFrom = singleDate || dateFrom;
  const effectiveDateTo = singleDate || dateTo;

  const roleNorm = normalizeRole(user?.role || user?.rolDb);
  const isAdmin = isAdminOrSuperAdmin(user);
  const hideProfit = shouldHideProfit(user);
  const isCajero = roleNorm.includes('cajer');
  const canSeeAllSales = isAdmin || roleNorm.includes('conta');
  const canEditSales = isAdmin || isCajero || hasPermission(user?.role ?? 'Cajero', 'ventas', 'editar');
  const canDeleteSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'eliminar');
  const canCreateSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'crear');
  const canExportSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'exportar');
  const ownCajeroId = !canSeeAllSales ? user?.id : undefined;
  const ownCajeroNombre = !canSeeAllSales ? user?.name : undefined;

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'quotes' || tabParam === 'sales' || tabParam === 'returns' || tabParam === 'held') {
      setTab(tabParam);
    }
  }, [searchParams]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [loadingHeldSales, setLoadingHeldSales] = useState(false);

  const fetchHeldSales = useCallback(async () => {
    setLoadingHeldSales(true);
    try {
      const list = await obtenerVentasSuspendidas();
      setHeldSales(list);
    } finally {
      setLoadingHeldSales(false);
    }
  }, []);

  useEffect(() => {
    void fetchHeldSales();
    const handleUpdate = () => void fetchHeldSales();
    window.addEventListener('mercato_held_sales_updated', handleUpdate);
    return () => window.removeEventListener('mercato_held_sales_updated', handleUpdate);
  }, [fetchHeldSales]);

  useEffect(() => {
    setPage(1);
  }, [search, singleDate, dateFrom, dateTo, tab]);

  // Data Hooks
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
    fechaInicio: effectiveDateFrom || undefined,
    fechaFin: effectiveDateTo || undefined,
    cajeroId: ownCajeroId,
    cajeroNombre: ownCajeroNombre,
  });

  const {
    cotizaciones: rawCotizaciones,
    loading: loadingCotizaciones,
    guardarCotizacion,
    convertirAVenta,
  } = useCotizaciones({
    busqueda: tab === 'quotes' ? search : undefined,
  });

  const {
    devoluciones: rawDevoluciones,
    loading: loadingDevoluciones,
    procesarEstado: procesarEstadoDevolucion,
    refetch: refetchDevoluciones,
  } = useDevoluciones({
    busqueda: tab === 'returns' ? search : undefined,
  });

  const matchesDateRange = (rawIsoOrDate?: string) => {
    if (!effectiveDateFrom && !effectiveDateTo) return true;
    const utcD = String(rawIsoOrDate || '').slice(0, 10);
    const dt = rawIsoOrDate ? new Date(rawIsoOrDate) : null;
    const localD = dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString('en-CA') : utcD;
    if (effectiveDateFrom && localD < effectiveDateFrom && utcD < effectiveDateFrom) return false;
    if (effectiveDateTo && localD > effectiveDateTo && utcD > effectiveDateTo) return false;
    return true;
  };

  const cotizaciones = rawCotizaciones.filter((c) => matchesDateRange(c.creado_en));
  const devoluciones = rawDevoluciones.filter((d) => matchesDateRange(d.creado_en));
  const filteredHeldSales = heldSales.filter((h) => matchesDateRange(h.savedAt));

  // Modal and View Coordinator Hook
  const {
    dbClientes,
    dbProductos,
    showAddSaleForm,
    setShowAddSaleForm,
    showAddQuoteForm,
    setShowAddQuoteForm,
    viewingSale,
    setViewingSale,
    loadingSaleDetail,
    handleOpenSaleDetail,
    anulandoSale,
    setAnulandoSale,
    anularMotivo,
    setAnularMotivo,
    handleConfirmAnular,
    editingSale,
    setEditingSale,
    handleOpenEditSale,
    handleSaveEditSale,
    printingSale,
    setPrintingSale,
    loadingPrintDetail,
    handleOpenPrintSale,
    viewingQuote,
    setViewingQuote,
    loadingQuoteDetail,
    handleOpenQuoteDetail,
    printingQuote,
    setPrintingQuote,
    loadingPrintQuote,
    handleOpenPrintQuote,
    convertQuote,
    setConvertQuote,
    handleConfirmConvertQuote,
    creatingReturn,
    setCreatingReturn,
    returnSale,
    setReturnSale,
  } = useSalesModals({
    canEditSales,
    canDeleteSales,
    obtenerDetalle,
    anular,
    actualizar,
    convertirAVenta,
  });

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && ventas.length > 0 && !editingSale) {
      const target = ventas.find((v) => String(v.id) === String(editId));
      if (target) {
        void handleOpenEditSale(target);
      }
    }
  }, [searchParams, ventas, editingSale]);

  useEffect(() => {
    const printQuoteId = searchParams.get('printQuote');
    if (printQuoteId && rawCotizaciones.length > 0 && !printingQuote) {
      const target = rawCotizaciones.find((c) => String(c.id) === String(printQuoteId));
      if (target) {
        void handleOpenPrintQuote(target);
      }
    }
  }, [searchParams, rawCotizaciones, printingQuote]);

  const handleCreateSaleSubmit = async (payload: Parameters<typeof cobrar>[0]) => {
    try {
      const res = await cobrar({
        ...payload,
        cajero_id: payload.cajero_id ?? user?.id ?? null,
        cajero_nombre: payload.cajero_nombre ?? user?.name ?? 'Cajero',
      });
      toast.success(`¡Venta procesada con éxito! Factura: ${res.numero_factura}`);
      setShowAddSaleForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la venta');
    }
  };

  const handleCreateQuoteSubmit = async (payload: Parameters<typeof guardarCotizacion>[0]) => {
    try {
      const cot = await guardarCotizacion({
        ...payload,
        vendedor_id: payload.vendedor_id ?? user?.id ?? null,
        vendedor_nombre: payload.vendedor_nombre ?? user?.name ?? 'Cajero',
      });
      toast.success(`Cotización ${cot.codigo} guardada exitosamente`);
      setShowAddQuoteForm(false);
      setTab('quotes');
      void handleOpenPrintQuote(cot);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la cotización');
    }
  };

  const handleExportPdf = () => {
    if (tab === 'sales') return exportSalesPdf(ventas);
    if (tab === 'quotes') return exportQuotesPdf(cotizaciones);
    exportReturnsPdf(devoluciones);
  };

  const handleExportExcel = () => {
    exportSalesExcel(ventas);
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
          canEdit={canEditSales}
          onEdit={(s) => {
            setViewingSale(null);
            void handleOpenEditSale(s);
          }}
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
          products={dbProductos}
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
          onPrint={(q) => void handleOpenPrintQuote(q)}
          onClose={() => setViewingQuote(null)}
        />
        {printingQuote && (
          <QuotePrintModal
            quote={printingQuote}
            clients={dbClientes}
            loadingPrintDetail={loadingPrintQuote}
            onClose={() => setPrintingQuote(null)}
          />
        )}
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

  const currentCount =
    tab === 'sales'
      ? ventas.length
      : tab === 'quotes'
      ? cotizaciones.length
      : tab === 'returns'
      ? devoluciones.length
      : filteredHeldSales.length;

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <SalesHeader
          tab={tab}
          canSeeAllSales={canSeeAllSales}
          canCreateSales={canCreateSales}
          onNewSale={() => setShowAddSaleForm(true)}
          onNewQuote={() => setShowAddQuoteForm(true)}
          onNewReturn={() => setCreatingReturn(true)}
        />

        {/* Stats Row */}
        <SalesStatsCards
          tab={tab}
          ventas={ventas}
          totalVentas={totalVentas}
          cotizaciones={cotizaciones}
          devoluciones={devoluciones}
          hideProfit={hideProfit}
        />

        {/* Tab Navigation and Filter Toolbar */}
        <SalesFilterToolbar
          tab={tab}
          onTabChange={setTab}
          counts={{
            sales: totalVentas,
            quotes: cotizaciones.length,
            returns: devoluciones.length,
            held: filteredHeldSales.length,
          }}
          search={search}
          onSearchChange={setSearch}
          singleDate={singleDate}
          onSingleDateChange={setSingleDate}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          currentCount={currentCount}
          canExportSales={canExportSales}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
        />

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
            hideProfit={hideProfit}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(lim) => {
              setLimit(lim);
              setPage(1);
            }}
            onViewDetail={(s) => void handleOpenSaleDetail(s)}
            onEditSale={(s) => void handleOpenEditSale(s)}
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
            onPrintQuote={(q) => void handleOpenPrintQuote(q)}
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

        {/* Tab 4: Held Sales Table */}
        {tab === 'held' && (
          <HeldSalesTable
            heldSales={filteredHeldSales}
            loading={loadingHeldSales}
            onRefresh={fetchHeldSales}
            canManage={canEditSales || canDeleteSales}
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

        {printingQuote && (
          <QuotePrintModal
            quote={printingQuote}
            clients={dbClientes}
            loadingPrintDetail={loadingPrintQuote}
            onClose={() => setPrintingQuote(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
