import React from 'react';
import { Eye, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Perfil, Rol } from '@/types/database';
import { ROL_DB_A_UI } from '@/services/auth.service';
import { InlineLoader, TableRowSkeleton } from '@/components/ui/LoadingSkeleton';

interface UsersTableProps {
  usuarios: Perfil[];
  roles: Rol[];
  loading: boolean;
  onView: (user: Perfil) => void;
  onEdit: (user: Perfil) => void;
  onDelete: (user: Perfil) => void;
  onToggleActive: (user: Perfil) => void;
}

export function UsersTable({
  usuarios,
  roles,
  loading,
  onView,
  onEdit,
  onDelete,
  onToggleActive,
}: UsersTableProps) {
  return (
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
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Ver usuario"
                        onClick={() => onView(user)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Editar usuario"
                        onClick={() => onEdit(user)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors cursor-pointer"
                        title="Eliminar usuario"
                        onClick={() => onDelete(user)}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() => onToggleActive(user)}
                        title={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
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
  );
}
