import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  iniciarCaja,
  cerrarTurnoCaja,
  obtenerCajaAbierta,
  obtenerSesionAbiertaDeUsuario,
  calcularResumenCajaAbierta,
} from '@/services/cierresCaja.service';
import type { CierreCaja } from '@/types/database';
import { getCashClosures, saveCashClosure } from '@/lib/cashClosureStore';
import {
  registrarMovimientoCaja,
  obtenerMovimientosCaja,
  getLocalMovimientosCaja,
} from '@/services/movimientosCaja.service';
import { saveLocalVentas, getLocalVentas } from '@/services/ventas.service';

function helperAddLocalVenta(v: any) {
  const current = getLocalVentas();
  saveLocalVentas([v, ...current.filter((x) => x.id !== v.id)]);
}

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = new LocalStorageMock();
}

describe('Auditoría Técnica y Pruebas de Sesiones de Caja (10 Escenarios Obligatorios)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ESCENARIO 1: Una cajera abre su caja y registra varias ventas
  it('Escenario 1: Cajera abre caja y registra ventas en efectivo y tarjeta; efectivo esperado excluye tarjeta', async () => {
    const apertura = await iniciarCaja({
      caja_id: '5',
      caja_label: 'Caja Valentina',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      cajero_username: 'valentina@mercato.com',
      monto_apertura: 2000,
    });

    expect(apertura).toBeDefined();
    expect(apertura.estado).toBe('abierta');
    expect(Number(apertura.monto_apertura)).toBe(2000);

    // Registrar ventas: RD$ 10,000 en efectivo y RD$ 7,000 en tarjeta
    const venta1: any = {
      id: 'vta-001',
      numero_factura: 'FAC-001',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 6000,
      monto_efectivo: 6000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    };
    const venta2: any = {
      id: 'vta-002',
      numero_factura: 'FAC-002',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 4000,
      monto_efectivo: 4000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    };
    const ventaTarjeta: any = {
      id: 'vta-003',
      numero_factura: 'FAC-003',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 7000,
      monto_efectivo: 0,
      monto_tarjeta: 7000,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'tarjeta',
      creado_en: new Date().toISOString(),
    };

    helperAddLocalVenta(venta1);
    helperAddLocalVenta(venta2);
    helperAddLocalVenta(ventaTarjeta);

    const resumen = await calcularResumenCajaAbierta('5', 'usr-val-001');

    // Regla de Negocio: Monto esperado = Apertura (2000) + Efectivo (10000) = 12000
    // Tarjeta (7000) NO debe sumarse al efectivo esperado
    expect(resumen.monto_apertura).toBe(2000);
    expect(resumen.total_efectivo).toBe(10000);
    expect(resumen.total_tarjeta).toBe(7000);
    expect(resumen.total_ventas).toBe(17000);
    expect(resumen.monto_esperado).toBe(12000);
  }, 25000);

  // ESCENARIO 2: Cierra sesión y vuelve a ingresar
  it('Escenario 2: Cajera cierra sesión y reingresa; recupera su sesión activa original sin resetear fondo a 0', async () => {
    // Sesión inicial
    const sesionOriginal = await iniciarCaja({
      caja_id: '5',
      caja_label: 'Caja Valentina',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 3500,
    });

    expect(sesionOriginal.id).toBeDefined();

    // Simular que el usuario cierra sesión y reingresa
    // 1. Verificar si tiene sesión activa
    const sesionRecuperada = await obtenerSesionAbiertaDeUsuario('usr-val-001', 'Valentina');
    expect(sesionRecuperada).not.toBeNull();
    expect(sesionRecuperada?.id).toBe(sesionOriginal.id);
    expect(Number(sesionRecuperada?.monto_apertura)).toBe(3500);

    // 2. Si el sistema intenta llamar a iniciarCaja de nuevo, debe retornar la sesión existente
    const intentoReapertura = await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 0, // intento erróneo de abrir con 0
    });

    expect(intentoReapertura.id).toBe(sesionOriginal.id);
    expect(Number(intentoReapertura.monto_apertura)).toBe(3500); // conserva el fondo original
  }, 25000);

  // ESCENARIO 3: Recarga la página mientras tiene una caja activa
  it('Escenario 3: Recarga de página; obtenerCajaAbierta localiza la sesión activa por usuario y registradora', async () => {
    await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 1500,
    });

    // Simular recarga: llamar a obtenerCajaAbierta con los datos del usuario autenticado
    const cajaActiva = await obtenerCajaAbierta('5', 'usr-val-001', 'Valentina');
    expect(cajaActiva).not.toBeNull();
    expect(cajaActiva?.caja_id).toBe('5');
    expect(cajaActiva?.cajero_id).toBe('usr-val-001');
    expect(cajaActiva?.estado).toBe('abierta');
  }, 25000);

  // ESCENARIO 4: Pierde temporalmente la conexión a Internet
  it('Escenario 4: Conexión intermitente; el estado local mantiene la sesión activa disponible sin forzar cierre', async () => {
    await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 2500,
    });

    // En fallo de red (simulado en entorno local/offline), getCashClosures y obtenerCajaAbierta siguen disponibles
    const abiertas = getCashClosures().filter((c) => c.status === 'abierta');
    expect(abiertas.length).toBe(1);
    expect(abiertas[0].userId).toBe('usr-val-001');
    expect(abiertas[0].userName).toBe('Valentina');
    expect(Number(abiertas[0].baseCash)).toBe(2500);
  }, 25000);

  // ESCENARIO 5: Otro empleado intenta ingresar a una registradora ocupada
  it('Escenario 5: Otro empleado intenta ingresar a una registradora ocupada; es bloqueado con error', async () => {
    // Valentina tiene abierta la Caja 5
    await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 2000,
    });

    // Keyla intenta abrir la misma Caja 5
    await expect(
      iniciarCaja({
        caja_id: '5',
        cajero_id: 'usr-key-002',
        cajero_nombre: 'Keyla',
        monto_apertura: 1000,
      })
    ).rejects.toThrow(/ya se encuentra en uso/i);
  }, 25000);

  // ESCENARIO 6: Se realiza un retiro de efectivo
  it('Escenario 6: Retiro de efectivo atribuido con cajero y hora; se descuenta exactamente del efectivo esperado', async () => {
    const sesion = await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 5000,
    });

    // Venta en efectivo de 10,000
    helperAddLocalVenta({
      id: 'vta-004',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 10000,
      monto_efectivo: 10000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    });

    // Retiro legítimo de efectivo de RD$ 500 efectuado por Valentina
    const retiro = await registrarMovimientoCaja({
      caja_id: '5',
      cierre_id: sesion.id,
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      tipo: 'retiro',
      monto: 500,
      concepto: 'Retiro autorizado para cambio de caja chica',
    });

    expect(retiro.monto).toBe(500);
    expect(retiro.cajero_nombre).toBe('Valentina');
    expect(retiro.cierre_id).toBe(sesion.id);

    // Calcular resumen
    const resumen = await calcularResumenCajaAbierta('5', 'usr-val-001');

    // Regla: 5000 (apertura) + 10000 (ventas efectivo) - 500 (retiro) = 14500
    expect(resumen.total_retiros).toBe(500);
    expect(resumen.monto_esperado).toBe(14500);
  }, 25000);

  // ESCENARIO 7: Se intenta cerrar dos veces la misma sesión
  it('Escenario 7: Intento de doble cierre de sesión; el segundo cierre es rechazado y no altera saldos', async () => {
    const sesion = await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 2000,
    });

    // Primer cierre exitoso
    const primerCierre = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '5',
      cajero_id: 'usr-val-001',
      monto_apertura: 2000,
      monto_esperado: 2000,
      monto_real: 2000,
      monto_diferencia: 0,
    });

    expect(primerCierre.estado).toBe('cerrada');

    // Segundo cierre sobre la misma sesión
    await expect(
      cerrarTurnoCaja({
        cierre_id: sesion.id,
        caja_id: '5',
        cajero_id: 'usr-val-001',
        monto_apertura: 2000,
        monto_esperado: 2000,
        monto_real: 2000,
        monto_diferencia: 0,
      })
    ).rejects.toThrow(/ya (fue|ha sido) cerrad[ao]/i);
  }, 20000);

  // ESCENARIO 8: Dos cajeros trabajan simultáneamente en registradoras diferentes
  it('Escenario 8: Dos cajeros trabajan en registradoras diferentes de forma simultánea sin mezclar ventas ni cierres', async () => {
    // Cajera 1: Valentina en Caja 5
    const sesionVal = await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 2000,
    });

    // Cajera 2: Keyla en Caja 2
    const sesionKey = await iniciarCaja({
      caja_id: '2',
      cajero_id: 'usr-key-002',
      cajero_nombre: 'Keyla',
      monto_apertura: 1500,
    });

    expect(sesionVal.id).not.toBe(sesionKey.id);

    // Ventas de Valentina en Caja 5
    helperAddLocalVenta({
      id: 'vta-val-1',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 8000,
      monto_efectivo: 8000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    });

    // Ventas de Keyla en Caja 2
    helperAddLocalVenta({
      id: 'vta-key-1',
      caja_id: '2',
      usuario_id: 'usr-key-002',
      monto_total: 5000,
      monto_efectivo: 5000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    });

    // Retiro de Valentina en Caja 5
    await registrarMovimientoCaja({
      caja_id: '5',
      cierre_id: sesionVal.id,
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      tipo: 'retiro',
      monto: 300,
      concepto: 'Retiro caja 5',
    });

    // Retiro de Keyla en Caja 2
    await registrarMovimientoCaja({
      caja_id: '2',
      cierre_id: sesionKey.id,
      cajero_id: 'usr-key-002',
      cajero_nombre: 'Keyla',
      tipo: 'retiro',
      monto: 100,
      concepto: 'Retiro caja 2',
    });

    // Resumen de Valentina (Caja 5): 2000 + 8000 - 300 = 9700
    const resumenVal = await calcularResumenCajaAbierta('5', 'usr-val-001');
    expect(resumenVal.monto_apertura).toBe(2000);
    expect(resumenVal.total_efectivo).toBe(8000);
    expect(resumenVal.total_retiros).toBe(300);
    expect(resumenVal.monto_esperado).toBe(9700);

    // Resumen de Keyla (Caja 2): 1500 + 5000 - 100 = 6400
    const resumenKey = await calcularResumenCajaAbierta('2', 'usr-key-002');
    expect(resumenKey.monto_apertura).toBe(1500);
    expect(resumenKey.total_efectivo).toBe(5000);
    expect(resumenKey.total_retiros).toBe(100);
    expect(resumenKey.monto_esperado).toBe(6400);
  }, 20000);

  // ESCENARIO 9: Se intenta recuperar una sesión después de reiniciar el navegador
  it('Escenario 9: Recuperación de sesión tras reinicio de navegador (persistencia de identidad)', async () => {
    // Abrir sesión
    const original = await iniciarCaja({
      caja_id: '5',
      caja_label: 'Caja Valentina',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      cajero_username: 'valentina@mercato.com',
      monto_apertura: 3000,
      notes: 'Turno de la tarde',
    });

    // Simular que el usuario cerró el navegador y vuelve a abrirlo:
    // El frontend lee de localStorage o Supabase a través de obtenerCajaAbierta
    const recuperada = await obtenerCajaAbierta('5', 'usr-val-001', 'Valentina');
    expect(recuperada).not.toBeNull();
    expect(recuperada?.id).toBe(original.id);
    expect(recuperada?.caja_id).toBe('5');
    expect(recuperada?.cajero_id).toBe('usr-val-001');
    expect(Number(recuperada?.monto_apertura)).toBe(3000);
  }, 25000);

  // ESCENARIO 10: Se verifica que las ventas y movimientos sigan asociados a la sesión correcta
  // (Gastos operativos generales sin caja_id o de otra caja NO se restan de esta caja)
  it('Escenario 10: Gastos operativos generales sin caja_id o de otra caja NO se descuentan del efectivo esperado de la cajera', async () => {
    const sesion = await iniciarCaja({
      caja_id: '5',
      cajero_id: 'usr-val-001',
      cajero_nombre: 'Valentina',
      monto_apertura: 2000,
    });

    // Ventas de Valentina por RD$ 17,000 en efectivo
    helperAddLocalVenta({
      id: 'vta-val-real',
      caja_id: '5',
      usuario_id: 'usr-val-001',
      monto_total: 17000,
      monto_efectivo: 17000,
      monto_tarjeta: 0,
      monto_transferencia: 0,
      monto_credito: 0,
      metodo_pago: 'efectivo',
      creado_en: new Date().toISOString(),
    });

    // Simular el caso del incidente: un gasto de RD$ 500 de gasolina registrado en el módulo de Gastos
    // SIN caja_id (gasto operativo de administración)
    const gastosGenerales = [
      {
        id: 'gas-139',
        descripcion: 'GAS-139 gazolina motor grande',
        monto: 500,
        amount: 500,
        paymentMethod: 'efectivo',
        status: 'approved',
        // NOTA: NO tiene caja_id
      },
      {
        id: 'gas-140',
        descripcion: 'Gasto de Caja 2',
        monto: 250,
        amount: 250,
        caja_id: '2', // Pertenece a Caja 2, NO a Caja 5
        paymentMethod: 'efectivo',
        status: 'approved',
      },
    ];
    localStorage.setItem('mercato_gastos_local', JSON.stringify(gastosGenerales));

    // Resumen de Valentina en Caja 5
    const resumen = await calcularResumenCajaAbierta('5', 'usr-val-001');

    // El gasto de RD$ 500 general y el de Caja 2 NO deben descontarse de Caja 5
    expect(resumen.total_retiros).toBe(0);
    // Efectivo esperado debe ser EXACTAMENTE: 2000 (apertura) + 17000 (ventas efectivo) = 19000
    expect(resumen.monto_esperado).toBe(19000);
  }, 25000);
});
