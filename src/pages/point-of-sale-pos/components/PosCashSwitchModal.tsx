import React, { useEffect, useState } from 'react';
import { X, Monitor, Shield, User, ArrowRight, DollarSign, Ticket, Clock, Lock, Check, Info } from 'lucide-react';
import { toast } from '@/lib/toast';
import { type CashRegisterId, type CashRegisterSession } from '@/lib/cashRegisters';
import { useAuth } from '@/context/AuthContext';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import PosCashOpenModal from './PosCashOpenModal';

interface Props {
  currentId: CashRegisterId;
  onSelect: (id: CashRegisterId) => void;
  onClose: () => void;
}

export default function PosCashSwitchModal({ currentId, onSelect, onClose }: Props) {
  const { user } = useAuth();
  const { registers, refetch } = useCashRegisters();
  const roleNorm = (user?.role || '').trim().toLowerCase();
  const isAdmin =
    roleNorm === 'administrador' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super_admin' ||
    roleNorm === 'superadmin';

  const visibleRegisters = isAdmin
    ? registers
    : registers.filter((c) => !c.isAdminBox);

  const adminBox = registers.find((c) => c.isAdminBox) || registers[0];
  const defaultBox =
    visibleRegisters.find((c) => c.id === currentId) ||
    visibleRegisters[0] ||
    adminBox;

  const [openTargetId, setOpenTargetId] = useState<string | null>(null);
  const [selectedBox, setSelectedBox] = useState<CashRegisterSession>(() => defaultBox);

  useEffect(() => {
    const matched = visibleRegisters.find((c) => c.id === selectedBox.id);
    if (matched) {
      setSelectedBox(matched);
      return;
    }
    if (visibleRegisters[0]) setSelectedBox(visibleRegisters[0]);
  }, [registers, selectedBox.id, isAdmin]);

  const handleEnterBox = (reg: CashRegisterSession) => {
    if (!isAdmin && reg.isAdminBox) {
      toast.error('Solo el administrador puede entrar a la caja principal');
      return;
    }
    if (!reg.open) {
      setOpenTargetId(reg.id);
      return;
    }
    onSelect(reg.id);
    toast.success(`Entraste a ${reg.label} (${reg.cashier})`);
    onClose();
  };

  return (
    <div
      className="dialog-inline-host"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh] text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 sm:p-7 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              <Monitor size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Entrar a una caja
                </h2>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-100 dark:border-indigo-900/40">
                  Selección de Caja
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-400 font-medium mt-0.5">
                Selecciona la caja a la que deseas acceder para operar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 sm:px-7 py-2 overflow-y-auto space-y-6">
          {/* Top Card: MI CAJA PROPIA */}
          {isAdmin && (
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 relative">
              {/* Badge Top Left */}
              <div className="inline-block">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-md border border-indigo-100/80 dark:border-indigo-900/40">
                  MI CAJA PROPIA
                </span>
              </div>

              {/* Main Info Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <Shield size={26} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {adminBox.label}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                      Asignada a: <span className="font-semibold text-slate-800 dark:text-slate-200">{adminBox.cashier}</span>
                    </p>
                    <p className="text-xs text-slate-400 font-medium">{adminBox.role}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleEnterBox(adminBox)}
                  className="px-6 py-3 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 border border-slate-900 dark:border-white"
                >
                  <span>Entrar a Mi Caja</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* 3 Metric Cards inside Top Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0 shadow-2xs">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">VENTAS DE HOY</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                      RD$ {adminBox.salesToday.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0 shadow-2xs">
                    <Ticket size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">TICKETS</span>
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {adminBox.tickets} realizados
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0 shadow-2xs">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ESTADO</span>
                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Abierta ({adminBox.openedAt})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Middle Section Header */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                ¿A cuál caja quieres entrar? (Cajas disponibles)
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                {visibleRegisters.length} cajas disponibles
              </span>
            </div>

            {/* 2x2 Grid of Cash Register Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleRegisters.length === 0 ? (
                <p className="col-span-full text-sm text-slate-500 py-8 text-center">
                  No hay cajas disponibles para tu perfil.
                </p>
              ) : (
                visibleRegisters.map((reg) => {
                const isSelected = selectedBox.id === reg.id;
                const isActiveCurrent = currentId === reg.id;

                return (
                  <div
                    key={reg.id}
                    onClick={() => setSelectedBox(reg)}
                    onDoubleClick={() => handleEnterBox(reg)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'border-2 border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-indigo-500/10'
                        : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    {/* Top Checkmark if selected */}
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}

                    {/* Card User & Title */}
                    <div className="flex items-start justify-between gap-3 pr-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                              {reg.label}
                            </h4>
                            {reg.isAdminBox && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                                Principal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {reg.cashier}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {reg.role}
                          </p>
                        </div>
                      </div>

                      {/* Status indicator on right if not selected */}
                      {!isSelected && (
                        <div className="flex-shrink-0">
                          {reg.open ? (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Abierta
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                              <Lock size={12} />
                              Cerrada
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Metrics Row */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">VENTAS HOY</span>
                        <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                          RD$ {reg.salesToday.toLocaleString('es-DO')}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CARRITO EN CURSO</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {reg.cartItems > 0
                            ? `${reg.cartItems} ítems (RD$ ${reg.currentTotal.toLocaleString('es-DO')})`
                            : 'Vacío'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Active Indicator Banner if active current */}
                    {isActiveCurrent && (
                      <div className="bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1.5 border border-indigo-100/60 dark:border-indigo-900/30">
                        <Check size={14} strokeWidth={2.5} />
                        <span>Caja activa en este momento</span>
                      </div>
                    )}
                  </div>
                );
              })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 sm:p-7 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Info size={16} className="text-slate-400 flex-shrink-0" />
            <span>Puedes cambiar de caja libremente según los permisos de tu perfil de usuario.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleEnterBox(selectedBox)}
              className="px-6 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 border border-slate-900 dark:border-white"
            >
              <Monitor size={15} />
              <span>{selectedBox.open ? 'Entrar a caja' : 'Abrir / Iniciar esta Caja'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-2xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {openTargetId && (
        <PosCashOpenModal
          initialCajaId={openTargetId}
          onSuccess={() => {
            void refetch();
            onSelect(openTargetId as CashRegisterId);
            onClose();
          }}
          onClose={() => setOpenTargetId(null)}
        />
      )}
    </div>
  );
}
