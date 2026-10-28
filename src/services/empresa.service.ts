import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import type { ConfiguracionEmpresa } from '@/types/database';

export async function obtenerConfiguracionEmpresa(): Promise<ConfiguracionEmpresa | null> {
  const sb = tryGetSupabase();
  if (!sb) return null;

  const columnsWithInvoice =
    'id, nombre_comercial, razon_social, rnc, telefono, correo, direccion, logo_url, moneda, itbis_porcentaje, configuracion_factura, actualizado_en';
  const columnsBase =
    'id, nombre_comercial, razon_social, rnc, telefono, correo, direccion, logo_url, moneda, itbis_porcentaje, actualizado_en';

  let data: any = null;
  let error: any = null;

  const res1 = await sb
    .from('configuracion_empresa')
    .select(columnsWithInvoice)
    .order('actualizado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    res1.error &&
    (res1.error.code === '42703' ||
      String(res1.error.message || '').includes('configuracion_factura') ||
      String(res1.error.details || '').includes('configuracion_factura'))
  ) {
    const res2 = await sb
      .from('configuracion_empresa')
      .select(columnsBase)
      .order('actualizado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    data = res2.data;
    error = res2.error;
  } else {
    data = res1.data;
    error = res1.error;
  }

  if (error) throw error;
  if (!data) return null;

  // Fallback: si aún no tiene la columna configuracion_factura pero se guardó en razon_social
  if (
    !data.configuracion_factura &&
    typeof data.razon_social === 'string' &&
    data.razon_social.startsWith('{') &&
    data.razon_social.includes('printFormat')
  ) {
    try {
      data.configuracion_factura = JSON.parse(data.razon_social);
    } catch {
      /* ignore */
    }
  }

  return (data as ConfiguracionEmpresa) ?? null;
}

export async function guardarLogoEmpresa(logoUrl: string | null): Promise<string | null> {
  if (!isSupabaseConfigured()) return logoUrl;

  const sb = getSupabase();
  const existing = await obtenerConfiguracionEmpresa();

  if (existing?.id) {
    const { error } = await sb
      .from('configuracion_empresa')
      .update({ logo_url: logoUrl, actualizado_en: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    return logoUrl;
  }

  const { error } = await sb.from('configuracion_empresa').insert({
    nombre_comercial: 'Mercato',
    logo_url: logoUrl,
    moneda: 'DOP',
    itbis_porcentaje: 18,
  });
  if (error) throw error;
  return logoUrl;
}

export async function obtenerLogoEmpresa(): Promise<string | null> {
  const cfg = await obtenerConfiguracionEmpresa();
  return cfg?.logo_url ?? null;
}

export type DatosEmpresaInput = {
  nombre_comercial: string;
  razon_social?: string | null;
  rnc?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  moneda?: string | null;
  itbis_porcentaje?: number | null;
  configuracion_factura?: Record<string, any> | null;
};

export async function guardarConfiguracionEmpresa(datos: DatosEmpresaInput): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no configurado');
  }
  if (!datos.nombre_comercial.trim()) {
    throw new Error('El nombre de la empresa es obligatorio');
  }

  const sb = getSupabase();
  const existing = await obtenerConfiguracionEmpresa();
  const payloadBase: Record<string, any> = {
    nombre_comercial: datos.nombre_comercial.trim(),
    razon_social: datos.razon_social?.trim() || null,
    rnc: datos.rnc?.trim() || null,
    telefono: datos.telefono?.trim() || null,
    correo: datos.correo?.trim() || null,
    direccion: datos.direccion?.trim() || null,
    moneda: datos.moneda?.trim() || 'DOP',
    itbis_porcentaje: datos.itbis_porcentaje ?? 18,
    actualizado_en: new Date().toISOString(),
  };

  const payloadWithInvoice: Record<string, any> = {
    ...payloadBase,
    ...(datos.configuracion_factura !== undefined
      ? { configuracion_factura: datos.configuracion_factura }
      : {}),
  };

  let writeError: any = null;

  // 1. Intentar actualizar o insertar con columna configuracion_factura
  if (existing?.id) {
    const res = await sb.from('configuracion_empresa').update(payloadWithInvoice).eq('id', existing.id);
    writeError = res.error;
  } else {
    const res = await sb.from('configuracion_empresa').insert({
      ...payloadWithInvoice,
      logo_url: null,
    });
    writeError = res.error;
  }

  // 2. Si la columna configuracion_factura no existe aún en Postgres, guardar el JSON en razon_social como respaldo
  if (
    writeError &&
    (writeError.code === '42703' ||
      String(writeError.message || '').includes('configuracion_factura') ||
      String(writeError.details || '').includes('configuracion_factura'))
  ) {
    const fallbackPayload = {
      ...payloadBase,
      razon_social:
        payloadBase.razon_social ||
        (datos.configuracion_factura ? JSON.stringify(datos.configuracion_factura) : null),
    };

    if (existing?.id) {
      const res = await sb.from('configuracion_empresa').update(fallbackPayload).eq('id', existing.id);
      writeError = res.error;
    } else {
      const res = await sb.from('configuracion_empresa').insert({
        ...fallbackPayload,
        logo_url: null,
      });
      writeError = res.error;
    }
  }

  if (writeError) throw writeError;
}
