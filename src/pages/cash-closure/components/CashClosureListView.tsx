import React from 'react';
import {
<<<<<<< HEAD
  Lock, PlayCircle, Download, FileSpreadsheet, User, Eye, AlertTriangle,
=======
  Lock,
  PlayCircle,
  Download,
  FileSpreadsheet,
  User,
  Eye,
  Monitor,
  Clock,
  RefreshCw,
  CheckCircle2,
  Banknote,
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
} from 'lucide-react';
import type { CashClosure } from '@/lib/cashClosureStore';
import type { CashRegisterSession } from '@/lib/cashRegisters';

interface CashClosureListViewProps {
  isAdmin: boolean;
  registers: CashRegisterSession[];
  loadingRegisters?: boolean;
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
  onCloseActiveRegister: (reg: CashRegisterSession) => void;
  onRefresh?: () => void;
  onViewClosure: (c: CashClosure) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

const formatTimeShort = (val?: string) => {
  if (!val) return '—';
  if (val.includes('T')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
    }
  }
  return val.split(' ')[1] || val;
};

export const CashClosureListView: React.FC<CashClosureListViewProps> = ({
  isAdmin,
  registers,
  loadingRegisters = false,
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
  onCloseActiveRegister,
  onRefresh,
  onViewClosure,
  onExportPdf,
  onExportExcel,
}) => {
  const openRegisters = registers.filter((r) => r.open);
  const closedRegisters = registers.filter((r) => !r.open);

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
            {isAdmin
              ? 'Supervisión en tiempo real de cajas activas, cajeros en turno y auditoría exacta de cierres'
              : 'Realiza y consulta tus cierres diarios de caja'}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn-secondary flex items-center gap-1.5 text-xs font-bold px-3.5 py-2"
              title="Actualizar estado de cajas y cierres"
            >
              <RefreshCw size={15} className={loading || loadingRegisters ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
          )}
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
            Cerrar Caja
          </button>
        </div>
      </div>

      {/* Panel de Cajas Activas para Administradores */}
      {isAdmin && (
        <div className="card p-5 space-y-4 border-l-4 border-l-emerald-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Monitor size={19} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-foreground">
                    Cajas Activas en Este Momento
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {openRegisters.length} abierta{openRegisters.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Visualiza qué cajeros tienen turno abierto, su efectivo esperado y cierra cualquier caja directamente.
                </p>
              </div>
            </div>
          </div>

          {openRegisters.length === 0 ? (
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>No hay cajas abiertas con turno activo en este momento.</span>
              <span className="font-semibold">
                {closedRegisters.length} caja(s) cerrada(s) / disponible(s)
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {openRegisters.map((reg) => (
                <div
                  key={reg.cierreId || reg.id}
                  className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 flex flex-col justify-between gap-3.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <h3 className="text-sm font-black text-foreground truncate">
                          {reg.label}
                        </h3>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <User size={13} className="shrink-0" />
                        <span className="truncate">Cajero: {reg.cashier}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                      Activa
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-card/90 p-2.5 rounded-xl border border-border/70">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                        Fondo Inicial
                      </span>
                      <span className="font-extrabold text-foreground tabular-nums">
                        RD$ {(reg.baseCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase block">
                        Ventas Turno
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        RD$ {(reg.salesToday ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                        Efec. Esperado
                      </span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        RD$ {(reg.expectedCash ?? (reg.baseCash ?? 0) + (reg.cashSales ?? 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Clock size={12} />
                      Apertura: {reg.openedAt} ({reg.tickets ?? 0} fact.)
                    </span>
                    <button
                      type="button"
                      onClick={() => onCloseActiveRegister(reg)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <Lock size={13} />
                      <span>Cerrar Caja</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Cierres registrados</p>
          <p className="text-2xl font-bold text-foreground mt-1">{filteredClosures.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Total vendido en cierres</p>
          <p className="text-xl font-bold text-success mt-1 tabular-nums">
            RD${' '}
            {filteredClosures
              .reduce((s, c) => s + c.totalSales, 0)
              .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Efectivo esperado total</p>
          <p className="text-xl font-bold text-info mt-1 tabular-nums">
            RD${' '}
            {filteredClosures
              .reduce((s, c) => s + c.expectedCash, 0)
              .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted-foreground">Efectivo real contado</p>
          <p className="text-xl font-bold text-primary mt-1 tabular-nums">
            RD${' '}
            {filteredClosures
              .reduce((s, c) => s + c.countedCash, 0)
              .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Diferencia neta acumulada</p>
          {(() => {
            const diff =
              Math.round(filteredClosures.reduce((s, c) => s + c.difference, 0) * 100) / 100;
            return (
              <p
                className={`text-xl font-bold mt-1 tabular-nums ${
                  diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning' : 'text-success'
                }`}
              >
                {diff > 0 ? '+' : ''}RD${' '}
                {diff.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
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
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Filtrar por Cajero / Usuario
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  className="input-field pl-9"
                  placeholder="Nombre del cajero..."
                  value={searchUser}
                  onChange={(e) => onSearchUserChange(e.target.value)}
                />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Fecha Específica
            </label>
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
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Desde (Rango)
            </label>
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
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Hasta (Rango)
            </label>
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
            Mostrando {filteredClosures.length} cierre(s) exacto(s)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExportPdf}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              <Download size={14} /> Exportar PDF
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
            >
              <FileSpreadsheet size={14} /> Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Closures Table with Exact Breakdown */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs">
                <th className="text-left px-3.5 py-3 font-semibold text-muted-foreground">Código</th>
                <th className="text-left px-3.5 py-3 font-semibold text-muted-foreground">
                  Fecha / Horario
                </th>
                <th className="text-left px-3.5 py-3 font-semibold text-muted-foreground">Caja</th>
                <th className="text-left px-3.5 py-3 font-semibold text-muted-foreground">Cajero</th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Fondo Inicial
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Ventas Efectivo
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Otros Cobros
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Total Vendido
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Efectivo Esperado
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Efectivo Contado
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Diferencia
                </th>
                <th className="text-right px-3.5 py-3 font-semibold text-muted-foreground">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                    Cargando cierres de caja...
                  </td>
                </tr>
              ) : filteredClosures.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                    <Lock size={32} className="mx-auto mb-2 opacity-30" />
                    No se encontraron cierres de caja con los filtros seleccionados
                  </td>
                </tr>
              ) : (
<<<<<<< HEAD
                filteredClosures.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/10'}`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{c.code}</span>
                        {c.isInconsistent && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-sans font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            title={
                              c.inconsistencyReasons?.join(' · ') ||
                              'Cierre histórico con datos incompletos o inconsistentes'
                            }
                          >
                            <AlertTriangle size={11} />
                            Inconsistente
                          </span>
                        )}
                      </div>
                    </td>
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
=======
                filteredClosures.map((c, idx) => {
                  const otherPayments =
                    (c.totalCard ?? 0) + (c.totalTransfer ?? 0) + (c.totalCredit ?? 0);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-secondary/10'
                      }`}
                    >
                      <td className="px-3.5 py-3 font-mono font-bold text-primary text-xs whitespace-nowrap">
                        {c.code}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <p className="text-foreground font-semibold text-xs">{c.date}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatTimeShort(c.openedAt)} — {formatTimeShort(c.closedAt)}
                        </p>
                      </td>
                      <td className="px-3.5 py-3 text-xs font-semibold text-foreground whitespace-nowrap">
                        {c.cashRegisterLabel || `Caja #${c.cashRegisterId}`}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <div>
                          <p className="font-bold text-foreground text-xs">{c.userName}</p>
                          {c.username && (
                            <p className="text-[11px] text-muted-foreground">@{c.username}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        RD$ {(c.baseCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        RD$ {(c.totalCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums text-xs font-medium text-muted-foreground whitespace-nowrap">
                        RD$ {otherPayments.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums font-black text-foreground whitespace-nowrap">
                        RD$ {c.totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        RD$ {c.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums font-black text-primary whitespace-nowrap">
                        RD$ {c.countedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3.5 py-3 text-right tabular-nums font-bold whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs ${
                            c.difference < 0
                              ? 'bg-danger-bg text-danger'
                              : c.difference > 0
                                ? 'bg-warning-bg text-warning'
                                : 'bg-success-bg text-success'
>>>>>>> 57bbebe1c1b40ce6b28d91de9bc1ae3c21035762
                          }`}
                        >
                          {c.difference === 0
                            ? 'Exacto (RD$ 0.00)'
                            : c.difference > 0
                              ? `+RD$ ${c.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                              : `-RD$ ${Math.abs(c.difference).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewClosure(c)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer"
                          title="Ver vista previa completa del cierre"
                        >
                          <Eye size={14} />
                          <span>Ver Detalle</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
