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

import { productoAUi, obtenerProductos } from '@/services/productos.service';
import type { Producto } from '@/types/database';
import { type ProductItem } from '@/lib/productStore';
import { crearGasto, obtenerGastos, sugerirSiguienteCodigoGasto } from '@/services/gastos.service';
import { createBlockStockAdjustment, getStoredAdjustments } from '@/lib/stockAdjustmentStore';
import { procesarAjusteStockBloque } from '@/services/inventario.service';
import {
  iniciarCaja,
  guardarCierreCaja,
  calcularResumenCajaAbierta,
  cerrarTurnoCaja,
  obtenerCajaAbierta,
} from '@/services/cierresCaja.service';
import { procesarVenta } from '@/services/ventas.service';
import { saveCashClosure } from '@/lib/cashClosureStore';

describe('Verificación Exhaustiva de Requerimientos del Usuario', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. CRUD de Productos: Precios de Compra y de Venta', () => {
    it('debe mapear y mostrar tanto precio de compra (costPrice) como precio de venta (salePrice)', () => {
      const prodDb: Producto = {
        id: '99999999-9999-4999-9999-999999999999',
        codigo_barras: '740001',
        sku: '74',
        nombre: 'Cabeza de Cerdo Fresca',
        categoria: 'Carnes',
        marca: 'Mercato Fresco',
        unidad: 'lb',
        proveedor_id: null,
        precio_costo: 85.5,
        precio_venta: 130.0,
        precio_mayorista: 115.0,
        porcentaje_impuesto: 0,
        stock_minimo: 5,
        stock_actual: 28,
        es_pesado: true,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      };

      const ui = productoAUi(prodDb);
      expect(ui.costPrice).toBe(85.5);
      expect(ui.salePrice).toBe(130.0);
      expect(ui.wholesalePrice).toBe(115.0);
      expect(ui.currentStock).toBe(28);
      expect(ui.salePrice).toBeGreaterThan(ui.costPrice);
    });
  });

  describe('2. Gastos en Cajas Registradoras reflejados en Historial de Gastos', () => {
    it('debe generar códigos de gasto incrementales seguros sin colisiones', async () => {
      const codigo1 = await sugerirSiguienteCodigoGasto();
      expect(codigo1).toMatch(/^GAS-\d{3,}$/);

      const gasto1 = await crearGasto({
        categoria_id: 'cat-008',
        descripcion: 'Compra cinta para impresora POS',
        monto: 250,
        metodo_pago: 'efectivo',
        caja_id: '1',
        fecha: new Date().toISOString().slice(0, 10),
      });

      expect(gasto1.code).toBeDefined();
      expect(gasto1.amount).toBe(250);

      const historial = await obtenerGastos();
      const existe = historial.find((g) => g.id === gasto1.id || g.code === gasto1.code);
      expect(existe).toBeDefined();
      expect(existe?.amount).toBe(250);
      expect(existe?.description).toBe('Compra cinta para impresora POS');
    });

    it('sincroniza retiros de caja directamente con el historial de gastos', async () => {
      await crearGasto({
        categoria_id: 'cat-008',
        descripcion: 'Pago de mensajero entrega express',
        monto: 300,
        metodo_pago: 'efectivo',
        caja_id: '2',
        fecha: new Date().toISOString().slice(0, 10),
      });

      const gastos = await obtenerGastos();
      const gastoCaja = gastos.find((g) => g.description && g.description.includes('mensajero entrega express'));
      expect(gastoCaja).toBeDefined();
      expect(gastoCaja?.amount).toBe(300);
    });
  });

  describe('3. Ajustes de Stock: Precio Unitario, Cálculo de Pérdida Financiera y Automatización a Gastos y Kardex', () => {
    it('calcula la pérdida financiera por producto y pérdida total del lote de ajuste', () => {
      const prodCerdo: ProductItem = {
        id: 'prod-cerdo-74',
        barcode: '740001',
        name: 'CABEZA DE CERDO',
        sku: '74',
        category: 'Carnes',
        brand: '',
        unit: 'lb',
        supplier: '',
        currentStock: 28,
        minStock: 5,
        costPrice: 85.0,
        salePrice: 130.0,
        wholesalePrice: 115.0,
        tax: 0,
        image: '',
        expiryDate: null,
        warranty: 'N/A',
        status: 'active',
        stockStatus: 'normal',
      };

      const prodPollo: ProductItem = {
        id: 'prod-pollo-10',
        barcode: '100001',
        name: 'POLLO FRESCO ENTERO',
        sku: '10',
        category: 'Carnes',
        brand: '',
        unit: 'lb',
        supplier: '',
        currentStock: 50,
        minStock: 10,
        costPrice: 90.0,
        salePrice: 140.0,
        wholesalePrice: 120.0,
        tax: 0,
        image: '',
        expiryDate: null,
        warranty: 'N/A',
        status: 'active',
        stockStatus: 'normal',
      };

      const adjustmentsToApply = [
        {
          product: prodCerdo,
          newQty: 9, // Salida de 19
          reason: 'Merma / Producto dañado',
          unitPrice: 85.0,
        },
        {
          product: prodPollo,
          newQty: 45, // Salida de 5
          reason: 'Consumo interno / Muestra',
          unitPrice: 90.0,
        },
      ];

      const batch = createBlockStockAdjustment(adjustmentsToApply, 'Cheila');
      expect(batch).toHaveLength(2);
      expect(batch[0].unitPrice).toBe(85.0);
      expect(batch[0].totalLoss).toBe(19 * 85.0); // 1615
      expect(batch[1].unitPrice).toBe(90.0);
      expect(batch[1].totalLoss).toBe(5 * 90.0); // 450

      const perdidaTotalLote = batch.reduce((sum, item) => sum + (item.totalLoss || 0), 0);
      expect(perdidaTotalLote).toBe(2065.0);
    });

    it('procesa el ajuste en bloque con inventario.service registrando precio unitario y código', async () => {
      // Consultar un producto existente de la base de datos
      const { datos: productos } = await obtenerProductos({ pagina: 1, limite: 1 });
      const targetProdId = productos[0]?.id || 'prod-cerdo-74';

      const items = [
        {
          producto_id: targetProdId,
          tipo_ajuste: 'perdida' as const,
          cantidad_variacion: -19,
          cantidad_nueva: Math.max(0, (productos[0]?.stock_actual ?? 28) - 19),
          motivo: 'Merma / Producto dañado',
          precio_unitario: 85.0,
        },
      ];

      const resultado = await procesarAjusteStockBloque(items);
      expect(resultado).toBeDefined();
      expect(resultado.ajustes).toBeGreaterThanOrEqual(1);

      const adjustments = getStoredAdjustments();
      const adj = adjustments.find((a) => a.productId === targetProdId);
      if (adj) {
        expect(adj.unitPrice).toBe(85.0);
        expect(adj.totalLoss).toBe(19 * 85.0);
      }
    });
  });

  describe('4. Inicio y Cierre de Caja: Usuarios Bloqueados al Usuario Activo y Cálculo Exacto de Ventas', () => {
    it('inicia caja asignando estrictamente el usuario activo actual sin duplicar ni perder datos', async () => {
      const inicio = await iniciarCaja({
        caja_id: '4', // Caja #5 admin
        caja_label: 'Caja #5 admin',
        cajero_id: '1', // ID no-UUID de usuario administrador demo
        cajero_nombre: 'Administrador Demo',
        cajero_username: 'admin@mercato.local',
        monto_apertura: 3000,
        notes: 'Apertura de turno de prueba',
      });

      expect(inicio).toBeDefined();
      expect(inicio.caja_id).toBe('4');
      expect(inicio.monto_apertura).toBe(3000);
      expect(inicio.estado).toBe('abierta');

      const abierta = await obtenerCajaAbierta('4', '1');
      expect(abierta).toBeDefined();
      expect(abierta?.id).toBe(inicio.id);
      expect(abierta?.monto_apertura).toBe(3000);
    });

    it('calcula las ventas del turno de la caja correctamente (no muestra 0) aún si cajero_id es demo o null en Supabase', async () => {
      const now = new Date();
      const abiertaEn = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

      saveCashClosure({
        id: 'cier-admin-test',
        code: 'CC-ADMIN-01',
        cashRegisterId: '4',
        cashRegisterLabel: 'Caja #5 admin',
        userId: '1',
        userName: 'Administrador Demo',
        username: 'admin@mercato.local',
        openedAt: abiertaEn,
        closedAt: '',
        date: abiertaEn.slice(0, 10),
        baseCash: 2500,
        expectedCash: 2500,
        countedCash: 0,
        difference: 0,
        status: 'abierta',
        totalSales: 0,
        totalCash: 0,
        totalCard: 0,
        cardCount: 0,
        totalTransfer: 0,
        transferCount: 0,
        totalCheque: 0,
        chequeCount: 0,
        totalCredit: 0,
        creditCount: 0,
      });

      // Simular venta en POS para la Caja 4
      await procesarVenta({
        caja_id: '4',
        cajero_id: '1',
        cajero_nombre: 'Administrador Demo',
        subtotal: 1500,
        monto_impuesto: 0,
        monto_descuento: 0,
        monto_total: 1500,
        costo_total: 900,
        metodo_pago: 'efectivo',
        monto_pagado: 2000,
        monto_efectivo: 1500,
        monto_tarjeta: 0,
        monto_transferencia: 0,
        monto_credito: 0,
        devuelta_entregada: 500,
        items: [
          {
            producto_id: null,
            tipo_item: 'producto',
            nombre_item: 'Corte Especial',
            precio_unitario: 1500,
            costo_unitario: 900,
            cantidad: 1,
            porcentaje_impuesto: 0,
            subtotal: 1500,
          },
        ],
      });

      // Calcular el resumen de la caja activa
      const resumen = await calcularResumenCajaAbierta('4', '1');

      // Las ventas NUNCA deben mostrarse en 0
      expect(resumen.total_ventas).toBeGreaterThanOrEqual(1500);
      expect(resumen.total_efectivo).toBeGreaterThanOrEqual(1500);
      expect(resumen.monto_apertura).toBe(2500);
      // Efectivo esperado = Fondo (2500) + Ventas Efectivo (1500) = 4000
      expect(resumen.monto_esperado).toBeGreaterThanOrEqual(4000);
    });

    it('ejecuta el cierre de caja completo cuadrando efectivo esperado vs real', async () => {
      const now = new Date();
      const abiertaEn = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

      saveCashClosure({
        id: 'cier-cierre-test',
        code: 'CC-TURNO-100',
        cashRegisterId: '2',
        cashRegisterLabel: 'Caja #2 - Keyla',
        userId: '2',
        userName: 'Keyla Cajera',
        username: 'keyla@mercato.local',
        openedAt: abiertaEn,
        closedAt: '',
        date: abiertaEn.slice(0, 10),
        baseCash: 2000,
        expectedCash: 2000,
        countedCash: 0,
        difference: 0,
        status: 'abierta',
        totalSales: 0,
        totalCash: 0,
        totalCard: 0,
        cardCount: 0,
        totalTransfer: 0,
        transferCount: 0,
        totalCheque: 0,
        chequeCount: 0,
        totalCredit: 0,
        creditCount: 0,
      });

      // Venta en efectivo de 800
      await procesarVenta({
        caja_id: '2',
        cajero_id: '2',
        cajero_nombre: 'Keyla Cajera',
        subtotal: 800,
        monto_impuesto: 0,
        monto_descuento: 0,
        monto_total: 800,
        costo_total: 500,
        metodo_pago: 'efectivo',
        monto_pagado: 1000,
        monto_efectivo: 800,
        monto_tarjeta: 0,
        monto_transferencia: 0,
        monto_credito: 0,
        devuelta_entregada: 200,
        items: [
          {
            producto_id: null,
            tipo_item: 'producto',
            nombre_item: 'Queso Gouda',
            precio_unitario: 800,
            costo_unitario: 500,
            cantidad: 1,
            porcentaje_impuesto: 0,
            subtotal: 800,
          },
        ],
      });

      // Cierre con conteo físico exacto de 2,800
      const cerrado = await cerrarTurnoCaja({
        cierre_id: 'cier-cierre-test',
        caja_id: '2',
        caja_label: 'Caja #2 - Keyla',
        cajero_id: '2',
        cajero_nombre: 'Keyla Cajera',
        usuario_cierre_id: '2',
        usuario_cierre_nombre: 'Keyla Cajera',
        monto_apertura: 2000,
        monto_esperado: 2800,
        monto_real: 2800,
        monto_diferencia: 0, // Cuadre exacto
        total_ventas: 800,
        total_efectivo: 800,
        total_tarjeta: 0,
        total_transferencia: 0,
        notes: 'Cierre cuadre perfecto',
      });

      expect(cerrado.estado).toBe('cerrada');
      expect(cerrado.monto_esperado).toBe(2800);
      expect(cerrado.monto_real).toBe(2800);
      expect(cerrado.monto_diferencia).toBe(0);

      // Comprobar que ya no aparece como caja abierta
      const todaviaAbierta = await obtenerCajaAbierta('2', '2');
      expect(todaviaAbierta).toBeNull();
    });
  });
});
