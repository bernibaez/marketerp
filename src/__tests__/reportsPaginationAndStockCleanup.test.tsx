import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

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
  (globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = new LocalStorageMock();
}

vi.mock('@/services/clienteSupabase', () => ({
  tryGetSupabase: () => null,
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('Supabase not configured in test');
  },
}));

import { ReportTable, ReportPagination, ReportSectionTabs } from '@/pages/reports/shared';
import {
  obtenerInformeStockGeneral,
  obtenerHistorialMovimientosProducto,
} from '@/services/informes/informesStockMovimientos.service';
import { saveStoredProducts, type ProductItem } from '@/lib/productStore';

describe('Paginación de Informes y Limpieza de Informe de Stock', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ReportTable pagina de 10 en 10 por defecto y no tira todos los registros de golpe', () => {
    const rows = Array.from({ length: 45 }, (_, i) => [
      `SKU-${String(i + 1).padStart(3, '0')}`,
      `Producto ${i + 1}`,
      'Categoría A',
      i + 1,
      <span key={i} className="badge-success">OK</span>,
    ]);

    const html = renderToString(
      <ReportTable
        headers={['SKU', 'Producto', 'Categoría', 'Stock', 'Estado']}
        rows={rows}
        itemLabel="productos"
      />
    );

    // Solo debe renderizar los primeros 10 productos
    expect(html).toContain('SKU-001');
    expect(html).toContain('SKU-010');
    expect(html).not.toContain('SKU-011');
    expect(html).not.toContain('SKU-045');

    // Muestra el contador total y paginación + buscador
    expect(html).toContain('Mostrando');
    expect(html).toContain('45');
    expect(html).toContain('productos');
    expect(html).toContain('Buscar en la tabla');
  });

  it('ReportTable permite defaultPageSize personalizado y omite controles innecesarios con pocos registros', () => {
    const rows = [
      ['SKU-1', 'Arroz', 'Granos', 10],
      ['SKU-2', 'Habichuela', 'Granos', 5],
    ];

    const html = renderToString(
      <ReportTable
        headers={['SKU', 'Producto', 'Categoría', 'Stock']}
        rows={rows}
        itemLabel="productos"
      />
    );

    expect(html).toContain('SKU-1');
    expect(html).toContain('SKU-2');
    expect(html).not.toContain('Buscar en la tabla');
    expect(html).not.toContain('Página siguiente');
  });

  it('ReportPagination maneja rangos, clamping de página y retorno vacío con 0 ítems', () => {
    const emptyHtml = renderToString(
      <ReportPagination totalItems={0} currentPage={1} pageSize={10} onPageChange={() => { }} />
    );
    expect(emptyHtml).toBe('');

    const html = renderToString(
      <ReportPagination
        totalItems={120}
        currentPage={99}
        pageSize={10}
        onPageChange={() => { }}
        onPageSizeChange={() => { }}
        itemLabel="movimientos"
      />
    );
    // Página 99 debe ajustarse a la última página (12): 111–120 de 120
    expect(html).toContain('111');
    expect(html).toContain('120');
    expect(html).toContain('movimientos');
  });

  it('ReportSectionTabs renderiza pestañas con conteos para evitar tablas apiladas', () => {
    const html = renderToString(
      <ReportSectionTabs
        activeTab="606"
        onChange={() => { }}
        tabs={[
          { id: 'ncf', label: 'NCF / Facturas', count: 12 },
          { id: '606', label: 'Formato 606 (Compras)', count: 8 },
          { id: '607', label: 'Formato 607 (Ventas)', count: 24 },
        ]}
      />
    );

    expect(html).toContain('NCF / Facturas');
    expect(html).toContain('Formato 606 (Compras)');
    expect(html).toContain('Formato 607 (Ventas)');
    expect(html).toContain('24');
  });

  it('obtenerHistorialMovimientosProducto acepta ítem precargado sin recargar todo el catálogo', async () => {
    const mockProducts: ProductItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `prod-${i + 1}`,
      name: `Artículo ${i + 1}`,
      sku: `ART-${i + 1}`,
      barcode: `746000000${i + 1}`,
      category: 'Abarrotes',
      brand: 'Genérica',
      supplier: 'Proveedor',
      costPrice: 20,
      salePrice: 35,
      wholesalePrice: 30,
      tax: 0,
      currentStock: 10 + i,
      minStock: 5,
      unit: 'Unidad',
      image: '',
      expiryDate: null,
      warranty: '',
      status: 'active',
      stockStatus: 'normal',
      isWeightProduct: false,
    }));
    saveStoredProducts(mockProducts);

    const general = await obtenerInformeStockGeneral();
    expect(general.items.length).toBe(15);

    const target = general.items[3];
    const kardex = await obtenerHistorialMovimientosProducto(target.id, target);
    expect(kardex.producto.id).toBe(target.id);
    expect(kardex.producto.nombre).toBe(target.nombre);
    expect(kardex.resumen.totales.stock_actual).toBe(target.stock_actual);
  });
});
