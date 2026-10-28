import React from 'react';
import PosExpenseModal from './PosExpenseModal';
import PosHoldModal from './PosHoldModal';
import PosScaleModal from './PosScaleModal';
import PosReturnModal from './PosReturnModal';
import PosCashSwitchModal from './PosCashSwitchModal';
import RegisterDetailsModal from './RegisterDetailsModal';
import FiscalInvoiceModal from '@/components/FiscalInvoiceModal';
import PosCashOpenModal from './PosCashOpenModal';
import PosCashCloseModal from './PosCashCloseModal';
import PosWeightScanModal from './PosWeightScanModal';
import type { HeldSale } from '@/lib/posStore';
import type { FiscalInvoiceRecord } from '@/lib/ncfStore';
import type { CashRegisterId } from '@/lib/cashRegisters';
import type { CartItem } from './POSTerminal';

interface POSModalsProps {
  expenseOpen: boolean;
  onCloseExpense: () => void;
  activeCashId: CashRegisterId;
  activeCashLabel: string;
  activeCashDbId?: string;

  holdOpen: boolean;
  onCloseHold: () => void;
  heldSales: HeldSale[];
  canHold: boolean;
  onHoldCurrent: (label: string) => void;
  onResumeHeld: (sale: HeldSale) => void;
  onDeleteHeld: (id: string) => void;

  scaleOpen: boolean;
  onCloseScale: () => void;
  scaleParams: { productId?: string; weight?: number; product?: any } | null;
  onConfirmScale: (item: any, qty: number) => void;

  returnOpen: boolean;
  onCloseReturn: () => void;

  cashSwitchOpen: boolean;
  onCloseCashSwitch: () => void;
  onSelectCashRegister: (id: CashRegisterId) => void;
  registers: any[];
  isAdminUser: boolean;

  registerDetailsOpen: boolean;
  onCloseRegisterDetails: () => void;

  lastFiscalInvoice: FiscalInvoiceRecord | null;
  onCloseFiscalInvoice: () => void;

  openCashModalOpen: boolean;
  onCloseOpenCash: () => void;
  onSuccessOpenCash: (cierre: any) => void;

  closeCashModalOpen: boolean;
  onCloseCloseCash: () => void;
  onSuccessCloseCash: () => void;

  weightScanOpen: boolean;
  onCloseWeightScan: () => void;
  realScaleCatalog: any[];
  onConfirmWeightScan: (item: any, weight: number) => void;
}

export const POSModals: React.FC<POSModalsProps> = ({
  expenseOpen,
  onCloseExpense,
  activeCashId,
  activeCashLabel,
  activeCashDbId,

  holdOpen,
  onCloseHold,
  heldSales,
  canHold,
  onHoldCurrent,
  onResumeHeld,
  onDeleteHeld,

  scaleOpen,
  onCloseScale,
  scaleParams,
  onConfirmScale,

  returnOpen,
  onCloseReturn,

  cashSwitchOpen,
  onCloseCashSwitch,
  onSelectCashRegister,
  registers,
  isAdminUser,

  registerDetailsOpen,
  onCloseRegisterDetails,

  lastFiscalInvoice,
  onCloseFiscalInvoice,

  openCashModalOpen,
  onCloseOpenCash,
  onSuccessOpenCash,

  closeCashModalOpen,
  onCloseCloseCash,
  onSuccessCloseCash,

  weightScanOpen,
  onCloseWeightScan,
  realScaleCatalog,
  onConfirmWeightScan,
}) => {
  return (
    <>
      {expenseOpen && (
        <PosExpenseModal
          onClose={onCloseExpense}
          cajaId={String(activeCashId)}
          cashierLabel={activeCashLabel}
        />
      )}

      {holdOpen && (
        <PosHoldModal
          heldSales={heldSales}
          canHold={canHold}
          onHold={onHoldCurrent}
          onResume={onResumeHeld}
          onDelete={onDeleteHeld}
          onClose={onCloseHold}
        />
      )}

      {scaleOpen && (
        <PosScaleModal
          initialProductId={scaleParams?.productId}
          initialWeight={scaleParams?.weight}
          initialProduct={scaleParams?.product}
          onClose={onCloseScale}
          onConfirm={onConfirmScale}
        />
      )}

      {returnOpen && <PosReturnModal onClose={onCloseReturn} />}

      {cashSwitchOpen && (
        <PosCashSwitchModal
          currentId={activeCashId}
          onSelect={onSelectCashRegister}
          onClose={onCloseCashSwitch}
        />
      )}

      {registerDetailsOpen && (
        <RegisterDetailsModal
          onClose={onCloseRegisterDetails}
          cajaId={String(activeCashId)}
          cajaLabel={activeCashLabel}
          includeUserSales={isAdminUser}
        />
      )}

      {lastFiscalInvoice && (
        <FiscalInvoiceModal
          invoice={lastFiscalInvoice}
          onClose={onCloseFiscalInvoice}
        />
      )}

      {openCashModalOpen && (
        <PosCashOpenModal
          initialCajaId={String(activeCashDbId || activeCashId)}
          onSuccess={onSuccessOpenCash}
          onClose={onCloseOpenCash}
        />
      )}

      {closeCashModalOpen && (
        <PosCashCloseModal
          initialCajaId={String(activeCashDbId || activeCashId)}
          onSuccess={onSuccessCloseCash}
          onClose={onCloseCloseCash}
        />
      )}

      {weightScanOpen && (
        <PosWeightScanModal
          catalog={realScaleCatalog}
          onConfirm={onConfirmWeightScan}
          onClose={onCloseWeightScan}
        />
      )}
    </>
  );
};
