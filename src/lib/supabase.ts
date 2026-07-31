// src/lib/supabase.ts
// Lê URL da API e do PostgREST do window.__BARBER_CONFIG__ (runtime/EasyPanel)
// ou import.meta.env (dev local). Usa @supabase/postgrest-js puro (não
// @supabase/supabase-js) — não há mais GoTrue/Kong, e supabase-js prefixa
// /rest/v1/ nas chamadas (convenção do Supabase hospedado), o que quebraria
// contra o PostgREST direto. O token de auth é injetado a cada request via
// um fetch customizado, atualizado pelo AuthContext (setAccessToken).
import { PostgrestClient } from '@supabase/postgrest-js';

function getConfig() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return {
    url: w.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '',
  };
}

const { url } = getConfig();

if (!url) {
  console.warn('[Supabase] SUPABASE_URL não configurado.');
}

let currentAccessToken: string | null = null;

/** Chamado pelo AuthContext a cada login/refresh/logout */
export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

// Sem token → sem header Authorization → PostgREST cai na role "anon"
// (PGRST_DB_ANON_ROLE) sozinho. Não existe mais um "anon key" fixo pra
// mandar — isso era a JWT anônima que o GoTrue/Supabase hospedado emitia.
const authenticatedFetch: typeof fetch = (input, init) => {
  if (!currentAccessToken) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${currentAccessToken}`);
  return fetch(input, { ...init, headers });
};

export const supabase = new PostgrestClient(url || 'http://localhost', {
  schema: 'barber',
  fetch: authenticatedFetch,
});
