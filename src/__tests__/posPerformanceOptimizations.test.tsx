import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ProductPanel from '@/pages/point-of-sale-pos/components/ProductPanel';
import {
  buildPosCatalogIndex,
  findExactScanProduct,
  searchPosCatalog,
} from '@/pages/point-of-sale-pos/utils/posCatalogIndex';
import { createPOSSearchStore } from '@/pages/point-of-sale-pos/utils/posSearchStore';
import {
  applyPresentationConversions,
  applyStockDeltasToCatalog,
} from '@/services/productos.service';
import {
  formatPosPerfReport,
  getPosPerfSnapshot,
  markPosOpenReady,
  markPosOpenStart,
  posPerfNow,
  recordAddToCart,
  recordCodeSearch,
  recordNameSearch,
  recordPostSaleReady,
  recordUpdateQty,
  resetPosPerfMetrics,
  trackPosCacheHit,
  trackPosNetworkRequest,
} from '@/lib/posPerfMetrics';
import type { Producto } from '@/types/database';

function makeDbProduct(
  overrides: Partial<Producto> & {
    id: string;
    nombre: string;
    composite_items?: Array<{ product_id: string; quantity: number }>;
  }
): Producto {
  const { composite_items, ...rest } = overrides;
  const base: Producto = {
    id: rest.id,
    codigo_barras: rest.codigo_barras ?? '',
    sku: rest.sku ?? `SKU-${rest.id}`,
    plu: rest.plu ?? null,
    nombre: rest.nombre,
    categoria: rest.categoria ?? 'General',
    marca: rest.marca ?? null,
    unidad: rest.unidad ?? 'unidad',
    proveedor_id: rest.proveedor_id ?? null,
    precio_costo: rest.precio_costo ?? 60,
    precio_venta: rest.precio_venta ?? 100,
    precio_mayorista: rest.precio_mayorista ?? 90,
    porcentaje_impuesto: rest.porcentaje_impuesto ?? 18,
    stock_minimo: rest.stock_minimo ?? 2,
    stock_actual: rest.stock_actual ?? 10,
    es_pesado: rest.es_pesado ?? false,
    sale_type: rest.sale_type ?? 'unit',
    weight_unit: rest.weight_unit ?? 'lb',
    price_per_weight: rest.price_per_weight ?? 0,
    allow_decimal: rest.allow_decimal ?? false,
    min_weight: rest.min_weight ?? 0,
    max_weight: rest.max_weight ?? 0,
    generate_scale_barcode: rest.generate_scale_barcode ?? false,
    is_weight_product: rest.is_weight_product ?? false,
    fecha_vencimiento: rest.fecha_vencimiento ?? null,
    garantia: rest.garantia ?? null,
    imagen_url: rest.imagen_url ?? null,
    estado: rest.estado ?? 'activo',
    producto_base_id: rest.producto_base_id ?? null,
    factor_conversion: rest.factor_conversion ?? 1,
    unidad_base: rest.unidad_base,
    creado_en: rest.creado_en ?? '2026-01-01T00:00:00Z',
    actualizado_en: rest.actualizado_en ?? '2026-01-01T00:00:00Z',
  };
  if (composite_items) {
    (base as any).composite_items = composite_items;
  }
  return base;
}

describe('POS Performance Optimizations', () => {
  describe('posSearchStore (estado externo para evitar re-renders del terminal)', () => {
    it('notifica suscriptores únicamente cuando cambia la consulta y limpia suscripciones', () => {
      const store = createPOSSearchStore('');
      let notifications = 0;
      const unsubscribe = store.subscribe(() => {
        notifications += 1;
      });

      expect(store.getQuery()).toBe('');

      store.setQuery('agua');
      expect(store.getQuery()).toBe('agua');
      expect(notifications).toBe(1);

      // Valor idéntico no dispara notificación redundante
      store.setQuery('agua');
      expect(notifications).toBe(1);

      unsubscribe();
      store.setQuery('refresco');
      expect(store.getQuery()).toBe('refresco');
      expect(notifications).toBe(1);
    });
  });

  describe('posCatalogIndex (índices O(1) por ID/SKU/Barcode/PLU y búsqueda unificada)', () => {
    it('construye mapas de búsqueda O(1) y resuelve códigos exactos sin recorrer todo el catálogo', () => {
      const catalog = Array.from({ length: 1500 }, (_, i) => ({
        id: `p-${i}`,
        sku: `SKU-${i}`,
        barcode: `74400000${String(i).padStart(4, '0')}`,
        plu: i % 10 === 0 ? `${1000 + i}` : '',
        name: i === 42 ? 'Presidente Pequeña Fría' : `Producto Catálogo ${i}`,
        category: i === 42 ? 'Cervezas' : 'Abarrotes',
        price: 50 + (i % 100),
        salePrice: 50 + (i % 100),
        cost: 30,
        costPrice: 30,
        stock: 20,
        currentStock: 20,
        minStock: 2,
        unit: 'Und',
        tax: 18,
        status: 'active',
      }));

      const index = buildPosCatalogIndex(catalog, false);

      expect(index.byId.get('p-42')?.name).toBe('Presidente Pequeña Fría');
      expect(findExactScanProduct(index, '744000000042')?.id).toBe('p-42');
      expect(findExactScanProduct(index, 'sku-42')?.id).toBe('p-42');
      expect(findExactScanProduct(index, '1040')?.id).toBe('p-40');

      const ranked = searchPosCatalog(index, 'presidente', {
        ranked: true,
        limit: 10,
      });
      expect(ranked.length).toBeGreaterThanOrEqual(1);
      expect(ranked[0].id).toBe('p-42');
    });

    it('extrae el PLU de códigos de barra de balanza (prefijo 20-29)', () => {
      const catalog = [
        {
          id: 'w-1',
          sku: 'QUESO-01',
          barcode: '',
          plu: '00125',
          name: 'Queso Gouda por Libra',
          category: 'Lácteos',
          price: 250,
          salePrice: 250,
          cost: 180,
          costPrice: 180,
          stock: 15,
          currentStock: 15,
          minStock: 2,
          unit: 'lb',
          isWeightProduct: true,
          saleType: 'weight',
          status: 'active',
        },
      ];

      const index = buildPosCatalogIndex(catalog, false);
      // Código EAN-13 variable de balanza: prefijo 20 + PLU 00125 + peso + dígito
      const matches = searchPosCatalog(index, '2000125001501');
      expect(matches.map((m) => m.id)).toContain('w-1');
    });

    it('no muestra productos demo de respaldo cuando allowDemoFallback=false durante carga inicial', () => {
      const index = buildPosCatalogIndex([], false);
      expect(index.panelItems).toHaveLength(0);
    });
  });

  describe('Actualización incremental de inventario en cache y derivación en una pasada', () => {
    it('calcula stock de presentaciones y actualiza productos base + derivados sin recargar el catálogo', () => {
      const baseWater = makeDbProduct({
        id: 'base-water',
        sku: 'AGUA-UND',
        nombre: 'Agua Pureza Sana Botella',
        stock_actual: 45,
        unidad: 'unidad',
      });
      const packWater = makeDbProduct({
        id: 'pack-water',
        sku: 'AGUA-FARDO',
        nombre: 'Fardo de Agua Pureza Sana',
        producto_base_id: 'base-water',
        factor_conversion: 20,
        stock_actual: 0,
        unidad: 'fardo',
      });
      const sixPackBeer = makeDbProduct({
        id: 'six-beer',
        sku: 'PRES-SIX',
        nombre: 'Presidente Six Pack',
        composite_items: [
          { product_id: 'beer-und', quantity: 6 },
        ],
        stock_actual: 0,
        unidad: 'six pack',
      });
      const unitBeer = makeDbProduct({
        id: 'beer-und',
        sku: 'PRES-UND',
        nombre: 'Cerveza Presidente Normal',
        stock_actual: 18,
        unidad: 'unidad',
      });

      const resolved = applyPresentationConversions([
        baseWater,
        packWater,
        unitBeer,
        sixPackBeer,
      ]);

      expect(resolved.find((p) => p.id === 'pack-water')?.stock_actual).toBe(2);
      expect(resolved.find((p) => p.id === 'six-beer')?.stock_actual).toBe(3);

      // Simular venta de 1 fardo (-20 botellas base) y 1 six pack (-6 cervezas base)
      const afterSale = applyStockDeltasToCatalog(resolved, [
        { productoId: 'base-water', delta: -20 },
        { productoId: 'beer-und', delta: -6 },
      ]);

      expect(afterSale.find((p) => p.id === 'base-water')?.stock_actual).toBe(25);
      expect(afterSale.find((p) => p.id === 'pack-water')?.stock_actual).toBe(1);
      expect(afterSale.find((p) => p.id === 'beer-und')?.stock_actual).toBe(12);
      expect(afterSale.find((p) => p.id === 'six-beer')?.stock_actual).toBe(2);
    });
  });

  describe('ProductPanel (virtualización de grilla e imágenes lazy)', () => {
    it('renderiza solo una ventana acotada de tarjetas cuando el catálogo tiene 2,000 productos', () => {
      const manyProducts = Array.from({ length: 2000 }, (_, i) => ({
        id: `prod-${i}`,
        sku: `SKU-${i}`,
        barcode: `7441000${String(i).padStart(5, '0')}`,
        name: `Producto Perf ${String(i).padStart(4, '0')}`,
        category: 'General',
        price: 100,
        salePrice: 100,
        cost: 60,
        costPrice: 60,
        stock: 25,
        currentStock: 25,
        minStock: 2,
        unit: 'Und',
        tax: 18,
        image: `https://example.com/img-${i}.jpg`,
        status: 'active',
      }));

      const catalogIndex = buildPosCatalogIndex(manyProducts, false);
      const searchStore = createPOSSearchStore('');

      const html = renderToString(
        <ProductPanel
          onAddToCart={() => {}}
          catalogIndex={catalogIndex}
          combos={[]}
          searchStore={searchStore}
          catalogLoading={false}
        />
      );

      // Las primeras tarjetas visibles sí están en el HTML y usan loading="lazy"
      expect(html).toContain('Producto Perf 0000');
      expect(html).toContain('loading="lazy"');
      expect(html).toContain('decoding="async"');

      // Tarjetas fuera del viewport inicial NO se montan en el DOM
      expect(html).not.toContain('Producto Perf 0500');
      expect(html).not.toContain('Producto Perf 1999');

      // Conteo acotado de nodos botón renderizados (11 filas * 4 cols = 44 tarjetas vs 2,000 totales)
      const renderedButtonCards = (html.match(/<button type="button"/g) || []).length;
      expect(renderedButtonCards).toBeGreaterThan(0);
      expect(renderedButtonCards).toBeLessThanOrEqual(48);
    });

    it('muestra indicador de carga sin exponer productos demo mientras carga el catálogo', () => {
      const emptyLoadingIndex = buildPosCatalogIndex([], false);
      const searchStore = createPOSSearchStore('');

      const html = renderToString(
        <ProductPanel
          onAddToCart={() => {}}
          catalogIndex={emptyLoadingIndex}
          combos={[]}
          searchStore={searchStore}
          catalogLoading={true}
        />
      );

      expect(html).toContain('Cargando catálogo...');
      expect(html).not.toContain('Producto Perf');
    });

    it('reutiliza resultados remotos compartidos en searchStore cuando el producto no está en la página inicial', () => {
      const partialIndex = buildPosCatalogIndex(
        [
          {
            id: 'local-1',
            sku: 'SKU-001',
            name: 'Aceite Cristal',
            price: 120,
            salePrice: 120,
            cost: 80,
            costPrice: 80,
            stock: 10,
            currentStock: 10,
            unit: 'Und',
            status: 'active',
          },
        ],
        false
      );
      const searchStore = createPOSSearchStore('yogurt');
      searchStore.setRemoteResults('yogurt', [
        {
          id: 'remote-850',
          sku: 'YOG-850',
          name: 'Yogurt Fresa Griego',
          price: 95,
          salePrice: 95,
          cost: 60,
          costPrice: 60,
          stock: 14,
          currentStock: 14,
          unit: 'Und',
          status: 'active',
        },
      ]);

      const html = renderToString(
        <ProductPanel
          onAddToCart={() => {}}
          catalogIndex={partialIndex}
          combos={[]}
          searchStore={searchStore}
          catalogLoading={false}
        />
      );

      expect(html).toContain('Yogurt Fresa Griego');

      // Al limpiar la búsqueda, limpia los resultados remotos compartidos
      searchStore.setQuery('');
      expect(searchStore.getRemoteState().results).toHaveLength(0);
    });
  });

  describe('Fase 4 — Instrumentación de métricas y benchmark con 5,000 productos', () => {
    it('registra métricas POS de apertura, búsqueda, carrito, post-venta y solicitudes', () => {
      resetPosPerfMetrics();
      markPosOpenStart();
      markPosOpenReady({ catalogCount: 250, cacheHit: true });
      recordCodeSearch(2.4, { cacheHit: true, remoteFallback: false });
      recordNameSearch(6.8, { resultCount: 4, remoteFallback: false });
      recordAddToCart(1.2);
      recordUpdateQty(0.9);
      recordPostSaleReady(3.5, {
        deltaCount: 2,
        skippedFullCatalogReload: true,
        skippedFullRegisterReload: true,
      });
      trackPosCacheHit('productos_master');
      trackPosNetworkRequest('productos');

      const snap = getPosPerfSnapshot();
      expect(snap.posOpen.cacheHit).toBe(true);
      expect(snap.posOpen.catalogCount).toBe(250);
      expect(snap.posOpen.durationMs).not.toBeNull();
      expect(snap.codeSearch.cacheHits).toBe(1);
      expect(snap.nameSearch.lastResultCount).toBe(4);
      expect(snap.addToCart.count).toBe(1);
      expect(snap.updateQty.count).toBe(1);
      expect(snap.postSaleReady.fullCatalogReloadsSkipped).toBe(1);
      expect(snap.postSaleReady.fullRegisterReloadsSkipped).toBe(1);
      expect(snap.requests.totalCacheHits).toBe(1);
      expect(snap.requests.totalSupabaseRequests).toBe(1);

      const report = formatPosPerfReport();
      expect(report.every((row) => String(row.Cumple).startsWith('OK'))).toBe(true);
    });

    it('mide búsqueda O(1), filtrado por nombre, deltas post-venta y virtualización sobre 5,000 productos por debajo de objetivos', () => {
      const db5000: Producto[] = Array.from({ length: 5000 }, (_, i) =>
        makeDbProduct({
          id: `bench-${i}`,
          sku: `SKU-${i}`,
          codigo_barras: `7449000${String(i).padStart(5, '0')}`,
          nombre: i === 4250 ? 'Queso Especial Bench 4250' : `Artículo Catálogo ${String(i).padStart(4, '0')}`,
          stock_actual: 50,
          precio_venta: 100 + (i % 50),
        })
      );

      const ui5000 = db5000.map((p) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.codigo_barras,
        name: p.nombre,
        category: p.categoria,
        price: p.precio_venta,
        salePrice: p.precio_venta,
        cost: p.precio_costo,
        costPrice: p.precio_costo,
        stock: p.stock_actual,
        currentStock: p.stock_actual,
        minStock: p.stock_minimo,
        unit: 'Und',
        tax: 18,
        status: 'active',
      }));

      const idx5000 = buildPosCatalogIndex(ui5000, false);

      const tScanStart = posPerfNow();
      const scanned = findExactScanProduct(idx5000, '744900004250');
      const scanMs = posPerfNow() - tScanStart;
      expect(scanned?.id).toBe('bench-4250');
      expect(scanMs).toBeLessThan(200);

      const tSearchStart = posPerfNow();
      const foundByName = searchPosCatalog(idx5000, 'queso especial', { ranked: true, limit: 30 });
      const searchMs = posPerfNow() - tSearchStart;
      expect(foundByName[0]?.id).toBe('bench-4250');
      expect(searchMs).toBeLessThan(300);

      const tDeltaStart = posPerfNow();
      const updated5000 = applyStockDeltasToCatalog(db5000, [
        { productoId: 'bench-4250', delta: -3 },
      ]);
      const deltaMs = posPerfNow() - tDeltaStart;
      expect(updated5000[4250].stock_actual).toBe(47);
      expect(deltaMs).toBeLessThan(100);

      const searchStore = createPOSSearchStore('');
      const html = renderToString(
        <ProductPanel
          onAddToCart={() => {}}
          catalogIndex={idx5000}
          combos={[]}
          searchStore={searchStore}
          catalogLoading={false}
        />
      );
      const renderedCards = (html.match(/<button type="button"/g) || []).length;
      expect(renderedCards).toBeGreaterThan(0);
      expect(renderedCards).toBeLessThanOrEqual(48);
    });
  });
});

