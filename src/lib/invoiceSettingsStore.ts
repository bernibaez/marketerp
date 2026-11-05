import { isSupabaseConfigured } from '@/services/clienteSupabase';
import { obtenerConfiguracionEmpresa, guardarConfiguracionEmpresa } from '@/services/empresa.service';
import { syncCompanyLogoFromDb } from './companyLogo';
import type {
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  PrintFormat,
  TemplateStyle,
  InvoiceHeightMode,
  FontFamily,
  FontSize,
  FontWeight,
  PrintDensity,
  SeparatorStyle,
  LogoSize,
} from '@/types/invoice';
import { normalizeInvoiceStyle } from '@/types/invoice';

export type {
  InvoiceSettings,
  PaperWidth,
  FontSizeOption,
  PrintFormat,
  TemplateStyle,
  InvoiceHeightMode,
  FontFamily,
  FontSize,
  FontWeight,
  PrintDensity,
  SeparatorStyle,
  LogoSize,
};
export { normalizeInvoiceStyle };

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
  zoomScale: 1.0,
  defaultCopies: 1,

  // Visibilidad granular
  showLogo: true,
  showCustomer: true,
  showCashier: true,
  showBarcode: true,
  showFooter: true,

  // Textos y avisos
  footerMessage: '¡Gracias por preferirnos! Conserve este comprobante para cualquier reclamación.',
  termsAndConditions: 'Cambios permitidos dentro de los 15 días posteriores a la compra con factura original en buen estado.',
  dgiiNotice: 'Documento autorizado por la DGII conforme a la Ley 11-92.',

  // Formato & Dimensiones manuales
  printFormat: 'ticket_80mm',
  templateStyle: 'clasico',
  customWidthMm: 80,
  marginMm: 2,
  feedLines: 1, // 1 línea predeterminada para evitar desperdicio de papel térmico

  // Control de Altura y Optimización Automática de Papel
  heightMode: 'auto',
  paperSaverSmallSales: true,

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
        templateStyle: parsed.templateStyle ?? 'clasico',
        heightMode: parsed.heightMode ?? 'auto',
        paperSaverSmallSales: parsed.paperSaverSmallSales ?? true,
        feedLines: parsed.feedLines !== undefined ? parsed.feedLines : 1,
        fontFamily: parsed.fontFamily ?? 'courier',
        zoomScale: typeof parsed.zoomScale === 'number' && !isNaN(parsed.zoomScale) ? parsed.zoomScale : 1.0,
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
      updated.customWidthMm = 80;
    }
  }

  localStorage.setItem(INVOICE_SETTINGS_KEY, JSON.stringify(updated));
  LISTENERS.forEach((l) => l());
  return updated;
}

export function subscribeInvoiceSettings(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}

export async function syncInvoiceSettingsFromSupabase(): Promise<InvoiceSettings> {
  const local = getInvoiceSettings();
  if (!isSupabaseConfigured()) {
    return local;
  }

  try {
    const config = await obtenerConfiguracionEmpresa();
    if (!config) return local;

    await syncCompanyLogoFromDb();

    const remoteFactura =
      (config.configuracion_factura as Partial<InvoiceSettings> | null) ?? {};

    const merged: InvoiceSettings = {
      ...local,
      ...remoteFactura,
      companyName: config.nombre_comercial || remoteFactura.companyName || local.companyName,
      companyRnc: config.rnc || remoteFactura.companyRnc || local.companyRnc,
      companyPhone: config.telefono || remoteFactura.companyPhone || local.companyPhone,
      companyEmail: config.correo || remoteFactura.companyEmail || local.companyEmail,
      companyAddress: config.direccion || remoteFactura.companyAddress || local.companyAddress,
      currencySymbol: config.moneda || remoteFactura.currencySymbol || local.currencySymbol,
      itbisPercent: config.itbis_porcentaje ?? remoteFactura.itbisPercent ?? local.itbisPercent,
    };

    saveInvoiceSettings(merged);
    return merged;
  } catch (err) {
    console.warn('Error al sincronizar configuración de factura desde Supabase:', err);
    return local;
  }
}

export async function saveInvoiceSettingsToSupabase(settings: InvoiceSettings): Promise<InvoiceSettings> {
  const savedLocal = saveInvoiceSettings(settings);
  if (!isSupabaseConfigured()) {
    return savedLocal;
  }

  try {
    await guardarConfiguracionEmpresa({
      nombre_comercial: settings.companyName || 'Mi Empresa',
      rnc: settings.companyRnc,
      telefono: settings.companyPhone,
      correo: settings.companyEmail,
      direccion: settings.companyAddress,
      moneda: settings.currencySymbol,
      itbis_porcentaje: settings.itbisPercent,
      configuracion_factura: settings,
    });
  } catch (err) {
    console.error('Error al guardar configuración de empresa en Supabase:', err);
  }

  return savedLocal;
}
