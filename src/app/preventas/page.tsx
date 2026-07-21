'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Plus, Search, Filter, Download, Eye, Edit2, Trash2, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';

interface Preventa {
  id: number;
  code: string;
  customer: string;
  date: string;
  items: number;
  total: number;
  status: 'pending' | 'approved' | 'cancelled' | 'converted';
  agent: string;
  notes: string;
}

const mockPreventas: Preventa[] = [
  { id: 1, code: 'PRE-001', customer: 'Empresa ABC S.R.L.', date: '2024-01-15', items: 12, total: 45000, status: 'pending', agent: 'Roberto Díaz', notes: 'Cliente solicita entrega el lunes' },
  { id: 2, code: 'PRE-002', customer: 'Distribuidora XYZ', date: '2024-01-14', items: 8, total: 28500, status: 'approved', agent: 'Luisa Fernández', notes: '' },
  { id: 3, code: 'PRE-003', customer: 'Juan Pérez', date: '2024-01-14', items: 3, total: 4200, status: 'converted', agent: 'Roberto Díaz', notes: 'Convertida a FAC-006' },
  { id: 4, code: 'PRE-004', customer: 'Supermercado El Sol', date: '2024-01-13', items: 25, total: 92000, status: 'pending', agent: 'Miguel Torres', notes: 'Pedido semanal' },
  { id: 5, code: 'PRE-005', customer: 'Rosa Jiménez', date: '2024-01-12', items: 5, total: 8750, status: 'cancelled', agent: 'Luisa Fernández', notes: 'Cliente canceló' },
  { id: 6, code: 'PRE-006', customer: 'Colmado Don Pedro', date: '2024-01-11', items: 18, total: 36000, status: 'approved', agent: 'Miguel Torres', notes: '' },
];

const products = [
  { id: 1, name: 'Arroz Selecto 5lb', price: 280, unit: 'Saco' },
  { id: 2, name: 'Aceite Vegetal 1L', price: 350, unit: 'Botella' },
  { id: 3, name: 'Azúcar Blanca 2lb', price: 200, unit: 'Bolsa' },
  { id: 4, name: 'Leche Entera 1L', price: 300, unit: 'Caja' },
  { id: 5, name: 'Pollo Entero', price: 500, unit: 'Unidad' },
];

const statusMap: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendiente', cls: 'badge-warning', icon: <Clock size={12} /> },
  approved: { label: 'Aprobada', cls: 'badge-success', icon: <CheckCircle size={12} /> },
  cancelled: { label: 'Cancelada', cls: 'badge-danger', icon: <XCircle size={12} /> },
  converted: { label: 'Convertida', cls: 'badge-info', icon: <ArrowRight size={12} /> },
};

interface CartItem { productId: number; name: string; price: number; qty: number; unit: string; }

export default function PreventasPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);

  const filtered = mockPreventas.filter(p => {
    const matchSearch = p.code.toLowerCase().includes(search.toLowerCase()) || p.customer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const addToCart = () => {
    const prod = products.find(p => p.id === Number(selectedProduct));
    if (!prod) return;
    const existing = cart.find(c => c.productId === prod.id);
    if (existing) {
      setCart(cart.map(c => c.productId === prod.id ? { ...c, qty: c.qty + qty } : c));
    } else {
      setCart([...cart, { productId: prod.id, name: prod.name, price: prod.price, qty, unit: prod.unit }]);
    }
    setSelectedProduct('');
    setQty(1);
  };

  const removeFromCart = (id: number) => setCart(cart.filter(c => c.productId !== id));
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Preventa</h1>
              <p className="text-sm text-muted-foreground mt-1">Registrar pedido anticipado</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Header info */}
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información General</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
                    <select className="input-field">
                      <option>Seleccionar cliente...</option>
                      <option>Empresa ABC S.R.L.</option>
                      <option>Distribuidora XYZ</option>
                      <option>Juan Pérez</option>
                      <option>Supermercado El Sol</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" className="input-field" defaultValue="2024-01-15" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Agente Comercial</label>
                    <select className="input-field">
                      <option>Roberto Díaz</option>
                      <option>Luisa Fernández</option>
                      <option>Miguel Torres</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Entrega</label>
                    <input type="date" className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas / Observaciones</label>
                    <textarea className="input-field resize-none" rows={2} placeholder="Instrucciones especiales, condiciones de entrega..." />
                  </div>
                </div>
              </div>

              {/* Add products */}
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Agregar Productos</h3>
                <div className="flex gap-3">
                  <select className="input-field flex-1" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                    <option value="">Seleccionar producto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — RD${p.price}</option>)}
                  </select>
                  <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="input-field w-24" placeholder="Cant." />
                  <button onClick={addToCart} className="btn-primary px-4" disabled={!selectedProduct}>
                    <Plus size={16} />
                  </button>
                </div>

                {/* Cart table */}
                {cart.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">Cant.</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Precio</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Subtotal</th>
                          <th className="py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.productId} className="border-b border-border/50">
                            <td className="py-2.5 text-foreground">{item.name}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{item.qty} {item.unit}</td>
                            <td className="py-2.5 text-right text-muted-foreground">RD${item.price.toLocaleString()}</td>
                            <td className="py-2.5 text-right font-medium text-foreground">RD${(item.price * item.qty).toLocaleString()}</td>
                            <td className="py-2.5 text-center">
                              <button onClick={() => removeFromCart(item.productId)} className="text-danger hover:text-danger/80">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                    No hay productos agregados
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Resumen</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>RD${subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>ITBIS (18%)</span>
                    <span>RD${tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-primary">RD${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <button className="btn-primary w-full">Guardar Preventa</button>
                  <button className="btn-secondary w-full">Guardar y Aprobar</button>
                  <button onClick={() => setShowAddForm(false)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                </div>
              </div>

              <div className="card p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</p>
                <select className="input-field text-sm">
                  <option value="pending">Pendiente</option>
                  <option value="approved">Aprobada</option>
                </select>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Preventas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de pedidos anticipados</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
            <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Nueva Preventa</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Preventas', value: mockPreventas.length, color: 'text-primary' },
            { label: 'Pendientes', value: mockPreventas.filter(p => p.status === 'pending').length, color: 'text-warning' },
            { label: 'Aprobadas', value: mockPreventas.filter(p => p.status === 'approved').length, color: 'text-success' },
            { label: 'Convertidas', value: mockPreventas.filter(p => p.status === 'converted').length, color: 'text-info' },
          ].map((stat, i) => (
            <div key={i} className="card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-field pl-9"
                placeholder="Buscar por código o cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input-field sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="converted">Convertida</option>
              <option value="cancelled">Cancelada</option>
            </select>
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtros</button>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Código</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Agente</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Items</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const st = statusMap[p.status];
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-primary">{p.code}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{p.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.agent}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.date}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.items}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">RD${p.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${st.cls} inline-flex items-center gap-1`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Ver"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors" title="Editar"><Edit2 size={14} /></button>
                          {p.status === 'approved' && (
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-success hover:bg-success/10 transition-colors" title="Convertir a Venta">
                              <ArrowRight size={14} />
                            </button>
                          )}
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>Mostrando {filtered.length} de {mockPreventas.length} preventas</span>
            <div className="flex gap-1">
              <button className="px-3 py-1 rounded border border-border hover:bg-secondary transition-colors">Anterior</button>
              <button className="px-3 py-1 rounded bg-primary text-primary-foreground">1</button>
              <button className="px-3 py-1 rounded border border-border hover:bg-secondary transition-colors">Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
