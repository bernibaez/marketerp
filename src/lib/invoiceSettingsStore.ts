export type PrintFormat = 'ticket_80mm' | 'ticket_58mm' | 'full_page' | 'half_page';
export type TemplateStyle = 'modern' | 'classic' | 'minimal' | 'bold';
export type FontFamily = 'courier' | 'sans' | 'mono' | 'condensed' | 'consolas' | 'serif';
export type FontSize = 'compact' | 'normal' | 'large';
export type FontWeight = 'normal' | 'medium' | 'bold';
export type PrintDensity = 'compact' | 'normal' | 'spacious';
export type SeparatorStyle = 'dashed' | 'solid' | 'dotted' | 'double';
export type LogoSize = 'small' | 'medium' | 'large';

export interface InvoiceSettings {
  // Datos Empresa
  companyName: string;
  companyRnc: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  customSlogan: string;
  companyWebsite?: string;

  // Formato & Dimensiones manuales
  printFormat: PrintFormat;
  templateStyle: TemplateStyle;
  customWidthMm: number; // Ancho manual en mm (ej: 45 - 110 mm)
  marginMm: number; // Margen lateral en mm (ej: 0 - 8 mm)
  feedLines: number; // Líneas de avance de papel antes de cortar (ej: 1 - 6)

  // Tipografía Avanzada
  fontFamily: FontFamily;
  customFontSizePt: number; // Tamaño manual en pt (ej: 8 - 15 pt)
  fontWeight: FontWeight; // Peso para legibilidad térmica
  uppercaseOnly: boolean; // Forzar todo mayúsculas para POS tradicional
  printDensity: PrintDensity; // Interlineado
  separatorStyle: SeparatorStyle; // Estilo de divisor
  accentColor: string;

  // Logo
  showLogo: boolean;
  logoSize: LogoSize;

  // Cabecera: visibilidad
  showCompanyRnc: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showCompanyEmail: boolean;
  showSlogan: boolean;

  // Metadatos de la venta
  showCashier: boolean;
  showRegisterNumber: boolean;
  showIssueTime: boolean;

  // Cliente
  showCustomerInfo: boolean;
  showCustomerRncInNormal: boolean;
  showCustomerPhone: boolean;
  showCustomerAddress: boolean;

  // Detalle de ítems
  showItemSku: boolean;
  showItemPriceUnitPrice: boolean;

  // Totales y pagos
  showTaxBreakdown: boolean;
  showPaymentDetails: boolean;
  showChange: boolean;

  // Pie y elementos de cierre
  showDgiiLegend: boolean;
  showFooterMessage: boolean;
  showTerms: boolean;
  showSignatureLine: boolean;
  showBarcodeQr: boolean;

  // Comportamiento de Hardware / Impresora
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  defaultCopies: number;

  // Textos personalizados
  footerMessage: string;
  termsAndConditions: string;
  dgiiNotice: string;
}

const INVOICE_SETTINGS_KEY = 'mercato_invoice_settings';

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  companyName: 'SUPERMERCADO MERCATO S.R.L.',
  companyRnc: '131-45678-9',
  companyPhone: '(809) 555-0199',
  companyEmail: 'contacto@mercato.do',
  companyAddress: 'Av. 27 de Febrero #450, Santo Domingo, R.D.',
  customSlogan: 'Calidad y Frescura para tu Hogar',
  companyWebsite: 'www.mercato.do',

  printFormat: 'ticket_80mm',
  templateStyle: 'modern',
  customWidthMm: 80,
  marginMm: 3,
  feedLines: 3,

  fontFamily: 'courier',
  customFontSizePt: 11,
  fontWeight: 'normal',
  uppercaseOnly: false,
  printDensity: 'normal',
  separatorStyle: 'dashed',
  accentColor: '#0f766e',

  showLogo: true,
  logoSize: 'medium',

  showCompanyRnc: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showCompanyEmail: false,
  showSlogan: true,

  showCashier: true,
  showRegisterNumber: true,
  showIssueTime: true,

  showCustomerInfo: true,
  showCustomerRncInNormal: false,
  showCustomerPhone: false,
  showCustomerAddress: false,

  showItemSku: false,
  showItemPriceUnitPrice: true,

  showTaxBreakdown: true,
  showPaymentDetails: true,
  showChange: true,

  showDgiiLegend: true,
  showFooterMessage: true,
  showTerms: true,
  showSignatureLine: true,
  showBarcodeQr: true,

  autoCutPaper: true,
  openCashDrawer: false,
  defaultCopies: 1,

  footerMessage: '¡Gracias por su compra! Conserve este comprobante para cualquier reclamación.',
  termsAndConditions: 'Cambios permitidos dentro de los 15 días posteriores con factura original.',
  dgiiNotice: 'Documento autorizado por la DGII conforme a la Ley 11-92.',
};

const LISTENERS = new Set<() => void>();

export function getInvoiceSettings(): InvoiceSettings {
  try {
    const raw = localStorage.getItem(INVOICE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_INVOICE_SETTINGS, ...parsed };
    }
  } catch {
    /* fallback to defaults */
  }
  return { ...DEFAULT_INVOICE_SETTINGS };
}

export function saveInvoiceSettings(settings: Partial<InvoiceSettings>): InvoiceSettings {
  const current = getInvoiceSettings();
  const updated = { ...current, ...settings };
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
