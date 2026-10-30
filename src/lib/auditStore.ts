/** Persistence and tracking for System Audit Trail (Auditoría de Acciones) */

export type AuditActionType =
  | 'Venta'
  | 'Edición de venta'
  | 'Devolución'
  | 'Edición de producto'
  | 'Cambio de precio'
  | 'Eliminación'
  | 'Cierre de caja'
  | 'Apertura de caja'
  | 'Inicio de caja'
  | 'Compra'
  | 'Pago';

export type AuditLog = {
  id: string;
  user: string;
  role: string;
  timestamp: string;
  date: string;
  time: string;
  action: AuditActionType;
  module: string;
  details: string;
  before?: Record<string, unknown> | string | null;
  after?: Record<string, unknown> | string | null;
  ip: string;
};

const STORAGE_KEY = 'mercato_audit_logs';

/** Solo logs reales locales (sin seed demo). */
export function getAuditLogsLocal(): AuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditLog[];
  } catch {
    return [];
  }
}

export function appendAuditLogLocal(newLog: AuditLog): AuditLog {
  const logs = getAuditLogsLocal();
  const updated = [newLog, ...logs].slice(0, 500);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota
  }
  return newLog;
}

/** @deprecated Usa obtenerAuditoria(); se mantiene por compatibilidad sync offline. */
export function getAuditLogs(): AuditLog[] {
  return getAuditLogsLocal();
}

/** Registra en Supabase cuando está configurado; si no, localStorage. */
export function logAuditEvent(params: {
  user: string;
  role: string;
  action: AuditActionType;
  module: string;
  details: string;
  before?: Record<string, unknown> | string | null;
  after?: Record<string, unknown> | string | null;
  ip?: string;
}) {
  const now = new Date();
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user: params.user,
    role: params.role,
    timestamp: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString('es-DO', { hour12: false }),
    action: params.action,
    module: params.module,
    details: params.details,
    before: params.before ?? null,
    after: params.after ?? null,
    ip: params.ip || '127.0.0.1 (Local)',
  };

  // Guardar localmente de inmediato para disponibilidad sincrónica
  appendAuditLogLocal(newLog);

  // Fire-and-forget a Supabase si está disponible
  void import('@/services/auditoria.service')
    .then(({ registrarAuditoria }) =>
      registrarAuditoria({
        user: params.user,
        role: params.role,
        action: params.action,
        module: params.module,
        details: params.details,
        before: params.before,
        after: params.after,
        ip: params.ip,
      })
    )
    .catch(() => {
      // ya guardado localmente
    });

  return newLog;
}
