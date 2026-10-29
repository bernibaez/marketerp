import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, KeyRound, UserCheck, Lock, AlertCircle } from 'lucide-react';
import { verificarAutorizacionSupervisor } from '@/services/auth.service';
import type { AuthUser } from '@/lib/auth';
import { toast } from '@/lib/toast';

interface SupervisorAuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthorized: (adminUser: AuthUser) => void;
  title?: string;
  subtitle?: string;
  actionDescription?: string;
}

export default function SupervisorAuthModal({
  open,
  onClose,
  onAuthorized,
  title = 'Autorización de Administrador',
  subtitle = 'Solo los Administradores y Super Administradores pueden cambiar precios en el POS.',
  actionDescription,
}: SupervisorAuthModalProps) {
  const [tab, setTab] = useState<'pin' | 'credentials'>('pin');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode('');
      setUsername('');
      setPassword('');
      setError('');
      setLoading(false);
      setTimeout(() => {
        if (tab === 'pin' && pinInputRef.current) {
          pinInputRef.current.focus();
        } else if (tab === 'credentials' && userInputRef.current) {
          userInputRef.current.focus();
        }
      }, 100);
    }
  }, [open, tab]);

  if (!open) return null;

  const handleAuthorizeWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Ingresa el código o PIN de administrador');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await verificarAutorizacionSupervisor({ code: code.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Autorizado por: ${res.user.name} (${res.user.role})`);
      onAuthorized(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar credenciales');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeWithCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await verificarAutorizacionSupervisor({
        usernameOrEmail: username.trim(),
        password,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Autorizado por: ${res.user.name} (${res.user.role})`);
      onAuthorized(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar credenciales');
    } finally {
      setLoading(false);
    }
  };

  const appendPinDigit = (digit: string) => {
    setError('');
    setCode((prev) => (prev.length < 10 ? prev + digit : prev));
  };

  const clearPin = () => {
    setCode('');
    setError('');
  };

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action description info banner */}
        {actionDescription && (
          <div className="px-6 py-2.5 bg-muted/40 border-b border-border text-xs text-muted-foreground flex items-center gap-2">
            <Lock size={14} className="text-amber-500 shrink-0" />
            <span className="truncate">
              Acción: <strong className="text-foreground">{actionDescription}</strong>
            </span>
          </div>
        )}

        {/* Tab switch */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-muted rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTab('pin');
                setError('');
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'pin'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound size={14} />
              <span>PIN / Código</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('credentials');
                setError('');
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'credentials'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck size={14} />
              <span>Usuario y Contraseña</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Tab: PIN */}
        {tab === 'pin' && (
          <form onSubmit={handleAuthorizeWithPin} className="p-6 space-y-4">
            <div>
              <label htmlFor="supervisor-pin-input" className="text-xs font-bold text-foreground mb-1 block text-center">
                Código PIN de Administrador
              </label>
              <input
                ref={pinInputRef}
                id="supervisor-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) => {
                  setError('');
                  setCode(e.target.value);
                }}
                placeholder="••••"
                className="w-full text-center tracking-[0.5em] text-2xl font-black h-12 bg-background border-2 border-border focus:border-amber-500 rounded-xl focus:outline-none transition-colors"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                Ej: 1001 (Administrador General)
              </p>
            </div>

            {/* On-screen Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => appendPinDigit(String(n))}
                  className="h-11 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-black text-lg transition-colors border border-border cursor-pointer active:scale-95"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={clearPin}
                className="h-11 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors border border-rose-500/20 cursor-pointer active:scale-95"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => appendPinDigit('0')}
                className="h-11 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-black text-lg transition-colors border border-border cursor-pointer active:scale-95"
              >
                0
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 active:scale-95 flex items-center justify-center"
              >
                OK
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary !h-9 px-4 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="btn-primary !h-9 px-5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? 'Verificando...' : 'Autorizar'}
              </button>
            </div>
          </form>
        )}

        {/* Content Tab: Credentials */}
        {tab === 'credentials' && (
          <form onSubmit={handleAuthorizeWithCredentials} className="p-6 space-y-4">
            <div>
              <label htmlFor="supervisor-username-input" className="text-xs font-bold text-foreground mb-1 block">
                Usuario o Correo de Administrador
              </label>
              <input
                ref={userInputRef}
                id="supervisor-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin o admin@mercato.do"
                className="input-field !h-10 text-xs font-semibold"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label htmlFor="supervisor-password-input" className="text-xs font-bold text-foreground mb-1 block">
                Contraseña de Administrador
              </label>
              <input
                id="supervisor-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field !h-10 text-xs font-semibold"
                autoComplete="off"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary !h-9 px-4 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="btn-primary !h-9 px-5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {loading ? 'Verificando...' : 'Autorizar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

