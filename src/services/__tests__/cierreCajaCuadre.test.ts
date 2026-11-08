import { describe, it, expect, beforeEach } from 'vitest';
import {
  iniciarCaja,
  calcularResumenCajaAbierta,
  cerrarTurnoCaja,
} from '../cierresCaja.service';
import { procesarVenta, calcularEfectivoNetoVenta } from '../ventas.service';
import { crearGasto } from '../gastos.service';
import { addCashExpense } from '@/lib/posStore';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: createMemoryStorage(),
  configurable: true,
  writable: true,
});

describe('Prueba integral de Cierre de Caja y Cuadre de Efectivo Físico', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  it('calcularEfectivoNetoVenta descuenta la devuelta entregada en pagos mixtos y en efectivo', () => {
    // Caso 1: Venta en efectivo de RD$ 500 donde el cliente pagó con RD$ 1,000 (devuelta RD$ 500)
    expect(
      calcularEfectivoNetoVenta({
        estado: 'completada',
        metodo_pago: 'efectivo',
        monto_total: 500,
        monto_efectivo: 500,
        devuelta_entregada: 500,
      })
    ).toBe(500);

    // Caso 2: Venta con monto_efectivo guardado como billete entregado (RD$ 1,000) para total RD$ 500
    expect(
      calcularEfectivoNetoVenta({
        estado: 'completada',
        metodo_pago: 'efectivo',
        monto_total: 500,
        monto_efectivo: 1000,
        devuelta_entregada: 500,
      })
    ).toBe(500);

    // Caso 3: Pago múltiple (Total RD$ 350 -> Transferencia RD$ 200 + Billete Efectivo RD$ 200 -> Devuelta RD$ 50)
    // En la gaveta física entran RD$ 200 y salen RD$ 50 de cambio = +RD$ 150 netos en gaveta.
    expect(
      calcularEfectivoNetoVenta({
        estado: 'completada',
        metodo_pago: 'mixto',
        monto_total: 350,
        monto_efectivo: 200,
        monto_transferencia: 200,
        monto_tarjeta: 0,
        monto_credito: 0,
        devuelta_entregada: 50,
      })
    ).toBe(150);
  });

  it('cuadra exactamente el dinero esperado con el dinero físico en gaveta al cerrar turno', async () => {
    // 1. Simulamos un turno anterior ya cerrado hoy por la misma cajera (no debe sumarse al nuevo turno)
    const turnoAnterior = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1 - Leanny',
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      monto_apertura: 4000,
    });

    await procesarVenta({
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      caja_id: '1',
      subtotal: 600,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 600,
      costo_total: 400,
      metodo_pago: 'efectivo',
      monto_pagado: 600,
      monto_efectivo: 600,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    await cerrarTurnoCaja({
      cierre_id: turnoAnterior.id,
      caja_id: '1',
      caja_label: 'Caja #1 - Leanny',
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      monto_apertura: 4000,
      monto_esperado: 4600,
      monto_real: 4600,
      monto_diferencia: 0,
      total_ventas: 600,
      total_efectivo: 600,
      total_tarjeta: 0,
      total_transferencia: 0,
      total_otros: 0,
    });

    // Esperar 10ms para que el nuevo turno tenga timestamp posterior al cierre anterior
    await new Promise((r) => setTimeout(r, 15));

    // 2. Abrir nuevo turno actual con Fondo Inicial = RD$ 4,000.00
    const turnoActual = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1 - Leanny',
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      monto_apertura: 4000,
      forzarNueva: true,
    });

    // 3. Venta #1 (Efectivo): Total RD$ 500, cliente entrega RD$ 1,000, devuelta RD$ 500 -> +RD$ 500 en gaveta
    await procesarVenta({
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      caja_id: '1',
      subtotal: 500,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 500,
      costo_total: 350,
      metodo_pago: 'efectivo',
      monto_pagado: 1000,
      monto_efectivo: 500,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 500,
      items: [],
    });

    // 4. Venta #2 (Pago Múltiple con devuelta): Total RD$ 350, Transferencia RD$ 200 + Billete RD$ 200 -> Devuelta RD$ 50
    // Aunque monto_efectivo venga como 200, en gaveta física solo quedan RD$ 150 netos
    await procesarVenta({
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      caja_id: '1',
      subtotal: 350,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 350,
      costo_total: 250,
      metodo_pago: 'mixto',
      monto_pagado: 400,
      monto_efectivo: 200,
      monto_tarjeta: 0,
      monto_transferencia: 200,
      monto_credito: 0,
      devuelta_entregada: 50,
      items: [],
    });

    // 5. Venta #3 (Tarjeta): Total RD$ 400 -> +RD$ 0 en gaveta
    await procesarVenta({
      cajero_id: 'usr-leanny',
      cajero_nombre: 'Leanny',
      caja_id: '1',
      subtotal: 400,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 400,
      costo_total: 280,
      metodo_pago: 'tarjeta',
      monto_pagado: 400,
      monto_efectivo: 0,
      monto_tarjeta: 400,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    // 6. Venta de OTRA cajera (Keila) en caja_id = '1' -> NO debe sumarse al cierre de Leanny
    await procesarVenta({
      cajero_id: 'usr-keila',
      cajero_nombre: 'Keila',
      caja_id: '1',
      subtotal: 900,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 900,
      costo_total: 600,
      metodo_pago: 'efectivo',
      monto_pagado: 900,
      monto_efectivo: 900,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    // 7. Gasto de caja en efectivo de RD$ 120 (ej. Compra de botellón de agua) -> -RD$ 120 en gaveta
    await crearGasto({
      categoria_id: 'cat-008',
      descripcion: 'Botellón de agua para caja',
      monto: 120,
      metodo_pago: 'efectivo',
      responsable_nombre: 'Leanny',
      caja_id: '1',
      cierre_id: turnoActual.id,
      estado: 'aprobado',
    });
    addCashExpense({
      id: `exp-${Date.now()}`,
      code: 'GCJ-001',
      category: 'Otros Gastos Operativos',
      description: 'Botellón de agua para caja',
      amount: 120,
      date: new Date().toISOString().slice(0, 10),
      time: '12:00 PM',
      user: 'Leanny',
      cashier: 'Caja #1 - Leanny',
      cajaId: '1',
      cierreId: turnoActual.id,
      created_at: new Date().toISOString(),
    });

    // 8. Devolución en efectivo de RD$ 80 -> -RD$ 80 en gaveta
    localStorage.setItem(
      'mercato_devoluciones_local',
      JSON.stringify([
        {
          id: 'dev-1',
          caja_id: '1',
          estado: 'aprobada',
          metodo_reembolso: 'efectivo',
          monto_total: 80,
          creado_en: new Date().toISOString(),
        },
      ])
    );

    // 9. Calcular resumen de cierre de caja para Leanny
    const resumen = await calcularResumenCajaAbierta('1', 'usr-leanny', 'Leanny', turnoActual.id);

    // Verificaciones exactas del cuadre:
    // Fondo inicial: 4,000.00
    // Ventas totales del turno de Leanny: 500 + 350 + 400 = 1,250.00 (excluye los 600 del turno cerrado y los 900 de Keila)
    // Efectivo neto ingresado por ventas: 500 + 150 = 650.00 (excluye los RD$ 50 de devuelta del pago mixto)
    // Gastos en efectivo: 120.00 (sin duplicar entre gastos_local, movimientos_caja y pos_expenses)
    // Devoluciones en efectivo: 80.00
    // Efectivo físico esperado en gaveta = 4,000 + 650 - 120 - 80 = RD$ 4,450.00
    expect(resumen.monto_apertura).toBe(4000);
    expect(resumen.total_ventas).toBe(1250);
    expect(resumen.total_efectivo).toBe(650);
    expect(resumen.total_transferencia).toBe(200);
    expect(resumen.total_tarjeta).toBe(400);
    expect(resumen.total_retiros).toBe(120);
    expect(resumen.total_devoluciones).toBe(80);
    expect(resumen.monto_esperado).toBe(4450);
  });

  it('NUNCA combina ventas ni gastos de otras cajas ni sobreescribe el cajero cuando una administradora consulta Caja #1 - CHEILA', async () => {
    // 1. Cheila abre Caja #1 con RD$ 4,000
    const turnoCheila = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1 - CHEILA',
      cajero_id: 'usr-cheila',
      cajero_nombre: 'CHEILA',
      monto_apertura: 4000,
    });

    // 2. Rosario (administradora) abre Caja #4 con RD$ 2,000
    await iniciarCaja({
      caja_id: '4',
      caja_label: 'Caja #4 - Rosario',
      cajero_id: 'usr-rosario',
      cajero_nombre: 'Rosario',
      monto_apertura: 2000,
    });

    // 3. Keila abre Caja #2 con RD$ 3,000
    await iniciarCaja({
      caja_id: '2',
      caja_label: 'Caja #2 - Keila',
      cajero_id: 'usr-keila',
      cajero_nombre: 'Keila',
      monto_apertura: 3000,
    });

    // Ventas de Cheila en Caja #1: RD$ 3,200 efectivo + RD$ 800 tarjeta = RD$ 4,000 total
    await procesarVenta({
      cajero_id: 'usr-cheila',
      cajero_nombre: 'CHEILA',
      caja_id: '1',
      subtotal: 4000,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 4000,
      costo_total: 2500,
      metodo_pago: 'mixto',
      monto_pagado: 4000,
      monto_efectivo: 3200,
      monto_tarjeta: 800,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    // Ventas masivas de Rosario en Caja #4 (RD$ 150,000) -> NO deben sumarse a Caja #1
    await procesarVenta({
      cajero_id: 'usr-rosario',
      cajero_nombre: 'Rosario',
      caja_id: '4',
      subtotal: 150000,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 150000,
      costo_total: 100000,
      metodo_pago: 'efectivo',
      monto_pagado: 150000,
      monto_efectivo: 150000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    // Ventas de Keila en Caja #2 (RD$ 45,000) -> NO deben sumarse a Caja #1
    await procesarVenta({
      cajero_id: 'usr-keila',
      cajero_nombre: 'Keila',
      caja_id: '2',
      subtotal: 45000,
      monto_impuesto: 0,
      monto_descuento: 0,
      monto_total: 45000,
      costo_total: 30000,
      metodo_pago: 'efectivo',
      monto_pagado: 45000,
      monto_efectivo: 45000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      devuelta_entregada: 0,
      items: [],
    });

    // Gasto administrativo general sin caja_id (RD$ 1,000) -> NO debe descontarse de Caja #1
    await crearGasto({
      categoria_id: 'cat-008',
      descripcion: 'Pago mantenimiento planta eléctrica',
      monto: 1000,
      metodo_pago: 'efectivo',
      responsable_nombre: 'Rosario',
      estado: 'aprobado',
    });

    // Cuando Rosario (admin) abre el modal de cierre para Caja #1 (incluso si se pasan credenciales de Rosario por defecto):
    const resumenCheila = await calcularResumenCajaAbierta('1', 'usr-rosario', 'Rosario', turnoCheila.id);

    expect(resumenCheila.caja_id).toBe('1');
    expect(resumenCheila.cajero_nombre).toBe('CHEILA');
    expect(resumenCheila.monto_apertura).toBe(4000);
    expect(resumenCheila.total_ventas).toBe(4000);
    expect(resumenCheila.total_efectivo).toBe(3200);
    expect(resumenCheila.total_tarjeta).toBe(800);
    expect(resumenCheila.total_retiros).toBe(0);
    expect(resumenCheila.monto_esperado).toBe(7200);
  });
});
