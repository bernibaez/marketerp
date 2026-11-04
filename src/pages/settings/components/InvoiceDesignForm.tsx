import React from 'react';
import type {
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  FontFamily,
  SeparatorStyle,
  LogoSize,
} from '@/types/invoice';

const ACCENT_COLORS = [
  { name: 'Negro térmico puro', hex: '#000000' },
  { name: 'Verde esmeralda', hex: '#0f766e' },
  { name: 'Azul clásico', hex: '#2563eb' },
  { name: 'Violeta moderno', hex: '#7c3aed' },
  { name: 'Negro slate', hex: '#0f172a' },
  { name: 'Rojo carmesí', hex: '#be123c' },
];

interface InvoiceDesignFormProps {
  settings: InvoiceSettings;
  logoUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFieldChange: <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
}

export function InvoiceDesignForm({
  settings,
  logoUrl,
  fileInputRef,
  onFieldChange,
  onLogoUpload,
  onRemoveLogo,
}: InvoiceDesignFormProps) {
  const currentPaperWidth = settings.paperWidth || (settings.customWidthMm === 50 ? 50 : settings.printFormat === 'ticket_58mm' ? 58 : 80);

  const handleWidthChange = (w: PaperWidth) => {
    onFieldChange('paperWidth', w);
    onFieldChange('customWidthMm', w);
    if (w === 50 || w === 58) {
      onFieldChange('printFormat', 'ticket_58mm');
    } else {
      onFieldChange('printFormat', 'ticket_80mm');
    }
  };

  return (
    <div className="lg:col-span-6 space-y-6">
      {/* 1. Ancho de Papel Térmico (80 mm / 58 mm / 50 mm) */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Ancho de papel y formato térmico
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona el ancho de rollo según la impresora instalada en caja o despacho.
          </p>
        </div>

        {/* Selector de Ancho */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            id="btn-width-80mm"
            aria-label="Seleccionar 80 mm POS Estándar"
            onClick={() => handleWidthChange(80)}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              currentPaperWidth === 80
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/70 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>80 mm</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 font-mono">
                POS Caja
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              4 columnas: Cant, Desc, Precio y Total.
            </p>
          </button>

          <button
            type="button"
            id="btn-width-58mm"
            aria-label="Seleccionar 58 mm Miniprinter"
            onClick={() => handleWidthChange(58)}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              currentPaperWidth === 58
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/70 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>58 mm</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 font-mono">
                Estándar
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Miniprinter de mostrador (2 líneas por ítem).
            </p>
          </button>

          <button
            type="button"
            id="btn-width-50mm"
            aria-label="Seleccionar 50 mm Portátil"
            onClick={() => handleWidthChange(50)}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              currentPaperWidth === 50
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/70 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>50 mm</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 font-mono">
                Portátil
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Impresora móvil bluetooth / delivery.
            </p>
          </button>
        </div>

        {/* Copias por impresión y tamaño de letra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label htmlFor="copiesCount" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Número de copias por impresión
            </label>
            <div className="flex items-center gap-2">
              <input
                id="copiesCount"
                type="number"
                min={1}
                max={5}
                value={settings.defaultCopies || 1}
                onChange={(e) => onFieldChange('defaultCopies', Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                className="w-20 text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
              />
              <span className="text-[11px] text-slate-500">
                {settings.defaultCopies > 1 ? `${settings.defaultCopies} tickets por venta` : '1 ticket original'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Tamaño de letra térmico
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onFieldChange('fontSizeOption', 'compact')}
                className={`py-1.5 px-2 text-xs rounded-lg border text-center transition cursor-pointer font-medium ${
                  settings.fontSizeOption === 'compact'
                    ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Compacto
              </button>
              <button
                type="button"
                onClick={() => onFieldChange('fontSizeOption', 'normal')}
                className={`py-1.5 px-2 text-xs rounded-lg border text-center transition cursor-pointer font-medium ${
                  (settings.fontSizeOption || 'normal') === 'normal'
                    ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onFieldChange('fontSizeOption', 'large')}
                className={`py-1.5 px-2 text-xs rounded-lg border text-center transition cursor-pointer font-medium ${
                  settings.fontSizeOption === 'large'
                    ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Grande
              </button>
              <button
                type="button"
                onClick={() => onFieldChange('fontSizeOption', 'xlarge')}
                className={`py-1.5 px-2 text-xs rounded-lg border text-center transition cursor-pointer font-medium ${
                  settings.fontSizeOption === 'xlarge'
                    ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Extra (+30%)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visibilidad de Elementos (Mostrar / Ocultar) */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Elementos visibles en la factura
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controla qué secciones aparecen en el comprobante impreso y en la vista previa.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {[
            {
              key: 'showLogo' as const,
              label: 'Logotipo o inicial de empresa',
              desc: 'Círculo negro con inicial si no hay imagen',
            },
            {
              key: 'showNcf' as const,
              label: 'Comprobante fiscal (NCF)',
              desc: 'Muestra fila destacada con NCF',
            },
            {
              key: 'showCustomer' as const,
              label: 'Datos del cliente',
              desc: 'Nombre y RNC del comprador',
            },
            {
              key: 'showCashier' as const,
              label: 'Nombre del cajero / operador',
              desc: 'Identificación del responsable de caja',
            },
            {
              key: 'showBarcode' as const,
              label: 'Código de barras Code 128',
              desc: 'Con número de factura en letras espaciadas',
            },
            {
              key: 'showFooter' as const,
              label: 'Pie de página y políticas',
              desc: 'Agradecimiento, política y copia cliente',
            },
          ].map((item) => (
            <label
              key={item.key}
              htmlFor={`chk-${item.key}`}
              className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer text-xs"
            >
              <div className="pr-2">
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {item.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {item.desc}
                </span>
              </div>
              <input
                id={`chk-${item.key}`}
                type="checkbox"
                checked={Boolean(settings[item.key] ?? true)}
                onChange={(e) => onFieldChange(item.key, e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer shrink-0"
              />
            </label>
          ))}
        </div>
      </div>

      {/* 3. Logotipo de la Empresa */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Logotipo del negocio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aparece centrado arriba. Si no subes una imagen, se muestra un círculo negro con la inicial de tu empresa.
          </p>
        </div>

        <div className="flex items-center gap-4 pt-1">
          {logoUrl ? (
            <div className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <img
                src={logoUrl}
                alt="Logo Empresa"
                className="h-10 object-contain filter grayscale contrast-200"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-black text-white font-sans font-black flex items-center justify-center text-lg shadow-sm">
              {(settings.companyName || 'M').trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-2 flex-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoUpload}
              className="hidden"
              id="logo-file-input"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {logoUrl ? 'Cambiar imagen' : 'Subir logo (PNG/JPG)'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  Quitar imagen
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Para impresoras térmicas se recomienda PNG en blanco y negro nítido.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Datos del Negocio & Fiscalidad */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Datos del negocio y fiscales
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Encabezado de la factura, RNC, moneda, porcentaje de ITBIS y comprobante fiscal.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="sm:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="companyName" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Nombre del negocio
              </label>
              <span className="text-[11px] text-slate-500">Permite 1 o 2 líneas en negrita</span>
            </div>
            <input
              id="companyName"
              type="text"
              value={settings.companyName}
              onChange={(e) => onFieldChange('companyName', e.target.value)}
              placeholder="SUPERMERCADO MERCATO S.R.L."
              className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="companyRnc" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              RNC o Cédula fiscal
            </label>
            <input
              id="companyRnc"
              type="text"
              value={settings.companyRnc}
              onChange={(e) => onFieldChange('companyRnc', e.target.value)}
              placeholder="131-45678-9"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="companyPhone" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Teléfono / Contacto
            </label>
            <input
              id="companyPhone"
              type="text"
              value={settings.companyPhone}
              onChange={(e) => onFieldChange('companyPhone', e.target.value)}
              placeholder="(809) 555-0199"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="companyAddress" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Dirección física
            </label>
            <input
              id="companyAddress"
              type="text"
              value={settings.companyAddress}
              onChange={(e) => onFieldChange('companyAddress', e.target.value)}
              placeholder="Av. 27 de Febrero #450, Santo Domingo, R.D."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="companyWebsite" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Sitio web
            </label>
            <input
              id="companyWebsite"
              type="text"
              value={settings.companyWebsite || ''}
              onChange={(e) => onFieldChange('companyWebsite', e.target.value)}
              placeholder="www.mercato.do"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="customSlogan" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Eslogan comercial
            </label>
            <input
              id="customSlogan"
              type="text"
              value={settings.customSlogan || ''}
              onChange={(e) => onFieldChange('customSlogan', e.target.value)}
              placeholder="Calidad y Frescura para tu Hogar"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          {/* Moneda e ITBIS */}
          <div>
            <label htmlFor="currencySymbol" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Símbolo de moneda
            </label>
            <input
              id="currencySymbol"
              type="text"
              value={settings.currencySymbol || 'RD$'}
              onChange={(e) => onFieldChange('currencySymbol', e.target.value)}
              placeholder="RD$"
              className="w-full text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="itbisPercent" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Porcentaje de ITBIS (%)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="itbisPercent"
                type="number"
                min={0}
                max={100}
                step={1}
                value={settings.itbisPercent ?? 18}
                onChange={(e) => onFieldChange('itbisPercent', Number(e.target.value))}
                placeholder="18"
                className="w-full text-xs font-mono font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
              />
              <span className="text-xs text-slate-500 font-bold">%</span>
            </div>
          </div>

          {/* Tipo de NCF y Secuencia por defecto */}
          <div>
            <label htmlFor="ncfType" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Tipo de NCF por defecto
            </label>
            <select
              id="ncfType"
              value={settings.ncfType || 'B02'}
              onChange={(e) => onFieldChange('ncfType', e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="B02">B02 - Factura de Consumo Final</option>
              <option value="B01">B01 - Factura de Crédito Fiscal</option>
              <option value="B14">B14 - Régimen Especial</option>
              <option value="B15">B15 - Gubernamental</option>
            </select>
          </div>

          <div>
            <label htmlFor="ncfSequence" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Secuencia / Prefijo NCF
            </label>
            <input
              id="ncfSequence"
              type="text"
              value={settings.ncfSequence || ''}
              onChange={(e) => onFieldChange('ncfSequence', e.target.value)}
              placeholder="B0200000452"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 5. Textos al Pie, Políticas y Copia Cliente */}
      <div className="space-y-3 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Mensajes al pie, políticas y texto de copia
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Agradecimientos, términos de garantía y rótulo de copia para entrega al comprador.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label htmlFor="footerMessage" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Mensaje de agradecimiento
            </label>
            <input
              id="footerMessage"
              type="text"
              value={settings.footerMessage}
              onChange={(e) => onFieldChange('footerMessage', e.target.value)}
              placeholder="¡GRACIAS POR SU COMPRA!"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label htmlFor="termsAndConditions" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Política de cambios y devoluciones
            </label>
            <textarea
              id="termsAndConditions"
              rows={2}
              value={settings.termsAndConditions}
              onChange={(e) => onFieldChange('termsAndConditions', e.target.value)}
              placeholder="Cambios permitidos dentro de los 15 días posteriores con factura original."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 resize-none"
            />
          </div>

          <div>
            <label htmlFor="copyText" className="text-xs text-slate-700 dark:text-slate-300 block mb-1 font-medium">
              Texto de copia (al final del comprobante)
            </label>
            <input
              id="copyText"
              type="text"
              value={settings.copyText || '*** COPIA CLIENTE ***'}
              onChange={(e) => onFieldChange('copyText', e.target.value)}
              placeholder="*** COPIA CLIENTE ***"
              className="w-full text-xs font-bold font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
