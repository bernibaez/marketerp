import { useCallback, useEffect, useRef, useState } from 'react';
import {
  comboDbAUi,
  eliminarCombo,
  guardarCombo,
  obtenerCombos,
} from '@/services/combos.service';
import type { Combo as UiCombo } from '@/lib/comboStore';

export function useCombos(soloActivos = false, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [combos, setCombos] = useState<UiCombo[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerCombos({ soloActivos, signal: ac.signal });
      if (!ac.signal.aborted) {
        setCombos(data.map((c) => comboDbAUi(c, c.items)));
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Error al cargar combos');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [soloActivos, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch, enabled]);

  const guardar = useCallback(
    async (combo: UiCombo) => {
      const id = await guardarCombo(combo);
      await refetch();
      return id;
    },
    [refetch]
  );

  const eliminar = useCallback(
    async (id: string) => {
      await eliminarCombo(id);
      await refetch();
    },
    [refetch]
  );

  return { combos, loading, error, refetch, guardar, eliminar };
}
