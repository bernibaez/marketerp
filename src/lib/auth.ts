import type { UserRole } from '@/types/roles';

export type { UserRole } from '@/types/roles';

import { routesFromPermissions } from '@/lib/permissionsStore';

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  phone: string;
  initials: string;
  sucursalId?: string | null;
  rolDb?: string;
};

type AuthAccount = AuthUser & { password: string };

/** Cuentas de demo — fallback cuando Supabase no está configurado */
export const AUTH_ACCOUNTS: AuthAccount[] = [
  {
    id: '1',
    username: 'admin',
    name: 'Admin General',
    email: 'admin@mercato.do',
    password: 'admin123',
    role: 'Administrador',
    status: 'active',
    phone: '809-555-0001',
    initials: 'AG',
  },
  {
    id: '2',
    username: 'maria',
    name: 'María García',
    email: 'maria@mercato.do',
    password: 'maria123',
    role: 'Cajero',
    status: 'active',
    phone: '809-555-0002',
    initials: 'MG',
  },
  {
    id: '3',
    username: 'carlos',
    name: 'Carlos López',
    email: 'carlos@mercato.do',
    password: 'carlos123',
    role: 'Vendedor',
    status: 'active',
    phone: '809-555-0003',
    initials: 'CL',
  },
  {
    id: '4',
    username: 'ana',
    name: 'Ana Martínez',
    email: 'ana@mercato.do',
    password: 'ana123',
    role: 'Almacenista',
    status: 'inactive',
    phone: '809-555-0004',
    initials: 'AM',
  },
  {
    id: '5',
    username: 'pedro',
    name: 'Pedro Sánchez',
    email: 'pedro@mercato.do',
    password: 'pedro123',
    role: 'Contador',
    status: 'active',
    phone: '809-555-0005',
    initials: 'PS',
  },
];

/** Código de acceso rápido (botón "Acceder con código") — solo modo local */
export const ACCESS_CODES: Record<string, string> = {
  '1001': 'admin',
  '2002': 'maria',
  '3003': 'carlos',
  '4004': 'pedro',
};

const ALL_ROUTES = '*';

/** Rutas permitidas por rol (`*` = todas) */
export const ROLE_ROUTES: Record<UserRole, string[] | typeof ALL_ROUTES> = {
  Administrador: ALL_ROUTES,
  Cajero: ['/point-of-sale-pos', '/cash-closure', '/sales'],
  Vendedor: ['/', '/sales', '/point-of-sale-pos', '/combos', '/contacts', '/accounts-receivable', '/cash-closure', '/settings'],
  Almacenista: [
    '/',
    '/product-management',
    '/combos',
    '/stock-transfers',
    '/stock-adjustments',
    '/cajas',
    '/purchases',
    '/settings',
  ],
  Contador: [
    '/',
    '/reports',
    '/expenses',
    '/accounts-receivable',
    '/accounts-payable',
    '/sales',
    '/purchases',
    '/cash-closure',
    '/settings',
  ],
};

export const ROLE_HOME: Record<string, string> = {
  Administrador: '/',
  admin: '/',
  'Super Administrador': '/',
  superadmin: '/',
  Cajero: '/point-of-sale-pos',
  cajero: '/point-of-sale-pos',
  Vendedor: '/sales',
  vendedor: '/sales',
  Almacenista: '/product-management',
  almacen: '/product-management',
  Contador: '/reports',
  contable: '/reports',
};

export function getRoleHome(role: UserRole): string {
  if (ROLE_HOME[role]) return ROLE_HOME[role];
  const norm = String(role).toLowerCase();
  if (ROLE_HOME[norm]) return ROLE_HOME[norm];
  const routes = routesFromPermissions(role);
  if (routes === '*' || (Array.isArray(routes) && routes.includes('/'))) return '/';
  if (Array.isArray(routes) && routes.length > 0) return routes[0];
  return '/';
}

const STORAGE_KEY = 'mercato_auth_user';


function toPublicUser(account: AuthAccount): AuthUser {
  const { password: _, ...user } = account;
  return user;
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    // Migrar ids numéricos antiguos
    return { ...parsed, id: String(parsed.id) };
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function authenticate(
  username: string,
  password: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const account = AUTH_ACCOUNTS.find(
    (a) =>
      a.username.toLowerCase() === username.trim().toLowerCase() ||
      a.email.toLowerCase() === username.trim().toLowerCase()
  );
  if (!account) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  if (account.password !== password) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  if (account.status !== 'active') return { ok: false, error: 'Esta cuenta está desactivada' };
  return { ok: true, user: toPublicUser(account) };
}

export function authenticateByCode(
  code: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const username = ACCESS_CODES[code.trim()];
  if (!username) return { ok: false, error: 'Código de acceso inválido' };
  const account = AUTH_ACCOUNTS.find((a) => a.username === username);
  if (!account || account.status !== 'active') {
    return { ok: false, error: 'Código no disponible' };
  }
  return { ok: true, user: toPublicUser(account) };
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const norm = String(role).trim().toLowerCase();
  if (norm === 'superadmin' || norm === 'super_admin' || norm === 'super administrador') {
    return true;
  }
  const fromMatrix = routesFromPermissions(role);
  if (fromMatrix === '*') return true;
  const cleanPath = pathname.split('?')[0];
  if (cleanPath === '/') return fromMatrix.includes('/');
  return fromMatrix.some((route) => route !== '/' && cleanPath.startsWith(route));
}

export function canAccessNav(role: UserRole, href: string): boolean {
  return canAccessRoute(role, href);
}

export function isAdminOrSuperAdmin(
  userOrRole?: { role?: string; rolDb?: string } | string | null
): boolean {
  if (!userOrRole) return false;
  const roleStr =
    typeof userOrRole === 'string'
      ? userOrRole
      : (userOrRole.role || userOrRole.rolDb || '');
  const norm = roleStr.trim().toLowerCase();
  return (
    norm === 'administrador' ||
    norm === 'admin' ||
    norm === 'super administrador' ||
    norm === 'superadministrador' ||
    norm === 'superadmin' ||
    norm === 'super_admin'
  );
}

export function verifySupervisorAdmin(credentials: {
  code?: string;
  username?: string;
  password?: string;
}): { ok: true; user: AuthUser } | { ok: false; error: string } {
  // 1. Validar por código de acceso rápido (PIN)
  if (credentials.code && credentials.code.trim()) {
    const codeResult = authenticateByCode(credentials.code.trim());
    if (codeResult.ok) {
      if (isAdminOrSuperAdmin(codeResult.user)) {
        return { ok: true, user: codeResult.user };
      }
      return {
        ok: false,
        error: `El usuario "${codeResult.user.name}" (${codeResult.user.role}) no tiene permisos de Administrador o Super Administrador.`,
      };
    }
  }

  // 2. Validar por usuario y contraseña
  if (credentials.username && credentials.password) {
    const authResult = authenticate(credentials.username.trim(), credentials.password);
    if (authResult.ok) {
      if (isAdminOrSuperAdmin(authResult.user)) {
        return { ok: true, user: authResult.user };
      }
      return {
        ok: false,
        error: `El usuario "${authResult.user.name}" (${authResult.user.role}) no tiene permisos de Administrador o Super Administrador.`,
      };
    }
    return { ok: false, error: authResult.error };
  }

  return { ok: false, error: 'Código o credenciales de administrador incorrectos' };
}
