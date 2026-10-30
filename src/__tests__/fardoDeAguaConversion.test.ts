import { describe, it, expect } from 'vitest';
import { applyPresentationConversions } from '@/services/productos.service';
import {
  calcularStockPresentacion,
  convertirAUnidadBase,
  movimientoInventarioPresentacion,
} from '@/services/presentaciones.service';
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

  it('permite productos independientes con unidad Fardo o Cartón sin requerir vinculación', () => {
    // Caso de uso solicitado por el usuario:
    // Si un producto se crea con unidad "Fardo" pero NO está vinculado a ningún producto base (producto_base_id = null):
    const fardoIndependiente: Producto = {
      id: 'fardo-refresco-independiente-id',
      codigo_barras: '7469998881112',
      sku: 'FAR-REF-IND',
      nombre: 'Fardo de Refresco 2L (Autónomo)',
      categoria: 'Bebidas',
      marca: 'Refresco Marca',
      unidad: 'Fardo',
      proveedor_id: null,
      precio_costo: 350,
      precio_venta: 450,
      precio_mayorista: 420,
      porcentaje_impuesto: 18,
      stock_minimo: 10,
      stock_actual: 50, // 50 fardos en stock independiente
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
      producto_base_id: null, // NO VINCULADO
      factor_conversion: 1,
    };

    const productos = applyPresentationConversions([fardoIndependiente]);
    const res = productos.find((p) => p.sku === 'FAR-REF-IND');
    expect(res).toBeDefined();

    // El stock no es alterado por ninguna conversión: conserva sus 50 fardos propios
    expect(res?.stock_actual).toBe(50);
    expect(res?.unidad).toBe('Fardo');

    // Simulación de venta de 3 fardos independientes:
    const cantidadVendida = 3;
    const stockRestante = (res?.stock_actual ?? 0) - cantidadVendida;
    expect(stockRestante).toBe(47); // Descuenta directamente de sus 50 fardos

    // Simulación de compra de 10 fardos independientes:
    const cantidadComprada = 10;
    const stockTrasCompra = stockRestante + cantidadComprada;
    expect(stockTrasCompra).toBe(57); // Suma directo a su inventario
  });

  it('coexistencia perfecta entre productos independientes y presentaciones vinculadas', () => {
    const catalogoMixto: Producto[] = [
      // 1. Producto Base
      {
        id: 'botella-base-id',
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
        stock_actual: 1000, // 1000 botellas
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
      },
      // 2. Fardo Vinculado (Modo Presentación Vinculada, factor 20)
      {
        id: 'fardo-agua-vinculado-id',
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
        stock_actual: 0,
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
        producto_base_id: 'botella-base-id',
        factor_conversion: 20,
      },
      // 3. Fardo Autónomo (Modo Independiente, sin vinculación)
      {
        id: 'fardo-galletas-autonomo-id',
        codigo_barras: '8889990001',
        sku: 'FAR-GAL-01',
        nombre: 'Fardo De Galletas Surtidas',
        categoria: 'Snacks',
        marca: 'Galletas Rico',
        unidad: 'Fardo',
        proveedor_id: null,
        precio_costo: 500,
        precio_venta: 650,
        precio_mayorista: 600,
        porcentaje_impuesto: 18,
        stock_minimo: 5,
        stock_actual: 30, // 30 fardos propios
        es_pesado: false,
        fecha_vencimiento: null,
        garantia: null,
        imagen_url: null,
        estado: 'activo',
        producto_base_id: null, // NO VINCULADO
        factor_conversion: 1,
      },
    ];

    const catalogoProcesado = applyPresentationConversions(catalogoMixto);

    const botella = catalogoProcesado.find((p) => p.sku === '7461136665069');
    const fardoAgua = catalogoProcesado.find((p) => p.sku === '23653');
    const fardoGalletas = catalogoProcesado.find((p) => p.sku === 'FAR-GAL-01');

    // El Fardo vinculado calcula dinámicamente: 1000 botellas / 20 = 50 fardos
    expect(fardoAgua?.stock_actual).toBe(50);

    // El Fardo independiente conserva sus 30 fardos exactos intactos
    expect(fardoGalletas?.stock_actual).toBe(30);

    // La botella base conserva sus 1000 botellas
    expect(botella?.stock_actual).toBe(1000);
  });

  it('soporta flujo completo de Paquete (ej. Galletas x6) y Caja (ej. Leche x12)', () => {
    // 1. Producto Base: Galleta Individual (125 unidades)
    const galletaBase: Producto = {
      id: 'galleta-ind-id',
      codigo_barras: '746001002001',
      sku: 'GAL-001',
      nombre: 'Galleta de Chocolate Individual',
      categoria: 'Snacks',
      marca: 'ChocoRico',
      unidad: 'Unidad',
      proveedor_id: null,
      precio_costo: 10,
      precio_venta: 15,
      precio_mayorista: 12,
      porcentaje_impuesto: 18,
      stock_minimo: 20,
      stock_actual: 125,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    // 2. Presentación: Paquete de Galletas x6
    const paqueteGalletas: Producto = {
      id: 'paquete-galleta-x6-id',
      codigo_barras: '746001002006',
      sku: 'PAQ-GAL-6',
      nombre: 'Paquete de Galletas (6 unidades)',
      categoria: 'Snacks',
      marca: 'ChocoRico',
      unidad: 'Paquete',
      proveedor_id: null,
      precio_costo: 55,
      precio_venta: 80,
      precio_mayorista: 75,
      porcentaje_impuesto: 18,
      stock_minimo: 5,
      stock_actual: 0,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
      producto_base_id: 'galleta-ind-id',
      factor_conversion: 6,
    };

    // 3. Producto Base: Litro de Leche (48 litros)
    const lecheBase: Producto = {
      id: 'leche-litro-id',
      codigo_barras: '746003001001',
      sku: 'LEC-LIT-01',
      nombre: 'Leche Entera 1 Litro',
      categoria: 'Lácteos',
      marca: 'Lacty',
      unidad: 'Litro',
      proveedor_id: null,
      precio_costo: 60,
      precio_venta: 75,
      precio_mayorista: 70,
      porcentaje_impuesto: 0,
      stock_minimo: 24,
      stock_actual: 48,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    // 4. Presentación: Caja de Leche x12
    const cajaLeche: Producto = {
      id: 'caja-leche-x12-id',
      codigo_barras: '746003001012',
      sku: 'CAJ-LEC-12',
      nombre: 'Caja de Leche Entera (12 unidades)',
      categoria: 'Lácteos',
      marca: 'Lacty',
      unidad: 'Caja',
      proveedor_id: null,
      precio_costo: 680,
      precio_venta: 850,
      precio_mayorista: 820,
      porcentaje_impuesto: 0,
      stock_minimo: 2,
      stock_actual: 0,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
      producto_base_id: 'leche-litro-id',
      factor_conversion: 12,
    };

    const catalogo = applyPresentationConversions([galletaBase, paqueteGalletas, lecheBase, cajaLeche]);

    // Verificación 1: Stock dinámico inicial
    // Galletas: 125 / 6 = 20 paquetes disponibles
    const paqCalculado = catalogo.find((p) => p.sku === 'PAQ-GAL-6');
    expect(paqCalculado?.stock_actual).toBe(20);

    // Leche: 48 / 12 = 4 cajas disponibles
    const cajaCalculada = catalogo.find((p) => p.sku === 'CAJ-LEC-12');
    expect(cajaCalculada?.stock_actual).toBe(4);

    // Verificación 2: Venta en POS de 3 paquetes de galletas
    const movVentaPaquetes = movimientoInventarioPresentacion(paqueteGalletas, 3);
    expect(movVentaPaquetes.productoId).toBe('galleta-ind-id');
    expect(movVentaPaquetes.cantidad).toBe(18); // 3 * 6 = 18 unidades base

    // El stock base de galletas pasa de 125 a 107
    const nuevoStockGalletas = galletaBase.stock_actual - movVentaPaquetes.cantidad;
    expect(nuevoStockGalletas).toBe(107);

    // Con 107 galletas, ahora quedan 107 / 6 = 17 paquetes
    expect(calcularStockPresentacion(nuevoStockGalletas, 6)).toBe(17);

    // Verificación 3: Compra a proveedor de 5 cajas de leche
    const movCompraCajas = movimientoInventarioPresentacion(cajaLeche, 5);
    expect(movCompraCajas.productoId).toBe('leche-litro-id');
    expect(movCompraCajas.cantidad).toBe(60); // 5 * 12 = 60 litros agregados

    // El stock base de leche pasa de 48 a 108 litros
    const nuevoStockLeche = lecheBase.stock_actual + movCompraCajas.cantidad;
    expect(nuevoStockLeche).toBe(108);

    // Con 108 litros, ahora hay 108 / 12 = 9 cajas de leche disponibles
    expect(calcularStockPresentacion(nuevoStockLeche, 12)).toBe(9);
  });
});
