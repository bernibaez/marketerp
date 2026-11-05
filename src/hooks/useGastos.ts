import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarEstadoGasto,
  actualizarGasto,
  crearCategoriaGasto,
  crearGasto,
  eliminarCategoriaGasto,
  eliminarGasto,
  obtenerCategoriasGasto,
  obtenerGastos,
  type CategoriaGastoUi,
  type GastoUi,
  type NuevaCategoriaGastoInput,
  type NuevoGastoInput,
} from '@/services/gastos.service';
import type { EstadoGasto } from '@/types/database';
import { isAbortError } from '@/lib/isAbortError';

export function useGastos() {
  const [gastos, setGastos] = useState<GastoUi[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGastoUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [g, c] = await Promise.all([obtenerGastos(), obtenerCategoriasGasto()]);
      if (!mountedRef.current || reqId !== reqIdRef.current) return;
      setGastos(g);
      setCategorias(c);
    } catch (e) {
      if (isAbortError(e) || !mountedRef.current || reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar gastos');
    } finally {
      if (mountedRef.current && reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();

    const handleUpdate = () => {
      void refetch();
    };
    window.addEventListener('mercato_gastos_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      mountedRef.current = false;
      reqIdRef.current += 1;
      window.removeEventListener('mercato_gastos_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refetch]);

  const crear = useCallback(
    async (input: NuevoGastoInput) => {
      await crearGasto(input);
      await refetch();
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, input: Partial<NuevoGastoInput>) => {
      await actualizarGasto(id, input);
      await refetch();
    },
    [refetch]
  );

  const crearCategoria = useCallback(
    async (input: NuevaCategoriaGastoInput) => {
      await crearCategoriaGasto(input);
      await refetch();
    },
    [refetch]
  );

  const cambiarEstado = useCallback(
    async (id: string, estado: EstadoGasto) => {
      await actualizarEstadoGasto(id, estado);
      await refetch();
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarGasto(id);
      await refetch();
    },
    [refetch]
  );

  const eliminarCategoria = useCallback(
    async (id: string) => {
      await eliminarCategoriaGasto(id);
      await refetch();
    },
    [refetch]
  );

  return {
    gastos,
    categorias,
    loading,
    error,
    refetch,
    crear,
    actualizar,
    crearCategoria,
    cambiarEstado,
    eliminar,
    eliminarCategoria,
  };
}
