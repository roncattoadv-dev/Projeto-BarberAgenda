#!/bin/sh
# ============================================================
# docker-entrypoint.sh — injeta variáveis em runtime no app React
# O SUPABASE_URL aponta para o Kong interno (não para o host)
# ============================================================
CONFIG_FILE="/usr/share/nginx/html/config.js"

# BUG-FIX 7: SUPABASE_URL usa o Kong interno por padrão.
# O cliente JS do Supabase roda no BROWSER do usuário —
# portanto precisa da URL PÚBLICA (acessível de fora da rede Docker).
# SUPABASE_URL deve ser a URL pública do Kong (via domínio do EasyPanel),
# não http://supabase-kong:8000 (que só funciona dentro da rede Docker).
# Configure SUPABASE_URL com a URL pública nas env vars do EasyPanel.
SUPABASE_URL_RESOLVED="${SUPABASE_URL:-}"

cat > "$CONFIG_FILE" << JSEOF
window.__BARBER_CONFIG__ = {
  SUPABASE_URL:      "${SUPABASE_URL_RESOLVED}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  EVO_URL:           "${EVO_URL:-}",
  EVO_INSTANCE:      "${EVO_INSTANCE:-barberflow}",
  EVO_APIKEY:        "${EVO_APIKEY:-}",
  EVO_GLOBAL_KEY:    "${EVO_GLOBAL_KEY:-}",
  API_URL:           "${API_URL:-}",
  SITE_URL:          "${SITE_URL:-}",
};
JSEOF

echo "[entrypoint] config.js gerado"
echo "[entrypoint] SUPABASE_URL=${SUPABASE_URL_RESOLVED:-NÃO CONFIGURADO}"
echo "[entrypoint] EVO_INSTANCE=${EVO_INSTANCE:-barberflow}"

exec nginx -g "daemon off;"
