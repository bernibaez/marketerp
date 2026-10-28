import { describe, it, expect } from 'vitest';
import {
  decodeVariableWeightBarcode,
  extractPluFromCode,
  normalizePlu,
  isVariableWeightBarcode,
  digitsOnly,
  productMatchesScanCode,
} from '@/lib/scaleBarcode';

describe('scaleBarcode (Decodificación de Códigos de Balanza mscale)', () => {
  it('elimina caracteres no numéricos con digitsOnly', () => {
    expect(digitsOnly('20-00132-01455-8')).toBe('2000132014558');
    expect(digitsOnly(null)).toBe('');
    expect(digitsOnly(undefined)).toBe('');
  });

  it('normaliza PLUs cortos rellenando con ceros a 5 dígitos', () => {
    expect(normalizePlu('1')).toBe('00001');
    expect(normalizePlu('132')).toBe('00132');
    expect(normalizePlu('00132')).toBe('00132');
    expect(normalizePlu('123456')).toBe(''); // mayor a 5 dígitos retorna vacío
  });

  it('reconoce correctamente si un código es de peso variable (prefijo 20-29)', () => {
    expect(isVariableWeightBarcode('2000132014558')).toBe(true);
    expect(isVariableWeightBarcode('2100055005001')).toBe(true);
    expect(isVariableWeightBarcode('7461234567890')).toBe(false); // producto regular
    expect(isVariableWeightBarcode('12345')).toBe(false); // PLU corto no es código completo
  });

  it('extrae el PLU de 5 dígitos de diferentes formatos de entrada', () => {
    // PLU corto
    expect(extractPluFromCode('132')).toBe('00132');
    // Prefijo 20 + PLU (7 dígitos)
    expect(extractPluFromCode('2000132')).toBe('00132');
    // EAN-13 completo: 20 (prefijo) + 00132 (PLU) + 01455 (peso) + 8 (check)
    expect(extractPluFromCode('2000132014558')).toBe('00132');
  });

  it('decodifica el peso exacto en libras desde el código EAN-13 de balanza', () => {
    // Código: Prefijo=20, PLU=00132, Peso=01455 (1.455 lb), Check=8
    const barcode = '2000132014558';
    const decoded = decodeVariableWeightBarcode(barcode);

    expect(decoded.isVariableWeight).toBe(true);
    expect(decoded.plu).toBe('00132');
    expect(decoded.weight).toBe(1.455);
    expect(decoded.unit).toBe('lb');
    expect(decoded.error).toBeUndefined();
  });

  it('rechaza códigos que no cumplen con la longitud requerida de 12 o 13 dígitos', () => {
    const decoded = decodeVariableWeightBarcode('2000132');
    expect(decoded.isVariableWeight).toBe(false);
    expect(decoded.weight).toBe(0);
    expect(decoded.error).toBeDefined();
  });

  it('rechaza códigos con prefijos no asignados a balanzas in-store', () => {
    // 74... es prefijo EAN de país, no balanza in-store
    const decoded = decodeVariableWeightBarcode('7460013201455');
    expect(decoded.isVariableWeight).toBe(false);
    expect(decoded.error).toContain('no corresponde al prefijo de balanza');
  });

  describe('productMatchesScanCode', () => {
    it('coincide código exacto por barcode y sku', () => {
      expect(productMatchesScanCode({ barcode: '750103131130' }, '750103131130')).toBe(true);
      expect(productMatchesScanCode({ sku: 'PROD-001' }, 'prod-001')).toBe(true);
    });

    it('coincide UPC-12 con EAN-13 que tiene 0 inicial (ambas direcciones)', () => {
      // Barcode guardado con 13 dígitos y escaneo con 12
      expect(productMatchesScanCode({ barcode: '0750103131130' }, '750103131130')).toBe(true);
      // Barcode guardado con 12 dígitos y escaneo con 13 (lector añade 0)
      expect(productMatchesScanCode({ barcode: '750103131130' }, '0750103131130')).toBe(true);
    });

    it('coincide códigos numéricos con y sin ceros a la izquierda', () => {
      expect(productMatchesScanCode({ barcode: '001234' }, '1234')).toBe(true);
      expect(productMatchesScanCode({ barcode: '1234' }, '001234')).toBe(true);
    });

    it('coincide por PLU y código de balanza variable', () => {
      expect(productMatchesScanCode({ plu: '132' }, '00132')).toBe(true);
      expect(productMatchesScanCode({ plu: '00132' }, '2000132014558')).toBe(true);
    });
  });
});
