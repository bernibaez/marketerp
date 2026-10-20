import React, { useState } from 'react';
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
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { getRoleHome } from '@/lib/auth';
import { isSupabaseConfigured } from '@/services/clienteSupabase';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  if (isAuthenticated && user) {
    return <Navigate to={from && from !== '/login' ? from : getRoleHome(user.role)} replace />;
  }

  const goHome = (role: NonNullable<typeof user>['role']) => {
    navigate(from && from !== '/login' ? from : getRoleHome(role), { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Bienvenido, ${result.user.name}`);
      goHome(result.user.role);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await loginWithCode(accessCode);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Acceso con código · ${result.user.name}`);
    setCodeOpen(false);
    goHome(result.user.role);
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
                  Entrando…
                </>
              ) : (
                <>
                  Iniciar sesión
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
              Ingresa el código de acceso asignado a tu rol o caja.
            </p>
            <form onSubmit={handleCodeAccess} className="space-y-3">
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15"
                placeholder="Código de acceso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="w-full rounded-xl py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: '#14532d' }}
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
