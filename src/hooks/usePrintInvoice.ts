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

    const printableMm = width === 50 ? 44 : width === 58 ? 48 : 72;

    const styleEl = document.createElement('style');
    styleEl.id = DYNAMIC_STYLE_ID;
    styleEl.innerHTML = `
      @media print {
        @page {
          size: auto;
          margin: 0 !important;
        }

        html, body {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          overflow: visible !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          position: static !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Desconectar #root cuando se imprime una factura térmica para no generar páginas vacías previas (problema Página 9) */
        body:has(#mercato-thermal-print-portal) > *:not(#mercato-thermal-print-portal),
        body:has(> .printable-document) > #root,
        body:has(> .dialog-inline-host) > #root,
        body:has(> [role="dialog"]) > #root,
        body:has(.thermal-invoice-printable) > #root,
        body:has(.thermal-invoice-host) > #root {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          top: -99999px !important;
          left: -99999px !important;
        }

        /* Ocultar elementos de interfaz no imprimibles */
        header, aside, nav, .sidebar, .topbar, button, .no-print, .print\\:hidden {
          display: none !important;
        }

        /* Contenedores de modales overlay */
        .dialog-inline-host,
        .dialog-inline-host > div,
        .modal-panel,
        [role="dialog"] {
          background: #ffffff !important;
          color: #000000 !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          position: static !important;
          inset: auto !important;
          transform: none !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* Contenedores térmicos ajustados al cabezal físico real */
        .thermal-invoice-host,
        .thermal-invoice-printable {
          position: static !important;
          display: block !important;
          width: ${printableMm}mm !important;
          max-width: ${printableMm}mm !important;
          min-width: ${printableMm}mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          box-shadow: none !important;
          border: none !important;
          overflow: visible !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        /* Proteger ítems y encabezados de partición indeseada */
        .thermal-invoice-item,
        .thermal-invoice-header,
        .thermal-invoice-totals,
        .thermal-invoice-footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
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

      document.body.setAttribute('data-printing', 'true');
      injectPrintStyles(effectiveWidth);

      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        document.body.removeAttribute('data-printing');
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

