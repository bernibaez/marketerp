import React from 'react';
import {
  Lock, PlayCircle, Download, FileSpreadsheet, User, Eye,
} from 'lucide-react';
import type { CashClosure } from '@/lib/cashClosureStore';

interface CashClosureListViewProps {
  isAdmin: boolean;
  filteredClosures: CashClosure[];
  loading: boolean;
  searchUser: string;
  onSearchUserChange: (val: string) => void;
  singleDate: string;
  onSingleDateChange: (val: string) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  onOpenOpenModal: () => void;
  onOpenCloseModal: () => void;
  onViewClosure: (c: CashClosure) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}


export const CashClosureListView: React.FC<CashClosureListViewProps> = ({
  isAdmin,
  filteredClosures,
  loading,
  searchUser,
  onSearchUserChange,
  singleDate,
  onSingleDateChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onOpenOpenModal,
  onOpenCloseModal,
  onViewClosure,
  onExportPdf,
  onExportExcel,
}) => {
  return (
    <div className="space-y-6 slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lock className="text-primary" size={24} />
            Cierre de Caja Diario
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? 'Gestión y auditoría de cierres de caja de todos los usuarios' : 'Realiza y consulta tus cierres diarios de caja'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenOpenModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <PlayCircle size={16} />
            Iniciar / Abrir Caja
          </button>
          <button
            type="button"
            onClick={onOpenCloseModal}
            className="btn-primary flex items-center gap-2"
          >
            <Lock size={16} />
            Realizar Cierre de Hoy
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Total cierres registrados</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filteredClosures.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Total ventas procesadas</p>
          <p className="text-2xl font-bold text-success mt-1">
            RD$ {filteredClosures.reduce((s, c) => s + c.totalSales, 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Efectivo total en cierres</p>
          <p className="text-2xl font-bold text-info mt-1">
            RD$ {filteredClosures.reduce((s, c) => s + (c.totalCash ?? 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Diferencia neta acumulada</p>
          {(() => {
            const diff = filteredClosures.reduce((s, c) => s + c.difference, 0);
            return (
              <p className={`text-2xl font-bold mt-1 ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning' : 'text-success'}`}>
                RD$ {diff.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Filtrar por Usuario</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="input-field pl-9"
                  placeholder="Nombre de usuario..."
                  value={searchUser}
                  onChange={(e) => onSearchUserChange(e.target.value)}
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fecha Específica</label>
            <input
              type="date"
              className="input-field"
              value={singleDate}
              onChange={(e) => {
                onSingleDateChange(e.target.value);
                onStartDateChange('');
                onEndDateChange('');
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Desde (Rango)</label>
            <input
              type="date"
              className="input-field"
              value={startDate}
              onChange={(e) => {
                onStartDateChange(e.target.value);
                onSingleDateChange('');
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Hasta (Rango)</label>
            <input
              type="date"
              className="input-field"
              value={endDate}
              onChange={(e) => {
                onEndDateChange(e.target.value);
                onSingleDateChange('');
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Mostrando {filteredClosures.length} cierre(s)
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onExportPdf} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <Download size={14} /> Exportar PDF
            </button>
            <button type="button" onClick={onExportExcel} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
              <FileSpreadsheet size={14} /> Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Closures Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Caja</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cajero</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Vendido</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Diferencia</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Cargando cierres de caja...
                  </td>
                </tr>
              ) : filteredClosures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Lock size={32} className="mx-auto mb-2 opacity-30" />
                    No se encontraron cierres de caja con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredClosures.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/10'}`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-primary">{c.code}</td>
                    <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">{c.date}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                      {c.cashRegisterLabel || `Caja #${c.cashRegisterId}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-foreground text-xs">{c.userName}</p>
                        <p className="text-[11px] text-muted-foreground">@{c.username || 'usuario'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-foreground whitespace-nowrap">
                      RD$ {c.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs ${c.difference < 0
                            ? 'bg-danger-bg text-danger'
                            : c.difference > 0
                              ? 'bg-warning-bg text-warning'
                              : 'bg-success-bg text-success'
                          }`}
                      >
                        {c.difference >= 0 ? `+RD$ ${c.difference.toFixed(2)}` : `-RD$ ${Math.abs(c.difference).toFixed(2)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewClosure(c)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        title="Ver vista previa completa del cierre"
                      >
                        <Eye size={14} />
                        <span>Ver Detalle</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
