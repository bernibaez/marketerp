import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { isUuid, crearCompra, obtenerCompras, obtenerDetalleCompra, anularCompra } from '@/services/compras.service';
import ThermalInvoice from '@/components/invoice/ThermalInvoice';
import { DEFAULT_INVOICE_SETTINGS, getInvoiceSettings, saveInvoiceSettings } from '@/lib/invoiceSettingsStore';
import type { InvoiceData, InvoiceSettings } from '@/types/invoice';

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

describe('Compras y Personalización de Facturas (Tipografía & Zoom)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Validación de UUID y Guardado de Compras (Corrección de Error)', () => {
    it('isUuid reconoce correctamente UUID v4 válidos e invalida no-UUIDs', () => {
      expect(isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isUuid('e58245c9-9712-426b-a225-2a58fb6a40b1')).toBe(true);
      expect(isUuid('')).toBe(false);
      expect(isUuid('prov-001')).toBe(false);
      expect(isUuid('1')).toBe(false);
      expect(isUuid(null)).toBe(false);
      expect(isUuid(undefined)).toBe(false);
    });

    it('crearCompra guarda exitosamente compras locales cuando Supabase no está configurado o falla', async () => {
      const nueva = await crearCompra({
        codigo: 'FAC-COMP-TEST-001',
        proveedor_id: 'prov-local-01', // ID no UUID
        proveedor_nombre: 'Distribuidora del Caribe',
        metodo_pago: 'Transferencia',
        lineas: [
          {
            producto_id: 'prod-00132', // ID no UUID
            nombre: 'Queso Cheddar 1lb',
            cantidad: 5,
            precio_costo: 180,
            precio_venta: 240,
            porcentaje_impuesto: 18,
          },
          {
            producto_id: null,
            nombre: 'Artículo Misceláneo',
            cantidad: 2,
            precio_costo: 50,
            precio_venta: 75,
            porcentaje_impuesto: 0,
          },
        ],
      });

      expect(nueva.id).toBeDefined();
      expect(nueva.codigo).toBe('FAC-COMP-TEST-001');
      expect(nueva.proveedor).toBe('Distribuidora del Caribe');
      expect(nueva.items).toBe(7);
      expect(nueva.subtotal).toBe(5 * 180 + 2 * 50); // 900 + 100 = 1000
      expect(nueva.total).toBe(1000 + 5 * 180 * 0.18); // 1000 + 162 = 1162

      // Verificar que se recupera en la lista de compras
      const lista = await obtenerCompras();
      expect(lista.length).toBeGreaterThanOrEqual(1);
      const encontrada = lista.find((c) => c.codigo === 'FAC-COMP-TEST-001');
      expect(encontrada).toBeDefined();
      expect(encontrada?.proveedor).toBe('Distribuidora del Caribe');

      // Verificar detalle completo
      const detalle = await obtenerDetalleCompra(nueva.id);
      expect(detalle).not.toBeNull();
      expect(detalle?.lineas.length).toBe(2);
      expect(detalle?.lineas[0].nombre).toBe('Queso Cheddar 1lb');
    });

    it('anularCompra actualiza el estado de la compra local a anulada', async () => {
      const nueva = await crearCompra({
        codigo: 'FAC-COMP-ANULAR-01',
        proveedor_nombre: 'Proveedor Anular',
        metodo_pago: 'Efectivo',
        lineas: [
          {
            producto_id: null,
            nombre: 'Item para anular',
            cantidad: 1,
            precio_costo: 100,
            precio_venta: 150,
            porcentaje_impuesto: 0,
          },
        ],
      });

      await anularCompra(nueva.id);
      const detalle = await obtenerDetalleCompra(nueva.id);
      expect(detalle?.estado).toBe('anulada');
    });
  });

  describe('2. Tipografías de Factura Térmica (fontFamily)', () => {
    const dummyData: InvoiceData = {
      numero: 'FAC-0001',
      fecha: '2026-11-05',
      hora: '10:00 AM',
      items: [
        {
          cantidad: 1,
          descripcion: 'Arroz 10 lbs',
          precioUnitario: 350,
          total: 350,
        },
      ],
      subtotal: 350,
      impuesto: 0,
      total: 350,
      pagado: 500,
      cambio: 150,
    };

    it('aplica la tipografía Courier cuando se selecciona fontFamily: courier', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'courier',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('Courier New');
    });

    it('aplica tipografía sans-serif cuando se selecciona fontFamily: sans', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'sans',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('sans-serif');
    });

    it('aplica tipografía monoespaciada cuando se selecciona fontFamily: mono', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'mono',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('Roboto Mono');
    });

    it('aplica tipografía condensada cuando se selecciona fontFamily: condensed', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'condensed',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('Arial Narrow');
    });

    it('aplica tipografía consolas cuando se selecciona fontFamily: consolas', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'consolas',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('Consolas');
    });

    it('aplica tipografía serif cuando se selecciona fontFamily: serif', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontFamily: 'serif',
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      expect(html).toContain('Georgia');
    });
  });

  describe('3. Ajuste Manual de Zoom de Factura (zoomScale)', () => {
    const dummyData: InvoiceData = {
      numero: 'FAC-0002',
      fecha: '2026-11-05',
      hora: '11:00 AM',
      items: [
        {
          cantidad: 2,
          descripcion: 'Aceite 64 oz',
          precioUnitario: 295,
          total: 590,
        },
      ],
      subtotal: 590,
      impuesto: 0,
      total: 590,
      pagado: 1000,
      cambio: 410,
    };

    it('escala la fuente base proporcionalmente con zoomScale de 1.0 (100%)', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontSizeOption: 'normal', // multiplier 1.0
        zoomScale: 1.0,
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      // 9.5 * 1.0 * 1.0 = 9.5px
      expect(html).toContain('font-size:9.5px');
    });

    it('reduce la fuente proporcionalmente cuando zoomScale es 0.80 (80%)', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontSizeOption: 'normal',
        zoomScale: 0.8,
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      // 9.5 * 1.0 * 0.8 = 7.6px
      expect(html).toContain('font-size:7.6px');
    });

    it('aumenta la fuente proporcionalmente cuando zoomScale es 1.20 (120%)', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontSizeOption: 'normal',
        zoomScale: 1.2,
      };
      const html = renderToString(<ThermalInvoice data={dummyData} settings={settings} />);
      // 9.5 * 1.0 * 1.2 = 11.4px
      expect(html).toContain('font-size:11.4px');
    });

    it('prioriza la prop zoomScale pasada directamente al componente sobre settings', () => {
      const settings: InvoiceSettings = {
        ...DEFAULT_INVOICE_SETTINGS,
        fontSizeOption: 'normal',
        zoomScale: 1.0,
      };
      const html = renderToString(
        <ThermalInvoice data={dummyData} settings={settings} zoomScale={1.3} />
      );
      // 9.5 * 1.0 * 1.3 = 12.35 -> (12.35).toFixed(1) = 12.3px
      expect(html).toContain('font-size:12.3px');
    });

    it('guarda y recupera zoomScale y fontFamily en invoiceSettingsStore', () => {
      saveInvoiceSettings({
        fontFamily: 'mono',
        zoomScale: 1.15,
      });

      const recuperado = getInvoiceSettings();
      expect(recuperado.fontFamily).toBe('mono');
      expect(recuperado.zoomScale).toBe(1.15);
    });
  });
});
