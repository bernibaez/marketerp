import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarAgente,
  alternarActivoAgente,
  crearAgente,
  eliminarAgente,
  obtenerAgentes,
  type NuevoAgenteInput,
} from '@/services/agentes.service';
import type { AgenteComercial } from '@/types/database';

export function useAgentes(busqueda = '') {
  const [agentes, setAgentes] = useState<AgenteComercial[]>([]);
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
      const data = await obtenerAgentes({ busqueda, signal: ac.signal });
      if (!ac.signal.aborted) setAgentes(data);
    } catch (e) {
      if (
        ac.signal.aborted ||
        (e as Error)?.name === 'AbortError' ||
        (e as Error)?.message?.toLowerCase().includes('abort')
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Error al cargar agentes');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (payload: NuevoAgenteInput) => {
      const created = await crearAgente(payload);
      await refetch();
      return created;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Partial<NuevoAgenteInput>) => {
      await actualizarAgente(id, datos);
      await refetch();
    },
    [refetch]
  );

  const alternarActivo = useCallback(
    async (id: string, activo: boolean) => {
      await alternarActivoAgente(id, activo);
      await refetch();
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarAgente(id);
      await refetch();
    },
    [refetch]
  );

  return {
    agentes,
    loading,
    error,
    refetch,
    crear,
    actualizar,
    alternarActivo,
    eliminar,
  };
}
