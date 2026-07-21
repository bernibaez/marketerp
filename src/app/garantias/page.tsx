'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Shield, Plus, Search, Eye, Edit2, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, Calendar } from 'lucide-react';


interface Warranty {
  id: number; code: string; product: string; sku: string; customer: string;
  saleCode: string; purchaseDate: string; expiryDate: string;
  warrantyMonths: number; status: 'active' | 'expired' | 'claimed' | 'voided';
  claimCount: number; notes: string;
}

interface WarrantyClaim {
  id: number; warrantyCode: string; product: string; customer: string;
  claimDate: string; description: string; resolution: string;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
}

const mockWarranties: Warranty[] = [
  { id: 1, code: 'GAR-001', product: 'Nevera Samsung 400L', sku: 'ELE-001', customer: 'Juan Pérez', saleCode: 'FAC-001', purchaseDate: '2023-07-15', expiryDate: '2024-07-15', warrantyMonths: 12, status: 'active', claimCount: 0, notes: 'Garantía de fábrica' },
  { id: 2, code: 'GAR-002', product: 'Televisor LG 55"', sku: 'ELE-002', customer: 'Empresa ABC S.R.L.', saleCode: 'FAC-002', purchaseDate: '2023-01-10', expiryDate: '2024-01-10', warrantyMonths: 12, status: 'expired', claimCount: 1, notes: '' },
  { id: 3, code: 'GAR-003', product: 'Lavadora Whirlpool', sku: 'ELE-003', customer: 'Rosa Jiménez', saleCode: 'FAC-003', purchaseDate: '2023-10-20', expiryDate: '2025-10-20', warrantyMonths: 24, status: 'active', claimCount: 0, notes: 'Garantía extendida' },
  { id: 4, code: 'GAR-004', product: 'Microondas Panasonic', sku: 'ELE-004', customer: 'Pedro Martínez', saleCode: 'FAC-006', purchaseDate: '2023-11-05', expiryDate: '2024-11-05', warrantyMonths: 12, status: 'claimed', claimCount: 2, notes: 'Reclamación activa' },
  { id: 5, code: 'GAR-005', product: 'Aire Acondicionado 12000 BTU', sku: 'ELE-005', customer: 'Distribuidora XYZ', saleCode: 'FAC-004', purchaseDate: '2022-06-15', expiryDate: '2024-06-15', warrantyMonths: 24, status: 'active', claimCount: 0, notes: '' },
];

const mockClaims: WarrantyClaim[] = [
  { id: 1, warrantyCode: 'GAR-004', product: 'Microondas Panasonic', customer: 'Pedro Martínez', claimDate: '2024-01-10', description: 'No calienta correctamente', resolution: 'Revisión técnica programada', status: 'in_progress' },
  { id: 2, warrantyCode: 'GAR-002', product: 'Televisor LG 55"', customer: 'Empresa ABC S.R.L.', claimDate: '2023-12-20', description: 'Pantalla con líneas horizontales', resolution: 'Reemplazo de pantalla realizado', status: 'resolved' },
  { id: 3, warrantyCode: 'GAR-004', product: 'Microondas Panasonic', customer: 'Pedro Martínez', claimDate: '2024-01-15', description: 'Ruido extraño al operar', resolution: 'Pendiente de diagnóstico', status: 'open' },
];

type Tab = 'warranties' | 'claims';

const warrantyStatusConfig = {
  active: { label: 'Activa', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  expired: { label: 'Vencida', cls: 'bg-secondary text-muted-foreground', icon: <Calendar size={13} /> },
  claimed: { label: 'Reclamada', cls: 'bg-warning/10 text-warning', icon: <AlertTriangle size={13} /> },
  voided: { label: 'Anulada', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

const claimStatusConfig = {
  open: { label: 'Abierto', cls: 'bg-info/10 text-info', icon: <Clock size={13} /> },
  in_progress: { label: 'En Proceso', cls: 'bg-warning/10 text-warning', icon: <AlertTriangle size={13} /> },
  resolved: { label: 'Resuelto', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  rejected: { label: 'Rechazado', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

export default function GarantiasPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('warranties');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredWarranties = mockWarranties.filter(w =>
    w.code.toLowerCase().includes(search.toLowerCase()) ||
    w.product.toLowerCase().includes(search.toLowerCase()) ||
    w.customer.toLowerCase().includes(search.toLowerCase())
  );
  const filteredClaims = mockClaims.filter(c =>
    c.warrantyCode.toLowerCase().includes(search.toLowerCase()) ||
    c.product.toLowerCase().includes(search.toLowerCase()) ||
    c.customer.toLowerCase().includes(search.toLowerCase())
  );

  if (showForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Garantía</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar garantía de producto</p>
            </div>
            <button onClick={() => setShowForm(false)} className="btn-secondary">← Volver</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Información de la Garantía</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura de Venta *</label>
                  <select className="input-field"><option>Seleccionar factura...</option><option>FAC-001 - Juan Pérez</option><option>FAC-002 - Empresa ABC</option></select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Producto *</label>
                  <select className="input-field"><option>Seleccionar producto...</option><option>Nevera Samsung 400L</option><option>Televisor LG 55"</option></select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Duración (meses) *</label>
                  <select className="input-field"><option>6</option><option>12</option><option>18</option><option>24</option><option>36</option></select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Inicio *</label>
                  <input type="date" className="input-field" defaultValue="2024-01-17" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">No. de Serie</label>
                  <input className="input-field" placeholder="SN-XXXXXXXXXX" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Garantía</label>
                  <select className="input-field"><option>Garantía de fábrica</option><option>Garantía extendida</option><option>Garantía del proveedor</option></select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Condiciones / Notas</label>
                  <textarea className="input-field resize-none" rows={3} placeholder="Condiciones de la garantía, exclusiones, etc." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1">Registrar Garantía</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </div>
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Garantías Recientes</h3>
              <div className="space-y-3">
                {mockWarranties.slice(0, 4).map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{w.product}</p>
                      <p className="text-xs text-muted-foreground">{w.customer} · {w.warrantyMonths} meses</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${warrantyStatusConfig[w.status].cls}`}>
                      {warrantyStatusConfig[w.status].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield size={24} className="text-primary" />
              Garantías
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de garantías de productos y reclamaciones</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva Garantía
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Garantías Activas', value: mockWarranties.filter(w => w.status === 'active').length, icon: <Shield size={18} />, color: 'text-success' },
            { label: 'Vencidas', value: mockWarranties.filter(w => w.status === 'expired').length, icon: <Calendar size={18} />, color: 'text-muted-foreground' },
            { label: 'Reclamaciones', value: mockClaims.length, icon: <AlertTriangle size={18} />, color: 'text-warning' },
            { label: 'Resueltas', value: mockClaims.filter(c => c.status === 'resolved').length, icon: <CheckCircle size={18} />, color: 'text-primary' },
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

        {/* Tabs + Table */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: 'warranties', label: 'Garantías', icon: <Shield size={15} /> },
              { key: 'claims', label: 'Reclamaciones', icon: <AlertTriangle size={15} /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código, producto o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="overflow-x-auto">
            {tab === 'warranties' ? (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Código', 'Producto', 'Cliente', 'Factura', 'Inicio', 'Vencimiento', 'Duración', 'Reclamaciones', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWarranties.map(w => (
                    <tr key={w.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{w.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{w.product}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.customer}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.saleCode}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.purchaseDate}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.expiryDate}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.warrantyMonths} meses</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${w.claimCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{w.claimCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${warrantyStatusConfig[w.status].cls}`}>
                          {warrantyStatusConfig[w.status].icon} {warrantyStatusConfig[w.status].label}
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
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['Garantía', 'Producto', 'Cliente', 'Fecha', 'Descripción', 'Resolución', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredClaims.map(c => (
                    <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{c.warrantyCode}</td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{c.product}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.claimDate}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{c.description}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{c.resolution}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${claimStatusConfig[c.status].cls}`}>
                          {claimStatusConfig[c.status].icon} {claimStatusConfig[c.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
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
