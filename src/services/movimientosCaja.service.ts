import { tryGetSupabase, isSupabaseConfigured, getSupabase } from './clienteSupabase';
import type { MovimientoCaja, TipoMovimientoCaja } from '@/types/database';

const isTestEnv =
  typeof process !== 'undefined' &&
  Boolean(
    process.env.VITEST ||
    process.env.NODE_ENV === 'test' ||
    (typeof process.env.npm_lifecycle_event === 'string' && process.env.npm_lifecycle_event.includes('test'))
  );

function getSafeSupabase() {
  if (isTestEnv) return null;
  return tryGetSupabase();
}

const LOCAL_MOVIMIENTOS_KEY = 'mercato_movimientos_caja_local';

export interface NuevoMovimientoCajaInput {
  caja_id: string;
  cierre_id?: string | null;
  cajero_id?: string | null;
  cajero_nombre?: string;
  tipo: TipoMovimientoCaja; // 'entrada' | 'salida' | 'gasto' | 'retiro' | 'aporte'
  monto: number;
  concepto: string;
  categoria?: string | null;
}

export function getLocalMovimientosCaja(): (MovimientoCaja & { cajero_nombre?: string })[] {
  try {
    const raw = localStorage.getItem(LOCAL_MOVIMIENTOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMovimientoCaja(mov: MovimientoCaja & { cajero_nombre?: string }) {
  const current = getLocalMovimientosCaja();
  localStorage.setItem(LOCAL_MOVIMIENTOS_KEY, JSON.stringify([mov, ...current]));
}

export async function registrarMovimientoCaja(
  datos: NuevoMovimientoCajaInput
): Promise<MovimientoCaja & { cajero_nombre?: string }> {
  const now = new Date().toISOString();
  const id = `mov-${Date.now()}`;
  const codigo = `MOV-${Date.now().toString().slice(-6)}`;

  const nuevo: MovimientoCaja & { cajero_nombre?: string } = {
    id,
    codigo,
    caja_id: datos.caja_id,
    cierre_id: datos.cierre_id ?? null,
    cajero_id: datos.cajero_id ?? null,
    cajero_nombre: datos.cajero_nombre ?? 'Cajero',
    tipo: datos.tipo,
    monto: datos.monto,
    concepto: datos.concepto,
    categoria: datos.categoria ?? null,
    creado_en: now,
  };

  saveLocalMovimientoCaja(nuevo);

  const sb = getSafeSupabase();
  if (sb && isSupabaseConfigured()) {
    try {
      const payload: Record<string, any> = {
        codigo,
        caja_id: datos.caja_id,
        cierre_id: datos.cierre_id ?? null,
        cajero_id: datos.cajero_id ?? null,
        tipo: datos.tipo,
        monto: datos.monto,
        concepto: datos.concepto,
        categoria: datos.categoria ?? null,
      };
      if (datos.cajero_nombre) {
        payload.cajero_nombre = datos.cajero_nombre;
      }
      const { error: insErr } = await sb.from('movimientos_caja').insert(payload);
      if (insErr && (insErr.message?.includes('cajero_nombre') || insErr.code === '42703')) {
        delete payload.cajero_nombre;
        await sb.from('movimientos_caja').insert(payload);
      }
    } catch {
      // Fallback a local storage
    }
  }

  return nuevo;
}

export async function obtenerMovimientosCaja(cierreId?: string, cajaId?: string): Promise<(MovimientoCaja & { cajero_nombre?: string })[]> {
  const localList = getLocalMovimientosCaja();
  const sb = getSafeSupabase();

  const filterItem = (m: MovimientoCaja) => {
    if (cierreId) {
      if (m.cierre_id === cierreId) return true;
      if (!m.cierre_id && cajaId && String(m.caja_id) === String(cajaId)) return true;
      return false;
    }
    if (cajaId) {
      return String(m.caja_id) === String(cajaId);
    }
    return true;
  };

  if (!sb || !isSupabaseConfigured()) {
    return localList.filter(filterItem);
  }

  try {
    let query = sb.from('movimientos_caja').select('*').order('creado_en', { ascending: false });
    if (cierreId && cajaId) {
      query = query.or(`cierre_id.eq.${cierreId},and(cierre_id.is.null,caja_id.eq.${cajaId})`);
    } else if (cierreId) {
      query = query.or(`cierre_id.eq.${cierreId},cierre_id.is.null`);
    } else if (cajaId) {
      query = query.eq('caja_id', cajaId);
    }

    const { data, error } = await query;
    if (error || !data) return localList.filter(filterItem);

    const fromDb: (MovimientoCaja & { cajero_nombre?: string })[] = data.map((row: any) => ({
      id: String(row.id),
      codigo: row.codigo,
      caja_id: String(row.caja_id),
      cierre_id: row.cierre_id ? String(row.cierre_id) : null,
      cajero_id: row.cajero_id ? String(row.cajero_id) : null,
      tipo: row.tipo,
      monto: Number(row.monto || 0),
      concepto: row.concepto,
      categoria: row.categoria,
      creado_en: row.creado_en,
    }));

    const dbIds = new Set(fromDb.map((m) => m.id));
    const pendingLocal = localList.filter((m) => !dbIds.has(m.id) && filterItem(m));
    return [...pendingLocal, ...fromDb];
  } catch {
    return localList.filter(filterItem);
  }
}
