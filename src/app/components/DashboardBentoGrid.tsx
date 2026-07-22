'use client';
import React, { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, Clock, Users, Truck, DollarSign, BarChart2, Receipt, Layers,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatNumber } from '@/lib/formatNumber';

interface DashboardStats {
  salesToday: number;
  salesMonth: number;
  salesMonthTarget: number;
  grossProfit: number;
  purchasesMonth: number;
  purchasesCount: number;
  productsSoldToday: number;
  transactionsToday: number;
  lowStockCount: number;
  criticalStockCount: number;
  expiringCount: number;
  clientsCount: number;
  suppliersCount: number;
  totalStock: number;
  pendingInvoices: number;
  pendingAmount: number;
  cashInRegister: number;
}

export default function DashboardBentoGrid() {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0, salesMonth: 0, salesMonthTarget: 2000000, grossProfit: 0,
    purchasesMonth: 0, purchasesCount: 0, productsSoldToday: 0, transactionsToday: 0,
    lowStockCount: 0, criticalStockCount: 0, expiringCount: 0, clientsCount: 0,
    suppliersCount: 0, totalStock: 0, pendingInvoices: 0, pendingAmount: 0, cashInRegister: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      try {
        const [salesTodayRes, salesMonthRes, purchasesMonthRes, productsRes, contactsRes, saleItemsTodayRes, pendingSalesRes, cashRes] = await Promise.all([
          supabase.from('sales').select('total').gte('created_at', today).lte('created_at', today + 'T23:59:59'),
          supabase.from('sales').select('total, subtotal').gte('created_at', monthStartStr),
          supabase.from('purchases').select('total').gte('created_at', monthStartStr),
          supabase.from('products').select('id, current_stock, min_stock, expiry_date').eq('is_active', true),
          supabase.from('contacts').select('id, type').eq('is_active', true),
          supabase.from('sale_items').select('quantity').gte('created_at', today),
          supabase.from('sales').select('total').eq('payment_status', 'pendiente'),
          supabase.from('cash_sessions').select('opening_amount').eq('status', 'abierta').limit(1),
        ]);

        const salesToday = (salesTodayRes.data || []).reduce((s, r) => s + Number(r.total), 0);
        const salesMonth = (salesMonthRes.data || []).reduce((s, r) => s + Number(r.total), 0);
        const purchasesMonth = (purchasesMonthRes.data || []).reduce((s, r) => s + Number(r.total), 0);
        const grossProfit = salesMonth - purchasesMonth;

        const products = productsRes.data || [];
        const lowStockCount = products.filter(p => Number(p.current_stock) <= Number(p.min_stock) && Number(p.current_stock) > 0).length;
        const criticalStockCount = products.filter(p => Number(p.current_stock) === 0).length;
        const totalStock = products.reduce((s, p) => s + Number(p.current_stock), 0);
        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        const expiringCount = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= nextWeek).length;

        const contacts = contactsRes.data || [];
        const clientsCount = contacts.filter(c => c.type === 'cliente' || c.type === 'ambos').length;
        const suppliersCount = contacts.filter(c => c.type === 'proveedor' || c.type === 'ambos').length;

        const productsSoldToday = (saleItemsTodayRes.data || []).reduce((s: number, r: any) => s + Number(r.quantity), 0);
        const transactionsToday = salesTodayRes.data?.length || 0;

        const pendingInvoices = pendingSalesRes.data?.length || 0;
        const pendingAmount = (pendingSalesRes.data || []).reduce((s, r) => s + Number(r.total), 0);
        const cashInRegister = cashRes.data?.[0]?.opening_amount || 0;

        setStats({
          salesToday, salesMonth, salesMonthTarget: 2000000, grossProfit,
          purchasesMonth, purchasesCount: purchasesMonthRes.data?.length || 0,
          productsSoldToday, transactionsToday,
          lowStockCount, criticalStockCount, expiringCount,
          clientsCount, suppliersCount, totalStock,
          pendingInvoices, pendingAmount, cashInRegister,
        });
      } catch {
        // silently fail — stats remain at defaults
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const progressMonth = Math.min(100, Math.round((stats.salesMonth / stats.salesMonthTarget) * 100));

  const kpiData = [
    {
      id: 'kpi-ventas-dia', label: 'Ventas del Día',
      value: loading ? '...' : `RD$ ${formatNumber(stats.salesToday)}`,
      subValue: `${stats.transactionsToday} transacciones`,
      icon: <ShoppingCart size={20} />, iconBg: 'bg-primary/10', iconColor: 'text-primary',
      colSpan: 'col-span-1 md:col-span-2',
    },
    {
      id: 'kpi-ventas-mes', label: 'Ventas del Mes',
      value: loading ? '...' : `RD$ ${formatNumber(stats.salesMonth)}`,
      subValue: `Meta: RD$ ${formatNumber(stats.salesMonthTarget)}`,
      icon: <TrendingUp size={20} />, iconBg: 'bg-info-bg', iconColor: 'text-info',
      progress: progressMonth, progressColor: 'bg-info',
    },
    {
      id: 'kpi-ganancias', label: 'Ganancias Brutas',
      value: loading ? '...' : `RD$ ${formatNumber(stats.grossProfit)}`,
      subValue: stats.salesMonth > 0 ? `Margen: ${((stats.grossProfit / stats.salesMonth) * 100).toFixed(1)}%` : 'Sin ventas',
      icon: <DollarSign size={20} />, iconBg: 'bg-success-bg', iconColor: 'text-success',
    },
    {
      id: 'kpi-compras', label: 'Compras del Mes',
      value: loading ? '...' : `RD$ ${formatNumber(stats.purchasesMonth)}`,
      subValue: `${stats.purchasesCount} órdenes emitidas`,
      icon: <Truck size={20} />, iconBg: 'bg-secondary', iconColor: 'text-secondary-foreground',
    },
    {
      id: 'kpi-productos-vendidos', label: 'Productos Vendidos Hoy',
      value: loading ? '...' : stats.productsSoldToday.toString(),
      subValue: `en ${stats.transactionsToday} transacciones`,
      icon: <BarChart2 size={20} />, iconBg: 'bg-primary/10', iconColor: 'text-primary',
    },
    {
      id: 'kpi-stock-bajo', label: 'Productos Stock Bajo',
      value: loading ? '...' : stats.lowStockCount.toString(),
      subValue: `${stats.criticalStockCount} sin stock`,
      icon: <AlertTriangle size={20} />, iconBg: 'bg-warning-bg', iconColor: 'text-warning',
      warning: stats.lowStockCount > 0,
    },
    {
      id: 'kpi-por-vencer', label: 'Próximos a Vencer',
      value: loading ? '...' : stats.expiringCount.toString(),
      subValue: 'Vencen esta semana',
      icon: <Clock size={20} />, iconBg: 'bg-danger-bg', iconColor: 'text-danger',
      alert: stats.expiringCount > 0,
    },
    {
      id: 'kpi-clientes', label: 'Clientes Registrados',
      value: loading ? '...' : stats.clientsCount.toString(),
      subValue: `${stats.suppliersCount} proveedores`,
      icon: <Users size={20} />, iconBg: 'bg-info-bg', iconColor: 'text-info',
    },
    {
      id: 'kpi-proveedores', label: 'Proveedores Activos',
      value: loading ? '...' : stats.suppliersCount.toString(),
      subValue: 'Proveedores activos',
      icon: <Truck size={20} />, iconBg: 'bg-secondary', iconColor: 'text-secondary-foreground',
    },
    {
      id: 'kpi-stock-total', label: 'Stock Total',
      value: loading ? '...' : formatNumber(stats.totalStock),
      subValue: 'unidades en inventario',
      icon: <Layers size={20} />, iconBg: 'bg-primary/10', iconColor: 'text-primary',
      progress: 78, progressColor: 'bg-primary',
    },
    {
      id: 'kpi-facturas', label: 'Facturas Pendientes',
      value: loading ? '...' : stats.pendingInvoices.toString(),
      subValue: `RD$ ${formatNumber(stats.pendingAmount)} por cobrar`,
      icon: <Receipt size={20} />, iconBg: 'bg-warning-bg', iconColor: 'text-warning',
      warning: stats.pendingInvoices > 0,
    },
    {
      id: 'kpi-caja', label: 'Caja Abierta',
      value: loading ? '...' : `RD$ ${formatNumber(stats.cashInRegister)}`,
      subValue: 'Monto de apertura',
      icon: <Package size={20} />, iconBg: 'bg-success-bg', iconColor: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 mb-6">
      {kpiData.map((kpi) => {
        const borderClass = kpi.alert ? 'border-danger/30 bg-danger-bg/30' : kpi.warning ? 'border-warning/30 bg-warning-bg/30' : '';
        return (
          <div key={kpi.id} className={`card p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow duration-200 ${kpi.colSpan || ''} ${borderClass}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">{kpi.label}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.iconBg} ${kpi.iconColor}`}>{kpi.icon}</div>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-foreground leading-none">{kpi.value}</p>
              {kpi.subValue && <p className="text-xs text-muted-foreground mt-1">{kpi.subValue}</p>}
            </div>
            {kpi.progress !== undefined && kpi.progressColor && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Progreso</span><span className="tabular-nums font-medium">{kpi.progress}%</span></div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${kpi.progressColor} rounded-full transition-all duration-500`} style={{ width: `${kpi.progress}%` }} />
                </div>
              </div>
            )}
            {(kpi.alert || kpi.warning) && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className={kpi.alert ? 'text-danger' : 'text-warning'} />
                <span className={`text-xs font-medium ${kpi.alert ? 'text-danger' : 'text-warning'}`}>
                  {kpi.alert ? 'Requiere atención inmediata' : 'Revisar pronto'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}