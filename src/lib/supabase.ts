// src/lib/supabase.ts
// Lê URL e key do window.__BARBER_CONFIG__ (runtime/EasyPanel) ou import.meta.env (dev local)
import { createClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return {
    url:    w.SUPABASE_URL    || import.meta.env.VITE_SUPABASE_URL    || '',
    anonKey: w.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

const { url, anonKey } = getSupabaseConfig();

if (!url || !anonKey) {
  console.warn('[Supabase] SUPABASE_URL ou SUPABASE_ANON_KEY não configurados.');
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'placeholder', {
  db: { schema: 'barber' },
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
  },
});
