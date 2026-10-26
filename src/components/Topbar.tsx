import React, { useState } from 'react';
import {
  Menu, Search, Bell, Sun, Moon, ChevronDown, X, Settings, LogOut, User, Users,
  Store, RotateCcw, Lock, ShoppingCart, Package, ArrowLeftRight, Sliders, Scale, DollarSign, BarChart2, ShieldCheck, UserCheck, ShoppingBag, HandCoins, Wallet, Briefcase
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  sidebarCollapsed: boolean;
}

interface AppNotification {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  time: string;
  href: string;
}

interface ModuleAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'amber';
}

interface ModuleInfo {
  name: string;
  group: string;
  actions: ModuleAction[];
}

const MODULE_MAP: Record<string, ModuleInfo> = {
  '/point-of-sale-pos': {
    name: 'Punto de Venta',
    group: 'Principal',
    actions: [
      { label: 'Devoluciones', href: '/returns-history', icon: <RotateCcw size={14} />, variant: 'danger' },
      { label: 'Cierre de Caja', href: '/cash-closure', icon: <Lock size={14} />, variant: 'amber' },
      { label: 'Ventas', href: '/sales', icon: <ShoppingCart size={14} /> },
    ],
  },
  '/returns-history': {
    name: 'Devoluciones',
    group: 'Operaciones',
    actions: [
      { label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' },
      { label: 'Ver Ventas', href: '/sales', icon: <ShoppingCart size={14} /> },
      { label: 'Cierre de Caja', href: '/cash-closure', icon: <Lock size={14} /> },
    ],
  },
  '/sales': {
    name: 'Ventas',
    group: 'Operaciones',
    actions: [
      { label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' },
      { label: 'Devoluciones', href: '/returns-history', icon: <RotateCcw size={14} />, variant: 'danger' },
      { label: 'Cierre de Caja', href: '/cash-closure', icon: <Lock size={14} /> },
    ],
  },
  '/purchases': {
    name: 'Compras',
    group: 'Operaciones',
    actions: [
      { label: 'Productos', href: '/product-management', icon: <Package size={14} />, variant: 'primary' },
      { label: 'Contactos', href: '/contacts', icon: <UserCheck size={14} /> },
    ],
  },
  '/product-management': {
    name: 'Productos e Inventario',
    group: 'Inventario',
    actions: [
      { label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' },
      { label: 'Transferencias', href: '/stock-transfers', icon: <ArrowLeftRight size={14} /> },
      { label: 'Ajustes Stock', href: '/stock-adjustments', icon: <Sliders size={14} /> },
      { label: 'Balanzas', href: '/scales', icon: <Scale size={14} /> },
    ],
  },
  '/stock-transfers': {
    name: 'Transferencias',
    group: 'Inventario',
    actions: [
      { label: 'Productos', href: '/product-management', icon: <Package size={14} />, variant: 'primary' },
      { label: 'Ajustes Stock', href: '/stock-adjustments', icon: <Sliders size={14} /> },
    ],
  },
  '/stock-adjustments': {
    name: 'Ajustes Stock',
    group: 'Inventario',
    actions: [
      { label: 'Productos', href: '/product-management', icon: <Package size={14} />, variant: 'primary' },
      { label: 'Transferencias', href: '/stock-transfers', icon: <ArrowLeftRight size={14} /> },
    ],
  },
  '/scales': {
    name: 'Balanzas',
    group: 'Inventario',
    actions: [
      { label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' },
      { label: 'Productos', href: '/product-management', icon: <Package size={14} /> },
    ],
  },
  '/contacts': {
    name: 'Contactos',
    group: 'CRM',
    actions: [
      { label: 'Ventas', href: '/sales', icon: <ShoppingCart size={14} /> },
      { label: 'Cuentas por Cobrar', href: '/accounts-receivable', icon: <HandCoins size={14} /> },
    ],
  },
  '/cash-closure': {
    name: 'Cierre de Caja',
    group: 'Finanzas',
    actions: [
      { label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' },
      { label: 'Gastos', href: '/expenses', icon: <DollarSign size={14} /> },
    ],
  },
  '/expenses': {
    name: 'Gastos',
    group: 'Finanzas',
    actions: [
      { label: 'Cierre de Caja', href: '/cash-closure', icon: <Lock size={14} /> },
      { label: 'Cuentas por Pagar', href: '/accounts-payable', icon: <Wallet size={14} /> },
    ],
  },
  '/accounts-receivable': {
    name: 'Cuentas por Cobrar',
    group: 'Finanzas',
    actions: [
      { label: 'Ventas', href: '/sales', icon: <ShoppingCart size={14} /> },
      { label: 'Contactos', href: '/contacts', icon: <UserCheck size={14} /> },
    ],
  },
  '/accounts-payable': {
    name: 'Cuentas por Pagar',
    group: 'Finanzas',
    actions: [
      { label: 'Compras', href: '/purchases', icon: <ShoppingBag size={14} /> },
      { label: 'Gastos', href: '/expenses', icon: <DollarSign size={14} /> },
    ],
  },
  '/reports': {
    name: 'Informes',
    group: 'Análisis',
    actions: [
      { label: 'Dashboard', href: '/', icon: <Store size={14} /> },
    ],
  },
};

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-001',
    type: 'warning',
    title: '8 productos con stock bajo',
    time: 'hace 5 min',
    href: '/product-management',
  },
  {
    id: 'notif-002',
    type: 'danger',
    title: '3 productos próximos a vencer',
    time: 'hace 12 min',
    href: '/product-management',
  },
  {
    id: 'notif-003',
    type: 'success',
    title: 'Compra #C-0142 recibida',
    time: 'hace 1 hora',
    href: '/purchases',
  },
  {
    id: 'notif-004',
    type: 'info',
    title: 'Backup automático completado',
    time: 'hace 3 horas',
    href: '/settings',
  },
  {
    id: 'notif-005',
    type: 'warning',
    title: 'Caja cerrada sin cuadre',
    time: 'ayer',
    href: '/reports',
  },
];

export default function Topbar({
  onToggleSidebar,
  onToggleMobileSidebar,
  darkMode,
  onToggleDark,
  sidebarCollapsed,
}: TopbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  const currentModule = MODULE_MAP[location.pathname] || {
    name: 'Dashboard',
    group: 'Principal',
    actions: [{ label: 'Ir al POS', href: '/point-of-sale-pos', icon: <Store size={14} />, variant: 'primary' }],
  };

  const handleLogout = () => {
    void logout();
    toast.success('Sesión cerrada');
    navigate('/login', { replace: true });
  };

  const unreadCount = notifications.length;

  const notifDot: Record<string, string> = {
    warning: 'bg-warning',
    danger: 'bg-danger',
    success: 'bg-success',
    info: 'bg-info',
  };

  const handleNotificationClick = (notification: AppNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    setNotifOpen(false);
    navigate(notification.href);
  };

  const handleClearAll = () => {
    setNotifications([]);
    setNotifOpen(false);
  };

  return (
    <header className="h-20 bg-card/90 backdrop-blur-md border-b border-border/80 flex items-center px-4 sm:px-6 gap-3 sm:gap-4 flex-shrink-0 z-20 relative shadow-sm">
      {/* Sidebar Toggle Buttons */}
      <button
        onClick={onToggleSidebar}
        className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl text-foreground/80 hover:bg-secondary hover:text-foreground transition-all"
        aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        <Menu size={20} />
      </button>

      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl text-foreground/80 hover:bg-secondary hover:text-foreground transition-all"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Module Title & Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="hidden md:inline text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {currentModule.group} /
        </span>
        <h2 className="font-black text-base sm:text-lg text-foreground truncate">
          {currentModule.name}
        </h2>
      </div>

      {/* Dynamic Contextual Action Buttons Tailored to Current Module */}
      <div className="hidden md:flex items-center gap-2 ml-2">
        {currentModule.actions.map((act) => {
          let btnClass = 'btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 transition-all shadow-xs';
          if (act.variant === 'primary') {
            btnClass = 'btn-primary text-xs font-bold py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs';
          } else if (act.variant === 'danger') {
            btnClass = 'px-3 py-1.5 rounded-xl bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs';
          } else if (act.variant === 'amber') {
            btnClass = 'px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs';
          }
          return (
            <Link key={act.href} to={act.href} className={btnClass}>
              {act.icon}
              <span>{act.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Topbar Search */}
      <div className="hidden xl:flex items-center max-w-xs relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
        <input
          type="text"
          placeholder="Buscar..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="input-field !pl-10 !pr-8 h-10 text-xs truncate"
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 z-10"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onToggleDark}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-foreground/80 hover:bg-secondary hover:text-foreground transition-all"
          aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
        >
          {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-400" />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((p) => !p);
              setProfileOpen(false);
            }}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl text-foreground/80 hover:bg-secondary hover:text-foreground transition-all"
            aria-label="Notificaciones"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-danger text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-floating z-50 fade-in overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-secondary/30">
                <span className="font-extrabold text-base text-foreground">Notificaciones</span>
                {unreadCount > 0 ? (
                  <span className="badge-danger">{unreadCount} nuevas</span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">Sin pendientes</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="px-5 py-10 text-center text-base text-muted-foreground">
                    No hay notificaciones
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="w-full flex items-start gap-3.5 px-5 py-3.5 border-b border-border/40 hover:bg-secondary/70 transition-colors cursor-pointer text-left"
                    >
                      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${notifDot[n.type]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground leading-snug">{n.title}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-1">{n.time}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="px-5 py-3 border-t border-border/80 bg-secondary/20">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="w-full text-center text-sm text-primary font-bold hover:underline py-1"
                  >
                    Limpiar todas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((p) => !p);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-secondary transition-all border border-transparent hover:border-border/60"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shadow-sm">
              {user?.initials?.charAt(0) ?? 'U'}
            </div>
            <span className="hidden sm:block text-sm font-bold text-foreground">
              {user?.name?.split(' ')[0] ?? 'Usuario'}
            </span>
            <ChevronDown size={16} className="text-muted-foreground" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-3 w-64 bg-card border border-border/80 rounded-2xl shadow-floating z-50 fade-in overflow-hidden">
              <div className="px-5 py-4 border-b border-border/80 bg-secondary/30">
                <p className="text-base font-bold text-foreground">{user?.name ?? 'Usuario'}</p>
                <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{user?.email}</p>
                <span className="inline-block badge-success mt-2">{user?.role}</span>
              </div>
              {[
                { icon: <User size={18} />, label: 'Mi Perfil', href: '/settings' },
                { icon: <Settings size={18} />, label: 'Configuración', href: '/settings' },
              ].map((item) => (
                <Link
                  key={`profile-${item.label}`}
                  to={item.href}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3.5 px-5 py-3 text-base font-semibold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <span className="text-primary">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-border/80">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3.5 px-5 py-3 text-base font-bold text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <Users size={18} className="text-primary" />
                  Cambiar usuario
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3.5 px-5 py-3.5 text-base font-bold text-danger hover:bg-danger-bg transition-colors"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
