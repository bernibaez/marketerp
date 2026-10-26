import React from 'react';
import { RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { DevolucionConDetalle } from '@/services/devoluciones.service';
import { formatCleanDateTime } from '../types';

interface ReturnsTableProps {
  returns: DevolucionConDetalle[];
  loading: boolean;
  onApprove: (id: string, codigo: string) => void;
  onReject: (id: string) => void;
}

export const ReturnsTable: React.FC<ReturnsTableProps> = ({
  returns,
  loading,
  onApprove,
  onReject,
}) => {
  return (
    <div className="card overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs">
      <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw size={15} className="text-[#007052]" />
            Devoluciones y Reembolsos Registrados
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Historial de solicitudes de devolución y notas de crédito emitidas
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Factura Ref.</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Cliente</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 text-right">Total Reembolso</th>
              <th className="px-4 py-3 text-left hidden lg:table-cell">Motivo</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs">
                  Cargando devoluciones...
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs">
                  No hay devoluciones registradas
                </td>
              </tr>
            ) : (
              returns.map((r) => {
                const isGenericClient =
                  !r.cliente_nombre ||
                  r.cliente_nombre.trim() === 'Cliente general' ||
                  r.cliente_nombre.trim() === 'Consumidor Final';

                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {r.codigo}
                    </td>

                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 text-xs">
                      {r.numero_factura || '—'}
                    </td>

                    <td className="px-4 py-3 hidden md:table-cell">
                      {isGenericClient ? (
                        <span className="text-slate-400 text-xs italic">Consumidor Final</span>
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-xs">
                          {r.cliente_nombre}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs whitespace-nowrap">
                      {formatCleanDateTime(r.creado_en)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                      RD$ {Number(r.monto_total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>

                    <td
                      className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden lg:table-cell text-xs max-w-[180px] truncate"
                      title={r.motivo}
                    >
                      {r.motivo}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {r.estado === 'aprobada' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          <CheckCircle size={12} /> Aprobada
                        </span>
                      ) : r.estado === 'rechazada' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                          <XCircle size={12} /> Rechazada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          <Clock size={12} /> Pendiente
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.estado === 'pendiente' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onApprove(r.id, r.codigo)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <CheckCircle size={13} /> Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(r.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            >
                              <XCircle size={13} /> Rechazar
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                            ✓ Procesado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
