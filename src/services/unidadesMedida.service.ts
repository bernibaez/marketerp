import { tryGetSupabase } from './clienteSupabase';

export type TipoUnidadMedida = 'unidad' | 'peso' | 'volumen' | 'empaque';

export type UnidadMedida = {
  id: string;
  codigo: string;
  nombre: string;
  abreviatura: string | null;
  tipo: TipoUnidadMedida;
  descripcion: string | null;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
};

export type NuevaUnidadMedidaInput = {
  nombre: string;
  codigo?: string;
  abreviatura?: string | null;
  tipo?: TipoUnidadMedida;
  descripcion?: string | null;
};

const UNIDADES_STORAGE_KEY = 'mercato_unidades_medida_v1';

export const DEFAULT_UNIDADES: UnidadMedida[] = [
  { id: 'uni-und', codigo: 'UNI-UND', nombre: 'Unidad', abreviatura: 'ud', tipo: 'unidad', descripcion: 'Unidad individual', activo: true },
  { id: 'uni-ctn', codigo: 'UNI-CTN', nombre: 'Cartón', abreviatura: 'ctn', tipo: 'empaque', descripcion: 'Cartón de empaque (ej. huevos, latas)', activo: true },
  { id: 'uni-med-ctn', codigo: 'UNI-MED-CTN', nombre: 'Medio cartón', abreviatura: '1/2 ctn', tipo: 'empaque', descripcion: 'Medio cartón (ej. 15 huevos)', activo: true },
  { id: 'uni-cmb', codigo: 'UNI-CMB', nombre: 'Combo', abreviatura: 'cmb', tipo: 'unidad', descripcion: 'Paquete o combo especial', activo: true },
  { id: 'uni-lbr', codigo: 'UNI-LBR', nombre: 'Libra', abreviatura: 'lb', tipo: 'peso', descripcion: 'Libra estándar (16 oz)', activo: true },
  { id: 'uni-kgm', codigo: 'UNI-KGM', nombre: 'Kilogramo', abreviatura: 'kg', tipo: 'peso', descripcion: 'Kilogramo métrico (1,000 g)', activo: true },
  { id: 'uni-grm', codigo: 'UNI-GRM', nombre: 'Gramo', abreviatura: 'g', tipo: 'peso', descripcion: 'Gramo métrico', activo: true },
  { id: 'uni-fdo', codigo: 'UNI-FDO', nombre: 'Fardo', abreviatura: 'fdo', tipo: 'empaque', descripcion: 'Fardo de productos (ej. agua, refrescos)', activo: true },
  { id: 'uni-paq', codigo: 'UNI-PAQ', nombre: 'Paquete', abreviatura: 'paq', tipo: 'empaque', descripcion: 'Paquete o bulto de unidades', activo: true },
  { id: 'uni-cja', codigo: 'UNI-CJA', nombre: 'Caja', abreviatura: 'cja', tipo: 'empaque', descripcion: 'Caja corrugada o empaque cerrado', activo: true },
  { id: 'uni-bls', codigo: 'UNI-BLS', nombre: 'Bolsa', abreviatura: 'bls', tipo: 'empaque', descripcion: 'Bolsa sellada o empaque flexible', activo: true },
  { id: 'uni-bot', codigo: 'UNI-BOT', nombre: 'Botella', abreviatura: 'bot', tipo: 'unidad', descripcion: 'Envase o botella individual', activo: true },
  { id: 'uni-ltr', codigo: 'UNI-LTR', nombre: 'Litro', abreviatura: 'lt', tipo: 'volumen', descripcion: 'Litro métrico de líquido', activo: true },
  { id: 'uni-gal', codigo: 'UNI-GAL', nombre: 'Galón', abreviatura: 'gal', tipo: 'volumen', descripcion: 'Galón estadounidense (3.785 L)', activo: true },
];

function getStoredUnidades(): UnidadMedida[] {
  try {
    const raw = localStorage.getItem(UNIDADES_STORAGE_KEY);
    if (!raw) return DEFAULT_UNIDADES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_UNIDADES;
  } catch {
    return DEFAULT_UNIDADES;
  }
}

function saveStoredUnidades(list: UnidadMedida[]): void {
  try {
    localStorage.setItem(UNIDADES_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error al guardar unidades de medida en localStorage:', err);
  }
}

function generarCodigoUnidad(nombre: string): string {
  const clean = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const suffix = Date.now().toString(36).toUpperCase().slice(-3);
  return `UNI-${clean || 'MED'}-${suffix}`;
}

export async function obtenerUnidadesMedida(params?: {
  busqueda?: string;
  tipo?: TipoUnidadMedida | 'todas';
  signal?: AbortSignal;
}): Promise<UnidadMedida[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      let query = sb
        .from('unidades_medida')
        .select('*')
        .eq('activo', true)
        .order('nombre');

      if (params?.tipo && params.tipo !== 'todas') {
        query = query.eq('tipo', params.tipo);
      }

      if (params?.busqueda?.trim()) {
        const q = params.busqueda.trim();
        query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,abreviatura.ilike.%${q}%`);
      }

      if (params?.signal) query = query.abortSignal(params.signal);

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const currentLocal = getStoredUnidades();
        const dbIds = new Set(data.map((d: any) => d.id));
        const localOnly = currentLocal.filter((u) => !dbIds.has(u.id) && u.id.startsWith('uni-'));
        const combined = [...data, ...localOnly] as UnidadMedida[];
        saveStoredUnidades(combined);

        let filtered = combined.filter((u) => u.activo !== false);
        if (params?.tipo && params.tipo !== 'todas') {
          filtered = filtered.filter((u) => u.tipo === params.tipo);
        }
        if (params?.busqueda?.trim()) {
          const q = params.busqueda.trim().toLowerCase();
          filtered = filtered.filter(
            (u) =>
              u.nombre.toLowerCase().includes(q) ||
              u.codigo.toLowerCase().includes(q) ||
              (u.abreviatura && u.abreviatura.toLowerCase().includes(q))
          );
        }
        return filtered;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      console.warn('Consulta a Supabase para unidades_medida falló, usando respaldo local:', err);
    }
  }

  // Fallback local enriquecido
  let list = getStoredUnidades().filter((u) => u.activo !== false);

  if (params?.tipo && params.tipo !== 'todas') {
    list = list.filter((u) => u.tipo === params.tipo);
  }

  if (params?.busqueda?.trim()) {
    const q = params.busqueda.trim().toLowerCase();
    list = list.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.codigo.toLowerCase().includes(q) ||
        (u.abreviatura && u.abreviatura.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function crearUnidadMedida(input: NuevaUnidadMedidaInput): Promise<UnidadMedida> {
  const nombreLimpio = input.nombre.trim();
  if (!nombreLimpio) throw new Error('El nombre de la unidad es obligatorio');

  const codigo = (input.codigo && input.codigo.trim()) || generarCodigoUnidad(nombreLimpio);
  const abreviatura = input.abreviatura ? input.abreviatura.trim() : null;
  const tipo: TipoUnidadMedida = input.tipo || 'unidad';
  const descripcion = input.descripcion ? input.descripcion.trim() : null;

  const currentLocal = getStoredUnidades();
  const existe = currentLocal.some(
    (u) => u.activo && u.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase()
  );
  if (existe) {
    throw new Error(`La unidad de medida "${nombreLimpio}" ya existe.`);
  }

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('unidades_medida')
        .insert({
          codigo,
          nombre: nombreLimpio,
          abreviatura,
          tipo,
          descripcion,
          activo: true,
        })
        .select('*')
        .single();

      if (!error && data) {
        const item = data as UnidadMedida;
        saveStoredUnidades([item, ...currentLocal.filter((u) => u.id !== item.id)]);
        return item;
      }
    } catch (err) {
      console.warn('Error al insertar unidad en Supabase, guardando en respaldo local:', err);
    }
  }

  const localItem: UnidadMedida = {
    id: `uni-${Date.now()}`,
    codigo,
    nombre: nombreLimpio,
    abreviatura,
    tipo,
    descripcion,
    activo: true,
    creado_en: new Date().toISOString(),
  };

  saveStoredUnidades([localItem, ...currentLocal]);
  return localItem;
}

export async function actualizarUnidadMedida(
  id: string,
  input: Partial<NuevaUnidadMedidaInput & { activo: boolean }>
): Promise<UnidadMedida> {
  const sb = tryGetSupabase();
  const patch: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
  if (input.codigo !== undefined) patch.codigo = input.codigo.trim();
  if (input.abreviatura !== undefined) patch.abreviatura = input.abreviatura ? input.abreviatura.trim() : null;
  if (input.tipo !== undefined) patch.tipo = input.tipo;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion ? input.descripcion.trim() : null;
  if (input.activo !== undefined) patch.activo = input.activo;

  if (sb) {
    try {
      const { data, error } = await sb
        .from('unidades_medida')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        const updated = data as UnidadMedida;
        const list = getStoredUnidades().map((u) => (u.id === id ? updated : u));
        saveStoredUnidades(list);
        return updated;
      }
    } catch (err) {
      console.warn('Fallo actualizando en Supabase, aplicando a memoria local:', err);
    }
  }

  const list = getStoredUnidades();
  const idx = list.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('Unidad de medida no encontrada');

  const updated: UnidadMedida = {
    ...list[idx],
    ...patch,
  };
  list[idx] = updated;
  saveStoredUnidades(list);
  return updated;
}

export async function eliminarUnidadMedida(id: string): Promise<void> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('unidades_medida').update({ activo: false }).eq('id', id);
    } catch (err) {
      console.warn('Error al desactivar unidad en Supabase:', err);
    }
  }

  const list = getStoredUnidades().map((u) => (u.id === id ? { ...u, activo: false } : u));
  saveStoredUnidades(list);
}

