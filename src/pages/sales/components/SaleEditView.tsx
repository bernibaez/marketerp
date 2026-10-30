import React, { useState, useMemo } from 'react';
import {
  Edit,
  CheckCircle,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  ArrowLeft,
  Search,
} from 'lucide-react';
import type { Cliente, Producto, MetodoPago, TipoItemVenta } from '@/types/database';
import type { VentaConDetalle, ActualizarVentaPayload, EditarVentaItem } from '@/services/ventas.service';
import { useAuth } from '@/context/AuthContext';
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
          sku: null,
          precio_unitario: sale.subtotal || sale.monto_total || 0,
          costo_unitario: 0,
          cantidad: 1,
          porcentaje_impuesto: sale.monto_impuesto && sale.subtotal ? round2((sale.monto_impuesto / sale.subtotal) * 100) : 18,
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
      sku: (d as any).sku ?? null,
      precio_unitario: Number(d.precio_unitario || 0),
      costo_unitario: Number(d.costo_unitario || 0),
      cantidad: Number(d.cantidad || 1),
      porcentaje_impuesto: Number(d.porcentaje_impuesto ?? 18),
      subtotal: round2(Number(d.precio_unitario || 0) * Number(d.cantidad || 1)),
    }));
  });

  // Adding product state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 50);
    const q = productSearch.toLowerCase().trim();
    return products
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.codigo_barras.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [products, productSearch]);

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

  // Handlers for modifying items
  const handleQuantityChange = (index: number, newQty: number) => {
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
    if (items.length <= 1) {
      toast.error('La factura debe tener al menos un producto');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    toast.success('Producto removido de la venta');
  };

  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error('Selecciona un producto para agregar');
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    // Check if product is already in items
    const existingIndex = items.findIndex((it) => it.producto_id === prod.id);
    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, items[existingIndex].cantidad + 1);
      toast.success(`Incrementada cantidad de ${prod.nombre}`);
      setSelectedProductId('');
      setProductSearch('');
      return;
    }

    const newItem: EditableSaleItem = {
      id: `item-${Date.now()}-${items.length + 1}`,
      producto_id: prod.id,
      combo_id: null,
      tipo_item: 'producto',
      nombre_item: prod.nombre,
      sku: prod.sku || prod.codigo_barras,
      precio_unitario: round2(prod.precio_venta),
      costo_unitario: round2(prod.precio_costo || 0),
      cantidad: 1,
      porcentaje_impuesto: Number(prod.porcentaje_impuesto ?? 18),
      subtotal: round2(prod.precio_venta),
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProductId('');
    setProductSearch('');
    toast.success(`Producto agregado: ${prod.nombre}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('La venta debe tener al menos un producto');
      return;
    }

    const selectedClient = clients.find((c) => c.id === customerId);
    const clienteNombre = selectedClient ? selectedClient.nombre : 'Cliente general (Contado)';

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
        cliente_id: customerId || null,
        cliente_nombre: clienteNombre,
        metodo_pago: paymentMethod,
        tipo_ncf: tipoNcf || null,
        ncf: ncf || null,
        subtotal,
        monto_impuesto: montoImpuesto,
        monto_descuento: Number(montoDescuento) || 0,
        monto_total: nuevoMontoTotal,
        costo_total: costoTotal,
        estado: estado as any,
        items: itemsPayload,
        usuario_modificador_id: user?.id || null,
        usuario_modificador_nombre: user?.name || 'Administrador',
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
            Editar Factura {sale.numero_factura}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modifica productos, cantidades, cliente y comprobantes. El inventario y los totales se actualizarán automáticamente.
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección 1: Datos de la Venta (Cliente, Pago, NCF, Estado) */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            1. Datos del Cliente y Facturación
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Cliente Asociado</label>
              <select
                className="input-field w-full"
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
                className="input-field w-full"
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
                className="input-field w-full"
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
                className="input-field w-full font-mono uppercase"
                placeholder="Ej: B0200000001"
                value={ncf}
                onChange={(e) => setNcf(e.target.value)}
              />
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Estado de la Factura</label>
              <select
                className="input-field w-full"
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
                className="input-field w-full font-mono"
                value={montoDescuento}
                onChange={(e) => setMontoDescuento(Math.max(0, Number(e.target.value)))}
              />
            </div>

            <div className="lg:col-span-2 flex flex-col justify-end">
              <div className="bg-secondary/40 p-2.5 rounded-lg text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Fecha original: </span>
                {new Date(sale.creado_en).toLocaleString('es-DO')}
                {sale.cajero_nombre && (
                  <span className="block mt-0.5">
                    <span className="font-medium text-foreground">Cajero responsable: </span>
                    {sale.cajero_nombre}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2: Productos y Cantidades */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package size={16} /> 2. Productos de la Factura ({items.length})
            </h2>
            <div className="text-xs text-muted-foreground">
              Ajusta las cantidades o elimina/agrega productos según corresponda.
            </div>
          </div>

          {/* Buscador y agregador de productos */}
          <div className="bg-secondary/20 p-3.5 rounded-xl border border-border/60 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                className="input-field pl-9 w-full text-xs"
                placeholder="Buscar por nombre, código de barras o SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <select
              className="input-field sm:w-72 text-xs"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Seleccionar producto a agregar...</option>
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
                  <th className="px-3.5 py-2.5 text-center w-12">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-foreground">{item.nombre_item}</div>
                      {item.sku && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          SKU / Barcode: {item.sku}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-field text-right w-24 py-1 px-1.5 text-xs font-mono inline-block"
                        value={item.precio_unitario}
                        onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          className="w-7 h-7 rounded border border-border bg-card hover:bg-secondary flex items-center justify-center font-bold text-muted-foreground hover:text-foreground text-sm"
                          onClick={() => handleQuantityChange(idx, item.cantidad - 1)}
                          disabled={item.cantidad <= 1}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          className="input-field text-center w-16 py-1 px-1 text-xs font-mono font-bold"
                          value={item.cantidad}
                          onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="w-7 h-7 rounded border border-border bg-card hover:bg-secondary flex items-center justify-center font-bold text-muted-foreground hover:text-foreground text-sm"
                          onClick={() => handleQuantityChange(idx, item.cantidad + 1)}
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
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
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
                Al confirmar, el sistema calculará automáticamente las diferencias de existencias (delta) y reajustará el stock de cada producto.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Responsable de edición: <span className="font-semibold text-foreground">{user?.name || 'Administrador'}</span>.
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
