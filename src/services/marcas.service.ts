import { tryGetSupabase } from './clienteSupabase';

export type Marca = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en?: string;
};

const MARCAS_STORAGE_KEY = 'mercato_product_marcas';

const MARCAS_POR_DEFECTO: Marca[] = [
  { id: 'marca-01', codigo: 'MAR-001', nombre: 'Molinos Modernos', descripcion: 'Harinas, pastas y galletas', activo: true },
  { id: 'marca-02', codigo: 'MAR-002', nombre: 'Mazola', descripcion: 'Aceites vegetales y maíz', activo: true },
  { id: 'marca-03', codigo: 'MAR-003', nombre: 'Pollo Rey', descripcion: 'Aves y carnes frescas', activo: true },
  { id: 'marca-04', codigo: 'MAR-004', nombre: 'Carnation', descripcion: 'Leches evaporadas y condensadas', activo: true },
  { id: 'marca-05', codigo: 'MAR-005', nombre: 'Central Romana', descripcion: 'Azúcar refinada y crema', activo: true },
  { id: 'marca-06', codigo: 'MAR-006', nombre: 'Goya', descripcion: 'Granos, sazones y condimentos', activo: true },
  { id: 'marca-07', codigo: 'MAR-007', nombre: 'Rica', descripcion: 'Leches, jugos y quesos', activo: true },
  { id: 'marca-08', codigo: 'MAR-008', nombre: 'Crisol', descripcion: 'Aceites comestibles', activo: true },
  { id: 'marca-09', codigo: 'MAR-009', nombre: 'Induveca', descripcion: 'Embutidos y fiambres', activo: true },
  { id: 'marca-10', codigo: 'MAR-010', nombre: 'Colgate-Palmolive', descripcion: 'Higiene bucal y cuidado personal', activo: true },
  { id: 'marca-11', codigo: 'MAR-011', nombre: 'Nestlé', descripcion: 'Café, cereales y confitería', activo: true },
  { id: 'marca-12', codigo: 'MAR-012', nombre: 'Fabuloso', descripcion: 'Limpiadores multiusos y aromatizantes', activo: true },
];

function getStoredMarcas(): Marca[] {
  try {
    const raw = localStorage.getItem(MARCAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MARCAS_STORAGE_KEY, JSON.stringify(MARCAS_POR_DEFECTO));
      return MARCAS_POR_DEFECTO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : MARCAS_POR_DEFECTO;
  } catch {
    return MARCAS_POR_DEFECTO;
  }
}

function saveStoredMarcas(list: Marca[]): void {
  try {
    localStorage.setItem(MARCAS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error al guardar marcas en localStorage:', err);
  }
}

export type NuevaMarcaInput = {
  nombre: string;
  descripcion?: string | null;
  codigo?: string;
};

export async function obtenerMarcas(params?: {
  busqueda?: string;
  signal?: AbortSignal;
}): Promise<Marca[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      let query = sb
        .from('marcas')
        .select('id, codigo, nombre, descripcion, activo, creado_en')
        .eq('activo', true)
        .order('nombre');

      if (params?.busqueda?.trim()) {
        const q = params.busqueda.trim();
        query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%`);
      }
      if (params?.signal) query = query.abortSignal(params.signal);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as Marca[];
      }
      if (error) {
        console.warn('Aviso: no se pudo consultar tabla marcas en Supabase, usando almacenamiento local:', error.message);
      }
    } catch (err) {
      console.warn('Fallo al obtener marcas de Supabase, usando respaldo local:', err);
    }
  }

  // Fallback local
  let list = getStoredMarcas().filter((m) => m.activo !== false);
  if (params?.busqueda?.trim()) {
    const q = params.busqueda.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        m.codigo.toLowerCase().includes(q) ||
        (m.descripcion && m.descripcion.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function crearMarca(datos: NuevaMarcaInput): Promise<Marca> {
  const nombreClean = datos.nombre.trim();
  if (!nombreClean) throw new Error('El nombre de la marca es obligatorio');

  const codigo = datos.codigo?.trim() || `MAR-${Date.now().toString(36).toUpperCase()}`;
  const descripcion = datos.descripcion?.trim() || null;

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('marcas')
        .insert({
          codigo,
          nombre: nombreClean,
          descripcion,
          activo: true,
        })
        .select('id, codigo, nombre, descripcion, activo, creado_en')
        .single();

      if (!error && data) {
        const current = getStoredMarcas();
        saveStoredMarcas([data as Marca, ...current.filter((m) => m.id !== data.id)]);
        return data as Marca;
      }
      if (error) {
        console.warn('Error al insertar marca en Supabase, guardando localmente:', error.message);
      }
    } catch (err) {
      console.warn('Fallo Supabase al crear marca, guardando localmente:', err);
    }
  }

  const nuevaMarca: Marca = {
    id: `marca-${Date.now()}`,
    codigo,
    nombre: nombreClean,
    descripcion,
    activo: true,
    creado_en: new Date().toISOString(),
  };

  const list = getStoredMarcas();
  saveStoredMarcas([nuevaMarca, ...list]);
  return nuevaMarca;
}

export async function actualizarMarca(
  id: string,
  datos: Partial<NuevaMarcaInput> & { activo?: boolean }
): Promise<Marca> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      const patch: Record<string, unknown> = {};
      if (datos.nombre !== undefined) patch.nombre = datos.nombre.trim();
      if (datos.descripcion !== undefined) patch.descripcion = datos.descripcion?.trim() || null;
      if (datos.codigo !== undefined) patch.codigo = datos.codigo.trim();
      if (datos.activo !== undefined) patch.activo = datos.activo;

      const { data, error } = await sb
        .from('marcas')
        .update(patch)
        .eq('id', id)
        .select('id, codigo, nombre, descripcion, activo, creado_en')
        .single();

      if (!error && data) {
        const current = getStoredMarcas();
        saveStoredMarcas(current.map((m) => (m.id === id ? (data as Marca) : m)));
        return data as Marca;
      }
    } catch (err) {
      console.warn('Fallo Supabase al actualizar marca, actualizando localmente:', err);
    }
  }

  const list = getStoredMarcas();
  const index = list.findIndex((m) => m.id === id);
  if (index === -1) throw new Error('Marca no encontrada');

  const updated: Marca = {
    ...list[index],
    ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
    ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion?.trim() || null } : {}),
    ...(datos.codigo !== undefined ? { codigo: datos.codigo.trim() } : {}),
    ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
  };

  list[index] = updated;
  saveStoredMarcas(list);
  return updated;
}

export async function eliminarMarca(id: string): Promise<void> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('marcas').update({ activo: false }).eq('id', id);
    } catch (err) {
      console.warn('Fallo Supabase al eliminar marca:', err);
    }
  }

  const list = getStoredMarcas();
  saveStoredMarcas(list.filter((m) => m.id !== id));
}
