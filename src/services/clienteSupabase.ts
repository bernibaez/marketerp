import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** True cuando hay URL y anon key configuradas (no placeholders). */
export function isSupabaseConfigured(): boolean {
  if (!url || !anonKey) return false;
  if (url.includes('YOUR_PROJECT') || anonKey.includes('YOUR_SUPABASE')) return false;
  return url.startsWith('http') && anonKey.length > 20;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as Record<string, unknown>).__MERCATO_REAL_IS_SUPABASE_CONFIGURED__ =
    isSupabaseConfigured;
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase no configurado. Copia .env.example a .env y pega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
    );
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/** Cliente opcional: null si no hay env (permite fallback demo local). */
export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}
