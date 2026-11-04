import type { BarcodeFormat, BarcodeValidationResult } from '@/types/barcode';

/**
 * Calcula el dígito verificador para estándares GS1 (EAN-13, EAN-8 y UPC-A).
 * Para Code 128 devuelve null ya que su checksum es interno a la simbología.
 */
export function calculateCheckDigit(format: BarcodeFormat, digits: string): number | null {
  if (format === 'CODE128') {
    return null;
  }

  const clean = (digits || '').replace(/\D/g, '');

  if (format === 'EAN13') {
    if (clean.length < 12) return null;
    const p12 = clean.slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(p12[i], 10);
      sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }

  if (format === 'EAN8') {
    if (clean.length < 7) return null;
    const p7 = clean.slice(0, 7);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = parseInt(p7[i], 10);
      sum += i % 2 === 0 ? d * 3 : d;
    }
    return (10 - (sum % 10)) % 10;
  }

  if (format === 'UPCA') {
    if (clean.length < 11) return null;
    const p11 = clean.slice(0, 11);
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const d = parseInt(p11[i], 10);
      sum += i % 2 === 0 ? d * 3 : d;
    }
    return (10 - (sum % 10)) % 10;
  }

  return null;
}

/**
 * Valida si un código cumple con los requisitos del formato especificado.
 * Devuelve { valid: true } o { valid: false, message: '...' }.
 */
export function validateBarcode(format: BarcodeFormat, value: string): BarcodeValidationResult {
  const raw = (value || '').trim();

  if (!raw) {
    return { valid: false, message: 'El código de barras no puede estar vacío.' };
  }

  if (format === 'CODE128') {
    // Code 128 admite cualquier caracter ASCII imprimible (32 a 126)
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      if (code < 32 || code > 126) {
        return {
          valid: false,
          message: 'Code 128 solo admite caracteres alfanuméricos ASCII estándar.',
        };
      }
    }
    return { valid: true };
  }

  // Los formatos numéricos solo admiten dígitos 0-9
  const digitsOnly = raw.replace(/\D/g, '');

  if (raw !== digitsOnly) {
    return {
      valid: false,
      message: `${format} solo admite números. Cambia a Code 128 para códigos alfanuméricos con letras o guiones.`,
    };
  }

  if (format === 'EAN13') {
    if (digitsOnly.length !== 12 && digitsOnly.length !== 13) {
      return {
        valid: false,
        message: 'EAN-13 requiere 12 dígitos (con cálculo automático) o 13 dígitos completos.',
      };
    }
    if (digitsOnly.length === 13) {
      const expected = calculateCheckDigit('EAN13', digitsOnly.slice(0, 12));
      const actual = parseInt(digitsOnly[12], 10);
      if (expected !== actual) {
        return {
          valid: false,
          message: `Dígito verificador inválido para EAN-13 (esperado: ${expected}, recibido: ${actual}).`,
        };
      }
    }
    return { valid: true };
  }

  if (format === 'EAN8') {
    if (digitsOnly.length !== 7 && digitsOnly.length !== 8) {
      return {
        valid: false,
        message: 'EAN-8 requiere 7 dígitos (con cálculo automático) u 8 dígitos completos.',
      };
    }
    if (digitsOnly.length === 8) {
      const expected = calculateCheckDigit('EAN8', digitsOnly.slice(0, 7));
      const actual = parseInt(digitsOnly[7], 10);
      if (expected !== actual) {
        return {
          valid: false,
          message: `Dígito verificador inválido para EAN-8 (esperado: ${expected}, recibido: ${actual}).`,
        };
      }
    }
    return { valid: true };
  }

  if (format === 'UPCA') {
    if (digitsOnly.length !== 11 && digitsOnly.length !== 12) {
      return {
        valid: false,
        message: 'UPC-A requiere 11 dígitos (con cálculo automático) o 12 dígitos completos.',
      };
    }
    if (digitsOnly.length === 12) {
      const expected = calculateCheckDigit('UPCA', digitsOnly.slice(0, 11));
      const actual = parseInt(digitsOnly[11], 10);
      if (expected !== actual) {
        return {
          valid: false,
          message: `Dígito verificador inválido para UPC-A (esperado: ${expected}, recibido: ${actual}).`,
        };
      }
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Normaliza el código de barras según el formato elegido:
 * - Para EAN-13: Si tiene 12 dígitos, calcula y concatena el 13.° dígito.
 * - Para EAN-8: Si tiene 7 dígitos, calcula y concatena el 8.° dígito.
 * - Para UPC-A: Si tiene 11 dígitos, calcula y concatena el 12.° dígito.
 * - Para Code 128: Limpia espacios exteriores.
 */
export function normalizeBarcode(format: BarcodeFormat, value: string): string {
  const raw = (value || '').trim();

  if (format === 'CODE128') {
    return raw;
  }

  const digits = raw.replace(/\D/g, '');

  if (format === 'EAN13') {
    if (digits.length === 12) {
      const check = calculateCheckDigit('EAN13', digits);
      return `${digits}${check ?? ''}`;
    }
    return digits.slice(0, 13);
  }

  if (format === 'EAN8') {
    if (digits.length === 7) {
      const check = calculateCheckDigit('EAN8', digits);
      return `${digits}${check ?? ''}`;
    }
    return digits.slice(0, 8);
  }

  if (format === 'UPCA') {
    if (digits.length === 11) {
      const check = calculateCheckDigit('UPCA', digits);
      return `${digits}${check ?? ''}`;
    }
    return digits.slice(0, 12);
  }

  return raw;
}

/**
 * Detecta automáticamente el formato más conveniente según el código dado.
 */
export function detectBestBarcodeFormat(code: string): BarcodeFormat {
  const clean = (code || '').trim();
  const digits = clean.replace(/\D/g, '');

  if (digits === clean) {
    if (digits.length === 12 || digits.length === 13) {
      const validation = validateBarcode('EAN13', digits);
      if (validation.valid) return 'EAN13';
    }
    if (digits.length === 7 || digits.length === 8) {
      const validation = validateBarcode('EAN8', digits);
      if (validation.valid) return 'EAN8';
    }
    if (digits.length === 11) {
      return 'UPCA';
    }
  }

  return 'CODE128';
}

/**
 * Determina si el código impreso es demasiado largo y corre riesgo de desbordar
 * el ancho físico de la etiqueta en mm con un ancho de módulo mínimo escaneable (0.25mm).
 */
export function isBarcodeOverflowing(
  format: BarcodeFormat,
  code: string,
  labelWidthMm: number
): boolean {
  const clean = normalizeBarcode(format, code);
  // Ancho mínimo por módulo escaneable = 0.25 mm
  const minModuleMm = 0.25;
  // Quiet zones laterales mínimas = 2 x 2.5 mm = 5 mm
  const quietZonesMm = 5;
  const availableWidthMm = Math.max(labelWidthMm - quietZonesMm, 15);

  let totalModules = 95; // EAN-13 estándar: 95 módulos
  if (format === 'EAN8') {
    totalModules = 67; // EAN-8 estándar: 67 módulos
  } else if (format === 'UPCA') {
    totalModules = 95; // UPC-A estándar: 95 módulos
  } else if (format === 'CODE128') {
    // Code 128: 11 módulos por carácter + start (11) + stop (13) + check (11)
    const charCount = Math.max(clean.length, 1);
    totalModules = 11 * charCount + 35;
  }

  const requiredWidthMm = totalModules * minModuleMm;
  return requiredWidthMm > availableWidthMm;
}
