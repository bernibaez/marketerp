import React from 'react';
import {
  HandCoins, Plus, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Clock, Search, Eye,
} from 'lucide-react';
import type { CuentaCobrarUi, CxStatusUi } from '@/services/cxc.service';
import { InlineLoader } from '@/components/ui/LoadingSkeleton';

const statusMap: Record<CxStatusUi, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'badge-warning' },
  partial: { label: 'Parcial', cls: 'badge-info' },
  overdue: { label: 'Vencida', cls: 'badge-danger' },
  paid: { label: 'Cobrada', cls: 'badge-success' },
};

interface CxcListViewProps {
  cuentas: CuentaCobrarUi[];
  filtered: CuentaCobrarUi[];
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: 'all' | CxStatusUi;
  onStatusFilterChange: (val: 'all' | CxStatusUi) => void;
  onOpenCreate: () => void;
  onSelectCuenta: (c: CuentaCobrarUi) => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export const CxcListView: React.FC<CxcListViewProps> = ({
  cuentas,
  filtered,
  loading,
  error,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onOpenCreate,
  onSelectCuenta,
  onExportPdf,
  onExportExcel,
}) => {
  const totalPending = cuentas.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.balance, 0);
  const totalOverdue = cuentas.filter((r) => r.status === 'overdue').reduce((s, r) => s + r.balance, 0);
  const totalCollected = cuentas.reduce((s, r) => s + r.paid, 0);
  const overdueCount = cuentas.filter((r) => r.status === 'overdue').length;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HandCoins className="text-primary" size={24} />
            Cuentas por Cobrar (Crédito Clientes)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control de saldos, límites de crédito, pagos parciales/totales y estados de cuenta
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva Cuenta por Cobrar
          </button>
          <button type="button" onClick={onExportPdf} className="btn-secondary flex items-center gap-1.5">
            <Download size={16} /> PDF
          </button>
          <button type="button" onClick={onExportExcel} className="btn-secondary flex items-center gap-1.5">
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Por cobrar total</p>
            <HandCoins size={16} className="text-info" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            RD$ {totalPending.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Cuentas Vencidas</p>
            <AlertTriangle size={16} className="text-danger" />
          </div>
          <p className="text-2xl font-bold text-danger">
            RD$ {totalOverdue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{overdueCount} facturas en mora</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Cobrado acum.</p>
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <p className="text-2xl font-bold text-success">
            RD$ {totalCollected.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Documentos</p>
            <Clock size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{cuentas.length}</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por código, factura o cliente..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="input-field w-full sm:w-44"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as 'all' | CxStatusUi)}
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="partial">Parcial</option>
          <option value="overdue">Vencida</option>
          <option value="paid">Cobrada</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Factura</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Límite Créd.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Vencimiento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Pagado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Saldo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <InlineLoader colSpan={10} message="Cargando cuentas por cobrar…" />}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No hay cuentas por cobrar registradas
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-bold text-foreground font-mono">{r.code}</td>
                  <td className="px-4 py-3 text-primary font-mono font-semibold">{r.invoice}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{r.customer}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    RD$ {r.creditLimit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                    {r.dueDate}
                    {r.daysOverdue > 0 && (
                      <span className="block text-xs text-danger font-bold">+{r.daysOverdue} días mora</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">RD$ {r.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-success font-semibold">RD$ {r.paid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-danger">RD$ {r.balance.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={statusMap[r.status].cls}>{statusMap[r.status].label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => onSelectCuenta(r)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Cobrar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectCuenta(r)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Ver estado de cuenta e historial"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
