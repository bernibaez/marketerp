import React from 'react';
import { Eye, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AgenteComercial } from '@/types/database';

interface AgentsTableProps {
  agentes: AgenteComercial[];
  loadingAgentes: boolean;
  onView: (agent: AgenteComercial) => void;
  onEdit: (agent: AgenteComercial) => void;
  onDelete: (agent: AgenteComercial) => void;
  onToggleActive: (agent: AgenteComercial) => void;
}

export function AgentsTable({
  agentes,
  loadingAgentes,
  onView,
  onEdit,
  onDelete,
  onToggleActive,
}: AgentsTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Agente</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Teléfono</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Comisión %</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingAgentes && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Cargando agentes…
                </td>
              </tr>
            )}
            {!loadingAgentes && agentes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No hay agentes en Supabase. Crea el primero con “Nuevo Agente”.
                </td>
              </tr>
            )}
            {!loadingAgentes &&
              agentes.map((agent, i) => (
                <tr
                  key={agent.id}
                  className={`border-b border-border hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-secondary/10'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                        {agent.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{agent.nombre}</p>
                        <p className="text-xs text-muted-foreground">{agent.correo || 'Sin correo'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {agent.telefono || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-success font-semibold">
                    {Number(agent.porcentaje_comision).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onToggleActive(agent)}
                      className="inline-flex items-center gap-1 cursor-pointer"
                      title={agent.activo ? 'Desactivar' : 'Activar'}
                    >
                      {agent.activo ? (
                        <ToggleRight size={22} className="text-success" />
                      ) : (
                        <ToggleLeft size={22} className="text-muted-foreground" />
                      )}
                      <span className={agent.activo ? 'badge-success' : 'badge-danger'}>
                        {agent.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Vista previa"
                        onClick={() => onView(agent)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(agent)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(agent)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
