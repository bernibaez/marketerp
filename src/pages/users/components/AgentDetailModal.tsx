import React from 'react';
import { UserCheck } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import type { AgenteComercial } from '@/types/database';

interface AgentDetailModalProps {
  agent: AgenteComercial | null;
  onClose: () => void;
  onEdit: (agent: AgenteComercial) => void;
}

export function AgentDetailModal({ agent, onClose, onEdit }: AgentDetailModalProps) {
  return (
    <ModalShell open={!!agent} onClose={onClose} size="md" className="p-6">
      {agent && (
        <>
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UserCheck size={20} className="text-primary" />
              Detalle de Agente
            </h2>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-bold text-foreground text-base">{agent.nombre}</p>
            <div className="grid grid-cols-2 gap-3 bg-secondary/30 rounded-xl p-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Correo</span>
                <span className="font-medium text-foreground">{agent.correo || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Teléfono</span>
                <span className="font-medium text-foreground">{agent.telefono || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Comisión</span>
                <span className="font-bold text-primary">{agent.porcentaje_comision ?? 0}%</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Estado</span>
                <span className={agent.activo ? 'badge-success' : 'badge-danger'}>
                  {agent.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-secondary cursor-pointer" onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn-primary cursor-pointer"
              onClick={() => {
                onClose();
                onEdit(agent);
              }}
            >
              Editar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
