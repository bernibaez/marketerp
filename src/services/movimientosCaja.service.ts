import { getSafeSupabaseClient, isSafeSupabaseConfigured } from './supabaseSafeClient';
import type { MovimientoCaja, TipoMovimientoCaja } from '@/types/database';

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
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const codigo = `MOV-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  const nuevo: MovimientoCaja & { cajero_nombre?: string } = {
    id,
    codigo,
    caja_id: datos.caja_id,
    cierre_id: datos.cierre_id ?? null,
    cajero_id: datos.cajero_id ?? null,
    cajero_nombre: datos.cajero_nombre ?? 'Cajero',
    tipo: datos.tipo,
    monto: Number(datos.monto || 0),
    concepto: datos.concepto,
    categoria: datos.categoria ?? null,
    creado_en: now,
  };

  const sb = getSafeSupabaseClient();
  if (sb && isSafeSupabaseConfigured()) {
    const payload: Record<string, any> = {
      id,
      codigo,
      caja_id: datos.caja_id,
      cierre_id: datos.cierre_id ?? null,
      cajero_id: datos.cajero_id ?? null,
      tipo: datos.tipo,
      monto: Number(datos.monto || 0),
      concepto: datos.concepto,
      categoria: datos.categoria ?? null,
      creado_en: now,
    };
    if (datos.cajero_nombre) {
      payload.cajero_nombre = datos.cajero_nombre;
    }

    let { data: inserted, error: insErr } = await sb
      .from('movimientos_caja')
      .insert(payload)
      .select('*')
      .single();

    if (insErr && (insErr.message?.includes('cajero_nombre') || insErr.code === '42703')) {
      delete payload.cajero_nombre;
      const retry = await sb.from('movimientos_caja').insert(payload).select('*').single();
      inserted = retry.data;
      insErr = retry.error;
    }

    if (insErr) {
      throw new Error(insErr.message || 'No se pudo registrar el movimiento de caja en el servidor.');
    }

    if (inserted) {
      return {
        id: String((inserted as any).id),
        codigo: (inserted as any).codigo || codigo,
        caja_id: String((inserted as any).caja_id ?? datos.caja_id),
        cierre_id: (inserted as any).cierre_id ? String((inserted as any).cierre_id) : (datos.cierre_id ?? null),
        cajero_id: (inserted as any).cajero_id ? String((inserted as any).cajero_id) : (datos.cajero_id ?? null),
        cajero_nombre: (inserted as any).cajero_nombre || datos.cajero_nombre || 'Cajero',
        tipo: (inserted as any).tipo || datos.tipo,
        monto: Number((inserted as any).monto ?? datos.monto ?? 0),
        concepto: (inserted as any).concepto || datos.concepto,
        categoria: (inserted as any).categoria ?? datos.categoria ?? null,
        creado_en: (inserted as any).creado_en || now,
      };
    }

    return nuevo;
  }

  saveLocalMovimientoCaja(nuevo);
  return nuevo;
}

export async function obtenerMovimientosCaja(
  cierreId?: string,
  cajaId?: string,
  options?: { incluirLegacySinCierreId?: boolean; desde?: string }
): Promise<(MovimientoCaja & { cajero_nombre?: string })[]> {
  const localList = getLocalMovimientosCaja();
  const sb = getSafeSupabaseClient();
  const desdeTime = options?.desde ? new Date(options.desde).getTime() : 0;

  const filterItem = (m: MovimientoCaja) => {
    if (cierreId) {
      if (m.cierre_id != null && String(m.cierre_id).trim() !== '') {
        return String(m.cierre_id) === String(cierreId);
      }
      if (options?.incluirLegacySinCierreId === false) return false;
      if (cajaId && String(m.caja_id) === String(cajaId)) {
        if (desdeTime > 0 && m.creado_en) {
          const mt = new Date(m.creado_en).getTime();
          if (!isNaN(mt) && mt < desdeTime) return false;
        }
        return true;
      }
      return false;
    }
    if (cajaId) {
      return String(m.caja_id) === String(cajaId);
    }
    return true;
  };

  if (!sb || !isSafeSupabaseConfigured()) {
    return localList.filter(filterItem);
  }

  try {
    let query = sb.from('movimientos_caja').select('*').order('creado_en', { ascending: false });
    if (cierreId) {
      if (options?.incluirLegacySinCierreId && cajaId) {
        query = options?.desde
          ? query.or(
              `cierre_id.eq.${cierreId},and(cierre_id.is.null,caja_id.eq.${cajaId},creado_en.gte.${options.desde})`
            )
          : query.or(`cierre_id.eq.${cierreId},and(cierre_id.is.null,caja_id.eq.${cajaId})`);
      } else {
        query = query.eq('cierre_id', cierreId);
      }
    } else if (cajaId) {
      query = query.eq('caja_id', cajaId);
    }

    const { data, error } = await query;
    if (error || !data) {
      throw error ?? new Error('No se pudieron cargar movimientos de caja');
    }

    // Supabase es la única fuente contable cuando está disponible (sin mezclar localStorage)
    return data.map((row: any) => ({
      id: String(row.id),
      codigo: row.codigo,
      caja_id: String(row.caja_id),
      cierre_id: row.cierre_id ? String(row.cierre_id) : null,
      cajero_id: row.cajero_id ? String(row.cajero_id) : null,
      cajero_nombre: row.cajero_nombre ?? undefined,
      tipo: row.tipo,
      monto: Number(row.monto || 0),
      concepto: row.concepto,
      categoria: row.categoria,
      creado_en: row.creado_en,
    }));
  } catch (err) {
    console.warn('Error consultando movimientos_caja en Supabase:', err);
    return [];
  }
}
