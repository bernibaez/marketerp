import React from 'react';
import type {
  InvoiceSettings,
  FontFamily,
  SeparatorStyle,
  PrintDensity,
  LogoSize,
} from '@/lib/invoiceSettingsStore';

interface InvoiceLivePreviewProps {
  settings: InvoiceSettings;
  logoUrl: string | null;
  previewTab: 'consumidor' | 'fiscal';
  onTabChange: (tab: 'consumidor' | 'fiscal') => void;
}

export function InvoiceLivePreview({
  settings,
  logoUrl,
  previewTab,
  onTabChange,
}: InvoiceLivePreviewProps) {
  const isFiscal = previewTab === 'fiscal';
  const accent = settings.accentColor || '#0f766e';
  const isTicket = settings.printFormat === 'ticket_80mm' || settings.printFormat === 'ticket_58mm';

  const widthMm = settings.customWidthMm || (settings.printFormat === 'ticket_58mm' ? 58 : 80);
  const previewWidthPx = isTicket
    ? Math.min(460, Math.max(190, Math.round(widthMm * 3.78)))
    : 440;

  const getFontFamily = (f: FontFamily) => {
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

  const getSeparatorBorder = (s: SeparatorStyle) => {
    switch (s) {
      case 'solid':
        return 'border-t border-slate-300 dark:border-slate-700';
      case 'dotted':
        return 'border-t border-dotted border-slate-400 dark:border-slate-600';
      case 'double':
        return 'border-t-2 border-double border-slate-400 dark:border-slate-600';
      case 'dashed':
      default:
        return 'border-t border-dashed border-slate-300 dark:border-slate-700';
    }
  };

  const getLineSpacingClass = (d: PrintDensity) => {
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

  const getLogoHeightPx = (s: LogoSize) => {
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

  return (
    <div className="lg:col-span-6 sticky top-6 space-y-3">
      {/* Cabecera de la vista previa: Control segmentado y texto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onTabChange('consumidor')}
            className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
              previewTab === 'consumidor'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Consumidor
          </button>
          <button
            type="button"
            onClick={() => onTabChange('fiscal')}
            className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
              previewTab === 'fiscal'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Crédito fiscal
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {widthMm}mm (~{previewWidthPx}px)
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Vista previa en vivo
          </span>
        </div>
      </div>

      {/* Contenedor gris suave donde reposa el papel */}
      <div className="bg-slate-50/90 dark:bg-slate-900/40 p-6 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-center items-start min-h-[560px] overflow-y-auto max-h-[700px] scrollbar-thin">
        {/* Papel de factura (blanco, sombra sutil, tipografía y ancho dinámico) */}
        <div
          className={`bg-white text-slate-900 border border-slate-200/90 shadow-sm p-5 select-none transition-all mx-auto ${getLineSpacingClass(
            settings.printDensity || 'normal'
          )}`}
          style={{
            width: `${previewWidthPx}px`,
            maxWidth: '100%',
            paddingLeft: `${Math.max(8, (settings.marginMm || 3) * 3.78)}px`,
            paddingRight: `${Math.max(8, (settings.marginMm || 3) * 3.78)}px`,
            fontFamily: getFontFamily(settings.fontFamily || 'courier'),
            fontSize: `${settings.customFontSizePt || 11}px`,
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
              className="font-black uppercase tracking-tight text-slate-900"
              style={{ fontSize: `${(settings.customFontSizePt || 11) + 2}px` }}
            >
              {settings.companyName || 'Supermercado Mercato S.R.L.'}
            </p>
            {settings.showSlogan && settings.customSlogan && (
              <p className="text-slate-600 italic" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                "{settings.customSlogan}"
              </p>
            )}
            {settings.showCompanyRnc && (
              <p className="font-semibold text-slate-700" style={{ fontSize: `${(settings.customFontSizePt || 11) - 0.5}px` }}>
                RNC: {settings.companyRnc || '131-45678-9'}
              </p>
            )}
            {settings.showCompanyAddress && settings.companyAddress && (
              <p className="text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                {settings.companyAddress}
              </p>
            )}
            {settings.showCompanyPhone && settings.companyPhone && (
              <p className="text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                Tel: {settings.companyPhone}
              </p>
            )}
          </div>

          {/* Línea fina con el color de acento seleccionado */}
          <div
            className="h-[2px] w-full my-2.5"
            style={{ backgroundColor: accent }}
          />

          {/* Título de comprobante y NCF */}
          <div className="text-center space-y-0.5 pb-2">
            <p className="font-bold uppercase" style={{ fontSize: `${(settings.customFontSizePt || 11) - 0.5}px` }}>
              {isFiscal ? 'FACTURA DE CRÉDITO FISCAL' : 'FACTURA PARA CONSUMIDOR FINAL'}
            </p>
            <p className="font-mono font-bold text-slate-800">
              {isFiscal ? 'NCF: B0100000084' : 'NCF: B0200000452'}
            </p>
            {isFiscal && (
              <p className="text-slate-500 font-mono" style={{ fontSize: `${(settings.customFontSizePt || 11) - 2}px` }}>
                Vencimiento NCF: 31/12/2027
              </p>
            )}
          </div>

          {/* Metadatos (Fecha, Cajero, Terminal, Cliente) */}
          <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-1 text-slate-700`} style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha / Hora:</span>
              <span>26/10/2026 {settings.showIssueTime ? '10:45 AM' : ''}</span>
            </div>
            {settings.showCashier && (
              <div className="flex justify-between">
                <span className="text-slate-500">Cajero:</span>
                <span>Caja #1 (Admin)</span>
              </div>
            )}
            {settings.showRegisterNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Terminal:</span>
                <span>POS-01</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-medium truncate max-w-[170px]">
                {isFiscal ? 'DISTRIBUIDORA NACIONAL S.A.' : 'Juan Pérez'}
              </span>
            </div>
            {isFiscal && (
              <div className="flex justify-between">
                <span className="text-slate-500">RNC Cliente:</span>
                <span className="font-mono">101-98765-4</span>
              </div>
            )}
          </div>

          {/* Tabla de Ítems */}
          <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-2`}>
            <div className="space-y-0.5">
              <p className="text-slate-900 font-medium">Arroz Súper Selecto 10 lbs</p>
              <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                <span>{settings.showItemPriceUnitPrice ? '2 x RD$ 380.00' : 'Cant: 2'}</span>
                <span className="text-slate-900 font-semibold tabular-nums">RD$ 760.00</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-slate-900 font-medium">Aceite Vegetal Crisol 64 oz</p>
              <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                <span>{settings.showItemPriceUnitPrice ? '1 x RD$ 295.00' : 'Cant: 1'}</span>
                <span className="text-slate-900 font-semibold tabular-nums">RD$ 295.00</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-slate-900 font-medium">Leche Entera Milex 1L</p>
              <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                <span>{settings.showItemPriceUnitPrice ? '4 x RD$ 85.00' : 'Cant: 4'}</span>
                <span className="text-slate-900 font-semibold tabular-nums">RD$ 340.00</span>
              </div>
            </div>
          </div>

          {/* Subtotal, ITBIS y Total */}
          <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-1`}>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">RD$ 1,395.00</span>
            </div>
            {settings.showTaxBreakdown && (
              <div className="flex justify-between text-slate-600">
                <span>ITBIS (18%)</span>
                <span className="tabular-nums">RD$ 251.10</span>
              </div>
            )}
            <div className="flex justify-between font-black text-slate-900 pt-1.5 border-t border-slate-900" style={{ fontSize: `${(settings.customFontSizePt || 11) + 1.5}px` }}>
              <span>TOTAL A PAGAR</span>
              <span className="tabular-nums">RD$ 1,646.10</span>
            </div>

            {settings.showPaymentDetails && (
              <div className="pt-1.5 text-slate-600 space-y-0.5" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                <div className="flex justify-between">
                  <span>Efectivo recibido:</span>
                  <span className="tabular-nums">RD$ 2,000.00</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Cambio entregado:</span>
                  <span className="tabular-nums">RD$ 353.90</span>
                </div>
              </div>
            )}
          </div>

          {/* Código de barras / QR si está activo */}
          {settings.showBarcodeQr && (
            <div className="py-2.5 flex flex-col items-center justify-center space-y-1">
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
              <span className="text-[7.5px] font-mono tracking-wider text-slate-500">
                {isFiscal ? 'e-CF: E3100000084 · DGII Válido' : 'FAC-000452'}
              </span>
            </div>
          )}

          {/* Línea de firma si está activa */}
          {settings.showSignatureLine && (
            <div className="pt-3 pb-1 text-center space-y-1">
              <div className="w-3/4 mx-auto border-t border-slate-400" />
              <p className="text-[8px] text-slate-500 uppercase">Firma del cliente / Recibido conforme</p>
            </div>
          )}

          {/* Pie de ticket y DGII */}
          <div
            className="pt-2 text-center space-y-1 text-slate-500"
            style={{ fontSize: `${(settings.customFontSizePt || 11) - 2}px` }}
          >
            {settings.footerMessage && (
              <p className="font-medium text-slate-700">{settings.footerMessage}</p>
            )}
            {settings.termsAndConditions && (
              <p className="text-[8px] leading-tight text-slate-400">{settings.termsAndConditions}</p>
            )}
            {settings.showDgiiLegend && isFiscal && (
              <p className="text-[8px] font-bold text-slate-700 pt-0.5">
                {settings.dgiiNotice || 'Documento autorizado por la DGII conforme a la Ley 11-92.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
