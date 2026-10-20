import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Shield,
  Search,
  RotateCcw,
  Save,
  Check,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Copy,
  CheckCheck,
  XCircle,
  ArrowLeft,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import type { UserRole } from '@/types/roles';
import type { Rol } from '@/types/database';
import {
  PERMISSION_ACTIONS,
  PERMISSION_GROUPS,
  PERMISSION_MODULES,
  getRoleMeta,
  getEmptyRolePermissions,
  getFullRolePermissions,
  getDefaultRolePermissions,
  type PermissionAction,
  type PermissionsMatrix,
  type RolePermissionMap,
} from '@/lib/permissionsCatalog';
import {
  countEnabled,
  countModuleEnabled,
  getPermissionsLoadError,
  getPermissionsMatrix,
  loadPermissionsMatrix,
  resetPermissionsMatrix,
  savePermissionsMatrix,
} from '@/lib/permissionsStore';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import {
  isMissingRolesTableError,
  obtenerRoles,
  crearRol,
  actualizarRol,
  eliminarRol,
} from '@/services/roles.service';
import ModalShell from '@/components/ui/ModalShell';

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        disabled:opacity-40 disabled:cursor-not-allowed
        ${checked ? 'bg-primary' : 'bg-muted'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

export default function PermissionsSettingsTab() {
  const [searchParams] = useSearchParams();
  const [matrix, setMatrix] = useState<PermissionsMatrix>(() => getPermissionsMatrix());
  const [rolesList, setRolesList] = useState<Rol[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('Cajero');
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateSourceRole, setTemplateSourceRole] = useState<string>('');

  // Modales para gestionar roles directamente desde la pantalla de permisos
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createCodigo, setCreateCodigo] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTemplate, setCreateTemplate] = useState('cajero');
  const [creatingRole, setCreatingRole] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editingRoleState, setEditingRoleState] = useState(false);

  const targetRoleParam = searchParams.get('role');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([loadPermissionsMatrix(true), obtenerRoles()])
      .then(([m, roles]) => {
        if (!alive) return;
        setRolesList(roles);

        // Aseguramos que cada rol tenga entrada inicial en la matriz
        const nextMatrix: PermissionsMatrix = { ...m };
        for (const r of roles) {
          if (!nextMatrix[r.nombre] && !nextMatrix[r.codigo]) {
            nextMatrix[r.nombre] = r.permisos && Object.keys(r.permisos).length > 0
              ? (r.permisos as RolePermissionMap)
              : getEmptyRolePermissions();
          }
        }
        setMatrix(nextMatrix);

        // Si se especificó rol en URL, buscarlo por código o nombre
        if (targetRoleParam) {
          const found = roles.find(
            (r) =>
              r.codigo.toLowerCase() === targetRoleParam.toLowerCase() ||
              r.nombre.toLowerCase() === targetRoleParam.toLowerCase()
          );
          if (found) {
            setSelectedRole(found.nombre);
            return;
          }
        }

        // Si el rol seleccionado actual no existe en la lista, seleccionar el primero no-admin
        const hasCurrent = roles.some((r) => r.nombre === selectedRole || r.codigo === selectedRole);
        if (!hasCurrent && roles.length > 0) {
          const firstNonAdmin = roles.find((r) => r.codigo !== 'admin' && r.codigo !== 'superadmin') || roles[0];
          setSelectedRole(firstNonAdmin.nombre);
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'No se pudieron cargar permisos';
        if (alive) setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [targetRoleParam]);

  // Identificar rol activo en BD
  const currentRoleObj = useMemo(() => {
    return (
      rolesList.find(
        (r) =>
          r.nombre.toLowerCase() === selectedRole.toLowerCase() ||
          r.codigo.toLowerCase() === selectedRole.toLowerCase()
      ) || null
    );
  }, [rolesList, selectedRole]);

  const isSuperAdmin =
    selectedRole.toLowerCase() === 'superadmin' ||
    selectedRole.toLowerCase() === 'super_admin' ||
    selectedRole === 'Super Administrador' ||
    currentRoleObj?.codigo === 'superadmin' ||
    currentRoleObj?.codigo === 'super_admin';

  const handleCreateRole = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nombre = createNombre.trim();
    if (!nombre) {
      toast.error('Por favor escribe el nombre del rol');
      return;
    }

    const codigo = (createCodigo.trim() || nombre)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!codigo) {
      toast.error('El código del rol no es válido');
      return;
    }

    const exists = rolesList.some(
      (r) => r.codigo.toLowerCase() === codigo || r.nombre.toLowerCase() === nombre.toLowerCase()
    );
    if (exists) {
      toast.error(`Ya existe un rol con el nombre "${nombre}" o código "${codigo}"`);
      return;
    }

    setCreatingRole(true);
    try {
      let initialPerms: RolePermissionMap = {};
      if (createTemplate === 'full' || createTemplate === 'admin') {
        initialPerms = getFullRolePermissions();
      } else if (createTemplate === 'empty') {
        initialPerms = getEmptyRolePermissions();
      } else {
        const sourceMap = matrix[createTemplate] || matrix[createTemplate.toLowerCase()];
        initialPerms = sourceMap ? JSON.parse(JSON.stringify(sourceMap)) : getDefaultRolePermissions(createTemplate);
      }

      const nuevo = await crearRol({
        codigo,
        nombre,
        descripcion: createDesc.trim() || null,
        permisos: initialPerms,
      });

      setRolesList((prev) => [...prev.filter((r) => r.codigo !== nuevo.codigo), nuevo]);
      setMatrix((prev) => ({
        ...prev,
        [nuevo.nombre]: initialPerms,
        [nuevo.codigo]: initialPerms,
      }));
      setSelectedRole(nuevo.nombre);
      setDirty(true);
      setShowCreateModal(false);
      setCreateNombre('');
      setCreateCodigo('');
      setCreateDesc('');
      setCreateTemplate('cajero');
      toast.success(`¡Rol "${nuevo.nombre}" creado exitosamente! Configura sus permisos y guarda.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear rol');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async (rol: Rol) => {
    if (['admin', 'cajero', 'vendedor', 'almacen', 'contable', 'superadmin'].includes(rol.codigo.toLowerCase())) {
      toast.error('No se pueden eliminar los roles integrados del sistema');
      return;
    }
    if (!confirm(`¿Eliminar el rol personalizado "${rol.nombre}"? Los usuarios con este rol perderán sus accesos.`)) {
      return;
    }
    try {
      await eliminarRol(rol.id);
      setRolesList((prev) => prev.filter((r) => r.id !== rol.id && r.codigo !== rol.codigo));
      setSelectedRole('Cajero');
      toast.success(`Rol "${rol.nombre}" eliminado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el rol');
    }
  };

  const handleEditRole = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentRoleObj) return;
    const nombre = editNombre.trim();
    if (!nombre) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setEditingRoleState(true);
    try {
      const act = await actualizarRol(currentRoleObj.id, {
        nombre,
        descripcion: editDesc.trim() || null,
      });
      setRolesList((prev) => prev.map((r) => (r.id === act.id ? act : r)));
      if (currentRoleObj.nombre !== act.nombre) {
        setMatrix((prev) => {
          const m = { ...prev };
          if (m[currentRoleObj.nombre]) {
            m[act.nombre] = m[currentRoleObj.nombre];
          }
          return m;
        });
        setSelectedRole(act.nombre);
      }
      setShowEditModal(false);
      toast.success('Información del rol actualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setEditingRoleState(false);
    }
  };

  // Mapa seguro de permisos para el rol actual
  const roleMap: RolePermissionMap = useMemo(() => {
    if (matrix[selectedRole]) return matrix[selectedRole];
    if (currentRoleObj) {
      if (matrix[currentRoleObj.nombre]) return matrix[currentRoleObj.nombre];
      if (matrix[currentRoleObj.codigo]) return matrix[currentRoleObj.codigo];
    }
    return getEmptyRolePermissions();
  }, [matrix, selectedRole, currentRoleObj]);

  const roleMeta = useMemo(() => {
    return getRoleMeta(selectedRole, currentRoleObj?.descripcion);
  }, [selectedRole, currentRoleObj]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PERMISSION_MODULES;
    return PERMISSION_MODULES.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
    );
  }, [search]);

  const enabledCount = countEnabled(roleMap);
  const totalPossible = PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0);
  const modulesWithAccess = PERMISSION_MODULES.filter((m) => roleMap[m.id]?.ver).length;
  const coverage = Math.round((enabledCount / totalPossible) * 100);

  const setAction = useCallback(
    (moduleId: string, action: PermissionAction, value: boolean) => {
      if (isSuperAdmin) return;
      setMatrix((prev) => {
        const currentMap = prev[selectedRole] || roleMap;
        const currentMod = currentMap[moduleId] || {};
        return {
          ...prev,
          [selectedRole]: {
            ...currentMap,
            [moduleId]: {
              ...currentMod,
              [action]: value,
            },
          },
        };
      });
      setDirty(true);
    },
    [isSuperAdmin, selectedRole, roleMap]
  );

  const toggleModuleAccess = (moduleId: string, actions: PermissionAction[], enable: boolean) => {
    if (isSuperAdmin) return;
    setMatrix((prev) => {
      const currentMap = prev[selectedRole] || roleMap;
      return {
        ...prev,
        [selectedRole]: {
          ...currentMap,
          [moduleId]: Object.fromEntries(actions.map((a) => [a, enable])),
        },
      };
    });
    setDirty(true);
  };

  // Clonar permisos de otro rol hacia el rol actual
  const handleCloneFromRole = (sourceRoleNameOrCode: string) => {
    if (!sourceRoleNameOrCode || isSuperAdmin) return;
    const sourceMap = matrix[sourceRoleNameOrCode] || matrix[sourceRoleNameOrCode.toLowerCase()];
    if (!sourceMap) {
      toast.error('No se encontraron permisos para el rol seleccionado');
      return;
    }
    // Clonación profunda
    const cloned: RolePermissionMap = JSON.parse(JSON.stringify(sourceMap));
    setMatrix((prev) => ({
      ...prev,
      [selectedRole]: cloned,
    }));
    setDirty(true);
    setTemplateSourceRole('');
    toast.success(`Permisos de «${sourceRoleNameOrCode}» copiados a «${selectedRole}».`);
  };

  // Otorgar acceso total a todos los módulos
  const handleGrantAll = () => {
    if (isSuperAdmin) return;
    setMatrix((prev) => ({
      ...prev,
      [selectedRole]: getFullRolePermissions(),
    }));
    setDirty(true);
    toast.info(`Acceso completo asignado a «${selectedRole}». Guarda los cambios.`);
  };

  // Quitar todos los accesos
  const handleRevokeAll = () => {
    if (isSuperAdmin) return;
    setMatrix((prev) => ({
      ...prev,
      [selectedRole]: getEmptyRolePermissions(),
    }));
    setDirty(true);
    toast.info(`Se han revocado todos los accesos de «${selectedRole}». Guarda los cambios.`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePermissionsMatrix(matrix);
      setDirty(false);
      setSavedFlash(true);
      toast.success(
        isSupabaseConfigured()
          ? 'Permisos sincronizados correctamente con Supabase.'
          : 'Accesos actualizados localmente.'
      );
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar los permisos');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('¿Restaurar permisos a los valores predeterminados del sistema?')) return;
    try {
      const defaults = await resetPermissionsMatrix();
      setMatrix(defaults);
      setDirty(false);
      toast.info('Permisos restaurados a valores predeterminados.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron restaurar los permisos');
    }
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (loading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center gap-3 text-center fade-in" role="status">
        <span className="inline-block h-8 w-8 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando roles y permisos del sistema…</p>
        <div className="w-full max-w-lg space-y-2 mt-2">
          <div className="skeleton-shimmer h-10 rounded-xl" />
          <div className="skeleton-shimmer h-10 rounded-xl" />
          <div className="skeleton-shimmer h-10 rounded-xl" />
          <div className="skeleton-shimmer h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  const loadErr = loadError || getPermissionsLoadError();
  const isMissingRolesTable = loadErr ? isMissingRolesTableError(loadErr) : false;

  // Lista consolidada de roles disponibles
  const displayRoles = rolesList.length > 0
    ? rolesList
    : [
        { id: '1', codigo: 'admin', nombre: 'Administrador', descripcion: 'Acceso total', permisos: {} },
        { id: '2', codigo: 'cajero', nombre: 'Cajero', descripcion: 'POS y caja', permisos: {} },
        { id: '3', codigo: 'vendedor', nombre: 'Vendedor', descripcion: 'Ventas y clientes', permisos: {} },
        { id: '4', codigo: 'almacen', nombre: 'Almacenista', descripcion: 'Inventario y compras', permisos: {} },
        { id: '5', codigo: 'contable', nombre: 'Contador', descripcion: 'Finanzas e informes', permisos: {} },
      ];

  const isCustomRole =
    currentRoleObj &&
    !['admin', 'cajero', 'vendedor', 'almacen', 'contable', 'superadmin', 'super_admin'].includes(
      currentRoleObj.codigo.toLowerCase()
    );

  return (
    <div className="space-y-4">
      {(isMissingRolesTable || (loadErr && !isMissingRolesTable)) && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <span>Sincronización remota pendiente — Tabla "roles" en Supabase</span>
          </div>
          <p>{loadErr}</p>
          <p className="font-medium flex items-center">
            <Lightbulb size={16} className="text-amber-500 inline mr-1.5 shrink-0" />
            <span>
              <strong>Instrucciones:</strong> Abre tu panel de Supabase → <strong>SQL Editor</strong>, abre o pega el contenido de{' '}
              <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono">supabase/migrations/014_permitir_roles_personalizados.sql</code> y haz clic en <strong>Run</strong>.
            </span>
          </p>
        </div>
      )}

      {/* Header card with actions */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Permisos de acceso por Rol</h2>
              <Link
                to="/users"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium ml-2"
                title="Ir al listado de usuarios y roles"
              >
                <Users size={13} />
                <span>Gestionar roles</span>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Configura los permisos para cada rol. Puedes ajustar roles del sistema o creados por ti.
              La acción <strong>Ver</strong> habilita la pantalla en el menú y las rutas; las demás acciones definen qué operaciones puede realizar dentro del módulo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Restaurar a los permisos iniciales"
            >
              <RotateCcw size={15} />
              <span className="hidden sm:inline">Restaurar</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || isSuperAdmin}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none shadow-sm"
            >
              {savedFlash ? <Check size={15} /> : <Save size={15} />}
              {saving ? 'Guardando…' : savedFlash ? '¡Guardado!' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {dirty && !isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200 animate-in fade-in">
            <Info size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              Tienes modificaciones sin guardar en el rol <strong className="mx-0.5 font-bold">{selectedRole}</strong>.
              Haz clic en <strong>Guardar Cambios</strong> para aplicarlas.
            </span>
          </div>
        )}

        {/* Dynamic role chips for ALL roles + New Role button */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-primary" />
              <span>Selecciona un rol para ver y configurar sus accesos:</span>
              <span className="text-[11px] bg-secondary px-2 py-0.5 rounded-full font-bold text-foreground">
                {displayRoles.length} roles
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateNombre('');
                setCreateCodigo('');
                setCreateDesc('');
                setCreateTemplate('cajero');
                setShowCreateModal(true);
              }}
              className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
              title="Crear un nuevo rol personalizado"
            >
              <Plus size={14} />
              <span>Nuevo Rol</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {displayRoles.map((r) => {
              const roleName = r.nombre;
              const meta = getRoleMeta(roleName, r.descripcion);
              const active = selectedRole.toLowerCase() === roleName.toLowerCase() || selectedRole.toLowerCase() === r.codigo.toLowerCase();
              const rMap = matrix[roleName] || matrix[r.codigo] || (r.permisos as RolePermissionMap) || {};
              const accessCount = PERMISSION_MODULES.filter((m) => rMap[m.id]?.ver).length;
              const isSuper = r.codigo === 'superadmin' || r.codigo === 'super_admin' || roleName === 'Super Administrador';
              const isCustom = !['admin', 'cajero', 'vendedor', 'almacen', 'contable', 'superadmin', 'super_admin'].includes(r.codigo.toLowerCase());

              return (
                <button
                  key={r.id || r.codigo}
                  type="button"
                  onClick={() => setSelectedRole(roleName)}
                  className={`
                    inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all cursor-pointer
                    ${
                      active
                        ? `${meta.accent} bg-card shadow-sm ring-2 ring-primary/20 scale-[1.02]`
                        : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }
                  `}
                >
                  {isSuper ? <Lock size={13} className="text-emerald-600" /> : <Unlock size={13} />}
                  <span>{roleName}</span>
                  {isCustom && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Personalizado
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.color}`}>
                    {isSuper ? 'Total' : `${accessCount} áreas`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor container */}
      <div className="card p-4 sm:p-5 space-y-4">
        {/* Role header info bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${roleMeta.color}`}
            >
              <Shield size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-extrabold text-foreground text-base">{selectedRole}</p>
                {currentRoleObj && (
                  <span className="text-[11px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                    código: {currentRoleObj.codigo}
                  </span>
                )}
                {isCustomRole && (
                  <div className="flex items-center gap-1.5">
                    <span className="badge-info text-[10px]">Rol Personalizado</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentRoleObj) {
                          setEditNombre(currentRoleObj.nombre);
                          setEditDesc(currentRoleObj.descripcion || '');
                          setShowEditModal(true);
                        }
                      }}
                      className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-xs"
                      title="Editar nombre o descripción de este rol"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => currentRoleObj && handleDeleteRole(currentRoleObj)}
                      className="p-1 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger text-xs"
                      title="Eliminar este rol personalizado"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {roleMeta.description} · Acceso a {modulesWithAccess} de {PERMISSION_MODULES.length} módulos ({coverage}% de acciones)
              </p>
            </div>
          </div>

          {/* Quick action tools */}
          <div className="flex flex-wrap items-center gap-2">
            {!isSuperAdmin && (
              <>
                {/* Clone template dropdown */}
                <div className="flex items-center gap-1.5 bg-secondary/60 rounded-xl px-2 py-1 border border-border text-xs">
                  <Copy size={13} className="text-muted-foreground" />
                  <span className="text-muted-foreground text-[11px] font-medium hidden sm:inline">Copiar de:</span>
                  <select
                    className="bg-transparent border-0 text-xs font-semibold text-foreground focus:ring-0 p-1 cursor-pointer"
                    value={templateSourceRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTemplateSourceRole(val);
                      if (val) handleCloneFromRole(val);
                    }}
                  >
                    <option value="">Seleccionar plantilla...</option>
                    {displayRoles
                      .filter((r) => r.nombre !== selectedRole && r.codigo !== currentRoleObj?.codigo)
                      .map((r) => (
                        <option key={r.id || r.codigo} value={r.nombre}>
                          {r.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Grant all / Revoke all quick buttons */}
                <button
                  type="button"
                  onClick={handleGrantAll}
                  className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 hover:text-primary transition-colors"
                  title="Activar todos los permisos para este rol"
                >
                  <CheckCheck size={14} className="text-primary" />
                  <span className="hidden md:inline">Acceso total</span>
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAll}
                  className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 hover:text-danger transition-colors"
                  title="Desactivar todos los permisos para este rol"
                >
                  <XCircle size={14} className="text-danger" />
                  <span className="hidden md:inline">Quitar todo</span>
                </button>
              </>
            )}

            <div className="relative w-full sm:w-56">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-field pl-9 text-xs py-2 w-full"
                placeholder="Filtrar módulos…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Coverage progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
            <span>Nivel de cobertura del rol:</span>
            <span>{coverage}% ({enabledCount} permisos activos)</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <Sparkles size={14} className="mt-0.5 text-emerald-600 flex-shrink-0" />
            <span>
              El rol <strong>Super Administrador</strong> es el acceso maestro de seguridad y cuenta con permisos totales permanentes para prevenir bloqueos accidentales.
            </span>
          </div>
        )}

        {/* Column headers for desktop */}
        <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,0.5fr))] gap-1 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground pt-1">
          <span>Área / Pantalla</span>
          {PERMISSION_ACTIONS.map((a) => (
            <span key={a.id} className="text-center">
              {a.short}
            </span>
          ))}
        </div>

        {/* Groups and Modules list */}
        <div className="space-y-2">
          {PERMISSION_GROUPS.map((group) => {
            const modules = filteredModules.filter((m) => m.group === group);
            if (modules.length === 0) return null;
            const collapsed = !!collapsedGroups[group];

            return (
              <div key={group} className="rounded-2xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
                  }
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-secondary/50 hover:bg-secondary/70 transition-colors"
                >
                  <span className="text-sm font-bold text-foreground">{group}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {modules.length} {modules.length === 1 ? 'módulo' : 'módulos'}
                    {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </span>
                </button>

                {!collapsed && (
                  <div className="divide-y divide-border bg-card">
                    {modules.map((mod) => {
                      const enabledInMod = countModuleEnabled(roleMap, mod.id);
                      const allOn = enabledInMod === mod.actions.length;
                      const canEnter = !!roleMap[mod.id]?.ver;

                      return (
                        <div key={mod.id} className="px-3.5 py-3 hover:bg-secondary/15 transition-colors">
                          <div className="md:grid md:grid-cols-[minmax(0,1.5fr)_repeat(6,minmax(0,0.5fr))] md:gap-1 md:items-center">
                            <div className="flex items-start justify-between gap-2 mb-2 md:mb-0">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm text-foreground">{mod.label}</p>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      canEnter
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-secondary text-muted-foreground'
                                    }`}
                                  >
                                    {canEnter ? 'Puede entrar' : 'Sin acceso'}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                              </div>
                              {!isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => toggleModuleAccess(mod.id, mod.actions, !allOn)}
                                  className="text-[11px] font-bold text-primary hover:underline flex-shrink-0 md:hidden"
                                >
                                  {allOn ? 'Quitar' : 'Dar acceso'}
                                </button>
                              )}
                            </div>

                            {/* Mobile action buttons */}
                            <div className="flex flex-wrap gap-1.5 md:hidden">
                              {PERMISSION_ACTIONS.map((action) => {
                                if (!mod.actions.includes(action.id)) return null;
                                const on = !!roleMap[mod.id]?.[action.id];
                                return (
                                  <button
                                    key={action.id}
                                    type="button"
                                    disabled={isSuperAdmin}
                                    onClick={() => setAction(mod.id, action.id, !on)}
                                    className={`
                                      px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all
                                      ${
                                        on
                                          ? 'bg-primary/15 border-primary/30 text-primary'
                                          : 'bg-card border-border text-muted-foreground'
                                      }
                                      disabled:opacity-50
                                    `}
                                  >
                                    {action.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Desktop toggles */}
                            {PERMISSION_ACTIONS.map((action) => {
                              if (!mod.actions.includes(action.id)) {
                                return (
                                  <div key={action.id} className="hidden md:flex justify-center">
                                    <span className="text-muted-foreground/25 text-xs">—</span>
                                  </div>
                                );
                              }
                              const on = !!roleMap[mod.id]?.[action.id];
                              return (
                                <div key={action.id} className="hidden md:flex justify-center">
                                  <Toggle
                                    checked={on}
                                    disabled={isSuperAdmin}
                                    label={`${mod.label} · ${action.label}`}
                                    onChange={() => setAction(mod.id, action.id, !on)}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {!isSuperAdmin && (
                            <div className="hidden md:flex justify-end mt-1">
                              <button
                                type="button"
                                onClick={() => toggleModuleAccess(mod.id, mod.actions, !allOn)}
                                className="text-[11px] font-bold text-primary hover:underline"
                              >
                                {allOn ? 'Quitar acceso al área' : 'Dar acceso completo al área'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredModules.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No hay módulos que coincidan con “{search}”.
            </p>
          )}
        </div>
      </div>

      {/* Modal para Crear Rol */}
      <ModalShell open={showCreateModal} onClose={() => !creatingRole && setShowCreateModal(false)} size="md">
        <form onSubmit={handleCreateRole} className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Plus size={18} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Crear Nuevo Rol</h3>
                <p className="text-xs text-muted-foreground">Define un nuevo rol y personaliza sus permisos</p>
              </div>
            </div>
            <button
              type="button"
              disabled={creatingRole}
              onClick={() => setShowCreateModal(false)}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nombre del Rol <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                className="input-field text-sm w-full"
                placeholder="Ej: Supervisor de Turno, Auditor, etc."
                value={createNombre}
                onChange={(e) => {
                  const val = e.target.value;
                  setCreateNombre(val);
                  if (!createCodigo || createCodigo === createNombre.toLowerCase().replace(/[^a-z0-9_]+/g, '_')) {
                    setCreateCodigo(val.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Código identificador (sistema) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                className="input-field text-xs font-mono w-full"
                placeholder="ej: supervisor_turno"
                value={createCodigo}
                onChange={(e) => setCreateCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
              />
              <span className="text-[11px] text-muted-foreground">Solo letras minúsculas, números y guiones bajos</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descripción (opcional)
              </label>
              <textarea
                rows={2}
                className="input-field text-xs w-full resize-none"
                placeholder="Describe la responsabilidad o propósito de este rol..."
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Plantilla base de permisos
              </label>
              <select
                className="input-field text-xs w-full"
                value={createTemplate}
                onChange={(e) => setCreateTemplate(e.target.value)}
              >
                <option value="cajero">Cajero (3 áreas: POS, ventas y caja)</option>
                <option value="vendedor">Vendedor (8 áreas: ventas, clientes, CxC)</option>
                <option value="almacen">Almacenista (8 áreas: inventario, transferencias, compras)</option>
                <option value="contable">Contador (10 áreas: finanzas, informes, auditoría)</option>
                <option value="admin">Administrador (Acceso total)</option>
                <option value="empty">Sin accesos (empezar en blanco)</option>
              </select>
              <span className="text-[11px] text-muted-foreground">
                El nuevo rol heredará estos permisos como punto de partida y podrás afinarlos de inmediato.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              disabled={creatingRole}
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary text-xs py-2 px-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingRole || !createNombre.trim()}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
            >
              {creatingRole ? (
                <span>Creando…</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Crear y Configurar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Modal para Editar Rol */}
      <ModalShell open={showEditModal} onClose={() => !editingRoleState && setShowEditModal(false)} size="md">
        <form onSubmit={handleEditRole} className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Edit2 size={16} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Editar Información del Rol</h3>
                <p className="text-xs text-muted-foreground">Modifica el nombre o descripción del rol</p>
              </div>
            </div>
            <button
              type="button"
              disabled={editingRoleState}
              onClick={() => setShowEditModal(false)}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nombre del Rol <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                className="input-field text-sm w-full"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descripción
              </label>
              <textarea
                rows={3}
                className="input-field text-xs w-full resize-none"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              disabled={editingRoleState}
              onClick={() => setShowEditModal(false)}
              className="btn-secondary text-xs py-2 px-4"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={editingRoleState || !editNombre.trim()}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
            >
              {editingRoleState ? 'Guardando…' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
