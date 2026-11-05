import React from 'react';
import type { InvoiceSettings, InvoiceData, PaperWidth } from '@/types/invoice';
import InvoicePreview from '@/components/invoice/InvoicePreview';

interface InvoiceLivePreviewProps {
  settings: InvoiceSettings;
  logoUrl: string | null;
  previewTab: 'consumidor' | 'fiscal';
  onTabChange: (tab: 'consumidor' | 'fiscal') => void;
  onWidthChange?: (width: PaperWidth) => void;
  onZoomChange?: (zoom: number) => void;
}

export function InvoiceLivePreview({
  settings,
  logoUrl,
  previewTab,
  onTabChange,
  onWidthChange,
  onZoomChange,
}: InvoiceLivePreviewProps) {
  const [sampleSize, setSampleSize] = React.useState<1 | 3 | 6>(1);
  const isFiscal = previewTab === 'fiscal';
  const itbisRate = settings.itbisPercent ?? 18;

  const sampleItemsMap = {
    1: [
      {
        cantidad: 1,
        descripcion: 'Aceite Vegetal Crisol 64 oz',
        precioUnitario: 295,
        total: 295,
      },
    ],
    3: [
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
    6: [
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
      {
        cantidad: 1,
        descripcion: 'Café Santo Domingo 1 lb',
        precioUnitario: 310,
        total: 310,
      },
      {
        cantidad: 3,
        descripcion: 'Azúcar Crema 2 lbs',
        precioUnitario: 65,
        total: 195,
      },
      {
        cantidad: 2,
        descripcion: 'Huevos Docena',
        precioUnitario: 120,
        total: 240,
      },
    ],
  };

  const currentItems = sampleItemsMap[sampleSize];
  const subtotal = currentItems.reduce((acc, it) => acc + it.total, 0);
  const impuesto = Math.round(subtotal * (itbisRate / 100) * 100) / 100;
  const total = Math.round((subtotal + impuesto) * 100) / 100;
  const pagado = Math.ceil(total / 100) * 100;
  const cambio = Math.round((pagado - total) * 100) / 100;

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
    fecha: '02/11/2026',
    hora: '09:31 AM',
    cajero: 'Admin General',
    registerNumber: 'Caja #00000000-0000-0000-0000-000000000021',
    paymentMethod: 'EFECTIVO',
    cliente: isFiscal ? 'DISTRIBUIDORA NACIONAL S.A.' : 'Juan Pérez',
    clienteRnc: isFiscal ? '101-98765-4' : undefined,
    items: currentItems,
    subtotal,
    impuesto,
    total,
    pagado,
    cambio,
  };

  const isPaperSavingActive =
    settings.heightMode === 'compact' ||
    settings.templateStyle === 'compacto' ||
    (settings.heightMode !== 'standard' && (settings.paperSaverSmallSales ?? true) && sampleSize <= 3);

  return (
    <div className="lg:col-span-6 sticky top-6 space-y-3">
      {/* Cabecera de la vista previa: Segmented control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de prueba de tamaño / cantidad de ítems */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
            <span className="text-slate-400 dark:text-slate-500 px-1.5 font-medium">Prueba:</span>
            <button
              type="button"
              onClick={() => setSampleSize(1)}
              className={`py-0.5 px-2 rounded font-semibold transition cursor-pointer ${
                sampleSize === 1
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="1 producto - Venta pequeña (Ticket corto)"
            >
              1 prod
            </button>
            <button
              type="button"
              onClick={() => setSampleSize(3)}
              className={`py-0.5 px-2 rounded font-semibold transition cursor-pointer ${
                sampleSize === 3
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="3 productos - Mediana"
            >
              3 prod
            </button>
            <button
              type="button"
              onClick={() => setSampleSize(6)}
              className={`py-0.5 px-2 rounded font-semibold transition cursor-pointer ${
                sampleSize === 6
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
              title="6 productos - Venta grande (Ticket largo)"
            >
              6 prod
            </button>
          </div>

          {/* Control interactivo de Zoom */}
          {onZoomChange && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <span className="text-slate-400 dark:text-slate-500 px-1 font-medium">Zoom:</span>
              <button
                type="button"
                onClick={() =>
                  onZoomChange(
                    Math.max(0.7, Math.round(((settings.zoomScale ?? 1.0) - 0.05) * 100) / 100)
                  )
                }
                className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Reducir zoom (-5%)"
              >
                −
              </button>
              <span className="font-mono font-bold text-[11px] px-1 text-slate-800 dark:text-slate-200 min-w-[34px] text-center">
                {Math.round((settings.zoomScale ?? 1.0) * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  onZoomChange(
                    Math.min(1.5, Math.round(((settings.zoomScale ?? 1.0) + 0.05) * 100) / 100)
                  )
                }
                className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Aumentar zoom (+5%)"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Indicador de estado de altura de factura */}
      <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
        <span className="flex items-center gap-1">
          {isPaperSavingActive ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Ahorro de papel activo ({sampleSize === 1 ? 'Venta de 1 producto: Altura reducida' : 'Ajustado'})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
              Modo estándar ({sampleSize} productos)
            </span>
          )}
        </span>
        <span className="font-mono text-slate-400">
          Estilo: <strong className="text-slate-700 dark:text-slate-300 capitalize">{settings.templateStyle || 'clasico'}</strong>
        </span>
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
