import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, tryGetSupabase } from './clienteSupabase';

let testSupabaseClient: SupabaseClient | null = null;

function isTestRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    Boolean(
      process.env.VITEST ||
        process.env.NODE_ENV === 'test' ||
        process.env.JEST_WORKER_ID
    )
  );
}

/**
 * Permite inyectar un cliente mock de Supabase en pruebas automatizadas
 * sin depender de mocks globales de '@/services/clienteSupabase'.
 */
export function setSupabaseClientForTests(mockClient: SupabaseClient | null): void {
  testSupabaseClient = mockClient;
}

function isBaseModuleMocked(): boolean {
  const realFn =
    typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, unknown>).__MERCATO_REAL_IS_SUPABASE_CONFIGURED__
      : undefined;
  return isSupabaseConfigured !== realFn;
}

/**
 * En entorno real delega en clienteSupabase.
 * En tests, si un test mockeó '@/services/clienteSupabase', respeta ese mock;
 * en caso contrario solo activa Supabase cuando se inyectó setSupabaseClientForTests().
 */
export function isSafeSupabaseConfigured(): boolean {
  if (isTestRuntime()) {
    if (testSupabaseClient !== null) return true;
    if (isBaseModuleMocked()) {
      return Boolean(isSupabaseConfigured());
    }
    return false;
  }
  return Boolean(isSupabaseConfigured());
}

export function getSafeSupabaseClient(): SupabaseClient | null {
  if (isTestRuntime()) {
    if (testSupabaseClient !== null) return testSupabaseClient;
    if (isBaseModuleMocked()) {
      return tryGetSupabase() ?? null;
    }
    return null;
  }
  return tryGetSupabase() ?? null;
}
