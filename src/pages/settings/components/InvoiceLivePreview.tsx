import React from 'react';
import type { InvoiceSettings, InvoiceData, PaperWidth } from '@/types/invoice';
import InvoicePreview from '@/components/invoice/InvoicePreview';

interface InvoiceLivePreviewProps {
  settings: InvoiceSettings;
  logoUrl: string | null;
  previewTab: 'consumidor' | 'fiscal';
  onTabChange: (tab: 'consumidor' | 'fiscal') => void;
  onWidthChange?: (width: PaperWidth) => void;
}

export function InvoiceLivePreview({
  settings,
  logoUrl,
  previewTab,
  onTabChange,
  onWidthChange,
}: InvoiceLivePreviewProps) {
  const isFiscal = previewTab === 'fiscal';
  const itbisRate = settings.itbisPercent ?? 18;

  // Datos simulados de alta calidad para la vista previa en vivo
  const sampleData: InvoiceData = {
    numero: settings.ncfSequence || 'FAC-2026-0042',
    invoiceNumber: settings.ncfSequence || 'FAC-2026-0042',
    ncf: settings.showNcf
      ? isFiscal
        ? 'B0100000084'
        : settings.ncfSequence || 'B0200000452'
      : undefined,
    ncfTypeName: isFiscal ? 'FACTURA DE CRÉDITO FISCAL' : 'FACTURA DE CONSUMO',
    fecha: '04/11/2026',
    hora: '10:45 AM',
    cajero: 'Caja #1 - Administrador',
    cliente: isFiscal ? 'DISTRIBUIDORA NACIONAL S.A.' : 'Juan Pérez',
    clienteRnc: isFiscal ? '101-98765-4' : undefined,
    items: [
      {
        cantidad: 2,
        descripcion: 'Arroz Súper Selecto 10 lbs',
        precioUnitario: 380,
        total: 760,
      },
      {
        cantidad: 1,
        descripcion: 'Aceite Vegetal Crisol 64 oz',
        precioUnitario: 295,
        total: 295,
      },
      {
        cantidad: 4,
        descripcion: 'Leche Entera Milex 1L',
        precioUnitario: 85,
        total: 340,
      },
    ],
    subtotal: 1395,
    impuesto: Math.round(1395 * (itbisRate / 100) * 100) / 100,
    total: Math.round((1395 + (1395 * itbisRate) / 100) * 100) / 100,
    pagado: 2000,
    cambio: Math.round((2000 - (1395 + (1395 * itbisRate) / 100)) * 100) / 100,
  };

  return (
    <div className="lg:col-span-6 sticky top-6 space-y-3">
      {/* Cabecera de la vista previa: Segmented control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onTabChange('consumidor')}
            className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
              previewTab === 'consumidor'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Consumidor Final
          </button>
          <button
            type="button"
            onClick={() => onTabChange('fiscal')}
            className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
              previewTab === 'fiscal'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Crédito Fiscal (B01)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Vista previa en vivo
          </span>
        </div>
      </div>

      {/* Contenedor gris suave donde reposa el rollo térmico a escala real */}
      <div className="bg-slate-100/80 dark:bg-slate-900/40 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex justify-center items-start min-h-[580px] overflow-y-auto max-h-[82vh] scrollbar-thin">
        <InvoicePreview
          data={sampleData}
          settings={settings}
          width={settings.paperWidth}
          logoUrl={logoUrl}
          showWidthSwitcher={true}
          onWidthChange={onWidthChange}
        />
      </div>
    </div>
  );
}

export default InvoiceLivePreview;
