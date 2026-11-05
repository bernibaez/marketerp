import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ThermalInvoice from '@/components/invoice/ThermalInvoice';
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/invoiceSettingsStore';
import type { InvoiceData, InvoiceSettings } from '@/types/invoice';

describe('Nuevo Diseño Compacto y Claro de Factura Térmica (Mockup Referencia)', () => {
  const sampleData: InvoiceData = {
    numero: 'FAC-20261102-B13637CF',
    invoiceNumber: 'FAC-20261102-B13637CF',
    registerNumber: 'Caja #00000000-0000-0000-0000-000000000021',
    cajero: 'Admin General',
    fecha: '02/11/2026',
    hora: '09:31 AM',
    paymentMethod: 'EFECTIVO',
    items: [
      {
        cantidad: 1,
        descripcion: 'Avena por libra',
        precioUnitario: 60,
        total: 60,
      },
    ],
    subtotal: 60,
    impuesto: 0,
    total: 60,
    pagado: 60,
    cambio: 0,
  };

  const sampleSettings: InvoiceSettings = {
    ...DEFAULT_INVOICE_SETTINGS,
    companyName: 'LICORES CHICHA',
    companyRnc: '101000001',
    companyPhone: '809-555-0100',
    companyAddress: 'Av. Principal #100, Santo Domingo',
    templateStyle: 'clasico',
    showLogo: true,
    showRegisterNumber: true,
    showCashier: true,
    showIssueTime: true,
    showItemPriceUnitPrice: true,
    showTaxBreakdown: true,
    showPaymentDetails: true,
    showChange: true,
    showFooter: true,
    showFooterMessage: true,
    showTerms: true,
    showSignatureLine: true,
    footerMessage: '¡Gracias por preferirnos! Conserve este comprobante para cualquier reclamación.',
    termsAndConditions:
      'Cambios permitidos dentro de los 15 días posteriores a la compra con factura original en buen estado.',
  };

  it('1. Renderiza exactamente los datos del encabezado, contacto y comprobante', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('LICORES CHICHA');
    expect(html).toContain('RNC: 101000001 · Tel: 809-555-0100');
    expect(html).toContain('Av. Principal #100, Santo Domingo');
    expect(html).toContain('COMPROBANTE DE VENTA');
  });

  it('2. Renderiza metadatos de venta con No. Factura, Caja, Cajero y Fecha/Hora', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('No. Factura:');
    expect(html).toContain('FAC-20261102-B13637CF');
    expect(html).toContain('Caja:');
    expect(html).toContain('Caja #00000000-0000-0000-0000-000000000021');
    expect(html).toContain('Cajero:');
    expect(html).toContain('Admin General');
    expect(html).toContain('02/11/2026');
  });

  it('3. Renderiza cabecera de tabla y producto en dos líneas compactas', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('Cant. Descripción');
    expect(html).toContain('Importe');
    expect(html).toContain('Avena por libra');
    // Línea 2 con desglose 1x RD$ 60.00
    expect(html).toContain('1x RD$ 60.00');
    expect(html).toContain('RD$ 60.00');
  });

  it('4. Renderiza Subtotal Neto, ITBIS y TOTAL A PAGAR destacado', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('Subtotal Neto:');
    expect(html).toContain('ITBIS (18%):');
    expect(html).toContain('TOTAL A PAGAR:');
    expect(html).toContain('RD$ 60.00');
  });

  it('5. Renderiza método de pago y monto recibido', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('Método de Pago:');
    expect(html).toContain('EFECTIVO');
    expect(html).toContain('Efectivo Recibido:');
  });

  it('6. Renderiza mensaje de agradecimiento y políticas de devolución', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('¡Gracias por preferirnos! Conserve este comprobante para cualquier reclamación.');
    expect(html).toContain(
      'Cambios permitidos dentro de los 15 días posteriores a la compra con factura original en buen estado.'
    );
  });

  it('7. Renderiza líneas dobles para firmas de Cajero y Cliente', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('Firma Cajero');
    expect(html).toContain('Firma Cliente');
  });

  it('8. Renderiza atribución de sistema en el pie', () => {
    const html = renderToString(<ThermalInvoice data={sampleData} settings={sampleSettings} width={80} />);

    expect(html).toContain('Sistema Mercato POS');
  });

  it('9. Responde a las opciones de visibilidad desactivando secciones cuando se apagan', () => {
    const customizedSettings: InvoiceSettings = {
      ...sampleSettings,
      showSignatureLine: false,
      showRegisterNumber: false,
      showItemPriceUnitPrice: false,
      showPaymentDetails: false,
      showFooter: false,
    };

    const html = renderToString(<ThermalInvoice data={sampleData} settings={customizedSettings} width={80} />);

    expect(html).not.toContain('Firma Cajero');
    expect(html).not.toContain('Firma Cliente');
    expect(html).not.toContain('Caja #00000000-0000-0000-0000-000000000021');
    expect(html).not.toContain('1x RD$ 60.00');
    expect(html).not.toContain('Efectivo Recibido:');
    expect(html).not.toContain('¡Gracias por preferirnos!');
    // Pero el producto y el total a pagar siguen estando
    expect(html).toContain('Avena por libra');
    expect(html).toContain('TOTAL A PAGAR:');
  });
});