import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  actualizarProducto,
  applyStockDeltasToCatalog,
  crearProducto,
  eliminarProducto,
  hayCatalogoProductosEnCache,
  hidratarRestoCatalogoEnCache,
  obtenerProductos,
  productoAUi,
  uiAProductoInsert,
  type ProductosFiltro,
  type StockDelta,
} from '@/services/productos.service';
import type { Product } from '@/pages/product-management/components/ProductManagementScreen';
import type { Producto } from '@/types/database';
import { isAbortError } from '@/lib/isAbortError';

export type UseProductosParams = ProductosFiltro & {
  enabled?: boolean;
  /** Límite rápido para apertura inicial cuando el catálogo maestro aún no está en caché. */
  progressiveInitialLimit?: number;
};

export function useProductos(params: UseProductosParams = {}) {
  const enabled = params.enabled ?? true;
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const mountedRef = useRef(true);
  const hydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 5000;
  const progressiveInitialLimit = params.progressiveInitialLimit;
  const busqueda = params.busqueda ?? '';
  const categoria = params.categoria;
  const estado = params.estado;

  const productosUi = useMemo<Product[]>(
    () => productos.map(productoAUi),
    [productos]
  );

  const applyStockDeltas = useCallback((deltas: StockDelta[]) => {
    if (deltas.length === 0) return;
    setProductos((prev) => applyStockDeltasToCatalog(prev, deltas));
  }, []);

  const clearHydrationTimer = useCallback(() => {
    if (hydrationTimerRef.current !== null) {
      clearTimeout(hydrationTimerRef.current);
      hydrationTimerRef.current = null;
    }
  }, []);

  const refetch = useCallback(async () => {
    clearHydrationTimer();
    if (!enabled) {
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const canProgressive =
        Boolean(progressiveInitialLimit && progressiveInitialLimit > 0 && progressiveInitialLimit < limite) &&
        pagina === 1 &&
        !busqueda &&
        (!categoria || categoria === 'Todas') &&
        !hayCatalogoProductosEnCache(estado ?? 'todos');

      const initialLimit = canProgressive ? progressiveInitialLimit! : limite;
      const res = await obtenerProductos({
        pagina,
        limite: initialLimit,
        busqueda,
        categoria,
        estado,
      });
      if (!mountedRef.current || reqId !== reqIdRef.current) return;
      setProductos(res.datos);
      setTotal(res.total);
      setLoading(false);

      if (canProgressive && res.total > res.datos.length) {
        hydrationTimerRef.current = setTimeout(() => {
          hydrationTimerRef.current = null;
          if (!mountedRef.current || reqId !== reqIdRef.current) return;
          void hidratarRestoCatalogoEnCache({
            estado: estado ?? 'todos',
            initialPage: res,
            maxLimite: limite,
          })
            .then((fullRes) => {
              if (!mountedRef.current || reqId !== reqIdRef.current) return;
              setProductos(fullRes.datos);
              setTotal(fullRes.total);
            })
            .catch(() => {
              // Silenciar error de hidratación en segundo plano; la búsqueda remota cubre faltantes
            });
        }, 120);
      }
    } catch (e) {
      if (isAbortError(e) || !mountedRef.current || reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
      setLoading(false);
    }
  }, [enabled, pagina, limite, progressiveInitialLimit, busqueda, categoria, estado, clearHydrationTimer]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
        reqIdRef.current += 1;
        clearHydrationTimer();
      };
    }
    void refetch();

    const handleProductsUpdated = () => {
      if (mountedRef.current) {
        void refetch();
      }
    };
    window.addEventListener('mercato_products_updated', handleProductsUpdated);

    return () => {
      mountedRef.current = false;
      reqIdRef.current += 1;
      clearHydrationTimer();
      window.removeEventListener('mercato_products_updated', handleProductsUpdated);
    };
  }, [enabled, refetch, clearHydrationTimer]);

  const crear = useCallback(
    async (product: Omit<Product, 'id' | 'stockStatus'> & { id?: string }) => {
      const created = await crearProducto(uiAProductoInsert(product));
      await refetch();
      return productoAUi(created);
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, product: Partial<Product>) => {
      const patch = uiAProductoInsert({
        barcode: product.barcode ?? '',
        sku: product.sku ?? '',
        plu: product.plu,
        name: product.name ?? '',
        category: product.category ?? '',
        brand: product.brand ?? '',
        unit: product.unit ?? 'Unidad',
        supplier: product.supplier ?? '',
        costPrice: product.costPrice ?? 0,
        salePrice: product.salePrice ?? 0,
        wholesalePrice: product.wholesalePrice ?? 0,
        tax: product.tax ?? 0,
        minStock: product.minStock ?? 0,
        currentStock: product.currentStock ?? 0,
        image: product.image ?? '',
        expiryDate: product.expiryDate ?? null,
        warranty: product.warranty ?? '',
        status: product.status ?? 'active',
        saleType: product.saleType,
        weightUnit: product.weightUnit,
        pricePerWeight: product.pricePerWeight,
        allowDecimal: product.allowDecimal,
        minWeight: product.minWeight,
        maxWeight: product.maxWeight,
        generateScaleBarcode: product.generateScaleBarcode,
        isWeightProduct: product.isWeightProduct,
        producto_base_id: product.producto_base_id,
        factor_conversion: product.factor_conversion,
        unidad_base: product.unidad_base,
        composite_items: product.composite_items,
        id,
      });
      await actualizarProducto(id, patch);
      await refetch();
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarProducto(id);
      await refetch();
    },
    [refetch]
  );

  return {
    productos,
    productosUi,
    total,
    loading,
    error,
    refetch,
    applyStockDeltas,
    crear,
    actualizar,
    eliminar,
  };
}
