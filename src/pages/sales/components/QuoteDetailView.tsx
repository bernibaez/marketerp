import React from 'react';
import { FileText, ArrowRightLeft } from 'lucide-react';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';
import { saleStatusMap } from '../types';

interface QuoteDetailViewProps {
  quote: CotizacionConDetalle;
  loadingDetail: boolean;
  onConvert: (quote: CotizacionConDetalle) => void;
  onClose: () => void;
}

export const QuoteDetailView: React.FC<QuoteDetailViewProps> = ({
  quote,
  loadingDetail,
  onConvert,
  onClose,
}) => {
  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="text-primary" size={26} />
            Detalle de Cotización {quote.codigo}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estado: {saleStatusMap[quote.estado]?.label ?? quote.estado} · Válida hasta {quote.valida_hasta || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onConvert(quote)}
            className="btn-primary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
          >
            <ArrowRightLeft size={14} /> Facturar Cotización
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex items-center gap-1.5 font-bold text-xs py-2 px-3.5"
          >
            ← Volver a Cotizaciones
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
              Ítems de Cotización ({quote.items?.length || 0})
            </h3>
            {loadingDetail ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Cargando ítems...</div>
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
                  <tbody className="divide-y divide-border">
                    {(quote.items || []).map((item) => (
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
              Información de Cotización
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{quote.cliente_nombre || 'Cliente general'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fecha emisión:</span><span>{new Date(quote.creado_en).toLocaleString('es-DO')}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Válida hasta:</span><span className="font-mono">{quote.valida_hasta || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vendedor:</span><span>{quote.vendedor_nombre || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Estado:</span><span className={saleStatusMap[quote.estado]?.cls ?? 'badge-neutral'}>{saleStatusMap[quote.estado]?.label ?? quote.estado}</span></div>
            </div>
          </div>

          <div className="card p-5 space-y-3 bg-card border border-border shadow-sm text-xs">
            <h3 className="font-semibold text-foreground text-sm border-b border-border pb-2">
              Totales
            </h3>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-mono">RD$ {quote.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-muted-foreground">ITBIS:</span><span className="font-mono text-amber-600 dark:text-amber-400">RD$ {quote.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-black text-base text-foreground"><span>Total:</span><span className="text-primary font-mono">RD$ {quote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onConvert(quote)}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
            >
              <ArrowRightLeft size={15} /> Convertir a Venta
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full py-2.5 text-xs font-bold"
            >
              ← Volver a Cotizaciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
