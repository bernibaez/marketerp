import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeInvoiceLookupKey,
  scoreVentaMatch,
  obtenerVentaPorNumeroFactura,
  obtenerUltimasVentasParaDevolucion,
} from '@/services/ventas.service';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as any).localStorage = new LocalStorageMock();
}

describe('Búsqueda Flexible de Facturas en Devoluciones (POS y Ventas)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('normalizeInvoiceLookupKey', () => {
    it('normaliza facturas generadas en POS (FAC-...)', () => {
      const res = normalizeInvoiceLookupKey('FAC-20261029-4F901A1C');
      expect(res.cleanUpper).toBe('FAC-20261029-4F901A1C');
      expect(res.coreCode).toBe('20261029-4F901A1C');
      expect(res.candidates).toContain('FAC-20261029-4F901A1C');
      expect(res.candidates).toContain('VEN-20261029-4F901A1C');
      expect(res.candidates).toContain('20261029-4F901A1C');
      expect(res.candidates).toContain('4F901A1C');
    });

    it('normaliza facturas de venta (VEN-... o VNT-...)', () => {
      const res = normalizeInvoiceLookupKey('VEN-20261029-0005');
      expect(res.cleanUpper).toBe('VEN-20261029-0005');
      expect(res.coreCode).toBe('20261029-0005');
      expect(res.candidates).toContain('VEN-20261029-0005');
      expect(res.candidates).toContain('FAC-20261029-0005');
      expect(res.candidates).toContain('20261029-0005');
      expect(res.candidates).toContain('0005');
    });

    it('remueve prefijos decorativos como "No.", "#", "Factura:"', () => {
      const r1 = normalizeInvoiceLookupKey('No. FAC-20261029-0001');
      expect(r1.cleanUpper).toBe('FAC-20261029-0001');
      expect(r1.coreCode).toBe('20261029-0001');

      const r2 = normalizeInvoiceLookupKey('#VEN-0042');
      expect(r2.cleanUpper).toBe('VEN-0042');
      expect(r2.coreCode).toBe('0042');

      const r3 = normalizeInvoiceLookupKey('Factura: 0001');
      expect(r3.cleanUpper).toBe('0001');
      expect(r3.coreCode).toBe('0001');
      expect(r3.candidates).toContain('FAC-0001');
      expect(r3.candidates).toContain('VEN-0001');
    });

    it('normaliza comprobantes fiscales NCF con guiones o espacios', () => {
      const res = normalizeInvoiceLookupKey('b02-00000001');
      expect(res.candidates).toContain('B0200000001');

      const res2 = normalizeInvoiceLookupKey('B01 00000042');
      expect(res2.candidates).toContain('B0100000042');
    });

    it('maneja strings vacíos o solo espacios sin lanzar error', () => {
      const res = normalizeInvoiceLookupKey('   ');
      expect(res.raw).toBe('');
      expect(res.candidates).toEqual([]);
    });
  });

  describe('scoreVentaMatch', () => {
    const posSale = {
      id: '4f901a1c-91bc-4000-8000-000000000000',
      numero_factura: 'FAC-20261029-4F901A1C',
      ncf: 'B0200000001',
    };

    const salesSale = {
      id: 'c9b0e271-9279-4d64-8fe4-d115f57ea683',
      numero_factura: 'VEN-20261029-0005',
      ncf: 'B0100000042',
    };

    it('asigna puntuación máxima (100) en coincidencia exacta', () => {
      const lookup1 = normalizeInvoiceLookupKey('FAC-20261029-4F901A1C');
      expect(scoreVentaMatch(posSale, lookup1)).toBe(100);

      const lookup2 = normalizeInvoiceLookupKey('VEN-20261029-0005');
      expect(scoreVentaMatch(salesSale, lookup2)).toBe(100);

      const lookupNcf = normalizeInvoiceLookupKey('B0200000001');
      expect(scoreVentaMatch(posSale, lookupNcf)).toBe(100);
    });

    it('permite buscar factura POS ingresando formato de venta (VEN-...)', () => {
      const lookup = normalizeInvoiceLookupKey('VEN-20261029-4F901A1C');
      const score = scoreVentaMatch(posSale, lookup);
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('permite buscar factura de venta ingresando formato POS (FAC-...)', () => {
      const lookup = normalizeInvoiceLookupKey('FAC-20261029-0005');
      const score = scoreVentaMatch(salesSale, lookup);
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('encuentra facturas por su sufijo o número sin prefijo', () => {
      const lookup1 = normalizeInvoiceLookupKey('20261029-4F901A1C');
      expect(scoreVentaMatch(posSale, lookup1)).toBeGreaterThanOrEqual(90);

      const lookup2 = normalizeInvoiceLookupKey('4F901A1C');
      expect(scoreVentaMatch(posSale, lookup2)).toBeGreaterThanOrEqual(85);

      const lookup3 = normalizeInvoiceLookupKey('0005');
      expect(scoreVentaMatch(salesSale, lookup3)).toBeGreaterThanOrEqual(85);
    });

    it('encuentra facturas por NCF con guiones', () => {
      const lookup = normalizeInvoiceLookupKey('b02-00000001');
      expect(scoreVentaMatch(posSale, lookup)).toBeGreaterThanOrEqual(95);
    });

    it('retorna 0 para facturas no relacionadas', () => {
      const lookup = normalizeInvoiceLookupKey('FAC-99999999-9999');
      expect(scoreVentaMatch(posSale, lookup)).toBe(0);
      expect(scoreVentaMatch(salesSale, lookup)).toBe(0);
    });
  });

  describe('obtenerVentaPorNumeroFactura (Integración con Ventas)', () => {
    const mockVentas = [
      {
        id: '11111111-1111-4000-8000-111111111111',
        numero_factura: 'FAC-20261029-0001',
        ncf: 'B0200000001',
        cliente_id: null,
        cliente_nombre: 'Consumidor Final',
        cajero_id: null,
        cajero_nombre: 'Cajero POS',
        monto_total: 1500,
        subtotal: 1271.19,
        monto_impuesto: 228.81,
        metodo_pago: 'efectivo',
        estado: 'completada',
        creado_en: '2026-10-29T10:00:00Z',
        detalle_ventas: [
          {
            id: 'item-1',
            venta_id: '11111111-1111-4000-8000-111111111111',
            producto_id: 'p-1',
            sku: 'SKU-001',
            nombre_item: 'Arroz Premium 10lb',
            precio_unitario: 500,
            costo_unitario: 350,
            cantidad: 3,
            subtotal: 1500,
          },
        ],
      },
      {
        id: '22222222-2222-4000-8000-222222222222',
        numero_factura: 'VEN-20261029-0002',
        ncf: 'B0100000015',
        cliente_id: null,
        cliente_nombre: 'Distribuidora San Juan',
        cajero_id: null,
        cajero_nombre: 'Ventas Oficina',
        monto_total: 8200,
        subtotal: 6949.15,
        monto_impuesto: 1250.85,
        metodo_pago: 'transferencia',
        estado: 'completada',
        creado_en: '2026-10-29T11:00:00Z',
        detalle_ventas: [
          {
            id: 'item-2',
            venta_id: '22222222-2222-4000-8000-222222222222',
            producto_id: 'p-2',
            sku: 'SKU-002',
            nombre_item: 'Aceite de Oliva 1L',
            precio_unitario: 410,
            costo_unitario: 280,
            cantidad: 20,
            subtotal: 8200,
          },
        ],
      },
      {
        id: '33333333-3333-4000-8000-333333333333',
        numero_factura: 'FAC-20261029-0003',
        ncf: null,
        cliente_id: null,
        cliente_nombre: 'Cliente Anulado',
        cajero_id: null,
        cajero_nombre: 'Cajero POS',
        monto_total: 300,
        subtotal: 254.24,
        monto_impuesto: 45.76,
        metodo_pago: 'efectivo',
        estado: 'anulada',
        creado_en: '2026-10-29T09:00:00Z',
        detalle_ventas: [],
      },
    ];

    beforeEach(() => {
      localStorage.setItem('mercato_ventas_local', JSON.stringify(mockVentas));
    });

    it('encuentra una factura de POS usando el número POS exacto (FAC-...)', async () => {
      const venta = await obtenerVentaPorNumeroFactura('FAC-20261029-0001');
      expect(venta).not.toBeNull();
      expect(venta?.numero_factura).toBe('FAC-20261029-0001');
      expect(venta?.monto_total).toBe(1500);
    });

    it('encuentra una factura de POS buscando con prefijo de venta (VEN-...)', async () => {
      const venta = await obtenerVentaPorNumeroFactura('VEN-20261029-0001');
      expect(venta).not.toBeNull();
      expect(venta?.numero_factura).toBe('FAC-20261029-0001');
    });

    it('encuentra una factura de venta usando el número de venta exacto (VEN-...)', async () => {
      const venta = await obtenerVentaPorNumeroFactura('VEN-20261029-0002');
      expect(venta).not.toBeNull();
      expect(venta?.numero_factura).toBe('VEN-20261029-0002');
      expect(venta?.cliente_nombre).toBe('Distribuidora San Juan');
    });

    it('encuentra una factura de venta buscando con prefijo POS (FAC-...)', async () => {
      const venta = await obtenerVentaPorNumeroFactura('FAC-20261029-0002');
      expect(venta).not.toBeNull();
      expect(venta?.numero_factura).toBe('VEN-20261029-0002');
    });

    it('encuentra la factura buscando solo el número o sufijo (ej: 0001 o 0002)', async () => {
      const v1 = await obtenerVentaPorNumeroFactura('0001');
      expect(v1).not.toBeNull();
      expect(v1?.numero_factura).toBe('FAC-20261029-0001');

      const v2 = await obtenerVentaPorNumeroFactura('0002');
      expect(v2).not.toBeNull();
      expect(v2?.numero_factura).toBe('VEN-20261029-0002');
    });

    it('encuentra la factura por su comprobante fiscal NCF', async () => {
      const venta = await obtenerVentaPorNumeroFactura('B0200000001');
      expect(venta).not.toBeNull();
      expect(venta?.numero_factura).toBe('FAC-20261029-0001');

      const fiscalVenta = await obtenerVentaPorNumeroFactura('B0100000015');
      expect(fiscalVenta).not.toBeNull();
      expect(fiscalVenta?.numero_factura).toBe('VEN-20261029-0002');
    });

    it('encuentra la factura con prefijos decorativos (#0001, No. VEN-0002)', async () => {
      const v1 = await obtenerVentaPorNumeroFactura('#FAC-20261029-0001');
      expect(v1).not.toBeNull();
      expect(v1?.numero_factura).toBe('FAC-20261029-0001');

      const v2 = await obtenerVentaPorNumeroFactura('No. 0002');
      expect(v2).not.toBeNull();
      expect(v2?.numero_factura).toBe('VEN-20261029-0002');
    });

    it('retorna null si la factura no existe o el término está vacío', async () => {
      const vNone = await obtenerVentaPorNumeroFactura('FAC-99999999-9999');
      expect(vNone).toBeNull();

      const vBlank = await obtenerVentaPorNumeroFactura('');
      expect(vBlank).toBeNull();
    });

    it('obtenerUltimasVentasParaDevolucion excluye facturas anuladas', async () => {
      const ultimas = await obtenerUltimasVentasParaDevolucion(10);
      expect(ultimas.length).toBe(2);
      expect(ultimas.some((v) => v.estado === 'anulada')).toBe(false);
      expect(ultimas.map((v) => v.numero_factura)).toContain('FAC-20261029-0001');
      expect(ultimas.map((v) => v.numero_factura)).toContain('VEN-20261029-0002');
    });
  });
});
