import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { toast } from '@/lib/toast';
import { useVentas } from '@/hooks/useVentas';
import { useCotizaciones } from '@/hooks/useCotizaciones';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissionsStore';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';
import { syncInvoiceSettingsFromSupabase } from '@/lib/invoiceSettingsStore';

import type { SalesTab } from './sales/types';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const roleNorm = (user?.role ?? '').trim().toLowerCase();
  const isAdmin =
    roleNorm === 'administrador' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super_admin' ||
    roleNorm === 'superadmin';
  const canSeeAllSales = isAdmin || roleNorm === 'contador';
  const canEditSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'editar');
  const canDeleteSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'eliminar');
  const canCreateSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'crear');
  const canExportSales = isAdmin || hasPermission(user?.role ?? 'Cajero', 'ventas', 'exportar');
  const ownCajeroId = !canSeeAllSales ? user?.id : undefined;

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, tab]);

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
    handleSaveEditSale,
    printingSale,
    setPrintingSale,
    loadingPrintDetail,
    handleOpenPrintSale,
    viewingQuote,
    setViewingQuote,
    loadingQuoteDetail,
    handleOpenQuoteDetail,
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
      const cot = await guardarCotizacion(payload);
      toast.success(`Cotización ${cot.codigo} guardada exitosamente`);
      setShowAddQuoteForm(false);
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

  const currentCount =
    tab === 'sales' ? ventas.length : tab === 'quotes' ? cotizaciones.length : devoluciones.length;

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
        />

        {/* Tab Navigation and Filter Toolbar */}
        <SalesFilterToolbar
          tab={tab}
          onTabChange={setTab}
          counts={{
            sales: totalVentas,
            quotes: cotizaciones.length,
            returns: devoluciones.length,
          }}
          search={search}
          onSearchChange={setSearch}
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
