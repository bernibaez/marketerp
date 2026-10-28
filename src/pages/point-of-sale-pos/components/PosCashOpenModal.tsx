import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Monitor,
  CheckCircle2,
  User,
  ArrowLeft,
  ShieldCheck,
  Banknote,
  ChevronUp,
  ChevronDown,
  Info,
  RotateCcw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { findCashRegister } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import { iniciarCaja } from '@/services/cierresCaja.service';
import { ROL_DB_A_UI } from '@/services/auth.service';
import type { CierreCaja } from '@/types/database';
import { logAuditEvent } from '@/lib/auditStore';

interface PosCashOpenModalProps {
  initialCajaId?: string;
  isMandatory?: boolean;
  onExit?: () => void;
  onSuccess?: (cierre: CierreCaja) => void;
  onClose: () => void;
}

const PRESET_AMOUNTS = [1000, 2000, 3000, 5000, 10000];

const CASH_DENOMINATIONS = [
  { label: 'RD$ 2,000', value: 2000, type: 'Billete' },
  { label: 'RD$ 1,000', value: 1000, type: 'Billete' },
  { label: 'RD$ 500', value: 500, type: 'Billete' },
  { label: 'RD$ 200', value: 200, type: 'Billete' },
  { label: 'RD$ 100', value: 100, type: 'Billete' },
  { label: 'RD$ 50', value: 50, type: 'Billete' },
  { label: 'RD$ 25', value: 25, type: 'Moneda' },
  { label: 'RD$ 10', value: 10, type: 'Moneda' },
  { label: 'RD$ 5', value: 5, type: 'Moneda' },
  { label: 'RD$ 1', value: 1, type: 'Moneda' },
];

export default function PosCashOpenModal({
  initialCajaId,
  isMandatory = false,
  onExit,
  onSuccess,
  onClose,
}: PosCashOpenModalProps) {
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

  const resolvedMatch =
    findCashRegister(availableRegisters, initialCajaId) ||
    findCashRegister(registers, initialCajaId);
  const resolvedInitial =
    resolvedMatch?.id ||
    availableRegisters[0]?.id ||
    registers.find((c) => !c.isAdminBox)?.id ||
    registers[0]?.id ||
    '2';

  const [selectedCajaId, setSelectedCajaId] = useState(resolvedInitial);
  const [selectedCajeroId, setSelectedCajeroId] = useState<string>(user?.id || '');
  const [montoApertura, setMontoApertura] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [desgloseOpen, setDesgloseOpen] = useState(false);
  const [breakdownCounts, setBreakdownCounts] = useState<Record<number, number>>({});
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const selectedCaja =
    findCashRegister(availableRegisters, selectedCajaId) ||
    availableRegisters[0] ||
    registers[0];
  const selectedUser = isAdmin ? dbUsers.find((u) => u.id === selectedCajeroId) : null;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('es-DO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAdmin && !selectedCajeroId && dbUsers.length > 0) {
      const match = dbUsers.find((u) => u.id === user?.id) || dbUsers[0];
      if (match) setSelectedCajeroId(match.id);
    }
  }, [isAdmin, dbUsers, user, selectedCajeroId]);

  useEffect(() => {
    if (!isAdmin && selectedCaja?.isAdminBox) {
      const first = registers.find((c) => !c.isAdminBox);
      if (first) setSelectedCajaId(first.id);
    }
  }, [isAdmin, registers, selectedCaja?.isAdminBox]);

  const handleCancelOrExit = () => {
    if (isMandatory && onExit) {
      onExit();
    } else {
      onClose();
    }
  };

  const handleAdjustMonto = (delta: number) => {
    const current = parseFloat(montoApertura) || 0;
    const next = Math.max(0, current + delta);
    setMontoApertura(String(next));
  };

  const calculateBreakdownTotal = () => {
    return Object.entries(breakdownCounts).reduce((acc, [denom, count]) => {
      return acc + Number(denom) * (Number(count) || 0);
    }, 0);
  };

  const handleApplyBreakdown = () => {
    const sum = calculateBreakdownTotal();
    setMontoApertura(String(sum));
    setDesgloseOpen(false);
    toast.success(`Desglose aplicado: RD$ ${sum.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`);
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
      const cajeroNombre = isAdmin
        ? selectedUser?.nombre_completo || user?.name || 'super admin'
        : user?.name || 'super admin';
      const cajeroUsername = isAdmin
        ? selectedUser?.correo || user?.username || ''
        : user?.username || '';
      const cajeroId = isAdmin
        ? selectedUser?.id || user?.id || null
        : user?.id || null;

      const result = await iniciarCaja({
        caja_id: selectedCaja.dbId || selectedCajaId,
        caja_label: selectedCaja.label,
        cajero_id: cajeroId,
        cajero_nombre: cajeroNombre,
        cajero_username: cajeroUsername,
        monto_apertura: monto,
        notes: notes.trim() || undefined,
      });

      logAuditEvent({
        user: cajeroNombre,
        role:
          isAdmin && selectedUser
            ? ROL_DB_A_UI[selectedUser.rol] || 'Super Administrador'
            : user?.role || 'Super Administrador',
        action: 'Inicio de caja',
        module: 'Caja',
        details: `Inicio de caja ${selectedCaja.label} asignada a ${cajeroNombre} con fondo de RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        after: { caja_id: selectedCajaId, cajero_id: cajeroId, monto_apertura: monto },
      });

      toast.success(`Caja ${selectedCaja.label} iniciada exitosamente para ${cajeroNombre}`);
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar caja');
    } finally {
      setLoading(false);
    }
  };

  const activeUserName =
    isAdmin && selectedUser
      ? selectedUser.nombre_completo
      : user?.name || 'Cajero';
  const activeUserRole =
    isAdmin && selectedUser
      ? ROL_DB_A_UI[selectedUser.rol] || 'Cajero'
      : user?.role || 'Cajero';

  return (
    <div
      className="dialog-inline-host"
      onClick={isMandatory ? undefined : onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 space-y-6 overflow-hidden flex flex-col text-slate-800 dark:text-slate-200 animate-modalPanelIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-center text-amber-500 flex-shrink-0">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/80 flex items-center justify-center">
                <Play size={15} className="fill-amber-500 text-amber-500 ml-0.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Apertura de Caja Requerida
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100/70 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900">
                  ACCESO BLOQUEADO
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-medium mt-1">
                Debes aperturar la caja con tu fondo inicial para habilitar las ventas en el punto de venta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Terminal en Espera</span>
            </div>
            <button
              type="button"
              onClick={handleCancelOrExit}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={isMandatory ? 'Salir del POS' : 'Cerrar'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleStart} className="space-y-5">
          {/* Fila 1: Cajero Responsable y Selección de Caja */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Columna Izquierda: Cajero Responsable */}
            <div className="md:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  <User size={14} strokeWidth={2.5} />
                  <span>Cajero Responsable</span>
                </div>
                <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-black text-sm flex items-center justify-center flex-shrink-0">
                    {activeUserName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isAdmin && dbUsers.length > 0 ? (
                      <select
                        value={selectedCajeroId}
                        onChange={(e) => setSelectedCajeroId(e.target.value)}
                        className="w-full text-sm font-extrabold text-slate-900 dark:text-white bg-transparent focus:outline-none cursor-pointer truncate"
                      >
                        {dbUsers.map((u) => (
                          <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900">
                            {u.nombre_completo} ({ROL_DB_A_UI[u.rol] || u.rol})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                        {activeUserName}
                      </p>
                    )}
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 truncate">
                      {activeUserRole}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-medium px-1 mt-3">
                <span>Hora del sistema:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {currentTimeStr || '10:04 a. m.'}
                </span>
              </div>
            </div>

            {/* Columna Derecha: Selección de Caja */}
            <div className="md:col-span-7">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <Monitor size={14} strokeWidth={2.5} />
                  <span>Seleccionar Caja Registradora</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {availableRegisters.length} registradoras disponibles
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableRegisters.map((caja) => {
                  const isSelected = selectedCajaId === caja.id;
                  return (
                    <button
                      key={caja.id}
                      type="button"
                      onClick={() => setSelectedCajaId(caja.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-900 dark:text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400'
                        }`}
                      >
                        <Monitor size={18} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate">{caja.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {caja.cashier || activeUserName} • {caja.role || activeUserRole}
                        </p>
                      </div>
                      {isSelected ? (
                        <CheckCircle2
                          size={18}
                          className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 fill-emerald-600 text-white"
                        />
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          LIBRE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Fila 2: Card Monto Inicial / Fondo de Caja */}
          <div className="p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Monto Inicial / Fondo de Caja (RD$)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Ingresa el dinero en efectivo asignado para dar cambio a clientes
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDesgloseOpen(true)}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer shadow-2xs"
              >
                <Banknote size={15} />
                <span>Desglose de Billetes y Monedas</span>
              </button>
            </div>

            {/* Input Grande de Monto */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl font-black text-slate-400 select-none">RD$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent font-black text-3xl sm:text-4xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-0.5 pl-2 border-l border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleAdjustMonto(100)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  title="Sumar RD$ 100"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustMonto(-100)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  title="Restar RD$ 100"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {/* Chips Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">
                  RÁPIDO:
                </span>
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = montoApertura === String(amt);
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMontoApertura(String(amt))}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 ${
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

              <button
                type="button"
                onClick={() => setMontoApertura('0')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold transition-all cursor-pointer"
              >
                Limpiar
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 pt-1">
              <div className="w-4 h-4 rounded-full border border-emerald-500/80 flex items-center justify-center flex-shrink-0 text-emerald-500">
                <Info size={11} strokeWidth={2.5} />
              </div>
              <span>
                Este fondo representa la base física de billetes y monedas con la que comienzas a operar la sesión.
              </span>
            </div>
          </div>

          {/* Fila 3: Observaciones / Notas */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              OBSERVACIONES / NOTAS <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Entregado por administración en billetes de RD$ 100 y 500 para cambio matutino..."
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          {/* Fila 4: Banner Informativo Shield */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              <strong className="font-extrabold">Apertura asignada a: {activeUserName}</strong>. Al confirmar, el
              sistema registrará la fecha y hora oficial de inicio de operaciones ({currentTimeStr || '10:04 a. m.'}).
            </span>
          </div>

          {/* Fila 5: Botones de Acción */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCancelOrExit}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <ArrowLeft size={15} strokeWidth={2.5} />
              <span>Salir del POS</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Play size={13} className="fill-white text-white" />
              <span>{loading ? 'Iniciando…' : 'Abrir Caja y Comenzar'}</span>
            </button>
          </div>
        </form>

        {/* Submodal Desglose de Billetes y Monedas */}
        {desgloseOpen && (
          <div className="dialog-inline-host z-[1050]" onClick={() => setDesgloseOpen(false)}>
            <div
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Desglose de Efectivo
                    </h3>
                    <p className="text-xs text-slate-400">Ingresa las cantidades por denominación</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDesgloseOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                {CASH_DENOMINATIONS.map((d) => {
                  const qty = breakdownCounts[d.value] || 0;
                  const sub = qty * d.value;
                  return (
                    <div
                      key={d.value}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {d.label}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Sub: RD$ {sub.toLocaleString()}
                        </p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={qty || ''}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setBreakdownCounts((prev) => ({
                            ...prev,
                            [d.value]: Math.max(0, val),
                          }));
                        }}
                        className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                  Total Contado:
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                  RD$ {calculateBreakdownTotal().toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBreakdownCounts({})}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  <span>Reiniciar</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyBreakdown}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700"
                >
                  Aplicar al Fondo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
