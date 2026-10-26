import React from 'react';
import { FileText, Printer, RotateCcw } from 'lucide-react';
import type { VentaConDetalle } from '@/services/ventas.service';
import { metodoLabel } from '../types';

interface SaleDetailViewProps {
  sale: VentaConDetalle;
  loadingDetail: boolean;
  onPrint: (sale: VentaConDetalle) => void;
  onReturn: (sale: VentaConDetalle) => void;
  onClose: () => void;
}

export const SaleDetailView: React.FC<SaleDetailViewProps> = ({
  sale,
  loadingDetail,
  onPrint,
  onReturn,
  onClose,
}) => {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="text-primary" size={26} />
            Detalle de Factura {sale.numero_factura}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sale.ncf ? `Comprobante Fiscal: ${sale.ncf}` : 'Factura de Venta'} · Emitida el {new Date(sale.creado_en).toLocaleString('es-DO')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPrint(sale)}
            className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
          >
            <Printer size={15} /> Imprimir Factura
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
          >
            ← Volver a Ventas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
              Ítems de Facturación ({sale.detalle_ventas?.length || 0})
            </h3>
            {loadingDetail ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Cargando productos de factura...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-secondary/30">
                      <th className="text-left py-2 px-3">Producto</th>
                      <th className="text-center py-2 px-3">Cantidad</th>
                      <th className="text-right py-2 px-3">Precio Unit.</th>
                      <th className="text-right py-2 px-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border">
                    {(sale.detalle_ventas || []).map((item) => (
                      <tr key={item.id} className="hover:bg-secondary/20">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-foreground text-sm">{item.nombre_item}</p>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-foreground">
                          {item.cantidad}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          RD$ {item.precio_unitario.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          RD$ {item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
              Información General
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{sale.cliente_nombre || 'Cliente general'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fecha:</span><span>{new Date(sale.creado_en).toLocaleString('es-DO')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cajero:</span><span>{sale.cajero_nombre || 'Cajero'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Método:</span><span className="badge-neutral font-medium">{metodoLabel[sale.metodo_pago] || sale.metodo_pago}</span></div>
              {sale.ncf && <div className="flex justify-between"><span className="text-muted-foreground">NCF:</span><span className="font-mono font-bold">{sale.ncf}</span></div>}
            </div>
          </div>

          <div className="card p-5 space-y-3 bg-card border border-border shadow-sm text-xs">
            <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
              Totales de la Factura
            </h3>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal Neto:</span><span className="font-mono">RD$ {sale.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Descuento:</span><span className="font-mono text-emerald-600">- RD$ {sale.monto_descuento.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-muted-foreground">ITBIS (18%):</span><span className="font-mono text-amber-600 dark:text-amber-400">RD$ {sale.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-black text-base text-foreground"><span>Total:</span><span className="text-primary font-mono">RD$ {sale.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onReturn(sale)}
              className="btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 border-rose-300"
            >
              <RotateCcw size={14} /> Hacer Devolución sobre esta Factura
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full py-2.5 text-xs font-bold"
            >
              ← Volver a Ventas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
