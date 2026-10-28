import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';

export type Proveedor = {
  id: string;
  codigo: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  creado_en?: string;
};

export const PROVEEDOR_COLUMNS =
  'id, codigo, nombre, telefono, correo, direccion, activo, creado_en' as const;

export type NuevoProveedorInput = {
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
};

export async function obtenerProveedores(params?: {
  busqueda?: string;
  signal?: AbortSignal;
}): Promise<Proveedor[]> {
  const sb = tryGetSupabase();
  if (!sb) return [];

  let query = sb
    .from('proveedores')
    .select(PROVEEDOR_COLUMNS)
    .eq('activo', true)
    .order('nombre')
    .limit(300);

  if (params?.busqueda?.trim()) {
    const q = params.busqueda.trim();
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,correo.ilike.%${q}%,codigo.ilike.%${q}%`);
  }
  if (params?.signal) query = query.abortSignal(params.signal);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Proveedor[];
}

export async function crearProveedor(datos: NuevoProveedorInput): Promise<Proveedor> {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  if (!datos.nombre.trim()) throw new Error('El nombre es obligatorio');

  const sb = getSupabase();
  const codigo = `PROV-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await sb
    .from('proveedores')
    .insert({
      codigo,
      nombre: datos.nombre.trim(),
      telefono: datos.telefono?.trim() || null,
      correo: datos.correo?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      activo: true,
    })
    .select(PROVEEDOR_COLUMNS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '42501') {
      throw new Error(
        'Permisos RLS requeridos: ejecuta supabase/migrations/016_politicas_categorias_proveedores.sql en el SQL Editor de Supabase.'
      );
    }
    throw error;
  }
  return data as Proveedor;
}

export async function actualizarProveedor(
  id: string,
  datos: Partial<NuevoProveedorInput> & { activo?: boolean }
): Promise<Proveedor> {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  const sb = getSupabase();
  const patch: Record<string, unknown> = {};
  if (datos.nombre !== undefined) patch.nombre = datos.nombre.trim();
  if (datos.telefono !== undefined) patch.telefono = datos.telefono?.trim() || null;
  if (datos.correo !== undefined) patch.correo = datos.correo?.trim() || null;
  if (datos.direccion !== undefined) patch.direccion = datos.direccion?.trim() || null;
  if (datos.activo !== undefined) patch.activo = datos.activo;

  const { data, error } = await sb
    .from('proveedores')
    .update(patch)
    .eq('id', id)
    .select(PROVEEDOR_COLUMNS)
    .single();
  if (error) throw error;
  return data as Proveedor;
}

export async function eliminarProveedor(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  const sb = getSupabase();
  const { error } = await sb.from('proveedores').update({ activo: false }).eq('id', id);
  if (error) throw error;
}
