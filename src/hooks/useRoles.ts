import { useCallback, useEffect, useRef, useState } from 'react';
import {
  obtenerRoles,
  crearRol,
  actualizarRol,
  eliminarRol,
} from '@/services/roles.service';
import type { Rol } from '@/types/database';

export function useRoles(busqueda = '') {
  const [roles, setRoles] = useState<Rol[]>([]);
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
      const data = await obtenerRoles({ busqueda, signal: ac.signal });
      if (!ac.signal.aborted) {
        setRoles(data);
      }
    } catch (e) {
      if (
        ac.signal.aborted ||
        (e as Error)?.name === 'AbortError' ||
        (e as Error)?.message?.toLowerCase().includes('abort')
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Error al cargar roles');
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  }, [busqueda]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (datos: Omit<Rol, 'id' | 'creado_en' | 'actualizado_en'>) => {
      const nuevo = await crearRol(datos);
      await refetch();
      return nuevo;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Partial<Omit<Rol, 'id' | 'creado_en' | 'actualizado_en'>>) => {
      const act = await actualizarRol(id, datos);
      await refetch();
      return act;
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarRol(id);
      await refetch();
    },
    [refetch]
  );

  return { roles, loading, error, refetch, crear, actualizar, eliminar };
}
