import React, { useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShoppingCart,
  Package,
  BarChart2,
  UserRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  Banknote,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { getRoleHome, canAccessRoute, type AuthUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { iniciarCaja } from '@/services/cierresCaja.service';
import { obtenerCajas } from '@/services/cajas.service';
import { CASH_REGISTERS } from '@/lib/cashRegisters';
import { logAuditEvent } from '@/lib/auditStore';

const PRESET_AMOUNTS = [0, 1000, 2000, 3000, 5000];

const features = [
  { icon: ShoppingCart, label: 'Ventas rápidas' },
  { icon: Package, label: 'Inventario en tiempo real' },
  { icon: BarChart2, label: 'Reportes y estadísticas' },
  { icon: UserRound, label: 'Gestión de clientes' },
];

function MercatoLogo() {
  return (
    <div className="relative inline-block">
      <span
        className="text-5xl sm:text-6xl font-bold tracking-tight"
        style={{ color: '#14532d', fontFamily: 'var(--font-sans)' }}
      >
        mercat
        <span className="relative inline-block">
          o
          <svg
            className="absolute -top-2 -right-1 w-5 h-5"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path
              d="M6 14c2-6 6-9 10-10-1 4-3 7-6 9-1.5 1-3 1.5-4 1z"
              fill="#4ade80"
            />
            <path
              d="M10 6c1 2 2 3.5 2.5 5"
              stroke="#166534"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </span>
    </div>
  );
}

export default function LoginPage() {
  const { login, loginWithCode, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [montoApertura, setMontoApertura] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const montoInputRef = useRef<HTMLInputElement>(null);

  const showCashAmountField = Boolean(username.trim().length > 0 && password.length > 0);

  if (isAuthenticated && user && !isProcessingLogin) {
    const target = from && from !== '/login' && canAccessRoute(user.role, from) ? from : getRoleHome(user.role);
    return <Navigate to={target} replace />;
  }

  const goHome = (role: NonNullable<typeof user>['role']) => {
    const target = from && from !== '/login' && canAccessRoute(role, from) ? from : getRoleHome(role);
    navigate(target, { replace: true });
  };

  const autoOpenCashForUser = async (loggedUser: AuthUser, rawAmount: string) => {
    const monto = Math.max(0, parseFloat(rawAmount) || 0);
    try {
      let targetCajaId = '1';
      let targetLabel = 'Caja Principal';

      try {
        const dbCajas = await obtenerCajas({ soloActivas: true });
        const activeCajas = dbCajas.length > 0
          ? dbCajas.map((c) => ({
              id: String(c.id),
              label: c.nombre || `Caja #${c.codigo || c.id}`,
            }))
          : CASH_REGISTERS.map((c) => ({ id: c.id, label: c.label }));

        const uNorm = (loggedUser.name || '').trim().toLowerCase();
        const byName = uNorm
          ? activeCajas.find(
              (c) => c.label.toLowerCase().includes(uNorm) || uNorm.includes(c.label.toLowerCase())
            )
          : undefined;
        const chosen = byName || activeCajas[0];
        if (chosen) {
          targetCajaId = chosen.id;
          targetLabel = chosen.label;
        }
      } catch {
        // Fallback a Caja Principal
      }

      await iniciarCaja({
        caja_id: targetCajaId,
        caja_label: targetLabel,
        cajero_id: loggedUser.id || null,
        cajero_nombre: loggedUser.name || 'Cajero',
        cajero_username: loggedUser.username || loggedUser.email || '',
        monto_apertura: monto,
        forzarNueva: true,
      });

      logAuditEvent({
        user: loggedUser.name || 'Cajero',
        role: loggedUser.role || 'Cajero',
        action: 'Inicio de caja',
        module: 'Caja',
        details: `Inicio de caja automático al iniciar sesión con fondo de RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        after: { caja_id: targetCajaId, cajero_id: loggedUser.id, monto_apertura: monto },
      });

      sessionStorage.setItem('mercato_cash_opened_at_login', 'true');
    } catch (err) {
      console.warn('No se pudo iniciar la caja automáticamente en login:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    const parsedMonto = parseFloat(montoApertura);
    if (isNaN(parsedMonto) || parsedMonto < 0) {
      setError('Ingresa un monto de inicio de caja válido (0 o mayor)');
      return;
    }

    setLoading(true);
    setIsProcessingLogin(true);
    try {
      const result = await login(username, password);
      if (!result.ok) {
        setError(result.error);
        setIsProcessingLogin(false);
        return;
      }
      await autoOpenCashForUser(result.user, montoApertura);
      toast.success(
        `Bienvenido, ${result.user.name} · Caja iniciada con RD$ ${parsedMonto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
      );
      setIsProcessingLogin(false);
      goHome(result.user.role);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = Math.max(0, parseFloat(montoApertura) || 0);
    setIsProcessingLogin(true);
    try {
      const result = await loginWithCode(accessCode);
      if (!result.ok) {
        toast.error(result.error);
        setIsProcessingLogin(false);
        return;
      }
      await autoOpenCashForUser(result.user, String(parsedMonto));
      toast.success(
        `Acceso con código · ${result.user.name} · Caja iniciada con RD$ ${parsedMonto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
      );
      setCodeOpen(false);
      setIsProcessingLogin(false);
      goHome(result.user.role);
    } catch {
      setIsProcessingLogin(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ backgroundColor: '#f3f4f6' }}
    >
      {/* Decorative blobs */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, #bbf7d0 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 w-96 h-96 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, #86efac 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-0 w-40 h-64 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle, #166534 1.5px, transparent 1.5px)',
          backgroundSize: '18px 18px',
        }}
      />

      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Left branding */}
        <div className="hidden lg:flex flex-col justify-between p-10 xl:p-12 border-r border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck size={16} style={{ color: '#166534' }} />
            <span>Sistema de gestión para tu supermercado</span>
          </div>

          <div className="my-10">
            <MercatoLogo />
            <h2 className="mt-4 text-xl font-bold text-gray-800">
              Sistema de gestión para supermercados
            </h2>
            <div className="mt-3 w-12 h-1 rounded-full" style={{ backgroundColor: '#166534' }} />
            <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-sm">
              Administra tus ventas, inventario, clientes y más desde una sola plataforma eficiente y
              segura.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <Icon size={22} className="text-gray-600" strokeWidth={1.5} />
                <span className="text-[11px] text-gray-600 leading-tight font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div className="p-8 sm:p-10 xl:p-12 flex flex-col justify-center">
          <div className="lg:hidden mb-8">
            <MercatoLogo />
            <p className="text-sm text-gray-500 mt-2">Sistema de gestión para supermercados</p>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Bienvenido de nuevo</h1>
          <p className="text-sm text-gray-500 mt-1.5">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario</label>
              <div className="relative">
                <UserRound
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15 transition"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-11 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15 transition"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && username.trim() && password) {
                      e.preventDefault();
                      montoInputRef.current?.focus();
                      montoInputRef.current?.select();
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {showCashAmountField && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Banknote size={17} className="text-emerald-700 flex-shrink-0" />
                  <div>
                    <label className="block text-sm font-bold text-gray-900 leading-tight">
                      Monto de inicio de caja
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Ingresa el efectivo inicial en caja para comenzar a facturar
                    </p>
                  </div>
                </div>

                <div className="relative bg-white rounded-xl border-2 border-emerald-500/80 focus-within:border-emerald-700 px-3.5 py-2.5 flex items-center shadow-2xs">
                  <span className="text-xl font-black text-emerald-700 mr-2 select-none">
                    RD$
                  </span>
                  <input
                    ref={montoInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={montoApertura}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent font-black text-2xl text-gray-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_AMOUNTS.map((amt) => {
                    const isSelected = montoApertura === String(amt);
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setMontoApertura(String(amt))}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        RD$ {amt.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium hover:underline"
                style={{ color: '#166534' }}
                onClick={() =>
                  toast.info('Contacta al administrador para restablecer tu contraseña')
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
              style={{ backgroundColor: '#14532d' }}
            >
              {loading ? (
                <>
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Iniciando caja y entrando…
                </>
              ) : (
                <>
                  {showCashAmountField ? 'Iniciar sesión y abrir caja' : 'Iniciar sesión'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-400">o</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCodeOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition"
          >
            <ShieldCheck size={18} style={{ color: '#166534' }} />
            Acceder con código
          </button>

          {!isSupabaseConfigured() && (
            <p className="mt-6 text-[11px] text-center text-gray-400 leading-relaxed">
              Demo local: admin/admin123 · maria/maria123 · carlos/carlos123 · pedro/pedro123
              <br />
              Códigos: 1001 · 2002 · 3003 · 4004
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm font-medium" style={{ color: '#166534' }}>
        <ShieldCheck size={16} />
        Acceso seguro y protegido
      </div>

      {codeOpen && (
        <div
          className="dialog-inline-host"
          onClick={() => setCodeOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Acceder con código</h3>
              <button type="button" onClick={() => setCodeOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Ingresa el código de acceso y el monto de inicio de caja.
            </p>
            <form onSubmit={handleCodeAccess} className="space-y-3">
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15"
                placeholder="Código de acceso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                autoFocus
              />
              {accessCode.trim().length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <label className="block text-xs font-bold text-gray-800">
                    Monto de inicio de caja (RD$)
                  </label>
                  <div className="relative bg-white rounded-lg border border-emerald-500 px-3 py-2 flex items-center">
                    <span className="text-base font-black text-emerald-700 mr-1.5 select-none">RD$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoApertura}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => setMontoApertura(e.target.value)}
                      className="w-full bg-transparent font-black text-lg text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full rounded-xl py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: '#14532d' }}
              >
                Iniciar caja y entrar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
