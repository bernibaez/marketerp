import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { getHeldSales, saveHeldSale, removeHeldSale, clearHeldSales, type HeldSale } from '@/lib/posStore';

export type { HeldSale };

export async function obtenerVentasSuspendidas(): Promise<HeldSale[]> {
  const local = getHeldSales();
  const sb = tryGetSupabase();
  if (!sb) return local;

  try {
    const { data, error } = await sb
      .from('ventas_suspendidas')
      .select('*')
      .order('saved_at', { ascending: false });

    if (error || !data) {
      return local;
    }

    const remote: HeldSale[] = data.map((r: any) => ({
      id: String(r.id),
      label: String(r.label || 'Venta en espera'),
      cart: Array.isArray(r.cart) ? r.cart : [],
      customer: r.customer ?? null,
      globalDiscount: Number(r.global_discount || 0),
      savedAt: String(r.saved_at || r.creado_en || new Date().toISOString()),
      cashierId: r.cashier_id ? String(r.cashier_id) : undefined,
      cashierName: r.cashier_name ? String(r.cashier_name) : undefined,
      cajaId: r.caja_id ? String(r.caja_id) : undefined,
      cajaLabel: r.caja_label ? String(r.caja_label) : undefined,
      total: Number(r.total || 0),
    }));

    // Sincronizar hacia local
    const mergedMap = new Map<string, HeldSale>();
    local.forEach((s) => mergedMap.set(s.id, s));
    remote.forEach((s) => mergedMap.set(s.id, s));
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );

    return merged;
  } catch (err) {
    console.warn('Error al obtener ventas suspendidas de Supabase:', err);
    return local;
  }
}

export async function guardarVentaSuspendida(sale: HeldSale): Promise<void> {
  // 1. Guardar siempre en local para máxima disponibilidad
  saveHeldSale(sale);

  // 2. Sincronizar en Supabase si está disponible
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      await sb.from('ventas_suspendidas').upsert({
        id: sale.id,
        label: sale.label,
        cart: sale.cart,
        customer: sale.customer,
        global_discount: sale.globalDiscount,
        saved_at: sale.savedAt,
        cashier_id: sale.cashierId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sale.cashierId) ? sale.cashierId : null,
        cashier_name: sale.cashierName || null,
        caja_id: sale.cajaId || null,
        caja_label: sale.cajaLabel || null,
        total: sale.total ?? 0,
      });
    } catch (err) {
      console.warn('No se pudo guardar la venta suspendida en Supabase:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mercato_held_sales_updated'));
  }
}

export async function eliminarVentaSuspendida(id: string): Promise<void> {
  // 1. Eliminar de local
  removeHeldSale(id);

  // 2. Eliminar de Supabase
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      await sb.from('ventas_suspendidas').delete().eq('id', id);
    } catch (err) {
      console.warn('No se pudo eliminar venta suspendida de Supabase:', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mercato_held_sales_updated'));
  }
}

export async function limpiarTodasVentasSuspendidas(): Promise<void> {
  clearHeldSales();
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabase();
      await sb.from('ventas_suspendidas').delete().neq('id', '');
    } catch (err) {
      console.warn('No se pudieron limpiar ventas suspendidas de Supabase:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mercato_held_sales_updated'));
  }
}

