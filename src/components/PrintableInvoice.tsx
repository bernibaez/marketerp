import React, { useEffect, useState } from 'react';
import {
  getInvoiceSettings,
  subscribeInvoiceSettings,
  type InvoiceSettings,
  type PrintFormat,
  type FontFamily,
  type FontSize,
} from '@/lib/invoiceSettingsStore';
import { getCompanyLogo } from '@/lib/companyLogo';

export interface InvoiceItem {
  sku?: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
  itbis?: number;
  taxRate?: string;
}

export interface PrintableInvoiceProps {
  invoiceData: {
    invoiceNumber: string;
    status?: 'draft' | 'sent' | 'paid' | 'fiscal';
    isFiscal: boolean;
    ncf?: string | null;
    ncfType?: string | null;
    ncfTypeName?: string | null;
    expirationDate?: string | null;
    issueDate: string;
    issueTime?: string;
    dueDate?: string;
    dueInDays?: number;
    cashier?: string;
    registerNumber?: string;
    customerName?: string;
    customerSubtitle?: string;
    customerRnc?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCityCountry?: string;
    customerAddress?: string;
    items: InvoiceItem[];
    subtotal: number;
    discount?: number;
    taxRatePercent?: number;
    itbis: number;
    total: number;
    paymentMethod?: string;
    cashReceived?: number;
    change?: number;
    notes?: string;
  };
  settingsOverride?: Partial<InvoiceSettings>;
  formatOverride?: PrintFormat;
  className?: string;
}

function BarcodeMock({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center justify-center my-2 text-center select-none">
      <svg className="w-32 h-6 sm:w-36 sm:h-7" viewBox="0 0 140 30" fill="currentColor">
        <rect x="0" y="0" width="2" height="24" />
        <rect x="4" y="0" width="1" height="24" />
        <rect x="7" y="0" width="3" height="24" />
        <rect x="12" y="0" width="1" height="24" />
        <rect x="15" y="0" width="2" height="24" />
        <rect x="19" y="0" width="4" height="24" />
        <rect x="25" y="0" width="1" height="24" />
        <rect x="28" y="0" width="2" height="24" />
        <rect x="32" y="0" width="3" height="24" />
        <rect x="37" y="0" width="1" height="24" />
        <rect x="40" y="0" width="4" height="24" />
        <rect x="46" y="0" width="2" height="24" />
        <rect x="50" y="0" width="1" height="24" />
        <rect x="53" y="0" width="3" height="24" />
        <rect x="58" y="0" width="2" height="24" />
        <rect x="62" y="0" width="4" height="24" />
        <rect x="68" y="0" width="1" height="24" />
        <rect x="71" y="0" width="3" height="24" />
        <rect x="76" y="0" width="2" height="24" />
        <rect x="80" y="0" width="1" height="24" />
        <rect x="83" y="0" width="3" height="24" />
        <rect x="88" y="0" width="2" height="24" />
        <rect x="92" y="0" width="4" height="24" />
        <rect x="98" y="0" width="1" height="24" />
        <rect x="101" y="0" width="2" height="24" />
        <rect x="105" y="0" width="3" height="24" />
        <rect x="110" y="0" width="2" height="24" />
        <rect x="114" y="0" width="1" height="24" />
        <rect x="117" y="0" width="4" height="24" />
        <rect x="123" y="0" width="2" height="24" />
        <rect x="127" y="0" width="1" height="24" />
        <rect x="130" y="0" width="3" height="24" />
        <rect x="135" y="0" width="2" height="24" />
      </svg>
      <span className="text-[8px] font-mono tracking-wider text-slate-600 mt-0.5">{value}</span>
    </div>
  );
}

export default function PrintableInvoice({
  invoiceData,
  settingsOverride,
  formatOverride,
  className = '',
}: PrintableInvoiceProps) {
  const [storeSettings, setStoreSettings] = useState<InvoiceSettings>(() => getInvoiceSettings());
  const [logoUrl, setLogoUrl] = useState<string | null>(() => getCompanyLogo());

  useEffect(() => {
    return subscribeInvoiceSettings(() => {
      setStoreSettings(getInvoiceSettings());
      setLogoUrl(getCompanyLogo());
    });
  }, []);

  const settings: InvoiceSettings = {
    ...storeSettings,
    ...settingsOverride,
  };

  const activeFormat: PrintFormat = formatOverride ?? settings.printFormat;
  const isFiscal = invoiceData.isFiscal || Boolean(invoiceData.ncf);
  const status = invoiceData.status || (isFiscal ? 'fiscal' : 'draft');

  const fmt = (v: number) =>
    `RD$ ${Number(v || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const companyName = settings.companyName || 'SUPERMERCADO MERCATO S.R.L.';
  const companyRnc = settings.companyRnc || '131-45678-9';
  const companyPhone = settings.companyPhone || '(809) 555-0199';
  const companyEmail = settings.companyEmail || 'contacto@mercato.do';
  const companyAddress = settings.companyAddress || 'Av. 27 de Febrero #450, Santo Domingo, R.D.';

  const getFontFamilyStyle = (font: FontFamily): string => {
    switch (font) {
      case 'courier':
        return "'Courier New', Courier, monospace";
      case 'sans':
        return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      case 'mono':
        return "'Roboto Mono', 'SF Mono', Consolas, monospace";
      case 'condensed':
        return "'Arial Narrow', 'Helvetica Condensed', 'Roboto Condensed', sans-serif";
      case 'consolas':
        return "'Consolas', 'Fira Code', Menlo, monospace";
      case 'serif':
        return "'Georgia', 'Times New Roman', serif";
      default:
        return "'Courier New', Courier, monospace";
    }
  };

  const getFontSizeClass = (format: PrintFormat): string => {
    if (settings.customFontSizePt) {
      // Usar pt exacto si está disponible
      return '';
    }
    if (format === 'ticket_58mm') return 'text-[9.5px] leading-tight';
    if (format === 'ticket_80mm') return 'text-[11px] leading-tight';
    return 'text-xs leading-normal';
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: getFontFamilyStyle(settings.fontFamily || 'courier'),
    fontSize: settings.customFontSizePt ? `${settings.customFontSizePt}pt` : undefined,
    fontWeight: settings.fontWeight === 'bold' ? 700 : settings.fontWeight === 'medium' ? 600 : 400,
    textTransform: settings.uppercaseOnly ? 'uppercase' : 'none',
  };
  const fontStyle = containerStyle;
  const accentBorderColor = settings.accentColor || '#1e40af';
  const fontSizeClass = getFontSizeClass(activeFormat);

  // -------------------------------------------------------------
  // RENDER 1: TICKET 58MM (MINIPRINTER COMPACTA)
  // -------------------------------------------------------------
  if (activeFormat === 'ticket_58mm') {
    return (
      <div
        className={`printable-invoice-container print-format-58mm bg-white text-slate-900 ${fontSizeClass} p-3 max-w-[220px] mx-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full ${className}`}
        style={fontStyle}
      >
        <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
          {settings.showLogo && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-6 mx-auto object-contain mb-1" />
          )}
          <h2 className="font-black text-xs uppercase tracking-tight leading-snug">{companyName}</h2>
          {settings.showCompanyRnc && <p className="text-[8.5px] font-bold">RNC: {companyRnc}</p>}
          {settings.showCompanyAddress && <p className="text-[8px] leading-tight text-slate-600">{companyAddress}</p>}
          {settings.showCompanyPhone && <p className="text-[8px] text-slate-600">Tel: {companyPhone}</p>}
        </div>

        <div className="text-center py-1.5 border-b border-dashed border-slate-400 my-1 bg-slate-50 print:bg-transparent">
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-black text-[9.5px] uppercase">
              {isFiscal ? (invoiceData.ncfTypeName || 'FACTURA FISCAL') : 'INVOICE / COMPROBANTE'}
            </span>
            <span
              className={`px-1 py-0.2 rounded text-[7.5px] font-black uppercase ${
                status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {status === 'sent' ? 'Sent' : 'Draft'}
            </span>
          </div>
          <p className="font-mono text-[9px] font-bold mt-0.5">{invoiceData.invoiceNumber}</p>
          {isFiscal && invoiceData.ncf && (
            <p className="text-[9.5px] font-black text-slate-900 tracking-wide mt-0.5">
              NCF: {invoiceData.ncf}
            </p>
          )}
        </div>

        <div className="py-1 border-b border-dashed border-slate-400 space-y-0.5 text-[8.5px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Issued:</span>
            <span>{invoiceData.issueDate}</span>
          </div>
          {invoiceData.customerName && (
            <div className="pt-0.5 border-t border-slate-100">
              <span className="text-slate-500 block text-[7.5px]">Billed to:</span>
              <p className="font-bold text-slate-900 truncate">{invoiceData.customerName}</p>
              <p className="text-[7.5px] text-slate-500">
                {invoiceData.customerSubtitle || 'Cliente general'}
              </p>
            </div>
          )}
        </div>

        <div className="py-1 border-b border-dashed border-slate-400">
          <div className="flex justify-between font-black pb-0.5 border-b border-slate-300 text-[8px] uppercase">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="divide-y divide-slate-100 py-0.5">
            {invoiceData.items.map((item, idx) => (
              <div key={idx} className="py-0.5">
                <div className="font-semibold text-slate-900 leading-tight">{item.name}</div>
                <div className="text-[7.5px] text-slate-500">Tax 18% (ITBIS)</div>
                <div className="flex justify-between text-[8px] text-slate-600 font-mono">
                  <span>{item.qty} x {fmt(item.price)}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{fmt(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="py-1 border-b border-dashed border-slate-400 space-y-0.5 text-[8.5px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal:</span>
            <span className="tabular-nums">{fmt(invoiceData.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax (18%):</span>
            <span className="tabular-nums">{fmt(invoiceData.itbis)}</span>
          </div>
          <div className="flex justify-between font-black text-[11px] pt-1 border-t border-slate-900 text-slate-900 bg-slate-50 p-1 rounded">
            <span>Total due:</span>
            <span className="tabular-nums">{fmt(invoiceData.total)}</span>
          </div>
        </div>

        <div className="pt-2 text-center space-y-1 text-[8px] text-slate-500">
          {settings.showBarcodeQr && (
            <BarcodeMock value={invoiceData.ncf || invoiceData.invoiceNumber} />
          )}
          {settings.footerMessage && <p className="italic">{settings.footerMessage}</p>}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 2: TICKET 80MM (ESTÁNDAR POS TÉRMICO)
  // -------------------------------------------------------------
  if (activeFormat === 'ticket_80mm') {
    return (
      <div
        className={`printable-invoice-container print-format-80mm bg-white text-slate-900 ${fontSizeClass} p-4 max-w-[320px] mx-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full ${className}`}
        style={fontStyle}
      >
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
          {settings.showLogo && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-9 mx-auto object-contain mb-1" />
          )}
          <h2 className="font-bold text-sm uppercase tracking-wide">{companyName}</h2>
          {settings.showCompanyRnc && <p className="text-[10px] font-bold">RNC: {companyRnc}</p>}
          {settings.showCompanyAddress && <p className="text-[10px] text-slate-600">{companyAddress}</p>}
          <div className="flex justify-center gap-2 text-[10px] text-slate-600">
            {settings.showCompanyPhone && <span>Tel: {companyPhone}</span>}
            {settings.showCompanyEmail && <span>{companyEmail}</span>}
          </div>
        </div>

        <div className="text-center py-2 border-b border-dashed border-slate-400 my-1 bg-slate-50 print:bg-transparent">
          <div className="flex items-center justify-center gap-2">
            <span className="font-extrabold text-xs uppercase">
              {isFiscal ? (invoiceData.ncfTypeName || 'FACTURA FISCAL') : 'INVOICE / COMPROBANTE'}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                status === 'sent'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {status === 'sent' ? 'Sent' : 'Draft'}
            </span>
          </div>
          <p className="font-mono text-[10px] font-bold mt-0.5">{invoiceData.invoiceNumber}</p>
          {isFiscal && invoiceData.ncf && (
            <p className="text-xs font-black text-slate-900 mt-1 tracking-wider">
              NCF: {invoiceData.ncf}
            </p>
          )}
        </div>

        {/* Billed To & Dates */}
        <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Issued:</span>
            <span>{invoiceData.issueDate} {invoiceData.issueTime || ''}</span>
          </div>
          {invoiceData.dueDate && (
            <div className="flex justify-between">
              <span className="text-slate-500">Due:</span>
              <div className="text-right">
                <span>{invoiceData.dueDate}</span>
                {typeof invoiceData.dueInDays === 'number' && (
                  <span className="block text-[9px] font-semibold text-amber-600">
                    in {invoiceData.dueInDays} days
                  </span>
                )}
              </div>
            </div>
          )}
          {invoiceData.customerName && (
            <div className="pt-1.5 border-t border-slate-200">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                Billed to:
              </span>
              <p className="font-bold text-slate-900 text-xs">{invoiceData.customerName}</p>
              <p className="text-[9.5px] text-slate-500">
                {invoiceData.customerSubtitle || 'Cliente general'}
              </p>
              {invoiceData.customerCityCountry && (
                <p className="text-[9px] text-slate-600">{invoiceData.customerCityCountry}</p>
              )}
              {invoiceData.customerEmail && (
                <p className="text-[9px] text-slate-600">{invoiceData.customerEmail}</p>
              )}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-2 border-b border-dashed border-slate-400">
          <div className="flex justify-between font-bold pb-1 border-b border-slate-300 text-[10px] uppercase">
            <span className="w-1/2">Description</span>
            <span className="w-1/6 text-center">Qty</span>
            <span className="w-1/3 text-right">Amount</span>
          </div>
          <div className="divide-y divide-slate-100 py-1">
            {invoiceData.items.map((item, idx) => (
              <div key={idx} className="py-1 space-y-0.5">
                <div className="font-semibold text-slate-900 leading-snug">{item.name}</div>
                <div className="text-[9px] text-slate-400">Tax 18% (ITBIS)</div>
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>{item.qty} x {fmt(item.price)}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{fmt(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Breakdown */}
        <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="tabular-nums font-mono">{fmt(invoiceData.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tax (18% ITBIS):</span>
            <span className="tabular-nums font-mono">{fmt(invoiceData.itbis)}</span>
          </div>
          <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-800 text-slate-900 bg-slate-50 p-2 rounded-xl">
            <span>Total due:</span>
            <span className="tabular-nums font-mono">{fmt(invoiceData.total)}</span>
          </div>
        </div>

        <div className="pt-3 text-center space-y-2 text-[9px] text-slate-600">
          {settings.showBarcodeQr && (
            <BarcodeMock value={invoiceData.ncf || invoiceData.invoiceNumber} />
          )}
          {settings.footerMessage && (
            <p className="font-medium text-slate-700 italic">{settings.footerMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 3: FULL PAGE / MINIMALIST DOCUMENT (CARTA / A4)
  // -------------------------------------------------------------
  return (
    <div
      className={`printable-invoice-container bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-7 sm:p-8 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-xs print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full ${fontSizeClass} ${className}`}
      style={fontStyle}
    >
      {/* 1. CABECERA: Empresa a la izquierda · Título, código y badge a la derecha */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          {settings.showLogo && logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-1.5" />
          )}
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
            {companyName}
          </h1>
          {settings.showCompanyRnc && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tax ID / RNC: <span className="font-mono text-slate-700 dark:text-slate-300">{companyRnc}</span>
            </p>
          )}
          {settings.showCompanyAddress && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{companyAddress}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            {settings.showCompanyPhone && <span>Tel: {companyPhone}</span>}
            {settings.showCompanyEmail && <span>· {companyEmail}</span>}
          </div>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <div className="flex sm:justify-end items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Invoice
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                status === 'sent'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}
            >
              {status === 'sent' ? 'Sent' : 'Draft'}
            </span>
          </div>

          <p className="font-mono text-base font-black text-slate-900 dark:text-white tracking-tight">
            {invoiceData.invoiceNumber}
          </p>

          {isFiscal && invoiceData.ncf && (
            <div className="pt-0.5">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider font-mono">
                NCF: {invoiceData.ncf}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. DATOS DE CLIENTE & FECHAS (Sin vacío excesivo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-slate-100 dark:border-slate-800 text-xs">
        {/* Billed To */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Billed to
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {invoiceData.customerName || 'Juan Pérez'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {invoiceData.customerSubtitle || 'Cliente general'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-0.5">
            {invoiceData.customerCityCountry || 'Santo Domingo, República Dominicana'}
          </p>
          {invoiceData.customerEmail && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{invoiceData.customerEmail}</p>
          )}
          {invoiceData.customerRnc && (
            <p className="text-xs font-mono text-slate-500">RNC/Cédula: {invoiceData.customerRnc}</p>
          )}
        </div>

        {/* Dates & Amount Due */}
        <div className="space-y-1.5 sm:text-right">
          <div className="flex sm:justify-end gap-3 text-xs">
            <span className="text-slate-400 dark:text-slate-500">Issued:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{invoiceData.issueDate}</span>
          </div>

          <div className="flex sm:justify-end gap-3 text-xs items-center">
            <span className="text-slate-400 dark:text-slate-500">Due:</span>
            <div className="sm:text-right">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {invoiceData.dueDate || new Date(Date.now() + 7 * 86400000).toLocaleDateString('es-DO')}
              </span>
              <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400">
                in {invoiceData.dueInDays ?? 7} days
              </span>
            </div>
          </div>

          <div className="flex sm:justify-end gap-3 text-xs pt-1">
            <span className="text-slate-400 dark:text-slate-500">Amount due:</span>
            <span className="font-black text-slate-900 dark:text-white tabular-nums">
              {fmt(invoiceData.total)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TABLA DE ÍTEMS: Description, Qty, Rate, Amount (tabular-nums alineados a la derecha) */}
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <th className="py-2.5 px-2">Description</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Rate</th>
              <th className="py-2.5 px-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {invoiceData.items.map((item, idx) => (
              <tr key={idx} className="group">
                <td className="py-2.5 px-2">
                  <p className="font-bold text-slate-900 dark:text-white leading-snug">{item.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Tax 18% (ITBIS)
                  </p>
                </td>
                <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                  {item.qty}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                  {fmt(item.price)}
                </td>
                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                  {fmt(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. PIE: Nota a la izquierda · Subtotal, Tax y Total Due destacado a la derecha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3 items-end border-t border-slate-200 dark:border-slate-800">
        <div className="space-y-2 text-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Notes & Terms
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
            {invoiceData.notes || settings.footerMessage || 'Payment is due within 7 days. Thank you for your business!'}
          </p>
          {settings.showTerms && settings.termsAndConditions && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
              {settings.termsAndConditions}
            </p>
          )}
          {settings.showBarcodeQr && (
            <div className="pt-2">
              <BarcodeMock value={invoiceData.ncf || invoiceData.invoiceNumber} />
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div className="space-y-2 text-xs sm:text-right">
          <div className="flex justify-between sm:justify-end sm:gap-8 text-slate-500 dark:text-slate-400">
            <span>Subtotal:</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{fmt(invoiceData.subtotal)}</span>
          </div>

          <div className="flex justify-between sm:justify-end sm:gap-8 text-slate-500 dark:text-slate-400">
            <span>Tax (18%):</span>
            <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{fmt(invoiceData.itbis)}</span>
          </div>

          {/* Caja destacada "Total due" con fondo suave y número grande sin cortes */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 mt-3 flex justify-between items-center sm:justify-end sm:gap-6">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Total due:
            </span>
            <span
              className="text-2xl sm:text-3xl font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-white"
              style={{ color: accentBorderColor }}
            >
              {fmt(invoiceData.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
