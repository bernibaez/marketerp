import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Barcode } from 'lucide-react';
import type { Product } from './ProductManagementScreen';
import { generateBarcodeBars } from '@/lib/barcodeUtils';
import { toast } from '@/lib/toast';

interface PriceLabelModalProps {
  products: Product[];
  onClose: () => void;
}

function LabelBarcode({ code }: { code: string }) {
  const bars = useMemo(() => generateBarcodeBars(code), [code]);
  let x = 0;
  const rects = bars.map((bar) => {
    const width = bar.width * 1.4;
    const el = {
      key: bar.key,
      x,
      width,
      isBar: !(bar.key.includes('space') || bar.key.startsWith('s-') || bar.key.includes('start-space')),
    };
    x += width;
    return el;
  });
  const viewW = Math.max(x, 80);

  return (
    <svg
      className="h-8 w-full max-w-[180px] mx-auto block"
      viewBox={`0 0 ${viewW} 28`}
      preserveAspectRatio="none"
    >
      {rects.map((r) =>
        r.isBar ? (
          <rect key={r.key} x={r.x} y={0} width={Math.max(r.width, 0.8)} height={26} fill="#000" />
        ) : null
      )}
    </svg>
  );
}

function ProductLabel({
  product,
  businessName,
  widthClass,
}: {
  product: Product;
  businessName: string;
  widthClass: string;
}) {
  const code = product.barcode || product.sku || product.id;
  return (
    <div
      className={`bg-white text-black p-2.5 text-center font-sans border border-black break-inside-avoid ${widthClass}`}
      style={{ color: '#000', background: '#fff' }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: '#333' }}>
        {businessName}
      </p>
      <p className="text-[11px] font-black leading-tight mt-0.5 line-clamp-2" style={{ color: '#000' }}>
        {product.name}
      </p>
      <p className="text-lg font-extrabold tracking-tight my-1" style={{ color: '#000' }}>
        RD${' '}
        {Number(product.salePrice || 0).toLocaleString('es-DO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      <LabelBarcode code={code} />
      <p className="text-[10px] font-mono font-bold tracking-widest mt-0.5" style={{ color: '#111' }}>
        {code}
      </p>
      <p className="text-[8px] font-mono" style={{ color: '#555' }}>
        SKU: {product.sku || '—'}
      </p>
    </div>
  );
}

export default function PriceLabelModal({ products, onClose }: PriceLabelModalProps) {
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      initial[p.id] = 1;
    });
    return initial;
  });

  const [businessName, setBusinessName] = useState('Mi Colmado / Supermercado ERP');
  const [printerFormat, setPrinterFormat] = useState<'thermal-58' | 'thermal-80' | 'sticker-grid'>(
    'thermal-58'
  );

  const selectedList = products.map((p) => ({
    product: p,
    count: copies[p.id] || 1,
  }));

  const totalLabels = selectedList.reduce((s, item) => s + item.count, 0);

  const previewWidth =
    printerFormat === 'thermal-58' ? 'w-[200px]' : printerFormat === 'thermal-80' ? 'w-[280px]' : 'w-[220px]';

  const printWidth =
    printerFormat === 'thermal-58'
      ? 'w-[52mm]'
      : printerFormat === 'thermal-80'
        ? 'w-[72mm]'
        : 'w-[60mm]';

  const handlePrint = () => {
    if (products.length === 0) {
      toast.error('No hay productos para imprimir');
      return;
    }
    toast.success(`Imprimiendo ${totalLabels} etiqueta(s)…`);
    window.setTimeout(() => window.print(), 100);
  };

  const printSheet =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className={`printable-area label-print-sheet ${
              printerFormat === 'sticker-grid' ? 'label-print-grid' : ''
            }`}
            aria-hidden
          >
            {selectedList.flatMap(({ product: p, count }) =>
              Array.from({ length: count }).map((_, idx) => (
                <div key={`print-${p.id}-${idx}`} className="label-print-item mb-3">
                  <ProductLabel product={p} businessName={businessName} widthClass={printWidth} />
                </div>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  const dialogContent = (
    <div
      className="dialog-inline-host print:p-0 print:bg-white print:static"
      onClick={onClose}
    >
        <div
          className="card w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Barcode size={20} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">
                  Imprimir Etiquetas de Precios y Códigos de Barras
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configura el formato térmico y la cantidad de etiquetas
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/30 rounded-xl p-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Nombre del Negocio
              </label>
              <input
                className="input-field text-xs font-semibold"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Formato de Impresora
              </label>
              <select
                className="input-field text-xs"
                value={printerFormat}
                onChange={(e) => setPrinterFormat(e.target.value as typeof printerFormat)}
              >
                <option value="thermal-58">Térmica 58mm (Rollo Continuo)</option>
                <option value="thermal-80">Térmica 80mm (Rollo Ancho)</option>
                <option value="sticker-grid">Hoja Adhesiva (Rejilla / Grid)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Productos Seleccionados ({products.length})
            </p>
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border border-border rounded-lg p-2 bg-card text-xs"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-muted-foreground font-mono">
                      SKU: {p.sku} · Barcode: {p.barcode || 'Sin Código'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Copias:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="input-field w-16 text-center font-bold"
                      value={copies[p.id] ?? 1}
                      onChange={(e) =>
                        setCopies((prev) => ({
                          ...prev,
                          [p.id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Previsualización ({printerFormat})
            </p>
            <div className="bg-muted/40 p-6 rounded-xl flex flex-wrap items-start justify-center gap-4 overflow-x-auto min-h-[160px]">
              {products.slice(0, 3).map((p) => (
                <ProductLabel
                  key={`preview-${p.id}`}
                  product={p}
                  businessName={businessName}
                  widthClass={previewWidth}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="button" onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer size={16} />
              Imprimir Etiquetas ({totalLabels})
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(dialogContent, document.body) : dialogContent}
      {printSheet}
    </>
  );
}
