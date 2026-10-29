import { tryGetSupabase } from './clienteSupabase';
import {
  PERFIL_COLUMNS,
  type Perfil,
  type RolDb,
} from '@/types/database';
import type { AuthUser, UserRole } from '@/lib/auth';
import {
  authenticate as localAuthenticate,
  authenticateByCode as localAuthenticateByCode,
  verifySupervisorAdmin,
  isAdminOrSuperAdmin,
} from '@/lib/auth';

export const ROL_DB_A_UI: Record<string, string> = {
  admin: 'Administrador',
  super_admin: 'Administrador',
  superadmin: 'Super Administrador',
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  almacen: 'Almacenista',
  contable: 'Contador',
};

export const ROL_UI_A_DB: Record<string, string> = {
  Administrador: 'admin',
  'Super Administrador': 'superadmin',
  Cajero: 'cajero',
  Vendedor: 'vendedor',
  Almacenista: 'almacen',
  Contador: 'contable',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function perfilToAuthUser(perfil: Perfil): AuthUser {
  return {
    id: perfil.id,
    username: perfil.correo.split('@')[0],
    name: perfil.nombre_completo,
    email: perfil.correo,
    role: (ROL_DB_A_UI[perfil.rol] ?? perfil.rol) as UserRole,
    status: perfil.activo ? 'active' : 'inactive',
    phone: perfil.telefono ?? '',
    initials: initialsFromName(perfil.nombre_completo),
    sucursalId: perfil.sucursal_id,
    rolDb: perfil.rol,
  };
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

async function cargarPerfil(userId: string): Promise<Perfil | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('perfiles')
    .select(PERFIL_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Perfil | null;
}

/** Login email/password vía Supabase Auth, o fallback local si no hay env. */
export async function iniciarSesion(
  usuarioOEmail: string,
  password: string
): Promise<AuthResult> {
  const sb = tryGetSupabase();
  if (!sb) {
    return localAuthenticate(usuarioOEmail, password);
  }

  const input = usuarioOEmail.trim();
  const email = input.includes('@') ? input.toLowerCase() : `${input.toLowerCase()}@mercato.do`;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Usuario o contraseña incorrectos' };
  }

  try {
    const perfil = await cargarPerfil(data.user.id);
    if (!perfil) {
      await sb.auth.signOut();
      return { ok: false, error: 'Perfil de usuario no encontrado' };
    }
    if (!perfil.activo) {
      await sb.auth.signOut();
      return { ok: false, error: 'Esta cuenta está desactivada' };
    }
    return { ok: true, user: perfilToAuthUser(perfil) };
  } catch (e) {
    await sb.auth.signOut();
    return { ok: false, error: e instanceof Error ? e.message : 'Error al cargar perfil' };
  }
}

/** Código de acceso: busca en perfiles.codigo_acceso; fallback local. */
export async function iniciarSesionConCodigo(code: string): Promise<AuthResult> {
  const sb = tryGetSupabase();
  if (!sb) {
    return localAuthenticateByCode(code);
  }

  const { data, error } = await sb
    .from('perfiles')
    .select(PERFIL_COLUMNS)
    .eq('codigo_acceso', code.trim())
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Código de acceso inválido' };
  }

  // Sin password: no se puede signIn. Mantener sesión solo local si el admin
  // prefiere códigos — para Supabase requerimos email+password.
  // Intentamos sesión anónima no aplica; devolvemos perfil mapeado y
  // el contexto guardará usuario localmente (sin JWT). Mejor: rechazar.
  return {
    ok: false,
    error: 'Con Supabase activo usa email y contraseña. Los códigos se migrarán a perfiles.codigo_acceso.',
  };
}

export async function cerrarSesion(): Promise<void> {
  const sb = tryGetSupabase();
  if (sb) await sb.auth.signOut();
}

export async function obtenerSesionActual(): Promise<AuthUser | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;

  const { data } = await sb.auth.getSession();
  if (!data.session?.user) return null;

  const perfil = await cargarPerfil(data.session.user.id);
  if (!perfil || !perfil.activo) return null;
  return perfilToAuthUser(perfil);
}

export async function obtenerPerfilPorId(id: string): Promise<Perfil | null> {
  return cargarPerfil(id);
}

export async function verificarAutorizacionSupervisor(credentials: {
  code?: string;
  usernameOrEmail?: string;
  password?: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  // 1. Probar credenciales locales / códigos demo
  const localRes = verifySupervisorAdmin({
    code: credentials.code,
    username: credentials.usernameOrEmail,
    password: credentials.password,
  });
  if (localRes.ok) return localRes;

  const sb = tryGetSupabase();
  if (!sb) {
    return localRes;
  }

  // 2. Si se ingresó código PIN, buscar en perfiles de Supabase
  if (credentials.code && credentials.code.trim()) {
    try {
      const { data, error } = await sb
        .from('perfiles')
        .select(PERFIL_COLUMNS)
        .eq('codigo_acceso', credentials.code.trim())
        .eq('activo', true)
        .maybeSingle();

      if (!error && data) {
        const authUser = perfilToAuthUser(data as Perfil);
        if (isAdminOrSuperAdmin(authUser)) {
          return { ok: true, user: authUser };
        }
        return {
          ok: false,
          error: `El usuario "${authUser.name}" (${authUser.role}) no tiene permisos de Administrador o Super Administrador.`,
        };
      }
    } catch {
      // Ignorar y continuar a validación
    }
  }

  // 3. Si se ingresó usuario/correo y contraseña en modo Supabase
  if (credentials.usernameOrEmail && credentials.password) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (url && key) {
        // Cliente aislado sin persistencia para no cerrar la sesión del cajero actual
        const tempClient = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const input = credentials.usernameOrEmail.trim();
        const email = input.includes('@') ? input.toLowerCase() : `${input.toLowerCase()}@mercato.do`;
        const { data: authData, error: authErr } = await tempClient.auth.signInWithPassword({
          email,
          password: credentials.password,
        });

        if (!authErr && authData?.user) {
          const perfil = await cargarPerfil(authData.user.id);
          if (perfil && perfil.activo) {
            const authUser = perfilToAuthUser(perfil);
            if (isAdminOrSuperAdmin(authUser)) {
              return { ok: true, user: authUser };
            }
            return {
              ok: false,
              error: `El usuario "${authUser.name}" (${authUser.role}) no tiene permisos de Administrador o Super Administrador.`,
            };
          }
        }
      }
    } catch {
      // Continuar al fallo
    }
  }

  return { ok: false, error: 'Código o credenciales de administrador incorrectos' };
}
