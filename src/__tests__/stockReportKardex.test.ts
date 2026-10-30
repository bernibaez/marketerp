import { describe, it, expect, beforeEach, vi } from 'vitest';

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

vi.mock('@/services/clienteSupabase', () => ({
  tryGetSupabase: () => null,
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('Supabase not configured in test');
  },
}));

import {
  obtenerInformeStockGeneral,
  obtenerHistorialMovimientosProducto,
} from '@/services/informes/informesStockMovimientos.service';
import { saveStoredProducts, type ProductItem } from '@/lib/productStore';

describe('Módulo de Informes de Stock y Kardex de Movimientos', () => {
  const mockProducts: any[] = [
    {
      id: 'prod-funda-papel',
      name: 'FUNDA DE PAPEL #2',
      sku: '0071',
      barcode: '0071',
      category: 'Empaques',
      costPrice: 5,
      salePrice: 10,
      currentStock: 58,
      minStock: 10,
      unit: 'PQ',
      status: 'active',
      isWeightProduct: false,
    },
    {
      id: 'prod-agua-botella',
      name: 'Agua 500ml',
      sku: 'AGUA-500',
      barcode: '7461136665069',
      category: 'Bebidas',
      costPrice: 15,
      salePrice: 25,
      currentStock: 100,
      minStock: 20,
      unit: 'Botella',
      status: 'active',
      isWeightProduct: false,
    },
    {
      id: 'prod-agotado',
      name: 'Galletas Choco',
      sku: 'GAL-001',
      barcode: '12345678',
      category: 'Snacks',
      costPrice: 30,
      salePrice: 50,
      currentStock: 0,
      minStock: 5,
      unit: 'Unidad',
      status: 'active',
      isWeightProduct: false,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    saveStoredProducts(mockProducts);
  });

  describe('1. Informe General de Stock (Vista 1)', () => {
    it('calcula correctamente el stock de cierre de compra, venta, beneficio potencial y margen de beneficio %', async () => {
      const informe = await obtenerInformeStockGeneral();

      expect(informe.items.length).toBe(3);

      // prod-funda-papel: 58 * 5 = 290 (costo), 58 * 10 = 580 (venta)
      // prod-agua-botella: 100 * 15 = 1500 (costo), 100 * 25 = 2500 (venta)
      // prod-agotado: 0 * 30 = 0 (costo), 0 * 50 = 0 (venta)
      // Total costo: 290 + 1500 = 1790
      // Total venta: 580 + 2500 = 3080
      // Beneficio potencial: 3080 - 1790 = 1290
      // Margen de beneficio (Margen comercial sobre venta = Beneficio / Venta * 100):
      // (1290 / 3080) * 100 = 41.88% (fórmula idéntica a la Imagen 1: 1,696,392.29 / 8,579,157.25 = 19.77%)

      expect(informe.stock_cierre_compra).toBe(1790);
      expect(informe.stock_cierre_venta).toBe(3080);
      expect(informe.beneficio_potencial).toBe(1290);
      expect(informe.profit_margin_pct).toBeCloseTo(41.88, 1);
    });

    it('clasifica con precisión los estados de stock (Agotado, Bajo, OK)', async () => {
      const informe = await obtenerInformeStockGeneral();

      const agotado = informe.items.find((i) => i.id === 'prod-agotado');
      const normal = informe.items.find((i) => i.id === 'prod-agua-botella');

      expect(agotado?.estado).toBe('Agotado');
      expect(normal?.estado).toBe('OK');
      expect(informe.total_agotados).toBe(1);
    });
  });

  describe('2. Historial de Existencias y Kardex de Producto (Vista 2)', () => {
    it('obtiene el Kardex de un producto y garantiza consistencia de saldo con el stock actual', async () => {
      const kardex = await obtenerHistorialMovimientosProducto('prod-funda-papel');

      expect(kardex.producto.nombre).toBe('FUNDA DE PAPEL #2');
      expect(kardex.producto.stock_actual).toBe(58);
      expect(kardex.resumen.totales.stock_actual).toBe(58);

      // Al no haber transacciones registradas previamente, genera movimiento de apertura inicial
      expect(kardex.movimientos.length).toBeGreaterThan(0);
      const ultimoMovimiento = kardex.movimientos[0]; // Ordenado más reciente primero
      expect(ultimoMovimiento.nueva_cantidad).toBe(58);
    });

    it('reconstruye el flujo de movimientos registrando ventas como salidas y compras como entradas', async () => {
      // Simular transacciones en offline storage
      const mockVentas = [
        {
          id: 'v-100',
          numero_factura: 'B0200192523',
          ncf: 'B0200192523',
          cliente_nombre: 'Cliente Contado',
          creado_en: '2026-10-27T17:26:00Z',
        },
      ];
      const mockDetalle = [
        {
          id: 'dv-100',
          venta_id: 'v-100',
          producto_id: 'prod-funda-papel',
          cantidad: 2,
          precio_unitario: 10,
        },
      ];

      localStorage.setItem('mercato_ventas_local', JSON.stringify(mockVentas));
      localStorage.setItem('mercato_detalle_ventas_local', JSON.stringify(mockDetalle));

      const kardex = await obtenerHistorialMovimientosProducto('prod-funda-papel');

      const ventaMov = kardex.movimientos.find((m) => m.numero_referencia === 'B0200192523');
      expect(ventaMov).toBeDefined();
      expect(ventaMov?.tipo).toBe('Ventas');
      expect(ventaMov?.cambio_cantidad).toBe(-2); // Salida en negativo
      expect(ventaMov?.cliente_proveedor_info).toBe('Cliente Contado');
      expect(ventaMov?.nueva_cantidad).toBe(58); // Último saldo coincide con stock actual
    });
  });
});
