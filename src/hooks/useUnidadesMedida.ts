import { useCallback, useEffect, useRef, useState } from 'react';
import {
  actualizarUnidadMedida,
  crearUnidadMedida,
  eliminarUnidadMedida,
  obtenerUnidadesMedida,
  type NuevaUnidadMedidaInput,
  type TipoUnidadMedida,
  type UnidadMedida,
} from '@/services/unidadesMedida.service';

export interface UseUnidadesMedidaOptions {
  busqueda?: string;
  search?: string;
  tipo?: TipoUnidadMedida | 'todas' | 'todos';
}

export function useUnidadesMedida(
  filtro?: string | UseUnidadesMedidaOptions,
  tipoArg: TipoUnidadMedida | 'todas' | 'todos' = 'todas'
) {
  const busqueda = typeof filtro === 'string' ? filtro : filtro?.busqueda ?? filtro?.search ?? '';
  const rawTipo = typeof filtro === 'object' && filtro ? filtro.tipo ?? 'todas' : tipoArg;
  const tipo: TipoUnidadMedida | 'todas' = rawTipo === 'todos' ? 'todas' : rawTipo;
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
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
      const data = await obtenerUnidadesMedida({ busqueda, tipo, signal: ac.signal });
      if (!ac.signal.aborted) setUnidades(data);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al cargar unidades de medida');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [busqueda, tipo]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const crear = useCallback(
    async (datos: NuevaUnidadMedidaInput) => {
      const u = await crearUnidadMedida(datos);
      await refetch();
      return u;
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (id: string, datos: Parameters<typeof actualizarUnidadMedida>[1]) => {
      const u = await actualizarUnidadMedida(id, datos);
      await refetch();
      return u;
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarUnidadMedida(id);
      await refetch();
    },
    [refetch]
  );

  return {
    unidades,
    loading,
    error,
    refetch,
    crear,
    actualizar,
    eliminar,
  };
}
