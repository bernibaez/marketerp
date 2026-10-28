import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  obtenerCategorias,
  type Categoria,
  type NuevaCategoriaInput,
} from '@/services/categorias.service';

export function useCategorias(busqueda = '') {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerCategorias({ busqueda, signal: ac.signal });
      if (!ac.signal.aborted) setCategorias(data);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al cargar categorías');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (datos: NuevaCategoriaInput) => {
      const c = await crearCategoria(datos);
      await refetch();
      return c;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Parameters<typeof actualizarCategoria>[1]) => {
      const c = await actualizarCategoria(id, datos);
      await refetch();
      return c;
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarCategoria(id);
      await refetch();
    },
    [refetch]
  );

  return {
    categorias,
    loading,
    error,
    refetch,
    crear,
    actualizar,
    eliminar,
  };
}
