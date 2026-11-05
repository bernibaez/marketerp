import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  obtenerMetricasDashboard,
  getRangoFechasPeriodo,
  getEffectiveSaleTotal,
  obtenerTendenciaVentas,
  obtenerTopProductosVendidos,
} from '@/services/dashboard.service';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
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

describe('Dashboard Metrics Accuracy & Bug Diagnosis', () => {
  beforeEach(() => {
    const mockStorage = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. getRangoFechasPeriodo handles local start of day correctly without UTC early cutoff', () => {
    const rangeHoy = getRangoFechasPeriodo('hoy');
    expect(rangeHoy.desde.getHours()).toBe(0);
    expect(rangeHoy.desde.getMinutes()).toBe(0);
    expect(rangeHoy.desde.getSeconds()).toBe(0);
    expect(rangeHoy.hasta.getTime()).toBeGreaterThanOrEqual(rangeHoy.desde.getTime());

    const rangeSemana = getRangoFechasPeriodo('semana');
    expect(rangeSemana.desde.getDay()).toBe(1); // Monday
    expect(rangeSemana.desde.getHours()).toBe(0);

    const rangeMes = getRangoFechasPeriodo('mes');
    expect(rangeMes.desde.getDate()).toBe(1);
    expect(rangeMes.desde.getHours()).toBe(0);
  });

  it('2. getEffectiveSaleTotal handles various formats of sale totals', () => {
    // Normal total
    expect(getEffectiveSaleTotal({ monto_total: 1500 })).toBe(1500);

    // Missing monto_total (0), reconstructed from subtotal + tax - discount
    expect(
      getEffectiveSaleTotal({
        monto_total: 0,
        subtotal: 1000,
        monto_impuesto: 180,
        monto_descuento: 50,
      })
    ).toBe(1130);

    // Fallback to monto_pagado
    expect(getEffectiveSaleTotal({ monto_total: 0, subtotal: 0, monto_pagado: 2500 })).toBe(2500);

    // Fallback to split payment methods sum
    expect(
      getEffectiveSaleTotal({
        monto_total: 0,
        subtotal: 0,
        monto_efectivo: 300,
        monto_tarjeta: 700,
      })
    ).toBe(1000);
  });

  it('3. Diagnoses and fixes the 10 mil error: sums all daytime sales + evening sales, ignores anuladas', async () => {
    const today = new Date();
    const morningDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30, 0);
    const afternoonDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 15, 0);
    const eveningDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 5, 0);

    const mockVentas = [
      {
        id: 'v-morning-1',
        numero_factura: 'FAC-001',
        monto_total: 45000,
        costo_total: 30000,
        creado_en: morningDate.toISOString(),
        estado: 'completada',
      },
      {
        id: 'v-afternoon-1',
        numero_factura: 'FAC-002',
        monto_total: 25000,
        costo_total: 15000,
        creado_en: afternoonDate.toISOString(),
        estado: 'pagada',
      },
      {
        id: 'v-evening-1',
        numero_factura: 'FAC-003',
        monto_total: 10000, // This is the 10 mil sale that was the ONLY one showing due to UTC 8 PM cut-off!
        costo_total: 6000,
        creado_en: eveningDate.toISOString(),
        estado: 'completada',
      },
      {
        id: 'v-cancelled-1',
        numero_factura: 'FAC-004',
        monto_total: 50000,
        costo_total: 35000,
        creado_en: afternoonDate.toISOString(),
        estado: 'anulada', // Must be ignored
      },
    ];

    localStorage.setItem('mercato_ventas_local', JSON.stringify(mockVentas));

    const metrics = await obtenerMetricasDashboard('hoy');

    // Expected total: 45,000 + 25,000 + 10,000 = 80,000 (NOT just 10,000!)
    expect(metrics.ventas_total).toBe(80000);
    expect(metrics.ventas_count).toBe(3);
    expect(metrics.costo_total).toBe(51000); // 30,000 + 15,000 + 6,000
    expect(metrics.ganancia_bruta).toBe(29000); // 80,000 - 51,000
    expect(metrics.ticket_promedio).toBeCloseTo(80000 / 3, 2);
  });

  it('4. obtenerTendenciaVentas correctly groups sales across 7 days with local calendar date mapping', async () => {
    const today = new Date();
    const mockVentas = [
      {
        id: 'v-today-1',
        monto_total: 12000,
        creado_en: today.toISOString(),
        estado: 'completada',
      },
      {
        id: 'v-today-2',
        monto_total: 8000,
        creado_en: today.toISOString(),
        estado: 'completada',
      },
    ];
    localStorage.setItem('mercato_ventas_local', JSON.stringify(mockVentas));

    const trend = await obtenerTendenciaVentas(7);
    expect(trend).toHaveLength(7);
    const lastDay = trend[trend.length - 1];
    expect(lastDay.ventas).toBe(20000); // 12,000 + 8,000
  });

  it('5. obtenerTopProductosVendidos aggregates items accurately', async () => {
    const mockVentas = [
      {
        id: 'v-1',
        estado: 'completada',
        detalle_ventas: [
          { nombre_item: 'Arroz Selecto', subtotal: 3500, cantidad: 10 },
          { nombre_item: 'Aceite Crisol', subtotal: 1200, cantidad: 4 },
        ],
      },
      {
        id: 'v-2',
        estado: 'completada',
        detalle_ventas: [
          { nombre_item: 'Arroz Selecto', subtotal: 1500, cantidad: 5 },
          { nombre_item: 'Pollo Fresco', subtotal: 4500, cantidad: 20 },
        ],
      },
    ];
    localStorage.setItem('mercato_ventas_local', JSON.stringify(mockVentas));

    const top = await obtenerTopProductosVendidos(5);
    expect(top).toHaveLength(3);
    // Arroz Selecto: 3500 + 1500 = 5000
    // Pollo Fresco: 4500
    // Aceite Crisol: 1200
    expect(top[0].name).toBe('Arroz Selecto');
    expect(top[0].ventas).toBe(5000);
    expect(top[1].name).toBe('Pollo Fresco');
    expect(top[1].ventas).toBe(4500);
    expect(top[2].name).toBe('Aceite Crisol');
    expect(top[2].ventas).toBe(1200);
  });
});

