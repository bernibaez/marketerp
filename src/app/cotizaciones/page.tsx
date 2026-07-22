'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Plus, Search, Trash2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatNumber } from '@/lib/formatNumber';

interface Cotizacion {
  id: string;
  code: string;
  client_id: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  contacts?: { name: string } | null;
  quotation_items?: { id: string }[];
}

interface Contact { id: string; name: string; }
interface Product { id: string; name: string; sale_price: number; code: string; }

const statusMap: Record<string, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'badge-warning' },
  aprobado: { label: 'Aprobada', cls: 'badge-success' },
  rechazado: { label: 'Rechazada', cls: 'badge-danger' },
  convertido: { label: 'Convertida', cls: 'badge-info' },
  vencido: { label: 'Vencida', cls: 'bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full' },
  cancelado: { label: 'Cancelada', cls: 'badge-danger' },
};

interface CartItem { productId: string; name: string; price: number; qty: number; discount: number; }

export default function CotizacionesPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [selectedClient, setSelectedClient] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const [cotRes, contactRes, prodRes] = await Promise.all([
      supabase.from('quotations').select('*, contacts(name), quotation_items(id)').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, sale_price, code').eq('is_active', true).order('name'),
    ]);
    if (cotRes.error) setError(cotRes.error.message);
    else setCotizaciones(cotRes.data || []);
    if (contactRes.data) setContacts(contactRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = cotizaciones.filter(c => {
    const clientName = c.contacts?.name || '';
    const matchSearch = c.code.toLowerCase().includes(search.toLowerCase()) || clientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const addToCart = () => {
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) return;
    const existing = cart.find(c => c.productId === prod.id);
    if (existing) {
      setCart(cart.map(c => c.productId === prod.id ? { ...c, qty: c.qty + qty } : c));
    } else {
      setCart([...cart, { productId: prod.id, name: prod.name, price: prod.sale_price, qty, discount }]);
    }
    setSelectedProduct(''); setQty(1); setDiscount(0);
  };

  const removeFromCart = (id: string) => setCart(cart.filter(c => c.productId !== id));
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty * (1 - c.discount / 100), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  const handleSave = async (status: string = 'pendiente') => {
    if (!selectedClient) { setError('Selecciona un cliente'); return; }
    if (cart.length === 0) { setError('Agrega al menos un producto'); return; }
    setSaving(true); setError(null);
    const code = `COT-${Date.now().toString().slice(-6)}`;
    const { data: quot, error: quotErr } = await supabase.from('quotations').insert({
      code, client_id: selectedClient, status,
      subtotal, tax_amount: tax, discount_amount: 0, total,
      valid_until: validUntil || null, notes: notes || null,
    }).select().single();
    if (quotErr) { setError(quotErr.message); setSaving(false); return; }
    const items = cart.map(item => ({
      quotation_id: quot.id, product_id: item.productId,
      quantity: item.qty, unit_price: item.price,
      discount_percent: item.discount, subtotal: item.price * item.qty * (1 - item.discount / 100),
    }));
    const { error: itemsErr } = await supabase.from('quotation_items').insert(items);
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }
    setSaving(false);
    setShowAddForm(false);
    setCart([]); setSelectedClient(''); setValidUntil(''); setNotes('');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('quotation_items').delete().eq('quotation_id', id);
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) setError(error.message);
    else setCotizaciones(prev => prev.filter(c => c.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('quotations').update({ status: newStatus }).eq('id', id);
    if (error) setError(error.message);
    else setCotizaciones(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

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
          {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Información de la Cotización</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente *</label>
                    <select className="input-field" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                      <option value="">Seleccionar cliente...</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Válida hasta</label>
                    <input type="date" className="input-field" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
                    <textarea className="input-field resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condiciones de entrega, garantías, etc." />
                  </div>
                </div>
              </div>
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Productos</h3>
                <div className="flex gap-3">
                  <select className="input-field flex-1" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                    <option value="">Seleccionar producto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — RD${formatNumber(p.sale_price)}</option>)}
                  </select>
                  <input type="number" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} className="input-field w-20" placeholder="Cant." />
                  <input type="number" min={0} max={100} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="input-field w-20" placeholder="Desc%" />
                  <button onClick={addToCart} className="btn-primary px-4" disabled={!selectedProduct}><Plus size={16} /></button>
                </div>
                {cart.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Producto</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Cant.</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Precio</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Desc.</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                        <th className="py-2 w-8"></th>
                      </tr></thead>
                      <tbody>
                        {cart.map(item => (
                          <tr key={item.productId} className="border-b border-border/50">
                            <td className="py-2.5 text-foreground">{item.name}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{item.qty}</td>
                            <td className="py-2.5 text-right text-muted-foreground">RD${formatNumber(item.price)}</td>
                            <td className="py-2.5 text-center text-muted-foreground">{item.discount}%</td>
                            <td className="py-2.5 text-right font-medium text-foreground">RD${formatNumber(item.price * item.qty * (1 - item.discount / 100))}</td>
                            <td className="py-2.5 text-center"><button onClick={() => removeFromCart(item.productId)} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">No hay productos agregados</div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Resumen</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>RD${formatNumber(subtotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>ITBIS (18%)</span><span>RD${formatNumber(tax)}</span></div>
                  <div className="flex justify-between font-bold text-foreground text-base border-t border-border pt-2"><span>Total</span><span className="text-primary">RD${formatNumber(total)}</span></div>
                </div>
                <div className="space-y-2 pt-2">
                  <button onClick={() => handleSave('pendiente')} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2"><Send size={14} />{saving ? 'Guardando...' : 'Guardar Cotización'}</button>
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
            <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Nueva Cotización</button>
          </div>
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: cotizaciones.length, color: 'text-primary' },
            { label: 'Pendientes', value: cotizaciones.filter(c => c.status === 'pendiente').length, color: 'text-warning' },
            { label: 'Aprobadas', value: cotizaciones.filter(c => c.status === 'aprobado').length, color: 'text-success' },
            { label: 'Convertidas', value: cotizaciones.filter(c => c.status === 'convertido').length, color: 'text-info' },
            { label: 'Rechazadas', value: cotizaciones.filter(c => c.status === 'rechazado').length, color: 'text-danger' },
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
            <select className="input-field w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobada</option>
              <option value="convertido">Convertida</option>
              <option value="rechazado">Rechazada</option>
              <option value="vencido">Vencida</option>
            </select>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando cotizaciones...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Válida hasta</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay cotizaciones</td></tr>
                  ) : filtered.map((c, i) => (
                    <tr key={c.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      <td className="px-4 py-3 font-mono text-primary font-medium">{c.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.contacts?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.created_at?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{c.valid_until || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">RD${formatNumber(c.total)}</td>
                      <td className="px-4 py-3">
                        <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${statusMap[c.status]?.cls || 'badge-warning'}`}>
                          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
