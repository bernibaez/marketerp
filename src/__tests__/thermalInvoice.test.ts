import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatTime,
  wrapText,
  truncateText,
  calculateInvoiceTotals,
} from '@/utils/invoiceFormat';
import { DEFAULT_INVOICE_SETTINGS, getInvoiceSettings, saveInvoiceSettings } from '@/lib/invoiceSettingsStore';
import type { InvoiceData, InvoiceSettings, PaperWidth } from '@/types/invoice';

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

describe('Factura Térmica Profesional: Formateo, Cálculos y Casos Límite', () => {
  describe('1. Formato de Moneda (formatCurrency)', () => {
    it('formatea montos estándar con separador de miles y dos decimales', () => {
      expect(formatCurrency(1250)).toBe('RD$ 1,250.00');
      expect(formatCurrency(1500.5)).toBe('RD$ 1,500.50');
      expect(formatCurrency(99.99)).toBe('RD$ 99.99');
    });

    it('maneja valores cero correctamente', () => {
      expect(formatCurrency(0)).toBe('RD$ 0.00');
      expect(formatCurrency(0.0)).toBe('RD$ 0.00');
    });

    it('maneja montos grandes en el orden de millones sin pérdida de precisión', () => {
      expect(formatCurrency(1000000)).toBe('RD$ 1,000,000.00');
      expect(formatCurrency(12345678.9)).toBe('RD$ 12,345,678.90');
      expect(formatCurrency(99999999.99)).toBe('RD$ 99,999,999.99');
    });

    it('maneja montos negativos adecuadamente', () => {
      expect(formatCurrency(-50)).toBe('-RD$ 50.00');
      expect(formatCurrency(-1250.75)).toBe('-RD$ 1,250.75');
    });

    it('admite símbolos de moneda personalizados o sin símbolo', () => {
      expect(formatCurrency(500, '$')).toBe('$ 500.00');
      expect(formatCurrency(500, 'US$')).toBe('US$ 500.00');
      expect(formatCurrency(500, '')).toBe('500.00');
    });

    it('maneja valores nulos, indefinidos o NaN como 0.00', () => {
      expect(formatCurrency(null)).toBe('RD$ 0.00');
      expect(formatCurrency(undefined)).toBe('RD$ 0.00');
      expect(formatCurrency(Number.NaN)).toBe('RD$ 0.00');
    });
  });

  describe('2. Ajuste de Texto Largo (wrapText & truncateText)', () => {
    it('mantiene texto corto en una sola línea si no supera el límite', () => {
      const lines = wrapText('Arroz 10 lbs', 22);
      expect(lines).toEqual(['Arroz 10 lbs']);
    });

    it('ajusta texto largo en múltiples líneas respetando límites de palabras (~22 caracteres)', () => {
      const longName = 'Aceite Vegetal Crisol Puro de Soya Familiar 128 oz';
      const lines = wrapText(longName, 22);

      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(22);
      });
      // Verifica que no se perdió ninguna palabra
      expect(lines.join(' ')).toBe(longName);
    });

    it('divide palabras continuas extremadamente largas sin espacios sin desbordar ni bloquearse', () => {
      const veryLongWord = 'SUPERMICROPROCESADOREXTRALARGOSINNINGUNESPACIO123456';
      const lines = wrapText(veryLongWord, 20);

      expect(lines.length).toBeGreaterThanOrEqual(3);
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(20);
      });
      expect(lines.join('')).toBe(veryLongWord);
    });

    it('respeta saltos de línea manuales existentes', () => {
      const multiline = 'Línea uno\nLínea dos\nLínea tres';
      const lines = wrapText(multiline, 30);
      expect(lines).toEqual(['Línea uno', 'Línea dos', 'Línea tres']);
    });

    it('retorna array vacío ante texto vacío, nulo o espacios', () => {
      expect(wrapText('')).toEqual([]);
      expect(wrapText('   ')).toEqual([]);
      expect(wrapText(null)).toEqual([]);
      expect(wrapText(undefined)).toEqual([]);
    });

    it('recorta texto con truncateText cuando excede el límite', () => {
      expect(truncateText('Supermercado Mercato SRL', 15)).toBe('Supermercado...');
      expect(truncateText('Texto corto', 20)).toBe('Texto corto');
    });
  });

  describe('3. Cálculos de Factura (Subtotal, ITBIS, Descuento, Total y Cambio)', () => {
    it('calcula subtotal e ITBIS estándar al 18%', () => {
      const items = [
        { cantidad: 2, precioUnitario: 500 }, // 1,000
        { cantidad: 1, precioUnitario: 250 }, // 250
      ];

      const res = calculateInvoiceTotals(items, 18, 0, 1500);
      expect(res.subtotal).toBe(1250);
      // 1250 * 0.18 = 225
      expect(res.impuesto).toBe(225);
      expect(res.total).toBe(1475);
      expect(res.cambio).toBe(25);
      expect(res.totalArticulos).toBe(3);
    });

    it('maneja ITBIS en 0 (productos exentos o régimen especial)', () => {
      const items = [
        { cantidad: 5, precioUnitario: 100 }, // 500
      ];

      const res = calculateInvoiceTotals(items, 0, 0, 1000);
      expect(res.subtotal).toBe(500);
      expect(res.impuesto).toBe(0);
      expect(res.total).toBe(500);
      expect(res.cambio).toBe(500);
    });

    it('deduce descuentos aplicados antes del cálculo de impuesto', () => {
      const items = [
        { cantidad: 1, precioUnitario: 1000 },
      ];
      // Subtotal 1000 - Descuento 100 = 900 base. ITBIS 18% de 900 = 162. Total 1062.
      const res = calculateInvoiceTotals(items, 18, 100, 1100);
      expect(res.subtotal).toBe(1000);
      expect(res.impuesto).toBe(162);
      expect(res.total).toBe(1062);
      expect(res.cambio).toBe(38);
    });

    it('devuelve cambio en 0 si el pago es exacto o insuficiente', () => {
      const items = [{ cantidad: 1, precioUnitario: 100 }];
      const resExacto = calculateInvoiceTotals(items, 0, 0, 100);
      expect(resExacto.cambio).toBe(0);

      const resMenor = calculateInvoiceTotals(items, 0, 0, 50);
      expect(resMenor.cambio).toBe(0);
    });

    it('suma correctamente cantidades fraccionarias (ej. productos pesables por libra/kilo)', () => {
      const items = [
        { cantidad: 1.75, precioUnitario: 80 }, // 140
        { cantidad: 0.5, precioUnitario: 120 },  // 60
      ];

      const res = calculateInvoiceTotals(items, 0, 0, 200);
      expect(res.subtotal).toBe(200);
      expect(res.total).toBe(200);
      expect(res.totalArticulos).toBe(2.25);
    });
  });

  describe('4. Formateo de Fechas y Horas', () => {
    it('normaliza fechas de cadenas ISO a formato DD/MM/YYYY', () => {
      expect(formatDate('2026-11-04')).toBe('04/11/2026');
      expect(formatDate('04/11/2026')).toBe('04/11/2026');
      expect(formatDate('04-11-2026')).toBe('04/11/2026');
    });

    it('formatea horas adecuadamente', () => {
      expect(formatTime('10:30 AM')).toBe('10:30 AM');
      expect(formatTime('14:45:00')).toBe('14:45:00');
      expect(formatTime(undefined, '11:15 AM')).toBe('11:15 AM');
    });
  });

  describe('5. Configuración y Migración Segura (InvoiceSettingsStore)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('contiene los valores por defecto requeridos para la factura térmica', () => {
      expect(DEFAULT_INVOICE_SETTINGS.paperWidth).toBe(80);
      expect(DEFAULT_INVOICE_SETTINGS.itbisPercent).toBe(18);
      expect(DEFAULT_INVOICE_SETTINGS.currencySymbol).toBe('RD$');
      expect(DEFAULT_INVOICE_SETTINGS.copyText).toBe('*** COPIA CLIENTE ***');
      expect(DEFAULT_INVOICE_SETTINGS.fontSizeOption).toBe('normal');
      expect(DEFAULT_INVOICE_SETTINGS.showLogo).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.showNcf).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.showCustomer).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.showCashier).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.showBarcode).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.showFooter).toBe(true);
      expect(DEFAULT_INVOICE_SETTINGS.defaultCopies).toBe(1);
    });

    it('migra configuraciones antiguas sin perder campos ni lanzar errores', () => {
      // Simula datos guardados previamente en localStorage sin los campos nuevos
      const oldRaw = {
        companyName: 'MI COLMADO TEST',
        printFormat: 'ticket_58mm',
        showCustomerInfo: true,
        showBarcodeQr: false,
      };

      localStorage.setItem('mercato_invoice_settings', JSON.stringify(oldRaw));
      const loaded = getInvoiceSettings();

      expect(loaded.companyName).toBe('MI COLMADO TEST');
      // Migración de formato 58mm a paperWidth 58
      expect(loaded.paperWidth).toBe(58);
      // Migración de showBarcodeQr a showBarcode
      expect(loaded.showBarcode).toBe(false);
      // Valores por defecto seguros para los nuevos
      expect(loaded.itbisPercent).toBe(18);
      expect(loaded.currencySymbol).toBe('RD$');
      expect(loaded.copyText).toBe('*** COPIA CLIENTE ***');
      expect(loaded.fontSizeOption).toBe('normal');
    });

    it('sincroniza bidireccionalmente paperWidth con printFormat al guardar', () => {
      saveInvoiceSettings({ paperWidth: 50 });
      let current = getInvoiceSettings();
      expect(current.paperWidth).toBe(50);
      expect(current.printFormat).toBe('ticket_58mm');
      expect(current.customWidthMm).toBe(50);

      saveInvoiceSettings({ paperWidth: 80 });
      current = getInvoiceSettings();
      expect(current.paperWidth).toBe(80);
      expect(current.printFormat).toBe('ticket_80mm');
      expect(current.customWidthMm).toBe(80);
    });
  });

  describe('6. Casos Límite de Datos para la Factura Térmica', () => {
    it('soporta cliente vacío o anónimo sin fallos', () => {
      const invoiceData: InvoiceData = {
        numero: 'FAC-0001',
        fecha: '04/11/2026',
        hora: '10:00 AM',
        items: [{ cantidad: 1, descripcion: 'Pan', precioUnitario: 50, total: 50 }],
        subtotal: 50,
        impuesto: 9,
        total: 59,
        pagado: 100,
        cambio: 41,
        // Cliente omitido
      };

      expect(invoiceData.cliente).toBeUndefined();
      expect(invoiceData.numero).toBe('FAC-0001');
    });

    it('soporta facturas con más de 20 artículos sin truncamiento numérico', () => {
      const manyItems = Array.from({ length: 25 }, (_, i) => ({
        cantidad: i + 1,
        descripcion: `Producto de prueba No. ${i + 1}`,
        precioUnitario: 10 * (i + 1),
        total: (i + 1) * 10 * (i + 1),
      }));

      const totals = calculateInvoiceTotals(manyItems, 18, 0, 70000);
      expect(totals.totalArticulos).toBe(325); // suma de 1..25
      expect(totals.subtotal).toBe(55250);
      expect(totals.total).toBeGreaterThan(totals.subtotal);
      expect(totals.cambio).toBeGreaterThan(0);
    });

    it('soporta nombres comerciales de 2 líneas', () => {
      const settings: Partial<InvoiceSettings> = {
        companyName: 'SUPERMERCADO Y PROVISIONES\nEL GRAN MERCATO',
      };
      const lines = wrapText(settings.companyName, 26);
      expect(lines.length).toBe(2);
      expect(lines[0]).toBe('SUPERMERCADO Y PROVISIONES');
      expect(lines[1]).toBe('EL GRAN MERCATO');
    });
  });
});
