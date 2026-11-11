import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredUser, storeUser, type AuthUser } from '@/lib/auth';
import {
  clearPermissionsCache,
  loadPermissionsMatrix,
} from '@/lib/permissionsStore';
import {
  cerrarSesion,
  iniciarSesion,
  iniciarSesionConCodigo,
  obtenerSesionActual,
} from '@/services/auth.service';
import { isSupabaseConfigured, tryGetSupabase } from '@/services/clienteSupabase';

type AuthSuccess = { ok: true; user: AuthUser };
type AuthFailure = { ok: false; error: string };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthSuccess | AuthFailure>;
  loginWithCode: (code: string) => Promise<AuthSuccess | AuthFailure>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }
      try {
        const sessionUser = await obtenerSesionActual();
        try {
          await loadPermissionsMatrix(true);
        } catch (permErr) {
          console.warn('[auth] Permisos no cargados:', permErr);
        }
        if (!cancelled) {
          if (sessionUser) {
            setUser(sessionUser);
            storeUser(sessionUser);
          } else {
            // Si Supabase no devolvió usuario (por ejemplo desconexión momentánea),
            // verificar si tenemos un usuario válido en almacenamiento local antes de limpiar
            const localUser = getStoredUser();
            if (localUser) {
              setUser(localUser);
            } else {
              setUser(null);
              storeUser(null);
            }
          }
        }
      } catch (err) {
        console.warn('[auth] Excepción en hidratación de sesión:', err);
        if (!cancelled) {
          const localUser = getStoredUser();
          if (localUser) {
            setUser(localUser);
          } else {
            setUser(null);
            storeUser(null);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrate();

    const sb = tryGetSupabase();
    if (!sb) return;

    const { data: sub } = sb.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        storeUser(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        try {
          const sessionUser = await obtenerSesionActual();
          if (sessionUser) {
            setUser(sessionUser);
            storeUser(sessionUser);
          }
        } catch (err) {
          console.warn('[auth] Error en actualización silenciosa de token, preservando sesión activa:', err);
        }
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await iniciarSesion(username, password);
    if (!result.ok) return result;
    try {
      await loadPermissionsMatrix(true);
    } catch {
      /* permisos opcionales al login */
    }
    storeUser(result.user);
    setUser(result.user);
    return { ok: true as const, user: result.user };
  }, []);

  const loginWithCode = useCallback(async (code: string) => {
    const result = await iniciarSesionConCodigo(code);
    if (!result.ok) return result;
    try {
      await loadPermissionsMatrix(true);
    } catch {
      /* permisos opcionales al login */
    }
    storeUser(result.user);
    setUser(result.user);
    return { ok: true as const, user: result.user };
  }, []);

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem('mercato_cash_opened_at_login');
      sessionStorage.removeItem('mercato_pending_cash_open');
    } catch {
      /* ignore */
    }
    await cerrarSesion();
    clearPermissionsCache();
    storeUser(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithCode,
      logout,
    }),
    [user, isLoading, login, loginWithCode, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
