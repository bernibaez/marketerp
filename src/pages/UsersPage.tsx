import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  Users,
  UserCheck,
  Shield,
  Plus,
  Search,
  Filter,
  Download,
  X,
} from 'lucide-react';
import { exportTableToPdf } from '@/lib/exportPdf';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useAgentes } from '@/hooks/useAgentes';
import { useRoles } from '@/hooks/useRoles';
import { ROL_DB_A_UI, ROL_UI_A_DB } from '@/services/auth.service';
import type { AgenteComercial, Perfil, Rol, RolDb } from '@/types/database';
import { toast } from '@/lib/toast';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { getDefaultRolePermissions } from '@/lib/permissionsCatalog';
import { UsersTable } from './users/components/UsersTable';
import { RolesTable } from './users/components/RolesTable';
import { AgentsTable } from './users/components/AgentsTable';
import { UserInlineForm } from './users/components/UserInlineForm';
import { UserDetailModal } from './users/components/UserDetailModal';
import { AgentDetailModal } from './users/components/AgentDetailModal';

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
                type="button"
                onClick={() => {
                  if (showForm) {
                    setShowForm(false);
                    resetForm();
                  } else {
                    openNewModal();
                  }
                }}
                className="btn-primary flex items-center gap-2 w-fit shadow-xs cursor-pointer"
              >
                {showForm ? <X size={16} /> : <Plus size={16} />}
                <span>
                  {showForm
                    ? 'Cerrar Formulario'
                    : `Nuevo ${tab === 'users' ? 'Usuario' : tab === 'roles' ? 'Rol' : 'Agente'}`}
                </span>
              </button>
            </div>

            <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
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
                  className="btn-secondary flex items-center gap-2 cursor-pointer"
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
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="btn-secondary flex items-center gap-2 cursor-pointer"
                >
                  <Download size={16} />
                  Exportar PDF
                </button>
              </div>
            </div>

            {/* Formulario Inline */}
            {showForm && (
              <UserInlineForm
                tab={tab}
                editingUser={editingUser}
                editingRole={editingRole}
                editingAgent={editingAgent}
                formNombre={formNombre}
                setFormNombre={setFormNombre}
                formCorreo={formCorreo}
                setFormCorreo={setFormCorreo}
                formTelefono={formTelefono}
                setFormTelefono={setFormTelefono}
                formPassword={formPassword}
                setFormPassword={setFormPassword}
                formComision={formComision}
                setFormComision={setFormComision}
                formRol={formRol}
                setFormRol={setFormRol}
                formDescRol={formDescRol}
                setFormDescRol={setFormDescRol}
                formCodigoRol={formCodigoRol}
                setFormCodigoRol={setFormCodigoRol}
                formTemplateRol={formTemplateRol}
                setFormTemplateRol={setFormTemplateRol}
                roles={roles}
                saving={saving}
                onClose={() => {
                  setShowForm(false);
                  resetForm();
                }}
                onSave={() => {
                  if (tab === 'users') void handleCreateUser();
                  else if (tab === 'agents') void handleSaveAgent();
                  else if (tab === 'roles') void handleSaveRole();
                }}
              />
            )}

            {tab === 'users' && (
              <UsersTable
                usuarios={usuarios}
                roles={roles}
                loading={loading}
                onView={(u) => setViewingUser(u)}
                onEdit={(u) => openEditUser(u)}
                onDelete={(u) => void handleDeleteUser(u)}
                onToggleActive={async (u) => {
                  try {
                    await alternarActivo(u.id, !u.activo);
                    toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Error');
                  }
                }}
              />
            )}

            {tab === 'roles' && (
              <RolesTable
                roles={roles}
                usuarios={usuarios}
                loadingRoles={loadingRoles}
                rolesError={rolesError}
                countPermissions={countPermissions}
                onEditRole={(r) => openEditRole(r)}
                onDeleteRole={(r) => void handleDeleteRole(r)}
              />
            )}

            {tab === 'agents' && (
              <AgentsTable
                agentes={agentes}
                loadingAgentes={loadingAgentes}
                onView={(a) => setViewingAgent(a)}
                onEdit={(a) => openEditAgent(a)}
                onDelete={(a) => {
                  if (!confirm(`¿Eliminar agente "${a.nombre}"?`)) return;
                  void eliminarAgente(a.id)
                    .then(() => toast.success('Agente eliminado'))
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'));
                }}
                onToggleActive={(a) =>
                  void alternarActivoAgente(a.id, !a.activo).then(() =>
                    toast.success(a.activo ? 'Agente desactivado' : 'Agente activado')
                  )
                }
              />
            )}
          </>
        )}
      </div>

      <UserDetailModal user={viewingUser} roles={roles} onClose={() => setViewingUser(null)} />
      <AgentDetailModal
        agent={viewingAgent}
        onClose={() => setViewingAgent(null)}
        onEdit={(a) => openEditAgent(a)}
      />
    </AppLayout>
  );
}
