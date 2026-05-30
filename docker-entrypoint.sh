#!/bin/sh
CONFIG_FILE="/usr/share/nginx/html/config.js"

cat > "$CONFIG_FILE" << JSEOF
window.__BARBER_CONFIG__ = {
  EVO_URL:          "${EVO_URL:-}",
  EVO_INSTANCE:     "${EVO_INSTANCE:-barberflow}",
  EVO_APIKEY:       "${EVO_APIKEY:-}",
  SUPABASE_URL:     "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY:"${SUPABASE_ANON_KEY:-}",
};
JSEOF

echo "[entrypoint] config.js gerado — SUPABASE_URL=${SUPABASE_URL:-não configurado}"
exec nginx -g "daemon off;"
