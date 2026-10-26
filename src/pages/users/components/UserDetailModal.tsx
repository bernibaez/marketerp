import React from 'react';
import { Users } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import type { Perfil, Rol } from '@/types/database';
import { ROL_DB_A_UI } from '@/services/auth.service';

interface UserDetailModalProps {
  user: Perfil | null;
  roles: Rol[];
  onClose: () => void;
}

export function UserDetailModal({ user, roles, onClose }: UserDetailModalProps) {
  return (
    <ModalShell open={!!user} onClose={onClose} size="md" className="p-6">
      {user && (
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
                {user.nombre_completo.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-foreground">{user.nombre_completo}</p>
                <p className="text-xs text-muted-foreground">{user.correo}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-secondary/30 rounded-xl p-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Teléfono</span>
                <span className="font-medium text-foreground">{user.telefono || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Rol</span>
                <span className="badge-info">
                  {roles.find((r) => r.codigo === user.rol || r.nombre === user.rol)?.nombre ||
                    ROL_DB_A_UI[user.rol] ||
                    user.rol}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Estado</span>
                <span className={user.activo ? 'badge-success' : 'badge-danger'}>
                  {user.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Código acceso</span>
                <span className="font-mono">{user.codigo_acceso || '—'}</span>
              </div>
              {user.creado_en && (
                <div className="col-span-2">
                  <span className="text-muted-foreground block">Creado</span>
                  <span>{new Date(user.creado_en).toLocaleString('es-DO')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button type="button" className="btn-primary cursor-pointer" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
