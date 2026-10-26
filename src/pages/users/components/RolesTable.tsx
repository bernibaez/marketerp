import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Sliders, Edit2, Trash2, AlertTriangle, Lightbulb } from 'lucide-react';
import type { Perfil, Rol } from '@/types/database';
import { isMissingRolesTableError } from '@/services/roles.service';

interface RolesTableProps {
  roles: Rol[];
  usuarios: Perfil[];
  loadingRoles: boolean;
  rolesError: string | null;
  countPermissions: (permisos: Record<string, Record<string, boolean>> | null | undefined) => number;
  onEditRole: (role: Rol) => void;
  onDeleteRole: (role: Rol) => void;
}

export function RolesTable({
  roles,
  usuarios,
  loadingRoles,
  rolesError,
  countPermissions,
  onEditRole,
  onDeleteRole,
}: RolesTableProps) {
  return (
    <div className="space-y-4">
      {rolesError && isMissingRolesTableError(rolesError) && (
        <div className="card border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span>Sincronización remota pendiente — Tabla "roles" en Supabase</span>
          </div>
          <p>{rolesError}</p>
          <p className="font-medium flex items-center">
            <Lightbulb size={16} className="text-amber-500 inline mr-1.5 shrink-0" />
            <span>
              <strong>Instrucciones:</strong> Abre tu panel de Supabase → <strong>SQL Editor</strong>, pega el contenido de{' '}
              <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono">
                supabase/migrations/008_crear_tabla_roles.sql
              </code>{' '}
              y haz clic en <strong>Run</strong>.
            </span>
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
            <p className="text-xs text-muted-foreground">
              Configura los accesos y permisos por módulo para todos los usuarios y roles del sistema.
            </p>
          </div>
        </div>
        <Link
          to="/settings?section=permissions"
          className="btn-primary text-xs py-2 px-4 flex items-center gap-2 flex-shrink-0 shadow-sm"
        >
          <Sliders size={15} />
          <span>Abrir Matriz de Permisos</span>
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
                            onClick={() => onEditRole(role)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Editar rol"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={role.codigo === 'admin'}
                            onClick={() => void onDeleteRole(role)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors disabled:opacity-30 cursor-pointer"
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
  );
}
