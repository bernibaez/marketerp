import { useCallback, useRef } from 'react';
import type { PaperWidth } from '@/types/invoice';

export interface PrintInvoiceOptions {
  paperWidth?: PaperWidth;
  copies?: number;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

const DYNAMIC_STYLE_ID = 'thermal-invoice-dynamic-print-style';

/**
 * Hook para gestionar la impresión de facturas térmicas de alta calidad.
 * Inyecta dinámicamente la regla @page con el ancho exacto (50mm, 58mm u 80mm)
 * y márgenes físicos para rollos continuos sin desbordes.
 */
export function usePrintInvoice(defaultOptions?: PrintInvoiceOptions) {
  const isPrintingRef = useRef(false);

  const injectPrintStyles = useCallback((width: PaperWidth) => {
    // Retirar estilo previo si existe
    const existing = document.getElementById(DYNAMIC_STYLE_ID);
    if (existing) {
      existing.remove();
    }

    const styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_STYLE_ID;
    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${width}mm auto;
          margin: 0 !important;
        }

        html, body {
          width: ${width}mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          overflow: visible !important;
        }

        /* Ocultar toda la interfaz que no pertenezca a la factura térmica */
        header, aside, nav, .sidebar, .topbar, button, .no-print, [role="dialog"] > div:first-child:not(.printable-document):not(.thermal-invoice-host) {
          display: none !important;
        }

        body * {
          visibility: hidden;
        }

        /* Hacer visibles solo el contenedor térmico y sus hijos */
        .thermal-invoice-host,
        .thermal-invoice-host *,
        .thermal-invoice-printable,
        .thermal-invoice-printable * {
          visibility: visible !important;
        }

        .thermal-invoice-host {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: ${width}mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        .thermal-invoice-printable {
          position: relative !important;
          display: block !important;
          width: ${width}mm !important;
          max-width: ${width}mm !important;
          margin: 0 auto !important;
          background: #ffffff !important;
          color: #000000 !important;
          box-shadow: none !important;
          border: none !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .thermal-invoice-copy-break {
          page-break-after: always !important;
          break-after: page !important;
          height: 12px !important;
          border-bottom: 2px dashed #000000 !important;
          margin-bottom: 12px !important;
        }
      }
    `;

    document.head.appendChild(styleEl);
  }, []);

  const cleanupStyles = useCallback(() => {
    const existing = document.getElementById(DYNAMIC_STYLE_ID);
    if (existing) {
      existing.remove();
    }
  }, []);

  const print = useCallback(
    (overrideOptions?: PrintInvoiceOptions) => {
      if (isPrintingRef.current) return;
      isPrintingRef.current = true;

      const effectiveWidth: PaperWidth =
        overrideOptions?.paperWidth ?? defaultOptions?.paperWidth ?? 80;

      const beforeCb = overrideOptions?.onBeforePrint ?? defaultOptions?.onBeforePrint;
      const afterCb = overrideOptions?.onAfterPrint ?? defaultOptions?.onAfterPrint;

      if (beforeCb) {
        beforeCb();
      }

      injectPrintStyles(effectiveWidth);

      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        cleanupStyles();
        isPrintingRef.current = false;
        if (afterCb) {
          afterCb();
        }
      };

      window.addEventListener('afterprint', handleAfterPrint);

      // Despachar diálogo de impresión
      setTimeout(() => {
        window.print();
        // Fallback por si afterprint no dispara en algunos navegadores
        setTimeout(() => {
          if (isPrintingRef.current) {
            handleAfterPrint();
          }
        }, 1500);
      }, 50);
    },
    [defaultOptions, injectPrintStyles, cleanupStyles]
  );

  return {
    print,
    injectPrintStyles,
    cleanupStyles,
  };
}

export default usePrintInvoice;
