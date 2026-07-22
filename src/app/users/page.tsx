'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Users, Shield, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

type Tab = 'users' | 'roles';

export default function UsersPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ full_name: '', email: '', role: 'cajero', phone: '' });

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('roles').select('*').order('name'),
      ]);
      if (usersRes.error) setError(usersRes.error.message);
      else setUsers(usersRes.data || []);
      if (rolesRes.data) setRoles(rolesRes.data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUserActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('user_profiles').update({ is_active: !current }).eq('id', id);
    if (error) setError(error.message);
    else setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u));
  };

  const tabs = [
    { id: 'users' as Tab, label: 'Usuarios', icon: <Users size={16} /> },
    { id: 'roles' as Tab, label: 'Roles', icon: <Shield size={16} /> },
  ];

  const roleColors: Record<string, string> = {
    admin: 'badge-danger',
    cajero: 'badge-info',
    vendedor: 'badge-success',
    almacenista: 'badge-warning',
    contador: 'bg-purple-100 text-purple-700',
    supervisor: 'badge-info',
  };

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-1">Administra usuarios y roles del sistema</p>
          </div>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {tab === 'users' && (
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando usuarios...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Creado</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay usuarios</td></tr>
                    ) : filteredUsers.map((user, i) => (
                      <tr key={user.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.full_name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[user.role] || 'badge-info'}`}>{user.role}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{user.phone || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{user.created_at?.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <span className={user.is_active ? 'badge-success' : 'badge-danger'}>{user.is_active ? 'Activo' : 'Inactivo'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => toggleUserActive(user.id, user.is_active)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                              {user.is_active ? <ToggleRight size={14} className="text-success" /> : <ToggleLeft size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Mostrando {filteredUsers.length} de {users.length} usuarios</span>
            </div>
          </div>
        )}

        {tab === 'roles' && (
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Cargando roles...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Usuarios</th>
                  </tr></thead>
                  <tbody>
                    {filteredRoles.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No hay roles</td></tr>
                    ) : filteredRoles.map((role, i) => (
                      <tr key={role.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{role.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{role.description || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={role.is_system ? 'badge-info' : 'badge-success'}>{role.is_system ? 'Sistema' : 'Personalizado'}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {users.filter(u => u.role === role.name.toLowerCase()).length} usuarios
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
