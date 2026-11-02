import React, { useEffect, useState, useMemo } from 'react';
import {
  getInvoiceSettings,
  subscribeInvoiceSettings,
  syncInvoiceSettingsFromSupabase,
  type InvoiceSettings,
  type PrintFormat,
  type FontFamily,
  type SeparatorStyle,
  type PrintDensity,
  type LogoSize,
} from '@/lib/invoiceSettingsStore';
import { getCompanyLogo } from '@/lib/companyLogo';

export interface InvoiceItem {
  sku?: string;
  name: string;
  qty: number;
  unit?: string;
  price: number;
  subtotal: number;
  itbis?: number;
  taxRate?: string;
}

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  amount: number;
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
    paymentBreakdown?: PaymentMethodBreakdown[];
    montoEfectivo?: number;
    montoTarjeta?: number;
    montoTransferencia?: number;
    montoCredito?: number;
    cashReceived?: number;
    change?: number;
    notes?: string;
  };
  settingsOverride?: Partial<InvoiceSettings>;
  formatOverride?: PrintFormat;
  className?: string;
}

function QrCodeMock({ label }: { label: string }) {
  return (
    <div className="py-2.5 flex flex-col items-center justify-center space-y-1 select-none">
      <div className="p-1 bg-white border border-slate-300 rounded">
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="currentColor">
          <rect x="0" y="0" width="30" height="30" fill="black" />
          <rect x="5" y="5" width="20" height="20" fill="white" />
          <rect x="9" y="9" width="12" height="12" fill="black" />
          <rect x="70" y="0" width="30" height="30" fill="black" />
          <rect x="75" y="5" width="20" height="20" fill="white" />
          <rect x="79" y="9" width="12" height="12" fill="black" />
          <rect x="0" y="70" width="30" height="30" fill="black" />
          <rect x="5" y="75" width="20" height="20" fill="white" />
          <rect x="9" y="79" width="12" height="12" fill="black" />
          <rect x="36" y="10" width="6" height="6" fill="black" />
          <rect x="48" y="10" width="12" height="6" fill="black" />
          <rect x="36" y="24" width="16" height="6" fill="black" />
          <rect x="58" y="24" width="6" height="6" fill="black" />
          <rect x="36" y="38" width="8" height="8" fill="black" />
          <rect x="50" y="38" width="14" height="6" fill="black" />
          <rect x="70" y="38" width="6" height="18" fill="black" />
          <rect x="82" y="38" width="12" height="8" fill="black" />
          <rect x="10" y="48" width="18" height="6" fill="black" />
          <rect x="36" y="52" width="6" height="16" fill="black" />
          <rect x="48" y="50" width="16" height="6" fill="black" />
          <rect x="70" y="62" width="24" height="6" fill="black" />
          <rect x="48" y="62" width="10" height="18" fill="black" />
          <rect x="36" y="74" width="6" height="20" fill="black" />
          <rect x="64" y="74" width="8" height="20" fill="black" />
          <rect x="78" y="74" width="16" height="8" fill="black" />
          <rect x="78" y="88" width="16" height="6" fill="black" />
        </svg>
      </div>
      <span className="text-[7.5px] font-mono tracking-wider text-slate-500">{label}</span>
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
    void syncInvoiceSettingsFromSupabase().then((synced) => {
      setStoreSettings(synced);
      setLogoUrl(getCompanyLogo());
    });
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
  const isTicket = activeFormat === 'ticket_80mm' || activeFormat === 'ticket_58mm';
  const isFiscal = invoiceData.isFiscal || Boolean(invoiceData.ncf);
  const accent = settings.accentColor || '#0f766e';

  // Si formatOverride fuerza 58mm u 80mm distinto al guardado, adaptamos el ancho salvo que sea el mismo formato configurado
  const widthMm =
    formatOverride && formatOverride !== settings.printFormat
      ? formatOverride === 'ticket_58mm'
        ? 58
        : 80
      : settings.customWidthMm || (activeFormat === 'ticket_58mm' ? 58 : 80);

  const previewWidthPx = isTicket
    ? Math.min(460, Math.max(190, Math.round(widthMm * 3.78)))
    : 440;

  const baseFontPt = settings.customFontSizePt || 11;

  const fmt = (v: number) =>
    `RD$ ${Number(v || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getFontFamily = (f: FontFamily): string => {
    switch (f) {
      case 'courier':
        return "'Courier New', Courier, monospace";
      case 'mono':
        return "'Roboto Mono', 'SF Mono', Consolas, monospace";
      case 'sans':
        return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
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

  const getSeparatorBorder = (s: SeparatorStyle): string => {
    switch (s) {
      case 'solid':
        return 'border-t border-slate-300';
      case 'dotted':
        return 'border-t border-dotted border-slate-400';
      case 'double':
        return 'border-t-2 border-double border-slate-400';
      case 'dashed':
      default:
        return 'border-t border-dashed border-slate-300';
    }
  };

  const getLineSpacingClass = (d: PrintDensity): string => {
    switch (d) {
      case 'compact':
        return 'space-y-0.5 leading-tight';
      case 'spacious':
        return 'space-y-1.5 leading-relaxed';
      case 'normal':
      default:
        return 'space-y-1 leading-snug';
    }
  };

  const getLogoHeightPx = (s: LogoSize): number => {
    switch (s) {
      case 'small':
        return 28;
      case 'large':
        return 56;
      case 'medium':
      default:
        return 40;
    }
  };

  const getReceiptTitle = (): string => {
    if (invoiceData.ncfTypeName) {
      return invoiceData.ncfTypeName.toUpperCase();
    }
    if (invoiceData.ncfType === 'B01' || (invoiceData.ncf && invoiceData.ncf.startsWith('B01'))) {
      return 'FACTURA DE CRÉDITO FISCAL';
    }
    if (invoiceData.ncfType === 'B02' || (invoiceData.ncf && invoiceData.ncf.startsWith('B02'))) {
      return 'FACTURA PARA CONSUMIDOR FINAL';
    }
    if (isFiscal) {
      return 'FACTURA FISCAL';
    }
    return 'COMPROBANTE DE VENTA';
  };

  const formatMethodName = (m?: string): string => {
    if (!m) return 'Efectivo';
    const norm = m.toLowerCase();
    if (norm === 'card' || norm === 'tarjeta') return 'Tarjeta';
    if (norm === 'transfer' || norm === 'transferencia') return 'Transferencia bancaria';
    if (norm === 'credit' || norm === 'credito' || norm === 'crédito') return 'Venta a crédito';
    if (norm === 'split' || norm === 'mixto') return 'Pago mixto / múltiple';
    return 'Efectivo';
  };

  const computedPaymentBreakdown = useMemo<PaymentMethodBreakdown[]>(() => {
    if (invoiceData.paymentBreakdown && invoiceData.paymentBreakdown.length > 0) {
      return invoiceData.paymentBreakdown.filter((p) => p.amount > 0);
    }
    const list: PaymentMethodBreakdown[] = [];
    if (Number(invoiceData.montoEfectivo || 0) > 0) {
      list.push({ method: 'efectivo', label: 'Efectivo', amount: Number(invoiceData.montoEfectivo) });
    }
    if (Number(invoiceData.montoTarjeta || 0) > 0) {
      list.push({ method: 'tarjeta', label: 'Tarjeta', amount: Number(invoiceData.montoTarjeta) });
    }
    if (Number(invoiceData.montoTransferencia || 0) > 0) {
      list.push({ method: 'transferencia', label: 'Transferencia bancaria', amount: Number(invoiceData.montoTransferencia) });
    }
    if (Number(invoiceData.montoCredito || 0) > 0) {
      list.push({ method: 'credito', label: 'Crédito', amount: Number(invoiceData.montoCredito) });
    }
    return list;
  }, [invoiceData]);

  const isMultiPayment = computedPaymentBreakdown.length > 1;
  const totalPagadoEnDesglose = computedPaymentBreakdown.reduce((sum, p) => sum + p.amount, 0);
  const totalPagadoEfectivo = isMultiPayment
    ? totalPagadoEnDesglose
    : (invoiceData.cashReceived ?? invoiceData.total);
  const primaryPaymentLabel = formatMethodName(
    computedPaymentBreakdown.length === 1 ? computedPaymentBreakdown[0].method : invoiceData.paymentMethod
  );

  const formattedDateTime = useMemo(() => {
    if (invoiceData.issueDate && invoiceData.issueTime) {
      return `${invoiceData.issueDate} ${invoiceData.issueTime}`;
    }
    if (invoiceData.issueDate) {
      return invoiceData.issueDate;
    }
    const now = new Date();
    return now.toLocaleString('es-DO', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [invoiceData.issueDate, invoiceData.issueTime]);

  // -------------------------------------------------------------
  // RENDER 1 & 2: TICKET TÉRMICO PROFESIONAL (58MM / 80MM / ANCHO PERSONALIZADO)
  // Formato claro, estético y diseñado para impresión continua sin truncado
  // -------------------------------------------------------------
  if (isTicket) {
    const printFormatClass = activeFormat === 'ticket_58mm' ? 'print-format-58mm' : 'print-format-80mm';
    const separatorClass = getSeparatorBorder(settings.separatorStyle || 'dashed');

    return (
      <div
        className={`printable-invoice-container ${printFormatClass} bg-white text-slate-900 border border-slate-200/90 shadow-xs p-4 sm:p-5 select-none transition-all mx-auto print:shadow-none print:border-none print:p-0 ${getLineSpacingClass(
          settings.printDensity || 'normal'
        )} ${className}`}
        style={{
          width: `${previewWidthPx}px`,
          maxWidth: '100%',
          height: 'auto',
          overflow: 'visible',
          paddingLeft: `${Math.max(8, (settings.marginMm ?? 3) * 3.78)}px`,
          paddingRight: `${Math.max(8, (settings.marginMm ?? 3) * 3.78)}px`,
          fontFamily: getFontFamily(settings.fontFamily || 'sans'),
          fontSize: `${baseFontPt}px`,
          fontWeight: settings.fontWeight === 'bold' ? 700 : settings.fontWeight === 'medium' ? 600 : 400,
          textTransform: settings.uppercaseOnly ? 'uppercase' : 'none',
        }}
      >
        {/* Encabezado del ticket */}
        <div className="text-center space-y-1">
          {settings.showLogo && logoUrl && (
            <div className="flex justify-center pb-1">
              <img
                src={logoUrl}
                alt="Logo Empresa"
                style={{ height: `${getLogoHeightPx(settings.logoSize || 'medium')}px` }}
                className="object-contain"
              />
            </div>
          )}
          <p
            className="font-black uppercase tracking-tight text-slate-950"
            style={{ fontSize: `${baseFontPt + 3}px` }}
          >
            {settings.companyName || 'Supermercado Mercato S.R.L.'}
          </p>
          {settings.showSlogan && settings.customSlogan && (
            <p className="text-slate-600 italic" style={{ fontSize: `${baseFontPt - 1.5}px` }}>
              "{settings.customSlogan}"
            </p>
          )}
          {settings.showCompanyRnc && (
            <p className="font-semibold text-slate-800" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
              RNC: {settings.companyRnc || '101000001'}
              {settings.showCompanyPhone && settings.companyPhone ? ` · Tel: ${settings.companyPhone}` : ''}
            </p>
          )}
          {settings.showCompanyAddress && settings.companyAddress && (
            <p className="text-slate-600 leading-tight" style={{ fontSize: `${baseFontPt - 1.5}px` }}>
              {settings.companyAddress}
            </p>
          )}
          {!settings.showCompanyRnc && settings.showCompanyPhone && settings.companyPhone && (
            <p className="text-slate-600" style={{ fontSize: `${baseFontPt - 1.5}px` }}>
              Tel: {settings.companyPhone}
            </p>
          )}
          {settings.showCompanyEmail && settings.companyEmail && (
            <p className="text-slate-600" style={{ fontSize: `${baseFontPt - 1.5}px` }}>
              {settings.companyEmail}
            </p>
          )}

          {/* Título de comprobante */}
          <div className="pt-2 pb-0.5">
            <p className="font-black uppercase tracking-wide text-slate-950" style={{ fontSize: `${baseFontPt + 0.5}px` }}>
              {getReceiptTitle()}
            </p>
          </div>
        </div>

        {/* Separador superior */}
        <div className={`my-2 ${separatorClass}`} />

        {/* Metadatos (No. Fac, Caja, Cajero, Fecha, NCF) */}
        <div
          className="space-y-1 text-slate-800"
          style={{ fontSize: `${baseFontPt - 0.5}px` }}
        >
          <div className="flex justify-between gap-2">
            <span className="text-slate-600 font-medium shrink-0">No. Fac:</span>
            <span className="font-mono font-bold text-slate-950 text-right truncate">
              {invoiceData.invoiceNumber}
            </span>
          </div>

          {invoiceData.ncf && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 font-medium shrink-0">NCF:</span>
              <span className="font-mono font-bold text-slate-950 text-right">
                {invoiceData.ncf}
              </span>
            </div>
          )}

          {isFiscal && invoiceData.expirationDate && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Vencimiento:</span>
              <span className="font-mono text-slate-800 text-right">
                {invoiceData.expirationDate}
              </span>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <span className="text-slate-600 font-medium shrink-0">Caja:</span>
            <span className="font-semibold text-slate-950 text-right">
              {invoiceData.registerNumber || 'Caja #1 - Administrador'}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-600 font-medium shrink-0">Cajero:</span>
            <span className="font-semibold text-slate-950 text-right">
              {invoiceData.cashier || 'Admin General'}
            </span>
          </div>

          <div className="flex justify-between gap-2">
            <span className="text-slate-600 font-medium shrink-0">Fecha:</span>
            <span className="font-semibold text-slate-950 text-right">
              {formattedDateTime}
            </span>
          </div>

          {settings.showCustomerInfo && invoiceData.customerName && (
            <div className="flex justify-between gap-2 pt-0.5 border-t border-dotted border-slate-200">
              <span className="text-slate-600 font-medium shrink-0">Cliente:</span>
              <span className="font-semibold text-slate-950 text-right truncate max-w-[200px]">
                {invoiceData.customerName}
              </span>
            </div>
          )}

          {invoiceData.customerRnc && (isFiscal || settings.showCustomerRncInNormal) && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 font-medium shrink-0">RNC Cliente:</span>
              <span className="font-mono font-bold text-slate-950 text-right">
                {invoiceData.customerRnc}
              </span>
            </div>
          )}

          {settings.showCustomerPhone && invoiceData.customerPhone && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Tel. Cliente:</span>
              <span className="text-right text-slate-800">{invoiceData.customerPhone}</span>
            </div>
          )}

          {settings.showCustomerAddress && invoiceData.customerAddress && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Dirección:</span>
              <span className="text-right truncate max-w-[190px] text-slate-800">
                {invoiceData.customerAddress}
              </span>
            </div>
          )}
        </div>

        {/* Cabecera de la tabla de Ítems */}
        <div className={`mt-2 pt-2 pb-1 ${separatorClass}`}>
          <div className="flex justify-between font-black text-slate-900 uppercase tracking-wider text-[11px]">
            <span>Cant. Descripción</span>
            <span>Importe</span>
          </div>
        </div>

        {/* Lista de Ítems sin truncado ni solapamiento */}
        <div className={`pt-1 pb-2 ${separatorClass} space-y-2`}>
          {invoiceData.items.map((item, idx) => (
            <div
              key={idx}
              className="printable-invoice-item space-y-0.5"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-slate-950 leading-snug break-words">
                  {settings.showItemSku && item.sku ? `[${item.sku}] ` : ''}
                  {item.name}
                </span>
                <span className="font-black text-slate-950 tabular-nums shrink-0 text-right">
                  {fmt(item.subtotal)}
                </span>
              </div>
              <div
                className="text-slate-600 font-medium"
                style={{ fontSize: `${baseFontPt - 1.5}px` }}
              >
                <span>
                  {item.qty}{item.unit && !['und', 'ud', 'unidad', 'unidades'].includes(item.unit.toLowerCase()) ? ` ${item.unit}` : ''} x ${fmt(item.price)}
                </span>
                {item.itbis !== undefined && item.itbis > 0 && settings.showTaxBreakdown && (
                  <span className="ml-2 text-slate-500 font-normal">
                    (ITBIS: {fmt(item.itbis)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Subtotal, Descuento, ITBIS y Total */}
        <div className={`py-2 ${separatorClass} space-y-1.5`}>
          <div className="flex justify-between text-slate-700 font-medium" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
            <span>Subtotal:</span>
            <span className="tabular-nums font-semibold text-slate-900">{fmt(invoiceData.subtotal)}</span>
          </div>
          {typeof invoiceData.discount === 'number' && invoiceData.discount > 0 && (
            <div className="flex justify-between text-slate-700 font-medium" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
              <span>Descuento:</span>
              <span className="tabular-nums font-bold text-emerald-700">-{fmt(invoiceData.discount)}</span>
            </div>
          )}
          {settings.showTaxBreakdown && (
            <div className="flex justify-between text-slate-700 font-medium" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
              <span>ITBIS (18%):</span>
              <span className="tabular-nums font-semibold text-slate-900">{fmt(invoiceData.itbis)}</span>
            </div>
          )}
          <div
            className="flex justify-between font-black text-slate-950 pt-1.5 border-t border-slate-900"
            style={{ fontSize: `${baseFontPt + 2}px` }}
          >
            <span>TOTAL:</span>
            <span className="tabular-nums">{fmt(invoiceData.total)}</span>
          </div>
        </div>

        {/* Sección de Pago */}
        <div
          className={`py-2 ${separatorClass} space-y-1 text-slate-800`}
          style={{ fontSize: `${baseFontPt - 0.5}px` }}
        >
          {isMultiPayment ? (
            <div className="space-y-1">
              <div className="flex justify-between font-bold text-slate-950 pb-0.5">
                <span className="text-slate-600">Pago:</span>
                <span className="uppercase font-black text-slate-950">MÚLTIPLE</span>
              </div>
              {computedPaymentBreakdown.map((p, idx) => (
                <div key={idx} className="flex justify-between pl-2 text-slate-700">
                  <span>{p.label}:</span>
                  <span className="tabular-nums font-semibold text-slate-950">{fmt(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-slate-950 pt-0.5 border-t border-slate-200">
                <span className="text-slate-600">Recibido:</span>
                <span className="tabular-nums font-black text-slate-950">{fmt(totalPagadoEfectivo)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Pago:</span>
                <span className="font-bold text-slate-950 uppercase">{primaryPaymentLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">Recibido:</span>
                <span className="font-bold text-slate-950 tabular-nums">
                  {fmt(invoiceData.cashReceived ?? invoiceData.total)}
                </span>
              </div>
            </div>
          )}

          {invoiceData.change !== undefined && Number(invoiceData.change) > 0 && (
            <div className="flex justify-between font-bold text-slate-950 pt-0.5">
              <span className="text-slate-600 font-medium">Cambio:</span>
              <span className="tabular-nums font-black">{fmt(invoiceData.change)}</span>
            </div>
          )}
        </div>

        {/* Código de barras / QR si está activo */}
        {settings.showBarcodeQr && (
          <QrCodeMock
            label={
              isFiscal && invoiceData.ncf
                ? `NCF: ${invoiceData.ncf} · DGII Válido`
                : invoiceData.invoiceNumber
            }
          />
        )}

        {/* Mensaje de cortesía */}
        <div className={`py-2 ${separatorClass} text-center space-y-1`}>
          <p className="font-medium italic text-slate-700 leading-snug" style={{ fontSize: `${baseFontPt - 1}px` }}>
            {settings.footerMessage || '¡Gracias por preferirnos! Conserve este comprobante para cualquier reclamación.'}
          </p>
          {settings.showTerms && settings.termsAndConditions && (
            <p className="text-[8.5px] leading-tight text-slate-500 pt-0.5">
              {settings.termsAndConditions}
            </p>
          )}
          {settings.showDgiiLegend && isFiscal && (
            <p className="text-[8px] font-bold text-slate-700 pt-0.5">
              {settings.dgiiNotice || 'Documento autorizado por la DGII conforme a la Ley 11-92.'}
            </p>
          )}
        </div>

        {/* Firmas Cajero y Cliente */}
        {settings.showSignatureLine && (
          <div className={`pt-4 pb-2 ${separatorClass}`}>
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="border-t border-slate-700 mb-1" />
                <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                  Cajero
                </span>
              </div>
              <div>
                <div className="border-t border-slate-700 mb-1" />
                <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                  Cliente
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pie del sistema */}
        <div className="pt-2 pb-1 text-center select-none">
          <p className="text-[9px] font-medium text-slate-400 tracking-wider">
            Sistema Mercato Desktop
          </p>
        </div>

        {/* Avance de papel configurado */}
        {settings.feedLines > 0 && (
          <div style={{ height: `${Math.min(6, settings.feedLines) * 6}px` }} />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 3: HOJA COMPLETA / CARTA / A4 (ESPAÑOL, UNIFICADO CON CONFIGURACIÓN)
  // -------------------------------------------------------------
  const separatorClass = getSeparatorBorder(settings.separatorStyle || 'dashed');

  return (
    <div
      className={`printable-invoice-container bg-white text-slate-900 p-7 sm:p-8 rounded-[20px] border border-slate-200/80 shadow-xs print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full ${getLineSpacingClass(
        settings.printDensity || 'normal'
      )} ${className}`}
      style={{
        fontFamily: getFontFamily(settings.fontFamily || 'courier'),
        fontSize: `${baseFontPt}px`,
        fontWeight: settings.fontWeight === 'bold' ? 700 : settings.fontWeight === 'medium' ? 600 : 400,
        textTransform: settings.uppercaseOnly ? 'uppercase' : 'none',
      }}
    >
      {/* 1. CABECERA: Empresa a la izquierda · Comprobante y NCF a la derecha */}
      <div
        className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b-2"
        style={{ borderColor: accent }}
      >
        <div className="space-y-1">
          {settings.showLogo && logoUrl && (
            <img
              src={logoUrl}
              alt="Logo Empresa"
              style={{ height: `${getLogoHeightPx(settings.logoSize || 'medium')}px` }}
              className="object-contain mb-1.5"
            />
          )}
          <h1
            className="font-black tracking-tight text-slate-900 uppercase"
            style={{ fontSize: `${baseFontPt + 5}px` }}
          >
            {settings.companyName || 'SUPERMERCADO MERCATO S.R.L.'}
          </h1>
          {settings.showSlogan && settings.customSlogan && (
            <p className="text-slate-600 italic" style={{ fontSize: `${baseFontPt - 1}px` }}>
              "{settings.customSlogan}"
            </p>
          )}
          {settings.showCompanyRnc && (
            <p className="font-semibold text-slate-700" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
              RNC: <span className="font-mono">{settings.companyRnc || '131-45678-9'}</span>
            </p>
          )}
          {settings.showCompanyAddress && settings.companyAddress && (
            <p className="text-slate-600" style={{ fontSize: `${baseFontPt - 1}px` }}>
              {settings.companyAddress}
            </p>
          )}
          <div
            className="flex flex-wrap gap-2 text-slate-600 pt-0.5"
            style={{ fontSize: `${baseFontPt - 1}px` }}
          >
            {settings.showCompanyPhone && settings.companyPhone && (
              <span>Tel: {settings.companyPhone}</span>
            )}
            {settings.showCompanyEmail && settings.companyEmail && (
              <span>· {settings.companyEmail}</span>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <p
            className="font-black uppercase tracking-wide text-slate-900"
            style={{ fontSize: `${baseFontPt + 1}px`, color: accent }}
          >
            {getReceiptTitle()}
          </p>

          {invoiceData.ncf && (
            <p className="font-mono font-bold text-slate-900" style={{ fontSize: `${baseFontPt + 1}px` }}>
              NCF: {invoiceData.ncf}
            </p>
          )}

          <p className="font-mono font-semibold text-slate-600" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
            Factura No.: {invoiceData.invoiceNumber}
          </p>

          {isFiscal && invoiceData.expirationDate && (
            <p className="text-slate-500 font-mono" style={{ fontSize: `${baseFontPt - 1.5}px` }}>
              Vencimiento NCF: {invoiceData.expirationDate}
            </p>
          )}
        </div>
      </div>

      {/* 2. DATOS DE CLIENTE & METADATOS DE LA VENTA */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 ${separatorClass}`}>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Datos del Cliente
          </p>
          {settings.showCustomerInfo && (
            <p className="font-bold text-slate-900" style={{ fontSize: `${baseFontPt + 1}px` }}>
              {invoiceData.customerName || 'Consumidor Final'}
            </p>
          )}
          {invoiceData.customerRnc && (isFiscal || settings.showCustomerRncInNormal) && (
            <p className="font-mono text-slate-700" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
              RNC / Cédula: {invoiceData.customerRnc}
            </p>
          )}
          {settings.showCustomerPhone && invoiceData.customerPhone && (
            <p className="text-slate-600" style={{ fontSize: `${baseFontPt - 1}px` }}>
              Teléfono: {invoiceData.customerPhone}
            </p>
          )}
          {settings.showCustomerAddress && invoiceData.customerAddress && (
            <p className="text-slate-600" style={{ fontSize: `${baseFontPt - 1}px` }}>
              Dirección: {invoiceData.customerAddress}
            </p>
          )}
        </div>

        <div className="space-y-1 sm:text-right" style={{ fontSize: `${baseFontPt - 0.5}px` }}>
          <div className="flex sm:justify-end gap-2">
            <span className="text-slate-500">Fecha / Hora:</span>
            <span className="font-semibold text-slate-900">
              {invoiceData.issueDate}{' '}
              {settings.showIssueTime && invoiceData.issueTime ? invoiceData.issueTime : ''}
            </span>
          </div>
          <div className="flex sm:justify-end gap-2">
            <span className="text-slate-500 font-semibold">Cajero responsable:</span>
            <span className="font-semibold text-slate-900">
              {invoiceData.cashier || 'Cajero'}
            </span>
          </div>
          {settings.showRegisterNumber && (
            <div className="flex sm:justify-end gap-2">
              <span className="text-slate-500">Terminal:</span>
              <span className="font-semibold text-slate-900">
                {invoiceData.registerNumber || 'POS-01'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. TABLA DE ÍTEMS */}
      <div className={`my-3 overflow-x-auto ${separatorClass} pt-2`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              {settings.showItemSku && <th className="py-2 px-2">Código</th>}
              <th className="py-2 px-2">Descripción</th>
              <th className="py-2 px-3 text-right">Cant.</th>
              {settings.showItemPriceUnitPrice && (
                <th className="py-2 px-3 text-right">Precio Unit.</th>
              )}
              <th className="py-2 px-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoiceData.items.map((item, idx) => (
              <tr key={idx}>
                {settings.showItemSku && (
                  <td className="py-2 px-2 font-mono text-slate-500">{item.sku || '—'}</td>
                )}
                <td className="py-2 px-2 font-medium text-slate-900">{item.name}</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                  {item.qty}{item.unit && !['und', 'ud', 'unidad', 'unidades'].includes(item.unit.toLowerCase()) ? ` ${item.unit}` : ''}
                </td>
                {settings.showItemPriceUnitPrice && (
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                    {fmt(item.price)}
                  </td>
                )}
                <td className="py-2 px-2 text-right font-mono font-bold tabular-nums text-slate-900">
                  {fmt(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. PIE Y TOTALES */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 items-start ${separatorClass}`}>
        <div className="space-y-2" style={{ fontSize: `${baseFontPt - 1}px` }}>
          {settings.showFooterMessage && settings.footerMessage && (
            <p className="font-medium text-slate-700">{settings.footerMessage}</p>
          )}
          {settings.showTerms && settings.termsAndConditions && (
            <p className="text-slate-500 leading-snug" style={{ fontSize: `${baseFontPt - 2}px` }}>
              {settings.termsAndConditions}
            </p>
          )}
          {settings.showDgiiLegend && isFiscal && (
            <p className="font-bold text-slate-700 pt-0.5" style={{ fontSize: `${baseFontPt - 2}px` }}>
              {settings.dgiiNotice || 'Documento autorizado por la DGII conforme a la Ley 11-92.'}
            </p>
          )}
          {settings.showBarcodeQr && (
            <div className="pt-1 flex justify-start">
              <QrCodeMock
                label={
                  isFiscal && invoiceData.ncf
                    ? `NCF: ${invoiceData.ncf} · DGII Válido`
                    : invoiceData.invoiceNumber
                }
              />
            </div>
          )}
          {settings.showSignatureLine && (
            <div className="pt-6 w-64 text-center space-y-1">
              <div className="border-t border-slate-400" />
              <p className="text-[9px] text-slate-500 uppercase">
                Firma del cliente / Recibido conforme
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5 sm:text-right">
          <div className="flex justify-between sm:justify-end sm:gap-8 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono tabular-nums text-slate-900">
              {fmt(invoiceData.subtotal)}
            </span>
          </div>
          {typeof invoiceData.discount === 'number' && invoiceData.discount > 0 && (
            <div className="flex justify-between sm:justify-end sm:gap-8 text-slate-600">
              <span>Descuento:</span>
              <span className="font-mono tabular-nums text-slate-900">
                -{fmt(invoiceData.discount)}
              </span>
            </div>
          )}
          {settings.showTaxBreakdown && (
            <div className="flex justify-between sm:justify-end sm:gap-8 text-slate-600">
              <span>ITBIS (18%):</span>
              <span className="font-mono tabular-nums text-slate-900">
                {fmt(invoiceData.itbis)}
              </span>
            </div>
          )}
          <div
            className="flex justify-between sm:justify-end sm:gap-8 font-black text-slate-900 pt-2 border-t-2 border-slate-900"
            style={{ fontSize: `${baseFontPt + 3}px` }}
          >
            <span>TOTAL A PAGAR:</span>
            <span className="font-mono tabular-nums" style={{ color: accent }}>
              {fmt(invoiceData.total)}
            </span>
          </div>

          {/* Sección de Métodos de Pago (Simple o Múltiple) */}
          <div
            className="pt-3 text-slate-700 space-y-2 border-t border-slate-200"
            style={{ fontSize: `${baseFontPt - 1}px` }}
          >
            {isMultiPayment ? (
              <div className="space-y-1 sm:max-w-sm sm:ml-auto">
                <div className="flex justify-between font-black text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-tight text-xs">
                  <span>MÉTODO DE PAGO</span>
                  <span>IMPORTE</span>
                </div>
                {computedPaymentBreakdown.map((p, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="font-medium text-slate-700">{p.label}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">{fmt(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Pagado:</span>
                  <span className="font-mono tabular-nums">{fmt(totalPagadoEfectivo)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between sm:justify-end sm:gap-8">
                  <span className="font-semibold text-slate-600">Método de pago:</span>
                  <span className="font-bold text-slate-900">{primaryPaymentLabel}</span>
                </div>
                <div className="flex justify-between sm:justify-end sm:gap-8">
                  <span className="text-slate-600">Importe pagado:</span>
                  <span className="font-mono tabular-nums">{fmt(invoiceData.cashReceived ?? invoiceData.total)}</span>
                </div>
              </div>
            )}

            {invoiceData.change !== undefined && Number(invoiceData.change) > 0 && (
              <div className="flex justify-between sm:justify-end sm:gap-8 font-semibold text-slate-900 pt-1 border-t border-slate-100">
                <span>Cambio entregado:</span>
                <span className="font-mono tabular-nums">{fmt(invoiceData.change)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
