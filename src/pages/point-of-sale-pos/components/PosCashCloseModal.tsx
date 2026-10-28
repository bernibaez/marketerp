import React, { useEffect, useState } from 'react';
import { X, Lock, DollarSign, Monitor, CheckCircle2, AlertTriangle, Calculator, FileText, ArrowUpRight, ArrowDownRight, CreditCard, Undo2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuth } from '@/context/AuthContext';
import { findCashRegister } from '@/lib/cashRegisters';
import { useCashRegisters } from '@/hooks/useCashRegisters';
import { cerrarTurnoCaja, calcularResumenCajaAbierta, type ResumenCajaAbierta } from '@/services/cierresCaja.service';
import type { CierreCaja } from '@/types/database';
import { logAuditEvent } from '@/lib/auditStore';

interface PosCashCloseModalProps {
  initialCajaId?: string;
  onSuccess?: (cierre: CierreCaja) => void;
  onClose: () => void;
}

export default function PosCashCloseModal({
  initialCajaId,
  onSuccess,
  onClose,
}: PosCashCloseModalProps) {
  const { user } = useAuth();
  const { registers, dbUsers } = useCashRegisters();
  const roleNorm = (user?.role || '').trim().toLowerCase();
  const isAdmin =
    roleNorm === 'administrador' ||
    roleNorm === 'super administrador' ||
    roleNorm === 'admin' ||
    roleNorm === 'super_admin' ||
    roleNorm === 'superadmin';
  const availableRegisters = isAdmin
    ? registers
    : registers.filter((c) => !c.isAdminBox);

  const resolvedMatch = findCashRegister(availableRegisters, initialCajaId) || findCashRegister(registers, initialCajaId);
  const resolvedInitial =
    resolvedMatch?.id ||
    availableRegisters[0]?.id ||
    registers[0]?.id ||
    '2';

  const [selectedCajaId, setSelectedCajaId] = useState(resolvedInitial);
  const [selectedCajeroId, setSelectedCajeroId] = useState<string>(user?.id || '');

  const [summary, setSummary] = useState<ResumenCajaAbierta>({
    caja_id: resolvedInitial,
    caja_label: `Caja #${resolvedInitial}`,
    abierta_en: new Date().toISOString(),
    monto_apertura: 0,
    total_ventas: 0,
    total_efectivo: 0,
    total_tarjeta: 0,
    total_transferencia: 0,
    total_otros: 0,
    total_entradas: 0,
    total_retiros: 0,
    total_devoluciones: 0,
    monto_esperado: 0,
    estado: 'en_curso',
  });

  const [montoRealInput, setMontoRealInput] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSummary, setFetchingSummary] = useState(false);

  const selectedCaja =
    findCashRegister(availableRegisters, selectedCajaId) || availableRegisters[0] || registers[0];
  const selectedUser = isAdmin ? dbUsers.find((u) => u.id === selectedCajeroId) : null;

  useEffect(() => {
    let alive = true;
    (async () => {
      setFetchingSummary(true);
      try {
        const res = await calcularResumenCajaAbierta(
          selectedCaja?.dbId || selectedCajaId,
          user?.id
        );
        if (alive) {
          setSummary(res);
          setMontoRealInput(String(res.monto_esperado));
          if (!res.cierre_id) {
            toast.error('No se encontró un inicio de caja activo para esta caja.');
          }
        }
      } catch {
        if (alive) {
          setSummary({
            caja_id: selectedCajaId,
            caja_label: `Caja #${selectedCajaId}`,
            abierta_en: new Date().toISOString(),
            monto_apertura: 0,
            total_ventas: 0,
            total_efectivo: 0,
            total_tarjeta: 0,
            total_transferencia: 0,
            total_otros: 0,
            total_entradas: 0,
            total_retiros: 0,
            total_devoluciones: 0,
            monto_esperado: 0,
            estado: 'en_curso',
          });
          setMontoRealInput('0');
        }
      } finally {
        if (alive) setFetchingSummary(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedCajaId, selectedCaja?.dbId, user?.id]);

  const countedReal = parseFloat(montoRealInput) || 0;
  const diferencia = countedReal - summary.monto_esperado;

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(countedReal) || countedReal < 0) {
      toast.error('Ingresa un conteo físico de dinero válido (0 o mayor)');
      return;
    }

    setLoading(true);
    try {
      const cajeroNombre = summary.cajero_nombre || (isAdmin
        ? (selectedUser?.nombre_completo || user?.name || 'Cajero Activo')
        : (user?.name || 'Cajero Activo'));
      const cajeroUsername = summary.cajero_username || (isAdmin
        ? (selectedUser?.correo || user?.username || '')
        : (user?.username || ''));
      const cajeroId = summary.cajero_id || (isAdmin
        ? (selectedUser?.id || user?.id || null)
        : (user?.id || null));

      const result = await cerrarTurnoCaja({
        cierre_id: summary.cierre_id,
        caja_id: selectedCaja?.dbId || selectedCajaId,
        caja_label: selectedCaja.label,
        cajero_id: cajeroId,
        cajero_nombre: cajeroNombre,
        cajero_username: cajeroUsername,
        usuario_cierre_id: user?.id ?? null,
        usuario_cierre_nombre: user?.name ?? 'Usuario',
        monto_apertura: summary.monto_apertura,
        monto_esperado: summary.monto_esperado,
        monto_real: countedReal,
        monto_diferencia: diferencia,
        total_ventas: summary.total_ventas,
        total_efectivo: summary.total_efectivo,
        total_tarjeta: summary.total_tarjeta,
        total_transferencia: summary.total_transferencia,
        total_otros: summary.total_otros,
        total_entradas: summary.total_entradas,
        total_retiros: summary.total_retiros,
        total_devoluciones: summary.total_devoluciones,
        notes: notes || 'Cierre de turno en punto de venta POS',
      });

      logAuditEvent({
        user: user?.name ?? 'Usuario',
        role: user?.role ?? 'Cajero',
        action: 'Cierre de caja',
        module: 'Caja',
        details: `Cierre de turno ${selectedCaja.label} realizado por ${user?.name}. Esperado: RD$ ${summary.monto_esperado.toFixed(2)}, Conteo Real: RD$ ${countedReal.toFixed(2)}, Diferencia: RD$ ${diferencia.toFixed(2)}`,
        after: {
          caja_id: selectedCajaId,
          monto_esperado: summary.monto_esperado,
          monto_real: countedReal,
          diferencia,
        },
      });

      toast.success(`Caja ${selectedCaja.label} cerrada exitosamente`);
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar turno de caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="dialog-inline-host"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card rounded-3xl border border-border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Lock size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-foreground text-lg leading-tight">
                Cierre de Turno / Arqueo de Caja
              </h3>
              <p className="text-xs text-muted-foreground">
                Cálculo de arqueo real basado en ventas, entradas, retiros y devoluciones
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

        <form onSubmit={handleCloseRegister} className="space-y-4">
          {/* Select Register */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">
              Caja a Cerrar
            </label>
            <div className="relative">
              <Monitor size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                value={selectedCajaId}
                onChange={(e) => setSelectedCajaId(e.target.value)}
                className="input-field pl-10 h-11 text-xs font-bold w-full"
              >
                {availableRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.label} — (Caja #{reg.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real Breakdown Financial Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 bg-secondary/40 rounded-xl border border-border/60">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Fondo Inicial</span>
              <span className="text-xs font-extrabold text-foreground tabular-nums">
                RD$ {summary.monto_apertura.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block flex items-center gap-1">
                <ArrowUpRight size={12} /> Ventas Efectivo
              </span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                +RD$ {summary.total_efectivo.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase block flex items-center gap-1">
                <ArrowUpRight size={12} /> Entradas Ef.
              </span>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                +RD$ {summary.total_entradas.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block flex items-center gap-1">
                <ArrowDownRight size={12} /> Retiros / Gastos
              </span>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                -RD$ {summary.total_retiros.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase block flex items-center gap-1">
                <Undo2 size={12} /> Devoluciones
              </span>
              <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                -RD$ {summary.total_devoluciones.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <span className="text-[10px] font-bold text-primary uppercase block flex items-center gap-1">
                <CreditCard size={12} /> Tarjeta/Transf
              </span>
              <span className="text-xs font-extrabold text-primary tabular-nums">
                RD$ {(summary.total_tarjeta + summary.total_transferencia).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Expected Total Badge */}
          <div className="p-3.5 bg-secondary/70 rounded-2xl border border-border flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Efectivo Esperado en Caja
              </span>
              <span className="text-[10px] text-muted-foreground">
                (Fondo + Ventas Ef. + Entradas - Retiros - Devoluciones)
              </span>
            </div>
            <span className="text-xl font-black text-foreground tabular-nums">
              {fetchingSummary ? 'Calculando...' : `RD$ ${summary.monto_esperado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`}
            </span>
          </div>

          {/* Real Counted Input */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block flex items-center justify-between">
              <span>Efectivo Físico Contado (RD$) <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-muted-foreground font-medium">Billetes y monedas contados</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-muted-foreground pointer-events-none">
                RD$
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoRealInput}
                onChange={(e) => setMontoRealInput(e.target.value)}
                required
                className="input-field pl-14 h-14 text-2xl font-black tabular-nums border-2 border-primary/40 focus:border-primary text-foreground"
              />
            </div>
          </div>

          {/* Difference Indicator Badge */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-extrabold ${
            diferencia === 0
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : diferencia > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {diferencia === 0 ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
              <span>
                {diferencia === 0
                  ? 'Cierre Perfecto — Cuadre Exacto'
                  : diferencia > 0
                    ? 'Sobrante en Caja'
                    : 'Faltante en Caja'}
              </span>
            </div>
            <span className="text-sm font-black tabular-nums">
              {diferencia >= 0 ? `+RD$ ${diferencia.toFixed(2)}` : `-RD$ ${Math.abs(diferencia).toFixed(2)}`}
            </span>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">
              Observaciones del Cierre (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Cuadre perfecto sin novedades..."
              className="input-field h-10 text-xs font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs font-bold px-4 py-2.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || fetchingSummary}
              className="btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Lock size={16} />
              {loading ? 'Procesando Cierre...' : 'Confirmar Cierre de Caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
