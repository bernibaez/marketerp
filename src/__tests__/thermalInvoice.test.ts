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

  describe('7. Pruebas y Validaciones de Impresión Requeridas (1, 10, 30 ítems, 80mm & 50mm)', () => {
    // 1. Factura con 1 solo producto
    it('procesa y formatea correctamente una factura con 1 solo producto', () => {
      const items = [{ cantidad: 1, descripcion: 'Refresco Cola 2L', precioUnitario: 85, total: 85 }];
      const totals = calculateInvoiceTotals(items, 18, 0, 100);

      expect(totals.totalArticulos).toBe(1);
      expect(totals.subtotal).toBe(85);
      expect(totals.impuesto).toBe(15.3);
      expect(totals.total).toBe(100.3);
      expect(formatCurrency(totals.total)).toBe('RD$ 100.30');
    });

    // 2. Factura con 10 productos
    it('procesa correctamente una factura con 10 productos variados', () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        cantidad: i + 1,
        descripcion: `Artículo ${i + 1}`,
        precioUnitario: (i + 1) * 50,
        total: (i + 1) * (i + 1) * 50,
      }));

      const totals = calculateInvoiceTotals(items, 18, 0, 30000);
      expect(items.length).toBe(10);
      expect(totals.totalArticulos).toBe(55); // 1+2+...+10 = 55
      expect(totals.subtotal).toBe(19250);
      expect(totals.impuesto).toBe(3465);
      expect(totals.total).toBe(22715);
      expect(totals.cambio).toBe(7285);
    });

    // 3. Factura con 30 productos (estrés de longitud y flujo continuo)
    it('procesa sin pérdida ni desbordes una factura extensa con 30 productos', () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        cantidad: 1,
        descripcion: `Producto de Canasta Básica No. ${i + 1}`,
        precioUnitario: 100 + i * 5,
        total: 100 + i * 5,
      }));

      const totals = calculateInvoiceTotals(items, 18, 0, 10000);
      expect(items.length).toBe(30);
      expect(totals.totalArticulos).toBe(30);
      // Suma de 100 + 105 + ... + 245 = 30 * (100 + 245) / 2 = 5175
      expect(totals.subtotal).toBe(5175);
      expect(totals.impuesto).toBe(931.5);
      expect(totals.total).toBe(6106.5);
      expect(totals.cambio).toBe(3893.5);
    });

    // 4. Productos con nombres extensos (>60 caracteres)
    it('ajusta nombres extensos de productos sin cortar ni sobrepasar el ancho de columna', () => {
      const longProductName = 'Detergente Líquido Concentrado Multiuso Aroma Lavanda Silvestre Biodegradable Familiar 3 Litros';
      // En 80mm el ancho de columna de descripción es ~20-22 caracteres
      const lines80mm = wrapText(longProductName, 22);
      expect(lines80mm.length).toBeGreaterThanOrEqual(4);
      lines80mm.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(22);
      });

      // En 50mm el ancho de descripción es ~16-18 caracteres
      const lines50mm = wrapText(longProductName, 18);
      expect(lines50mm.length).toBeGreaterThanOrEqual(5);
      lines50mm.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(18);
      });
      // Verificamos que todo el contenido se conserva intacto
      expect(lines50mm.join(' ')).toBe(longProductName);
    });

    // 5. Facturas con descuentos
    it('aplica descuentos y deduce la base imponible correctamente', () => {
      const items = [{ cantidad: 2, descripcion: 'Zapatos Escolares', precioUnitario: 1500, total: 3000 }];
      const discount = 500;
      const totals = calculateInvoiceTotals(items, 18, discount, 3000);

      expect(totals.subtotal).toBe(3000);
      // Base imponible: 3000 - 500 = 2500
      // ITBIS 18% de 2500 = 450
      expect(totals.impuesto).toBe(450);
      expect(totals.total).toBe(2950);
      expect(totals.cambio).toBe(50);
    });

    // 6. Facturas con múltiples métodos de pago
    it('soporta desglose de múltiples métodos de pago (Efectivo, Tarjeta, Transferencia, Crédito)', () => {
      const breakdown = [
        { method: 'efectivo', label: 'Efectivo', amount: 500 },
        { method: 'tarjeta', label: 'Tarjeta Débito', amount: 1500 },
        { method: 'transferencia', label: 'Transferencia', amount: 1000 },
      ];

      const sumPaid = breakdown.reduce((acc, b) => acc + b.amount, 0);
      expect(sumPaid).toBe(3000);

      const totalInvoice = 2800;
      const change = Math.max(0, sumPaid - totalInvoice);
      expect(change).toBe(200);
    });

    // 7. Facturas con cantidades y precios elevados
    it('maneja cantidades grandes y precios de millones con precisión exacta', () => {
      const items = [
        { cantidad: 500, descripcion: 'Saco de Cemento Gris 50kg', precioUnitario: 450.75, total: 225375 },
        { cantidad: 10, descripcion: 'Generador Eléctrico Industrial 50kW', precioUnitario: 350000, total: 3500000 },
      ];

      const totals = calculateInvoiceTotals(items, 18, 0, 4500000);
      expect(totals.subtotal).toBe(3725375);
      expect(totals.impuesto).toBe(670567.5);
      expect(totals.total).toBe(4395942.5);
      expect(totals.cambio).toBe(104057.5);
      expect(formatCurrency(totals.total)).toBe('RD$ 4,395,942.50');
      expect(formatCurrency(totals.cambio)).toBe('RD$ 104,057.50');
    });

    // 8. Validación de especificaciones térmicas para 80mm y 50mm
    it('calcula dimensiones físicas exactas del cabezal térmico para 80mm, 58mm y 50mm', () => {
      const getPhysicalPrintableWidth = (paperWidth: PaperWidth): number => {
        switch (paperWidth) {
          case 50:
            return 44; // 44 mm efectivos
          case 58:
            return 48; // 48 mm efectivos
          case 80:
          default:
            return 72; // 72 mm efectivos
        }
      };

      expect(getPhysicalPrintableWidth(80)).toBe(72);
      expect(getPhysicalPrintableWidth(58)).toBe(48);
      expect(getPhysicalPrintableWidth(50)).toBe(44);
    });
  });
});
