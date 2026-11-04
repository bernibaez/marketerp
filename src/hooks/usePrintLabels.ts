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
   * Totalmente compatible con Chrome en Windows 10 y Windows 11.
   */
  const injectDynamicPageStyle = useCallback((
    size: LabelSize,
    customW: number,
    customH: number,
    orientation: 'portrait' | 'landscape',
    rotation: 0 | 90 | 180 | 270 = 0
  ) => {
    const existingStyle = document.getElementById('dynamic-label-print-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    const baseW = size.id === 'custom' ? customW : size.widthMm;
    const baseH = size.id === 'custom' ? customH : size.heightMm;

    const natW = size.isContinuous ? baseW : Math.max(baseW, baseH);
    const natH = size.isContinuous ? baseH : Math.min(baseW, baseH);

    const isRotated = rotation === 90 || rotation === 270;
    const widthMm = isRotated && !size.isContinuous ? natH : natW;
    const heightMm = isRotated && !size.isContinuous ? natW : natH;

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-label-print-style';

    const hideRootCss = `
        body[data-printing="true"] > #root,
        body[data-printing-labels="true"] > #root,
        body.is-printing-labels > #root,
        #root {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          overflow: hidden !important;
          position: static !important;
          visibility: hidden !important;
        }
        header, aside, nav, .sidebar, .topbar, button, .no-print, .print\\:hidden, [role="dialog"], .modal-panel, .dialog-inline-host, .fixed.inset-0 {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          overflow: hidden !important;
        }
        #mercato-label-print-portal,
        .label-print-sheet {
          display: block !important;
          position: static !important;
          margin: 0 auto !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          visibility: visible !important;
          overflow: visible !important;
        }
        #mercato-label-print-portal *,
        .label-print-sheet * {
          visibility: visible !important;
        }
    `;

    if (size.isGrid) {
      // Formato A4 (rejilla de etiquetas)
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
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-after: always;
          }
          .label-print-grid-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
      `;
    } else if (size.isContinuous) {
      // Formato térmico continuo (ej. rollo 58mm o 80mm)
      styleEl.innerHTML = `
        @page {
          size: auto;
          margin: 0;
        }
        @media print {
          ${hideRootCss}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .label-print-continuous-container {
            width: ${widthMm}mm !important;
            max-width: ${widthMm}mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .label-print-continuous-item {
            width: 100% !important;
            max-width: 100% !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin: 0 auto 2mm auto !important;
            padding-bottom: 2mm !important;
            border-bottom: 1px dashed #aaaaaa !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .label-print-continuous-item:last-child {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            border-bottom: none !important;
          }
        }
      `;
    } else {
      // Etiqueta individual estándar (ej: 50x30mm o 40x25mm)
      // IMPORTANTE: En la especificación W3C CSS Paged Media y en Google Chrome (Windows 10/11),
      // los valores de longitud (ej. 50mm 30mm) NUNCA deben combinarse con palabras clave 'portrait' o 'landscape'.
      // La orientación queda intrínsecamente definida por el orden de ancho y alto (ancho x alto).
      // Si se incluye 'portrait' o 'landscape', Chrome marca la regla como INVÁLIDA y cae en papel Letter/A4,
      // provocando que la etiqueta aparezca diminuta en una esquina.
      styleEl.innerHTML = `
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 0;
        }
        @media print {
          ${hideRootCss}
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            min-width: ${widthMm}mm !important;
            min-height: ${heightMm}mm !important;
            max-width: ${widthMm}mm !important;
            max-height: ${heightMm}mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          .label-print-single-container {
            width: ${widthMm}mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .label-print-single-item {
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            max-width: ${widthMm}mm !important;
            max-height: ${heightMm}mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: page !important;
            page-break-after: always !important;
            overflow: hidden !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          .label-print-single-item:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `;
    }

    document.head.appendChild(styleEl);
  }, []);

  const printLabels = useCallback(
    (
      size: LabelSize,
      customW: number,
      customH: number,
      orientation: 'portrait' | 'landscape',
      rotation: 0 | 90 | 180 | 270 = 0
    ) => {
      document.body.setAttribute('data-printing', 'true');
      document.body.setAttribute('data-printing-labels', 'true');
      document.body.classList.add('is-printing-labels');
      injectDynamicPageStyle(size, customW, customH, orientation, rotation);

      const handleAfterPrint = () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        document.body.removeAttribute('data-printing');
        document.body.removeAttribute('data-printing-labels');
        document.body.classList.remove('is-printing-labels');
        const styleEl = document.getElementById('dynamic-label-print-style');
        if (styleEl) styleEl.remove();
      };
      window.addEventListener('afterprint', handleAfterPrint);

      // Esperar 160ms para que el navegador aplique los estilos dinámicos antes de invocar window.print()
      window.setTimeout(() => {
        window.print();
        window.setTimeout(() => {
          handleAfterPrint();
        }, 1500);
      }, 160);
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
      document.body.setAttribute('data-generating-pdf', 'true');
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
        document.body.removeAttribute('data-generating-pdf');
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

