import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Scale,
  Trash2,
  Sparkles,
  X,
} from 'lucide-react';

export interface OperationProgressState {
  open: boolean;
  title: string;
  subtitle?: string;
  current: number;
  total: number;
  currentItemName?: string;
  variant?: 'emerald' | 'rose' | 'indigo' | 'amber';
  iconType?: 'scale' | 'trash' | 'sync';
  stats?: {
    successLabel?: string;
    successCount?: number;
    warningLabel?: string;
    warningCount?: number;
    errorLabel?: string;
    errorCount?: number;
  };
  isFinished?: boolean;
  onClose?: () => void;
}

export default function OperationProgressModal({
  open,
  title,
  subtitle,
  current,
  total,
  currentItemName,
  variant = 'emerald',
  iconType = 'sync',
  stats,
  isFinished = false,
  onClose,
}: OperationProgressState) {
  if (!open) return null;

  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  const colorStyles = {
    emerald: {
      bar: 'from-emerald-500 via-teal-400 to-emerald-400',
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
      glow: 'shadow-emerald-500/20',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    rose: {
      bar: 'from-rose-500 via-red-500 to-amber-500',
      badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      iconBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
      glow: 'shadow-rose-500/20',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    indigo: {
      bar: 'from-indigo-500 via-purple-500 to-sky-400',
      badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900',
      glow: 'shadow-indigo-500/20',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    },
    amber: {
      bar: 'from-amber-500 via-orange-400 to-yellow-400',
      badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
      glow: 'shadow-amber-500/20',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
  }[variant];

  const renderIcon = () => {
    if (isFinished) {
      return <CheckCircle2 size={24} className="text-emerald-500 animate-scaleIn" />;
    }
    if (iconType === 'scale') {
      return <Scale size={24} className="animate-pulse" />;
    }
    if (iconType === 'trash') {
      return <Trash2 size={24} className="animate-bounce" />;
    }
    return <Loader2 size={24} className="animate-spin" />;
  };

  return (
    <div className="dialog-inline-host z-[1200]">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-5 text-slate-800 dark:text-slate-200 animate-modalPanelIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 ${colorStyles.iconBg} ${colorStyles.glow} shadow-lg`}
            >
              {renderIcon()}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-medium mt-0.5">
                {subtitle || 'Por favor espera mientras finaliza la operación...'}
              </p>
            </div>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${colorStyles.badge}`}
          >
            {isFinished ? (
              <span>100%</span>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></span>
                <span>{percentage}%</span>
              </>
            )}
          </div>
        </div>

        {/* Barra de Progreso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
            <span>
              Progreso: <strong className="text-slate-900 dark:text-white">{current}</strong> de{' '}
              <strong className="text-slate-900 dark:text-white">{total}</strong>
            </span>
            <span className="font-mono">{percentage}%</span>
          </div>

          <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r ${colorStyles.bar} shadow-sm relative overflow-hidden`}
              style={{ width: `${Math.max(4, percentage)}%` }}
            >
              {/* Shimmer animation */}
              <div className="absolute inset-0 bg-white/20 -skew-x-12 animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Item actual procesándose */}
        {currentItemName && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium flex-shrink-0">
              {isFinished ? 'Último ítem:' : 'Procesando:'}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-right">
              {currentItemName}
            </span>
          </div>
        )}

        {/* Stats / Contadores en tiempo real */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {stats.successCount !== undefined && (
              <div className="p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-center">
                <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 block tracking-wider">
                  {stats.successLabel || 'Exitosos'}
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {stats.successCount}
                </span>
              </div>
            )}

            {stats.warningCount !== undefined && (
              <div className="p-2.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-center">
                <span className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 block tracking-wider">
                  {stats.warningLabel || 'Avisos'}
                </span>
                <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                  {stats.warningCount}
                </span>
              </div>
            )}

            {stats.errorCount !== undefined && (
              <div className="p-2.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-center">
                <span className="text-[10px] uppercase font-black text-rose-600 dark:text-rose-400 block tracking-wider">
                  {stats.errorLabel || 'Errores'}
                </span>
                <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                  {stats.errorCount}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="text-[11px] text-slate-400 font-medium">
            {!isFinished ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Procesando en segundo plano...</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>Operación completada exitosamente</span>
              </span>
            )}
          </div>

          {isFinished && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-2 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer ${colorStyles.btn}`}
            >
              Listo / Aceptar
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium italic">
              No recargues la página
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
