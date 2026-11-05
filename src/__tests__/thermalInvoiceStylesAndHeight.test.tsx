import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { normalizeInvoiceStyle, type InvoiceData, type InvoiceSettings } from '@/types/invoice';
import { DEFAULT_INVOICE_SETTINGS, getInvoiceSettings, saveInvoiceSettings } from '@/lib/invoiceSettingsStore';
import ThermalInvoice from '@/components/invoice/ThermalInvoice';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = new LocalStorageMock();
}

describe('Estilos de Diseño de Facturas (6 Estilos) y Automatización de Altura', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Normalización y Mapeo de Estilos de Factura', () => {
    it('normaliza correctamente los 6 estilos oficiales', () => {
      expect(normalizeInvoiceStyle('clasico')).toBe('clasico');
      expect(normalizeInvoiceStyle('compacto')).toBe('compacto');
      expect(normalizeInvoiceStyle('elegante')).toBe('elegante');
      expect(normalizeInvoiceStyle('minimalista')).toBe('minimalista');
      expect(normalizeInvoiceStyle('moderno')).toBe('moderno');
      expect(normalizeInvoiceStyle('supermercado')).toBe('supermercado');
    });

    it('mapea estilos heredados (legacy) hacia los nuevos estilos correspondientes', () => {
      expect(normalizeInvoiceStyle('standard')).toBe('clasico');
      expect(normalizeInvoiceStyle('compact')).toBe('compacto');
      expect(normalizeInvoiceStyle('modern')).toBe('moderno');
      expect(normalizeInvoiceStyle('minimal')).toBe('minimalista');
      expect(normalizeInvoiceStyle('detailed')).toBe('supermercado');
    });

    it('proporciona fallback a clasico ante valores inválidos o indefinidos', () => {
      expect(normalizeInvoiceStyle(undefined)).toBe('clasico');
      expect(normalizeInvoiceStyle('')).toBe('clasico');
      expect(normalizeInvoiceStyle('desconocido_123')).toBe('clasico');
    });
  });

  describe('2. Configuración y Persistencia de Control de Altura', () => {
    it('el store contiene los valores predeterminados para ahorro inteligente de papel', () => {
      const defaults = DEFAULT_INVOICE_SETTINGS;
      expect(defaults.heightMode).toBe('auto');
      expect(defaults.paperSaverSmallSales).toBe(true);
      expect(defaults.feedLines).toBe(1);
    });

    it('persiste y recupera heightMode y paperSaverSmallSales correctamente', () => {
      saveInvoiceSettings({
        templateStyle: 'compacto',
        heightMode: 'compact',
        paperSaverSmallSales: true,
        feedLines: 0,
      });

      const loaded = getInvoiceSettings();
      expect(loaded.templateStyle).toBe('compacto');
      expect(loaded.heightMode).toBe('compact');
      expect(loaded.paperSaverSmallSales).toBe(true);
      expect(loaded.feedLines).toBe(0);
    });
  });

  describe('3. Renderizado de los 6 Diseños en ThermalInvoice', () => {
    const sampleSingleItemData: InvoiceData = {
      numero: 'FAC-0001',
      invoiceNumber: 'FAC-0001',
      fecha: '04/11/2026',
      hora: '10:30 AM',
      cajero: 'Cajero Principal',
      cliente: 'Consumidor Final',
      items: [
        {
          cantidad: 1,
          descripcion: 'Botellón Agua Cristal',
          precioUnitario: 80,
          total: 80,
        },
      ],
      subtotal: 80,
      impuesto: 0,
      total: 80,
      pagado: 100,
      cambio: 20,
    };

    const sampleMultiItemData: InvoiceData = {
      ...sampleSingleItemData,
      numero: 'FAC-0002',
      invoiceNumber: 'FAC-0002',
      items: [
        { cantidad: 1, descripcion: 'Botellón Agua Cristal', precioUnitario: 80, total: 80 },
        { cantidad: 2, descripcion: 'Arroz Súper Selecto 10 lbs', precioUnitario: 380, total: 760 },
        { cantidad: 1, descripcion: 'Aceite Vegetal Crisol 64 oz', precioUnitario: 295, total: 295 },
        { cantidad: 4, descripcion: 'Leche Entera Milex 1L', precioUnitario: 85, total: 340 },
        { cantidad: 3, descripcion: 'Azúcar Crema 2 lbs', precioUnitario: 65, total: 195 },
      ],
      subtotal: 1670,
      impuesto: 0,
      total: 1670,
    };

    it('renderiza exitosamente el diseño "clasico"', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'clasico' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      expect(html).toContain('TOTAL');
    });

    it('renderiza exitosamente el diseño "compacto" en formato ultra-ahorro inline', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'compacto' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      // En modo compacto los ítems se representan en formato condensado
      expect(html).toMatch(/1(<!-- -->)?x/);
      expect(html).toContain('80.00');
      expect(html).toContain('data-style-variant="compacto"');
    });

    it('renderiza exitosamente el diseño "elegante" con ornamentos y tipografía distintiva', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'elegante' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      expect(html).toContain('✦');
      expect(html).toContain('data-style-variant="elegante"');
    });

    it('renderiza exitosamente el diseño "minimalista" con diseño asimétrico y titular limpio', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'minimalista' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      expect(html).toContain('Factura');
    });

    it('renderiza exitosamente el diseño "moderno" con bandas invertidas oscuras', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'moderno' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      // Encabezado y total con estilo invertido
      expect(html).toContain('bg-black text-white');
    });

    it('renderiza exitosamente el diseño "supermercado" con estilo de terminal POS y códigos numerados', () => {
      const html = renderToString(
        <ThermalInvoice
          data={sampleSingleItemData}
          settings={{ ...DEFAULT_INVOICE_SETTINGS, templateStyle: 'supermercado' }}
          width={80}
        />
      );
      expect(html).toContain('Botellón Agua Cristal');
      expect(html).toContain('001');
      expect(html).toContain('TOTAL A PAGAR');
    });

    describe('4. Automatización de Altura Inteligente (Control de Largo del Ticket)', () => {
      it('en venta pequeña (1 producto) con modo auto ahorra papel y reduce padding', () => {
        const htmlSingle = renderToString(
          <ThermalInvoice
            data={sampleSingleItemData}
            settings={{
              ...DEFAULT_INVOICE_SETTINGS,
              heightMode: 'auto',
              paperSaverSmallSales: true,
              showFooterMessage: true,
              footerMessage: 'Gracias por su compra',
            }}
            width={80}
          />
        );

        // Debería activar el ahorro de papel para ventas pequeñas (1 producto)
        expect(htmlSingle).toContain('data-paper-saver="true"');
        expect(htmlSingle).toMatch(/padding-top:\s*2px/);
        expect(htmlSingle).toMatch(/padding-bottom:\s*3px/);
      });

      it('en venta de varios productos (5 ítems) con modo auto se expande de forma completa', () => {
        const htmlMulti = renderToString(
          <ThermalInvoice
            data={sampleMultiItemData}
            settings={{
              ...DEFAULT_INVOICE_SETTINGS,
              heightMode: 'auto',
              paperSaverSmallSales: true,
              showFooterMessage: true,
              footerMessage: 'Gracias por su compra',
            }}
            width={80}
          />
        );

        // Con más de 3 productos, aplica padding normal y espaciado estándar sin forzar compresión
        expect(htmlMulti).toContain('data-paper-saver="false"');
        expect(htmlMulti).toMatch(/padding-top:\s*4px/);
        expect(htmlMulti).toMatch(/padding-bottom:\s*8px/);
      });

      it('en modo "compact" explícito fuerza el ahorro de altura sin importar la cantidad de productos', () => {
        const htmlForcedCompact = renderToString(
          <ThermalInvoice
            data={sampleMultiItemData}
            settings={{
              ...DEFAULT_INVOICE_SETTINGS,
              heightMode: 'compact',
            }}
            width={80}
          />
        );

        expect(htmlForcedCompact).toContain('data-paper-saver="true"');
        expect(htmlForcedCompact).toMatch(/padding-top:\s*2px/);
      });

      it('en modo "standard" explícito mantiene el formato expandido incluso con 1 producto', () => {
        const htmlForcedStandard = renderToString(
          <ThermalInvoice
            data={sampleSingleItemData}
            settings={{
              ...DEFAULT_INVOICE_SETTINGS,
              heightMode: 'standard',
            }}
            width={80}
          />
        );

        expect(htmlForcedStandard).toContain('data-paper-saver="false"');
        expect(htmlForcedStandard).toMatch(/padding-top:\s*4px/);
        expect(htmlForcedStandard).toMatch(/padding-bottom:\s*8px/);
      });
    });
  });
});
