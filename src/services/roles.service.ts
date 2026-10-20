import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { ROL_COLUMNS, type Rol } from '@/types/database';
import type { UserRole } from '@/types/roles';
import {
  buildDefaultMatrix,
  PERMISSION_MODULES,
  type PermissionsMatrix,
  type RolePermissionMap,
} from '@/lib/permissionsCatalog';
import { ROL_DB_A_UI, ROL_UI_A_DB } from './auth.service';

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.message.toLowerCase().includes('abort')) return true;
  }
  if (typeof error === 'object') {
    const e = error as { name?: string; message?: string; details?: string; hint?: string };
    if (e.name === 'AbortError') return true;
    if (e.message?.toLowerCase().includes('abort')) return true;
    if (e.details?.toLowerCase().includes('abort')) return true;
    if (e.hint?.toLowerCase().includes('abort')) return true;
  }
  return false;
}

function errorSupabase(error: unknown): Error {
  if (isAbortError(error)) {
    const err = new Error('Operación cancelada');
    err.name = 'AbortError';
    return err;
  }
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    if (
      e.code === '42P01' ||
      e.code === 'PGRST205' ||
      e.message?.includes('42P01') ||
      e.message?.includes('Could not find the table') ||
      (e.message?.includes('roles') && e.message?.includes('does not exist'))
    ) {
      return new Error(
        'La tabla "roles" no existe en Supabase. Ejecuta supabase/migrations/008_crear_tabla_roles.sql en el SQL Editor.'
      );
    }
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    return new Error(parts.join(' — ') || 'Error de Supabase');
  }
  return error instanceof Error ? error : new Error('Error de Supabase');
}

export function isMissingRolesTableError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    return error.message.includes('tabla "roles" no existe') || error.message.includes('relation "roles" does not exist') || error.message.includes('42P01');
  }
  if (typeof error === 'object') {
    const e = error as { code?: string; message?: string };
    return (
      e.code === '42P01' ||
      e.code === 'PGRST205' ||
      !!e.message?.includes('42P01') ||
      (!!e.message?.includes('roles') && (!!e.message?.includes('does not exist') || !!e.message?.includes('no existe')))
    );
  }
  return false;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export function generateFallbackUuid(idx = 0): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  const hex = ((idx + 1) * 7919 + Date.now()).toString(16).padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}

const LOCAL_ROLES_KEY = 'mercato_local_roles';
const ROLE_CODES = ['admin', 'cajero', 'vendedor', 'almacen', 'contable'] as const;

function getInitialLocalRoles(): Rol[] {
  const matrix = buildDefaultMatrix();
  return ROLE_CODES.map((codigo, idx) => {
    const nombre = ROL_DB_A_UI[codigo];
    return {
      id: generateFallbackUuid(idx),
      codigo,
      nombre,
      descripcion:
        codigo === 'admin'
          ? 'Acceso total al sistema y configuración'
          : codigo === 'cajero'
            ? 'Acceso exclusivo al Punto de Venta (POS) y Cierre de Caja'
            : codigo === 'vendedor'
              ? 'Ventas, clientes y cuentas por cobrar'
              : codigo === 'almacen'
                ? 'Inventario, compras y transferencias'
                : 'Finanzas, informes y auditoría',
      permisos: matrix[nombre] ?? {},
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };
  });
}

export function getLocalRoles(busqueda = ''): Rol[] {
  try {
    const raw = localStorage.getItem(LOCAL_ROLES_KEY);
    let roles: Rol[] = raw ? JSON.parse(raw) : [];
    if (!roles || roles.length === 0) {
      roles = getInitialLocalRoles();
      localStorage.setItem(LOCAL_ROLES_KEY, JSON.stringify(roles));
    } else {
      // Migrar IDs locales antiguos (ej: "local-role-1") a UUIDs válidos para evitar errores de sintaxis en Postgres
      let migrated = false;
      roles = roles.map((r, idx) => {
        if (!isUuid(r.id)) {
          migrated = true;
          return { ...r, id: generateFallbackUuid(idx) };
        }
        return r;
      });
      if (migrated) {
        localStorage.setItem(LOCAL_ROLES_KEY, JSON.stringify(roles));
      }
    }
    if (!busqueda.trim()) return roles;
    const q = busqueda.trim().toLowerCase();
    return roles.filter(
      (r) =>
        r.nombre.toLowerCase().includes(q) ||
        r.codigo.toLowerCase().includes(q) ||
        (r.descripcion && r.descripcion.toLowerCase().includes(q))
    );
  } catch {
    return getInitialLocalRoles();
  }
}

function saveLocalRoles(roles: Rol[]): void {
  localStorage.setItem(LOCAL_ROLES_KEY, JSON.stringify(roles));
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no está configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }
  return getSupabase();
}

/** Matriz vacía (todo false). Admin queda con acceso total. */
export function emptyPermissionsMatrix(): PermissionsMatrix {
  const emptyRole = (): RolePermissionMap =>
    Object.fromEntries(
      PERMISSION_MODULES.map((m) => [m.id, Object.fromEntries(m.actions.map((a) => [a, false]))])
    );

  const admin = emptyRole();
  for (const m of PERMISSION_MODULES) {
    admin[m.id] = Object.fromEntries(m.actions.map((a) => [a, true]));
  }

  return {
    Administrador: admin,
    Cajero: emptyRole(),
    Vendedor: emptyRole(),
    Almacenista: emptyRole(),
    Contador: emptyRole(),
  };
}

function mergeRolePermisos(base: RolePermissionMap, stored: RolePermissionMap | null | undefined): RolePermissionMap {
  const next: RolePermissionMap = { ...base };
  for (const mod of PERMISSION_MODULES) {
    next[mod.id] = {
      ...base[mod.id],
      ...(stored?.[mod.id] ?? {}),
    };
  }
  return next;
}

export function isRlsOrPermissionError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'object') {
    const e = error as { code?: string; message?: string };
    return (
      e.code === '42501' ||
      !!e.message?.includes('violates row-level security policy') ||
      !!e.message?.includes('permission denied')
    );
  }
  return false;
}

export async function obtenerRoles(params?: {
  busqueda?: string;
  signal?: AbortSignal;
}): Promise<Rol[]> {
  const sb = tryGetSupabase();
  if (!sb) {
    return getLocalRoles(params?.busqueda);
  }

  try {
    let query = sb.from('roles').select(ROL_COLUMNS).order('nombre');

    if (params?.busqueda?.trim()) {
      const q = params.busqueda.trim();
      query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%`);
    }
    if (params?.signal) query = query.abortSignal(params.signal);

    const { data, error } = await query;
    if (params?.signal?.aborted || isAbortError(error)) {
      const err = new Error('Operación cancelada');
      err.name = 'AbortError';
      throw err;
    }
    if (error) {
      if (isMissingRolesTableError(error) || isRlsOrPermissionError(error)) {
        return getLocalRoles(params?.busqueda);
      }
      throw errorSupabase(error);
    }

    const roles: Rol[] = (data ?? []) as Rol[];
    const existingCodes = new Set(roles.map((r) => r.codigo.toLowerCase()));

    // Asegurar que los roles estándar del sistema (como Almacenista) existan siempre
    const initial = getInitialLocalRoles();
    for (const initRol of initial) {
      if (!existingCodes.has(initRol.codigo.toLowerCase())) {
        roles.push(initRol);
        existingCodes.add(initRol.codigo.toLowerCase());
      }
    }

    // Incluir roles creados localmente que aún no se hayan guardado en Supabase
    const local = getLocalRoles(params?.busqueda);
    for (const locRol of local) {
      if (!existingCodes.has(locRol.codigo.toLowerCase())) {
        roles.push(locRol);
        existingCodes.add(locRol.codigo.toLowerCase());
      }
    }

    return roles;
  } catch (e) {
    if (params?.signal?.aborted || isAbortError(e)) {
      const err = new Error('Operación cancelada');
      err.name = 'AbortError';
      throw err;
    }
    if (isMissingRolesTableError(e) || isRlsOrPermissionError(e)) {
      return getLocalRoles(params?.busqueda);
    }
    throw e;
  }
}

export async function crearRol(datos: Omit<Rol, 'id' | 'creado_en' | 'actualizado_en'>): Promise<Rol> {
  const sb = tryGetSupabase();
  const nuevoLocal: Rol = {
    id: generateFallbackUuid(),
    codigo: datos.codigo.trim().toLowerCase(),
    nombre: datos.nombre.trim(),
    descripcion: datos.descripcion?.trim() || null,
    permisos: datos.permisos || {},
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  };

  if (!sb) {
    const roles = getLocalRoles();
    saveLocalRoles([...roles.filter((r) => r.codigo !== nuevoLocal.codigo), nuevoLocal]);
    return nuevoLocal;
  }

  try {
    const { data, error } = await sb
      .from('roles')
      .insert({
        codigo: datos.codigo.trim().toLowerCase(),
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        permisos: datos.permisos || {},
      })
      .select(ROL_COLUMNS)
      .single();

    if (error) {
      if (isMissingRolesTableError(error) || isRlsOrPermissionError(error)) {
        const roles = getLocalRoles();
        saveLocalRoles([...roles.filter((r) => r.codigo !== nuevoLocal.codigo), nuevoLocal]);
        return nuevoLocal;
      }
      throw errorSupabase(error);
    }

    const created = data as Rol;
    const roles = getLocalRoles();
    saveLocalRoles([...roles.filter((r) => r.codigo !== created.codigo), created]);
    return created;
  } catch (e) {
    if (isMissingRolesTableError(e) || isRlsOrPermissionError(e)) {
      const roles = getLocalRoles();
      saveLocalRoles([...roles.filter((r) => r.codigo !== nuevoLocal.codigo), nuevoLocal]);
      return nuevoLocal;
    }
    throw e;
  }
}

export async function actualizarRol(
  id: string,
  datos: Partial<Omit<Rol, 'id' | 'creado_en' | 'actualizado_en'>>
): Promise<Rol> {
  const sb = tryGetSupabase();
  const updateLocal = (): Rol => {
    const roles = getLocalRoles();
    const idx = roles.findIndex((r) => r.id === id || (datos.codigo && r.codigo === datos.codigo.trim().toLowerCase()));
    if (idx === -1) {
      const fallback: Rol = {
        id: isUuid(id) ? id : generateFallbackUuid(),
        codigo: (datos.codigo || 'rol_custom').trim().toLowerCase(),
        nombre: (datos.nombre || 'Rol').trim(),
        descripcion: datos.descripcion?.trim() || null,
        permisos: datos.permisos || {},
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      };
      saveLocalRoles([...roles, fallback]);
      return fallback;
    }
    const act: Rol = {
      ...roles[idx],
      ...(datos.nombre !== undefined && { nombre: datos.nombre.trim() }),
      ...(datos.codigo !== undefined && { codigo: datos.codigo.trim().toLowerCase() }),
      ...(datos.descripcion !== undefined && { descripcion: datos.descripcion?.trim() || null }),
      ...(datos.permisos !== undefined && { permisos: datos.permisos }),
      actualizado_en: new Date().toISOString(),
    };
    roles[idx] = act;
    saveLocalRoles(roles);
    return act;
  };

  if (!sb) return updateLocal();

  try {
    const patch: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    };
    if (datos.codigo !== undefined) patch.codigo = datos.codigo.trim().toLowerCase();
    if (datos.nombre !== undefined) patch.nombre = datos.nombre.trim();
    if (datos.descripcion !== undefined) patch.descripcion = datos.descripcion?.trim() || null;
    if (datos.permisos !== undefined) patch.permisos = datos.permisos;

    let query = sb.from('roles').update(patch);
    if (isUuid(id)) {
      query = query.eq('id', id);
    } else {
      const localRole = getLocalRoles().find((r) => r.id === id);
      const codigoToMatch = datos.codigo?.trim().toLowerCase() || localRole?.codigo?.toLowerCase();
      if (codigoToMatch) {
        query = query.eq('codigo', codigoToMatch);
      } else {
        return updateLocal();
      }
    }

    const { data, error } = await query.select(ROL_COLUMNS).single();

    if (error) {
      if (isMissingRolesTableError(error) || isRlsOrPermissionError(error)) {
        return updateLocal();
      }
      throw errorSupabase(error);
    }
    const res = data as Rol;
    const roles = getLocalRoles();
    const idx = roles.findIndex((r) => r.id === id || r.codigo === res.codigo);
    if (idx !== -1) roles[idx] = res;
    else roles.push(res);
    saveLocalRoles(roles);
    return res;
  } catch (e) {
    if (isMissingRolesTableError(e) || isRlsOrPermissionError(e)) {
      return updateLocal();
    }
    throw e;
  }
}

export async function eliminarRol(id: string): Promise<void> {
  const sb = tryGetSupabase();
  const deleteLocal = () => {
    const roles = getLocalRoles().filter((r) => r.id !== id);
    saveLocalRoles(roles);
  };

  deleteLocal();
  if (!sb) return;

  try {
    let query = sb.from('roles').delete();
    if (isUuid(id)) {
      query = query.eq('id', id);
    } else {
      const localRole = getLocalRoles().find((r) => r.id === id);
      if (localRole?.codigo) {
        query = query.eq('codigo', localRole.codigo.toLowerCase());
      } else {
        return;
      }
    }

    const { error } = await query;
    if (error && !isMissingRolesTableError(error) && !isRlsOrPermissionError(error)) {
      throw errorSupabase(error);
    }
  } catch (e) {
    if (!isMissingRolesTableError(e) && !isRlsOrPermissionError(e)) {
      throw e;
    }
  }
}

function findPermsInMatrix(matrix: PermissionsMatrix, rol: { codigo: string; nombre: string }): RolePermissionMap | undefined {
  if (matrix[rol.nombre]) return matrix[rol.nombre];
  if (matrix[rol.codigo]) return matrix[rol.codigo];
  const ui = ROL_DB_A_UI[rol.codigo];
  if (ui && matrix[ui]) return matrix[ui];

  const normNombre = rol.nombre.trim().toLowerCase();
  const normCodigo = rol.codigo.trim().toLowerCase();
  for (const [k, v] of Object.entries(matrix)) {
    const normK = k.trim().toLowerCase();
    if (normK === normNombre || normK === normCodigo) return v;
  }
  return undefined;
}

/** Si faltan roles estándar en Supabase, los inserta sin duplicar. */
export async function sincronizarRolesPorDefecto(): Promise<void> {
  const sb = tryGetSupabase();
  if (!sb) return;

  try {
    const { data, error } = await sb.from('roles').select('id, codigo');
    if (error) {
      if (isMissingRolesTableError(error) || isRlsOrPermissionError(error)) return;
      throw errorSupabase(error);
    }
    const existing = new Set(((data ?? []) as Array<{ id: string; codigo: string }>).map((r) => r.codigo?.toLowerCase()));

    const matrix = buildDefaultMatrix();
    const missing = ROLE_CODES.filter((codigo) => !existing.has(codigo.toLowerCase())).map((codigo) => {
      const ui = ROL_DB_A_UI[codigo];
      return {
        codigo,
        nombre: ui,
        descripcion:
          codigo === 'admin'
            ? 'Acceso total al sistema y configuración'
            : codigo === 'cajero'
              ? 'Acceso exclusivo al Punto de Venta (POS) y Cierre de Caja'
              : codigo === 'vendedor'
                ? 'Ventas, clientes y cuentas por cobrar'
                : codigo === 'almacen'
                  ? 'Inventario, compras y transferencias'
                  : 'Finanzas, informes y auditoría',
        permisos: matrix[ui] ?? {},
      };
    });

    if (missing.length > 0) {
      const { error: insErr } = await sb.from('roles').insert(missing);
      if (insErr && !isMissingRolesTableError(insErr) && !isRlsOrPermissionError(insErr)) {
        // Ignorar errores de inserción no críticos
      }
    }
  } catch (e) {
    if (isMissingRolesTableError(e) || isRlsOrPermissionError(e)) return;
    throw e;
  }
}

/** Matriz desde filas reales de Supabase o fallback local. */
export async function obtenerMatrizPermisos(): Promise<PermissionsMatrix> {
  try {
    await sincronizarRolesPorDefecto();
    const roles = await obtenerRoles();
    const matrix = buildDefaultMatrix();

    for (const rol of roles) {
      if (
        rol.codigo === 'superadmin' ||
        rol.codigo === 'super_admin' ||
        rol.nombre === 'Super Administrador'
      ) {
        continue;
      }
      const uiName = ROL_DB_A_UI[rol.codigo] || rol.nombre;
      const basePerms = matrix[uiName] || matrix[rol.codigo] || {};
      const merged = mergeRolePermisos(basePerms, rol.permisos as RolePermissionMap);
      
      matrix[uiName] = merged;
      matrix[rol.codigo] = merged;
      if (rol.nombre) {
        matrix[rol.nombre] = merged;
      }
    }
    return matrix;
  } catch (e) {
    if (isMissingRolesTableError(e) || isRlsOrPermissionError(e)) {
      return buildDefaultMatrix();
    }
    throw e;
  }
}

/** Persiste cada rol de la matriz en Supabase o fallback local. */
export async function guardarMatrizPermisos(matrix: PermissionsMatrix): Promise<void> {
  const sb = tryGetSupabase();
  const existentes = await obtenerRoles();

  // Guardar siempre respaldo local completo
  const localRoles = getLocalRoles();
  for (let i = 0; i < localRoles.length; i++) {
    const r = localRoles[i];
    if (r.codigo === 'superadmin' || r.codigo === 'super_admin') continue;
    const permisos = findPermsInMatrix(matrix, r) ?? r.permisos ?? {};
    localRoles[i] = { ...r, permisos, actualizado_en: new Date().toISOString() };
  }
  saveLocalRoles(localRoles);

  if (!sb) return;

  try {
    for (const rol of existentes) {
      if (rol.codigo === 'superadmin' || rol.codigo === 'super_admin') continue;
      const permisos = findPermsInMatrix(matrix, rol) ?? rol.permisos ?? {};

      const payload: Record<string, unknown> = {
        codigo: rol.codigo.toLowerCase().trim(),
        nombre: rol.nombre,
        descripcion: rol.descripcion ?? null,
        permisos,
        actualizado_en: new Date().toISOString(),
      };

      // SOLO incluir id si es un UUID válido. Jamás enviar IDs locales sintéticos como "local-role-1" a columnas UUID
      if (isUuid(rol.id)) {
        payload.id = rol.id;
      }

      const { error } = await sb
        .from('roles')
        .upsert(payload, { onConflict: 'codigo' });

      if (error && !isMissingRolesTableError(error) && !isRlsOrPermissionError(error)) {
        throw errorSupabase(error);
      }
    }

    // Actualizar localStorage con las filas y UUIDs reales generados en Supabase
    try {
      const { data: remoteRoles } = await sb.from('roles').select(ROL_COLUMNS);
      if (remoteRoles && remoteRoles.length > 0) {
        saveLocalRoles(remoteRoles as Rol[]);
      }
    } catch {
      // Ignorar si falla lectura
    }
  } catch (e) {
    if (!isMissingRolesTableError(e) && !isRlsOrPermissionError(e)) {
      throw e;
    }
  }
}

