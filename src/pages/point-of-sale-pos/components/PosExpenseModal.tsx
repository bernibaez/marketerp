import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { addCashExpense, getCashExpenses, nextCode } from '@/lib/posStore';
import {
  crearGasto,
  obtenerCategoriasGasto,
  CATEGORIAS_GASTO_DEFAULT,
  type CategoriaGastoUi,
} from '@/services/gastos.service';
import { registrarMovimientoCaja } from '@/services/movimientosCaja.service';
import { useAuth } from '@/context/AuthContext';

export default function PosExpenseModal({
  onClose,
  cajaId,
  cashierLabel,
  cierreId,
}: {
  onClose: () => void;
  cajaId?: string;
  cashierLabel?: string;
  cierreId?: string;
}) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<CategoriaGastoUi[]>(CATEGORIAS_GASTO_DEFAULT);
  const [categoriaId, setCategoriaId] = useState<string>('cat-008');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    obtenerCategoriasGasto()
      .then((cats) => {
        if (cancelled || !cats || cats.length === 0) return;
        setCategorias(cats);
        // Si la categoría actual no existe en las cargadas, seleccionar la primera
        if (!cats.some((c) => c.id === categoriaId)) {
          setCategoriaId(cats[0].id);
        }
      })
      .catch((e) => {
        console.warn('Categorías fallback cargadas:', e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    const value = parseFloat(amount);
    if (!description.trim() || !value || value <= 0) {
      toast.error('Completa descripción y un monto válido mayor a 0');
      return;
    }
    if (!categoriaId) {
      toast.error('Selecciona una categoría de gasto');
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const respName = user?.name || cashierLabel || 'Cajero';
      const catName = categorias.find((c) => c.id === categoriaId)?.name ?? 'Gastos Operativos';
      const effectiveCajaId = cajaId ? String(cajaId) : '1';

      // 1. Guardar en el servicio central de gastos (local y Supabase)
      await crearGasto({
        categoria_id: categoriaId,
        descripcion: description.trim(),
        monto: value,
        metodo_pago: 'efectivo',
        fecha: today,
        responsable_nombre: respName,
        caja_id: effectiveCajaId,
        cierre_id: cierreId,
        tiene_recibo: false,
        estado: 'aprobado',
      });

      // 2. Registrar en mercado_pos_expenses solo para historial rápido de UI POS (crearGasto ya registró 1 movimiento en caja)
      const now = new Date();
      addCashExpense({
        id: `exp-${Date.now()}`,
        code: nextCode('GCJ', getCashExpenses().length),
        category: catName,
        description: description.trim(),
        amount: value,
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
        user: user?.name || 'Cajero',
        cashier: cashierLabel || `Caja #${effectiveCajaId}`,
        cajaId: effectiveCajaId,
        cierreId: cierreId || undefined,
        created_at: now.toISOString(),
      });

      toast.success(`Gasto registrado: RD$ ${value.toLocaleString('es-DO')}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar el gasto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-inline-host" onClick={onClose}>
      <div className="card w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground">Gasto de caja</h3>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
            <select
              className="input-field"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={saving}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción *</label>
            <input
              autoFocus
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Pago de mensajería, botellón de agua..."
              disabled={saving}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Monto (RD$) *</label>
            <input
              className="input-field"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !categoriaId || !description.trim() || !amount}
            >
              {saving ? 'Guardando…' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
