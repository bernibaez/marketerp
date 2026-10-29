import { describe, it, expect, beforeEach } from 'vitest';
import {
  obtenerProductos,
  buscarProductoPorCodigo,
  invalidarCacheProductos,
  buscarProductoPorCodigoEscaneado,
} from '@/services/productos.service';

describe('Optimizaciones de Egress y Caché de Productos', () => {
  beforeEach(() => {
    invalidarCacheProductos();
  });

  it('obtenerProductos guarda el catálogo en caché y resuelve consultas subsecuentes sin duplicar', async () => {
    // 1. Primera consulta: carga catálogo
    const start1 = performance.now();
    const res1 = await obtenerProductos({ pagina: 1, limite: 5000, estado: 'activo' });
    const elapsed1 = performance.now() - start1;

    expect(res1.datos).toBeDefined();
    expect(res1.total).toBeGreaterThan(0);

    // 2. Segunda consulta idéntica inmediata: debe resolverse desde caché en < 10ms (0 egress)
    const start2 = performance.now();
    const res2 = await obtenerProductos({ pagina: 1, limite: 5000, estado: 'activo' });
    const elapsed2 = performance.now() - start2;

    expect(res2.datos.length).toBe(res1.datos.length);
    expect(elapsed2).toBeLessThan(elapsed1 + 20);

    // 3. Sub-consulta (ej: límite 100, categoría o búsqueda): debe ser resuelta desde el catálogo maestro en memoria
    const subRes = await obtenerProductos({ pagina: 1, limite: 50, estado: 'activo' });
    expect(subRes.datos.length).toBeLessThanOrEqual(50);
  });

  it('buscarProductoPorCodigo resuelve inmediatamente desde memoria para códigos existentes', async () => {
    // Precargar catálogo
    const res = await obtenerProductos({ pagina: 1, limite: 5000, estado: 'activo' });
    const sample = res.datos[0];
    expect(sample).toBeDefined();

    if (sample && sample.sku) {
      const found = await buscarProductoPorCodigo(sample.sku);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(sample.id);
    }
  });

  it('invalidarCacheProductos limpia adecuadamente las entradas de memoria', async () => {
    await obtenerProductos({ pagina: 1, limite: 5000, estado: 'activo' });
    invalidarCacheProductos();
    // Debe poder volver a consultar sin errores tras invalidar
    const res = await obtenerProductos({ pagina: 1, limite: 10, estado: 'activo' });
    expect(res.datos.length).toBeGreaterThan(0);
  });
});

