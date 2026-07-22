'use client';
import dynamic from 'next/dynamic';

export const DashboardBentoGrid = dynamic(() => import('./DashboardBentoGrid'), {
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 8 })?.map((_, i) => (
        <div key={i} className="card p-5 h-28 animate-pulse bg-secondary/50" />
      ))}
    </div>
  ),
  ssr: false,
});

export const DashboardCharts = dynamic(() => import('./DashboardCharts'), {
  loading: () => <div className="card p-6 h-64 animate-pulse bg-secondary/50 mb-6" />,
  ssr: false,
});

export const RecentTransactions = dynamic(() => import('./RecentTransactions'), {
  loading: () => <div className="card p-6 h-48 animate-pulse bg-secondary/50" />,
  ssr: false,
});

export const InventoryAlerts = dynamic(() => import('./InventoryAlerts'), {
  loading: () => <div className="card p-6 h-48 animate-pulse bg-secondary/50" />,
  ssr: false,
});
