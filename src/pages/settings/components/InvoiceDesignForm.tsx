import React from 'react';
import type {
  InvoiceSettings,
  FontFamily,
  SeparatorStyle,
  LogoSize,
} from '@/lib/invoiceSettingsStore';

const ACCENT_COLORS = [
  { name: 'Verde esmeralda', hex: '#0f766e' },
  { name: 'Azul clásico', hex: '#2563eb' },
  { name: 'Violeta moderno', hex: '#7c3aed' },
  { name: 'Negro slate', hex: '#0f172a' },
  { name: 'Rojo carmesí', hex: '#be123c' },
  { name: 'Ámbar cálido', hex: '#b45309' },
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
  const isTicket = settings.printFormat === 'ticket_80mm' || settings.printFormat === 'ticket_58mm';
  const widthMm = settings.customWidthMm || (settings.printFormat === 'ticket_58mm' ? 58 : 80);

  return (
    <div className="lg:col-span-6 space-y-6">
      {/* 1. Formato y Tamaño de Papel Manual */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Formato y dimensiones de papel
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona una plantilla base o calibra el ancho exacto en milímetros.
          </p>
        </div>

        {/* Presets de formato */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onFieldChange('printFormat', 'ticket_80mm')}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              settings.printFormat === 'ticket_80mm'
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/50 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Ticket térmico
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              80 mm · punto de venta y cajas
            </p>
          </button>

          <button
            type="button"
            onClick={() => onFieldChange('printFormat', 'ticket_58mm')}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              settings.printFormat === 'ticket_58mm'
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/50 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Ticket térmico
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              58 mm · miniprinter portátil
            </p>
          </button>

          <button
            type="button"
            onClick={() => onFieldChange('printFormat', 'full_page')}
            className={`p-3 rounded-lg border text-left transition cursor-pointer ${
              settings.printFormat === 'full_page'
                ? 'border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white bg-slate-50/50 dark:bg-slate-800/40'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Hoja completa
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Carta / A4 · crédito fiscal B01
            </p>
          </button>
        </div>

        {/* Ajuste manual de ancho en milímetros */}
        {isTicket && (
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/60 space-y-3 mt-2">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Ajuste manual del ancho de ticket
                </span>
                <p className="text-[11px] text-slate-500">
                  Calibra según la marca de tu impresora (Epson, Bixolon, Xprinter, etc.)
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={45}
                  max={115}
                  value={widthMm}
                  onChange={(e) => onFieldChange('customWidthMm', Number(e.target.value))}
                  className="w-16 px-2 py-0.5 text-xs text-right font-mono font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
                <span className="text-xs font-medium text-slate-500">mm</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono">45mm</span>
              <input
                type="range"
                min="45"
                max="115"
                step="1"
                value={widthMm}
                onChange={(e) => onFieldChange('customWidthMm', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
              />
              <span className="text-[10px] text-slate-400 font-mono">115mm</span>
            </div>

            {/* Accesos directos estándar */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] text-slate-500">Estándares:</span>
              {[
                { mm: 48, label: '48mm (Bluetooth)' },
                { mm: 58, label: '58mm (Miniprinter)' },
                { mm: 72, label: '72mm (Epson)' },
                { mm: 80, label: '80mm (POS Standard)' },
                { mm: 100, label: '100mm (Ancho)' },
              ].map((preset) => (
                <button
                  key={preset.mm}
                  type="button"
                  onClick={() => onFieldChange('customWidthMm', preset.mm)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                    widthMm === preset.mm
                      ? 'border-slate-900 dark:border-white font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Margen lateral y avance de papel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Margen lateral de papel
                  </span>
                  <span className="font-mono text-[11px] font-semibold">{settings.marginMm || 3} mm</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 2, 3, 5].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onFieldChange('marginMm', m)}
                      className={`flex-1 py-1 text-[10px] rounded border text-center transition ${
                        (settings.marginMm ?? 3) === m
                          ? 'border-slate-900 dark:border-white font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {m === 0 ? '0mm' : `${m}mm`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Avance antes de corte
                  </span>
                  <span className="font-mono text-[11px] font-semibold">{settings.feedLines || 3} líneas</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 6].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => onFieldChange('feedLines', l)}
                      className={`flex-1 py-1 text-[10px] rounded border text-center transition ${
                        (settings.feedLines ?? 3) === l
                          ? 'border-slate-900 dark:border-white font-semibold bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {l}L
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Color de acento */}
        <div className="pt-2">
          <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1.5">
            Color de acento de la factura
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_COLORS.map((c) => {
              const isSelected = settings.accentColor === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onFieldChange('accentColor', c.hex)}
                  className={`w-6 h-6 rounded-full transition cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110'
                      : 'hover:scale-105 opacity-90'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              );
            })}
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="color"
                value={settings.accentColor || '#0f766e'}
                onChange={(e) => onFieldChange('accentColor', e.target.value)}
                className="w-6 h-6 rounded border-0 cursor-pointer p-0 bg-transparent"
                title="Color personalizado"
              />
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                {settings.accentColor || '#0f766e'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tipografía & Tamaño de letra */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Tipografía y legibilidad
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona la familia tipográfica, tamaño en puntos y peso para máxima nitidez en impresión térmica.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Tipo de letra (Font)
            </label>
            <select
              value={settings.fontFamily || 'courier'}
              onChange={(e) => onFieldChange('fontFamily', e.target.value as FontFamily)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="courier">Courier New (Monospaced clásico)</option>
              <option value="mono">Roboto Mono (Técnica / Nítida)</option>
              <option value="sans">Inter / Sans-serif (Moderna SaaS)</option>
              <option value="condensed">Arial Narrow (Condensada / Ahorro)</option>
              <option value="consolas">Consolas / Fira Code (Terminal)</option>
              <option value="serif">Georgia (Serif formal corporativa)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Estilo de divisor
            </label>
            <select
              value={settings.separatorStyle || 'dashed'}
              onChange={(e) => onFieldChange('separatorStyle', e.target.value as SeparatorStyle)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="dashed">Punteado con guiones (- - - -)</option>
              <option value="dotted">Puntos finos (· · · ·)</option>
              <option value="solid">Línea sólida continua (─────)</option>
              <option value="double">Doble línea (═════)</option>
            </select>
          </div>

          {/* Slider de tamaño de fuente manual (pt) */}
          <div className="sm:col-span-2 p-3 bg-slate-50/70 dark:bg-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/60 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Tamaño de letra manual
                </span>
                <span className="text-[11px] text-slate-500 ml-1.5">(Escala todo el comprobante proporcionalmente)</span>
              </div>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {settings.customFontSizePt || 11} pt
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 font-mono">8 pt</span>
              <input
                type="range"
                min="8"
                max="15"
                step="0.5"
                value={settings.customFontSizePt || 11}
                onChange={(e) => onFieldChange('customFontSizePt', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
              />
              <span className="text-[10px] text-slate-400 font-mono">15 pt</span>
            </div>
          </div>

          {/* Peso de letra e Interlineado */}
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Grosor de texto (Legibilidad)
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 'normal' as const, label: 'Normal' },
                { val: 'medium' as const, label: 'Medio' },
                { val: 'bold' as const, label: 'Negrita' },
              ].map((w) => (
                <button
                  key={w.val}
                  type="button"
                  onClick={() => onFieldChange('fontWeight', w.val)}
                  className={`py-1.5 text-xs rounded border text-center transition ${
                    (settings.fontWeight || 'normal') === w.val
                      ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Densidad de renglones
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { val: 'compact' as const, label: 'Compacta' },
                { val: 'normal' as const, label: 'Estándar' },
                { val: 'spacious' as const, label: 'Espaciosa' },
              ].map((d) => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => onFieldChange('printDensity', d.val)}
                  className={`py-1.5 text-xs rounded border text-center transition ${
                    (settings.printDensity || 'normal') === d.val
                      ? 'border-slate-900 dark:border-white font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interruptor Todo Mayúsculas */}
          <div className="sm:col-span-2 pt-1">
            <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer text-xs">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  Imprimir comprobante TODO EN MAYÚSCULAS
                </span>
                <p className="text-[11px] text-slate-500">
                  Recomendado en República Dominicana para tickets POS tradicionales
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.uppercaseOnly)}
                onChange={(e) => onFieldChange('uppercaseOnly', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Logotipo de la Empresa */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Logotipo del negocio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aparece centrado en la parte superior del ticket o factura.
          </p>
        </div>

        <div className="flex items-center gap-4 pt-1">
          {logoUrl ? (
            <div className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 text-[10px]">
              Sin logo
            </div>
          )}

          <div className="space-y-2 flex-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onLogoUpload}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {logoUrl ? 'Cambiar logo' : 'Subir imagen'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  Quitar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500">Tamaño:</label>
              {(['small', 'medium', 'large'] as LogoSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onFieldChange('logoSize', sz)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition ${
                    (settings.logoSize || 'medium') === sz
                      ? 'border-slate-900 dark:border-white font-semibold bg-slate-100 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {sz === 'small' ? 'Pequeño' : sz === 'medium' ? 'Mediano' : 'Grande'}
                </button>
              ))}
              <label className="flex items-center gap-1.5 ml-auto text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.showLogo)}
                  onChange={(e) => onFieldChange('showLogo', e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300"
                />
                <span>Mostrar en ticket</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Datos del negocio */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Datos del negocio
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Información fiscal y de contacto que encabeza cada comprobante.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Razón social / Nombre comercial
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => onFieldChange('companyName', e.target.value)}
              placeholder="Supermercado Mercato S.R.L."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              RNC / Cédula fiscal
            </label>
            <input
              type="text"
              value={settings.companyRnc}
              onChange={(e) => onFieldChange('companyRnc', e.target.value)}
              placeholder="131-45678-9"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Teléfono / WhatsApp
            </label>
            <input
              type="text"
              value={settings.companyPhone}
              onChange={(e) => onFieldChange('companyPhone', e.target.value)}
              placeholder="(809) 555-0199"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={settings.companyEmail}
              onChange={(e) => onFieldChange('companyEmail', e.target.value)}
              placeholder="contacto@mercato.do"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Dirección física
            </label>
            <input
              type="text"
              value={settings.companyAddress}
              onChange={(e) => onFieldChange('companyAddress', e.target.value)}
              placeholder="Av. 27 de Febrero #450, Santo Domingo, R.D."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Eslogan comercial o lema
            </label>
            <input
              type="text"
              value={settings.customSlogan}
              onChange={(e) => onFieldChange('customSlogan', e.target.value)}
              placeholder="Calidad y Frescura para tu Hogar"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 5. Contenido, Ítems & Opciones de Impresión */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Contenido e información impresa
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona con precisión los datos que se desglosan en cada venta.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {[
            { key: 'showSlogan' as const, label: 'Mostrar eslogan comercial debajo del nombre' },
            { key: 'showCashier' as const, label: 'Mostrar nombre del cajero / operador' },
            { key: 'showRegisterNumber' as const, label: 'Mostrar número de caja / terminal POS' },
            { key: 'showIssueTime' as const, label: 'Mostrar hora exacta de emisión' },
            { key: 'showItemPriceUnitPrice' as const, label: 'Mostrar desglose de precio unitario y cantidad (ej: 2 x RD$ 150)' },
            { key: 'showTaxBreakdown' as const, label: 'Mostrar desglose de base imponible e ITBIS (18%)' },
            { key: 'showPaymentDetails' as const, label: 'Mostrar método de pago y cambio devuelto' },
            { key: 'showBarcodeQr' as const, label: 'Mostrar código de barras / QR de verificación' },
            { key: 'showDgiiLegend' as const, label: 'Mostrar leyenda legal oficial de la DGII' },
            { key: 'showSignatureLine' as const, label: 'Incluir línea para firma del cliente (recibido conforme)' },
            { key: 'autoCutPaper' as const, label: 'Activar corte automático de papel (Auto-cut ESC/POS)' },
            { key: 'openCashDrawer' as const, label: 'Apertura automática de gaveta de dinero (RJ11 Cash Drawer)' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between py-1.5 cursor-pointer text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={Boolean(settings[item.key])}
                onChange={(e) => onFieldChange(item.key, e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>

      {/* 6. Textos de Pie & Políticas */}
      <div className="space-y-3 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Mensajes al pie y políticas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Agradecimientos, términos de cambio o notas de garantía.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Mensaje de agradecimiento
            </label>
            <input
              type="text"
              value={settings.footerMessage}
              onChange={(e) => onFieldChange('footerMessage', e.target.value)}
              placeholder="¡Gracias por su compra! Conserve este comprobante para cualquier reclamación."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
              Política de cambios y garantías
            </label>
            <textarea
              rows={2}
              value={settings.termsAndConditions}
              onChange={(e) => onFieldChange('termsAndConditions', e.target.value)}
              placeholder="Cambios permitidos dentro de los 15 días posteriores con factura original."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
