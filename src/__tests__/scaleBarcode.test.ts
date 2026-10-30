import { describe, it, expect } from 'vitest';
import { parseScaleBarcode, findScaleProductByCode, type ScaleProduct } from '@/pages/point-of-sale-pos/utils/scaleUtils';
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

  describe('parseScaleBarcode (Protección de productos por unidad con prefijo 20-29)', () => {
    it('no procesa como balanza productos regulares por unidad cuyo barcode inicia en 20-29 (ej: Vainilla Blanca Galón)', () => {
      const mockCatalog: ScaleProduct[] = [
        {
          productId: 'prod-vainilla-1',
          name: 'Extracto De Vainilla Blanca Galon',
          sku: '2021321111336',
          barcode: '2021321111336',
          price: 175,
          cost: 141.66,
          tax: 0,
          unit: 'Unidad',
          category: 'Abarrotes',
          isWeightProduct: false,
        },
      ];

      // Al escanear 2021321111336, debe retornar null para que el POS lo venda como UNIDAD regular y no como 11.133 lb
      const result = parseScaleBarcode('2021321111336', mockCatalog);
      expect(result).toBeNull();
    });

    it('procesa correctamente etiquetas de balanza reales cuando el producto sí es pesado', () => {
      const mockCatalog: ScaleProduct[] = [
        {
          productId: 'prod-queso-1',
          name: 'Queso Cheddar',
          sku: 'SKU-00132',
          plu: '00132',
          barcode: '00132',
          price: 200,
          cost: 150,
          tax: 0,
          unit: 'lb',
          category: 'Embutidos',
          isWeightProduct: true,
        },
      ];

      // 20 + 00132 (PLU) + 01455 (1.455 lb) + 8 (check)
      const result = parseScaleBarcode('2000132014558', mockCatalog);
      expect(result).not.toBeNull();
      expect(result?.weight).toBe(1.455);
      expect(result?.isFromEan13).toBe(true);
      expect(result?.product.name).toBe('Queso Cheddar');
    });

    it('no secuestra un producto comercial por coincidencia accidental de PLU', () => {
      // Caso: Carne Molida Foods (barcode 2100003137715) vs Malagueta (PLU 3)
      const mockCatalog: ScaleProduct[] = [
        {
          productId: 'prod-malagueta',
          name: 'MALAGUETA',
          sku: '3',
          plu: '00003',
          barcode: '3',
          price: 310,
          cost: 200,
          tax: 0,
          unit: 'Libra',
          category: 'Especias',
          isWeightProduct: true,
        },
        {
          productId: 'prod-carne-foods',
          name: 'CARNE MOLIDA FOODS',
          sku: '2100003137715',
          barcode: '2100003137715',
          price: 165,
          cost: 120,
          tax: 0,
          unit: 'Unidad',
          category: 'Carnes',
          isWeightProduct: false,
        },
      ];

      const found = findScaleProductByCode(mockCatalog, '2100003137715');
      expect(found).toBeDefined();
      expect(found?.name).toBe('CARNE MOLIDA FOODS');

      // Y parseScaleBarcode debe ser null para vender por unidad
      const parsed = parseScaleBarcode('2100003137715', mockCatalog);
      expect(parsed).toBeNull();
    });

    it('dos productos comerciales con código de 13 dígitos no se cruzan entre sí', () => {
      const prodA = {
        barcode: '2021321111336',
        sku: '2021321111336',
        plu: '',
      };
      const prodB = {
        barcode: '2021321125300',
        sku: '2021321125300',
        plu: '',
      };

      // Escanear prodA no debe coincidir con prodB
      expect(productMatchesScanCode(prodA, '2021321111336')).toBe(true);
      expect(productMatchesScanCode(prodB, '2021321111336')).toBe(false);
      expect(productMatchesScanCode(prodA, '2021321125300')).toBe(false);
      expect(productMatchesScanCode(prodB, '2021321125300')).toBe(true);
    });

    it('productos de empaque fijo con unidad Libra pero no pesados no se tratan como balanza', () => {
      const mockCatalog: ScaleProduct[] = [
        {
          productId: 'prod-arroz-1lib',
          name: 'Arroz La Garza 1Lib',
          sku: '10168',
          barcode: '10168',
          price: 50,
          cost: 39.9,
          tax: 0,
          unit: 'Libra',
          category: 'Abarrotes',
          isWeightProduct: false,
        },
      ];

      const parsed = parseScaleBarcode('10168', mockCatalog);
      expect(parsed).toBeNull();
    });

    it('prioriza producto pesado (Jamon Estelar PLU 70) sobre producto por unidad (Funda de Papel #4 con codigo 0070) al escanear ticket de balanza', () => {
      // Simula el orden alfabético donde 'FUNDA DE PAPEL #4' está antes de 'JAMON ESTELAR INDUVECA'
      const mockCatalog: ScaleProduct[] = [
        {
          productId: 'prod-funda-4',
          name: 'FUNDA DE PAPEL #4',
          sku: '00702000',
          barcode: '0070',
          plu: undefined,
          price: 45,
          cost: 32.5,
          tax: 0,
          unit: 'Paquete',
          category: 'Abarrotes',
          isWeightProduct: false,
        },
        {
          productId: 'prod-jamon-estelar',
          name: 'JAMON ESTELAR INDUVECA',
          sku: '70',
          barcode: '70',
          plu: '00070',
          price: 100,
          cost: 84.44,
          tax: 0,
          unit: 'lb',
          category: 'Embutidos',
          isWeightProduct: true,
        },
      ];

      // Código de balanza: 20 + 00070 (PLU 70) + 00500 (0.500 lb) + 1 (check)
      const scaleTicket = '2000070005001';
      const parsed = parseScaleBarcode(scaleTicket, mockCatalog);

      expect(parsed).not.toBeNull();
      expect(parsed?.product.name).toBe('JAMON ESTELAR INDUVECA');
      expect(parsed?.product.productId).toBe('prod-jamon-estelar');
      expect(parsed?.weight).toBe(0.5);
      expect(parsed?.isFromEan13).toBe(true);

      const found = findScaleProductByCode(mockCatalog, scaleTicket);
      expect(found).toBeDefined();
      expect(found?.name).toBe('JAMON ESTELAR INDUVECA');
    });
  });
});
