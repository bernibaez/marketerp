import React, { useState } from 'react';
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
import { Boxes } from 'lucide-react';

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
  { id: 'profit-loss', label: 'Ganancias y Pérdidas', icon: <TrendingUp size={18} />, color: 'text-success' },
  { id: 'product-profit', label: 'Ganancias por Producto', icon: <Tag size={18} />, color: 'text-primary' },
  { id: 'combos', label: 'Informe de Combos', icon: <Boxes size={18} />, color: 'text-purple-600' },
  { id: 'sales', label: 'Ventas', icon: <ShoppingCart size={18} />, color: 'text-info' },
  { id: 'purchases', label: 'Compras', icon: <ShoppingBag size={18} />, color: 'text-warning' },
  { id: 'stock', label: 'Inventario', icon: <Package size={18} />, color: 'text-primary' },
  { id: 'stock-detail', label: 'Informe de Stock', icon: <ClipboardList size={18} />, color: 'text-primary' },
  { id: 'adjustments', label: 'Informe Ajustes', icon: <Sliders size={18} />, color: 'text-warning' },
  { id: 'expenses', label: 'Gastos', icon: <DollarSign size={18} />, color: 'text-danger' },
  { id: 'customers', label: 'Clientes', icon: <Users size={18} />, color: 'text-info' },
  { id: 'suppliers', label: 'Proveedores', icon: <Truck size={18} />, color: 'text-warning' },
  { id: 'agents', label: 'Agentes', icon: <UserCheck size={18} />, color: 'text-primary' },
  { id: 'fiscal', label: 'Informe Fiscal DGII', icon: <FileText size={18} />, color: 'text-warning' },
  { id: 'cashier', label: 'Informe de Caja', icon: <Wallet size={18} />, color: 'text-success' },
];

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

function defaultDateRange() {
  const now = new Date();
  const hasta = now.toISOString().slice(0, 10);
  const desde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { desde, hasta };
}

export default function ReportsPage() {
  const defaults = defaultDateRange();
  const [activeReport, setActiveReport] = useState<ReportId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && reportTypes.some((r) => r.id === tab)) {
        return tab as ReportId;
      }
    }
    return 'profit-loss';
  });
  const [dateFrom, setDateFrom] = useState(defaults.desde);
  const [dateTo, setDateTo] = useState(defaults.hasta);
  const [branch, setBranch] = useState('all');
  const [generated, setGenerated] = useState(true);

  const activeLabel = reportTypes.find((r) => r.id === activeReport)?.label ?? 'Informe';

  const handleGenerate = () => {
    setGenerated(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Informes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análisis y reportes del negocio — {activeLabel}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => window.print()}>
              <Printer size={16} />
              Imprimir
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={() => {
                void exportReportPdf(activeReport, activeLabel, dateFrom, dateTo);
              }}
            >
              <Download size={16} />
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block">
          <div className="card p-3 space-y-1 h-fit print:hidden">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
              Tipo de Informe
            </p>
            {reportTypes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveReport(r.id);
                  setGenerated(true);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', r.id);
                    window.history.replaceState(null, '', url.toString());
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  activeReport === r.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <span className={activeReport === r.id ? 'text-primary' : r.color}>{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4 print:w-full print:p-0">
            {/* Cabecera formal de reporte para impresión */}
            <div className="hidden print:block pb-4 mb-4 border-b border-black text-center">
              <h2 className="text-base font-black uppercase text-black">MERCATO SUPERMERCADO S.R.L.</h2>
              <h3 className="text-sm font-bold uppercase text-black">{activeLabel}</h3>
              <p className="text-xs text-black/70">
                Período: {dateFrom || 'Inicio'} al {dateTo || 'Actualidad'} · Generado el {new Date().toLocaleDateString('es-DO')}
              </p>
            </div>

            <div className="card p-4 flex flex-wrap gap-3 items-end print:hidden">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
                <input
                  type="date"
                  className="input-field"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
                <input
                  type="date"
                  className="input-field"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal</label>
                <select
                  className="input-field"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="all">Todas las sucursales</option>
                </select>
              </div>
              <button type="button" className="btn-primary flex items-center gap-2" onClick={handleGenerate}>
                <Filter size={16} />
                Generar
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <BarChart2 size={14} />
              Periodo: {dateFrom} → {dateTo} · Datos en vivo desde Supabase
            </div>

            {generated ? (
              renderReport(activeReport, dateFrom, dateTo)
            ) : (
              <div className="card p-12 text-center text-muted-foreground">
                Selecciona un periodo y pulsa <strong>Generar</strong> para ver el informe.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
