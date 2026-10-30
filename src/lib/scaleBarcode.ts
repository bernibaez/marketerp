/** Códigos de peso variable de balanza (prefijo in-store 20–29). */

export function digitsOnly(code: string | null | undefined): string {
  return String(code ?? '').replace(/\D/g, '');
}

/** PLU de 5 dígitos conservando ceros (00132). Vacío si no es un PLU corto. */
export function normalizePlu(raw: string | null | undefined): string {
  const digits = digitsOnly(raw);
  if (!digits || digits.length > 5) return '';
  return digits.padStart(5, '0');
}

/** Variantes con y sin ceros para buscar el mismo PLU en BD o catálogo. */
export function pluSearchVariants(plu: string): string[] {
  const padded = normalizePlu(plu);
  if (!padded) return [];
  const stripped = padded.replace(/^0+/, '') || '0';
  return [...new Set([padded, stripped, stripped.padStart(4, '0'), stripped.padStart(5, '0')])];
}

function scaleBody(digits: string): string {
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isVariableWeightBarcode(code: string | null | undefined): boolean {
  const body = scaleBody(digitsOnly(code));
  return (body.length === 12 || body.length === 13) && /^2[0-9]/.test(body);
}

/**
 * Extrae el PLU de:
 * - PLU corto (1–5 dígitos)
 * - prefijo+PLU (7 dígitos, ej. 2000132)
 * - EAN-13/12 de balanza (20 + PLU + peso [+ dígito de control])
 * - GTIN-14 con 0 inicial
 */
export function extractPluFromCode(code: string | null | undefined): string {
  const digits = digitsOnly(code);
  if (!digits) return '';
  if (digits.length <= 5) return normalizePlu(digits);

  const body = scaleBody(digits);
  if (body.length >= 7 && /^2[0-9]/.test(body)) {
    return body.substring(2, 7);
  }
  return '';
}

export interface DecodedVariableWeightBarcode {
  isVariableWeight: boolean;
  plu: string;
  weight: number;
  unit: string;
  rawBarcode: string;
  error?: string;
}

let activeScalePrefix = '20';

export function setScalePrefix(prefix: string): void {
  if (prefix && prefix.trim().length === 2) {
    activeScalePrefix = prefix.trim();
  }
}

export function getScalePrefix(): string {
  return activeScalePrefix;
}

export function decodeVariableWeightBarcode(
  barcode: string,
  configuredPrefix: string = activeScalePrefix
): DecodedVariableWeightBarcode {
  const raw = String(barcode ?? '').trim();
  const body = scaleBody(digitsOnly(raw));

  if (!(body.length === 12 || body.length === 13)) {
    return {
      isVariableWeight: false,
      plu: '',
      weight: 0,
      unit: 'lb',
      rawBarcode: raw,
      error: 'El código de peso debe tener 12 o 13 dígitos numéricos.',
    };
  }

  const prefix = body.substring(0, 2);
  const validPrefixes = Array.from(
    new Set([configuredPrefix, '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'])
  );

  if (!validPrefixes.includes(prefix)) {
    return {
      isVariableWeight: false,
      plu: '',
      weight: 0,
      unit: 'lb',
      rawBarcode: raw,
      error: `El código no corresponde al prefijo de balanza configurado (${configuredPrefix}).`,
    };
  }

  const plu = body.substring(2, 7);
  const weightRaw = parseInt(body.substring(7, 12), 10);
  const weight = Number.isFinite(weightRaw) ? Math.round((weightRaw / 1000) * 1000) / 1000 : 0;

  return {
    isVariableWeight: true,
    plu,
    weight,
    unit: 'lb',
    rawBarcode: raw,
  };
}

export interface ScalePluIdentity {
  plu?: string | null;
  barcode?: string | null;
  sku?: string | null;
  isWeightProduct?: boolean;
  es_pesado?: boolean;
  saleType?: string;
  sale_type?: string;
  unit?: string;
}

export function isExplicitUnitOnlyProduct(product: ScalePluIdentity): boolean {
  if (product.isWeightProduct === true || product.es_pesado === true) return false;
  const st = String(product.saleType || product.sale_type || '').toLowerCase();
  if (st === 'weight' || st === 'both') return false;
  const unit = String(product.unit || '').toLowerCase();
  if (['lb', 'libra', 'kg', 'kilogramo'].includes(unit)) return false;

  return (
    product.isWeightProduct === false ||
    product.es_pesado === false ||
    st === 'unit'
  );
}

function pluFromSku(sku: string): string {
  const trimmed = sku.trim();
  if (/^\d{1,5}$/.test(trimmed)) return normalizePlu(trimmed);
  const tagged = trimmed.match(/^PLU-?(\d{1,5})$/i);
  if (tagged) return normalizePlu(tagged[1]);
  return '';
}

function pluFromBarcodeField(barcode: string): string {
  const digits = digitsOnly(barcode);
  if (!digits) return '';
  if (digits.length <= 5) return normalizePlu(digits);
  if (digits.length === 7 && /^2[0-9]/.test(digits)) return digits.substring(2, 7);
  return '';
}

/** Todos los PLU con los que un producto pesado puede identificarse. */
export function collectProductPlus(product: ScalePluIdentity): string[] {
  const found = new Set<string>();

  for (const part of String(product.plu ?? '').split(/[,;|/]+/)) {
    const n = normalizePlu(part.trim());
    if (n) found.add(n);
  }

  // Si el producto es explícitamente vendido únicamente por unidad (no pesado),
  // su SKU o código de barras numérico no debe interpretarse como PLU de balanza.
  if (!isExplicitUnitOnlyProduct(product)) {
    const fromBarcode = pluFromBarcodeField(String(product.barcode ?? ''));
    if (fromBarcode) found.add(fromBarcode);

    const fromSku = pluFromSku(String(product.sku ?? ''));
    if (fromSku) found.add(fromSku);
  }

  return [...found];
}

export function productMatchesPlu(product: ScalePluIdentity, plu: string): boolean {
  const target = normalizePlu(plu) || extractPluFromCode(plu);
  if (!target) return false;
  return collectProductPlus(product).includes(target);
}

export function productMatchesScanCode(product: ScalePluIdentity, rawCode: string): boolean {
  const clean = String(rawCode ?? '').trim();
  if (!clean) return false;

  const upper = clean.toUpperCase();
  const barcode = String(product.barcode ?? '').trim();
  const sku = String(product.sku ?? '').trim();
  const plu = String(product.plu ?? '').trim();

  // 1. Coincidencia exacta por código de barras, SKU o PLU explícito (insensible a mayúsculas)
  if (barcode && barcode.toUpperCase() === upper) return true;
  if (sku && sku.toUpperCase() === upper) return true;
  if (plu && (plu.toUpperCase() === upper || normalizePlu(plu) === normalizePlu(clean))) return true;

  // Si el código escaneado es una etiqueta de balanza (variable weight, 12-13 dígitos empezando por 20-29):
  // Un producto configurado exclusivamente para venta por unidad NO debe emparejarse por PLU extraído.
  if (isVariableWeightBarcode(clean) && isExplicitUnitOnlyProduct(product)) {
    return false;
  }

  // 2. Coincidencia por PLU o etiqueta de balanza: solo si el producto realmente tiene un identificador de PLU
  // (evita que un producto comercial con código de 13 dígitos empezando por 20... se empareje por azar con otro producto)
  const productPlus = collectProductPlus(product);
  if (productPlus.length > 0) {
    const extracted = extractPluFromCode(clean);
    if (extracted && productPlus.includes(extracted)) return true;
  }

  // 3. Normalización de códigos numéricos comerciales (UPC-A de 12 dígitos vs EAN-13 de 13 dígitos y ceros a la izquierda)
  const cleanDigits = digitsOnly(clean);
  if (cleanDigits && cleanDigits.length >= 2) {
    const cleanNoZeros = cleanDigits.replace(/^0+/, '');

    // Comparar contra barcode numérico
    const barcodeDigits = digitsOnly(barcode);
    if (barcodeDigits && barcodeDigits.length >= 2) {
      // UPC (12 dígitos) vs EAN (13 dígitos con 0 inicial)
      if (
        (cleanDigits.length === 12 && barcodeDigits === '0' + cleanDigits) ||
        (barcodeDigits.length === 12 && cleanDigits === '0' + barcodeDigits)
      ) {
        return true;
      }
      // Mismos dígitos significativos si tienen al menos 3 dígitos y longitudes consistentes
      if (cleanNoZeros.length >= 3 && cleanNoZeros === barcodeDigits.replace(/^0+/, '')) {
        return true;
      }
    }

    // Comparar contra SKU si el SKU es numérico
    const skuDigits = digitsOnly(sku);
    if (skuDigits && skuDigits.length >= 2) {
      if (
        (cleanDigits.length === 12 && skuDigits === '0' + cleanDigits) ||
        (skuDigits.length === 12 && cleanDigits === '0' + skuDigits)
      ) {
        return true;
      }
      if (cleanNoZeros.length >= 3 && cleanNoZeros === skuDigits.replace(/^0+/, '')) {
        return true;
      }
    }
  }

  return false;
}
