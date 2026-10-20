import type { UserRole } from '@/types/roles';
import {
  buildDefaultMatrix,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionsMatrix,
  type RolePermissionMap,
} from './permissionsCatalog';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import {
  emptyPermissionsMatrix,
  guardarMatrizPermisos,
  obtenerMatrizPermisos,
} from '@/services/roles.service';

/** Caché en memoria para lecturas síncronas (menú / rutas). */
let cachedMatrix: PermissionsMatrix | null = null;
let loadPromise: Promise<PermissionsMatrix> | null = null;
let lastError: string | null = null;

export function getPermissionsLoadError(): string | null {
  return lastError;
}

/** Lectura síncrona: solo caché en memoria (sin localStorage simulado). */
export function getPermissionsMatrix(): PermissionsMatrix {
  if (cachedMatrix) return cachedMatrix;
  // Sin caché aún: matriz vacía (admin total). Se hidrata con loadPermissionsMatrix.
  return emptyPermissionsMatrix();
}

/** Carga matriz desde Supabase. Obligatoria con env configurado. */
export async function loadPermissionsMatrix(force = false): Promise<PermissionsMatrix> {
  if (!force && cachedMatrix) return cachedMatrix;
  if (!force && loadPromise) return loadPromise;

  loadPromise = (async () => {
    lastError = null;
    if (!isSupabaseConfigured()) {
      lastError = 'Supabase no configurado';
      cachedMatrix = emptyPermissionsMatrix();
      return cachedMatrix;
    }
    try {
      const remote = await obtenerMatrizPermisos();
      cachedMatrix = remote;
      return remote;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Error al cargar permisos';
      cachedMatrix = buildDefaultMatrix();
      return cachedMatrix;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function savePermissionsMatrix(matrix: PermissionsMatrix): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado');
  }
  await guardarMatrizPermisos(matrix);
  cachedMatrix = matrix;
  lastError = null;
}

export async function resetPermissionsMatrix(): Promise<PermissionsMatrix> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado');
  }
  const defaults = buildDefaultMatrix();
  await guardarMatrizPermisos(defaults);
  cachedMatrix = defaults;
  return defaults;
}

export function countEnabled(map: RolePermissionMap): number {
  let n = 0;
  for (const mod of Object.values(map)) {
    for (const v of Object.values(mod)) {
      if (v) n += 1;
    }
  }
  return n;
}

export function countModuleEnabled(map: RolePermissionMap, moduleId: string): number {
  const mod = map[moduleId] ?? {};
  return Object.values(mod).filter(Boolean).length;
}

function findRolePermissions(matrix: PermissionsMatrix, role: UserRole): RolePermissionMap | undefined {
  if (matrix[role]) return matrix[role];
  const norm = String(role).trim().toLowerCase();
  if (matrix[norm]) return matrix[norm];
  const foundKey = Object.keys(matrix).find((k) => k.trim().toLowerCase() === norm);
  if (foundKey) return matrix[foundKey];
  return undefined;
}

export function hasPermission(
  role: UserRole,
  moduleId: string,
  action: PermissionAction = 'ver'
): boolean {
  const norm = String(role).trim().toLowerCase();
  // Super Administrador tiene acceso maestro irrestricto por seguridad
  if (norm === 'superadmin' || norm === 'super_admin' || norm === 'super administrador') {
    return true;
  }
  const matrix = getPermissionsMatrix();
  const perms = findRolePermissions(matrix, role);
  // Fallback seguro: si es admin y aún no tiene permisos guardados, acceso total
  if (!perms && (norm === 'admin' || norm === 'administrador')) {
    return true;
  }
  return !!perms?.[moduleId]?.[action];
}

export function routesFromPermissions(role: UserRole): string[] | '*' {
  const norm = String(role).trim().toLowerCase();
  // Super Administrador tiene acceso maestro irrestricto por seguridad
  if (norm === 'superadmin' || norm === 'super_admin' || norm === 'super administrador') {
    return '*';
  }
  const matrix = getPermissionsMatrix();
  const rolePerms = findRolePermissions(matrix, role);
  // Fallback seguro: si es admin y aún no tiene permisos guardados, acceso total
  if (!rolePerms && (norm === 'admin' || norm === 'administrador')) {
    return '*';
  }
  if (!rolePerms) return [];
  const routes: string[] = [];
  for (const mod of PERMISSION_MODULES) {
    if (mod.href && rolePerms[mod.id]?.ver) {
      routes.push(mod.href);
    }
  }
  if (!routes.includes('/settings') && rolePerms.configuracion?.ver) {
    routes.push('/settings');
  }
  return routes;
}

export function clearPermissionsCache(): void {
  cachedMatrix = null;
  loadPromise = null;
  lastError = null;
}
