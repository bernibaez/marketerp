'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Tag, Plus, Search, Trash2, ToggleLeft, ToggleRight, Percent, Calendar, Users } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';
import { createClient } from '@/lib/supabase/client';

interface Discount {
  id: string;
  code: string;
  name: string;
  discount_type: string;
  value: number;
  min_purchase: number | null;
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

const typeConfig: Record<string, { label: string; cls: string }> = {
  percent: { label: 'Porcentaje', cls: 'bg-primary/10 text-primary' },
  fixed: { label: 'Monto Fijo', cls: 'bg-info/10 text-info' },
  buy_x_get_y: { label: 'Compra X Lleva Y', cls: 'bg-success/10 text-success' },
};

interface DiscountFormProps { onClose: () => void; onSaved: () => void; }

function DiscountForm({ onClose, onSaved }: DiscountFormProps) {
  const supabase = createClient();
  const [discountType, setDiscountType] = useState<string>('percent');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', value: '', min_purchase: '', max_uses: '', valid_from: '', valid_until: '' });

  const handleSave = async () => {
    if (!formData.name || !formData.value) { setError('Nombre y valor son requeridos'); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('discounts').insert({
      name: formData.name, code: formData.code || `DESC-${Date.now().toString().slice(-5)}`,
      discount_type: discountType, value: Number(formData.value),
      min_purchase: formData.min_purchase ? Number(formData.min_purchase) : 0,
      max_uses: formData.max_uses ? Number(formData.max_uses) : null,
      valid_from: formData.valid_from || null, valid_until: formData.valid_until || null,
      is_active: true,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); onSaved();
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Nuevo Descuento</h1><p className="text-sm text-muted-foreground mt-1">Crear regla de descuento o código promocional</p></div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label><input className="input-field" placeholder="Ej: Descuento Enero 20%" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Código Promocional</label><input className="input-field" placeholder="Ej: ENERO20" value={formData.code} onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo *</label>
                <select className="input-field" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo (RD$)</option>
                  <option value="buy_x_get_y">Compra X Lleva Y</option>
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Valor *</label><input type="number" className="input-field" placeholder={discountType === 'percent' ? '10' : '200'} value={formData.value} onChange={e => setFormData(f => ({ ...f, value: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Compra Mínima (RD$)</label><input type="number" className="input-field" placeholder="0" value={formData.min_purchase} onChange={e => setFormData(f => ({ ...f, min_purchase: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Máximo de Usos (0 = ilimitado)</label><input type="number" className="input-field" placeholder="0" value={formData.max_uses} onChange={e => setFormData(f => ({ ...f, max_uses: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Inicio</label><input type="date" className="input-field" value={formData.valid_from} onChange={e => setFormData(f => ({ ...f, valid_from: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Vencimiento</label><input type="date" className="input-field" value={formData.valid_until} onChange={e => setFormData(f => ({ ...f, valid_until: e.target.value }))} /></div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Vista Previa</h3>
            <div className="bg-secondary/50 rounded-xl p-4 text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto"><Percent size={24} className="text-primary" /></div>
              <p className="font-bold text-foreground text-lg">{formData.value ? `${formData.value}${discountType === 'percent' ? '%' : ' RD$'} OFF` : '—'}</p>
              <p className="text-xs text-muted-foreground">Código: {formData.code || '—'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">{saving ? 'Guardando...' : 'Crear Descuento'}</button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DescuentosPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from('discounts').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setDiscounts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = discounts.filter(d => {
    const matchSearch = d.code.toLowerCase().includes(search.toLowerCase()) || d.name.toLowerCase().includes(search.toLowerCase());
    const matchActive = activeFilter === 'all' || (activeFilter === 'active' ? d.is_active : !d.is_active);
    return matchSearch && matchActive;
  });

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('discounts').update({ is_active: !current }).eq('id', id);
    if (error) setError(error.message);
    else setDiscounts(prev => prev.map(d => d.id === id ? { ...d, is_active: !current } : d));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('discounts').delete().eq('id', id);
    if (error) setError(error.message);
    else setDiscounts(prev => prev.filter(d => d.id !== id));
  };

  if (showForm) {
    return <AppLayout currentPath={pathname}><DiscountForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Tag size={24} className="text-primary" />Descuentos y Promociones</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de códigos promocionales y reglas de descuento</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> Nuevo Descuento</button>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Descuentos', value: discounts.length, icon: <Tag size={18} />, color: 'text-primary' },
            { label: 'Activos', value: discounts.filter(d => d.is_active).length, icon: <ToggleRight size={18} />, color: 'text-success' },
            { label: 'Usos Totales', value: discounts.reduce((s, d) => s + d.uses_count, 0), icon: <Users size={18} />, color: 'text-info' },
            { label: 'Inactivos', value: discounts.filter(d => !d.is_active).length, icon: <Calendar size={18} />, color: 'text-warning' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-muted-foreground">{s.label}</span><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
            <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="input-field pl-9" placeholder="Buscar por código o nombre..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando descuentos...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50"><tr>
                  {['Código', 'Nombre', 'Tipo', 'Valor', 'Compra Mín.', 'Usos', 'Vigencia', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No hay descuentos</td></tr>
                  ) : filtered.map(d => (
                    <tr key={d.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{d.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{d.name}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig[d.discount_type]?.cls || 'bg-secondary text-muted-foreground'}`}>{typeConfig[d.discount_type]?.label || d.discount_type}</span></td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{d.discount_type === 'percent' ? `${d.value}%` : `RD$ ${formatNumber(d.value)}`}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.min_purchase && d.min_purchase > 0 ? `RD$ ${formatNumber(d.min_purchase)}` : 'Sin mínimo'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.uses_count}{d.max_uses ? `/${d.max_uses}` : ''}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{d.valid_from || '—'} → {d.valid_until || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(d.id, d.is_active)} className="flex items-center gap-1.5 text-xs font-medium transition-colors">
                          {d.is_active ? <><ToggleRight size={18} className="text-success" /><span className="text-success">Activo</span></> : <><ToggleLeft size={18} className="text-muted-foreground" /><span className="text-muted-foreground">Inactivo</span></>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
