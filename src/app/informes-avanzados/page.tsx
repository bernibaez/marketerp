'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { usePathname } from 'next/navigation';
import { FileText, DollarSign, Users, Activity, Download, Printer, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ReportTab = 'dgii' | 'caja' | 'agente' | 'actividades';

const dgiiData = [
  { ncf: 'B01-00000001', tipo: 'Factura de Crédito Fiscal', cliente: 'Empresa ABC S.R.L.', rnc: '1-01-23456-7', fecha: '2024-01-15', subtotal: 62000, itbis: 11160, total: 73160, estado: 'Válido' },
  { ncf: 'B01-00000002', tipo: 'Factura de Crédito Fiscal', cliente: 'Distribuidora XYZ', rnc: '1-02-34567-8', fecha: '2024-01-15', subtotal: 38500, itbis: 6930, total: 45430, estado: 'Válido' },
  { ncf: 'B02-00000001', tipo: 'Factura de Consumidor Final', cliente: 'Juan Pérez', rnc: '-', fecha: '2024-01-14', subtotal: 2400, itbis: 432, total: 2832, estado: 'Válido' },
  { ncf: 'B02-00000002', tipo: 'Factura de Consumidor Final', cliente: 'Rosa Jiménez', rnc: '-', fecha: '2024-01-14', subtotal: 850, itbis: 153, total: 1003, estado: 'Válido' },
  { ncf: 'B04-00000001', tipo: 'Nota de Crédito', cliente: 'Empresa ABC S.R.L.', rnc: '1-01-23456-7', fecha: '2024-01-13', subtotal: -5000, itbis: -900, total: -5900, estado: 'Válido' },
  { ncf: 'B01-00000003', tipo: 'Factura de Crédito Fiscal', cliente: 'Supermercado El Sol', rnc: '1-03-45678-9', fecha: '2024-01-12', subtotal: 92000, itbis: 16560, total: 108560, estado: 'Válido' },
];

const cajaData = [
  { hora: '08:00', ventas: 0, efectivo: 0, tarjeta: 0 },
  { hora: '09:00', ventas: 3, efectivo: 2800, tarjeta: 1200 },
  { hora: '10:00', ventas: 7, efectivo: 5600, tarjeta: 3400 },
  { hora: '11:00', ventas: 12, efectivo: 8900, tarjeta: 6100 },
  { hora: '12:00', ventas: 18, efectivo: 14200, tarjeta: 9800 },
  { hora: '13:00', ventas: 22, efectivo: 17500, tarjeta: 12500 },
  { hora: '14:00', ventas: 15, efectivo: 11200, tarjeta: 8800 },
  { hora: '15:00', ventas: 19, efectivo: 15600, tarjeta: 10400 },
  { hora: '16:00', ventas: 25, efectivo: 19800, tarjeta: 14200 },
  { hora: '17:00', ventas: 20, efectivo: 16000, tarjeta: 11000 },
];

const agentData = [
  { agent: 'Roberto Díaz', ventas: 45, total: 185000, clientes: 28, comision: 9250, meta: 200000 },
  { agent: 'Luisa Fernández', ventas: 38, total: 162000, clientes: 22, comision: 8100, meta: 180000 },
  { agent: 'Miguel Torres', ventas: 31, total: 128000, clientes: 18, comision: 6400, meta: 150000 },
  { agent: 'Carmen Reyes', ventas: 27, total: 98000, clientes: 15, comision: 4900, meta: 120000 },
];

const activityLog = [
  { id: 1, user: 'Admin General', action: 'Creó factura FAC-0089', module: 'Ventas', ip: '192.168.1.10', date: '2024-01-15 16:45:23', type: 'create' },
  { id: 2, user: 'Roberto Díaz', action: 'Editó producto ARR-001', module: 'Productos', ip: '192.168.1.15', date: '2024-01-15 16:30:11', type: 'edit' },
  { id: 3, user: 'Luisa Fernández', action: 'Eliminó cotización COT-010', module: 'Cotizaciones', ip: '192.168.1.20', date: '2024-01-15 16:15:05', type: 'delete' },
  { id: 4, user: 'Admin General', action: 'Inició sesión', module: 'Sistema', ip: '192.168.1.10', date: '2024-01-15 08:00:01', type: 'login' },
  { id: 5, user: 'Miguel Torres', action: 'Exportó informe de ventas', module: 'Informes', ip: '192.168.1.25', date: '2024-01-15 15:50:44', type: 'export' },
  { id: 6, user: 'Carmen Reyes', action: 'Creó cliente nuevo: Pedro Martínez', module: 'Contactos', ip: '192.168.1.30', date: '2024-01-15 15:22:18', type: 'create' },
  { id: 7, user: 'Admin General', action: 'Cambió configuración de impresora', module: 'Configuración', ip: '192.168.1.10', date: '2024-01-15 14:10:33', type: 'edit' },
  { id: 8, user: 'Roberto Díaz', action: 'Procesó devolución DEV-005', module: 'Ventas', ip: '192.168.1.15', date: '2024-01-15 13:45:09', type: 'create' },
];

const activityTypeMap: Record<string, { cls: string; label: string }> = {
  create: { cls: 'badge-success', label: 'Crear' },
  edit: { cls: 'badge-warning', label: 'Editar' },
  delete: { cls: 'badge-danger', label: 'Eliminar' },
  login: { cls: 'badge-info', label: 'Sesión' },
  export: { cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs px-2 py-0.5 rounded-full', label: 'Exportar' },
};

export default function InformesAvanzadosPage() {
  const pathname = usePathname();
  const [tab, setTab] = useState<ReportTab>('dgii');
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2024-01-31');
  const [ncfType, setNcfType] = useState('all');

  const totalItbis = dgiiData.reduce((s, r) => s + r.itbis, 0);
  const totalVentas = dgiiData.reduce((s, r) => s + r.subtotal, 0);
  const totalGeneral = dgiiData.reduce((s, r) => s + r.total, 0);

  const cajaEfectivo = cajaData.reduce((s, d) => s + d.efectivo, 0);
  const cajaTarjeta = cajaData.reduce((s, d) => s + d.tarjeta, 0);
  const cajaTotal = cajaEfectivo + cajaTarjeta;

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dgii', label: 'Informe Fiscal DGII', icon: <FileText size={16} /> },
    { id: 'caja', label: 'Informe de Caja', icon: <DollarSign size={16} /> },
    { id: 'agente', label: 'Por Agente Comercial', icon: <Users size={16} /> },
    { id: 'actividades', label: 'Registro de Actividades', icon: <Activity size={16} /> },
  ];

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-6 slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Informes Avanzados</h1>
            <p className="text-sm text-muted-foreground mt-1">DGII, Caja, Agentes y Actividades</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2"><Printer size={16} />Imprimir</button>
            <button className="btn-primary flex items-center gap-2"><Download size={16} />Exportar PDF</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Date filters */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
              <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
              <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {tab === 'dgii' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo NCF</label>
                <select className="input-field" value={ncfType} onChange={e => setNcfType(e.target.value)}>
                  <option value="all">Todos</option>
                  <option value="B01">B01 - Crédito Fiscal</option>
                  <option value="B02">B02 - Consumidor Final</option>
                  <option value="B04">B04 - Nota de Crédito</option>
                  <option value="B14">B14 - Régimen Especial</option>
                </select>
              </div>
            )}
            {tab === 'agente' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Agente</label>
                <select className="input-field">
                  <option>Todos los agentes</option>
                  {agentData.map(a => <option key={a.agent}>{a.agent}</option>)}
                </select>
              </div>
            )}
            <button className="btn-primary flex items-center gap-2"><Filter size={16} />Aplicar Filtros</button>
          </div>
        </div>

        {/* DGII TAB */}
        {tab === 'dgii' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">Total Ventas (sin ITBIS)</p>
                <p className="text-2xl font-bold text-foreground mt-1">RD${totalVentas.toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">ITBIS Recaudado</p>
                <p className="text-2xl font-bold text-primary mt-1">RD${totalItbis.toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">Total General</p>
                <p className="text-2xl font-bold text-foreground mt-1">RD${totalGeneral.toLocaleString()}</p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Comprobantes Fiscales (NCF)</h3>
                <button className="btn-secondary text-xs flex items-center gap-1"><Download size={14} />Exportar 606/607</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">NCF</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Tipo</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cliente / RNC</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Subtotal</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">ITBIS</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dgiiData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-primary font-medium">{row.ncf}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{row.tipo}</td>
                        <td className="px-4 py-3">
                          <p className="text-foreground font-medium text-xs">{row.cliente}</p>
                          <p className="text-muted-foreground text-xs">{row.rnc}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{row.fecha}</td>
                        <td className={`px-4 py-3 text-right text-xs font-medium ${row.subtotal < 0 ? 'text-danger' : 'text-foreground'}`}>
                          RD${row.subtotal.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs font-medium ${row.itbis < 0 ? 'text-danger' : 'text-foreground'}`}>
                          RD${row.itbis.toLocaleString()}
                        </td>
                        <td className={`px-4 py-3 text-right text-xs font-bold ${row.total < 0 ? 'text-danger' : 'text-foreground'}`}>
                          RD${row.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="badge badge-success text-xs">{row.estado}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/30 border-t-2 border-border">
                      <td colSpan={4} className="px-4 py-3 font-bold text-foreground text-sm">TOTALES</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground text-sm">RD${totalVentas.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary text-sm">RD${totalItbis.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground text-sm">RD${totalGeneral.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CAJA TAB */}
        {tab === 'caja' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Apertura de Caja', value: 'RD$5,000', sub: '08:00 AM', color: 'text-foreground' },
                { label: 'Total Efectivo', value: `RD$${cajaEfectivo.toLocaleString()}`, sub: 'Ventas en efectivo', color: 'text-success' },
                { label: 'Total Tarjeta', value: `RD$${cajaTarjeta.toLocaleString()}`, sub: 'Ventas con tarjeta', color: 'text-info' },
                { label: 'Total del Día', value: `RD$${cajaTotal.toLocaleString()}`, sub: 'Todas las ventas', color: 'text-primary' },
              ].map((stat, i) => (
                <div key={i} className="card p-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-foreground mb-4">Ventas por Hora</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cajaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hora" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                  <Tooltip formatter={(v: number) => `RD$${v.toLocaleString()}`} />
                  <Bar dataKey="efectivo" name="Efectivo" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tarjeta" name="Tarjeta" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Movimientos de Caja</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Hora</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Ventas</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Efectivo</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Tarjeta</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajaData.filter(d => d.ventas > 0).map((d, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{d.hora}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{d.ventas}</td>
                        <td className="px-4 py-3 text-right text-success font-medium">RD${d.efectivo.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-info font-medium">RD${d.tarjeta.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">RD${(d.efectivo + d.tarjeta).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AGENTE TAB */}
        {tab === 'agente' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">Total Ventas (todos)</p>
                <p className="text-2xl font-bold text-foreground mt-1">RD${agentData.reduce((s, a) => s + a.total, 0).toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">Total Comisiones</p>
                <p className="text-2xl font-bold text-primary mt-1">RD${agentData.reduce((s, a) => s + a.comision, 0).toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-muted-foreground">Total Facturas</p>
                <p className="text-2xl font-bold text-foreground mt-1">{agentData.reduce((s, a) => s + a.ventas, 0)}</p>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-foreground mb-4">Ventas por Agente</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis dataKey="agent" type="category" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={110} />
                  <Tooltip formatter={(v: number) => `RD$${v.toLocaleString()}`} />
                  <Bar dataKey="total" name="Ventas" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="meta" name="Meta" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Agente</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Facturas</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Clientes</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total Ventas</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Meta</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Comisión (5%)</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentData.map((agent, i) => {
                      const pct = Math.round((agent.total / agent.meta) * 100);
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {agent.agent.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="font-medium text-foreground">{agent.agent}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{agent.ventas}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{agent.clientes}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">RD${agent.total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">RD${agent.meta.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">RD${agent.comision.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-secondary rounded-full h-2">
                                <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-success' : pct >= 75 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${pct >= 100 ? 'text-success' : pct >= 75 ? 'text-warning' : 'text-danger'}`}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVIDADES TAB */}
        {tab === 'actividades' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Acciones', value: activityLog.length, color: 'text-foreground' },
                { label: 'Creaciones', value: activityLog.filter(a => a.type === 'create').length, color: 'text-success' },
                { label: 'Ediciones', value: activityLog.filter(a => a.type === 'edit').length, color: 'text-warning' },
                { label: 'Eliminaciones', value: activityLog.filter(a => a.type === 'delete').length, color: 'text-danger' },
              ].map((stat, i) => (
                <div key={i} className="card p-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <input className="input-field pl-4" placeholder="Buscar por usuario o acción..." />
                </div>
                <select className="input-field w-44">
                  <option>Todos los usuarios</option>
                  {[...new Set(activityLog.map(a => a.user))].map(u => <option key={u}>{u}</option>)}
                </select>
                <select className="input-field w-44">
                  <option>Todos los módulos</option>
                  {[...new Set(activityLog.map(a => a.module))].map(m => <option key={m}>{m}</option>)}
                </select>
                <select className="input-field w-36">
                  <option>Todas las acciones</option>
                  <option>Crear</option>
                  <option>Editar</option>
                  <option>Eliminar</option>
                  <option>Sesión</option>
                  <option>Exportar</option>
                </select>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Usuario</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Acción</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Módulo</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">IP</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Fecha y Hora</th>
                      <th className="text-center px-4 py-3 text-muted-foreground font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLog.map(log => {
                      const typeInfo = activityTypeMap[log.type];
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {log.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="font-medium text-foreground text-xs">{log.user}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{log.action}</td>
                          <td className="px-4 py-3">
                            <span className="badge bg-secondary text-foreground text-xs">{log.module}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ip}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{log.date}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`badge ${typeInfo.cls}`}>{typeInfo.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>Mostrando {activityLog.length} registros</span>
                <div className="flex gap-1">
                  <button className="px-3 py-1 rounded border border-border hover:bg-secondary transition-colors">Anterior</button>
                  <button className="px-3 py-1 rounded bg-primary text-primary-foreground">1</button>
                  <button className="px-3 py-1 rounded border border-border hover:bg-secondary transition-colors">Siguiente</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
