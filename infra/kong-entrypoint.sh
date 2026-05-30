#!/bin/sh
# Substitui as variáveis no kong.yml.template e inicia o Kong
set -e

if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "[kong-init] ERRO: SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são obrigatórios"
  exit 1
fi

sed \
  -e "s|\${SUPABASE_ANON_KEY}|${SUPABASE_ANON_KEY}|g" \
  -e "s|\${SUPABASE_SERVICE_ROLE_KEY}|${SUPABASE_SERVICE_ROLE_KEY}|g" \
  /var/lib/kong/kong.yml.template > /tmp/kong-resolved.yml

echo "[kong-init] kong.yml resolvido OK"

export KONG_DECLARATIVE_CONFIG=/tmp/kong-resolved.yml

exec /docker-entrypoint.sh kong docker-start
