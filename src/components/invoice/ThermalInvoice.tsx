import React, { useMemo } from 'react';
import type { InvoiceData, InvoiceSettings, PaperWidth } from '@/types/invoice';
import {
  formatCurrency,
  formatDate,
  formatTime,
  wrapText,
} from '@/utils/invoiceFormat';
import InvoiceBarcode from './InvoiceBarcode';

export interface ThermalInvoiceProps {
  data: InvoiceData;
  settings: InvoiceSettings;
  width?: PaperWidth;
  logoUrl?: string | null;
  className?: string;
}

export const ThermalInvoice: React.FC<ThermalInvoiceProps> = ({
  data,
  settings,
  width,
  logoUrl,
  className = '',
}) => {
  // Ancho efectivo: prop width tiene prioridad, luego settings.paperWidth, default 80
  const activeWidth: PaperWidth = width ?? settings.paperWidth ?? 80;
  const is50mm = activeWidth === 50;
  const is58mm = activeWidth === 58;
  const isNarrow = is50mm || is58mm;

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

  // Dimensiones físicas del cabezal térmico real para evitar que nada se corte:
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

  // Tamaño de fuente base
  const isLargeFont = settings.fontSizeOption === 'large';
  const baseFontSize = isLargeFont ? '10.5px' : '9.5px';
  const smallFontSize = isLargeFont ? '9px' : '8px';
  const microFontSize = isLargeFont ? '8px' : '7px';

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

  return (
    <div
      className={`thermal-invoice-printable ${printableWidthClass} bg-white text-black select-none leading-tight ${className}`}
      style={{
        width: containerWidthMm,
        maxWidth: containerWidthMm,
        minWidth: containerWidthMm,
        margin: '0 auto',
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingTop: '4px',
        paddingBottom: '8px',
        color: '#000000',
        backgroundColor: '#ffffff',
        fontFamily: "'DejaVu Sans Mono', 'Courier New', Courier, monospace",
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
          a) ENCABEZADO CENTRADO: Logo, Negocio, RNC, Dirección, Tel
          ======================================================== */}
      <div
        className="thermal-invoice-header text-center space-y-0.5"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* LOGO: Imagen o inicial en círculo negro */}
        {settings.showLogo && (
          <div className="flex justify-center pb-1">
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt={settings.companyName || 'Logo'}
                className="object-contain block"
                style={{
                  maxHeight: isNarrow ? '34px' : '44px',
                  maxWidth: '100%',
                  filter: 'grayscale(100%) contrast(200%)',
                }}
              />
            ) : (
              <div
                className="rounded-full bg-black text-white font-sans font-black flex items-center justify-center select-none"
                style={{
                  width: isNarrow ? '30px' : '36px',
                  height: isNarrow ? '30px' : '36px',
                  fontSize: isNarrow ? '13px' : '16px',
                }}
                aria-label="Inicial de la empresa"
              >
                {(settings.companyName || 'M').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* NOMBRE DEL NEGOCIO (Sans-serif negrita, grande, hasta 2 líneas) */}
        <h1
          className="font-sans font-black text-black uppercase tracking-tight text-center leading-tight mx-auto"
          style={{
            fontSize: isNarrow ? '11.5px' : '13.5px',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {settings.companyName || 'MERCATO SRL'}
        </h1>

        {/* Eslogan si existe */}
        {settings.showSlogan && settings.customSlogan && (
          <p
            className="italic text-black font-sans leading-tight text-center"
            style={{ fontSize: microFontSize }}
          >
            "{settings.customSlogan}"
          </p>
        )}

        {/* RNC, Dirección, Teléfono, Sitio Web (monoespaciado pequeño) */}
        <div className="space-y-0.5 pt-0.5" style={{ fontSize: smallFontSize }}>
          {settings.companyRnc && (
            <p className="leading-tight">
              RNC: <span className="font-bold">{settings.companyRnc}</span>
            </p>
          )}
          {settings.companyAddress && (
            <p className="leading-tight break-words">{settings.companyAddress}</p>
          )}
          {settings.companyPhone && (
            <p className="leading-tight">Tel: {settings.companyPhone}</p>
          )}
          {settings.companyWebsite && (
            <p className="leading-tight lowercase">{settings.companyWebsite}</p>
          )}
        </div>
      </div>

      {/* ========================================================
          b) LÍNEA PUNTEADA, TÍTULO EN NEGRITA, LÍNEA PUNTEADA
          ======================================================== */}
      <div className="my-1 border-b border-dotted border-black" />
      <div
        className="text-center py-0.5"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <span
          className="font-sans font-bold uppercase tracking-wider text-black block"
          style={{ fontSize: isNarrow ? '10px' : '11px' }}
        >
          {receiptTitle}
        </span>
      </div>
      <div className="my-1 border-b border-dotted border-black" />

      {/* ========================================================
          c) DATOS EN FILAS (Etiqueta izquierda · Valor derecha)
          ======================================================== */}
      <div
        className="space-y-0.5"
        style={{
          fontSize: smallFontSize,
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        {/* NCF si está habilitado */}
        {settings.showNcf && ncfValue && (
          <div className="flex justify-between items-baseline gap-1">
            <span className="shrink-0">NCF:</span>
            <span className="font-bold text-right truncate">{ncfValue}</span>
          </div>
        )}

        {/* Factura No. */}
        <div className="flex justify-between items-baseline gap-1">
          <span className="shrink-0">Factura No.:</span>
          <span className="font-bold text-right truncate">{invoiceNumber}</span>
        </div>

        {/* Fecha y Hora */}
        <div className="flex justify-between items-baseline gap-1">
          <span className="shrink-0">Fecha:</span>
          <span className="text-right">{formattedDate}</span>
        </div>
        <div className="flex justify-between items-baseline gap-1">
          <span className="shrink-0">Hora:</span>
          <span className="text-right">{formattedTime}</span>
        </div>

        {/* Cajero */}
        {settings.showCashier && cashierName && (
          <div className="flex justify-between items-baseline gap-1">
            <span className="shrink-0">Cajero:</span>
            <span className="text-right truncate max-w-[65%]">{cashierName}</span>
          </div>
        )}

        {/* Cliente */}
        {settings.showCustomer && customerName && (
          <div className="flex justify-between items-baseline gap-1">
            <span className="shrink-0">Cliente:</span>
            <span className="text-right truncate max-w-[65%]">{customerName}</span>
          </div>
        )}

        {/* RNC Cliente si existe */}
        {settings.showCustomer && (data.clienteRnc || data.customerRnc) && (
          <div className="flex justify-between items-baseline gap-1">
            <span className="shrink-0">RNC Cliente:</span>
            <span className="text-right font-mono font-bold truncate max-w-[65%]">
              {data.clienteRnc || data.customerRnc}
            </span>
          </div>
        )}
      </div>

      {/* ========================================================
          d) LÍNEA DOBLE (gruesa y fina)
          ======================================================== */}
      <div
        className="my-1.5"
        style={{
          borderBottom: '3px double #000000',
        }}
      />

      {/* ========================================================
          e) DETALLE DE ARTÍCULOS
             - 80 mm: CANT | DESCRIPCIÓN | PRECIO | TOTAL
             - 50 mm / 58 mm: DESCRIPCIÓN | TOTAL en 2 líneas
          ======================================================== */}
      <div className="pt-0.5 pb-1">
        {!isNarrow ? (
          /* -------- Formato 80 mm: Columnas estándar ajustadas -------- */
          <div>
            <div
              className="flex justify-between items-center pb-1 font-bold border-b border-black uppercase tracking-wider"
              style={{
                fontSize: smallFontSize,
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              <span className="w-7 shrink-0 text-left">CANT</span>
              <span className="flex-1 px-1 text-left">DESCRIPCIÓN</span>
              <span className="w-14 shrink-0 text-right">PRECIO</span>
              <span className="w-14 shrink-0 text-right">TOTAL</span>
            </div>

            <div className="divide-y divide-dotted divide-black/30">
              {(data.items || []).map((item, idx) => {
                const qty = item.cantidad ?? item.qty ?? 1;
                const desc = item.descripcion || item.name || 'Artículo';
                const price = item.precioUnitario ?? item.price ?? 0;
                const totalItem = item.total ?? item.subtotal ?? qty * price;
                const descLines = wrapText(desc, 22);

                return (
                  <div
                    key={idx}
                    className="thermal-invoice-item py-1 flex items-start gap-1"
                    style={{
                      fontSize: smallFontSize,
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <span className="w-7 shrink-0 text-left pt-0.5">{qty}</span>
                    <div className="flex-1 px-1 break-words leading-tight">
                      {descLines.length > 0 ? (
                        descLines.map((line, lIdx) => (
                          <div key={lIdx} className="leading-tight">
                            {line}
                          </div>
                        ))
                      ) : (
                        <div>{desc}</div>
                      )}
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums pt-0.5">
                      {formatCurrency(price, '')}
                    </span>
                    <span className="w-14 shrink-0 text-right font-bold tabular-nums pt-0.5">
                      {formatCurrency(totalItem, '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* -------- Formato 50 mm / 58 mm: Dos líneas por ítem -------- */
          <div>
            <div
              className="flex justify-between items-center pb-1 font-bold border-b border-black uppercase tracking-wider"
              style={{
                fontSize: microFontSize,
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              <span>DESCRIPCIÓN</span>
              <span>TOTAL</span>
            </div>

            <div className="divide-y divide-dotted divide-black/30">
              {(data.items || []).map((item, idx) => {
                const qty = item.cantidad ?? item.qty ?? 1;
                const desc = item.descripcion || item.name || 'Artículo';
                const price = item.precioUnitario ?? item.price ?? 0;
                const totalItem = item.total ?? item.subtotal ?? qty * price;

                return (
                  <div
                    key={idx}
                    className="thermal-invoice-item py-1 space-y-0.5"
                    style={{
                      fontSize: smallFontSize,
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <div className="font-bold leading-tight break-words">{desc}</div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[7.5px] leading-none">
                        {qty} x {formatCurrency(price, currencySymbol)}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(totalItem, '')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          f) LÍNEA GRUESA, LUEGO SUBTOTAL E ITBIS (con porcentaje)
             Y TOTAL DESTACADO (4 px)
          ======================================================== */}
      <div
        className="thermal-invoice-totals"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div className="border-t-2 border-black my-1" />
        <div className="space-y-0.5" style={{ fontSize: smallFontSize }}>
          <div className="flex justify-between items-baseline">
            <span>Subtotal:</span>
            <span className="tabular-nums font-semibold">
              {formatCurrency(totals.subtotal, currencySymbol)}
            </span>
          </div>

          {typeof data.discount === 'number' && data.discount > 0 && (
            <div className="flex justify-between items-baseline">
              <span>Descuento:</span>
              <span className="tabular-nums font-bold">
                -{formatCurrency(data.discount, currencySymbol)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline">
            <span>ITBIS ({settings.itbisPercent ?? 18}%):</span>
            <span className="tabular-nums font-semibold">
              {formatCurrency(totals.itbis, currencySymbol)}
            </span>
          </div>
        </div>

        {/* ========================================================
            g) TOTAL DENTRO DE UN RECUADRO DE BORDE GRUESO (4 px)
               - 80 mm: Una sola línea "TOTAL" y monto grande
               - 50 mm / 58 mm: "TOTAL A PAGAR" y monto centrado abajo
            ======================================================== */}
        <div
          className="my-1.5 p-1.5 text-black"
          style={{
            border: '4px solid #000000',
          }}
        >
          {!isNarrow ? (
            <div className="flex justify-between items-center font-sans">
              <span className="font-black text-sm tracking-wide">TOTAL</span>
              <span className="font-black text-lg sm:text-xl tracking-tight tabular-nums">
                {formatCurrency(totals.total, currencySymbol)}
              </span>
            </div>
          ) : (
            <div className="text-center font-sans">
              <span className="block font-bold uppercase text-[8.5px] tracking-wider leading-none">
                TOTAL A PAGAR
              </span>
              <span className="block font-black text-base tracking-tight tabular-nums mt-0.5 leading-none">
                {formatCurrency(totals.total, currencySymbol)}
              </span>
            </div>
          )}
        </div>

        {/* ========================================================
            h) EFECTIVO / PAGADO, CAMBIO Y NÚMERO DE ARTÍCULOS
            ======================================================== */}
        <div className="space-y-0.5" style={{ fontSize: smallFontSize }}>
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
            <span className="tabular-nums">
              {formatCurrency(totals.pagado, currencySymbol)}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="font-bold">Cambio:</span>
            <span className="font-bold tabular-nums">
              {formatCurrency(totals.cambio, currencySymbol)}
            </span>
          </div>

          <div className="pt-0.5 text-right" style={{ fontSize: microFontSize }}>
            <span>Artículos: {totals.totalArticulos}</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          i & j) CÓDIGO DE BARRAS Y PIE DE PÁGINA
          ======================================================== */}
      <div
        className="thermal-invoice-footer"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Código de barras Code 128 */}
        {settings.showBarcode && invoiceNumber && (
          <>
            <div className="my-1.5 border-b border-dotted border-black" />
            <InvoiceBarcode value={invoiceNumber} width={activeWidth} />
          </>
        )}

        {/* Mensajes al pie y texto de copia */}
        {settings.showFooter && (
          <>
            <div className="my-1.5 border-b border-dotted border-black" />
            <div className="text-center space-y-0.5">
              <p
                className="font-bold text-black uppercase"
                style={{ fontSize: smallFontSize }}
              >
                {settings.footerMessage || '¡GRACIAS POR SU COMPRA!'}
              </p>

              {settings.termsAndConditions && (
                <p
                  className="leading-tight text-black max-w-[95%] mx-auto"
                  style={{ fontSize: microFontSize }}
                >
                  {settings.termsAndConditions}
                </p>
              )}

              {settings.companyWebsite && (
                <p
                  className="leading-tight text-black font-mono lowercase"
                  style={{ fontSize: microFontSize }}
                >
                  {settings.companyWebsite}
                </p>
              )}

              {/* Texto de Copia Configurable */}
              <p
                className="font-black text-black pt-1 uppercase tracking-wider"
                style={{ fontSize: smallFontSize }}
              >
                {settings.copyText || '*** COPIA CLIENTE ***'}
              </p>
            </div>
          </>
        )}

        {/* Avance final para corte de papel si está configurado */}
        {settings.feedLines > 0 && (
          <div style={{ height: `${Math.min(6, settings.feedLines) * 4}px` }} />
        )}
      </div>
    </div>
  );
};

export default ThermalInvoice;
