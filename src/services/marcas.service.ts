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

function getStoredMarcas(): Marca[] {
  try {
    const raw = localStorage.getItem(MARCAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
      if (!error && data) {
        saveStoredMarcas(data as Marca[]);
        return data as Marca[];
      }
      if (error) {
        console.warn('Aviso: no se pudo consultar tabla marcas en Supabase:', error.message);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      console.warn('Fallo al obtener marcas de Supabase, usando respaldo local:', err);
    }
  }

  // Fallback local solo si Supabase no está configurado o falla la red
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

    if (error) {
      if (error.code === '42501') {
        throw new Error(
          'Permisos RLS requeridos: ejecuta supabase/migrations/016_politicas_categorias_proveedores.sql en el SQL Editor de Supabase.'
        );
      }
      if (error.code === '23505') {
        throw new Error('Ya existe una marca registrada con ese nombre o código.');
      }
      throw new Error(`Error en Supabase al crear marca: ${error.message}`);
    }

    if (data) {
      const current = getStoredMarcas();
      saveStoredMarcas([data as Marca, ...current.filter((m) => m.id !== data.id)]);
      return data as Marca;
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

    if (error) {
      if (error.code === '42501') {
        throw new Error(
          'Permisos RLS requeridos: ejecuta supabase/migrations/016_politicas_categorias_proveedores.sql en el SQL Editor de Supabase.'
        );
      }
      throw new Error(`Error en Supabase al actualizar marca: ${error.message}`);
    }

    if (data) {
      const current = getStoredMarcas();
      saveStoredMarcas(current.map((m) => (m.id === id ? (data as Marca) : m)));
      return data as Marca;
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
    const { error } = await sb.from('marcas').update({ activo: false }).eq('id', id);
    if (error) {
      if (error.code === '42501') {
        throw new Error(
          'Permisos RLS requeridos: ejecuta supabase/migrations/016_politicas_categorias_proveedores.sql en el SQL Editor de Supabase.'
        );
      }
      throw new Error(`Error al eliminar marca en Supabase: ${error.message}`);
    }
  }

  const list = getStoredMarcas();
  saveStoredMarcas(list.filter((m) => m.id !== id));
}
