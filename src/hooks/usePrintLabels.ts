import { useState, useEffect, useCallback } from 'react';
import type { LabelPrintConfig, LabelSize } from '@/types/barcode';
import { DEFAULT_LABEL_CONFIG, PRESET_LABEL_SIZES } from '@/types/barcode';
import { toast } from '@/lib/toast';

const STORAGE_KEY = 'mercato_label_print_config_v2';

export function usePrintLabels() {
  const [config, setConfig] = useState<LabelPrintConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_LABEL_CONFIG;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LABEL_CONFIG, ...parsed };
    } catch {
      return DEFAULT_LABEL_CONFIG;
    }
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Persistir cambios en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('No se pudo guardar la configuración de impresión de etiquetas en localStorage', e);
    }
  }, [config]);

  const updateConfig = useCallback((patch: Partial<LabelPrintConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const getEffectiveDimensions = useCallback(
    (sizeId: string, customW: number, customH: number): { widthMm: number; heightMm: number; isContinuous: boolean; isGrid: boolean } => {
      const size = PRESET_LABEL_SIZES.find((s) => s.id === sizeId) || PRESET_LABEL_SIZES[0];
      const w = size.id === 'custom' ? customW : size.widthMm;
      const h = size.id === 'custom' ? customH : size.heightMm;
      return {
        widthMm: w,
        heightMm: h,
        isContinuous: Boolean(size.isContinuous),
        isGrid: Boolean(size.isGrid),
      };
    },
    []
  );

  /**
   * Genera e inyecta dinámicamente la regla @page para que la impresora
   * corte el papel o ajuste el margen al tamaño exacto de la etiqueta elegida.
   */
  const injectDynamicPageStyle = useCallback((size: LabelSize, customW: number, customH: number, orientation: 'portrait' | 'landscape') => {
    const existingStyle = document.getElementById('dynamic-label-print-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    const baseW = size.id === 'custom' ? customW : size.widthMm;
    const baseH = size.id === 'custom' ? customH : size.heightMm;

    const isLandscape = orientation === 'landscape';
    const widthMm = size.isContinuous
      ? baseW
      : isLandscape
        ? Math.max(baseW, baseH)
        : Math.min(baseW, baseH);
    const heightMm = size.isContinuous
      ? (isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH, 60))
      : isLandscape
        ? Math.min(baseW, baseH)
        : Math.max(baseW, baseH);

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-label-print-style';

    const hideRootCss = `
        body > #root {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          top: -99999px !important;
          left: -99999px !important;
          visibility: hidden !important;
        }
        header, aside, nav, .sidebar, .topbar, button, .no-print, .print\\:hidden, [role="dialog"] {
          display: none !important;
        }
        .label-print-sheet {
          display: block !important;
          position: static !important;
          margin: 0 auto !important;
          padding: 0 !important;
          visibility: visible !important;
        }
    `;

    if (size.isGrid) {
      // Formato A4
      styleEl.innerHTML = `
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        @media print {
          ${hideRootCss}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .label-print-grid-container {
            display: grid !important;
            grid-template-columns: repeat(${size.columns || 3}, 1fr) !important;
            gap: 2mm !important;
            page-break-after: always;
          }
          .label-print-grid-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `;
    } else if (size.isContinuous) {
      // Formato térmico continuo (ej. 58mm o 80mm)
      styleEl.innerHTML = `
        @page {
          size: auto;
          margin: 0 !important;
        }
        @media print {
          ${hideRootCss}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .label-print-continuous-item {
            width: ${widthMm}mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 2mm !important;
            border-bottom: 1px dashed #cccccc !important;
          }
        }
      `;
    } else {
      // Etiqueta individual estándar (ej: 50x30mm o 40x25mm)
      styleEl.innerHTML = `
        @page {
          size: ${widthMm}mm ${heightMm}mm ${isLandscape ? 'landscape' : 'portrait'};
          margin: 0;
        }
        @media print {
          ${hideRootCss}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .label-print-single-item {
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
          }
        }
      `;
    }

    document.head.appendChild(styleEl);
  }, []);

  const printLabels = useCallback(
    (size: LabelSize, customW: number, customH: number, orientation: 'portrait' | 'landscape') => {
      document.body.setAttribute('data-printing', 'true');
      injectDynamicPageStyle(size, customW, customH, orientation);

      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        document.body.removeAttribute('data-printing');
        const styleEl = document.getElementById('dynamic-label-print-style');
        if (styleEl) styleEl.remove();
      };
      window.addEventListener('afterprint', handleAfterPrint);

      window.setTimeout(() => {
        window.print();
        window.setTimeout(() => {
          handleAfterPrint();
        }, 1500);
      }, 120);
    },
    [injectDynamicPageStyle]
  );

  const downloadPdf = useCallback(
    async (containerElement: HTMLElement | null, filename = 'etiquetas_productos.pdf') => {
      if (!containerElement) {
        toast.error('No se pudo encontrar el contenedor para generar el PDF');
        return false;
      }

      setIsGeneratingPdf(true);
      try {
        const { default: jsPDF } = await import('jspdf');
        const { default: html2canvas } = await import('html2canvas');

        const canvas = await html2canvas(containerElement, {
          scale: 3, // Alta resolución para máxima nitidez de barras
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidthPx = canvas.width;
        const imgHeightPx = canvas.height;

        // Ancho y alto proporcionales en mm (relación de aspecto)
        const pdfWidthMm = 210; // A4 standard
        const pdfHeightMm = (imgHeightPx * pdfWidthMm) / imgWidthPx;

        const doc = new jsPDF({
          orientation: pdfHeightMm > pdfWidthMm ? 'portrait' : 'landscape',
          unit: 'mm',
          format: [pdfWidthMm, Math.max(pdfHeightMm, 297)],
        });

        doc.addImage(imgData, 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
        doc.save(filename);
        toast.success('PDF de etiquetas descargado correctamente');
        return true;
      } catch (err) {
        console.error('Error generando PDF de etiquetas:', err);
        toast.error('Error al generar el PDF de etiquetas');
        return false;
      } finally {
        setIsGeneratingPdf(false);
      }
    },
    []
  );

  return {
    config,
    updateConfig,
    printLabels,
    downloadPdf,
    isGeneratingPdf,
    getEffectiveDimensions,
  };
}

