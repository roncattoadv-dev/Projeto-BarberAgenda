// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { setAccessToken } from '../lib/supabase';

export type Role = 'super_admin' | 'tenant_admin' | 'tenant_professional' | 'customer';

export interface Profile {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: Role;
  phone?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
  google_linked?: boolean;
  user_metadata: { name: string; role: Role; tenant_id: string | null; phone: string | null };
}

export interface AuthSession {
  access_token: string;
}

interface AuthCtx {
  session:         AuthSession | null;
  user:            AuthUser   | null;
  profile:         Profile | null;
  loading:         boolean;
  needsOnboarding: boolean;
  signIn:          (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => void;
  signOut:         () => Promise<void>;
  resetPassword:   (email: string) => Promise<{ error: string | null }>;
  updatePassword:  (newPassword: string, currentPassword?: string) => Promise<{ error: string | null }>;
  refreshSession:  () => Promise<void>;
  completeSession: (accessToken: string, user: AuthUser) => void;
  isSuper:         boolean;
  isAdmin:         boolean;
  tenantId:        string | null;
}

const Ctx = createContext<AuthCtx | null>(null);

function getApiUrl(): string {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}
const API_URL = getApiUrl();

// ── Extrai profile do user (user_metadata) — zero chamadas de rede ─────────────
function profileFromUser(user: AuthUser): Profile | null {
  const m = user.user_metadata ?? ({} as AuthUser['user_metadata']);
  if (!m.role) return null;
  return {
    id:        user.id,
    tenant_id: m.tenant_id ?? null,
    name:      m.name ?? user.email ?? '',
    email:     user.email ?? '',
    role:      m.role,
    phone:     m.phone ?? undefined,
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

/** Lê o campo "exp" do JWT sem verificar assinatura — só pra agendar o próximo refresh */
function decodeExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(readCache);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyProfile(p: Profile | null) {
    writeCache(p);
    setProfile(p);
  }

  function clearSession() {
    setAccessToken(null);
    setSession(null);
    setUser(null);
    applyProfile(null);
    if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; }
  }

  function applySession(accessToken: string, authUser: AuthUser) {
    setAccessToken(accessToken);
    setSession({ access_token: accessToken });
    setUser(authUser);
    applyProfile(profileFromUser(authUser));

    const exp = decodeExpiry(accessToken);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (exp) {
      const msUntilRefresh = Math.max((exp * 1000 - Date.now()) - 60_000, 5_000); // 1min antes de expirar
      refreshTimer.current = setTimeout(() => { silentRefresh(); }, msUntilRefresh);
    }
  }

  async function silentRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { clearSession(); return false; }
      const data = await res.json();
      applySession(data.access_token, data.user);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    silentRefresh().finally(() => setLoading(false));
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error ?? 'Erro ao entrar.' };
      applySession(data.access_token, data.user);
      return { error: null };
    } catch {
      return { error: 'Erro de conexão.' };
    }
  };

  const signInWithGoogle = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const signOut = async () => {
    try { await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }); } catch {}
    clearSession();
  };

  const resetPassword = async (email: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      return { error: res.ok ? null : (data.error ?? 'Erro ao solicitar redefinição.') };
    } catch {
      return { error: 'Erro de conexão.' };
    }
  };

  const updatePassword = async (newPassword: string, currentPassword?: string) => {
    if (!session) return { error: 'Sessão expirada.' };
    try {
      const res = await fetch(`${API_URL}/api/auth/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ newPassword, currentPassword }),
      });
      const data = await res.json();
      return { error: res.ok ? null : (data.error ?? 'Erro ao trocar senha.') };
    } catch {
      return { error: 'Erro de conexão.' };
    }
  };

  // Usuário autenticado mas sem barbearia associada (inclui role='customer' do onboarding do Google)
  const needsOnboarding = !loading && session !== null
    && !profile?.tenant_id
    && profile?.role !== 'super_admin';

  const value: AuthCtx = {
    session, user, profile, loading,
    needsOnboarding,
    signIn, signInWithGoogle, signOut, resetPassword, updatePassword,
    refreshSession: async () => { await silentRefresh(); },
    completeSession: applySession,
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
