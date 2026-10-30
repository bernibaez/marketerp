import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import type { Product } from './ProductManagementScreen';
import { Package, Printer, Sparkles, Layers, Search, X, Loader2 } from 'lucide-react';
import { generateUniqueBarcode, generateUniqueSku, generatePresentationSku } from '@/lib/barcodeUtils';
import { normalizePlu } from '@/lib/scaleBarcode';
import { logAuditEvent } from '@/lib/auditStore';
import { toast } from '@/lib/toast';
import WeightProductForm, { type WeightFormState } from '@/components/weight/WeightProductForm';
import type { SaleType, WeightUnit } from '@/types/database';
import { buscarProductosParaVinculacion, obtenerProductoPorId, productoAUi } from '@/services/productos.service';

import { useCategorias } from '@/hooks/useCategorias';
import { useMarcas } from '@/hooks/useMarcas';
import { useProveedores } from '@/hooks/useProveedores';
import { useUnidadesMedida } from '@/hooks/useUnidadesMedida';
import type { TipoUnidadMedida } from '@/services/unidadesMedida.service';

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

/** Unidades que representan un empaque que contiene varias unidades de otro producto. */
const PACK_UNITS = ['Fardo', 'Cartón', 'Medio cartón', 'Caja', 'Paquete', 'Bolsa', 'Combo'];

/** Normaliza una unidad guardada (ej: "Fardo (20 unidades)") a su nombre base ("Fardo"). */
function baseUnitName(unit: string | null | undefined): string {
  return (unit || '').replace(/\s*\(.*\)\s*$/, '').trim();
}

function isPackUnit(unit: string | null | undefined): boolean {
  const u = baseUnitName(unit)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return PACK_UNITS.some(
    (p) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === u
  );
}


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
  const { unidades, crear: crearUnidadDirecto } = useUnidadesMedida();

  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'supplier' | 'unit' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddExtra, setQuickAddExtra] = useState('');
  const [quickAddUnitType, setQuickAddUnitType] = useState<TipoUnidadMedida>('unidad');
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

  const unitOptions = React.useMemo(() => {
    const names = new Set(unidades.map((u) => u.nombre));
    if (product?.unit && !names.has(product.unit)) {
      return [product.unit, ...Array.from(names)];
    }
    return names.size > 0 ? Array.from(names) : units;
  }, [unidades, product?.unit]);

  const isPackUnitItem = (val: string | null | undefined): boolean => {
    if (isPackUnit(val)) return true;
    const base = baseUnitName(val).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const found = unidades.find((u) => u.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === base);
    return found?.tipo === 'empaque';
  };

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
  const [baseProductResolved, setBaseProductResolved] = useState<Product | null>(null);
  const [remoteBaseProducts, setRemoteBaseProducts] = useState<Product[]>([]);
  const [isSearchingBase, setIsSearchingBase] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [conversionFactorText, setConversionFactorText] = useState('');
  const conversionFactor = Math.max(1, Math.floor(Number(conversionFactorText) || 0) || 1);
  const setConversionFactor = (n: number) => setConversionFactorText(n > 1 ? String(n) : '');
  const [baseProductSearch, setBaseProductSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
        unit: units.includes(baseUnitName(product.unit)) ? baseUnitName(product.unit) : product.unit,
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
      setIsPresentation(Boolean(product.producto_base_id) || isPackUnitItem(product.unit));
      setBaseProductId(product.producto_base_id || '');
      setConversionFactorText(
        product.factor_conversion && product.factor_conversion > 1
          ? String(product.factor_conversion)
          : ''
      );
      setBaseProductSearch('');
      setIsSearchOpen(false);
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
      setConversionFactorText('');
      setBaseProductSearch('');
      setIsSearchOpen(false);
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
      } else if (quickAddType === 'unit') {
        const unit = await crearUnidadDirecto({
          nombre: cleanName,
          tipo: quickAddUnitType,
          descripcion: quickAddExtra.trim() || null,
        });
        setValue('unit', unit.nombre, { shouldValidate: true, shouldDirty: true });
        handleUnitSelection(unit.nombre);
        toast.success(`Unidad "${unit.nombre}" creada y seleccionada`);
      }
      setQuickAddType(null);
      setQuickAddName('');
      setQuickAddExtra('');
      setQuickAddUnitType('unidad');
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

  const handleGenerateSku = () => {
    let sku = '';
    if (isPresentation && selectedBaseProduct) {
      sku = generatePresentationSku(selectedUnit, selectedBaseProduct.sku, selectedBaseProduct.name);
    } else {
      const name = getValues('name');
      const prefix = name ? name.trim().slice(0, 3).toUpperCase() : 'SKU';
      sku = generateUniqueSku(prefix);
    }
    setValue('sku', sku, { shouldValidate: true, shouldDirty: true });
    toast.success(`SKU generado automáticamente: ${sku}`);
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

    if (isPresentation) {
      const packLabel = (getValues('unit') || 'empaque').toLowerCase();
      if (!baseProductId) {
        toast.error(`Selecciona el producto que contiene este ${packLabel}, o desmarca la vinculación.`);
        return;
      }
      if (conversionFactor < 2) {
        toast.error(`Indica cuántas unidades van en cada ${packLabel} (mínimo 2).`);
        return;
      }
    }

    // Resolve final SKU (auto-generated if empty)
    let finalSku = cleanSku;
    if (!finalSku) {
      if (isPresentation && selectedBaseProduct) {
        finalSku = generatePresentationSku(selectedUnit, selectedBaseProduct.sku, selectedBaseProduct.name);
      } else {
        const prefix = (data.name || '').trim().slice(0, 3).toUpperCase() || 'SKU';
        finalSku = generateUniqueSku(prefix);
      }
    }

    // Validation 5: Unique SKU validation
    if (allProducts && allProducts.length > 0) {
      const duplicate = allProducts.find(
        (p) => p.id !== product?.id && p.sku && p.sku.trim().toLowerCase() === finalSku.toLowerCase()
      );
      if (duplicate) {
        if (!cleanSku) {
          // If auto-generated, resolve collision by appending a unique counter
          let uniqueSku = finalSku;
          let counter = 1;
          while (
            allProducts.some(
              (p) => p.id !== product?.id && p.sku && p.sku.trim().toLowerCase() === uniqueSku.toLowerCase()
            )
          ) {
            uniqueSku = `${finalSku}-${counter++}`;
          }
          finalSku = uniqueSku;
        } else {
          toast.error(`El SKU "${cleanSku}" ya está asignado a otro producto ("${duplicate.name}").`);
          return;
        }
      }
    }

    const finalCategory = (data.category || '').trim() || (selectedBaseProduct?.category || 'General');
    const finalBrand = (data.brand || '').trim() || (selectedBaseProduct?.brand || '');

    const saved: Product = {
      id: product?.id ?? `prod-${Date.now()}`,
      ...data,
      sku: finalSku,
      category: finalCategory,
      brand: finalBrand,
      plu: isWeight || isScaleProduct ? (cleanPlu || (product?.plu ?? '')) : '',
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
      factor_conversion: isPresentation && baseProductId ? Math.max(2, Number(conversionFactor) || 2) : 1,
      unidad_base: isPresentation && selectedBaseProduct ? selectedBaseProduct.unit : undefined,
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

  // Resolver producto base seleccionado incluso si no vino en el subconjunto de allProducts
  useEffect(() => {
    if (!baseProductId) {
      setBaseProductResolved(null);
      return;
    }
    const foundInLocal =
      allProducts.find((p) => p.id === baseProductId) ||
      remoteBaseProducts.find((p) => p.id === baseProductId);
    if (foundInLocal) {
      setBaseProductResolved(foundInLocal);
      return;
    }

    let isMounted = true;
    obtenerProductoPorId(baseProductId).then((p) => {
      if (isMounted && p) {
        setBaseProductResolved(productoAUi(p));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [baseProductId, allProducts, remoteBaseProducts]);

  // Cargar catálogo de productos base cuando el modal se abre o se activa la vinculación
  useEffect(() => {
    if (!open || !isPresentation) return;
    let isMounted = true;
    buscarProductosParaVinculacion('', product?.id).then((list) => {
      if (isMounted && list.length > 0) {
        setRemoteBaseProducts(list.map(productoAUi));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [open, isPresentation, product?.id]);

  // Búsqueda en tiempo real contra Supabase al escribir con debounce de 180ms
  useEffect(() => {
    if (!isPresentation || !isSearchOpen) return;
    const term = baseProductSearch.trim();
    if (!term) return;

    setIsSearchingBase(true);
    const timer = setTimeout(() => {
      let isMounted = true;
      buscarProductosParaVinculacion(term, product?.id)
        .then((list) => {
          if (isMounted) {
            const mapped = list.map(productoAUi);
            setRemoteBaseProducts((prev) => {
              const map = new Map<string, Product>();
              for (const p of prev) map.set(p.id, p);
              for (const p of mapped) map.set(p.id, p);
              return Array.from(map.values());
            });
          }
        })
        .finally(() => {
          if (isMounted) setIsSearchingBase(false);
        });
    }, 180);

    return () => {
      clearTimeout(timer);
    };
  }, [baseProductSearch, isPresentation, isSearchOpen, product?.id]);

  // Cerrar selector al hacer click fuera
  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  const selectedBaseProduct = React.useMemo(() => {
    if (!baseProductId) return null;
    return (
      allProducts.find((p) => p.id === baseProductId) ||
      remoteBaseProducts.find((p) => p.id === baseProductId) ||
      baseProductResolved
    );
  }, [baseProductId, allProducts, remoteBaseProducts, baseProductResolved]);

  // Catálogo unificado y deduplicado entre allProducts y productos remotos
  const combinedBaseProducts = React.useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of allProducts) {
      if (!product || p.id !== product.id) map.set(p.id, p);
    }
    for (const p of remoteBaseProducts) {
      if (!product || p.id !== product.id) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [allProducts, remoteBaseProducts, product]);

  const filteredBaseProducts = React.useMemo(() => {
    const rawQ = baseProductSearch.trim();
    if (!rawQ) {
      return combinedBaseProducts.slice(0, 50);
    }

    const normalizeStr = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const tokens = normalizeStr(rawQ).split(/\s+/).filter(Boolean);

    return combinedBaseProducts
      .filter((p) => {
        const normName = normalizeStr(p.name);
        const normSku = normalizeStr(p.sku);
        const normBarcode = normalizeStr(p.barcode);
        const normCategory = normalizeStr(p.category);
        const normBrand = normalizeStr(p.brand);

        return tokens.every(
          (t) =>
            normName.includes(t) ||
            normSku.includes(t) ||
            normBarcode.includes(t) ||
            normCategory.includes(t) ||
            normBrand.includes(t)
        );
      })
      .slice(0, 60);
  }, [combinedBaseProducts, baseProductSearch]);

  const handleSelectBaseProduct = (baseProd: Product) => {
    setBaseProductId(baseProd.id);
    setIsSearchOpen(false);
    setBaseProductSearch('');

    // Auto-generate presentation SKU if current SKU is empty or an auto-generated SKU
    const currentSku = (getValues('sku') || '').trim();
    if (!currentSku || /^(FDO|CTN|CAJ|PQT|BLS|CMB|PACK|SKU)-/i.test(currentSku)) {
      const generatedSku = generatePresentationSku(selectedUnit, baseProd.sku, baseProd.name);
      setValue('sku', generatedSku, { shouldValidate: true, shouldDirty: true });
    }

    // Auto-fill category, brand, and name if empty
    if (!getValues('category') && baseProd.category) {
      setValue('category', baseProd.category, { shouldDirty: true });
    }
    if (!getValues('brand') && baseProd.brand) {
      setValue('brand', baseProd.brand, { shouldDirty: true });
    }
    if (!getValues('name')) {
      setValue('name', `${selectedUnit} de ${baseProd.name}`, { shouldDirty: true, shouldValidate: true });
    }

    // Si aún no se indicó cuántas unidades trae, sugerirlo por costos (el usuario puede cambiarlo)
    if (conversionFactor <= 1) {
      const currentCost = Number(getValues('costPrice') || 0);
      const baseCost = Number(baseProd.costPrice || 0);
      if (currentCost > 0 && baseCost > 0 && currentCost > baseCost) {
        const calcFactor = Math.round(currentCost / baseCost);
        if (calcFactor >= 2) {
          setConversionFactor(calcFactor);
          toast.info(`Sugerencia por costos: ${calcFactor} unidades. Ajústalo si no es correcto.`);
        }
      }
    }
  };

  const handleUnitSelection = (val: string) => {
    setValue('unit', val, { shouldValidate: true, shouldDirty: true });
    if (isPackUnitItem(val)) {
      // Al elegir Fardo, Cartón, Caja, etc. se abre automáticamente la gestión del empaque
      setIsPresentation(true);
      if (selectedBaseProduct) {
        const currentSku = (getValues('sku') || '').trim();
        if (!currentSku || /^(FDO|CTN|CAJ|PQT|BLS|CMB|PACK|SKU)-/i.test(currentSku)) {
          const generatedSku = generatePresentationSku(val, selectedBaseProduct.sku, selectedBaseProduct.name);
          setValue('sku', generatedSku, { shouldValidate: true, shouldDirty: true });
        }
      }
    } else {
      setIsPresentation(false);
      setBaseProductId('');
      setConversionFactorText('');
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

            <FormField
              label="SKU (Opcional)"
              name="sku"
              error={errors.sku?.message}
              hint={
                isPresentation
                  ? 'Se genera automáticamente para este fardo/empaque si se deja vacío'
                  : 'Código único interno (se genera automáticamente si se deja vacío)'
              }
            >
              <div className="flex gap-2">
                <input
                  id="sku"
                  {...register('sku')}
                  className="input-field font-mono flex-1"
                  placeholder={
                    isPresentation
                      ? 'Ej: FDO-AGU-500 (Opcional)'
                      : 'Ej: ARR-SEL-5LB (Opcional)'
                  }
                />
                <button
                  type="button"
                  onClick={handleGenerateSku}
                  className="btn-secondary text-xs flex items-center gap-1 px-3 whitespace-nowrap cursor-pointer"
                  title="Generar SKU automáticamente"
                >
                  <Sparkles size={14} className="text-primary" /> Generar SKU
                </button>
              </div>
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
                  Categoría <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('category');
                    setQuickAddName('');
                    setQuickAddExtra('');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  + Nueva
                </button>
              </div>
              <select id="category" {...register('category')} className="input-field">
                <option value="">(Sin categoría / General)</option>
                {categoryOptions.map((c) => (
                  <option key={`cat-opt-${c}`} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="text-sm text-danger">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="brand" className="block text-sm font-semibold text-foreground">
                  Marca <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('brand');
                    setQuickAddName('');
                    setQuickAddExtra('');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  + Nueva
                </button>
              </div>
              <select id="brand" {...register('brand')} className="input-field">
                <option value="">(Sin marca)</option>
                {brandOptions.map((b) => (
                  <option key={`brand-opt-${b}`} value={b}>{b}</option>
                ))}
              </select>
              {errors.brand && <p className="text-sm text-danger">{errors.brand.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="unit" className="block text-sm font-semibold text-foreground">
                  Unidad de Medida <span className="text-danger ml-0.5">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddType('unit');
                    setQuickAddName('');
                    setQuickAddExtra('');
                    setQuickAddUnitType('unidad');
                  }}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  + Nueva
                </button>
              </div>
              <select
                id="unit"
                {...register('unit', { required: true })}
                className="input-field"
                onChange={(e) => {
                  register('unit').onChange(e);
                  handleUnitSelection(e.target.value);
                }}
              >
                {unitOptions.map((u) => (
                  <option key={`unit-opt-${u}`} value={u}>{u}</option>
                ))}
              </select>
              {errors.unit && <p className="text-sm text-danger">{errors.unit.message}</p>}

              <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPresentation}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsPresentation(checked);
                    if (!checked) {
                      setBaseProductId('');
                    }
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span>¿Este empaque descuenta de otro producto? (ej. fardo de botellas)</span>
              </label>
            </div>

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

            {/* Subpanel que solo aparece si el usuario decide explícitamente vincular el producto */}
            {isPresentation && (
              <div className="sm:col-span-2 bg-secondary/30 border border-border/80 rounded-xl p-3.5 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <Layers size={13} className="text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      Vinculación opcional de inventario para {selectedUnit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPresentation(false);
                      setBaseProductId('');
                    }}
                    className="text-[11px] text-muted-foreground hover:text-danger hover:underline"
                  >
                    Desactivar vinculación
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-border/40">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Producto Base del que descontará stock
                    </label>

                    {selectedBaseProduct && !isSearchOpen ? (
                      <div className="flex items-center justify-between p-2 rounded-lg border border-primary/30 bg-background text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <Package size={13} className="text-primary" />
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-foreground block truncate">{selectedBaseProduct.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {selectedBaseProduct.sku ? `SKU: ${selectedBaseProduct.sku} • ` : ''}
                              Stock: <strong className="text-primary">{selectedBaseProduct.currentStock} {selectedBaseProduct.unit}</strong>
                              {selectedBaseProduct.costPrice > 0 ? ` • Costo: RD$ ${selectedBaseProduct.costPrice}` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(true);
                            setBaseProductSearch('');
                          }}
                          className="btn-secondary text-[11px] px-2.5 py-1 shrink-0 ml-2 font-medium"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <div className="relative" ref={searchContainerRef}>
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          <input
                            type="text"
                            autoFocus={isSearchOpen}
                            value={baseProductSearch}
                            onChange={(e) => {
                              setBaseProductSearch(e.target.value);
                              if (!isSearchOpen) setIsSearchOpen(true);
                            }}
                            onFocus={() => setIsSearchOpen(true)}
                            placeholder="Escribe el producto (ej: Botella de agua, Arroz, Aceite, Huevo)..."
                            className="input-field pl-8 pr-14 text-xs w-full font-medium"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {isSearchingBase && (
                              <Loader2 size={13} className="animate-spin text-primary" />
                            )}
                            {baseProductSearch && (
                              <button
                                type="button"
                                onClick={() => setBaseProductSearch('')}
                                className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                                title="Limpiar búsqueda"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isSearchOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-xl divide-y divide-border/50 animate-fadeIn scrollbar-thin">
                            <div className="px-3 py-1.5 bg-secondary/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-xs z-10 border-b border-border/50">
                              <span>
                                {baseProductSearch
                                  ? `${filteredBaseProducts.length} resultado(s) para "${baseProductSearch}"`
                                  : `Catálogo (${filteredBaseProducts.length} productos disponibles)`}
                              </span>
                              {isSearchingBase && (
                                <span className="flex items-center gap-1 text-primary lowercase font-normal">
                                  <Loader2 size={10} className="animate-spin" /> buscando...
                                </span>
                              )}
                            </div>

                            {filteredBaseProducts.length === 0 ? (
                              <div className="p-4 text-xs text-muted-foreground text-center space-y-1">
                                <p className="font-medium text-foreground">
                                  {isSearchingBase
                                    ? 'Buscando en el catálogo completo...'
                                    : `No se encontraron productos con "${baseProductSearch}"`}
                                </p>
                                {!isSearchingBase && (
                                  <p className="text-[11px]">
                                    Prueba escribiendo otra palabra clave, marca o código de barras.
                                  </p>
                                )}
                              </div>
                            ) : (
                              filteredBaseProducts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectBaseProduct(p)}
                                  className="w-full text-left p-2.5 hover:bg-secondary/40 transition-colors flex items-center justify-between text-xs group cursor-pointer"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                      {p.name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                      {p.sku && <span>SKU: {p.sku}</span>}
                                      {p.category && <span className="text-muted-foreground/80">• {p.category}</span>}
                                      <span>
                                        • Stock: <strong className="text-foreground">{p.currentStock} {p.unit}</strong>
                                      </span>
                                      {p.costPrice > 0 && <span>• Costo: RD$ {p.costPrice}</span>}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 px-2 py-0.5 rounded-md">
                                    Vincular →
                                  </span>
                                </button>
                              ))
                            )}
                            {selectedBaseProduct && (
                              <div className="p-1.5 bg-secondary/20 text-center sticky bottom-0 border-t border-border/50 backdrop-blur-xs">
                                <button
                                  type="button"
                                  onClick={() => setIsSearchOpen(false)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                                >
                                  Mantener actual ({selectedBaseProduct.name})
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Unidades base por cada {selectedUnit} (Factor)
                    </label>
                    <input
                      type="number"
                      min={2}
                      step={1}
                      inputMode="numeric"
                      className="input-field text-xs w-full font-mono"
                      placeholder={`Ej: ${selectedUnit === 'Fardo' ? '20' : selectedUnit === 'Cartón' ? '2' : '12'}`}
                      value={conversionFactorText}
                      onChange={(e) => setConversionFactorText(e.target.value.replace(/[^\d]/g, ''))}
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
                      Selecciona un producto base si deseas compartir inventario. Si no, puedes desmarcar la casilla y el {selectedUnit.toLowerCase()} descontará su propio stock independiente al venderse.
                    </div>
                  )}
                </div>
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
                  : quickAddType === 'supplier'
                  ? 'Nuevo Proveedor Rápido'
                  : 'Nueva Unidad de Medida'}
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
                      : quickAddType === 'supplier'
                      ? 'Ej. Distribuidora Central'
                      : 'Ej. Cartón, Combo, Libra, Kilogramo...'
                  }
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  className="input-field text-xs !h-9"
                  autoFocus
                />
              </div>

              {quickAddType === 'unit' && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Tipo de Unidad <span className="text-danger">*</span>
                  </label>
                  <select
                    value={quickAddUnitType}
                    onChange={(e) => setQuickAddUnitType(e.target.value as TipoUnidadMedida)}
                    className="input-field text-xs !h-9"
                  >
                    <option value="unidad">Unidad simple (unidad, combo, docena)</option>
                    <option value="empaque">Empaque múltiple (cartón, fardo, caja, paquete)</option>
                    <option value="peso">Peso / Balanza (libra, kg)</option>
                    <option value="volumen">Volumen / Líquido (litro, galón)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  {quickAddType === 'supplier' ? 'Teléfono (Opcional)' : 'Descripción (Opcional)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    quickAddType === 'supplier'
                      ? 'Ej. 809-555-0123'
                      : quickAddType === 'unit'
                      ? 'Ej. Empaque de 30 unidades, balanza, etc.'
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