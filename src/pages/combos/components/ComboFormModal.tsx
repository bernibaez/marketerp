import React, { useState, useEffect, useId, useMemo } from 'react';
import { Layers, Check } from 'lucide-react';
import { Combo, ComboItem, PricingMode } from '@/lib/comboStore';
import type { ProductItem } from '@/lib/productStore';
import { useProductos } from '@/hooks/useProductos';
import { toast } from '@/lib/toast';

import { ComboGeneralInfoCard } from './form/ComboGeneralInfoCard';
import { ComboItemsCard } from './form/ComboItemsCard';
import { ComboPricingCard } from './form/ComboPricingCard';
import { ComboConfigCard } from './form/ComboConfigCard';
import { ComboValidityCard } from './form/ComboValidityCard';

interface ComboFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (combo: Combo) => void;
  editingCombo?: Combo | null;
}

const CATEGORIES = [
  'Desayunos & Ofertas',
  'Despensa',
  'Hogar & Limpieza',
  'Meriendas',
  'Carnes & Asados',
  'Bebidas & Licores',
  'Paquete Escolar',
  'Promocional Especial',
];

const BRANCHES_LIST = [
  'Sucursal Principal',
  'Sucursal Norte',
  'Sucursal Este',
  'Sucursal Sur',
];

export default function ComboFormModal({
  isOpen,
  onClose,
  onSave,
  editingCombo,
}: ComboFormModalProps) {
  const formId = useId();
  const {
    productosUi,
    loading: loadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useProductos({ pagina: 1, limite: 500, estado: 'todos' });

  const availableProducts = useMemo(() => {
    const list = productosUi as ProductItem[];
    const activos = list.filter((p) => p.status === 'active');
    return activos.length > 0 ? activos : list;
  }, [productosUi]);

  // Card 1: General
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [image, setImage] = useState('');

  // Card 2: Items
  const [items, setItems] = useState<ComboItem[]>([]);

  // Card 3: Pricing
  const [discountType, setDiscountType] = useState<PricingMode>('fixed');
  const [priceInput, setPriceInput] = useState<number>(0);
  const [percentInput, setPercentInput] = useState<number>(10);
  const [amountInput, setAmountInput] = useState<number>(50);

  // Card 4: Config
  const [active, setActive] = useState(true);
  const [visibleInPos, setVisibleInPos] = useState(true);
  const [allowSaleWithoutStock, setAllowSaleWithoutStock] = useState(false);
  const [applyTax, setApplyTax] = useState(false);
  const [allBranches, setAllBranches] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>(BRANCHES_LIST);

  // Card 5: Vigencia
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');

  useEffect(() => {
    if (!isOpen) return;

    if (editingCombo) {
      setName(editingCombo.name);
      setCode(editingCombo.code);
      setBarcode(editingCombo.barcode);
      setDescription(editingCombo.description);
      setCategory(editingCombo.category || CATEGORIES[0]);
      setImage(editingCombo.image || '');
      setItems(editingCombo.items || []);
      setDiscountType(editingCombo.discountType || 'fixed');
      setPriceInput(editingCombo.price || 0);
      setPercentInput(editingCombo.discountValue || 10);
      setAmountInput(editingCombo.discountValue || 50);
      setActive(editingCombo.active);
      setVisibleInPos(editingCombo.visibleInPos);
      setAllowSaleWithoutStock(editingCombo.allowSaleWithoutStock);
      setApplyTax(editingCombo.applyTax);
      setAllBranches(editingCombo.allBranches);
      setSelectedBranches(editingCombo.branches || BRANCHES_LIST);
      setStartDate(editingCombo.startDate || new Date().toISOString().slice(0, 10));
      setEndDate(editingCombo.endDate || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
      setStartTime(editingCombo.startTime || '06:00');
      setEndTime(editingCombo.endTime || '22:00');
    } else {
      const randomCode = `CMB-${Math.floor(100 + Math.random() * 900)}`;
      const randomBar = `${Math.floor(7892000000000 + Math.random() * 999999999)}`;
      setName('');
      setCode(randomCode);
      setBarcode(randomBar);
      setDescription('');
      setCategory(CATEGORIES[0]);
      setImage('');
      setItems([]);
      setDiscountType('fixed');
      setPriceInput(0);
      setPercentInput(10);
      setAmountInput(50);
      setActive(true);
      setVisibleInPos(true);
      setAllowSaleWithoutStock(false);
      setApplyTax(false);
      setAllBranches(true);
      setSelectedBranches(BRANCHES_LIST);
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate(new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
      setStartTime('06:00');
      setEndTime('22:00');
    }
  }, [editingCombo, isOpen]);

  // Real-time calculations
  const normalPrice = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);

  let finalPrice = 0;
  if (discountType === 'fixed') {
    finalPrice = priceInput;
  } else if (discountType === 'percent') {
    finalPrice = Math.max(0, normalPrice * (1 - percentInput / 100));
  } else if (discountType === 'amount') {
    finalPrice = Math.max(0, normalPrice - amountInput);
  }

  const savingsAmount = Math.max(0, normalPrice - finalPrice);
  const savingsPercent = normalPrice > 0 ? (savingsAmount / normalPrice) * 100 : 0;
  const profitMargin = finalPrice > 0 ? ((finalPrice - totalCost) / finalPrice) * 100 : 0;

  const handleAddItem = (prod: ProductItem) => {
    if (items.some((i) => i.productId === prod.id)) {
      toast.warning(`"${prod.name}" ya está en el combo. Puedes incrementar su cantidad en la tabla.`);
      return;
    }

    const newItem: ComboItem = {
      id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      quantity: 1,
      unitPrice: prod.salePrice,
      costPrice: prod.costPrice,
      subtotal: prod.salePrice * 1,
    };

    const updated = [...items, newItem];
    setItems(updated);
    toast.success(`"${prod.name}" agregado al combo`);

    if (priceInput === 0 && discountType === 'fixed') {
      const newNormal = updated.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      setPriceInput(Math.round(newNormal * 0.9));
    }
  };

  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, quantity: newQty, subtotal: i.unitPrice * newQty } : i
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleGenerateBarcode = () => {
    setBarcode(`${Math.floor(7892000000000 + Math.random() * 999999999)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre del combo es obligatorio');
      return;
    }
    if (!code.trim()) {
      toast.error('El código interno es obligatorio');
      return;
    }
    if (items.length === 0) {
      toast.error('Debes agregar al menos un producto al combo');
      return;
    }

    const comboToSave: Combo = {
      id: editingCombo ? editingCombo.id : `cmb-${Date.now()}`,
      name: name.trim(),
      code: code.trim(),
      barcode: barcode.trim() || code.trim(),
      description: description.trim(),
      category,
      price: Math.round(finalPrice),
      totalCost: Math.round(totalCost),
      normalPrice: Math.round(normalPrice),
      discountType,
      discountValue:
        discountType === 'fixed'
          ? priceInput
          : discountType === 'percent'
          ? percentInput
          : amountInput,
      savingsAmount: Math.round(savingsAmount),
      savingsPercent: Number(savingsPercent.toFixed(2)),
      marginPercent: Number(profitMargin.toFixed(2)),
      active,
      visibleInPos,
      allowSaleWithoutStock,
      applyTax,
      allBranches,
      branches: allBranches ? BRANCHES_LIST : selectedBranches,
      startDate,
      endDate,
      startTime,
      endTime,
      image,
      items,
      createdAt: editingCombo ? editingCombo.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      salesCount: editingCombo ? editingCombo.salesCount : 0,
    };

    onSave(comboToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="text-primary" size={26} />
            {editingCombo ? 'Editar Combo' : 'Nuevo Combo'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura los productos componentes, precios y vigencia del combo
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-secondary">
          ← Volver a Combos
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ComboGeneralInfoCard
          formId={formId}
          name={name}
          setName={setName}
          category={category}
          setCategory={setCategory}
          code={code}
          setCode={setCode}
          barcode={barcode}
          setBarcode={setBarcode}
          description={description}
          setDescription={setDescription}
          onGenerateBarcode={handleGenerateBarcode}
          categories={CATEGORIES}
        />

        <ComboItemsCard
          items={items}
          availableProducts={availableProducts}
          loadingProducts={loadingProducts}
          productsError={productsError}
          refetchProducts={refetchProducts}
          onAddItem={handleAddItem}
          onUpdateQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          totalCost={totalCost}
          normalPrice={normalPrice}
        />

        <ComboPricingCard
          formId={formId}
          discountType={discountType}
          setDiscountType={setDiscountType}
          totalCost={totalCost}
          finalPrice={finalPrice}
          priceInput={priceInput}
          setPriceInput={setPriceInput}
          percentInput={percentInput}
          setPercentInput={setPercentInput}
          amountInput={amountInput}
          setAmountInput={setAmountInput}
          profitMargin={profitMargin}
        />

        <ComboConfigCard
          active={active}
          setActive={setActive}
          visibleInPos={visibleInPos}
          setVisibleInPos={setVisibleInPos}
          allowSaleWithoutStock={allowSaleWithoutStock}
          setAllowSaleWithoutStock={setAllowSaleWithoutStock}
          applyTax={applyTax}
          setApplyTax={setApplyTax}
          allBranches={allBranches}
          setAllBranches={setAllBranches}
          selectedBranches={selectedBranches}
          setSelectedBranches={setSelectedBranches}
          branchesList={BRANCHES_LIST}
        />

        <ComboValidityCard
          formId={formId}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
        />

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary text-xs font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-sm font-black px-6 py-2.5 flex items-center gap-2 shadow-md shadow-primary/20"
          >
            <Check size={18} />
            {editingCombo ? 'Guardar Cambios' : 'Crear Combo'}
          </button>
        </div>
      </form>
    </div>
  );
}
