#!/bin/sh
# ============================================================
# docker-entrypoint.sh — injeta variáveis de ambiente em runtime
# Executado pelo Nginx antes de servir os arquivos estáticos.
# ============================================================

CONFIG_FILE="/usr/share/nginx/html/config.js"

cat > "$CONFIG_FILE" << JSEOF
// Runtime config gerado automaticamente em $(date -u)
window.__BARBER_CONFIG__ = {
  EVO_URL:      "${EVO_URL:-}",
  EVO_INSTANCE: "${EVO_INSTANCE:-barberflow}",
  EVO_APIKEY:   "${EVO_APIKEY:-}",
};
JSEOF

echo "[entrypoint] config.js gerado com EVO_INSTANCE=${EVO_INSTANCE:-barberflow}"

exec nginx -g "daemon off;"
