import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import { useCxc } from '@/hooks/useCxc';
import { obtenerClientes } from '@/services/clientes.service';
import type { CuentaCobrarUi, CxStatusUi } from '@/services/cxc.service';
import type { Cliente } from '@/types/database';
import { PageContentSkeleton } from '@/components/ui/LoadingSkeleton';
import { CxcCreateView } from './cxc/components/CxcCreateView';
import { CxcDetailView } from './cxc/components/CxcDetailView';
import { CxcListView } from './cxc/components/CxcListView';

const statusMap: Record<CxStatusUi, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  overdue: { label: 'Vencida', cls: 'badge-danger' },
  paid: { label: 'Cobrada', cls: 'badge-success' },
};

export default function AccountsReceivablePage() {
  const { cuentas, loading, error, crear, registrarPago } = useCxc();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CxStatusUi>('all');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<CuentaCobrarUi | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    obtenerClientes({ limite: 200 })
      .then((r) => setClientes(r.datos))
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fresh = cuentas.find((c) => c.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [cuentas, selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cuentas.filter((r) => {
      const matchSearch =
        r.code.toLowerCase().includes(q) ||
        r.invoice.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cuentas, search, statusFilter]);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Reporte de Cuentas por Cobrar (Clientes)',
      filename: 'cuentas-por-cobrar',
      headers: ['Código', 'Factura', 'Cliente', 'Límite Crédito', 'Emisión', 'Vence', 'Total', 'Pagado', 'Saldo Pendiente', 'Estado'],
      rows: filtered.map((r) => [
        r.code, r.invoice, r.customer, formatMoneyPdf(r.creditLimit), r.issueDate, r.dueDate,
        formatMoneyPdf(r.total), formatMoneyPdf(r.paid), formatMoneyPdf(r.balance), statusMap[r.status].label,
      ]),
      landscape: true,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Reporte de Cuentas por Cobrar (Clientes)',
      filename: 'cuentas-por-cobrar',
      headers: ['Código', 'Factura', 'Cliente', 'Límite Crédito', 'Emisión', 'Vencimiento', 'Monto Total', 'Monto Pagado', 'Saldo Pendiente', 'Estado', 'Días Mora'],
      rows: filtered.map((r) => [
        r.code, r.invoice, r.customer, r.creditLimit, r.issueDate, r.dueDate,
        r.total, r.paid, r.balance, statusMap[r.status].label, r.daysOverdue,
      ]),
    });
  };

  const handleProcessPayment = async (amount: number, paymentMethod: string, paymentNote: string) => {
    if (!selected) return;
    try {
      await registrarPago({
        cuenta_id: selected.id,
        monto: amount,
        metodo_pago: paymentMethod,
        nota: paymentNote || 'Abono/Cobro registrado',
      });
      logAuditEvent({
        user: 'Usuario',
        role: 'Sistema',
        action: 'Pago',
        module: 'Cuentas por Cobrar',
        details: `Cobro/Abono de RD$ ${amount.toLocaleString()} para ${selected.customer} (${selected.code})`,
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
    cliente_id: string;
    factura_id?: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
  }) => {
    try {
      await crear({
        cliente_id: payload.cliente_id,
        numero_factura: payload.factura_id || null,
        monto_total: payload.monto_total,
        fecha_emision: payload.fecha_emision,
        fecha_vencimiento: payload.fecha_vencimiento,
      });
      toast.success('Cuenta por cobrar registrada');
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
        <CxcCreateView
          clientes={clientes}
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
        />
      ) : selected ? (
        <CxcDetailView
          selected={selected}
          clientes={clientes}
          onClose={() => setSelected(null)}
          onProcessPayment={handleProcessPayment}
        />
      ) : (
        <CxcListView
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
