import React, { useState, useEffect, useRef } from 'react';
import {
  getInvoiceSettings,
  saveInvoiceSettings,
  DEFAULT_INVOICE_SETTINGS,
  syncInvoiceSettingsFromSupabase,
  saveInvoiceSettingsToSupabase,
  type InvoiceSettings,
} from '@/lib/invoiceSettingsStore';
import { getCompanyLogo, setCompanyLogo, clearCompanyLogo } from '@/lib/companyLogo';
import { toast } from '@/lib/toast';
import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { obtenerConfiguracionEmpresa, guardarConfiguracionEmpresa } from '@/services/empresa.service';
import { InvoiceDesignForm } from './components/InvoiceDesignForm';
import { InvoiceLivePreview } from './components/InvoiceLivePreview';

export interface InvoiceSettingsTabProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function InvoiceSettingsTab({ onBack, showBackButton = false }: InvoiceSettingsTabProps) {
  const [settings, setSettings] = useState<InvoiceSettings>(() => getInvoiceSettings());
  const [logoUrl, setLogoUrlState] = useState<string | null>(() => getCompanyLogo());
  const [previewTab, setPreviewTab] = useState<'consumidor' | 'fiscal'>('consumidor');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void syncInvoiceSettingsFromSupabase()
      .then((synced) => {
        setSettings(synced);
      })
      .catch(() => {});
  }, []);

  const handleFieldChange = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'printFormat') {
        if (value === 'ticket_58mm') updated.customWidthMm = 58;
        if (value === 'ticket_80mm') updated.customWidthMm = 80;
      }
      return updated;
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCompanyLogo(result);
      setLogoUrlState(result);
      toast.success('Logotipo cargado correctamente');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    clearCompanyLogo();
    setLogoUrlState(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info('Logotipo eliminado');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveInvoiceSettingsToSupabase(settings);
      setSettings(saved);
      toast.success('Configuración de factura guardada en Supabase y aplicada al POS y Ventas');
    } catch (e) {
      toast.error('Error al guardar la configuración: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSettings(DEFAULT_INVOICE_SETTINGS);
    try {
      await saveInvoiceSettingsToSupabase(DEFAULT_INVOICE_SETTINGS);
      toast.info('Valores restablecidos y guardados en Supabase');
    } catch {
      saveInvoiceSettings(DEFAULT_INVOICE_SETTINGS);
      toast.info('Valores restablecidos a predeterminados');
    }
  };

  const handlePrintTest = () => {
    // Guardar temporalmente para que el PrintableInvoice use las opciones actuales
    saveInvoiceSettings(settings);
    window.print();
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-2">
      {/* Botón Volver opcional */}
      {showBackButton && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>Volver a configuración</span>
          </button>
        </div>
      )}

      {/* Encabezado: Título, descripción y botones de acción */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Diseño & Configuración de Facturas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personaliza el ancho manual, fuentes térmicas, márgenes y elementos que aparecen en tus comprobantes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrintTest}
            title="Abre el diálogo de impresión con el diseño actual"
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Imprimir prueba</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            Restablecer
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium transition cursor-pointer"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Dos columnas: Formulario a la izquierda · Vista previa fija a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
        <InvoiceDesignForm
          settings={settings}
          logoUrl={logoUrl}
          fileInputRef={fileInputRef}
          onFieldChange={handleFieldChange}
          onLogoUpload={handleLogoUpload}
          onRemoveLogo={handleRemoveLogo}
        />

        <InvoiceLivePreview
          settings={settings}
          logoUrl={logoUrl}
          previewTab={previewTab}
          onTabChange={setPreviewTab}
        />
      </div>
    </div>
  );
}
