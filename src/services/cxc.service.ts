import { getSupabase, isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';
import { CXC_COLUMNS, type EstadoCx } from '@/types/database';
import { getPosCustomers } from '@/lib/posCustomers';

export type CxStatusUi = 'pending' | 'partial' | 'overdue' | 'paid';

export type PagoCxcUi = {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
};

export type CuentaCobrarUi = {
  id: string;
  code: string;
  invoice: string;
  customer: string;
  customerId: string | null;
  creditLimit: number;
  issueDate: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
  status: CxStatusUi;
  daysOverdue: number;
  payments: PagoCxcUi[];
};

export type NuevaCxcInput = {
  cliente_id: string;
  cliente_nombre?: string;
  numero_factura?: string | null;
  venta_id?: string | null;
  monto_total: number;
  fecha_emision?: string;
  fecha_vencimiento: string;
};

export type NuevoPagoCxcInput = {
  cuenta_id: string;
  monto: number;
  metodo_pago: string;
  nota?: string;
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

function errorSupabase(error: unknown): Error {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; details?: string };
    if (e.code === 'PGRST205' || e.message?.includes('schema cache')) {
      return new Error(
        'La tabla "cuentas_por_cobrar" no existe. Ejecuta supabase/migrations/006_tablas_faltantes.sql en el SQL Editor.'
      );
    }
    return new Error([e.message, e.details].filter(Boolean).join(' — ') || 'Error de Supabase');
  }
  return error instanceof Error ? error : new Error('Error de Supabase');
}

// -------------------------------------------------------------
// ALMACENAMIENTO LOCAL DE CUENTAS POR COBRAR (CxC)
// -------------------------------------------------------------
const STORAGE_CXC = 'mercato_cxc_local';
const STORAGE_PAGOS_CXC = 'mercato_pagos_cxc_local';

interface CxcLocalRow {
  id: string;
  codigo: string;
  venta_id: string | null;
  numero_factura: string | null;
  cliente_id: string;
  cliente_nombre?: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoCx;
  creado_en: string;
}

interface PagoCxcLocalRow {
  id: string;
  cuenta_id: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  creado_en: string;
}

export function getLocalCxc(): CxcLocalRow[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_CXC) : null;
    return raw ? (JSON.parse(raw) as CxcLocalRow[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCxc(data: CxcLocalRow[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_CXC, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

export function getLocalPagosCxc(): PagoCxcLocalRow[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_PAGOS_CXC) : null;
    return raw ? (JSON.parse(raw) as PagoCxcLocalRow[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalPagosCxc(data: PagoCxcLocalRow[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_PAGOS_CXC, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

async function nextCodigo(prefix: string): Promise<string> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { count } = await sb.from('cuentas_por_cobrar').select('id', { count: 'exact', head: true });
      const n = (count ?? 0) + 1;
      return `${prefix}-${String(n).padStart(3, '0')}`;
    } catch {
      // fallback local
    }
  }
  const local = getLocalCxc();
  return `${prefix}-${String(local.length + 1).padStart(3, '0')}`;
}

export async function obtenerCuentasPorCobrar(signal?: AbortSignal): Promise<CuentaCobrarUi[]> {
  const sb = tryGetSupabase();
  if (sb) {
    try {
      let query = sb
        .from('cuentas_por_cobrar')
        .select(
          `
          ${CXC_COLUMNS},
          clientes ( nombre, limite_credito ),
          pagos_cxc ( id, monto, metodo_pago, nota, creado_en )
        `
        )
        .neq('estado', 'anulada')
        .order('fecha_emision', { ascending: false })
        .limit(300);

      if (signal) query = query.abortSignal(signal);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return (data as Record<string, unknown>[]).map((row) => {
          const cliente = row.clientes as { nombre?: string; limite_credito?: number } | null;
          const pagosRaw = (row.pagos_cxc as Record<string, unknown>[] | null) ?? [];
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
            invoice: String(row.numero_factura ?? '—'),
            customer: cliente?.nombre ?? 'Sin cliente',
            customerId: row.cliente_id ? String(row.cliente_id) : null,
            creditLimit: Number(cliente?.limite_credito ?? 0),
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
  const localCxc = getLocalCxc().filter((c) => c.estado !== 'anulada');
  const localPagos = getLocalPagosCxc();
  const customers = getPosCustomers();

  return localCxc.map((c) => {
    const cust = customers.find((k) => String(k.id) === String(c.cliente_id));
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
      invoice: c.numero_factura || '—',
      customer: c.cliente_nombre || cust?.name || 'Cliente a crédito',
      customerId: c.cliente_id,
      creditLimit: Number(cust?.credit ?? 0),
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

export async function crearCuentaPorCobrar(input: NuevaCxcInput): Promise<CxcLocalRow> {
  if (!input.cliente_id) throw new Error('Selecciona un cliente');
  if (!(input.monto_total > 0)) throw new Error('El monto debe ser mayor a 0');
  if (!input.fecha_vencimiento) throw new Error('Indica la fecha de vencimiento');

  const emision = input.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const codigo = await nextCodigo('CXC');
  const id = `cxc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const customers = getPosCustomers();
  const cust = customers.find((k) => String(k.id) === String(input.cliente_id));
  const clienteNombre = input.cliente_nombre || cust?.name || 'Cliente Crédito';

  const localRow: CxcLocalRow = {
    id,
    codigo,
    venta_id: input.venta_id ?? null,
    numero_factura: input.numero_factura?.trim() || null,
    cliente_id: input.cliente_id,
    cliente_nombre: clienteNombre,
    monto_total: Number(input.monto_total),
    monto_pagado: 0,
    saldo: Number(input.monto_total),
    fecha_emision: emision,
    fecha_vencimiento: input.fecha_vencimiento,
    estado: 'pendiente',
    creado_en: new Date().toISOString(),
  };

  const currentLocal = getLocalCxc();
  saveLocalCxc([localRow, ...currentLocal]);

  const sb = tryGetSupabase();
  if (sb) {
    try {
      await sb.from('cuentas_por_cobrar').insert({
        codigo,
        venta_id: input.venta_id ?? null,
        numero_factura: input.numero_factura?.trim() || null,
        cliente_id: input.cliente_id,
        monto_total: input.monto_total,
        monto_pagado: 0,
        saldo: input.monto_total,
        fecha_emision: emision,
        fecha_vencimiento: input.fecha_vencimiento,
        estado: 'pendiente',
      });

      const { data: cli } = await sb
        .from('clientes')
        .select('balance_actual')
        .eq('id', input.cliente_id)
        .maybeSingle();
      await sb
        .from('clientes')
        .update({ balance_actual: Number(cli?.balance_actual ?? 0) + input.monto_total })
        .eq('id', input.cliente_id);
    } catch {
      // Ignorar fallo de red remoto, ya guardado localmente
    }
  }

  return localRow;
}

/** Crea CxC desde una venta a crédito (idempotente si ya existe para esa venta). */
export async function crearCxcDesdeVenta(params: {
  venta_id: string;
  numero_factura: string;
  cliente_id: string | null | undefined;
  cliente_nombre?: string;
  monto_credito: number;
  dias_credito?: number;
}): Promise<CxcLocalRow | null> {
  if (!params.cliente_id || !(params.monto_credito > 0)) return null;

  // Verificar si ya existe localmente
  const local = getLocalCxc();
  const existingLocal = local.find(
    (c) => c.venta_id === params.venta_id || c.numero_factura === params.numero_factura
  );
  if (existingLocal) {
    return existingLocal;
  }

  const sb = tryGetSupabase();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('cuentas_por_cobrar')
        .select('*')
        .eq('venta_id', params.venta_id)
        .maybeSingle();
      if (existing?.id) return existing as unknown as CxcLocalRow;
    } catch {
      // ignore
    }
  }

  const dias = params.dias_credito ?? 15;
  const venc = new Date();
  venc.setDate(venc.getDate() + dias);

  return await crearCuentaPorCobrar({
    cliente_id: params.cliente_id,
    cliente_nombre: params.cliente_nombre,
    venta_id: params.venta_id,
    numero_factura: params.numero_factura,
    monto_total: params.monto_credito,
    fecha_vencimiento: venc.toISOString().slice(0, 10),
  });
}

export async function obtenerCxcPorVenta(ventaId: string): Promise<CxcLocalRow | null> {
  const local = getLocalCxc();
  return local.find((c) => c.venta_id === ventaId) ?? null;
}

export async function obtenerPagosCxc(cuentaId: string): Promise<PagoCxcLocalRow[]> {
  const local = getLocalPagosCxc();
  return local.filter((p) => p.cuenta_id === cuentaId);
}

export async function registrarPagoCxc(input: NuevoPagoCxcInput): Promise<PagoCxcLocalRow> {
  if (!(input.monto > 0)) throw new Error('Ingresa un monto válido');

  const sb = tryGetSupabase();
  let supabaseSuccess = false;

  if (sb) {
    try {
      const { data: cuenta, error: cErr } = await sb
        .from('cuentas_por_cobrar')
        .select(CXC_COLUMNS)
        .eq('id', input.cuenta_id)
        .single();

      if (!cErr && cuenta) {
        const saldo = Number(cuenta.saldo);
        if (input.monto > saldo) {
          throw new Error(`El monto supera el saldo pendiente de RD$ ${saldo}`);
        }

        const { data: userData } = await sb.auth.getUser();

        await sb.from('pagos_cxc').insert({
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
          .from('cuentas_por_cobrar')
          .update({ monto_pagado: newPaid, saldo: newBalance, estado })
          .eq('id', input.cuenta_id);

        if (cuenta.cliente_id) {
          const { data: cli } = await sb
            .from('clientes')
            .select('balance_actual')
            .eq('id', cuenta.cliente_id)
            .maybeSingle();
          const bal = Math.max(0, Number(cli?.balance_actual ?? 0) - input.monto);
          await sb.from('clientes').update({ balance_actual: bal }).eq('id', cuenta.cliente_id);
        }

        supabaseSuccess = true;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('supera el saldo')) {
        throw err;
      }
    }
  }

  // Registrar pago en almacenamiento local
  const localList = getLocalCxc();
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
    saveLocalCxc(localList);

    const nuevoPago: PagoCxcLocalRow = {
      id: `pago-cxc-${Date.now()}`,
      cuenta_id: input.cuenta_id,
      monto: input.monto,
      metodo_pago: input.metodo_pago,
      nota: input.nota || null,
      creado_en: new Date().toISOString(),
    };
    const pagos = getLocalPagosCxc();
    saveLocalPagosCxc([nuevoPago, ...pagos]);
    return nuevoPago;
  }

  return {
    id: `pago-cxc-${Date.now()}`,
    cuenta_id: input.cuenta_id,
    monto: input.monto,
    metodo_pago: input.metodo_pago,
    nota: input.nota || null,
    creado_en: new Date().toISOString(),
  };
}
