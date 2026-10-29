import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  User,
  Search,
  Plus,
  CreditCard,
  Info,
  X,
  Pencil,
  DollarSign,
  Minus,
  Trash2,
  Banknote,
  FileText,
  Barcode,
  Tag,
  Scale,
  Package,
  Loader2,
} from 'lucide-react';
import type { CartItem, Customer } from './POSTerminal';
import { useClientes } from '@/hooks/useClientes';
import { useProductos } from '@/hooks/useProductos';
import { initialProducts } from '@/lib/initialProducts';
import { isVariableWeightBarcode, productMatchesScanCode } from '@/lib/scaleBarcode';
import { obtenerProductos, productoAUi } from '@/services/productos.service';
import PosAddCustomerModal from './PosAddCustomerModal';
import { toast } from '@/lib/toast';
import type { NCFType } from '@/lib/ncfStore';

interface CartPanelProps {
  cart: CartItem[];
  customer: Customer | null;
  onSetCustomer: (c: Customer | null) => void;
  selectedNcfType?: NCFType;
  onSelectNcfType?: (t: NCFType) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateDiscount: (id: string, discount: number) => void;
  onRemove: (id: string) => void;
  onEditWeight?: (item: CartItem) => void;
  onOpenWeightScan?: () => void;
  globalDiscount: number;
  onSetGlobalDiscount: (d: number) => void;
  subtotal: number;
  taxTotal: number;
  globalDiscountAmount: number;
  total: number;
  onCheckout: () => void;
  fiscalEnabled?: boolean;
  onToggleFiscal?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: (q: string) => void | Promise<boolean | void>;
  onAddToCart?: (product: any, qty?: number) => void;
  awaitingDelete?: boolean;
  onToggleDeleteMode?: () => void;
  onCancelDelete?: () => void;
  onToggleWholesale?: (id: string) => void;
  onToggleAllWholesale?: () => void;
  isWholesaleMode?: boolean;
  onOpenDiscountModal?: (item: CartItem) => void;
  onOpenPriceModal?: (item: CartItem) => void;
  isAdmin?: boolean;
}

export default function CartPanel({
  cart,
  customer,
  onSetCustomer,
  selectedNcfType = 'B02',
  onSelectNcfType,
  onUpdateQty,
  onRemove,
  onEditWeight,
  onOpenWeightScan,
  taxTotal,
  total,
  fiscalEnabled = false,
  onToggleFiscal,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  onAddToCart,
  awaitingDelete = false,
  onToggleDeleteMode,
  onCancelDelete,
  onToggleWholesale,
  onToggleAllWholesale,
  isWholesaleMode = false,
  onOpenDiscountModal,
  onOpenPriceModal,
  isAdmin = false,
}: CartPanelProps) {
  const { clientes, refetch } = useClientes('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const cartListRef = useRef<HTMLDivElement>(null);

  // Mantener el scroll arriba cuando se agrega o escanea un producto (el último agregado aparece primero)
  const topCartItemKey = cart[0] ? `${cart[0].id}-${cart[0].qty}` : '';
  useEffect(() => {
    if (cartListRef.current && topCartItemKey) {
      cartListRef.current.scrollTop = 0;
    }
  }, [topCartItemKey]);

  const { productosUi } = useProductos({ pagina: 1, limite: 5000, estado: 'activo' });

  // Merge store products and initialProducts for comprehensive local search matching (solo activos)
  const allProducts = useMemo(() => {
    const list = [...productosUi.filter((p) => p.status === 'active' || p.status === undefined)];
    const skus = new Set(list.map((p) => p.sku.toLowerCase()));
    for (const p of initialProducts) {
      if (!skus.has(p.sku.toLowerCase()) && p.status !== 'inactive' && p.status !== 'discontinued') {
        list.push(p as any);
      }
    }
    return list;
  }, [productosUi]);

  // Consulta en tiempo real a Supabase / Base de datos con debounce cuando el usuario escribe en la barra
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 1) {
      setDbResults([]);
      setSearchingDb(false);
      setSelectedIndex(0);
      return;
    }

    setSearchingDb(true);
    const abortCtrl = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await obtenerProductos({
          busqueda: q,
          limite: 30,
          estado: 'todos',
          signal: abortCtrl.signal,
        });
        if (!abortCtrl.signal.aborted) {
          setDbResults(res.datos.map(productoAUi));
          setSearchingDb(false);
          setSelectedIndex(0);
        }
      } catch (err: any) {
        if (!abortCtrl.signal.aborted) {
          setSearchingDb(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      abortCtrl.abort();
    };
  }, [searchQuery]);

  // Resultados combinados: catálogo local instantáneo + resultados en vivo de la base de datos
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    // 1. Filtrar en catálogo local
    const localMatches = allProducts.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const plu = (p.plu || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q) || plu.includes(q);
    });

    // 2. Fusionar con resultados devueltos por la base de datos sin duplicados
    const combined: any[] = [...localMatches];
    const seenIds = new Set(localMatches.map((p) => p.id));
    const seenSkus = new Set(localMatches.map((p) => (p.sku || '').toLowerCase()));

    for (const dbItem of dbResults) {
      if (!seenIds.has(dbItem.id) && !seenSkus.has((dbItem.sku || '').toLowerCase())) {
        combined.push(dbItem);
        seenIds.add(dbItem.id);
        if (dbItem.sku) seenSkus.add(dbItem.sku.toLowerCase());
      }
    }

    // 3. Ordenar por relevancia para que productos cuyo nombre empiece con la búsqueda (ej. "fresaya") aparezcan al inicio
    combined.sort((a, b) => {
      const aName = (a.name || '').toLowerCase().trim();
      const bName = (b.name || '').toLowerCase().trim();
      const aBarcode = (a.barcode || '').toLowerCase().trim();
      const bBarcode = (b.barcode || '').toLowerCase().trim();
      const aSku = (a.sku || '').toLowerCase().trim();
      const bSku = (b.sku || '').toLowerCase().trim();

      const getRank = (name: string, barcode: string, sku: string) => {
        if (name === q || barcode === q || sku === q) return 0;
        if (name.startsWith(q)) return 1;
        if (barcode.startsWith(q) || sku.startsWith(q)) return 2;
        if (name.includes(q)) return 3;
        return 4;
      };

      // Priorizar productos activos sobre inactivos
      const inactA = a.status === 'inactive' || a.status === 'discontinued' || a.estado === 'inactivo';
      const inactB = b.status === 'inactive' || b.status === 'discontinued' || b.estado === 'inactivo';
      if (inactA !== inactB) return inactA ? 1 : -1;

      const rankA = getRank(aName, aBarcode, aSku);
      const rankB = getRank(bName, bBarcode, bSku);
      if (rankA !== rankB) return rankA - rankB;
      return aName.localeCompare(bName);
    });

    return combined.slice(0, 30);
  }, [searchQuery, allProducts, dbResults]);

  useEffect(() => {
    setCustomers(
      clientes.map((c) => ({
        id: c.id,
        name: c.nombre,
        phone: c.telefono ?? '',
        credit: Number(c.limite_credito ?? 0),
        rnc_cedula: c.rnc_cedula ?? null,
        direccion: c.direccion ?? null,
        tipo_cliente: c.tipo_cliente ?? null,
        tipo_ncf: c.tipo_ncf ?? (c.tipo_cliente === 'fiscal' ? 'B01' : (c.rnc_cedula ? 'B01' : 'B02')),
      }))
    );
  }, [clientes]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fmt = (v: number) =>
    `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalItemsCount = cart.reduce((s, i) => s + i.qty, 0);

  const handleSelectProduct = (p: any) => {
    // 1. Validar que no esté inactivo
    if (
      p.status === 'inactive' ||
      p.status === 'discontinued' ||
      p.estado === 'inactivo' ||
      p.estado === 'descontinuado'
    ) {
      toast.error(`"${p.name}" está INACTIVO en el sistema. Debes activarlo en Gestión de Productos para poder venderlo.`, { duration: 4000 });
      return;
    }

    // 2. Validar que no esté agotado
    if (
      p.stockStatus === 'out' ||
      p.outOfStock ||
      (p.currentStock !== undefined && p.currentStock <= 0) ||
      (p.stock !== undefined && p.stock <= 0)
    ) {
      toast.error(`Producto sin existencias: "${p.name}"`);
      return;
    }

    const isWeight =
      Boolean(p.isWeightProduct) ||
      Boolean((p as any).es_pesado) ||
      p.saleType === 'weight' ||
      p.saleType === 'both';

    // Unidad corregida: productos de balanza pasan como 'lb' (o su unidad de peso), NUNCA 'Unidad' o 'ud'
    const resolvedUnit = isWeight
      ? (p.weightUnit || (p.unit && !['und', 'ud', 'unidad', 'unidades'].includes(p.unit.toLowerCase()) ? p.unit : 'lb'))
      : (p.unit || 'Und');

    const wholesale = p.wholesalePrice ? Number(p.wholesalePrice) : undefined;
    const shouldWholesale = Boolean(isWholesaleMode && wholesale && wholesale > 0);

    const basePrice = Number(
      p.salePrice && p.salePrice > 0
        ? p.salePrice
        : p.pricePerWeight && p.pricePerWeight > 0
          ? p.pricePerWeight
          : p.price ?? 0
    );

    const unitPrice = shouldWholesale && wholesale ? wholesale : basePrice;

    const existingInCart = cart.find(
      (i) => i.productId === p.id || (p.sku && i.sku && i.sku.toLowerCase() === p.sku.toLowerCase())
    );

    if (isWeight && onEditWeight) {
      onEditWeight({
        id: existingInCart?.id || `cart-${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        sku: p.sku || '',
        barcode: p.barcode || '',
        price: unitPrice,
        regularPrice: basePrice,
        wholesalePrice: wholesale,
        isWholesale: shouldWholesale,
        cost: Number(p.costPrice ?? p.cost ?? 0),
        tax: Number(p.tax ?? 0),
        image: p.image || '',
        unit: resolvedUnit,
        qty: existingInCart ? existingInCart.qty : 1,
        discount: existingInCart?.discount ?? 0,
        isWeighted: true,
      });
    } else if (onAddToCart) {
      onAddToCart({
        id: `cart-${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        sku: p.sku || '',
        barcode: p.barcode || '',
        price: unitPrice,
        regularPrice: basePrice,
        wholesalePrice: wholesale,
        isWholesale: shouldWholesale,
        cost: Number(p.costPrice ?? p.cost ?? 0),
        tax: Number(p.tax ?? 0),
        image: p.image || '',
        unit: resolvedUnit,
        isWeighted: isWeight,
        status: p.status,
        outOfStock: false,
      });
    }
    if (onSearchChange) onSearchChange('');
    setDropdownOpen(false);
    const input = document.getElementById('pos-barcode-search-input');
    if (input) input.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setDropdownOpen(true);
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setDropdownOpen(true);
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const valueToSubmit = searchQuery.trim();
      if (!valueToSubmit) return;

      const qLower = valueToSubmit.toLowerCase();

      // 1. Si hay coincidencia exacta por código de barras, SKU o PLU en los resultados:
      // (Priorizar siempre productos regulares para no confundir productos con código fijo
      // que empieza en 20-29 con etiquetas de peso de balanza)
      const upperSubmit = valueToSubmit.toUpperCase();
      const exactCode =
        searchResults.find((p) => {
          const b = String(p.barcode ?? '').trim().toUpperCase();
          const s = String(p.sku ?? '').trim().toUpperCase();
          return (b && b === upperSubmit) || (s && s === upperSubmit);
        }) || searchResults.find((p) => productMatchesScanCode(p, valueToSubmit));
      if (exactCode) {
        handleSelectProduct(exactCode);
        return;
      }

      // 2. Si es una etiqueta de balanza con peso embebido (EAN-13/12 prefijo 20-29) y NO es
      // un producto de catálogo con código exacto fijo:
      if (isVariableWeightBarcode(valueToSubmit) && onSearchSubmit) {
        if (onSearchChange) onSearchChange('');
        setDropdownOpen(false);
        void onSearchSubmit(valueToSubmit);
        return;
      }

      // 2. Coincidencia exacta de nombre (ej. "fresaya")
      const exactName = searchResults.find(
        (p) => (p.name || '').trim().toLowerCase() === qLower
      );
      if (exactName) {
        handleSelectProduct(exactName);
        return;
      }

      // 3. Coincidencia donde el nombre del producto inicia con el texto escrito (ej: "fresaya")
      const startsName = searchResults.find(
        (p) => (p.name || '').trim().toLowerCase().startsWith(qLower)
      );
      if (startsName) {
        handleSelectProduct(startsName);
        return;
      }

      // 4. Si el usuario navegó activamente con flechas y seleccionó un ítem específico:
      if (dropdownOpen && searchResults.length > 0 && selectedIndex > 0 && selectedIndex < searchResults.length) {
        handleSelectProduct(searchResults[selectedIndex]);
        return;
      }

      // 5. Si hay un primer resultado que contiene el texto escrito:
      if (searchResults.length > 0) {
        const topResult = searchResults[0];
        const topName = (topResult.name || '').toLowerCase();
        const topSku = (topResult.sku || '').toLowerCase();
        const topBarcode = (topResult.barcode || '').toLowerCase();
        if (topName.includes(qLower) || topSku.includes(qLower) || topBarcode.includes(qLower)) {
          handleSelectProduct(topResult);
          return;
        }
      }

      // 6. Si no hay coincidencia local, delegar al procesador global (Supabase / combos):
      if (onSearchSubmit) {
        if (onSearchChange) onSearchChange('');
        setDropdownOpen(false);
        void onSearchSubmit(valueToSubmit);
        return;
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
      if (awaitingDelete && onCancelDelete) {
        onCancelDelete();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-3.5 overflow-hidden">
      {/* Row 1: Customer Selector (Left) & Search Input with Floating Dropdown (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-2.5 flex-shrink-0">
        {/* Customer Select (Cols 5) */}
        <div className="md:col-span-5 flex items-center gap-1.5">
          <div className="relative flex-1">
            <User size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={customer?.id || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onSetCustomer(null);
                  return;
                }
                const found = customers.find((c) => c.id === val);
                if (found) {
                  onSetCustomer(found);
                  if (found.tipo_ncf && onSelectNcfType) {
                    onSelectNcfType(found.tipo_ncf as NCFType);
                  } else if (found.rnc_cedula && onSelectNcfType) {
                    onSelectNcfType('B01');
                  }
                }
              }}
              className="w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-7 h-10 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer truncate"
            >
              <option value="">Cliente Contado (Consumidor Final)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.rnc_cedula ? `· RNC/Céd: ${c.rnc_cedula}` : c.phone ? `· ${c.phone}` : ''}
                </option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">
              ▼
            </span>
          </div>

          {/* Plus Blue Button */}
          <button
            type="button"
            onClick={() => setAddCustomerOpen(true)}
            className="w-10 h-10 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-2xs cursor-pointer active:scale-95"
            title="Agregar nuevo cliente"
          >
            <Plus size={18} strokeWidth={2.8} />
          </button>
        </div>

        {/* Search Input with Autocomplete (Cols 7) */}
        <div className="md:col-span-7 relative flex items-center gap-1.5" ref={searchContainerRef}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="pos-barcode-search-input"
              type="text"
              placeholder={
                awaitingDelete
                  ? 'MODO QUITAR: Escanea o busca producto a restar/eliminar...'
                  : 'Buscar producto o escanear código...'
              }
              value={searchQuery}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={handleKeyDown}
              autoFocus
              className={`w-full rounded-xl pl-9 pr-9 h-10 text-xs sm:text-sm font-semibold focus:outline-none transition-all ${
                awaitingDelete
                  ? 'bg-rose-50/70 dark:bg-rose-950/40 border-2 border-rose-500 text-rose-900 dark:text-rose-100 placeholder:text-rose-400 focus:ring-2 focus:ring-rose-400'
                  : 'bg-slate-50/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {/* Card / Barcode reader icon inside right */}
            {awaitingDelete ? (
              <Minus size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-600 dark:text-rose-400 pointer-events-none" />
            ) : (
              <CreditCard size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none" />
            )}
          </div>

          {/* Botón Minimalista para Activar/Desactivar Modo Quitar Producto */}
          <button
            type="button"
            onClick={() => {
              if (cart.length === 0 && !awaitingDelete) {
                toast.error('El carrito está vacío');
                return;
              }
              if (onToggleDeleteMode) onToggleDeleteMode();
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all shadow-2xs cursor-pointer active:scale-95 border ${
              awaitingDelete
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40'
                : 'bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border-slate-200 dark:border-slate-700 hover:border-rose-300'
            }`}
            title={
              awaitingDelete
                ? 'Modo quitar activo (clic para volver a modo normal o presiona Esc)'
                : 'Activar modo quitar producto (F4)'
            }
          >
            <Minus size={20} strokeWidth={3} />
          </button>

          {/* Botón para Activar/Desactivar Venta al Por Mayor */}
          {onToggleAllWholesale && (
            <button
              type="button"
              onClick={onToggleAllWholesale}
              className={`h-10 px-2.5 rounded-xl flex items-center gap-1.5 flex-shrink-0 transition-all shadow-2xs cursor-pointer active:scale-95 border font-bold text-xs ${
                isWholesaleMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40'
                  : 'bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-amber-950/40 text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700 hover:border-amber-300'
              }`}
              title={
                isWholesaleMode
                  ? 'Modo Por Mayor activo: clic para volver a precio normal'
                  : 'Activar modo venta al por mayor para todo el carrito'
              }
            >
              <Tag size={15} className={isWholesaleMode ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
              <span className="hidden sm:inline">{isWholesaleMode ? 'Al Por Mayor' : 'Por Mayor'}</span>
            </button>
          )}

          {/* Floating Search Dropdown (Lista de productos en vivo desde Base de Datos) */}
          {dropdownOpen && (searchResults.length > 0 || (searchQuery.trim().length >= 1 && searchingDb)) && (
            <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in-50 duration-150">
              {/* Barra de estado / cabecera */}
              <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  {searchingDb ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-blue-600" />
                      <span>Consultando en base de datos...</span>
                    </>
                  ) : (
                    <span>{searchResults.length} productos encontrados</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  ↑↓ para navegar · Enter para agregar
                </span>
              </div>

              {/* Lista de productos */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400">
                    {searchingDb ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={22} className="animate-spin text-blue-500" />
                        <p className="text-xs">Buscando "{searchQuery.trim()}" en la base de datos...</p>
                      </div>
                    ) : (
                      <p className="text-xs font-semibold">No se encontraron productos con "{searchQuery.trim()}" en la base de datos</p>
                    )}
                  </div>
                ) : (
                  searchResults.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    const stockVal = Number(item.currentStock ?? 0);
                    const unitStr = item.unit || 'Und';
                    const isOut = stockVal <= 0 || item.stockStatus === 'out';
                    const isLow = !isOut && (stockVal <= (item.minStock || 5) || item.stockStatus === 'low');
                    const isInactive =
                      item.status === 'inactive' ||
                      item.status === 'discontinued' ||
                      (item as any).estado === 'inactivo' ||
                      (item as any).estado === 'descontinuado';
                    const isWeight =
                      Boolean(item.isWeightProduct) ||
                      Boolean((item as any).es_pesado) ||
                      item.saleType === 'weight' ||
                      item.saleType === 'both';

                    return (
                      <button
                        key={item.id || index}
                        type="button"
                        onClick={() => handleSelectProduct(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                          isInactive
                            ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50'
                            : isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-l-4 border-blue-600 pl-2.5'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        {/* Info Izquierda: Imagen/Icono + Nombre + SKU/Barcode */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden text-slate-500">
                            {item.image ? (
                              <img src={item.image} alt="" className="w-full h-full object-cover" />
                            ) : isWeight ? (
                              <Scale size={16} className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Package size={16} className="text-slate-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                                {item.name}
                              </p>
                              {isInactive && (
                                <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                  Inactivo
                                </span>
                              )}
                              {isWeight && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  <Scale size={10} /> Balanza
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.barcode && <span>Barras: {item.barcode}</span>}
                              {item.sku && <span>SKU: {item.sku}</span>}
                              {item.plu && <span>PLU: {item.plu}</span>}
                              {item.category && item.category !== 'General' && (
                                <span className="text-slate-400">· {item.category}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Info Derecha: Precio + Stock Badge */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                            {fmt(item.salePrice ?? item.price ?? 0)}
                          </p>
                          <div className="mt-0.5 flex justify-end">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                isOut
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isOut ? 'Agotado' : `${stockVal} ${unitStr}`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Factura Selector / Tipo de Comprobante Fiscal (DGII) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={fiscalEnabled ? (selectedNcfType || 'B02') : 'TICKET'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'TICKET') {
                  if (onToggleFiscal && fiscalEnabled) onToggleFiscal();
                } else {
                  if (onToggleFiscal && !fiscalEnabled) onToggleFiscal();
                  if (onSelectNcfType) onSelectNcfType(val as NCFType);
                }
              }}
              className="bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-7 h-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="TICKET">Ticket Simple (Sin NCF)</option>
              <option value="B02">Factura Consumidor Final (B02)</option>
              <option value="B01">Factura Crédito Fiscal (B01)</option>
              <option value="B14">Régimen Especial (B14)</option>
              <option value="B15">Comprobante Gubernamental (B15)</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">
              ▼
            </span>
          </div>

          {/* Badge informativo de Crédito Fiscal */}
          {fiscalEnabled && selectedNcfType === 'B01' && (
            customer?.rnc_cedula ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span>✓ RNC: {customer.rnc_cedula}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAddCustomerOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                title="B01 requiere RNC/Cédula. Clic para registrar o seleccionar cliente"
              >
                <span>⚠ B01 Requiere RNC (Clic para asignar)</span>
              </button>
            )
          )}
        </div>

        {customer && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Cliente:</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{customer.name}</span>
            <button
              type="button"
              onClick={() => onSetCustomer(null)}
              className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
              title="Quitar cliente asignado"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Row 3: Product Table Header */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-t-xl px-4 py-3 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 text-sm sm:text-[15px] font-black text-slate-800 dark:text-slate-200 flex-shrink-0">
        <div className="col-span-6 flex items-center gap-2">
          <span>Producto</span>
          <Info size={16} className="text-sky-500" strokeWidth={2.4} />
        </div>
        <div className="col-span-3 text-center">Cantidad / Peso</div>
        <div className="col-span-2 text-right">Subtotal</div>
        <div className="col-span-1 text-center text-slate-400 flex justify-center">
          <X size={18} strokeWidth={2.5} />
        </div>
      </div>

      {/* Table Body: Cart Items List */}
      <div
        ref={cartListRef}
        className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border-x border-b border-slate-200/90 dark:border-slate-700/80 rounded-b-xl mb-2.5 min-h-[160px]"
      >
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-slate-400">
            <p className="text-sm font-bold">Carrito vacío</p>
            <p className="text-xs">Busca o escanea productos para comenzar la venta</p>
          </div>
        ) : (
          cart.map((item, idx) => {
            const isLatestItem = idx === 0;
            const isWeightItem =
              item.isWeighted ||
              ['lb', 'kg', 'g', 'oz', 'libra'].some((u) => (item.unit || '').toLowerCase().includes(u));
            const unitLabel = item.unit || 'lb';
            const codeToDisplay = item.barcode || item.sku || '';
            const hasWholesale = Boolean(item.wholesalePrice && item.wholesalePrice > 0);
            const isWholesaleActive = Boolean(item.isWholesale);

            const hasDiscount = Boolean(
              (item.discount && item.discount > 0) ||
              (item.discountValue && item.discountValue > 0) ||
              (item.professionalDiscount && item.professionalDiscount > 0)
            );

            return (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3.5 sm:py-4 items-center transition-colors ${
                  isLatestItem
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="col-span-6 min-w-0 pr-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onOpenDiscountModal && onOpenDiscountModal(item)}
                        className="text-left text-[16px] sm:text-[17px] font-black text-slate-900 dark:text-slate-100 hover:text-primary truncate leading-snug cursor-pointer transition-colors"
                        title="Clic para modificar precio o agregar descuento"
                      >
                        {item.name}
                      </button>
                    ) : (
                      <span
                        className="text-left text-[16px] sm:text-[17px] font-black text-slate-900 dark:text-slate-100 truncate leading-snug select-none"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    )}

                    {isLatestItem && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white shadow-2xs">
                        Último
                      </span>
                    )}

                    {hasDiscount ? (
                      <button
                        type="button"
                        onClick={() => onOpenDiscountModal && onOpenDiscountModal(item)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer shadow-2xs"
                        title="Descuento aplicado. Clic para editar"
                      >
                        <Tag size={11} />
                        <span>
                          Desc: -{item.discountType === 'percentage'
                            ? `${(item.discountValue !== undefined ? item.discountValue : item.discount).toFixed(0)}%`
                            : `RD$ ${(item.discountValue || 0).toFixed(2)}`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenDiscountModal && onOpenDiscountModal(item)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Agregar descuento a este producto"
                      >
                        <Tag size={10} />
                        <span>+ Descuento</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenPriceModal && onOpenPriceModal(item)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                      title="Cambiar precio unitario (Solo Administradores)"
                    >
                      <DollarSign size={10} />
                      <span>Cambiar precio</span>
                    </button>

                    {hasWholesale && (
                      <button
                        type="button"
                        onClick={() => onToggleWholesale && onToggleWholesale(item.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 border ${
                          isWholesaleActive
                            ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title={
                          isWholesaleActive
                            ? 'Precio al por mayor aplicado. Clic para volver a normal'
                            : 'Cambiar a precio al por mayor'
                        }
                      >
                        <Tag size={12} className={isWholesaleActive ? 'text-white' : 'text-slate-400'} />
                        <span>{isWholesaleActive ? 'Al por mayor' : 'Por mayor'}</span>
                      </button>
                    )}
                  </div>

                  {isWeightItem ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <p className="text-xs sm:text-[13px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        {item.qty} {unitLabel} ×
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenPriceModal && onOpenPriceModal(item)}
                        className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-black text-emerald-700 dark:text-emerald-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer group"
                        title="Clic para cambiar precio por libra"
                      >
                        <span>RD$ {item.price.toFixed(2)}</span>
                        <Pencil size={11} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </button>
                      {item.isCustomPrice && (
                        <span
                          className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.2 rounded border border-blue-300 dark:border-blue-700 cursor-pointer"
                          onClick={() => onOpenPriceModal && onOpenPriceModal(item)}
                          title={`Precio original: RD$ ${(item.originalPrice ?? item.regularPrice ?? item.price).toFixed(2)}`}
                        >
                          Modificado (Orig: RD$ {(item.originalPrice ?? item.regularPrice ?? item.price).toFixed(2)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5 tracking-wide flex items-center gap-1.5 flex-wrap">
                      {codeToDisplay && <span className="font-mono">{codeToDisplay} ·</span>}
                      <button
                        type="button"
                        onClick={() => onOpenPriceModal && onOpenPriceModal(item)}
                        className="inline-flex items-center gap-1 font-black text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer group"
                        title="Clic para cambiar precio unitario"
                      >
                        <span>RD$ {item.price.toFixed(2)} c/u</span>
                        <Pencil size={11} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </button>
                      {item.isCustomPrice && (
                        <span
                          className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.2 rounded border border-blue-300 dark:border-blue-700 cursor-pointer"
                          onClick={() => onOpenPriceModal && onOpenPriceModal(item)}
                          title={`Precio original: RD$ ${(item.originalPrice ?? item.regularPrice ?? item.price).toFixed(2)}`}
                        >
                          Modificado (Orig: RD$ {(item.originalPrice ?? item.regularPrice ?? item.price).toFixed(2)})
                        </span>
                      )}
                      {isWholesaleActive && (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700">
                          (Por mayor)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-3 flex items-center justify-center gap-1.5 sm:gap-2">
                  {isWeightItem ? (
                    <button
                      type="button"
                      onClick={() => onEditWeight && onEditWeight(item)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs sm:text-sm font-black tabular-nums transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title="Editar peso"
                    >
                      <span>{item.qty} {unitLabel}</span>
                      <Pencil size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, Math.max(0, item.qty - 1))}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="Restar 1"
                      >
                        <Minus size={18} strokeWidth={3} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={item.qty === 0 ? '' : item.qty}
                        placeholder="0"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '') {
                            onUpdateQty(item.id, 0);
                          } else {
                            const n = parseFloat(val);
                            onUpdateQty(item.id, isNaN(n) ? 0 : Math.max(0, n));
                          }
                        }}
                        className={`w-12 sm:w-14 h-9 sm:h-10 text-center text-sm sm:text-base font-black border rounded-xl tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                          item.qty === 0
                            ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-850 text-slate-900 dark:text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, item.qty + 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="Sumar 1"
                      >
                        <Plus size={18} strokeWidth={3} />
                      </button>
                    </>
                  )}
                </div>

                <div className="col-span-2 text-right">
                  {hasDiscount && (
                    <p className="text-[11px] text-slate-400 line-through tabular-nums font-semibold">
                      {fmt(item.price * item.qty)}
                    </p>
                  )}
                  <p className="text-sm sm:text-base font-black tabular-nums text-slate-900 dark:text-white">
                    {fmt(item.price * item.qty * (1 - item.discount / 100))}
                  </p>
                </div>

                <div className="col-span-1 text-center flex justify-center">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-all cursor-pointer active:scale-95"
                    title="Eliminar ítem"
                  >
                    <Trash2 size={21} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary Footer (Matches Reference UI) */}
      <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex-shrink-0 space-y-2 text-xs">
        {/* Row 1: Artículos & Total */}
        <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold">Artículos:</span>
            <span className="tabular-nums font-bold text-slate-700 dark:text-slate-300">
              {totalItemsCount.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-extrabold">Total:</span>
            <span className="tabular-nums font-extrabold text-slate-900 dark:text-white">
              {total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Row 2: Descuento PUNTOS (-), Impuesto del pedido(+), Transporte(+) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-200 dark:border-slate-700">
          {/* Descuento PUNTOS (-) */}
          <div className="flex items-center gap-1">
            <span className="font-bold">Descuento</span>
            <Info size={12} className="text-sky-500 inline" />
            <span>PUNTOS (-):</span>
            <Pencil size={11} className="text-slate-700 dark:text-slate-300 cursor-pointer ml-0.5" />
            <span className="font-extrabold">0.00</span>
          </div>

          {/* Impuesto del pedido(+) */}
          <div className="flex items-center gap-1">
            <span className="font-bold">Impuesto del pedido(+):</span>
            <Info size={12} className="text-sky-500 inline" />
            <Pencil size={11} className="text-slate-700 dark:text-slate-300 cursor-pointer ml-0.5" />
            <span className="font-extrabold">{taxTotal.toFixed(2)}</span>
          </div>

          {/* Transporte(+) */}
          <div className="flex items-center gap-1">
            <span className="font-bold">Transporte(+):</span>
            <Info size={12} className="text-sky-500 inline" />
            <Pencil size={11} className="text-slate-700 dark:text-slate-300 cursor-pointer ml-0.5" />
            <span className="font-extrabold">0.00</span>
          </div>
        </div>
      </div>

      {addCustomerOpen && (
        <PosAddCustomerModal
          onClose={() => setAddCustomerOpen(false)}
          onCreated={async (c) => {
            setCustomers((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
            onSetCustomer(c);
            if (c.tipo_ncf && onSelectNcfType) {
              onSelectNcfType(c.tipo_ncf as NCFType);
            }
            await refetch();
          }}
        />
      )}
    </div>
  );
}
