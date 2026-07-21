'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { ShoppingBag, RotateCcw, Plus, Search, Filter, Download, Eye, Edit2, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface Purchase {
  id: number; code: string; supplier: string; date: string; items: number;
  subtotal: number; tax: number; total: number; status: 'received' | 'pending' | 'partial'; payment: string;
}
interface Return {
  id: number; code: string; purchaseCode: string; supplier: string; date: string; total: number; reason: string; status: 'approved' | 'pending';
}

const mockPurchases: Purchase[] = [
  { id: 1, code: 'OC-001', supplier: 'Distribuidora Nacional S.A.', date: '2024-01-15', items: 12, subtotal: 45000, tax: 8100, total: 53100, status: 'received', payment: 'Transferencia' },
  { id: 2, code: 'OC-002', supplier: 'Importadora del Caribe', date: '2024-01-14', items: 5, subtotal: 18500, tax: 3330, total: 21830, status: 'pending', payment: 'Crédito' },
  { id: 3, code: 'OC-003', supplier: 'Alimentos Frescos RD', date: '2024-01-13', items: 28, subtotal: 32000, tax: 5760, total: 37760, status: 'received', payment: 'Efectivo' },
  { id: 4, code: 'OC-004', supplier: 'Bebidas y Más', date: '2024-01-12', items: 8, subtotal: 12000, tax: 2160, total: 14160, status: 'partial', payment: 'Cheque' },
  { id: 5, code: 'OC-005', supplier: 'Distribuidora Nacional S.A.', date: '2024-01-10', items: 20, subtotal: 67000, tax: 12060, total: 79060, status: 'received', payment: 'Transferencia' },
];

const mockReturns: Return[] = [
  { id: 1, code: 'DEV-001', purchaseCode: 'OC-001', supplier: 'Distribuidora Nacional S.A.', date: '2024-01-16', total: 3500, reason: 'Productos dañados', status: 'approved' },
  { id: 2, code: 'DEV-002', purchaseCode: 'OC-003', supplier: 'Alimentos Frescos RD', date: '2024-01-14', total: 1200, reason: 'Fecha de vencimiento próxima', status: 'pending' },
];

type Tab = 'list' | 'returns';

const statusMap = {
  received: { label: 'Recibido', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  approved: { label: 'Aprobado', cls: 'badge-success' },
};

export default function PurchasesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = mockPurchases.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Compra</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar orden de compra</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Compra</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor *</label>
                    <select className="input-field"><option>Seleccionar proveedor...</option><option>Distribuidora Nacional S.A.</option><option>Importadora del Caribe</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" className="input-field" defaultValue="2024-01-15" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                    <select className="input-field"><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>Crédito</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">No. Factura Proveedor</label>
                    <input className="input-field" placeholder="FAC-0001" />
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Productos</h3>
                  <button className="btn-primary flex items-center gap-2 text-xs py-1.5"><Plus size={14} />Agregar producto</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Cantidad</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Precio</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Total</th>
                      <th className="py-2"></th>
                    </tr></thead>
                    <tbody>
                      {[
                        { name: 'Arroz Selecto 5lb', qty: 50, price: 180, total: 9000 },
                        { name: 'Aceite Vegetal 1L', qty: 24, price: 220, total: 5280 },
                        { name: 'Azúcar Blanca 2lb', qty: 36, price: 95, total: 3420 },
                      ].map((item, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="py-2 text-foreground">{item.name}</td>
                          <td className="py-2"><input type="number" defaultValue={item.qty} className="input-field w-20 py-1" /></td>
                          <td className="py-2"><input type="number" defaultValue={item.price} className="input-field w-24 py-1" /></td>
                          <td className="py-2 font-semibold text-foreground">RD$ {formatNumber(item.total)}</td>
                          <td className="py-2"><button className="p-1 text-danger hover:bg-danger-bg rounded"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Resumen</h3>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">RD$ 17,700</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">ITBIS (18%)</span><span className="font-medium">RD$ 3,186</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Descuento</span><span className="font-medium text-success">- RD$ 0</span></div>
                <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground"><span>Total</span><span>RD$ 20,886</span></div>
              </div>
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Notas</h3>
                <textarea className="input-field" rows={4} placeholder="Observaciones..." />
              </div>
              <button className="btn-primary w-full py-3">Guardar Compra</button>
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
            <h1 className="text-2xl font-bold text-foreground">Compras</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona órdenes de compra y devoluciones</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} />Nueva Compra
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Compras del mes</p><p className="text-2xl font-bold text-foreground mt-1">RD$ 205.9K</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Órdenes totales</p><p className="text-2xl font-bold text-info mt-1">48</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes</p><p className="text-2xl font-bold text-warning mt-1">5</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Devoluciones</p><p className="text-2xl font-bold text-danger mt-1">2</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
          {[{ id: 'list' as Tab, label: 'Lista de Compras', icon: <ShoppingBag size={16} /> }, { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={16} /> }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar por código o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {tab === 'list' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Productos</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">ITBIS</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.date}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.items} items</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">RD$ {formatNumber(p.tax)}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(p.total)}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className={statusMap[p.status].cls}>{statusMap[p.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Mostrando {filtered.length} de {mockPurchases.length} compras</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Anterior</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">1</button>
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Siguiente</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'returns' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Compra Ref.</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Proveedor</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Motivo</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mockReturns.map((r, i) => (
                    <tr key={r.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-danger font-medium">{r.code}</td>
                      <td className="px-4 py-3 font-mono text-primary">{r.purchaseCode}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(r.total)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{r.reason}</td>
                      <td className="px-4 py-3"><span className={statusMap[r.status].cls}>{statusMap[r.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
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
    </AppLayout>
  );
}
