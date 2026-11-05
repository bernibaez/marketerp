import { tryGetSupabase } from './clienteSupabase';
import { PERFIL_COLUMNS, type Perfil, type RolDb } from '@/types/database';
import { AUTH_ACCOUNTS, saveStoredUserPassword } from '@/lib/auth';
import { ROL_DB_A_UI } from './auth.service';
import { isUuid } from './roles.service';

export type CrearUsuarioPayload = {
  correo: string;
  password: string;
  nombre_completo: string;
  rol: RolDb;
  sucursal_id?: string | null;
  telefono?: string | null;
  codigo_acceso?: string | null;
};

const LOCAL_PERFILES_KEY = 'mercato_local_perfiles';

function mockPerfiles(): Perfil[] {
  return AUTH_ACCOUNTS.map((a) => ({
    id: String(a.id),
    nombre_completo: a.name,
    correo: a.email,
    telefono: a.phone,
    rol: (Object.entries(ROL_DB_A_UI).find(([, v]) => v === a.role)?.[0] as RolDb) ?? 'cajero',
    sucursal_id: null,
    codigo_acceso: null,
    activo: a.status === 'active',
  }));
}

function getLocalPerfiles(): Perfil[] {
  try {
    const raw = localStorage.getItem(LOCAL_PERFILES_KEY);
    if (raw) return JSON.parse(raw);
    const initial = mockPerfiles();
    localStorage.setItem(LOCAL_PERFILES_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return mockPerfiles();
  }
}

function saveLocalPerfiles(perfiles: Perfil[]): void {
  localStorage.setItem(LOCAL_PERFILES_KEY, JSON.stringify(perfiles));
}

function errorSupabaseUsuario(error: unknown): Error {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    if (
      e.message?.includes('perfiles_rol_check') ||
      e.message?.includes('check constraint') ||
      e.message?.includes('Rol inválido') ||
      e.details?.includes('perfiles_rol_check')
    ) {
      return new Error(
        'El rol seleccionado requiere habilitar roles dinámicos en Supabase. Ejecuta el script "supabase/migrations/014_permitir_roles_personalizados.sql" en el SQL Editor de tu panel de Supabase.'
      );
    }
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    return new Error(parts.join(' — ') || 'Error al procesar usuario en Supabase');
  }
  return error instanceof Error ? error : new Error('Error de Supabase');
}

export async function obtenerUsuarios(opts?: {
  busqueda?: string;
  signal?: AbortSignal;
}): Promise<Perfil[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    let list = getLocalPerfiles();
    const q = opts?.busqueda?.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.nombre_completo.toLowerCase().includes(q) || p.correo.toLowerCase().includes(q)
      );
    }
    return list;
  }

  let query = sb.from('perfiles').select(PERFIL_COLUMNS).order('nombre_completo');
  if (opts?.busqueda?.trim()) {
    const q = opts.busqueda.trim();
    query = query.or(`nombre_completo.ilike.%${q}%,correo.ilike.%${q}%`);
  }
  if (opts?.signal) {
    query = query.abortSignal(opts.signal);
  }
  const { data, error } = await query;
  if (error) throw errorSupabaseUsuario(error);
  return (data ?? []) as Perfil[];
}

/** Alta de usuario vía RPC (inserta auth.users + perfiles) o fallback local. */
export async function crearUsuario(payload: CrearUsuarioPayload): Promise<string> {
  const sb = tryGetSupabase();
  if (!sb) {
    const list = getLocalPerfiles();
    const newId = `local-user-${Date.now()}`;
    const nuevo: Perfil = {
      id: newId,
      nombre_completo: payload.nombre_completo,
      correo: payload.correo,
      telefono: payload.telefono ?? null,
      rol: payload.rol,
      sucursal_id: payload.sucursal_id ?? null,
      codigo_acceso: payload.codigo_acceso ?? null,
      activo: true,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };
    saveLocalPerfiles([...list, nuevo]);
    saveStoredUserPassword(newId, payload.correo, payload.password);
    return newId;
  }

  try {
    const { data, error } = await sb.rpc('crear_usuario_sistema', {
      p_correo: payload.correo,
      p_password: payload.password,
      p_nombre_completo: payload.nombre_completo,
      p_rol: payload.rol,
      p_sucursal_id: payload.sucursal_id ?? null,
      p_telefono: payload.telefono ?? null,
      p_codigo_acceso: payload.codigo_acceso ?? null,
    });
    if (error) throw errorSupabaseUsuario(error);
    return data as string;
  } catch (err) {
    throw errorSupabaseUsuario(err);
  }
}

export async function actualizarPerfil(
  id: string,
  datos: Partial<Pick<Perfil, 'nombre_completo' | 'telefono' | 'rol' | 'sucursal_id' | 'activo' | 'codigo_acceso'>>
): Promise<Perfil> {
  const sb = tryGetSupabase();
  const updateLocal = (): Perfil => {
    const list = getLocalPerfiles();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Usuario no encontrado');
    const updated: Perfil = {
      ...list[idx],
      ...datos,
      actualizado_en: new Date().toISOString(),
    };
    list[idx] = updated;
    saveLocalPerfiles(list);
    return updated;
  };

  if (!sb || !isUuid(id)) {
    return updateLocal();
  }

  try {
    const updatePayload: Record<string, unknown> = {
      ...datos,
      actualizado_en: new Date().toISOString(),
    };
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });

    const { data, error } = await sb
      .from('perfiles')
      .update(updatePayload)
      .eq('id', id)
      .select(PERFIL_COLUMNS)
      .single();

    if (error) throw errorSupabaseUsuario(error);
    return data as Perfil;
  } catch (err) {
    throw errorSupabaseUsuario(err);
  }
}

export async function alternarActivoUsuario(id: string, activo: boolean): Promise<void> {
  await actualizarPerfil(id, { activo });
}

/** Soft-delete: desactiva el usuario (no borra auth.users). */
export async function eliminarUsuario(id: string): Promise<void> {
  await actualizarPerfil(id, { activo: false });
}

/**
 * Cambia la contraseña de un usuario en el sistema.
 * Soporta actualización en Supabase (usuario propio vía updateUser, o terceros vía RPC cambiar_password_usuario)
 * y persistencia en almacén local / usuarios de demostración.
 */
export async function cambiarPasswordUsuario(
  id: string,
  nuevaPassword: string,
  correo?: string
): Promise<void> {
  const trimmed = nuevaPassword.trim();
  if (!trimmed || trimmed.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
  }

  // 1. Guardar en almacenamiento local para asegurar funcionamiento offline y cuentas demo
  saveStoredUserPassword(id, correo || '', trimmed);

  const sb = tryGetSupabase();
  if (!sb || !isUuid(id)) {
    return;
  }

  // 2. Si el usuario actual es quien cambia su propia contraseña en Supabase
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const currentUid = sessionData.session?.user?.id;
    if (currentUid && currentUid === id) {
      const { error } = await sb.auth.updateUser({ password: trimmed });
      if (error) throw errorSupabaseUsuario(error);
      return;
    }
  } catch (e) {
    if (e instanceof Error && !e.message.includes('not authenticated')) {
      // Si falló específicamente la actualización de auth propio
      throw errorSupabaseUsuario(e);
    }
  }

  // 3. Si un administrador cambia la contraseña de otro usuario mediante RPC en Supabase
  try {
    const { error } = await sb.rpc('cambiar_password_usuario', {
      p_user_id: id,
      p_nueva_password: trimmed,
    });
    if (error) {
      if (
        error.message?.includes('function') ||
        error.message?.includes('does not exist') ||
        (error as any).code === '42883'
      ) {
        console.warn(
          'Para cambiar contraseñas de otros usuarios en Supabase debes ejecutar la migración 028_cambiar_password_usuario.sql'
        );
      } else {
        throw errorSupabaseUsuario(error);
      }
    }
  } catch (err) {
    throw errorSupabaseUsuario(err);
  }
}
