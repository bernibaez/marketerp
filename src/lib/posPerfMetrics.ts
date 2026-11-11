/**
 * Instrumentación ligera de rendimiento para el Terminal POS (Fase 4).
 * Utiliza Performance API estándar cuando está disponible y expone métricas
 * en `window.__MERCATO_POS_PERF__` para inspección en Chrome DevTools.
 */

export interface TimingMetricSummary {
  count: number;
  lastMs: number;
  avgMs: number;
  maxMs: number;
  samplesMs: number[];
  targetMs: number;
}

export interface PosPerfSnapshot {
  posOpen: {
    startedAtMs: number | null;
    durationMs: number | null;
    cacheHit: boolean;
    catalogCount: number;
    targetMs: number;
  };
  codeSearch: TimingMetricSummary & {
    cacheHits: number;
    remoteFallbacks: number;
  };
  nameSearch: TimingMetricSummary & {
    remoteFallbacks: number;
    lastResultCount: number;
  };
  addToCart: TimingMetricSummary;
  updateQty: TimingMetricSummary;
  postSaleReady: {
    count: number;
    lastMs: number;
    avgMs: number;
    maxMs: number;
    samplesMs: number[];
    lastDeltaCount: number;
    fullCatalogReloadsSkipped: number;
    fullRegisterReloadsSkipped: number;
  };
  requests: {
    supabase: Record<string, number>;
    cacheHits: Record<string, number>;
    totalSupabaseRequests: number;
    totalCacheHits: number;
  };
  memory: {
    usedJSHeapMB: number | null;
    totalJSHeapMB: number | null;
  };
}

const MAX_SAMPLES = 30;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function safeMark(name: string): void {
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(name);
    }
  } catch {
    // Ignorar en entornos sin Performance Timeline completo
  }
}

function safeMeasure(name: string, startMark: string, endMark: string): void {
  try {
    if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
      performance.measure(name, startMark, endMark);
    }
  } catch {
    // Ignorar si falta la marca inicial
  }
}

function createTimingSummary(targetMs: number): TimingMetricSummary {
  return {
    count: 0,
    lastMs: 0,
    avgMs: 0,
    maxMs: 0,
    samplesMs: [],
    targetMs,
  };
}

function pushSample(
  bucket: { count: number; lastMs: number; avgMs: number; maxMs: number; samplesMs: number[] },
  durationMs: number
): void {
  const clean = Math.max(0, Math.round(durationMs * 100) / 100);
  const prevTotal = bucket.avgMs * bucket.count;
  bucket.count += 1;
  bucket.lastMs = clean;
  bucket.avgMs = Math.round(((prevTotal + clean) / bucket.count) * 100) / 100;
  if (clean > bucket.maxMs) bucket.maxMs = clean;
  bucket.samplesMs.push(clean);
  if (bucket.samplesMs.length > MAX_SAMPLES) {
    bucket.samplesMs.shift();
  }
}

function readMemoryUsage(): { usedJSHeapMB: number | null; totalJSHeapMB: number | null } {
  const mem = typeof performance !== 'undefined' ? (performance as any).memory : undefined;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') {
    return { usedJSHeapMB: null, totalJSHeapMB: null };
  }
  const toMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100;
  return {
    usedJSHeapMB: toMB(mem.usedJSHeapSize),
    totalJSHeapMB: typeof mem.totalJSHeapSize === 'number' ? toMB(mem.totalJSHeapSize) : null,
  };
}

function createInitialState(): PosPerfSnapshot {
  return {
    posOpen: {
      startedAtMs: null,
      durationMs: null,
      cacheHit: false,
      catalogCount: 0,
      targetMs: 2000,
    },
    codeSearch: {
      ...createTimingSummary(200),
      cacheHits: 0,
      remoteFallbacks: 0,
    },
    nameSearch: {
      ...createTimingSummary(300),
      remoteFallbacks: 0,
      lastResultCount: 0,
    },
    addToCart: createTimingSummary(100),
    updateQty: createTimingSummary(100),
    postSaleReady: {
      count: 0,
      lastMs: 0,
      avgMs: 0,
      maxMs: 0,
      samplesMs: [],
      lastDeltaCount: 0,
      fullCatalogReloadsSkipped: 0,
      fullRegisterReloadsSkipped: 0,
    },
    requests: {
      supabase: {},
      cacheHits: {},
      totalSupabaseRequests: 0,
      totalCacheHits: 0,
    },
    memory: {
      usedJSHeapMB: null,
      totalJSHeapMB: null,
    },
  };
}

let state: PosPerfSnapshot = createInitialState();

export function posPerfNow(): number {
  return nowMs();
}

export function markPosOpenStart(): number {
  const t = nowMs();
  if (state.posOpen.startedAtMs === null) {
    state.posOpen.startedAtMs = t;
    safeMark('mercato:pos:open:start');
  }
  return t;
}

export function markPosOpenReady(info: { catalogCount: number; cacheHit: boolean }): number | null {
  const end = nowMs();
  if (state.posOpen.durationMs !== null) {
    state.posOpen.catalogCount = info.catalogCount;
    return state.posOpen.durationMs;
  }
  const start = state.posOpen.startedAtMs ?? end;
  const duration = Math.max(0, Math.round((end - start) * 100) / 100);
  state.posOpen.durationMs = duration;
  state.posOpen.cacheHit = info.cacheHit;
  state.posOpen.catalogCount = info.catalogCount;
  safeMark('mercato:pos:open:ready');
  safeMeasure('mercato:pos:open', 'mercato:pos:open:start', 'mercato:pos:open:ready');
  return duration;
}

export function recordCodeSearch(
  durationMs: number,
  opts?: { cacheHit?: boolean; remoteFallback?: boolean }
): void {
  pushSample(state.codeSearch, durationMs);
  if (opts?.cacheHit) state.codeSearch.cacheHits += 1;
  if (opts?.remoteFallback) state.codeSearch.remoteFallbacks += 1;
}

export function recordNameSearch(
  durationMs: number,
  opts?: { resultCount?: number; remoteFallback?: boolean }
): void {
  pushSample(state.nameSearch, durationMs);
  if (typeof opts?.resultCount === 'number') state.nameSearch.lastResultCount = opts.resultCount;
  if (opts?.remoteFallback) state.nameSearch.remoteFallbacks += 1;
}

export function recordAddToCart(durationMs: number): void {
  pushSample(state.addToCart, durationMs);
}

export function recordUpdateQty(durationMs: number): void {
  pushSample(state.updateQty, durationMs);
}

export function recordPostSaleReady(
  durationMs: number,
  opts?: { deltaCount?: number; skippedFullCatalogReload?: boolean; skippedFullRegisterReload?: boolean }
): void {
  safeMark('mercato:pos:sale:ready');
  pushSample(state.postSaleReady, durationMs);
  state.postSaleReady.lastDeltaCount = opts?.deltaCount ?? 0;
  if (opts?.skippedFullCatalogReload !== false) {
    state.postSaleReady.fullCatalogReloadsSkipped += 1;
  }
  if (opts?.skippedFullRegisterReload !== false) {
    state.postSaleReady.fullRegisterReloadsSkipped += 1;
  }
}

export function trackPosNetworkRequest(kind: string): void {
  state.requests.supabase[kind] = (state.requests.supabase[kind] ?? 0) + 1;
  state.requests.totalSupabaseRequests += 1;
}

export function trackPosCacheHit(kind: string): void {
  state.requests.cacheHits[kind] = (state.requests.cacheHits[kind] ?? 0) + 1;
  state.requests.totalCacheHits += 1;
}

export function getPosPerfSnapshot(): PosPerfSnapshot {
  const mem = readMemoryUsage();
  return {
    ...state,
    posOpen: { ...state.posOpen },
    codeSearch: { ...state.codeSearch, samplesMs: [...state.codeSearch.samplesMs] },
    nameSearch: { ...state.nameSearch, samplesMs: [...state.nameSearch.samplesMs] },
    addToCart: { ...state.addToCart, samplesMs: [...state.addToCart.samplesMs] },
    updateQty: { ...state.updateQty, samplesMs: [...state.updateQty.samplesMs] },
    postSaleReady: { ...state.postSaleReady, samplesMs: [...state.postSaleReady.samplesMs] },
    requests: {
      supabase: { ...state.requests.supabase },
      cacheHits: { ...state.requests.cacheHits },
      totalSupabaseRequests: state.requests.totalSupabaseRequests,
      totalCacheHits: state.requests.totalCacheHits,
    },
    memory: mem,
  };
}

export function resetPosPerfMetrics(): void {
  state = createInitialState();
}

export function formatPosPerfReport(): Array<{
  Operacion: string;
  UltimaMs: number | string;
  PromedioMs: number | string;
  Objetivo: string;
  Cumple: string;
}> {
  const s = getPosPerfSnapshot();
  return [
    {
      Operacion: 'Abrir POS',
      UltimaMs: s.posOpen.durationMs ?? '-',
      PromedioMs: s.posOpen.durationMs ?? '-',
      Objetivo: `< ${s.posOpen.targetMs} ms`,
      Cumple: s.posOpen.durationMs === null ? 'Pendiente' : s.posOpen.durationMs <= s.posOpen.targetMs ? 'OK' : 'Excede',
    },
    {
      Operacion: 'Buscar por código',
      UltimaMs: s.codeSearch.count ? s.codeSearch.lastMs : '-',
      PromedioMs: s.codeSearch.count ? s.codeSearch.avgMs : '-',
      Objetivo: `< ${s.codeSearch.targetMs} ms`,
      Cumple: s.codeSearch.count === 0 ? 'Sin muestras' : s.codeSearch.avgMs <= s.codeSearch.targetMs ? 'OK' : 'Excede',
    },
    {
      Operacion: 'Buscar por nombre',
      UltimaMs: s.nameSearch.count ? s.nameSearch.lastMs : '-',
      PromedioMs: s.nameSearch.count ? s.nameSearch.avgMs : '-',
      Objetivo: `< ${s.nameSearch.targetMs} ms`,
      Cumple: s.nameSearch.count === 0 ? 'Sin muestras' : s.nameSearch.avgMs <= s.nameSearch.targetMs ? 'OK' : 'Excede',
    },
    {
      Operacion: 'Agregar al carrito',
      UltimaMs: s.addToCart.count ? s.addToCart.lastMs : '-',
      PromedioMs: s.addToCart.count ? s.addToCart.avgMs : '-',
      Objetivo: `< ${s.addToCart.targetMs} ms`,
      Cumple: s.addToCart.count === 0 ? 'Sin muestras' : s.addToCart.avgMs <= s.addToCart.targetMs ? 'OK' : 'Excede',
    },
    {
      Operacion: 'Actualizar cantidades',
      UltimaMs: s.updateQty.count ? s.updateQty.lastMs : '-',
      PromedioMs: s.updateQty.count ? s.updateQty.avgMs : '-',
      Objetivo: `< ${s.updateQty.targetMs} ms`,
      Cumple: s.updateQty.count === 0 ? 'Sin muestras' : s.updateQty.avgMs <= s.updateQty.targetMs ? 'OK' : 'Excede',
    },
    {
      Operacion: 'Post-venta (sin recarga)',
      UltimaMs: s.postSaleReady.count ? s.postSaleReady.lastMs : '-',
      PromedioMs: s.postSaleReady.count ? s.postSaleReady.avgMs : '-',
      Objetivo: `0 recargas catálogo`,
      Cumple: s.postSaleReady.count === 0 ? 'Sin muestras' : `OK (${s.postSaleReady.fullCatalogReloadsSkipped} omitidas)`,
    },
  ];
}

if (typeof window !== 'undefined') {
  (window as any).__MERCATO_POS_PERF__ = {
    getSnapshot: getPosPerfSnapshot,
    reset: resetPosPerfMetrics,
    getReport: formatPosPerfReport,
    logReport: () => {
      const snap = getPosPerfSnapshot();
      console.table(formatPosPerfReport());
      console.info('[Mercato POS Perf]', {
        requests: snap.requests,
        memory: snap.memory,
        catalogCount: snap.posOpen.catalogCount,
      });
      return snap;
    },
  };
}

