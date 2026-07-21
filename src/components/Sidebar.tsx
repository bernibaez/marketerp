'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import { LayoutDashboard, ShoppingCart, Package, Users, UserCheck, ShoppingBag, ArrowLeftRight, Sliders, BarChart2, Settings, ChevronRight, Store, FileText, DollarSign, ClipboardList, Upload, Shield, TrendingUp, RotateCcw, Truck, Tag, Layers, BookOpen } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  group?: string;
}

const navItems: NavItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/', group: 'Principal' },
  { id: 'nav-pos', label: 'Punto de Venta', icon: <Store size={18} />, href: '/point-of-sale-pos', group: 'Principal' },
  { id: 'nav-sales', label: 'Ventas', icon: <ShoppingCart size={18} />, href: '/sales', group: 'Operaciones' },
  { id: 'nav-preventas', label: 'Preventas', icon: <ClipboardList size={18} />, href: '/preventas', group: 'Operaciones' },
  { id: 'nav-cotizaciones', label: 'Cotizaciones', icon: <FileText size={18} />, href: '/cotizaciones', group: 'Operaciones' },
  { id: 'nav-purchases', label: 'Compras', icon: <ShoppingBag size={18} />, href: '/purchases', group: 'Operaciones' },
  { id: 'nav-devoluciones', label: 'Devoluciones', icon: <RotateCcw size={18} />, href: '/devoluciones', group: 'Operaciones' },
  { id: 'nav-envios', label: 'Envíos', icon: <Truck size={18} />, href: '/envios', group: 'Operaciones' },
  { id: 'nav-products', label: 'Productos', icon: <Package size={18} />, href: '/product-management', group: 'Inventario' },
  { id: 'nav-catalogo', label: 'Catálogo', icon: <BookOpen size={18} />, href: '/catalogo', group: 'Inventario' },
  { id: 'nav-importar', label: 'Importar Datos', icon: <Upload size={18} />, href: '/importar', group: 'Inventario' },
  { id: 'nav-stock-transfer', label: 'Transferencias', icon: <ArrowLeftRight size={18} />, href: '/stock-transfers', group: 'Inventario' },
  { id: 'nav-stock-adjust', label: 'Ajustes Stock', icon: <Sliders size={18} />, href: '/stock-adjustments', group: 'Inventario' },
  { id: 'nav-garantias', label: 'Garantías', icon: <Shield size={18} />, href: '/garantias', group: 'Inventario' },
  { id: 'nav-contacts', label: 'Contactos', icon: <Users size={18} />, href: '/contacts', group: 'CRM' },
  { id: 'nav-expenses', label: 'Gastos', icon: <DollarSign size={18} />, href: '/expenses', group: 'Finanzas' },
  { id: 'nav-descuentos', label: 'Descuentos', icon: <Tag size={18} />, href: '/descuentos', group: 'Finanzas' },
  { id: 'nav-grupos-precios', label: 'Grupos de Precios', icon: <Layers size={18} />, href: '/grupos-precios', group: 'Finanzas' },
  { id: 'nav-reports', label: 'Informes', icon: <BarChart2 size={18} />, href: '/reports', group: 'Análisis' },
  { id: 'nav-reports-advanced', label: 'Inf. Avanzados', icon: <TrendingUp size={18} />, href: '/informes-avanzados', group: 'Análisis' },
  { id: 'nav-users', label: 'Usuarios', icon: <UserCheck size={18} />, href: '/users', group: 'Configuración' },
  { id: 'nav-settings', label: 'Configuración', icon: <Settings size={18} />, href: '/settings', group: 'Configuración' },
  { id: 'nav-config-advanced', label: 'Config. Avanzada', icon: <Shield size={18} />, href: '/configuracion-avanzada', group: 'Configuración' },
];

const groups = ['Principal', 'Operaciones', 'Inventario', 'CRM', 'Finanzas', 'Análisis', 'Configuración'];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  currentPath: string;
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, currentPath }: SidebarProps) {
  const isActive = (href: string) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col h-full bg-card border-r border-border sidebar-transition z-30 flex-shrink-0
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 px-4 border-b border-border flex-shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
          <AppLogo size={32} />
          {!collapsed && (
            <span className="font-bold text-lg text-foreground tracking-tight">
              MarketERP
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
          {groups.map((group) => {
            const groupItems = navItems.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={`group-${group}`} className="mb-1">
                {!collapsed && (
                  <p className="px-4 py-1.5 text-xs font-600 uppercase tracking-widest text-muted-foreground select-none">
                    {group}
                  </p>
                )}
                {collapsed && <div className="mx-2 my-1 border-t border-border" />}
                {groupItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`
                      flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150 group relative
                      ${isActive(item.href)
                        ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }
                      ${collapsed ? 'justify-center px-2' : ''}
                    `}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute top-1 right-1 bg-danger text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">
                        {item.badge}
                      </span>
                    )}
                    {isActive(item.href) && !collapsed && (
                      <ChevronRight size={14} className="flex-shrink-0 text-primary" />
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Bottom user */}
        <div className={`border-t border-border p-3 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              A
            </div>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">Admin General</p>
                <p className="text-xs text-muted-foreground truncate">admin@marketerp.do</p>
              </div>
              <Settings size={14} className="text-muted-foreground flex-shrink-0" />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col
          sidebar-transition lg:hidden
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo size={32} />
            <span className="font-bold text-lg text-foreground tracking-tight">MarketERP</span>
          </div>
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3">
          {groups.map((group) => {
            const groupItems = navItems.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={`mobile-group-${group}`} className="mb-1">
                <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground select-none">
                  {group}
                </p>
                {groupItems.map((item) => (
                  <Link
                    key={`mobile-${item.id}`}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`
                      flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150
                      ${isActive(item.href)
                        ? 'bg-primary/10 text-primary' :'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }
                    `}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}