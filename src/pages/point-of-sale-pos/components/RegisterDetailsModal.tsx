import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Printer, Download, Briefcase } from 'lucide-react';
import { exportTableToPdf, formatMoneyPdf } from '@/lib/exportPdf';
import { useAuth } from '@/context/AuthContext';
import { obtenerVentasTurno, type VentaConDetalle } from '@/services/ventas.service';
import { obtenerCajaAbierta } from '@/services/cierresCaja.service';
import { toast } from '@/lib/toast';

interface RegisterDetailsModalProps {
  onClose: () => void;
  cajaId?: string;
  cajaLabel?: string;
  /** Si true (admin), incluye ventas del usuario aunque el turno esté a nombre de otro cajero. */
  includeUserSales?: boolean;
  locationName?: string;
}

function money(n: number) {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RegisterDetailsModal({
  onClose,
  cajaId = 'principal',
  cajaLabel = 'Caja',
  includeUserSales = false,
  locationName = 'SUPERMERCADO REMANENTE',
}: RegisterDetailsModalProps) {
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState<VentaConDetalle[]>([]);
  const [abiertaEn, setAbiertaEn] = useState<string>('');
  const [turnoCajeroNombre, setTurnoCajeroNombre] = useState<string>('');

  const displayUser = turnoCajeroNombre || ventas[0]?.cajero_nombre || user?.name || 'Usuario';
  const displayEmail = user?.email || '';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const abierta = await obtenerCajaAbierta(cajaId).catch(() => null);
        if (!abierta) {
          if (alive) {
            setAbiertaEn('');
            setTurnoCajeroNombre('');
            setVentas([]);
          }
          return;
        }
        const desde = abierta.abierta_en;
        const cajeroAbierta =
          (abierta as typeof abierta & { cajero_nombre?: string })?.cajero_nombre || '';
        if (alive) {
          setAbiertaEn(desde);
          setTurnoCajeroNombre(cajeroAbierta);
        }

        const cajaIds = Array.from(new Set([cajaId, abierta.caja_id].filter(Boolean) as string[]));
        const porCaja = await obtenerVentasTurno({
          cajaId: cajaIds.length > 0 ? cajaIds : cajaId,
          // No-admin: solo las ventas que él/ella realizó; Admin: todas las ventas de esta caja
          cajeroId: includeUserSales ? undefined : (abierta.cajero_id || user?.id),
          desde,
          limite: 500,
        });

        let merged = porCaja;
        // Si hay ventas del cajero titular del turno sin caja_id explícita, incluirlas
        const targetCajeroId = abierta.cajero_id || (!includeUserSales ? user?.id : undefined);
        if (targetCajeroId) {
          const porCajero = await obtenerVentasTurno({
            cajeroId: targetCajeroId,
            desde,
            limite: 500,
          });
          const allowedSet = new Set(cajaIds.map(String));
          const seen = new Set(merged.map((v) => v.id));
          for (const v of porCajero) {
            if (!seen.has(v.id) && (!v.caja_id || allowedSet.has(String(v.caja_id)))) {
              merged = [...merged, v];
              seen.add(v.id);
            }
          }
          merged.sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
        }

        if (alive) setVentas(merged);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las ventas del turno');
        if (alive) setVentas([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cajaId, includeUserSales, user?.id]);

  const dateRangeStr = useMemo(() => {
    const start = abiertaEn
      ? new Date(abiertaEn).toLocaleString('es-DO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Hoy';
    const end = new Date().toLocaleString('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} - ${end}`;
  }, [abiertaEn]);

  const totals = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let credit = 0;
    for (const v of ventas) {
      total += Number(v.monto_total) || 0;
      cash += Number(v.monto_efectivo) || 0;
      card += Number(v.monto_tarjeta) || 0;
      transfer += Number(v.monto_transferencia) || 0;
      credit += Number(v.monto_credito) || 0;
    }
    return { total, cash, card, transfer, credit, count: ventas.length };
  }, [ventas]);

  const productsSold = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; qty: number; total: number }>();
    for (const v of ventas) {
      for (const d of v.detalle_ventas ?? []) {
        const key = d.producto_id || d.combo_id || d.nombre_item;
        const prev = map.get(key) || {
          sku: d.producto_id?.slice(0, 8) || d.combo_id?.slice(0, 8) || '—',
          name: d.nombre_item,
          qty: 0,
          total: 0,
        };
        prev.qty += Number(d.cantidad) || 0;
        prev.total += Number(d.subtotal) || 0;
        map.set(key, prev);
      }
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [ventas]);

  const productsQtyTotal = productsSold.reduce((s, p) => s + p.qty, 0);
  const productsMoneyTotal = productsSold.reduce((s, p) => s + p.total, 0);

  const paymentMethods = [
    { name: 'Efectivo', sales: money(totals.cash) },
    { name: 'Tarjeta', sales: money(totals.card) },
    { name: 'Transferencia', sales: money(totals.transfer) },
    { name: 'Crédito', sales: money(totals.credit) },
  ];

  const totalsSummary = [
    { label: 'Tickets / facturas:', value: String(totals.count) },
    { label: 'Ventas totales:', value: money(totals.total) },
    { label: 'Efectivo:', value: money(totals.cash) },
    { label: 'Tarjeta:', value: money(totals.card) },
    { label: 'Transferencia:', value: money(totals.transfer) },
    { label: 'Crédito:', value: money(totals.credit) },
  ];

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    if (productsSold.length === 0) {
      toast.error('No hay productos vendidos para exportar');
      return;
    }
    exportTableToPdf({
      title: `Detalles de caja — ${cajaLabel}`,
      subtitle: `${dateRangeStr} | ${locationName} | ${displayUser}`,
      filename: `detalles-caja-${Date.now()}`,
      headers: ['#', 'SKU / CÓDIGO', 'Producto', 'Cantidad', 'Total'],
      rows: productsSold.map((p, idx) => [
        idx + 1,
        p.sku,
        p.name,
        p.qty.toFixed(2),
        formatMoneyPdf(p.total),
      ]),
    });
  };

  return (
    <div className="dialog-inline-host print:p-0 print:bg-white print:static">
      <div
        ref={modalRef}
        className="printable-invoice-container w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Detalles de caja{' '}
                <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({cajaLabel} · {dateRangeStr})
                </span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200 text-xs sm:text-sm print:p-4 print:text-black">
          {loading ? (
            <div className="py-16 text-center text-slate-400 font-semibold">
              Cargando ventas del turno…
            </div>
          ) : !abiertaEn ? (
            <div className="py-16 text-center text-slate-400 font-semibold">
              No hay un turno de caja iniciado. Las ventas del cierre anterior no se muestran aquí.
            </div>
          ) : (
            <>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-4">Método de pago</th>
                      <th className="py-2.5 px-4 text-right">Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {paymentMethods.map((pm) => (
                      <tr key={pm.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {pm.name}
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{pm.sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-xs sm:text-sm">
                {totalsSummary.map((tot) => (
                  <div
                    key={tot.label}
                    className="flex justify-between items-center py-0.5 border-b border-slate-200/50 dark:border-slate-700/50 last:border-none"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-300">{tot.label}</span>
                    <span className="font-black text-slate-900 dark:text-white">{tot.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Facturas del turno ({ventas.length})
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs bg-white dark:bg-slate-900 max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">Factura</th>
                        <th className="py-2.5 px-3">Hora</th>
                        <th className="py-2.5 px-3">Cajero</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {ventas.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                            Aún no hay ventas en este turno
                          </td>
                        </tr>
                      ) : (
                        ventas.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-mono font-bold text-xs">{v.numero_factura}</td>
                            <td className="py-2 px-3 text-xs">
                              {new Date(v.creado_en).toLocaleTimeString('es-DO', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2 px-3 text-xs font-semibold">
                              {v.cajero_nombre || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold">
                              {money(v.monto_total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Productos vendidos
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs bg-white dark:bg-slate-900">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-right">Cantidad</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {productsSold.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                            Sin productos en el turno
                          </td>
                        </tr>
                      ) : (
                        productsSold.map((p, idx) => (
                          <tr key={`${p.sku}-${p.name}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-slate-500 font-semibold">{idx + 1}.</td>
                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                            <td className="py-2 px-3 text-right font-mono">{p.qty.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold">
                              {money(p.total)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800 font-black border-t-2 border-slate-300 dark:border-slate-700">
                        <td className="py-2.5 px-3" colSpan={2}>
                          Totales
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {productsQtyTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {money(productsMoneyTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1 text-slate-700 dark:text-slate-300 font-medium">
                <p>
                  <span className="font-bold text-slate-900 dark:text-white">Usuario:</span>{' '}
                  {displayUser}
                </p>
                {displayEmail ? (
                  <p>
                    <span className="font-bold text-slate-900 dark:text-white">Email:</span>{' '}
                    {displayEmail}
                  </p>
                ) : null}
                <p>
                  <span className="font-bold text-slate-900 dark:text-white">Caja:</span> {cajaLabel}
                </p>
                <p>
                  <span className="font-bold text-slate-900 dark:text-white">Ubicación:</span>{' '}
                  {locationName}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-all active:scale-95 shadow-sm"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
            >
              <Download size={16} />
              <span>Exportar PDF</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
