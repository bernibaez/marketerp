import { useCallback, useEffect, useRef, useState } from 'react';
import { obtenerAlertasStock, obtenerMetricasDashboard } from '@/services/dashboard.service';
import type { MetricasDashboard } from '@/types/database';

export function useDashboard(
  periodo: 'hoy' | 'semana' | 'mes' | 'dia' = 'hoy',
  fechaEspecifica?: string
) {
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [alertas, setAlertas] = useState<
    { id: string; sku: string; nombre: string; stock_actual: number; stock_minimo: number; nivel_alerta: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastDateRef = useRef<string>(new Date().toDateString());

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    lastDateRef.current = new Date().toDateString();
    try {
      const [m, a] = await Promise.all([
        obtenerMetricasDashboard(periodo, ac.signal, fechaEspecifica),
        obtenerAlertasStock(ac.signal),
      ]);
      if (!ac.signal.aborted) {
        setMetricas(m);
        setAlertas(a as typeof alertas);
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [periodo, fechaEspecifica]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  // Detector de cambio de día y auto-refresco
  useEffect(() => {
    // 1. Chequeo periódico: si el día calendario cambió (medianoche pasada), refrescar inmediatamente
    const interval = setInterval(() => {
      const currentDate = new Date().toDateString();
      if (currentDate !== lastDateRef.current) {
        lastDateRef.current = currentDate;
        void refetch();
      }
    }, 30_000);

    // 2. Al cambiar visibilidad de pestaña o recibir foco (ej. reabrir navegador al día siguiente)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastDateRef.current) {
          lastDateRef.current = currentDate;
          void refetch();
        }
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    // 3. Temporizador exacto al comenzar el nuevo día a las 00:00:01
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const msUntilMidnight = Math.max(1000, midnight.getTime() - now.getTime());
    const midnightTimer = setTimeout(() => {
      lastDateRef.current = new Date().toDateString();
      void refetch();
    }, msUntilMidnight);

    return () => {
      clearInterval(interval);
      clearTimeout(midnightTimer);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [refetch]);

  return { metricas, alertas, loading, error, refetch };
}
