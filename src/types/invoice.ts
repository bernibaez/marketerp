export type PaperWidth = 50 | 58 | 80;
export type FontSizeOption = 'compact' | 'normal' | 'large' | 'xlarge';

export type PrintFormat = 'ticket_80mm' | 'ticket_58mm' | 'ticket_50mm' | 'full_page' | 'half_page';
export type TemplateStyle = 'modern' | 'classic' | 'minimal' | 'bold';
export type FontFamily = 'courier' | 'sans' | 'mono' | 'condensed' | 'consolas' | 'serif';
export type FontSize = 'compact' | 'normal' | 'large';
export type FontWeight = 'normal' | 'medium' | 'bold';
export type PrintDensity = 'compact' | 'normal' | 'spacious';
export type SeparatorStyle = 'dashed' | 'solid' | 'dotted' | 'double';
export type LogoSize = 'small' | 'medium' | 'large';

export interface InvoiceItem {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  total: number;
  // Aliases opcionales para máxima compatibilidad con código existente
  sku?: string;
  qty?: number;
  name?: string;
  price?: number;
  subtotal?: number;
  unit?: string;
  itbis?: number;
  taxRate?: string;
}

export interface InvoiceData {
  numero: string;
  ncf?: string | null;
  fecha: string;
  hora: string;
  cajero?: string;
  cliente?: string;
  clienteRnc?: string;
  items: InvoiceItem[];
  subtotal: number;
  impuesto: number;
  total: number;
  pagado: number;
  cambio: number;

  // Campos adicionales opcionales de integración
  invoiceNumber?: string;
  issueDate?: string;
  issueTime?: string;
  cashier?: string;
  customerName?: string;
  customerRnc?: string;
  customerPhone?: string;
  customerAddress?: string;
  discount?: number;
  taxRatePercent?: number;
  itbis?: number;
  paymentMethod?: string;
  ncfType?: string | null;
  ncfTypeName?: string | null;
  expirationDate?: string | null;
  registerNumber?: string;
  isFiscal?: boolean;
}

export interface InvoiceSettings {
  // Datos Empresa
  companyName: string;
  companyRnc: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  customSlogan: string;
  companyWebsite?: string;
  logoUrl?: string | null;

  // Nuevas opciones térmicas requeridas
  paperWidth: PaperWidth;
  itbisPercent: number;
  currencySymbol: string;
  ncfType: string;
  ncfSequence: string;
  showNcf: boolean;
  copyText: string;
  fontSizeOption: FontSizeOption;
  zoomScale?: number;
  defaultCopies: number;

  // Visibilidad granular
  showLogo: boolean;
  showCustomer: boolean;
  showCashier: boolean;
  showBarcode: boolean;
  showFooter: boolean;

  // Textos y políticas editables
  footerMessage: string;
  termsAndConditions: string;
  dgiiNotice: string;

  // Propiedades existentes para compatibilidad total
  printFormat: PrintFormat;
  templateStyle: TemplateStyle;
  customWidthMm: number;
  marginMm: number;
  feedLines: number;

  fontFamily: FontFamily;
  customFontSizePt: number;
  fontWeight: FontWeight;
  uppercaseOnly: boolean;
  printDensity: PrintDensity;
  separatorStyle: SeparatorStyle;
  accentColor: string;
  logoSize: LogoSize;

  showCompanyRnc: boolean;
  showCompanyAddress: boolean;
  showCompanyPhone: boolean;
  showCompanyEmail: boolean;
  showSlogan: boolean;

  showRegisterNumber: boolean;
  showIssueTime: boolean;
  showCustomerInfo: boolean;
  showCustomerRncInNormal: boolean;
  showCustomerPhone: boolean;
  showCustomerAddress: boolean;

  showItemSku: boolean;
  showItemPriceUnitPrice: boolean;

  showTaxBreakdown: boolean;
  showPaymentDetails: boolean;
  showChange: boolean;

  showDgiiLegend: boolean;
  showFooterMessage: boolean;
  showTerms: boolean;
  showSignatureLine: boolean;
  showBarcodeQr: boolean;

  autoCutPaper: boolean;
  openCashDrawer: boolean;
}
