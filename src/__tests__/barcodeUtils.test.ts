import { describe, it, expect } from 'vitest';
import {
  calculateCheckDigit,
  validateBarcode,
  normalizeBarcode,
  detectBestBarcodeFormat,
  isBarcodeOverflowing,
} from '@/utils/barcode';

describe('Utilidades de Código de Barras (utils/barcode)', () => {
  describe('1. calculateCheckDigit', () => {
    it('calcula correctamente el dígito verificador para EAN-13 estándar', () => {
      // 746113666506 -> 9 (Botella Pureza Sana)
      expect(calculateCheckDigit('EAN13', '746113666506')).toBe(9);
      // 789100010010 -> 3 (Arroz Selecto)
      expect(calculateCheckDigit('EAN13', '789100010010')).toBe(3);
      // Si ya tiene 13 dígitos, calcula con los primeros 12
      expect(calculateCheckDigit('EAN13', '7461136665069')).toBe(9);
    });

    it('calcula correctamente el dígito verificador para EAN-8', () => {
      // 9638507 -> 4 (Ejemplo estándar GS1)
      expect(calculateCheckDigit('EAN8', '9638507')).toBe(4);
      // 6583325 -> 4
      expect(calculateCheckDigit('EAN8', '6583325')).toBe(4);
      // Si tiene 8 dígitos, usa los primeros 7
      expect(calculateCheckDigit('EAN8', '96385074')).toBe(4);
    });

    it('calcula correctamente el dígito verificador para UPC-A', () => {
      // 03600029145 -> 2
      expect(calculateCheckDigit('UPCA', '03600029145')).toBe(2);
      // 12345678901 -> 2
      expect(calculateCheckDigit('UPCA', '12345678901')).toBe(2);
      // Si tiene 12 dígitos, usa los primeros 11
      expect(calculateCheckDigit('UPCA', '036000291452')).toBe(2);
    });

    it('devuelve null para Code 128 o entradas con longitud insuficiente', () => {
      expect(calculateCheckDigit('CODE128', 'SKU-12345')).toBeNull();
      expect(calculateCheckDigit('EAN13', '123')).toBeNull();
      expect(calculateCheckDigit('EAN8', '12')).toBeNull();
      expect(calculateCheckDigit('UPCA', '12345')).toBeNull();
    });
  });

  describe('2. validateBarcode', () => {
    it('valida EAN-13 correctamente (12 o 13 dígitos y check digit válido)', () => {
      expect(validateBarcode('EAN13', '746113666506').valid).toBe(true);
      expect(validateBarcode('EAN13', '7461136665069').valid).toBe(true);

      // Dígito verificador incorrecto
      const invalidCheck = validateBarcode('EAN13', '7461136665061');
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.message).toContain('Dígito verificador inválido');

      // Longitud errónea
      const invalidLen = validateBarcode('EAN13', '12345');
      expect(invalidLen.valid).toBe(false);
      expect(invalidLen.message).toContain('12 dígitos');
    });

    it('valida EAN-8 correctamente (7 u 8 dígitos y check digit válido)', () => {
      expect(validateBarcode('EAN8', '9638507').valid).toBe(true);
      expect(validateBarcode('EAN8', '96385074').valid).toBe(true);

      const invalid = validateBarcode('EAN8', '96385079');
      expect(invalid.valid).toBe(false);
      expect(invalid.message).toContain('Dígito verificador inválido');
    });

    it('valida UPC-A correctamente (11 o 12 dígitos)', () => {
      expect(validateBarcode('UPCA', '03600029145').valid).toBe(true);
      expect(validateBarcode('UPCA', '036000291452').valid).toBe(true);

      const invalid = validateBarcode('UPCA', '036000291459');
      expect(invalid.valid).toBe(false);
    });

    it('valida Code 128 para alfanuméricos y rechaza cadenas vacías', () => {
      expect(validateBarcode('CODE128', 'ARR-SEL-5LB').valid).toBe(true);
      expect(validateBarcode('CODE128', '123456789').valid).toBe(true);
      expect(validateBarcode('CODE128', '').valid).toBe(false);
      expect(validateBarcode('CODE128', '   ').valid).toBe(false);
    });

    it('rechaza letras en formatos estrictamente numéricos sugiriendo Code 128', () => {
      const result = validateBarcode('EAN13', 'CERVEZA-01');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('solo admite números');
      expect(result.message).toContain('Code 128');
    });
  });

  describe('3. normalizeBarcode', () => {
    it('agrega el dígito verificador faltante a EAN-13 de 12 dígitos', () => {
      expect(normalizeBarcode('EAN13', '746113666506')).toBe('7461136665069');
      expect(normalizeBarcode('EAN13', '7461136665069')).toBe('7461136665069');
    });

    it('agrega el dígito verificador faltante a EAN-8 de 7 dígitos', () => {
      expect(normalizeBarcode('EAN8', '9638507')).toBe('96385074');
      expect(normalizeBarcode('EAN8', '96385074')).toBe('96385074');
    });

    it('agrega el dígito verificador faltante a UPC-A de 11 dígitos', () => {
      expect(normalizeBarcode('UPCA', '03600029145')).toBe('036000291452');
      expect(normalizeBarcode('UPCA', '036000291452')).toBe('036000291452');
    });

    it('mantiene intacto Code 128', () => {
      expect(normalizeBarcode('CODE128', 'SKU-00123')).toBe('SKU-00123');
    });
  });

  describe('4. detectBestBarcodeFormat', () => {
    it('detecta EAN-13 para números de 12 o 13 dígitos con check digit válido', () => {
      expect(detectBestBarcodeFormat('7461136665069')).toBe('EAN13');
      expect(detectBestBarcodeFormat('746113666506')).toBe('EAN13');
    });

    it('detecta EAN-8 para números de 7 u 8 dígitos', () => {
      expect(detectBestBarcodeFormat('96385074')).toBe('EAN8');
      expect(detectBestBarcodeFormat('9638507')).toBe('EAN8');
    });

    it('detecta UPC-A para números de 11 dígitos', () => {
      expect(detectBestBarcodeFormat('03600029145')).toBe('UPCA');
    });

    it('usa CODE128 por defecto para SKUs alfanuméricos', () => {
      expect(detectBestBarcodeFormat('ARR-5LB-SEL')).toBe('CODE128');
      expect(detectBestBarcodeFormat('PLU-2001')).toBe('CODE128');
    });
  });

  describe('5. isBarcodeOverflowing', () => {
    it('detecta si un código largo desborda el ancho físico de una etiqueta pequeña', () => {
      // Un Code 128 con 25 caracteres en una etiqueta pequeña de 40mm requiere más de 40mm
      expect(isBarcodeOverflowing('CODE128', 'ESTE-ES-UN-SKU-DEMASIADO-LARGO-PARA-40MM', 40)).toBe(true);
      // Un código corto de 6 caracteres en 50mm cabe perfectamente
      expect(isBarcodeOverflowing('CODE128', 'SKU-01', 50)).toBe(false);
    });
  });
});

