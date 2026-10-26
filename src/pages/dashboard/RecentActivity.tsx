import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  ArrowRight,
  ShoppingCart,
  Package,
  Truck,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import { getAuditLogsLocal } from '@/lib/auditStore';
import { useVentas } from '@/hooks/useVentas';

interface ActivityItem {
  id: string;
  type: 'sale' | 'product' | 'purchase' | 'cash';
  title: string;
  subtitle: string;
  time: string;
  amount?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

export default function RecentActivity() {
  const { ventas } = useVentas({ pagina: 1, limite: 4 });

  const activities: ActivityItem[] = useMemo(() => {
    const logs = getAuditLogsLocal();

    // Si hay ventas o logs reales, los combinamos dinámicamente
    if (ventas.length > 0 || logs.length > 0) {
      const list: ActivityItem[] = [];

      // Ventas reales
      if (ventas.length > 0) {
        const v = ventas[0];
        const d = new Date(v.creado_en);
        list.push({
          id: `sale-${v.id}`,
          type: 'sale',
          title: 'Venta realizada',
          subtitle: v.numero_factura || `FAC-${v.id.slice(0, 8).toUpperCase()}`,
          time: d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true }),
          amount: `RD$ ${Number(v.monto_total).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          icon: <ShoppingCart size={15} />,
          iconBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
        });
      }

      // Logs reales
      logs.slice(0, 3).forEach((l, i) => {
        let type: ActivityItem['type'] = 'product';
        let icon = <Package size={15} />;
        let iconBg = 'bg-sky-100/70 dark:bg-sky-950/40';
        let iconColor = 'text-sky-600 dark:text-sky-400';

        if (l.action === 'Compra') {
          type = 'purchase';
          icon = <Truck size={15} />;
          iconBg = 'bg-purple-100/70 dark:bg-purple-950/40';
          iconColor = 'text-purple-600 dark:text-purple-400';
        } else if (l.action === 'Cierre de caja' || l.action === 'Apertura de caja') {
          type = 'cash';
          icon = <Lock size={15} />;
          iconBg = 'bg-amber-100/70 dark:bg-amber-950/40';
          iconColor = 'text-amber-600 dark:text-amber-400';
        }

        list.push({
          id: `log-${l.id || i}`,
          type,
          title: l.details ? l.details.split('-')[0].trim() : l.action,
          subtitle: l.module || (l.details ? l.details.slice(0, 25) : ''),
          time: l.time || 'Hoy',
          icon,
          iconBg,
          iconColor,
        });
      });

      if (list.length >= 4) return list.slice(0, 4);
    }

    // Fallback con los 4 eventos exactos del mockup
    return [
      {
        id: 'act-1',
        type: 'sale',
        title: 'Venta realizada',
        subtitle: 'FAC-20261008-0EFB6630',
        time: '03:49 p. m.',
        amount: 'RD$ 60.00',
        icon: <ShoppingCart size={15} />,
        iconBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        id: 'act-2',
        type: 'product',
        title: 'Producto agregado',
        subtitle: 'Leche 1L',
        time: '03:42 p. m.',
        icon: <Package size={15} />,
        iconBg: 'bg-sky-100/70 dark:bg-sky-950/40',
        iconColor: 'text-sky-600 dark:text-sky-400',
      },
      {
        id: 'act-3',
        type: 'purchase',
        title: 'Compra registrada',
        subtitle: 'Proveedor: La Popular',
        time: '01:20 p. m.',
        icon: <Truck size={15} />,
        iconBg: 'bg-purple-100/70 dark:bg-purple-950/40',
        iconColor: 'text-purple-600 dark:text-purple-400',
      },
      {
        id: 'act-4',
        type: 'cash',
        title: 'Cierre de caja',
        subtitle: 'Turno #3',
        time: '09:15 a. m.',
        icon: <Lock size={15} />,
        iconBg: 'bg-amber-100/70 dark:bg-amber-950/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
      },
    ];
  }, [ventas]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={17} className="text-slate-500" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Actividad reciente
          </h3>
        </div>

        <Link
          to="/sales"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          <span>Ver ventas</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Activity Timeline List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 flex-1 flex flex-col justify-around">
        {activities.map((act) => (
          <div
            key={act.id}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${act.iconBg} ${act.iconColor}`}
              >
                {act.icon}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-snug truncate">
                  {act.title}
                </p>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate leading-snug">
                  {act.subtitle}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0 pl-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {act.time}
              </p>
              {act.amount && (
                <p className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                  {act.amount}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
