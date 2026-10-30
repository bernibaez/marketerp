import { tryGetSupabase } from './clienteSupabase';
import { GASTO_COLUMNS, type EstadoGasto } from '@/types/database';

export type GastoStatusUi = 'approved' | 'pending' | 'rejected';

export type GastoUi = {
  id: string;
  code: string;
  category: string;
  categoryId: string | null;
  description: string;
  amount: number;
  paymentMethod: string;
  responsible: string;
  date: string;
  receipt: boolean;
  status: GastoStatusUi;
};

export type CategoriaGastoUi = {
  id: string;
  code: string;
  name: string;
  description: string;
  budget: number;
  spent: number;
  activo: boolean;
};

export type NuevoGastoInput = {
  categoria_id: string;
  descripcion: string;
  monto: number;
  metodo_pago?: string;
  fecha?: string;
  responsable_nombre?: string;
  responsable_id?: string | null;
  tiene_recibo?: boolean;
  estado?: EstadoGasto;
};

export type NuevaCategoriaGastoInput = {
  nombre: string;
  descripcion?: string;
  presupuesto_mensual?: number;
};

const STATUS_UI: Record<EstadoGasto, GastoStatusUi> = {
  aprobado: 'approved',
  pendiente: 'pending',
  rechazado: 'rejected',
};

export const CATEGORIAS_GASTO_DEFAULT: CategoriaGastoUi[] = [
  { id: 'cat-001', code: 'CAT-001', name: 'Servicios Públicos (Luz, Agua, Internet)', description: 'Pago de electricidad, agua potable y telecomunicaciones', budget: 15000, spent: 0, activo: true },
  { id: 'cat-002', code: 'CAT-002', name: 'Nómina y Salarios', description: 'Sueldos de empleados, horas extras y propinas', budget: 80000, spent: 0, activo: true },
  { id: 'cat-003', code: 'CAT-003', name: 'Mantenimiento y Reparaciones', description: 'Reparación de equipos, pintura y arreglos del local', budget: 10000, spent: 0, activo: true },
  { id: 'cat-004', code: 'CAT-004', name: 'Suministros y Empaques', description: 'Bolsas plásticas, papel térmico para tickets y limpieza', budget: 8000, spent: 0, activo: true },
  { id: 'cat-005', code: 'CAT-005', name: 'Alquiler de Local', description: 'Pago mensual por concepto de arrendamiento comercial', budget: 35000, spent: 0, activo: true },
  { id: 'cat-006', code: 'CAT-006', name: 'Transporte y Combustible', description: 'Combustible de reparto, fletes y viáticos', budget: 12000, spent: 0, activo: true },
  { id: 'cat-007', code: 'CAT-007', name: 'Impuestos y Tasas', description: 'Arbitrios municipales, tasas bancarias y tributos', budget: 5000, spent: 0, activo: true },
  { id: 'cat-008', code: 'CAT-008', name: 'Otros Gastos Operativos', description: 'Gastos imprevistos y caja chica', budget: 5000, spent: 0, activo: true },
];

const LOCAL_GASTOS_KEY = 'mercato_gastos_local';
const LOCAL_CATEGORIAS_KEY = 'mercato_categorias_gasto_local';

function getCurrentAuthUser(): { id?: string; name?: string; username?: string } | null {
  try {
    const raw = localStorage.getItem('mercato_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalGastos(): GastoUi[] {
  try {
    const raw = localStorage.getItem(LOCAL_GASTOS_KEY);
    return raw ? (JSON.parse(raw) as GastoUi[]) : [];
  } catch {
    return [];
  }
}

function saveLocalGastos(data: GastoUi[]) {
  try {
    localStorage.setItem(LOCAL_GASTOS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getLocalCategorias(): CategoriaGastoUi[] {
  try {
    const raw = localStorage.getItem(LOCAL_CATEGORIAS_KEY);
    const parsed = raw ? (JSON.parse(raw) as CategoriaGastoUi[]) : [];
    if (parsed.length > 0) return parsed;
    saveLocalCategorias(CATEGORIAS_GASTO_DEFAULT);
    return CATEGORIAS_GASTO_DEFAULT;
  } catch {
    return CATEGORIAS_GASTO_DEFAULT;
  }
}

function saveLocalCategorias(data: CategoriaGastoUi[]) {
  try {
    localStorage.setItem(LOCAL_CATEGORIAS_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function obtenerCategoriasGasto(signal?: AbortSignal): Promise<CategoriaGastoUi[]> {
  const localList = getLocalCategorias();
  const sb = tryGetSupabase();
  if (!sb) return localList;

  try {
    let catQuery = sb
      .from('categorias_gasto')
      .select('id, codigo, nombre, descripcion, presupuesto_mensual, activo')
      .eq('activo', true)
      .order('nombre');
    if (signal) catQuery = catQuery.abortSignal(signal);

    const { data: cats, error } = await catQuery;
    if (error || !cats || cats.length === 0) {
      return localList;
    }

    const start = new Date();
    start.setDate(1);
    const desde = start.toISOString().slice(0, 10);

    let gasQuery = sb
      .from('gastos')
      .select('categoria_id, monto, estado')
      .eq('estado', 'aprobado')
      .gte('creado_en', `${desde}T00:00:00`);
    if (signal) gasQuery = gasQuery.abortSignal(signal);

    const { data: gastos } = await gasQuery;

    const spentByCat = new Map<string, number>();
    for (const g of gastos ?? []) {
      if (!g.categoria_id) continue;
      spentByCat.set(
        String(g.categoria_id),
        (spentByCat.get(String(g.categoria_id)) ?? 0) + Number(g.monto ?? 0)
      );
    }

    const result = cats.map((c) => ({
      id: String(c.id),
      code: String(c.codigo),
      name: String(c.nombre),
      description: String(c.descripcion ?? ''),
      budget: Number(c.presupuesto_mensual ?? 0),
      spent: spentByCat.get(String(c.id)) ?? 0,
      activo: Boolean(c.activo),
    }));

    saveLocalCategorias(result);
    return result;
  } catch {
    return localList;
  }
}

export async function obtenerGastos(signal?: AbortSignal): Promise<GastoUi[]> {
  const localList = getLocalGastos();
  const sb = tryGetSupabase();
  if (!sb) return localList;

  try {
    let query = sb
      .from('gastos')
      .select(
        `
        *,
        categorias_gasto ( nombre ),
        perfiles!responsable_id ( nombre_completo )
      `
      )
      .order('creado_en', { ascending: false })
      .limit(300);

    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query;
    if (error || !data) {
      return localList;
    }

    const catsMap = new Map(getLocalCategorias().map((c) => [c.id, c.name]));

    const fromDb: GastoUi[] = data.map((row: any) => {
      const cat = row.categorias_gasto as { nombre?: string } | null;
      const perfil = row.perfiles as { nombre_completo?: string } | null;
      const estado = (row.estado as EstadoGasto) ?? 'pendiente';
      const fecha = row.fecha || String(row.creado_en || new Date().toISOString()).slice(0, 10);
      const categoryName = cat?.nombre || catsMap.get(String(row.categoria_id)) || 'Sin categoría';

      return {
        id: String(row.id),
        code: String(row.codigo),
        category: categoryName,
        categoryId: row.categoria_id ? String(row.categoria_id) : null,
        description: String(row.descripcion ?? ''),
        amount: Number(row.monto ?? 0),
        paymentMethod: String(row.metodo_pago ?? 'efectivo'),
        responsible: row.responsable_nombre || perfil?.nombre_completo || 'Administrador',
        date: fecha,
        receipt: Boolean(row.tiene_recibo),
        status: STATUS_UI[estado] ?? 'pending',
      };
    });

    // Fusionar elementos locales que aún no estén en base de datos
    const dbIds = new Set(fromDb.map((g) => g.id));
    const pendingLocal = localList.filter((g) => !dbIds.has(g.id));
    return [...pendingLocal, ...fromDb];
  } catch {
    return localList;
  }
}

export async function crearGasto(input: NuevoGastoInput): Promise<GastoUi> {
  if (!input.categoria_id) throw new Error('Selecciona una categoría');
  if (!input.descripcion.trim()) throw new Error('La descripción es obligatoria');
  if (!(input.monto > 0)) throw new Error('El monto debe ser mayor a 0');

  const authUser = getCurrentAuthUser();
  const today = new Date().toISOString().slice(0, 10);
  const effectiveFecha = input.fecha || today;
  const effectiveMetodoPago = input.metodo_pago || 'efectivo';
  const effectiveResponsable = input.responsable_nombre || authUser?.name || 'Administrador';

  const localCats = getLocalCategorias();
  const cat = localCats.find((c) => c.id === input.categoria_id);
  const catName = cat?.name ?? 'Gastos Operativos';

  const localGastos = getLocalGastos();
  const nextSeq = localGastos.length + 1;
  const codigo = `GAS-${String(nextSeq).padStart(3, '0')}`;
  const id = crypto.randomUUID();

  const newGastoUi: GastoUi = {
    id,
    code: codigo,
    category: catName,
    categoryId: input.categoria_id,
    description: input.descripcion.trim(),
    amount: Number(input.monto),
    paymentMethod: effectiveMetodoPago,
    responsible: effectiveResponsable,
    date: effectiveFecha,
    receipt: Boolean(input.tiene_recibo),
    status: STATUS_UI[input.estado ?? 'pendiente'] ?? 'pending',
  };

  // 1. Guardar de inmediato en almacenamiento local para no perder nunca el registro
  saveLocalGastos([newGastoUi, ...localGastos]);

  // 2. Intentar guardar en Supabase si está disponible
  const sb = tryGetSupabase();
  if (sb) {
    try {
      const payloadWithMeta: Record<string, unknown> = {
        id,
        codigo,
        categoria_id: isUUID(input.categoria_id) ? input.categoria_id : null,
        descripcion: input.descripcion.trim(),
        monto: input.monto,
        metodo_pago: effectiveMetodoPago,
        fecha: effectiveFecha,
        responsable_id: authUser?.id && isUUID(authUser.id) ? authUser.id : null,
        responsable_nombre: effectiveResponsable,
        tiene_recibo: input.tiene_recibo ?? false,
        estado: input.estado ?? 'pendiente',
      };

      const { error: err1 } = await sb.from('gastos').insert(payloadWithMeta);
      if (err1) {
        // Si las columnas metodo_pago o fecha no están en la tabla de Supabase, reintentar con esquema estándar
        if (err1.message?.includes('column') || err1.code === '42703') {
          const minimalPayload = {
            id,
            codigo,
            categoria_id: isUUID(input.categoria_id) ? input.categoria_id : null,
            descripcion: input.descripcion.trim(),
            monto: input.monto,
            responsable_id: authUser?.id && isUUID(authUser.id) ? authUser.id : null,
            tiene_recibo: input.tiene_recibo ?? false,
            estado: input.estado ?? 'pendiente',
          };
          await sb.from('gastos').insert(minimalPayload);
        }
      }
    } catch {
      // Si la base de datos rechaza por RLS (42501) u offline, el gasto ya se guardó localmente con éxito
    }
  }

  return newGastoUi;
}

export async function actualizarEstadoGasto(id: string, estado: EstadoGasto): Promise<void> {
  const local = getLocalGastos().map((g) => {
    if (g.id === id) {
      return { ...g, status: STATUS_UI[estado] ?? g.status };
    }
    return g;
  });
  saveLocalGastos(local);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('gastos').update({ estado }).eq('id', id);
    } catch {
      // offline fallback
    }
  }
}

export async function actualizarGasto(
  id: string,
  datos: Partial<NuevoGastoInput>
): Promise<void> {
  const local = getLocalGastos().map((g) => {
    if (g.id === id) {
      return {
        ...g,
        categoryId: datos.categoria_id ?? g.categoryId,
        description: datos.descripcion ? datos.descripcion.trim() : g.description,
        amount: datos.monto !== undefined ? Number(datos.monto) : g.amount,
        paymentMethod: datos.metodo_pago ?? g.paymentMethod,
        date: datos.fecha ?? g.date,
        receipt: datos.tiene_recibo !== undefined ? Boolean(datos.tiene_recibo) : g.receipt,
        status: datos.estado ? STATUS_UI[datos.estado] : g.status,
      };
    }
    return g;
  });
  saveLocalGastos(local);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const patch: Record<string, unknown> = {};
      if (datos.categoria_id !== undefined) patch.categoria_id = datos.categoria_id;
      if (datos.descripcion !== undefined) patch.descripcion = datos.descripcion.trim();
      if (datos.monto !== undefined) patch.monto = datos.monto;
      if (datos.metodo_pago !== undefined) patch.metodo_pago = datos.metodo_pago;
      if (datos.fecha !== undefined) patch.fecha = datos.fecha;
      if (datos.tiene_recibo !== undefined) patch.tiene_recibo = datos.tiene_recibo;
      if (datos.estado !== undefined) patch.estado = datos.estado;
      await sb.from('gastos').update(patch).eq('id', id);
    } catch {
      // offline fallback
    }
  }
}

export async function eliminarGasto(id: string): Promise<void> {
  const local = getLocalGastos().filter((g) => g.id !== id);
  saveLocalGastos(local);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('gastos').delete().eq('id', id);
    } catch {
      // offline fallback
    }
  }
}

export async function crearCategoriaGasto(input: NuevaCategoriaGastoInput): Promise<CategoriaGastoUi> {
  if (!input.nombre.trim()) throw new Error('El nombre es obligatorio');

  const localCats = getLocalCategorias();
  const nextSeq = localCats.length + 1;
  const codigo = `CAT-${String(nextSeq).padStart(3, '0')}`;
  const id = crypto.randomUUID();

  const newCat: CategoriaGastoUi = {
    id,
    code: codigo,
    name: input.nombre.trim(),
    description: input.descripcion?.trim() || '',
    budget: Number(input.presupuesto_mensual ?? 0),
    spent: 0,
    activo: true,
  };

  saveLocalCategorias([...localCats, newCat]);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('categorias_gasto').insert({
        id,
        codigo,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        presupuesto_mensual: Number(input.presupuesto_mensual ?? 0),
        activo: true,
      });
    } catch {
      // fallback local
    }
  }

  return newCat;
}

export async function eliminarCategoriaGasto(id: string): Promise<void> {
  const localCats = getLocalCategorias().filter((c) => c.id !== id);
  saveLocalCategorias(localCats);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('categorias_gasto').update({ activo: false }).eq('id', id);
    } catch {
      // fallback local
    }
  }
}
