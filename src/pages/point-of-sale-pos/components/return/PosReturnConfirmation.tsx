import React from 'react';
import { Clock, AlertCircle, Printer } from 'lucide-react';
import PrintableReturnReceipt from '@/components/printing/PrintableReturnReceipt';
import { PosReturnHeader } from './PosReturnHeader';
import type { SaleItem } from './PosReturnItemsTable';

interface SelectedReturnItem extends SaleItem {
  key: string;
  qty: number;
}

interface PosReturnConfirmationProps {
  returnCode: string;
  originalInvoiceCode: string;
  customer: string;
  reason: string;
  selectedItems: SelectedReturnItem[];
  totalReturnAmount: number;
  cashLabel: string;
  cashierName?: string;
  onClose: () => void;
  backLabel?: string;
  bottomBackLabel?: string;
}

export const PosReturnConfirmation: React.FC<PosReturnConfirmationProps> = ({
  returnCode,
  originalInvoiceCode,
  customer,
  reason,
  selectedItems,
  totalReturnAmount,
  cashLabel,
  cashierName,
  onClose,
  backLabel,
  bottomBackLabel,
}) => {
  return (
    <div className="space-y-6">
      {/* COMPROBANTE OFICIAL PARA IMPRESIÓN (SOLO PRINT) */}
      <div className="hidden print:block printable-document">
        <PrintableReturnReceipt
          data={{
            code: returnCode,
            originalInvoiceCode,
            date: new Date().toLocaleDateString('es-DO'),
            customerName: customer || 'Consumidor Final',
            cashierName: cashierName || 'Cajero',
            reason,
            items: selectedItems.map((it) => ({
              name: it.name,
              qty: it.qty,
              price: it.price,
              subtotal: it.qty * it.price,
            })),
            totalAmount: totalReturnAmount,
          }}
        />
      </div>

      <PosReturnHeader cashLabel={cashLabel} onClose={onClose} backLabel={backLabel} />

      {/* Confirmation Card */}
      <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 p-8 space-y-5 text-center max-w-xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
          <Clock size={34} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Solicitud de Devolución Enviada</h2>
          <p className="text-base font-mono text-[#007052] font-bold mt-1">{returnCode}</p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
          <Clock size={14} />
          <span>Pendiente de Aprobación por Administrador</span>
        </div>

        <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-2.5 text-left">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            La solicitud fue registrada exitosamente. Se ha enviado al módulo de{' '}
            <strong>Devoluciones</strong> donde un administrador podrá aprobarla o rechazarla.
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2 text-left border border-slate-200/70">
          <div className="flex justify-between">
            <span className="text-slate-500">Factura Original:</span>
            <span className="font-semibold text-slate-800">{originalInvoiceCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Cliente:</span>
            <span className="font-semibold text-slate-800">{customer}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Motivo:</span>
            <span className="font-semibold text-slate-800">{reason}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
            <span className="text-slate-700">Total Solicitado:</span>
            <span className="text-[#e11d48] font-mono">
              RD$ {totalReturnAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Printer size={15} /> Imprimir Comprobante
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[#007052] hover:bg-[#005c43] text-white py-2.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
          >
            {bottomBackLabel || '← Volver a Ventas'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-6 pb-2 print:hidden">
        <p className="text-[11px] text-slate-400 font-medium">
          Sistema POS & Facturación Electrónica · Cumplimiento DGII República Dominicana
        </p>
      </div>
    </div>
  );
};
