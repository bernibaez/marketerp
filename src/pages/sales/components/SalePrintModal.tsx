import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Receipt, FileText, X, Download } from 'lucide-react';
import type { Cliente } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';
import PrintableInvoice from '@/components/PrintableInvoice';
import { getInvoiceSettings, syncInvoiceSettingsFromSupabase, type PrintFormat } from '@/lib/invoiceSettingsStore';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';

interface SalePrintModalProps {
  sale: VentaConDetalle;
  clients: Cliente[];
  loadingPrintDetail: boolean;
  onClose: () => void;
}

export const SalePrintModal: React.FC<SalePrintModalProps> = ({
  sale,
  clients,
  loadingPrintDetail,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<PrintFormat>(() => {
    return getInvoiceSettings().printFormat;
  });

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase().then((s) => {
      setPrintFormat(s.printFormat);
    });
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden print:p-0 print:bg-white print:static"
      onClick={onClose}
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
                Imprimir Factura {sale.numero_factura}
              </h3>
              {sale.ncf && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">NCF: {sale.ncf}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex p-0.5 bg-secondary rounded-lg text-xs font-semibold border border-border">
              <button
                type="button"
                onClick={() => setPrintFormat('ticket_58mm')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  printFormat === 'ticket_58mm'
                    ? 'bg-card text-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Receipt size={12} /> 58mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('ticket_80mm')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  printFormat === 'ticket_80mm'
                    ? 'bg-card text-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Receipt size={12} /> 80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('full_page')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  printFormat === 'full_page'
                    ? 'bg-card text-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText size={12} /> Carta/A4
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
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
                invoiceNumber: sale.numero_factura,
                isFiscal: Boolean(sale.ncf),
                ncf: sale.ncf || undefined,
                ncfType: sale.ncf ? sale.ncf.slice(0, 3) : undefined,
                issueDate: new Date(sale.creado_en).toLocaleDateString('es-DO'),
                issueTime: new Date(sale.creado_en).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
                cashier: sale.cajero_nombre || 'Cajero',
                customerName: sale.cliente_nombre || clients.find((c) => c.id === sale.cliente_id)?.nombre || 'Consumidor Final',
                customerRnc: clients.find((c) => c.id === sale.cliente_id)?.rnc_cedula || undefined,
                customerPhone: clients.find((c) => c.id === sale.cliente_id)?.telefono || undefined,
                customerAddress: clients.find((c) => c.id === sale.cliente_id)?.direccion || undefined,
                items: (sale.detalle_ventas || []).map((it) => ({
                  sku: it.producto_id || undefined,
                  name: it.nombre_item,
                  qty: it.cantidad,
                  price: it.precio_unitario,
                  subtotal: it.subtotal,
                  itbis: (it.precio_unitario - it.precio_unitario / 1.18) * it.cantidad,
                })),
                subtotal: sale.subtotal,
                discount: sale.monto_descuento || undefined,
                itbis: sale.monto_impuesto,
                total: sale.monto_total,
                paymentMethod: sale.metodo_pago,
                cashReceived: sale.monto_pagado || sale.monto_total,
                change: sale.devuelta_entregada || 0,
                registerNumber: sale.caja_id ? `Caja #${sale.caja_id}` : 'POS-01',
              }}
              formatOverride={printFormat}
            />
          )}
        </div>

        {/* Footer Buttons (Fixed at bottom) */}
        <div className="flex justify-end gap-2.5 p-4 border-t border-border flex-shrink-0 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-2xl print:hidden">
          <button
            type="button"
            onClick={() => {
              exportTableToPdf({
                title: `FACTURA FISCAL - ${sale.numero_factura}`,
                subtitle: `Cliente: ${sale.cliente_nombre || 'Consumidor Final'} | NCF: ${sale.ncf || 'N/A'}`,
                filename: `factura-${sale.numero_factura}`,
                headers: ['Producto', 'Cant.', 'Precio Unit.', 'Subtotal'],
                rows: (sale.detalle_ventas || []).map((it) => [
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
  );
};
