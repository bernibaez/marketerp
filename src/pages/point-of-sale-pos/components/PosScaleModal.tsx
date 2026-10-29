import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Barcode, Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import type { CartItem } from './POSTerminal';
import { parseScaleBarcode, type ScaleProduct } from '../utils/scaleUtils';
import { useProductos } from '@/hooks/useProductos';
import { initialProducts } from '@/lib/initialProducts';
import { buscarProductoPorCodigoEscaneado, productoAUi } from '@/services/productos.service';
import { decodeVariableWeightBarcode } from '@/lib/scaleBarcode';

interface Props {
  onClose: () => void;
  onConfirm: (item: Omit<CartItem, 'qty' | 'discount'>, qty: number) => void;
  initialProductId?: string;
  initialWeight?: number;
  initialProduct?: any;
}

export default function PosScaleModal({
  onClose,
  onConfirm,
  initialProductId,
  initialWeight,
  initialProduct,
}: Props) {
  const { productosUi } = useProductos({ pagina: 1, limite: 1000, estado: 'todos' });
  const [extraProducts, setExtraProducts] = useState<ScaleProduct[]>([]);

  const normalizedInitialProduct: ScaleProduct | null = useMemo(() => {
    if (!initialProduct) return null;
    const pid = initialProduct.productId || initialProduct.id;
    if (!pid) return null;
    const unitPrice = Number(
      initialProduct.price ??
        initialProduct.salePrice ??
        initialProduct.pricePerWeight ??
        0
    );
    const resolvedUnit =
      initialProduct.unit && !['unidad', 'ud', 'und', 'unidades'].includes(initialProduct.unit.toLowerCase())
        ? initialProduct.unit
        : initialProduct.weightUnit || 'lb';
    return {
      productId: String(pid),
      name: initialProduct.name || 'Producto sin nombre',
      sku: initialProduct.sku || '',
      plu: initialProduct.plu || '',
      price: unitPrice,
      wholesalePrice: initialProduct.wholesalePrice ? Number(initialProduct.wholesalePrice) : undefined,
      cost: Number(initialProduct.cost ?? initialProduct.costPrice ?? 0),
      tax: Number(initialProduct.tax ?? 0),
      unit: resolvedUnit,
      barcode: initialProduct.barcode || '',
      category: initialProduct.category || '',
      image: initialProduct.image || '',
      isWeightProduct: true,
    };
  }, [initialProduct]);

  const catalogProducts: ScaleProduct[] = useMemo(() => {
    const combinedRaw = [...(Array.isArray(productosUi) ? productosUi : [])];
    const seenSkus = new Set(combinedRaw.map((p) => (p.sku || '').toLowerCase()));
    for (const ip of initialProducts) {
      if (!seenSkus.has((ip.sku || '').toLowerCase())) {
        combinedRaw.push(ip as any);
      }
    }

    const filtered = combinedRaw.filter(
      (p) =>
        p.isWeightProduct ||
        p.saleType === 'weight' ||
        p.saleType === 'both' ||
        (typeof p.unit === 'string' &&
          (p.unit.toLowerCase().includes('lb') || p.unit.toLowerCase().includes('kg')))
    );

    const listToUse = filtered;

    const mapped: ScaleProduct[] = listToUse.map((p) => {
      const unitPrice = Number(
        p.salePrice && p.salePrice > 0
          ? p.salePrice
          : p.pricePerWeight && p.pricePerWeight > 0
            ? p.pricePerWeight
            : (p as any).price ?? 0
      );
      return {
        productId: p.id,
        name: p.name || 'Producto sin nombre',
        sku: p.sku || '',
        plu: p.plu || '',
        price: unitPrice,
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
        cost: Number(p.costPrice ?? (p as any).cost ?? 0),
        tax: Number(p.tax ?? 0),
        unit:
          p.unit && !['unidad', 'ud', 'und', 'unidades'].includes(p.unit.toLowerCase())
            ? p.unit
            : p.weightUnit || 'lb',
        barcode: p.barcode || '',
        category: p.category || '',
        image: p.image,
        isWeightProduct: true,
      };
    });

    const result: ScaleProduct[] = [];
    const seenIds = new Set<string>();

    if (normalizedInitialProduct) {
      result.push(normalizedInitialProduct);
      seenIds.add(normalizedInitialProduct.productId);
    }

    for (const ep of extraProducts) {
      if (!seenIds.has(ep.productId)) {
        result.push(ep);
        seenIds.add(ep.productId);
      }
    }

    for (const mp of mapped) {
      if (!seenIds.has(mp.productId)) {
        result.push(mp);
        seenIds.add(mp.productId);
      }
    }

    return result;
  }, [productosUi, normalizedInitialProduct, extraProducts]);

  const targetInitialId = normalizedInitialProduct?.productId || initialProductId || '';

  const [selected, setSelected] = useState<string>(() => {
    if (targetInitialId) return targetInitialId;
    return catalogProducts[0]?.productId || '';
  });

  const [weight, setWeight] = useState<string>(
    initialWeight !== undefined && initialWeight > 0 ? String(initialWeight) : '1'
  );
  const [scanCode, setScanCode] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Actualizar producto seleccionado solo cuando cambia el producto inicial solicitado
  useEffect(() => {
    if (targetInitialId) {
      setSelected(targetInitialId);
    }
  }, [targetInitialId]);

  // Si no había selección inicial y el catálogo termina de cargar, seleccionar el primero disponible
  useEffect(() => {
    if (!selected && catalogProducts.length > 0) {
      setSelected(targetInitialId || catalogProducts[0].productId);
    }
  }, [catalogProducts, selected, targetInitialId]);

  useEffect(() => {
    if (initialWeight !== undefined && initialWeight > 0) {
      setWeight(String(initialWeight));
    }
  }, [initialWeight]);

  useEffect(() => {
    const timer = setTimeout(() => {
      weightInputRef.current?.focus();
      weightInputRef.current?.select();
    }, 80);
    return () => clearTimeout(timer);
  }, [selected]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  const product =
    catalogProducts.find((p) => p.productId === selected) ||
    normalizedInitialProduct ||
    catalogProducts[0];
  const parsedWeight = parseFloat(String(weight).replace(',', '.'));
  const qty = Number.isFinite(parsedWeight) && parsedWeight > 0 ? Math.round(parsedWeight * 1000) / 1000 : 0;
  const unitPrice = Number(product?.price || 0);
  const lineTotal = product ? Math.round(qty * unitPrice * 100) / 100 : 0;

  const handleScanKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = scanCode.trim();
    if (!code) return;

    const parsed = parseScaleBarcode(code, catalogProducts);
    if (parsed) {
      setSelected(parsed.product.productId);
      setWeight(parsed.weight.toFixed(3));
      setScanCode('');
      toast.success(`Detectado: ${parsed.product.name} (${parsed.weight.toFixed(3)} ${parsed.product.unit})`);
      weightInputRef.current?.focus();
      weightInputRef.current?.select();
      return;
    }

    try {
      const fromDb = await buscarProductoPorCodigoEscaneado(code);
      if (fromDb) {
        const ui = productoAUi(fromDb);
        const decoded = decodeVariableWeightBarcode(code);
        const dbScaleProd: ScaleProduct = {
          productId: ui.id,
          name: ui.name,
          sku: ui.sku || '',
          plu: ui.plu || '',
          price: ui.salePrice > 0 ? ui.salePrice : (ui.pricePerWeight ?? 0),
          wholesalePrice: ui.wholesalePrice ? Number(ui.wholesalePrice) : undefined,
          cost: ui.costPrice ?? 0,
          tax: ui.tax ?? 0,
          unit:
            ui.unit && !['unidad', 'ud', 'und', 'unidades'].includes(ui.unit.toLowerCase())
              ? ui.unit
              : ui.weightUnit || 'lb',
          barcode: ui.barcode || '',
          category: ui.category || '',
          image: ui.image,
          isWeightProduct: true,
        };
        setExtraProducts((prev) => [
          dbScaleProd,
          ...prev.filter((p) => p.productId !== dbScaleProd.productId),
        ]);
        setSelected(dbScaleProd.productId);
        const w = decoded.isVariableWeight && decoded.weight > 0 ? decoded.weight : 1;
        setWeight(w.toFixed(3));
        setScanCode('');
        toast.success(`Detectado: ${dbScaleProd.name} (${w.toFixed(3)} ${dbScaleProd.unit})`);
        weightInputRef.current?.focus();
        weightInputRef.current?.select();
        return;
      }
    } catch {
      // ignore
    }

    toast.error('Código de pesados no reconocido');
  };

  const confirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!product) {
      toast.error('No hay producto seleccionado');
      return;
    }
    if (qty <= 0) {
      toast.error('Ingresa un peso mayor a cero');
      return;
    }

    const foundProd = (productosUi as any[])?.find((p) => p.id === product.productId);
    if (foundProd) {
      if (foundProd.status === 'inactive' || foundProd.status === 'discontinued') {
        toast.error(`El producto "${product.name}" está inactivo y no se puede vender`);
        return;
      }
      if (foundProd.currentStock <= 0 || foundProd.stockStatus === 'out') {
        toast.error(`Producto sin existencias: "${product.name}"`);
        return;
      }
    }

    const resolvedUnit =
      product.unit && !['unidad', 'ud', 'und', 'unidades'].includes(product.unit.toLowerCase())
        ? product.unit
        : 'lb';

    onConfirm(
      {
        id: `cart-scale-${product.productId}-${Date.now()}`,
        productId: product.productId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        regularPrice: product.price,
        wholesalePrice: product.wholesalePrice,
        isWholesale: false,
        cost: product.cost,
        tax: product.tax,
        image: product.image || '',
        unit: resolvedUnit,
        isWeighted: true,
      },
      qty
    );
    toast.success(`Agregado: ${qty.toFixed(3)} ${resolvedUnit} de ${product.name}`);
  };

  return (
    <div
      className="dialog-inline-host"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-lg leading-tight">
                Producto Pesado (Balanza)
              </h3>
              <p className="text-xs text-slate-400 font-medium">Balanza electrónica o peso manual</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {catalogProducts.length === 0 ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto">
              <AlertCircle size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                No hay productos en el catálogo
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Registra productos en el inventario para poder pesarlos y venderlos.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              Cerrar (Esc)
            </button>
          </div>
        ) : !product ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-xs text-slate-400">Cargando datos del producto...</p>
          </div>
        ) : (
          <>
            {/* Quick Barcode Scanner inside modal */}
            <div className="relative">
              <Barcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Escanear etiqueta de balanza EAN-13 o SKU..."
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={handleScanKey}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 h-11 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <form onSubmit={confirm} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Producto Seleccionado
                </label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 h-12 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {catalogProducts.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.name} — RD$ {p.price} / {p.unit} {p.sku ? `(SKU: ${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Peso o Cantidad ({product.unit})
                  </label>
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    Precio: RD$ {unitPrice.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {product.unit}
                  </span>
                </div>
                <div className="relative">
                  <input
                    ref={weightInputRef}
                    className="w-full text-center text-3xl font-black tabular-nums h-16 rounded-2xl border-2 border-emerald-500/40 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all focus:outline-none"
                    type="number"
                    min={0.001}
                    step="any"
                    value={weight}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 pointer-events-none">
                    {product.unit}
                  </span>
                </div>
              </div>

              {/* Subtotal calculated */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex justify-between items-center text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">
                    Subtotal Producto
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {qty} {product.unit} × RD$ {unitPrice.toFixed(2)}
                  </span>
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  RD$ {lineTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  onClick={onClose}
                >
                  Cancelar (Esc)
                </button>
                <button
                  type="submit"
                  disabled={qty <= 0}
                  className="flex-1 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>Agregar Al Carrito (Enter)</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
