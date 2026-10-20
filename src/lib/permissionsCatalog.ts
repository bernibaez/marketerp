import type { UserRole } from '@/types/roles';

export type PermissionAction = 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar' | 'aprobar';

export type PermissionModule = {
  id: string;
  label: string;
  group: string;
  href?: string;
  description: string;
  actions: PermissionAction[];
};

export const PERMISSION_ACTIONS: { id: PermissionAction; label: string; short: string }[] = [
  { id: 'ver', label: 'Ver', short: 'Ver' },
  { id: 'crear', label: 'Crear', short: 'Crear' },
  { id: 'editar', label: 'Editar', short: 'Edit' },
  { id: 'eliminar', label: 'Eliminar', short: 'Elim' },
  { id: 'exportar', label: 'Exportar', short: 'Exp' },
  { id: 'aprobar', label: 'Aprobar', short: 'Apr' },
];

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    group: 'Principal',
    href: '/',
    description: 'KPIs y resumen operativo',
    actions: ['ver', 'exportar'],
  },
  {
    id: 'pos',
    label: 'Punto de Venta',
    group: 'Principal',
    href: '/point-of-sale-pos',
    description: 'Cobro, carrito y terminal POS',
    actions: ['ver', 'crear', 'editar'],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    group: 'Operaciones',
    href: '/sales',
    description: 'Historial, cotizaciones y facturas',
    actions: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    id: 'compras',
    label: 'Compras',
    group: 'Operaciones',
    href: '/purchases',
    description: 'Órdenes de compra y recepción',
    actions: ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'exportar'],
  },
  {
    id: 'devoluciones',
    label: 'Devoluciones',
    group: 'Operaciones',
    href: '/returns-history',
    description: 'Devoluciones de venta',
    actions: ['ver', 'crear', 'aprobar', 'exportar'],
  },
  {
    id: 'productos',
    label: 'Productos',
    group: 'Inventario',
    href: '/product-management',
    description: 'Catálogo y precios',
    actions: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  },
  {
    id: 'combos',
    label: 'Combos',
    group: 'Inventario',
    href: '/combos',
    description: 'Ofertas combinadas',
    actions: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    id: 'transferencias',
    label: 'Transferencias',
    group: 'Inventario',
    href: '/stock-transfers',
    description: 'Traslados entre sucursales',
    actions: ['ver', 'crear', 'aprobar'],
  },
  {
    id: 'ajustes_stock',
    label: 'Ajustes de Stock',
    group: 'Inventario',
    href: '/stock-adjustments',
    description: 'Entradas, salidas y pérdidas',
    actions: ['ver', 'crear', 'aprobar', 'exportar'],
  },
  {
    id: 'cajas',
    label: 'Cajas Registradoras',
    group: 'Finanzas',
    href: '/cajas',
    description: 'Registro y administración de cajas del POS',
    actions: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    id: 'contactos',
    label: 'Contactos',
    group: 'CRM',
    href: '/contacts',
    description: 'Clientes, proveedores y grupos',
    actions: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    id: 'cierre_caja',
    label: 'Cierre de Caja',
    group: 'Finanzas',
    href: '/cash-closure',
    description: 'Apertura y cierre de turnos',
    actions: ['ver', 'crear', 'aprobar', 'exportar'],
  },
  {
    id: 'maleta',
    label: 'Maleta / Detalles',
    group: 'Finanzas',
    href: '/maleta',
    description: 'Cortes y merma de carne',
    actions: ['ver', 'crear', 'editar'],
  },
  {
    id: 'gastos',
    label: 'Gastos',
    group: 'Finanzas',
    href: '/expenses',
    description: 'Gastos operativos',
    actions: ['ver', 'crear', 'editar', 'aprobar', 'exportar'],
  },
  {
    id: 'cxc',
    label: 'Cuentas por Cobrar',
    group: 'Finanzas',
    href: '/accounts-receivable',
    description: 'Créditos a clientes',
    actions: ['ver', 'crear', 'editar', 'aprobar', 'exportar'],
  },
  {
    id: 'cxp',
    label: 'Cuentas por Pagar',
    group: 'Finanzas',
    href: '/accounts-payable',
    description: 'Deudas a proveedores',
    actions: ['ver', 'crear', 'editar', 'aprobar', 'exportar'],
  },
  {
    id: 'informes',
    label: 'Informes',
    group: 'Análisis',
    href: '/reports',
    description: 'Reportes gerenciales',
    actions: ['ver', 'exportar'],
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    group: 'Configuración',
    href: '/audit',
    description: 'Bitácora de acciones',
    actions: ['ver', 'exportar'],
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    group: 'Configuración',
    href: '/users',
    description: 'Cuentas y roles de acceso',
    actions: ['ver', 'crear', 'editar', 'eliminar'],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    group: 'Configuración',
    href: '/settings',
    description: 'Empresa, NCF, permisos y preferencias',
    actions: ['ver', 'editar'],
  },
];

export const PERMISSION_GROUPS = [
  'Principal',
  'Operaciones',
  'Inventario',
  'CRM',
  'Finanzas',
  'Análisis',
  'Configuración',
] as const;

export type RolePermissionMap = Record<string, Partial<Record<PermissionAction, boolean>>>;

export type PermissionsMatrix = Record<string, RolePermissionMap>;

const ALL_TRUE = (actions: PermissionAction[]): Partial<Record<PermissionAction, boolean>> =>
  Object.fromEntries(actions.map((a) => [a, true]));

export function getEmptyRolePermissions(): RolePermissionMap {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m.id, Object.fromEntries(m.actions.map((a) => [a, false]))])
  );
}

export function getFullRolePermissions(): RolePermissionMap {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m.id, Object.fromEntries(m.actions.map((a) => [a, true]))])
  );
}

/** Valores por defecto alineados con ROLE_ROUTES actuales */
export function buildDefaultMatrix(): PermissionsMatrix {
  const empty = (): RolePermissionMap => getEmptyRolePermissions();

  const admin = getFullRolePermissions();

  const cajero = empty();
  for (const id of ['pos', 'cierre_caja', 'ventas']) {
    const mod = PERMISSION_MODULES.find((m) => m.id === id);
    if (!mod) continue;
    cajero[id] = {
      ...Object.fromEntries(mod.actions.map((a) => [a, false])),
      ver: true,
      crear: id === 'pos' || id === 'cierre_caja',
      editar: id === 'pos',
      exportar: id === 'ventas',
      aprobar: id === 'cierre_caja',
    };
  }

  const vendedor = empty();
  for (const id of ['dashboard', 'ventas', 'pos', 'combos', 'contactos', 'cxc', 'cierre_caja', 'configuracion']) {
    const mod = PERMISSION_MODULES.find((m) => m.id === id);
    if (!mod) continue;
    vendedor[id] = {
      ...Object.fromEntries(mod.actions.map((a) => [a, false])),
      ver: true,
      crear: ['ventas', 'pos', 'contactos', 'cxc'].includes(id),
      editar: ['contactos', 'cxc'].includes(id),
      exportar: ['ventas', 'cxc'].includes(id),
    };
  }

  const almacen = empty();
  for (const id of [
    'dashboard',
    'productos',
    'combos',
    'transferencias',
    'ajustes_stock',
    'cajas',
    'compras',
    'configuracion',
  ]) {
    const mod = PERMISSION_MODULES.find((m) => m.id === id);
    if (!mod) continue;
    almacen[id] = {
      ...Object.fromEntries(mod.actions.map((a) => [a, false])),
      ver: true,
      crear: !['dashboard', 'configuracion', 'cajas'].includes(id),
      editar: !['dashboard', 'configuracion'].includes(id),
      eliminar: ['productos', 'combos'].includes(id),
      aprobar: ['transferencias', 'ajustes_stock', 'compras'].includes(id),
      exportar: ['productos', 'ajustes_stock', 'compras'].includes(id),
    };
  }

  const contador = empty();
  for (const id of [
    'dashboard',
    'informes',
    'gastos',
    'cxc',
    'cxp',
    'ventas',
    'compras',
    'cierre_caja',
    'auditoria',
    'configuracion',
  ]) {
    const mod = PERMISSION_MODULES.find((m) => m.id === id);
    if (!mod) continue;
    contador[id] = {
      ...Object.fromEntries(mod.actions.map((a) => [a, false])),
      ver: true,
      crear: ['gastos', 'cxc', 'cxp'].includes(id),
      editar: ['gastos', 'cxc', 'cxp'].includes(id),
      aprobar: ['gastos', 'cxc', 'cxp', 'cierre_caja'].includes(id),
      exportar: true,
    };
  }

  return {
    Administrador: admin,
    admin: admin,
    'Super Administrador': admin,
    superadmin: admin,
    Cajero: cajero,
    cajero: cajero,
    Vendedor: vendedor,
    vendedor: vendedor,
    Almacenista: almacen,
    almacen: almacen,
    Contador: contador,
    contable: contador,
  };
}

export function getDefaultRolePermissions(roleCodeOrName: string): RolePermissionMap {
  const norm = roleCodeOrName.trim().toLowerCase();
  const matrix = buildDefaultMatrix();
  if (norm.includes('admin') || norm === 'administrador') return matrix.Administrador;
  if (norm.includes('cajer')) return matrix.Cajero;
  if (norm.includes('vended')) return matrix.Vendedor;
  if (norm.includes('almacen')) return matrix.Almacenista;
  if (norm.includes('conta') || norm.includes('finan')) return matrix.Contador;
  return getEmptyRolePermissions();
}

export const ROLE_META: Record<
  string,
  { description: string; color: string; accent: string }
> = {
  Administrador: {
    description: 'Acceso total al sistema y configuración',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    accent: 'border-emerald-500/40',
  },
  admin: {
    description: 'Acceso total al sistema y configuración',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    accent: 'border-emerald-500/40',
  },
  'Super Administrador': {
    description: 'Acceso maestro total a todos los módulos',
    color: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300',
    accent: 'border-emerald-600/40',
  },
  superadmin: {
    description: 'Acceso maestro total a todos los módulos',
    color: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300',
    accent: 'border-emerald-600/40',
  },
  Cajero: {
    description: 'POS, consulta de sus ventas y cierre de caja (sin editar/anular facturas)',
    color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    accent: 'border-sky-500/40',
  },
  cajero: {
    description: 'POS, consulta de sus ventas y cierre de caja',
    color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    accent: 'border-sky-500/40',
  },
  Vendedor: {
    description: 'Ventas propias, clientes y CxC (editar/anular facturas solo con permiso admin)',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    accent: 'border-amber-500/40',
  },
  vendedor: {
    description: 'Ventas propias, clientes y CxC',
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    accent: 'border-amber-500/40',
  },
  Almacenista: {
    description: 'Inventario, compras y transferencias',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    accent: 'border-violet-500/40',
  },
  almacen: {
    description: 'Inventario, compras y transferencias',
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    accent: 'border-violet-500/40',
  },
  Contador: {
    description: 'Finanzas, informes y auditoría',
    color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    accent: 'border-rose-500/40',
  },
  contable: {
    description: 'Finanzas, informes y auditoría',
    color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
    accent: 'border-rose-500/40',
  },
};

const DYNAMIC_PALETTES = [
  { color: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400', accent: 'border-indigo-500/40' },
  { color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', accent: 'border-teal-500/40' },
  { color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', accent: 'border-purple-500/40' },
  { color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400', accent: 'border-cyan-500/40' },
  { color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400', accent: 'border-orange-500/40' },
  { color: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400', accent: 'border-fuchsia-500/40' },
];

export function getRoleMeta(roleNameOrCode: string, description?: string | null): { description: string; color: string; accent: string } {
  if (ROLE_META[roleNameOrCode]) {
    return {
      ...ROLE_META[roleNameOrCode],
      description: description || ROLE_META[roleNameOrCode].description,
    };
  }
  // Deterministic palette based on string hash
  let hash = 0;
  for (let i = 0; i < roleNameOrCode.length; i++) {
    hash = (hash << 5) - hash + roleNameOrCode.charCodeAt(i);
    hash |= 0;
  }
  const palette = DYNAMIC_PALETTES[Math.abs(hash) % DYNAMIC_PALETTES.length];
  return {
    description: description || 'Rol personalizado con accesos a la medida',
    ...palette,
  };
}
