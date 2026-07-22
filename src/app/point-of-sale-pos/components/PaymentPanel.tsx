'use client';
import React, { useState } from 'react';
import { CreditCard, Banknote, Smartphone, Split, Printer, CheckCircle, X } from 'lucide-react';
import type { CartItem, Customer } from './POSTerminal';
import { createClient } from '@/lib/supabase/client';

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';

interface PaymentPanelProps {
  total: number;
  cart: CartItem[];
  customer: Customer | null;
  onComplete: () => void;
  orderCompleted: boolean;
  onClose?: () => void;
}

const paymentMethods = [
  { id: 'cash' as PaymentMethod, label: 'Efectivo', icon: <Banknote size={18} /> },
  { id: 'card' as PaymentMethod, label: 'Tarjeta', icon: <CreditCard size={18} /> },
  { id: 'transfer' as PaymentMethod, label: 'Transferencia', icon: <Smartphone size={18} /> },
  { id: 'credit' as PaymentMethod, label: 'Crédito', icon: <Split size={18} /> },
];

const quickCash = [500, 1000, 2000, 5000];

const paymentMethodMap: Record<PaymentMethod, string> = {
  cash: 'efectivo', card: 'tarjeta', transfer: 'transferencia', credit: 'credito',
};

export default function PaymentPanel({ total, cart, customer, onComplete, orderCompleted, onClose }: PaymentPanelProps) {
  const supabase = createClient();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printReceipt, setPrintReceipt] = useState(true);

  const fmt = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cashAmount = parseFloat(cashReceived) || 0;
  const change = method === 'cash' ? Math.max(0, cashAmount - total) : 0;
  const insufficient = method === 'cash' && cashAmount > 0 && cashAmount < total;

  const handleProcess = async () => {
    if (cart.length === 0) { setError('El carrito está vacío'); return; }
    if (method === 'cash' && cashAmount < total) { setError('Monto recibido insuficiente'); return; }
    setProcessing(true); setError(null);

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty * (1 - item.discount / 100), 0);
    const taxTotal = cart.filter(i => i.tax > 0).reduce((sum, item) => {
      const lineTotal = item.price * item.qty * (1 - item.discount / 100);
      return sum + lineTotal * (item.tax / 100);
    }, 0);

    const code = `FAC-${Date.now().toString().slice(-6)}`;
    const { data: sale, error: saleErr } = await supabase.from('sales').insert({
      code, client_id: customer?.id || null,
      status: 'completado', subtotal, tax_amount: taxTotal, discount_amount: 0, total,
      payment_method: paymentMethodMap[method], payment_status: method === 'credit' ? 'pendiente' : 'pagado',
      sale_date: new Date().toISOString().slice(0, 10),
    }).select().single();

    if (saleErr) { setError(saleErr.message); setProcessing(false); return; }

    const items = cart.map(item => ({
      sale_id: sale.id, product_id: item.productId,
      quantity: item.qty, unit_price: item.price,
      tax_rate: item.tax, discount_percent: item.discount,
      subtotal: item.price * item.qty * (1 - item.discount / 100),
    }));
    const { error: itemsErr } = await supabase.from('sale_items').insert(items);
    if (itemsErr) { setError(itemsErr.message); setProcessing(false); return; }

    setProcessing(false);
    onComplete();
  };

  if (orderCompleted) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center"><CheckCircle size={32} className="text-success" /></div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">¡Venta Completada!</p>
          <p className="text-sm text-muted-foreground mt-1">{fmt(total)}</p>
        </div>
        {change > 0 && (
          <div className="w-full bg-success-bg border border-success/20 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">Cambio a entregar</p>
            <p className="text-2xl font-bold tabular-nums text-success mt-1">{fmt(change)}</p>
          </div>
        )}
        <div className="flex gap-2 w-full mt-2">
          <button className="flex-1 btn-secondary flex items-center justify-center gap-2 text-xs py-2.5"><Printer size={14} />Imprimir</button>
          <button className="flex-1 btn-primary text-xs py-2.5">Nueva Venta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">Método de Pago</span>
        {onClose && <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X size={16} /></button>}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total a Cobrar</p>
          <p className="text-3xl font-bold tabular-nums text-primary mt-1">{fmt(total)}</p>
          {customer && <p className="text-xs text-muted-foreground mt-1">Cliente: {customer.name}</p>}
        </div>

        {error && <div className="p-3 bg-danger/10 text-danger rounded-lg text-sm">{error}</div>}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Forma de Pago</p>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((m) => (
              <button key={`pm-${m.id}`} onClick={() => setMethod(m.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 active:scale-95 ${method === m.id ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                {m.icon}<span className="text-xs font-semibold">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {method === 'cash' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Monto Recibido (RD$)</label>
              <input type="number" placeholder="0.00" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)}
                className={`input-field text-lg font-bold tabular-nums text-center ${insufficient ? 'border-danger focus:ring-danger' : ''}`} />
              {insufficient && <p className="text-xs text-danger mt-1">Faltan: {fmt(total - cashAmount)}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Billetes comunes</p>
              <div className="grid grid-cols-4 gap-1.5">
                {quickCash.map((v) => (
                  <button key={`quick-${v}`} onClick={() => setCashReceived(v.toString())}
                    className="py-1.5 text-xs font-semibold bg-secondary hover:bg-border rounded-lg transition-colors active:scale-95 tabular-nums">
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
              <button onClick={() => setCashReceived(Math.ceil(total / 100) * 100 + '')}
                className="w-full mt-1.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors">
                Exacto: {fmt(Math.ceil(total / 100) * 100)}
              </button>
            </div>
            {cashAmount >= total && cashAmount > 0 && (
              <div className="bg-success-bg border border-success/20 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Cambio a entregar</p>
                <p className="text-2xl font-bold tabular-nums text-success">{fmt(change)}</p>
              </div>
            )}
          </div>
        )}

        {method === 'card' && (
          <div className="space-y-3">
            <div className="bg-info-bg border border-info/20 rounded-xl p-4 text-center">
              <CreditCard size={28} className="text-info mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Insertar o deslizar tarjeta</p>
              <p className="text-xs text-muted-foreground mt-1">Terminal listo para cobrar {fmt(total)}</p>
            </div>
          </div>
        )}

        {method === 'transfer' && (
          <div className="space-y-3">
            <div className="bg-secondary rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datos para transferencia</p>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monto:</span><span className="font-bold tabular-nums text-primary">{fmt(total)}</span></div>
            </div>
          </div>
        )}

        {method === 'credit' && (
          <div className="bg-warning-bg border border-warning/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground">Venta a crédito</p>
            <p className="text-xs text-muted-foreground mt-1">Se registrará como pago pendiente</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex-shrink-0">
        <button onClick={handleProcess} disabled={processing || cart.length === 0}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${processing || cart.length === 0 ? 'bg-secondary text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'}`}>
          {processing ? 'Procesando...' : `Cobrar ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}