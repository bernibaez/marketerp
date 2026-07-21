'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Truck, Plus, Search, Eye, Edit2, Trash2, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface Shipment {
  id: number; code: string; refCode: string; customer: string; address: string;
  carrier: string; trackingNo: string; date: string; estimatedDelivery: string;
  weight: number; cost: number; status: 'delivered' | 'in_transit' | 'pending' | 'failed';
}

const mockShipments: Shipment[] = [
  { id: 1, code: 'ENV-001', refCode: 'FAC-001', customer: 'Juan Pérez', address: 'Av. 27 de Febrero #45, Santo Domingo', carrier: 'Caribe Express', trackingNo: 'CE-2024-001', date: '2024-01-15', estimatedDelivery: '2024-01-17', weight: 3.5, cost: 350, status: 'delivered' },
  { id: 2, code: 'ENV-002', refCode: 'FAC-002', customer: 'Empresa ABC S.R.L.', address: 'Calle El Conde #120, Zona Colonial', carrier: 'Vimenpaq', trackingNo: 'VMP-2024-045', date: '2024-01-15', estimatedDelivery: '2024-01-18', weight: 12.0, cost: 850, status: 'in_transit' },
  { id: 3, code: 'ENV-003', refCode: 'FAC-004', customer: 'Distribuidora XYZ', address: 'Autopista Duarte Km 12, Santiago', carrier: 'Caribe Express', trackingNo: 'CE-2024-002', date: '2024-01-14', estimatedDelivery: '2024-01-16', weight: 45.0, cost: 2200, status: 'delivered' },
  { id: 4, code: 'ENV-004', refCode: 'FAC-006', customer: 'Pedro Martínez', address: 'Calle Las Damas #8, Santo Domingo', carrier: 'Domex', trackingNo: 'DMX-2024-089', date: '2024-01-16', estimatedDelivery: '2024-01-19', weight: 2.1, cost: 280, status: 'pending' },
  { id: 5, code: 'ENV-005', refCode: 'FAC-003', customer: 'Rosa Jiménez', address: 'Av. Independencia #200, La Romana', carrier: 'Vimenpaq', trackingNo: 'VMP-2024-046', date: '2024-01-13', estimatedDelivery: '2024-01-15', weight: 1.8, cost: 420, status: 'failed' },
  { id: 6, code: 'ENV-006', refCode: 'FAC-007', customer: 'Carlos Rodríguez', address: 'Calle Mella #55, San Pedro de Macorís', carrier: 'Caribe Express', trackingNo: 'CE-2024-003', date: '2024-01-17', estimatedDelivery: '2024-01-20', weight: 6.3, cost: 680, status: 'in_transit' },
];

const statusConfig = {
  delivered: { label: 'Entregado', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  in_transit: { label: 'En Tránsito', cls: 'bg-info/10 text-info', icon: <Truck size={13} /> },
  pending: { label: 'Pendiente', cls: 'bg-warning/10 text-warning', icon: <Clock size={13} /> },
  failed: { label: 'Fallido', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

interface ShipmentFormProps { onClose: () => void; }

function ShipmentForm({ onClose }: ShipmentFormProps) {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Envío</h1>
          <p className="text-sm text-muted-foreground mt-1">Registrar envío de mercancía</p>
        </div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información del Envío</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura de Referencia *</label>
                <select className="input-field">
                  <option>Seleccionar factura...</option>
                  <option>FAC-001 - Juan Pérez</option>
                  <option>FAC-002 - Empresa ABC S.R.L.</option>
                  <option>FAC-006 - Pedro Martínez</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Transportista *</label>
                <select className="input-field">
                  <option>Caribe Express</option>
                  <option>Vimenpaq</option>
                  <option>Domex</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">No. de Seguimiento</label>
                <input className="input-field" placeholder="CE-2024-XXX" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Envío *</label>
                <input type="date" className="input-field" defaultValue="2024-01-17" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega Estimada</label>
                <input type="date" className="input-field" defaultValue="2024-01-20" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Peso (kg)</label>
                <input type="number" className="input-field" placeholder="0.00" step="0.1" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección de Entrega *</label>
                <input className="input-field" placeholder="Calle, número, ciudad, provincia..." />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Instrucciones Especiales</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Instrucciones para el transportista..." />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Costo del Envío</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Servicio</label>
                <select className="input-field">
                  <option>Estándar (3-5 días)</option>
                  <option>Express (1-2 días)</option>
                  <option>Mismo día</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Costo (RD$)</label>
                <input type="number" className="input-field" placeholder="0.00" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="insurance" className="accent-primary" />
                <label htmlFor="insurance" className="text-sm text-foreground cursor-pointer">Seguro de envío</label>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full">Registrar Envío</button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnviosPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const filtered = mockShipments.filter(s => {
    const matchSearch = s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.customer.toLowerCase().includes(search.toLowerCase()) ||
      s.trackingNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: mockShipments.length,
    delivered: mockShipments.filter(s => s.status === 'delivered').length,
    inTransit: mockShipments.filter(s => s.status === 'in_transit').length,
    pending: mockShipments.filter(s => s.status === 'pending').length,
    totalCost: mockShipments.reduce((s, e) => s + e.cost, 0),
  };

  if (showForm) {
    return <AppLayout currentPath={pathname}><ShipmentForm onClose={() => setShowForm(false)} /></AppLayout>;
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck size={24} className="text-primary" />
              Envíos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión y seguimiento de envíos</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo Envío
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Envíos', value: stats.total, icon: <Package size={18} />, color: 'text-primary' },
            { label: 'Entregados', value: stats.delivered, icon: <CheckCircle size={18} />, color: 'text-success' },
            { label: 'En Tránsito', value: stats.inTransit, icon: <Truck size={18} />, color: 'text-info' },
            { label: 'Pendientes', value: stats.pending, icon: <Clock size={18} />, color: 'text-warning' },
            { label: 'Costo Total', value: `RD$ ${formatNumber(stats.totalCost)}`, icon: <AlertCircle size={18} />, color: 'text-muted-foreground' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código, cliente o tracking..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="delivered">Entregado</option>
              <option value="in_transit">En Tránsito</option>
              <option value="pending">Pendiente</option>
              <option value="failed">Fallido</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  {['Código', 'Referencia', 'Cliente', 'Transportista', 'Tracking', 'Fecha', 'Entrega Est.', 'Costo', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{s.code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.refCode}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{s.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.carrier}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.trackingNo}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.date}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.estimatedDelivery}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">RD$ {formatNumber(s.cost)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusConfig[s.status].cls}`}>
                        {statusConfig[s.status].icon} {statusConfig[s.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Truck size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontraron envíos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
