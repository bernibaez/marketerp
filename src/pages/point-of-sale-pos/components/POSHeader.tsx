import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  RotateCcw,
  X,
  Briefcase,
  Calculator,
  Undo2,
  Pause,
  MinusCircle,
  PlayCircle,
  Lock,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Users,
  Monitor,
  CheckCircle2,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessRoute } from '@/lib/auth';
import PosCalculatorModal from './PosCalculatorModal';

interface POSHeaderProps {
  cartCount: number;
  total: number;
  heldCount: number;
  awaitingDelete: boolean;
  cashLabel: string;
  cashierName: string;
  isRemoteAdmin: boolean;
  onClear: () => void;
  onHold: () => void;
  onExpense: () => void;
  onScale?: () => void;
  onReturn: () => void;
  onCancelDelete: () => void;
  onToggleDeleteMode?: () => void;
  onSwitchCash: () => void;
  onOpenRegisterDetails?: () => void;
  cashIsOpen?: boolean;
  onOpenCash?: () => void;
  onCloseCash?: () => void;
}

const POSHeader = React.memo(function POSHeader({
  cartCount,
  total,
  heldCount,
  awaitingDelete,
  cashLabel,
  cashierName,
  isRemoteAdmin,
  onClear,
  onHold,
  onExpense,
  onScale,
  onReturn,
  onCancelDelete,
  onToggleDeleteMode,
  onSwitchCash,
  onOpenRegisterDetails,
  cashIsOpen = false,
  onOpenCash,
  onCloseCash,
}: POSHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const canSettings = canAccessRoute(user?.role ?? 'Cajero', '/settings');
  const canHome = canAccessRoute(user?.role ?? 'Cajero', '/');
  const canSales = canAccessRoute(user?.role ?? 'Cajero', '/sales');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hh = String(hours).padStart(2, '0');
      setTimeStr(`${dd}-${mm}-${yyyy} ${hh}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [profileOpen]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm px-4 py-2.5 mb-2.5 flex-shrink-0">
        {/* Left Section: Ubicación + Purple Date Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5 text-xs">
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight">
              Ubicación:
            </span>
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight text-[11px] sm:text-xs">
              {cashLabel ? (cashLabel.toUpperCase().includes('CAJA') ? cashLabel : `CAJA: ${cashLabel}`) : 'CAJA PRINCIPAL'}
            </span>
          </div>

          {/* Purple Pill Button with Date & Keyboard Icon */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5c55e6] hover:bg-[#5048db] text-white text-xs font-bold shadow-xs transition-colors cursor-default select-none">
            <span>{timeStr || '14-09-2026 09:18 AM'}</span>
            <span className="text-[13px] leading-none">⌨️</span>
          </div>
        </div>

        {/* Center / Actions: 7 Square Cards + Agregar Gasto */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {/* 1. Fast Rewind / Venta Previa (Blue/Cyan) */}
          <button
            type="button"
            onClick={onClear}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-sky-500 hover:text-sky-600 cursor-pointer"
            title="Venta Previa / Reajustar"
          >
            <RotateCcw size={18} strokeWidth={2.5} />
          </button>

          {/* 2. Red X / Limpiar Carrito */}
          <button
            type="button"
            onClick={onClear}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-red-500 hover:text-red-600 cursor-pointer"
            title="Limpiar Carrito / Cancelar"
          >
            <X size={20} strokeWidth={2.6} />
          </button>

          {/* 3. Teal Briefcase / Registrar Detalles de Caja */}
          <button
            type="button"
            onClick={onOpenRegisterDetails}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-teal-600 hover:text-teal-700 cursor-pointer"
            title="Registrar detalles de caja"
          >
            <Briefcase size={18} strokeWidth={2.4} />
          </button>

          {/* 4. Green Calculator / Calculadora Rápida */}
          <button
            type="button"
            onClick={() => setCalcOpen(true)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-emerald-600 hover:text-emerald-700 cursor-pointer"
            title="Abrir Calculadora"
          >
            <Calculator size={18} strokeWidth={2.4} />
          </button>

          {/* 5. Red Undo / Devolución */}
          <button
            type="button"
            onClick={onReturn}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-rose-500 hover:text-rose-600 cursor-pointer"
            title="Devolución de Producto"
          >
            <Undo2 size={18} strokeWidth={2.5} />
          </button>

          {/* 6. Purple Drawer / Cambiar Caja */}
          <button
            type="button"
            onClick={onSwitchCash}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-indigo-600 hover:text-indigo-700 cursor-pointer"
            title="Cambiar de Caja / Terminal"
          >
            <Monitor size={18} strokeWidth={2.4} />
          </button>

          {/* 7. Grey/Blue Pause / Ventas en Espera */}
          <button
            type="button"
            onClick={onHold}
            className="relative w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center shadow-xs transition-all active:scale-95 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            title="Ventas Suspendidas"
          >
            <Pause size={18} strokeWidth={2.4} />
            {heldCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-black px-1 shadow-xs">
                {heldCount}
              </span>
            )}
          </button>

          {/* 8. Agregar Gasto Button (Pill with border) */}
          <button
            type="button"
            onClick={onExpense}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer ml-1"
          >
            <MinusCircle size={15} className="text-slate-800 dark:text-slate-200" strokeWidth={2.3} />
            <span>Agregar gasto</span>
          </button>
        </div>

        {/* Right Section: Inicio/Cierre de Caja & User Profile */}
        <div className="flex items-center gap-2.5">
          {/* Shift State: Iniciar Caja o Cierre de Caja */}
          {cashIsOpen ? (
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={13} />
                <span>Caja Abierta</span>
              </div>
              {onCloseCash && (
                <button
                  type="button"
                  onClick={onCloseCash}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Cerrar turno de caja y realizar arqueo"
                >
                  <Lock size={14} />
                  <span>Cierre de caja</span>
                </button>
              )}
            </div>
          ) : (
            onOpenCash && (
              <button
                type="button"
                onClick={onOpenCash}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Abrir turno de caja con fondo inicial"
              >
                <PlayCircle size={15} />
                <span>Iniciar Caja</span>
              </button>
            )
          )}

          {/* User Account / Navigation Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((p) => !p)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              title="Menú y usuario"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                {(user?.initials || user?.name || cashierName || 'U').charAt(0).toUpperCase()}
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {user?.name || cashierName || 'Usuario'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user?.email || '—'}
                  </p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800">
                    {user?.role || 'Cajero'}
                  </span>
                </div>

                <div className="py-1">
                  {canHome && (
                    <Link
                      to="/"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Home size={15} className="text-indigo-600" />
                      Menú Principal
                    </Link>
                  )}
                  {canSales && (
                    <Link
                      to="/sales"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Briefcase size={15} className="text-indigo-600" />
                      Mis Ventas
                    </Link>
                  )}
                  {canSettings && (
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings size={15} className="text-indigo-600" />
                      Configuración
                    </Link>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 py-1">
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut size={15} />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <PosCalculatorModal isOpen={calcOpen} onClose={() => setCalcOpen(false)} />
    </>
  );
});

export default POSHeader;
