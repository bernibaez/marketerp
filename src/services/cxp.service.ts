import { getSupabase, tryGetSupabase } from './clienteSupabase';
import { CXP_COLUMNS, type EstadoCx } from '@/types/database';

export type CxStatusUi = 'pending' | 'partial' | 'overdue' | 'paid';

export type PagoCxpUi = {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
};

export type CuentaPagarUi = {
  id: string;
  code: string;
  purchase: string;
  supplier: string;
  supplierId: string | null;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
  status: CxStatusUi;
  daysOverdue: number;
  payments: PagoCxpUi[];
};

export type ProveedorOpcion = { id: string; nombre: string };

export type NuevaCxpInput = {
  proveedor_id: string;
  proveedor_nombre?: string;
  compra_id?: string | null;
  compra_ref?: string | null;
  monto_total: number;
  fecha_emision?: string;
  fecha_vencimiento: string;
};

export type NuevoPagoCxpInput = {
  cuenta_id: string;
  monto: number;
  metodo_pago: string;
  nota?: string;
  referencia?: string;
};

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  mixto: 'Mixto',
};

function mapMetodoPago(raw: string): 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque' | 'mixto' {
  const p = raw.toLowerCase();
  if (p.includes('efectivo')) return 'efectivo';
  if (p.includes('tarjeta')) return 'tarjeta';
  if (p.includes('transfer')) return 'transferencia';
  if (p.includes('cheque')) return 'cheque';
  return 'mixto';
}

function daysOverdue(dueDate: string, balance: number): number {
  if (balance <= 0) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

function toUiStatus(estado: EstadoCx, dueDate: string, balance: number): CxStatusUi {
  if (estado === 'pagada' || balance <= 0) return 'paid';
  if (estado === 'parcial') {
    return daysOverdue(dueDate, balance) > 0 ? 'overdue' : 'partial';
  }
  if (estado === 'vencida' || daysOverdue(dueDate, balance) > 0) return 'overdue';
  return 'pending';
}

// -------------------------------------------------------------
// ALMACENAMIENTO LOCAL DE CUENTAS POR PAGAR (CxP)
// -------------------------------------------------------------
const STORAGE_CXP = 'mercato_cxp_local';
const STORAGE_PAGOS_CXP = 'mercato_pagos_cxp_local';

interface CxpLocalRow {
  id: string;
  codigo: string;
  compra_id: string | null;
  compra_ref?: string | null;
  proveedor_id: string;
  proveedor_nombre?: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoCx;
  creado_en: string;
}

export interface PagoCxpLocalRow {
  id: string;
  cuenta_id: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  referencia?: string | null;
  creado_en: string;
}

const PROVEEDORES_DEFAULT: ProveedorOpcion[] = [
  { id: 'prov-1', nombre: 'Distribuidora Corripio' },
  { id: 'prov-2', nombre: 'Cervecería Nacional Dominicana' },
  { id: 'prov-3', nombre: 'MercaSID' },
  { id: 'prov-4', nombre: 'Induveca' },
  { id: 'prov-5', nombre: 'Rica' },
];

export function getLocalCxp(): CxpLocalRow[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_CXP) : null;
    return raw ? (JSON.parse(raw) as CxpLocalRow[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCxp(data: CxpLocalRow[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_CXP, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

export function getLocalPagosCxp(): PagoCxpLocalRow[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PAGOS_CXP) : null;
    return raw ? (JSON.parse(raw) as PagoCxpLocalRow[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalPagosCxp(data: PagoCxpLocalRow[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_PAGOS_CXP, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

async function nextCodigo(): Promise<string> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { count } = await sb.from('cuentas_por_pagar').select('id', { count: 'exact', head: true });
      const n = (count ?? 0) + 1;
      return `CXP-${String(n).padStart(3, '0')}`;
    } catch {
      // fallback
    }
  }
  const local = getLocalCxp();
  return `CXP-${String(local.length + 1).padStart(3, '0')}`;
}

export async function listarProveedores(): Promise<ProveedorOpcion[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('proveedores')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')
        .limit(300);
      if (!error && data && data.length > 0) {
        return data.map((p) => ({ id: String(p.id), nombre: String(p.nombre) }));
      }
    } catch {
      // Fallback
    }
  }
  return PROVEEDORES_DEFAULT;
}

export async function obtenerCuentasPorPagar(signal?: AbortSignal): Promise<CuentaPagarUi[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      let query = sb
        .from('cuentas_por_pagar')
        .select(
          `
          ${CXP_COLUMNS},
          proveedores ( nombre ),
          compras ( codigo ),
          pagos_cxp ( id, monto, metodo_pago, nota, creado_en )
        `
        )
        .neq('estado', 'anulada')
        .order('fecha_emision', { ascending: false })
        .limit(300);

      if (signal) query = query.abortSignal(signal);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return (data as Record<string, unknown>[]).map((row) => {
          const proveedor = row.proveedores as { nombre?: string } | null;
          const compra = row.compras as { codigo?: string } | null;
          const pagosRaw = (row.pagos_cxp as Record<string, unknown>[] | null) ?? [];
          const payments = pagosRaw
            .map((p) => ({
              id: String(p.id),
              date: String(p.creado_en).slice(0, 10),
              amount: Number(p.monto ?? 0),
              method: METHOD_LABEL[String(p.metodo_pago)] ?? String(p.metodo_pago),
              note: String(p.nota ?? ''),
            }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));

          const balance = Number(row.saldo ?? 0);
          const dueDate = String(row.fecha_vencimiento);
          const estado = row.estado as EstadoCx;

          return {
            id: String(row.id),
            code: String(row.codigo),
            purchase: compra?.codigo ?? '—',
            supplier: proveedor?.nombre ?? 'Sin proveedor',
            supplierId: row.proveedor_id ? String(row.proveedor_id) : null,
            issueDate: String(row.fecha_emision),
            dueDate,
            total: Number(row.monto_total ?? 0),
            paid: Number(row.monto_pagado ?? 0),
            balance,
            status: toUiStatus(estado, dueDate, balance),
            daysOverdue: daysOverdue(dueDate, balance),
            payments,
          };
        });
      }
    } catch {
      // Fallback a almacenamiento local
    }
  }

  // Fallback Local Storage
  const localCxp = getLocalCxp().filter((c) => c.estado !== 'anulada');
  const localPagos = getLocalPagosCxp();
  const proveedores = PROVEEDORES_DEFAULT;

  return localCxp.map((c) => {
    const prov = proveedores.find((p) => p.id === c.proveedor_id);
    const pagosDeCuenta = localPagos
      .filter((p) => p.cuenta_id === c.id)
      .map((p) => ({
        id: p.id,
        date: p.creado_en.slice(0, 10),
        amount: p.monto,
        method: METHOD_LABEL[p.metodo_pago] ?? p.metodo_pago,
        note: p.nota ?? '',
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const balance = Number(c.saldo);
    const dueDate = String(c.fecha_vencimiento);

    return {
      id: c.id,
      code: c.codigo,
      purchase: c.compra_ref || '—',
      supplier: c.proveedor_nombre || prov?.nombre || 'Proveedor a crédito',
      supplierId: c.proveedor_id,
      issueDate: c.fecha_emision,
      dueDate,
      total: Number(c.monto_total),
      paid: Number(c.monto_pagado),
      balance,
      status: toUiStatus(c.estado, dueDate, balance),
      daysOverdue: daysOverdue(dueDate, balance),
      payments: pagosDeCuenta,
    };
  });
}

export async function crearCuentaPorPagar(input: NuevaCxpInput): Promise<CxpLocalRow> {
  if (!input.proveedor_id) throw new Error('Selecciona un proveedor');
  if (!(input.monto_total > 0)) throw new Error('El monto debe ser mayor a 0');
  if (!input.fecha_vencimiento) throw new Error('Indica la fecha de vencimiento');

  const emision = input.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const codigo = await nextCodigo();
  const id = `cxp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const proveedores = PROVEEDORES_DEFAULT;
  const prov = proveedores.find((p) => p.id === input.proveedor_id);
  const provNombre = input.proveedor_nombre || prov?.nombre || 'Proveedor Crédito';

  const localRow: CxpLocalRow = {
    id,
    codigo,
    compra_id: input.compra_id ?? null,
    compra_ref: input.compra_ref ?? null,
    proveedor_id: input.proveedor_id,
    proveedor_nombre: provNombre,
    monto_total: Number(input.monto_total),
    monto_pagado: 0,
    saldo: Number(input.monto_total),
    fecha_emision: emision,
    fecha_vencimiento: input.fecha_vencimiento,
    estado: 'pendiente',
    creado_en: new Date().toISOString(),
  };

  const currentLocal = getLocalCxp();
  saveLocalCxp([localRow, ...currentLocal]);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('cuentas_por_pagar').insert({
        codigo,
        compra_id: input.compra_id ?? null,
        proveedor_id: input.proveedor_id,
        monto_total: input.monto_total,
        monto_pagado: 0,
        saldo: input.monto_total,
        fecha_emision: emision,
        fecha_vencimiento: input.fecha_vencimiento,
        estado: 'pendiente',
      });
    } catch {
      // Ignorar fallo remoto
    }
  }

  return localRow;
}

/** Crea CxP desde una compra a crédito (idempotente). */
export async function crearCxpDesdeCompra(params: {
  compra_id: string;
  compra_codigo?: string;
  proveedor_id: string | null | undefined;
  proveedor_nombre?: string;
  monto_total: number;
  dias_credito?: number;
}): Promise<CxpLocalRow | null> {
  if (!params.proveedor_id || !(params.monto_total > 0)) return null;

  const local = getLocalCxp();
  const existingLocal = local.find((c) => c.compra_id === params.compra_id);
  if (existingLocal) return existingLocal;

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('cuentas_por_pagar')
        .select('*')
        .eq('compra_id', params.compra_id)
        .maybeSingle();
      if (existing?.id) return existing as unknown as CxpLocalRow;
    } catch {
      // ignore
    }
  }

  const dias = params.dias_credito ?? 15;
  const venc = new Date();
  venc.setDate(venc.getDate() + dias);

  return await crearCuentaPorPagar({
    proveedor_id: params.proveedor_id,
    proveedor_nombre: params.proveedor_nombre,
    compra_id: params.compra_id,
    compra_ref: params.compra_codigo,
    monto_total: params.monto_total,
    fecha_vencimiento: venc.toISOString().slice(0, 10),
  });
}

export async function obtenerCxpPorCompra(compraId: string): Promise<CxpLocalRow | null> {
  const local = getLocalCxp();
  return local.find((c) => c.compra_id === compraId) ?? null;
}

export async function obtenerPagosCxp(cuentaId: string): Promise<PagoCxpLocalRow[]> {
  const local = getLocalPagosCxp();
  return local.filter((p) => p.cuenta_id === cuentaId);
}

export async function registrarPagoCxp(input: NuevoPagoCxpInput): Promise<PagoCxpLocalRow> {
  if (!(input.monto > 0)) throw new Error('Ingresa un monto válido');

  const sb = tryGetSupabase();
  let supabaseSuccess = false;

  if (sb) {
    try {
      const { data: cuenta, error: cErr } = await sb
        .from('cuentas_por_pagar')
        .select(CXP_COLUMNS)
        .eq('id', input.cuenta_id)
        .single();

      if (!cErr && cuenta) {
        const saldo = Number(cuenta.saldo);
        if (input.monto > saldo) {
          throw new Error(`El monto supera el saldo pendiente de RD$ ${saldo}`);
        }

        const { data: userData } = await sb.auth.getUser();

        await sb.from('pagos_cxp').insert({
          cuenta_id: input.cuenta_id,
          monto: input.monto,
          metodo_pago: mapMetodoPago(input.metodo_pago),
          nota: input.nota?.trim() || null,
          registrado_por: userData?.user?.id ?? null,
        });

        const newPaid = Number(cuenta.monto_pagado) + input.monto;
        const newBalance = Math.max(0, saldo - input.monto);
        let estado: EstadoCx = newBalance <= 0 ? 'pagada' : 'parcial';
        if (estado !== 'pagada' && daysOverdue(String(cuenta.fecha_vencimiento), newBalance) > 0) {
          estado = 'vencida';
        }

        await sb
          .from('cuentas_por_pagar')
          .update({ monto_pagado: newPaid, saldo: newBalance, estado })
          .eq('id', input.cuenta_id);

        supabaseSuccess = true;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('supera el saldo')) {
        throw err;
      }
    }
  }

  // Registrar pago en almacenamiento local
  const localList = getLocalCxp();
  const cIndex = localList.findIndex((c) => c.id === input.cuenta_id);
  if (cIndex >= 0) {
    const cuenta = localList[cIndex];
    const saldo = Number(cuenta.saldo);
    if (input.monto > saldo && !supabaseSuccess) {
      throw new Error(`El monto supera el saldo pendiente de RD$ ${saldo}`);
    }

    const newPaid = Number(cuenta.monto_pagado) + input.monto;
    const newBalance = Math.max(0, saldo - input.monto);
    let estado: EstadoCx = newBalance <= 0 ? 'pagada' : 'parcial';
    if (estado !== 'pagada' && daysOverdue(String(cuenta.fecha_vencimiento), newBalance) > 0) {
      estado = 'vencida';
    }

    localList[cIndex] = {
      ...cuenta,
      monto_pagado: newPaid,
      saldo: newBalance,
      estado,
    };
    saveLocalCxp(localList);

    const nuevoPago: PagoCxpLocalRow = {
      id: `pago-cxp-${Date.now()}`,
      cuenta_id: input.cuenta_id,
      monto: input.monto,
      metodo_pago: input.metodo_pago,
      nota: input.nota || null,
      referencia: input.referencia || null,
      creado_en: new Date().toISOString(),
    };
    const pagos = getLocalPagosCxp();
    saveLocalPagosCxp([nuevoPago, ...pagos]);
    return nuevoPago;
  }

  return {
    id: `pago-cxp-${Date.now()}`,
    cuenta_id: input.cuenta_id,
    monto: input.monto,
    metodo_pago: input.metodo_pago,
    nota: input.nota || null,
    referencia: input.referencia || null,
    creado_en: new Date().toISOString(),
  };
}
