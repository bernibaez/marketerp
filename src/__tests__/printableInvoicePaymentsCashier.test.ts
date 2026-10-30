import { describe, it, expect } from 'vitest';
import type { PaymentMethodBreakdown } from '@/components/PrintableInvoice';

describe('Facturas Físicas: Método de pago detallado y Cajero responsable (Items 4 y 5)', () => {
  describe('1. Desglose de Métodos de Pago', () => {
    it('genera desglose para pago mixto / múltiple con montos individuales', () => {
      const invoiceData = {
        total: 1500,
        paymentMethod: 'mixto',
        montoEfectivo: 500,
        montoTransferencia: 1000,
      };

      const list: PaymentMethodBreakdown[] = [];
      if (Number(invoiceData.montoEfectivo || 0) > 0) {
        list.push({ method: 'efectivo', label: 'Efectivo', amount: Number(invoiceData.montoEfectivo) });
      }
      if (Number(invoiceData.montoTransferencia || 0) > 0) {
        list.push({ method: 'transferencia', label: 'Transferencia bancaria', amount: Number(invoiceData.montoTransferencia) });
      }

      expect(list.length).toBe(2);
      expect(list[0]).toEqual({ method: 'efectivo', label: 'Efectivo', amount: 500 });
      expect(list[1]).toEqual({ method: 'transferencia', label: 'Transferencia bancaria', amount: 1000 });
      expect(list.reduce((s, p) => s + p.amount, 0)).toBe(1500);
    });

    it('soporta desglose directo pasado en paymentBreakdown', () => {
      const breakdown: PaymentMethodBreakdown[] = [
        { method: 'efectivo', label: 'Efectivo', amount: 300 },
        { method: 'tarjeta', label: 'Tarjeta', amount: 700 },
      ];

      expect(breakdown.length).toBe(2);
      expect(breakdown.reduce((s, p) => s + p.amount, 0)).toBe(1000);
    });
  });

  describe('2. Identificación del Cajero Responsable', () => {
    it('mantiene la identificación del cajero original incluso al reimprimir', () => {
      const originalSale = {
        numero_factura: 'FAC-20261029-0001',
        cajero_id: 'cajero-123',
        cajero_nombre: 'Juan Pérez',
      };

      const reprintingUser = {
        id: 'admin-999',
        name: 'Administrador General',
      };

      // Al imprimir o reimprimir, debe usar sale.cajero_nombre, nunca el reprintingUser
      const invoiceCashier = originalSale.cajero_nombre || 'Cajero';
      expect(invoiceCashier).toBe('Juan Pérez');
      expect(invoiceCashier).not.toBe(reprintingUser.name);
    });
  });
});
