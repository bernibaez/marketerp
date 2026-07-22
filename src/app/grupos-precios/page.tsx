'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Layers, Plus, Search, Trash2, Users, Percent, ChevronDown, ChevronUp } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

interface PriceGroup {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
  contacts?: { id: string }[];
}

interface GroupFormProps { onClose: () => void; onSaved: () => void; }

function GroupForm({ onClose, onSaved }: GroupFormProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', discount_percent: '' });

  const handleSave = async () => {
    if (!formData.name) { setError('El nombre es requerido'); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('price_groups').insert({
      name: formData.name, description: formData.description || null,
      discount_percent: Number(formData.discount_percent) || 0, is_active: true,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); onSaved();
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Nuevo Grupo de Precios</h1><p className="text-sm text-muted-foreground mt-1">Crear lista de precios personalizada</p></div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
      <div className="card p-5 space-y-4 max-w-lg">
        <h3 className="font-semibold text-foreground">Información del Grupo</h3>
        <div className="space-y-4">
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del Grupo *</label><input className="input-field" placeholder="Ej: Precio Mayorista" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Descuento (%)</label><input type="number" min={0} max={100} className="input-field" placeholder="15" value={formData.discount_percent} onChange={e => setFormData(f => ({ ...f, discount_percent: e.target.value }))} /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label><textarea className="input-field resize-none" rows={2} placeholder="Descripción del grupo de precios..." value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Crear Grupo'}</button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function GruposPreciosPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from('price_groups').select('*, contacts(id)').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setGroups(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('price_groups').delete().eq('id', id);
    if (error) setError(error.message);
    else setGroups(prev => prev.filter(g => g.id !== id));
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('price_groups').update({ is_active: !current }).eq('id', id);
    if (error) setError(error.message);
    else setGroups(prev => prev.map(g => g.id === id ? { ...g, is_active: !current } : g));
  };

  const colorMap = ['bg-primary/10 text-primary', 'bg-warning/10 text-warning', 'bg-success/10 text-success', 'bg-info/10 text-info', 'bg-secondary text-muted-foreground'];

  if (showForm) {
    return <AppLayout currentPath={pathname}><GroupForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Layers size={24} className="text-primary" />Grupos de Precios</h1>
            <p className="text-sm text-muted-foreground mt-1">Listas de precios personalizadas por tipo de cliente</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Nuevo Grupo</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Grupos Activos', value: groups.filter(g => g.is_active).length, icon: <Layers size={18} />, color: 'text-primary' },
            { label: 'Clientes Asignados', value: groups.reduce((s, g) => s + (g.contacts?.length || 0), 0), icon: <Users size={18} />, color: 'text-info' },
            { label: 'Mayor Descuento', value: groups.length > 0 ? `${Math.max(...groups.map(g => g.discount_percent))}%` : '0%', icon: <Percent size={18} />, color: 'text-success' },
            { label: 'Total Grupos', value: groups.length, icon: <Layers size={18} />, color: 'text-muted-foreground' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-muted-foreground">{s.label}</span><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input-field pl-9" placeholder="Buscar grupos de precios..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="card p-8 text-center text-muted-foreground">Cargando grupos de precios...</div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="card p-8 text-center text-muted-foreground">No hay grupos de precios</div>
            ) : filtered.map((g, idx) => (
              <div key={g.id} className="card overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[idx % colorMap.length]}`}><Layers size={18} /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{g.name}</p>
                        {!g.is_active && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Inactivo</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{g.description || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-foreground">-{g.discount_percent}%</p>
                      <p className="text-xs text-muted-foreground">Descuento</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold text-foreground">{g.contacts?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors" onClick={e => { e.stopPropagation(); handleDelete(g.id); }}><Trash2 size={14} /></button>
                      {expandedGroup === g.id ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>
                </div>
                {expandedGroup === g.id && (
                  <div className="border-t border-border p-4">
                    <p className="text-sm text-muted-foreground">Descuento aplicado: <span className="font-semibold text-foreground">{g.discount_percent}%</span> sobre el precio base de todos los productos.</p>
                    <p className="text-xs text-muted-foreground mt-2">Clientes asignados: {g.contacts?.length || 0}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
