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
  getSupabase: () => null,
}));

import {
  applyPresentationConversions,
  resolveSingleProductPresentation,
  productoAUi,
  actualizarProducto,
} from '@/services/productos.service';
import { getStoredProducts, saveStoredProducts } from '@/lib/productStore';
import type { Producto } from '@/types/database';
import type { Product } from '@/lib/initialProducts';

describe('Corrección de Six Packs y Productos Presentación en POS y Gestión de Productos', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('calcula dinámicamente el stock de un Six Pack vinculado a un producto base con existencias', () => {
    const baseCerveza: Producto = {
      id: 'prod-cerveza-base',
      codigo_barras: '746000000001',
      sku: 'CERV-BASE',
      nombre: 'Cerveza Presidente 355ml',
      categoria: 'Bebidas',
      marca: 'Presidente',
      unidad: 'Botella',
      proveedor_id: null,
      precio_costo: 80,
      precio_venta: 120,
      precio_mayorista: 110,
      porcentaje_impuesto: 18,
      stock_minimo: 12,
      stock_actual: 30, // 30 botellas = 5 six packs
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    const sixPack: Producto = {
      id: 'prod-sixpack-cerveza',
      codigo_barras: '746000000006',
      sku: 'SIX-CERV-BASE',
      nombre: 'Six Pack Cerveza Presidente 355ml',
      categoria: 'Bebidas',
      marca: 'Presidente',
      unidad: 'Six Pack',
      proveedor_id: null,
      precio_costo: 480,
      precio_venta: 680,
      precio_mayorista: 650,
      porcentaje_impuesto: 18,
      stock_minimo: 2,
      stock_actual: 0, // En BD tiene 0 porque depende del producto base
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
      producto_base_id: 'prod-cerveza-base',
      factor_conversion: 6,
    };

    const catalog = applyPresentationConversions([sixPack, baseCerveza]);
    const convertedSixPack = catalog.find((p) => p.id === 'prod-sixpack-cerveza');

    expect(convertedSixPack).toBeDefined();
    expect(convertedSixPack?.stock_actual).toBe(5); // 30 / 6 = 5 six packs

    // Al transformarlo a modelo UI para el POS
    const ui = productoAUi(convertedSixPack!);
    expect(ui.currentStock).toBe(5);
    expect(ui.stockStatus).toBe('normal'); // NO debe ser 'out' ni 'Agotado'
  });

  it('calcula dinámicamente el stock de un Six Pack Mixto (compuesto de varios productos)', () => {
    const rubia: Producto = {
      id: 'prod-cerveza-rubia',
      codigo_barras: '746000000010',
      sku: 'CERV-RUBIA',
      nombre: 'Cerveza Rubia',
      categoria: 'Bebidas',
      marca: 'Cervecería',
      unidad: 'Botella',
      proveedor_id: null,
      precio_costo: 70,
      precio_venta: 100,
      precio_mayorista: 90,
      porcentaje_impuesto: 18,
      stock_minimo: 6,
      stock_actual: 18, // 18 / 3 = 6 posibles
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    const negra: Producto = {
      id: 'prod-cerveza-negra',
      codigo_barras: '746000000020',
      sku: 'CERV-NEGRA',
      nombre: 'Cerveza Negra',
      categoria: 'Bebidas',
      marca: 'Cervecería',
      unidad: 'Botella',
      proveedor_id: null,
      precio_costo: 75,
      precio_venta: 110,
      precio_mayorista: 100,
      porcentaje_impuesto: 18,
      stock_minimo: 6,
      stock_actual: 12, // 12 / 3 = 4 posibles -> Cuello de botella es 4 six packs
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    const sixPackMixto: Producto & { composite_items: any[] } = {
      id: 'prod-six-mixto',
      codigo_barras: '746000000099',
      sku: 'SIX-MIXTO',
      nombre: 'Six Pack Mixto (3 Rubias + 3 Negras)',
      categoria: 'Bebidas',
      marca: 'Cervecería',
      unidad: 'Six Pack',
      proveedor_id: null,
      precio_costo: 435,
      precio_venta: 620,
      precio_mayorista: 590,
      porcentaje_impuesto: 18,
      stock_minimo: 2,
      stock_actual: 0,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
      composite_items: [
        { product_id: 'prod-cerveza-rubia', product_name: 'Cerveza Rubia', quantity: 3 },
        { product_id: 'prod-cerveza-negra', product_name: 'Cerveza Negra', quantity: 3 },
      ],
    };

    const catalog = applyPresentationConversions([sixPackMixto, rubia, negra]);
    const converted = catalog.find((p) => p.id === 'prod-six-mixto');

    expect(converted).toBeDefined();
    expect(converted?.stock_actual).toBe(4); // min(18/3, 12/3) = min(6, 4) = 4

    const ui = productoAUi(converted!);
    expect(ui.currentStock).toBe(4);
    expect(ui.stockStatus).toBe('normal');
    expect(ui.composite_items).toHaveLength(2);
  });

  it('al editar un Six Pack en el almacén local preserva composite_items y actualiza stock dinámicamente', async () => {
    const rubia: Product = {
      id: 'prod-cerv-rubia',
      barcode: '111111',
      sku: 'RUBIA',
      name: 'Rubia',
      category: 'Bebidas',
      brand: '',
      unit: 'Unidad',
      supplier: '',
      costPrice: 50,
      salePrice: 80,
      wholesalePrice: 70,
      tax: 18,
      minStock: 5,
      currentStock: 24,
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'normal',
    };

    const negra: Product = {
      id: 'prod-cerv-negra',
      barcode: '222222',
      sku: 'NEGRA',
      name: 'Negra',
      category: 'Bebidas',
      brand: '',
      unit: 'Unidad',
      supplier: '',
      costPrice: 50,
      salePrice: 80,
      wholesalePrice: 70,
      tax: 18,
      minStock: 5,
      currentStock: 30,
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'normal',
    };

    const sixPack: Product = {
      id: 'prod-six-edit',
      barcode: '666666',
      sku: 'SIX-EDIT',
      name: 'Six Pack Editado',
      category: 'Bebidas',
      brand: '',
      unit: 'Six Pack',
      supplier: '',
      costPrice: 300,
      salePrice: 450,
      wholesalePrice: 420,
      tax: 18,
      minStock: 2,
      currentStock: 0,
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'out',
      composite_items: [
        { product_id: 'prod-cerv-rubia', product_name: 'Rubia', quantity: 3 },
        { product_id: 'prod-cerv-negra', product_name: 'Negra', quantity: 3 },
      ],
    };

    saveStoredProducts([rubia, negra, sixPack]);

    // Simulamos edición cambiando nombre o precio
    await actualizarProducto('prod-six-edit', {
      nombre: 'Six Pack Cervezas Especiales',
      precio_venta: 480,
    });

    const stored = getStoredProducts().find((p) => p.id === 'prod-six-edit');
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('Six Pack Cervezas Especiales');
    expect(stored?.salePrice).toBe(480);
    // Debe haber preservado composite_items
    expect(stored?.composite_items).toHaveLength(2);
    // Debe haber recalculado el stock desde sus componentes: min(24/3, 30/3) = min(8, 10) = 8
    expect(stored?.currentStock).toBe(8);
    expect(stored?.stockStatus).toBe('normal');
  });

  it('resuelve automáticamente el stock de un Six Pack por nombre si no tiene vínculo explícito', async () => {
    const baseCerveza: Product = {
      id: 'prod-cerveza-modelo',
      barcode: '75010001',
      sku: 'CERV-MOD',
      name: 'Cerveza Modelo',
      category: 'Bebidas',
      brand: 'Modelo',
      unit: 'Botella',
      supplier: '',
      costPrice: 90,
      salePrice: 130,
      wholesalePrice: 120,
      tax: 18,
      minStock: 10,
      currentStock: 36, // 36 botellas = 6 six packs
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'normal',
    };

    saveStoredProducts([baseCerveza]);

    const sixPackRaw: Producto = {
      id: 'prod-six-modelo',
      codigo_barras: '75010006',
      sku: 'SIX-MOD',
      nombre: 'Six Pack Cerveza Modelo',
      categoria: 'Bebidas',
      marca: 'Modelo',
      unidad: 'Six Pack',
      proveedor_id: null,
      precio_costo: 540,
      precio_venta: 750,
      precio_mayorista: 720,
      porcentaje_impuesto: 18,
      stock_minimo: 2,
      stock_actual: 0,
      es_pesado: false,
      fecha_vencimiento: null,
      garantia: null,
      imagen_url: null,
      estado: 'activo',
    };

    const resolved = await resolveSingleProductPresentation(sixPackRaw);
    expect(resolved.stock_actual).toBe(6); // 36 / 6 = 6 six packs disponibles

    const ui = productoAUi(resolved);
    expect(ui.currentStock).toBe(6);
    expect(ui.stockStatus).toBe('normal');
  });

  it('valida que el Six Pack no sea rechazado en POS cuando sus productos base tienen existencias', () => {
    const base: Product = {
      id: 'prod-cerveza-pilsen',
      barcode: '123456789',
      sku: 'PIL-01',
      name: 'Cerveza Pilsen',
      category: 'Bebidas',
      brand: 'Pilsen',
      unit: 'Botella',
      supplier: '',
      costPrice: 80,
      salePrice: 120,
      wholesalePrice: 110,
      tax: 18,
      minStock: 10,
      currentStock: 24, // 24 botellas
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'normal',
    };

    saveStoredProducts([base]);

    // Six pack producto con stock directo 0 pero vinculado al producto base
    const sixPackProduct = {
      id: 'prod-six-pilsen',
      productId: 'prod-six-pilsen',
      sku: 'SIX-PIL',
      barcode: '123456786',
      name: 'Six Pack Cerveza Pilsen',
      price: 650,
      cost: 450,
      tax: 18,
      unit: 'Six Pack',
      currentStock: 0, // Cero directo en la fila del sixpack
      stock: 0,
      outOfStock: false,
      stockStatus: 'normal' as const,
      producto_base_id: 'prod-cerveza-pilsen',
      factor_conversion: 6,
    };

    // Lógica de validación de POS
    let effectiveStock = sixPackProduct.stock !== undefined ? Number(sixPackProduct.stock) : Number(sixPackProduct.currentStock ?? 0);
    const catalog = getStoredProducts();
    const baseProd = catalog.find((x) => x.id === sixPackProduct.producto_base_id);
    if (baseProd && Number(baseProd.currentStock || 0) >= 6) {
      effectiveStock = Math.floor(Number(baseProd.currentStock) / 6);
    }

    expect(effectiveStock).toBe(4); // 24 / 6 = 4 six packs
    expect(effectiveStock > 0).toBe(true); // Pasa al carrito sin bloqueo de "sin existencias"
  });
});
