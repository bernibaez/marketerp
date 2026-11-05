import React, { useEffect, useState } from 'react';
import { X, Lock, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { findCashRegister } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import { cerrarTurnoCaja, calcularResumenCajaAbierta, type ResumenCajaAbierta } from '@/services/cierresCaja.service';
import type { CierreCaja } from '@/types/database';
import { logAuditEvent } from '@/lib/auditStore';

interface PosCashCloseModalProps {
  initialCajaId?: string;
  onSuccess?: (cierre: CierreCaja) => void;
  onClose: () => void;
}

export default function PosCashCloseModal({
  initialCajaId,
  onSuccess,
  onClose,
}: PosCashCloseModalProps) {
  const { user } = useAuth();
  const { registers, dbUsers } = useCashRegisters();
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

  const resolvedMatch = findCashRegister(availableRegisters, initialCajaId) || findCashRegister(registers, initialCajaId);
  const resolvedInitial =
    resolvedMatch?.id ||
    availableRegisters[0]?.id ||
    registers[0]?.id ||
    '2';

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

  const [montoRealInput, setMontoRealInput] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  const selectedCaja =
    findCashRegister(availableRegisters, selectedCajaId) || availableRegisters[0] || registers[0];

  const getRegisterDisplayLabel = (reg: { id: string; label: string }) => {
    if (reg.label.includes('—')) return reg.label;
    const shortBox = reg.label.includes('Caja #')
      ? reg.label.split(' - ')[0].trim()
      : `Caja #${reg.id}`;
    const userName = user?.name ? user.name.toUpperCase() : '';
    const prefix = userName && !reg.label.toUpperCase().includes(userName) ? `${userName} ` : '';
    return `${prefix}${shortBox} — (${shortBox})`;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setFetchingSummary(true);
      try {
        const res = await calcularResumenCajaAbierta(
          selectedCaja?.dbId || selectedCajaId,
          user?.id
        );
        if (alive) {
          setSummary(res);
          setMontoRealInput(String(res.monto_esperado));
          if (!res.cierre_id) {
            toast.error('No se encontró un inicio de caja activo para esta caja.');
          }
        }
      } catch {
        if (alive) {
          setSummary({
            caja_id: selectedCajaId,
            caja_label: `Caja #${selectedCajaId}`,
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
          setMontoRealInput('0');
        }
      } finally {
        if (alive) setFetchingSummary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedCajaId, selectedCaja?.dbId, user?.id]);

  const countedReal = parseFloat(montoRealInput) || 0;
  const diferencia = countedReal - summary.monto_esperado;

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(countedReal) || countedReal < 0) {
      toast.error('Ingresa un conteo físico de dinero válido (0 o mayor)');
      return;
    }

    setLoading(true);
    try {
      const cajeroNombre = user?.name || summary.cajero_nombre || 'Usuario';
      const cajeroUsername = user?.username || user?.email || summary.cajero_username || '';
      const cajeroId = user?.id || summary.cajero_id || null;

      const result = await cerrarTurnoCaja({
        cierre_id: summary.cierre_id,
        caja_id: selectedCaja?.dbId || selectedCajaId,
        caja_label: selectedCaja.label,
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
        details: `Cierre de turno ${selectedCaja.label} realizado por ${user?.name}. Esperado: RD$ ${summary.monto_esperado.toFixed(2)}, Conteo Real: RD$ ${countedReal.toFixed(2)}, Diferencia: RD$ ${diferencia.toFixed(2)}`,
        after: {
          caja_id: selectedCajaId,
          monto_esperado: summary.monto_esperado,
          monto_real: countedReal,
          diferencia,
        },
      });

      toast.success(`Caja ${selectedCaja.label} cerrada exitosamente`);
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar turno de caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="dialog-inline-host"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl p-7 sm:p-8 animate-in zoom-in-95 duration-150 overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-xl sm:text-[22px] font-bold text-slate-900 dark:text-white tracking-tight">
              Cierre de turno
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
              Arqueo de caja basado en ventas, entradas, retiros y devoluciones.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-lg cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCloseRegister}>
          {/* Caja a cerrar */}
          <div className="space-y-1.5 mb-5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Caja a cerrar
            </label>
            <div className="relative">
              <select
                value={selectedCajaId}
                onChange={(e) => setSelectedCajaId(e.target.value)}
                disabled={!isAdmin && availableRegisters.length <= 1}
                className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer disabled:cursor-default"
              >
                {availableRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {getRegisterDisplayLabel(reg)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Desglose Financiero Limpio */}
          <div className="space-y-3 mb-4 text-[13.5px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Fondo inicial</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                RD$ {summary.monto_apertura.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Ventas en efectivo</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                + RD$ {summary.total_efectivo.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Entradas en efectivo</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                + RD$ {summary.total_entradas.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Retiros y gastos</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                - RD$ {summary.total_retiros.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Devoluciones</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                - RD$ {summary.total_devoluciones.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Bloque Destacado: Efectivo esperado en caja */}
          <div className="bg-[#F8FAFC] dark:bg-slate-800/60 rounded-2xl p-4 sm:p-5 flex items-center justify-between mt-3 mb-2 border border-slate-100 dark:border-slate-800">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Efectivo esperado en caja
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {fetchingSummary
                ? 'Calculando...'
                : `RD$ ${summary.monto_esperado.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Tarjeta y transferencias: RD$ {(summary.total_tarjeta + summary.total_transferencia).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · No se incluyen en el conteo de efectivo.
          </p>

          {/* Input: Efectivo contado */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Efectivo contado
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Billetes y monedas
              </span>
            </div>

            <div className="relative border border-slate-300 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-slate-300 rounded-xl px-4 py-3 bg-white dark:bg-slate-900 flex items-center transition">
              <span className="text-slate-500 dark:text-slate-400 font-semibold text-base mr-3 select-none">
                RD$
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={montoRealInput}
                onChange={(e) => setMontoRealInput(e.target.value)}
                required
                className="w-full text-2xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none p-0 focus:ring-0 tabular-nums"
                placeholder="0"
                autoFocus
              />
            </div>

            {/* Fila de Cuadre / Sobrante / Faltante */}
            {diferencia === 0 ? (
              <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>Cuadre exacto</span>
                </div>
                <span className="font-semibold tabular-nums">RD$ 0.00</span>
              </div>
            ) : diferencia > 0 ? (
              <div className="flex items-center justify-between text-xs font-medium text-amber-600 dark:text-amber-400 mt-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span>Sobrante en caja</span>
                </div>
                <span className="font-semibold tabular-nums">
                  + RD$ {diferencia.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs font-medium text-rose-600 dark:text-rose-400 mt-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span>Faltante en caja</span>
                </div>
                <span className="font-semibold tabular-nums">
                  - RD$ {Math.abs(diferencia).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Observaciones (opcional) */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Observaciones (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Cuadre perfecto sin novedades"
              className="w-full h-11 px-4 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || fetchingSummary}
              className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1f2937] active:scale-[0.98] text-white text-sm font-semibold flex items-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Lock size={15} />
              <span>{loading ? 'Cerrando...' : 'Confirmar cierre'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
