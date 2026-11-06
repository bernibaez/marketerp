import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Edit,
  CheckCircle,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  ArrowLeft,
  Search,
  Lock,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import type { Cliente, Producto, MetodoPago, TipoItemVenta } from '@/types/database';
import type { VentaConDetalle, ActualizarVentaPayload, EditarVentaItem } from '@/services/ventas.service';
import { useAuth } from '@/context/AuthContext';
import { canChangePrice, isAdminOrSuperAdmin } from '@/lib/auth';
import { getStoredProducts } from '@/lib/productStore';
import { toast } from '@/lib/toast';

interface SaleEditViewProps {
  sale: VentaConDetalle;
  clients: Cliente[];
  products: Producto[];
  onSave: (data: ActualizarVentaPayload) => Promise<void>;
  onClose: () => void;
}

interface EditableSaleItem {
  id: string;
  producto_id: string | null;
  combo_id: string | null;
  tipo_item: TipoItemVenta;
  nombre_item: string;
  original_nombre_item?: string;
  sku: string | null;
  precio_unitario: number;
  costo_unitario: number;
  cantidad: number;
  porcentaje_impuesto: number;
  subtotal: number;
}

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export const SaleEditView: React.FC<SaleEditViewProps> = ({
  sale,
  clients,
  products,
  onSave,
  onClose,
}) => {
  const { user } = useAuth();
  const isAdmin = isAdminOrSuperAdmin(user);
  // Las cajeras (usuarios no administradores) solo pueden cambiar un producto por otro en la factura
  const isCashierSwapOnly = !isAdmin;

  // General sale state
  const [customerId, setCustomerId] = useState<string>(sale.cliente_id || '');
  const [paymentMethod, setPaymentMethod] = useState<MetodoPago>(sale.metodo_pago || 'efectivo');
  const [tipoNcf, setTipoNcf] = useState<string>(sale.tipo_ncf || 'B02');
  const [ncf, setNcf] = useState<string>(sale.ncf || '');
  const [montoDescuento, setMontoDescuento] = useState<number>(sale.monto_descuento || 0);
  const [estado, setEstado] = useState<string>(sale.estado || 'completada');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Line items state
  const [items, setItems] = useState<EditableSaleItem[]>(() => {
    const raw = sale.detalle_ventas ?? [];
    if (raw.length === 0) {
      return [
        {
          id: `item-${Date.now()}-1`,
          producto_id: null,
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: 'Producto / Venta rápida',
          original_nombre_item: 'Producto / Venta rápida',
          sku: null,
          precio_unitario: sale.subtotal || sale.monto_total || 0,
          costo_unitario: 0,
          cantidad: 1,
          porcentaje_impuesto:
            sale.monto_impuesto && sale.subtotal
              ? round2((sale.monto_impuesto / sale.subtotal) * 100)
              : 18,
          subtotal: sale.subtotal || sale.monto_total || 0,
        },
      ];
    }
    return raw.map((d, idx) => ({
      id: d.id || `item-${Date.now()}-${idx + 1}`,
      producto_id: d.producto_id,
      combo_id: d.combo_id ?? null,
      tipo_item: d.tipo_item,
      nombre_item: d.nombre_item,
      original_nombre_item: d.nombre_item,
      sku: (d as any).sku ?? null,
      precio_unitario: Number(d.precio_unitario || 0),
      costo_unitario: Number(d.costo_unitario || 0),
      cantidad: Number(d.cantidad || 1),
      porcentaje_impuesto: Number(d.porcentaje_impuesto ?? 18),
      subtotal: round2(Number(d.precio_unitario || 0) * Number(d.cantidad || 1)),
    }));
  });

  // Adding product state (Admin only)
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userCanChangePrice = canChangePrice(user) && !isCashierSwapOnly;

  // Product swap state (Available for both Cashiers and Admins on each row)
  const [swappingRowIndex, setSwappingRowIndex] = useState<number | null>(null);
  const [swapSearch, setSwapSearch] = useState<string>('');
  const swapInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (swappingRowIndex !== null) {
      const t = setTimeout(() => {
        swapInputRef.current?.focus();
        swapInputRef.current?.select();
      }, 40);
      return () => clearTimeout(t);
    }
  }, [swappingRowIndex]);

  const allAvailableProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    const seenIds = new Set(list.map((p) => p.id));
    const stored = getStoredProducts();
    for (const sp of stored) {
      if (!seenIds.has(sp.id) && sp.status === 'active') {
        list.push({
          id: sp.id,
          nombre: sp.name,
          codigo_barras: sp.barcode || '',
          sku: sp.sku || '',
          precio_venta: sp.salePrice || 0,
          precio_costo: sp.costPrice || 0,
          stock_actual: sp.currentStock || 0,
          porcentaje_impuesto: sp.tax || 18,
          categoria: sp.category || 'General',
          unidad: sp.unit || 'Und',
          estado: 'activo',
        } as Producto);
        seenIds.add(sp.id);
      }
    }
    return list;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allAvailableProducts.slice(0, 50);
    const q = productSearch.toLowerCase().trim();
    return allAvailableProducts
      .filter((p) => {
        const name = (p.nombre || '').toLowerCase();
        const barcode = (p.codigo_barras || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return name.includes(q) || barcode.includes(q) || sku.includes(q);
      })
      .slice(0, 50);
  }, [allAvailableProducts, productSearch]);

  const filteredSwapProducts = useMemo(() => {
    if (!swapSearch.trim()) return allAvailableProducts.slice(0, 60);
    const q = swapSearch.toLowerCase().trim();
    return allAvailableProducts
      .filter((p) => {
        const name = (p.nombre || '').toLowerCase();
        const barcode = (p.codigo_barras || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return name.includes(q) || barcode.includes(q) || sku.includes(q);
      })
      .slice(0, 60);
  }, [allAvailableProducts, swapSearch]);

  // Recalculations
  const subtotal = useMemo(() => {
    return round2(items.reduce((sum, it) => sum + it.precio_unitario * it.cantidad, 0));
  }, [items]);

  const montoImpuesto = useMemo(() => {
    return round2(
      items.reduce(
        (sum, it) => sum + it.precio_unitario * it.cantidad * ((it.porcentaje_impuesto || 0) / 100),
        0
      )
    );
  }, [items]);

  const costoTotal = useMemo(() => {
    return round2(items.reduce((sum, it) => sum + (it.costo_unitario || 0) * it.cantidad, 0));
  }, [items]);

  const nuevoMontoTotal = useMemo(() => {
    return round2(Math.max(0, subtotal + montoImpuesto - (Number(montoDescuento) || 0)));
  }, [subtotal, montoImpuesto, montoDescuento]);

  // Handler for swapping a product on a specific line item
  const handleSwapProduct = (index: number, newProd: Producto) => {
    const currentItem = items[index];
    if (!currentItem) return;

    const unitPrice = round2(newProd.precio_venta);
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        return {
          ...it,
          producto_id: newProd.id,
          combo_id: null,
          tipo_item: 'producto',
          nombre_item: newProd.nombre,
          sku: newProd.sku || newProd.codigo_barras || null,
          precio_unitario: unitPrice,
          costo_unitario: round2(newProd.precio_costo || 0),
          porcentaje_impuesto: Number(newProd.porcentaje_impuesto ?? 18),
          subtotal: round2(unitPrice * it.cantidad),
        };
      })
    );

    setSwappingRowIndex(null);
    setSwapSearch('');
    toast.success(`Producto cambiado: "${currentItem.nombre_item}" → "${newProd.nombre}"`);
  };

  // Handlers for modifying items
  const handleQuantityChange = (index: number, newQty: number) => {
    if (isCashierSwapOnly) {
      toast.error('Las cajeras solo pueden cambiar un producto por otro en la factura');
      return;
    }
    if (newQty < 0.001) return;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const q = round2(newQty);
        return {
          ...it,
          cantidad: q,
          subtotal: round2(it.precio_unitario * q),
        };
      })
    );
  };

  const handlePriceChange = (index: number, newPrice: number) => {
    if (!userCanChangePrice) {
      toast.error('Acceso denegado: Solo el Administrador o Super Administrador pueden modificar precios.');
      return;
    }
    if (newPrice < 0) return;
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        const p = round2(newPrice);
        return {
          ...it,
          precio_unitario: p,
          subtotal: round2(p * it.cantidad),
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    if (isCashierSwapOnly) {
      toast.error('Las cajeras solo pueden cambiar un producto por otro en la factura');
      return;
    }
    if (items.length <= 1) {
      toast.error('La factura debe tener al menos un producto');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    toast.success('Producto removido de la venta');
  };

  const addProductDirectly = (prod: Producto) => {
    if (isCashierSwapOnly) return;
    const targetSku = prod.sku || prod.codigo_barras;
    const existingIndex = items.findIndex(
      (it) => it.producto_id === prod.id && (!targetSku || it.sku === targetSku)
    );
    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, items[existingIndex].cantidad + 1);
      toast.success(`Incrementada cantidad de ${prod.nombre}`);
      setSelectedProductId('');
      setProductSearch('');
      setIsDropdownOpen(false);
      return;
    }

    const newItem: EditableSaleItem = {
      id: `item-${Date.now()}-${items.length + 1}`,
      producto_id: prod.id,
      combo_id: null,
      tipo_item: 'producto',
      nombre_item: prod.nombre,
      original_nombre_item: prod.nombre,
      sku: prod.sku || prod.codigo_barras || null,
      precio_unitario: round2(prod.precio_venta),
      costo_unitario: round2(prod.precio_costo || 0),
      cantidad: 1,
      porcentaje_impuesto: Number(prod.porcentaje_impuesto ?? 18),
      subtotal: round2(prod.precio_venta),
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId('');
    setProductSearch('');
    setIsDropdownOpen(false);
    toast.success(`Producto agregado: ${prod.nombre}`);
  };

  const handleAddProduct = () => {
    if (isCashierSwapOnly) return;
    if (!selectedProductId) {
      if (filteredProducts.length === 1) {
        addProductDirectly(filteredProducts[0]);
        return;
      }
      toast.error('Selecciona un producto para agregar');
      return;
    }
    const prod = allAvailableProducts.find((p) => p.id === selectedProductId);
    if (prod) {
      addProductDirectly(prod);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedProductId) {
        const prod = allAvailableProducts.find((p) => p.id === selectedProductId);
        if (prod) {
          addProductDirectly(prod);
          return;
        }
      }
      if (filteredProducts.length === 1) {
        addProductDirectly(filteredProducts[0]);
        return;
      }
      if (filteredProducts.length > 1) {
        toast.info(`Se encontraron ${filteredProducts.length} productos. Haz clic en el que deseas agregar.`);
      } else {
        toast.error(`No se encontró ningún producto con "${productSearch}"`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('La venta debe tener al menos un producto');
      return;
    }

    const effectiveCustomerId = isCashierSwapOnly ? (sale.cliente_id || '') : customerId;
    const selectedClient = clients.find((c) => c.id === effectiveCustomerId);
    const clienteNombre = selectedClient
      ? selectedClient.nombre
      : (sale.cliente_nombre || 'Cliente general (Contado)');

    setIsSubmitting(true);
    try {
      const itemsPayload: EditarVentaItem[] = items.map((it) => ({
        id: it.id,
        producto_id: it.producto_id,
        combo_id: it.combo_id,
        tipo_item: it.tipo_item,
        nombre_item: it.nombre_item,
        sku: it.sku,
        precio_unitario: it.precio_unitario,
        costo_unitario: it.costo_unitario,
        cantidad: it.cantidad,
        porcentaje_impuesto: it.porcentaje_impuesto,
        subtotal: it.subtotal,
      }));

      await onSave({
        cliente_id: effectiveCustomerId || null,
        cliente_nombre: clienteNombre,
        metodo_pago: isCashierSwapOnly ? sale.metodo_pago : paymentMethod,
        tipo_ncf: isCashierSwapOnly ? (sale.tipo_ncf || null) : (tipoNcf || null),
        ncf: isCashierSwapOnly ? (sale.ncf || null) : (ncf || null),
        subtotal,
        monto_impuesto: montoImpuesto,
        monto_descuento: isCashierSwapOnly ? Number(sale.monto_descuento || 0) : (Number(montoDescuento) || 0),
        monto_total: nuevoMontoTotal,
        costo_total: costoTotal,
        estado: (isCashierSwapOnly ? sale.estado : estado) as any,
        items: itemsPayload,
        usuario_modificador_id: user?.id || null,
        usuario_modificador_nombre: user?.name || (isCashierSwapOnly ? 'Cajera' : 'Administrador'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 slide-up max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Edit className="text-amber-500" size={26} />
            {isCashierSwapOnly
              ? `Cambiar Producto en Factura ${sale.numero_factura}`
              : `Editar Factura ${sale.numero_factura}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCashierSwapOnly
              ? 'Modo Cajera: Haz clic en «Cambiar por otro» en el producto que deseas reemplazar. El inventario y los totales se ajustarán automáticamente.'
              : 'Modifica productos, cámbialos por otros, ajusta cantidades, cliente y comprobantes. El inventario y los totales se actualizarán automáticamente.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary flex items-center gap-1.5 font-bold"
        >
          <ArrowLeft size={16} /> Volver a Ventas
        </button>
      </div>

      {/* Aviso de modo Cajera */}
      {isCashierSwapOnly && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <ArrowLeftRight size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-bold">Permiso de Cajera: Solo cambio de producto por otro</p>
            <p>
              Como cajera, puedes sustituir un producto de la factura por otro del catálogo usando el botón{' '}
              <span className="font-bold">«Cambiar por otro»</span> en la tabla de productos. Los demás campos de la factura están protegidos.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección 1: Datos de la Venta (Cliente, Pago, NCF, Estado) */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              1. Datos del Cliente y Facturación
            </h2>
            {isCashierSwapOnly && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                <Lock size={12} /> Solo lectura para cajera
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Cliente Asociado</label>
              <select
                className={`input-field w-full ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                disabled={isCashierSwapOnly}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Cliente General (Contado)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.rnc_cedula ? `(${c.rnc_cedula})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Método de Pago</label>
              <select
                className={`input-field w-full ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                disabled={isCashierSwapOnly}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as MetodoPago)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Tipo de Comprobante (NCF)</label>
              <select
                className={`input-field w-full ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                disabled={isCashierSwapOnly}
                value={tipoNcf}
                onChange={(e) => setTipoNcf(e.target.value)}
              >
                <option value="B02">Consumo (B02)</option>
                <option value="B01">Crédito Fiscal (B01)</option>
                <option value="B14">Gubernamental (B14)</option>
                <option value="B15">Para Exportaciones (B15)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Número NCF</label>
              <input
                type="text"
                disabled={isCashierSwapOnly}
                className={`input-field w-full font-mono uppercase ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                placeholder="Ej: B0200000001"
                value={ncf}
                onChange={(e) => setNcf(e.target.value)}
              />
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Estado de la Factura</label>
              <select
                disabled={isCashierSwapOnly}
                className={`input-field w-full ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="completada">Completada / Pagada</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Descuento Global (RD$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isCashierSwapOnly}
                className={`input-field w-full font-mono ${isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                value={montoDescuento}
                onChange={(e) => setMontoDescuento(Math.max(0, Number(e.target.value)))}
              />
            </div>

            <div className="lg:col-span-2 flex flex-col justify-end">
              <div className="bg-secondary/40 p-2.5 rounded-lg text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Fecha de emisión: </span>
                {new Date(sale.creado_en).toLocaleString('es-DO')}
                <span className="block mt-0.5">
                  <span className="font-medium text-foreground">Cajera emisora: </span>
                  {sale.cajero_nombre || user?.name || 'Cajera'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2: Productos y Cambio de Producto */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package size={16} /> 2. Productos de la Factura ({items.length})
            </h2>
            <div className="text-xs text-muted-foreground">
              {isCashierSwapOnly
                ? 'Haz clic en «Cambiar por otro» en la fila del producto que deseas sustituir.'
                : 'Cambia un producto por otro, ajusta cantidades o agrega/elimina productos.'}
            </div>
          </div>

          {/* Buscador y agregador de productos adicionales (Solo Administradores) */}
          {!isCashierSwapOnly && (
            <div className="bg-secondary/20 p-3.5 rounded-xl border border-border/60 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1" ref={searchContainerRef}>
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    className="input-field pl-9 w-full text-xs"
                    placeholder="Buscar por nombre, código de barras o SKU (presiona Enter para agregar)..."
                    value={productSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                  />

                  {/* Dropdown de resultados interactivo */}
                  {isDropdownOpen && productSearch.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-border">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-xs text-center text-muted-foreground">
                          No se encontraron productos que coincidan con "{productSearch}".
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => addProductDirectly(p)}
                            className="p-2.5 hover:bg-secondary/40 transition-colors flex items-center justify-between cursor-pointer gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{p.nombre}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                SKU: {p.sku || 'N/A'} {p.codigo_barras ? `| Barcode: ${p.codigo_barras}` : ''} | Stock: {p.stock_actual}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="font-black text-foreground">
                                RD$ {p.precio_venta.toLocaleString('es-DO')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductDirectly(p);
                                }}
                                className="btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1 font-bold"
                              >
                                <Plus size={12} /> Agregar
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <select
                  className="input-field sm:w-72 text-xs"
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const p = allAvailableProducts.find((it) => it.id === e.target.value);
                    if (p) addProductDirectly(p);
                  }}
                >
                  <option value="">O selecciona de la lista...</option>
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — RD$ {p.precio_venta.toLocaleString('es-DO')} (Stock: {p.stock_actual})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="btn-secondary text-xs flex items-center justify-center gap-1.5 font-bold whitespace-nowrap px-4"
                >
                  <Plus size={15} /> Agregar Producto
                </button>
              </div>
              {isDropdownOpen && productSearch.trim().length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cerrar resultados
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tabla de ítems */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-left text-muted-foreground">
                  <th className="px-3.5 py-2.5 font-semibold">Producto</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right w-28">Precio Unit. (RD$)</th>
                  <th className="px-3.5 py-2.5 font-semibold text-center w-36">Cantidad</th>
                  <th className="px-3.5 py-2.5 font-semibold text-center w-20">ITBIS</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right w-32">Subtotal (RD$)</th>
                  <th className="px-3.5 py-2.5 text-center w-44">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => {
                  const isSwappingThisRow = swappingRowIndex === idx;
                  const wasChanged =
                    item.original_nombre_item && item.original_nombre_item !== item.nombre_item;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-secondary/20 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="font-bold text-foreground flex items-center gap-2 flex-wrap">
                            <span>{item.nombre_item}</span>
                            {wasChanged && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                Reemplaza a: {item.original_nombre_item}
                              </span>
                            )}
                          </div>
                          {item.sku && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              SKU / Barcode: {item.sku}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-medium">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={!userCanChangePrice}
                              className={`input-field text-right w-24 py-1 px-1.5 text-xs font-mono inline-block ${
                                !userCanChangePrice ? 'opacity-70 bg-muted cursor-not-allowed' : ''
                              }`}
                              value={item.precio_unitario}
                              onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                              title={!userCanChangePrice ? 'Solo Administradores pueden cambiar precios' : 'Precio unitario'}
                            />
                            {!userCanChangePrice && (
                              <span title="Precio bloqueado para cajeras">
                                <Lock size={12} className="text-muted-foreground" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              className="w-7 h-7 rounded border border-border bg-card hover:bg-secondary flex items-center justify-center font-bold text-muted-foreground hover:text-foreground text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={() => handleQuantityChange(idx, item.cantidad - 1)}
                              disabled={isCashierSwapOnly || item.cantidad <= 1}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              disabled={isCashierSwapOnly}
                              className={`input-field text-center w-16 py-1 px-1 text-xs font-mono font-bold ${
                                isCashierSwapOnly ? 'opacity-70 bg-muted cursor-not-allowed' : ''
                              }`}
                              value={item.cantidad}
                              onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="w-7 h-7 rounded border border-border bg-card hover:bg-secondary flex items-center justify-center font-bold text-muted-foreground hover:text-foreground text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={() => handleQuantityChange(idx, item.cantidad + 1)}
                              disabled={isCashierSwapOnly}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="badge-neutral text-[10px]">
                            {item.porcentaje_impuesto > 0 ? `${item.porcentaje_impuesto}%` : 'Exento'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                          RD$ {item.subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isSwappingThisRow) {
                                  setSwappingRowIndex(null);
                                  setSwapSearch('');
                                } else {
                                  setSwappingRowIndex(idx);
                                  setSwapSearch('');
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isSwappingThisRow
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              }`}
                              title="Cambiar este producto por otro del catálogo"
                            >
                              <ArrowLeftRight size={13} />
                              <span>{isSwappingThisRow ? 'Cancelar' : 'Cambiar por otro'}</span>
                            </button>

                            {!isCashierSwapOnly && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar producto"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Panel desplegable en línea para elegir el nuevo producto que reemplazará al actual */}
                      {isSwappingThisRow && (
                        <tr className="bg-amber-500/5 border-b border-amber-500/30">
                          <td colSpan={6} className="p-3.5">
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                  <ArrowLeftRight size={14} />
                                  Selecciona el nuevo producto para reemplazar a «{item.nombre_item}»:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSwappingRowIndex(null);
                                    setSwapSearch('');
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                                >
                                  <X size={14} /> Cerrar
                                </button>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-2.5">
                                <div className="relative flex-1">
                                  <Search
                                    size={15}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                  />
                                  <input
                                    ref={swapInputRef}
                                    type="text"
                                    className="input-field pl-9 w-full text-xs"
                                    placeholder="Escribe el nombre, código de barras o SKU del nuevo producto..."
                                    value={swapSearch}
                                    onChange={(e) => setSwapSearch(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (filteredSwapProducts.length === 1) {
                                          handleSwapProduct(idx, filteredSwapProducts[0]);
                                        } else if (filteredSwapProducts.length > 1) {
                                          toast.info('Haz clic en el producto de la lista por el que deseas cambiarlo');
                                        }
                                      } else if (e.key === 'Escape') {
                                        setSwappingRowIndex(null);
                                        setSwapSearch('');
                                      }
                                    }}
                                  />
                                </div>

                                <select
                                  className="input-field sm:w-80 text-xs"
                                  value=""
                                  onChange={(e) => {
                                    const chosen = allAvailableProducts.find((p) => p.id === e.target.value);
                                    if (chosen) handleSwapProduct(idx, chosen);
                                  }}
                                >
                                  <option value="">O elígelo directamente de la lista...</option>
                                  {filteredSwapProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.nombre} — RD$ {p.precio_venta.toLocaleString('es-DO')} (Stock: {p.stock_actual})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="max-h-48 overflow-y-auto bg-card border border-border rounded-xl divide-y divide-border shadow-inner">
                                {filteredSwapProducts.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-muted-foreground">
                                    No se encontraron productos con "{swapSearch}".
                                  </div>
                                ) : (
                                  filteredSwapProducts.map((p) => (
                                    <div
                                      key={p.id}
                                      onClick={() => handleSwapProduct(idx, p)}
                                      className="px-3 py-2 hover:bg-amber-500/10 transition-colors flex items-center justify-between cursor-pointer gap-2 text-xs"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-bold text-foreground truncate">{p.nombre}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">
                                          SKU: {p.sku || 'N/A'}{' '}
                                          {p.codigo_barras ? `| Código: ${p.codigo_barras}` : ''} | Stock:{' '}
                                          {p.stock_actual}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2.5 flex-shrink-0">
                                        <span className="font-black text-foreground font-mono">
                                          RD$ {p.precio_venta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSwapProduct(idx, p);
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                        >
                                          <ArrowLeftRight size={11} /> Cambiar por este
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sección 3: Resumen de Totales y Auditoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alerta de Auditoría e Inventario */}
          <div className="card p-4 bg-amber-500/5 border-amber-500/30 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-1">
              <p className="font-bold">Aviso de Auditoría y Control de Inventario</p>
              <p>
                Al guardar, el producto anterior volverá al stock y se descontará el nuevo producto seleccionado automáticamente.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Responsable de edición: <span className="font-semibold text-foreground">{user?.name || 'Cajera'}</span>.
              </p>
            </div>
          </div>

          {/* Resumen Financiero Recalculado */}
          <div className="card p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-foreground">
                RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>ITBIS (18%):</span>
              <span className="font-mono font-medium text-foreground">
                RD$ {montoImpuesto.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {montoDescuento > 0 && (
              <div className="flex justify-between text-danger">
                <span>Descuento aplicado:</span>
                <span className="font-mono font-medium">
                  - RD$ {montoDescuento.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-foreground">
              <span>Total Actualizado:</span>
              <span className="font-mono text-primary">
                RD$ {nuevoMontoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-2.5 px-5 font-bold"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary text-xs py-2.5 px-6 font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            <CheckCircle size={16} />
            {isSubmitting ? 'Guardando y ajustando inventario…' : 'Guardar y Actualizar Factura'}
          </button>
        </div>
      </form>
    </div>
  );
};
