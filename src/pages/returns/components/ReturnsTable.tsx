import React from 'react';
import { RotateCcw, Check, XCircle, Eye } from 'lucide-react';
import type { PosReturn } from '@/lib/posStore';
import { StatusBadge } from './StatusBadge';

interface ReturnsTableProps {
  loading: boolean;
  returns: PosReturn[];
  onSelectReturn: (r: PosReturn) => void;
  onApproveReturn: (r: PosReturn) => void;
  onOpenRejectModal: (r: PosReturn) => void;
  processing: boolean;
}

export default function ReturnsTable({
  loading,
  returns,
  onSelectReturn,
  onApproveReturn,
  onOpenRejectModal,
  processing,
}: ReturnsTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Factura Ref.</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                Fecha/Hora
              </th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">
                Usuario
              </th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">
                Motivo
              </th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones Admin</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Cargando devoluciones…
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  <RotateCcw size={28} className="mx-auto mb-2 opacity-40" />
                  No hay devoluciones registradas con estos filtros
                </td>
              </tr>
            ) : (
              returns.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => onSelectReturn(r)}
                  className={`border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer ${
                    i % 2 === 0 ? '' : 'bg-secondary/10'
                  } ${r.status === 'pending' ? 'bg-amber-500/5' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-danger font-bold">{r.code}</td>
                  <td className="px-4 py-3 font-mono text-primary font-semibold">{r.saleCode}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.customer}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {r.date} {r.time}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{r.user}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">
                    RD$ {r.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{r.reason}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onApproveReturn(r)}
                            disabled={processing}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-all shadow-xs disabled:opacity-50"
                            title="Aprobar Devolución"
                          >
                            <Check size={14} /> Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenRejectModal(r)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                            title="Rechazar Devolución"
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectReturn(r)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver detalles y comprobante"
                        >
                          <Eye size={16} />
                        </button>
                      )}
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
}
