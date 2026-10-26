import React, { useState, useEffect, useRef } from 'react';
import {
  getInvoiceSettings,
  saveInvoiceSettings,
  DEFAULT_INVOICE_SETTINGS,
  type InvoiceSettings,
  type PrintFormat,
  type FontFamily,
  type FontWeight,
  type PrintDensity,
  type SeparatorStyle,
  type LogoSize,
} from '@/lib/invoiceSettingsStore';
import { getCompanyLogo, setCompanyLogo, clearCompanyLogo } from '@/lib/companyLogo';
import { toast } from '@/lib/toast';

const ACCENT_COLORS = [
  { name: 'Verde esmeralda', hex: '#0f766e' },
  { name: 'Azul clásico', hex: '#2563eb' },
  { name: 'Violeta moderno', hex: '#7c3aed' },
  { name: 'Negro slate', hex: '#0f172a' },
  { name: 'Rojo carmesí', hex: '#be123c' },
  { name: 'Ámbar cálido', hex: '#b45309' },
];

export interface InvoiceSettingsTabProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function InvoiceSettingsTab({ onBack, showBackButton = false }: InvoiceSettingsTabProps) {
  const [settings, setSettings] = useState<InvoiceSettings>(() => getInvoiceSettings());
  const [logoUrl, setLogoUrlState] = useState<string | null>(() => getCompanyLogo());
  const [previewTab, setPreviewTab] = useState<'consumidor' | 'fiscal'>('consumidor');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void import('@/services/empresa.service')
      .then(({ obtenerConfiguracionEmpresa }) => obtenerConfiguracionEmpresa())
      .then((cfg) => {
        if (!cfg) return;
        setSettings((prev) => ({
          ...prev,
          companyName: cfg.nombre_comercial?.trim() || prev.companyName,
          companyRnc: cfg.rnc?.trim() || prev.companyRnc,
          companyPhone: cfg.telefono?.trim() || prev.companyPhone,
          companyEmail: cfg.correo?.trim() || prev.companyEmail,
          companyAddress: cfg.direccion?.trim() || prev.companyAddress,
        }));
      })
      .catch(() => {});
  }, []);

  const handleFieldChange = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'printFormat') {
        if (value === 'ticket_58mm') updated.customWidthMm = 58;
        if (value === 'ticket_80mm') updated.customWidthMm = 80;
      }
      return updated;
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCompanyLogo(result);
      setLogoUrlState(result);
      toast.success('Logotipo cargado correctamente');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    clearCompanyLogo();
    setLogoUrlState(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Logotipo eliminado');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveInvoiceSettings(settings);
      const { isSupabaseConfigured } = await import('@/services/clienteSupabase');
      if (isSupabaseConfigured()) {
        const { guardarConfiguracionEmpresa } = await import('@/services/empresa.service');
        await guardarConfiguracionEmpresa({
          nombre_comercial: settings.companyName,
          rnc: settings.companyRnc,
          telefono: settings.companyPhone,
          correo: settings.companyEmail,
          direccion: settings.companyAddress,
        });
      }
      toast.success('Configuración guardada correctamente');
    } catch {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_INVOICE_SETTINGS);
    saveInvoiceSettings(DEFAULT_INVOICE_SETTINGS);
    toast.info('Valores restablecidos a predeterminados');
  };

  const handlePrintTest = () => {
    // Guardar temporalmente para que el PrintableInvoice use las opciones actuales
    saveInvoiceSettings(settings);
    window.print();
  };

  const isFiscal = previewTab === 'fiscal';
  const accent = settings.accentColor || '#0f766e';
  const isTicket = settings.printFormat === 'ticket_80mm' || settings.printFormat === 'ticket_58mm';

  // Ancho en píxeles para la vista previa según ancho en mm (1mm ≈ 3.78px)
  const widthMm = settings.customWidthMm || (settings.printFormat === 'ticket_58mm' ? 58 : 80);
  const previewWidthPx = isTicket
    ? Math.min(460, Math.max(190, Math.round(widthMm * 3.78)))
    : 440;

  // Fuente tipográfica para la factura
  const getFontFamily = (f: FontFamily) => {
    switch (f) {
      case 'courier':
        return "'Courier New', Courier, monospace";
      case 'mono':
        return "'Roboto Mono', 'SF Mono', Consolas, monospace";
      case 'sans':
        return "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      case 'condensed':
        return "'Arial Narrow', 'Helvetica Condensed', 'Roboto Condensed', sans-serif";
      case 'consolas':
        return "'Consolas', 'Fira Code', Menlo, monospace";
      case 'serif':
        return "'Georgia', 'Times New Roman', serif";
      default:
        return "'Courier New', Courier, monospace";
    }
  };

  // Clases de divisor
  const getSeparatorBorder = (s: SeparatorStyle) => {
    switch (s) {
      case 'solid':
        return 'border-t border-slate-300 dark:border-slate-700';
      case 'dotted':
        return 'border-t border-dotted border-slate-400 dark:border-slate-600';
      case 'double':
        return 'border-t-2 border-double border-slate-400 dark:border-slate-600';
      case 'dashed':
      default:
        return 'border-t border-dashed border-slate-300 dark:border-slate-700';
    }
  };

  // Densidad / interlineado
  const getLineSpacingClass = (d: PrintDensity) => {
    switch (d) {
      case 'compact':
        return 'space-y-0.5 leading-tight';
      case 'spacious':
        return 'space-y-1.5 leading-relaxed';
      case 'normal':
      default:
        return 'space-y-1 leading-snug';
    }
  };

  // Altura del logo en preview según tamaño seleccionado
  const getLogoHeightPx = (s: LogoSize) => {
    switch (s) {
      case 'small':
        return 28;
      case 'large':
        return 56;
      case 'medium':
      default:
        return 40;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-2">
      {/* Botón Volver opcional */}
      {showBackButton && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Volver a configuración</span>
          </button>
        </div>
      )}

      {/* Encabezado: Título, descripción y botones de acción */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Diseño & Configuración de Facturas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personaliza el ancho manual, fuentes térmicas, márgenes y elementos que aparecen en tus comprobantes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrintTest}
            title="Abre el diálogo de impresión con el diseño actual"
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Imprimir prueba</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            Restablecer
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium transition cursor-pointer"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Dos columnas: Formulario a la izquierda · Vista previa fija a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
        {/* ========================================================
            Columna Izquierda: Formulario (6 cols)
            ======================================================== */}
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
                onClick={() => handleFieldChange('printFormat', 'ticket_80mm')}
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
                onClick={() => handleFieldChange('printFormat', 'ticket_58mm')}
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
                onClick={() => handleFieldChange('printFormat', 'full_page')}
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
                      onChange={(e) => handleFieldChange('customWidthMm', Number(e.target.value))}
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
                    onChange={(e) => handleFieldChange('customWidthMm', Number(e.target.value))}
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
                      onClick={() => handleFieldChange('customWidthMm', preset.mm)}
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
                          onClick={() => handleFieldChange('marginMm', m)}
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
                          onClick={() => handleFieldChange('feedLines', l)}
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
                      onClick={() => handleFieldChange('accentColor', c.hex)}
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
                    onChange={(e) => handleFieldChange('accentColor', e.target.value)}
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
                  onChange={(e) => handleFieldChange('fontFamily', e.target.value as FontFamily)}
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
                  onChange={(e) => handleFieldChange('separatorStyle', e.target.value as SeparatorStyle)}
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
                    onChange={(e) => handleFieldChange('customFontSizePt', Number(e.target.value))}
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
                      onClick={() => handleFieldChange('fontWeight', w.val)}
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
                      onClick={() => handleFieldChange('printDensity', d.val)}
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
                    onChange={(e) => handleFieldChange('uppercaseOnly', e.target.checked)}
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
                  onChange={handleLogoUpload}
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
                      onClick={handleRemoveLogo}
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
                      onClick={() => handleFieldChange('logoSize', sz)}
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
                      onChange={(e) => handleFieldChange('showLogo', e.target.checked)}
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
                  onChange={(e) => handleFieldChange('companyName', e.target.value)}
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
                  onChange={(e) => handleFieldChange('companyRnc', e.target.value)}
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
                  onChange={(e) => handleFieldChange('companyPhone', e.target.value)}
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
                  onChange={(e) => handleFieldChange('companyEmail', e.target.value)}
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
                  onChange={(e) => handleFieldChange('companyAddress', e.target.value)}
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
                  onChange={(e) => handleFieldChange('customSlogan', e.target.value)}
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
                    onChange={(e) => handleFieldChange(item.key, e.target.checked)}
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
                  onChange={(e) => handleFieldChange('footerMessage', e.target.value)}
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
                  onChange={(e) => handleFieldChange('termsAndConditions', e.target.value)}
                  placeholder="Cambios permitidos dentro de los 15 días posteriores con factura original."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            Columna Derecha: Vista previa fija (6 cols sticky)
            ======================================================== */}
        <div className="lg:col-span-6 sticky top-6 space-y-3">
          {/* Cabecera de la vista previa: Control segmentado y texto */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPreviewTab('consumidor')}
                className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
                  previewTab === 'consumidor'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Consumidor
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('fiscal')}
                className={`py-1 px-3 rounded-md font-medium transition cursor-pointer ${
                  previewTab === 'fiscal'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Crédito fiscal
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {widthMm}mm (~{previewWidthPx}px)
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Vista previa en vivo
              </span>
            </div>
          </div>

          {/* Contenedor gris suave donde reposa el papel */}
          <div className="bg-slate-50/90 dark:bg-slate-900/40 p-6 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-center items-start min-h-[560px] overflow-y-auto max-h-[700px] scrollbar-thin">
            {/* Papel de factura (blanco, sombra sutil, tipografía y ancho dinámico) */}
            <div
              className={`bg-white text-slate-900 border border-slate-200/90 shadow-sm p-5 select-none transition-all mx-auto ${getLineSpacingClass(
                settings.printDensity || 'normal'
              )}`}
              style={{
                width: `${previewWidthPx}px`,
                maxWidth: '100%',
                paddingLeft: `${Math.max(8, (settings.marginMm || 3) * 3.78)}px`,
                paddingRight: `${Math.max(8, (settings.marginMm || 3) * 3.78)}px`,
                fontFamily: getFontFamily(settings.fontFamily || 'courier'),
                fontSize: `${settings.customFontSizePt || 11}px`,
                fontWeight: settings.fontWeight === 'bold' ? 700 : settings.fontWeight === 'medium' ? 600 : 400,
                textTransform: settings.uppercaseOnly ? 'uppercase' : 'none',
              }}
            >
              {/* Encabezado del ticket */}
              <div className="text-center space-y-1">
                {settings.showLogo && logoUrl && (
                  <div className="flex justify-center pb-1">
                    <img
                      src={logoUrl}
                      alt="Logo Empresa"
                      style={{ height: `${getLogoHeightPx(settings.logoSize || 'medium')}px` }}
                      className="object-contain"
                    />
                  </div>
                )}
                <p
                  className="font-black uppercase tracking-tight text-slate-900"
                  style={{ fontSize: `${(settings.customFontSizePt || 11) + 2}px` }}
                >
                  {settings.companyName || 'Supermercado Mercato S.R.L.'}
                </p>
                {settings.showSlogan && settings.customSlogan && (
                  <p className="text-slate-600 italic" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                    "{settings.customSlogan}"
                  </p>
                )}
                {settings.showCompanyRnc && (
                  <p className="font-semibold text-slate-700" style={{ fontSize: `${(settings.customFontSizePt || 11) - 0.5}px` }}>
                    RNC: {settings.companyRnc || '131-45678-9'}
                  </p>
                )}
                {settings.showCompanyAddress && settings.companyAddress && (
                  <p className="text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                    {settings.companyAddress}
                  </p>
                )}
                {settings.showCompanyPhone && settings.companyPhone && (
                  <p className="text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                    Tel: {settings.companyPhone}
                  </p>
                )}
              </div>

              {/* Línea fina con el color de acento seleccionado */}
              <div
                className="h-[2px] w-full my-2.5"
                style={{ backgroundColor: accent }}
              />

              {/* Título de comprobante y NCF */}
              <div className="text-center space-y-0.5 pb-2">
                <p className="font-bold uppercase" style={{ fontSize: `${(settings.customFontSizePt || 11) - 0.5}px` }}>
                  {isFiscal ? 'FACTURA DE CRÉDITO FISCAL' : 'FACTURA PARA CONSUMIDOR FINAL'}
                </p>
                <p className="font-mono font-bold text-slate-800">
                  {isFiscal ? 'NCF: B0100000084' : 'NCF: B0200000452'}
                </p>
                {isFiscal && (
                  <p className="text-slate-500 font-mono" style={{ fontSize: `${(settings.customFontSizePt || 11) - 2}px` }}>
                    Vencimiento NCF: 31/12/2027
                  </p>
                )}
              </div>

              {/* Metadatos (Fecha, Cajero, Terminal, Cliente) */}
              <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-1 text-slate-700`} style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha / Hora:</span>
                  <span>26/10/2026 {settings.showIssueTime ? '10:45 AM' : ''}</span>
                </div>
                {settings.showCashier && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cajero:</span>
                    <span>Caja #1 (Admin)</span>
                  </div>
                )}
                {settings.showRegisterNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Terminal:</span>
                    <span>POS-01</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-medium truncate max-w-[170px]">
                    {isFiscal ? 'DISTRIBUIDORA NACIONAL S.A.' : 'Juan Pérez'}
                  </span>
                </div>
                {isFiscal && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">RNC Cliente:</span>
                    <span className="font-mono">101-98765-4</span>
                  </div>
                )}
              </div>

              {/* Tabla de Ítems */}
              <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-2`}>
                <div className="space-y-0.5">
                  <p className="text-slate-900 font-medium">Arroz Súper Selecto 10 lbs</p>
                  <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                    <span>{settings.showItemPriceUnitPrice ? '2 x RD$ 380.00' : 'Cant: 2'}</span>
                    <span className="text-slate-900 font-semibold tabular-nums">RD$ 760.00</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="text-slate-900 font-medium">Aceite Vegetal Crisol 64 oz</p>
                  <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                    <span>{settings.showItemPriceUnitPrice ? '1 x RD$ 295.00' : 'Cant: 1'}</span>
                    <span className="text-slate-900 font-semibold tabular-nums">RD$ 295.00</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="text-slate-900 font-medium">Leche Entera Milex 1L</p>
                  <div className="flex justify-between text-slate-600" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1}px` }}>
                    <span>{settings.showItemPriceUnitPrice ? '4 x RD$ 85.00' : 'Cant: 4'}</span>
                    <span className="text-slate-900 font-semibold tabular-nums">RD$ 340.00</span>
                  </div>
                </div>
              </div>

              {/* Subtotal, ITBIS y Total */}
              <div className={`py-2 ${getSeparatorBorder(settings.separatorStyle || 'dashed')} space-y-1`}>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">RD$ 1,395.00</span>
                </div>
                {settings.showTaxBreakdown && (
                  <div className="flex justify-between text-slate-600">
                    <span>ITBIS (18%)</span>
                    <span className="tabular-nums">RD$ 251.10</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 pt-1.5 border-t border-slate-900" style={{ fontSize: `${(settings.customFontSizePt || 11) + 1.5}px` }}>
                  <span>TOTAL A PAGAR</span>
                  <span className="tabular-nums">RD$ 1,646.10</span>
                </div>

                {settings.showPaymentDetails && (
                  <div className="pt-1.5 text-slate-600 space-y-0.5" style={{ fontSize: `${(settings.customFontSizePt || 11) - 1.5}px` }}>
                    <div className="flex justify-between">
                      <span>Efectivo recibido:</span>
                      <span className="tabular-nums">RD$ 2,000.00</span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>Cambio entregado:</span>
                      <span className="tabular-nums">RD$ 353.90</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Código de barras / QR si está activo */}
              {settings.showBarcodeQr && (
                <div className="py-2.5 flex flex-col items-center justify-center space-y-1">
                  <div className="p-1 bg-white border border-slate-300 rounded">
                    <svg className="w-16 h-16" viewBox="0 0 100 100" fill="currentColor">
                      <rect x="0" y="0" width="30" height="30" fill="black" />
                      <rect x="5" y="5" width="20" height="20" fill="white" />
                      <rect x="9" y="9" width="12" height="12" fill="black" />
                      <rect x="70" y="0" width="30" height="30" fill="black" />
                      <rect x="75" y="5" width="20" height="20" fill="white" />
                      <rect x="79" y="9" width="12" height="12" fill="black" />
                      <rect x="0" y="70" width="30" height="30" fill="black" />
                      <rect x="5" y="75" width="20" height="20" fill="white" />
                      <rect x="9" y="79" width="12" height="12" fill="black" />
                      <rect x="36" y="10" width="6" height="6" fill="black" />
                      <rect x="48" y="10" width="12" height="6" fill="black" />
                      <rect x="36" y="24" width="16" height="6" fill="black" />
                      <rect x="58" y="24" width="6" height="6" fill="black" />
                      <rect x="36" y="38" width="8" height="8" fill="black" />
                      <rect x="50" y="38" width="14" height="6" fill="black" />
                      <rect x="70" y="38" width="6" height="18" fill="black" />
                      <rect x="82" y="38" width="12" height="8" fill="black" />
                      <rect x="10" y="48" width="18" height="6" fill="black" />
                      <rect x="36" y="52" width="6" height="16" fill="black" />
                      <rect x="48" y="50" width="16" height="6" fill="black" />
                      <rect x="70" y="62" width="24" height="6" fill="black" />
                      <rect x="48" y="62" width="10" height="18" fill="black" />
                      <rect x="36" y="74" width="6" height="20" fill="black" />
                      <rect x="64" y="74" width="8" height="20" fill="black" />
                      <rect x="78" y="74" width="16" height="8" fill="black" />
                      <rect x="78" y="88" width="16" height="6" fill="black" />
                    </svg>
                  </div>
                  <span className="text-[7.5px] font-mono tracking-wider text-slate-500">
                    {isFiscal ? 'e-CF: E3100000084 · DGII Válido' : 'FAC-000452'}
                  </span>
                </div>
              )}

              {/* Línea de firma si está activa */}
              {settings.showSignatureLine && (
                <div className="pt-3 pb-1 text-center space-y-1">
                  <div className="w-3/4 mx-auto border-t border-slate-400" />
                  <p className="text-[8px] text-slate-500 uppercase">Firma del cliente / Recibido conforme</p>
                </div>
              )}

              {/* Pie de ticket y DGII */}
              <div
                className="pt-2 text-center space-y-1 text-slate-500"
                style={{ fontSize: `${(settings.customFontSizePt || 11) - 2}px` }}
              >
                {settings.footerMessage && (
                  <p className="font-medium text-slate-700">{settings.footerMessage}</p>
                )}
                {settings.termsAndConditions && (
                  <p className="text-[8px] leading-tight text-slate-400">{settings.termsAndConditions}</p>
                )}
                {settings.showDgiiLegend && isFiscal && (
                  <p className="text-[8px] font-bold text-slate-700 pt-0.5">
                    {settings.dgiiNotice || 'Documento autorizado por la DGII conforme a la Ley 11-92.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
