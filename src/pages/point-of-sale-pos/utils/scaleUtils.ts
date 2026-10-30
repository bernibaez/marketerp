import {
  decodeVariableWeightBarcode,
  extractPluFromCode,
  getScalePrefix,
  productMatchesPlu,
  productMatchesScanCode,
  setScalePrefix,
  type DecodedVariableWeightBarcode,
} from '@/lib/scaleBarcode';

export {
  decodeVariableWeightBarcode,
  extractPluFromCode,
  getScalePrefix,
  setScalePrefix,
  type DecodedVariableWeightBarcode,
};

export interface ScaleProduct {
  productId: string;
  name: string;
  sku: string;
  plu?: string;
  price: number;
  wholesalePrice?: number;
  cost: number;
  tax: number;
  unit: string;
  barcode: string;
  category: string;
  image?: string;
  isWeightProduct?: boolean;
}

export const scaleProducts: ScaleProduct[] = [];

export interface ParsedScaleBarcode {
  product: ScaleProduct;
  weight: number;
  price: number;
  total: number;
  isFromEan13: boolean;
}

export function validateEan13(code: string): boolean {
  const clean = code.trim();
  if (!/^\d{13}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(clean[12], 10);
}

export function findScaleProductByCode(catalog: ScaleProduct[], code: string): ScaleProduct | undefined {
  const clean = String(code ?? '').trim();
  if (!clean) return undefined;

  const isWeightedProd = (p: ScaleProduct) =>
    Boolean(p.isWeightProduct) ||
    Boolean((p as any).isWeighted) ||
    Boolean((p as any).es_pesado) ||
    (p as any).saleType === 'weight' ||
    (p as any).saleType === 'both' ||
    (p as any).sale_type === 'weight' ||
    (p as any).sale_type === 'both' ||
    ['lb', 'libra', 'kg', 'kilogramo'].includes(String(p.unit ?? '').toLowerCase());

  // 1. PRIORIDAD ABSOLUTA: Si existe un producto en catálogo cuyo código de barras o SKU coincide exactamente con el código escaneado,
  // ese producto TIENE PRIORIDAD y NO debe confundirse con una etiqueta de balanza generada por azar.
  const upper = clean.toUpperCase();
  const exact = catalog.find((p) => {
    const b = String(p.barcode ?? '').trim().toUpperCase();
    const s = String(p.sku ?? '').trim().toUpperCase();
    return (b && b === upper) || (s && s === upper);
  });
  if (exact) {
    return exact;
  }

  // 2. Solo si NO hubo coincidencia exacta de código comercial, intentamos decodificar como etiqueta de peso de balanza
  const decoded = decodeVariableWeightBarcode(clean);
  if (decoded.isVariableWeight) {
    // IMPORTANTE: Primero buscar en productos PESADOS para evitar que un producto por unidad
    // (ej. una funda de papel) secuestre la etiqueta de balanza de un producto pesado (ej. Jamón Estelar PLU 70).
    const byPluWeighted = catalog.find((p) => isWeightedProd(p) && productMatchesPlu(p, decoded.plu));
    if (byPluWeighted) return byPluWeighted;

    const byPlu = catalog.find((p) => productMatchesPlu(p, decoded.plu));
    if (byPlu) return byPlu;
  }

  const extractedPlu = extractPluFromCode(clean);
  if (extractedPlu) {
    const byPluWeighted = catalog.find((p) => isWeightedProd(p) && productMatchesPlu(p, extractedPlu));
    if (byPluWeighted) return byPluWeighted;

    const byPlu = catalog.find((p) => productMatchesPlu(p, extractedPlu));
    if (byPlu) return byPlu;
  }

  if (decoded.isVariableWeight) {
    const weightedMatch = catalog.find((p) => isWeightedProd(p) && productMatchesScanCode(p, clean));
    if (weightedMatch) return weightedMatch;
  }

  return catalog.find((p) => productMatchesScanCode(p, clean));
}

export function parseScaleBarcode(code: string, catalog?: ScaleProduct[]): ParsedScaleBarcode | null {
  const clean = code.trim();
  if (!clean) return null;

  const productsToSearch = catalog || [];
  const decoded = decodeVariableWeightBarcode(clean);

  // Si no es un código de balanza válido (12-13 dígitos empezando por 20-29), no es ticket de balanza
  if (!decoded.isVariableWeight) return null;

  // Si existe un producto de catálogo cuyo código de barras exacto es este código numérico (ej: un galón con código comercial 2021321111336 o 2578901234902),
  // y ese producto se vende por unidad, NUNCA debe parsearse como peso de balanza.
  const upper = clean.toUpperCase();
  const exactProduct = productsToSearch.find((p) => {
    const b = String(p.barcode ?? '').trim().toUpperCase();
    const s = String(p.sku ?? '').trim().toUpperCase();
    return (b && b === upper) || (s && s === upper);
  });

  if (exactProduct) {
    const isWeight =
      exactProduct.isWeightProduct ||
      Boolean((exactProduct as any).isWeighted) ||
      (exactProduct as any).saleType === 'weight' ||
      (exactProduct as any).saleType === 'both';
    if (!isWeight) return null;
  }

  const matchedProduct = findScaleProductByCode(productsToSearch, clean);
  if (!matchedProduct) return null;

  const isActuallyWeighted =
    matchedProduct.isWeightProduct ||
    Boolean((matchedProduct as any).isWeighted) ||
    (matchedProduct as any).saleType === 'weight' ||
    (matchedProduct as any).saleType === 'both';

  // Si el producto coincidente no está configurado para venta por peso / balanza,
  // NO debe interpretarse como etiqueta de peso variable.
  if (!isActuallyWeighted) {
    return null;
  }

  if (decoded.isVariableWeight && decoded.weight > 0) {
    const total = Math.round(matchedProduct.price * decoded.weight * 100) / 100;
    return {
      product: matchedProduct,
      weight: decoded.weight,
      price: matchedProduct.price,
      total,
      isFromEan13: true,
    };
  }

  return null;
}
