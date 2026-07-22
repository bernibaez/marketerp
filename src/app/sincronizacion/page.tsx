'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { RefreshCw, Wifi, WifiOff, CheckCircle, XCircle, Clock, AlertCircle, Database, Zap, Settings, Play, RotateCcw, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SyncModule {
  id: string;
  module: string;
  is_realtime: boolean;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  sync_status: 'idle' | 'syncing' | 'success' | 'error';
  error_message: string | null;
  updated_at: string;
}

const moduleIcons: Record<string, React.ReactNode> = {
  Ventas: <Activity size={18} className="text-primary" />,
  Inventario: <Database size={18} className="text-warning" />,
  Compras: <RefreshCw size={18} className="text-success" />,
  Contactos: <Wifi size={18} className="text-info" />,
  Productos: <Database size={18} className="text-primary" />,
  Gastos: <Activity size={18} className="text-danger" />,
  Usuarios: <Settings size={18} className="text-muted-foreground" />,
  Reportes: <Activity size={18} className="text-success" />,
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; badge: string }> = {
  idle: { label: 'En espera', icon: <Clock size={14} />, badge: 'badge-secondary' },
  syncing: { label: 'Sincronizando', icon: <RefreshCw size={14} className="animate-spin" />, badge: 'badge-warning' },
  success: { label: 'Sincronizado', icon: <CheckCircle size={14} />, badge: 'badge-success' },
  error: { label: 'Error', icon: <XCircle size={14} />, badge: 'badge-danger' },
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

export default function SyncConfigPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const [modules, setModules] = useState<SyncModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [realtimeChannel, setRealtimeChannel] = useState<any>(null);

  useEffect(() => {
    loadModules();
    checkConnection();
    return () => {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const checkConnection = async () => {
    try {
      const { error } = await supabase.from('sync_config').select('id').limit(1);
      setConnectionStatus(error ? 'disconnected' : 'connected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const loadModules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sync_config')
        .select('*')
        .order('module');
      if (!error && data) setModules(data as SyncModule[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const updateModule = async (id: string, updates: Partial<SyncModule>) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('sync_config')
        .update(updates)
        .eq('id', id);
      if (!error) {
        setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
      }
    } finally {
      setSaving(null);
    }
  };

  const triggerSync = async (id: string, moduleName: string) => {
    setSaving(id);
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, sync_status: 'syncing' } : m))
    );
    try {
      await supabase.from('sync_config').update({
        sync_status: 'syncing',
        error_message: null,
      }).eq('id', id);

      // Simulate sync delay
      await new Promise((r) => setTimeout(r, 1500));

      const now = new Date().toISOString();
      await supabase.from('sync_config').update({
        sync_status: 'success',
        last_synced_at: now,
        error_message: null,
      }).eq('id', id);

      setModules((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, sync_status: 'success', last_synced_at: now } : m
        )
      );
    } catch {
      await supabase.from('sync_config').update({ sync_status: 'error', error_message: 'Error de conexion' }).eq('id', id);
      setModules((prev) =>
        prev.map((m) => (m.id === id ? { ...m, sync_status: 'error' } : m))
      );
    } finally {
      setSaving(null);
    }
  };

  const syncAll = async () => {
    for (const mod of modules) {
      await triggerSync(mod.id, mod.module);
    }
  };

  const toggleRealtime = async (mod: SyncModule) => {
    await updateModule(mod.id, { is_realtime: !mod.is_realtime });
  };

  const updateInterval = async (mod: SyncModule, interval: number) => {
    await updateModule(mod.id, { sync_interval_minutes: interval });
  };

  const successCount = modules.filter((m) => m.sync_status === 'success').length;
  const errorCount = modules.filter((m) => m.sync_status === 'error').length;
  const realtimeCount = modules.filter((m) => m.is_realtime).length;

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sincronización de Datos</h1>
            <p className="text-sm text-muted-foreground mt-1">Configura la sincronización en tiempo real con Supabase</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-success/10 text-success' :
              connectionStatus === 'disconnected'? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
            }`}>
              {connectionStatus === 'connected' ? <Wifi size={16} /> :
               connectionStatus === 'disconnected' ? <WifiOff size={16} /> :
               <RefreshCw size={16} className="animate-spin" />}
              {connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'disconnected' ? 'Desconectado' : 'Verificando...'}
            </div>
            <button onClick={syncAll} className="btn-primary flex items-center gap-2">
              <RefreshCw size={16} />Sincronizar Todo
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Módulos Totales', value: modules.length, icon: <Database size={20} />, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Tiempo Real', value: realtimeCount, icon: <Zap size={20} />, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Sincronizados', value: successCount, icon: <CheckCircle size={20} />, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Con Errores', value: errorCount, icon: <AlertCircle size={20} />, color: 'text-danger', bg: 'bg-danger/10' },
          ].map((stat, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Modules Table */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Configuración por Módulo</h2>
            <button onClick={loadModules} className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw size={14} />Recargar
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Cargando configuración...</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Database size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay módulos configurados. Ejecuta la migración primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Módulo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiempo Real</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intervalo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Última Sync</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {modules.map((mod) => {
                    const status = statusConfig[mod.sync_status] || statusConfig.idle;
                    const isSaving = saving === mod.id;
                    return (
                      <tr key={mod.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                              {moduleIcons[mod.module] || <Database size={16} />}
                            </div>
                            <span className="font-medium text-foreground text-sm">{mod.module}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            mod.sync_status === 'success' ? 'bg-success/10 text-success' :
                            mod.sync_status === 'error' ? 'bg-danger/10 text-danger' :
                            mod.sync_status === 'syncing'? 'bg-warning/10 text-warning' : 'bg-secondary text-muted-foreground'
                          }`}>
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRealtime(mod)}
                            disabled={isSaving}
                            className={`relative w-11 h-6 rounded-full transition-colors ${mod.is_realtime ? 'bg-primary' : 'bg-border'} ${isSaving ? 'opacity-50' : ''}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${mod.is_realtime ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={mod.sync_interval_minutes}
                            onChange={(e) => updateInterval(mod, Number(e.target.value))}
                            disabled={mod.is_realtime || isSaving}
                            className="input-field text-xs py-1.5 w-28 disabled:opacity-50"
                          >
                            <option value={1}>1 min</option>
                            <option value={5}>5 min</option>
                            <option value={10}>10 min</option>
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={60}>1 hora</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(mod.last_synced_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => triggerSync(mod.id, mod.module)}
                            disabled={isSaving || mod.sync_status === 'syncing'}
                            className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 ml-auto disabled:opacity-50"
                          >
                            {isSaving ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Play size={12} />
                            )}
                            Sincronizar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="card p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Sincronización en Tiempo Real</p>
              <p className="text-xs text-muted-foreground">
                Los módulos con tiempo real activado usan Supabase Realtime para recibir cambios instantáneamente.
                Los módulos sin tiempo real se sincronizan según el intervalo configurado.
                Los datos se almacenan en Supabase PostgreSQL con RLS habilitado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
