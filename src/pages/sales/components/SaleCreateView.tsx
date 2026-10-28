import React, { useState, useMemo } from 'react';
import { ShoppingCart, Search, Trash2 } from 'lucide-react';
import type { Cliente, Producto, MetodoPago } from '@/types/database';
import { toast } from '@/lib/toast';
import type { CartItem } from '../types';

interface SaleCreateViewProps {
  clients: Cliente[];
  products: Producto[];
  onSubmit: (payload: {
    cliente_id: string | null;
    cliente_nombre?: string | null;
    tipo_ncf: string;
    subtotal: number;
    monto_impuesto: number;
    monto_descuento: number;
    monto_total: number;
    costo_total: number;
    metodo_pago: MetodoPago;
    monto_pagado: number;
    devuelta_entregada: number;
    items: Array<{
      producto_id: string;
      tipo_item: 'producto';
      nombre_item: string;
      precio_unitario: number;
      costo_unitario: number;
      cantidad: number;
      porcentaje_impuesto: number;
      subtotal: number;
    }>;
  }) => Promise<void>;
  onClose: () => void;
}

export const SaleCreateView: React.FC<SaleCreateViewProps> = ({
  clients,
  products,
  onSubmit,
  onClose,
}) => {
  const [customerId, setCustomerId] = useState('');
  const [tipoNcf, setTipoNcf] = useState('B02');
  const [paymentMethod, setPaymentMethod] = useState<MetodoPago>('efectivo');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [montoPagado, setMontoPagado] = useState(0);
  const [searchProd, setSearchProd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddProduct = (p: Producto) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.producto.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].cantidad += 1;
        return next;
      }
      return [...prev, { producto: p, cantidad: 1, precio_unitario: p.precio_venta }];
    });
  };

  const subtotal = useMemo(
    () =>
      Math.round(
        cart.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0) * 100
      ) / 100,
    [cart]
  );
  const tax = useMemo(
    () =>
      Math.round(
        cart.reduce((sum, item) => {
          const itemSub = item.cantidad * item.precio_unitario;
          const pct = Number(item.producto.porcentaje_impuesto ?? 0);
          return sum + itemSub * (pct / 100);
        }, 0) * 100
      ) / 100,
    [cart]
  );
  const total = useMemo(() => Math.round((subtotal + tax) * 100) / 100, [subtotal, tax]);
  const costoTotal = useMemo(
    () =>
      Math.round(
        cart.reduce((sum, item) => sum + item.cantidad * (item.producto.precio_costo || 0), 0) * 100
      ) / 100,
    [cart]
  );
  const devuelta = useMemo(
    () => Math.round(Math.max(0, montoPagado - total) * 100) / 100,
    [montoPagado, total]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Agrega al menos un producto al carrito');
      return;
    }

    const selectedClient = clients.find((c) => c.id === customerId);

    setIsSubmitting(true);
    try {
      await onSubmit({
        cliente_id: customerId || null,
        cliente_nombre: selectedClient?.nombre || 'Cliente General',
        tipo_ncf: tipoNcf,
        subtotal,
        monto_impuesto: tax,
        monto_descuento: 0,
        monto_total: total,
        costo_total: costoTotal,
        metodo_pago: paymentMethod,
        monto_pagado: paymentMethod === 'efectivo' ? (montoPagado || total) : total,
        devuelta_entregada: devuelta,
        items: cart.map((item) => ({
          producto_id: item.producto.id,
          tipo_item: 'producto',
          nombre_item: item.producto.nombre,
          precio_unitario: item.precio_unitario,
          costo_unitario: item.producto.precio_costo || 0,
          cantidad: item.cantidad,
          porcentaje_impuesto: Number(item.producto.porcentaje_impuesto ?? 0),
          subtotal: Math.round(item.cantidad * item.precio_unitario * 100) / 100,
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
            <ShoppingCart className="text-primary" size={26} />
            Nueva Venta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registrar factura con ITBIS 18% transparentado y actualizar inventario
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary">
          ← Volver a Ventas
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Información de la Venta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
                <select
                  className="input-field"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Cliente General (Contado)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} {c.rnc_cedula ? `(${c.rnc_cedula})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo Comprobante (NCF)</label>
                <select
                  className="input-field"
                  value={tipoNcf}
                  onChange={(e) => setTipoNcf(e.target.value)}
                >
                  <option value="B02">Factura Consumo (B02)</option>
                  <option value="B01">Crédito Fiscal (B01)</option>
                  <option value="B14">Gubernamental (B14)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                <select
                  className="input-field"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as MetodoPago)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="credito">Crédito (A pagar)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Productos</h3>
              <p className="text-xs text-muted-foreground">Busca y agrega ítems al carrito de la venta</p>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="input-field !pl-10"
                placeholder="Buscar producto por nombre o código..."
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border text-sm">
              {products
                .filter((p) => p.nombre.toLowerCase().includes(searchProd.toLowerCase()))
                .slice(0, 10)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleAddProduct(p)}
                    className="px-3.5 py-3 hover:bg-primary/10 cursor-pointer flex justify-between items-center transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground block truncate">{p.nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        Stock: {p.stock_actual} {p.unidad}
                      </span>
                    </div>
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
                        El carrito de ventas está vacío. Selecciona productos arriba.
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
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded"
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
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3.5 bg-secondary/20 sticky top-4">
            <h4 className="font-bold text-foreground border-b border-border pb-2.5">Resumen de Factura</h4>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal Neto</span>
              <span className="font-mono font-medium">
                RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ITBIS Transparentado (18%)</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                RD$ {tax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-black text-foreground text-lg">
              <span>Total Venta</span>
              <span className="text-primary font-mono">
                RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {paymentMethod === 'efectivo' && (
              <div className="pt-2 space-y-2">
                <label className="text-xs font-medium text-muted-foreground block">Monto Recibido</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="input-field font-mono"
                  value={montoPagado || ''}
                  onChange={(e) => setMontoPagado(Number(e.target.value))}
                />
                <div className="flex justify-between text-sm font-bold">
                  <span>Devuelta / Cambio:</span>
                  <span className="text-emerald-600 font-mono">
                    RD$ {devuelta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="submit"
                disabled={cart.length === 0 || isSubmitting}
                className="btn-primary w-full py-3 font-bold shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Procesando...' : 'Procesar y Guardar'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary w-full">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
