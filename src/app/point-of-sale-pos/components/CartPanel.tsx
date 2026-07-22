'use client';
import React, { useState } from 'react';
import { Minus, Plus, Trash2, User, Tag, ChevronDown } from 'lucide-react';
import type { CartItem, Customer } from './POSTerminal';
function InitialAvatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
  const colors = ['bg-primary/20 text-primary', 'bg-info/20 text-info', 'bg-success/20 text-success', 'bg-warning/20 text-warning', 'bg-danger/20 text-danger'];
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${colors[name.charCodeAt(0) % colors.length]}`}>
      {initials}
    </div>
  );
}

const mockCustomers: Customer[] = [
  { id: 'cust-001', name: 'Rosa Martínez', phone: '809-555-0142', credit: 5000 },
  { id: 'cust-002', name: 'Pedro Sánchez', phone: '829-555-0287', credit: 12000 },
  { id: 'cust-003', name: 'María Torres', phone: '849-555-0398', credit: 2500 },
  { id: 'cust-004', name: 'Fernando Díaz', phone: '809-555-0511', credit: 8000 },
  { id: 'cust-005', name: 'Josefa Guerrero', phone: '829-555-0623', credit: 3500 },
];

interface CartPanelProps {
  cart: CartItem[];
  customer: Customer | null;
  onSetCustomer: (c: Customer | null) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, discount: number) => void;
  onRemove: (id: string) => void;
  globalDiscount: number;
  onSetGlobalDiscount: (d: number) => void;
  subtotal: number;
  taxTotal: number;
  globalDiscountAmount: number;
  total: number;
  onCheckout: () => void;
}

export default function CartPanel({
  cart,
  customer,
  onSetCustomer,
  onUpdateQty,
  onUpdateDiscount,
  onRemove,
  globalDiscount,
  onSetGlobalDiscount,
  subtotal,
  taxTotal,
  globalDiscountAmount,
  total,
  onCheckout,
}: CartPanelProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);

  const filteredCustomers = mockCustomers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const fmt = (v: number) =>
    `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">
          Carrito
          {cart.length > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 inline-flex items-center justify-center font-semibold">
              {cart.length}
            </span>
          )}
        </span>
        {cart.length > 0 && (
          <button
            onClick={() => setDiscountOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Tag size={13} />
            {globalDiscount > 0 ? `Desc. ${globalDiscount}%` : 'Descuento'}
          </button>
        )}
      </div>

      {/* Global discount bar */}
      {discountOpen && (
        <div className="px-3 py-2 border-b border-border bg-warning-bg/50 flex items-center gap-2 flex-shrink-0">
          <Tag size={14} className="text-warning flex-shrink-0" />
          <span className="text-xs text-warning font-medium">Descuento global:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={globalDiscount}
            onChange={(e) => onSetGlobalDiscount(Number(e.target.value))}
            className="input-field w-16 h-7 text-sm text-center py-0"
          />
          <span className="text-xs text-warning">%</span>
          <button onClick={() => setDiscountOpen(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Customer selector */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0 relative">
        {customer ? (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
              {customer.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{customer.name}</p>
              <p className="text-xs text-muted-foreground">{customer.phone}</p>
            </div>
            <button
              onClick={() => onSetCustomer(null)}
              className="text-muted-foreground hover:text-danger transition-colors flex-shrink-0"
              title="Quitar cliente"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar cliente (F3)..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="input-field pl-8 pr-7 h-8 text-sm"
              />
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            {showCustomerDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-card-hover z-20 max-h-40 overflow-y-auto">
                <div
                  className="px-3 py-2 text-xs text-muted-foreground hover:bg-secondary cursor-pointer border-b border-border"
                  onClick={() => { onSetCustomer(null); setShowCustomerDropdown(false); setCustomerSearch(''); }}
                >
                  Cliente Genérico (sin cuenta)
                </div>
                {filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-secondary cursor-pointer"
                    onClick={() => { onSetCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(''); }}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                    <span className="text-xs text-success font-medium tabular-nums flex-shrink-0">
                      Créd: {c.credit.toLocaleString('es-DO')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 px-4">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <Tag size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              El carrito está vacío
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Selecciona productos del panel izquierdo o escanea un código de barras
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {cart.map((item) => (
              <div key={item.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors group">
                <div className="flex items-start gap-2">
                  <InitialAvatar name={item.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">{item.name}</p>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-danger flex-shrink-0"
                        title="Quitar del carrito"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>

                    <div className="flex items-center justify-between mt-1.5 gap-2">
                      {/* Qty controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onUpdateQty(item.id, item.qty - 1)}
                          className="w-6 h-6 rounded-md bg-secondary hover:bg-border flex items-center justify-center transition-colors active:scale-95"
                          title="Reducir cantidad"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={item.qty}
                          onChange={(e) => onUpdateQty(item.id, Number(e.target.value))}
                          className="w-10 h-6 text-center text-xs font-semibold border border-border rounded-md bg-background tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          onClick={() => onUpdateQty(item.id, item.qty + 1)}
                          className="w-6 h-6 rounded-md bg-secondary hover:bg-border flex items-center justify-center transition-colors active:scale-95"
                          title="Aumentar cantidad"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Discount */}
                      <div className="flex items-center gap-1">
                        {editingDiscountId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.discount}
                              onChange={(e) => onUpdateDiscount(item.id, Number(e.target.value))}
                              onBlur={() => setEditingDiscountId(null)}
                              autoFocus
                              className="w-12 h-6 text-center text-xs border border-warning rounded-md bg-background focus:outline-none"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingDiscountId(item.id)}
                            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                              item.discount > 0
                                ? 'bg-warning-bg text-warning font-medium' :'text-muted-foreground hover:bg-secondary'
                            }`}
                            title="Editar descuento de línea"
                          >
                            {item.discount > 0 ? `-${item.discount}%` : 'Desc.'}
                          </button>
                        )}
                      </div>

                      {/* Line total */}
                      <p className="text-sm font-bold tabular-nums text-foreground ml-auto">
                        {fmt(item.price * item.qty * (1 - item.discount / 100))}
                      </p>
                    </div>
                    {item.tax > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ITBIS {item.tax}%: {fmt(item.price * item.qty * (1 - item.discount / 100) * (item.tax / 100))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {cart.length > 0 && (
        <div className="border-t border-border px-3 py-3 space-y-1.5 flex-shrink-0 bg-secondary/20">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">{fmt(subtotal)}</span>
          </div>
          {globalDiscountAmount > 0 && (
            <div className="flex justify-between text-xs text-warning">
              <span>Descuento global ({globalDiscount}%)</span>
              <span className="tabular-nums font-medium">-{fmt(globalDiscountAmount)}</span>
            </div>
          )}
          {taxTotal > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ITBIS (18%)</span>
              <span className="tabular-nums font-medium text-foreground">{fmt(taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-base font-bold text-foreground">TOTAL</span>
            <span className="text-xl font-bold tabular-nums text-primary">{fmt(total)}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full btn-primary py-3 text-base mt-2 xl:hidden"
          >
            Proceder al Pago →
          </button>
        </div>
      )}
    </div>
  );
}