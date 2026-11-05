import React from 'react';
import type {
  InvoiceSettings,
  PaperWidth,
  TemplateStyle,
  InvoiceHeightMode,
  FontFamily,
} from '@/types/invoice';
import { normalizeInvoiceStyle } from '@/types/invoice';
import { Check, Type, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface InvoiceDesignFormProps {
  settings: InvoiceSettings;
  logoUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFieldChange: <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
}

const FONT_OPTIONS: Array<{
  id: FontFamily;
  name: string;
  badge: string;
  badgeColor: string;
  sample: string;
  fontCss: string;
  desc: string;
}> = [
  {
    id: 'courier',
    name: 'Courier Matricial',
    badge: 'Ticket clásico',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "'Courier New', Courier, monospace",
    desc: 'Estilo clásico matricial de caja registradora. Robusto y de máxima legibilidad en papel térmico.',
  },
  {
    id: 'sans',
    name: 'Sans-Serif Moderna',
    badge: 'Limpia / Suave',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    desc: 'Diseño moderno, limpio y geométrico. Excelente definición en impresoras térmicas de 203 DPI.',
  },
  {
    id: 'mono',
    name: 'Monoespaciada Pro',
    badge: 'Alineación exacta',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "'Roboto Mono', 'SF Mono', Consolas, monospace",
    desc: 'Ancho de letra idéntico en todos los caracteres para columnas y cifras numéricas perfectamente cuadradas.',
  },
  {
    id: 'condensed',
    name: 'Condensada (Ahorro)',
    badge: 'Ideal 50 / 58mm',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "'Arial Narrow', 'Helvetica Condensed', 'Roboto Condensed', sans-serif",
    desc: 'Tipografía angosta optimizada para no cortar nombres largos en rollos estrechos de 50mm y 58mm.',
  },
  {
    id: 'consolas',
    name: 'Consolas Terminal',
    badge: 'Terminal POS',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "'Consolas', 'Fira Code', Menlo, monospace",
    desc: 'Carácter nítido de terminal de caja con números distintivos y cero barrado para evitar confusiones.',
  },
  {
    id: 'serif',
    name: 'Serif Elegante',
    badge: 'Boutique / Gourmet',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    sample: 'RD$ 1,250.00 · TICKET #042',
    fontCss: "'Georgia', 'Times New Roman', serif",
    desc: 'Estilo editorial distinguido con terminaciones refinadas, ideal para restaurantes y comercios boutique.',
  },
];

const INVOICE_STYLES: Array<{
  id: TemplateStyle;
  name: string;
  tag: string;
  tagColor: string;
  description: string;
  thumbnail80: string;
  thumbnail50: string;
}> = [
  {
    id: 'clasico',
    name: 'Clásico Tradicional',
    tag: 'Estándar Oficial',
    tagColor:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    description:
      'Diseño tradicional y equilibrado con logo circular, NCF destacado, tabla de 4 columnas y marco de total en negrita.',
    thumbnail80: '/invoice-styles/clasico_80mm.png',
    thumbnail50: '/invoice-styles/clasico_50mm.png',
  },
  {
    id: 'compacto',
    name: 'Compacto (Ultra Ahorro)',
    tag: 'Ahorro Máximo de Papel',
    tagColor:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description:
      'Optimizado para ahorrar hasta un 60% de papel térmico. Ítems en 1 sola línea horizontal, datos en 2 columnas y altura mínima.',
    thumbnail80: '/invoice-styles/compacto_80mm.png',
    thumbnail50: '/invoice-styles/compacto_50mm.png',
  },
  {
    id: 'elegante',
    name: 'Elegante Boutique',
    tag: 'Gourmet / Boutique',
    tagColor:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    description:
      'Tipografía serif refinada con ornamentos de rombo ✦, tracking espaciado, cursivas y dobles líneas artesanales.',
    thumbnail80: '/invoice-styles/elegante_80mm.png',
    thumbnail50: '/invoice-styles/elegante_50mm.png',
  },
  {
    id: 'minimalista',
    name: 'Minimalista Nórdico',
    tag: 'Moderno Limpio',
    tagColor:
      'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    description:
      'Alineación moderna a la izquierda, tipografía sans-serif limpia, encabezado prominente y líneas delgadas sin saturación.',
    thumbnail80: '/invoice-styles/minimalista_80mm.png',
    thumbnail50: '/invoice-styles/minimalista_50mm.png',
  },
  {
    id: 'moderno',
    name: 'Moderno Alto Contraste',
    tag: 'Banners Invertidos',
    tagColor:
      'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    description:
      'Bloques y cintillos en negro sólido con texto blanco en encabezado, tabla y total para máxima visibilidad en caja.',
    thumbnail80: '/invoice-styles/moderno_80mm.png',
    thumbnail50: '/invoice-styles/moderno_50mm.png',
  },
  {
    id: 'supermercado',
    name: 'Supermercado Retail',
    tag: 'Caja Registradora',
    tagColor:
      'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    description:
      'Formato terminal de retail con marco doble superior, numeración secuencial 001, líneas de asteriscos y gran total centrado.',
    thumbnail80: '/invoice-styles/supermercado_80mm.png',
    thumbnail50: '/invoice-styles/supermercado_50mm.png',
  },
];

export function InvoiceDesignForm({
  settings,
  logoUrl,
  fileInputRef,
  onFieldChange,
  onLogoUpload,
  onRemoveLogo,
}: InvoiceDesignFormProps) {
  const currentPaperWidth =
    settings.paperWidth ||
    (settings.customWidthMm === 50 ? 50 : settings.printFormat === 'ticket_58mm' ? 58 : 80);

  const activeStyle = normalizeInvoiceStyle(settings.templateStyle);

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
    <div className="lg:col-span-6 space-y-7">
      {/* ========================================================
          1. SELECTOR DE ESTILOS DE DISEÑO DE FACTURAS (6 ESTILOS)
          ======================================================== */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Estilo de diseño de factura
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              6 Estilos disponibles
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Elige el formato visual que mejor se adapte a tu tipo de negocio. Todos son 100% compatibles con impresoras de 80mm, 58mm y 50mm.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {INVOICE_STYLES.map((st) => {
            const isSelected = activeStyle === st.id;
            const thumbUrl = currentPaperWidth === 50 ? st.thumbnail50 : st.thumbnail80;

            return (
              <div
                key={st.id}
                onClick={() => onFieldChange('templateStyle', st.id)}
                className={`group relative rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.tagColor}`}
                    >
                      {st.tag}
                    </span>

                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'border border-slate-300 dark:border-slate-700 group-hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>

                  <h3 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                    {st.name}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {st.description}
                  </p>
                </div>

                {/* Previsualización en miniatura de la factura */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 h-10 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-white flex items-center justify-center shadow-2xs">
                      <img
                        src={thumbUrl}
                        alt={st.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          // Si no carga la imagen, ocultar
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      80mm & 50mm
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-bold ${
                      isSelected
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                    }`}
                  >
                    {isSelected ? 'Activo' : 'Seleccionar'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          2. CONTROL DE ALTURA Y OPTIMIZACIÓN DE PAPEL TÉRMICO
          ======================================================== */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Tamaño de la factura y control de altura
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Ahorro de Rollo Térmico
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Resuelve que las facturas salgan largas cuando hay solo 1 o pocos productos. Automatiza la longitud según la compra.
          </p>
        </div>

        {/* 3 Modos de Altura */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onFieldChange('heightMode', 'auto')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              (settings.heightMode || 'auto') === 'auto'
                ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Automático
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Recomendado
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Corta y compacta para 1-3 productos; se alarga naturalmente si hay muchos ítems.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onFieldChange('heightMode', 'compact')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              settings.heightMode === 'compact'
                ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Ultra Compacto
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Ahorro Max
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Interlineado mínimo y sin saltos vacíos en todas las ventas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onFieldChange('heightMode', 'standard')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
              settings.heightMode === 'standard'
                ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Estándar
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Completo
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Espaciado tradicional holgado independientemente de la cantidad de productos.
            </p>
          </button>
        </div>

        {/* Automatización de ventas pequeñas */}
        <label className="flex items-start justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 cursor-pointer text-xs">
          <div className="pr-3">
            <span className="font-bold text-slate-900 dark:text-white block">
              Ahorro automático de papel en ventas pequeñas (1 a 3 productos)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
              Cuando el cliente adquiere pocos productos, compacta el encabezado, suprime líneas secundarias y reduce el pie para no emitir una factura kilometrica.
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settings.paperSaverSmallSales ?? true)}
            onChange={(e) => onFieldChange('paperSaverSmallSales', e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer shrink-0"
          />
        </label>

        {/* Avance de papel al corte (Feed lines) */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">
              Avance de papel para corte (Feed lines)
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Líneas vacías expulsadas al cortar el ticket térmico.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((lines) => (
              <button
                key={`feed-${lines}`}
                type="button"
                onClick={() => onFieldChange('feedLines', lines)}
                className={`w-8 h-7 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center justify-center ${
                  (settings.feedLines ?? 1) === lines
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {lines}
              </button>
            ))}
            <span className="text-[11px] text-slate-400 pl-1 font-mono">líneas</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. ANCHO DE PAPEL TÉRMICO (80 mm / 58 mm / 50 mm)
          ======================================================== */}
      <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Ancho de papel y formato térmico
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecciona el ancho de rollo según la impresora instalada en caja o despacho.
          </p>
        </div>

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

          {/* Selector de Tipo de Letra de Factura */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-slate-500" />
                <span>Tipo de Letra (Tipografía de Factura)</span>
              </label>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                {settings.fontFamily || 'courier'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONT_OPTIONS.map((f) => {
                const isSelected = (settings.fontFamily || 'courier') === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onFieldChange('fontFamily', f.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-slate-900 dark:border-white bg-slate-50/80 dark:bg-slate-800/80 ring-1 ring-slate-900 dark:ring-white shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {f.name}
                      </span>
                      <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md ${f.badgeColor}`}>
                        {f.badge}
                      </span>
                    </div>
                    {/* Muestra de texto en vivo con la tipografía real */}
                    <div
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200 py-1 px-1.5 bg-slate-100/70 dark:bg-slate-800/60 rounded border border-slate-200/50 dark:border-slate-700/50 my-1 truncate"
                      style={{ fontFamily: f.fontCss }}
                    >
                      {f.sample}
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                      {f.desc}
                    </p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ajuste Manual de Zoom / Escala */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
                <span>Ajuste Manual de Zoom / Escala</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {Math.round((settings.zoomScale ?? 1.0) * 100)}%
                </span>
                {(settings.zoomScale ?? 1.0) !== 1.0 && (
                  <button
                    type="button"
                    onClick={() => onFieldChange('zoomScale', 1.0)}
                    className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5 cursor-pointer"
                    title="Restablecer zoom a 100%"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>100%</span>
                  </button>
                )}
              </div>
            </div>

            {/* Slider de control continuo */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onFieldChange(
                      'zoomScale',
                      Math.max(0.7, Math.round(((settings.zoomScale ?? 1.0) - 0.05) * 100) / 100)
                    )
                  }
                  title="Reducir 5%"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <div className="flex-1">
                  <input
                    type="range"
                    min="0.70"
                    max="1.50"
                    step="0.05"
                    value={settings.zoomScale ?? 1.0}
                    onChange={(e) => onFieldChange('zoomScale', parseFloat(e.target.value))}
                    className="w-full accent-slate-900 dark:accent-white cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                    <span>70% (Mínimo)</span>
                    <span className="font-bold text-slate-600 dark:text-slate-400">100% (Estándar)</span>
                    <span>150% (Máximo)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onFieldChange(
                      'zoomScale',
                      Math.min(1.5, Math.round(((settings.zoomScale ?? 1.0) + 0.05) * 100) / 100)
                    )
                  }
                  title="Aumentar 5%"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botones de Presets rápidos */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                {[
                  { label: '75% (Mini)', val: 0.75 },
                  { label: '85% (Compacto)', val: 0.85 },
                  { label: '100% (Normal)', val: 1.0 },
                  { label: '115% (Grande)', val: 1.15 },
                  { label: '130% (Extra)', val: 1.3 },
                ].map((preset) => {
                  const isCurrent = Math.abs((settings.zoomScale ?? 1.0) - preset.val) < 0.01;
                  return (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => onFieldChange('zoomScale', preset.val)}
                      className={`text-[10px] px-2 py-1 rounded-md border font-medium transition cursor-pointer ${
                        isCurrent
                          ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. VISIBILIDAD DE ELEMENTOS (Mostrar / Ocultar)
          ======================================================== */}
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

      {/* ========================================================
          5. LOGOTIPO DEL NEGOCIO
          ======================================================== */}
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

      {/* ========================================================
          6. DATOS DEL NEGOCIO Y FISCALES
          ======================================================== */}
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

      {/* ========================================================
          7. TEXTOS AL PIE, POLÍTICAS Y COPIA CLIENTE
          ======================================================== */}
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
