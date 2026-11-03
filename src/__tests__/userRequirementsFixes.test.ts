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
  actualizarVenta,
  anularVenta,
  eliminarVenta,
  obtenerVentaPorId,
  type ActualizarVentaPayload,
  type VentaConDetalle,
} from '@/services/ventas.service';
import {
  getStoredProducts,
  saveStoredProducts,
  type ProductItem,
} from '@/lib/productStore';
import { movimientoInventarioPresentacion } from '@/services/presentaciones.service';
import { getAuditLogsLocal } from '@/lib/auditStore';

describe('Correcciones y Requerimientos de Usuario', () => {
  beforeEach(() => {
    localStorage.clear();

    const initialProds: ProductItem[] = [
      {
        id: 'prod-cerveza-rubia',
        barcode: '7460000000001',
        sku: 'CER-RUB',
        name: 'Cerveza Rubia 350ml',
        category: 'Bebidas',
        brand: 'Presidente',
        costPrice: 80,
        salePrice: 120,
        wholesalePrice: 110,
        tax: 18,
        minStock: 10,
        currentStock: 48,
        stockStatus: 'normal',
        supplier: 'Cervecería Nacional',
        unit: 'Unidad',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
      {
        id: 'prod-cerveza-negra',
        barcode: '7460000000002',
        sku: 'CER-NEG',
        name: 'Cerveza Negra 350ml',
        category: 'Bebidas',
        brand: 'Presidente',
        costPrice: 90,
        salePrice: 130,
        wholesalePrice: 120,
        tax: 18,
        minStock: 10,
        currentStock: 30,
        stockStatus: 'normal',
        supplier: 'Cervecería Nacional',
        unit: 'Unidad',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
      {
        id: 'prod-carne-molida-base',
        barcode: '7460000000003',
        sku: 'CAR-MOL-BASE',
        name: 'Carne de Res Base (Bulk)',
        category: 'Carnes',
        brand: 'Local',
        costPrice: 150,
        salePrice: 220,
        wholesalePrice: 200,
        tax: 0,
        minStock: 20,
        currentStock: 200, // 200 lbs disponibles
        stockStatus: 'normal',
        supplier: 'Ganadera del Este',
        unit: 'Libra',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
      },
      {
        id: 'prod-sixpack-mixto',
        barcode: '7460000000004',
        sku: 'SIX-MIXTO',
        name: 'Six Pack Mixto de Cervezas',
        category: 'Bebidas',
        brand: 'Presidente',
        costPrice: 510,
        salePrice: 720,
        wholesalePrice: 680,
        tax: 18,
        minStock: 5,
        currentStock: 5,
        stockStatus: 'normal',
        supplier: 'Cervecería Nacional',
        unit: 'Six Pack',
        image: '',
        warranty: '',
        status: 'active',
        expiryDate: null,
        composite_items: [
          { product_id: 'prod-cerveza-rubia', product_name: 'Cerveza Rubia 350ml', quantity: 3 },
          { product_id: 'prod-cerveza-negra', product_name: 'Cerveza Negra 350ml', quantity: 3 },
        ],
      },
    ];

    saveStoredProducts(initialProds);
  });

  describe('Requerimiento 1: Six Packs con múltiples productos (composite items)', () => {
    it('soporta six packs compuestos con más de un producto diferente', () => {
      const prods = getStoredProducts();
      const sixPack = prods.find((p) => p.id === 'prod-sixpack-mixto');

      expect(sixPack).toBeDefined();
      expect(sixPack?.composite_items).toHaveLength(2);
      expect(sixPack?.composite_items?.[0].product_id).toBe('prod-cerveza-rubia');
      expect(sixPack?.composite_items?.[0].quantity).toBe(3);
      expect(sixPack?.composite_items?.[1].product_id).toBe('prod-cerveza-negra');
      expect(sixPack?.composite_items?.[1].quantity).toBe(3);

      const totalItems = sixPack?.composite_items?.reduce((acc, ci) => acc + ci.quantity, 0);
      expect(totalItems).toBe(6);
    });

    it('actualizar venta descuenta y ajusta el inventario de cada producto componente en un six pack mixto', async () => {
      const saleId = 'venta-sixpack-01';
      const ventaInitial: any = {
        id: saleId,
        numero_factura: 'FAC-20261103-0001',
        cliente_id: null,
        cliente_nombre: 'Cliente Mostrador',
        metodo_pago: 'efectivo',
        subtotal: 720,
        monto_impuesto: 129.6,
        monto_descuento: 0,
        monto_total: 849.6,
        costo_total: 510,
        estado: 'completada',
        creado_en: new Date().toISOString(),
        detalle_ventas: [
          {
            id: 'item-1',
            venta_id: saleId,
            producto_id: 'prod-sixpack-mixto',
            combo_id: null,
            tipo_item: 'producto',
            nombre_item: 'Six Pack Mixto de Cervezas',
            precio_unitario: 720,
            costo_unitario: 510,
            cantidad: 1, // 1 six pack vendido (descontó 3 rubias y 3 negras)
            porcentaje_impuesto: 18,
            subtotal: 720,
          },
        ],
      };
      localStorage.setItem('mercato_ventas_local', JSON.stringify([ventaInitial]));

      // Venta inicial descuenta 3 rubias (48 -> 45) y 3 negras (30 -> 27)
      const prodsBefore = getStoredProducts().map((p) => {
        if (p.id === 'prod-cerveza-rubia') return { ...p, currentStock: 45 };
        if (p.id === 'prod-cerveza-negra') return { ...p, currentStock: 27 };
        return p;
      });
      saveStoredProducts(prodsBefore);

      // Ahora el cliente modifica la venta para llevar 2 six packs en lugar de 1
      const payload: ActualizarVentaPayload = {
        subtotal: 1440,
        monto_impuesto: 259.2,
        monto_descuento: 0,
        monto_total: 1699.2,
        costo_total: 1020,
        items: [
          {
            id: 'item-1',
            producto_id: 'prod-sixpack-mixto',
            tipo_item: 'producto',
            nombre_item: 'Six Pack Mixto de Cervezas',
            precio_unitario: 720,
            costo_unitario: 510,
            cantidad: 2, // Aumenta a 2 six packs (debe descontar 3 rubias más y 3 negras más)
            porcentaje_impuesto: 18,
            subtotal: 1440,
          },
        ],
      };

      await actualizarVenta(saleId, payload);

      const prodsAfter = getStoredProducts();
      const rubia = prodsAfter.find((p) => p.id === 'prod-cerveza-rubia');
      const negra = prodsAfter.find((p) => p.id === 'prod-cerveza-negra');

      // 45 - 3 = 42
      expect(rubia?.currentStock).toBe(42);
      // 27 - 3 = 24
      expect(negra?.currentStock).toBe(24);
    });
  });

  describe('Requerimiento 3: Permitir sacar 1 libra o más de 1 libra', () => {
    it('permite deducciones fraccionarias y mayores a 1 libra desde un producto base vinculado', () => {
      const paqueteCarne5Lb = {
        id: 'prod-paquete-5lb',
        name: 'Paquete de Carne 5 Lbs',
        unit: 'Paquete',
        producto_base_id: 'prod-carne-molida-base',
        factor_conversion: 5, // Saca 5 libras del producto base de 200 lbs
      };

      const mov = movimientoInventarioPresentacion(paqueteCarne5Lb, 1);
      expect(mov.productoId).toBe('prod-carne-molida-base');
      expect(mov.cantidad).toBe(5); // Descuenta 5 libras
    });

    it('permite sacar exactamente 1 libra (factor 1) sin ser bloqueado por min=2', () => {
      const paqueteCarne1Lb = {
        id: 'prod-paquete-1lb',
        name: 'Paquete de Carne 1 Lb',
        unit: 'Paquete',
        producto_base_id: 'prod-carne-molida-base',
        factor_conversion: 1, // Saca exactamente 1 libra
      };

      const mov = movimientoInventarioPresentacion(paqueteCarne1Lb, 2); // Vende 2 paquetes de 1 lb
      expect(mov.productoId).toBe('prod-carne-molida-base');
      expect(mov.cantidad).toBe(2); // Descuenta 2 libras en total
    });

    it('permite sacar cantidades decimales de libras (ej: 2.5 lbs)', () => {
      const porcionCarne = {
        id: 'prod-porcion-2.5lb',
        name: 'Porción Familiar 2.5 Lbs',
        unit: 'Porción',
        producto_base_id: 'prod-carne-molida-base',
        factor_conversion: 2.5,
      };

      const mov = movimientoInventarioPresentacion(porcionCarne, 2); // 2 porciones de 2.5 lbs = 5 lbs
      expect(mov.productoId).toBe('prod-carne-molida-base');
      expect(mov.cantidad).toBe(5);
    });
  });

  describe('Requerimiento 4: Edición de venta sin error', () => {
    it('actualiza exitosamente una factura sin arrojar error al modificar ítems y totales', async () => {
      const saleId = 'venta-test-edit-01';
      const venta: any = {
        id: saleId,
        numero_factura: 'FAC-20261103-0002',
        cliente_id: null,
        cliente_nombre: 'Consumidor Final',
        metodo_pago: 'efectivo',
        subtotal: 240,
        monto_impuesto: 43.2,
        monto_descuento: 0,
        monto_total: 283.2,
        costo_total: 160,
        estado: 'completada',
        creado_en: new Date().toISOString(),
        detalle_ventas: [
          {
            id: 'item-cerveza-1',
            venta_id: saleId,
            producto_id: 'prod-cerveza-rubia',
            combo_id: null,
            tipo_item: 'producto',
            nombre_item: 'Cerveza Rubia 350ml',
            precio_unitario: 120,
            costo_unitario: 80,
            cantidad: 2,
            porcentaje_impuesto: 18,
            subtotal: 240,
          },
        ],
      };
      localStorage.setItem('mercato_ventas_local', JSON.stringify([venta]));

      const payload: ActualizarVentaPayload = {
        subtotal: 120,
        monto_impuesto: 21.6,
        monto_descuento: 0,
        monto_total: 141.6,
        costo_total: 80,
        items: [
          {
            id: 'item-cerveza-1',
            producto_id: 'prod-cerveza-rubia',
            tipo_item: 'producto',
            nombre_item: 'Cerveza Rubia 350ml',
            precio_unitario: 120,
            costo_unitario: 80,
            cantidad: 1, // Redujo de 2 a 1 (devuelve 1 unidad al stock)
            porcentaje_impuesto: 18,
            subtotal: 120,
          },
        ],
      };

      await expect(actualizarVenta(saleId, payload)).resolves.not.toThrow();

      const updatedSale = await obtenerVentaPorId(saleId);
      expect(updatedSale?.monto_total).toBe(141.6);
      expect(updatedSale?.detalle_ventas?.[0].cantidad).toBe(1);

      // Stock de cerveza rubia: 48 iniciales - (-1 devuelto) = 49
      const rubia = getStoredProducts().find((p) => p.id === 'prod-cerveza-rubia');
      expect(rubia?.currentStock).toBe(49);
    });
  });

  describe('Requerimiento 5: Recuperación de stock al eliminar o anular una venta', () => {
    it('restaura el stock de productos simples al anular la venta', async () => {
      const saleId = 'venta-anular-01';
      // Supongamos que se vendieron 4 cervezas rubias (stock bajó de 48 a 44)
      saveStoredProducts(
        getStoredProducts().map((p) => (p.id === 'prod-cerveza-rubia' ? { ...p, currentStock: 44 } : p))
      );

      const venta: any = {
        id: saleId,
        numero_factura: 'FAC-20261103-0003',
        cliente_id: null,
        cliente_nombre: 'Cliente Anulación',
        metodo_pago: 'efectivo',
        subtotal: 480,
        monto_impuesto: 86.4,
        monto_descuento: 0,
        monto_total: 566.4,
        costo_total: 320,
        estado: 'completada',
        creado_en: new Date().toISOString(),
        detalle_ventas: [
          {
            id: 'item-anular-1',
            venta_id: saleId,
            producto_id: 'prod-cerveza-rubia',
            combo_id: null,
            tipo_item: 'producto',
            nombre_item: 'Cerveza Rubia 350ml',
            precio_unitario: 120,
            costo_unitario: 80,
            cantidad: 4,
            porcentaje_impuesto: 18,
            subtotal: 480,
          },
        ],
      };
      localStorage.setItem('mercato_ventas_local', JSON.stringify([venta]));

      await anularVenta(saleId, 'Devolución de mercancía por cliente');

      const prod = getStoredProducts().find((p) => p.id === 'prod-cerveza-rubia');
      // Stock recuperado: 44 + 4 = 48
      expect(prod?.currentStock).toBe(48);

      const ventaAnulada = await obtenerVentaPorId(saleId);
      expect(ventaAnulada?.estado).toBe('anulada');
    });

    it('restaura el stock de los componentes individuales de un Six Pack mixto al anular/eliminar la venta', async () => {
      const saleId = 'venta-anular-sixpack';
      // Supongamos que se vendió 1 six pack mixto (3 rubias y 3 negras)
      // Stock actual: rubia 45 (48-3), negra 27 (30-3)
      saveStoredProducts(
        getStoredProducts().map((p) => {
          if (p.id === 'prod-cerveza-rubia') return { ...p, currentStock: 45 };
          if (p.id === 'prod-cerveza-negra') return { ...p, currentStock: 27 };
          return p;
        })
      );

      const venta: any = {
        id: saleId,
        numero_factura: 'FAC-20261103-0004',
        cliente_id: null,
        cliente_nombre: 'Cliente Six Pack',
        metodo_pago: 'efectivo',
        subtotal: 720,
        monto_impuesto: 129.6,
        monto_descuento: 0,
        monto_total: 849.6,
        costo_total: 510,
        estado: 'completada',
        creado_en: new Date().toISOString(),
        detalle_ventas: [
          {
            id: 'item-sixpack-1',
            venta_id: saleId,
            producto_id: 'prod-sixpack-mixto',
            combo_id: null,
            tipo_item: 'producto',
            nombre_item: 'Six Pack Mixto de Cervezas',
            precio_unitario: 720,
            costo_unitario: 510,
            cantidad: 1,
            porcentaje_impuesto: 18,
            subtotal: 720,
          },
        ],
      };
      localStorage.setItem('mercato_ventas_local', JSON.stringify([venta]));

      // Ejecutar anulación o eliminación
      await eliminarVenta(saleId, 'Factura errónea');

      const prods = getStoredProducts();
      const rubia = prods.find((p) => p.id === 'prod-cerveza-rubia');
      const negra = prods.find((p) => p.id === 'prod-cerveza-negra');

      // Ambas deben recuperar las 3 unidades que componían el six pack
      expect(rubia?.currentStock).toBe(48); // 45 + 3 = 48
      expect(negra?.currentStock).toBe(30); // 27 + 3 = 30

      const v = await obtenerVentaPorId(saleId);
      expect(v?.estado).toBe('anulada');
    });

    it('restaura el stock del producto base de carne vendida por libra', async () => {
      const saleId = 'venta-anular-carne';
      // Supongamos que se vendieron 15 lbs de carne base (stock bajó de 200 a 185)
      saveStoredProducts(
        getStoredProducts().map((p) => (p.id === 'prod-carne-molida-base' ? { ...p, currentStock: 185 } : p))
      );

      const venta: any = {
        id: saleId,
        numero_factura: 'FAC-20261103-0005',
        cliente_id: null,
        cliente_nombre: 'Carnicería',
        metodo_pago: 'efectivo',
        subtotal: 3300,
        monto_impuesto: 0,
        monto_descuento: 0,
        monto_total: 3300,
        costo_total: 2250,
        estado: 'completada',
        creado_en: new Date().toISOString(),
        detalle_ventas: [
          {
            id: 'item-carne-1',
            venta_id: saleId,
            producto_id: 'prod-carne-molida-base',
            combo_id: null,
            tipo_item: 'producto',
            nombre_item: 'Carne de Res Base (Bulk)',
            precio_unitario: 220,
            costo_unitario: 150,
            cantidad: 15, // 15 libras
            porcentaje_impuesto: 0,
            subtotal: 3300,
          },
        ],
      };
      localStorage.setItem('mercato_ventas_local', JSON.stringify([venta]));

      await anularVenta(saleId, 'Cancelación de pedido carnicería');

      const carne = getStoredProducts().find((p) => p.id === 'prod-carne-molida-base');
      // 185 + 15 = 200 lbs recuperadas
      expect(carne?.currentStock).toBe(200);
    });
  });
});
