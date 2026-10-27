import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Download, RotateCcw, FileSpreadsheet, Clock, Shield, Plus } from 'lucide-react';
import type { PosReturn } from '@/lib/posStore';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import { useAuth } from '@/context/AuthContext';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';

import { mapDevolucionToPosReturn, methodLabel, typeLabel } from './returns/returnsShared';
import ReturnsStatsCards from './returns/components/ReturnsStatsCards';
import ReturnsFiltersBar, { type ReturnStatusTab } from './returns/components/ReturnsFiltersBar';
import ReturnsTable from './returns/components/ReturnsTable';
import ReturnDetailView from './returns/components/ReturnDetailView';
import ReturnRejectModal from './returns/components/ReturnRejectModal';

export default function ReturnsHistoryPage() {
  const { user: authUser } = useAuth();
  const { devoluciones, loading, refetch, procesarEstado, procesando } = useDevoluciones({
    limite: 200,
  });
  const returns = useMemo(() => devoluciones.map(mapDevolucionToPosReturn), [devoluciones]);
  const [selectedReturn, setSelectedReturn] = useState<PosReturn | null>(null);
  const [statusTab, setStatusTab] = useState<ReturnStatusTab>('all');
  const [searchParams] = useSearchParams();
  const [newReturnOpen, setNewReturnOpen] = useState(
    () => searchParams.get('action') === 'new' || searchParams.get('nueva') === '1'
  );

  // Rejection modal state
  const [rejectingReturn, setRejectingReturn] = useState<PosReturn | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState(
    'No cumple con las políticas de devolución de tienda'
  );

  // Filters
  const [date, setDate] = useState('');
  const [user, setUser] = useState('');
  const [customer, setCustomer] = useState('');
  const [cashier, setCashier] = useState('');
  const [product, setProduct] = useState('');

  const pendingCount = useMemo(() => returns.filter((r) => r.status === 'pending').length, [returns]);
  const approvedCount = useMemo(() => returns.filter((r) => r.status === 'approved').length, [returns]);
  const rejectedCount = useMemo(() => returns.filter((r) => r.status === 'rejected').length, [returns]);

  const filtered = useMemo(() => {
    const q = product.toLowerCase().trim();
    return returns.filter((r) => {
      if (statusTab !== 'all' && (r.status || 'approved') !== statusTab) return false;
      if (date && r.date !== date) return false;
      if (user && !r.user.toLowerCase().includes(user.toLowerCase())) return false;
      if (customer && !r.customer.toLowerCase().includes(customer.toLowerCase())) return false;
      if (cashier && !r.cashier.toLowerCase().includes(cashier.toLowerCase())) return false;
      if (q) {
        const matchProduct = r.products.some(
          (p) => p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false)
        );
        if (!matchProduct) return false;
      }
      return true;
    });
  }, [returns, statusTab, date, user, customer, cashier, product]);

  const totalAmount = filtered.reduce((s, r) => s + r.total, 0);
  const reviewerName = authUser?.name || authUser?.email || 'Administrador';

  const handleApproveReturn = async (r: PosReturn) => {
    try {
      await procesarEstado(r.id, 'aprobada');
      logAuditEvent({
        user: reviewerName,
        role: 'Administrador',
        action: 'Devolución',
        module: 'Devoluciones',
        details: `Devolución ${r.code} (Factura: ${r.saleCode}) por RD$ ${r.total.toLocaleString()} APROBADA`,
        before: { id: r.id, status: r.status },
        after: { id: r.id, status: 'approved', reviewedBy: reviewerName },
      });
      toast.success(`Devolución ${r.code} APROBADA exitosamente`);
      await refetch();
      if (selectedReturn?.id === r.id) {
        setSelectedReturn((prev) => (prev ? { ...prev, status: 'approved', reviewedBy: reviewerName } : null));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo aprobar la devolución');
    }
  };

  const handleOpenRejectModal = (r: PosReturn) => {
    setRejectingReturn(r);
    setRejectReasonInput('No cumple con las políticas de devolución de tienda');
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReturn) return;

    const reasonText = rejectReasonInput.trim() || 'Rechazada por administración';

    try {
      await procesarEstado(rejectingReturn.id, 'rechazada', reasonText);
      logAuditEvent({
        user: reviewerName,
        role: 'Administrador',
        action: 'Devolución',
        module: 'Devoluciones',
        details: `Devolución ${rejectingReturn.code} (Factura: ${rejectingReturn.saleCode}) por RD$ ${rejectingReturn.total.toLocaleString()} RECHAZADA. Motivo: ${reasonText}`,
        before: { id: rejectingReturn.id, status: rejectingReturn.status },
        after: {
          id: rejectingReturn.id,
          status: 'rejected',
          reviewedBy: reviewerName,
          rejectionReason: reasonText,
        },
      });
      toast.error(`Devolución ${rejectingReturn.code} RECHAZADA`);
      await refetch();
      if (selectedReturn?.id === rejectingReturn.id) {
        setSelectedReturn((prev) =>
          prev
            ? { ...prev, status: 'rejected', reviewedBy: reviewerName, rejectionReason: reasonText }
            : null
        );
      }
      setRejectingReturn(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo rechazar la devolución');
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Historial de Devoluciones de Mercancía',
      filename: 'historial-devoluciones',
      headers: [
        'Código',
        'Venta Ref.',
        'Cliente',
        'Fecha',
        'Hora',
        'Usuario',
        'Estado',
        'Total',
        'Motivo',
        'Método',
        'Tipo',
      ],
      rows: filtered.map((r) => [
        r.code,
        r.saleCode,
        r.customer,
        r.date,
        r.time,
        r.user,
        r.status || 'approved',
        formatMoneyPdf(r.total),
        r.reason,
        methodLabel[r.method],
        typeLabel[r.type],
      ]),
      landscape: true,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Historial de Devoluciones de Mercancía',
      filename: 'historial-devoluciones',
      headers: [
        'Código',
        'Factura Original',
        'Cliente',
        'Fecha',
        'Hora',
        'Usuario',
        'Estado',
        'Productos Devueltos',
        'Total Reembolso',
        'Motivo',
        'Método Reembolso',
        'Tipo Devolución',
      ],
      rows: filtered.map((r) => [
        r.code,
        r.saleCode,
        r.customer,
        r.date,
        r.time,
        r.user,
        r.status || 'approved',
        r.products.map((p) => `${p.name} (Cant: ${p.qty})`).join('; '),
        r.total,
        r.reason,
        methodLabel[r.method],
        typeLabel[r.type],
      ]),
    });
  };

  if (newReturnOpen) {
    return (
      <PosReturnModal
        mode="page"
        backLabel="← Regresar a Facturación"
        bottomBackLabel="← Volver a Ventas"
        onClose={() => setNewReturnOpen(false)}
        onSuccess={() => {
          void refetch();
          setNewReturnOpen(false);
        }}
      />
    );
  }

  if (selectedReturn) {
    return (
      <AppLayout>
        <ReturnDetailView
          selectedReturn={selectedReturn}
          onBack={() => setSelectedReturn(null)}
          onApprove={handleApproveReturn}
          onOpenRejectModal={handleOpenRejectModal}
          processing={procesando}
        />
        {rejectingReturn && (
          <ReturnRejectModal
            returnItem={rejectingReturn}
            reasonInput={rejectReasonInput}
            onReasonChange={setRejectReasonInput}
            onClose={() => setRejectingReturn(null)}
            onConfirm={handleConfirmRejection}
          />
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="text-danger" size={24} />
              Gestión y Aprobación de Devoluciones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Revisa, aprueba o rechaza solicitudes de devolución enviadas por cajeros
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewReturnOpen(true)}
              className="btn-danger flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus size={16} /> Nueva Devolución
            </button>
            <button type="button" onClick={handleExportPdf} className="btn-secondary flex items-center gap-1.5">
              <Download size={16} /> PDF
            </button>
            <button type="button" onClick={handleExportExcel} className="btn-secondary flex items-center gap-1.5">
              <FileSpreadsheet size={16} /> Excel
            </button>
          </div>
        </div>

        {/* Pending Banner Alert */}
        {pendingCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="font-extrabold text-foreground text-sm">
                  {pendingCount} Solicitud(es) de Devolución Pendiente(s) de Aprobación
                </p>
                <p className="text-xs text-muted-foreground">
                  Cajeros han solicitado devoluciones que requieren tu revisión como Administrador.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusTab('pending')}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Shield size={14} />
              Ver Pendientes ({pendingCount})
            </button>
          </div>
        )}

        {/* Stats */}
        <ReturnsStatsCards
          filteredCount={filtered.length}
          pendingCount={pendingCount}
          totalAmount={totalAmount}
          totalHistory={returns.length}
        />

        {/* Status Filter Tabs & Filter Inputs */}
        <ReturnsFiltersBar
          statusTab={statusTab}
          onStatusTabChange={setStatusTab}
          counts={{
            all: returns.length,
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
          }}
          date={date}
          onDateChange={setDate}
          user={user}
          onUserChange={setUser}
          customer={customer}
          onCustomerChange={setCustomer}
          cashier={cashier}
          onCashierChange={setCashier}
          product={product}
          onProductChange={setProduct}
        />

        {/* Table */}
        <ReturnsTable
          loading={loading}
          returns={filtered}
          onSelectReturn={setSelectedReturn}
          onApproveReturn={handleApproveReturn}
          onOpenRejectModal={handleOpenRejectModal}
          processing={procesando}
        />

        {/* Modal: Rejection Reason Custom Dialog */}
        {rejectingReturn && (
          <ReturnRejectModal
            returnItem={rejectingReturn}
            reasonInput={rejectReasonInput}
            onReasonChange={setRejectReasonInput}
            onClose={() => setRejectingReturn(null)}
            onConfirm={handleConfirmRejection}
          />
        )}
      </div>
    </AppLayout>
  );
}
