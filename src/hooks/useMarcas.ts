import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarMarca,
  crearMarca,
  eliminarMarca,
  obtenerMarcas,
  type Marca,
  type NuevaMarcaInput,
} from '@/services/marcas.service';

export function useMarcas(busqueda = '') {
  const [marcas, setMarcas] = useState<Marca[]>([]);
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
      const data = await obtenerMarcas({ busqueda, signal: ac.signal });
      if (!ac.signal.aborted) setMarcas(data);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al cargar marcas');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (datos: NuevaMarcaInput) => {
      const m = await crearMarca(datos);
      await refetch();
      return m;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Parameters<typeof actualizarMarca>[1]) => {
      const m = await actualizarMarca(id, datos);
      await refetch();
      return m;
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarMarca(id);
      await refetch();
    },
    [refetch]
  );

  return {
    marcas,
    loading,
    error,
    refetch,
    crear,
    actualizar,
    eliminar,
  };
}
