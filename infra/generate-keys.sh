#!/bin/bash
# ============================================================
# Gera JWT_SECRET, ANON_KEY e SERVICE_ROLE_KEY para o Supabase
# Uso: bash infra/generate-keys.sh
# Requer: openssl, node (ou python3)
# ============================================================

set -e

# Gera JWT_SECRET (64 bytes hex)
JWT_SECRET=$(openssl rand -hex 64)
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Função para gerar JWT HS256 com node
generate_jwt() {
  local payload=$1
  node -e "
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const payload = $payload;
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig     = crypto.createHmac('sha256', secret)
  .update(header + '.' + body).digest('base64url');
console.log(header + '.' + body + '.' + sig);
"
}

# ANON_KEY — role: anon, sem expiração
ANON_KEY=$(generate_jwt '{"role":"anon","iss":"supabase","iat":1700000000,"exp":9999999999}')
echo "SUPABASE_ANON_KEY=$ANON_KEY"
echo ""

# SERVICE_ROLE_KEY — role: service_role, sem expiração
SERVICE_ROLE_KEY=$(generate_jwt '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":9999999999}')
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo ""

echo "# Cole essas 3 variáveis no EasyPanel → Environment Variables do projeto"
echo "# NUNCA commite esses valores no git!"
