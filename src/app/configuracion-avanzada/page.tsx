'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { Printer, Shield, Plus, Edit2, Trash2, CheckCircle, XCircle, Wifi, WifiOff, Save } from 'lucide-react';

type Tab = 'printers' | 'permissions';

interface TicketPrinter {
  id: number;
  name: string;
  type: 'thermal' | 'laser' | 'inkjet';
  connection: 'usb' | 'network' | 'bluetooth';
  ip?: string;
  port?: number;
  paperWidth: '58mm' | '80mm';
  location: string;
  status: 'online' | 'offline';
  default: boolean;
}

interface Role {
  id: number;
  name: string;
  description: string;
  users: number;
  color: string;
}

interface Permission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

const mockPrinters: TicketPrinter[] = [
  { id: 1, name: 'Impresora Caja Principal', type: 'thermal', connection: 'usb', paperWidth: '80mm', location: 'Caja 1', status: 'online', default: true },
  { id: 2, name: 'Impresora Caja 2', type: 'thermal', connection: 'network', ip: '192.168.1.101', port: 9100, paperWidth: '80mm', location: 'Caja 2', status: 'online', default: false },
  { id: 3, name: 'Impresora Etiquetas', type: 'thermal', connection: 'usb', paperWidth: '58mm', location: 'Almacén', status: 'offline', default: false },
];

const mockRoles: Role[] = [
  { id: 1, name: 'Administrador', description: 'Acceso total al sistema', users: 2, color: 'bg-danger/10 text-danger' },
  { id: 2, name: 'Cajero', description: 'Acceso al POS y ventas', users: 5, color: 'bg-primary/10 text-primary' },
  { id: 3, name: 'Vendedor', description: 'Ventas y cotizaciones', users: 3, color: 'bg-success/10 text-success' },
  { id: 4, name: 'Almacenista', description: 'Gestión de inventario', users: 2, color: 'bg-warning/10 text-warning' },
  { id: 5, name: 'Contador', description: 'Informes y finanzas', users: 1, color: 'bg-info/10 text-info' },
];

const defaultPermissions: Permission[] = [
  { module: 'Dashboard', view: true, create: false, edit: false, delete: false, export: true },
  { module: 'Ventas', view: true, create: true, edit: true, delete: false, export: true },
  { module: 'Compras', view: true, create: true, edit: true, delete: false, export: true },
  { module: 'Productos', view: true, create: false, edit: false, delete: false, export: true },
  { module: 'Inventario', view: true, create: false, edit: true, delete: false, export: false },
  { module: 'Contactos', view: true, create: true, edit: true, delete: false, export: true },
  { module: 'Gastos', view: true, create: true, edit: true, delete: false, export: false },
  { module: 'Informes', view: true, create: false, edit: false, delete: false, export: true },
  { module: 'Usuarios', view: false, create: false, edit: false, delete: false, export: false },
  { module: 'Configuración', view: false, create: false, edit: false, delete: false, export: false },
];

export default function ConfiguracionAvanzadaPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>('printers');
  const [selectedRole, setSelectedRole] = useState<number>(2);
  const [permissions, setPermissions] = useState<Permission[]>(defaultPermissions);
  const [showPrinterForm, setShowPrinterForm] = useState(false);

  const togglePermission = (moduleIndex: number, field: keyof Omit<Permission, 'module'>) => {
    setPermissions(prev => prev.map((p, i) => i === moduleIndex ? { ...p, [field]: !p[field] } : p));
  };

  const ToggleIcon = ({ value, onClick }: { value: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`transition-colors ${value ? 'text-primary' : 'text-muted-foreground/40'}`}>
      {value ? <CheckCircle size={18} /> : <XCircle size={18} />}
    </button>
  );

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración Avanzada</h1>
          <p className="text-sm text-muted-foreground mt-1">Impresoras de tickets y permisos por roles</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('printers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'printers' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Printer size={16} />Impresoras de Tickets
          </button>
          <button
            onClick={() => setTab('permissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'permissions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Shield size={16} />Permisos por Roles
          </button>
        </div>

        {/* PRINTERS TAB */}
        {tab === 'printers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{mockPrinters.length} impresoras configuradas</p>
              <button onClick={() => setShowPrinterForm(!showPrinterForm)} className="btn-primary flex items-center gap-2">
                <Plus size={16} />Agregar Impresora
              </button>
            </div>

            {showPrinterForm && (
              <div className="card p-5 space-y-4 border-2 border-primary/20">
                <h3 className="font-semibold text-foreground">Nueva Impresora</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
                    <input className="input-field" placeholder="Ej: Impresora Caja 3" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                    <select className="input-field">
                      <option>Térmica</option>
                      <option>Láser</option>
                      <option>Inyección de tinta</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Conexión</label>
                    <select className="input-field">
                      <option>USB</option>
                      <option>Red (IP)</option>
                      <option>Bluetooth</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Ancho de Papel</label>
                    <select className="input-field">
                      <option>80mm</option>
                      <option>58mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección IP</label>
                    <input className="input-field" placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Puerto</label>
                    <input className="input-field" placeholder="9100" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Ubicación</label>
                    <input className="input-field" placeholder="Ej: Caja 3, Almacén..." />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="btn-primary flex items-center gap-2"><Save size={16} />Guardar Impresora</button>
                  <button onClick={() => setShowPrinterForm(false)} className="btn-secondary">Cancelar</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {mockPrinters.map(printer => (
                <div key={printer.id} className="card p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${printer.status === 'online' ? 'bg-success/10' : 'bg-muted'}`}>
                        <Printer size={20} className={printer.status === 'online' ? 'text-success' : 'text-muted-foreground'} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{printer.name}</p>
                        <p className="text-xs text-muted-foreground">{printer.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {printer.status === 'online'
                        ? <span className="flex items-center gap-1 text-xs text-success"><Wifi size={12} />En línea</span>
                        : <span className="flex items-center gap-1 text-xs text-muted-foreground"><WifiOff size={12} />Desconectada</span>
                      }
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="text-foreground capitalize">{printer.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conexión</span>
                      <span className="text-foreground uppercase">{printer.connection}</span>
                    </div>
                    {printer.ip && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IP</span>
                        <span className="text-foreground font-mono">{printer.ip}:{printer.port}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Papel</span>
                      <span className="text-foreground">{printer.paperWidth}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    {printer.default && (
                      <span className="badge badge-success text-xs">Predeterminada</span>
                    )}
                    {!printer.default && <span />}
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"><Edit2 size={14} /></button>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {tab === 'permissions' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Roles list */}
            <div className="card p-3 space-y-1 h-fit">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</p>
                <button className="text-primary hover:text-primary/80 transition-colors"><Plus size={14} /></button>
              </div>
              {mockRoles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${selectedRole === role.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${role.color}`}>
                    {role.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.users} usuarios</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Permissions matrix */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">
                    Permisos: {mockRoles.find(r => r.id === selectedRole)?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{mockRoles.find(r => r.id === selectedRole)?.description}</p>
                </div>
                <button className="btn-primary flex items-center gap-2"><Save size={16} />Guardar Cambios</button>
              </div>

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">Módulo</th>
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Ver</th>
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Crear</th>
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Editar</th>
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Eliminar</th>
                        <th className="text-center px-4 py-3 text-muted-foreground font-medium">Exportar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions.map((perm, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{perm.module}</td>
                          <td className="px-4 py-3 text-center"><ToggleIcon value={perm.view} onClick={() => togglePermission(i, 'view')} /></td>
                          <td className="px-4 py-3 text-center"><ToggleIcon value={perm.create} onClick={() => togglePermission(i, 'create')} /></td>
                          <td className="px-4 py-3 text-center"><ToggleIcon value={perm.edit} onClick={() => togglePermission(i, 'edit')} /></td>
                          <td className="px-4 py-3 text-center"><ToggleIcon value={perm.delete} onClick={() => togglePermission(i, 'delete')} /></td>
                          <td className="px-4 py-3 text-center"><ToggleIcon value={perm.export} onClick={() => togglePermission(i, 'export')} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-primary" />Permitido</span>
                <span className="flex items-center gap-1"><XCircle size={14} className="text-muted-foreground/40" />Denegado</span>
                <span className="ml-auto">Haz clic en los iconos para cambiar los permisos</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
