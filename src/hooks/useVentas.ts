import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '@/lib/isAbortError';
import {
  obtenerHistorialVentas,
  obtenerVentaPorId,
  anularVenta,
  actualizarVenta,
  procesarVenta,
  type PayloadVenta,
  type VentaConDetalle,
  type ActualizarVentaPayload,
} from '@/services/ventas.service';

export function useVentas(params: {
  pagina?: number;
  limite?: number;
  fechaInicio?: string;
  fechaFin?: string;
  busqueda?: string;
  cajeroId?: string;
  cajaId?: string;
} = {}) {
  const [ventas, setVentas] = useState<VentaConDetalle[]>([]);
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
      const res = await obtenerHistorialVentas({ ...params, signal: ac.signal });
      if (!ac.signal.aborted) {
        setVentas(res.datos);
        setTotal(res.total);
        setError(null);
      }
    } catch (e) {
      if (ac.signal.aborted || isAbortError(e)) return;
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Error al cargar ventas';
      setError(msg || 'Error al cargar ventas');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [
    params.pagina,
    params.limite,
    params.fechaInicio,
    params.fechaFin,
    params.busqueda,
    params.cajeroId,
    params.cajaId,
  ]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  const cobrar = useCallback(
    async (payload: PayloadVenta) => {
      setProcesando(true);
      try {
        const result = await procesarVenta(payload);
        await refetch();
        return result;
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  const obtenerDetalle = useCallback(async (ventaId: string) => {
    return await obtenerVentaPorId(ventaId);
  }, []);

  const anular = useCallback(
    async (ventaId: string, motivo?: string) => {
      setProcesando(true);
      try {
        await anularVenta(ventaId, motivo);
        await refetch();
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  const actualizar = useCallback(
    async (ventaId: string, payload: ActualizarVentaPayload) => {
      setProcesando(true);
      try {
        await actualizarVenta(ventaId, payload);
        await refetch();
      } finally {
        setProcesando(false);
      }
    },
    [refetch]
  );

  return {
    ventas,
    total,
    loading,
    error,
    procesando,
    refetch,
    cobrar,
    obtenerDetalle,
    anular,
    actualizar,
  };
}

