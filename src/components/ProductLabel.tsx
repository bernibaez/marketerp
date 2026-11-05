import React from 'react';
import type { Product } from '@/lib/initialProducts';
import type { BarcodeFormat, LabelSize } from '@/types/barcode';
import BarcodeSvg from './BarcodeSvg';
import { isBarcodeOverflowing, normalizeBarcode } from '@/utils/barcode';

export interface ProductLabelProps {
  product: Product;
  format: BarcodeFormat;
  size: LabelSize;
  customWidthMm?: number;
  customHeightMm?: number;
  businessName?: string;
  currencySymbol?: string;
  showName?: boolean;
  showPrice?: boolean;
  showSku?: boolean;
  showBarcodeText?: boolean;
  showBusinessName?: boolean;
  orientation?: 'portrait' | 'landscape';
  rotation?: 0 | 90 | 180 | 270;
  isPrintMode?: boolean;
  scale?: number; // Factor de escala para pantalla (1.0 = escala real a ~3.78 px por mm)
  className?: string;
}

export default function ProductLabel({
  product,
  format,
  size,
  customWidthMm = 50,
  customHeightMm = 30,
  businessName = '',
  currencySymbol = 'RD$',
  showName = true,
  showPrice = true,
  showSku = true,
  showBarcodeText = true,
  showBusinessName = true,
  orientation = 'landscape',
  rotation,
  isPrintMode = false,
  scale = 1,
  className = '',
}: ProductLabelProps) {
  // Rotación efectiva: prioridad a prop rotation (0, 90, 180, 270), fallback a orientation (portrait => 90, landscape => 0)
  const effectiveRotation: 0 | 90 | 180 | 270 =
    rotation !== undefined
      ? rotation
      : orientation === 'portrait'
        ? 90
        : 0;

  const isRotated90or270 = effectiveRotation === 90 || effectiveRotation === 270;

  // Dimensiones base naturales de la etiqueta antes de girar (ej. 50mm ancho x 30mm alto)
  const baseWidth = size.id === 'custom' ? customWidthMm : size.widthMm;
  const baseHeight = size.id === 'custom' ? customHeightMm : size.heightMm;

  // En etiquetas individuales estándar (50x30, 40x25), el diseño nativo es ancho (max) x alto (min)
  const naturalWidthMm = size.isContinuous
    ? baseWidth
    : Math.max(baseWidth, baseHeight);
  const naturalHeightMm = size.isContinuous
    ? Math.min(baseWidth, baseHeight)
    : Math.min(baseWidth, baseHeight);

  // Dimensiones exteriores del contenedor según si está girado 90°/270° o no
  const outerWidthMm = isRotated90or270 && !size.isContinuous
    ? naturalHeightMm
    : naturalWidthMm;
  const outerHeightMm = isRotated90or270 && !size.isContinuous
    ? naturalWidthMm
    : naturalHeightMm;

  // Código a renderizar (prioriza código de barras, luego sku, luego id)
  const rawCode = (product.barcode || product.sku || product.id || '').trim();

  // Alerta de desbordamiento en etiquetas pequeñas según el ancho nativo donde se dibuja el código
  const isOverflowing = isBarcodeOverflowing(format, rawCode, naturalWidthMm);

  // Dimensiones dinámicas del código de barras calibradas para no exceder los límites físicos de la etiqueta
  const barcodeHeight =
    naturalHeightMm <= 26
      ? 20
      : naturalHeightMm <= 32
        ? 24
        : naturalHeightMm <= 42
          ? 32
          : 42;

  const barcodeModuleWidth =
    naturalWidthMm < 45 ? 1.2 : naturalWidthMm < 60 ? 1.35 : naturalWidthMm < 75 ? 1.6 : 1.9;

  // 1 mm ≈ 3.7795 px a 96 DPI estándar de pantalla
  const pxPerMm = 3.78 * scale;
  const naturalWidthPx = Math.round(naturalWidthMm * pxPerMm);
  const naturalHeightPx = Math.round(naturalHeightMm * pxPerMm);

  const outerWidthPx = isRotated90or270 && !size.isContinuous
    ? naturalHeightPx
    : naturalWidthPx;
  const outerHeightPx = isRotated90or270 && !size.isContinuous
    ? naturalWidthPx
    : naturalHeightPx;

  // Separar parte entera y decimales del precio para jerarquía visual óptima (salePrice o price de fallback)
  const numericPrice = Number(product.salePrice ?? (product as unknown as { price?: number }).price ?? 0);
  const formattedPrice = numericPrice.toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Contenido interno de la etiqueta
  const labelContent = (
    <>
      {/* Alerta visible en pantalla si el código es demasiado largo para el ancho físico */}
      {!isPrintMode && isOverflowing && (
        <div
          className="absolute top-0.5 right-0.5 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold z-10"
          title={`Atención: El código puede desbordar los ${naturalWidthMm}mm de esta etiqueta.`}
        >
          !
        </div>
      )}

      {/* Cabecera: Nombre del negocio */}
      {showBusinessName && businessName && (
        <p
          className="font-bold uppercase tracking-wider text-slate-600 truncate leading-none mb-0.5"
          style={{
            color: '#444444',
            fontSize: isPrintMode
              ? naturalHeightMm <= 26
                ? '5.5pt'
                : naturalHeightMm <= 32
                  ? '6pt'
                  : '7pt'
              : undefined,
          }}
        >
          {businessName}
        </p>
      )}

      {/* Nombre del producto (máx 2 líneas) */}
      {showName && (
        <p
          className="font-bold text-[10px] sm:text-[11px] leading-tight text-black line-clamp-2 px-0.5"
          title={product.name}
          style={{
            color: '#000000',
            fontSize: isPrintMode
              ? naturalHeightMm <= 26
                ? '6.5pt'
                : naturalHeightMm <= 32
                  ? '7.5pt'
                  : '8.5pt'
              : undefined,
            lineHeight: isPrintMode ? '1.1' : undefined,
          }}
        >
          {product.name}
        </p>
      )}

      {/* PRECIO: Elemento dominante de máxima jerarquía visual */}
      {showPrice && (
        <div className="flex items-start justify-center text-black leading-none my-0.5 font-black">
          <span
            className="text-[9px] sm:text-[10px] font-bold mr-0.5 mt-0.5 tracking-tight align-top"
            style={{
              color: '#111111',
              fontSize: isPrintMode
                ? naturalHeightMm <= 26
                  ? '6.5pt'
                  : naturalHeightMm <= 32
                    ? '7pt'
                    : '8pt'
                : undefined,
            }}
          >
            {currencySymbol}
          </span>
          <span
            className="tracking-tight font-black"
            style={{
              color: '#000000',
              fontSize: isPrintMode
                ? naturalHeightMm <= 26
                  ? '11pt'
                  : naturalHeightMm <= 32
                    ? '13pt'
                    : naturalHeightMm <= 42
                      ? '15pt'
                      : '18pt'
                : naturalHeightMm <= 32
                  ? '16px'
                  : '22px',
            }}
          >
            {formattedPrice}
          </span>
        </div>
      )}

      {/* Código de barras en SVG nítido */}
      <div className="w-full flex items-center justify-center overflow-hidden my-0.5">
        <BarcodeSvg
          value={rawCode}
          format={format}
          width={barcodeModuleWidth}
          height={barcodeHeight}
          displayValue={showBarcodeText}
          fontSize={
            isPrintMode
              ? naturalHeightMm <= 26
                ? 6
                : naturalHeightMm <= 32
                  ? 7
                  : 8
              : naturalHeightMm <= 32
                ? 8
                : 10
          }
          textMargin={1}
          margin={0}
          lineColor="#000000"
          background="transparent"
        />
      </div>

      {/* Pie: SKU o datos complementarios */}
      {showSku && (product.sku || product.barcode) && (
        <div
          className="flex items-center justify-between text-slate-500 font-mono px-0.5 leading-none mt-0.5 border-t border-slate-100 pt-0.5"
          style={{
            fontSize: isPrintMode
              ? naturalHeightMm <= 26
                ? '5pt'
                : '5.5pt'
              : undefined,
          }}
        >
          <span className="truncate">SKU: {product.sku || '—'}</span>
          {product.unit && <span className="truncate uppercase font-bold text-slate-600">{product.unit}</span>}
        </div>
      )}
    </>
  );

  // Renderizado para impresión (@media print)
  if (isPrintMode) {
    return (
      <div
        className="product-label-print-wrapper"
        style={{
          width: `${outerWidthMm}mm`,
          height: `${outerHeightMm}mm`,
          maxWidth: `${outerWidthMm}mm`,
          maxHeight: `${outerHeightMm}mm`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          margin: '0 auto',
        }}
      >
        <div
          className="product-label-print-inner relative flex flex-col justify-between text-center bg-white text-black"
          style={{
            width: `${naturalWidthMm}mm`,
            height: `${naturalHeightMm}mm`,
            maxWidth: `${naturalWidthMm}mm`,
            maxHeight: `${naturalHeightMm}mm`,
            transform: effectiveRotation !== 0 ? `rotate(${effectiveRotation}deg)` : undefined,
            transformOrigin: 'center center',
            flexShrink: 0,
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            color: '#000000',
            padding: naturalHeightMm <= 26 ? '0.5mm' : naturalHeightMm <= 32 ? '0.8mm' : '1.2mm',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            fontFamily: 'Inter, Arial, Helvetica, sans-serif',
          }}
        >
          {labelContent}
        </div>
      </div>
    );
  }

  // Renderizado en pantalla para previsualización interactiva con soporte de giro en vivo
  return (
    <div
      className={`product-label-preview-wrapper relative flex items-center justify-center overflow-hidden transition-all ${className}`}
      style={{
        width: `${outerWidthPx}px`,
        height: `${outerHeightPx}px`,
        minWidth: `${outerWidthPx}px`,
        minHeight: `${outerHeightPx}px`,
      }}
    >
      <div
        className="relative flex flex-col justify-between text-center bg-white text-black border border-slate-300 rounded-sm select-none transition-transform shadow-xs p-2"
        style={{
          width: `${naturalWidthPx}px`,
          height: `${naturalHeightPx}px`,
          minWidth: `${naturalWidthPx}px`,
          minHeight: `${naturalHeightPx}px`,
          transform: effectiveRotation !== 0 ? `rotate(${effectiveRotation}deg)` : undefined,
          transformOrigin: 'center center',
          flexShrink: 0,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'Inter, Arial, Helvetica, sans-serif',
        }}
      >
        {labelContent}
      </div>
    </div>
  );
}
