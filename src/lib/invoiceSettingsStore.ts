import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { obtenerConfiguracionEmpresa, guardarConfiguracionEmpresa } from '@/services/empresa.service';
import { syncCompanyLogoFromDb } from './companyLogo';
import type {
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  PrintFormat,
  TemplateStyle,
  FontFamily,
  FontSize,
  FontWeight,
  PrintDensity,
  SeparatorStyle,
  LogoSize,
} from '@/types/invoice';

export type {
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  PrintFormat,
  TemplateStyle,
  FontFamily,
  FontSize,
  FontWeight,
  PrintDensity,
  SeparatorStyle,
  LogoSize,
};

const INVOICE_SETTINGS_KEY = 'mercato_invoice_settings';

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  // Datos Empresa
  companyName: 'SUPERMERCADO MERCATO S.R.L.',
  companyRnc: '131-45678-9',
  companyPhone: '(809) 555-0199',
  companyEmail: 'contacto@mercato.do',
  companyAddress: 'Av. 27 de Febrero #450, Santo Domingo, R.D.',
  customSlogan: 'Calidad y Frescura para tu Hogar',
  companyWebsite: 'www.mercato.do',

  // Nuevas opciones térmicas
  paperWidth: 80,
  itbisPercent: 18,
  currencySymbol: 'RD$',
  ncfType: 'B02',
  ncfSequence: '',
  showNcf: true,
  copyText: '*** COPIA CLIENTE ***',
  fontSizeOption: 'normal',
  defaultCopies: 1,

  // Visibilidad granular
  showLogo: true,
  showCustomer: true,
  showCashier: true,
  showBarcode: true,
  showFooter: true,

  // Textos y avisos
  footerMessage: '¡Gracias por su compra! Conserve este comprobante para cualquier reclamación.',
  termsAndConditions: 'Cambios permitidos dentro de los 15 días posteriores con factura original.',
  dgiiNotice: 'Documento autorizado por la DGII conforme a la Ley 11-92.',

  // Formato & Dimensiones manuales
  printFormat: 'ticket_80mm',
  templateStyle: 'modern',
  customWidthMm: 80,
  marginMm: 3,
  feedLines: 3,

  // Tipografía Avanzada
  fontFamily: 'courier',
  customFontSizePt: 11,
  fontWeight: 'normal',
  uppercaseOnly: false,
  printDensity: 'normal',
  separatorStyle: 'dashed',
  accentColor: '#0f766e',
  logoSize: 'medium',

  // Cabecera: visibilidad
  showCompanyRnc: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showCompanyEmail: false,
  showSlogan: true,

  // Metadatos de la venta
  showRegisterNumber: true,
  showIssueTime: true,

  // Cliente
  showCustomerInfo: true,
  showCustomerRncInNormal: false,
  showCustomerPhone: false,
  showCustomerAddress: false,

  // Detalle de ítems
  showItemSku: false,
  showItemPriceUnitPrice: true,

  // Totales y pagos
  showTaxBreakdown: true,
  showPaymentDetails: true,
  showChange: true,

  // Pie y elementos de cierre
  showDgiiLegend: true,
  showFooterMessage: true,
  showTerms: true,
  showSignatureLine: true,
  showBarcodeQr: true,

  // Comportamiento de Hardware / Impresora
  autoCutPaper: true,
  openCashDrawer: false,
};

const LISTENERS = new Set<() => void>();

export function getInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(INVOICE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migración segura: si faltan propiedades nuevas, aplicar valores por defecto o equivalentes
      const migrated: Partial<InvoiceSettings> = {
        ...parsed,
        paperWidth:
          parsed.paperWidth ??
          (parsed.customWidthMm === 50
            ? 50
            : parsed.printFormat === 'ticket_58mm' || parsed.customWidthMm === 58
            ? 58
            : 80),
        itbisPercent: parsed.itbisPercent ?? 18,
        currencySymbol: parsed.currencySymbol ?? 'RD$',
        ncfType: parsed.ncfType ?? 'B02',
        ncfSequence: parsed.ncfSequence ?? '',
        showNcf: parsed.showNcf ?? true,
        copyText: parsed.copyText ?? '*** COPIA CLIENTE ***',
        fontSizeOption: parsed.fontSizeOption ?? 'normal',
        showCustomer: parsed.showCustomer ?? parsed.showCustomerInfo ?? true,
        showBarcode: parsed.showBarcode ?? parsed.showBarcodeQr ?? true,
        showFooter: parsed.showFooter ?? parsed.showFooterMessage ?? true,
        defaultCopies: parsed.defaultCopies ?? 1,
      };
      return { ...DEFAULT_INVOICE_SETTINGS, ...migrated };
    }
  } catch {
    /* fallback to defaults */
  }
  return { ...DEFAULT_INVOICE_SETTINGS };
}

export function saveInvoiceSettings(settings: Partial<InvoiceSettings>): InvoiceSettings {
  const current = getInvoiceSettings();
  const updated: InvoiceSettings = { ...current, ...settings };

  // Sincronización bidireccional entre campos nuevos y legados
  if (settings.paperWidth !== undefined) {
    if (settings.paperWidth === 50) {
      updated.printFormat = 'ticket_58mm';
      updated.customWidthMm = 50;
    } else if (settings.paperWidth === 58) {
      updated.printFormat = 'ticket_58mm';
      updated.customWidthMm = 58;
    } else {
      updated.printFormat = 'ticket_80mm';
      updated.customWidthMm = 80;
    }
  } else if (settings.printFormat !== undefined) {
    if (settings.printFormat === 'ticket_58mm') {
      updated.paperWidth = updated.paperWidth === 50 ? 50 : 58;
    } else if (settings.printFormat === 'ticket_80mm') {
      updated.paperWidth = 80;
    }
  }

  if (settings.showCustomer !== undefined) {
    updated.showCustomerInfo = settings.showCustomer;
  } else if (settings.showCustomerInfo !== undefined) {
    updated.showCustomer = settings.showCustomerInfo;
  }

  if (settings.showBarcode !== undefined) {
    updated.showBarcodeQr = settings.showBarcode;
  } else if (settings.showBarcodeQr !== undefined) {
    updated.showBarcode = settings.showBarcodeQr;
  }

  if (settings.showFooter !== undefined) {
    updated.showFooterMessage = settings.showFooter;
  } else if (settings.showFooterMessage !== undefined) {
    updated.showFooter = settings.showFooterMessage;
  }

  try {
    localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    /* ignore write errors */
  }
  LISTENERS.forEach((cb) => cb());
  return updated;
}

export function subscribeInvoiceSettings(callback: () => void): () => void {
  LISTENERS.add(callback);
  return () => {
    LISTENERS.delete(callback);
  };
}

/**
 * Sincroniza la configuración de factura desde Supabase si está disponible.
 * Actualiza el store local y notifica a todos los componentes escuchando (POS, Ventas, etc.).
 */
export async function syncInvoiceSettingsFromSupabase(): Promise<InvoiceSettings> {
  if (!isSupabaseConfigured()) {
    return getInvoiceSettings();
  }
  try {
    const cfg = await obtenerConfiguracionEmpresa();
    void syncCompanyLogoFromDb().catch(() => {});
    if (!cfg) return getInvoiceSettings();

    const fromDb: Partial<InvoiceSettings> = {
      companyName: cfg.nombre_comercial?.trim() || undefined,
      companyRnc: cfg.rnc?.trim() || undefined,
      companyPhone: cfg.telefono?.trim() || undefined,
      companyEmail: cfg.correo?.trim() || undefined,
      companyAddress: cfg.direccion?.trim() || undefined,
      ...(cfg.configuracion_factura && typeof cfg.configuracion_factura === 'object'
        ? cfg.configuracion_factura
        : {}),
    };

    const clean: Partial<InvoiceSettings> = {};
    for (const [k, v] of Object.entries(fromDb)) {
      if (v !== undefined) {
        (clean as Record<string, unknown>)[k] = v;
      }
    }
    return saveInvoiceSettings(clean);
  } catch (err) {
    console.warn('[invoiceSettingsStore] Error al sincronizar desde Supabase:', err);
    return getInvoiceSettings();
  }
}

/**
 * Guarda la configuración de factura en localStorage y la persiste en Supabase.
 */
export async function saveInvoiceSettingsToSupabase(
  settings: Partial<InvoiceSettings>
): Promise<InvoiceSettings> {
  const updated = saveInvoiceSettings(settings);
  if (isSupabaseConfigured()) {
    await guardarConfiguracionEmpresa({
      nombre_comercial: updated.companyName,
      rnc: updated.companyRnc,
      telefono: updated.companyPhone,
      correo: updated.companyEmail,
      direccion: updated.companyAddress,
      configuracion_factura: updated,
    });
  }
  return updated;
}
