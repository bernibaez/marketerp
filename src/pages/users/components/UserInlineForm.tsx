import React from 'react';
import { UserCheck, X, CheckCircle } from 'lucide-react';
import type { Perfil, Rol, AgenteComercial } from '@/types/database';

interface UserInlineFormProps {
  tab: 'users' | 'roles' | 'agents';
  editingUser: Perfil | null;
  editingRole: Rol | null;
  editingAgent: AgenteComercial | null;
  formNombre: string;
  setFormNombre: (v: string) => void;
  formCorreo: string;
  setFormCorreo: (v: string) => void;
  formTelefono: string;
  setFormTelefono: (v: string) => void;
  formPassword: string;
  setFormPassword: (v: string) => void;
  formComision: string;
  setFormComision: (v: string) => void;
  formRol: string;
  setFormRol: (v: string) => void;
  formDescRol: string;
  setFormDescRol: (v: string) => void;
  formCodigoRol: string;
  setFormCodigoRol: (v: string) => void;
  formTemplateRol: string;
  setFormTemplateRol: (v: string) => void;
  roles: Rol[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function UserInlineForm({
  tab,
  editingUser,
  editingRole,
  editingAgent,
  formNombre,
  setFormNombre,
  formCorreo,
  setFormCorreo,
  formTelefono,
  setFormTelefono,
  formPassword,
  setFormPassword,
  formComision,
  setFormComision,
  formRol,
  setFormRol,
  formDescRol,
  setFormDescRol,
  formCodigoRol,
  setFormCodigoRol,
  formTemplateRol,
  setFormTemplateRol,
  roles,
  saving,
  onClose,
  onSave,
}: UserInlineFormProps) {
  return (
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
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
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
              className="input-field w-full cursor-pointer"
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
                  className="input-field w-full text-xs cursor-pointer"
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
          className="btn-secondary text-xs py-2 px-4 cursor-pointer"
          disabled={saving}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary text-xs font-bold py-2 px-5 flex items-center gap-1.5 shadow-sm cursor-pointer"
          disabled={saving}
          onClick={onSave}
        >
          <CheckCircle size={15} />
          <span>{saving ? 'Guardando…' : 'Guardar'}</span>
        </button>
      </div>
    </div>
  );
}
