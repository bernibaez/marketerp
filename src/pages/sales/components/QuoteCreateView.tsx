import React, { useState, useMemo } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import type { Cliente, Producto } from '@/types/database';
import { toast } from '@/lib/toast';
import type { CartItem } from '../types';

interface QuoteCreateViewProps {
  clients: Cliente[];
  products: Producto[];
  onSubmit: (payload: {
    cliente_id: string | null;
    subtotal: number;
    monto_impuesto: number;
    monto_total: number;
    valida_hasta: string;
    items: Array<{
      producto_id: string;
      nombre_item: string;
      precio_unitario: number;
      cantidad: number;
      subtotal: number;
    }>;
  }) => Promise<void>;
  onClose: () => void;
}

export const QuoteCreateView: React.FC<QuoteCreateViewProps> = ({
  clients,
  products,
  onSubmit,
  onClose,
}) => {
  const [customerId, setCustomerId] = useState('');
  const [validaHasta, setValidaHasta] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0),
    [cart]
  );
  const tax = useMemo(() => Math.round(subtotal * 0.18 * 100) / 100, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto a la cotización');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        cliente_id: customerId || null,
        subtotal,
        monto_impuesto: tax,
        monto_total: total,
        valida_hasta: validaHasta,
        items: cart.map((it) => ({
          producto_id: it.producto.id,
          nombre_item: it.producto.nombre,
          precio_unitario: it.precio_unitario,
          cantidad: it.cantidad,
          subtotal: it.cantidad * it.precio_unitario,
        })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="text-primary" size={26} />
            Nueva Cotización
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crear cotización comercial con validez y productos del catálogo
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary">
          ← Volver a Ventas
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Información de la Cotización</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
              <select
                className="input-field"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Válida Hasta</label>
              <input
                type="date"
                className="input-field"
                value={validaHasta}
                onChange={(e) => setValidaHasta(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">Productos</h3>
            <p className="text-xs text-muted-foreground">Selecciona productos para agregarlos a la cotización</p>
          </div>
          <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border text-sm">
            {products.slice(0, 12).map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setCart((prev) => {
                    const idx = prev.findIndex((item) => item.producto.id === p.id);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx].cantidad += 1;
                      return next;
                    }
                    return [...prev, { producto: p, cantidad: 1, precio_unitario: p.precio_venta }];
                  });
                }}
                className="px-3.5 py-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center transition-colors gap-3"
              >
                <span className="font-semibold text-foreground truncate">{p.nombre}</span>
                <span className="font-bold text-primary whitespace-nowrap">
                  RD$ {p.precio_venta.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Producto</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Precio</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Cant.</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Subtotal</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Selecciona productos arriba para agregarlos a la cotización
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5 font-medium">{item.producto.nombre}</td>
                      <td className="px-3 py-2.5">RD$ {item.precio_unitario.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.cantidad}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setCart((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, cantidad: val } : c))
                            );
                          }}
                          className="input-field text-center w-16 py-1.5 text-sm inline-block"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold">
                        RD$ {(item.cantidad * item.precio_unitario).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-500 rounded hover:bg-rose-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
            <div className="font-bold text-base">
              Total Cotización:{' '}
              <span className="text-primary font-mono text-lg">
                RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cart.length === 0 || isSubmitting}
                className="btn-primary font-bold disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Cotización'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
