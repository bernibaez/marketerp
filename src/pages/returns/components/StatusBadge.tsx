import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import type { PosReturnStatus } from '@/lib/posStore';

export function StatusBadge({ status }: { status?: PosReturnStatus }) {
  const currentStatus = status || 'approved';
  if (currentStatus === 'pending') {
    return (
      <span className="badge-warning inline-flex items-center gap-1 font-bold text-xs">
        <Clock size={12} />
        Pendiente
      </span>
    );
  }
  if (currentStatus === 'approved') {
    return (
      <span className="badge-success inline-flex items-center gap-1 font-bold text-xs">
        <CheckCircle size={12} />
        Aprobada
      </span>
    );
  }
  return (
    <span className="badge-danger inline-flex items-center gap-1 font-bold text-xs">
      <XCircle size={12} />
      Rechazada
    </span>
  );
}
