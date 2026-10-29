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

  const decoded = decodeVariableWeightBarcode(clean);
  if (decoded.isVariableWeight) {
    const byPlu = catalog.find((p) => productMatchesPlu(p, decoded.plu));
    if (byPlu) return byPlu;
  }

  const extractedPlu = extractPluFromCode(clean);
  if (extractedPlu) {
    const byPlu = catalog.find((p) => productMatchesPlu(p, extractedPlu));
    if (byPlu) return byPlu;
  }

  return catalog.find((p) => productMatchesScanCode(p, clean));
}

export function parseScaleBarcode(code: string, catalog?: ScaleProduct[]): ParsedScaleBarcode | null {
  const clean = code.trim();
  if (!clean) return null;

  const productsToSearch = catalog || [];
  const decoded = decodeVariableWeightBarcode(clean);
  const matchedProduct = findScaleProductByCode(productsToSearch, clean);

  if (!matchedProduct) return null;

  const isActuallyWeighted =
    matchedProduct.isWeightProduct ||
    Boolean((matchedProduct as any).isWeighted) ||
    (matchedProduct as any).saleType === 'weight' ||
    (matchedProduct as any).saleType === 'both' ||
    ['lb', 'libra', 'kg', 'kilogramo'].includes((matchedProduct.unit || '').toLowerCase());

  // Si el producto coincidente no está configurado para venta por peso / balanza,
  // NO debe interpretarse como etiqueta de peso variable.
  if (!isActuallyWeighted) {
    return null;
  }

  if (decoded.isVariableWeight) {
    const total = Math.round(matchedProduct.price * decoded.weight * 100) / 100;
    return {
      product: matchedProduct,
      weight: decoded.weight,
      price: matchedProduct.price,
      total,
      isFromEan13: true,
    };
  }

  const weight = 1.0;
  const total = Math.round(matchedProduct.price * weight * 100) / 100;
  return { product: matchedProduct, weight, price: matchedProduct.price, total, isFromEan13: false };
}
