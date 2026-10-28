import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, MoreHorizontal, ArrowRight } from 'lucide-react';
import { useVentas } from '@/hooks/useVentas';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

export default function RecentTransactions() {
  const navigate = useNavigate();
  const { ventas, loading } = useVentas({ pagina: 1, limite: 4 });

  const transactions = ventas.slice(0, 4).map((v) => {
    const d = new Date(v.creado_en);
    const methodLabel =
      v.metodo_pago === 'efectivo'
        ? 'Efectivo'
        : v.metodo_pago === 'tarjeta'
          ? 'Tarjeta'
          : v.metodo_pago === 'transferencia'
            ? 'Transferencia'
            : v.metodo_pago === 'credito'
              ? 'Crédito'
              : 'Mixto';

    return {
      id: v.id,
      ref: v.numero_factura || `FAC-${v.id.slice(0, 8).toUpperCase()}`,
      method: methodLabel,
      total: `RD$ ${Number(v.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      status: v.estado === 'anulada' ? 'Anulada' : 'Pagada',
      time: d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
          Transacciones recientes
        </h3>

        <Link
          to="/sales"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          <span>Ver todas</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 pr-4 font-semibold">Factura</th>
              <th className="py-2.5 px-4 font-semibold">Método</th>
              <th className="py-2.5 px-4 font-semibold text-center">Total</th>
              <th className="py-2.5 px-4 font-semibold text-center">Estado</th>
              <th className="py-2.5 px-4 font-semibold text-right">Hora</th>
              <th className="py-2.5 pl-4 text-center w-16" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`loading-row-${i}`}>
                  <td className="py-3 pr-4"><Skeleton className="h-4 w-32" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="py-3 pl-4" />
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No hay transacciones recientes registradas
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors"
                >
                  {/* Factura */}
                  <td className="py-3.5 pr-4 font-bold text-slate-800 dark:text-slate-100 font-mono text-xs">
                    {txn.ref}
                  </td>

                  {/* Método */}
                  <td className="py-3.5 px-4 font-medium text-slate-500 dark:text-slate-400">
                    {txn.method}
                  </td>

                  {/* Total */}
                  <td className="py-3.5 px-4 text-center font-black tabular-nums text-slate-900 dark:text-white">
                    {txn.total}
                  </td>

                  {/* Estado Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        txn.status === 'Pagada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          txn.status === 'Pagada' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{txn.status}</span>
                    </span>
                  </td>

                  {/* Hora */}
                  <td className="py-3.5 px-4 text-right font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                    {txn.time}
                  </td>

                  {/* Acciones */}
                  <td className="py-3.5 pl-4 text-center">
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <button
                        type="button"
                        onClick={() => navigate(`/sales?q=${encodeURIComponent(txn.ref)}`)}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Ver detalles"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/sales?q=${encodeURIComponent(txn.ref)}`)}
                        className="p-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Más opciones"
                      >
                        <MoreHorizontal size={15} />
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
}
