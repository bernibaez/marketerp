'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Layers, Plus, Search, Edit2, Trash2, Users, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface PriceGroup {
  id: number; name: string; description: string; type: 'percentage' | 'fixed_margin' | 'custom';
  adjustment: number; adjustmentType: 'increase' | 'decrease'; customerCount: number;
  productCount: number; active: boolean; color: string;
}

interface PriceGroupProduct {
  id: number; name: string; sku: string; basePrice: number; groupPrice: number; category: string;
}

const mockGroups: PriceGroup[] = [
  { id: 1, name: 'Precio Mayorista', description: 'Clientes con compras mayores a RD$ 50,000/mes', type: 'percentage', adjustment: 15, adjustmentType: 'decrease', customerCount: 12, productCount: 450, active: true, color: 'bg-primary/10 text-primary' },
  { id: 2, name: 'Precio VIP', description: 'Clientes premium con descuento especial', type: 'percentage', adjustment: 20, adjustmentType: 'decrease', customerCount: 5, productCount: 450, active: true, color: 'bg-warning/10 text-warning' },
  { id: 3, name: 'Precio Distribuidor', description: 'Distribuidores autorizados de la región', type: 'percentage', adjustment: 25, adjustmentType: 'decrease', customerCount: 8, productCount: 380, active: true, color: 'bg-success/10 text-success' },
  { id: 4, name: 'Precio Empleado', description: 'Descuento para empleados de la empresa', type: 'percentage', adjustment: 10, adjustmentType: 'decrease', customerCount: 25, productCount: 450, active: true, color: 'bg-info/10 text-info' },
  { id: 5, name: 'Precio Especial Evento', description: 'Precio temporal para eventos y ferias', type: 'percentage', adjustment: 5, adjustmentType: 'decrease', customerCount: 0, productCount: 120, active: false, color: 'bg-secondary text-muted-foreground' },
];

const mockProducts: PriceGroupProduct[] = [
  { id: 1, name: 'Leche Entera 1L', sku: 'LAC-001', basePrice: 100, groupPrice: 85, category: 'Lácteos' },
  { id: 2, name: 'Pan de Molde Grande', sku: 'PAN-001', basePrice: 150, groupPrice: 127.5, category: 'Panadería' },
  { id: 3, name: 'Aceite Vegetal 1L', sku: 'ACE-001', basePrice: 230, groupPrice: 195.5, category: 'Aceites' },
  { id: 4, name: 'Arroz Selecto 5lb', sku: 'ARR-001', basePrice: 180, groupPrice: 153, category: 'Granos' },
  { id: 5, name: 'Azúcar Blanca 2lb', sku: 'AZU-001', basePrice: 95, groupPrice: 80.75, category: 'Azúcares' },
];

interface GroupFormProps { onClose: () => void; }

function GroupForm({ onClose }: GroupFormProps) {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Grupo de Precios</h1>
          <p className="text-sm text-muted-foreground mt-1">Crear lista de precios personalizada</p>
        </div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información del Grupo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del Grupo *</label>
                <input className="input-field" placeholder="Ej: Precio Mayorista" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Ajuste *</label>
                <select className="input-field">
                  <option value="percentage">Porcentaje sobre precio base</option>
                  <option value="fixed_margin">Margen fijo</option>
                  <option value="custom">Precios personalizados</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Ajuste (%)</label>
                <input type="number" className="input-field" placeholder="15" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección del Ajuste</label>
                <select className="input-field">
                  <option value="decrease">Descuento (reducir precio)</option>
                  <option value="increase">Recargo (aumentar precio)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Descripción del grupo de precios..." />
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Clientes Asignados</h3>
              <button className="btn-secondary text-xs py-1.5 px-3">+ Agregar Clientes</button>
            </div>
            <p className="text-sm text-muted-foreground">No hay clientes asignados a este grupo aún.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Vista Previa de Precios</h3>
            <div className="space-y-2">
              {mockProducts.slice(0, 3).map(p => (
                <div key={p.id} className="flex justify-between items-center text-sm py-1.5 border-b border-border/50">
                  <span className="text-foreground truncate flex-1 mr-2">{p.name}</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground line-through">RD$ {formatNumber(p.basePrice)}</p>
                    <p className="font-semibold text-success">RD$ {formatNumber(p.groupPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full">Crear Grupo</button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GruposPreciosPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(1);

  const filtered = mockGroups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description.toLowerCase().includes(search.toLowerCase())
  );

  if (showForm) {
    return <AppLayout currentPath={pathname}><GroupForm onClose={() => setShowForm(false)} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Layers size={24} className="text-primary" />
              Grupos de Precios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Listas de precios personalizadas por tipo de cliente</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Grupo
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Grupos Activos', value: mockGroups.filter(g => g.active).length, icon: <Layers size={18} />, color: 'text-primary' },
            { label: 'Clientes Asignados', value: mockGroups.reduce((s, g) => s + g.customerCount, 0), icon: <Users size={18} />, color: 'text-info' },
            { label: 'Mayor Descuento', value: `${Math.max(...mockGroups.map(g => g.adjustment))}%`, icon: <Percent size={18} />, color: 'text-success' },
            { label: 'Total Grupos', value: mockGroups.length, icon: <Layers size={18} />, color: 'text-muted-foreground' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input-field pl-9" placeholder="Buscar grupos de precios..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Groups List */}
        <div className="space-y-3">
          {filtered.map(g => (
            <div key={g.id} className="card overflow-hidden">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${g.color}`}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{g.name}</p>
                      {!g.active && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Inactivo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-foreground">
                      {g.adjustmentType === 'decrease' ? '-' : '+'}{g.adjustment}%
                    </p>
                    <p className="text-xs text-muted-foreground">{g.adjustmentType === 'decrease' ? 'Descuento' : 'Recargo'}</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-foreground">{g.customerCount}</p>
                    <p className="text-xs text-muted-foreground">Clientes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}><Edit2 size={14} /></button>
                    <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors" onClick={e => e.stopPropagation()}><Trash2 size={14} /></button>
                    {expandedGroup === g.id ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </div>
                </div>
              </div>
              {expandedGroup === g.id && (
                <div className="border-t border-border">
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Productos con precios ajustados</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Producto</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">SKU</th>
                          <th className="text-left py-2 text-xs text-muted-foreground font-medium">Categoría</th>
                          <th className="text-right py-2 text-xs text-muted-foreground font-medium">Precio Base</th>
                          <th className="text-right py-2 text-xs text-muted-foreground font-medium">Precio Grupo</th>
                          <th className="text-right py-2 text-xs text-muted-foreground font-medium">Ahorro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {mockProducts.map(p => {
                          const groupPrice = g.adjustmentType === 'decrease'
                            ? p.basePrice * (1 - g.adjustment / 100)
                            : p.basePrice * (1 + g.adjustment / 100);
                          const saving = p.basePrice - groupPrice;
                          return (
                            <tr key={p.id} className="hover:bg-secondary/20">
                              <td className="py-2.5 font-medium text-foreground">{p.name}</td>
                              <td className="py-2.5 font-mono text-xs text-muted-foreground">{p.sku}</td>
                              <td className="py-2.5 text-muted-foreground">{p.category}</td>
                              <td className="py-2.5 text-right text-muted-foreground">RD$ {formatNumber(p.basePrice)}</td>
                              <td className="py-2.5 text-right font-semibold text-success">RD$ {formatNumber(groupPrice)}</td>
                              <td className="py-2.5 text-right text-xs text-danger">-RD$ {formatNumber(saving)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
