import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import type { PaperWidth } from '@/types/invoice';

export interface InvoiceBarcodeProps {
  value: string;
  width?: PaperWidth;
  className?: string;
}

export const InvoiceBarcode: React.FC<InvoiceBarcodeProps> = ({
  value,
  width = 80,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hasError, setHasError] = useState(false);

  const cleanValue = (value || '').trim();

  useEffect(() => {
    if (!svgRef.current || !cleanValue) {
      setHasError(true);
      return;
    }

    try {
      // Dimensiones de módulo según estándar térmico de 203 DPI:
      // En 80 mm: >= 0.5 mm (~1.9px a 96dpi, 4 dots a 203dpi)
      // En 50 mm / 58 mm: >= 0.375 mm (~1.4px a 96dpi, 3 dots a 203dpi)
      const isNarrow = width === 50 || width === 58;
      const moduleWidth = isNarrow ? 1.4 : 1.9;
      const barHeight = isNarrow ? 32 : 40;

      JsBarcode(svgRef.current, cleanValue, {
        format: 'CODE128',
        width: moduleWidth,
        height: barHeight,
        displayValue: false, // El texto se renderiza debajo con letras espaciadas
        margin: 0,
        background: 'transparent',
        lineColor: '#000000',
        valid: (valid) => {
          setHasError(!valid);
        },
      });
      setHasError(false);
    } catch {
      setHasError(true);
    }
  }, [cleanValue, width]);

  if (!cleanValue || hasError) {
    return (
      <div className={`py-1 text-center font-mono text-[9px] text-black ${className}`}>
        {cleanValue || 'SIN CÓDIGO'}
      </div>
    );
  }

  // Separar caracteres con un espacio visible para máxima legibilidad humana
  const spacedText = cleanValue.split('').join(' ');

  return (
    <div className={`flex flex-col items-center justify-center py-1 select-none ${className}`}>
      <svg
        ref={svgRef}
        className="max-w-full block"
        style={{
          shapeRendering: 'crispEdges',
          colorAdjust: 'exact',
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
        }}
      />
      <div
        className="font-mono text-center font-bold text-black text-[9px] tracking-[0.2em] mt-1 uppercase"
        style={{ letterSpacing: '0.22em' }}
      >
        {spacedText}
      </div>
    </div>
  );
};

export default InvoiceBarcode;
