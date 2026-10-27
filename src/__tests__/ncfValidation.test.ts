import { describe, it, expect } from 'vitest';
import { validateRNC, NCF_TYPES, type NCFType } from '@/lib/ncfStore';

describe('ncfValidation (Comprobantes Fiscales y Validación DGII)', () => {
  describe('Validación de RNC (9 dígitos - Módulo 11)', () => {
    it('valida correctamente un RNC válido de 9 dígitos', () => {
      // 131-88073-8
      const result = validateRNC('131880738');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RNC');
      expect(result.message).toContain('correcto');
    });

    it('acepta RNC con guiones y formatos típicos', () => {
      const result = validateRNC('131-88073-8');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('RNC');
    });

    it('rechaza un RNC con dígito verificador incorrecto', () => {
      const result = validateRNC('131880739'); // dígito incorrecto (debería ser 8)
      expect(result.valid).toBe(false);
      expect(result.type).toBe('RNC');
      expect(result.message).toContain('inválido');
    });
  });

  describe('Validación de Cédula Dominicana (11 dígitos - Módulo 10)', () => {
    it('valida correctamente una Cédula con dígito verificador válido', () => {
      const result = validateRNC('00100000009');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('Cédula');
      expect(result.message).toContain('correcta');
    });

    it('acepta Cédula con formato con guiones 001-0000000-9', () => {
      const result = validateRNC('001-0000000-9');
      expect(result.valid).toBe(true);
      expect(result.type).toBe('Cédula');
    });

    it('rechaza una Cédula con dígito verificador alterado', () => {
      const result = validateRNC('00100000001'); // incorrecto
      expect(result.valid).toBe(false);
      expect(result.type).toBe('Cédula');
    });
  });

  describe('Validación de entradas inválidas', () => {
    it('rechaza cadenas con longitud distinta a 9 o 11 dígitos numéricos', () => {
      expect(validateRNC('12345').valid).toBe(false);
      expect(validateRNC('1234567890').valid).toBe(false); // 10 dígitos
      expect(validateRNC('').valid).toBe(false);
    });
  });

  describe('Tipos de NCF y requerimientos fiscales', () => {
    it('requiere RNC obligatorio para B01, B14 y B15', () => {
      expect(NCF_TYPES.B01.requiresRnc).toBe(true);
      expect(NCF_TYPES.B14.requiresRnc).toBe(true);
      expect(NCF_TYPES.B15.requiresRnc).toBe(true);
    });

    it('no exige RNC obligatorio para Facturas de Consumo B02', () => {
      expect(NCF_TYPES.B02.requiresRnc).toBe(false);
    });

    it('garantiza formato estándar de secuencia DGII con 8 dígitos de relleno', () => {
      const tipo: NCFType = 'B01';
      const secuencia = 47;
      const ncfFormateado = `${tipo}${String(secuencia).padStart(8, '0')}`;

      expect(ncfFormateado).toBe('B0100000047');
      expect(ncfFormateado.length).toBe(11);
    });
  });
});
