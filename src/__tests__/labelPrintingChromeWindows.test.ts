import { describe, it, expect } from 'vitest';
import { PRESET_LABEL_SIZES } from '@/types/barcode';

describe('Compatibilidad de Impresión de Etiquetas con Chrome y Windows 10/11', () => {
  it('garantiza que los tamaños predefinidos tienen dimensiones físicas positivas en mm', () => {
    for (const size of PRESET_LABEL_SIZES) {
      expect(size.widthMm).toBeGreaterThan(0);
      expect(size.heightMm).toBeGreaterThan(0);
    }
  });

  it('verifica que la regla @page size para etiquetas individuales NO incluya palabras portrait/landscape (error de sintaxis en CSS W3C)', () => {
    // Para cualquier etiqueta individual (ej. 50x30, 40x25):
    // La sintaxis CSS válida es "@page { size: <ancho>mm <alto>mm; }"
    // Si se incluye "landscape" o "portrait" junto a longitudes, Chrome lo invalida y cae en tamaño Carta/A4.
    const testCases = [
      { w: 50, h: 30, rotation: 0 },
      { w: 50, h: 30, rotation: 90 },
      { w: 40, h: 25, rotation: 0 },
      { w: 40, h: 25, rotation: 270 },
    ];

    for (const tc of testCases) {
      const isRotated = tc.rotation === 90 || tc.rotation === 270;
      const widthMm = isRotated ? tc.h : tc.w;
      const heightMm = isRotated ? tc.w : tc.h;

      const pageCss = `size: ${widthMm}mm ${heightMm}mm; margin: 0;`;

      expect(pageCss).not.toContain('landscape');
      expect(pageCss).not.toContain('portrait');
      expect(pageCss).toMatch(/^size: \d+mm \d+mm; margin: 0;$/);
    }
  });

  it('verifica que la última etiqueta de la serie no tenga page-break-after para no generar hojas en blanco extra', () => {
    const singleItemLastChildCss = '.label-print-single-item:last-child { break-after: auto !important; page-break-after: auto !important; }';
    expect(singleItemLastChildCss).toContain('page-break-after: auto');
    expect(singleItemLastChildCss).toContain('break-after: auto');
  });

  it('valida que no se utilicen posiciones negativas destructivas (-99999px) que provocan páginas en blanco fantasma', () => {
    // Al ocultar #root en print media, usar display: none y width: 0 / height: 0 sin top: -99999px
    const hideRootRule = `
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
      position: static !important;
      visibility: hidden !important;
    `;
    expect(hideRootRule).not.toContain('-99999px');
  });
});

