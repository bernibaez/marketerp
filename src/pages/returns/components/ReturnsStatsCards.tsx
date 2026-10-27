import React from 'react';

interface ReturnsStatsCardsProps {
  filteredCount: number;
  pendingCount: number;
  totalAmount: number;
  totalHistory: number;
}

export default function ReturnsStatsCards({
  filteredCount,
  pendingCount,
  totalAmount,
  totalHistory,
}: ReturnsStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card p-4">
        <p className="text-xs text-muted-foreground font-semibold">Devoluciones Filtradas</p>
        <p className="text-2xl font-bold text-foreground mt-1">{filteredCount}</p>
      </div>
      <div className="card p-4 border-amber-500/20 bg-amber-500/5">
        <p className="text-xs text-muted-foreground font-semibold">Pendientes de Admin</p>
        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</p>
      </div>
      <div className="card p-4">
        <p className="text-xs text-muted-foreground font-semibold">Monto Filtrado Reembolsado</p>
        <p className="text-2xl font-bold text-danger mt-1">
          RD$ {totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-xs text-muted-foreground font-semibold">Total Histórico</p>
        <p className="text-2xl font-bold text-info mt-1">{totalHistory} registros</p>
      </div>
    </div>
  );
}
