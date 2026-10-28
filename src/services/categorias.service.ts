import { tryGetSupabase } from './clienteSupabase';

export type Categoria = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en?: string;
};

const CATEGORIAS_STORAGE_KEY = 'mercato_product_categorias';

function getStoredCategorias(): Categoria[] {
  try {
    const raw = localStorage.getItem(CATEGORIAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCategorias(list: Categoria[]): void {
  try {
    localStorage.setItem(CATEGORIAS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error al guardar categorias en localStorage:', err);
  }
}

export type NuevaCategoriaInput = {
  nombre: string;
  descripcion?: string | null;
  codigo?: string;
};

export async function obtenerCategorias(params?: {
  busqueda?: string;
  signal?: AbortSignal;
}): Promise<Categoria[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      let query = sb
        .from('categorias')
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
        saveStoredCategorias(data as Categoria[]);
        return data as Categoria[];
      }
      if (error) {
        console.warn('Aviso: no se pudo consultar tabla categorias en Supabase:', error.message);
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      console.warn('Fallo al obtener categorias de Supabase, usando respaldo local:', err);
    }
  }

  // Fallback local solo si Supabase no está configurado o falla la red
  let list = getStoredCategorias().filter((c) => c.activo !== false);
  if (params?.busqueda?.trim()) {
    const q = params.busqueda.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        (c.descripcion && c.descripcion.toLowerCase().includes(q))
    );
  }
  return list;
}

export async function crearCategoria(datos: NuevaCategoriaInput): Promise<Categoria> {
  const nombreClean = datos.nombre.trim();
  if (!nombreClean) throw new Error('El nombre de la categoría es obligatorio');

  const codigo = datos.codigo?.trim() || `CAT-${Date.now().toString(36).toUpperCase()}`;
  const descripcion = datos.descripcion?.trim() || null;

  const sb = tryGetSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('categorias')
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
        throw new Error('Ya existe una categoría registrada con ese nombre o código.');
      }
      throw new Error(`Error en Supabase al crear categoría: ${error.message}`);
    }

    if (data) {
      const current = getStoredCategorias();
      saveStoredCategorias([data as Categoria, ...current.filter((c) => c.id !== data.id)]);
      return data as Categoria;
    }
  }

  const nuevaCat: Categoria = {
    id: `cat-${Date.now()}`,
    codigo,
    nombre: nombreClean,
    descripcion,
    activo: true,
    creado_en: new Date().toISOString(),
  };

  const list = getStoredCategorias();
  saveStoredCategorias([nuevaCat, ...list]);
  return nuevaCat;
}

export async function actualizarCategoria(
  id: string,
  datos: Partial<NuevaCategoriaInput> & { activo?: boolean }
): Promise<Categoria> {
  const sb = tryGetSupabase();
  if (sb) {
    const patch: Record<string, unknown> = {};
    if (datos.nombre !== undefined) patch.nombre = datos.nombre.trim();
    if (datos.descripcion !== undefined) patch.descripcion = datos.descripcion?.trim() || null;
    if (datos.codigo !== undefined) patch.codigo = datos.codigo.trim();
    if (datos.activo !== undefined) patch.activo = datos.activo;

    const { data, error } = await sb
      .from('categorias')
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
      throw new Error(`Error en Supabase al actualizar categoría: ${error.message}`);
    }

    if (data) {
      const current = getStoredCategorias();
      saveStoredCategorias(current.map((c) => (c.id === id ? (data as Categoria) : c)));
      return data as Categoria;
    }
  }

  const list = getStoredCategorias();
  const index = list.findIndex((c) => c.id === id);
  if (index === -1) throw new Error('Categoría no encontrada');

  const updated: Categoria = {
    ...list[index],
    ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
    ...(datos.descripcion !== undefined ? { descripcion: datos.descripcion?.trim() || null } : {}),
    ...(datos.codigo !== undefined ? { codigo: datos.codigo.trim() } : {}),
    ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
  };

  list[index] = updated;
  saveStoredCategorias(list);
  return updated;
}

export async function eliminarCategoria(id: string): Promise<void> {
  const sb = tryGetSupabase();
  if (sb) {
    const { error } = await sb.from('categorias').update({ activo: false }).eq('id', id);
    if (error) {
      if (error.code === '42501') {
        throw new Error(
          'Permisos RLS requeridos: ejecuta supabase/migrations/016_politicas_categorias_proveedores.sql en el SQL Editor de Supabase.'
        );
      }
      throw new Error(`Error al eliminar categoría en Supabase: ${error.message}`);
    }
  }

  const list = getStoredCategorias();
  saveStoredCategorias(list.filter((c) => c.id !== id));
}
