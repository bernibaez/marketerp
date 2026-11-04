import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import type { BarcodeFormat } from '@/types/barcode';
import { normalizeBarcode, validateBarcode } from '@/utils/barcode';

export interface BarcodeSvgProps {
  value: string;
  format: BarcodeFormat;
  width?: number; // Ancho de barra individual (módulo en px)
  height?: number; // Altura de las barras en px
  displayValue?: boolean; // Mostrar texto/números bajo las barras
  fontSize?: number;
  font?: string;
  textAlign?: 'left' | 'center' | 'right';
  textPosition?: 'bottom' | 'top';
  textMargin?: number;
  margin?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  background?: string;
  lineColor?: string;
  className?: string;
  onError?: (error: Error) => void;
}

export default function BarcodeSvg({
  value,
  format,
  width = 1.5,
  height = 40,
  displayValue = true,
  fontSize = 11,
  font = 'monospace',
  textAlign = 'center',
  textPosition = 'bottom',
  textMargin = 2,
  margin = 0,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  background = 'transparent',
  lineColor = '#000000',
  className = '',
  onError,
}: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const rawValue = (value || '').trim();
    if (!rawValue) {
      setRenderError('Código vacío');
      return;
    }

    const validation = validateBarcode(format, rawValue);
    if (!validation.valid) {
      setRenderError(validation.message || 'Código incompatible con el formato');
      if (onError) onError(new Error(validation.message || 'Código incompatible'));
      return;
    }

    const normalizedValue = normalizeBarcode(format, rawValue);

    // Mapeo al nombre de formato esperado por JsBarcode
    const jsBarcodeFormat =
      format === 'UPCA' ? 'UPC' : format === 'EAN13' ? 'EAN13' : format === 'EAN8' ? 'EAN8' : 'CODE128';

    try {
      JsBarcode(svgRef.current, normalizedValue, {
        format: jsBarcodeFormat,
        width,
        height,
        displayValue,
        font,
        fontSize,
        textAlign,
        textPosition,
        textMargin,
        margin,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        background,
        lineColor,
        valid: (valid) => {
          if (!valid) {
            setRenderError(`Código no válido para ${format}`);
            if (onError) onError(new Error(`Código no válido para ${format}`));
          } else {
            setRenderError(null);
          }
        },
      });
      setRenderError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al renderizar código de barras';
      setRenderError(msg);
      if (onError) onError(err instanceof Error ? err : new Error(msg));
    }
  }, [
    value,
    format,
    width,
    height,
    displayValue,
    fontSize,
    font,
    textAlign,
    textPosition,
    textMargin,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    background,
    lineColor,
    onError,
  ]);

  if (renderError) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-1.5 text-center bg-rose-50 border border-rose-200 rounded text-rose-700 text-[10px] leading-tight font-sans ${className}`}
        style={{ minHeight: height ? `${height + 15}px` : '45px' }}
      >
        <span className="font-bold text-[11px]">⚠️ {format} no compatible</span>
        <span className="text-[9px] text-rose-600 mt-0.5 line-clamp-2">{renderError}</span>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`block mx-auto max-w-full ${className}`}
      shapeRendering="crispEdges"
      aria-label={`Código de barras ${format}: ${value}`}
    />
  );
}
