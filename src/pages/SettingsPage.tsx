import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  Building2, MapPin, FileText, Printer, Tag, DollarSign, Globe, Bell, Shield, Mail, Upload, Save, ChevronRight, Trash2, ImageIcon, ShieldCheck
} from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  clearCompanyLogo,
  getCompanyLogo,
  readLogoFile,
  setCompanyLogo,
  syncCompanyLogoFromDb,
} from '@/lib/companyLogo';
import NCFSettingsTab from './settings/NCFSettingsTab';
import PermissionsSettingsTab from './settings/PermissionsSettingsTab';
import InvoiceSettingsTab from './settings/InvoiceSettingsTab';
import { obtenerConfiguracionEmpresa, guardarConfiguracionEmpresa } from '@/services/empresa.service';
import { obtenerSucursales } from '@/services/transferencias.service';
import { saveInvoiceSettings } from '@/lib/invoiceSettingsStore';

const settingsSections = [
  { id: 'company', label: 'Empresa', icon: <Building2 size={18} /> },
  { id: 'locations', label: 'Ubicaciones', icon: <MapPin size={18} /> },
  { id: 'invoice', label: 'Facturación & Impresión', icon: <FileText size={18} /> },
  { id: 'ncf', label: 'Secuencias NCF (DGII)', icon: <ShieldCheck size={18} /> },
  { id: 'taxes', label: 'Impuestos', icon: <Tag size={18} /> },
  { id: 'currency', label: 'Moneda', icon: <DollarSign size={18} /> },
  { id: 'localization', label: 'Localización', icon: <Globe size={18} /> },
  { id: 'notifications', label: 'Notificaciones', icon: <Bell size={18} /> },
  { id: 'permissions', label: 'Permisos', icon: <Shield size={18} /> },
  { id: 'email', label: 'Correo', icon: <Mail size={18} /> },
];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const initialSection = searchParams.get('section') || searchParams.get('tab') || 'company';
  const [activeSection, setActiveSection] = useState(initialSection);
  const [logoPreview, setLogoPreview] = useState<string | null>(() => getCompanyLogo());
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [empresaNombre, setEmpresaNombre] = useState('Mercato Supermercado');
  const [empresaRnc, setEmpresaRnc] = useState('');
  const [empresaTelefono, setEmpresaTelefono] = useState('');
  const [empresaCorreo, setEmpresaCorreo] = useState('');
  const [empresaDireccion, setEmpresaDireccion] = useState('');
  const [empresaMoneda, setEmpresaMoneda] = useState('DOP');
  const [empresaItbis, setEmpresaItbis] = useState('18');
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [sucursales, setSucursales] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('mercato_notif_prefs');
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* ignore */
    }
    return {
      stock: true,
      venta: false,
      compra: true,
      vencimiento: true,
      caja: false,
      usuario: true,
    };
  });

  useEffect(() => {
    void syncCompanyLogoFromDb().then((url) => setLogoPreview(url));
    void obtenerConfiguracionEmpresa()
      .then((cfg) => {
        if (!cfg) return;
        setEmpresaNombre(cfg.nombre_comercial || '');
        setEmpresaRnc(cfg.rnc || '');
        setEmpresaTelefono(cfg.telefono || '');
        setEmpresaCorreo(cfg.correo || '');
        setEmpresaDireccion(cfg.direccion || '');
        setEmpresaMoneda(cfg.moneda || 'DOP');
        setEmpresaItbis(String(cfg.itbis_porcentaje ?? 18));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  useEffect(() => {
    if (activeSection !== 'locations') return;
    setLoadingSucursales(true);
    void obtenerSucursales()
      .then(setSucursales)
      .catch(() => setSucursales([]))
      .finally(() => setLoadingSucursales(false));
  }, [activeSection]);

  const openFilePicker = () => {
    setLogoError(null);
    fileInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await readLogoFile(file);
      setLogoPreview(dataUrl);
      setCompanyLogo(dataUrl);
      setLogoError(null);
      toast.success('Logo actualizado');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la imagen';
      setLogoError(message);
      toast.error(message);
    }
  };

  const handleRemoveLogo = () => {
    clearCompanyLogo();
    setLogoPreview(null);
    setLogoError(null);
    toast.success('Logo eliminado');
  };

  const handleSaveEmpresa = async () => {
    setSavingEmpresa(true);
    try {
      await guardarConfiguracionEmpresa({
        nombre_comercial: empresaNombre,
        rnc: empresaRnc,
        telefono: empresaTelefono,
        correo: empresaCorreo,
        direccion: empresaDireccion,
        moneda: empresaMoneda,
        itbis_porcentaje: parseFloat(empresaItbis) || 18,
      });
      saveInvoiceSettings({
        companyName: empresaNombre,
        companyRnc: empresaRnc,
        companyPhone: empresaTelefono,
        companyEmail: empresaCorreo,
        companyAddress: empresaDireccion,
      });
      toast.success('Datos de empresa guardados y sincronizados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingEmpresa(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 slide-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-1">Administra la configuración del sistema</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="card p-3 space-y-1 h-fit">
            {settingsSections?.map(s => (
              <button key={s?.id} onClick={() => setActiveSection(s?.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === s?.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <div className="flex items-center gap-3">{s?.icon}{s?.label}</div>
                <ChevronRight size={14} className={activeSection === s?.id ? 'text-primary' : 'text-muted-foreground'} />
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeSection === 'company' && (
              <div className="card p-6 space-y-6">
                <h2 className="text-lg font-bold text-foreground">Información de la Empresa</h2>
                <div className="flex items-center gap-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-secondary/50 overflow-hidden relative group"
                    aria-label="Subir logo"
                  >
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo de la empresa"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <>
                        <Upload size={20} className="text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Logo</span>
                      </>
                    )}
                    <span className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon size={22} className="text-white" />
                    </span>
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Sube el logo de tu empresa (PNG, JPG, WEBP o SVG, máx. 2MB). Se mostrará en el menú lateral.
                    </p>
                    {logoError && (
                      <p className="text-xs text-danger mt-1">{logoError}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button type="button" onClick={openFilePicker} className="btn-secondary text-xs py-1.5">
                        {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                      </button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="btn-secondary text-xs py-1.5 text-danger flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre de la empresa *</label>
                    <input className="input-field" value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">RNC / Cédula *</label>
                    <input className="input-field" value={empresaRnc} onChange={(e) => setEmpresaRnc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono</label>
                    <input className="input-field" value={empresaTelefono} onChange={(e) => setEmpresaTelefono(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Correo electrónico</label>
                    <input className="input-field" type="email" value={empresaCorreo} onChange={(e) => setEmpresaCorreo(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Dirección</label>
                    <input className="input-field" value={empresaDireccion} onChange={(e) => setEmpresaDireccion(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Moneda</label>
                    <input className="input-field" value={empresaMoneda} onChange={(e) => setEmpresaMoneda(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">ITBIS %</label>
                    <input className="input-field" type="number" value={empresaItbis} onChange={(e) => setEmpresaItbis(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    disabled={savingEmpresa}
                    onClick={() => void handleSaveEmpresa()}
                  >
                    <Save size={16} />
                    {savingEmpresa ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'locations' && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Ubicaciones Comerciales</h2>
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={() =>
                      toast.info('Crea sucursales desde Supabase (tabla sucursales) o el módulo de transferencias')
                    }
                  >
                    <MapPin size={16} />
                    Nueva Sucursal
                  </button>
                </div>
                {loadingSucursales ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Cargando sucursales…</p>
                ) : sucursales.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No hay sucursales en la base de datos.
                  </p>
                ) : (
                  sucursales.map((loc) => (
                    <div
                      key={loc.id}
                      className="border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{loc.nombre}</p>
                          <p className="text-xs text-muted-foreground font-mono">{loc.codigo}</p>
                        </div>
                      </div>
                      <span className="badge-success">Activa</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeSection === 'taxes' && (
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Tasas de Impuestos</h2>
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2 text-sm"
                    disabled={savingEmpresa}
                    onClick={() => void handleSaveEmpresa()}
                  >
                    <Tag size={16} />
                    Guardar ITBIS
                  </button>
                </div>
                <div className="border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">ITBIS general</p>
                    <p className="text-xs text-muted-foreground">Porcentaje aplicado en ventas y POS</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input-field w-28 text-right font-bold"
                      type="number"
                      value={empresaItbis}
                      onChange={(e) => setEmpresaItbis(e.target.value)}
                    />
                    <span className="text-muted-foreground font-semibold">%</span>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'currency' && (
              <div className="card p-6 space-y-4">
                <h2 className="text-lg font-bold text-foreground">Moneda y Formato</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Moneda principal</label>
                    <select
                      className="input-field"
                      value={empresaMoneda}
                      onChange={(e) => setEmpresaMoneda(e.target.value)}
                    >
                      <option value="DOP">DOP - Peso Dominicano</option>
                      <option value="USD">USD - Dólar Americano</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Símbolo</label>
                    <input
                      className="input-field"
                      readOnly
                      value={empresaMoneda === 'USD' ? 'US$' : empresaMoneda === 'EUR' ? '€' : 'RD$'}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    disabled={savingEmpresa}
                    onClick={() => void handleSaveEmpresa()}
                  >
                    <Save size={16} />
                    {savingEmpresa ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="card p-6 space-y-4">
                <h2 className="text-lg font-bold text-foreground">Notificaciones</h2>
                <p className="text-xs text-muted-foreground">
                  Preferencias locales de este navegador (aún no hay tabla de notificaciones en Supabase).
                </p>
                {(
                  [
                    { key: 'stock', label: 'Stock mínimo alcanzado', desc: 'Notificar cuando un producto llegue al stock mínimo' },
                    { key: 'venta', label: 'Nueva venta registrada', desc: 'Notificar al registrar una nueva venta' },
                    { key: 'compra', label: 'Compra recibida', desc: 'Notificar al recibir una orden de compra' },
                    { key: 'vencimiento', label: 'Productos próximos a vencer', desc: 'Alertar 30 días antes del vencimiento' },
                    { key: 'caja', label: 'Caja abierta/cerrada', desc: 'Notificar apertura y cierre de caja' },
                    { key: 'usuario', label: 'Nuevo usuario registrado', desc: 'Notificar cuando se cree un nuevo usuario' },
                  ] as const
                ).map((n) => {
                  const enabled = Boolean(notifPrefs[n.key]);
                  return (
                    <div
                      key={n.key}
                      className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm">{n.label}</p>
                        <p className="text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={n.label}
                        onClick={() => {
                          setNotifPrefs((prev) => {
                            const next = { ...prev, [n.key]: !prev[n.key] };
                            try {
                              localStorage.setItem('mercato_notif_prefs', JSON.stringify(next));
                            } catch {
                              /* ignore */
                            }
                            toast.success(next[n.key] ? `${n.label} activada` : `${n.label} desactivada`);
                            return next;
                          });
                        }}
                        className={`
                          relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
                          border-2 transition-colors duration-200
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                          ${enabled
                            ? 'border-primary bg-primary'
                            : 'border-slate-500 bg-slate-400 dark:border-slate-400 dark:bg-slate-500'}
                        `}
                      >
                        <span
                          className={`
                            pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full
                            bg-white shadow-md ring-1 ring-slate-900/20
                            transition-transform duration-200 ease-out
                            ${enabled ? 'translate-x-5' : 'translate-x-0'}
                          `}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeSection === 'invoice' && <InvoiceSettingsTab />}

            {activeSection === 'ncf' && <NCFSettingsTab />}

            {activeSection === 'permissions' && <PermissionsSettingsTab />}

            {!['company', 'locations', 'taxes', 'currency', 'notifications', 'invoice', 'ncf', 'permissions'].includes(
              activeSection
            ) && (
              <div className="card p-6 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  {settingsSections.find((s) => s.id === activeSection)?.icon}
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {settingsSections.find((s) => s.id === activeSection)?.label}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Esta sección aún no tiene persistencia en Supabase. Usa Empresa, NCF o Permisos para configuración operativa.
                </p>
                <button
                  type="button"
                  className="btn-primary mt-4"
                  onClick={() => setActiveSection('company')}
                >
                  Ir a Empresa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
