import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/context/AuthContext';
import type { CashClosure } from '@/lib/cashClosureStore';
import { exportTableToPdf, exportTableToExcel, formatMoneyPdf } from '@/lib/exportPdf';
import { toast } from '@/lib/toast';
import { obtenerRegistrosCierreCaja } from '@/services/cierresCaja.service';
import PosCashOpenModal from '@/pages/point-of-sale-pos/components/PosCashOpenModal';
import PosCashCloseModal from '@/pages/point-of-sale-pos/components/PosCashCloseModal';
import { CashClosureDetailView } from './cash-closure/components/CashClosureDetailView';
import { CashClosureListView } from './cash-closure/components/CashClosureListView';

export default function CashClosurePage() {
  const { user } = useAuth();
  const roleNorm = (user?.role || '').trim().toLowerCase();
  const isAdmin =
    roleNorm === 'administrador' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super_admin' ||
    roleNorm === 'superadmin';

  const [closures, setClosures] = useState<CashClosure[]>([]);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [viewingClosure, setViewingClosure] = useState<CashClosure | null>(null);

  const [searchUser, setSearchUser] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchClosures = async () => {
    setLoading(true);
    try {
      const rows = await obtenerRegistrosCierreCaja();
      setClosures(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar cierres de caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  const filteredClosures = useMemo(() => {
    return closures.filter((c) => {
      if (!isAdmin) {
        const uid = user?.id ?? '';
        const uname = (user?.username ?? '').toLowerCase();
        const matchesUser =
          (c.userId && uid && c.userId === uid) ||
          (c.username && uname && c.username.toLowerCase() === uname);
        if (!matchesUser) return false;
      }
      if (searchUser && !c.userName.toLowerCase().includes(searchUser.toLowerCase()) && !c.username.toLowerCase().includes(searchUser.toLowerCase())) {
        return false;
      }
      if (singleDate && c.date !== singleDate) {
        return false;
      }
      if (startDate && c.date < startDate) return false;
      if (endDate && c.date > endDate) return false;

      return true;
    });
  }, [closures, isAdmin, user, searchUser, singleDate, startDate, endDate]);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Reporte de Cierres de Caja Diarios',
      subtitle: !isAdmin ? `Usuario: ${user?.name}` : 'Todos los usuarios',
      filename: 'cierres-de-caja',
      headers: [
        'Código', 'Fecha', 'Apertura', 'Cierre', 'Caja', 'Usuario', 'Vendido', 'Efectivo Esperado', 'Contado', 'Diferencia'
      ],
      rows: filteredClosures.map((c) => [
        c.code,
        c.date,
        c.openedAt.split(' ')[1] || c.openedAt,
        c.closedAt.split(' ')[1] || c.closedAt,
        c.cashRegisterLabel || `Caja #${c.cashRegisterId}`,
        c.userName,
        formatMoneyPdf(c.totalSales),
        formatMoneyPdf(c.expectedCash),
        formatMoneyPdf(c.countedCash),
        formatMoneyPdf(c.difference),
      ]),
      landscape: true,
    });
  };

  const handleExportExcel = () => {
    exportTableToExcel({
      title: 'Reporte de Cierres de Caja Diarios',
      filename: 'cierres-de-caja',
      headers: [
        'Código', 'Fecha', 'Apertura', 'Cierre', 'Caja', 'Usuario', 'Total Vendido', 'Fondo Inicial', 'Total Efectivo', 'Efectivo Esperado', 'Efectivo Contado', 'Diferencia', 'Total Tarjetas', 'Total Transferencias', 'Total Crédito'
      ],
      rows: filteredClosures.map((c) => [
        c.code,
        c.date,
        c.openedAt,
        c.closedAt,
        c.cashRegisterLabel || `Caja #${c.cashRegisterId}`,
        c.userName,
        c.totalSales,
        c.baseCash ?? 0,
        c.totalCash ?? 0,
        c.expectedCash,
        c.countedCash,
        c.difference,
        c.totalCard ?? 0,
        c.totalTransfer ?? 0,
        c.totalCredit ?? 0,
      ]),
    });
  };

  const handleExportSingleClosurePdf = (closure: CashClosure) => {
    exportTableToPdf({
      title: `Comprobante de Cierre de Caja — ${closure.code}`,
      subtitle: `${closure.cashRegisterLabel || `Caja #${closure.cashRegisterId}`} | ${closure.date} | Responsable: ${closure.userName}`,
      filename: `cierre-${closure.code}`,
      headers: ['Concepto / Rubro', 'Monto Registrado'],
      rows: [
        ['Código de Cierre', closure.code],
        ['Fecha del Turno', closure.date],
        ['Caja Registradora', closure.cashRegisterLabel || `Caja #${closure.cashRegisterId}`],
        ['Cajero / Usuario Responsable', `${closure.userName} (@${closure.username || 'usuario'})`],
        ['Horario de Apertura y Cierre', `${closure.openedAt} — ${closure.closedAt || '—'}`],
        ['Fondo Inicial (Apertura)', formatMoneyPdf(closure.baseCash ?? 0)],
        ['Ventas en Efectivo', formatMoneyPdf(closure.totalCash ?? 0)],
        ['Ventas con Tarjetas', formatMoneyPdf(closure.totalCard ?? 0)],
        ['Ventas por Transferencia', formatMoneyPdf(closure.totalTransfer ?? 0)],
        ['Ventas a Crédito', formatMoneyPdf(closure.totalCredit ?? 0)],
        ['TOTAL VENDIDO EN EL TURNO', formatMoneyPdf(closure.totalSales)],
        ['Efectivo Físico Esperado en Caja', formatMoneyPdf(closure.expectedCash)],
        ['Efectivo Físico Real Contado', formatMoneyPdf(closure.countedCash)],
        ['Diferencia de Arqueo', formatMoneyPdf(closure.difference)],
        ['Observaciones', closure.notes || 'Sin observaciones registradas'],
      ],
    });
  };

  return (
    <AppLayout>
      {viewingClosure ? (
        <CashClosureDetailView
          closure={viewingClosure}
          onBack={() => setViewingClosure(null)}
          onExportPdf={handleExportSingleClosurePdf}
        />
      ) : (
        <>
          <CashClosureListView
            isAdmin={isAdmin}
            filteredClosures={filteredClosures}
            loading={loading}
            searchUser={searchUser}
            onSearchUserChange={setSearchUser}
            singleDate={singleDate}
            onSingleDateChange={setSingleDate}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            onOpenOpenModal={() => setShowOpenModal(true)}
            onOpenCloseModal={() => setShowCloseModal(true)}
            onViewClosure={setViewingClosure}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
          />

          {showCloseModal && (
            <PosCashCloseModal
              onSuccess={() => {
                void fetchClosures();
                setShowCloseModal(false);
              }}
              onClose={() => setShowCloseModal(false)}
            />
          )}

          {showOpenModal && (
            <PosCashOpenModal
              onSuccess={() => {
                void fetchClosures();
                setShowOpenModal(false);
              }}
              onClose={() => setShowOpenModal(false)}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
