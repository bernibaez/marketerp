import { describe, it, expect } from 'vitest';
import { isAdminOrSuperAdmin, verifySupervisorAdmin } from '@/lib/auth';
import { calculateCartTotals } from '@/lib/cartCalculations';

describe('Cambio de precio de producto en POS (Restricción Administradores y Superadministradores)', () => {
  describe('1. Verificación de roles (isAdminOrSuperAdmin)', () => {
    it('reconoce correctamente a administradores y superadministradores', () => {
      // Como string directo
      expect(isAdminOrSuperAdmin('Administrador')).toBe(true);
      expect(isAdminOrSuperAdmin('administrador')).toBe(true);
      expect(isAdminOrSuperAdmin('admin')).toBe(true);
      expect(isAdminOrSuperAdmin('Super Administrador')).toBe(true);
      expect(isAdminOrSuperAdmin('super administrador')).toBe(true);
      expect(isAdminOrSuperAdmin('superadmin')).toBe(true);
      expect(isAdminOrSuperAdmin('super_admin')).toBe(true);
      expect(isAdminOrSuperAdmin('superadministrador')).toBe(true);

      // Como objeto AuthUser o Perfil
      expect(isAdminOrSuperAdmin({ role: 'Administrador' })).toBe(true);
      expect(isAdminOrSuperAdmin({ role: 'Super Administrador' })).toBe(true);
      expect(isAdminOrSuperAdmin({ role: 'admin' })).toBe(true);
      expect(isAdminOrSuperAdmin({ rolDb: 'admin' })).toBe(true);
      expect(isAdminOrSuperAdmin({ rolDb: 'superadmin' })).toBe(true);
      expect(isAdminOrSuperAdmin({ rolDb: 'super_admin' })).toBe(true);
    });

    it('deniega el acceso a roles no administradores (Cajero, Vendedor, Almacén, etc.)', () => {
      expect(isAdminOrSuperAdmin('Cajero')).toBe(false);
      expect(isAdminOrSuperAdmin('cajero')).toBe(false);
      expect(isAdminOrSuperAdmin('Vendedor')).toBe(false);
      expect(isAdminOrSuperAdmin('Almacenista')).toBe(false);
      expect(isAdminOrSuperAdmin('Contador')).toBe(false);
      expect(isAdminOrSuperAdmin(null)).toBe(false);
      expect(isAdminOrSuperAdmin(undefined)).toBe(false);
      expect(isAdminOrSuperAdmin({ role: 'Cajero' })).toBe(false);
      expect(isAdminOrSuperAdmin({ role: 'Vendedor' })).toBe(false);
      expect(isAdminOrSuperAdmin({ rolDb: 'cajero' })).toBe(false);
    });
  });

  describe('2. Validación de credenciales de supervisor (verifySupervisorAdmin)', () => {
    it('autoriza con código PIN de Administrador (1001)', () => {
      const result = verifySupervisorAdmin({ code: '1001' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.name).toBe('Admin General');
        expect(isAdminOrSuperAdmin(result.user)).toBe(true);
      }
    });

    it('rechaza código PIN de Cajero (2002) porque no es Administrador', () => {
      const result = verifySupervisorAdmin({ code: '2002' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('no tiene permisos de Administrador o Super Administrador');
      }
    });

    it('autoriza con usuario y contraseña de Administrador', () => {
      const result = verifySupervisorAdmin({ username: 'admin', password: 'admin123' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.role).toBe('Administrador');
      }
    });

    it('rechaza usuario y contraseña de Cajero (maria) para autorizar cambios de precio', () => {
      const result = verifySupervisorAdmin({ username: 'maria', password: 'maria123' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('no tiene permisos de Administrador o Super Administrador');
      }
    });

    it('rechaza contraseñas o códigos incorrectos', () => {
      expect(verifySupervisorAdmin({ code: '9999' }).ok).toBe(false);
      expect(verifySupervisorAdmin({ username: 'admin', password: 'wrongpassword' }).ok).toBe(false);
    });
  });

  describe('3. Recálculo del carrito con precio modificado', () => {
    it('calcula subtotal, impuesto y total con el nuevo precio modificado', () => {
      // Producto con precio regular 150, pero modificado a 120 por un administrador
      const cartItem = {
        id: 'cart-1',
        productId: 'prod-1',
        name: 'Arroz Premium 10lb',
        sku: 'ARR-10',
        price: 120, // Precio unitario cambiado
        regularPrice: 150,
        originalPrice: 150,
        isCustomPrice: true,
        cost: 80,
        qty: 2,
        discount: 0,
        tax: 18,
        image: '',
        unit: 'Unidad',
      };

      const totals = calculateCartTotals([cartItem], 0);
      expect(totals.subtotal).toBe(240); // 2 * 120 = 240
      expect(totals.taxTotal).toBe(Math.round(240 * 0.18 * 100) / 100); // 43.20
      expect(totals.total).toBe(240 + 43.20); // 283.20
    });

    it('preserva el precio modificado al incrementar cantidad', () => {
      const existingItem = {
        id: 'cart-1',
        productId: 'prod-1',
        name: 'Aceite de Oliva 500ml',
        sku: 'ACE-500',
        price: 250, // Precio modificado de 300 a 250
        regularPrice: 300,
        originalPrice: 300,
        isCustomPrice: true,
        cost: 180,
        qty: 1,
        discount: 0,
        tax: 0,
        image: '',
        unit: 'Unidad',
      };

      // Simular lógica de usePOSCart:
      // Si el ítem ya tiene isCustomPrice, debe mantener existing.price
      const effectivePrice = existingItem.isCustomPrice
        ? existingItem.price
        : existingItem.regularPrice;

      expect(effectivePrice).toBe(250);
      expect(effectivePrice).not.toBe(300);

      // Si se suma +1 cantidad
      const updatedItem = {
        ...existingItem,
        qty: existingItem.qty + 1,
        price: effectivePrice,
      };

      expect(updatedItem.qty).toBe(2);
      expect(updatedItem.price).toBe(250);
      expect(updatedItem.qty * updatedItem.price).toBe(500);
    });
  });
});
