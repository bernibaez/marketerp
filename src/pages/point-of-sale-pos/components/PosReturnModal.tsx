import { useEffect, useState } from 'react';
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

import { PosReturnHeader } from './return/PosReturnHeader';
import { PosReturnLookupCard } from './return/PosReturnLookupCard';
import { PosReturnItemsTable, type SaleItem } from './return/PosReturnItemsTable';
import { PosReturnSidebar } from './return/PosReturnSidebar';
import { PosReturnConfirmation } from './return/PosReturnConfirmation';

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
      sku: (d as any).sku || (d.producto_id ? d.nombre_item.slice(0, 12) : d.nombre_item),
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
      if (!venta) {
        setLoadedSale(null);
        toast.error(`No se encontró la factura "${codeKey}". Verifica el número (FAC-..., VEN-...) o NCF.`);
        return;
      }
      if (venta.estado === 'anulada') {
        setLoadedSale(null);
        toast.error(`La factura "${venta.numero_factura}" está anulada y no admite devoluciones.`);
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

  const handleToggleAllItems = () => {
    const allSelected = currentItems.every((it, idx) => (qty[`${it.sku}-${idx}`] || 0) === it.maxQty);
    const nextQty: Record<string, number> = {};
    if (!allSelected) {
      currentItems.forEach((it, idx) => {
        nextQty[`${it.sku}-${idx}`] = it.maxQty;
      });
    }
    setQty(nextQty);
  };

  const handleUpdateItemQty = (key: string, newQty: number) => {
    setQty((q) => ({
      ...q,
      [key]: newQty,
    }));
  };

  // 1. SUB-VIEW: CONFIRMATION
  if (registeredReturnCode) {
    const confirmationContent = (
      <PosReturnConfirmation
        returnCode={registeredReturnCode}
        originalInvoiceCode={loadedSale?.code || ''}
        customer={customer}
        reason={reason}
        selectedItems={selectedItems}
        totalReturnAmount={totalReturnAmount}
        cashLabel={cashLabel}
        cashierName={user?.name}
        onClose={onClose}
        backLabel={backLabel}
        bottomBackLabel={bottomBackLabel}
      />
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

  // 2. MAIN VIEW: NUEVA DEVOLUCIÓN
  const mainContent = (
    <div className="space-y-6 font-sans">
      <PosReturnHeader cashLabel={cashLabel} onClose={onClose} backLabel={backLabel} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column (65%) */}
        <div className="lg:col-span-8 space-y-6">
          <PosReturnLookupCard
            searchCode={searchCode}
            setSearchCode={setSearchCode}
            onLookup={handleLookup}
            lookingUp={lookingUp}
            recentSales={recentSales}
            loadingRecent={loadingRecent}
            loadedSaleId={loadedSale?.ventaId}
            onSelectSale={applyVenta}
          />

          <PosReturnItemsTable
            currentItems={currentItems}
            invoiceCode={loadedSale?.code}
            qty={qty}
            onUpdateQty={handleUpdateItemQty}
            onToggleAll={handleToggleAllItems}
            isFullReturn={isFullReturn}
          />
        </div>

        {/* Right column (35%) */}
        <div className="lg:col-span-4 space-y-6">
          <PosReturnSidebar
            customer={customer}
            setCustomer={setCustomer}
            reason={reason}
            setReason={setReason}
            method={method}
            setMethod={setMethod}
            isFullReturn={isFullReturn}
            selectedItemsCount={selectedItems.length}
            totalReturnAmount={totalReturnAmount}
            submitting={submitting}
            canSubmit={Boolean(loadedSale && selectedItems.length > 0)}
            onSubmit={() => void handleProcessReturn()}
            onClose={onClose}
            bottomBackLabel={bottomBackLabel}
          />
        </div>
      </div>

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
