import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '@/lib/isAbortError';
import {
  obtenerCotizaciones,
  crearCotizacion,
  actualizarEstadoCotizacion,
  convertirCotizacionAVenta,
  type CotizacionConDetalle,
  type PayloadCotizacion,
} from '@/services/cotizaciones.service';
import type { EstadoCotizacion } from '@/types/database';

export function useCotizaciones(params: {
  pagina?: number;
  limite?: number;
  busqueda?: string;
  estado?: EstadoCotizacion;
} = {}) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionConDetalle[]>([]);
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
      const res = await obtenerCotizaciones({ ...params, signal: ac.signal });
      if (!ac.signal.aborted) {
        setCotizaciones(res.datos);
        setTotal(res.total);
        setError(null);
      }
    } catch (e) {
      if (ac.signal.aborted || isAbortError(e)) return;
      setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [params.pagina, params.limite, params.busqueda, params.estado]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const guardarCotizacion = useCallback(
    async (payload: PayloadCotizacion) => {
      setProcesando(true);
      try {
        const cot = await crearCotizacion(payload);
        await refetch();
        return cot;
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  const cambiarEstado = useCallback(
    async (cotizacionId: string, nuevoEstado: EstadoCotizacion) => {
      setProcesando(true);
      try {
        await actualizarEstadoCotizacion(cotizacionId, nuevoEstado);
        await refetch();
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  const convertirAVenta = useCallback(
    async (cotizacionId: string, metodoPago: string = 'efectivo') => {
      setProcesando(true);
      try {
        const res = await convertirCotizacionAVenta(cotizacionId, metodoPago);
        await refetch();
        return res;
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  return {
    cotizaciones,
    total,
    loading,
    error,
    procesando,
    refetch,
    guardarCotizacion,
    cambiarEstado,
    convertirAVenta,
  };
}
