import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLogo from './ui/AppLogo';
import {
  LayoutDashboard, ShoppingCart, Package, Users, UserCheck, ShoppingBag, ArrowLeftRight, Sliders,
  BarChart2, Settings, ChevronRight, ChevronDown, Store, FileText, DollarSign, HandCoins, Wallet, Monitor,
  RotateCcw, Briefcase, Lock, ShieldCheck, Filter, Boxes, X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAccessNav } from '@/lib/auth';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  group?: string;
}

const navItems: NavItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/', group: 'Principal' },
  { id: 'nav-pos', label: 'Punto de Venta', icon: <Store size={20} />, href: '/point-of-sale-pos', group: 'Principal' },
  { id: 'nav-sales', label: 'Ventas', icon: <ShoppingCart size={20} />, href: '/sales', group: 'Operaciones' },
  { id: 'nav-purchases', label: 'Compras', icon: <ShoppingBag size={20} />, href: '/purchases', group: 'Operaciones' },
  { id: 'nav-returns', label: 'Devoluciones', icon: <RotateCcw size={20} />, href: '/returns-history', group: 'Operaciones' },
  { id: 'nav-products', label: 'Productos', icon: <Package size={20} />, href: '/product-management', group: 'Inventario' },
  { id: 'nav-combos', label: 'Combos', icon: <Boxes size={20} />, href: '/combos', group: 'Inventario' },
  { id: 'nav-stock-transfer', label: 'Transferencias', icon: <ArrowLeftRight size={20} />, href: '/stock-transfers', group: 'Inventario' },
  { id: 'nav-stock-adjust', label: 'Ajustes Stock', icon: <Sliders size={20} />, href: '/stock-adjustments', group: 'Inventario' },
  { id: 'nav-cajas', label: 'Cajas Registradoras', icon: <Monitor size={20} />, href: '/cajas', group: 'Finanzas' },
  { id: 'nav-contacts', label: 'Contactos', icon: <Users size={20} />, href: '/contacts', group: 'CRM' },
  { id: 'nav-cash-closure', label: 'Cierre de Caja', icon: <Lock size={20} />, href: '/cash-closure', group: 'Finanzas' },
  { id: 'nav-maleta', label: 'Maleta / Detalles', icon: <Briefcase size={20} />, href: '/maleta', group: 'Finanzas' },
  { id: 'nav-expenses', label: 'Gastos', icon: <DollarSign size={20} />, href: '/expenses', group: 'Finanzas' },
  { id: 'nav-receivable', label: 'Cuentas por Cobrar', icon: <HandCoins size={20} />, href: '/accounts-receivable', group: 'Finanzas' },
  { id: 'nav-payable', label: 'Cuentas por Pagar', icon: <Wallet size={20} />, href: '/accounts-payable', group: 'Finanzas' },
  { id: 'nav-reports', label: 'Informes', icon: <BarChart2 size={20} />, href: '/reports', group: 'Análisis' },
  { id: 'nav-users', label: 'Usuarios', icon: <UserCheck size={20} />, href: '/users', group: 'Configuración' },
  { id: 'nav-settings', label: 'Configuración', icon: <Settings size={20} />, href: '/settings', group: 'Configuración' },
  { id: 'nav-docs', label: 'Documentos', icon: <FileText size={20} />, href: '/documents', group: 'Configuración' },
];

const groups = ['Principal', 'Operaciones', 'Inventario', 'CRM', 'Finanzas', 'Análisis', 'Configuración'];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  currentPath: string;
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, currentPath }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'Cajero';
  const visibleNav = navItems.filter((n) => canAccessNav(role, n.href));

  const navRef = useRef<HTMLElement | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const handleNavScroll = (e: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem('sidebar_scroll_pos', e.currentTarget.scrollTop.toString());
  };

  useEffect(() => {
    const savedPos = sessionStorage.getItem('sidebar_scroll_pos');
    if (savedPos && navRef.current) {
      navRef.current.scrollTop = parseInt(savedPos, 10);
    }
  }, [currentPath]);

  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const displayGroups = groups;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col h-full bg-card border-r border-border/80 sidebar-transition z-30 flex-shrink-0 shadow-sm
          ${collapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-20 px-5 border-b border-border/80 flex-shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
          <AppLogo size={36} />
          {!collapsed && (
            <span className="font-extrabold text-xl text-foreground tracking-tight">
              Mercato
            </span>
          )}
        </div>

        {/* Nav */}
        <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-3">
          {displayGroups.map((group) => {
            const groupItems = visibleNav.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            const isGroupCollapsed = !!collapsedGroups[group];
            const hasActiveItemInGroup = groupItems.some((n) => isActive(n.href));

            return (
              <div key={`group-${group}`} className="space-y-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-all select-none cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{group}</span>
                      {hasActiveItemInGroup && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90 text-muted-foreground' : 'rotate-0 text-foreground'}`}
                    />
                  </button>
                )}

                {collapsed && <div className="mx-2 my-2 border-t border-border/70" />}

                {(!isGroupCollapsed || collapsed) &&
                  groupItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`
                          flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-base font-semibold
                          transition-all duration-200 group relative
                          ${active
                            ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 scale-[1.01]'
                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground hover:translate-x-0.5'
                          }
                          ${collapsed ? 'justify-center px-2 py-3.5' : ''}
                        `}
                      >
                        <span className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'text-primary-foreground' : 'text-primary'}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className={`flex-shrink-0 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'}`}>
                            {item.badge}
                          </span>
                        )}
                        {collapsed && item.badge && (
                          <span className="absolute top-1 right-1 bg-danger text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-xs">
                            {item.badge}
                          </span>
                        )}
                        {active && !collapsed && (
                          <ChevronRight size={16} className="flex-shrink-0 text-primary-foreground/90" />
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>

        {/* Bottom user */}
        <div className={`border-t border-border/80 p-4 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-base shadow-xs">
              {user?.initials?.charAt(0) ?? 'U'}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-base flex-shrink-0 shadow-xs">
                {user?.initials?.charAt(0) ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground truncate">{user?.name ?? 'Usuario'}</p>
                <p className="text-xs font-medium text-muted-foreground truncate">{user?.role ?? ''}</p>
              </div>
              <Settings size={18} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 cursor-pointer" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col
          sidebar-transition lg:hidden shadow-floating
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-20 px-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <span className="font-extrabold text-xl text-foreground tracking-tight">Mercato</span>
          </div>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-3">
          {displayGroups.map((group) => {
            const groupItems = visibleNav.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            const isGroupCollapsed = !!collapsedGroups[group];
            return (
              <div key={`mobile-group-${group}`} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-xl transition-all select-none cursor-pointer"
                >
                  <span>{group}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : 'rotate-0'}`}
                  />
                </button>
                {!isGroupCollapsed &&
                  groupItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={`mobile-${item.id}`}
                        to={item.href}
                        onClick={onMobileClose}
                        className={`
                          flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-base font-semibold
                          transition-all duration-200
                          ${active
                            ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20'
                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                          }
                        `}
                      >
                        <span className={`flex-shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${active ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}