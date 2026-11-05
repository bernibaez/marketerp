import React, { useState } from 'react';
import type { InvoiceData, InvoiceSettings, PaperWidth } from '@/types/invoice';
import ThermalInvoice from './ThermalInvoice';

export interface InvoicePreviewProps {
  data: InvoiceData;
  settings: InvoiceSettings;
  width?: PaperWidth;
  logoUrl?: string | null;
  className?: string;
  showWidthSwitcher?: boolean;
  onWidthChange?: (width: PaperWidth) => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  data,
  settings,
  width,
  logoUrl,
  className = '',
  showWidthSwitcher = true,
  onWidthChange,
}) => {
  const [internalWidth, setInternalWidth] = useState<PaperWidth>(
    width ?? settings.paperWidth ?? 80
  );

  const activeWidth = width ?? internalWidth;

  const handleWidthSelect = (w: PaperWidth) => {
    setInternalWidth(w);
    if (onWidthChange) {
      onWidthChange(w);
    }
  };

  // Conversión física estándar de pantalla: 1 mm = 3.779528 px (a 96 DPI estándar)
  const pixelWidth = Math.round(activeWidth * 3.779528);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Controles superiores de la vista previa */}
      {showWidthSwitcher && (
        <div className="w-full flex items-center justify-between pb-3 text-xs border-b border-slate-200 dark:border-slate-800 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => handleWidthSelect(80)}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                activeWidth === 80
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              80 mm (POS)
            </button>
            <button
              type="button"
              onClick={() => handleWidthSelect(58)}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                activeWidth === 58
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              58 mm
            </button>
            <button
              type="button"
              onClick={() => handleWidthSelect(50)}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                activeWidth === 50
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              50 mm (Portátil)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {activeWidth} mm ({pixelWidth} px a 1:1)
            </span>
            <span className="text-[11px] text-slate-500">Escala real</span>
          </div>
        </div>
      )}

      {/* Contenedor tipo bandeja de recepción térmica con rollo continuo */}
      <div className="w-full flex justify-center py-2 overflow-x-auto">
        <div
          className="relative bg-white text-black shadow-lg rounded-t-sm transition-all duration-150 border-x border-t border-slate-200"
          style={{
            width: `${pixelWidth}px`,
            maxWidth: '100%',
            minHeight: '260px',
            boxSizing: 'border-box',
          }}
        >
          {/* Componente de factura térmica real */}
          <ThermalInvoice
            data={data}
            settings={settings}
            width={activeWidth}
            logoUrl={logoUrl}
            zoomScale={settings.zoomScale}
          />

          {/* Efecto de borde dentado de guillotina / corte de papel al final */}
          <div
            className="w-full h-2.5 bg-repeat-x opacity-30 select-none pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, transparent 2px, #ffffff 2px, #ffffff 4px, transparent 4px)',
              backgroundSize: '8px 8px',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;

