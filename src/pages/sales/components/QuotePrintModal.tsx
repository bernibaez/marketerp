import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Receipt, FileText, X, Download, Minus, Plus } from 'lucide-react';
import type { Cliente } from '@/types/database';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';
import type { FontSizeOption } from '@/types/invoice';
import PrintableInvoice from '@/components/PrintableInvoice';
import { getInvoiceSettings, syncInvoiceSettingsFromSupabase, type PrintFormat } from '@/lib/invoiceSettingsStore';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';

interface QuotePrintModalProps {
  quote: CotizacionConDetalle;
  clients: Cliente[];
  loadingPrintDetail: boolean;
  onClose: () => void;
}

export const QuotePrintModal: React.FC<QuotePrintModalProps> = ({
  quote,
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

  const matchedClient = clients.find((c) => c.id === quote.cliente_id);

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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base leading-tight">
                Imprimir Cotización {quote.codigo}
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Cliente: <span className="font-bold text-foreground">{quote.cliente_nombre || matchedClient?.nombre || 'Cliente general'}</span> · Válida hasta:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {quote.valida_hasta || '—'}
                </span>
              </p>
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
                >
                  A+
                </button>
              </div>

              <div className="h-3.5 w-px bg-border my-auto mx-0.5" />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.5, Number((z - 0.05).toFixed(2))))}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card transition cursor-pointer"
                  aria-label="Reducir zoom"
                >
                  <Minus size={11} />
                </button>
                <span className="text-[10px] font-mono font-bold px-1">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(1.6, Number((z + 0.05).toFixed(2))))}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card transition cursor-pointer"
                  aria-label="Aumentar zoom"
                >
                  <Plus size={11} />
                </button>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0 printable-document scrollbar-thin print:overflow-visible print:h-auto print:max-h-none print:p-0 print:m-0 print:min-h-0">
          {loadingPrintDetail ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Cargando detalles de la cotización...
            </div>
          ) : (
            <PrintableInvoice
              fontSizeOverride={fontSizeOption}
              zoomScale={zoomScale}
              settingsOverride={{
                showNcf: false,
                footerMessage: quote.valida_hasta
                  ? `COTIZACIÓN COMERCIAL — Válida hasta: ${quote.valida_hasta}. Documento informativo, no válido como comprobante fiscal.`
                  : 'COTIZACIÓN COMERCIAL — Documento informativo, no válido como comprobante fiscal.',
              }}
              invoiceData={{
                invoiceNumber: quote.codigo,
                isFiscal: false,
                ncfTypeName: 'COTIZACIÓN COMERCIAL',
                issueDate: quote.creado_en
                  ? new Date(quote.creado_en).toLocaleDateString('es-DO', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : new Date().toLocaleDateString('es-DO', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }),
                issueTime: quote.creado_en
                  ? new Date(quote.creado_en).toLocaleTimeString('es-DO', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : new Date().toLocaleTimeString('es-DO', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    }),
                cashier: quote.vendedor_nombre || 'Cajera',
                customerName: quote.cliente_nombre || matchedClient?.nombre || 'Cliente General',
                customerRnc: matchedClient?.rnc_cedula || undefined,
                customerPhone: matchedClient?.telefono || undefined,
                customerAddress: matchedClient?.direccion || undefined,
                items: (quote.items || []).map((it) => ({
                  sku: it.producto_id ? String(it.producto_id).slice(0, 8) : undefined,
                  name: it.nombre_item,
                  qty: it.cantidad,
                  price: it.precio_unitario,
                  subtotal: it.subtotal,
                  itbis: 0,
                })),
                subtotal: quote.subtotal,
                itbis: quote.monto_impuesto,
                total: quote.monto_total,
                paymentMethod: 'COTIZACIÓN',
                cashReceived: 0,
                change: 0,
                registerNumber: 'COT',
              }}
              formatOverride={printFormat}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 p-4 border-t border-border flex-shrink-0 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-2xl print:hidden">
          <button
            type="button"
            onClick={() => {
              const fechaStr = quote.creado_en
                ? new Date(quote.creado_en).toLocaleDateString('es-DO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : new Date().toLocaleDateString('es-DO');
              exportTableToPdf({
                title: `COTIZACIÓN COMERCIAL — ${quote.codigo}`,
                subtitle: `Fecha: ${fechaStr} | Válida hasta: ${quote.valida_hasta || '—'} | Cliente: ${quote.cliente_nombre || matchedClient?.nombre || 'Cliente General'} | Vendedor: ${quote.vendedor_nombre || 'Cajero'}`,
                filename: `cotizacion-${quote.codigo}`,
                headers: ['Producto', 'Cant.', 'Precio Unit.', 'Subtotal'],
                rows: [
                  ...(quote.items || []).map((it) => [
                    it.nombre_item,
                    it.cantidad,
                    formatMoneyPdf(it.precio_unitario),
                    formatMoneyPdf(it.subtotal),
                  ]),
                  ['', '', 'Subtotal:', formatMoneyPdf(quote.subtotal)],
                  ['', '', 'ITBIS:', formatMoneyPdf(quote.monto_impuesto)],
                  ['', '', 'TOTAL COTIZADO:', formatMoneyPdf(quote.monto_total)],
                ],
              });
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Download size={14} /> Descargar PDF
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

