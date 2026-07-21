'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Tag, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Percent, Calendar, Users } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface Discount {
  id: number; code: string; name: string; type: 'percentage' | 'fixed' | 'buy_x_get_y';
  value: number; minPurchase: number; maxUses: number; usedCount: number;
  startDate: string; endDate: string; applies: 'all' | 'category' | 'product' | 'customer';
  active: boolean;
}

const mockDiscounts: Discount[] = [
  { id: 1, code: 'ENERO20', name: 'Descuento Enero 20%', type: 'percentage', value: 20, minPurchase: 500, maxUses: 100, usedCount: 45, startDate: '2024-01-01', endDate: '2024-01-31', applies: 'all', active: true },
  { id: 2, code: 'BIENVENIDO', name: 'Descuento Bienvenida', type: 'fixed', value: 200, minPurchase: 1000, maxUses: 50, usedCount: 12, startDate: '2024-01-01', endDate: '2024-12-31', applies: 'customer', active: true },
  { id: 3, code: 'LACTEOS10', name: 'Lácteos 10% Off', type: 'percentage', value: 10, minPurchase: 0, maxUses: 200, usedCount: 89, startDate: '2024-01-10', endDate: '2024-01-20', applies: 'category', active: false },
  { id: 4, code: '2X1BEBIDAS', name: '2x1 en Bebidas', type: 'buy_x_get_y', value: 1, minPurchase: 0, maxUses: 150, usedCount: 67, startDate: '2024-01-15', endDate: '2024-01-22', applies: 'product', active: true },
  { id: 5, code: 'MAYORISTA15', name: 'Descuento Mayorista', type: 'percentage', value: 15, minPurchase: 5000, maxUses: 0, usedCount: 23, startDate: '2024-01-01', endDate: '2024-12-31', applies: 'customer', active: true },
  { id: 6, code: 'FLASH50', name: 'Flash Sale 50%', type: 'percentage', value: 50, minPurchase: 300, maxUses: 30, usedCount: 30, startDate: '2024-01-12', endDate: '2024-01-12', applies: 'all', active: false },
];

const typeConfig = {
  percentage: { label: 'Porcentaje', cls: 'bg-primary/10 text-primary' },
  fixed: { label: 'Monto Fijo', cls: 'bg-info/10 text-info' },
  buy_x_get_y: { label: 'Compra X Lleva Y', cls: 'bg-success/10 text-success' },
};

const appliesConfig = {
  all: 'Todos los productos',
  category: 'Por categoría',
  product: 'Producto específico',
  customer: 'Por cliente',
};

interface DiscountFormProps { onClose: () => void; }

function DiscountForm({ onClose }: DiscountFormProps) {
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'buy_x_get_y'>('percentage');
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Descuento</h1>
          <p className="text-sm text-muted-foreground mt-1">Crear regla de descuento o código promocional</p>
        </div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información General</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del Descuento *</label>
                <input className="input-field" placeholder="Ej: Descuento Enero 20%" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Código Promocional</label>
                <input className="input-field" placeholder="Ej: ENERO20" style={{ textTransform: 'uppercase' }} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Descuento *</label>
                <select className="input-field" value={discountType} onChange={e => setDiscountType(e.target.value as typeof discountType)}>
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto Fijo (RD$)</option>
                  <option value="buy_x_get_y">Compra X Lleva Y</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {discountType === 'percentage' ? 'Porcentaje (%)' : discountType === 'fixed' ? 'Monto (RD$)' : 'Cantidad a llevar gratis'}
                </label>
                <input type="number" className="input-field" placeholder={discountType === 'percentage' ? '10' : '200'} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Compra Mínima (RD$)</label>
                <input type="number" className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Máximo de Usos (0 = ilimitado)</label>
                <input type="number" className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Inicio *</label>
                <input type="date" className="input-field" defaultValue="2024-01-17" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Vencimiento</label>
                <input type="date" className="input-field" defaultValue="2024-01-31" />
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Aplicabilidad</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Aplica a</label>
                <select className="input-field">
                  <option value="all">Todos los productos</option>
                  <option value="category">Categoría específica</option>
                  <option value="product">Producto específico</option>
                  <option value="customer">Cliente específico</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="stackable" className="accent-primary" />
                <label htmlFor="stackable" className="text-sm text-foreground cursor-pointer">Acumulable con otros descuentos</label>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="onetime" className="accent-primary" />
                <label htmlFor="onetime" className="text-sm text-foreground cursor-pointer">Un solo uso por cliente</label>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Vista Previa</h3>
            <div className="bg-secondary/50 rounded-xl p-4 text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Percent size={24} className="text-primary" />
              </div>
              <p className="font-bold text-foreground text-lg">20% OFF</p>
              <p className="text-xs text-muted-foreground">Código: ENERO20</p>
              <p className="text-xs text-muted-foreground">Válido hasta: 31 Ene 2024</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full">Crear Descuento</button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DescuentosPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [discounts, setDiscounts] = useState(mockDiscounts);

  const filtered = discounts.filter(d => {
    const matchSearch = d.code.toLowerCase().includes(search.toLowerCase()) || d.name.toLowerCase().includes(search.toLowerCase());
    const matchActive = activeFilter === 'all' || (activeFilter === 'active' ? d.active : !d.active);
    return matchSearch && matchActive;
  });

  const toggleActive = (id: number) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  if (showForm) {
    return <AppLayout currentPath={pathname}><DiscountForm onClose={() => setShowForm(false)} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Tag size={24} className="text-primary" />
              Descuentos y Promociones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de códigos promocionales y reglas de descuento</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Descuento
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Descuentos', value: discounts.length, icon: <Tag size={18} />, color: 'text-primary' },
            { label: 'Activos', value: discounts.filter(d => d.active).length, icon: <ToggleRight size={18} />, color: 'text-success' },
            { label: 'Usos Totales', value: discounts.reduce((s, d) => s + d.usedCount, 0), icon: <Users size={18} />, color: 'text-info' },
            { label: 'Vencidos', value: discounts.filter(d => !d.active).length, icon: <Calendar size={18} />, color: 'text-warning' },
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

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código o nombre..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'inactive'] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  {['Código', 'Nombre', 'Tipo', 'Valor', 'Compra Mín.', 'Usos', 'Vigencia', 'Aplica a', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{d.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig[d.type].cls}`}>{typeConfig[d.type].label}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      {d.type === 'percentage' ? `${d.value}%` : d.type === 'fixed' ? `RD$ ${formatNumber(d.value)}` : `${d.value} gratis`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {d.minPurchase > 0 ? `RD$ ${formatNumber(d.minPurchase)}` : 'Sin mínimo'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {d.usedCount}{d.maxUses > 0 ? `/${d.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{d.startDate} → {d.endDate}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{appliesConfig[d.applies]}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(d.id)} className="flex items-center gap-1.5 text-xs font-medium transition-colors">
                        {d.active
                          ? <><ToggleRight size={18} className="text-success" /><span className="text-success">Activo</span></>
                          : <><ToggleLeft size={18} className="text-muted-foreground" /><span className="text-muted-foreground">Inactivo</span></>
                        }
                      </button>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
