import { getStoredProducts } from '@/lib/productStore';
import { tryGetSupabase } from './clienteSupabase';

export type TipoMovimientoInventario =
  | 'Venta'
  | 'Compra'
  | 'Ajuste de inventario'
  | 'Devolución'
  | 'Anulación'
  | 'Edición de factura'
  | 'Transferencia';

export interface MovimientoInventarioCentral {
  id: string;
  producto_id: string;
  producto_nombre: string;
  tipo: TipoMovimientoInventario;
  cantidad_entrada: number;
  cantidad_salida: number;
  stock_anterior: number;
  stock_resultante: number;
  documento_referencia: string;
  motivo?: string;
  usuario?: string;
  fecha: string; // ISO
}

export interface RegistroMovimientoInput {
  producto_id: string;
  producto_nombre?: string;
  tipo: TipoMovimientoInventario;
  cantidad_entrada?: number;
  cantidad_salida?: number;
  stock_anterior?: number;
  stock_resultante?: number;
  documento_referencia?: string;
  motivo?: string;
  usuario?: string;
  fecha?: string;
}

const STORAGE_KEY = 'mercato_movimientos_inventario_central';

export function getLocalMovimientosInventario(): MovimientoInventarioCentral[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as MovimientoInventarioCentral[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalMovimientosInventario(movs: MovimientoInventarioCentral[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(movs.slice(0, 5000)));
    }
  } catch {
    // ignore
  }
}

/**
 * Registra de forma centralizada cualquier movimiento de inventario,
 * manteniendo la consistencia de datos y trazabilidad completa (Kardex).
 */
export function registrarMovimientoInventario(input: RegistroMovimientoInput): MovimientoInventarioCentral {
  const prods = getStoredProducts();
  const prod = prods.find((p) => p.id === input.producto_id);
  const prodName = input.producto_nombre || prod?.name || 'Producto';

  const cantEntrada = Math.round(Number(input.cantidad_entrada || 0) * 1000) / 1000;
  const cantSalida = Math.round(Number(input.cantidad_salida || 0) * 1000) / 1000;

  const currentStock = prod ? Number(prod.currentStock || 0) : 0;
  const stockAnterior =
    input.stock_anterior !== undefined ? Number(input.stock_anterior) : currentStock;
  const stockResultante =
    input.stock_resultante !== undefined
      ? Number(input.stock_resultante)
      : Math.round((stockAnterior + cantEntrada - cantSalida) * 1000) / 1000;

  const movimiento: MovimientoInventarioCentral = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    producto_id: input.producto_id,
    producto_nombre: prodName,
    tipo: input.tipo,
    cantidad_entrada: cantEntrada,
    cantidad_salida: cantSalida,
    stock_anterior: Math.round(stockAnterior * 100) / 100,
    stock_resultante: Math.round(stockResultante * 100) / 100,
    documento_referencia: input.documento_referencia || 'SIN-REF',
    motivo: input.motivo,
    usuario: input.usuario || 'Sistema',
    fecha: input.fecha || new Date().toISOString(),
  };

  const list = getLocalMovimientosInventario();
  saveLocalMovimientosInventario([movimiento, ...list]);

  // Si Supabase tiene tabla creada, intentar registrar de forma asíncrona
  const sb = tryGetSupabase();
  if (sb) {
    try {
      void Promise.resolve(
        sb.from('movimientos_inventario').insert({
          producto_id: movimiento.producto_id,
          tipo_movimiento: movimiento.tipo,
          cantidad_entrada: movimiento.cantidad_entrada,
          cantidad_salida: movimiento.cantidad_salida,
          stock_anterior: movimiento.stock_anterior,
          stock_resultante: movimiento.stock_resultante,
          documento_referencia: movimiento.documento_referencia,
          motivo: movimiento.motivo,
          usuario: movimiento.usuario,
          creado_en: movimiento.fecha,
        })
      )
        .then(() => {})
        .catch(() => {});
    } catch {
      // Ignorar si no existe tabla en BD
    }
  }

  return movimiento;
}

export function obtenerMovimientosProductoCentral(productoId: string): MovimientoInventarioCentral[] {
  return getLocalMovimientosInventario().filter((m) => m.producto_id === productoId);
}

export function limpiarMovimientosInventarioLocal(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}


