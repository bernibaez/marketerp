import React, { useState } from 'react';
import {
  FileText,
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Smartphone,
  Split,
  Layers,
  XCircle,
  CheckCircle,
  MoreVertical,
  Eye,
  Edit,
  Printer,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronDown,
} from 'lucide-react';
import type { VentaConDetalle } from '@/services/ventas.service';
import { metodoLabel } from '../types';

interface SalesTableProps {
  sales: VentaConDetalle[];
  totalSales: number;
  loading: boolean;
  error?: string | null;
  canSeeAllSales: boolean;
  canEditSales: boolean;
  canDeleteSales: boolean;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onViewDetail: (sale: VentaConDetalle) => void;
  onEditSale: (sale: VentaConDetalle) => void;
  onPrintSale: (sale: VentaConDetalle) => void;
  onReturnSale: (sale: VentaConDetalle) => void;
  onAnularSale: (sale: VentaConDetalle) => void;
}

export const SalesTable: React.FC<SalesTableProps> = ({
  sales,
  totalSales,
  loading,
  error,
  canSeeAllSales,
  canEditSales,
  canDeleteSales,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onViewDetail,
  onEditSale,
  onPrintSale,
  onReturnSale,
  onAnularSale,
}) => {
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const totalCount = totalSales || sales.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startRecord = totalCount > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(totalCount, page * limit);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="card overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
      {error && (
        <div className="px-5 py-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold border-b border-rose-200 dark:border-rose-900">
          {error}
        </div>
      )}
      {!canSeeAllSales && (
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-xs font-medium border-b border-slate-200 dark:border-slate-800">
          Mostrando solo tus ventas. Para editar o anular una factura, solicita permiso a un administrador.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
              <th className="text-left px-5 py-3.5">Factura / NCF</th>
              <th className="text-left px-4 py-3.5">
                <div className="flex items-center gap-1">
                  <span>Fecha / Hora</span>
                  <ArrowRightLeft size={12} className="rotate-90 text-slate-400" />
                </div>
              </th>
              <th className="text-left px-4 py-3.5">Cliente</th>
              <th className="text-left px-4 py-3.5">Cajero</th>
              <th className="text-center px-4 py-3.5">Método de Pago</th>
              <th className="text-right px-5 py-3.5">Total</th>
              <th className="text-right px-5 py-3.5">Ganancia Bruta</th>
              <th className="text-center px-4 py-3.5">Estado</th>
              <th className="text-right px-5 py-3.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  Cargando ventas desde Supabase...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  No se encontraron ventas registradas
                </td>
              </tr>
            ) : (
              sales.map((s, i) => {
                const openUpward = i >= sales.length - 2 || (sales.length > 3 && i >= sales.length / 2);
                const ganancia = s.monto_total - s.costo_total;
                const marginPct = s.monto_total > 0 ? ((ganancia / s.monto_total) * 100).toFixed(1) : '0.0';

                return (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="font-mono text-slate-900 dark:text-white font-bold text-xs">
                            {s.numero_factura}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            <span>{s.ncf ? `NCF: ${s.ncf}` : 'Factura Simple'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(s.creado_en).toLocaleDateString('es-DO')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {new Date(s.creado_en).toLocaleTimeString('es-DO', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {s.cliente_nombre || 'Cliente general'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {s.cajero_nombre || 'super admin'}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                          s.metodo_pago === 'efectivo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                            : s.metodo_pago === 'tarjeta'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800'
                              : s.metodo_pago === 'transferencia'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                                : s.metodo_pago === 'credito'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {s.metodo_pago === 'efectivo' && <Banknote size={14} />}
                        {s.metodo_pago === 'tarjeta' && <CreditCard size={14} />}
                        {s.metodo_pago === 'transferencia' && <Smartphone size={14} />}
                        {s.metodo_pago === 'credito' && <Split size={14} />}
                        {s.metodo_pago === 'mixto' && <Layers size={14} />}
                        <span className="capitalize">{metodoLabel[s.metodo_pago] || s.metodo_pago}</span>
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="font-extrabold text-xs tabular-nums text-slate-900 dark:text-white">
                        RD$ {s.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        RD$ {s.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} + ITBIS RD$ {s.monto_impuesto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="font-extrabold text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                        RD$ {ganancia.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {marginPct}%
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                          (s.estado as string) === 'anulada' || (s.estado as string) === 'cancelled'
                            ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                        }`}
                      >
                        {(s.estado as string) === 'anulada' || (s.estado as string) === 'cancelled' ? (
                          <>
                            <XCircle size={13} />
                            <span>Anulada</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={13} />
                            <span>Completada</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setOpenActionsId(openActionsId === s.id ? null : s.id)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                        >
                          <span>Acciones</span>
                          <MoreVertical size={14} className="text-slate-400" />
                        </button>

                        {openActionsId === s.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenActionsId(null)}
                            />
                            <div
                              className={`absolute right-0 ${
                                openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                              } w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-40 py-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs animate-in fade-in zoom-in-95`}
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionsId(null);
                                    onViewDetail(s);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                >
                                  <Eye size={15} className="text-emerald-600" />
                                  <span>Ver Detalle</span>
                                </button>
                                {canEditSales && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsId(null);
                                      onEditSale(s);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                  >
                                    <Edit size={15} className="text-amber-500" />
                                    <span>Editar Factura</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionsId(null);
                                    onPrintSale(s);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                >
                                  <Printer size={15} className="text-blue-500" />
                                  <span>Imprimir Factura</span>
                                </button>
                                {s.estado !== 'anulada' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsId(null);
                                      onReturnSale(s);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                  >
                                    <RotateCcw size={15} />
                                    <span>Hacer Devolución</span>
                                  </button>
                                )}
                              </div>
                              {canDeleteSales && s.estado !== 'anulada' && (
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsId(null);
                                      onAnularSale(s);
                                    }}
                                    className="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                    <span>Eliminar / Anular</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
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

      {/* Pagination Bar */}
      <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
        <div>
          Mostrando {startRecord} a {endRecord} de {totalCount.toLocaleString()} ventas
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
              }}
              className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <span>por página</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map((pNum, pIdx) =>
              typeof pNum === 'number' ? (
                <button
                  key={`pnum-${pNum}`}
                  type="button"
                  onClick={() => onPageChange(pNum)}
                  className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center transition-colors cursor-pointer ${
                    page === pNum
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pNum}
                </button>
              ) : (
                <span key={`pdots-${pIdx}`} className="px-1 text-slate-400">
                  ...
                </span>
              )
            )}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronDown size={16} className="-rotate-90" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Ir a</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= totalPages) onPageChange(val);
              }}
              className="w-14 h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-bold text-slate-800 dark:text-slate-200"
            />
            <span>de {totalPages}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
