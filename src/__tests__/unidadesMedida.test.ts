import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  obtenerUnidadesMedida,
  crearUnidadMedida,
  actualizarUnidadMedida,
  eliminarUnidadMedida,
} from '@/services/unidadesMedida.service';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
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

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as any).localStorage = new LocalStorageMock();
}

describe('Servicio de Unidades de Medida (unidadesMedida.service)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('debe devolver las unidades predeterminadas (semillas) si localStorage está vacío', async () => {
    const unidades = await obtenerUnidadesMedida();
    expect(unidades.length).toBeGreaterThanOrEqual(10);

    const nombres = unidades.map((u) => u.nombre.toLowerCase());
    expect(nombres).toContain('unidad');
    expect(nombres).toContain('cartón');
    expect(nombres).toContain('combo');
    expect(nombres).toContain('libra');
    expect(nombres).toContain('kilogramo');
    expect(nombres).toContain('fardo');
  });

  it('debe filtrar unidades por término de búsqueda', async () => {
    const resultados = await obtenerUnidadesMedida({ busqueda: 'cart' });
    expect(resultados.length).toBeGreaterThanOrEqual(1);
    expect(resultados.some((u) => u.nombre.toLowerCase().includes('cartón'))).toBe(true);
  });

  it('debe filtrar unidades por tipo (peso, empaque, etc.)', async () => {
    const empaques = await obtenerUnidadesMedida({ tipo: 'empaque' });
    expect(empaques.length).toBeGreaterThan(0);
    expect(empaques.every((u) => u.tipo === 'empaque')).toBe(true);

    const pesos = await obtenerUnidadesMedida({ tipo: 'peso' });
    expect(pesos.length).toBeGreaterThan(0);
    expect(pesos.every((u) => u.tipo === 'peso')).toBe(true);
    expect(pesos.some((u) => u.nombre.toLowerCase().includes('libra'))).toBe(true);
  });

  it('debe permitir crear una nueva unidad de medida personalizada', async () => {
    const nueva = await crearUnidadMedida({
      nombre: 'Bandeja Especial',
      codigo: 'BDJ-01',
      abreviatura: 'bdj',
      tipo: 'empaque',
      descripcion: 'Bandeja de 12 unidades',
    });

    expect(nueva.id).toBeDefined();
    expect(nueva.nombre).toBe('Bandeja Especial');
    expect(nueva.tipo).toBe('empaque');
    expect(nueva.abreviatura).toBe('bdj');

    const lista = await obtenerUnidadesMedida({ busqueda: 'Bandeja' });
    expect(lista.some((u) => u.id === nueva.id)).toBe(true);
  });

  it('debe rechazar crear una unidad con nombre duplicado', async () => {
    await expect(
      crearUnidadMedida({
        nombre: 'Cartón',
        tipo: 'empaque',
      })
    ).rejects.toThrow(/ya existe/i);
  });

  it('debe permitir actualizar una unidad existente', async () => {
    const lista = await obtenerUnidadesMedida();
    const carton = lista.find((u) => u.nombre.toLowerCase() === 'cartón');
    expect(carton).toBeDefined();

    const actualizada = await actualizarUnidadMedida(carton!.id, {
      descripcion: 'Cartón de 30 huevos premium',
      abreviatura: 'ctn-30',
    });

    expect(actualizada.descripcion).toBe('Cartón de 30 huevos premium');
    expect(actualizada.abreviatura).toBe('ctn-30');
    expect(actualizada.nombre).toBe(carton!.nombre);
  });

  it('debe permitir eliminar una unidad de medida', async () => {
    const creada = await crearUnidadMedida({
      nombre: 'Paca Temporal',
      tipo: 'empaque',
    });

    let lista = await obtenerUnidadesMedida({ busqueda: 'Paca Temporal' });
    expect(lista.length).toBe(1);

    await eliminarUnidadMedida(creada.id);

    lista = await obtenerUnidadesMedida({ busqueda: 'Paca Temporal' });
    expect(lista.length).toBe(0);
  });
});
