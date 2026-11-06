import React, { useMemo } from 'react';
import type {
  InvoiceData,
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  InvoiceHeightMode,
} from '@/types/invoice';
import { normalizeInvoiceStyle } from '@/types/invoice';
import {
  formatCurrency,
  formatDate,
  formatTime,
} from '@/utils/invoiceFormat';
import InvoiceBarcode from './InvoiceBarcode';

export interface ThermalInvoiceProps {
  data: InvoiceData;
  settings: InvoiceSettings;
  width?: PaperWidth;
  logoUrl?: string | null;
  className?: string;
  fontSizeOption?: FontSizeOption;
  zoomScale?: number;
}

export const ThermalInvoice: React.FC<ThermalInvoiceProps> = ({
  data,
  settings,
  width,
  logoUrl,
  className = '',
  fontSizeOption,
  zoomScale,
}) => {
  // Ancho efectivo: prop width tiene prioridad, luego settings.paperWidth, default 80
  const activeWidth: PaperWidth = width ?? settings.paperWidth ?? 80;
  const is50mm = activeWidth === 50;
  const is58mm = activeWidth === 58;
  const isNarrow = is50mm || is58mm;

  // Estilo visual seleccionado entre los 6 disponibles
  const styleVariant = normalizeInvoiceStyle(settings.templateStyle);

  // Optimización inteligente de altura / rollo térmico según cantidad de productos
  const itemsList = data.items || [];
  const itemCount = itemsList.length;
  const isSmallSale = itemCount <= 3;
  const effectiveHeightMode: InvoiceHeightMode = settings.heightMode ?? 'auto';
  const shouldSavePaper =
    effectiveHeightMode === 'compact' ||
    styleVariant === 'compacto' ||
    (effectiveHeightMode === 'auto' && (settings.paperSaverSmallSales ?? true) && isSmallSale);

  const currencySymbol = settings.currencySymbol || 'RD$';
  const effectiveLogoUrl = logoUrl ?? settings.logoUrl;

  // Cálculos consistentes de totales
  const totals = useMemo(() => {
    const subtotal = data.subtotal ?? 0;
    const itbis = data.impuesto ?? data.itbis ?? 0;
    const total = data.total ?? subtotal + itbis;
    const pagado = data.pagado ?? total;
    const cambio = data.cambio ?? Math.max(0, pagado - total);

    const totalArticulos = (data.items || []).reduce((acc, it) => {
      const q = typeof it.cantidad === 'number' ? it.cantidad : it.qty ?? 1;
      return acc + q;
    }, 0);

    return {
      subtotal,
      itbis,
      total,
      pagado,
      cambio,
      totalArticulos: Math.round((totalArticulos + Number.EPSILON) * 100) / 100,
    };
  }, [data]);

  // Formato de fecha y hora
  const formattedDate = useMemo(() => {
    return formatDate(data.fecha || data.issueDate);
  }, [data.fecha, data.issueDate]);

  const formattedTime = useMemo(() => {
    return formatTime(data.hora || data.issueTime);
  }, [data.hora, data.issueTime]);

  // Línea de contacto formateada limpia (RNC · Tel)
  const contactLine = useMemo(() => {
    const parts: string[] = [];
    if (settings.showCompanyRnc && settings.companyRnc) {
      parts.push(`RNC: ${settings.companyRnc}`);
    }
    if (settings.showCompanyPhone && settings.companyPhone) {
      parts.push(`Tel: ${settings.companyPhone}`);
    }
    return parts.join(' · ');
  }, [settings.showCompanyRnc, settings.companyRnc, settings.showCompanyPhone, settings.companyPhone]);

  // Dimensiones físicas del cabezal térmico real:
  // 80mm: 72mm imprimible
  // 58mm: 48mm imprimible
  // 50mm: 44mm imprimible
  const printableWidthClass = is50mm
    ? 'thermal-width-50mm'
    : is58mm
    ? 'thermal-width-58mm'
    : 'thermal-width-80mm';

  const containerWidthMm = is50mm ? '44mm' : is58mm ? '48mm' : '72mm';
  const paddingX = is50mm ? '1.5mm' : is58mm ? '2mm' : '2.5mm';

  // Tamaño de fuente base y escala de zoom
  const effectiveFontSizeOption: FontSizeOption =
    fontSizeOption ?? settings.fontSizeOption ?? 'normal';
  const effectiveZoom = zoomScale ?? settings.zoomScale ?? 1.0;

  const fontMultiplier = useMemo(() => {
    switch (effectiveFontSizeOption) {
      case 'compact':
        return 0.88;
      case 'large':
        return 1.15;
      case 'xlarge':
        return 1.30;
      case 'normal':
      default:
        return 1.0;
    }
  }, [effectiveFontSizeOption]);

  const totalScale = fontMultiplier * effectiveZoom;

  const baseFontSize = `${(9.5 * totalScale).toFixed(1)}px`;
  const smallFontSize = `${(8.0 * totalScale).toFixed(1)}px`;
  const microFontSize = `${(7.0 * totalScale).toFixed(1)}px`;

  // Título del comprobante
  const receiptTitle = useMemo(() => {
    if (data.ncfTypeName) return data.ncfTypeName.toUpperCase();
    if (data.ncf && data.ncf.startsWith('B01')) return 'FACTURA DE CRÉDITO FISCAL';
    if (data.ncf && data.ncf.startsWith('B02')) return 'FACTURA DE CONSUMO';
    if (data.ncf) return 'COMPROBANTE FISCAL';
    return 'COMPROBANTE DE VENTA';
  }, [data.ncf, data.ncfTypeName]);

  const invoiceNumber = data.numero || data.invoiceNumber || '000000';
  const cashierName = data.cajero || data.cashier;
  const customerName = data.cliente || data.customerName;
  const ncfValue = data.ncf || settings.ncfSequence;
  const registerDisplay = data.registerNumber || 'Caja #01';

  // Tipografía seleccionada: respeta settings.fontFamily o utiliza la del estilo visual
  const fontFamilyStyle = useMemo(() => {
    const family = settings.fontFamily;
    if (family === 'courier') {
      return "'Courier New', Courier, 'DejaVu Sans Mono', monospace";
    }
    if (family === 'sans') {
      return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    }
    if (family === 'mono') {
      return "'Roboto Mono', 'SF Mono', Consolas, 'DejaVu Sans Mono', monospace";
    }
    if (family === 'condensed') {
      return "'Arial Narrow', 'Helvetica Condensed', 'Roboto Condensed', 'Franklin Gothic Medium', sans-serif-condensed, sans-serif";
    }
    if (family === 'consolas') {
      return "'Consolas', 'Fira Code', 'Menlo', 'Monaco', monospace";
    }
    if (family === 'serif') {
      return "'Georgia', 'Times New Roman', 'DejaVu Serif', serif";
    }

    switch (styleVariant) {
      case 'elegante':
        return "'DejaVu Serif', Georgia, 'Times New Roman', serif";
      case 'minimalista':
      case 'moderno':
        return "'DejaVu Sans', Arial, Helvetica, ui-sans-serif, system-ui, sans-serif";
      case 'supermercado':
      case 'compacto':
      case 'clasico':
      default:
        return "'DejaVu Sans Mono', 'Courier New', Courier, monospace";
    }
  }, [settings.fontFamily, styleVariant]);

  // Espaciado vertical adaptable según modo de rollo y cantidad de ítems
  const sectionGapClass = shouldSavePaper ? 'my-0.5' : 'my-1';
  const lineSpacingClass = shouldSavePaper ? 'space-y-0.5' : 'space-y-0.5';

  // Renderizador de líneas divisorias según estilo de plantilla y configuración
  const renderDivider = (extraClass = 'my-1') => {
    if (styleVariant === 'supermercado') {
      return (
        <div
          className={`text-center font-mono text-black overflow-hidden select-none ${extraClass}`}
          style={{ fontSize: microFontSize }}
        >
          * * * * * * * * * * * * * * * * * * * * * * * * *
        </div>
      );
    }
    if (styleVariant === 'elegante') {
      return (
        <div className={`flex items-center gap-1 ${extraClass}`}>
          <div className="flex-1 border-b border-black" />
          <span className="text-[10px] leading-none">✦</span>
          <div className="flex-1 border-b border-black" />
        </div>
      );
    }
    if (styleVariant === 'moderno') {
      return <div className={`border-b-2 border-black ${extraClass}`} />;
    }
    if (styleVariant === 'minimalista') {
      return <div className={`border-b border-black/80 ${extraClass}`} />;
    }
    // Clásico y Compacto (Mockup del usuario): Línea punteada sutil y nítida
    return <div className={`border-t border-dashed border-black/60 w-full ${extraClass}`} />;
  };

  return (
    <div
      className={`thermal-invoice-printable ${printableWidthClass} bg-white text-black select-none leading-tight ${className}`}
      data-style-variant={styleVariant}
      data-paper-saver={shouldSavePaper ? 'true' : 'false'}
      style={{
        width: containerWidthMm,
        maxWidth: containerWidthMm,
        minWidth: containerWidthMm,
        margin: '0 auto',
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingTop: shouldSavePaper ? '2px' : '4px',
        paddingBottom: shouldSavePaper ? '3px' : '8px',
        color: '#000000',
        backgroundColor: '#ffffff',
        fontFamily: fontFamilyStyle,
        fontSize: baseFontSize,
        boxSizing: 'border-box',
        breakInside: 'auto',
        pageBreakInside: 'auto',
        overflow: 'visible',
        colorAdjust: 'exact',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* ========================================================
          1. ENCABEZADO DE EMPRESA Y COMPROBANTE
          ======================================================== */}
      <div className={`thermal-invoice-header ${styleVariant === 'minimalista' ? 'text-left' : 'text-center'}`}>
        {/* MODERNO: Franja negra sólida superior */}
        {styleVariant === 'moderno' && (
          <div className="bg-black text-white px-2 py-2 mb-1.5 text-center -mx-1">
            <h1
              className="font-black uppercase tracking-wider leading-tight text-white"
              style={{ fontSize: `${(12.5 * totalScale).toFixed(1)}px` }}
            >
              {settings.companyName || 'SUPERMERCADO MERCATO'}
            </h1>
            {settings.showSlogan && settings.customSlogan && (
              <p className="text-slate-200 tracking-widest uppercase mt-0.5" style={{ fontSize: microFontSize }}>
                {settings.customSlogan}
              </p>
            )}
          </div>
        )}

        {/* ELEGANTE: Ornamento superior diamante ✦ */}
        {styleVariant === 'elegante' && (
          <div className="text-center pb-0.5">
            <span className="text-black font-normal" style={{ fontSize: `${(11 * totalScale).toFixed(1)}px` }}>
              ✦
            </span>
          </div>
        )}

        {/* LOGOTIPO O ICONO COMERCIAL (Mockup con badge redondeado) */}
        {settings.showLogo && styleVariant !== 'moderno' && (
          <div className={`flex ${styleVariant === 'minimalista' ? 'justify-start' : 'justify-center'} mb-1.5`}>
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt="Logo"
                className="object-contain max-h-12 max-w-[85%] filter grayscale contrast-200"
              />
            ) : (
              <div
                className="rounded-2xl bg-emerald-800 text-white font-black flex items-center justify-center shadow-xs"
                style={{
                  width: `${(32 * totalScale).toFixed(0)}px`,
                  height: `${(32 * totalScale).toFixed(0)}px`,
                  fontSize: `${(15 * totalScale).toFixed(0)}px`,
                }}
              >
                {(settings.companyName || 'M').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* NOMBRE DE LA EMPRESA */}
        {styleVariant === 'supermercado' ? (
          <div className="border-2 border-black p-1 my-1 text-center font-mono font-black">
            <h1
              className="uppercase tracking-tight leading-none"
              style={{ fontSize: `${(11.5 * totalScale).toFixed(1)}px` }}
            >
              {settings.companyName || 'SUPERMERCADO MERCATO'}
            </h1>
          </div>
        ) : styleVariant !== 'moderno' ? (
          <h1
            className={`font-black uppercase leading-tight text-black ${
              styleVariant === 'elegante'
                ? 'tracking-[0.12em] font-serif'
                : styleVariant === 'minimalista'
                ? 'tracking-normal text-left font-sans'
                : 'tracking-tight text-center'
            }`}
            style={{ fontSize: `${(12.5 * totalScale).toFixed(1)}px` }}
          >
            {settings.companyName || 'LICORES CHICHA'}
          </h1>
        ) : null}

        {/* LÍNEA DE CONTACTO: RNC · Tel (Separados por punto en 1 sola línea) */}
        {contactLine ? (
          <p
            className={`leading-tight mt-0.5 text-black font-mono ${styleVariant === 'minimalista' ? 'text-left' : 'text-center'}`}
            style={{ fontSize: smallFontSize }}
          >
            {contactLine}
          </p>
        ) : null}

        {/* DIRECCIÓN FÍSICA */}
        {settings.showCompanyAddress && settings.companyAddress && (
          <p
            className={`leading-tight mt-0.5 text-black ${styleVariant === 'minimalista' ? 'text-left' : 'text-center'}`}
            style={{ fontSize: smallFontSize }}
          >
            {settings.companyAddress}
          </p>
        )}

        {/* ESLOGAN COMERCIAL OPCIONAL */}
        {settings.showSlogan && settings.customSlogan && styleVariant !== 'moderno' && (
          <p
            className={`italic leading-tight mt-0.5 text-slate-700 ${styleVariant === 'minimalista' ? 'text-left' : 'text-center'}`}
            style={{ fontSize: microFontSize }}
          >
            {settings.customSlogan}
          </p>
        )}

        {/* TÍTULO DEL COMPROBANTE (COMPROBANTE DE VENTA / FACTURA DE CONSUMO) */}
        {styleVariant === 'minimalista' ? (
          <div className="mt-1 text-left">
            <span
              className="block font-black font-sans uppercase tracking-tight leading-none text-black"
              style={{ fontSize: `${(14 * totalScale).toFixed(1)}px` }}
            >
              Factura
            </span>
          </div>
        ) : (
          <div className="text-center mt-1">
            <span
              className="font-bold uppercase tracking-wider block text-black font-mono"
              style={{ fontSize: `${(10.5 * totalScale).toFixed(1)}px` }}
            >
              {receiptTitle}
            </span>
          </div>
        )}
      </div>

      {/* DIVISOR SUPERIOR */}
      {renderDivider(sectionGapClass)}

      {/* ========================================================
          2. METADATOS DE VENTA (No. Factura, Caja, Cajero, Fecha/Hora, NCF, Cliente)
          ======================================================== */}
      <div className={`${lineSpacingClass} ${sectionGapClass}`} style={{ fontSize: smallFontSize }}>
        {/* No. Factura */}
        <div className="flex justify-between items-baseline">
          <span className="text-slate-800">No. Factura:</span>
          <span className="font-bold font-mono text-black">{invoiceNumber}</span>
        </div>

        {/* Caja Registradora */}
        {settings.showRegisterNumber && (
          <div className="flex justify-between items-baseline">
            <span className="text-slate-800">Caja:</span>
            <span className="font-mono font-medium truncate max-w-[75%] text-right text-black">
              {registerDisplay}
            </span>
          </div>
        )}

        {/* Cajera / Cajero que emite la factura */}
        <div className="flex justify-between items-baseline">
          <span className="text-slate-800">Cajera:</span>
          <span className="font-bold truncate max-w-[75%] text-right text-black">
            {cashierName || 'Cajera'}
          </span>
        </div>

        {/* Fecha y Hora de emisión */}
        <div className="flex justify-between items-baseline">
          <span className="text-slate-800">{isNarrow ? 'Fecha:' : 'Fecha / Hora:'}</span>
          <span className="tabular-nums font-mono font-semibold text-right text-black">
            {formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate}
          </span>
        </div>

        {/* NCF si está habilitado y presente */}
        {settings.showNcf && ncfValue && (
          <div className="flex justify-between items-baseline font-bold pt-0.5">
            <span>NCF:</span>
            <span className="font-mono text-black">{ncfValue}</span>
          </div>
        )}

        {/* Vencimiento NCF */}
        {settings.showNcf && data.expirationDate && (
          <div className="flex justify-between items-baseline" style={{ fontSize: microFontSize }}>
            <span className="text-slate-700">Vence:</span>
            <span className="font-mono text-black">{data.expirationDate}</span>
          </div>
        )}

        {/* Cliente */}
        {settings.showCustomer && customerName && (
          <div className="flex justify-between items-baseline pt-0.5">
            <span className="text-slate-800">Cliente:</span>
            <span className="font-bold truncate max-w-[75%] text-right text-black">{customerName}</span>
          </div>
        )}

        {/* RNC / Cédula del Cliente */}
        {settings.showCustomer && (data.clienteRnc || data.customerRnc) && (
          <div className="flex justify-between items-baseline">
            <span className="text-slate-800">RNC/Cédula:</span>
            <span className="font-mono font-medium text-right text-black">
              {data.clienteRnc || data.customerRnc}
            </span>
          </div>
        )}
      </div>

      {/* DIVISOR ANTES DE PRODUCTOS */}
      {renderDivider(sectionGapClass)}

      {/* ========================================================
          3. CABECERA DE LA TABLA DE PRODUCTOS
          ======================================================== */}
      {styleVariant === 'moderno' ? (
        <div className="bg-black text-white px-1.5 py-0.5 my-1 flex justify-between font-bold" style={{ fontSize: microFontSize }}>
          <span className="w-8 text-left">CANT</span>
          <span className="flex-1 text-left px-1">DESCRIPCIÓN</span>
          <span className="w-14 text-right">PRECIO</span>
          <span className="w-14 text-right">TOTAL</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-baseline font-bold pb-0.5 text-black" style={{ fontSize: smallFontSize }}>
            <span>Cant. Descripción</span>
            <span>Importe</span>
          </div>
          <div className="border-t border-black/30 mb-1" />
        </>
      )}

      {/* ========================================================
          4. LISTA DE ARTÍCULOS (Diseño compacto y claro en 2 líneas)
          ======================================================== */}
      <div className={shouldSavePaper ? 'space-y-1' : 'space-y-1.5'}>
        {itemsList.map((item, idx) => {
          const qty = item.cantidad ?? item.qty ?? 1;
          const name = item.descripcion ?? item.name ?? 'Producto';
          const price = item.precioUnitario ?? item.price ?? 0;
          const total = item.total ?? item.subtotal ?? qty * price;
          const indexFormatted = String(idx + 1).padStart(3, '0');

          return (
            <div key={`item-${idx}`} className="thermal-invoice-item">
              {/* Línea 1: Descripción a la izquierda y Total a la derecha (ambos en negrita) */}
              <div className="flex justify-between items-baseline font-bold leading-snug">
                <span className="truncate pr-1 text-black">
                  {styleVariant === 'supermercado' ? `${indexFormatted} ` : ''}{name}
                </span>
                <span className="tabular-nums font-mono text-right shrink-0 text-black">
                  {formatCurrency(total, currencySymbol)}
                </span>
              </div>

              {/* Línea 2: Cantidad x Precio Unitario (ej: 1x RD$ 60.00) */}
              {(settings.showItemPriceUnitPrice ?? true) && (
                <div
                  className="text-slate-600 font-mono tracking-tight leading-tight pl-0.5"
                  style={{ fontSize: microFontSize }}
                >
                  {`${qty}x ${formatCurrency(price, currencySymbol)}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DIVISOR POST-PRODUCTOS */}
      {renderDivider(sectionGapClass)}

      {/* ========================================================
          5. SUB-TOTALES, DESCUENTO E ITBIS
          ======================================================== */}
      <div className="thermal-invoice-totals">
        <div className={`${lineSpacingClass} ${sectionGapClass}`} style={{ fontSize: smallFontSize }}>
          {styleVariant === 'supermercado' && (
            <div className="flex justify-between items-baseline font-mono text-black">
              <span>TOTAL ARTÍCULOS</span>
              <span className="font-bold font-mono">{totals.totalArticulos}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline">
            <span className="text-slate-800">Subtotal Neto:</span>
            <span className="tabular-nums font-mono font-medium text-black">
              {formatCurrency(totals.subtotal, currencySymbol)}
            </span>
          </div>

          {Number(data.discount || 0) > 0 && (
            <div className="flex justify-between items-baseline text-slate-800">
              <span>Descuento:</span>
              <span className="tabular-nums font-mono font-bold text-black">
                {`-${formatCurrency(data.discount, currencySymbol)}`}
              </span>
            </div>
          )}

          {(settings.showTaxBreakdown ?? true) && (
            <div className="flex justify-between items-baseline">
              <span className="text-slate-800">{`ITBIS (${settings.itbisPercent ?? 18}%):`}</span>
              <span className="tabular-nums font-mono text-black">
                {formatCurrency(totals.itbis, currencySymbol)}
              </span>
            </div>
          )}
        </div>

        {/* DIVISOR ANTES DEL TOTAL */}
        {renderDivider(sectionGapClass)}

        {/* ========================================================
            6. RECUADRO O FILA DESTACADA DE TOTAL A PAGAR
            ======================================================== */}
        {styleVariant === 'moderno' ? (
          <div className="bg-black text-white p-2 my-1 flex justify-between items-center -mx-1">
            <span
              className="font-black uppercase tracking-wider text-white font-sans"
              style={{ fontSize: `${(11.5 * totalScale).toFixed(1)}px` }}
            >
              TOTAL
            </span>
            <span
              className="font-black font-mono tracking-tight text-white tabular-nums"
              style={{ fontSize: `${(15.5 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : styleVariant === 'supermercado' ? (
          <div className="text-center my-1">
            <span className="block font-mono font-bold tracking-wider uppercase text-xs">
              TOTAL A PAGAR
            </span>
            <span
              className="block font-mono font-black tabular-nums tracking-tight mt-0.5 text-black"
              style={{ fontSize: `${(17 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : (
          /* Clásico / Compacto (Mockup exacto): Fila destacada con TOTAL A PAGAR */
          <div className="flex justify-between items-baseline py-0.5 font-black text-black">
            <span
              className="uppercase tracking-tight"
              style={{ fontSize: `${(11.5 * totalScale).toFixed(1)}px` }}
            >
              TOTAL A PAGAR:
            </span>
            <span
              className="font-mono tabular-nums tracking-tight text-right text-black"
              style={{ fontSize: `${(15.5 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        )}

        {/* DIVISOR POST TOTAL */}
        {renderDivider(sectionGapClass)}

        {/* ========================================================
            7. PAGO, EFECTIVO RECIBIDO Y CAMBIO
            ======================================================== */}
        {(settings.showPaymentDetails ?? true) && (
          <div className={`${lineSpacingClass} ${sectionGapClass}`} style={{ fontSize: smallFontSize }}>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-800">Método de Pago:</span>
              <span className="font-bold uppercase font-mono text-black">
                {data.paymentMethod || 'EFECTIVO'}
              </span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-slate-800">Efectivo Recibido:</span>
              <span className="tabular-nums font-mono font-medium text-black">
                {formatCurrency(totals.pagado, currencySymbol)}
              </span>
            </div>

            {(settings.showChange ?? true) && (
              <div className="flex justify-between items-baseline">
                <span className="text-slate-800 font-bold">Cambio:</span>
                <span className="font-bold font-mono tabular-nums text-black">
                  {formatCurrency(totals.cambio, currencySymbol)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================
          8. MENSAJES AL PIE, POLÍTICAS Y NOTA DGII
          ======================================================== */}
      {(settings.showFooter ?? true) && (
        <div
          className="thermal-invoice-footer"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          {renderDivider(sectionGapClass)}

          <div className="text-center space-y-1 my-1">
            {(settings.showFooterMessage ?? true) && (
              <p
                className="italic font-medium leading-tight text-slate-800"
                style={{ fontSize: smallFontSize }}
              >
                {settings.footerMessage || '¡Gracias por preferirnos! Conserve este comprobante para cualquier reclamación.'}
              </p>
            )}

            {(settings.showTerms ?? true) && settings.termsAndConditions && (
              <p
                className="leading-tight text-slate-600 max-w-[95%] mx-auto"
                style={{ fontSize: microFontSize }}
              >
                {settings.termsAndConditions}
              </p>
            )}

            {(settings.showDgiiLegend ?? true) && settings.dgiiNotice && (
              <p
                className="leading-tight text-slate-500 font-mono text-center pt-0.5"
                style={{ fontSize: microFontSize }}
              >
                {settings.dgiiNotice}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          9. CÓDIGO DE BARRAS CODE 128 (OPCIONAL)
          ======================================================== */}
      {settings.showBarcode && invoiceNumber && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          {renderDivider(sectionGapClass)}
          <InvoiceBarcode value={invoiceNumber} width={activeWidth} />
        </div>
      )}

      {/* ========================================================
          10. LÍNEAS DE FIRMAS DOBLES (Firma Cajero / Firma Cliente)
          ======================================================== */}
      {(settings.showSignatureLine ?? true) && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          {renderDivider(sectionGapClass)}
          <div className="pt-4 pb-1">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="border-b border-black w-full mb-1" />
                <span className="font-bold text-[9px] block text-black">Firma Cajero</span>
              </div>
              <div>
                <div className="border-b border-black w-full mb-1" />
                <span className="font-bold text-[9px] block text-black">Firma Cliente</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          11. PIE DE SISTEMA Y TEXTO DE COPIA
          ======================================================== */}
      <div
        className="text-center pt-2 font-mono text-slate-500 select-none"
        style={{ fontSize: microFontSize, breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {settings.copyText ? (
          <span className="block font-bold text-black uppercase mb-0.5">{settings.copyText}</span>
        ) : null}
        <span>Sistema Mercato POS</span>
      </div>

      {/* Avance final para corte de papel */}
      {settings.feedLines > 0 && (
        <div
          style={{
            height: `${Math.min(shouldSavePaper ? 1 : 6, settings.feedLines) * 4}px`,
          }}
        />
      )}
    </div>
  );
};

export default ThermalInvoice;