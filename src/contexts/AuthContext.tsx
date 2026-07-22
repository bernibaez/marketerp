'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'cajero' | 'vendedor' | 'almacenista' | 'contador' | 'supervisor';
  phone?: string;
  is_active: boolean;
  branch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  profile: UserProfile | null;
  permissions: RolePermission[];
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  hasPermission: (module: string, action: 'view' | 'create' | 'edit' | 'delete' | 'export') => boolean;
  isAdmin: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const supabase = createClient();

  const loadProfileAndPermissions = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) return;
      setProfile(profileData as UserProfile);

      // Load permissions for the user's role
      const { data: permsData } = await supabase
        .from('role_permissions')
        .select('module, can_view, can_create, can_edit, can_delete, can_export, roles!inner(name)')
        .eq('roles.name', profileData.role);

      if (permsData) {
        setPermissions(
          permsData.map((p: any) => ({
            module: p.module,
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_export: p.can_export,
          }))
        );
      }
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileAndPermissions(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileAndPermissions(session.user.id);
      } else {
        setProfile(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: any = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
          role: metadata?.role || 'cajero',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setPermissions([]);
  };

  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => user?.email_confirmed_at !== null;

  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data as UserProfile;
  };

  const refreshProfile = async () => {
    if (user) await loadProfileAndPermissions(user.id);
  };

  const hasPermission = (
    module: string,
    action: 'view' | 'create' | 'edit' | 'delete' | 'export'
  ): boolean => {
    if (profile?.role === 'admin') return true;
    const perm = permissions.find((p) => p.module === module);
    if (!perm) return false;
    const map: Record<string, keyof RolePermission> = {
      view: 'can_view',
      create: 'can_create',
      edit: 'can_edit',
      delete: 'can_delete',
      export: 'can_export',
    };
    return perm[map[action]] as boolean;
  };

  const isAdmin = () => profile?.role === 'admin';

  const value: AuthContextType = {
    user,
    session,
    loading,
    profile,
    permissions,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    hasPermission,
    isAdmin,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
