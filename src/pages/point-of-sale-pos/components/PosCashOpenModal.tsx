import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Monitor,
  CheckCircle2,
  User,
  Banknote,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { isAdminOrSuperAdmin } from '@/lib/auth';
import { findCashRegister } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import { iniciarCaja } from '@/services/cierresCaja.service';
import type { CierreCaja } from '@/types/database';
import { logAuditEvent } from '@/lib/auditStore';

interface PosCashOpenModalProps {
  initialCajaId?: string;
  isMandatory?: boolean;
  onExit?: () => void;
  onSuccess?: (cierre: CierreCaja) => void;
  onClose: () => void;
}

const PRESET_AMOUNTS = [0, 1000, 2000, 3000, 5000];

export default function PosCashOpenModal({
  initialCajaId,
  isMandatory = false,
  onExit,
  onSuccess,
  onClose,
}: PosCashOpenModalProps) {
  const { user, logout } = useAuth();
  const { registers, refetch: refetchRegisters } = useCashRegisters();
  const isAdmin = isAdminOrSuperAdmin(user);

  const availableRegisters = isAdmin
    ? registers
    : registers.filter((c) => !c.isAdminBox);

  // 1. Identificar caja preferida:
  // a) Caja que ya tenga abierta el usuario en cualquier registradora
  const userOpenBox = registers.find(
    (c) =>
      c.open &&
      ((c.cashierId && user?.id && String(c.cashierId) === String(user.id)) ||
        (c.cashier && user?.name && c.cashier.trim().toLowerCase() === user.name.trim().toLowerCase()))
  );

  // b) Si el nombre del usuario coincide con una caja (ej: Cheila, Valentina, Eroly, Beiliz, Elizabeth, Keyla)
  const userBoxByName = user?.name
    ? registers.find((c) => {
        const u = user.name.trim().toLowerCase();
        const l = c.label.toLowerCase();
        return l.includes(u) || u.includes(l);
      })
    : undefined;
  const resolvedMatch =
    findCashRegister(availableRegisters, initialCajaId) ||
    findCashRegister(registers, initialCajaId);
  const firstFreeBox = availableRegisters.find((c) => !c.open);

  const defaultCajaId =
    userOpenBox?.id ||
    userBoxByName?.id ||
    (resolvedMatch && !resolvedMatch.isAdminBox ? resolvedMatch.id : undefined) ||
    firstFreeBox?.id ||
    availableRegisters[0]?.id ||
    registers[0]?.id ||
    '1';

  const [selectedCajaId, setSelectedCajaId] = useState(defaultCajaId);
  const [montoApertura, setMontoApertura] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultCajaId && !selectedCajaId) {
      setSelectedCajaId(defaultCajaId);
    }
  }, [defaultCajaId, selectedCajaId]);

  const selectedCaja =
    findCashRegister(availableRegisters, selectedCajaId) ||
    availableRegisters[0] ||
    registers[0];

  const handleCancelOrExit = async () => {
    if (isMandatory) {
      if (onExit) {
        onExit();
      } else {
        await logout();
        window.location.href = '/login';
      }
    } else {
      onClose();
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoApertura);
    if (isNaN(monto) || monto < 0) {
      toast.error('Por favor ingresa un monto de apertura válido (0 o mayor)');
      return;
    }

    setLoading(true);
    try {
      const cajeroNombre = user?.name || 'Cajero';
      const cajeroUsername = user?.username || user?.email || '';
      const cajeroId = user?.id || null;

      const targetBox = selectedCaja || availableRegisters[0];
      const targetCajaId = String(targetBox?.dbId || targetBox?.id || selectedCajaId);
      const targetLabel = targetBox?.label || `Caja #${selectedCajaId}`;

      const result = await iniciarCaja({
        caja_id: targetCajaId,
        caja_label: targetLabel,
        cajero_id: cajeroId,
        cajero_nombre: cajeroNombre,
        cajero_username: cajeroUsername,
        monto_apertura: monto,
        notes: notes.trim() || undefined,
        forzarNueva: true,
      });

      logAuditEvent({
        user: cajeroNombre,
        role: user?.role || 'Cajero',
        action: 'Inicio de caja',
        module: 'Caja',
        details: `Inicio de turno en ${targetLabel} con fondo de RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        after: { caja_id: targetCajaId, cajero_id: cajeroId, monto_apertura: monto },
      });

      toast.success(`¡Caja ${targetLabel} iniciada con RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}! Listo para facturar.`);
      await refetchRegisters();
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar caja');
    } finally {
      setLoading(false);
    }
  };

  const activeUserName = user?.name || 'Usuario';
  const activeUserRole = user?.role || 'Cajero';

  return (
    <div
      className="dialog-inline-host"
      onClick={isMandatory ? undefined : onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-6 overflow-hidden flex flex-col text-slate-800 dark:text-slate-200 animate-modalPanelIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <Play size={20} className="fill-current ml-0.5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Iniciar Turno de Caja
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Ingresa el fondo inicial para comenzar a facturar en el punto de venta.
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              type="button"
              onClick={handleCancelOrExit}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleStart} className="space-y-5">
          {/* Cajero Responsable */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <User size={14} className="text-emerald-600" />
              <span>Cajero Responsable</span>
            </label>
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-xs">
                {activeUserName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {activeUserName}
                </p>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                  {activeUserRole}
                </p>
              </div>
            </div>
          </div>

          {/* Card Principal: ¿Con qué monto vas a iniciar la caja? */}
          <div className="p-5 rounded-3xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 space-y-3.5">
            <div>
              <label className="block text-sm font-black text-slate-900 dark:text-white tracking-tight">
                ¿Con qué monto vas a iniciar la caja?
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Ingresa el efectivo inicial asignado para cambio a los clientes (Fondo de caja).
              </p>
            </div>

            {/* Input Grande de Monto */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/70 focus-within:border-emerald-600 px-4 py-3 flex items-center shadow-xs">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 mr-2 select-none">
                RD$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={montoApertura}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.currentTarget.select()}
                onChange={(e) => setMontoApertura(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent font-black text-3xl sm:text-4xl text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Botones de Monto Rápido */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Atajos rápidos:
              </span>
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = montoApertura === String(amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMontoApertura(String(amt))}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    RD$ {amt.toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Observaciones (Opcional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Observaciones / Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Turno mañana, entrega sin incidencias..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {isMandatory ? (
              <button
                type="button"
                onClick={handleCancelOrExit}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Iniciando caja...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                  <span>Iniciar Caja</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
