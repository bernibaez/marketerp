'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { RotateCcw, Plus, Search, Eye, Edit2, Trash2, ShoppingCart, ShoppingBag, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatNumber } from '@/lib/formatNumber';

interface SaleReturn {
  id: number; code: string; refCode: string; customer: string; date: string;
  total: number; reason: string; status: 'approved' | 'pending' | 'rejected'; type: 'venta';
}
interface PurchaseReturn {
  id: number; code: string; refCode: string; supplier: string; date: string;
  total: number; reason: string; status: 'approved' | 'pending' | 'rejected'; type: 'compra';
}

const mockSaleReturns: SaleReturn[] = [
  { id: 1, code: 'DEV-V001', refCode: 'FAC-001', customer: 'Juan Pérez', date: '2024-01-16', total: 450, reason: 'Producto defectuoso', status: 'approved', type: 'venta' },
  { id: 2, code: 'DEV-V002', refCode: 'FAC-003', customer: 'Rosa Jiménez', date: '2024-01-15', total: 200, reason: 'Cambio de producto', status: 'pending', type: 'venta' },
  { id: 3, code: 'DEV-V003', refCode: 'FAC-006', customer: 'Pedro Martínez', date: '2024-01-14', total: 850, reason: 'Error en pedido', status: 'approved', type: 'venta' },
  { id: 4, code: 'DEV-V004', refCode: 'FAC-002', customer: 'Empresa ABC S.R.L.', date: '2024-01-13', total: 1200, reason: 'Producto vencido', status: 'rejected', type: 'venta' },
  { id: 5, code: 'DEV-V005', refCode: 'FAC-004', customer: 'Distribuidora XYZ', date: '2024-01-12', total: 3400, reason: 'Mercancía dañada en tránsito', status: 'pending', type: 'venta' },
];

const mockPurchaseReturns: PurchaseReturn[] = [
  { id: 1, code: 'DEV-C001', refCode: 'OC-001', supplier: 'Distribuidora Nacional S.A.', date: '2024-01-16', total: 3500, reason: 'Productos dañados', status: 'approved', type: 'compra' },
  { id: 2, code: 'DEV-C002', refCode: 'OC-003', supplier: 'Alimentos Frescos RD', date: '2024-01-14', total: 1200, reason: 'Fecha de vencimiento próxima', status: 'pending', type: 'compra' },
  { id: 3, code: 'DEV-C003', refCode: 'OC-002', supplier: 'Importadora del Caribe', date: '2024-01-13', total: 780, reason: 'Producto incorrecto', status: 'approved', type: 'compra' },
  { id: 4, code: 'DEV-C004', refCode: 'OC-004', supplier: 'Bebidas y Más', date: '2024-01-11', total: 2100, reason: 'Exceso de inventario', status: 'rejected', type: 'compra' },
];

type Tab = 'ventas' | 'compras';

const statusConfig = {
  approved: { label: 'Aprobado', cls: 'bg-success/10 text-success', icon: <CheckCircle size={13} /> },
  pending: { label: 'Pendiente', cls: 'bg-warning/10 text-warning', icon: <Clock size={13} /> },
  rejected: { label: 'Rechazado', cls: 'bg-danger/10 text-danger', icon: <XCircle size={13} /> },
};

interface ReturnFormProps {
  type: Tab;
  onClose: () => void;
}

function ReturnForm({ type, onClose }: ReturnFormProps) {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Nueva Devolución de {type === 'ventas' ? 'Venta' : 'Compra'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Registrar devolución de mercancía</p>
        </div>
        <button onClick={onClose} className="btn-secondary">← Volver</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información de la Devolución</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {type === 'ventas' ? 'Factura de Venta *' : 'Orden de Compra *'}
                </label>
                <select className="input-field">
                  <option>Seleccionar referencia...</option>
                  {type === 'ventas' ? (
                    <>
                      <option>FAC-001 - Juan Pérez</option>
                      <option>FAC-002 - Empresa ABC S.R.L.</option>
                      <option>FAC-003 - Rosa Jiménez</option>
                    </>
                  ) : (
                    <>
                      <option>OC-001 - Distribuidora Nacional S.A.</option>
                      <option>OC-002 - Importadora del Caribe</option>
                      <option>OC-003 - Alimentos Frescos RD</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                <input type="date" className="input-field" defaultValue="2024-01-17" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo de Devolución *</label>
                <select className="input-field">
                  <option>Producto defectuoso</option>
                  <option>Producto incorrecto</option>
                  <option>Producto vencido</option>
                  <option>Daño en tránsito</option>
                  <option>Exceso de inventario</option>
                  <option>Cambio de producto</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observaciones</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Detalles adicionales sobre la devolución..." />
              </div>
            </div>
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Productos a Devolver</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Cant. Original</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Cant. Devolver</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Precio</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Leche Entera 1L', qty: 10, ret: 3, price: 85 },
                  { name: 'Pan de Molde', qty: 5, ret: 2, price: 120 },
                  { name: 'Aceite Vegetal 1L', qty: 8, ret: 1, price: 195 },
                ].map((item, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 text-foreground">{item.name}</td>
                    <td className="py-3 text-center text-muted-foreground">{item.qty}</td>
                    <td className="py-3 text-center">
                      <input type="number" className="input-field w-20 text-center py-1" defaultValue={item.ret} min={0} max={item.qty} />
                    </td>
                    <td className="py-3 text-right text-foreground">RD$ {formatNumber(item.price)}</td>
                    <td className="py-3 text-right font-medium text-foreground">RD$ {formatNumber(item.ret * item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>RD$ {formatNumber(790)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>ITBIS (18%)</span><span>RD$ {formatNumber(142.2)}</span></div>
              <div className="flex justify-between font-bold text-foreground border-t border-border pt-2 mt-2"><span>Total Devolución</span><span className="text-primary">RD$ {formatNumber(932.2)}</span></div>
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground">Método de Reembolso</h3>
            <div className="space-y-2">
              {['Nota de crédito', 'Efectivo', 'Transferencia bancaria', 'Cambio de producto'].map(m => (
                <label key={m} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="radio" name="refund" className="accent-primary" defaultChecked={m === 'Nota de crédito'} />
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full">Registrar Devolución</button>
            <button onClick={onClose} className="btn-secondary w-full">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DevolucionesPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('ventas');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filteredSale = mockSaleReturns.filter(r =>
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.customer.toLowerCase().includes(search.toLowerCase()) ||
    r.refCode.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPurchase = mockPurchaseReturns.filter(r =>
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier.toLowerCase().includes(search.toLowerCase()) ||
    r.refCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalVentas = mockSaleReturns.reduce((s, r) => s + r.total, 0);
  const totalCompras = mockPurchaseReturns.reduce((s, r) => s + r.total, 0);
  const pendingCount = [...mockSaleReturns, ...mockPurchaseReturns].filter(r => r.status === 'pending').length;

  if (showForm) {
    return (
      <AppLayout currentPath={pathname}>
        <ReturnForm type={tab} onClose={() => setShowForm(false)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RotateCcw size={24} className="text-primary" />
              Devoluciones
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de devoluciones de ventas y compras</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva Devolución
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Dev. de Ventas', value: mockSaleReturns.length, sub: `RD$ ${formatNumber(totalVentas)}`, icon: <ShoppingCart size={18} />, color: 'text-primary' },
            { label: 'Dev. de Compras', value: mockPurchaseReturns.length, sub: `RD$ ${formatNumber(totalCompras)}`, icon: <ShoppingBag size={18} />, color: 'text-info' },
            { label: 'Pendientes', value: pendingCount, sub: 'Requieren acción', icon: <Clock size={18} />, color: 'text-warning' },
            { label: 'Aprobadas', value: [...mockSaleReturns, ...mockPurchaseReturns].filter(r => r.status === 'approved').length, sub: 'Este mes', icon: <CheckCircle size={18} />, color: 'text-success' },
          ].map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-border">
            {([
              { key: 'ventas', label: 'Devoluciones de Ventas', icon: <ShoppingCart size={15} /> },
              { key: 'compras', label: 'Devoluciones de Compras', icon: <ShoppingBag size={15} /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-border">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-field pl-9"
                placeholder="Buscar por código, referencia o nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input-field w-auto">
              <option>Todos los estados</option>
              <option>Aprobado</option>
              <option>Pendiente</option>
              <option>Rechazado</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Referencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {tab === 'ventas' ? 'Cliente' : 'Proveedor'}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tab === 'ventas' ? filteredSale.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.refCode}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">RD$ {formatNumber(r.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[r.status].cls}`}>
                        {statusConfig[r.status].icon} {statusConfig[r.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )) : filteredPurchase.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.refCode}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">RD$ {formatNumber(r.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[r.status].cls}`}>
                        {statusConfig[r.status].icon} {statusConfig[r.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Eye size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={14} /></button>
                        <button className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {((tab === 'ventas' && filteredSale.length === 0) || (tab === 'compras' && filteredPurchase.length === 0)) && (
              <div className="text-center py-12 text-muted-foreground">
                <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontraron devoluciones</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
