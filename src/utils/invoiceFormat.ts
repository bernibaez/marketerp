/**
 * Utilidades puras para el formateo y cálculo de facturas térmicas.
 * No tienen dependencias de estado ni efectos secundarios.
 */

export interface TotalsCalculationResult {
  subtotal: number;
  impuesto: number;
  total: number;
  cambio: number;
  totalArticulos: number;
}

/**
 * Formatea un número como moneda con separador de miles y exactamente 2 decimales.
 * Maneja valores positivos, negativos, cero y montos grandes (millones).
 *
 * Ejemplos:
 *   formatCurrency(1250) -> "RD$ 1,250.00"
 *   formatCurrency(10500250.75, '$') -> "$ 10,500,250.75"
 *   formatCurrency(-50, 'RD$') -> "-RD$ 50.00"
 */
export function formatCurrency(amount: number | null | undefined, symbol = 'RD$'): string {
  const num = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // Redondear a 2 decimales evitando errores de punto flotante
  const rounded = (Math.round((absNum + Number.EPSILON) * 100) / 100).toFixed(2);
  const [integerPart, decimalPart] = rounded.split('.');

  // Insertar comas cada 3 dígitos
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedNumber = `${formattedInteger}.${decimalPart}`;

  if (symbol) {
    return isNegative ? `-${symbol} ${formattedNumber}` : `${symbol} ${formattedNumber}`;
  }
  return isNegative ? `-${formattedNumber}` : formattedNumber;
}

/**
 * Normaliza y formatea una fecha al estándar legible DD/MM/YYYY.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) {
    const today = new Date();
    return today.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (input instanceof Date) {
    return input.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  const trimmed = input.trim();
  // Si ya viene con formato D/M/YYYY, DD/MM/YYYY o DD-MM-YYYY
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split(/[/-]/);
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Si viene en formato ISO (YYYY-MM-DD...)
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    // Para evitar desfases de zona horaria con cadenas "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-');
      return `${day}/${month}/${year}`;
    }
    return parsed.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return trimmed;
}

/**
 * Normaliza y formatea una hora en formato HH:mm o hh:mm a.
 */
export function formatTime(
  dateOrTime?: string | Date | null,
  timeFallback?: string
): string {
  if (timeFallback && typeof timeFallback === 'string' && timeFallback.trim()) {
    return timeFallback.trim();
  }

  if (!dateOrTime) {
    const now = new Date();
    return now.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  if (dateOrTime instanceof Date) {
    return dateOrTime.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const str = dateOrTime.trim();
  // Si ya es solo una hora legible (ej: 09:30 AM o 14:15:00)
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s?[APap][Mm])?$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('es-DO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  return str;
}

/**
 * Ajusta y envuelve un texto en múltiples líneas respetando un ancho máximo de caracteres por línea.
 * Respeta saltos de línea explícitos y corta palabras largas si superan el límite.
 */
export function wrapText(text: string | null | undefined, maxCharsPerLine = 22): string[] {
  if (!text || !text.trim()) {
    return [];
  }

  const safeMax = Math.max(1, maxCharsPerLine);
  const rawLines = text.split('\n');
  const result: string[] = [];

  for (const rawLine of rawLines) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      continue;
    }

    let currentLine = '';

    for (const word of words) {
      // Si la palabra sola es más larga que el ancho máximo, debemos particionarla
      if (word.length > safeMax) {
        if (currentLine) {
          result.push(currentLine);
          currentLine = '';
        }
        let remainder = word;
        while (remainder.length > safeMax) {
          result.push(remainder.slice(0, safeMax));
          remainder = remainder.slice(safeMax);
        }
        currentLine = remainder;
        continue;
      }

      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= safeMax) {
        currentLine += ` ${word}`;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
}

/**
 * Recorta un texto si supera la longitud máxima especificada, agregando una elipsis opcional.
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number,
  ellipsis = '...'
): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cutIndex = Math.max(0, maxLength - ellipsis.length);
  return `${trimmed.slice(0, cutIndex).trim()}${ellipsis}`;
}

/**
 * Calcula con precisión decimal el subtotal, ITBIS, total y cambio de una factura.
 */
export function calculateInvoiceTotals(
  items: Array<{ cantidad: number; precioUnitario: number }>,
  itbisPercent = 18,
  discount = 0,
  pagado = 0
): TotalsCalculationResult {
  const safeItems = Array.isArray(items) ? items : [];

  let subtotalAcc = 0;
  let totalArticulosAcc = 0;

  for (const it of safeItems) {
    const qty = typeof it.cantidad === 'number' && !Number.isNaN(it.cantidad) ? it.cantidad : 0;
    const price = typeof it.precioUnitario === 'number' && !Number.isNaN(it.precioUnitario) ? it.precioUnitario : 0;
    subtotalAcc += qty * price;
    totalArticulosAcc += qty;
  }

  // Redondear subtotal
  const subtotal = Math.round((subtotalAcc + Number.EPSILON) * 100) / 100;
  const safeDiscount = Math.max(0, typeof discount === 'number' && !Number.isNaN(discount) ? discount : 0);
  const baseImponible = Math.max(0, subtotal - safeDiscount);

  const safeItbisPercent = Math.max(0, typeof itbisPercent === 'number' && !Number.isNaN(itbisPercent) ? itbisPercent : 0);
  const impuesto =
    safeItbisPercent > 0
      ? Math.round((baseImponible * (safeItbisPercent / 100) + Number.EPSILON) * 100) / 100
      : 0;

  const total = Math.round((baseImponible + impuesto + Number.EPSILON) * 100) / 100;

  const safePagado = typeof pagado === 'number' && !Number.isNaN(pagado) ? pagado : 0;
  const cambio = safePagado > total ? Math.round((safePagado - total + Number.EPSILON) * 100) / 100 : 0;

  return {
    subtotal,
    impuesto,
    total,
    cambio,
    totalArticulos: Math.round((totalArticulosAcc + Number.EPSILON) * 100) / 100,
  };
}

