import React from 'react';
import { Monitor, Star, Power, Edit2, Trash2 } from 'lucide-react';
import type { Caja } from '@/types/database';
import { InlineLoader, TableRowSkeleton } from '@/components/ui/LoadingSkeleton';

interface CajasTableProps {
  cajas: Caja[];
  loading: boolean;
  onToggle: (caja: Caja) => void;
  onEdit: (caja: Caja) => void;
  onDelete: (caja: Caja) => void;
}

export const CajasTable: React.FC<CajasTableProps> = ({
  cajas,
  loading,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const isActiva = (c: Caja) => c.activa ?? c.activo ?? true;
  const isPrincipal = (c: Caja) => c.es_caja_principal ?? false;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nombre de Caja</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Descripción</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <InlineLoader colSpan={6} message="Cargando cajas registradoras…" />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
                <TableRowSkeleton cols={6} />
              </>
            ) : cajas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay cajas registradoras encontradas
                </td>
              </tr>
            ) : (
              cajas.map((caja, i) => (
                <tr
                  key={caja.id}
                  className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-secondary/10'
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-foreground">#{caja.codigo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 font-bold text-foreground">
                      <Monitor size={17} className="text-primary flex-shrink-0" />
                      <span>{caja.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {caja.descripcion || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isPrincipal(caja) ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                        <Star size={11} className="fill-amber-500 text-amber-500" />
                        Principal
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">Auxiliar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={isActiva(caja) ? 'badge-success' : 'badge-danger'}>
                      {isActiva(caja) ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
