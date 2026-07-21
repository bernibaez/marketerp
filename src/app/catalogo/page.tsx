'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { BookOpen, Plus, Search, Edit2, Trash2, Tag, Award, Ruler, Package, ToggleLeft, ToggleRight } from 'lucide-react';

interface Category {
  id: number; name: string; slug: string; parent: string | null; productCount: number; active: boolean; color: string;
}
interface Brand {
  id: number; name: string; country: string; productCount: number; active: boolean; description: string;
}
interface Unit {
  id: number; name: string; abbreviation: string; type: 'weight' | 'volume' | 'length' | 'unit' | 'area'; productCount: number; active: boolean;
}

const mockCategories: Category[] = [
  { id: 1, name: 'Lácteos', slug: 'lacteos', parent: null, productCount: 45, active: true, color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: 'Panadería', slug: 'panaderia', parent: null, productCount: 32, active: true, color: 'bg-amber-100 text-amber-700' },
  { id: 3, name: 'Bebidas', slug: 'bebidas', parent: null, productCount: 78, active: true, color: 'bg-cyan-100 text-cyan-700' },
  { id: 4, name: 'Bebidas Gaseosas', slug: 'bebidas-gaseosas', parent: 'Bebidas', productCount: 28, active: true, color: 'bg-cyan-100 text-cyan-700' },
  { id: 5, name: 'Jugos y Néctares', slug: 'jugos-nectares', parent: 'Bebidas', productCount: 22, active: true, color: 'bg-cyan-100 text-cyan-700' },
  { id: 6, name: 'Carnes y Embutidos', slug: 'carnes', parent: null, productCount: 56, active: true, color: 'bg-red-100 text-red-700' },
  { id: 7, name: 'Granos y Cereales', slug: 'granos', parent: null, productCount: 41, active: true, color: 'bg-yellow-100 text-yellow-700' },
  { id: 8, name: 'Limpieza del Hogar', slug: 'limpieza', parent: null, productCount: 63, active: true, color: 'bg-green-100 text-green-700' },
  { id: 9, name: 'Cuidado Personal', slug: 'cuidado-personal', parent: null, productCount: 89, active: true, color: 'bg-pink-100 text-pink-700' },
  { id: 10, name: 'Congelados', slug: 'congelados', parent: null, productCount: 34, active: false, color: 'bg-indigo-100 text-indigo-700' },
];

const mockBrands: Brand[] = [
  { id: 1, name: 'Nestlé', country: 'Suiza', productCount: 85, active: true, description: 'Multinacional de alimentos y bebidas' },
  { id: 2, name: 'Colgate', country: 'EE.UU.', productCount: 23, active: true, description: 'Productos de higiene oral y personal' },
  { id: 3, name: 'Procter & Gamble', country: 'EE.UU.', productCount: 67, active: true, description: 'Bienes de consumo masivo' },
  { id: 4, name: 'Unilever', country: 'Reino Unido', productCount: 54, active: true, description: 'Alimentos, bebidas y cuidado personal' },
  { id: 5, name: 'Rica', country: 'Rep. Dominicana', productCount: 38, active: true, description: 'Productos lácteos dominicanos' },
  { id: 6, name: 'Bohio', country: 'Rep. Dominicana', productCount: 29, active: true, description: 'Alimentos procesados locales' },
  { id: 7, name: 'Presidente', country: 'Rep. Dominicana', productCount: 12, active: true, description: 'Cerveza y bebidas' },
  { id: 8, name: 'Kellogg\'s', country: 'EE.UU.', productCount: 18, active: false, description: 'Cereales y snacks' },
];

const mockUnits: Unit[] = [
  { id: 1, name: 'Unidad', abbreviation: 'und', type: 'unit', productCount: 245, active: true },
  { id: 2, name: 'Kilogramo', abbreviation: 'kg', type: 'weight', productCount: 89, active: true },
  { id: 3, name: 'Gramo', abbreviation: 'g', type: 'weight', productCount: 67, active: true },
  { id: 4, name: 'Libra', abbreviation: 'lb', type: 'weight', productCount: 54, active: true },
  { id: 5, name: 'Litro', abbreviation: 'L', type: 'volume', productCount: 78, active: true },
  { id: 6, name: 'Mililitro', abbreviation: 'mL', type: 'volume', productCount: 43, active: true },
  { id: 7, name: 'Galón', abbreviation: 'gal', type: 'volume', productCount: 12, active: true },
  { id: 8, name: 'Caja', abbreviation: 'caja', type: 'unit', productCount: 156, active: true },
  { id: 9, name: 'Docena', abbreviation: 'doc', type: 'unit', productCount: 34, active: true },
  { id: 10, name: 'Metro', abbreviation: 'm', type: 'length', productCount: 8, active: false },
];

type Tab = 'categories' | 'brands' | 'units';

const unitTypeConfig = {
  weight: { label: 'Peso', cls: 'bg-amber-100 text-amber-700' },
  volume: { label: 'Volumen', cls: 'bg-blue-100 text-blue-700' },
  length: { label: 'Longitud', cls: 'bg-green-100 text-green-700' },
  unit: { label: 'Unidad', cls: 'bg-purple-100 text-purple-700' },
  area: { label: 'Área', cls: 'bg-red-100 text-red-700' },
};

interface InlineFormProps { type: Tab; onClose: () => void; }

function InlineForm({ type, onClose }: InlineFormProps) {
  const titles = { categories: 'Nueva Categoría', brands: 'Nueva Marca', units: 'Nueva Unidad de Medida' };
  return (
    <div className="card p-5 space-y-4 border-2 border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{titles[type]}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
      </div>
      {type === 'categories' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
            <input className="input-field" placeholder="Ej: Lácteos" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría Padre</label>
            <select className="input-field"><option>Sin categoría padre</option>{mockCategories.filter(c => !c.parent).map(c => <option key={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
            <input className="input-field" placeholder="Descripción de la categoría..." />
          </div>
        </div>
      )}
      {type === 'brands' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre de la Marca *</label>
            <input className="input-field" placeholder="Ej: Nestlé" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">País de Origen</label>
            <input className="input-field" placeholder="Ej: Suiza" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
            <input className="input-field" placeholder="Descripción de la marca..." />
          </div>
        </div>
      )}
      {type === 'units' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
            <input className="input-field" placeholder="Ej: Kilogramo" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Abreviación *</label>
            <input className="input-field" placeholder="Ej: kg" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <select className="input-field">
              <option value="unit">Unidad</option>
              <option value="weight">Peso</option>
              <option value="volume">Volumen</option>
              <option value="length">Longitud</option>
              <option value="area">Área</option>
            </select>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button className="btn-primary">Guardar</button>
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
      </div>
    </div>
  );
}

export default function CatalogoPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('categories');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredCats = mockCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const filteredBrands = mockBrands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.country.toLowerCase().includes(search.toLowerCase()));
  const filteredUnits = mockUnits.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.abbreviation.toLowerCase().includes(search.toLowerCase()));

  const tabConfig = [
    { key: 'categories' as Tab, label: 'Categorías', icon: <Tag size={15} />, count: mockCategories.length },
    { key: 'brands' as Tab, label: 'Marcas', icon: <Award size={15} />, count: mockBrands.length },
    { key: 'units' as Tab, label: 'Unidades de Medida', icon: <Ruler size={15} />, count: mockUnits.length },
  ];

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen size={24} className="text-primary" />
              Catálogo de Productos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Categorías, marcas y unidades de medida</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo {tab === 'categories' ? 'Categoría' : tab === 'brands' ? 'Marca' : 'Unidad'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Categorías', value: mockCategories.filter(c => c.active).length, total: mockCategories.length, icon: <Tag size={18} />, color: 'text-primary' },
            { label: 'Marcas', value: mockBrands.filter(b => b.active).length, total: mockBrands.length, icon: <Award size={18} />, color: 'text-info' },
            { label: 'Unidades', value: mockUnits.filter(u => u.active).length, total: mockUnits.length, icon: <Ruler size={18} />, color: 'text-success' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.total} en total</p>
            </div>
          ))}
        </div>

        {/* Inline Form */}
        {showForm && <InlineForm type={tab} onClose={() => setShowForm(false)} />}

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-border">
            {tabConfig.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false); setSearch(''); }}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.icon} {t.label}
                <span className="bg-secondary text-muted-foreground text-xs rounded-full px-1.5 py-0.5">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder={`Buscar ${tab === 'categories' ? 'categorías' : tab === 'brands' ? 'marcas' : 'unidades'}...`} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            {tab === 'categories' && (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Nombre', 'Categoría Padre', 'Productos', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCats.map(c => (
                    <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.parent ?? <span className="text-xs italic">Raíz</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Package size={13} />
                          <span>{c.productCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.active ? 'text-success' : 'text-muted-foreground'}`}>
                          {c.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {c.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'brands' && (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Marca', 'País', 'Descripción', 'Productos', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBrands.map(b => (
                    <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{b.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.country}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{b.description}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Package size={13} />
                          <span>{b.productCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${b.active ? 'text-success' : 'text-muted-foreground'}`}>
                          {b.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {b.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'units' && (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Nombre', 'Abreviación', 'Tipo', 'Productos', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUnits.map(u => (
                    <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-primary">{u.abbreviation}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${unitTypeConfig[u.type].cls}`}>{unitTypeConfig[u.type].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Package size={13} />
                          <span>{u.productCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.active ? 'text-success' : 'text-muted-foreground'}`}>
                          {u.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {u.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
