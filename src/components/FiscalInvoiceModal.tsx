import React, { useRef, useState } from 'react';
import {
  X, Printer, Download, FileText, CheckCircle2, Building2, Copy, Check,
  Receipt, ShieldCheck, Calendar, User, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import type { FiscalInvoiceRecord } from '@/lib/ncfStore';
import { NCF_TYPES } from '@/lib/ncfStore';
import PrintableInvoice from './PrintableInvoice';

interface FiscalInvoiceModalProps {
  invoice: FiscalInvoiceRecord;
  onClose: () => void;
}

export default function FiscalInvoiceModal({ invoice, onClose }: FiscalInvoiceModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copiedNcf, setCopiedNcf] = useState(false);
  const [viewFormat, setViewFormat] = useState<'ticket' | 'a4'>('a4');

  const ncfInfo = NCF_TYPES[invoice.ncfType];

  const handleCopyNcf = () => {
    navigator.clipboard.writeText(invoice.ncf);
    setCopiedNcf(true);
    toast.success(`NCF ${invoice.ncf} copiado al portapapeles`);
    setTimeout(() => setCopiedNcf(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    exportTableToPdf({
      title: `FACTURA FISCAL DGII - NCF ${invoice.ncf}`,
      subtitle: `Emisor: SUPERMERCADO REMANENTE S.R.L. (RNC: 131-45678-9) | Cliente: ${invoice.companyName || 'Consumidor Final'} (${invoice.rncClient || 'N/A'})`,
      filename: `factura-fiscal-${invoice.ncf}`,
      headers: ['#', 'SKU', 'Descripción', 'Cant.', 'Precio Unit.', 'ITBIS (18%)', 'Subtotal'],
      rows: invoice.items.map((item, idx) => [
        idx + 1,
        item.sku,
        item.name,
        item.qty,
        formatMoneyPdf(item.price),
        formatMoneyPdf(item.itbis),
        formatMoneyPdf(item.subtotal),
      ]),
    });
  };

  return (
    <div className="dialog-inline-host print:p-0 print:bg-white print:static">
      <div
        ref={modalRef}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full text-slate-800 dark:text-slate-200"
      >
        {/* Top Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <FileText size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Factura Fiscal Emitida
                </h2>
                <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  NCF: {invoice.ncf}
                </span>
                <button
                  type="button"
                  onClick={handleCopyNcf}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Copiar NCF"
                >
                  {copiedNcf ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Comprobante de autorización tributaria emitido según normas DGII
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* View Format Switcher */}
            <div className="flex p-1 bg-slate-200/60 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewFormat('a4')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewFormat === 'a4'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText size={14} />
                <span>Hoja A4</span>
              </button>
              <button
                type="button"
                onClick={() => setViewFormat('ticket')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewFormat === 'ticket'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Receipt size={14} />
                <span>Ticket 80mm</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Invoice Display */}
        <div className="p-6 sm:p-8 overflow-y-auto print:p-0 print:text-black">
          <PrintableInvoice
            invoiceData={{
              invoiceNumber: invoice.numero_factura || invoice.ncf || invoice.id,
              isFiscal: true,
              ncf: invoice.ncf,
              ncfType: invoice.ncfType,
              ncfTypeName: ncfInfo.name,
              expirationDate: invoice.expirationDate,
              issueDate: invoice.issueDate,
              issueTime: invoice.issueTime,
              cashier: invoice.cashier,
              customerName: invoice.companyName || 'Consumidor Final',
              customerRnc: invoice.rncClient,
              items: invoice.items,
              subtotal: invoice.subtotal,
              itbis: invoice.itbis,
              total: invoice.total,
              paymentMethod: invoice.paymentMethod,
            }}
            formatOverride={viewFormat === 'ticket' ? 'ticket_80mm' : 'full_page'}
          />
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 border border-slate-900 dark:border-white"
            >
              <Printer size={16} />
              <span>Imprimir Recibo</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Download size={16} />
              <span>Exportar PDF</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-2xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
