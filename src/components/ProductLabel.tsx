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
  businessName = 'Mi Colmado / Supermercado ERP',
  currencySymbol = 'RD$',
  showName = true,
  showPrice = true,
  showSku = true,
  showBarcodeText = true,
  showBusinessName = true,
  orientation = 'portrait',
  isPrintMode = false,
  scale = 1,
  className = '',
}: ProductLabelProps) {
  // Dimensiones en milímetros
  const baseWidth = size.id === 'custom' ? customWidthMm : size.widthMm;
  const baseHeight = size.id === 'custom' ? customHeightMm : size.heightMm;

  const widthMm = orientation === 'landscape' ? Math.max(baseWidth, baseHeight) : baseWidth;
  const heightMm = orientation === 'landscape' ? Math.min(baseWidth, baseHeight) : baseHeight;

  // Código a renderizar (prioriza código de barras, luego sku, luego id)
  const rawCode = (product.barcode || product.sku || product.id || '').trim();
  const code = normalizeBarcode(format, rawCode);

  // Alerta de desbordamiento en etiquetas pequeñas
  const isOverflowing = isBarcodeOverflowing(format, rawCode, widthMm);

  // Dimensiones dinámicas del código de barras proporcionales al alto y ancho de la etiqueta
  const barcodeHeight = Math.max(
    18,
    Math.min(heightMm * 0.9, heightMm < 30 ? 20 : heightMm < 40 ? 28 : 36)
  );

  const barcodeModuleWidth =
    widthMm < 45 ? 1.0 : widthMm < 60 ? 1.25 : widthMm < 75 ? 1.5 : 1.75;

  // 1 mm ≈ 3.7795 px a 96 DPI estándar de pantalla
  const pxPerMm = 3.78 * scale;
  const widthPx = Math.round(widthMm * pxPerMm);
  const minHeightPx = Math.round(heightMm * pxPerMm);

  // Separar parte entera y decimales del precio para jerarquía visual óptima (salePrice o price de fallback)
  const numericPrice = Number(product.salePrice ?? (product as unknown as { price?: number }).price ?? 0);
  const formattedPrice = numericPrice.toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Estilos físicos para impresión (@media print) vs visualización previa
  const printInlineStyle: React.CSSProperties = isPrintMode
    ? {
        width: `${widthMm}mm`,
        minHeight: `${heightMm}mm`,
        maxWidth: `${widthMm}mm`,
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '1.2mm',
        margin: '0 auto',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        fontFamily: 'Inter, Arial, Helvetica, sans-serif',
      }
    : {
        width: `${widthPx}px`,
        minHeight: `${minHeightPx}px`,
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Inter, Arial, Helvetica, sans-serif',
      };

  return (
    <div
      className={`relative flex flex-col justify-between text-center bg-white text-black border border-slate-300 rounded-sm overflow-hidden select-none transition-shadow ${
        isPrintMode ? 'border-none p-0 shadow-none' : 'shadow-xs p-2'
      } ${className}`}
      style={printInlineStyle}
    >
      {/* Alerta visible en pantalla si el código es demasiado largo para el ancho físico */}
      {!isPrintMode && isOverflowing && (
        <div
          className="absolute top-0.5 right-0.5 bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold z-10"
          title={`Atención: El código puede desbordar los ${widthMm}mm de esta etiqueta.`}
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
            fontSize: isPrintMode ? '6.5pt' : undefined,
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
            fontSize: isPrintMode ? (heightMm < 30 ? '7.5pt' : '9pt') : undefined,
            lineHeight: isPrintMode ? '1.15' : undefined,
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
              fontSize: isPrintMode ? (heightMm < 30 ? '7pt' : '8pt') : undefined,
            }}
          >
            {currencySymbol}
          </span>
          <span
            className="tracking-tight font-black"
            style={{
              color: '#000000',
              fontSize: isPrintMode
                ? heightMm < 30
                  ? '13pt'
                  : '18pt'
                : heightMm < 30
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
          fontSize={isPrintMode ? (heightMm < 30 ? 7 : 8) : (heightMm < 30 ? 8 : 10)}
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
            fontSize: isPrintMode ? '6pt' : undefined,
          }}
        >
          <span className="truncate">SKU: {product.sku || '—'}</span>
          {product.unit && <span className="truncate uppercase font-bold text-slate-600">{product.unit}</span>}
        </div>
      )}
    </div>
  );
}
