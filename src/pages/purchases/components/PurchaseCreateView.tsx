import React, { useState, useMemo, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { Search, Loader2, X, Plus, Trash2, Check, ChevronDown } from 'lucide-react';
import type { ProductItem } from '@/lib/productStore';
import type { Proveedor } from '@/services/proveedores.service';

export interface PurchaseLineItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
  salePrice: number;
  wholesalePrice: number;
  taxPercent: number;
}

interface PurchaseCreateViewProps {
  supplierId: string;
  setSupplierId: (v: string) => void;
  proveedores: Proveedor[];
  purchaseDate: string;
  setPurchaseDate: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  purchaseItems: PurchaseLineItem[];
  onOpenProductModal: () => void;
  onBack: () => void;
  inlineSearch: string;
  setInlineSearch: (v: string) => void;
  inlineResults: ProductItem[];
  inlineLoading: boolean;
  inlineOpen: boolean;
  setInlineOpen: (v: boolean) => void;
  inlineHighlightIndex: number;
  setInlineHighlightIndex: (v: number) => void;
  inlineSearchRef: React.RefObject<HTMLInputElement | null>;
  inlineDropdownRef: React.RefObject<HTMLDivElement | null>;
  onInlineKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectInlineProduct: (p: ProductItem) => void;
  onUpdateLineQty: (id: string, qty: number) => void;
  onUpdateLinePrice: (id: string, price: number) => void;
  onUpdateLineSalePrice: (id: string, salePrice: number) => void;
  onUpdateLineWholesalePrice: (id: string, wholesalePrice: number) => void;
  onRemoveLine: (id: string) => void;
  onSavePurchase: () => Promise<void>;
  saving: boolean;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  onOpenNewProductModal: (name: string) => void;
}

export function PurchaseCreateView({
  supplierId,
  setSupplierId,
  proveedores,
  purchaseDate,
  setPurchaseDate,
  paymentMethod,
  setPaymentMethod,
  invoiceNumber,
  setInvoiceNumber,
  purchaseItems,
  onOpenProductModal,
  onBack,
  inlineSearch,
  setInlineSearch,
  inlineResults,
  inlineLoading,
  inlineOpen,
  setInlineOpen,
  inlineHighlightIndex,
  setInlineHighlightIndex,
  inlineSearchRef,
  inlineDropdownRef,
  onInlineKeyDown,
  onSelectInlineProduct,
  onUpdateLineQty,
  onUpdateLinePrice,
  onUpdateLineSalePrice,
  onUpdateLineWholesalePrice,
  onRemoveLine,
  onSavePurchase,
  saving,
  subtotal,
  taxTotal,
  grandTotal,
  onOpenNewProductModal,
}: PurchaseCreateViewProps) {
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierHighlightIndex, setSupplierHighlightIndex] = useState(0);
  const supplierContainerRef = useRef<HTMLDivElement>(null);

  // Sincronizar texto cuando cambia el supplierId seleccionado
  useEffect(() => {
    if (supplierId) {
      const found = proveedores.find((p) => p.id === supplierId);
      if (found) {
        setSupplierSearch(found.nombre);
      }
    } else {
      setSupplierSearch('');
    }
  }, [supplierId, proveedores]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierContainerRef.current && !supplierContainerRef.current.contains(e.target as Node)) {
        setSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar proveedores en tiempo real por nombre, código o teléfono
  const filteredProveedores = useMemo(() => {
    if (!supplierSearch.trim()) return proveedores;
    const q = supplierSearch.toLowerCase().trim();
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.telefono && p.telefono.includes(q))
    );
  }, [proveedores, supplierSearch]);

  const handleSelectSupplier = (p: Proveedor) => {
    setSupplierId(p.id);
    setSupplierSearch(p.nombre);
    setSupplierDropdownOpen(false);
  };

  const handleClearSupplier = () => {
    setSupplierId('');
    setSupplierSearch('');
    setSupplierDropdownOpen(false);
  };

  const handleSupplierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!supplierDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setSupplierDropdownOpen(true);
        return;
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSupplierHighlightIndex((prev) => (prev + 1 < filteredProveedores.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSupplierHighlightIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredProveedores.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProveedores[supplierHighlightIndex]) {
        handleSelectSupplier(filteredProveedores[supplierHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setSupplierDropdownOpen(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 slide-up">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Nueva Compra</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Registrar orden de compra y actualizar existencias
            </p>
          </div>
          <button type="button" onClick={onBack} className="btn-secondary text-xs sm:text-sm cursor-pointer">
            ← Volver a Compras
          </button>
        </div>

        {/* Fila Superior: Información de la compra y Resumen */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Información General de la Compra y Observaciones */}
          <div className="lg:col-span-2 card p-4 sm:p-5 space-y-3.5">
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Información de la Compra</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Selector de Proveedor Autocompletable y Escribible */}
              <div className="relative" ref={supplierContainerRef}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Proveedor * <span className="font-normal text-muted-foreground/80">(escribe para buscar o selecciona)</span>
                </label>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setSupplierDropdownOpen(true);
                      setSupplierHighlightIndex(0);
                      if (!e.target.value.trim()) {
                        setSupplierId('');
                      }
                    }}
                    onFocus={() => setSupplierDropdownOpen(true)}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Escribe el nombre del proveedor..."
                    className="input-field text-xs pl-8 pr-16 h-9 cursor-text"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {supplierId ? (
                      <button
                        type="button"
                        onClick={handleClearSupplier}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                        title="Limpiar proveedor"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSupplierDropdownOpen((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                      title="Ver lista de proveedores"
                    >
                      <ChevronDown size={14} className={`transition-transform ${supplierDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Dropdown flotante con lista filtrada */}
                {supplierDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                    {filteredProveedores.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No se encontraron proveedores para &quot;{supplierSearch}&quot;
                      </div>
                    ) : (
                      filteredProveedores.map((p, idx) => {
                        const isSelected = p.id === supplierId;
                        const isHighlighted = idx === supplierHighlightIndex;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectSupplier(p)}
                            onMouseEnter={() => setSupplierHighlightIndex(idx)}
                            className={`p-2.5 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                              isHighlighted
                                ? 'bg-secondary/70 text-foreground'
                                : isSelected
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'hover:bg-secondary/40 text-foreground'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold truncate">{p.nombre}</p>
                              {(p.codigo || p.telefono) && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {p.codigo ? `Cód: ${p.codigo}` : ''}
                                  {p.codigo && p.telefono ? ' · ' : ''}
                                  {p.telefono ? `Tel: ${p.telefono}` : ''}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <Check size={14} className="text-primary shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Compra *</label>
                <input
                  type="date"
                  className="input-field text-xs"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field text-xs cursor-pointer"
                >
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Crédito">Crédito</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  No. Factura / Comprobante Proveedor
                </label>
                <input
                  className="input-field font-mono text-xs"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-COMP-XXX"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Observaciones / Notas <span className="font-normal text-muted-foreground">(Opcional)</span>
                </label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="Instrucciones de entrega, detalles del proveedor..."
                />
              </div>
            </div>
          </div>

          {/* Resumen Financiero y Botón de Guardado */}
          <div className="card p-4 sm:p-5 space-y-3.5 flex flex-col justify-between bg-card border border-border shadow-xs">
            <div className="space-y-2.5">
              <h3 className="font-semibold text-foreground border-b border-border pb-2 text-sm sm:text-base">
                Resumen de la Compra
              </h3>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Ítems Totales</span>
                <span className="font-bold text-foreground">
                  {purchaseItems.reduce((s, i) => s + i.qty, 0)} unidades
                </span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold tabular-nums">
                  RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">ITBIS Estimado (18%)</span>
                <span className="font-bold tabular-nums">
                  RD$ {taxTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-border pt-2.5 flex justify-between font-black text-base sm:text-lg text-foreground">
                <span>Total Final</span>
                <span className="text-primary tabular-nums">
                  RD$ {grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void onSavePurchase()}
              disabled={saving || purchaseItems.length === 0}
              className="btn-primary w-full py-2.5 sm:py-3 text-sm sm:text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition active:scale-[0.99]"
            >
              <Check size={18} />
              {saving ? 'Guardando…' : 'Guardar Compra'}
            </button>
          </div>
        </div>

        {/* Fila Inferior: Tabla de Productos en la Compra ajustada para ver todos los renglones */}
        <div className="card p-4 sm:p-5 space-y-3.5 w-full border border-border shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base sm:text-lg">Productos en la Compra</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  {purchaseItems.length} {purchaseItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Renglones ajustados con precios, margen y subtotales visibles simultáneamente
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenProductModal}
              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3.5 shadow-xs self-start sm:self-auto bg-[#007052] hover:bg-[#005c43] text-white font-bold cursor-pointer transition shrink-0"
            >
              <Plus size={15} />
              Agregar producto
            </button>
          </div>

          {/* Buscador Rápido Inline con sugerencias flotantes */}
          <div className="relative" ref={inlineDropdownRef}>
            <div className="relative flex items-center">
              <Search
                size={16}
                className={`absolute left-3 transition-colors ${
                  inlineLoading ? 'text-[#007052] animate-pulse' : 'text-slate-400'
                }`}
              />
              <input
                ref={inlineSearchRef}
                type="text"
                value={inlineSearch}
                onChange={(e) => setInlineSearch(e.target.value)}
                onFocus={() => {
                  if (inlineResults.length > 0) setInlineOpen(true);
                }}
                onKeyDown={onInlineKeyDown}
                placeholder="Escribe el nombre, código de barras o SKU para agregar directamente... (Enter para añadir)"
                className="input-field !pl-9 !pr-9 h-10 text-xs sm:text-sm bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium rounded-xl w-full shadow-2xs"
              />
              {inlineLoading ? (
                <Loader2 size={15} className="absolute right-3 text-[#007052] animate-spin" />
              ) : inlineSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setInlineSearch('');
                    setInlineOpen(false);
                    inlineSearchRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                  title="Limpiar"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {/* Sugerencias flotantes */}
            {inlineOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                {inlineResults.length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-muted-foreground space-y-2">
                    <p>
                      No se encontraron productos para &quot;{inlineSearch}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineOpen(false);
                        onOpenNewProductModal(inlineSearch.trim());
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#007052] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs hover:bg-[#005c43] transition cursor-pointer"
                    >
                      <Plus size={13} />
                      Crear &quot;{inlineSearch}&quot; como nuevo producto
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                      <span>Sugerencias ({inlineResults.length}) · Enter o clic para agregar</span>
                      <span className="text-[10px] text-muted-foreground">↑↓ para seleccionar</span>
                    </div>
                    {inlineResults.map((p, idx) => {
                      const isHighlighted = idx === inlineHighlightIndex;
                      const alreadyInCart = purchaseItems.some((i) => i.productId === p.id);

                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelectInlineProduct(p)}
                          onMouseEnter={() => setInlineHighlightIndex(idx)}
                          className={`px-3.5 py-2 flex items-center justify-between cursor-pointer transition-colors gap-2.5 ${
                            isHighlighted
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-[#007052]'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {p.name}
                              </p>
                              {alreadyInCart && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                  En orden
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              SKU: <strong className="text-slate-700 dark:text-slate-300">{p.sku}</strong>
                              {p.barcode && <span> · Barra: {p.barcode}</span>}
                              <span> · Stock: {p.currentStock} {p.unit}</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 flex items-center gap-2.5">
                            <div className="text-right">
                              <p className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                Costo: RD$ {(p.costPrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-[10px] text-emerald-600 font-semibold font-mono">
                                Venta: RD$ {(p.salePrice || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#007052] dark:text-emerald-300 hover:bg-[#007052] hover:text-white transition shadow-2xs cursor-pointer"
                              title="Agregar a la compra"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Renglones Ajustada y Compacta */}
          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-slate-600 dark:text-slate-300">
                  <th className="text-left py-2.5 px-3 font-bold min-w-[150px]">Producto</th>
                  <th className="text-center py-2.5 px-2 font-bold w-20 sm:w-24">Cant.</th>
                  <th className="text-right py-2.5 px-2 font-bold w-28 sm:w-32">
                    P. Compra
                    <span className="block text-[9px] font-normal text-muted-foreground">costo</span>
                  </th>
                  <th className="text-right py-2.5 px-2 font-bold w-28 sm:w-32">
                    P. Venta
                    <span className="block text-[9px] font-normal text-emerald-600">público</span>
                  </th>
                  {/* Margen justo al lado del precio de venta */}
                  <th className="text-center py-2.5 px-2 font-bold w-24 sm:w-28">
                    Margen Venta
                    <span className="block text-[9px] font-normal text-emerald-600">% ganancia</span>
                  </th>
                  <th className="text-right py-2.5 px-2 font-bold w-24 sm:w-28">
                    P. Mayor
                    <span className="block text-[9px] font-normal text-amber-600 dark:text-amber-400">mayorista</span>
                  </th>
                  {/* Margen Mayor justo al lado de P. Mayor */}
                  <th className="text-center py-2.5 px-2 font-bold w-20 sm:w-24">
                    Margen Mayor
                    <span className="block text-[9px] font-normal text-amber-600 dark:text-amber-400">% ganancia</span>
                  </th>
                  <th className="text-right py-2.5 px-3 font-bold w-24 sm:w-28">Subtotal</th>
                  <th className="text-center py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {purchaseItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      No has agregado ningún producto a esta compra. Escribe en el buscador superior o haz clic en{' '}
                      <strong>Agregar producto</strong>.
                    </td>
                  </tr>
                ) : (
                  purchaseItems.map((item, idx) => {
                    const marginAmt = item.salePrice - item.price;
                    const marginPct = item.price > 0 ? (marginAmt / item.price) * 100 : 0;
                    const wholesaleMarginAmt = (item.wholesalePrice || 0) - item.price;
                    const wholesaleMarginPct =
                      item.price > 0 && item.wholesalePrice ? (wholesaleMarginAmt / item.price) * 100 : 0;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-secondary/30 transition-colors ${
                          idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/40 dark:bg-slate-900/20'
                        }`}
                      >
                        {/* Producto */}
                        <td className="py-2 px-3">
                          <p className="font-bold text-foreground text-xs truncate max-w-[220px]" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{item.sku}</p>
                        </td>

                        {/* Cantidad */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min={0.001}
                            step="0.001"
                            value={item.qty}
                            onChange={(e) => onUpdateLineQty(item.id, parseFloat(e.target.value) || 0)}
                            className="input-field w-16 sm:w-20 text-center py-1 px-1 font-bold text-xs"
                          />
                        </td>

                        {/* Precio Compra */}
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-[9px] text-muted-foreground font-semibold">RD$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              onChange={(e) => onUpdateLinePrice(item.id, Number(e.target.value))}
                              className="input-field w-20 sm:w-24 text-right py-1 px-1.5 font-bold font-mono text-xs tabular-nums"
                              title="Precio de compra / costo"
                            />
                          </div>
                        </td>

                        {/* Precio Venta */}
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-[9px] text-emerald-600 font-semibold">RD$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.salePrice}
                              onChange={(e) => onUpdateLineSalePrice(item.id, Number(e.target.value))}
                              className="input-field w-20 sm:w-24 text-right py-1 px-1.5 font-bold font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              title="Precio de venta"
                            />
                          </div>
                        </td>

                        {/* Margen Venta justo al lado de Precio de Venta */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums leading-tight ${
                                marginAmt >= 0
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-danger-bg text-danger border border-danger/20'
                              }`}
                              title={`Ganancia unitaria: RD$ ${marginAmt.toFixed(2)}`}
                            >
                              {marginPct >= 0 ? `+${marginPct.toFixed(0)}%` : `${marginPct.toFixed(0)}%`}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground mt-0.5 tabular-nums">
                              {marginAmt >= 0 ? `+${marginAmt.toFixed(2)}` : `${marginAmt.toFixed(2)}`}
                            </span>
                          </div>
                        </td>

                        {/* Precio Al Por Mayor */}
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span className="text-[9px] text-amber-600 font-semibold">RD$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.wholesalePrice || 0}
                              onChange={(e) => onUpdateLineWholesalePrice(item.id, Number(e.target.value))}
                              className="input-field w-20 sm:w-24 text-right py-1 px-1.5 font-bold font-mono text-xs tabular-nums text-amber-600 dark:text-amber-400 border-amber-500/30"
                              title="Precio de venta al por mayor"
                            />
                          </div>
                        </td>

                        {/* Margen Al Por Mayor justo al lado */}
                        <td className="py-2 px-2 text-center">
                          {item.wholesalePrice && item.wholesalePrice > 0 ? (
                            <div className="flex flex-col items-center justify-center">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums leading-tight ${
                                  wholesaleMarginAmt >= 0
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-danger-bg text-danger border border-danger/20'
                                }`}
                                title={`Ganancia mayorista unitaria: RD$ ${wholesaleMarginAmt.toFixed(2)}`}
                              >
                                {wholesaleMarginPct >= 0 ? `+${wholesaleMarginPct.toFixed(0)}%` : `${wholesaleMarginPct.toFixed(0)}%`}
                              </span>
                              <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                                {wholesaleMarginAmt >= 0 ? `+${wholesaleMarginAmt.toFixed(2)}` : `${wholesaleMarginAmt.toFixed(2)}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">-</span>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="py-2 px-3 text-right font-black text-foreground tabular-nums text-xs whitespace-nowrap">
                          RD$ {(item.qty * item.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Acciones */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveLine(item.id)}
                            className="p-1 text-muted-foreground hover:text-danger hover:bg-danger-bg rounded-md transition-colors cursor-pointer"
                            title="Eliminar renglón"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Barra inferior de totales y acción rápida si hay ítems */}
          {purchaseItems.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/80">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>
                  Renglones:{' '}
                  <strong className="text-foreground font-mono">{purchaseItems.length}</strong>
                </span>
                <span>
                  Unidades totales:{' '}
                  <strong className="text-foreground font-mono">
                    {purchaseItems.reduce((s, i) => s + i.qty, 0)}
                  </strong>
                </span>
                <span>
                  Subtotal:{' '}
                  <strong className="text-foreground font-mono">
                    RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onSavePurchase()}
                disabled={saving || purchaseItems.length === 0}
                className="btn-primary py-2 px-5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs self-end sm:self-auto disabled:opacity-50 cursor-pointer"
              >
                <Check size={15} />
                {saving ? 'Guardando…' : 'Guardar Compra'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
