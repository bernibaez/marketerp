import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import type { Product } from './ProductManagementScreen';
import { Package, Printer, Sparkles, Layers } from 'lucide-react';
import { generateUniqueBarcode } from '@/lib/barcodeUtils';
import { normalizePlu } from '@/lib/scaleBarcode';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import WeightProductForm, { type WeightFormState } from '@/components/weight/WeightProductForm';
import type { SaleType, WeightUnit } from '@/types/database';

import { useCategorias } from '@/hooks/useCategorias';
import { useMarcas } from '@/hooks/useMarcas';
import { useProveedores } from '@/hooks/useProveedores';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  allProducts?: Product[];
  onSave: (p: Product) => void;
  onPrintLabel?: (p: Product) => void;
  defaultIsScaleProduct?: boolean;
}

type FormValues = Omit<Product, 'id' | 'stockStatus'>;

const units = ['Unidad', 'Botella', 'Fardo', 'Cartón', 'Medio cartón', 'Libra', 'Kilogramo', 'Litro', 'Paquete', 'Caja', 'Bolsa'];
const taxOptions = [0, 18];


function FormField({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export default function ProductFormModal({ open, onClose, product, allProducts = [], onSave, onPrintLabel, defaultIsScaleProduct = false }: ProductFormModalProps) {
  const isEdit = !!product;

  const { categorias, crear: crearCatDirecto } = useCategorias();
  const { marcas, crear: crearMarcaDirecto } = useMarcas();
  const { proveedores, crear: crearProvDirecto } = useProveedores();

  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'supplier' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddExtra, setQuickAddExtra] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  const categoryOptions = React.useMemo(() => {
    const names = new Set(categorias.map((c) => c.nombre));
    if (product?.category && !names.has(product.category)) {
      return [product.category, ...Array.from(names)];
    }
    return Array.from(names);
  }, [categorias, product?.category]);

  const brandOptions = React.useMemo(() => {
    const names = new Set(marcas.map((m) => m.nombre));
    if (product?.brand && !names.has(product.brand)) {
      return [product.brand, ...Array.from(names)];
    }
    return Array.from(names);
  }, [marcas, product?.brand]);

  const supplierOptions = React.useMemo(() => {
    const names = new Set(proveedores.map((p) => p.nombre));
    if (product?.supplier && !names.has(product.supplier)) {
      return [product.supplier, ...Array.from(names)];
    }
    return Array.from(names);
  }, [proveedores, product?.supplier]);

  const [weightState, setWeightState] = useState<WeightFormState>({
    saleType: defaultIsScaleProduct ? 'weight' : 'unit',
    weightUnit: 'lb',
    pricePerWeight: 0,
    minWeight: 0.01,
    maxWeight: 999.99,
    allowDecimal: true,
    generateScaleBarcode: defaultIsScaleProduct,
  });

  const [isPresentation, setIsPresentation] = useState(false);
  const [baseProductId, setBaseProductId] = useState('');
  const [conversionFactor, setConversionFactor] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormValues>({
    defaultValues: {
      barcode: '',
      sku: '',
      name: '',
      category: product?.category || categoryOptions[0] || '',
      brand: product?.brand || brandOptions[0] || '',
      unit: defaultIsScaleProduct ? 'Libra' : 'Unidad',
      supplier: product?.supplier || supplierOptions[0] || '',
      costPrice: 0,
      salePrice: 0,
      wholesalePrice: 0,
      tax: 0,
      minStock: 10,
      currentStock: 0,
      image: '',
      expiryDate: null,
      warranty: 'N/A',
      status: 'active',
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        barcode: product.barcode,
        sku: product.sku,
        plu: product.plu || '',
        name: product.name,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        supplier: product.supplier,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        wholesalePrice: product.wholesalePrice,
        tax: product.tax,
        minStock: product.minStock,
        currentStock: product.currentStock,
        image: product.image,
        expiryDate: product.expiryDate,
        warranty: product.warranty,
        status: product.status,
      });
      setWeightState({
        saleType: product.saleType ?? (product.isWeightProduct ? 'weight' : 'unit'),
        weightUnit: product.weightUnit ?? 'lb',
        pricePerWeight: product.pricePerWeight ?? product.salePrice ?? 0,
        minWeight: product.minWeight ?? 0.01,
        maxWeight: product.maxWeight ?? 999.99,
        allowDecimal: product.allowDecimal ?? true,
        generateScaleBarcode: product.generateScaleBarcode ?? false,
      });
      setIsPresentation(Boolean(product.producto_base_id));
      setBaseProductId(product.producto_base_id || '');
      setConversionFactor(product.factor_conversion || 1);
    } else {
      reset({
        barcode: '',
        sku: '',
        plu: '',
        name: '',
        category: categoryOptions[0] || '',
        brand: brandOptions[0] || '',
        unit: defaultIsScaleProduct ? 'Libra' : 'Unidad',
        supplier: supplierOptions[0] || '',
        costPrice: 0,
        salePrice: 0,
        wholesalePrice: 0,
        tax: 0,
        minStock: 10,
        currentStock: 0,
        image: '',
        expiryDate: null,
        warranty: 'N/A',
        status: 'active',
      });
      setWeightState({
        saleType: defaultIsScaleProduct ? 'weight' : 'unit',
        weightUnit: 'lb',
        pricePerWeight: 0,
        minWeight: 0.01,
        maxWeight: 999.99,
        allowDecimal: true,
        generateScaleBarcode: defaultIsScaleProduct,
      });
      setIsPresentation(false);
      setBaseProductId('');
      setConversionFactor(1);
    }
  }, [product, reset, open, defaultIsScaleProduct]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickAddName.trim();
    if (!cleanName) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setQuickAddLoading(true);
    try {
      if (quickAddType === 'category') {
        const cat = await crearCatDirecto({ nombre: cleanName, descripcion: quickAddExtra.trim() || null });
        setValue('category', cat.nombre, { shouldValidate: true, shouldDirty: true });
        toast.success(`Categoría "${cat.nombre}" creada y seleccionada`);
      } else if (quickAddType === 'brand') {
        const brand = await crearMarcaDirecto({ nombre: cleanName, descripcion: quickAddExtra.trim() || null });
        setValue('brand', brand.nombre, { shouldValidate: true, shouldDirty: true });
        toast.success(`Marca "${brand.nombre}" creada y seleccionada`);
      } else if (quickAddType === 'supplier') {
        const sup = await crearProvDirecto({ nombre: cleanName, telefono: quickAddExtra.trim() || null });
        setValue('supplier', sup.nombre, { shouldValidate: true, shouldDirty: true });
        toast.success(`Proveedor "${sup.nombre}" creado y seleccionado`);
      }
      setQuickAddType(null);
      setQuickAddName('');
      setQuickAddExtra('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear elemento');
    } finally {
      setQuickAddLoading(false);
    }
  };


  const handleGenerateBarcode = () => {
    const code = generateUniqueBarcode();
    setValue('barcode', code, { shouldValidate: true, shouldDirty: true });
    toast.success(`Código de barras único generado: ${code}`);
  };

  const onSubmit = (data: FormValues) => {
    const cost = Number(data.costPrice);
    const sale = Number(data.salePrice);
    const stock = isEdit && product ? product.currentStock : Number(data.currentStock);
    const minStk = Number(data.minStock);

    const stockStatus: Product['stockStatus'] =
      stock === 0 ? 'out' : stock < minStk ? 'low' : 'normal';

    const isWeight = weightState.saleType === 'weight' || weightState.saleType === 'both';
    const isScaleProduct = weightState.generateScaleBarcode;
    const cleanPlu = normalizePlu((data.plu || '').trim()) || (data.plu || '').trim();

    const cleanBarcode = (data.barcode || '').trim();
    const cleanSku = (data.sku || '').trim();

    // Validation 1: Scale product must be configured for sale by weight
    if (isScaleProduct && !isWeight) {
      toast.error('Los productos de balanza deben configurarse para venta por peso.');
      return;
    }

    // Validation 2: Scale product requires PLU
    if (isScaleProduct && !cleanPlu) {
      toast.error('El PLU de balanza es obligatorio.');
      return;
    }

    // Validation 3: Unique PLU validation
    if (cleanPlu && allProducts && allProducts.length > 0) {
      const duplicate = allProducts.find(
        (p) =>
          p.id !== product?.id &&
          p.plu &&
          (normalizePlu(p.plu) || p.plu.trim()) === cleanPlu
      );
      if (duplicate) {
        toast.error(`El PLU "${cleanPlu}" ya está asignado a otro producto ("${duplicate.name}").`);
        return;
      }
    }

    // Validation 4: Unique Barcode validation
    if (cleanBarcode && allProducts && allProducts.length > 0) {
      const duplicate = allProducts.find(
        (p) => p.id !== product?.id && p.barcode && p.barcode.trim() === cleanBarcode
      );
      if (duplicate) {
        toast.error(`El Código de Barras "${cleanBarcode}" ya está asignado a otro producto ("${duplicate.name}").`);
        return;
      }
    }

    // Validation 5: Unique SKU validation
    if (cleanSku && allProducts && allProducts.length > 0) {
      const duplicate = allProducts.find(
        (p) => p.id !== product?.id && p.sku && p.sku.trim().toLowerCase() === cleanSku.toLowerCase()
      );
      if (duplicate) {
        toast.error(`El SKU "${cleanSku}" ya está asignado a otro producto ("${duplicate.name}").`);
        return;
      }
    }

    const saved: Product = {
      id: product?.id ?? `prod-${Date.now()}`,
      ...data,
      plu: cleanPlu || (product?.plu ?? ''),
      unit: isWeight ? (weightState.weightUnit === 'kg' ? 'Kilogramo' : weightState.weightUnit === 'lb' ? 'Libra' : data.unit) : data.unit,
      costPrice: cost,
      salePrice: sale,
      wholesalePrice: Number(data.wholesalePrice),
      tax: Number(data.tax),
      minStock: minStk,
      currentStock: isPresentation && baseProductId && selectedBaseProduct
        ? Math.floor(selectedBaseProduct.currentStock / conversionFactor)
        : stock,
      stockStatus,
      saleType: weightState.saleType,
      weightUnit: weightState.weightUnit,
      pricePerWeight: sale,
      minWeight: weightState.minWeight,
      maxWeight: weightState.maxWeight,
      allowDecimal: weightState.allowDecimal,
      generateScaleBarcode: weightState.generateScaleBarcode,
      isWeightProduct: isWeight,
      producto_base_id: isPresentation && baseProductId ? baseProductId : null,
      factor_conversion: isPresentation && baseProductId ? Math.max(1, Number(conversionFactor) || 1) : 1,
    };

    // System Audit Event
    if (isEdit && product) {
      const priceChanged = product.salePrice !== sale;
      logAuditEvent({
        user: 'Admin General',
        role: 'Administrador',
        action: priceChanged ? 'Cambio de precio' : 'Edición de producto',
        module: 'Gestión de Productos',
        details: priceChanged
          ? `Precio cambiado para "${saved.name}" de RD$ ${product.salePrice} a RD$ ${sale}`
          : `Producto "${saved.name}" actualizado`,
        before: { name: product.name, salePrice: product.salePrice, costPrice: product.costPrice },
        after: { name: saved.name, salePrice: saved.salePrice, costPrice: saved.costPrice },
      });
    } else {
      logAuditEvent({
        user: 'Admin General',
        role: 'Administrador',
        action: 'Edición de producto',
        module: 'Gestión de Productos',
        details: `Nuevo producto creado: "${saved.name}" (SKU: ${saved.sku})`,
        after: { name: saved.name, sku: saved.sku, salePrice: saved.salePrice },
      });
    }

    onSave(saved);
  };

  const costPrice = watch('costPrice');
  const salePrice = watch('salePrice');
  const selectedUnit = watch('unit') || product?.unit || 'Unidad';
  const isPresentationUnit = ['Fardo', 'Cartón', 'Caja', 'Paquete', 'Bolsa'].includes(selectedUnit);

  const selectedBaseProduct = React.useMemo(() => {
    if (!baseProductId) return null;
    return allProducts.find((p) => p.id === baseProductId) || null;
  }, [baseProductId, allProducts]);

  const handleUnitSelection = (val: string) => {
    setValue('unit', val, { shouldValidate: true, shouldDirty: true });
    const isPreset = ['Fardo', 'Cartón', 'Caja', 'Paquete', 'Bolsa'].includes(val);
    if (isPreset) {
      setIsPresentation(true);
      if (val === 'Fardo' && (!conversionFactor || conversionFactor <= 1)) setConversionFactor(20);
      else if (val === 'Cartón' && (!conversionFactor || conversionFactor <= 1)) setConversionFactor(2);
      else if (val === 'Caja' && (!conversionFactor || conversionFactor <= 1)) setConversionFactor(12);
      else if (val === 'Paquete' && (!conversionFactor || conversionFactor <= 1)) setConversionFactor(6);
      else if (val === 'Bolsa' && (!conversionFactor || conversionFactor <= 1)) setConversionFactor(10);
    }
  };

  const margin = costPrice && salePrice && Number(costPrice) > 0
    ? (((Number(salePrice) - Number(costPrice)) / Number(salePrice)) * 100).toFixed(1)
    : '0.0';

  const isWeighted = weightState.saleType === 'weight' || weightState.saleType === 'both';
  const weightUnitShort = weightState.weightUnit ? weightState.weightUnit.toUpperCase() : 'LB';

  if (!open) return null;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEdit ? `Editar: ${product?.name}` : 'Nuevo Producto'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? `SKU: ${product?.sku}` : 'Completa todos los campos requeridos'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
          ← Volver a Productos
        </button>
      </div>

      <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="card p-5 sm:p-6 space-y-6">
        {/* Basic Info */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Información Básica</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nombre del Producto" name="name" error={errors.name?.message} required>
              <input
                id="name"
                {...register('name', { required: 'El nombre es obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
                className="input-field"
                placeholder="Ej: Arroz Selecto 5lb"
              />
            </FormField>

            <FormField label="SKU" name="sku" error={errors.sku?.message} required hint="Código único interno del producto">
              <input
                id="sku"
                {...register('sku', { required: 'El SKU es obligatorio' })}
                className="input-field font-mono"
                placeholder="Ej: ARR-SEL-5LB"
              />
            </FormField>

            <FormField label="PLU (Balanza)" name="plu" error={errors.plu?.message} hint="Código de balanza conservando ceros (ej. 00132)">
              <input
                id="plu"
                {...register('plu')}
                className="input-field font-mono"
                placeholder="Ej: 00132"
              />
            </FormField>

            <FormField label="Código de Barras" name="barcode" error={errors.barcode?.message} hint="EAN-13, Code-128 o auto-generado">
              <div className="flex gap-2">
                <input
                  id="barcode"
                  {...register('barcode')}
                  className="input-field font-mono flex-1"
                  placeholder="Ej: 7891000100103"
                />
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="btn-secondary text-xs flex items-center gap-1 px-3 whitespace-nowrap"
                  title="Generar código de barras único automáticamente"
                >
                  <Sparkles size={14} className="text-primary" /> Generar Código
                </button>
              </div>
            </FormField>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category" className="block text-sm font-semibold text-foreground">
                  Categoría <span className="text-danger ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('category');
                    setQuickAddName('');
                    setQuickAddExtra('');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  + Nueva
                </button>
              </div>
              <select id="category" {...register('category', { required: true })} className="input-field">
                {categoryOptions.length === 0 ? (
                  <option value="">(Sin categorías)</option>
                ) : (
                  categoryOptions.map((c) => (
                    <option key={`cat-opt-${c}`} value={c}>{c}</option>
                  ))
                )}
              </select>
              {errors.category && <p className="text-sm text-danger">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="brand" className="block text-sm font-semibold text-foreground">
                  Marca <span className="text-danger ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('brand');
                    setQuickAddName('');
                    setQuickAddExtra('');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  + Nueva
                </button>
              </div>
              <select id="brand" {...register('brand', { required: true })} className="input-field">
                {brandOptions.length === 0 ? (
                  <option value="">(Sin marcas)</option>
                ) : (
                  brandOptions.map((b) => (
                    <option key={`brand-opt-${b}`} value={b}>{b}</option>
                  ))
                )}
              </select>
              {errors.brand && <p className="text-sm text-danger">{errors.brand.message}</p>}
            </div>

            <FormField label="Unidad de Medida" name="unit" error={errors.unit?.message} required>
              <select
                id="unit"
                {...register('unit', { required: true })}
                className="input-field"
                onChange={(e) => {
                  register('unit').onChange(e);
                  handleUnitSelection(e.target.value);
                }}
              >
                {units.map((u) => (
                  <option key={`unit-opt-${u}`} value={u}>{u}</option>
                ))}
              </select>
            </FormField>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="supplier" className="block text-sm font-semibold text-foreground">
                  Proveedor Registrado <span className="text-danger ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('supplier');
                    setQuickAddName('');
                    setQuickAddExtra('');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  + Nuevo
                </button>
              </div>
              <select id="supplier" {...register('supplier', { required: true })} className="input-field">
                {supplierOptions.length === 0 ? (
                  <option value="">(No hay proveedores registrados)</option>
                ) : (
                  supplierOptions.map((s) => (
                    <option key={`sup-opt-${s}`} value={s}>{s}</option>
                  ))
                )}
              </select>
              {errors.supplier && <p className="text-sm text-danger">{errors.supplier.message}</p>}
            </div>

            <FormField label="Estado" name="status" error={errors.status?.message} required>
              <select id="status" {...register('status', { required: true })} className="input-field">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="discontinued">Descontinuado</option>
              </select>
            </FormField>

            {/* Configuración contextual de Presentación al seleccionar Fardo, Cartón, etc. */}
            {(isPresentationUnit || isPresentation) && (
              <div className="sm:col-span-2 bg-primary/5 dark:bg-primary/10 border border-primary/25 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Layers size={14} className="text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Presentación comercial: {selectedUnit}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Vincula este {selectedUnit.toLowerCase()} al producto base para compartir inventario automáticamente.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground select-none bg-background px-2.5 py-1 rounded-md border border-border">
                    <input
                      type="checkbox"
                      checked={isPresentation}
                      onChange={(e) => setIsPresentation(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Vincular a producto base</span>
                  </label>
                </div>

                {isPresentation && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-primary/15">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Producto Base del que depende *
                      </label>
                      <select
                        className="input-field text-xs w-full"
                        value={baseProductId}
                        onChange={(e) => setBaseProductId(e.target.value)}
                      >
                        <option value="">Selecciona el producto base (ej. Botella de Agua, Medio Cartón)...</option>
                        {allProducts
                          .filter((p) => p.id !== product?.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.currentStock} {p.unit}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Unidades base por cada {selectedUnit} * (Factor de conversión)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        className="input-field text-xs w-full font-mono"
                        placeholder={`Ej: ${selectedUnit === 'Fardo' ? '20' : selectedUnit === 'Cartón' ? '2' : '12'}`}
                        value={conversionFactor}
                        onChange={(e) => setConversionFactor(Math.max(1, Number(e.target.value)))}
                      />
                    </div>

                    {selectedBaseProduct ? (
                      <div className="sm:col-span-2 text-xs bg-background p-2.5 rounded-lg border border-primary/20 text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          💡 Al vender 1 <strong>{selectedUnit}</strong> se descontarán <strong>{conversionFactor} {selectedBaseProduct.unit}</strong> de <strong>{selectedBaseProduct.name}</strong>.
                        </span>
                        <span className="font-bold text-primary whitespace-nowrap bg-primary/10 px-2 py-0.5 rounded">
                          Stock disponible: ~{Math.floor(selectedBaseProduct.currentStock / conversionFactor)} {selectedUnit}s
                        </span>
                      </div>
                    ) : (
                      <div className="sm:col-span-2 text-xs text-muted-foreground italic">
                        Selecciona el producto base para calcular existencias automáticamente.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Section: Tipo de Venta (Peso / Unidad) */}
        <WeightProductForm
          values={weightState}
          onChange={(updates) => setWeightState((prev) => ({ ...prev, ...updates }))}
          baseSalePrice={Number(salePrice || 0)}
        />

        <div className="border-t border-border" />

        {/* Pricing */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success-bg flex items-center justify-center">
                <span className="text-success text-xs font-bold">$</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Precios e Impuestos</h3>
            </div>
            {Number(costPrice) > 0 && Number(salePrice) > 0 && (
              <div className="flex items-center gap-1.5 bg-success-bg px-2.5 py-1 rounded-lg">
                <span className="text-xs text-muted-foreground">Margen:</span>
                <span className="text-xs font-bold text-success tabular-nums">{margin}%</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={isWeighted ? `Precio de Compra por ${weightUnitShort} (RD$)` : "Precio de Compra (RD$)"} name="costPrice" error={errors.costPrice?.message} required>
              <input
                id="costPrice"
                type="number"
                step="0.01"
                min={0}
                {...register('costPrice', {
                  required: 'El precio de compra es obligatorio',
                  min: { value: 0, message: 'Debe ser mayor o igual a 0' },
                })}
                className="input-field tabular-nums"
                placeholder="0.00"
              />
            </FormField>

            <FormField label={isWeighted ? `Precio de Venta por ${weightUnitShort} (RD$)` : "Precio de Venta (RD$)"} name="salePrice" error={errors.salePrice?.message} required>
              <input
                id="salePrice"
                type="number"
                step="0.01"
                min={0}
                {...register('salePrice', {
                  required: 'El precio de venta es obligatorio',
                  min: { value: 0, message: 'Debe ser mayor o igual a 0' },
                })}
                className="input-field tabular-nums"
                placeholder="0.00"
              />
            </FormField>

            <FormField
              label={isWeighted ? `Precio Mayorista por ${weightUnitShort} (RD$)` : "Precio Mayorista (RD$)"}
              name="wholesalePrice"
              error={errors.wholesalePrice?.message}
              hint={isWeighted ? `Precio por ${weightUnitShort} para compras al por mayor` : "Precio para compras al por mayor"}
            >
              <input
                id="wholesalePrice"
                type="number"
                step="0.01"
                min={0}
                {...register('wholesalePrice', {
                  min: { value: 0, message: 'Debe ser mayor o igual a 0' },
                })}
                className="input-field tabular-nums"
                placeholder="0.00"
              />
            </FormField>

            <FormField label="ITBIS (%)" name="tax" error={errors.tax?.message} hint="Impuesto sobre Transferencia de Bienes Industrializados">
              <select id="tax" {...register('tax')} className="input-field">
                {taxOptions.map((t) => (
                  <option key={`tax-opt-${t}`} value={t}>{t === 0 ? 'Exento (0%)' : `${t}%`}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Inventory */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-info-bg flex items-center justify-center">
              <Package size={14} className="text-info" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Inventario y Vencimiento</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label={isWeighted ? `Stock Actual (${weightUnitShort})` : "Stock Actual"}
              name="currentStock"
              error={errors.currentStock?.message}
              required={!isEdit && !(isPresentation && baseProductId)}
              hint={
                isPresentation && selectedBaseProduct
                  ? `Calculado dinámicamente desde ${selectedBaseProduct.name} (~${Math.floor(selectedBaseProduct.currentStock / conversionFactor)} ${selectedUnit}s disponibles)`
                  : isEdit
                  ? 'No editable aquí — usa Ajustes de Stock para cambiar existencias'
                  : (isWeighted ? `Cantidad de ${weightUnitShort} actualmente en inventario` : 'Cantidad actual en inventario')
              }
            >
              <input
                id="currentStock"
                type="number"
                min={0}
                disabled={isEdit || (isPresentation && !!baseProductId)}
                value={isPresentation && selectedBaseProduct ? Math.floor(selectedBaseProduct.currentStock / conversionFactor) : undefined}
                {...register('currentStock', {
                  required: isEdit || (isPresentation && baseProductId) ? false : 'El stock actual es obligatorio',
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
                className={`input-field tabular-nums ${(isEdit || (isPresentation && baseProductId)) ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="0"
              />
            </FormField>

            <FormField
              label={isWeighted ? `Stock Mínimo (${weightUnitShort})` : "Stock Mínimo"}
              name="minStock"
              error={errors.minStock?.message}
              required
              hint={isWeighted ? `Alerta cuando las ${weightUnitShort} bajen de este nivel` : "Alerta cuando el stock baje de este nivel"}
            >
              <input
                id="minStock"
                type="number"
                min={0}
                {...register('minStock', {
                  required: 'El stock mínimo es obligatorio',
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
                className="input-field tabular-nums"
                placeholder="10"
              />
            </FormField>

            <FormField
              label="Fecha de Vencimiento"
              name="expiryDate"
              error={errors.expiryDate?.message}
              hint="Dejar vacío si el producto no tiene vencimiento"
            >
              <input
                id="expiryDate"
                type="date"
                {...register('expiryDate')}
                className="input-field"
              />
            </FormField>

            <FormField
              label="Garantía"
              name="warranty"
              error={errors.warranty?.message}
              hint="Período de garantía del producto"
            >
              <input
                id="warranty"
                {...register('warranty')}
                className="input-field"
                placeholder="Ej: 6 meses, 1 año, N/A"
              />
            </FormField>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            {isEdit && product && onPrintLabel && (
              <button
                type="button"
                onClick={() => onPrintLabel(product)}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
              >
                <Printer size={14} /> Imprimir Etiqueta
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Los campos con <span className="text-danger">*</span> son obligatorios
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex items-center gap-2 min-w-28 justify-center"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>{isEdit ? 'Guardar Cambios' : 'Crear Producto'}</>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Mini Modal de Registro Rápido */}
      {quickAddType && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-sm font-bold text-foreground">
                {quickAddType === 'category'
                  ? 'Nueva Categoría Rápida'
                  : quickAddType === 'brand'
                  ? 'Nueva Marca Rápida'
                  : 'Nuevo Proveedor Rápido'}
              </h4>
              <button
                type="button"
                onClick={() => setQuickAddType(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    quickAddType === 'category'
                      ? 'Ej. Enlatados'
                      : quickAddType === 'brand'
                      ? 'Ej. Induveca'
                      : 'Ej. Distribuidora Central'
                  }
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="input-field text-xs !h-9"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  {quickAddType === 'supplier' ? 'Teléfono (Opcional)' : 'Descripción (Opcional)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    quickAddType === 'supplier'
                      ? 'Ej. 809-555-0123'
                      : 'Breve detalle...'
                  }
                  value={quickAddExtra}
                  onChange={(e) => setQuickAddExtra(e.target.value)}
                  className="input-field text-xs !h-9"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddType(null)}
                  className="btn-secondary !h-8 text-xs px-3"
                  disabled={quickAddLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary !h-8 text-xs px-4 font-bold"
                  disabled={quickAddLoading}
                >
                  {quickAddLoading ? 'Guardando...' : 'Guardar y Seleccionar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}