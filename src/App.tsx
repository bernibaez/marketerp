import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/point-of-sale-pos/POSPage';
import SalesPage from './pages/SalesPage';
import PurchasesPage from './pages/PurchasesPage';
import ProductManagementPage from './pages/product-management/ProductManagementPage';
import CombosPage from './pages/combos/CombosPage';
import StockTransfersPage from './pages/StockTransfersPage';
import StockAdjustmentsPage from './pages/StockAdjustmentsPage';
import CajasPage from './pages/CajasPage';
import ReturnsHistoryPage from './pages/ReturnsHistoryPage';
import CashClosurePage from './pages/CashClosurePage';
import MaletaPage from './pages/MaletaPage';
import ContactsPage from './pages/ContactsPage';
import ExpensesPage from './pages/ExpensesPage';
import AccountsReceivablePage from './pages/AccountsReceivablePage';
import AccountsPayablePage from './pages/AccountsPayablePage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import InvoiceSettingsPage from './pages/InvoiceSettingsPage';
import NotFoundPage from './pages/NotFoundPage';

function Guard({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
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
  );
}
