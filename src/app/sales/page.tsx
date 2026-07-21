'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { ShoppingCart, FileText, RotateCcw, Plus, Search, Filter, Download, Eye, Edit2, Trash2, Printer } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface Sale {
  id: number; code: string; customer: string; date: string; items: number;
  subtotal: number; tax: number; total: number; status: 'paid' | 'pending' | 'cancelled'; payment: string; agent: string;
}
interface Quote {
  id: number; code: string; customer: string; date: string; validUntil: string; total: number; status: 'pending' | 'approved' | 'rejected' | 'converted';
}
interface SaleReturn {
  id: number; code: string; saleCode: string; customer: string; date: string; total: number; reason: string; status: 'approved' | 'pending';
}

const mockSales: Sale[] = [
  { id: 1, code: 'FAC-001', customer: 'Juan Pérez', date: '2024-01-15', items: 8, subtotal: 2400, tax: 432, total: 2832, status: 'paid', payment: 'Efectivo', agent: 'Roberto Díaz' },
  { id: 2, code: 'FAC-002', customer: 'Empresa ABC S.R.L.', date: '2024-01-15', items: 25, subtotal: 18500, tax: 3330, total: 21830, status: 'paid', payment: 'Transferencia', agent: 'Luisa Fernández' },
  { id: 3, code: 'FAC-003', customer: 'Rosa Jiménez', date: '2024-01-14', items: 4, subtotal: 850, tax: 153, total: 1003, status: 'pending', payment: 'Crédito', agent: 'Roberto Díaz' },
  { id: 4, code: 'FAC-004', customer: 'Distribuidora XYZ', date: '2024-01-14', items: 40, subtotal: 45000, tax: 8100, total: 53100, status: 'paid', payment: 'Cheque', agent: 'Luisa Fernández' },
  { id: 5, code: 'FAC-005', customer: 'Carmen Reyes', date: '2024-01-13', items: 3, subtotal: 620, tax: 111.6, total: 731.6, status: 'cancelled', payment: 'Efectivo', agent: 'Miguel Torres' },
  { id: 6, code: 'FAC-006', customer: 'Pedro Martínez', date: '2024-01-13', items: 12, subtotal: 3200, tax: 576, total: 3776, status: 'paid', payment: 'Tarjeta', agent: 'Roberto Díaz' },
];

const mockQuotes: Quote[] = [
  { id: 1, code: 'COT-001', customer: 'Empresa ABC S.R.L.', date: '2024-01-15', validUntil: '2024-01-22', total: 35000, status: 'pending' },
  { id: 2, code: 'COT-002', customer: 'Distribuidora XYZ', date: '2024-01-14', validUntil: '2024-01-21', total: 78000, status: 'approved' },
  { id: 3, code: 'COT-003', customer: 'Juan Pérez', date: '2024-01-12', validUntil: '2024-01-19', total: 4500, status: 'converted' },
];

const mockReturns: SaleReturn[] = [
  { id: 1, code: 'DEV-001', saleCode: 'FAC-001', customer: 'Juan Pérez', date: '2024-01-16', total: 450, reason: 'Producto defectuoso', status: 'approved' },
  { id: 2, code: 'DEV-002', saleCode: 'FAC-003', customer: 'Rosa Jiménez', date: '2024-01-15', total: 200, reason: 'Cambio de producto', status: 'pending' },
];

type Tab = 'sales' | 'quotes' | 'returns';

const saleStatusMap: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Pagado', cls: 'badge-success' },
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  cancelled: { label: 'Cancelado', cls: 'badge-danger' },
  approved: { label: 'Aprobado', cls: 'badge-success' },
  rejected: { label: 'Rechazado', cls: 'badge-danger' },
  converted: { label: 'Convertido', cls: 'badge-info' },
};

export default function SalesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('sales');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredSales = mockSales.filter(s =>
    s.code.toLowerCase().includes(search.toLowerCase()) ||
    s.customer.toLowerCase().includes(search.toLowerCase())
  );

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Venta</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar factura de venta</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Venta</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
                    <select className="input-field"><option>Seleccionar cliente...</option><option>Juan Pérez</option><option>Empresa ABC S.R.L.</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" className="input-field" defaultValue="2024-01-15" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Agente</label>
                    <select className="input-field"><option>Roberto Díaz</option><option>Luisa Fernández</option></select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                    <select className="input-field"><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Crédito</option></select>
                  </div>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Productos</h3>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input className="input-field pl-8 py-1.5 text-xs w-48" placeholder="Buscar producto..." />
                    </div>
                    <button className="btn-primary flex items-center gap-1 text-xs py-1.5"><Plus size={14} />Agregar</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Precio</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Cant.</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Desc.</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Total</th>
                      <th className="py-2"></th>
                    </tr></thead>
                    <tbody>
                      {[
                        { name: 'Arroz Selecto 5lb', price: 280, qty: 5, disc: 0, total: 1400 },
                        { name: 'Aceite Vegetal 1L', price: 350, qty: 3, disc: 5, total: 997.5 },
                      ].map((item, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="py-2 text-foreground">{item.name}</td>
                          <td className="py-2"><input type="number" defaultValue={item.price} className="input-field w-24 py-1" /></td>
                          <td className="py-2"><input type="number" defaultValue={item.qty} className="input-field w-16 py-1" /></td>
                          <td className="py-2"><input type="number" defaultValue={item.disc} className="input-field w-16 py-1" /></td>
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
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">RD$ 2,397.50</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Descuento</span><span className="font-medium text-success">- RD$ 52.50</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">ITBIS (18%)</span><span className="font-medium">RD$ 431.55</span></div>
                <div className="border-t border-border pt-3 flex justify-between font-bold text-foreground text-lg"><span>Total</span><span>RD$ 2,776.55</span></div>
              </div>
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Pago</h3>
                <div><label className="text-xs text-muted-foreground mb-1 block">Monto recibido</label><input className="input-field" placeholder="0.00" type="number" /></div>
                <div className="flex justify-between text-sm font-semibold"><span>Cambio</span><span className="text-success">RD$ 0.00</span></div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 flex items-center justify-center gap-2"><Printer size={16} />Imprimir</button>
                <button className="btn-primary flex-1">Guardar</button>
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
            <h1 className="text-2xl font-bold text-foreground">Ventas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona facturas, cotizaciones y devoluciones</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2 w-fit">
            <Plus size={16} />Nueva Venta
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4"><p className="text-xs text-muted-foreground">Ventas del día</p><p className="text-2xl font-bold text-foreground mt-1">RD$ 83.5K</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Facturas emitidas</p><p className="text-2xl font-bold text-info mt-1">156</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Pendientes de cobro</p><p className="text-2xl font-bold text-warning mt-1">12</p></div>
          <div className="card p-4"><p className="text-xs text-muted-foreground">Devoluciones</p><p className="text-2xl font-bold text-danger mt-1">3</p></div>
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit flex-wrap">
          {[
            { id: 'sales' as Tab, label: 'Todas las Ventas', icon: <ShoppingCart size={16} /> },
            { id: 'quotes' as Tab, label: 'Cotizaciones', icon: <FileText size={16} /> },
            { id: 'returns' as Tab, label: 'Devoluciones', icon: <RotateCcw size={16} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="input-field pl-9" placeholder="Buscar por código o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtrar</button>
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
          </div>
        </div>

        {tab === 'sales' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Factura</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Agente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Pago</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((s, i) => (
                    <tr key={s.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{s.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{s.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.date}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{s.agent}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{s.payment}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(s.total)}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className={saleStatusMap[s.status].cls}>{saleStatusMap[s.status].label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Printer size={14} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Mostrando {filteredSales.length} de {mockSales.length} ventas</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Anterior</button>
                <button className="px-3 py-1 rounded-lg bg-primary text-primary-foreground">1</button>
                <button className="px-3 py-1 rounded-lg hover:bg-secondary transition-colors">Siguiente</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'quotes' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Válida hasta</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mockQuotes.map((q, i) => (
                    <tr key={q.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{q.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{q.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{q.date}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{q.validUntil}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(q.total)}</td>
                      <td className="px-4 py-3"><span className={saleStatusMap[q.status].cls}>{saleStatusMap[q.status].label}</span></td>
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
          </div>
        )}

        {tab === 'returns' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Factura Ref.</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Cliente</th>
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
                      <td className="px-4 py-3 font-mono text-primary">{r.saleCode}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.date}</td>
                      <td className="px-4 py-3 font-bold text-foreground">RD$ {formatNumber(r.total)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{r.reason}</td>
                      <td className="px-4 py-3"><span className={saleStatusMap[r.status].cls}>{saleStatusMap[r.status].label}</span></td>
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
