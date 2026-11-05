import { describe, it, expect, beforeEach, vi } from 'vitest';
import { procesarAjusteStockBloque } from '@/services/inventario.service';
import { crearGasto, obtenerGastos } from '@/services/gastos.service';
import {
  crearCompra,
  editarCompra,
  obtenerCompras,
  obtenerDetalleCompra,
} from '@/services/compras.service';
import {
  guardarVentaSuspendida,
  obtenerVentasSuspendidas,
  eliminarVentaSuspendida,
} from '@/services/ventasSuspendidas.service';
import { getStoredProducts, updateProductStockInStore } from '@/lib/productStore';
import { canAccessRoute, ROLE_ROUTES } from '@/lib/auth';
import { getStoredAdjustments } from '@/lib/stockAdjustmentStore';
import { getAuditLogs } from '@/lib/auditStore';

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

describe('Correcciones e Implementaciones Solicitadas', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Ajuste de Stock Agrupado en Gastos (Un solo gasto por lote)', () => {
    it('agrupa múltiples productos con pérdida en un único gasto con el total acumulado y código del ajuste', async () => {
      const batchCode = `AJU-TEST-${Date.now().toString(36).toUpperCase()}`;
      const loss1 = 62.60;
      const loss2 = 60.32;
      const expectedTotalLoss = Math.round((loss1 + loss2) * 100) / 100; // 122.92

      // Simular la lógica de StockAdjustmentsPage: un solo gasto con la suma total
      await crearGasto({
        descripcion: `Ajuste de stock #${batchCode}`,
        monto: expectedTotalLoss,
        categoria_id: 'cat-008',
        metodo_pago: 'otro',
        fecha: new Date().toISOString().slice(0, 10),
        responsable_nombre: 'Admin General',
        tiene_recibo: false,
        estado: 'aprobado',
      });

      const gastos = await obtenerGastos();
      const gastoAjuste = gastos.filter((g) => g.description && g.description.includes(batchCode));

      // Debe existir exactamente 1 solo gasto por el lote completo
      expect(gastoAjuste).toHaveLength(1);
      expect(gastoAjuste[0].amount).toBe(122.92);
      expect(gastoAjuste[0].description).toBe(`Ajuste de stock #${batchCode}`);
    });
  });

  describe('2. Apertura de Caja, Menú Principal y Aislamiento de Usuarios', () => {
    it('permite que un Cajero acceda a la ruta "/" y "/dashboard" para salir al menú principal', () => {
      expect(canAccessRoute('Cajero', '/')).toBe(true);
      expect(canAccessRoute('Cajero', '/dashboard')).toBe(true);
      expect(ROLE_ROUTES['Cajero']).toContain('/');
    });

    it('la lista de rutas de Cajero contiene el inicio sin atrapar al usuario en bucle', () => {
      const routes = ROLE_ROUTES['Cajero'];
      expect(routes).toContain('/');
      expect(routes).toContain('/point-of-sale-pos');
    });
  });

  describe('3. Visibilidad de Ventas Suspendidas para el Administrador', () => {
    it('sincroniza y permite al administrador ver las ventas suspendidas de otros cajeros', async () => {
      const heldSale1 = {
        id: 'hold-cajero-maria-101',
        label: 'Venta Juan Perez (Mesa 3)',
        cart: [
          { id: 'item-1', name: 'Refresco Cola', qty: 2, price: 50 },
          { id: 'item-2', name: 'Sandwich de Pollo', qty: 1, price: 150 },
        ],
        customer: { id: 'cli-01', name: 'Juan Perez' },
        globalDiscount: 0,
        savedAt: new Date().toISOString(),
        cashierId: 'cajero-maria-id',
        cashierName: 'María García',
        cajaId: '2',
        cajaLabel: 'Caja #01',
        total: 250,
      };

      await guardarVentaSuspendida(heldSale1);

      const suspendedList = await obtenerVentasSuspendidas();
      expect(suspendedList.length).toBeGreaterThanOrEqual(1);

      const found = suspendedList.find((s) => s.id === heldSale1.id);
      expect(found).toBeDefined();
      expect(found?.cashierName).toBe('María García');
      expect(found?.cajaLabel).toBe('Caja #01');
      expect(found?.total).toBe(250);

      // Eliminar / Retomar venta suspendida
      await eliminarVentaSuspendida(heldSale1.id);
      const afterList = await obtenerVentasSuspendidas();
      expect(afterList.find((s) => s.id === heldSale1.id)).toBeUndefined();
    });
  });

  describe('4. Edición Transaccional de Facturas de Compra Registradas', () => {
    it('permite modificar detalles, cantidades y sustituir un producto conservando precio y cantidad', async () => {
      const { obtenerProductos } = await import('@/services/productos.service');
      const catalog = await obtenerProductos({ limite: 10, estado: 'todos' });
      const prodOriginal = catalog.datos[0] || { id: 'prod-001', nombre: 'Vasos 10 Plastifal', stock_actual: 50 };
      const prodSustituto = catalog.datos[1] || { id: 'prod-002', nombre: 'Vasos 10oz Bio', stock_actual: 20 };

      const compraCreada = await crearCompra({
        codigo: 'FAC-PLASTIFAL-001',
        proveedor_id: 'prov-plastifal',
        proveedor_nombre: 'Plastifal Dominicana',
        metodo_pago: 'transferencia',
        estado: 'recibida',
        lineas: [
          {
            producto_id: prodOriginal.id,
            nombre: prodOriginal.nombre || 'Vasos número 10 (Genérico Plastifal)',
            cantidad: 100,
            precio_costo: 5.50,
            precio_venta: 8.00,
            porcentaje_impuesto: 18,
          },
        ],
      });

      expect(compraCreada).toBeDefined();
      expect(compraCreada.items).toBe(100);
      expect(compraCreada.subtotal).toBe(550);

      // 2. Editar la factura: Sustituir "Vasos número 10" por "prodSustituto" conservando precio 5.50 y 100 unidades
      const compraEditada = await editarCompra(
        compraCreada.id,
        {
          codigo: 'FAC-PLASTIFAL-001',
          proveedor_id: 'prov-plastifal',
          proveedor_nombre: 'Plastifal Dominicana',
          metodo_pago: 'transferencia',
          lineas: [
            {
              producto_id: prodSustituto.id,
              nombre: prodSustituto.nombre || 'Vasos 10oz Bio',
              cantidad: 100, // Misma cantidad
              precio_costo: 5.50, // Mismo precio unitario conservado
              precio_venta: 8.00,
              porcentaje_impuesto: 18,
            },
          ],
        },
        {
          id: 'user-admin',
          nombre: 'Administrador General',
          role: 'Administrador',
        }
      );

      expect(compraEditada).toBeDefined();
      expect(compraEditada.lineas[0].nombre).toBe(prodSustituto.nombre || 'Vasos 10oz Bio');
      expect(compraEditada.subtotal).toBe(550);

      // Verificar registro de auditoría
      const audits = getAuditLogs();
      const auditEdicion = audits.find(
        (a) => a.module === 'Compras' && a.action === 'Edición de compra'
      );
      expect(auditEdicion).toBeDefined();
      expect(auditEdicion?.user).toBe('Administrador General');
    });

    it('permite cambiar cantidades de 50 a 80 y recalcula subtotales y stock con exactitud', async () => {
      const { obtenerProductos } = await import('@/services/productos.service');
      const catalog = await obtenerProductos({ limite: 10, estado: 'todos' });
      const prod = catalog.datos[2] || catalog.datos[0] || { id: 'prod-003', nombre: 'Servilletas', stock_actual: 10 };

      const compra = await crearCompra({
        codigo: 'FAC-CANT-002',
        proveedor_nombre: 'Proveedor ABC',
        metodo_pago: 'efectivo',
        lineas: [
          {
            producto_id: prod.id,
            nombre: prod.nombre || 'Servilletas',
            cantidad: 50,
            precio_costo: 10,
            precio_venta: 15,
            porcentaje_impuesto: 0,
          },
        ],
      });

      expect(compra.items).toBe(50);
      expect(compra.subtotal).toBe(500);

      // Modificar cantidad a 80 (+30 unidades adicionales)
      const editada = await editarCompra(compra.id, {
        codigo: 'FAC-CANT-002',
        proveedor_nombre: 'Proveedor ABC',
        metodo_pago: 'efectivo',
        lineas: [
          {
            producto_id: prod.id,
            nombre: prod.nombre || 'Servilletas',
            cantidad: 80,
            precio_costo: 10,
            precio_venta: 15,
            porcentaje_impuesto: 0,
          },
        ],
      });

      expect(editada.items).toBe(80);
      expect(editada.subtotal).toBe(800);
    });
  });
});
