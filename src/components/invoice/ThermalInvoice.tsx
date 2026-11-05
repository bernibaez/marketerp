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
    return 'FACTURA DE CONSUMO';
  }, [data.ncf, data.ncfTypeName]);

  const invoiceNumber = data.numero || data.invoiceNumber || '000000';
  const cashierName = data.cajero || data.cashier;
  const customerName = data.cliente || data.customerName;
  const ncfValue = data.ncf || settings.ncfSequence;

  // Tipografía según estilo
  const fontFamilyStyle = useMemo(() => {
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
  }, [styleVariant]);

  // Espaciado vertical adaptable: si hay pocos productos o modo compacto, se reducen márgenes
  const sectionGapClass = shouldSavePaper ? 'my-0.5' : 'my-1.5';
  const lineSpacingClass = shouldSavePaper ? 'space-y-0' : 'space-y-0.5';

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
          1. ENCABEZADO SEGÚN ESTILO
          ======================================================== */}
      <div className={`thermal-invoice-header ${styleVariant === 'minimalista' ? 'text-left' : 'text-center'}`}>
        {/* MODERNO: Banner en bloque negro superior */}
        {styleVariant === 'moderno' && (
          <div className="bg-black text-white px-2 py-2 mb-1.5 text-center -mx-1">
            <h1
              className="font-black uppercase tracking-wider leading-tight text-white"
              style={{ fontSize: `${(12.5 * totalScale).toFixed(1)}px` }}
            >
              {settings.companyName || 'MINI MARKET LA ESQUINA'}
            </h1>
            <p
              className="text-slate-200 tracking-widest uppercase mt-0.5"
              style={{ fontSize: microFontSize }}
            >
              {settings.customSlogan || 'COLMADO · SUPERMERCADO'}
            </p>
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

        {/* CLÁSICO: Logotipo o círculo con inicial */}
        {styleVariant === 'clasico' && settings.showLogo && (
          <div className="flex justify-center mb-1">
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt="Logo"
                className="object-contain max-h-11 max-w-[85%] filter grayscale contrast-200"
              />
            ) : (
              <div
                className="rounded-full bg-black text-white font-sans font-black flex items-center justify-center shadow-xs"
                style={{
                  width: `${(28 * totalScale).toFixed(0)}px`,
                  height: `${(28 * totalScale).toFixed(0)}px`,
                  fontSize: `${(13 * totalScale).toFixed(0)}px`,
                }}
              >
                {(settings.companyName || 'M').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* SUPERMERCADO: Recuadro con borde alrededor del nombre */}
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
            className={`font-black uppercase leading-tight ${
              styleVariant === 'elegante'
                ? 'tracking-[0.15em] font-serif'
                : styleVariant === 'minimalista'
                ? 'tracking-normal text-left font-sans'
                : 'tracking-tight'
            }`}
            style={{ fontSize: `${(12 * totalScale).toFixed(1)}px` }}
          >
            {settings.companyName || 'MINI MARKET LA ESQUINA'}
          </h1>
        ) : null}

        {/* Eslogan secundario (si no es moderno ni está en modo ultra-ahorro de papel para 1 ítem) */}
        {settings.showSlogan && settings.customSlogan && styleVariant !== 'moderno' && (!shouldSavePaper || itemCount > 1) && (
          <p
            className={`text-black leading-tight ${
              styleVariant === 'elegante' ? 'italic font-serif' : ''
            }`}
            style={{ fontSize: microFontSize }}
          >
            {settings.customSlogan}
          </p>
        )}

        {/* Datos fiscales y contacto */}
        <div className={`mt-0.5 ${lineSpacingClass}`} style={{ fontSize: smallFontSize }}>
          {/* COMPACTO: RNC y Teléfono en una sola línea para ahorrar papel */}
          {styleVariant === 'compacto' ? (
            <>
              {settings.showCompanyAddress && settings.companyAddress && (
                <p className="truncate leading-tight">{settings.companyAddress}</p>
              )}
              <p className="leading-tight">
                {settings.showCompanyRnc && settings.companyRnc && `RNC ${settings.companyRnc}`}
                {settings.showCompanyPhone && settings.companyPhone && `  ·  Tel ${settings.companyPhone}`}
              </p>
            </>
          ) : (
            <>
              {settings.showCompanyRnc && settings.companyRnc && (
                <p className="font-mono leading-tight">RNC: {settings.companyRnc}</p>
              )}
              {settings.showCompanyAddress && settings.companyAddress && (
                <p className="leading-tight">{settings.companyAddress}</p>
              )}
              {settings.showCompanyPhone && settings.companyPhone && (
                <p className="leading-tight">Tel: {settings.companyPhone}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Divisor superior según estilo */}
      {styleVariant === 'supermercado' ? (
        <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
          * * * * * * * * * * * * * * * * * * * * * * * * *
        </div>
      ) : styleVariant === 'elegante' ? (
        <div className="flex items-center gap-1 my-1">
          <div className="flex-1 border-b border-black" />
          <span className="text-[10px] leading-none">✦</span>
          <div className="flex-1 border-b border-black" />
        </div>
      ) : styleVariant === 'moderno' ? (
        <div className="my-1 border-b border-black" />
      ) : styleVariant === 'minimalista' ? (
        <div className="my-1 border-b-2 border-black" />
      ) : (
        <div className="my-1 border-b border-dashed border-black" />
      )}

      {/* ========================================================
          2. TÍTULO Y NÚMERO DE FACTURA / NCF
          ======================================================== */}
      {styleVariant === 'minimalista' ? (
        <div className="mb-1 text-left">
          <span
            className="block font-black font-sans uppercase tracking-tight leading-none text-black"
            style={{ fontSize: `${(15 * totalScale).toFixed(1)}px` }}
          >
            Factura
          </span>
        </div>
      ) : styleVariant === 'moderno' ? (
        <div className="border-2 border-black p-1 my-1 text-center font-sans font-black">
          <span className="tracking-wider uppercase" style={{ fontSize: `${(10.5 * totalScale).toFixed(1)}px` }}>
            FACTURA Nº {invoiceNumber}
          </span>
        </div>
      ) : styleVariant === 'elegante' ? (
        <div className="text-center my-0.5">
          <span
            className="font-serif italic font-bold text-black"
            style={{ fontSize: `${(11 * totalScale).toFixed(1)}px` }}
          >
            {receiptTitle}
          </span>
        </div>
      ) : styleVariant === 'supermercado' ? (
        <div className="text-center font-mono font-black my-0.5">
          <span className="tracking-wider" style={{ fontSize: `${(10.5 * totalScale).toFixed(1)}px` }}>
            {receiptTitle}
          </span>
        </div>
      ) : (
        <div className="text-center font-mono font-bold my-0.5">
          <span className="tracking-wide uppercase" style={{ fontSize: `${(10.5 * totalScale).toFixed(1)}px` }}>
            {receiptTitle}
          </span>
        </div>
      )}

      {/* Divisor post-título */}
      {styleVariant === 'supermercado' ? (
        <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
          * * * * * * * * * * * * * * * * * * * * * * * * *
        </div>
      ) : styleVariant === 'elegante' ? (
        <div className="flex items-center gap-1 my-1">
          <div className="flex-1 border-b border-black" />
          <span className="text-[10px] leading-none">✦</span>
          <div className="flex-1 border-b border-black" />
        </div>
      ) : null}

      {/* ========================================================
          3. METADATOS DE VENTA (NCF, Factura, Fecha, Hora, Cajero, Cliente)
          ======================================================== */}
      <div className={`${lineSpacingClass} my-0.5`} style={{ fontSize: smallFontSize }}>
        {/* COMPACTO: En 2 columnas directas para ahorrar papel */}
        {styleVariant === 'compacto' ? (
          <>
            <div className="flex justify-between items-baseline">
              <span>Fact. {invoiceNumber}</span>
              <span>{formattedDate} {formattedTime}</span>
            </div>
            {(settings.showNcf && ncfValue) || (settings.showCashier && cashierName) ? (
              <div className="flex justify-between items-baseline font-bold">
                <span>{settings.showNcf && ncfValue ? `NCF ${ncfValue}` : ''}</span>
                <span>{settings.showCashier && cashierName ? cashierName : ''}</span>
              </div>
            ) : null}
            {settings.showCustomer && customerName && (
              <div className="flex justify-between items-baseline">
                <span className="truncate max-w-[90%]">Cliente: {customerName}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {settings.showNcf && ncfValue && (
              <div className="flex justify-between items-baseline">
                <span className="font-bold">NCF:</span>
                <span className="font-mono font-black">{ncfValue}</span>
              </div>
            )}
            {styleVariant !== 'moderno' && (
              <div className="flex justify-between items-baseline">
                <span>Factura No.:</span>
                <span className="font-mono font-bold">{invoiceNumber}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span>Fecha:</span>
              <span>{formattedDate}</span>
            </div>
            {settings.showIssueTime && formattedTime && (
              <div className="flex justify-between items-baseline">
                <span>Hora:</span>
                <span>{formattedTime}</span>
              </div>
            )}
            {settings.showCashier && cashierName && (
              <div className="flex justify-between items-baseline">
                <span>Cajero:</span>
                <span>{cashierName}</span>
              </div>
            )}
            {settings.showCustomer && customerName && (
              <div className="flex justify-between items-baseline">
                <span>Cliente:</span>
                <span className="truncate max-w-[65%]">{customerName}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Divisor antes de los artículos */}
      {styleVariant === 'supermercado' ? (
        <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
          * * * * * * * * * * * * * * * * * * * * * * * * *
        </div>
      ) : styleVariant === 'moderno' ? (
        /* MODERNO: Franja negra sólida para encabezado de columnas */
        <div className="bg-black text-white px-1.5 py-0.5 my-1 flex justify-between font-bold" style={{ fontSize: microFontSize }}>
          <span className="w-8 text-left">CANT</span>
          <span className="flex-1 text-left px-1">DESCRIPCIÓN</span>
          <span className="w-14 text-right">PRECIO</span>
          <span className="w-14 text-right">TOTAL</span>
        </div>
      ) : styleVariant === 'compacto' ? (
        <div className="my-0.5 border-b border-dashed border-black" />
      ) : styleVariant === 'elegante' ? (
        <>
          <div className="mt-1 border-b-2 border-black" />
          <div className="mb-0.5 border-b border-black" />
          <div className="flex justify-between italic font-serif py-0.5" style={{ fontSize: microFontSize }}>
            <span className="w-7 text-left">Cant.</span>
            <span className="flex-1 text-left px-1">Descripción</span>
            <span className="w-12 text-right">Precio</span>
            <span className="w-14 text-right">Importe</span>
          </div>
          <div className="mb-1 border-b border-black" />
        </>
      ) : styleVariant === 'minimalista' ? (
        <div className="my-1 border-b border-black" />
      ) : (
        <>
          <div className="mt-1 border-b-2 border-black" />
          <div className="mb-0.5 border-b border-black" />
          <div className="flex justify-between font-bold py-0.5" style={{ fontSize: microFontSize }}>
            <span className="w-7 text-left">CANT</span>
            <span className="flex-1 text-left px-1">DESCRIPCIÓN</span>
            <span className="w-12 text-right">PRECIO</span>
            <span className="w-14 text-right">TOTAL</span>
          </div>
          <div className="mb-1 border-b-2 border-black" />
        </>
      )}

      {/* ========================================================
          4. LISTA DE PRODUCTOS / ÍTEMS
          ======================================================== */}
      <div className={shouldSavePaper ? 'space-y-0.5' : 'space-y-1'}>
        {itemsList.map((item, idx) => {
          const qty = item.cantidad ?? item.qty ?? 1;
          const name = item.descripcion ?? item.name ?? 'Producto';
          const price = item.precioUnitario ?? item.price ?? 0;
          const total = item.total ?? item.subtotal ?? qty * price;
          const indexFormatted = String(idx + 1).padStart(3, '0');

          // COMPACTO: Formato en 1 sola línea horizontal (ej: 2x Café Molido 500g @385.00  ... 770.00)
          if (styleVariant === 'compacto') {
            return (
              <div key={`item-${idx}`} className="flex justify-between items-baseline thermal-invoice-item">
                <span className="truncate pr-1">
                  <span className="font-bold">{qty}x</span> {name} <span className="font-normal text-slate-700">@{formatCurrency(price, '')}</span>
                </span>
                <span className="font-bold font-mono tabular-nums text-right flex-shrink-0">
                  {formatCurrency(total, '')}
                </span>
              </div>
            );
          }

          // SUPERMERCADO: Número secuencial 001 + 2 líneas
          if (styleVariant === 'supermercado') {
            return (
              <div key={`item-${idx}`} className="thermal-invoice-item text-xs">
                <p className="font-bold uppercase truncate">
                  {indexFormatted} {name}
                </p>
                <div className="flex justify-between items-baseline pl-4 font-mono">
                  <span>{qty} X {formatCurrency(price, '')}</span>
                  <span className="font-bold tabular-nums">{formatCurrency(total, '')}</span>
                </div>
              </div>
            );
          }

          // MINIMALISTA: Nombre en negrita en línea 1, cantidad y total en línea 2
          if (styleVariant === 'minimalista') {
            return (
              <div key={`item-${idx}`} className="thermal-invoice-item">
                <p className="font-bold font-sans truncate">{name}</p>
                <div className="flex justify-between items-baseline font-sans" style={{ fontSize: smallFontSize }}>
                  <span className="text-slate-800">{qty} × {formatCurrency(price, '')}</span>
                  <span className="font-bold tabular-nums">{formatCurrency(total, '')}</span>
                </div>
              </div>
            );
          }

          // CLÁSICO, MODERNO, ELEGANTE: Columnas alineadas Cant / Nombre / Precio / Total
          return (
            <div key={`item-${idx}`} className="thermal-invoice-item">
              <div className="flex justify-between items-baseline">
                <span className="w-7 text-left font-bold">{qty}</span>
                <span className="flex-1 text-left px-1 truncate font-medium">{name}</span>
                <span className="w-12 text-right tabular-nums text-slate-800 font-mono" style={{ fontSize: smallFontSize }}>
                  {formatCurrency(price, '')}
                </span>
                <span className="w-14 text-right font-bold font-mono tabular-nums">
                  {formatCurrency(total, '')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divisor post-artículos */}
      {styleVariant === 'supermercado' ? (
        <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
          * * * * * * * * * * * * * * * * * * * * * * * * *
        </div>
      ) : styleVariant === 'elegante' ? (
        <div className="my-1 border-b border-black" />
      ) : styleVariant === 'moderno' ? (
        <div className="my-1 border-b border-black" />
      ) : styleVariant === 'minimalista' ? (
        <div className="my-1 border-b border-black" />
      ) : (
        <div className="my-1 border-b-2 border-black" />
      )}

      {/* ========================================================
          5. TOTALES, SUB-TOTAL, ITBIS Y DESCUENTO
          ======================================================== */}
      <div className="thermal-invoice-totals">
        <div className={`${lineSpacingClass} my-0.5`} style={{ fontSize: smallFontSize }}>
          {styleVariant === 'supermercado' && (
            <div className="flex justify-between items-baseline font-mono">
              <span>TOTAL ARTÍCULOS</span>
              <span className="font-bold font-mono">{totals.totalArticulos}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline">
            <span>Subtotal:</span>
            <span className="tabular-nums font-mono font-medium">
              {formatCurrency(totals.subtotal, currencySymbol)}
            </span>
          </div>

          {Number(data.discount || 0) > 0 && (
            <div className="flex justify-between items-baseline">
              <span>Descuento:</span>
              <span className="tabular-nums font-mono font-bold text-slate-800">
                -{formatCurrency(data.discount, currencySymbol)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline">
            <span>ITBIS ({settings.itbisPercent ?? 18}%):</span>
            <span className="tabular-nums font-mono">
              {formatCurrency(totals.itbis, currencySymbol)}
            </span>
          </div>
        </div>

        {/* Recuadro de TOTAL según el estilo */}
        {styleVariant === 'moderno' ? (
          /* MODERNO: Bloque negro con texto blanco */
          <div className="bg-black text-white p-2 my-1 flex justify-between items-center -mx-1">
            <span
              className="font-black uppercase tracking-wider text-white font-sans"
              style={{ fontSize: `${(12 * totalScale).toFixed(1)}px` }}
            >
              TOTAL
            </span>
            <span
              className="font-black font-mono tracking-tight text-white tabular-nums"
              style={{ fontSize: `${(16 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : styleVariant === 'supermercado' ? (
          /* SUPERMERCADO: Gran texto centrado */
          <>
            <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
              * * * * * * * * * * * * * * * * * * * * * * * * *
            </div>
            <div className="text-center my-1">
              <span className="block font-mono font-bold tracking-wider uppercase text-xs">
                TOTAL A PAGAR
              </span>
              <span
                className="block font-mono font-black tabular-nums tracking-tight mt-0.5"
                style={{ fontSize: `${(18 * totalScale).toFixed(1)}px` }}
              >
                {formatCurrency(totals.total, currencySymbol)}
              </span>
            </div>
            <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
              * * * * * * * * * * * * * * * * * * * * * * * * *
            </div>
          </>
        ) : styleVariant === 'compacto' ? (
          /* COMPACTO: Doble barra superior e inferior (ahorra altura) */
          <div className="border-y-4 border-black py-1 my-1 flex justify-between items-center">
            <span
              className="font-black uppercase font-sans tracking-wide"
              style={{ fontSize: `${(11 * totalScale).toFixed(1)}px` }}
            >
              TOTAL
            </span>
            <span
              className="font-black font-mono tabular-nums tracking-tight"
              style={{ fontSize: `${(15 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : styleVariant === 'minimalista' ? (
          /* MINIMALISTA: Barra superior de 4px con Total y valor a la derecha */
          <div className="border-t-4 border-black pt-1.5 pb-0.5 my-1 flex justify-between items-baseline font-sans">
            <span
              className="font-normal uppercase tracking-wide text-xs"
              style={{ fontSize: `${(11 * totalScale).toFixed(1)}px` }}
            >
              Total
            </span>
            <span
              className="font-black tracking-tight tabular-nums"
              style={{ fontSize: `${(17 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : styleVariant === 'elegante' ? (
          /* ELEGANTE: Enmarcado fino doble serif */
          <div className="border-y-2 border-black py-1 my-1 flex justify-between items-baseline font-serif">
            <span
              className="font-bold uppercase tracking-wider"
              style={{ fontSize: `${(12 * totalScale).toFixed(1)}px` }}
            >
              Total
            </span>
            <span
              className="font-bold font-mono tracking-tight tabular-nums"
              style={{ fontSize: `${(16 * totalScale).toFixed(1)}px` }}
            >
              {formatCurrency(totals.total, currencySymbol)}
            </span>
          </div>
        ) : (
          /* CLÁSICO: Recuadro con borde grueso de 4px */
          <div
            className="my-1.5 p-1.5 text-black"
            style={{ border: '4px solid #000000' }}
          >
            {!isNarrow ? (
              <div className="flex justify-between items-center font-sans">
                <span
                  className="font-black tracking-wide"
                  style={{ fontSize: `${(13.5 * totalScale).toFixed(1)}px` }}
                >
                  TOTAL
                </span>
                <span
                  className="font-black font-mono tracking-tight tabular-nums"
                  style={{ fontSize: `${(18 * totalScale).toFixed(1)}px` }}
                >
                  {formatCurrency(totals.total, currencySymbol)}
                </span>
              </div>
            ) : (
              <div className="text-center font-sans">
                <span
                  className="block font-bold uppercase tracking-wider leading-none"
                  style={{ fontSize: `${(8.5 * totalScale).toFixed(1)}px` }}
                >
                  TOTAL
                </span>
                <span
                  className="block font-black font-mono tracking-tight tabular-nums mt-0.5 leading-none"
                  style={{ fontSize: `${(15 * totalScale).toFixed(1)}px` }}
                >
                  {formatCurrency(totals.total, currencySymbol)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Pago y Cambio */}
        <div className={`${lineSpacingClass} my-0.5`} style={{ fontSize: smallFontSize }}>
          {styleVariant === 'compacto' ? (
            <div className="flex justify-between items-baseline">
              <span>Efect. {formatCurrency(totals.pagado, '')}</span>
              <span className="font-bold">Cambio {formatCurrency(totals.cambio, '')}</span>
            </div>
          ) : (
            <>
              {data.paymentMethod && (
                <div className="flex justify-between items-baseline">
                  <span>Método de pago:</span>
                  <span className="font-semibold uppercase truncate max-w-[65%]">
                    {data.paymentMethod}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span>Efectivo / Pagado:</span>
                <span className="tabular-nums font-mono font-medium">
                  {formatCurrency(totals.pagado, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-bold">Cambio:</span>
                <span className="font-bold font-mono tabular-nums">
                  {formatCurrency(totals.cambio, currencySymbol)}
                </span>
              </div>
              {styleVariant !== 'supermercado' && (
                <div className="pt-0.5 text-right text-slate-700" style={{ fontSize: microFontSize }}>
                  <span>Artículos: {totals.totalArticulos}</span>
                </div>
              )}
            </>
          )}

          {/* SUPERMERCADO: Bloque especial de ahorro y fidelidad si aplica */}
          {styleVariant === 'supermercado' && Number(data.discount || 0) > 0 && (
            <div className="border border-black p-1 text-center font-mono my-1 font-bold" style={{ fontSize: smallFontSize }}>
              USTED AHORRÓ: {formatCurrency(data.discount, currencySymbol)}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          6. CÓDIGO DE BARRAS Y PIE DE PÁGINA
          ======================================================== */}
      <div
        className="thermal-invoice-footer"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Código de barras Code 128 */}
        {settings.showBarcode && invoiceNumber && (
          <>
            {styleVariant === 'supermercado' ? (
              <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
                * * * * * * * * * * * * * * * * * * * * * * * * *
              </div>
            ) : styleVariant === 'elegante' ? (
              <div className="my-1 border-b border-black" />
            ) : (
              <div className="my-1 border-b border-dashed border-black" />
            )}

            <InvoiceBarcode value={invoiceNumber} width={activeWidth} />
          </>
        )}

        {/* Mensajes al pie y agradecimientos */}
        {settings.showFooter && (
          <>
            {styleVariant === 'moderno' ? (
              /* MODERNO: Franja negra inferior */
              <div className="bg-black text-white p-2 my-1.5 text-center -mx-1">
                <p className="font-bold text-white uppercase text-xs">
                  {settings.footerMessage || '¡GRACIAS POR SU COMPRA!'}
                </p>
                <p className="text-slate-300 mt-0.5" style={{ fontSize: microFontSize }}>
                  {settings.termsAndConditions || 'Cambios en 48 horas con esta factura'}
                </p>
              </div>
            ) : styleVariant === 'supermercado' ? (
              /* SUPERMERCADO: Asteriscos y mayúsculas */
              <>
                <div className="text-center font-mono my-0.5 text-black overflow-hidden select-none" style={{ fontSize: microFontSize }}>
                  * * * * * * * * * * * * * * * * * * * * * * * * *
                </div>
                <div className="text-center font-mono space-y-0.5">
                  <p className="font-black uppercase text-xs">
                    {settings.footerMessage || '¡GRACIAS POR SU COMPRA!'}
                  </p>
                  <p className="font-bold text-xs">VUELVA PRONTO</p>
                </div>
              </>
            ) : styleVariant === 'elegante' ? (
              /* ELEGANTE: Cursivas y rombos */
              <>
                <div className="flex items-center gap-1 my-1">
                  <div className="flex-1 border-b border-black" />
                  <span className="text-[10px] leading-none">✦</span>
                  <div className="flex-1 border-b border-black" />
                </div>
                <div className="text-center font-serif space-y-0.5">
                  <p className="font-bold italic text-xs">
                    {settings.footerMessage || 'Gracias por elegirnos'}
                  </p>
                  {settings.termsAndConditions && (!shouldSavePaper || itemCount > 1) && (
                    <p className="italic leading-tight text-slate-800" style={{ fontSize: microFontSize }}>
                      {settings.termsAndConditions}
                    </p>
                  )}
                  <p className="pt-1 text-[10px]">✦  ✦  ✦</p>
                </div>
              </>
            ) : styleVariant === 'minimalista' ? (
              /* MINIMALISTA: Alineado a la izquierda */
              <div className="text-left font-sans pt-1 space-y-0.5">
                <p className="font-bold text-xs">
                  {settings.footerMessage || 'Gracias por su compra.'}
                </p>
                {settings.termsAndConditions && (!shouldSavePaper || itemCount > 1) && (
                  <p className="leading-tight text-slate-700" style={{ fontSize: microFontSize }}>
                    {settings.termsAndConditions}
                  </p>
                )}
                {settings.companyWebsite && (!shouldSavePaper || itemCount > 1) && (
                  <p className="leading-tight text-slate-500 font-mono" style={{ fontSize: microFontSize }}>
                    {settings.companyWebsite}
                  </p>
                )}
              </div>
            ) : (
              /* CLÁSICO / COMPACTO */
              <>
                <div className="my-1 border-b border-dashed border-black" />
                <div className="text-center space-y-0.5">
                  <p className="font-bold text-black uppercase" style={{ fontSize: smallFontSize }}>
                    {settings.footerMessage || '¡GRACIAS POR SU COMPRA!'}
                  </p>

                  {settings.termsAndConditions && (!shouldSavePaper || itemCount > 1) && (
                    <p className="leading-tight text-black max-w-[95%] mx-auto" style={{ fontSize: microFontSize }}>
                      {settings.termsAndConditions}
                    </p>
                  )}

                  {settings.companyWebsite && (!shouldSavePaper || itemCount > 1) && (
                    <p className="leading-tight text-black font-mono lowercase" style={{ fontSize: microFontSize }}>
                      {settings.companyWebsite}
                    </p>
                  )}

                  {/* Texto de Copia Configurable */}
                  <p className="font-black text-black pt-0.5 uppercase tracking-wider" style={{ fontSize: smallFontSize }}>
                    {settings.copyText || '*** COPIA CLIENTE ***'}
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* Avance final para corte de papel si está configurado (si ahorramos papel, se reduce a max 1 línea) */}
        {settings.feedLines > 0 && (
          <div
            style={{
              height: `${Math.min(shouldSavePaper ? 1 : 6, settings.feedLines) * 4}px`,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ThermalInvoice;
