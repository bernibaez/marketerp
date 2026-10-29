import React from 'react';
import { Search } from 'lucide-react';

export type ReturnStatusTab = 'all' | 'pending' | 'approved' | 'rejected';

interface ReturnsFiltersBarProps {
  statusTab: ReturnStatusTab;
  onStatusTabChange: (tab: ReturnStatusTab) => void;
  counts: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  date: string;
  onDateChange: (val: string) => void;
  user: string;
  onUserChange: (val: string) => void;
  customer: string;
  onCustomerChange: (val: string) => void;
  cashier: string;
  onCashierChange: (val: string) => void;
  product: string;
  onProductChange: (val: string) => void;
}

export default function ReturnsFiltersBar({
  statusTab,
  onStatusTabChange,
  counts,
  date,
  onDateChange,
  user,
  onUserChange,
  customer,
  onCustomerChange,
  cashier,
  onCashierChange,
  product,
  onProductChange,
}: ReturnsFiltersBarProps) {
  const tabs = [
    { id: 'all' as const, label: 'Todas', count: counts.all },
    { id: 'pending' as const, label: 'Pendientes por Aprobar', count: counts.pending, highlight: true },
    { id: 'approved' as const, label: 'Aprobadas', count: counts.approved },
    { id: 'rejected' as const, label: 'Rechazadas', count: counts.rejected },
  ];

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex gap-2 border-b border-border pb-3 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onStatusTabChange(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              statusTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-foreground hover:bg-secondary'
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                tab.highlight && tab.count > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Inputs */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha</label>
            <input
              type="date"
              className="input-field"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Usuario</label>
            <input
              className="input-field"
              placeholder="Usuario..."
              value={user}
              onChange={(e) => onUserChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
            <input
              className="input-field"
              placeholder="Cliente..."
              value={customer}
              onChange={(e) => onCustomerChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cajero</label>
            <input
              className="input-field"
              placeholder="Cajero..."
              value={cashier}
              onChange={(e) => onCashierChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Factura, Dev. o Producto</label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10"
              />
              <input
                className="input-field !pl-9"
                placeholder="No. factura, dev. o producto..."
                value={product}
                onChange={(e) => onProductChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
