export interface CartCalculationItem {
  price: number;
  qty: number;
  discount?: number; // porcentaje (0-100)
  tax?: number; // porcentaje (0-18)
}

export interface CartTotalsResult {
  subtotal: number;
  globalDiscountAmount: number;
  afterDiscount: number;
  taxTotal: number;
  total: number;
}

/**
 * Realiza el cálculo puro de subtotales, descuentos de línea, descuento global,
 * ITBIS (impuesto) y monto final a pagar.
 */
export function calculateCartTotals(
  items: CartCalculationItem[],
  globalDiscountPct: number = 0
): CartTotalsResult {
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = item.price * item.qty;
    const discountPct = item.discount || 0;
    const lineDiscount = lineTotal * (discountPct / 100);
    return sum + (lineTotal - lineDiscount);
  }, 0);

  const globalDiscountAmount = subtotal * ((globalDiscountPct || 0) / 100);
  const afterDiscount = subtotal - globalDiscountAmount;

  const taxTotal = items
    .filter((i) => (i.tax || 0) > 0)
    .reduce((sum, item) => {
      const discountPct = item.discount || 0;
      const lineTotalAfterLineDiscount = item.price * item.qty * (1 - discountPct / 100);
      return sum + lineTotalAfterLineDiscount * ((item.tax || 0) / 100);
    }, 0);

  const total = afterDiscount + taxTotal;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    globalDiscountAmount: Math.round(globalDiscountAmount * 100) / 100,
    afterDiscount: Math.round(afterDiscount * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
