import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '@/lib/isAbortError';
import {
  obtenerDevoluciones,
  crearDevolucion,
  cambiarEstadoDevolucion,
  type DevolucionConDetalle,
  type PayloadDevolucion,
} from '@/services/devoluciones.service';
import type { EstadoDevolucion } from '@/types/database';

export function useDevoluciones(params: {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  estado?: EstadoDevolucion;
} = {}) {
  const [devoluciones, setDevoluciones] = useState<DevolucionConDetalle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await obtenerDevoluciones({ ...params, signal: ac.signal });
      if (!ac.signal.aborted) {
        setDevoluciones(res.datos);
        setTotal(res.total);
        setError(null);
      }
    } catch (e) {
      if (ac.signal.aborted || isAbortError(e)) return;
      setError(e instanceof Error ? e.message : 'Error al cargar devoluciones');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [params.pagina, params.limite, params.busqueda, params.estado]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const registrarDevolucion = useCallback(
    async (payload: PayloadDevolucion) => {
      setProcesando(true);
      try {
        const dev = await crearDevolucion(payload);
        await refetch();
        return dev;
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  const procesarEstado = useCallback(
    async (devolucionId: string, nuevoEstado: EstadoDevolucion, motivoRechazo?: string) => {
      setProcesando(true);
      try {
        await cambiarEstadoDevolucion(devolucionId, nuevoEstado, motivoRechazo);
        await refetch();
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  return {
    devoluciones,
    total,
    loading,
    error,
    procesando,
    refetch,
    registrarDevolucion,
    procesarEstado,
  };
}
