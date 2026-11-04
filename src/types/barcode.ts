export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPCA' | 'CODE128';

export interface LabelSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  columns?: number;
  rows?: number;
  isContinuous?: boolean;
  isGrid?: boolean;
  description?: string;
}

export interface BarcodeValidationResult {
  valid: boolean;
  message?: string;
}

export interface LabelPrintConfig {
  format: BarcodeFormat;
  sizeId: string;
  customWidthMm: number;
  customHeightMm: number;
  showName: boolean;
  showPrice: boolean;
  showSku: boolean;
  showBarcodeText: boolean;
  showBusinessName: boolean;
  businessName: string;
  currencySymbol: string;
  orientation: 'portrait' | 'landscape';
  copies: Record<string, number>;
  productFormats: Record<string, BarcodeFormat>;
  gridColumns: number;
  gridRows: number;
  gridGapMm: number;
  gridMarginMm: number;
}

export const PRESET_LABEL_SIZES: LabelSize[] = [
  {
    id: '50x30',
    name: '50 x 30 mm',
    widthMm: 50,
    heightMm: 30,
    description: 'Etiqueta estándar de góndola / producto',
  },
  {
    id: '40x25',
    name: '40 x 25 mm',
    widthMm: 40,
    heightMm: 25,
    description: 'Etiqueta pequeña para artículos compactos',
  },
  {
    id: 'thermal-58',
    name: '58 mm Continuo',
    widthMm: 54,
    heightMm: 38,
    isContinuous: true,
    description: 'Rollo térmico estándar 58 mm (POS / Tickets)',
  },
  {
    id: 'thermal-80',
    name: '80 mm Continuo',
    widthMm: 76,
    heightMm: 45,
    isContinuous: true,
    description: 'Rollo térmico ancho 80 mm',
  },
  {
    id: 'a4-grid',
    name: 'Hoja A4 (Rejilla 3x8)',
    widthMm: 65,
    heightMm: 34,
    columns: 3,
    rows: 8,
    isGrid: true,
    description: 'Hoja A4 adhesiva (24 etiquetas por hoja)',
  },
  {
    id: 'custom',
    name: 'Personalizado (mm)',
    widthMm: 50,
    heightMm: 30,
    description: 'Dimensiones libres configurables en mm',
  },
];

export const DEFAULT_LABEL_CONFIG: LabelPrintConfig = {
  format: 'CODE128',
  sizeId: '50x30',
  customWidthMm: 50,
  customHeightMm: 30,
  showName: true,
  showPrice: true,
  showSku: true,
  showBarcodeText: true,
  showBusinessName: true,
  businessName: 'Mi Colmado / Supermercado ERP',
  currencySymbol: 'RD$',
  orientation: 'portrait',
  copies: {},
  productFormats: {},
  gridColumns: 3,
  gridRows: 8,
  gridGapMm: 2,
  gridMarginMm: 8,
};
