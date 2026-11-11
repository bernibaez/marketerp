import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, DollarSign, Tag, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { registrarMovimientoCaja } from '@/services/movimientosCaja.service';
import { crearGasto, obtenerCategoriasGasto } from '@/services/gastos.service';
import type { TipoMovimientoCaja } from '@/types/database';

interface PosCashMovementModalProps {
  cajaId: string;
  cierreId?: string;
  onSuccess?: () => void;
  onClose: () => void;
}

export default function PosCashMovementModal({
  cajaId,
  cierreId,
  onSuccess,
  onClose,
}: PosCashMovementModalProps) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<'entrada' | 'retiro'>('entrada');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState('Insumos / Operativo');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(monto);
    if (isNaN(value) || value <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    if (!concepto.trim()) {
      toast.error('Ingresa un concepto o justificación para el movimiento');
      return;
    }

    setSaving(true);
    try {
      await registrarMovimientoCaja({
        caja_id: cajaId,
        cierre_id: cierreId ?? null,
        cajero_id: user?.id ?? null,
        cajero_nombre: user?.name ?? 'Usuario',
        tipo: tipo === 'entrada' ? 'entrada' : 'retiro',
        monto: value,
        concepto: concepto.trim(),
        categoria: tipo === 'retiro' ? categoria : 'Aporte de Fondo',
      });

      // Si es un retiro/gasto, reflejar automáticamente en el módulo central e historial de gastos
      if (tipo === 'retiro') {
        try {
          const cats = await obtenerCategoriasGasto().catch(() => []);
          const matchedCat = cats.find((c) => c.name.toLowerCase().includes('operativ') || c.name.toLowerCase().includes('otro')) || cats[0];
          await crearGasto({
            categoria_id: matchedCat?.id || 'cat-008',
            descripcion: concepto.trim(),
            monto: value,
            metodo_pago: 'efectivo',
            caja_id: String(cajaId),
            cierre_id: cierreId,
            responsable_nombre: user?.name ?? 'Usuario',
            estado: 'aprobado',
            omitirMovimientoCaja: true,
          });
        } catch (eGasto) {
          console.warn('Error al registrar gasto asociado al retiro:', eGasto);
        }
      }

      toast.success(
        tipo === 'entrada'
          ? `Entrada de efectivo registrada (+RD$ ${value.toLocaleString('es-DO', { minimumFractionDigits: 2 })})`
          : `Retiro de efectivo registrado (-RD$ ${value.toLocaleString('es-DO', { minimumFractionDigits: 2 })})`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="dialog-inline-host"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                tipo === 'entrada'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
              }`}
            >
              {tipo === 'entrada' ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
            </div>
            <div>
              <h3 className="font-extrabold text-foreground text-lg leading-tight">
                Movimiento de Efectivo
              </h3>
              <p className="text-xs text-muted-foreground">
                Registra entrada o retiro de efectivo en Caja #{cajaId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector Tipo Movimiento */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/60 rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => setTipo('entrada')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                tipo === 'entrada'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>Entrada (Aporte)</span>
            </button>
            <button
              type="button"
              onClick={() => setTipo('retiro')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                tipo === 'retiro'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowDownRight size={16} />
              <span>Retiro (Salida/Gasto)</span>
            </button>
          </div>

          {/* Monto */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">
              Monto del Movimiento (RD$) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground font-bold">
                <DollarSign size={18} />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="input-field pl-10 h-12 text-xl font-bold tabular-nums w-full"
              />
            </div>
          </div>

          {/* Concepto / Justificación */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">
              Concepto / Motivo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={
                tipo === 'entrada'
                  ? 'Ej. Refuerzo de menudo / cambio inicial entregado'
                  : 'Ej. Pago urgente de mensajería / Retiro parcial de seguridad'
              }
              className="input-field h-11 text-xs font-semibold w-full"
            />
          </div>

          {/* Categoría (solo para retiro) */}
          {tipo === 'retiro' && (
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Categoría de Salida</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="input-field h-11 text-xs font-semibold w-full"
              >
                <option value="Insumos / Operativo">Insumos / Operativo</option>
                <option value="Servicios Mensajería">Servicios / Mensajería</option>
                <option value="Retiro de Seguridad">Retiro de Seguridad</option>
                <option value="Pago a Proveedor Directo">Pago a Proveedor Directo</option>
                <option value="Otros Gastos de Caja">Otros Gastos de Caja</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary text-xs font-bold px-4 py-2.5">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`text-xs font-black px-6 py-2.5 rounded-xl text-white shadow-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>{saving ? 'Guardando...' : 'Confirmar Movimiento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
