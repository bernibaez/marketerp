import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import { useCxp } from '@/hooks/useCxp';
import type { CuentaPagarUi, CxStatusUi } from '@/services/cxp.service';
import { PageContentSkeleton } from '@/components/ui/LoadingSkeleton';
import { CxpCreateView } from './cxp/components/CxpCreateView';
import { CxpDetailView } from './cxp/components/CxpDetailView';
import { CxpListView } from './cxp/components/CxpListView';

const statusMap: Record<CxStatusUi, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  overdue: { label: 'Vencida', cls: 'badge-danger' },
  paid: { label: 'Pagada', cls: 'badge-success' },
};

export default function AccountsPayablePage() {
  const { cuentas, proveedores, loading, error, crear, registrarPago } = useCxp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CxStatusUi>('all');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<CuentaPagarUi | null>(null);

  useEffect(() => {
    if (!selected) return;
    const fresh = cuentas.find((c) => c.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [cuentas, selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cuentas.filter((p) => {
      const matchSearch =
        p.code.toLowerCase().includes(q) ||
        p.purchase.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cuentas, search, statusFilter]);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Reporte de Cuentas por Pagar (Proveedores)',
      filename: 'cuentas-por-pagar',
      headers: ['Código', 'Compra', 'Proveedor', 'Emisión', 'Vence', 'Total', 'Pagado', 'Saldo Pendiente', 'Estado'],
      rows: filtered.map((p) => [
        p.code, p.purchase, p.supplier, p.issueDate, p.dueDate,
        formatMoneyPdf(p.total), formatMoneyPdf(p.paid), formatMoneyPdf(p.balance), statusMap[p.status].label,
      ]),
      landscape: true,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Reporte de Cuentas por Pagar (Proveedores)',
      filename: 'cuentas-por-pagar',
      headers: ['Código', 'Compra Ref', 'Proveedor', 'Emisión', 'Vencimiento', 'Monto Total', 'Monto Pagado', 'Saldo Pendiente', 'Estado', 'Días Mora'],
      rows: filtered.map((p) => [
        p.code, p.purchase, p.supplier, p.issueDate, p.dueDate,
        p.total, p.paid, p.balance, statusMap[p.status].label, p.daysOverdue,
      ]),
    });
  };

  const handleProcessPayment = async (amount: number, method: string, note: string) => {
    if (!selected) return;
    try {
      await registrarPago({
        cuenta_id: selected.id,
        monto: amount,
        metodo_pago: method,
        nota: note || 'Pago a proveedor registrado',
      });
      logAuditEvent({
        user: 'Usuario',
        role: 'Sistema',
        action: 'Pago',
        module: 'Cuentas por Pagar',
        details: `Pago de RD$ ${amount.toLocaleString()} a ${selected.supplier} (${selected.code})`,
        before: { balance: selected.balance },
        after: { paid: selected.paid + amount },
      });
      toast.success(`Pago de RD$ ${amount.toLocaleString()} registrado`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el pago');
      throw e;
    }
  };

  const handleCreate = async (payload: {
    proveedor_id: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
  }) => {
    try {
      await crear({
        proveedor_id: payload.proveedor_id,
        monto_total: payload.monto_total,
        fecha_emision: payload.fecha_emision,
        fecha_vencimiento: payload.fecha_vencimiento,
      });
      toast.success('Cuenta por pagar registrada');
      setShowModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
      throw e;
    }
  };

  if (loading && cuentas.length === 0) {
    return (
      <AppLayout>
        <PageContentSkeleton kpiCount={4} tableCols={10} tableRows={6} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showModal ? (
        <CxpCreateView
          proveedores={proveedores}
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
        />
      ) : selected ? (
        <CxpDetailView
          selected={selected}
          onClose={() => setSelected(null)}
          onProcessPayment={handleProcessPayment}
        />
      ) : (
        <CxpListView
          cuentas={cuentas}
          filtered={filtered}
          loading={loading}
          error={error}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onOpenCreate={() => setShowModal(true)}
          onSelectCuenta={setSelected}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
        />
      )}
    </AppLayout>
  );
}
