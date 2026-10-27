import { describe, it, expect } from 'vitest';
import { calculateCartTotals } from '@/lib/cartCalculations';

describe('calculateCartTotals (Lógica de Facturación y Carrito)', () => {
  it('calcula correctamente un carrito simple sin impuestos ni descuentos', () => {
    const items = [
      { price: 100, qty: 2, discount: 0, tax: 0 },
      { price: 50, qty: 3, discount: 0, tax: 0 },
    ];

    const result = calculateCartTotals(items, 0);

    expect(result.subtotal).toBe(350);
    expect(result.globalDiscountAmount).toBe(0);
    expect(result.afterDiscount).toBe(350);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(350);
  });

  it('aplica correctamente el ITBIS del 18% a productos gravados', () => {
    const items = [
      { price: 1000, qty: 1, discount: 0, tax: 18 },
      { price: 500, qty: 1, discount: 0, tax: 0 }, // exento
    ];

    const result = calculateCartTotals(items, 0);

    expect(result.subtotal).toBe(1500);
    expect(result.taxTotal).toBe(180); // 18% de 1000
    expect(result.total).toBe(1680);
  });

  it('calcula descuentos por ítem individual antes de los impuestos', () => {
    const items = [
      // 100 con 10% de descuento = 90 neto. ITBIS 18% de 90 = 16.20
      { price: 100, qty: 1, discount: 10, tax: 18 },
    ];

    const result = calculateCartTotals(items, 0);

    expect(result.subtotal).toBe(90);
    expect(result.taxTotal).toBe(16.2);
    expect(result.total).toBe(106.2);
  });

  it('aplica descuento global sobre el subtotal acumulado', () => {
    const items = [
      { price: 200, qty: 1, discount: 0, tax: 0 },
      { price: 300, qty: 1, discount: 0, tax: 0 },
    ];
    // Subtotal = 500. Descuento global 10% = 50. Total = 450
    const result = calculateCartTotals(items, 10);

    expect(result.subtotal).toBe(500);
    expect(result.globalDiscountAmount).toBe(50);
    expect(result.afterDiscount).toBe(450);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(450);
  });

  it('maneja con precisión productos de balanza con cantidades fraccionadas (peso)', () => {
    const items = [
      // Carne a 250 RD$/lb, peso 2.455 lb
      { price: 250, qty: 2.455, discount: 0, tax: 18 },
    ];

    const result = calculateCartTotals(items, 0);

    // 250 * 2.455 = 613.75
    expect(result.subtotal).toBe(613.75);
    // ITBIS 18% de 613.75 = 110.475 -> 110.48
    expect(result.taxTotal).toBe(110.48);
    // Total = 724.23
    expect(result.total).toBe(724.23);
  });

  it('devuelve ceros en todos los campos si el carrito está vacío', () => {
    const result = calculateCartTotals([], 0);

    expect(result.subtotal).toBe(0);
    expect(result.globalDiscountAmount).toBe(0);
    expect(result.afterDiscount).toBe(0);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(0);
  });
});
