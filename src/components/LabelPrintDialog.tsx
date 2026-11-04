import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Barcode,
  Download,
  Settings2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  RotateCw,
  Plus,
  Minus,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { Product } from '@/lib/initialProducts';
import type { BarcodeFormat, LabelSize } from '@/types/barcode';
import { PRESET_LABEL_SIZES } from '@/types/barcode';
import { usePrintLabels } from '@/hooks/usePrintLabels';
import ProductLabel from './ProductLabel';
import { validateBarcode, detectBestBarcodeFormat } from '@/utils/barcode';
import { toast } from '@/lib/toast';

export interface LabelPrintDialogProps {
  products: Product[];
  onClose: () => void;
  isOpen?: boolean;
}

export default function LabelPrintDialog({
  products,
  onClose,
  isOpen = true,
}: LabelPrintDialogProps) {
  const { config, updateConfig, printLabels, downloadPdf, isGeneratingPdf } = usePrintLabels();
  const [scale, setScale] = useState<number>(1); // 1 = escala real 1:1 (~3.78 px por mm)
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  // Selector individual de formato por producto
  const [productFormats, setProductFormats] = useState<Record<string, BarcodeFormat>>(() => {
    const initial: Record<string, BarcodeFormat> = { ...config.productFormats };
    products.forEach((p) => {
      if (!initial[p.id]) {
        const code = p.barcode || p.sku || '';
        initial[p.id] = config.format || detectBestBarcodeFormat(code);
      }
    });
    return initial;
  });

  // Copias por producto
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = { ...config.copies };
    products.forEach((p) => {
      if (!initial[p.id] || initial[p.id] < 1) {
        initial[p.id] = 1;
      }
    });
    return initial;
  });

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Sincronizar copias y formatos en la configuración persistente
  useEffect(() => {
    updateConfig({ copies, productFormats });
  }, [copies, productFormats, updateConfig]);

  // Tamaño de etiqueta seleccionado
  const selectedSize: LabelSize = useMemo(() => {
    return PRESET_LABEL_SIZES.find((s) => s.id === config.sizeId) || PRESET_LABEL_SIZES[0];
  }, [config.sizeId]);

  const effectiveWidthMm =
    selectedSize.id === 'custom' ? config.customWidthMm : selectedSize.widthMm;
  const effectiveHeightMm =
    selectedSize.id === 'custom' ? config.customHeightMm : selectedSize.heightMm;

  // Cambiar formato global para todos los productos
  const handleGlobalFormatChange = (fmt: BarcodeFormat) => {
    updateConfig({ format: fmt });
    const next: Record<string, BarcodeFormat> = {};
    products.forEach((p) => {
      next[p.id] = fmt;
    });
    setProductFormats(next);
  };

  // Cambiar formato específico de un producto
  const handleProductFormatChange = (productId: string, fmt: BarcodeFormat) => {
    setProductFormats((prev) => ({
      ...prev,
      [productId]: fmt,
    }));
  };

  // Ajustar copias
  const handleCopiesChange = (productId: string, delta: number) => {
    setCopies((prev) => {
      const current = prev[productId] || 1;
      const next = Math.max(1, Math.min(999, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  // Lista aplanada de etiquetas con su formato y copias
  const printableList = useMemo(() => {
    return products.map((p) => {
      const fmt = productFormats[p.id] || config.format || 'CODE128';
      const count = copies[p.id] || 1;
      const code = p.barcode || p.sku || p.id;
      const validation = validateBarcode(fmt, code);
      return {
        product: p,
        format: fmt,
        count,
        validation,
      };
    });
  }, [products, productFormats, config.format, copies]);

  const totalLabels = printableList.reduce((acc, item) => acc + item.count, 0);

  // Detección de incompatibilidades en el lote
  const incompatibleItems = printableList.filter((item) => !item.validation.valid);

  const handleRotateNext = () => {
    const current = config.rotation ?? (config.orientation === 'portrait' ? 90 : 0);
    const nextRot = ((current + 90) % 360) as 0 | 90 | 180 | 270;
    updateConfig({
      rotation: nextRot,
      orientation: nextRot === 90 || nextRot === 270 ? 'portrait' : 'landscape',
    });
  };

  const handlePrint = () => {
    if (products.length === 0) {
      toast.error('No hay productos para imprimir.');
      return;
    }
    const currentRot = config.rotation ?? (config.orientation === 'portrait' ? 90 : 0);
    toast.success(`Enviando ${totalLabels} etiqueta(s) a la impresora...`);
    printLabels(selectedSize, config.customWidthMm, config.customHeightMm, config.orientation, currentRot);
  };

  const handleDownloadPdf = async () => {
    if (!printSheetRef.current) return;
    toast.info('Generando documento PDF de etiquetas...');
    await downloadPdf(printSheetRef.current, `etiquetas_${config.sizeId}_${Date.now()}.pdf`);
  };

  if (!isOpen) return null;

  // Hoja imprimible oculta en pantalla, activada en @media print
  const printSheetPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={printSheetRef}
            className={`printable-area label-print-sheet ${
              selectedSize.isGrid
                ? 'label-print-grid-container'
                : selectedSize.isContinuous
                  ? 'label-print-continuous-container'
                  : 'label-print-single-container'
            }`}
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
            }}
            aria-hidden="true"
          >
            {printableList.flatMap(({ product, format, count }) =>
              Array.from({ length: count }).map((_, idx) => (
                <div
                  key={`print-${product.id}-${format}-${idx}`}
                  className={`${
                    selectedSize.isGrid
                      ? 'label-print-grid-item'
                      : selectedSize.isContinuous
                        ? 'label-print-continuous-item'
                        : 'label-print-single-item'
                  }`}
                >
                  <ProductLabel
                    product={product}
                    format={format}
                    size={selectedSize}
                    customWidthMm={config.customWidthMm}
                    customHeightMm={config.customHeightMm}
                    businessName={config.businessName}
                    currencySymbol={config.currencySymbol}
                    showName={config.showName}
                    showPrice={config.showPrice}
                    showSku={config.showSku}
                    showBarcodeText={config.showBarcodeText}
                    showBusinessName={config.showBusinessName}
                    orientation={config.orientation}
                    rotation={config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)}
                    isPrintMode={true}
                  />
                </div>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-dialog-title"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Barcode size={22} />
              </div>
              <div>
                <h2 id="label-dialog-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  Imprimir Etiquetas y Códigos de Barras
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {totalLabels} {totalLabels === 1 ? 'etiqueta' : 'etiquetas'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configura formatos GS1/Code 128, dimensiones físicas y previsualización a escala real.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar panel de etiquetas"
            >
              <X size={20} />
            </button>
          </div>

          {/* Alerta de incompatibilidad si algún producto no cumple el formato */}
          {incompatibleItems.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">
                  {incompatibleItems.length} producto(s) no son compatibles con el formato seleccionado (letras o longitud no numérica).
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleGlobalFormatChange('CODE128')}
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer"
              >
                Cambiar todos a Code 128
              </button>
            </div>
          )}

          {/* Cuerpo dividido en 2 columnas: Configuración y Previsualización */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Columna Izquierda: Controles y Configuración */}
            <div className="lg:col-span-6 p-5 overflow-y-auto space-y-5 scrollbar-thin">
              {/* Sección 1: Formato de Código de Barras y Tamaño */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Settings2 size={14} />
                  1. Formato y Tamaño de Etiqueta
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="barcode-format-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Formato de Código Global
                    </label>
                    <select
                      id="barcode-format-select"
                      value={config.format}
                      onChange={(e) => handleGlobalFormatChange(e.target.value as BarcodeFormat)}
                      className="input-field text-xs w-full font-medium"
                    >
                      <option value="CODE128">Code 128 (Alfanumérico / Recomendado)</option>
                      <option value="EAN13">EAN-13 (12 dígitos + Verificador)</option>
                      <option value="EAN8">EAN-8 (7 dígitos + Verificador)</option>
                      <option value="UPCA">UPC-A (11 dígitos + Verificador)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="label-size-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tamaño / Preset de Impresión
                    </label>
                    <select
                      id="label-size-select"
                      value={config.sizeId}
                      onChange={(e) => updateConfig({ sizeId: e.target.value })}
                      className="input-field text-xs w-full font-medium"
                    >
                      {PRESET_LABEL_SIZES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.description ? `— ${s.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Orientación y Giro de Posición: Horizontal (0°) vs Vertical (Girado 90°) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Orientación y Giro del Ticket
                    </label>
                    <button
                      type="button"
                      onClick={handleRotateNext}
                      className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Girar 90° en sentido horario"
                    >
                      <RotateCw size={12} />
                      Girar 90° ({(config.rotation ?? (config.orientation === 'portrait' ? 90 : 0))}°)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientation: 'landscape', rotation: 0 })}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition cursor-pointer ${
                        (config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)) === 0
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-5 h-3.5 border-2 border-current rounded-xs flex items-center justify-center">
                        <span className="text-[8px] font-mono leading-none">━</span>
                      </div>
                      <div className="text-left">
                        <p className="leading-tight">Horizontal (0°)</p>
                        <p className="text-[10px] font-normal text-muted-foreground">Posición apaisada normal</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig({ orientation: 'portrait', rotation: 90 })}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition cursor-pointer ${
                        (config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)) === 90
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-3.5 h-5 border-2 border-current rounded-xs flex items-center justify-center">
                        <span className="text-[8px] font-mono leading-none">┃</span>
                      </div>
                      <div className="text-left">
                        <p className="leading-tight">Vertical (Girado 90°)</p>
                        <p className="text-[10px] font-normal text-muted-foreground">Posición girada 90°</p>
                      </div>
                    </button>
                  </div>

                  {/* Micro-pills de ángulo exacto de giro */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg text-[11px] font-medium">
                    <span className="text-[10px] text-slate-400 font-bold uppercase px-1">Giro:</span>
                    {([
                      { deg: 0, label: '0° Normal' },
                      { deg: 90, label: '90° Der.' },
                      { deg: 180, label: '180° Inv.' },
                      { deg: 270, label: '270° Izq.' },
                    ] as const).map(({ deg, label }) => {
                      const isActive = (config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)) === deg;
                      return (
                        <button
                          key={deg}
                          type="button"
                          onClick={() =>
                            updateConfig({
                              rotation: deg,
                              orientation: deg === 90 || deg === 270 ? 'portrait' : 'landscape',
                            })
                          }
                          className={`flex-1 py-1 px-1.5 rounded-md text-center transition cursor-pointer text-[10px] font-bold ${
                            isActive
                              ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-extrabold'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Gira la posición del ticket para adaptarlo a cómo sale el papel en tu impresora térmica.
                  </p>
                </div>

                {/* Dimensiones personalizadas si elige "custom" */}
                {config.sizeId === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div>
                      <label htmlFor="custom-width-input" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Ancho Etiqueta (mm)
                      </label>
                      <input
                        id="custom-width-input"
                        type="number"
                        min={20}
                        max={210}
                        value={config.customWidthMm}
                        onChange={(e) => updateConfig({ customWidthMm: Math.max(20, parseInt(e.target.value, 10) || 20) })}
                        className="input-field text-xs font-mono w-full"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-height-input" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Alto Etiqueta (mm)
                      </label>
                      <input
                        id="custom-height-input"
                        type="number"
                        min={15}
                        max={297}
                        value={config.customHeightMm}
                        onChange={(e) => updateConfig({ customHeightMm: Math.max(15, parseInt(e.target.value, 10) || 15) })}
                        className="input-field text-xs font-mono w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sección 2: Contenido Visual y Jerarquía */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>2. Jerarquía Visual y Textos</span>
                  <span className="text-[10px] lowercase font-normal text-slate-400">(El precio es dominante)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="business-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre del Negocio (Encabezado)
                    </label>
                    <input
                      id="business-name-input"
                      type="text"
                      value={config.businessName}
                      onChange={(e) => updateConfig({ businessName: e.target.value })}
                      placeholder="Ej: Supermercado Mercato"
                      className="input-field text-xs w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="currency-symbol-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Moneda / Símbolo
                    </label>
                    <input
                      id="currency-symbol-input"
                      type="text"
                      value={config.currencySymbol}
                      onChange={(e) => updateConfig({ currencySymbol: e.target.value })}
                      placeholder="RD$"
                      className="input-field text-xs w-full font-bold"
                    />
                  </div>
                </div>

                {/* Toggles de Contenido */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/60 cursor-pointer text-xs select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.showPrice}
                      onChange={(e) => updateConfig({ showPrice: e.target.checked })}
                      className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Mostrar Precio</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/60 cursor-pointer text-xs select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.showName}
                      onChange={(e) => updateConfig({ showName: e.target.checked })}
                      className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Mostrar Nombre</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/60 cursor-pointer text-xs select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.showBarcodeText}
                      onChange={(e) => updateConfig({ showBarcodeText: e.target.checked })}
                      className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Texto Código</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/60 cursor-pointer text-xs select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={config.showSku}
                      onChange={(e) => updateConfig({ showSku: e.target.checked })}
                      className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Mostrar SKU</span>
                  </label>
                </div>
              </div>

              {/* Sección 3: Productos Seleccionados y Formatos Individuales */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    3. Productos ({products.length}) y Copias
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      products.forEach((p) => {
                        next[p.id] = (copies[p.id] || 1) + 1;
                      });
                      setCopies(next);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    +1 a todas
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {printableList.map(({ product: p, format: fmt, count, validation }) => {
                    const rawCode = p.barcode || p.sku || 'Sin Código';
                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border text-xs transition-colors ${
                          !validation.valid
                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : 'bg-card border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                              Código: <strong className="text-slate-700 dark:text-slate-300">{rawCode}</strong> · RD$ {Number(p.salePrice || 0).toFixed(2)}
                            </p>
                          </div>

                          {/* Control de Copias */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleCopiesChange(p.id, -1)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                              aria-label={`Reducir copias de ${p.name}`}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-8 text-center font-bold text-xs font-mono">{count}</span>
                            <button
                              type="button"
                              onClick={() => handleCopiesChange(p.id, 1)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                              aria-label={`Aumentar copias de ${p.name}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Selector de formato por producto y aviso de error */}
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-medium">Formato:</span>
                            <select
                              value={fmt}
                              onChange={(e) => handleProductFormatChange(p.id, e.target.value as BarcodeFormat)}
                              className="input-field text-[11px] py-0.5 px-1.5 h-6 rounded"
                            >
                              <option value="CODE128">Code 128</option>
                              <option value="EAN13">EAN-13</option>
                              <option value="EAN8">EAN-8</option>
                              <option value="UPCA">UPC-A</option>
                            </select>
                          </div>

                          {!validation.valid && (
                            <button
                              type="button"
                              onClick={() => handleProductFormatChange(p.id, 'CODE128')}
                              className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1"
                              title={validation.message}
                            >
                              <AlertTriangle size={11} /> Usar Code 128
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Previsualización a Escala Real */}
            <div className="lg:col-span-6 p-5 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
              {/* Barra de herramientas del Preview con Giro y Zoom Manual */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Vista Previa (
                    {(config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)) === 90 ||
                    (config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)) === 270
                      ? `${effectiveHeightMm} × ${effectiveWidthMm}`
                      : `${effectiveWidthMm} × ${effectiveHeightMm}`}{' '}
                    mm)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                    {(config.rotation ?? (config.orientation === 'portrait' ? 90 : 0))}°
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botón rápido para girar 90° */}
                  <button
                    type="button"
                    onClick={handleRotateNext}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer shadow-2xs"
                    title="Girar 90° en sentido horario"
                  >
                    <RotateCw size={13} />
                    <span>Girar</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                  {/* Control manual de Zoom */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Zoom:</span>
                    <button
                      type="button"
                      onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(2))))}
                      className="p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded cursor-pointer"
                      title="Reducir zoom"
                    >
                      <ZoomOut size={13} />
                    </button>

                    <input
                      type="range"
                      min={50}
                      max={180}
                      step={1}
                      value={Math.round(scale * 100)}
                      onChange={(e) => setScale(Number(e.target.value) / 100)}
                      className="w-14 sm:w-20 accent-primary cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                      title="Deslizador de zoom manual"
                      aria-label="Deslizador de zoom manual"
                    />

                    <div className="flex items-center">
                      <input
                        type="number"
                        min={40}
                        max={250}
                        step={1}
                        value={Math.round(scale * 100)}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v >= 40 && v <= 250) setScale(v / 100);
                        }}
                        className="w-10 text-center font-mono font-bold text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-0.5 py-0.5 tabular-nums focus:outline-none"
                        aria-label="Porcentaje de zoom"
                      />
                      <span className="text-[10px] text-slate-400 font-mono ml-0.5">%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScale((s) => Math.min(2.0, Number((s + 0.1).toFixed(2))))}
                      className="p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded cursor-pointer"
                      title="Aumentar zoom"
                    >
                      <ZoomIn size={13} />
                    </button>

                    {scale !== 1 && (
                      <button
                        type="button"
                        onClick={() => setScale(1)}
                        className="text-[10px] font-bold text-primary hover:underline ml-0.5 cursor-pointer"
                        title="Restablecer a escala 100%"
                      >
                        100%
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lienzo de visualización de etiquetas con scroll */}
              <div className="flex-1 overflow-auto rounded-xl p-4 bg-slate-200/60 dark:bg-slate-950/60 flex flex-wrap items-start justify-center gap-4 min-h-[300px] border border-slate-200/60 dark:border-slate-800/60">
                {printableList.slice(0, 6).map(({ product: p, format: fmt }, idx) => (
                  <div key={`preview-${p.id}-${fmt}-${idx}`} className="transition-transform duration-150">
                    <ProductLabel
                      product={p}
                      format={fmt}
                      size={selectedSize}
                      customWidthMm={config.customWidthMm}
                      customHeightMm={config.customHeightMm}
                      businessName={config.businessName}
                      currencySymbol={config.currencySymbol}
                      showName={config.showName}
                      showPrice={config.showPrice}
                      showSku={config.showSku}
                      showBarcodeText={config.showBarcodeText}
                      showBusinessName={config.showBusinessName}
                      orientation={config.orientation}
                      rotation={config.rotation ?? (config.orientation === 'portrait' ? 90 : 0)}
                      scale={scale}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Renderizado SVG con <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-600 dark:text-slate-300">crispEdges</code> para máxima nitidez en lectura con escáner físico.
              </div>
            </div>
          </div>

          {/* Footer con Acciones */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Formato: <strong className="text-slate-700 dark:text-slate-200">{selectedSize.name}</strong> · Total:{' '}
              <strong className="text-primary font-bold">{totalLabels} etiquetas</strong>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-3.5 py-2 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || products.length === 0}
                className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Generar y guardar archivo PDF con las etiquetas"
              >
                <Download size={15} />
                {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={products.length === 0}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                <Printer size={15} />
                Imprimir Etiquetas ({totalLabels})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hoja de impresión oculta en pantalla pero activa en window.print() */}
      {printSheetPortal}
    </>
  );
}

