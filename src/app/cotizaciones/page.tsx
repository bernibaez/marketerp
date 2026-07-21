'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Plus, Search, Filter, Download, Eye, Edit2, Trash2, ArrowRight, Printer, Send } from 'lucide-react';

interface Cotizacion {
  id: number;
  code: string;
  customer: string;
  date: string;
  validUntil: string;
  items: number;
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'approved' | 'rejected' | 'converted' | 'expired';
  agent: string;
  notes: string;
}

const mockCotizaciones: Cotizacion[] = [
  { id: 1, code: 'COT-001', customer: 'Empresa ABC S.R.L.', date: '2024-01-15', validUntil: '2024-01-22', items: 15, subtotal: 62000, tax: 11160, total: 73160, status: 'pending', agent: 'Roberto Díaz', notes: 'Incluye descuento por volumen' },
  { id: 2, code: 'COT-002', customer: 'Distribuidora XYZ', date: '2024-01-14', validUntil: '2024-01-21', items: 8, subtotal: 38500, tax: 6930, total: 45430, status: 'approved', agent: 'Luisa Fernández', notes: '' },
  { id: 3, code: 'COT-003', customer: 'Juan Pérez', date: '2024-01-12', validUntil: '2024-01-19', items: 4, subtotal: 9200, tax: 1656, total: 10856, status: 'converted', agent: 'Roberto Díaz', notes: 'Convertida a FAC-008' },
  { id: 4, code: 'COT-004', customer: 'Supermercado El Sol', date: '2024-01-10', validUntil: '2024-01-17', items: 30, subtotal: 125000, tax: 22500, total: 147500, status: 'expired', agent: 'Miguel Torres', notes: '' },
  { id: 5, code: 'COT-005', customer: 'Rosa Jiménez', date: '2024-01-09', validUntil: '2024-01-16', items: 6, subtotal: 14000, tax: 2520, total: 16520, status: 'rejected', agent: 'Luisa Fernández', notes: 'Cliente prefirió otro proveedor' },
  { id: 6, code: 'COT-006', customer: 'Colmado Don Pedro', date: '2024-01-08', validUntil: '2024-01-15', items: 20, subtotal: 55000, tax: 9900, total: 64900, status: 'approved', agent: 'Miguel Torres', notes: '' },
];

const products = [
  { id: 1, name: 'Arroz Selecto 5lb', price: 280, unit: 'Saco' },
  { id: 2, name: 'Aceite Vegetal 1L', price: 350, unit: 'Botella' },
  { id: 3, name: 'Azúcar Blanca 2lb', price: 200, unit: 'Bolsa' },
  { id: 4, name: 'Leche Entera 1L', price: 300, unit: 'Caja' },
  { id: 5, name: 'Pollo Entero', price: 500, unit: 'Unidad' },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  approved: { label: 'Aprobada', cls: 'badge-success' },
  rejected: { label: 'Rechazada', cls: 'badge-danger' },
  converted: { label: 'Convertida', cls: 'badge-info' },
  expired: { label: 'Vencida', cls: 'bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full' },
};

interface CartItem { productId: number; name: string; price: number; qty: number; discount: number; unit: string; }

export default function CotizacionesPage() {
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);

  const filtered = mockCotizaciones.filter(c => {
    const matchSearch = c.code.toLowerCase().includes(search.toLowerCase()) || c.customer.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const addToCart = () => {
    const prod = products.find(p => p.id === Number(selectedProduct));
    if (!prod) return;
    const existing = cart.find(c => c.productId === prod.id);
    if (existing) {
      setCart(cart.map(c => c.productId === prod.id ? { ...c, qty: c.qty + qty } : c));
    } else {
      setCart([...cart, { productId: prod.id, name: prod.name, price: prod.price, qty, discount, unit: prod.unit }]);
    }
    setSelectedProduct(''); setQty(1); setDiscount(0);
  };

  const removeFromCart = (id: number) => setCart(cart.filter(c => c.productId !== id));
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  if (showAddForm) {
    return (
      <AppLayout currentPath={pathname}>
        <div className="space-y-6 slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nueva Cotización</h1>
              <p className="text-sm text-muted-foreground mt-1">Crear propuesta comercial</p>
            </div>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">← Volver</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Cotización</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
                    <select className="input-field">
                      <option>Seleccionar cliente...</option>
                      <option>Empresa ABC S.R.L.</option>
                      <option>Distribuidora XYZ</option>
                      <option>Juan Pérez</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" className="input-field" defaultValue="2024-01-15" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Válida hasta *</label>
                    <input type="date" className="input-field" />
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
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Condiciones de Pago</label>
                    <select className="input-field">
                      <option>Contado</option>
                      <option>15 días</option>
                      <option>30 días</option>
                      <option>60 días</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descuento Global (%)</label>
                    <input type="number" min={0} max={100} className="input-field" placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Términos y Condiciones</label>
                    <textarea className="input-field resize-none" rows={2} placeholder="Condiciones de entrega, garantías, etc." />
                  </div>
                </div>
              </div>

              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Productos</h3>
                <div className="flex gap-3">
                  <select className="input-field flex-1" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                    <option value="">Seleccionar producto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — RD${p.price}</option>)}
                  </select>
                  <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="input-field w-20" placeholder="Cant." />
                  <input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="input-field w-20" placeholder="Desc%" />
                  <button onClick={addToCart} className="btn-primary px-4" disabled={!selectedProduct}><Plus size={16} /></button>
                </div>

                {cart.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">Cant.</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Precio</th>
                          <th className="text-center py-2 text-muted-foreground font-medium">Desc.</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                          <th className="py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.productId} className="border-b border-border/50">
                            <td className="py-2.5 text-foreground">{item.name}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{item.qty}</td>
                            <td className="py-2.5 text-right text-muted-foreground">RD${item.price.toLocaleString()}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{item.discount}%</td>
                            <td className="py-2.5 text-right font-medium text-foreground">RD${(item.price * item.qty * (1 - item.discount / 100)).toLocaleString()}</td>
                            <td className="py-2.5 text-center">
                              <button onClick={() => removeFromCart(item.productId)} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button>
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

            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Resumen</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>RD${subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>ITBIS (18%)</span><span>RD${tax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-primary">RD${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <button className="btn-primary w-full flex items-center justify-center gap-2"><Send size={14} />Enviar Cotización</button>
                  <button className="btn-secondary w-full flex items-center justify-center gap-2"><Printer size={14} />Imprimir</button>
                  <button className="btn-secondary w-full">Guardar Borrador</button>
                  <button onClick={() => setShowAddForm(false)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                </div>
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
            <h1 className="text-2xl font-bold text-foreground">Cotizaciones</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestión de propuestas comerciales</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Download size={16} />Exportar</button>
            <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Nueva Cotización</button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: mockCotizaciones.length, color: 'text-primary' },
            { label: 'Pendientes', value: mockCotizaciones.filter(c => c.status === 'pending').length, color: 'text-warning' },
            { label: 'Aprobadas', value: mockCotizaciones.filter(c => c.status === 'approved').length, color: 'text-success' },
            { label: 'Convertidas', value: mockCotizaciones.filter(c => c.status === 'converted').length, color: 'text-info' },
            { label: 'Rechazadas', value: mockCotizaciones.filter(c => c.status === 'rejected').length, color: 'text-danger' },
          ].map((stat, i) => (
            <div key={i} className="card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="input-field pl-9" placeholder="Buscar por código o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="converted">Convertida</option>
              <option value="rejected">Rechazada</option>
              <option value="expired">Vencida</option>
            </select>
            <button className="btn-secondary flex items-center gap-2"><Filter size={16} />Filtros</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Código</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Agente</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Válida hasta</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Estado</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const st = statusMap[c.status];
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-primary">{c.code}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{c.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.agent}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.validUntil}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">RD${c.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Ver"><Eye size={14} /></button>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-info hover:bg-info/10 transition-colors" title="Enviar"><Send size={14} /></button>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors" title="Editar"><Edit2 size={14} /></button>
                          {c.status === 'approved' && (
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-success hover:bg-success/10 transition-colors" title="Convertir a Venta"><ArrowRight size={14} /></button>
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
            <span>Mostrando {filtered.length} de {mockCotizaciones.length} cotizaciones</span>
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
