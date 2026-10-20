import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  Users,
  UserCheck,
  Shield,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Download,
  Eye,
  Sliders,
  AlertTriangle,
  X,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import { exportTableToPdf } from '@/lib/exportPdf';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useAgentes } from '@/hooks/useAgentes';
import { useRoles } from '@/hooks/useRoles';
import { ROL_DB_A_UI, ROL_UI_A_DB } from '@/services/auth.service';
import type { AgenteComercial, Perfil, Rol, RolDb } from '@/types/database';
import type { UserRole } from '@/lib/auth';
import { toast } from '@/lib/toast';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { isMissingRolesTableError } from '@/services/roles.service';
import { InlineLoader, TableRowSkeleton } from '@/components/ui/LoadingSkeleton';
import ModalShell from '@/components/ui/ModalShell';
import { getDefaultRolePermissions } from '@/lib/permissionsCatalog';

type Tab = 'users' | 'roles' | 'agents';

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Perfil | null>(null);
  const [viewingUser, setViewingUser] = useState<Perfil | null>(null);
  const [viewingAgent, setViewingAgent] = useState<AgenteComercial | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgenteComercial | null>(null);
  const [editingRole, setEditingRole] = useState<Rol | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formComision, setFormComision] = useState('5');
  const [formRol, setFormRol] = useState<string>('cajero');
  const [formDescRol, setFormDescRol] = useState('');
  const [formCodigoRol, setFormCodigoRol] = useState('');
  const [formTemplateRol, setFormTemplateRol] = useState('');
  const [saving, setSaving] = useState(false);

  const { usuarios, loading, crear, actualizar, alternarActivo, eliminar } = useUsuarios(search);
  const {
    agentes,
    loading: loadingAgentes,
    crear: crearAgente,
    actualizar: actualizarAgente,
    alternarActivo: alternarActivoAgente,
    eliminar: eliminarAgente,
  } = useAgentes(search);
  const {
    roles,
    loading: loadingRoles,
    error: rolesError,
    crear: crearRol,
    actualizar: actualizarRol,
    eliminar: eliminarRol,
  } = useRoles(search);

  const countPermissions = (permisos: Record<string, Record<string, boolean>> | null | undefined): number => {
    if (!permisos) return 0;
    let count = 0;
    for (const mod in permisos) {
      const actions = permisos[mod];
      for (const act in actions) {
        if (actions[act]) count++;
      }
    }
    return count;
  };

  const resetForm = () => {
    setFormNombre('');
    setFormCorreo('');
    setFormTelefono('');
    setFormPassword('');
    setFormComision('5');
    setFormDescRol('');
    setFormCodigoRol('');
    setFormTemplateRol('');
    setFormRol('cajero');
    setEditingUser(null);
    setEditingAgent(null);
    setEditingRole(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditUser = (user: Perfil) => {
    setEditingUser(user);
    setFormNombre(user.nombre_completo);
    setFormCorreo(user.correo);
    setFormTelefono(user.telefono ?? '');
    setFormPassword('');
    setFormRol(user.rol || 'cajero');
    setShowForm(true);
  };

  const openEditAgent = (agent: AgenteComercial) => {
    setEditingAgent(agent);
    setFormNombre(agent.nombre);
    setFormCorreo(agent.correo ?? '');
    setFormTelefono(agent.telefono ?? '');
    setFormComision(String(agent.porcentaje_comision ?? 0));
    setShowForm(true);
  };

  const openEditRole = (role: Rol) => {
    setEditingRole(role);
    setFormNombre(role.nombre);
    setFormDescRol(role.descripcion ?? '');
    setFormCodigoRol(role.codigo);
    setFormTemplateRol('');
    setShowForm(true);
  };

  const handleSaveRole = async () => {
    if (!formNombre.trim()) {
      toast.error('Ingresa el nombre del rol');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await actualizarRol(editingRole.id, {
          nombre: formNombre.trim(),
          descripcion: formDescRol.trim() || null,
        });
        toast.success(`Rol "${formNombre.trim()}" actualizado correctamente`);
      } else {
        const codigo = formCodigoRol.trim()
          ? formCodigoRol.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
          : formNombre.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');

        const basePermissions = formTemplateRol
          ? (roles.find((r) => r.codigo === formTemplateRol)?.permisos || getDefaultRolePermissions(formTemplateRol))
          : {};

        await crearRol({
          codigo,
          nombre: formNombre.trim(),
          descripcion: formDescRol.trim() || null,
          permisos: basePermissions,
        });
        toast.success(`Rol "${formNombre.trim()}" creado exitosamente.`);
      }
      setShowForm(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar rol');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: Rol) => {
    if (role.codigo === 'admin') {
      toast.error('No se puede eliminar el rol Administrador');
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar el rol "${role.nombre}"?`)) return;
    try {
      await eliminarRol(role.id);
      toast.success(`Rol "${role.nombre}" eliminado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el rol');
    }
  };

  const tabs = [
    { id: 'users' as Tab, label: 'Usuarios', icon: <Users size={16} /> },
    { id: 'roles' as Tab, label: 'Roles', icon: <Shield size={16} /> },
    { id: 'agents' as Tab, label: 'Agentes Comerciales', icon: <UserCheck size={16} /> },
  ];

  const handleExportPdf = () => {
    if (tab === 'users') {
      exportTableToPdf({
        title: 'Usuarios del Sistema',
        filename: 'usuarios',
        headers: ['Nombre', 'Email', 'Teléfono', 'Rol', 'Estado'],
        rows: usuarios.map((u) => [
          u.nombre_completo,
          u.correo,
          u.telefono ?? '',
          ROL_DB_A_UI[u.rol] ?? u.rol,
          u.activo ? 'Activo' : 'Inactivo',
        ]),
      });
      return;
    }
    if (tab === 'roles') {
      exportTableToPdf({
        title: 'Roles y Permisos',
        filename: 'roles',
        headers: ['Rol', 'Código', 'Permisos', 'Usuarios', 'Descripción'],
        rows: roles.map((r) => [
          r.nombre,
          r.codigo,
          countPermissions(r.permisos),
          usuarios.filter((u) => u.rol === r.codigo).length,
          r.descripcion ?? '',
        ]),
      });
      return;
    }
    exportTableToPdf({
      title: 'Agentes Comerciales',
      filename: 'agentes',
      headers: ['Nombre', 'Email', 'Teléfono', 'Comisión %', 'Estado'],
      rows: agentes.map((a) => [
        a.nombre,
        a.correo ?? '',
        a.telefono ?? '',
        `${Number(a.porcentaje_comision).toFixed(2)}%`,
        a.activo ? 'Activo' : 'Inactivo',
      ]),
    });
  };

  const handleCreateUser = async () => {
    if (!formNombre.trim()) {
      toast.error('Ingresa el nombre completo');
      return;
    }
    const finalRolCode = (ROL_UI_A_DB[formRol] || formRol || 'cajero') as RolDb;

    if (editingUser) {
      setSaving(true);
      try {
        await actualizar(editingUser.id, {
          nombre_completo: formNombre.trim(),
          telefono: formTelefono.trim() || null,
          rol: finalRolCode,
        });
        toast.success('Usuario actualizado');
        setShowForm(false);
        resetForm();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al actualizar usuario');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!formCorreo.trim() || !formPassword) {
      toast.error('Completa nombre, correo y contraseña');
      return;
    }
    setSaving(true);
    try {
      await crear({
        correo: formCorreo.trim(),
        password: formPassword,
        nombre_completo: formNombre.trim(),
        rol: finalRolCode,
        telefono: formTelefono.trim() || null,
      });
      toast.success('Usuario creado');
      setShowForm(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: Perfil) => {
    if (!confirm(`¿Desactivar / eliminar al usuario "${user.nombre_completo}"?`)) return;
    try {
      await eliminar(user.id);
      toast.success(`Usuario "${user.nombre_completo}" eliminado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el usuario');
    }
  };

  const handleSaveAgent = async () => {
    if (!formNombre.trim()) {
      toast.error('Escribe el nombre del agente');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: formNombre.trim(),
        correo: formCorreo.trim() || null,
        telefono: formTelefono.trim() || null,
        porcentaje_comision: Number(formComision) || 0,
      };
      if (editingAgent) {
        await actualizarAgente(editingAgent.id, payload);
        toast.success('Agente actualizado en Supabase');
      } else {
        await crearAgente(payload);
        toast.success('Agente creado en Supabase');
      }
      setShowForm(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar agente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        {!(viewingUser || viewingAgent) && (
        <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Administra usuarios, roles y agentes comerciales
              {!isSupabaseConfigured() && ' (modo local — configura Supabase para altas reales)'}
            </p>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                openNewModal();
              }
            }}
            className="btn-primary flex items-center gap-2 w-fit shadow-xs"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showForm ? 'Cerrar Formulario' : `Nuevo ${tab === 'users' ? 'Usuario' : tab === 'roles' ? 'Rol' : 'Agente'}`}</span>
          </button>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="input-field pl-9"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => {
                if (!search.trim()) {
                  toast.info('Escribe en el buscador para filtrar la lista');
                  return;
                }
                toast.success(`Filtrando por «${search.trim()}»`);
              }}
            >
              <Filter size={16} />
              Filtrar
            </button>
            <button type="button" onClick={handleExportPdf} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* FORMULARIO INLINE DE CREACIÓN / EDICIÓN */}
        {showForm && (
          <div className="card p-6 border-2 border-primary/40 bg-card shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <UserCheck size={20} className="text-primary" />
                {tab === 'users'
                  ? editingUser
                    ? 'Editar Usuario'
                    : 'Nuevo Usuario'
                  : tab === 'roles'
                  ? editingRole
                    ? 'Editar Rol'
                    : 'Nuevo Rol'
                  : editingAgent
                  ? 'Editar Agente'
                  : 'Nuevo Agente'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-foreground">
                  {tab === 'roles' ? 'Nombre del Rol' : 'Nombre Completo'}
                </label>
                <input
                  className="input-field w-full"
                  placeholder={tab === 'roles' ? 'Ej: Cajero Nocturno' : 'Ej: Juan Pérez'}
                  value={formNombre}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormNombre(val);
                    if (tab === 'roles' && !editingRole) {
                      setFormCodigoRol(val.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                    }
                  }}
                />
              </div>

              {tab !== 'roles' && (
                <div>
                  <label className="block font-bold mb-1 text-foreground">Correo Electrónico</label>
                  <input
                    className="input-field w-full"
                    placeholder="correo@ejemplo.com"
                    type="email"
                    value={formCorreo}
                    onChange={(e) => setFormCorreo(e.target.value)}
                    disabled={tab === 'users' && !!editingUser}
                  />
                </div>
              )}

              {tab !== 'roles' && (
                <div>
                  <label className="block font-bold mb-1 text-foreground">Teléfono</label>
                  <input
                    className="input-field w-full"
                    placeholder="(809) 000-0000"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                  />
                </div>
              )}

              {tab === 'agents' && (
                <div>
                  <label className="block font-bold mb-1 text-foreground">Comisión (%)</label>
                  <input
                    className="input-field w-full font-mono"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={formComision}
                    onChange={(e) => setFormComision(e.target.value)}
                  />
                </div>
              )}

              {tab === 'users' && (
                <div>
                  <label className="block font-bold mb-1 text-foreground">Rol del Usuario</label>
                  <select
                    className="input-field w-full"
                    value={formRol}
                    onChange={(e) => setFormRol(e.target.value)}
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r.id || r.codigo} value={r.codigo}>
                          {r.nombre} ({r.codigo})
                        </option>
                      ))
                    ) : (
                      [
                        { codigo: 'admin', nombre: 'Administrador' },
                        { codigo: 'cajero', nombre: 'Cajero' },
                        { codigo: 'vendedor', nombre: 'Vendedor' },
                        { codigo: 'almacen', nombre: 'Almacenista' },
                        { codigo: 'contable', nombre: 'Contador' },
                      ].map((r) => (
                        <option key={r.codigo} value={r.codigo}>
                          {r.nombre} ({r.codigo})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {tab === 'users' && !editingUser && (
                <div>
                  <label className="block font-bold mb-1 text-foreground">Contraseña de Acceso</label>
                  <input
                    className="input-field w-full"
                    placeholder="••••••••"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              )}

              {tab === 'roles' && (
                <>
                  <div>
                    <label className="block font-bold mb-1 text-foreground">Código Identificador</label>
                    <input
                      className="input-field font-mono text-xs w-full"
                      placeholder="ej: cajero_nocturno (auto si se deja vacío)"
                      disabled={!!editingRole}
                      value={formCodigoRol}
                      onChange={(e) => setFormCodigoRol(e.target.value)}
                    />
                  </div>
                  {!editingRole && (
                    <div>
                      <label className="block font-bold mb-1 text-foreground">Plantilla de Permisos Inicial</label>
                      <select
                        className="input-field w-full text-xs"
                        value={formTemplateRol}
                        onChange={(e) => setFormTemplateRol(e.target.value)}
                      >
                        <option value="">Vacío (sin permisos iniciales)</option>
                        <option value="admin">Administrador (acceso total a todo)</option>
                        <option value="cajero">Cajero (POS y cierre de caja)</option>
                        <option value="vendedor">Vendedor (ventas, clientes y CxC)</option>
                        <option value="almacen">Almacenista (inventario y compras)</option>
                        <option value="contable">Contador (finanzas, gastos e informes)</option>
                        {roles
                          .filter((r) => !['admin', 'cajero', 'vendedor', 'almacen', 'contable'].includes(r.codigo))
                          .map((r) => (
                            <option key={r.id || r.codigo} value={r.codigo}>
                              Copiar de: {r.nombre}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <div className={editingRole ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <label className="block font-bold mb-1 text-foreground">Descripción del Rol</label>
                    <textarea
                      className="input-field w-full"
                      placeholder="Descripción de funciones y nivel de acceso..."
                      rows={2}
                      value={formDescRol}
                      onChange={(e) => setFormDescRol(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                className="btn-secondary text-xs py-2 px-4"
                disabled={saving}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary text-xs font-bold py-2 px-5 flex items-center gap-1.5 shadow-sm"
                disabled={saving}
                onClick={() => {
                  if (tab === 'users') void handleCreateUser();
                  else if (tab === 'agents') void handleSaveAgent();
                  else if (tab === 'roles') void handleSaveRole();
                }}
              >
                <CheckCircle size={15} />
                <span>{saving ? 'Guardando…' : 'Guardar'}</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <>
                      <InlineLoader colSpan={5} message="Cargando usuarios…" />
                      <TableRowSkeleton cols={5} />
                      <TableRowSkeleton cols={5} />
                      <TableRowSkeleton cols={5} />
                    </>
                  )}
                  {!loading &&
                    usuarios.map((user, i) => (
                      <tr
                        key={user.id}
                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-secondary/10'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                              {user.nombre_completo.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.nombre_completo}</p>
                              <p className="text-xs text-muted-foreground">{user.correo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {(() => {
                            const roleObj = roles.find((r) => r.codigo === user.rol || r.nombre === user.rol);
                            const roleLabel = roleObj?.nombre || ROL_DB_A_UI[user.rol] || user.rol;
                            const isCustom = roleObj && !['admin', 'cajero', 'vendedor', 'almacen', 'contable'].includes(roleObj.codigo);
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="badge-info font-medium">{roleLabel}</span>
                                {isCustom && (
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                    Personalizado
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                          {user.telefono ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={user.activo ? 'badge-success' : 'badge-danger'}>
                            {user.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Ver usuario"
                              onClick={() => setViewingUser(user)}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar usuario"
                              onClick={() => openEditUser(user)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"
                              title="Eliminar usuario"
                              onClick={() => void handleDeleteUser(user)}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              onClick={async () => {
                                try {
                                  await alternarActivo(user.id, !user.activo);
                                  toast.success(user.activo ? 'Usuario desactivado' : 'Usuario activado');
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : 'Error');
                                }
                              }}
                            >
                              {user.activo ? (
                                <ToggleRight size={14} className="text-success" />
                              ) : (
                                <ToggleLeft size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Mostrando {usuarios.length} usuario{usuarios.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        )}

        {tab === 'roles' && (
          <div className="space-y-4">
            {rolesError && isMissingRolesTableError(rolesError) && (
              <div className="card border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                  <span>Sincronización remota pendiente — Tabla "roles" en Supabase</span>
                </div>
                <p>
                  {rolesError}
                </p>
                <p className="font-medium flex items-center">
                  <Lightbulb size={16} className="text-amber-500 inline mr-1.5 shrink-0" />
                  <span><strong>Instrucciones:</strong> Abre tu panel de Supabase → <strong>SQL Editor</strong>, pega el contenido de <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">supabase/migrations/008_crear_tabla_roles.sql</code> y haz clic en <strong>Run</strong>.</span>
                </p>
              </div>
            )}

            <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Shield size={20} />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Matriz de Permisos de Acceso</p>
                  <p className="text-xs text-muted-foreground">Configura los accesos y permisos por módulo para todos los usuarios y roles del sistema.</p>
                </div>
              </div>
              <Link
                to="/settings?section=permissions"
                className="btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sliders size={14} />
                <span>Configurar Permisos de Accesos</span>
              </Link>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Permisos</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Usuarios</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRoles && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Cargando roles…
                      </td>
                    </tr>
                  )}
                  {!loadingRoles && rolesError && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-danger text-sm">
                        {rolesError}
                      </td>
                    </tr>
                  )}
                  {!loadingRoles && !rolesError && roles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No hay roles en Supabase. Ejecuta la migración 008 o ve a Configuración → Permisos.
                      </td>
                    </tr>
                  )}
                  {!loadingRoles &&
                    !rolesError &&
                    roles.map((role, i) => {
                    const activeUsersCount = usuarios.filter((u) => u.rol === role.codigo).length;
                    const permissionsCount = countPermissions(role.permisos);
                    const isCustom = !['admin', 'cajero', 'vendedor', 'almacen', 'contable'].includes(role.codigo);
                    return (
                      <tr
                        key={role.id}
                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-secondary/10'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{role.nombre}</span>
                            {isCustom ? (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                Personalizado
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                Sistema
                              </span>
                            )}
                          </div>
                          <span className="block text-[11px] text-muted-foreground font-mono">{role.codigo}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{role.descripcion || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Link
                            to={`/settings?section=permissions&role=${encodeURIComponent(role.nombre)}`}
                            className="badge-info hover:bg-primary/20 transition-colors inline-flex items-center gap-1 font-semibold"
                            title="Configurar permisos de este rol"
                          >
                            <Shield size={12} />
                            <span>{permissionsCount} permisos</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{activeUsersCount} usuarios</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/settings?section=permissions&role=${encodeURIComponent(role.nombre)}`}
                              className="p-1.5 rounded-lg hover:bg-primary/15 text-primary transition-colors flex items-center gap-1 text-xs font-semibold"
                              title="Configurar matriz de permisos de este rol"
                            >
                              <Sliders size={14} />
                              <span className="hidden sm:inline">Permisos</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEditRole(role)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar rol"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={role.codigo === 'admin'}
                              onClick={() => void handleDeleteRole(role)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors disabled:opacity-30"
                              title="Eliminar rol"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {tab === 'agents' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Agente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Comisión %</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAgentes && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Cargando agentes…
                      </td>
                    </tr>
                  )}
                  {!loadingAgentes && agentes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No hay agentes en Supabase. Crea el primero con “Nuevo Agente”.
                      </td>
                    </tr>
                  )}
                  {!loadingAgentes &&
                    agentes.map((agent, i) => (
                      <tr
                        key={agent.id}
                        className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-secondary/10'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                              {agent.nombre.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{agent.nombre}</p>
                              <p className="text-xs text-muted-foreground">{agent.correo || 'Sin correo'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {agent.telefono || '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-success font-semibold">
                          {Number(agent.porcentaje_comision).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              void alternarActivoAgente(agent.id, !agent.activo).then(() =>
                                toast.success(agent.activo ? 'Agente desactivado' : 'Agente activado')
                              )
                            }
                            className="inline-flex items-center gap-1"
                            title={agent.activo ? 'Desactivar' : 'Activar'}
                          >
                            {agent.activo ? (
                              <ToggleRight size={22} className="text-success" />
                            ) : (
                              <ToggleLeft size={22} className="text-muted-foreground" />
                            )}
                            <span className={agent.activo ? 'badge-success' : 'badge-danger'}>
                              {agent.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Vista previa"
                              onClick={() => setViewingAgent(agent)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditAgent(agent)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!confirm(`¿Eliminar agente "${agent.nombre}"?`)) return;
                                void eliminarAgente(agent.id)
                                  .then(() => toast.success('Agente eliminado'))
                                  .catch((e) =>
                                    toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
                                  );
                              }}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        </>
        )}
      </div>

      <ModalShell open={!!viewingUser} onClose={() => setViewingUser(null)} size="md" className="p-6">
        {viewingUser && (
          <>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users size={20} className="text-primary" />
                Detalle de Usuario
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {viewingUser.nombre_completo.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-foreground">{viewingUser.nombre_completo}</p>
                  <p className="text-xs text-muted-foreground">{viewingUser.correo}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-secondary/30 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Teléfono</span>
                  <span className="font-medium text-foreground">{viewingUser.telefono || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Rol</span>
                  <span className="badge-info">
                    {roles.find((r) => r.codigo === viewingUser.rol || r.nombre === viewingUser.rol)?.nombre ||
                      ROL_DB_A_UI[viewingUser.rol] ||
                      viewingUser.rol}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Estado</span>
                  <span className={viewingUser.activo ? 'badge-success' : 'badge-danger'}>
                    {viewingUser.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Código acceso</span>
                  <span className="font-mono">{viewingUser.codigo_acceso || '—'}</span>
                </div>
                {viewingUser.creado_en && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block">Creado</span>
                    <span>{new Date(viewingUser.creado_en).toLocaleString('es-DO')}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button type="button" className="btn-primary" onClick={() => setViewingUser(null)}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </ModalShell>

      <ModalShell open={!!viewingAgent} onClose={() => setViewingAgent(null)} size="md" className="p-6">
        {viewingAgent && (
          <>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserCheck size={20} className="text-primary" />
                Detalle de Agente
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <p className="font-bold text-foreground text-base">{viewingAgent.nombre}</p>
              <div className="grid grid-cols-2 gap-3 bg-secondary/30 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Correo</span>
                  <span className="font-medium text-foreground">{viewingAgent.correo || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Teléfono</span>
                  <span className="font-medium text-foreground">{viewingAgent.telefono || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Comisión</span>
                  <span className="font-bold text-primary">{viewingAgent.porcentaje_comision ?? 0}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Estado</span>
                  <span className={viewingAgent.activo ? 'badge-success' : 'badge-danger'}>
                    {viewingAgent.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn-secondary" onClick={() => setViewingAgent(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setViewingAgent(null);
                  openEditAgent(viewingAgent);
                }}
              >
                Editar
              </button>
            </div>
          </>
        )}
      </ModalShell>
    </AppLayout>
  );
}
