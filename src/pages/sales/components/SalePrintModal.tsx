import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Receipt, FileText, X, Download, Minus, Plus } from 'lucide-react';
import type { Cliente } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';
import type { FontSizeOption } from '@/types/invoice';
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
  const [fontSizeOption, setFontSizeOption] = useState<FontSizeOption>(() => {
    return getInvoiceSettings().fontSizeOption || 'normal';
  });
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase().then((s) => {
      setPrintFormat(s.printFormat);
    });
  }, []);

  const handlePrint = () => {
    document.body.setAttribute('data-printing', 'true');
    const cleanup = () => {
      document.body.removeAttribute('data-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  };

  return createPortal(
    <div
      data-printable-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden print:p-0 print:bg-white print:static print:overflow-visible print:h-auto print:max-h-none print:inset-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:p-0 print:overflow-visible print:h-auto print:my-0 print:static"
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
                onClick={() => setPrintFormat('ticket_50mm')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  printFormat === 'ticket_50mm'
                    ? 'bg-card text-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Receipt size={12} /> 50mm
              </button>
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

            {/* Ajuste de Tamaño / Letra / Zoom térmico manual */}
            <div className="flex items-center gap-1.5 p-1 bg-secondary rounded-lg text-xs font-semibold border border-border">
              <span className="text-[10px] text-muted-foreground px-1 font-bold uppercase tracking-wider hidden sm:inline">
                Letra:
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setFontSizeOption('compact');
                    setZoomScale(0.88);
                  }}
                  className={`px-1.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                    fontSizeOption === 'compact'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Compacto (88%)"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFontSizeOption('normal');
                    setZoomScale(1.0);
                  }}
                  className={`px-1.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                    fontSizeOption === 'normal' && zoomScale === 1.0
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Normal (100%)"
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFontSizeOption('large');
                    setZoomScale(1.15);
                  }}
                  className={`px-1.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                    fontSizeOption === 'large'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Grande (115%)"
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFontSizeOption('xlarge');
                    setZoomScale(1.30);
                  }}
                  className={`px-1.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                    fontSizeOption === 'xlarge'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Extra Grande (130%)"
                >
                  A++
                </button>
              </div>

              <div className="h-3.5 w-px bg-border my-auto mx-0.5" />

              {/* Controles manuales de Zoom (Slider + Input numérico directo + +/-) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.5, Number((z - 0.05).toFixed(2))))}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card transition cursor-pointer"
                  title="Reducir zoom (-5%)"
                  aria-label="Reducir zoom"
                >
                  <Minus size={11} />
                </button>

                <input
                  type="range"
                  min={50}
                  max={160}
                  step={1}
                  value={Math.round(zoomScale * 100)}
                  onChange={(e) => setZoomScale(Number((Number(e.target.value) / 100).toFixed(2)))}
                  className="w-12 sm:w-16 accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
                  title="Deslizador continuo de zoom manual"
                  aria-label="Deslizador continuo de zoom manual"
                />

                <div className="flex items-center bg-card border border-border rounded px-1 py-0.5">
                  <input
                    type="number"
                    min={40}
                    max={200}
                    step={1}
                    value={Math.round(zoomScale * 100)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!isNaN(v) && v >= 40 && v <= 200) {
                        setZoomScale(Number((v / 100).toFixed(2)));
                      }
                    }}
                    className="w-9 text-center font-mono font-bold text-xs bg-transparent tabular-nums focus:outline-none"
                    title="Escribir porcentaje de zoom manual"
                    aria-label="Escribir porcentaje de zoom manual"
                  />
                  <span className="text-[10px] text-muted-foreground font-mono">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(1.6, Number((z + 0.05).toFixed(2))))}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card transition cursor-pointer"
                  title="Aumentar zoom (+5%)"
                  aria-label="Aumentar zoom"
                >
                  <Plus size={11} />
                </button>

                {zoomScale !== 1.0 && (
                  <button
                    type="button"
                    onClick={() => setZoomScale(1.0)}
                    className="text-[10px] font-bold text-primary hover:underline px-1 transition cursor-pointer"
                    title="Restablecer a 100%"
                  >
                    100%
                  </button>
                )}
              </div>
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
        <div className="flex-1 overflow-y-auto p-5 min-h-0 printable-document scrollbar-thin print:overflow-visible print:h-auto print:max-h-none print:p-0 print:m-0 print:min-h-0">
          {loadingPrintDetail ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Cargando información de impresión...
            </div>
          ) : (
            <PrintableInvoice
              fontSizeOverride={fontSizeOption}
              zoomScale={zoomScale}
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
                  sku: (it as any).sku || (it.producto_id ? String(it.producto_id).slice(0, 8) : undefined),
                  name: it.nombre_item,
                  qty: it.cantidad,
                  price: it.precio_unitario,
                  subtotal: it.subtotal,
                  itbis:
                    Number(it.porcentaje_impuesto || 0) > 0
                      ? Math.round(((it.subtotal * Number(it.porcentaje_impuesto)) / 100) * 100) / 100
                      : 0,
                })),
                subtotal: sale.subtotal,
                discount: sale.monto_descuento || undefined,
                itbis: sale.monto_impuesto,
                total: sale.monto_total,
                paymentMethod: sale.metodo_pago,
                montoEfectivo: sale.monto_efectivo,
                montoTarjeta: sale.monto_tarjeta,
                montoTransferencia: sale.monto_transferencia,
                montoCredito: sale.monto_credito,
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
            onClick={handlePrint}
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
