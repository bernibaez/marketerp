import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  BarChart2,
  TrendingUp,
  Package,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  Users,
  UserCheck,
  FileText,
  Download,
  Printer,
  Filter,
  Wallet,
  Truck,
  ClipboardList,
  Sliders,
  Tag,
  Boxes,
} from 'lucide-react';
import ProfitLossReport from './reports/ProfitLossReport';
import ProductProfitReport from './reports/ProductProfitReport';
import SalesReport from './reports/SalesReport';
import PurchasesReport from './reports/PurchasesReport';
import InventoryReport from './reports/InventoryReport';
import StockDetailReport from './reports/StockDetailReport';
import AdjustmentsReport from './reports/AdjustmentsReport';
import ExpensesReport from './reports/ExpensesReport';
import CustomersReport from './reports/CustomersReport';
import SuppliersReport from './reports/SuppliersReport';
import AgentsReport from './reports/AgentsReport';
import FiscalDGIIReport from './reports/FiscalDGIIReport';
import CashierReport from './reports/CashierReport';
import CombosReport from './reports/CombosReport';
import { exportReportPdf } from './reports/exportReportPdf';

type ReportId =
  | 'profit-loss'
  | 'product-profit'
  | 'combos'
  | 'sales'
  | 'purchases'
  | 'stock'
  | 'stock-detail'
  | 'adjustments'
  | 'expenses'
  | 'customers'
  | 'suppliers'
  | 'agents'
  | 'fiscal'
  | 'cashier';

const reportTypes: { id: ReportId; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'profit-loss', label: 'Ganancias y Pérdidas', icon: <TrendingUp size={17} />, color: 'text-success' },
  { id: 'product-profit', label: 'Ganancias por Producto', icon: <Tag size={17} />, color: 'text-primary' },
  { id: 'combos', label: 'Informe de Combos', icon: <Boxes size={17} />, color: 'text-purple-600' },
  { id: 'sales', label: 'Ventas', icon: <ShoppingCart size={17} />, color: 'text-info' },
  { id: 'purchases', label: 'Compras', icon: <ShoppingBag size={17} />, color: 'text-warning' },
  { id: 'stock', label: 'Inventario', icon: <Package size={17} />, color: 'text-primary' },
  { id: 'stock-detail', label: 'Informe de Stock', icon: <ClipboardList size={17} />, color: 'text-primary' },
  { id: 'adjustments', label: 'Informe Ajustes', icon: <Sliders size={17} />, color: 'text-warning' },
  { id: 'expenses', label: 'Gastos', icon: <DollarSign size={17} />, color: 'text-danger' },
  { id: 'customers', label: 'Clientes', icon: <Users size={17} />, color: 'text-info' },
  { id: 'suppliers', label: 'Proveedores', icon: <Truck size={17} />, color: 'text-warning' },
  { id: 'agents', label: 'Agentes', icon: <UserCheck size={17} />, color: 'text-primary' },
  { id: 'fiscal', label: 'Informe Fiscal DGII', icon: <FileText size={17} />, color: 'text-warning' },
  { id: 'cashier', label: 'Informe de Caja', icon: <Wallet size={17} />, color: 'text-success' },
];

const SNAPSHOT_REPORTS = new Set<ReportId>(['stock', 'stock-detail', 'agents']);

function renderReport(id: ReportId, dateFrom: string, dateTo: string) {
  const period = { dateFrom, dateTo };
  switch (id) {
    case 'profit-loss':
      return <ProfitLossReport {...period} />;
    case 'product-profit':
      return <ProductProfitReport {...period} />;
    case 'combos':
      return <CombosReport {...period} />;
    case 'sales':
      return <SalesReport {...period} />;
    case 'purchases':
      return <PurchasesReport {...period} />;
    case 'stock':
      return <InventoryReport {...period} />;
    case 'stock-detail':
      return <StockDetailReport {...period} />;
    case 'adjustments':
      return <AdjustmentsReport {...period} />;
    case 'expenses':
      return <ExpensesReport {...period} />;
    case 'customers':
      return <CustomersReport {...period} />;
    case 'suppliers':
      return <SuppliersReport {...period} />;
    case 'agents':
      return <AgentsReport {...period} />;
    case 'fiscal':
      return <FiscalDGIIReport {...period} />;
    case 'cashier':
      return <CashierReport {...period} />;
    default:
      return <ProfitLossReport {...period} />;
  }
}

function toIsoDate(d: Date) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${day}`;
}

function defaultDateRange() {
  const now = new Date();
  return {
    desde: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    hasta: toIsoDate(now),
  };
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const resolvedTab: ReportId =
    tabParam && reportTypes.some((r) => r.id === tabParam) ? (tabParam as ReportId) : 'profit-loss';

  const defaults = defaultDateRange();
  const [activeReport, setActiveReport] = useState<ReportId>(resolvedTab);
  const [dateFrom, setDateFrom] = useState(defaults.desde);
  const [dateTo, setDateTo] = useState(defaults.hasta);
  const [appliedPeriod, setAppliedPeriod] = useState({ dateFrom: defaults.desde, dateTo: defaults.hasta });

  useEffect(() => {
    setActiveReport(resolvedTab);
  }, [resolvedTab]);

  const activeLabel = reportTypes.find((r) => r.id === activeReport)?.label ?? 'Informe';
  const isSnapshotReport = SNAPSHOT_REPORTS.has(activeReport);

  const selectReport = (id: ReportId) => {
    setActiveReport(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  const applyPreset = (preset: 'today' | '7d' | 'month' | 'prev-month') => {
    const now = new Date();
    let from = defaults.desde;
    let to = toIsoDate(now);
    if (preset === 'today') {
      from = to;
    } else if (preset === '7d') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      from = toIsoDate(start);
    } else if (preset === 'month') {
      from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (preset === 'prev-month') {
      from = toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      to = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0));
    }
    setDateFrom(from);
    setDateTo(to);
    setAppliedPeriod({ dateFrom: from, dateTo: to });
  };

  const handleGenerate = () => {
    setAppliedPeriod({ dateFrom, dateTo });
  };

  return (
    <AppLayout>
      <div className="space-y-5 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Informes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análisis y reportes del negocio — <span className="font-medium text-foreground">{activeLabel}</span>
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button type="button" className="btn-secondary flex items-center gap-2 text-xs" onClick={() => window.print()}>
              <Printer size={15} />
              Imprimir
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 text-xs"
              onClick={() => {
                void exportReportPdf(activeReport, activeLabel, appliedPeriod.dateFrom, appliedPeriod.dateTo);
              }}
            >
              <Download size={15} />
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 items-start print:block">
          <div className="w-full lg:w-56 flex-shrink-0 card p-2.5 h-fit print:hidden">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 py-1.5">
              Tipo de Informe
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
              {reportTypes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectReport(r.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    activeReport === r.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span className={activeReport === r.id ? 'text-primary' : r.color}>{r.icon}</span>
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full space-y-4 print:w-full print:p-0">
            {/* Cabecera formal de reporte para impresión */}
            <div className="hidden print:block pb-4 mb-4 border-b border-black text-center">
              <h2 className="text-base font-black uppercase text-black">MERCATO SUPERMERCADO S.R.L.</h2>
              <h3 className="text-sm font-bold uppercase text-black">{activeLabel}</h3>
              <p className="text-xs text-black/70">
                {isSnapshotReport
                  ? `Snapshot actual · Generado el ${new Date().toLocaleDateString('es-DO')}`
                  : `Período: ${appliedPeriod.dateFrom || 'Inicio'} al ${appliedPeriod.dateTo || 'Actualidad'} · Generado el ${new Date().toLocaleDateString('es-DO')}`}
              </p>
            </div>

            {isSnapshotReport ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground px-1 print:hidden">
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} className="text-primary" />
                  <span>Estado actual en tiempo real · Datos en vivo</span>
                </div>
              </div>
            ) : (
              <>
                <div className="card p-3.5 flex flex-wrap gap-3 items-end justify-between print:hidden">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Desde</label>
                      <input
                        type="date"
                        className="input-field py-1.5 text-xs"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Hasta</label>
                      <input
                        type="date"
                        className="input-field py-1.5 text-xs"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3" onClick={handleGenerate}>
                      <Filter size={14} />
                      Generar
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyPreset('today')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('7d')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                    >
                      7 días
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('month')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                    >
                      Este mes
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('prev-month')}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                    >
                      Mes ant.
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 print:hidden">
                  <BarChart2 size={14} />
                  Periodo activo: {appliedPeriod.dateFrom} → {appliedPeriod.dateTo}
                </div>
              </>
            )}

            {renderReport(activeReport, appliedPeriod.dateFrom, appliedPeriod.dateTo)}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
