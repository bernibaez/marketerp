'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Users, Truck, Tag, Plus, Search, Filter, Edit2, Trash2, Download, Eye, Phone, CreditCard } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Contact {
  id: string;
  type: 'cliente' | 'proveedor' | 'ambos';
  name: string;
  rnc: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  credit_limit: number | null;
  balance: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface PriceGroup {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  is_active: boolean;
}

type Tab = 'customers' | 'suppliers' | 'groups';

function InitialAvatar({ name, color = 'info' }: { name: string; color?: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  const colorMap: Record<string, string> = {
    info: 'bg-info/20 text-info',
    warning: 'bg-warning/20 text-warning',
    primary: 'bg-primary/20 text-primary',
    success: 'bg-success/20 text-success',
  };
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${colorMap[color] ?? colorMap.info}`}>
      {initials}
    </div>
  );
}

export default function ContactsPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('customers');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', type: 'cliente' as 'cliente' | 'proveedor' | 'ambos' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const [contactsRes, groupsRes] = await Promise.all([
        supabase.from('contacts').select('*').order('name'),
        supabase.from('price_groups').select('*').order('name'),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      setContacts(contactsRes.data || []);
      setPriceGroups(groupsRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const customers = contacts.filter(c => c.type === 'cliente' || c.type === 'ambos');
  const suppliers = contacts.filter(c => c.type === 'proveedor' || c.type === 'ambos');

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search)
  );
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('contacts').insert({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        type: form.type,
      });
      if (err) throw err;
      setShowModal(false);
      setForm({ name: '', phone: '', email: '', address: '', type: 'cliente' });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('contacts').delete().eq('id', id);
    fetchData();
  };

  const tabs = [
    { id: 'customers' as Tab, label: 'Clientes', icon: <Users size={16} /> },
    { id: 'suppliers' as Tab, label: 'Proveedores', icon: <Truck size={16} /> },
    { id: 'groups' as Tab, label: 'Grupos de Precio', icon: <Tag size={16} /> },
  ];

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contactos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona clientes, proveedores y grupos</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} /> Nuevo {tab === 'customers' ? 'Cliente' : tab === 'suppliers' ? 'Proveedor' : 'Grupo'}
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-danger/10 text-danger text-sm">{error}</div>}

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {tab === 'customers' && <>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Total Clientes</p><p className="text-2xl font-bold text-foreground mt-1">{customers.length}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Activos</p><p className="text-2xl font-bold text-success mt-1">{customers.filter(c => c.is_active).length}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Crédito Total</p><p className="text-2xl font-bold text-info mt-1">RD$ {formatNumber(customers.reduce((s, c) => s + (c.credit_limit ?? 0), 0))}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Saldo Pendiente</p><p className="text-2xl font-bold text-warning mt-1">RD$ {formatNumber(customers.reduce((s, c) => s + (c.balance ?? 0), 0))}</p></div>
          </>}
          {tab === 'suppliers' && <>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Total Proveedores</p><p className="text-2xl font-bold text-foreground mt-1">{suppliers.length}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Activos</p><p className="text-2xl font-bold text-success mt-1">{suppliers.filter(s => s.is_active).length}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Saldo por pagar</p><p className="text-2xl font-bold text-warning mt-1">RD$ {formatNumber(suppliers.reduce((s, c) => s + (c.balance ?? 0), 0))}</p></div>
          </>}
          {tab === 'groups' && <>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Total Grupos</p><p className="text-2xl font-bold text-foreground mt-1">{priceGroups.length}</p></div>
            <div className="card p-4"><p className="text-xs text-muted-foreground">Activos</p><p className="text-2xl font-bold text-success mt-1">{priceGroups.filter(g => g.is_active).length}</p></div>
          </>}
        </div>

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

        {loading && (
          <div className="card p-12 text-center text-muted-foreground">
            <Users size={40} className="mx-auto mb-3 opacity-30 animate-pulse" />
            <p>Cargando contactos...</p>
          </div>
        )}

        {/* Customers Table */}
        {!loading && tab === 'customers' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Crédito</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden xl:table-cell">Saldo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c, i) => (
                    <tr key={c.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <InitialAvatar name={c.name} color="info" />
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <Phone size={10} />{c.phone ?? '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground"><CreditCard size={12} />RD$ {formatNumber(c.credit_limit ?? 0)}</div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={(c.balance ?? 0) > 0 ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                          {(c.balance ?? 0) > 0 ? `RD$ ${formatNumber(c.balance ?? 0)}` : 'Al día'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className={c.is_active ? 'badge-success' : 'badge-danger'}>{c.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron clientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
              <span>Mostrando {filteredCustomers.length} de {customers.length} clientes</span>
            </div>
          </div>
        )}

        {/* Suppliers Table */}
        {!loading && tab === 'suppliers' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Saldo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s, i) => (
                    <tr key={s.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <InitialAvatar name={s.name} color="warning" />
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.phone ?? s.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={(s.balance ?? 0) > 0 ? 'text-warning font-semibold' : 'text-success font-semibold'}>
                          {(s.balance ?? 0) > 0 ? `RD$ ${formatNumber(s.balance ?? 0)}` : 'Al día'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className={s.is_active ? 'badge-success' : 'badge-danger'}>{s.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No se encontraron proveedores</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Groups Table */}
        {!loading && tab === 'groups' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Grupo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Descripción</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Descuento</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {priceGroups.map((g, i) => (
                    <tr key={g.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-semibold text-foreground">{g.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">{g.description ?? '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-info">{g.discount_percent}%</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className={g.is_active ? 'badge-success' : 'badge-danger'}>{g.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {priceGroups.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron grupos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 fade-in" onClick={() => setShowModal(false)}>
          <div className="card p-6 w-full max-w-md mx-4 slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-4">
              Nuevo {tab === 'customers' ? 'Cliente' : tab === 'suppliers' ? 'Proveedor' : 'Grupo'}
            </h2>
            <div className="space-y-3">
              {tab !== 'groups' ? <>
                <input className="input-field" placeholder="Nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className="input-field" placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className="input-field" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <input className="input-field" placeholder="Dirección" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                <input type="hidden" value={tab === 'customers' ? 'cliente' : 'proveedor'} />
              </> : <>
                <p className="text-sm text-muted-foreground">Los grupos de precio se gestionan desde la sección de Grupos de Precios.</p>
              </>}
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              {tab !== 'groups' && (
                <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || !form.name}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
