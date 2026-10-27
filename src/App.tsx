import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PageLoader } from './components/ui/LoadingSkeleton';

// Lazy loading de rutas para reducir el tamaño inicial del bundle y optimizar el tiempo de carga del POS
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const POSPage = lazy(() => import('./pages/point-of-sale-pos/POSPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const ProductManagementPage = lazy(() => import('./pages/product-management/ProductManagementPage'));
const CombosPage = lazy(() => import('./pages/combos/CombosPage'));
const StockTransfersPage = lazy(() => import('./pages/StockTransfersPage'));
const StockAdjustmentsPage = lazy(() => import('./pages/StockAdjustmentsPage'));
const CajasPage = lazy(() => import('./pages/CajasPage'));
const ReturnsHistoryPage = lazy(() => import('./pages/ReturnsHistoryPage'));
const CashClosurePage = lazy(() => import('./pages/CashClosurePage'));
const MaletaPage = lazy(() => import('./pages/MaletaPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const AccountsReceivablePage = lazy(() => import('./pages/AccountsReceivablePage'));
const AccountsPayablePage = lazy(() => import('./pages/AccountsPayablePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const InvoiceSettingsPage = lazy(() => import('./pages/InvoiceSettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function Guard({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Guard><DashboardPage /></Guard>} />
        <Route path="/point-of-sale-pos" element={<Guard><POSPage /></Guard>} />
        <Route path="/sales" element={<Guard><SalesPage /></Guard>} />
        <Route path="/purchases" element={<Guard><PurchasesPage /></Guard>} />
        <Route path="/product-management" element={<Guard><ProductManagementPage /></Guard>} />
        <Route path="/combos" element={<Guard><CombosPage /></Guard>} />
        <Route path="/stock-transfers" element={<Guard><StockTransfersPage /></Guard>} />
        <Route path="/stock-adjustments" element={<Guard><StockAdjustmentsPage /></Guard>} />
        <Route path="/cajas" element={<Guard><CajasPage /></Guard>} />
        <Route path="/returns-history" element={<Guard><ReturnsHistoryPage /></Guard>} />
        <Route path="/cash-closure" element={<Guard><CashClosurePage /></Guard>} />
        <Route path="/maleta" element={<Guard><MaletaPage /></Guard>} />
        <Route path="/audit" element={<Navigate to="/" replace />} />
        <Route path="/contacts" element={<Guard><ContactsPage /></Guard>} />
        <Route path="/expenses" element={<Guard><ExpensesPage /></Guard>} />
        <Route path="/accounts-receivable" element={<Guard><AccountsReceivablePage /></Guard>} />
        <Route path="/accounts-payable" element={<Guard><AccountsPayablePage /></Guard>} />
        <Route path="/reports" element={<Guard><ReportsPage /></Guard>} />
        <Route path="/users" element={<Guard><UsersPage /></Guard>} />
        <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
        <Route path="/invoice-settings" element={<Guard><InvoiceSettingsPage /></Guard>} />
        <Route path="*" element={<Guard><NotFoundPage /></Guard>} />
      </Routes>
    </Suspense>
  );
}
