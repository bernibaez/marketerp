import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { obtenerMetricasDashboard } from '@/services/dashboard.service';
import { cambiarPasswordUsuario, crearUsuario } from '@/services/usuarios.service';
import { authenticate } from '@/lib/auth';

vi.mock('@/services/clienteSupabase', () => ({
  tryGetSupabase: () => null,
  isSupabaseConfigured: () => false,
  getSupabase: () => null,
}));

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Requerimientos: Cambio de Contraseña y Reset Diario del Dashboard a 0', () => {
  beforeEach(() => {
    const mockStorage = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Si el día terminó y al día siguiente no se ha vendido nada, el dashboard de hoy debe estar estrictamente en 0', async () => {
    const now = new Date();
    // Ventas ocurridas ayer (mañana, tarde y noche)
    const yesterdayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 10, 0, 0);
    const yesterdayEvening = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 30, 0);

    const ventasAyer = [
      {
        id: 'v-ayer-1',
        numero_factura: 'FAC-AYER-001',
        monto_total: 45000,
        costo_total: 30000,
        creado_en: yesterdayMorning.toISOString(),
        estado: 'completada',
      },
      {
        id: 'v-ayer-2',
        numero_factura: 'FAC-AYER-002',
        monto_total: 32000,
        costo_total: 20000,
        creado_en: yesterdayEvening.toISOString(),
        estado: 'completada',
      },
    ];

    // Se guardan las ventas en la base local (fueron las ventas de ayer)
    localStorage.setItem('mercato_ventas_local', JSON.stringify(ventasAyer));

    // Consultamos las métricas de 'hoy' (donde aún no se ha vendido nada hoy)
    const metricas = await obtenerMetricasDashboard('hoy');

    // Debe estar estrictamente en 0, no con los montos de ayer (77,000)
    expect(metricas.ventas_total).toBe(0);
    expect(metricas.ventas_count).toBe(0);
    expect(metricas.ticket_promedio).toBe(0);
    expect(metricas.costo_total).toBe(0);
    expect(metricas.ganancia_bruta).toBe(0);
  });

  it('2. Cuando se registra una venta hoy, el dashboard suma solo la venta de hoy ignorando la de ayer', async () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0);

    const ventas = [
      {
        id: 'v-yesterday',
        numero_factura: 'FAC-YEST',
        monto_total: 50000,
        costo_total: 35000,
        creado_en: yesterday.toISOString(),
        estado: 'completada',
      },
      {
        id: 'v-today',
        numero_factura: 'FAC-TODAY',
        monto_total: 3500,
        costo_total: 2000,
        creado_en: today.toISOString(),
        estado: 'completada',
      },
    ];

    localStorage.setItem('mercato_ventas_local', JSON.stringify(ventas));

    const metricas = await obtenerMetricasDashboard('hoy');

    expect(metricas.ventas_total).toBe(3500);
    expect(metricas.ventas_count).toBe(1);
    expect(metricas.costo_total).toBe(2000);
    expect(metricas.ganancia_bruta).toBe(1500);
  });

  it('3. Permite cambiar la contraseña de un usuario existente y autenticarse con la nueva contraseña', async () => {
    // Usuario 'maria' (id '2') tiene contraseña inicial 'maria123'
    const loginOriginal = authenticate('maria', 'maria123');
    expect(loginOriginal.ok).toBe(true);

    // Cambiar la contraseña a 'nuevaClave2026'
    await cambiarPasswordUsuario('2', 'nuevaClave2026', 'maria@mercato.do');

    // La contraseña anterior ya no debe funcionar
    const loginViejo = authenticate('maria', 'maria123');
    expect(loginViejo.ok).toBe(false);

    // La nueva contraseña debe autenticar exitosamente
    const loginNuevo = authenticate('maria', 'nuevaClave2026');
    expect(loginNuevo.ok).toBe(true);
    if (loginNuevo.ok) {
      expect(loginNuevo.user.email).toBe('maria@mercato.do');
    }
  });

  it('4. Valida que la contraseña tenga al menos 6 caracteres al cambiarla', async () => {
    await expect(cambiarPasswordUsuario('2', '12345')).rejects.toThrow(
      'La nueva contraseña debe tener al menos 6 caracteres'
    );
  });

  it('5. Permite crear un nuevo usuario local y cambiar su contraseña posteriormente', async () => {
    const nuevoId = await crearUsuario({
      nombre_completo: 'Carlos Cajero Nuevo',
      correo: 'carlos.cajero@mercato.do',
      password: 'passwordInicial123',
      rol: 'cajero',
    });

    // Login inicial
    const login1 = authenticate('carlos.cajero@mercato.do', 'passwordInicial123');
    expect(login1.ok).toBe(true);

    // Cambio de contraseña
    await cambiarPasswordUsuario(nuevoId, 'claveModificada999', 'carlos.cajero@mercato.do');

    // Clave vieja falla
    expect(authenticate('carlos.cajero@mercato.do', 'passwordInicial123').ok).toBe(false);

    // Clave nueva funciona
    const login2 = authenticate('carlos.cajero@mercato.do', 'claveModificada999');
    expect(login2.ok).toBe(true);
  });
});
