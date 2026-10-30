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

import { actualizarVenta } from '@/services/ventas.service';
import { getStoredProducts, saveStoredProducts, type ProductItem } from '@/lib/productStore';
import { getAuditLogsLocal } from '@/lib/auditStore';

describe('Requerimiento 1: Edición de Ventas e Inventario Delta', () => {
  beforeEach(() => {
    localStorage.clear();

    const prods: ProductItem[] = [
      {
        id: 'prod-001',
        barcode: '7461111111111',
        sku: 'SKU-001',
        name: 'Arroz Premium 10 lb',
        category: 'Granos',
        brand: 'Bisonó',
        costPrice: 300,
        salePrice: 400,
        wholesalePrice: 380,
        tax: 0,
        minStock: 10,
        currentStock: 50,
        stockStatus: 'normal',
        supplier: 'Distribuidora',
        unit: 'Unidad',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
      {
        id: 'prod-002',
        barcode: '7462222222222',
        sku: 'SKU-002',
        name: 'Aceite Vegetal 64 oz',
        category: 'Aceites',
        brand: 'Crisol',
        costPrice: 200,
        salePrice: 250,
        wholesalePrice: 240,
        tax: 18,
        minStock: 5,
        currentStock: 30,
        stockStatus: 'normal',
        supplier: 'Distribuidora',
        unit: 'Unidad',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
      {
        id: 'prod-003',
        barcode: '7463333333333',
        sku: 'SKU-003',
        name: 'Leche Evaporada 315g',
        category: 'Lácteos',
        brand: 'Carnation',
        costPrice: 60,
        salePrice: 75,
        wholesalePrice: 70,
        tax: 0,
        minStock: 20,
        currentStock: 100,
        stockStatus: 'normal',
        supplier: 'Distribuidora',
        unit: 'Unidad',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
    ];

    saveStoredProducts(prods);

    const initialSale = {
      id: 'sale-test-001',
      numero_factura: 'FAC-2026-0001',
      cliente_id: 'cli-001',
      cliente_nombre: 'Juan Pérez',
      metodo_pago: 'efectivo',
      tipo_ncf: 'B02',
      ncf: 'B0200000001',
      subtotal: 900,
      monto_impuesto: 90,
      monto_descuento: 0,
      monto_total: 990,
      costo_total: 700,
      estado: 'completada',
      creado_en: '2026-10-29T10:00:00.000Z',
      detalle_ventas: [
        {
          id: 'item-1',
          venta_id: 'sale-test-001',
          producto_id: 'prod-001',
          combo_id: null,
          tipo_item: 'producto' as const,
          nombre_item: 'Arroz Premium 10 lb',
          precio_unitario: 400,
          costo_unitario: 300,
          cantidad: 1,
          porcentaje_impuesto: 0,
          subtotal: 400,
        },
        {
          id: 'item-2',
          venta_id: 'sale-test-001',
          producto_id: 'prod-002',
          combo_id: null,
          tipo_item: 'producto' as const,
          nombre_item: 'Aceite Vegetal 64 oz',
          precio_unitario: 250,
          costo_unitario: 200,
          cantidad: 2,
          porcentaje_impuesto: 18,
          subtotal: 500,
        },
      ],
    };

    localStorage.setItem('mercato_ventas_local', JSON.stringify([initialSale]));
  });

  it('ajusta el stock por la diferencia (delta) al incrementar y reducir cantidades', async () => {
    const productsBefore = getStoredProducts();
    expect(productsBefore.find((p) => p.id === 'prod-001')?.currentStock).toBe(50);
    expect(productsBefore.find((p) => p.id === 'prod-002')?.currentStock).toBe(30);

    // Editamos la venta:
    // prod-001: pasa de 1 a 3 (delta = +2 unidades vendidas -> stock debe bajar de 50 a 48)
    // prod-002: pasa de 2 a 1 (delta = -1 unidad vendida -> stock debe subir de 30 a 31)
    await actualizarVenta('sale-test-001', {
      cliente_id: 'cli-002',
      cliente_nombre: 'María Gómez',
      metodo_pago: 'tarjeta',
      subtotal: 1450,
      monto_impuesto: 45,
      monto_descuento: 50,
      monto_total: 1445,
      items: [
        {
          id: 'item-1',
          producto_id: 'prod-001',
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Arroz Premium 10 lb',
          precio_unitario: 400,
          costo_unitario: 300,
          cantidad: 3,
          porcentaje_impuesto: 0,
          subtotal: 1200,
        },
        {
          id: 'item-2',
          producto_id: 'prod-002',
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Aceite Vegetal 64 oz',
          precio_unitario: 250,
          costo_unitario: 200,
          cantidad: 1,
          porcentaje_impuesto: 18,
          subtotal: 250,
        },
      ],
      usuario_modificador_nombre: 'Admin Auditor',
    });

    const productsAfter = getStoredProducts();
    // prod-001: 50 - 2 = 48
    expect(productsAfter.find((p) => p.id === 'prod-001')?.currentStock).toBe(48);
    // prod-002: 30 + 1 = 31
    expect(productsAfter.find((p) => p.id === 'prod-002')?.currentStock).toBe(31);
  });

  it('restaura el stock cuando se elimina un producto de la venta y descuenta producto nuevo', async () => {
    // Editamos la venta:
    // prod-002 eliminado (pasa de 2 a 0 -> stock debe restaurarse de 30 a 32)
    // prod-003 agregado con 4 unidades (stock debe bajar de 100 a 96)
    await actualizarVenta('sale-test-001', {
      subtotal: 700,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 700,
      items: [
        {
          id: 'item-1',
          producto_id: 'prod-001',
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Arroz Premium 10 lb',
          precio_unitario: 400,
          costo_unitario: 300,
          cantidad: 1,
          porcentaje_impuesto: 0,
          subtotal: 400,
        },
        {
          id: 'item-3',
          producto_id: 'prod-003',
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Leche Evaporada 315g',
          precio_unitario: 75,
          costo_unitario: 60,
          cantidad: 4,
          porcentaje_impuesto: 0,
          subtotal: 300,
        },
      ],
      usuario_modificador_nombre: 'Admin Auditor',
    });

    const productsAfter = getStoredProducts();
    // prod-001 sin cambios -> 50
    expect(productsAfter.find((p) => p.id === 'prod-001')?.currentStock).toBe(50);
    // prod-002 eliminado -> 30 + 2 = 32
    expect(productsAfter.find((p) => p.id === 'prod-002')?.currentStock).toBe(32);
    // prod-003 nuevo -> 100 - 4 = 96
    expect(productsAfter.find((p) => p.id === 'prod-003')?.currentStock).toBe(96);
  });

  it('registra un evento de auditoría con el usuario responsable y los cambios realizados', async () => {
    await actualizarVenta('sale-test-001', {
      cliente_id: 'cli-003',
      cliente_nombre: 'Supermercado Central',
      subtotal: 1000,
      monto_total: 1000,
      items: [
        {
          id: 'item-1',
          producto_id: 'prod-001',
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Arroz Premium 10 lb',
          precio_unitario: 500,
          costo_unitario: 300,
          cantidad: 2,
          porcentaje_impuesto: 0,
          subtotal: 1000,
        },
      ],
      usuario_modificador_nombre: 'Supervisor Carlos',
    });

    const auditLogs = getAuditLogsLocal();
    expect(auditLogs.length).toBeGreaterThan(0);
    const saleEditLog = auditLogs.find((l) => l.action === 'Edición de venta');
    expect(saleEditLog).toBeDefined();
    expect(saleEditLog?.user).toBe('Supervisor Carlos');
    expect(saleEditLog?.details).toContain('FAC-2026-0001');
    expect(saleEditLog?.details).toContain('Supervisor Carlos');
  });
});
