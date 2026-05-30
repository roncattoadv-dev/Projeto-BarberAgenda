// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Role = 'super_admin' | 'tenant_admin' | 'tenant_professional' | 'customer';

export interface Profile {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: Role;
  phone?: string;
}

interface AuthCtx {
  session:   Session | null;
  user:      User    | null;
  profile:   Profile | null;
  loading:   boolean;
  signIn:    (email: string, password: string) => Promise<{ error: string | null }>;
  signOut:   () => Promise<void>;
  isSuper:   boolean;
  isAdmin:   boolean;
  tenantId:  string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.error('[Auth] fetchProfile:', error.message); return null; }
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id).then(setProfile);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const value: AuthCtx = {
    session, user: session?.user ?? null, profile, loading,
    signIn, signOut,
    isSuper:  profile?.role === 'super_admin',
    isAdmin:  profile?.role === 'tenant_admin',
    tenantId: profile?.tenant_id ?? null,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
