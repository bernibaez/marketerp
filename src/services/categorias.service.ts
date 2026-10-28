import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';

export type Categoria = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en?: string;
};

const CATEGORIAS_STORAGE_KEY = 'mercato_product_categorias';

const CATEGORIAS_POR_DEFECTO: Categoria[] = [
  { id: 'cat-01', codigo: 'CAT-001', nombre: 'Abarrotes y Granos', descripcion: 'Arroz, frijoles, aceites, pastas y enlatados', activo: true },
  { id: 'cat-02', codigo: 'CAT-002', nombre: 'Lácteos y Huevos', descripcion: 'Leche, quesos, yogures, mantequillas y huevos', activo: true },
  { id: 'cat-03', codigo: 'CAT-003', nombre: 'Carnes y Embutidos', descripcion: 'Pollo, res, cerdo, chuletas y salchichas', activo: true },
  { id: 'cat-04', codigo: 'CAT-004', nombre: 'Bebidas y Refrescos', descripcion: 'Agua, jugos, sodas, maltas y energizantes', activo: true },
  { id: 'cat-05', codigo: 'CAT-005', nombre: 'Limpieza y Hogar', descripcion: 'Detergentes, desinfectantes, esponjas y papel toalla', activo: true },
  { id: 'cat-06', codigo: 'CAT-006', nombre: 'Panadería y Repostería', descripcion: 'Pan de molde, galletas, pan sobao y pastelillos', activo: true },
  { id: 'cat-07', codigo: 'CAT-007', nombre: 'Frutas y Vegetales', descripcion: 'Plátanos, aguacates, tomates, cebollas y frutas frescas', activo: true },
  { id: 'cat-08', codigo: 'CAT-008', nombre: 'Snacks y Golosinas', descripcion: 'Platanitos, papas fritas, chocolates y caramelos', activo: true },
  { id: 'cat-09', codigo: 'CAT-009', nombre: 'Cuidado Personal', descripcion: 'Jabones, pastas dentales, champú y desodorantes', activo: true },
];

function getStoredCategorias(): Categoria[] {
  try {
    const raw = localStorage.getItem(CATEGORIAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIAS_STORAGE_KEY, JSON.stringify(CATEGORIAS_POR_DEFECTO));
      return CATEGORIAS_POR_DEFECTO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : CATEGORIAS_POR_DEFECTO;
  } catch {
    return CATEGORIAS_POR_DEFECTO;
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
      if (!error && data && data.length > 0) {
        return data as Categoria[];
      }
      if (error) {
        console.warn('Aviso: no se pudo consultar tabla categorias en Supabase, usando almacenamiento local:', error.message);
      }
    } catch (err) {
      console.warn('Fallo al obtener categorias de Supabase, usando respaldo local:', err);
    }
  }

  // Fallback local
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
    try {
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

      if (!error && data) {
        // Sincronizar también con local storage
        const current = getStoredCategorias();
        saveStoredCategorias([data as Categoria, ...current.filter((c) => c.id !== data.id)]);
        return data as Categoria;
      }
      if (error) {
        console.warn('Error al insertar categoría en Supabase, guardando localmente:', error.message);
      }
    } catch (err) {
      console.warn('Fallo Supabase al crear categoría, guardando localmente:', err);
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
    try {
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

      if (!error && data) {
        const current = getStoredCategorias();
        saveStoredCategorias(current.map((c) => (c.id === id ? (data as Categoria) : c)));
        return data as Categoria;
      }
    } catch (err) {
      console.warn('Fallo Supabase al actualizar categoría, actualizando localmente:', err);
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
    try {
      await sb.from('categorias').update({ activo: false }).eq('id', id);
    } catch (err) {
      console.warn('Fallo Supabase al eliminar categoría:', err);
    }
  }

  const list = getStoredCategorias();
  saveStoredCategorias(list.filter((c) => c.id !== id));
}
