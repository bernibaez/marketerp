import { describe, it, expect } from 'vitest';
import { applyPresentationConversions } from '@/services/productos.service';
import { calcularStockPresentacion, convertirAUnidadBase } from '@/services/presentaciones.service';
import type { Producto } from '@/types/database';

describe('Requerimientos 2 y 6: Unidades de Medida, Conversión y Fardo de Agua', () => {
  it('resuelve el stock dinámico de Fardo De Agua Pureza Sana a partir del inventario de Botella De Agua', () => {
    const rawProducts: Producto[] = [
      {
        id: 'botella-agua-pureza-sana-id',
        codigo_barras: '7461136665069',
        sku: '7461136665069',
        nombre: 'Botella De Agua Pureza Sana',
        categoria: 'Bebidas',
        marca: 'Pureza Sana',
        unidad: 'Botella',
        proveedor_id: null,
        precio_costo: 5.36,
        precio_venta: 10,
        precio_mayorista: 9,
        porcentaje_impuesto: 0,
        stock_minimo: 100,
        stock_actual: 3700, // 3,700 botellas registradas
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      },
      {
        id: 'fardo-agua-pureza-sana-id',
        codigo_barras: '23653',
        sku: '23653',
        nombre: 'Fardo De Agua Pureza Sana',
        categoria: 'Bebidas',
        marca: 'Pureza Sana',
        unidad: 'Fardo',
        proveedor_id: null,
        precio_costo: 107.14,
        precio_venta: 125,
        precio_mayorista: 120,
        porcentaje_impuesto: 0,
        stock_minimo: 5,
        stock_actual: 0, // En BD aparecía como 0
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      },
    ];

    const converted = applyPresentationConversions(rawProducts);
    const fardo = converted.find((p) => p.sku === '23653');
    expect(fardo).toBeDefined();

    // 3,700 botellas / 20 = 185 fardos disponibles!
    expect(fardo?.stock_actual).toBe(185);
    expect(fardo?.stock_actual).toBeGreaterThan(0);
    // No debe aparecer agotado
    expect(fardo?.stock_actual).not.toBe(0);
  });

  it('resuelve la conversión de presentación de Huevos (1 Cartón = 2 Medios Cartones)', () => {
    const rawProducts: Producto[] = [
      {
        id: 'huevo-medio-carton-id',
        codigo_barras: '0685',
        sku: '0685',
        nombre: 'HUEVOS MEDIO CARTON',
        categoria: 'Víveres y Granja',
        marca: 'Granja',
        unidad: 'Medio cartón',
        proveedor_id: null,
        precio_costo: 85,
        precio_venta: 105,
        precio_mayorista: 100,
        porcentaje_impuesto: 0,
        stock_minimo: 10,
        stock_actual: 43, // 43 medios cartones
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      },
      {
        id: 'huevo-1-carton-id',
        codigo_barras: '0686',
        sku: '0686',
        nombre: 'HUEVOS 1 CARTON',
        categoria: 'Víveres y Granja',
        marca: 'Granja',
        unidad: 'Cartón',
        proveedor_id: null,
        precio_costo: 170,
        precio_venta: 205,
        precio_mayorista: 195,
        porcentaje_impuesto: 0,
        stock_minimo: 5,
        stock_actual: 0,
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      },
    ];

    const converted = applyPresentationConversions(rawProducts);
    const carton = converted.find((p) => p.sku === '0686');
    expect(carton).toBeDefined();

    // 43 medios cartones / 2 = 21 cartones enteros disponibles
    expect(carton?.stock_actual).toBe(21);
    expect(carton?.stock_actual).toBeGreaterThan(0);
  });

  it('calcula conversiones exactas en compras y ventas sin errores de redondeo', () => {
    // Caso compra especificado por el usuario:
    // Compra 100 cartones de huevo, factor 2 -> ingresan 200 medios cartones
    const unidadesCompradasCartones = 100;
    const factorCartonHuevo = 2;
    const unidadesIngresadas = convertirAUnidadBase(unidadesCompradasCartones, factorCartonHuevo);
    expect(unidadesIngresadas).toBe(200);

    // Caso venta especificado por el usuario:
    // Venta de 1 cartón -> descuenta 2 medios cartones
    expect(convertirAUnidadBase(1, factorCartonHuevo)).toBe(2);
    // Venta de 3 cartones -> descuenta 6 medios cartones
    expect(convertirAUnidadBase(3, factorCartonHuevo)).toBe(6);

    // Venta de 1 fardo de agua (factor 20) -> descuenta 20 botellas
    expect(convertirAUnidadBase(1, 20)).toBe(20);
    // Venta de 5 fardos de agua (factor 20) -> descuenta 100 botellas
    expect(convertirAUnidadBase(5, 20)).toBe(100);

    // Cálculo inverso de existencias:
    // Con 3,700 botellas y factor 20:
    expect(calcularStockPresentacion(3700, 20)).toBe(185);
    // Con 3,719 botellas y factor 20:
    expect(calcularStockPresentacion(3719, 20)).toBe(185);
  });
});
