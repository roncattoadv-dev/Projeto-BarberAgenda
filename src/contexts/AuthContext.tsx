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
  session:         Session | null;
  user:            User    | null;
  profile:         Profile | null;
  loading:         boolean;
  needsOnboarding: boolean;
  signIn:          (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut:         () => Promise<void>;
  resetPassword:   (email: string) => Promise<{ error: string | null }>;
  updatePassword:  (password: string) => Promise<{ error: string | null }>;
  isSuper:         boolean;
  isAdmin:         boolean;
  tenantId:        string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

// ── Extrai profile do JWT (user_metadata) — zero chamadas de rede ──────────────
function profileFromUser(user: User): Profile | null {
  const m = user.user_metadata ?? {};
  if (!m.role) return null;
  return {
    id:        user.id,
    tenant_id: m.tenant_id ?? null,
    name:      m.name ?? user.email ?? '',
    email:     user.email ?? '',
    role:      m.role as Role,
    phone:     m.phone,
  };
}

// ── Cache no localStorage como fallback ────────────────────────────────────────
const CACHE_KEY = 'bf_profile_v1';

function readCache(): Profile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch { return null; }
}

function writeCache(p: Profile | null) {
  try {
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    else    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Inicia com cache — evita spinner em reloads
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(readCache);
  const [loading, setLoading]  = useState(true);

  function applyProfile(p: Profile | null) {
    writeCache(p);
    setProfile(p);
  }

  useEffect(() => {
    let done = false;

    const finish = () => { if (!done) { done = true; setLoading(false); } };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);

      if (sess?.user) {
        const p = profileFromUser(sess.user);
        applyProfile(p);
        finish();

        // Verifica se o usuário ainda existe no servidor (detecta sessões de contas deletadas)
        supabase.auth.getUser().then(({ error }) => {
          if (error?.status === 403 || error?.message?.includes('does not exist')) {
            supabase.auth.signOut();
            applyProfile(null);
          }
        });
      } else {
        applyProfile(null);
        finish();
      }
    });

    // Fallsafe: se onAuthStateChange não disparar em 3s, libera
    const t = setTimeout(finish, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
    });
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    // Se o servidor rejeitar (ex: usuário já deletado), limpa apenas a sessão local
    if (error) await supabase.auth.signOut({ scope: 'local' });
    applyProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  // Usuário autenticado mas sem barbearia associada (inclui role='customer' criado pelo trigger)
  const needsOnboarding = !loading && session !== null
    && !profile?.tenant_id
    && profile?.role !== 'super_admin';

  const value: AuthCtx = {
    session, user: session?.user ?? null, profile, loading,
    needsOnboarding,
    signIn, signInWithGoogle, signOut, resetPassword, updatePassword,
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
