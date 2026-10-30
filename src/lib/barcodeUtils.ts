/** Utility for auto-generating unique barcodes and rendering barcode vectors */

/** Generate a unique 13-digit barcode (EAN-13 structure with 789 prefix for DO local products) */
export function generateUniqueBarcode(): string {
  const prefix = '789';
  let middle = '';
  for (let i = 0; i < 9; i++) {
    middle += Math.floor(Math.random() * 10).toString();
  }
  const raw12 = prefix + middle;
  // Calculate EAN-13 checksum digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(raw12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return raw12 + checkDigit.toString();
}

/** Simple Code 128 / Barcode pattern generator for HTML SVG visualization */
export function generateBarcodeBars(code: string): { width: number; key: string }[] {
  const clean = code.replace(/[^0-9A-Z-]/gi, '') || '1234567890';
  const bars: { width: number; key: string }[] = [];
  let seed = 0;
  for (let i = 0; i < clean.length; i++) {
    seed += clean.charCodeAt(i);
  }

  // Quiet zone start
  bars.push({ width: 3, key: 'start-space' });
  bars.push({ width: 2, key: 'start-bar-1' });
  bars.push({ width: 1, key: 'start-space-1' });

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const w1 = (charCode % 3) + 1;
    const w2 = ((charCode * 2) % 3) + 1;
    const w3 = ((charCode * 3) % 2) + 1;
    bars.push({ width: w1, key: `b-${i}-1` });
    bars.push({ width: 1, key: `s-${i}-1` });
    bars.push({ width: w2, key: `b-${i}-2` });
    bars.push({ width: 1, key: `s-${i}-2` });
    bars.push({ width: w3, key: `b-${i}-3` });
    bars.push({ width: 2, key: `s-${i}-3` });
  }

  // Stop pattern
  bars.push({ width: 2, key: 'stop-bar-1' });
  bars.push({ width: 1, key: 'stop-space-1' });
  bars.push({ width: 3, key: 'stop-bar-2' });

  return bars;
}

/** Generate a unique product SKU code */
export function generateUniqueSku(prefix = 'SKU'): string {
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const cleanPrefix = (prefix || 'SKU').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'SKU';
  return `${cleanPrefix}-${randomSuffix}`;
}

/** Generate a clean SKU specifically for pack / presentation products (e.g. Fardo, Cartón) */
export function generatePresentationSku(unit: string, baseSku?: string, baseName?: string): string {
  const normUnit = (unit || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  let prefix = 'PACK';
  if (normUnit.includes('FARDO')) prefix = 'FDO';
  else if (normUnit.includes('CARTON')) prefix = 'CTN';
  else if (normUnit.includes('CAJA')) prefix = 'CAJ';
  else if (normUnit.includes('PAQUETE')) prefix = 'PQT';
  else if (normUnit.includes('BOLSA')) prefix = 'BLS';
  else if (normUnit.includes('COMBO')) prefix = 'CMB';
  else prefix = normUnit.slice(0, 3) || 'PK';

  if (baseSku) {
    const cleanBase = baseSku.replace(/^(FDO|CTN|CAJ|PQT|BLS|CMB|SKU)-/i, '').trim();
    return `${prefix}-${cleanBase}`;
  }

  if (baseName) {
    const nameCode = baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.slice(0, 3).toUpperCase())
      .join('-');
    if (nameCode) {
      return `${prefix}-${nameCode}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    }
  }

  return `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}
