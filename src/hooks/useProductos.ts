import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  obtenerProductos,
  productoAUi,
  uiAProductoInsert,
  type ProductosFiltro,
} from '@/services/productos.service';
import type { Product } from '@/pages/product-management/components/ProductManagementScreen';
import type { Producto } from '@/types/database';
import { isAbortError } from '@/lib/isAbortError';

export function useProductos(params: ProductosFiltro = {}) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosUi, setProductosUi] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const mountedRef = useRef(true);

  const pagina = params.pagina ?? 1;
  const limite = params.limite ?? 5000;
  const busqueda = params.busqueda ?? '';
  const categoria = params.categoria;
  const estado = params.estado;

  const refetch = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await obtenerProductos({
        pagina,
        limite,
        busqueda,
        categoria,
        estado,
      });
      if (!mountedRef.current || reqId !== reqIdRef.current) return;
      setProductos(res.datos);
      setProductosUi(res.datos.map(productoAUi));
      setTotal(res.total);
    } catch (e) {
      if (isAbortError(e) || !mountedRef.current || reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      if (mountedRef.current && reqId === reqIdRef.current) setLoading(false);
    }
  }, [pagina, limite, busqueda, categoria, estado]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
      reqIdRef.current += 1;
    };
  }, [refetch]);

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
    crear,
    actualizar,
    eliminar,
  };
}
