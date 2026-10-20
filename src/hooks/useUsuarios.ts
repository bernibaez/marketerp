import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarPerfil,
  alternarActivoUsuario,
  crearUsuario,
  eliminarUsuario,
  obtenerUsuarios,
  type CrearUsuarioPayload,
} from '@/services/usuarios.service';
import type { Perfil } from '@/types/database';

export function useUsuarios(busqueda = '') {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
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
      const data = await obtenerUsuarios({ busqueda, signal: ac.signal });
      if (!ac.signal.aborted) setUsuarios(data);
    } catch (e) {
      if (
        ac.signal.aborted ||
        (e as Error)?.name === 'AbortError' ||
        (e as Error)?.message?.toLowerCase().includes('abort')
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (payload: CrearUsuarioPayload) => {
      const id = await crearUsuario(payload);
      await refetch();
      return id;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Parameters<typeof actualizarPerfil>[1]) => {
      await actualizarPerfil(id, datos);
      await refetch();
    },
    [refetch]
  );

  const alternarActivo = useCallback(
    async (id: string, activo: boolean) => {
      setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, activo } : u)));
      try {
        await alternarActivoUsuario(id, activo);
      } catch (e) {
        await refetch();
        throw e;
      }
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarUsuario(id);
      await refetch();
    },
    [refetch]
  );

  return { usuarios, loading, error, refetch, crear, actualizar, alternarActivo, eliminar };
}
