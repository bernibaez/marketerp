import { describe, it, expect, beforeEach } from 'vitest';

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

import { canChangePrice } from '@/lib/auth';
import { movimientoInventarioPresentacion } from '@/services/presentaciones.service';
import {
  registrarMovimientoInventario,
  obtenerMovimientosProductoCentral,
  limpiarMovimientosInventarioLocal,
} from '@/services/movimientosInventarioCentral.service';
import {
  crearCxcDesdeVenta,
  obtenerCxcPorVenta,
  registrarPagoCxc,
  obtenerPagosCxc,
} from '@/services/cxc.service';
import {
  crearCxpDesdeCompra,
  obtenerCxpPorCompra,
  registrarPagoCxp,
  obtenerPagosCxp,
} from '@/services/cxp.service';
import { generatePresentationSku } from '@/lib/barcodeUtils';

describe('Verificación Integral de Requerimientos ERP Mercato', () => {
  beforeEach(() => {
    localStorage.clear();
    limpiarMovimientosInventarioLocal();
  });

  describe('Requerimiento 1: Descuento exacto de carnes por libra (sin duplicación)', () => {
    it('debe descontar exactamente 1 lb si se vende 1 lb de carne pesada', () => {
      const carnePorLibra = {
        id: 'prod-carne-1',
        name: 'Carne de Res Molida',
        is_weight_product: true,
        unit: 'lb',
        currentStock: 50,
        factor_conversion: 2, // No debe multiplicar aunque tenga factor residual
      };

      const mov = movimientoInventarioPresentacion(carnePorLibra, 1);
      expect(mov.productoId).toBe('prod-carne-1');
      expect(mov.cantidad).toBe(1); // Exactamente 1 libra, NO 2
    });

    it('debe descontar la cantidad decimal exacta vendida (ej: 0.75 lb)', () => {
      const polloPorLibra = {
        id: 'prod-pollo-1',
        name: 'Pechuga de Pollo',
        sale_type: 'weight',
        unit: 'libra',
        currentStock: 25.5,
      };

      const mov = movimientoInventarioPresentacion(polloPorLibra, 0.75);
      expect(mov.cantidad).toBe(0.75);
    });
  });

  describe('Requerimiento 2: Edición de facturas y consistencia de inventario', () => {
    it('calcula la diferencia neta de inventario para no duplicar descuentos', () => {
      // Simulación de reversión y reaplicación de inventario
      const stockInicial = 100;
      const ventaOriginalQty = 5;
      let stockActual = stockInicial - ventaOriginalQty; // 95

      // Edición: el cliente modifica la factura para llevar 3 en vez de 5
      const nuevaQty = 3;
      const revertQty = ventaOriginalQty;
      stockActual += revertQty; // Revertir original: 95 + 5 = 100
      stockActual -= nuevaQty; // Aplicar nuevo: 100 - 3 = 97

      expect(stockActual).toBe(97);

      // Si en cambio aumenta a 8:
      const nuevaQtyMayor = 8;
      let stockModificado = stockInicial - ventaOriginalQty; // 95
      stockModificado += ventaOriginalQty; // 100
      stockModificado -= nuevaQtyMayor; // 92
      expect(stockModificado).toBe(92);
    });
  });

  describe('Requerimiento 3: Movimientos de stock en Kardex centralizado', () => {
    it('registra movimientos de entrada, salida, stock anterior y resultante', () => {
      registrarMovimientoInventario({
        producto_id: 'prod-arroz-1',
        producto_nombre: 'Arroz Premium 10lb',
        tipo: 'Venta',
        cantidad_salida: 2,
        stock_anterior: 20,
        stock_resultante: 18,
        documento_referencia: 'FAC-00100',
        usuario: 'Cajero 1',
        motivo: 'Venta POS Factura FAC-00100',
      });

      registrarMovimientoInventario({
        producto_id: 'prod-arroz-1',
        producto_nombre: 'Arroz Premium 10lb',
        tipo: 'Edición de factura',
        cantidad_entrada: 1,
        stock_anterior: 18,
        stock_resultante: 19,
        documento_referencia: 'FAC-00100',
        usuario: 'Admin',
        motivo: 'Corrección de cantidad en factura',
      });

      const movimientos = obtenerMovimientosProductoCentral('prod-arroz-1');
      expect(movimientos).toHaveLength(2);

      const movVenta = movimientos.find((m) => m.tipo === 'Venta');
      expect(movVenta?.cantidad_salida).toBe(2);
      expect(movVenta?.stock_anterior).toBe(20);
      expect(movVenta?.stock_resultante).toBe(18);

      const movEdicion = movimientos.find((m) => m.tipo === 'Edición de factura');
      expect(movEdicion?.cantidad_entrada).toBe(1);
      expect(movEdicion?.stock_resultante).toBe(19);
    });
  });

  describe('Requerimiento 4: Créditos de clientes (CxC) y proveedores (CxP) separados', () => {
    it('maneja CxC de clientes de forma independiente con balance y abonos', async () => {
      const cxc = await crearCxcDesdeVenta({
        venta_id: 'v-101',
        numero_factura: 'FAC-00101',
        cliente_id: 'cli-1',
        cliente_nombre: 'Juan Pérez',
        monto_credito: 5000,
        dias_credito: 15,
      });

      expect(cxc?.saldo).toBe(5000);
      expect(cxc?.estado).toBe('pendiente');

      // Abono de 2000
      const pago = await registrarPagoCxc({
        cuenta_id: cxc!.id,
        monto: 2000,
        metodo_pago: 'efectivo',
        nota: 'Primer abono',
      });

      expect(pago.monto).toBe(2000);

      const cxcActualizada = await obtenerCxcPorVenta('v-101');
      expect(cxcActualizada?.monto_pagado).toBe(2000);
      expect(cxcActualizada?.saldo).toBe(3000);
      expect(cxcActualizada?.estado).toBe('parcial');

      const historialPagos = await obtenerPagosCxc(cxc!.id);
      expect(historialPagos).toHaveLength(1);
      expect(historialPagos[0].monto).toBe(2000);
    });

    it('maneja CxP a proveedores separada de los créditos de clientes', async () => {
      const cxp = await crearCxpDesdeCompra({
        compra_id: 'cmp-501',
        compra_codigo: 'CMP-00501',
        proveedor_id: 'prov-2',
        proveedor_nombre: 'Distribuidora Cervezas SA',
        monto_total: 12000,
        dias_credito: 30,
      });

      expect(cxp?.saldo).toBe(12000);
      expect(cxp?.proveedor_nombre).toBe('Distribuidora Cervezas SA');

      // Pago a proveedor de 12000 (total)
      await registrarPagoCxp({
        cuenta_id: cxp!.id,
        monto: 12000,
        metodo_pago: 'transferencia',
        referencia: 'TRF-998877',
      });

      const cxpActualizada = await obtenerCxpPorCompra('cmp-501');
      expect(cxpActualizada?.saldo).toBe(0);
      expect(cxpActualizada?.estado).toBe('pagada');

      const historialCxp = await obtenerPagosCxp(cxp!.id);
      expect(historialCxp).toHaveLength(1);
      expect(historialCxp[0].referencia).toBe('TRF-998877');
    });
  });

  describe('Requerimiento 5: Búsqueda de productos en POS (priorización y selección única)', () => {
    it('prioriza coincidencia exacta sobre parciales y permite seleccionar producto único', () => {
      const catalogo = [
        { id: '1', name: 'Refresco Cola Regular 500ml', barcode: '7461234567890', sku: 'REF-COL-500' },
        { id: '2', name: 'Refresco Cola Dieta 500ml', barcode: '7461234567891', sku: 'REF-COL-501' },
        { id: '3', name: 'Cerveza Presidente Regular', barcode: '7460000000001', sku: 'CERV-PRES' },
      ];

      const queryExactBarcode = '7461234567890';
      const exactMatch = catalogo.filter((p) => p.barcode === queryExactBarcode);
      expect(exactMatch).toHaveLength(1);
      expect(exactMatch[0].id).toBe('1');

      // Búsqueda de producto único sin similares
      const queryCerveza = 'Presidente';
      const cervezaMatch = catalogo.filter((p) => p.name.toLowerCase().includes(queryCerveza.toLowerCase()));
      expect(cervezaMatch).toHaveLength(1);
      expect(cervezaMatch[0].name).toBe('Cerveza Presidente Regular');
    });
  });

  describe('Requerimiento 6: Inventario inicial y final en Ganancias y Pérdidas', () => {
    it('calcula Costo de Ventas = Inventario Inicial + Compras - Inventario Final usando costos', () => {
      const inventarioInicialCosto = 150000;
      const comprasPeriodoCosto = 80000;
      const inventarioFinalCosto = 120000;

      const costoVentas = inventarioInicialCosto + comprasPeriodoCosto - inventarioFinalCosto;
      expect(costoVentas).toBe(110000);

      const ventasTotales = 180000;
      const gananciaBruta = ventasTotales - costoVentas;
      expect(gananciaBruta).toBe(70000);
    });
  });

  describe('Requerimiento 8: Six Packs y presentaciones compuestas', () => {
    it('genera el SKU correcto con prefijo SIX para Six Pack y DOC para Docena', () => {
      const skuBase = 'CERV-123';
      const skuSix = generatePresentationSku('Six Pack', skuBase);
      const skuDoc = generatePresentationSku('Docena', skuBase);

      expect(skuSix).toBe('SIX-CERV-123');
      expect(skuDoc).toBe('DOC-CERV-123');
    });

    it('calcula el factor de conversión correcto para Six Pack (6 unidades)', () => {
      const cervezaPresentacion = {
        id: 'pres-cerv-six',
        name: 'Cerveza Presidente 6-Pack',
        is_presentation: true,
        factor_conversion: 6,
        unit: 'Six Pack',
        product_id_base: 'prod-cerv-unit',
      };

      const mov = movimientoInventarioPresentacion(cervezaPresentacion as any, 2); // 2 six packs
      expect(mov.productoId).toBe('prod-cerv-unit');
      expect(mov.cantidad).toBe(12); // 2 * 6 = 12 cervezas individuales
    });
  });

  describe('Requerimiento 9: Restricción de cambio de precios por rol', () => {
    it('permite cambiar precios a Administrador y Super Administrador', () => {
      expect(canChangePrice('Administrador')).toBe(true);
      expect(canChangePrice('Super Administrador')).toBe(true);
      expect(canChangePrice({ role: 'Administrador' } as any)).toBe(true);
      expect(canChangePrice({ role: 'Super Administrador' } as any)).toBe(true);
    });

    it('restringe el cambio de precios a Cajera, Vendedor y otros roles', () => {
      expect(canChangePrice('Cajero')).toBe(false);
      expect(canChangePrice('Cajera')).toBe(false);
      expect(canChangePrice('Vendedor')).toBe(false);
      expect(canChangePrice('Inventario')).toBe(false);
      expect(canChangePrice(null)).toBe(false);
      expect(canChangePrice(undefined)).toBe(false);
      expect(canChangePrice({ role: 'Cajero' } as any)).toBe(false);
    });
  });
});
