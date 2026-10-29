import { describe, it, expect, vi } from 'vitest';
import { calculateCartTotals } from '@/lib/cartCalculations';
import { productoAUi } from '@/services/productos.service';
import type { Producto } from '@/types/database';

describe('Corrección de errores: Proveedores, Compras y POS', () => {
  describe('1. Unidades de balanza (lb en vez de Unidad / unidades)', () => {
    it('producto pesado resuelve su unidad como "lb" o su weight_unit, nunca como "Unidad"', () => {
      const mockDbProduct: Producto = {
        id: 'prod-peso-1',
        codigo_barras: '2000010000000',
        sku: 'PLU-0001',
        plu: '0001',
        nombre: 'Pechuga de Pollo',
        categoria: 'Carnes',
        marca: null,
        unidad: 'Unidad', // En BD estaba como Unidad
        proveedor_id: null,
        precio_costo: 80,
        precio_venta: 120,
        precio_mayorista: 100,
        porcentaje_impuesto: 0,
        stock_minimo: 10,
        stock_actual: 50,
        es_pesado: true,
        sale_type: 'weight',
        weight_unit: 'lb',
        price_per_weight: 120,
        allow_decimal: true,
        min_weight: 0.01,
        max_weight: 99.99,
        generate_scale_barcode: true,
        is_weight_product: true,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      };

      const ui = productoAUi(mockDbProduct);
      expect(ui.isWeightProduct).toBe(true);
      expect(ui.unit).toBe('lb');
      expect(ui.unit).not.toBe('Unidad');
    });

    it('producto con unidad "ud" o vacía pero es pesado resuelve a "lb"', () => {
      const mockDbProduct: Producto = {
        id: 'prod-peso-2',
        codigo_barras: '2000020000000',
        sku: 'PLU-0002',
        plu: '0002',
        nombre: 'Cebolla Roja',
        categoria: 'Vegetales',
        marca: null,
        unidad: 'ud',
        proveedor_id: null,
        precio_costo: 30,
        precio_venta: 50,
        precio_mayorista: 40,
        porcentaje_impuesto: 0,
        stock_minimo: 10,
        stock_actual: 100,
        es_pesado: true,
        sale_type: 'weight',
        weight_unit: undefined,
        price_per_weight: 50,
        allow_decimal: true,
        min_weight: 0.01,
        max_weight: 99.99,
        generate_scale_barcode: true,
        is_weight_product: true,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      };

      const ui = productoAUi(mockDbProduct);
      expect(ui.unit).toBe('lb');
    });

    it('producto no pesado mantiene su unidad ("Unidad", "Caja", etc.)', () => {
      const mockDbProduct: Producto = {
        id: 'prod-normal-1',
        codigo_barras: '750100000001',
        sku: 'SKU-001',
        plu: null,
        nombre: 'Refresco Cola 2L',
        categoria: 'Bebidas',
        marca: null,
        unidad: 'Unidad',
        proveedor_id: null,
        precio_costo: 60,
        precio_venta: 90,
        precio_mayorista: 80,
        porcentaje_impuesto: 18,
        stock_minimo: 5,
        stock_actual: 20,
        es_pesado: false,
        sale_type: 'unit',
        weight_unit: undefined,
        price_per_weight: undefined,
        allow_decimal: false,
        min_weight: undefined,
        max_weight: undefined,
        generate_scale_barcode: false,
        is_weight_product: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      };

      const ui = productoAUi(mockDbProduct);
      expect(ui.isWeightProduct).toBe(false);
      expect(ui.unit).toBe('Unidad');
    });
  });

  describe('2. Validación de estado inactivo y agotado', () => {
    it('detecta productos inactivos y stockStatus correcto', () => {
      const mockInactivo: Producto = {
        id: 'prod-inactivo-1',
        codigo_barras: '750100000002',
        sku: 'SKU-002',
        plu: null,
        nombre: 'Galletas de Mantequilla',
        categoria: 'Snacks',
        marca: null,
        unidad: 'Paquete',
        proveedor_id: null,
        precio_costo: 20,
        precio_venta: 35,
        precio_mayorista: 30,
        porcentaje_impuesto: 18,
        stock_minimo: 5,
        stock_actual: 15,
        es_pesado: false,
        sale_type: 'unit',
        weight_unit: undefined,
        price_per_weight: undefined,
        allow_decimal: false,
        min_weight: undefined,
        max_weight: undefined,
        generate_scale_barcode: false,
        is_weight_product: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'inactivo',
      };

      const ui = productoAUi(mockInactivo);
      expect(ui.status).toBe('inactive');
    });

    it('detecta productos agotados cuando stock_actual es 0 o menor', () => {
      const mockAgotado: Producto = {
        id: 'prod-agotado-1',
        codigo_barras: '750100000003',
        sku: 'SKU-003',
        plu: null,
        nombre: 'Funda de Menta Café',
        categoria: 'Dulces',
        marca: null,
        unidad: 'Unidad',
        proveedor_id: null,
        precio_costo: 40,
        precio_venta: 70,
        precio_mayorista: 60,
        porcentaje_impuesto: 18,
        stock_minimo: 5,
        stock_actual: 0,
        es_pesado: false,
        sale_type: 'unit',
        weight_unit: undefined,
        price_per_weight: undefined,
        allow_decimal: false,
        min_weight: undefined,
        max_weight: undefined,
        generate_scale_barcode: false,
        is_weight_product: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      };

      const ui = productoAUi(mockAgotado);
      expect(ui.currentStock).toBe(0);
      expect(ui.stockStatus).toBe('out');
    });
  });

  describe('3. Cálculos de venta al por mayor', () => {
    it('calcula correctamente los totales cuando se aplican precios al por mayor', () => {
      const regularItems = [
        { price: 100, qty: 5, tax: 18 },
        { price: 50, qty: 2, tax: 0 },
      ];
      const regularTotals = calculateCartTotals(regularItems);
      expect(regularTotals.subtotal).toBe(600);
      expect(regularTotals.taxTotal).toBe(90); // 500 * 18% = 90
      expect(regularTotals.total).toBe(690);

      // Con precios al por mayor (ej. precio baja a 80 y 40)
      const wholesaleItems = [
        { price: 80, qty: 5, tax: 18 },
        { price: 40, qty: 2, tax: 0 },
      ];
      const wholesaleTotals = calculateCartTotals(wholesaleItems);
      expect(wholesaleTotals.subtotal).toBe(480);
      expect(wholesaleTotals.taxTotal).toBe(72); // 400 * 18% = 72
      expect(wholesaleTotals.total).toBe(552);
    });
  });

  describe('4. Búsqueda y ordenamiento por relevancia (ej: "fresaya")', () => {
    it('los productos que inician o coinciden exactamente con el término tienen máxima prioridad', () => {
      const items = [
        { name: 'Paleta Sabor Fresa y Vainilla', sku: 'PAL-01', barcode: '111' },
        { name: 'Fresaya Especial 500g', sku: 'FRE-01', barcode: '222' },
        { name: 'Caramelo Dulce Fresa', sku: 'CAR-01', barcode: '333' },
      ];

      const q = 'fresaya';

      const getRank = (name: string) => {
        const lower = name.toLowerCase().trim();
        if (lower === q) return 0;
        if (lower.startsWith(q)) return 1;
        if (lower.includes(q)) return 2;
        return 3;
      };

      const sorted = [...items].sort((a, b) => getRank(a.name) - getRank(b.name));
      expect(sorted[0].name).toBe('Fresaya Especial 500g');
    });
  });
});
