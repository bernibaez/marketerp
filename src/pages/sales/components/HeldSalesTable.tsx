import React, { useState } from 'react';
import { Pause, Play, Trash2, Eye, User, Monitor, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { HeldSale } from '@/services/ventasSuspendidas.service';
import { eliminarVentaSuspendida } from '@/services/ventasSuspendidas.service';
import { toast } from '@/lib/toast';

interface Props {
  heldSales: HeldSale[];
  loading: boolean;
  onRefresh: () => void;
  canManage: boolean;
}

export function HeldSalesTable({ heldSales, loading, onRefresh, canManage }: Props) {
  const navigate = useNavigate();
  const [viewingSale, setViewingSale] = useState<HeldSale | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Deseas descartar definitivamente esta venta suspendida?')) return;
    setDeletingId(id);
    try {
      await eliminarVentaSuspendida(id);
      toast.success('Venta suspendida eliminada correctamente');
      onRefresh();
    } catch {
      toast.error('Error al eliminar la venta');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResumeInPos = (sale: HeldSale) => {
    // Redirigir al POS; en POS el hook usePOSHeldSales ya tiene la venta sincronizada
    navigate('/point-of-sale-pos');
    toast.info(`Abre la ventana de "Pausar/Retomar" en el POS para facturar la venta "${sale.label}"`);
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Pause size={18} className="text-amber-500" />
            Ventas Suspendidas / En Espera
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ventas pausadas por los cajeros en las terminales del punto de venta en tiempo real
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
          {heldSales.length} {heldSales.length === 1 ? 'venta en espera' : 'ventas en espera'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
              <th className="text-left px-4 py-3">Etiqueta / Referencia</th>
              <th className="text-left px-4 py-3">Cajero Responsable</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Caja</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Fecha / Hora</th>
              <th className="text-center px-4 py-3">Ítems</th>
              <th className="text-right px-4 py-3">Monto Estimado</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                  Cargando ventas suspendidas…
                </td>
              </tr>
            ) : heldSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Pause size={18} />
                    </div>
                    <p className="font-semibold text-foreground">No hay ventas suspendidas actualmente</p>
                    <p className="text-xs text-muted-foreground">
                      Cuando un cajero pause una compra en el POS, aparecerá aquí automáticamente.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              heldSales.map((s) => {
                const cartItems = Array.isArray(s.cart) ? s.cart : [];
                const totalUnits = cartItems.reduce((acc: number, it: any) => acc + Number(it.qty || 1), 0);
                const displayTotal = s.total != null && s.total > 0
                  ? s.total
                  : cartItems.reduce((acc: number, it: any) => acc + (Number(it.price || 0) * Number(it.qty || 1)), 0);

                return (
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        <span className="truncate max-w-[200px]" title={s.label}>
                          {s.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-muted-foreground shrink-0" />
                        <span>{s.cashierName || 'Cajero no asignado'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Monitor size={13} className="text-muted-foreground shrink-0" />
                        <span>{s.cajaLabel || 'Caja POS'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-muted-foreground shrink-0" />
                        <span>{new Date(s.savedAt).toLocaleString('es-DO')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {cartItems.length} ({totalUnits} uds)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">
                      RD$ {displayTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingSale(s)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
                          title="Ver detalle de ítems"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResumeInPos(s)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          title="Retomar en el POS"
                        >
                          <Play size={11} className="fill-white" />
                          <span>Retomar</span>
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            disabled={deletingId === s.id}
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                            title="Eliminar venta suspendida"
                          >
                            <Trash2 size={15} />
                          </button>
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

      {/* Modal Detalle de Venta Suspendida */}
      {viewingSale && (
        <div className="dialog-inline-host z-50" onClick={() => setViewingSale(null)}>
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-border space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-500">
                  <Pause size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{viewingSale.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    Suspendida por {viewingSale.cashierName || 'Cajero'} · {new Date(viewingSale.savedAt).toLocaleString('es-DO')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Array.isArray(viewingSale.cart) && viewingSale.cart.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-border bg-secondary/20 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{item.name || item.product?.name || 'Producto'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.qty} uds × RD$ {Number(item.price || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className="font-black font-mono text-foreground text-xs shrink-0">
                    RD$ {(Number(item.qty || 1) * Number(item.price || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Total de la Venta:</span>
              <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                RD$ {(viewingSale.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="btn-secondary text-xs px-4 py-2 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = viewingSale;
                  setViewingSale(null);
                  handleResumeInPos(s);
                }}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer"
              >
                <Play size={12} className="fill-white" />
                <span>Ir al POS y Retomar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

