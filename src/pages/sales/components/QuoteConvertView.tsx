import React, { useState } from 'react';
import { ArrowRightLeft, CheckCircle } from 'lucide-react';
import type { MetodoPago } from '@/types/database';
import type { CotizacionConDetalle } from '@/services/cotizaciones.service';

interface QuoteConvertViewProps {
  quote: CotizacionConDetalle;
  onConfirm: (paymentMethod: MetodoPago) => Promise<void>;
  onClose: () => void;
}

export const QuoteConvertView: React.FC<QuoteConvertViewProps> = ({
  quote,
  onConfirm,
  onClose,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<MetodoPago>('efectivo');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(paymentMethod);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 slide-up max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="text-primary" size={26} />
            Convertir Cotización a Venta
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generar factura a partir de la cotización {quote.codigo}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary flex items-center gap-1.5 font-bold"
        >
          ← Volver a Cotizaciones
        </button>
      </div>

      <div className="card p-6 space-y-5 shadow-lg border-primary/30">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estás a punto de procesar la cotización <strong className="font-mono text-foreground font-bold">{quote.codigo}</strong> por el monto total de{' '}
          <strong className="text-primary font-mono text-base font-black">
            RD$ {quote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </strong>
          . Se creará una factura formal y se descontará el stock en la base de datos.
        </p>

        <div className="bg-secondary/30 p-4 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-bold">{quote.cliente_nombre || 'Cliente General'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Ítems:</span><span className="font-bold">{quote.items?.length || 0} producto(s)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Monto Total:</span><span className="font-mono font-bold">RD$ {quote.monto_total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Seleccionar Método de Pago</label>
          <select
            className="input-field text-sm py-2.5 w-full font-semibold"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as MetodoPago)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta de Crédito/Débito</option>
            <option value="transferencia">Transferencia Bancaria</option>
            <option value="credito">Crédito</option>
          </select>
        </div>

        <div className="flex gap-3 pt-3 border-t border-border">
          <button type="button" onClick={onClose} className="flex-1 btn-secondary text-sm py-2.5 font-bold">
            ← Volver
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 btn-primary text-sm py-2.5 font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            <CheckCircle size={16} /> {isSubmitting ? 'Procesando...' : 'Confirmar y Facturar'}
          </button>
        </div>
      </div>
    </div>
  );
};
