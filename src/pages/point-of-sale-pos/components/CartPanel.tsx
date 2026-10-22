import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  User,
  Search,
  Plus,
  CreditCard,
  Info,
  X,
  Pencil,
  Minus,
  Trash2,
  Banknote,
  FileText,
  Barcode,
  Tag,
} from 'lucide-react';
import type { CartItem, Customer } from './POSTerminal';
import { useClientes } from '@/hooks/useClientes';
import { useProductos } from '@/hooks/useProductos';
import { initialProducts } from '@/pages/product-management/components/ProductManagementScreen';
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
}: CartPanelProps) {
  const { clientes, refetch } = useClientes('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { productosUi } = useProductos({ pagina: 1, limite: 200, estado: 'todos' });

  // Merge store products and initialProducts for comprehensive local search matching
  const allProducts = useMemo(() => {
    const list = [...productosUi];
    const skus = new Set(list.map((p) => p.sku.toLowerCase()));
    for (const p of initialProducts) {
      if (!skus.has(p.sku.toLowerCase())) {
        list.push(p as any);
      }
    }
    return list;
  }, [productosUi]);

  // Filtered search results for the floating autocomplete dropdown
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return allProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || sku.includes(q) || barcode.includes(q);
    }).slice(0, 15);
  }, [searchQuery, allProducts]);

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
    if (onAddToCart) {
      onAddToCart({
        id: `cart-${p.id}-${Date.now()}`,
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || '',
        price: p.salePrice ?? p.price,
        regularPrice: p.salePrice ?? p.price,
        wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
        isWholesale: false,
        cost: p.costPrice ?? p.cost ?? 0,
        tax: p.tax ?? 18,
        image: p.image || '',
        unit: p.unit || 'Und',
        isWeighted: p.isWeightProduct || p.saleType === 'weight' || p.unit?.toLowerCase().includes('lb'),
      });
    }
    if (onSearchChange) onSearchChange('');
    setDropdownOpen(false);
    const input = document.getElementById('pos-barcode-search-input');
    if (input) input.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (searchResults.length > 0) {
        const qTrim = searchQuery.trim().toLowerCase();
        const exact = searchResults.find(
          (p) =>
            (p.barcode && p.barcode.toLowerCase() === qTrim) ||
            (p.sku && p.sku.toLowerCase() === qTrim)
        );
        handleSelectProduct(exact || searchResults[0]);
        return;
      }
      const valueToSubmit = searchQuery.trim();
      if (!valueToSubmit) return;
      if (onSearchChange) onSearchChange('');
      setDropdownOpen(false);
      if (onSearchSubmit) {
        void onSearchSubmit(valueToSubmit);
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

          {/* Floating Search Dropdown (Matches Reference Image) */}
          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((item) => {
                const stockVal = item.currentStock ?? 0;
                const unitStr = item.unit || 'Und';
                const codeStr = item.barcode || item.sku || '';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProduct(item)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-start gap-2.5 cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 text-slate-500 group-hover:text-blue-600">
                      <Banknote size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-snug truncate">
                        {item.name} {codeStr ? `(${codeStr})` : ''}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        Price: {Number(item.salePrice || 0).toFixed(2)} - {stockVal.toFixed(2)}{unitStr}
                      </p>
                    </div>
                  </button>
                );
              })}
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
              <option value="B02">Factura Consumidor Final (B02)</option>
              <option value="B01">Factura Crédito Fiscal (B01)</option>
              <option value="B14">Régimen Especial (B14)</option>
              <option value="B15">Comprobante Gubernamental (B15)</option>
              <option value="TICKET">Ticket Simple (Sin NCF)</option>
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
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border-x border-b border-slate-200/90 dark:border-slate-700/80 rounded-b-xl mb-2.5 min-h-[160px]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-slate-400">
            <p className="text-sm font-bold">Carrito vacío</p>
            <p className="text-xs">Busca o escanea productos para comenzar la venta</p>
          </div>
        ) : (
          cart.map((item) => {
            const isWeightItem =
              item.isWeighted ||
              ['lb', 'kg', 'g', 'oz', 'libra'].some((u) => (item.unit || '').toLowerCase().includes(u));
            const unitLabel = item.unit || 'lb';
            const codeToDisplay = item.barcode || item.sku || '';
            const hasWholesale = Boolean(item.wholesalePrice && item.wholesalePrice > 0);
            const isWholesaleActive = Boolean(item.isWholesale);

            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-2 px-4 py-3.5 sm:py-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="col-span-6 min-w-0 pr-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[16px] sm:text-[17px] font-black text-slate-900 dark:text-slate-100 truncate leading-snug">
                      {item.name}
                    </p>
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
                    <p className="text-xs sm:text-[13px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                      {item.qty} {unitLabel} × RD$ {item.price}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-[13px] font-mono font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5 tracking-wide">
                      {codeToDisplay}
                    </p>
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
