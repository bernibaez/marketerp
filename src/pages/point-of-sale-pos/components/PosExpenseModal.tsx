import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { addCashExpense, getCashExpenses, nextCode } from '@/lib/posStore';
import {
  crearGasto,
  obtenerCategoriasGasto,
  type CategoriaGastoUi,
} from '@/services/gastos.service';
import { useAuth } from '@/context/AuthContext';

export default function PosExpenseModal({
  onClose,
  cajaId,
  cashierLabel,
}: {
  onClose: () => void;
  cajaId?: string;
  cashierLabel?: string;
}) {
  const { user } = useAuth();
  const [categorias, setCategorias] = useState<CategoriaGastoUi[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loadingCats, setLoadingCats] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingCats(true);
    obtenerCategoriasGasto()
      .then((cats) => {
        if (cancelled) return;
        setCategorias(cats);
        if (cats[0]) setCategoriaId(cats[0].id);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'No se pudieron cargar categorías');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCats(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    const value = parseFloat(amount);
    if (!description.trim() || !value || value <= 0) {
      toast.error('Completa descripción y monto válido');
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
      await crearGasto({
        categoria_id: categoriaId,
        descripcion: description.trim(),
        monto: value,
        metodo_pago: 'efectivo',
        fecha: today,
        responsable_nombre: respName,
        tiene_recibo: false,
        estado: 'aprobado',
      });

      // También en caja local para maleta / resumen de efectivo del día
      const now = new Date();
      const catName = categorias.find((c) => c.id === categoriaId)?.name ?? 'Gasto';
      addCashExpense({
        id: `exp-${Date.now()}`,
        code: nextCode('GCJ', getCashExpenses().length),
        category: catName,
        description: description.trim(),
        amount: value,
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
        user: user?.name || 'Cajero',
        cashier: cashierLabel || (cajaId ? `Caja #${cajaId}` : 'Caja'),
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
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
          <select
            className="input-field"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            disabled={loadingCats || saving}
          >
            {categorias.length === 0 ? (
              <option value="">Sin categorías — créalas en Gastos</option>
            ) : (
              categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción *</label>
          <input
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Pago de mensajería"
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
            disabled={saving}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={saving || loadingCats || !categoriaId}
          >
            {saving ? 'Guardando…' : 'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}
