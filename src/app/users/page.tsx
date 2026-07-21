'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Users, UserCheck, Shield, Plus, Search, Filter, Edit2, Trash2, ToggleLeft, ToggleRight, Download, Eye } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface User {
  id: number; name: string; email: string; role: string; status: 'active' | 'inactive';
  lastLogin: string; phone: string;
}
interface Role {
  id: number; name: string; permissions: number; users: number; description: string;
}
interface Agent {
  id: number; name: string; email: string; phone: string; sales: number; commission: number; status: 'active' | 'inactive';
}

const mockUsers: User[] = [
  { id: 1, name: 'Admin General', email: 'admin@marketerp.do', role: 'Administrador', status: 'active', lastLogin: '2024-01-15 09:30', phone: '809-555-0001' },
  { id: 2, name: 'María García', email: 'maria@marketerp.do', role: 'Cajero', status: 'active', lastLogin: '2024-01-15 08:15', phone: '809-555-0002' },
  { id: 3, name: 'Carlos López', email: 'carlos@marketerp.do', role: 'Vendedor', status: 'active', lastLogin: '2024-01-14 17:45', phone: '809-555-0003' },
  { id: 4, name: 'Ana Martínez', email: 'ana@marketerp.do', role: 'Almacenista', status: 'inactive', lastLogin: '2024-01-10 12:00', phone: '809-555-0004' },
  { id: 5, name: 'Pedro Sánchez', email: 'pedro@marketerp.do', role: 'Contador', status: 'active', lastLogin: '2024-01-15 07:50', phone: '809-555-0005' },
];

const mockRoles: Role[] = [
  { id: 1, name: 'Administrador', permissions: 48, users: 1, description: 'Acceso total al sistema' },
  { id: 2, name: 'Cajero', permissions: 12, users: 3, description: 'Acceso al POS y ventas' },
  { id: 3, name: 'Vendedor', permissions: 8, users: 5, description: 'Gestión de ventas y clientes' },
  { id: 4, name: 'Almacenista', permissions: 10, users: 2, description: 'Gestión de inventario' },
  { id: 5, name: 'Contador', permissions: 15, users: 1, description: 'Acceso a informes y finanzas' },
];

const mockAgents: Agent[] = [
  { id: 1, name: 'Roberto Díaz', email: 'roberto@marketerp.do', phone: '809-555-0010', sales: 145, commission: 8500, status: 'active' },
  { id: 2, name: 'Luisa Fernández', email: 'luisa@marketerp.do', phone: '809-555-0011', sales: 98, commission: 5200, status: 'active' },
  { id: 3, name: 'Miguel Torres', email: 'miguel@marketerp.do', phone: '809-555-0012', sales: 67, commission: 3100, status: 'inactive' },
];

type Tab = 'users' | 'roles' | 'agents';

export default function UsersPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const tabs = [
    { id: 'users' as Tab, label: 'Usuarios', icon: <Users size={16} /> },
    { id: 'roles' as Tab, label: 'Roles', icon: <Shield size={16} /> },
    { id: 'agents' as Tab, label: 'Agentes Comerciales', icon: <UserCheck size={16} /> },
  ];

  const filteredUsers = mockUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-1">Administra usuarios, roles y agentes comerciales</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} /> Nuevo {tab === 'users' ? 'Usuario' : tab === 'roles' ? 'Rol' : 'Agente'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {/* Users Table */}
        {tab === 'users' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Último acceso</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, i) => (
                    <tr key={user.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="badge-info">{user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{user.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{user.lastLogin}</td>
                      <td className="px-4 py-3">
                        <span className={user.status === 'active' ? 'badge-success' : 'badge-danger'}>
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            {user.status === 'active' ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Mostrando {filteredUsers.length} de {mockUsers.length} usuarios</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Anterior</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">1</button>
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Siguiente</button>
              </div>
            </div>
          </div>
        )}

        {/* Roles Table */}
        {tab === 'roles' && (
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
                  {mockRoles.map((role, i) => (
                    <tr key={role.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{role.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{role.description}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-info">{role.permissions} permisos</span></td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{role.users} usuarios</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Agents Table */}
        {tab === 'agents' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Agente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Ventas</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Comisión</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAgents.map((agent, i) => (
                    <tr key={agent.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">{agent.name.charAt(0)}</div>
                          <div>
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{agent.phone}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="font-semibold text-foreground">{agent.sales}</span></td>
                      <td className="px-4 py-3 hidden lg:table-cell text-success font-semibold">RD$ {formatNumber(agent.commission)}</td>
                      <td className="px-4 py-3"><span className={agent.status === 'active' ? 'badge-success' : 'badge-danger'}>{agent.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Simple Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 w-full max-w-md mx-4 slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">
              {tab === 'users' ? 'Nuevo Usuario' : tab === 'roles' ? 'Nuevo Rol' : 'Nuevo Agente'}
            </h2>
            <div className="space-y-3">
              <input className="input-field" placeholder="Nombre completo" />
              <input className="input-field" placeholder="Correo electrónico" type="email" />
              {tab !== 'roles' && <input className="input-field" placeholder="Teléfono" />}
              {tab === 'users' && (
                <select className="input-field">
                  <option>Seleccionar rol...</option>
                  {mockRoles.map(r => <option key={r.id}>{r.name}</option>)}
                </select>
              )}
              {tab === 'users' && <input className="input-field" placeholder="Contraseña" type="password" />}
              {tab === 'roles' && <textarea className="input-field" placeholder="Descripción del rol" rows={3} />}
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
