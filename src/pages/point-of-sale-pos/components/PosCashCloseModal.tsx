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
import { isAdminOrSuperAdmin } from '@/lib/auth';
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
  const isAdmin = isAdminOrSuperAdmin(user);

  const availableRegisters = isAdmin
    ? registers
    : registers.filter((c) => !c.isAdminBox);

  const openRegisters = registers.filter((c) => c.open);

  // Buscar el turno abierto del usuario en TODAS las cajas
  const userOpenBox = registers.find(
    (c) =>
      c.open &&
      ((c.cashierId && user?.id && String(c.cashierId) === String(user.id)) ||
        (c.cashier && user?.name && c.cashier.trim().toLowerCase() === user.name.trim().toLowerCase()))
  );

  const matchByCierre = initialCierreId
    ? registers.find((c) => c.cierreId === initialCierreId)
    : undefined;

  const resolvedMatch =
    matchByCierre ||
    findCashRegister(registers, initialCajaId) ||
    findCashRegister(availableRegisters, initialCajaId);

  const userBoxByName = user?.name
    ? registers.find((c) => {
        const u = user.name.trim().toLowerCase();
        const l = c.label.toLowerCase();
        return l.includes(u) || u.includes(l);
      })
    : undefined;

  const resolvedInitial =
    matchByCierre?.id ||
    (initialCajaId && resolvedMatch ? resolvedMatch.id : undefined) ||
    userOpenBox?.id ||
    (isAdmin && openRegisters[0] ? openRegisters[0].id : undefined) ||
    userBoxByName?.id ||
    resolvedMatch?.id ||
    availableRegisters[0]?.id ||
    registers[0]?.id ||
    '1';

  const [selectedCajaId, setSelectedCajaId] = useState(resolvedInitial);
  const [selectedCierreId, setSelectedCierreId] = useState<string | undefined>(
    initialCierreId || matchByCierre?.cierreId
  );

  // Sincronizar cuando cargan los registros dinámicos
  useEffect(() => {
    if (initialCierreId) {
      const found = registers.find((c) => c.cierreId === initialCierreId);
      if (found) {
        setSelectedCajaId(found.id);
        setSelectedCierreId(found.cierreId);
        return;
      }
    }
    if (initialCajaId) {
      const found = findCashRegister(registers, initialCajaId);
      if (found) {
        setSelectedCajaId(found.id);
        setSelectedCierreId(found.cierreId);
        return;
      }
    }
    if (!initialCajaId && !initialCierreId) {
      if (userOpenBox) {
        setSelectedCajaId(userOpenBox.id);
        setSelectedCierreId(userOpenBox.cierreId);
      } else if (isAdmin && openRegisters.length > 0) {
        setSelectedCajaId(openRegisters[0].id);
        setSelectedCierreId(openRegisters[0].cierreId);
      }
    }
  }, [initialCajaId, initialCierreId, registers.length, userOpenBox?.id, isAdmin]);

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
    (selectedCierreId ? registers.find((c) => c.cierreId === selectedCierreId) : undefined) ||
    (!isAdmin && userOpenBox ? userOpenBox : undefined) ||
    findCashRegister(registers, selectedCajaId) ||
    findCashRegister(availableRegisters, selectedCajaId) ||
    availableRegisters[0] ||
    registers[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      setFetchingSummary(true);
      try {
        const targetId = selectedCaja?.dbId || selectedCaja?.id || selectedCajaId;
        const targetCajeroId =
          selectedCaja?.open && selectedCaja?.cashierId
            ? selectedCaja.cashierId
            : !isAdmin
              ? user?.id
              : undefined;
        const targetCajeroName =
          selectedCaja?.open && selectedCaja?.cashier && selectedCaja.cashier !== 'Disponible'
            ? selectedCaja.cashier
            : !isAdmin
              ? user?.name
              : undefined;
        const targetCierreId = selectedCierreId || selectedCaja?.cierreId;

        const res = await calcularResumenCajaAbierta(
          targetId,
          targetCajeroId,
          targetCajeroName,
          targetCierreId
        );
        if (alive) {
          setSummary(res);
          setMontoRealInput(String(res.monto_esperado));
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
  }, [
    selectedCajaId,
    selectedCierreId,
    selectedCaja?.dbId,
    selectedCaja?.id,
    selectedCaja?.cierreId,
    selectedCaja?.cashierId,
    selectedCaja?.cashier,
    selectedCaja?.open,
    isAdmin,
    user?.id,
    user?.name,
  ]);

  const countedReal = parseFloat(montoRealInput) || 0;
  const diferencia = Math.round((countedReal - summary.monto_esperado) * 100) / 100;

  const shiftCashierName =
    summary.cajero_nombre ||
    (selectedCaja?.open && selectedCaja?.cashier && selectedCaja.cashier !== 'Disponible'
      ? selectedCaja.cashier
      : undefined) ||
    user?.name ||
    'Cajero';

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(countedReal) || countedReal < 0) {
      toast.error('Ingresa un monto de dinero válido en caja (0 o mayor)');
      return;
    }

    setLoading(true);
    try {
      const cajeroId =
        summary.cierre_id && summary.cajero_id
          ? summary.cajero_id
          : selectedCaja?.open && selectedCaja?.cashierId
            ? selectedCaja.cashierId
            : user?.id || null;
      const cajeroNombre = shiftCashierName;
      const cajeroUsername =
        summary.cajero_username ||
        (cajeroId && user?.id && String(cajeroId) === String(user.id)
          ? user?.username || user?.email || ''
          : '');
      const targetCajaId = String(
        summary.caja_id || selectedCaja?.dbId || selectedCaja?.id || selectedCajaId
      );
      const targetCajaLabel =
        selectedCaja?.label || summary.caja_label || `Caja #${selectedCajaId}`;

      const result = await cerrarTurnoCaja({
        cierre_id: summary.cierre_id || selectedCierreId || selectedCaja?.cierreId,
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
        notes:
          notes ||
          (isAdmin && cajeroNombre !== user?.name
            ? `Cierre realizado por Administrador (${user?.name}) para el turno de ${cajeroNombre}`
            : 'Cierre de turno en punto de venta POS'),
      });

      try {
        sessionStorage.removeItem('mercato_cash_opened_at_login');
      } catch {
        // ignore
      }

      logAuditEvent({
        user: user?.name ?? 'Usuario',
        role: user?.role ?? 'Cajero',
        action: 'Cierre de caja',
        module: 'Caja',
        details: `Cierre de turno ${targetCajaLabel} por ${user?.name}. Esperado: RD$ ${summary.monto_esperado.toFixed(2)}, Real Contado: RD$ ${countedReal.toFixed(2)}, Diferencia: RD$ ${diferencia.toFixed(2)}`,
        after: {
          caja_id: targetCajaId,
          monto_esperado: summary.monto_esperado,
          monto_real: countedReal,
          diferencia,
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
          {/* Selector de Caja Activa para Administradores */}
          {isAdmin && openRegisters.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Seleccionar Caja Activa a Cerrar ({openRegisters.length} abierta{openRegisters.length === 1 ? '' : 's'})
              </label>
              <select
                value={selectedCierreId || selectedCaja?.cierreId || selectedCajaId}
                onChange={(e) => {
                  const val = e.target.value;
                  const reg = openRegisters.find(
                    (r) => r.cierreId === val || String(r.id) === val || String(r.dbId) === val
                  );
                  if (reg) {
                    setSelectedCajaId(reg.id);
                    setSelectedCierreId(reg.cierreId);
                  } else {
                    setSelectedCajaId(val);
                    setSelectedCierreId(undefined);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                {openRegisters.map((reg) => (
                  <option key={reg.cierreId || reg.id} value={reg.cierreId || reg.id}>
                    {reg.label} — Cajero: {reg.cashier} (Apertura: {reg.openedAt} | Ventas: RD${' '}
                    {(reg.salesToday ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Responsable del turno y Caja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Caja Registradora
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {selectedCaja?.label || summary.caja_label || `Caja #${selectedCajaId}`}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Cajero Responsable del Turno
              </label>
              <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {shiftCashierName}
              </div>
            </div>
          </div>

          {/* Resumen del Turno: Fondo, Ventas, Gastos y Efectivo Esperado */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Movimientos Exactos del Turno
              </span>
              {fetchingSummary ? (
                <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
                  Actualizando saldos...
                </span>
              ) : (
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  Total Vendido: RD$ {summary.total_ventas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
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
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-rose-500 uppercase block">(-) Gastos / Retiros</span>
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
                  Fondo Inicial + Ventas Efectivo - Retiros/Gastos
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
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
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
