import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Search, Download, RotateCcw, FileSpreadsheet, Eye, Printer, X, Check, XCircle, Clock, Shield, CheckCircle, BellRing, Plus } from 'lucide-react';
import type { PosReturn, PosReturnStatus } from '@/lib/posStore';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import { useDevoluciones } from '@/hooks/useDevoluciones';
import type { DevolucionConDetalle } from '@/services/devoluciones.service';
import { useAuth } from '@/context/AuthContext';
import PrintableReturnReceipt from '@/components/printing/PrintableReturnReceipt';
import PosReturnModal from '@/pages/point-of-sale-pos/components/PosReturnModal';

const methodLabel: Record<PosReturn['method'], string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  credit_note: 'Nota de crédito',
  exchange: 'Cambio',
};

const typeLabel: Record<PosReturn['type'], string> = {
  partial: 'Parcial',
  full: 'Total',
};

function mapDevolucionToPosReturn(d: DevolucionConDetalle): PosReturn {
  const creado = new Date(d.creado_en);
  const methodMap: Record<string, PosReturn['method']> = {
    efectivo: 'cash',
    tarjeta: 'card',
    nota_credito: 'credit_note',
    cambio: 'exchange',
  };
  const statusMap: Record<string, PosReturnStatus> = {
    pendiente: 'pending',
    aprobada: 'approved',
    rechazada: 'rejected',
  };
  return {
    id: d.id,
    code: d.codigo,
    saleCode: d.numero_factura ?? '—',
    customer: d.cliente_nombre ?? 'Cliente',
    date: creado.toISOString().slice(0, 10),
    time: creado.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    user: d.cajero_nombre ?? 'Cajero',
    cashier: d.cajero_nombre ?? 'Caja',
    products: (d.items ?? []).map((i) => ({
      sku: i.sku ?? '',
      name: i.nombre_item,
      qty: i.cantidad,
      price: i.precio_unitario,
      subtotal: i.cantidad * i.precio_unitario,
    })),
    items: (d.items ?? []).map((i) => ({
      sku: i.sku ?? '',
      name: i.nombre_item,
      qty: i.cantidad,
      price: i.precio_unitario,
      subtotal: i.cantidad * i.precio_unitario,
    })),
    total: Number(d.monto_total),
    reason: d.motivo,
    method: methodMap[d.metodo_reembolso] ?? 'cash',
    type: d.tipo === 'total' ? 'full' : 'partial',
    status: statusMap[d.estado] ?? 'pending',
    reviewedBy: d.revisado_por_nombre,
    rejectionReason: d.motivo_rechazo ?? undefined,
  };
}

export default function ReturnsHistoryPage() {
  const { user: authUser } = useAuth();
  const { devoluciones, loading, refetch, procesarEstado, procesando } = useDevoluciones({
    limite: 200,
  });
  const returns = useMemo(() => devoluciones.map(mapDevolucionToPosReturn), [devoluciones]);
  const [selectedReturn, setSelectedReturn] = useState<PosReturn | null>(null);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [autoModalDismissed, setAutoModalDismissed] = useState(false);
  const [searchParams] = useSearchParams();
  const [newReturnOpen, setNewReturnOpen] = useState(
    () => searchParams.get('action') === 'new' || searchParams.get('nueva') === '1'
  );

  // Rejection modal state
  const [rejectingReturn, setRejectingReturn] = useState<PosReturn | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('No cumple con las políticas de devolución de tienda');

  // Filters
  const [date, setDate] = useState('');
  const [user, setUser] = useState('');
  const [customer, setCustomer] = useState('');
  const [cashier, setCashier] = useState('');
  const [product, setProduct] = useState('');

  const pendingReturns = useMemo(() => returns.filter((r) => r.status === 'pending'), [returns]);
  const pendingCount = pendingReturns.length;
  const approvedCount = returns.filter((r) => r.status === 'approved').length;
  const rejectedCount = returns.filter((r) => r.status === 'rejected').length;

  // No auto-open modal on mount to avoid hijacking page view

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
        after: { id: rejectingReturn.id, status: 'rejected', reviewedBy: reviewerName, rejectionReason: reasonText },
      });
      toast.error(`Devolución ${rejectingReturn.code} RECHAZADA`);
      await refetch();
      if (selectedReturn?.id === rejectingReturn.id) {
        setSelectedReturn((prev) =>
          prev ? { ...prev, status: 'rejected', reviewedBy: reviewerName, rejectionReason: reasonText } : null
        );
      }
      setRejectingReturn(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo rechazar la devolución');
    }
  };

  const renderStatusBadge = (status?: PosReturnStatus) => {
    const currentStatus = status || 'approved';
    if (currentStatus === 'pending') {
      return (
        <span className="badge-warning inline-flex items-center gap-1 font-bold text-xs">
          <Clock size={12} />
          Pendiente
        </span>
      );
    }
    if (currentStatus === 'approved') {
      return (
        <span className="badge-success inline-flex items-center gap-1 font-bold text-xs">
          <CheckCircle size={12} />
          Aprobada
        </span>
      );
    }
    return (
      <span className="badge-danger inline-flex items-center gap-1 font-bold text-xs">
        <XCircle size={12} />
        Rechazada
      </span>
    );
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Historial de Devoluciones de Mercancía',
      filename: 'historial-devoluciones',
      headers: [
        'Código', 'Venta Ref.', 'Cliente', 'Fecha', 'Hora', 'Usuario', 'Estado', 'Total', 'Motivo', 'Método', 'Tipo',
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
        'Código', 'Factura Original', 'Cliente', 'Fecha', 'Hora', 'Usuario', 'Estado', 'Productos Devueltos', 'Total Reembolso', 'Motivo', 'Método Reembolso', 'Tipo Devolución'
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
        <div className="space-y-6 slide-up">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center font-bold">
                <RotateCcw size={26} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black text-foreground tracking-tight">
                    Devolución {selectedReturn.code}
                  </h1>
                  {renderStatusBadge(selectedReturn.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Factura de referencia: <strong className="font-mono text-primary">{selectedReturn.saleCode}</strong> · Cajero solicitante: <strong>{selectedReturn.user}</strong> ({selectedReturn.cashier})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs font-semibold py-2.5 px-3 flex items-center gap-1.5"
              >
                <Printer size={15} /> Imprimir Comprobante
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedReturn(null);
                  setAutoModalDismissed(true);
                }}
                className="btn-secondary text-xs font-bold py-2.5 px-4 flex items-center gap-2 shadow-xs"
              >
                ← Volver a Devoluciones
              </button>
            </div>
          </div>

          {/* COMPROBANTE OFICIAL PARA IMPRESIÓN (SOLO VISIBLE EN PRINT) */}
          <div className="hidden print:block printable-document">
            <PrintableReturnReceipt
              data={{
                code: selectedReturn.code,
                originalInvoiceCode: selectedReturn.saleCode,
                date: selectedReturn.date,
                customerName: selectedReturn.customer,
                cashierName: selectedReturn.cashier,
                reason: selectedReturn.reason,
                items: (selectedReturn.items ?? selectedReturn.products ?? []).map((p) => ({
                  name: p.name,
                  qty: p.qty,
                  price: p.price,
                  subtotal: p.subtotal ?? p.qty * p.price,
                })),
                totalAmount: selectedReturn.total,
              }}
            />
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
            <div className="lg:col-span-2 space-y-6">
              {/* Status Alert Banner */}
              {selectedReturn.status === 'pending' ? (
                <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm">
                      <Shield size={20} />
                      <span>Solicitud de Devolución por Cajero (Pendiente de tu Aprobación)</span>
                    </div>
                    {renderStatusBadge(selectedReturn.status)}
                  </div>
                  <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                    El cajero <strong>{selectedReturn.user}</strong> (<i>{selectedReturn.cashier}</i>) solicita tu aprobación como Administrador para procesar una devolución por <strong className="text-danger font-mono">RD$ {selectedReturn.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> sobre la factura <strong>{selectedReturn.saleCode}</strong>.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(selectedReturn)}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                    >
                      <XCircle size={16} /> Rechazar Devolución
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApproveReturn(selectedReturn)}
                      disabled={procesando}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    >
                      <CheckCircle size={16} /> Aprobar Devolución
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card p-4 flex justify-between items-center bg-secondary/30">
                  <span className="text-muted-foreground font-semibold text-sm">Estado de la Solicitud:</span>
                  {renderStatusBadge(selectedReturn.status)}
                </div>
              )}

              {/* Items Table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
                  <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <RotateCcw size={16} className="text-danger" />
                    Productos a Devolver ({selectedReturn.products.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/20 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-3 font-semibold">Producto</th>
                        <th className="text-center px-4 py-3 font-semibold">Cantidad</th>
                        <th className="text-right px-4 py-3 font-semibold">Precio</th>
                        <th className="text-right px-4 py-3 font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.products.map((p, idx) => (
                        <tr key={idx} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {p.name}
                            {p.sku && <span className="text-xs text-muted-foreground block font-mono">{p.sku}</span>}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-foreground">{p.qty}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            RD$ {p.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            RD$ {(p.qty * p.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-bold text-foreground text-sm border-b border-border pb-2">
                  Información de la Devolución
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Factura Original:</span>
                    <span className="font-mono font-bold text-primary text-sm">{selectedReturn.saleCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Cliente:</span>
                    <span className="font-semibold text-foreground">{selectedReturn.customer}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Fecha / Hora:</span>
                    <span className="font-medium text-foreground">{selectedReturn.date} {selectedReturn.time}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Cajero:</span>
                    <span className="font-medium text-foreground">{selectedReturn.user} ({selectedReturn.cashier})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Motivo:</span>
                    <span className="font-medium text-foreground">{selectedReturn.reason}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Método de Reembolso:</span>
                    <span className="font-semibold text-foreground">{methodLabel[selectedReturn.method]}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tipo:</span>
                    <span className="font-medium text-foreground">{typeLabel[selectedReturn.type]}</span>
                  </div>
                  {selectedReturn.reviewedBy && (
                    <div className="border-t border-border pt-2">
                      <span className="text-muted-foreground block">Revisado por Admin:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedReturn.reviewedBy}</span>
                    </div>
                  )}
                  {selectedReturn.rejectionReason && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-600 dark:text-rose-400">
                      <strong>Motivo del Rechazo:</strong> {selectedReturn.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-muted-foreground">Total Reembolso:</span>
                    <span className="text-danger font-mono text-xl font-black">
                      RD$ {selectedReturn.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReturn(null);
                      setAutoModalDismissed(true);
                    }}
                    className="btn-secondary w-full text-xs font-bold py-2.5"
                  >
                    ← Volver a Devoluciones
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal de confirmación de rechazo (flotante) */}
          {rejectingReturn && (
            <div className="dialog-inline-host" onClick={() => setRejectingReturn(null)}>
              <form onSubmit={handleConfirmRejection} className="card w-full max-w-md p-6 space-y-4 shadow-2xl border-rose-500/30" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <XCircle size={24} />
                    <h3 className="font-extrabold text-foreground text-lg">Rechazar Solicitud</h3>
                  </div>
                  <button type="button" onClick={() => setRejectingReturn(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Especifica el motivo del rechazo para la devolución <strong className="font-mono text-foreground">{rejectingReturn.code}</strong>.
                </p>

                <textarea
                  rows={3}
                  required
                  autoFocus
                  className="input-field text-xs py-2 w-full focus:ring-rose-500"
                  placeholder="Escribe el motivo del rechazo..."
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                />

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button type="button" className="btn-secondary text-xs py-2" onClick={() => setRejectingReturn(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 font-bold">
                    <XCircle size={15} /> Confirmar Rechazo
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
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

        {/* Pending Banner Alert if there are pending returns */}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-muted-foreground font-semibold">Devoluciones Filtradas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p>
          </div>
          <div className="card p-4 border-amber-500/20 bg-amber-500/5">
            <p className="text-xs text-muted-foreground font-semibold">Pendientes de Admin</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground font-semibold">Monto Filtrado Reembolsado</p>
            <p className="text-2xl font-bold text-danger mt-1">
              RD$ {totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted-foreground font-semibold">Total Histórico</p>
            <p className="text-2xl font-bold text-info mt-1">{returns.length} registros</p>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 border-b border-border pb-3 overflow-x-auto">
          {[
            { id: 'all', label: 'Todas', count: returns.length },
            { id: 'pending', label: 'Pendientes por Aprobar', count: pendingCount, highlight: true },
            { id: 'approved', label: 'Aprobadas', count: approvedCount },
            { id: 'rejected', label: 'Rechazadas', count: rejectedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusTab(tab.id as typeof statusTab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                statusTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                tab.highlight && tab.count > 0 ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha</label>
              <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Usuario</label>
              <input className="input-field" placeholder="Usuario..." value={user} onChange={(e) => setUser(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
              <input className="input-field" placeholder="Cliente..." value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cajero</label>
              <input className="input-field" placeholder="Cajero..." value={cashier} onChange={(e) => setCashier(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
                <input
                  className="input-field !pl-9"
                  placeholder="Buscar producto..."
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Factura Ref.</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Motivo</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones Admin</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Cargando devoluciones…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <RotateCcw size={28} className="mx-auto mb-2 opacity-40" />
                      No hay devoluciones registradas con estos filtros
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReturn(r)}
                      className={`border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-secondary/10'} ${
                        r.status === 'pending' ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-danger font-bold">{r.code}</td>
                      <td className="px-4 py-3 font-mono text-primary font-semibold">{r.saleCode}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{r.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {r.date} {r.time}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{r.user}</td>
                      <td className="px-4 py-3">{renderStatusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        RD$ {r.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{r.reason}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleApproveReturn(r)}
                                disabled={procesando}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-all shadow-xs disabled:opacity-50"
                                title="Aprobar Devolución"
                              >
                                <Check size={14} /> Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenRejectModal(r)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                title="Rechazar Devolución"
                              >
                                <XCircle size={14} /> Rechazar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedReturn(r)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver detalles y comprobante"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Rejection Reason Custom Dialog */}
        {rejectingReturn && (
          <div className="dialog-inline-host" onClick={() => setRejectingReturn(null)}>
            <form onSubmit={handleConfirmRejection} className="card w-full max-w-md p-6 space-y-4 shadow-2xl border-rose-500/30" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <XCircle size={24} />
                  <h3 className="font-extrabold text-foreground text-lg">Rechazar Solicitud de Devolución</h3>
                </div>
                <button type="button" onClick={() => setRejectingReturn(null)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Por favor especifica o selecciona el motivo por el cual estás rechazando la devolución <strong className="font-mono text-foreground">{rejectingReturn.code}</strong> (<strong className="text-danger">RD$ {rejectingReturn.total.toLocaleString()}</strong>).
              </p>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Motivo del Rechazo</label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  className="input-field text-xs py-2 w-full focus:ring-rose-500"
                  placeholder="Escribe el motivo del rechazo..."
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                />
              </div>

              {/* Quick Option Pills */}
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Opciones rápidas de motivo:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'No cumple políticas de tienda',
                    'Producto deteriorado o usado',
                    'Fuera del plazo permitido (30 días)',
                    'Falta comprobante fiscal original',
                    'Error en la solicitud del cajero',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReasonInput(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        rejectReasonInput === preset
                          ? 'bg-rose-600 text-white border-rose-700 font-bold shadow-xs'
                          : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button type="button" className="btn-secondary text-xs py-2" onClick={() => setRejectingReturn(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-xs py-2 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 font-bold">
                  <XCircle size={15} /> Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
