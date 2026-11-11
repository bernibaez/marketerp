import React from 'react';
import { Monitor, Star, Power, Edit2, Trash2, User, Lock, Clock } from 'lucide-react';
import type { Caja } from '@/types/database';
import type { CashRegisterSession } from '@/lib/cashRegisters';
import { InlineLoader, TableRowSkeleton } from '@/components/ui/LoadingSkeleton';

interface CajasTableProps {
  cajas: Caja[];
  registers?: CashRegisterSession[];
  loading: boolean;
  onToggle: (caja: Caja) => void;
  onEdit: (caja: Caja) => void;
  onDelete: (caja: Caja) => void;
  onCloseRegister?: (reg: CashRegisterSession) => void;
}

export const CajasTable: React.FC<CajasTableProps> = ({
  cajas,
  registers = [],
  loading,
  onToggle,
  onEdit,
  onDelete,
  onCloseRegister,
}) => {
  const isActiva = (c: Caja) => c.activa ?? c.activo ?? true;
  const isPrincipal = (c: Caja) => c.es_caja_principal ?? false;

  const findOpenSessionForCaja = (caja: Caja): CashRegisterSession | undefined => {
    const code = String(caja.codigo || '').trim();
    const id = String(caja.id || '').trim();
    return registers.find(
      (r) =>
        r.open &&
        (String(r.dbId) === id ||
          String(r.id) === code ||
          String(r.codigo) === code ||
          String(r.id) === id)
    );
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                Nombre de Caja
              </th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                Cajero en Turno / Estado Operativo
              </th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                Ventas en Turno
              </th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">
                Habilitada
              </th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <InlineLoader colSpan={7} message="Cargando cajas registradoras…" />
                <TableRowSkeleton cols={7} />
                <TableRowSkeleton cols={7} />
                <TableRowSkeleton cols={7} />
              </>
            ) : cajas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No hay cajas registradoras encontradas
                </td>
              </tr>
            ) : (
              cajas.map((caja, i) => {
                const openSession = findOpenSessionForCaja(caja);
                return (
                  <tr
                    key={caja.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                      i % 2 === 0 ? '' : 'bg-secondary/10'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      #{caja.codigo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 font-bold text-foreground">
                        <Monitor size={17} className="text-primary flex-shrink-0" />
                        <div>
                          <span>{caja.nombre}</span>
                          {caja.descripcion && (
                            <p className="text-[11px] font-normal text-muted-foreground">
                              {caja.descripcion}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {openSession ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <User size={13} />
                            <span>{openSession.cashier}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock size={11} />
                            Abierta: {openSession.openedAt} · Fondo: RD${' '}
                            {(openSession.baseCash ?? 0).toLocaleString('es-DO', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">
                          Cerrada / Disponible
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {openSession ? (
                        <div>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs block">
                            RD${' '}
                            {(openSession.salesToday ?? 0).toLocaleString('es-DO', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Esperado: RD${' '}
                            {(openSession.expectedCash ?? 0).toLocaleString('es-DO', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isPrincipal(caja) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          Principal
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Auxiliar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={isActiva(caja) ? 'badge-success' : 'badge-danger'}>
                        {isActiva(caja) ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {openSession && onCloseRegister && (
                          <button
                            type="button"
                            onClick={() => onCloseRegister(openSession)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95 mr-1"
                            title={`Cerrar caja activa de ${openSession.cashier}`}
                          >
                            <Lock size={12} />
                            <span>Cerrar Caja</span>
                          </button>
                        )}
                        <button
                          type="button"
                          title={isActiva(caja) ? 'Desactivar' : 'Activar'}
                          onClick={() => onToggle(caja)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Power size={15} />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => onEdit(caja)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => onDelete(caja)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
