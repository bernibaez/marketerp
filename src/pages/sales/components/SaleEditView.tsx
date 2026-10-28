import React, { useState } from 'react';
import { Edit, CheckCircle } from 'lucide-react';
import type { Cliente, MetodoPago } from '@/types/database';
import type { VentaConDetalle } from '@/services/ventas.service';

interface SaleEditViewProps {
  sale: VentaConDetalle;
  clients: Cliente[];
  onSave: (data: {
    cliente_id: string | null;
    metodo_pago: MetodoPago;
    tipo_ncf: string | null;
    ncf: string | null;
    monto_descuento: number;
    monto_total: number;
    estado: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const SaleEditView: React.FC<SaleEditViewProps> = ({
  sale,
  clients,
  onSave,
  onClose,
}) => {
  const [customerId, setCustomerId] = useState<string>(sale.cliente_id || '');
  const [paymentMethod, setPaymentMethod] = useState<MetodoPago>(sale.metodo_pago || 'efectivo');
  const [tipoNcf, setTipoNcf] = useState<string>(sale.tipo_ncf || 'B02');
  const [ncf, setNcf] = useState<string>(sale.ncf || '');
  const [montoDescuento, setMontoDescuento] = useState<number>(sale.monto_descuento || 0);
  const [estado, setEstado] = useState<string>(sale.estado || 'completada');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nuevoMontoTotal = Math.max(
    0,
    Math.round((Number(sale.subtotal || 0) + Number(sale.monto_impuesto || 0) - Number(montoDescuento || 0)) * 100) / 100
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        cliente_id: customerId || null,
        metodo_pago: paymentMethod,
        tipo_ncf: tipoNcf || null,
        ncf: ncf || null,
        monto_descuento: Number(montoDescuento),
        monto_total: nuevoMontoTotal,
        estado,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 slide-up max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Edit className="text-amber-500" size={26} />
            Editar Factura {sale.numero_factura}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Actualizar información de cliente, comprobante fiscal o método de pago
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary flex items-center gap-1.5 font-bold"
        >
          ← Volver a Ventas
        </button>
      </div>

      <div className="card p-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Cliente</label>
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
                <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="credito">Crédito</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Tipo de NCF</label>
              <select
                className="input-field w-full"
                value={tipoNcf}
                onChange={(e) => setTipoNcf(e.target.value)}
              >
                <option value="B02">Factura Consumo (B02)</option>
                <option value="B01">Crédito Fiscal (B01)</option>
                <option value="B14">Gubernamental (B14)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">NCF Fiscal</label>
              <input
                type="text"
                className="input-field w-full font-mono"
                placeholder="Ej: B0200000001"
                value={ncf}
                onChange={(e) => setNcf(e.target.value)}
              />
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Descuento Aplicado (RD$)</label>
              <input
                type="number"
                step="any"
                min={0}
                className="input-field w-full font-mono"
                value={montoDescuento}
                onChange={(e) => setMontoDescuento(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="font-bold text-muted-foreground mb-1 block">Estado de Factura</label>
              <select
                className="input-field w-full"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="completada">Completada / Pagada</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
          </div>

          <div className="bg-secondary/30 p-3 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Monto Total Actualizado:</span>
              <span className="font-bold text-foreground font-mono">
                RD$ {nuevoMontoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Fecha Emisión:</span>
              <span>{new Date(sale.creado_en).toLocaleString('es-DO')}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2.5 px-4 font-bold"
            >
              ← Volver a Ventas
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs py-2.5 px-5 font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <CheckCircle size={15} /> {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
