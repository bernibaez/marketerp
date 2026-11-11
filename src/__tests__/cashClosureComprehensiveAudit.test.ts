import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setSupabaseClientForTests } from '@/services/supabaseSafeClient';
import {
  iniciarCaja,
  cerrarTurnoCaja,
  calcularResumenCajaAbierta,
  obtenerCajaAbierta,
  obtenerCierresCaja,
  obtenerRegistrosCierreCaja,
  obtenerCierrePorId,
  evaluarConsistenciaCierre,
} from '@/services/cierresCaja.service';
import {
  procesarVenta,
  anularVenta,
  obtenerVentasTurno,
  saveLocalVentas,
  type PayloadVenta,
} from '@/services/ventas.service';
import {
  registrarMovimientoCaja,
  obtenerMovimientosCaja,
  saveLocalMovimientoCaja,
} from '@/services/movimientosCaja.service';
import { crearGasto } from '@/services/gastos.service';
import { crearDevolucion } from '@/services/devoluciones.service';
import {
  getCashClosures,
  saveCashClosure,
  type CashClosure,
} from '@/lib/cashClosureStore';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  (globalThis as unknown as { localStorage: LocalStorageMock }).localStorage = new LocalStorageMock();
}

const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function calcNetCashSql(v: Record<string, any>): number {
  const eff = Math.max(0, Number(v.monto_efectivo ?? 0));
  const card = Math.max(0, Number(v.monto_tarjeta ?? 0));
  const transfer = Math.max(0, Number(v.monto_transferencia ?? 0));
  const credit = Math.max(0, Number(v.monto_credito ?? 0));
  const total = Math.max(0, Number(v.monto_total ?? 0));
  const change = Math.max(0, Number(v.devuelta_entregada ?? 0));
  const sumComponents = eff + card + transfer + credit;
  const overTendered = Math.max(0, r2(sumComponents - total));
  const deduct = Math.min(change, overTendered);
  return Math.max(0, r2(eff - deduct));
}

function splitTopLevelCommas(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function evalSimplePredicate(row: Record<string, any>, clause: string): boolean {
  const c = clause.trim();
  if (c.startsWith('and(') && c.endsWith(')')) {
    const inner = splitTopLevelCommas(c.slice(4, -1));
    return inner.every((sub) => evalSimplePredicate(row, sub));
  }
  if (c.startsWith('or(') && c.endsWith(')')) {
    const inner = splitTopLevelCommas(c.slice(3, -1));
    return inner.some((sub) => evalSimplePredicate(row, sub));
  }
  const firstDot = c.indexOf('.');
  if (firstDot === -1) return true;
  const col = c.slice(0, firstDot);
  const rest = c.slice(firstDot + 1);
  const secondDot = rest.indexOf('.');
  if (secondDot === -1) return true;
  const op = rest.slice(0, secondDot);
  const rawVal = rest.slice(secondDot + 1);
  const rowVal = row[col];

  switch (op) {
    case 'eq':
      return String(rowVal ?? '') === rawVal;
    case 'neq':
      return String(rowVal ?? '') !== rawVal;
    case 'is':
      return rawVal === 'null' ? rowVal == null : Boolean(rowVal);
    case 'gte':
      return String(rowVal ?? '') >= rawVal;
    case 'lte':
      return String(rowVal ?? '') <= rawVal;
    case 'ilike': {
      const needle = rawVal.replace(/%/g, '').toLowerCase();
      return String(rowVal ?? '').toLowerCase().includes(needle);
    }
    default:
      return true;
  }
}

interface SimDbState {
  cierres_caja: Record<string, any>[];
  ventas: Record<string, any>[];
  detalle_ventas: Record<string, any>[];
  movimientos_caja: Record<string, any>[];
  gastos: Record<string, any>[];
  devoluciones: Record<string, any>[];
  detalle_devoluciones: Record<string, any>[];
  cajas: Record<string, any>[];
  perfiles: Record<string, any>[];
  clientes: Record<string, any>[];
  categorias_gasto: Record<string, any>[];
}

function createTransactionalSupabaseMock(options?: { rpcCloseDelayMs?: number }) {
  const db: SimDbState = {
    cierres_caja: [],
    ventas: [],
    detalle_ventas: [],
    movimientos_caja: [],
    gastos: [],
    devoluciones: [],
    detalle_devoluciones: [],
    cajas: [],
    perfiles: [],
    clientes: [],
    categorias_gasto: [],
  };

  let saleSeq = 1;
  let clockSeq = 0;
  const baseEpoch = Date.now();
  const nextIso = () => new Date(baseEpoch + clockSeq++ * 10).toISOString();

  // Simula lock transaccional FOR UPDATE por tabla/registro en PostgreSQL
  const pgLocks = new Map<string, Promise<unknown>>();
  async function withPgLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = pgLocks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.then(
      () => undefined,
      () => undefined
    );
    pgLocks.set(key, tail);
    try {
      return await run;
    } finally {
      if (pgLocks.get(key) === tail) {
        pgLocks.delete(key);
      }
    }
  }

  function hydrateRelations(row: Record<string, any>, table: string, selectCols: string) {
    const out = { ...row };
    if (selectCols.includes('perfiles') && table === 'cierres_caja' && row.cajero_id) {
      const perfil = db.perfiles.find((p) => p.id === row.cajero_id) ?? null;
      if (perfil) {
        out.perfiles = { nombre_completo: perfil.nombre_completo, correo: perfil.correo };
      }
    }
    if (selectCols.includes('perfiles') && table === 'ventas' && row.cajero_id) {
      const perfil = db.perfiles.find((p) => p.id === row.cajero_id) ?? null;
      if (perfil) {
        out.perfiles = { nombre_completo: perfil.nombre_completo };
      }
    }
    if (selectCols.includes('clientes') && table === 'ventas' && row.cliente_id) {
      const cli = db.clientes.find((c) => c.id === row.cliente_id) ?? null;
      if (cli) out.clientes = { nombre: cli.nombre };
    }
    if (selectCols.includes('detalle_ventas') && table === 'ventas') {
      out.detalle_ventas = db.detalle_ventas.filter((d) => d.venta_id === row.id);
    }
    return out;
  }

  class QueryBuilder {
    private filters: ((r: Record<string, any>) => boolean)[] = [];
    private orderBy: { col: string; asc: boolean } | null = null;
    private rangeBounds: [number, number] | null = null;
    private limitVal: number | null = null;
    private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';
    private countExact = false;
    private selectCols = '*';
    private mode: 'select' | 'insert' | 'update' | 'upsert' = 'select';
    private payload: any = null;

    constructor(private table: keyof SimDbState) {}

    select(cols = '*', opts?: { count?: 'exact' }) {
      this.selectCols = cols;
      if (opts?.count === 'exact') this.countExact = true;
      return this;
    }

    insert(rows: any) {
      this.mode = 'insert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    update(patch: Record<string, any>) {
      this.mode = 'update';
      this.payload = patch;
      return this;
    }

    upsert(rows: any) {
      this.mode = 'upsert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    eq(col: string, val: any) {
      this.filters.push((r) => String(r[col] ?? '') === String(val ?? ''));
      return this;
    }

    neq(col: string, val: any) {
      this.filters.push((r) => String(r[col] ?? '') !== String(val ?? ''));
      return this;
    }

    in(col: string, vals: any[]) {
      const set = new Set(vals.map((v) => String(v)));
      this.filters.push((r) => set.has(String(r[col] ?? '')));
      return this;
    }

    is(col: string, val: null | boolean) {
      this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
      return this;
    }

    gte(col: string, val: string) {
      this.filters.push((r) => String(r[col] ?? '') >= String(val));
      return this;
    }

    lte(col: string, val: string) {
      this.filters.push((r) => String(r[col] ?? '') <= String(val));
      return this;
    }

    ilike(col: string, pattern: string) {
      const needle = pattern.replace(/%/g, '').toLowerCase();
      this.filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
      return this;
    }

    or(expr: string) {
      const clauses = splitTopLevelCommas(expr);
      this.filters.push((r) => clauses.some((c) => evalSimplePredicate(r, c)));
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, asc: opts?.ascending !== false };
      return this;
    }

    range(from: number, to: number) {
      this.rangeBounds = [from, to];
      return this;
    }

    limit(n: number) {
      this.limitVal = n;
      return this;
    }

    abortSignal(_sig?: AbortSignal) {
      return this;
    }

    single() {
      this.singleMode = 'single';
      return this;
    }

    maybeSingle() {
      this.singleMode = 'maybeSingle';
      return this;
    }

    private execute() {
      const rowsRef = db[this.table];

      if (this.mode === 'insert') {
        const inserted = (this.payload as Record<string, any>[]).map((item) => {
          const row = {
            id: item.id || crypto.randomUUID(),
            creado_en: item.creado_en || nextIso(),
            ...item,
          };
          rowsRef.push(row);
          return hydrateRelations(row, this.table, this.selectCols);
        });
        if (this.singleMode === 'single' || this.singleMode === 'maybeSingle') {
          return { data: inserted[0] ?? null, error: null, count: inserted.length };
        }
        return { data: inserted, error: null, count: inserted.length };
      }

      if (this.mode === 'upsert') {
        const upserted: Record<string, any>[] = [];
        for (const item of this.payload as Record<string, any>[]) {
          const id = item.id || crypto.randomUUID();
          const idx = rowsRef.findIndex((r) => String(r.id) === String(id));
          const merged = idx >= 0 ? { ...rowsRef[idx], ...item } : { id, creado_en: nextIso(), ...item };
          if (idx >= 0) rowsRef[idx] = merged;
          else rowsRef.push(merged);
          upserted.push(hydrateRelations(merged, this.table, this.selectCols));
        }
        if (this.singleMode === 'single' || this.singleMode === 'maybeSingle') {
          return { data: upserted[0] ?? null, error: null, count: upserted.length };
        }
        return { data: upserted, error: null, count: upserted.length };
      }

      if (this.mode === 'update') {
        const updated: Record<string, any>[] = [];
        for (let i = 0; i < rowsRef.length; i++) {
          if (this.filters.every((f) => f(rowsRef[i]))) {
            rowsRef[i] = { ...rowsRef[i], ...this.payload };
            updated.push(hydrateRelations(rowsRef[i], this.table, this.selectCols));
          }
        }
        if (this.singleMode === 'single') {
          return updated[0]
            ? { data: updated[0], error: null, count: updated.length }
            : { data: null, error: { message: 'No rows updated', code: 'PGRST116' }, count: 0 };
        }
        if (this.singleMode === 'maybeSingle') {
          return { data: updated[0] ?? null, error: null, count: updated.length };
        }
        return { data: updated, error: null, count: updated.length };
      }

      // SELECT
      let matched = rowsRef.filter((r) => this.filters.every((f) => f(r)));
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        matched = [...matched].sort((a, b) => {
          const av = String(a[col] ?? '');
          const bv = String(b[col] ?? '');
          if (av === bv) return 0;
          return asc ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
        });
      }
      const totalCount = matched.length;
      let sliced = matched;
      if (this.rangeBounds) {
        const [from, to] = this.rangeBounds;
        sliced = matched.slice(from, to + 1);
      } else if (this.limitVal != null) {
        sliced = matched.slice(0, this.limitVal);
      }

      const hydrated = sliced.map((r) => hydrateRelations(r, this.table, this.selectCols));
      if (this.singleMode === 'single') {
        if (hydrated.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: 0 };
        }
        return { data: hydrated[0], error: null, count: 1 };
      }
      if (this.singleMode === 'maybeSingle') {
        return { data: hydrated[0] ?? null, error: null, count: hydrated.length };
      }
      return {
        data: hydrated,
        error: null,
        count: this.countExact ? totalCount : hydrated.length,
      };
    }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
    }
  }

  async function handleRpc(fnName: string, args: Record<string, any>) {
    if (fnName === 'iniciar_caja_transaccional') {
      const cajaId = String(args.p_caja_id ?? '1');
      return await withPgLock(`open:${cajaId}`, async () => {
        const existente = db.cierres_caja.find(
          (c) => String(c.estado).toLowerCase() === 'abierta' && String(c.caja_id) === cajaId
        );
        if (existente) {
          const mismoId =
            args.p_cajero_id &&
            existente.cajero_id &&
            String(args.p_cajero_id) === String(existente.cajero_id);
          const mismoNombre =
            !args.p_cajero_id &&
            args.p_cajero_nombre &&
            String(args.p_cajero_nombre).trim().toLowerCase() ===
              String(existente.cajero_nombre ?? '').trim().toLowerCase();
          if (mismoId || mismoNombre) {
            return { data: { ok: true, reused: true, cierre: existente }, error: null };
          }
          return {
            data: {
              ok: false,
              error: `La caja ya tiene una sesión abierta por ${existente.cajero_nombre || 'otro cajero'}.`,
            },
            error: null,
          };
        }

        const nueva = {
          id: crypto.randomUUID(),
          codigo: `AP-${String(db.cierres_caja.length + 1).padStart(6, '0')}`,
          caja_id: cajaId,
          caja_label: args.p_caja_label || `Caja ${cajaId}`,
          cajero_id: args.p_cajero_id || null,
          cajero_nombre: args.p_cajero_nombre || 'Cajero',
          cajero_username: args.p_cajero_username || null,
          abierta_en: nextIso(),
          cerrada_en: null,
          monto_apertura: r2(args.p_monto_apertura || 0),
          monto_esperado: r2(args.p_monto_apertura || 0),
          monto_real: 0,
          monto_diferencia: 0,
          total_ventas: 0,
          total_efectivo: 0,
          total_tarjeta: 0,
          total_transferencia: 0,
          total_otros: 0,
          total_entradas: 0,
          total_retiros: 0,
          total_devoluciones: 0,
          estado: 'abierta',
          notes: args.p_notes || null,
        };
        db.cierres_caja.push(nueva);
        return { data: { ok: true, reused: false, cierre: nueva }, error: null };
      });
    }

    if (fnName === 'procesar_venta_pos') {
      const p = args.p_payload ?? {};
      const ventaId = crypto.randomUUID();
      const numero = p.numero_factura || `FAC-${String(saleSeq++).padStart(6, '0')}`;
      let cierreId = p.cierre_id ? String(p.cierre_id) : null;
      if (!cierreId && p.caja_id) {
        const abierta = db.cierres_caja.find(
          (c) => String(c.estado).toLowerCase() === 'abierta' && String(c.caja_id) === String(p.caja_id)
        );
        cierreId = abierta?.id ?? null;
      }
      const createdAt = nextIso();
      const saleRow = {
        id: ventaId,
        numero_factura: numero,
        ncf: p.ncf ?? null,
        tipo_ncf: p.tipo_ncf ?? null,
        sucursal_id: p.sucursal_id ?? null,
        cajero_id: p.cajero_id ?? null,
        cajero_nombre: p.cajero_nombre ?? null,
        cliente_id: p.cliente_id ?? null,
        caja_id: p.caja_id ?? null,
        cierre_id: cierreId,
        subtotal: r2(p.subtotal ?? 0),
        monto_impuesto: r2(p.monto_impuesto ?? 0),
        monto_descuento: r2(p.monto_descuento ?? 0),
        monto_total: r2(p.monto_total ?? 0),
        costo_total: r2(p.costo_total ?? 0),
        metodo_pago: p.metodo_pago ?? 'efectivo',
        monto_pagado: r2(p.monto_pagado ?? p.monto_total ?? 0),
        monto_efectivo: r2(p.monto_efectivo ?? 0),
        monto_tarjeta: r2(p.monto_tarjeta ?? 0),
        monto_transferencia: r2(p.monto_transferencia ?? 0),
        monto_credito: r2(p.monto_credito ?? 0),
        devuelta_entregada: r2(p.devuelta_entregada ?? 0),
        estado: 'completada',
        creado_en: createdAt,
      };
      db.ventas.push(saleRow);
      for (const it of p.items ?? []) {
        db.detalle_ventas.push({
          id: crypto.randomUUID(),
          venta_id: ventaId,
          producto_id: it.producto_id ?? null,
          combo_id: it.combo_id ?? null,
          tipo_item: it.tipo_item,
          nombre_item: it.nombre_item,
          sku: it.sku ?? null,
          precio_unitario: r2(it.precio_unitario),
          costo_unitario: r2(it.costo_unitario),
          cantidad: Number(it.cantidad),
          porcentaje_impuesto: Number(it.porcentaje_impuesto ?? 0),
          subtotal: r2(it.subtotal),
        });
      }
      return {
        data: { venta_id: ventaId, cierre_id: cierreId, numero_factura: numero, ncf: p.ncf ?? null },
        error: null,
      };
    }

    if (fnName === 'anular_venta_pos') {
      const v = db.ventas.find((row) => String(row.id) === String(args.p_venta_id));
      if (v) v.estado = 'anulada';
      return { data: { ok: true }, error: null };
    }

    if (fnName === 'cerrar_caja_transaccional') {
      const pCierreId = String(args.p_cierre_id);
      return await withPgLock(`close:${pCierreId}`, async () => {
        if (options?.rpcCloseDelayMs) {
          await new Promise((res) => setTimeout(res, options.rpcCloseDelayMs));
        }

        const idx = db.cierres_caja.findIndex((c) => String(c.id) === pCierreId);
        if (idx === -1) {
          return {
            data: { ok: false, error: 'No se encontró la sesión de caja especificada.' },
            error: null,
          };
        }

        const cierre = db.cierres_caja[idx];
        if (String(cierre.estado).toLowerCase() !== 'abierta') {
          return {
            data: { ok: false, error: 'La sesión de caja ya fue cerrada.' },
            error: null,
          };
        }

        // Réplica exacta de 034_auditoria_cierre_caja_por_sesion.sql:
        // SOLO ventas vinculadas por cierre_id = p_cierre_id (o legacy NULL de la misma caja desde abierta_en), excluyendo anuladas
        const ventasTurno = db.ventas.filter((v) => {
          if (String(v.estado).toLowerCase() === 'anulada') return false;
          if (v.cierre_id != null && String(v.cierre_id).trim() !== '') {
            return String(v.cierre_id) === pCierreId;
          }
          return (
            String(v.caja_id ?? '') === String(cierre.caja_id) &&
            String(v.creado_en ?? '') >= String(cierre.abierta_en ?? '')
          );
        });

        let totalVentas = 0;
        let totalEfectivo = 0;
        let totalTarjeta = 0;
        let totalTransferencia = 0;
        let totalOtros = 0;

        for (const v of ventasTurno) {
          totalVentas = r2(totalVentas + Number(v.monto_total ?? 0));
          totalEfectivo = r2(totalEfectivo + calcNetCashSql(v));
          totalTarjeta = r2(totalTarjeta + Number(v.monto_tarjeta ?? 0));
          totalTransferencia = r2(totalTransferencia + Number(v.monto_transferencia ?? 0));
          totalOtros = r2(totalOtros + Number(v.monto_credito ?? 0));
        }

        // SOLO movimientos vinculados por cierre_id = p_cierre_id (o legacy NULL de la misma caja desde abierta_en)
        const movsTurno = db.movimientos_caja.filter((m) => {
          if (m.cierre_id != null && String(m.cierre_id).trim() !== '') {
            return String(m.cierre_id) === pCierreId;
          }
          return (
            String(m.caja_id ?? '') === String(cierre.caja_id) &&
            String(m.creado_en ?? '') >= String(cierre.abierta_en ?? '')
          );
        });

        let totalEntradas = 0;
        let totalRetiros = 0;
        let totalDevoluciones = 0;

        for (const m of movsTurno) {
          const monto = r2(m.monto ?? 0);
          const tipo = String(m.tipo ?? '').toLowerCase();
          const cat = String(m.categoria ?? '').toLowerCase();
          const conc = String(m.concepto ?? '').toLowerCase();
          if (tipo === 'entrada' || tipo === 'aporte') {
            totalEntradas = r2(totalEntradas + monto);
          } else if (
            (tipo === 'salida' || tipo === 'retiro') &&
            (cat.includes('devoluci') || conc.includes('devoluci'))
          ) {
            totalDevoluciones = r2(totalDevoluciones + monto);
          } else if (tipo === 'salida' || tipo === 'retiro' || tipo === 'gasto') {
            totalRetiros = r2(totalRetiros + monto);
          }
        }

        const apertura = r2(cierre.monto_apertura ?? 0);
        const montoEsperado = r2(
          apertura + totalEfectivo + totalEntradas - totalRetiros - totalDevoluciones
        );
        const montoReal = r2(args.p_monto_real ?? 0);
        const montoDiferencia = r2(montoReal - montoEsperado);

        const updated = {
          ...cierre,
          codigo:
            !cierre.codigo || String(cierre.codigo).startsWith('AP-')
              ? `CC-${String(idx + 1).padStart(6, '0')}`
              : cierre.codigo,
          usuario_cierre_id: args.p_cajero_id ?? cierre.cajero_id ?? null,
          usuario_cierre_nombre: args.p_cajero_nombre ?? cierre.cajero_nombre ?? null,
          cerrada_en: nextIso(),
          monto_esperado: montoEsperado,
          monto_real: montoReal,
          monto_diferencia: montoDiferencia,
          total_ventas: totalVentas,
          total_efectivo: totalEfectivo,
          total_tarjeta: totalTarjeta,
          total_transferencia: totalTransferencia,
          total_otros: totalOtros,
          total_entradas: totalEntradas,
          total_retiros: totalRetiros,
          total_devoluciones: totalDevoluciones,
          estado: 'cerrada',
          notes: args.p_notes ?? cierre.notes ?? null,
        };
        db.cierres_caja[idx] = updated;
        return { data: { ok: true, cierre: updated }, error: null };
      });
    }

    return { data: null, error: { message: `RPC no mockeada: ${fnName}` } };
  }

  const client = {
    from: (table: keyof SimDbState) => new QueryBuilder(table),
    rpc: (fnName: string, args: Record<string, any>) => handleRpc(fnName, args),
  } as unknown as SupabaseClient;

  return { client, db };
}

function makeSalePayload(
  overrides: Partial<PayloadVenta> & { precio?: number; itemName?: string }
): PayloadVenta {
  const precio = overrides.precio ?? overrides.monto_total ?? 1000;
  return {
    cajero_id: overrides.cajero_id ?? '11111111-1111-4111-8111-111111111111',
    cajero_nombre: overrides.cajero_nombre ?? 'Cajero Test',
    caja_id: overrides.caja_id ?? '1',
    cierre_id: overrides.cierre_id ?? null,
    subtotal: overrides.subtotal ?? precio,
    monto_impuesto: overrides.monto_impuesto ?? 0,
    monto_descuento: overrides.monto_descuento ?? 0,
    monto_total: overrides.monto_total ?? precio,
    costo_total: overrides.costo_total ?? r2(precio * 0.6),
    metodo_pago: overrides.metodo_pago ?? 'efectivo',
    monto_pagado: overrides.monto_pagado ?? precio,
    monto_efectivo:
      overrides.monto_efectivo ??
      (overrides.metodo_pago === 'efectivo' || !overrides.metodo_pago ? precio : 0),
    monto_tarjeta: overrides.monto_tarjeta ?? 0,
    monto_transferencia: overrides.monto_transferencia ?? 0,
    monto_credito: overrides.monto_credito ?? 0,
    devuelta_entregada: overrides.devuelta_entregada ?? 0,
    items: overrides.items ?? [
      {
        tipo_item: 'producto',
        nombre_item: overrides.itemName ?? 'Artículo Prueba',
        precio_unitario: precio,
        costo_unitario: r2(precio * 0.6),
        cantidad: 1,
        subtotal: precio,
      },
    ],
  };
}

const UUID_CAJERO_A = '11111111-1111-4111-8111-111111111111';
const UUID_CAJERO_B = '22222222-2222-4222-8222-222222222222';
const UUID_CAJERO_C = '33333333-3333-4333-8333-333333333333';

describe('Auditoría Integral de Cierre de Caja (15 Escenarios Obligatorios)', () => {
  beforeEach(() => {
    localStorage.clear();
    setSupabaseClientForTests(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setSupabaseClientForTests(null);
  });

  // 1. Un cajero con una caja y ventas en efectivo (incluyendo devuelta)
  it('1. Un cajero con una caja y ventas en efectivo (descontando devuelta entregada)', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1500,
    });

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        cajero_nombre: 'Ana Gómez',
        monto_total: 600,
        monto_pagado: 600,
        monto_efectivo: 600,
        devuelta_entregada: 0,
      })
    );
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        cajero_nombre: 'Ana Gómez',
        monto_total: 350,
        monto_pagado: 500,
        monto_efectivo: 500,
        devuelta_entregada: 150,
      })
    );

    const preCierre = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(preCierre.total_ventas).toBe(950);
    expect(preCierre.total_efectivo).toBe(950);
    expect(preCierre.monto_esperado).toBe(2450);

    const cierre = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: preCierre.monto_apertura,
      monto_esperado: preCierre.monto_esperado,
      monto_real: 2450,
      monto_diferencia: 0,
    });

    expect(cierre.id).toBe(sesion.id);
    expect(cierre.estado).toBe('cerrada');
    expect(cierre.total_ventas).toBe(950);
    expect(cierre.total_efectivo).toBe(950);
    expect(cierre.monto_esperado).toBe(2450);
    expect(cierre.monto_real).toBe(2450);
    expect(cierre.monto_diferencia).toBe(0);

    const historial = await obtenerRegistrosCierreCaja();
    expect(historial).toHaveLength(1);
    expect(historial[0].totalCash).toBe(950);
    expect(historial[0].expectedCash).toBe(2450);
    expect(historial[0].difference).toBe(0);
    expect(historial[0].isInconsistent).toBe(false);
  });

  // 2. Ventas con pagos mixtos
  it('2. Ventas con pagos mixtos sin duplicar importes ni contaminar el efectivo esperado', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1000,
    });

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        metodo_pago: 'mixto',
        monto_total: 2500,
        monto_pagado: 2700,
        monto_efectivo: 1500,
        monto_tarjeta: 700,
        monto_transferencia: 300,
        monto_credito: 200,
        devuelta_entregada: 200,
      })
    );

    const pre = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(pre.total_ventas).toBe(2500);
    expect(pre.total_efectivo).toBe(1300);
    expect(pre.total_tarjeta).toBe(700);
    expect(pre.total_transferencia).toBe(300);
    expect(pre.total_otros).toBe(200);
    expect(pre.monto_esperado).toBe(2300);

    const cerrada = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: pre.monto_esperado,
      monto_real: 2300,
      monto_diferencia: 0,
    });

    expect(cerrada.total_ventas).toBe(2500);
    expect(cerrada.total_efectivo).toBe(1300);
    expect(cerrada.total_tarjeta).toBe(700);
    expect(cerrada.total_transferencia).toBe(300);
    expect(cerrada.total_otros).toBe(200);
    expect(cerrada.monto_esperado).toBe(2300);
  });

  // 3. Ventas con tarjeta y transferencia
  it('3. Ventas con tarjeta y transferencia se muestran en ventas pero nunca inflan el efectivo esperado', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '2',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 2000,
    });

    await procesarVenta(
      makeSalePayload({
        caja_id: '2',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        metodo_pago: 'tarjeta',
        monto_total: 4200,
        monto_efectivo: 0,
        monto_tarjeta: 4200,
      })
    );
    await procesarVenta(
      makeSalePayload({
        caja_id: '2',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        metodo_pago: 'transferencia',
        monto_total: 1800,
        monto_efectivo: 0,
        monto_transferencia: 1800,
      })
    );

    const cerrada = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '2',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 2000,
      monto_esperado: 2000,
      monto_real: 2000,
      monto_diferencia: 0,
    });

    expect(cerrada.total_ventas).toBe(6000);
    expect(cerrada.total_efectivo).toBe(0);
    expect(cerrada.total_tarjeta).toBe(4200);
    expect(cerrada.total_transferencia).toBe(1800);
    expect(cerrada.monto_esperado).toBe(2000);
  });

  // 4. Ventas a crédito
  it('4. Ventas a crédito se reflejan en total_otros y total_ventas, sin alterar el efectivo esperado', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1200,
    });

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        metodo_pago: 'credito',
        monto_total: 3500,
        monto_pagado: 0,
        monto_efectivo: 0,
        monto_credito: 3500,
      })
    );
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        metodo_pago: 'efectivo',
        monto_total: 500,
        monto_pagado: 500,
        monto_efectivo: 500,
      })
    );

    const cerrada = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1200,
      monto_esperado: 1700,
      monto_real: 1700,
      monto_diferencia: 0,
    });

    expect(cerrada.total_ventas).toBe(4000);
    expect(cerrada.total_otros).toBe(3500);
    expect(cerrada.total_efectivo).toBe(500);
    expect(cerrada.monto_esperado).toBe(1700);
  });

  // 5. Dos cajeros en cajas distintas simultáneamente
  it('5. Dos cajeros en cajas distintas simultáneamente operan con total aislamiento', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesionLucia = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Lucía Fernández',
      monto_apertura: 1000,
    });
    const sesionCarlos = await iniciarCaja({
      caja_id: '2',
      caja_label: 'Caja #2',
      cajero_id: UUID_CAJERO_B,
      cajero_nombre: 'Carlos Ruiz',
      monto_apertura: 3000,
    });

    expect(sesionLucia.id).not.toBe(sesionCarlos.id);

    await expect(
      iniciarCaja({
        caja_id: '1',
        cajero_id: UUID_CAJERO_C,
        cajero_nombre: 'Pedro',
        monto_apertura: 500,
      })
    ).rejects.toThrow();

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesionLucia.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 900,
        monto_efectivo: 900,
      })
    );
    await procesarVenta(
      makeSalePayload({
        caja_id: '2',
        cierre_id: sesionCarlos.id,
        cajero_id: UUID_CAJERO_B,
        monto_total: 4500,
        monto_efectivo: 4500,
      })
    );
    await registrarMovimientoCaja({
      caja_id: '2',
      cierre_id: sesionCarlos.id,
      cajero_id: UUID_CAJERO_B,
      tipo: 'retiro',
      monto: 500,
      concepto: 'Retiro parcial Caja 2',
    });

    const cierreLucia = await cerrarTurnoCaja({
      cierre_id: sesionLucia.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: 1900,
      monto_real: 1900,
      monto_diferencia: 0,
    });

    expect(cierreLucia.total_ventas).toBe(900);
    expect(cierreLucia.monto_esperado).toBe(1900);

    const caja2TodaviaAbierta = await obtenerCajaAbierta('2');
    expect(caja2TodaviaAbierta?.id).toBe(sesionCarlos.id);
    expect(caja2TodaviaAbierta?.estado).toBe('abierta');

    const cierreCarlos = await cerrarTurnoCaja({
      cierre_id: sesionCarlos.id,
      caja_id: '2',
      cajero_id: UUID_CAJERO_B,
      monto_apertura: 3000,
      monto_esperado: 7000,
      monto_real: 7000,
      monto_diferencia: 0,
    });
    expect(cierreCarlos.total_ventas).toBe(4500);
    expect(cierreCarlos.total_retiros).toBe(500);
    expect(cierreCarlos.monto_esperado).toBe(7000);
  });

  // 6. Dos turnos consecutivos en la misma caja
  it('6. Dos turnos consecutivos en la misma caja mantienen cuentas estrictamente separadas sin arrastrar ventas previas', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const turno1 = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Turno Mañana',
      monto_apertura: 2000,
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: turno1.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 1200,
        monto_efectivo: 1200,
      })
    );
    await registrarMovimientoCaja({
      caja_id: '1',
      cierre_id: turno1.id,
      cajero_id: UUID_CAJERO_A,
      tipo: 'entrada',
      monto: 300,
      concepto: 'Cambio sencillo turno 1',
    });
    const cierre1 = await cerrarTurnoCaja({
      cierre_id: turno1.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 2000,
      monto_esperado: 3500,
      monto_real: 3500,
      monto_diferencia: 0,
    });
    expect(cierre1.monto_esperado).toBe(3500);

    const turno2 = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_B,
      cajero_nombre: 'Turno Tarde',
      monto_apertura: 1000,
    });
    expect(turno2.id).not.toBe(turno1.id);

    const resumenInicialT2 = await calcularResumenCajaAbierta('1', UUID_CAJERO_B, turno2.id);
    expect(resumenInicialT2.total_ventas).toBe(0);
    expect(resumenInicialT2.total_entradas).toBe(0);
    expect(resumenInicialT2.monto_esperado).toBe(1000);

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: turno2.id,
        cajero_id: UUID_CAJERO_B,
        monto_total: 400,
        monto_efectivo: 400,
      })
    );
    const cierre2 = await cerrarTurnoCaja({
      cierre_id: turno2.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_B,
      monto_apertura: 1000,
      monto_esperado: 1400,
      monto_real: 1400,
      monto_diferencia: 0,
    });

    expect(cierre2.total_ventas).toBe(400);
    expect(cierre2.total_entradas).toBe(0);
    expect(cierre2.monto_esperado).toBe(1400);

    const check1 = await obtenerCierrePorId(turno1.id);
    expect(check1?.total_ventas).toBe(1200);
    expect(check1?.monto_esperado).toBe(3500);
  });

  // 7. Un cajero que trabaja en más de una caja
  it('7. Un cajero trabajando en múltiples cajas conserva sesiones independientes sin cerrar ni cruzar importes', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesionC1 = await iniciarCaja({
      caja_id: '1',
      caja_label: 'Caja #1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'María Castro',
      monto_apertura: 1000,
    });
    const sesionC2 = await iniciarCaja({
      caja_id: '2',
      caja_label: 'Caja #2',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'María Castro',
      monto_apertura: 2500,
    });

    expect(sesionC1.id).not.toBe(sesionC2.id);
    expect((await obtenerCajaAbierta('1'))?.id).toBe(sesionC1.id);
    expect((await obtenerCajaAbierta('2'))?.id).toBe(sesionC2.id);

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesionC1.id,
        cajero_id: UUID_CAJERO_A,
        cajero_nombre: 'María Castro',
        monto_total: 700,
        monto_efectivo: 700,
      })
    );
    await procesarVenta(
      makeSalePayload({
        caja_id: '2',
        cierre_id: sesionC2.id,
        cajero_id: UUID_CAJERO_A,
        cajero_nombre: 'María Castro',
        monto_total: 1600,
        monto_efectivo: 1600,
      })
    );

    const resumenC2 = await calcularResumenCajaAbierta('2', UUID_CAJERO_A, sesionC2.id);
    expect(resumenC2.total_ventas).toBe(1600);
    expect(resumenC2.monto_esperado).toBe(4100);

    const cierreC2 = await cerrarTurnoCaja({
      cierre_id: sesionC2.id,
      caja_id: '2',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'María Castro',
      monto_apertura: 2500,
      monto_esperado: 4100,
      monto_real: 4100,
      monto_diferencia: 0,
    });
    expect(cierreC2.total_ventas).toBe(1600);
    expect(cierreC2.monto_esperado).toBe(4100);

    const resumenC1 = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesionC1.id);
    expect(resumenC1.cierre_id).toBe(sesionC1.id);
    expect(resumenC1.total_ventas).toBe(700);
    expect(resumenC1.monto_esperado).toBe(1700);
  });

  // 8. Entradas, retiros, gastos y devoluciones
  it('8. Entradas, retiros, gastos POS y devoluciones en efectivo se calculan exactamente una vez', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 5000,
    });

    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 2000,
        monto_efectivo: 2000,
      })
    );

    await registrarMovimientoCaja({
      caja_id: '1',
      cierre_id: sesion.id,
      cajero_id: UUID_CAJERO_A,
      tipo: 'entrada',
      monto: 500,
      concepto: 'Ingreso de menudo',
    });

    await crearGasto({
      categoria_id: 'cat-008',
      descripcion: 'Retiro a bóveda',
      monto: 300,
      metodo_pago: 'efectivo',
      caja_id: '1',
      cierre_id: sesion.id,
      omitirMovimientoCaja: true,
    });
    await registrarMovimientoCaja({
      caja_id: '1',
      cierre_id: sesion.id,
      cajero_id: UUID_CAJERO_A,
      tipo: 'retiro',
      monto: 300,
      concepto: 'Retiro a bóveda',
    });

    await crearGasto({
      categoria_id: 'cat-004',
      descripcion: 'Compra de agua botellón',
      monto: 450,
      metodo_pago: 'efectivo',
      caja_id: '1',
      cierre_id: sesion.id,
    });

    await crearGasto({
      categoria_id: 'cat-005',
      descripcion: 'Alquiler oficina central',
      monto: 9999,
      metodo_pago: 'efectivo',
      omitirMovimientoCaja: true,
    });

    await crearDevolucion({
      numero_factura: 'FAC-000001',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      caja_id: '1',
      cierre_id: sesion.id,
      monto_total: 250,
      motivo: 'Producto dañado',
      metodo_reembolso: 'efectivo',
      tipo: 'parcial',
      items: [
        {
          nombre_item: 'Producto X',
          cantidad: 1,
          precio_unitario: 250,
          subtotal: 250,
        },
      ],
    });

    const pre = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(pre.total_entradas).toBe(500);
    expect(pre.total_retiros).toBe(750);
    expect(pre.total_devoluciones).toBe(250);
    expect(pre.monto_esperado).toBe(6500);

    const cerrada = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 5000,
      monto_esperado: 6500,
      monto_real: 6490,
      monto_diferencia: -10,
    });
    expect(cerrada.total_entradas).toBe(500);
    expect(cerrada.total_retiros).toBe(750);
    expect(cerrada.total_devoluciones).toBe(250);
    expect(cerrada.monto_esperado).toBe(6500);
    expect(cerrada.monto_real).toBe(6490);
    expect(cerrada.monto_diferencia).toBe(-10);
  });

  // 9. Ventas anuladas
  it('9. Ventas anuladas se excluyen completamente de los totales y del efectivo esperado', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
    });

    const vValida = await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 800,
        monto_efectivo: 800,
      })
    );
    const vAnulada = await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 1500,
        monto_efectivo: 1500,
      })
    );

    await anularVenta(vAnulada.venta_id, 'Error de digitación');

    const resumen = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(resumen.total_ventas).toBe(800);
    expect(resumen.total_efectivo).toBe(800);
    expect(resumen.monto_esperado).toBe(1800);

    const cerrada = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: 1800,
      monto_real: 1800,
      monto_diferencia: 0,
    });
    expect(cerrada.total_ventas).toBe(800);
    expect(cerrada.monto_esperado).toBe(1800);
    expect(vValida.venta_id).toBeTruthy();
  });

  // 10. Sesiones sin ventas
  it('10. Sesiones sin ventas ni movimientos cierran con monto_esperado === monto_apertura', async () => {
    const sesionLocal = await iniciarCaja({
      caja_id: '3',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Cajero Local',
      monto_apertura: 3500,
    });
    const resLocal = await calcularResumenCajaAbierta('3', UUID_CAJERO_A, sesionLocal.id);
    expect(resLocal.total_ventas).toBe(0);
    expect(resLocal.monto_esperado).toBe(3500);

    const cierreLocal = await cerrarTurnoCaja({
      cierre_id: sesionLocal.id,
      caja_id: '3',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 3500,
      monto_esperado: 3500,
      monto_real: 3500,
      monto_diferencia: 0,
    });
    expect(cierreLocal.total_ventas).toBe(0);
    expect(cierreLocal.monto_esperado).toBe(3500);
    expect(cierreLocal.monto_diferencia).toBe(0);

    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);
    const sesionDb = await iniciarCaja({
      caja_id: '3',
      cajero_id: UUID_CAJERO_B,
      cajero_nombre: 'Cajero DB',
      monto_apertura: 4200,
    });
    const cierreDb = await cerrarTurnoCaja({
      cierre_id: sesionDb.id,
      caja_id: '3',
      cajero_id: UUID_CAJERO_B,
      monto_apertura: 4200,
      monto_esperado: 4200,
      monto_real: 4200,
      monto_diferencia: 0,
    });
    expect(cierreDb.total_ventas).toBe(0);
    expect(cierreDb.monto_esperado).toBe(4200);
    expect(cierreDb.monto_diferencia).toBe(0);
  });

  // 11. Cierres repetidos
  it('11. Cierres repetidos de la misma sesión son rechazados y no alteran el registro cerrado', async () => {
    const { client } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 500,
        monto_efectivo: 500,
      })
    );

    const primero = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: 1500,
      monto_real: 1500,
      monto_diferencia: 0,
    });

    await expect(
      cerrarTurnoCaja({
        cierre_id: sesion.id,
        caja_id: '1',
        cajero_id: UUID_CAJERO_A,
        monto_apertura: 1000,
        monto_esperado: 9999,
        monto_real: 9999,
        monto_diferencia: 0,
      })
    ).rejects.toThrow(/ya fue cerrada/i);

    const historial = await obtenerCierresCaja();
    expect(historial).toHaveLength(1);
    expect(historial[0].id).toBe(primero.id);
    expect(historial[0].monto_real).toBe(1500);
    expect(historial[0].monto_esperado).toBe(1500);
  });

  // 12. Registros locales y remotos duplicados
  it('12. Cuando Supabase está activo, no mezcla registros temporales/duplicados de localStorage en historial ni movimientos', async () => {
    const { client, db } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const fakeLocalClosure: CashClosure = {
      id: 'cc-temp-fantasma',
      code: 'CC-TEMP01',
      userId: UUID_CAJERO_A,
      userName: 'Fantasma',
      username: 'fantasma',
      cashRegisterId: '1',
      cashRegisterLabel: 'Caja #1',
      openedAt: '2026-01-01 08:00:00',
      closedAt: '2026-01-01 20:00:00',
      date: '2026-01-01',
      baseCash: 9999,
      totalCash: 8888,
      totalCard: 0,
      cardCount: 0,
      totalTransfer: 0,
      transferCount: 0,
      totalCheque: 0,
      chequeCount: 0,
      totalCredit: 0,
      creditCount: 0,
      totalSales: 8888,
      expectedCash: 18887,
      countedCash: 18887,
      difference: 0,
      status: 'cerrada',
    };
    saveCashClosure(fakeLocalClosure);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1000,
    });

    saveCashClosure({ ...fakeLocalClosure, id: sesion.id, status: 'abierta', baseCash: 1000 });
    saveLocalMovimientoCaja({
      id: 'mov-local-fantasma',
      codigo: 'MOV-999',
      caja_id: '1',
      cierre_id: sesion.id,
      cajero_id: UUID_CAJERO_A,
      tipo: 'entrada',
      monto: 7777,
      concepto: 'Basura local no sincronizada',
      categoria: null,
      creado_en: new Date().toISOString(),
    });
    saveLocalVentas([
      {
        id: 'vta-local-fantasma',
        numero_factura: 'FAC-LOC-1',
        ncf: null,
        tipo_ncf: null,
        sucursal_id: null,
        cajero_id: UUID_CAJERO_A,
        cliente_id: null,
        caja_id: '1',
        cierre_id: sesion.id,
        subtotal: 5555,
        monto_impuesto: 0,
        monto_descuento: 0,
        monto_total: 5555,
        costo_total: 0,
        metodo_pago: 'efectivo',
        monto_pagado: 5555,
        monto_efectivo: 5555,
        monto_tarjeta: 0,
        monto_transferencia: 0,
        monto_credito: 0,
        devuelta_entregada: 0,
        estado: 'completada',
        creado_en: new Date().toISOString(),
      },
    ]);

    await registrarMovimientoCaja({
      caja_id: '1',
      cierre_id: sesion.id,
      cajero_id: UUID_CAJERO_A,
      tipo: 'entrada',
      monto: 200,
      concepto: 'Ingreso real',
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 400,
        monto_efectivo: 400,
      })
    );

    const movs = await obtenerMovimientosCaja(sesion.id, '1');
    expect(movs).toHaveLength(1);
    expect(movs[0].monto).toBe(200);

    const resumen = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(resumen.total_ventas).toBe(400);
    expect(resumen.total_entradas).toBe(200);
    expect(resumen.monto_esperado).toBe(1600);

    const cerrado = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: 1600,
      monto_real: 1600,
      monto_diferencia: 0,
    });
    expect(cerrado.monto_esperado).toBe(1600);

    expect(getCashClosures().some((c) => c.id === sesion.id)).toBe(false);
    const historial = await obtenerRegistrosCierreCaja();
    expect(historial).toHaveLength(1);
    expect(historial[0].id).toBe(sesion.id);
    expect(db.cierres_caja).toHaveLength(1);
  });

  // 13. Más de 1,000 ventas en una sesión
  it('13. Más de 1,000 ventas (1,250 ventas paginadas) se calculan completas sin truncamiento', async () => {
    const { client, db } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1000,
    });

    const nowBase = Date.now();
    for (let i = 0; i < 1250; i++) {
      db.ventas.push({
        id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        numero_factura: `FAC-${String(i + 1).padStart(6, '0')}`,
        cajero_id: UUID_CAJERO_A,
        caja_id: '1',
        cierre_id: sesion.id,
        subtotal: 12.34,
        monto_impuesto: 0,
        monto_descuento: 0,
        monto_total: 12.34,
        costo_total: 7,
        metodo_pago: 'efectivo',
        monto_pagado: 12.34,
        monto_efectivo: 12.34,
        monto_tarjeta: 0,
        monto_transferencia: 0,
        monto_credito: 0,
        devuelta_entregada: 0,
        estado: 'completada',
        creado_en: new Date(nowBase + i).toISOString(),
      });
    }

    const totalExacto = r2(1250 * 12.34); // 15,425.00
    const esperadoExacto = r2(1000 + totalExacto); // 16,425.00

    const ventasPaginadas = await obtenerVentasTurno({
      cierreId: sesion.id,
      cajaId: '1',
      omitirDetalles: true,
      todasPaginas: true,
    });
    expect(ventasPaginadas).toHaveLength(1250);

    const resumen = await calcularResumenCajaAbierta('1', UUID_CAJERO_A, sesion.id);
    expect(resumen.total_ventas).toBe(totalExacto);
    expect(resumen.total_efectivo).toBe(totalExacto);
    expect(resumen.monto_esperado).toBe(esperadoExacto);

    const cerrado = await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: esperadoExacto,
      monto_real: esperadoExacto,
      monto_diferencia: 0,
    });
    expect(cerrado.total_ventas).toBe(totalExacto);
    expect(cerrado.monto_esperado).toBe(esperadoExacto);
  });

  // 14. Dos solicitudes simultáneas de cierre
  it('14. Dos solicitudes simultáneas de cierre (cliente y RPC concurrente) cierran atómicamente una sola vez', async () => {
    const { client, db } = createTransactionalSupabaseMock({ rpcCloseDelayMs: 25 });
    setSupabaseClientForTests(client);

    const sesionA = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesionA.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 600,
        monto_efectivo: 600,
      })
    );

    const [res1, res2] = await Promise.allSettled([
      cerrarTurnoCaja({
        cierre_id: sesionA.id,
        caja_id: '1',
        cajero_id: UUID_CAJERO_A,
        monto_apertura: 1000,
        monto_esperado: 1600,
        monto_real: 1600,
        monto_diferencia: 0,
      }),
      cerrarTurnoCaja({
        cierre_id: sesionA.id,
        caja_id: '1',
        cajero_id: UUID_CAJERO_A,
        monto_apertura: 1000,
        monto_esperado: 1600,
        monto_real: 1550,
        monto_diferencia: -50,
      }),
    ]);

    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(db.cierres_caja).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<any>).value.monto_real).toBe(1600);

    const sesionB = await iniciarCaja({
      caja_id: '2',
      cajero_id: UUID_CAJERO_B,
      monto_apertura: 2000,
    });
    const [rpcA, rpcB] = await Promise.all([
      client.rpc('cerrar_caja_transaccional', {
        p_cierre_id: sesionB.id,
        p_caja_id: '2',
        p_cajero_id: UUID_CAJERO_B,
        p_cajero_nombre: 'Cajero B',
        p_monto_real: 2000,
        p_notes: null,
      }),
      client.rpc('cerrar_caja_transaccional', {
        p_cierre_id: sesionB.id,
        p_caja_id: '2',
        p_cajero_id: UUID_CAJERO_B,
        p_cajero_nombre: 'Cajero B',
        p_monto_real: 9999,
        p_notes: null,
      }),
    ]);

    expect(rpcA.data.ok).toBe(true);
    expect(rpcB.data.ok).toBe(false);
    expect(rpcB.data.error).toMatch(/ya fue cerrada/i);
    expect((await obtenerCierrePorId(sesionB.id))?.monto_real).toBe(2000);
  });

  // 15. Consulta repetida del historial sin que cambie ningún importe + inconsistencia solo lectura
  it('15. Consultas repetidas del historial nunca alteran los importes cerrados y detectan inconsistencias sin recalcular', async () => {
    const { client, db } = createTransactionalSupabaseMock();
    setSupabaseClientForTests(client);

    const sesion = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Ana Gómez',
      monto_apertura: 1000,
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion.id,
        cajero_id: UUID_CAJERO_A,
        monto_total: 750,
        monto_efectivo: 750,
      })
    );
    await cerrarTurnoCaja({
      cierre_id: sesion.id,
      caja_id: '1',
      cajero_id: UUID_CAJERO_A,
      monto_apertura: 1000,
      monto_esperado: 1750,
      monto_real: 1750,
      monto_diferencia: 0,
    });

    const consulta1 = await obtenerRegistrosCierreCaja();
    const sesion2 = await iniciarCaja({
      caja_id: '1',
      cajero_id: UUID_CAJERO_B,
      cajero_nombre: 'Carlos',
      monto_apertura: 3000,
    });
    await procesarVenta(
      makeSalePayload({
        caja_id: '1',
        cierre_id: sesion2.id,
        cajero_id: UUID_CAJERO_B,
        monto_total: 5000,
        monto_efectivo: 5000,
      })
    );

    const consulta2 = await obtenerRegistrosCierreCaja();
    const consulta3 = await obtenerRegistrosCierreCaja();

    const hist1 = consulta1.find((c) => c.id === sesion.id)!;
    const hist2 = consulta2.find((c) => c.id === sesion.id)!;
    const hist3 = consulta3.find((c) => c.id === sesion.id)!;
    expect(hist2).toEqual(hist1);
    expect(hist3).toEqual(hist1);

    db.cierres_caja.push({
      id: '99999999-9999-4999-8999-999999999999',
      codigo: 'CC-CORRUPT',
      caja_id: '1',
      caja_label: 'Caja #1',
      cajero_id: UUID_CAJERO_A,
      cajero_nombre: 'Histórico Corrupto',
      abierta_en: '2025-12-01T08:00:00.000Z',
      cerrada_en: '2025-12-01T18:00:00.000Z',
      monto_apertura: 1000,
      total_ventas: 0,
      total_efectivo: 2500,
      total_tarjeta: 0,
      total_transferencia: 0,
      total_otros: 0,
      total_entradas: 0,
      total_retiros: 0,
      total_devoluciones: 0,
      monto_esperado: 9999,
      monto_real: 3500,
      monto_diferencia: 0,
      estado: 'cerrada',
    });

    const evalCorrupt = evaluarConsistenciaCierre(
      db.cierres_caja[db.cierres_caja.length - 1] as any
    );
    expect(evalCorrupt.isInconsistent).toBe(true);
    expect(evalCorrupt.reasons.length).toBeGreaterThanOrEqual(2);

    const historialConCorrupto = await obtenerRegistrosCierreCaja();
    const corruptUi = historialConCorrupto.find(
      (c) => c.id === '99999999-9999-4999-8999-999999999999'
    )!;
    expect(corruptUi.isInconsistent).toBe(true);
    expect(corruptUi.inconsistencyReasons?.length).toBeGreaterThanOrEqual(2);
    expect(corruptUi.totalSales).toBe(0);
    expect(corruptUi.totalCash).toBe(2500);
    expect(corruptUi.expectedCash).toBe(9999);
    expect(corruptUi.countedCash).toBe(3500);
    expect(corruptUi.difference).toBe(0);
  });
});
