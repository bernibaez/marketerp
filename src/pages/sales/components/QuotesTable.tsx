import React from 'react';
import { ArrowRightLeft, Eye } from 'lucide-react';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';
import { saleStatusMap } from '../types';

interface QuotesTableProps {
  quotes: CotizacionConDetalle[];
  loading: boolean;
  onConvert: (quote: CotizacionConDetalle) => void;
  onViewDetail: (quote: CotizacionConDetalle) => void;
}

export const QuotesTable: React.FC<QuotesTableProps> = ({
  quotes,
  loading,
  onConvert,
  onViewDetail,
}) => {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                Fecha Emisión
              </th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                Válida hasta
              </th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Cargando cotizaciones desde Supabase...
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No hay cotizaciones registradas
                </td>
              </tr>
            ) : (
              quotes.map((q, i) => (
                <tr
                  key={q.id}
                  className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-secondary/10'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-primary font-bold">{q.codigo}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{q.cliente_nombre || 'Cliente general'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {new Date(q.creado_en).toLocaleDateString('es-DO')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs font-mono">
                    {q.valida_hasta || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    RD$ {q.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={saleStatusMap[q.estado]?.cls ?? 'badge-neutral'}>
                      {saleStatusMap[q.estado]?.label ?? q.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {q.estado === 'pendiente' && (
                        <button
                          onClick={() => onConvert(q)}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs font-bold flex items-center gap-1 transition-all"
                          title="Convertir a Factura"
                        >
                          <ArrowRightLeft size={13} /> Convertir Venta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onViewDetail(q)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Ver Detalle Cotización"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
