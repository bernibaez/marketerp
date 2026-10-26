import React from 'react';
import AppLayout from '@/components/AppLayout';
import { Search, Loader2, X, Plus, Trash2, Check } from 'lucide-react';
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
  onRemoveLine,
  onSavePurchase,
  saving,
  subtotal,
  taxTotal,
  grandTotal,
  onOpenNewProductModal,
}: PurchaseCreateViewProps) {
  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nueva Compra</h1>
            <p className="text-sm text-muted-foreground mt-1">Registrar orden de compra y actualizar existencias</p>
          </div>
          <button type="button" onClick={onBack} className="btn-secondary cursor-pointer">
            ← Volver a Compras
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Purchase General Info Header */}
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">Información de la Compra</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="input-field cursor-pointer"
                  >
                    <option value="">Seleccionar proveedor…</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de Compra *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="input-field cursor-pointer"
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
                    className="input-field font-mono"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="FAC-COMP-XXX"
                  />
                </div>
              </div>
            </div>

            {/* Products Table Card */}
            <div className="card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-base">Productos en la Compra</h3>
                  <p className="text-xs text-muted-foreground">
                    Escribe o escanea para agregar directamente a la lista sin abrir modales
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenProductModal}
                  className="btn-primary flex items-center gap-2 text-xs py-2 px-3.5 shadow-md self-start sm:self-auto bg-[#007052] hover:bg-[#005c43] text-white font-bold cursor-pointer transition"
                >
                  <Plus size={16} />
                  Agregar producto
                </button>
              </div>

              {/* Buscador Rápido Inline con sugerencias flotantes */}
              <div className="relative" ref={inlineDropdownRef}>
                <div className="relative flex items-center">
                  <Search
                    size={18}
                    className={`absolute left-3.5 transition-colors ${
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
                    className="input-field !pl-10 !pr-10 h-11 text-sm bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium rounded-xl w-full shadow-2xs"
                  />
                  {inlineLoading ? (
                    <Loader2 size={16} className="absolute right-3.5 text-[#007052] animate-spin" />
                  ) : inlineSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineSearch('');
                        setInlineOpen(false);
                        inlineSearchRef.current?.focus();
                      }}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                      title="Limpiar"
                    >
                      <X size={15} />
                    </button>
                  ) : null}
                </div>

                {/* Sugerencias flotantes */}
                {inlineOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                    {inlineResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                        <p>
                          No se encontraron productos en la base de datos para &quot;{inlineSearch}&quot;
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
                          <span>Sugerencias ({inlineResults.length}) · Haz clic o presiona Enter para agregar</span>
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
                              className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors gap-3 ${
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
                                      En la orden
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  SKU: <strong className="text-slate-700 dark:text-slate-300">{p.sku}</strong>
                                  {p.barcode && <span> · Barra: {p.barcode}</span>}
                                  <span> · Stock: {p.currentStock} {p.unit}</span>
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0 flex items-center gap-3">
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
                                  className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-[#007052] dark:text-emerald-300 hover:bg-[#007052] hover:text-white transition shadow-2xs cursor-pointer"
                                  title="Agregar a la compra"
                                >
                                  <Plus size={14} />
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left py-2.5 px-3 text-muted-foreground font-semibold">Producto</th>
                      <th className="text-center py-2.5 px-3 text-muted-foreground font-semibold">Cantidad</th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">
                        Precio compra
                        <span className="block text-[10px] font-normal normal-case">editable</span>
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">
                        Precio venta
                        <span className="block text-[10px] font-normal normal-case text-emerald-600">editable</span>
                      </th>
                      <th className="text-center py-2.5 px-3 text-muted-foreground font-semibold">Margen</th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground font-semibold">Subtotal</th>
                      <th className="text-center py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {purchaseItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground">
                          No has agregado ningún producto a esta compra. Escribe en el buscador superior o haz clic en{' '}
                          <strong>Agregar producto</strong>.
                        </td>
                      </tr>
                    ) : (
                      purchaseItems.map((item) => {
                        const marginAmt = item.salePrice - item.price;
                        const marginPct = item.price > 0 ? (marginAmt / item.price) * 100 : 0;

                        return (
                          <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-foreground">{item.name}</p>
                              <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={0.001}
                                step="0.001"
                                value={item.qty}
                                onChange={(e) => onUpdateLineQty(item.id, parseFloat(e.target.value) || 0)}
                                className="input-field w-24 text-center py-1 font-bold"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <span className="text-[10px] text-muted-foreground font-semibold">RD$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) => onUpdateLinePrice(item.id, Number(e.target.value))}
                                  className="input-field w-28 text-right py-1.5 font-bold tabular-nums"
                                  title="Precio de compra / costo"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <span className="text-[10px] text-emerald-600 font-semibold">RD$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.salePrice}
                                  onChange={(e) => onUpdateLineSalePrice(item.id, Number(e.target.value))}
                                  className="input-field w-28 text-right py-1.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  title="Precio de venta"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold tabular-nums ${
                                  marginAmt >= 0
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-danger-bg text-danger border border-danger/20'
                                }`}
                              >
                                {marginPct >= 0 ? `+${marginPct.toFixed(0)}%` : `${marginPct.toFixed(0)}%`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-foreground tabular-nums">
                              RD$ {(item.qty * item.price).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => onRemoveLine(item.id)}
                                className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-bg rounded-lg transition-colors cursor-pointer"
                                title="Eliminar ítem"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Summary Column */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3 bg-card border border-border shadow-sm">
              <h3 className="font-semibold text-foreground border-b border-border pb-2">Resumen de la Compra</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ítems Totales</span>
                <span className="font-bold text-foreground">
                  {purchaseItems.reduce((s, i) => s + i.qty, 0)} unidades
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold tabular-nums">
                  RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ITBIS Estimado (18%)</span>
                <span className="font-bold tabular-nums">
                  RD$ {taxTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-black text-lg text-foreground">
                <span>Total Final</span>
                <span className="text-primary tabular-nums">
                  RD$ {grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="card p-5 space-y-2">
              <h3 className="font-semibold text-foreground text-sm">Observaciones / Notas</h3>
              <textarea
                className="input-field text-xs"
                rows={3}
                placeholder="Instrucciones de entrega, detalles del proveedor..."
              />
            </div>

            <button
              type="button"
              onClick={() => void onSavePurchase()}
              disabled={saving || purchaseItems.length === 0}
              className="btn-primary w-full py-3 text-base font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Check size={18} />
              {saving ? 'Guardando…' : 'Guardar Compra'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
