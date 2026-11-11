import React, { useEffect, useState } from 'react';
import {
  X,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Coins,
  TrendingUp,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { findCashRegister } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import {
  cerrarTurnoCaja,
  calcularResumenCajaAbierta,
  type ResumenCajaAbierta,
} from '@/services/cierresCaja.service';
import type { CierreCaja } from '@/types/database';
import { logAuditEvent } from '@/lib/auditStore';

interface PosCashCloseModalProps {
  initialCajaId?: string;
  initialCierreId?: string;
  onSuccess?: (cierre: CierreCaja) => void;
  onClose: () => void;
}

export default function PosCashCloseModal({
  initialCajaId,
  initialCierreId,
  onSuccess,
  onClose,
}: PosCashCloseModalProps) {
  const { user } = useAuth();
  const { registers, refetch: refetchRegisters } = useCashRegisters();
  const roleNorm = (user?.role || '').trim().toLowerCase();
  const isAdmin =
    roleNorm === 'administrador' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super_admin' ||
    roleNorm === 'superadmin';

  const availableRegisters = isAdmin
    ? registers
    : registers.filter((c) => !c.isAdminBox);

  const userOpenBox = availableRegisters.find(
    (c) =>
      c.open &&
      ((c.cashierId && user?.id && String(c.cashierId) === String(user.id)) ||
        (c.cashier && user?.name && c.cashier.trim().toLowerCase() === user.name.trim().toLowerCase()))
  );
  const resolvedMatch =
    findCashRegister(availableRegisters, initialCajaId) ||
    findCashRegister(registers, initialCajaId);

  const userBoxByName = user?.name
    ? availableRegisters.find((c) => {
        const u = user.name.trim().toLowerCase();
        const l = c.label.toLowerCase();
        return l.includes(u) || u.includes(l);
      })
    : undefined;

  const resolvedInitial =
    userOpenBox?.id ||
    userBoxByName?.id ||
    resolvedMatch?.id ||
    availableRegisters[0]?.id ||
    registers[0]?.id ||
    '1';

  const [selectedCajaId, setSelectedCajaId] = useState(resolvedInitial);
  const [summary, setSummary] = useState<ResumenCajaAbierta>({
    caja_id: resolvedInitial,
    caja_label: `Caja #${resolvedInitial}`,
    abierta_en: new Date().toISOString(),
    monto_apertura: 0,
    total_ventas: 0,
    total_efectivo: 0,
    total_tarjeta: 0,
    total_transferencia: 0,
    total_otros: 0,
    total_entradas: 0,
    total_retiros: 0,
    total_devoluciones: 0,
    monto_esperado: 0,
    estado: 'en_curso',
  });

  const [montoRealInput, setMontoRealInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  const selectedCaja =
    findCashRegister(availableRegisters, selectedCajaId) ||
    availableRegisters[0] ||
    registers[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      setFetchingSummary(true);
      try {
        const targetId = selectedCaja?.dbId || selectedCajaId;
        const targetCierreId =
          selectedCaja?.cierreId ||
          (selectedCajaId === initialCajaId ? initialCierreId : undefined);
        const res = await calcularResumenCajaAbierta(targetId, user?.id, targetCierreId);
        if (alive) {
          setSummary(res);
          // Si el usuario no ha ingresado un monto aún, podemos sugerir o dejar listo
          if (montoRealInput === '') {
            setMontoRealInput(String(res.monto_esperado));
          }
        }
      } catch {
        if (alive) {
          setSummary((prev) => ({
            ...prev,
            caja_id: selectedCajaId,
          }));
        }
      } finally {
        if (alive) setFetchingSummary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedCajaId, selectedCaja?.dbId, selectedCaja?.cierreId, initialCajaId, initialCierreId, user?.id]);

  const countedReal = parseFloat(montoRealInput) || 0;
  const diferencia = Math.round((countedReal - summary.monto_esperado) * 100) / 100;

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(countedReal) || countedReal < 0) {
      toast.error('Ingresa un monto de dinero válido en caja (0 o mayor)');
      return;
    }

    setLoading(true);
    try {
      const cajeroNombre = user?.name || summary.cajero_nombre || 'Cajero';
      const cajeroUsername = user?.username || user?.email || summary.cajero_username || '';
      const cajeroId = user?.id || summary.cajero_id || null;
      const targetCajaId = String(selectedCaja?.dbId || selectedCaja?.id || selectedCajaId);
      const targetCajaLabel = selectedCaja?.label || `Caja #${selectedCajaId}`;

      const targetCierreId =
        summary.cierre_id ||
        selectedCaja?.cierreId ||
        (selectedCajaId === initialCajaId ? initialCierreId : undefined);

      const result = await cerrarTurnoCaja({
        cierre_id: targetCierreId,
        caja_id: targetCajaId,
        caja_label: targetCajaLabel,
        cajero_id: cajeroId,
        cajero_nombre: cajeroNombre,
        cajero_username: cajeroUsername,
        usuario_cierre_id: user?.id ?? null,
        usuario_cierre_nombre: user?.name ?? 'Usuario',
        monto_apertura: summary.monto_apertura,
        monto_esperado: summary.monto_esperado,
        monto_real: countedReal,
        monto_diferencia: diferencia,
        total_ventas: summary.total_ventas,
        total_efectivo: summary.total_efectivo,
        total_tarjeta: summary.total_tarjeta,
        total_transferencia: summary.total_transferencia,
        total_otros: summary.total_otros,
        total_entradas: summary.total_entradas,
        total_retiros: summary.total_retiros,
        total_devoluciones: summary.total_devoluciones,
        notes: notes || 'Cierre de turno en punto de venta POS',
      });

      logAuditEvent({
        user: user?.name ?? 'Usuario',
        role: user?.role ?? 'Cajero',
        action: 'Cierre de caja',
        module: 'Caja',
        details: `Cierre de turno ${targetCajaLabel} por ${user?.name}. Esperado: RD$ ${result.monto_esperado.toFixed(2)}, Real Contado: RD$ ${result.monto_real.toFixed(2)}, Diferencia: RD$ ${result.monto_diferencia.toFixed(2)}`,
        after: {
          cierre_id: result.id,
          caja_id: result.caja_id,
          monto_esperado: result.monto_esperado,
          monto_real: result.monto_real,
          diferencia: result.monto_diferencia,
        },
      });

      toast.success(`Caja ${targetCajaLabel} cerrada exitosamente`);
      await refetchRegisters();
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar turno de caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-inline-host" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 animate-modalPanelIn max-h-[94vh] overflow-y-auto text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/70 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
              <Lock size={20} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Cierre de Turno de Caja
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Arqueo de dinero en efectivo y cuadre final del turno.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCloseRegister} className="space-y-5">
          {/* Fila: Caja a cerrar y Cajero */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Caja a cerrar
              </label>
              <select
                value={selectedCajaId}
                onChange={(e) => setSelectedCajaId(e.target.value)}
                disabled={!isAdmin && availableRegisters.length <= 1}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {availableRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.label} {reg.open ? '(Abierta)' : '(Cerrada)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Responsable del turno
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {user?.name || summary.cajero_nombre || 'Cajero'}
              </div>
            </div>
          </div>

          {/* Resumen del Turno: Fondo, Ventas, Gastos y Efectivo Esperado */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Movimientos del Turno
              </span>
              {fetchingSummary && (
                <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
                  Actualizando saldos...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Fondo Inicial</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  RD$ {summary.monto_apertura.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">(+) Ventas Efectivo</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  RD$ {summary.total_efectivo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
                {summary.total_entradas > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-500 block mt-0.5">
                    + Entradas: RD$ {summary.total_entradas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-rose-500 uppercase block">(-) Gastos / Retiros / Dev.</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                  RD$ {(summary.total_retiros + summary.total_devoluciones).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Efectivo Físico Esperado */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 block">
                  Efectivo Total Esperado en Caja:
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                  Fondo Inicial + Ventas Efectivo + Entradas - Retiros/Gastos/Dev.
                </span>
              </div>
              <span className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-300">
                RD$ {summary.monto_esperado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Otros Medios de Pago (Informativo) */}
            {(summary.total_tarjeta > 0 || summary.total_transferencia > 0 || summary.total_otros > 0) && (
              <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Otros cobros:</span>
                {summary.total_tarjeta > 0 && (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Tarjetas: RD$ {summary.total_tarjeta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {summary.total_transferencia > 0 && (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Transferencias: RD$ {summary.total_transferencia.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {summary.total_otros > 0 && (
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Crédito: RD$ {summary.total_otros.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pregunta Principal: ¿Cuánto dinero tienes en caja? */}
          <div className="p-5 rounded-3xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-3">
            <div>
              <label className="block text-sm font-black text-slate-900 dark:text-white tracking-tight">
                ¿Cuánto dinero tienes en caja?
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Cuenta el dinero físico que hay físicamente en la gaveta y digítalo a continuación.
              </p>
            </div>

            {/* Input Grande de Efectivo Contado */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-500/70 focus-within:border-amber-600 px-4 py-3 flex items-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-amber-600 mr-2 select-none">
                RD$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={montoRealInput}
                onChange={(e) => setMontoRealInput(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent font-black text-3xl sm:text-4xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Indicador en Vivo de Diferencia / Cuadre */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Resultado del Cuadre:
              </span>
              {diferencia === 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 size={14} />
                  Cuadre exacto (RD$ 0.00)
                </span>
              ) : diferencia > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                  <ArrowUpRight size={14} />
                  Sobrante de RD$ +{diferencia.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                  <ArrowDownRight size={14} />
                  Faltante de RD$ {diferencia.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          {/* Observaciones del Cierre */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Observaciones / Justificación de diferencia (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Conteo verificado, turno finalizado normalmente..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Cerrando caja...</span>
              ) : (
                <>
                  <Lock size={16} strokeWidth={2.4} />
                  <span>Confirmar y Cerrar Caja</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
