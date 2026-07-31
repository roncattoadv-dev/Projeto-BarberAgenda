-- ============================================================
-- BarberFlow — Auth própria (substitui GoTrue)
--
-- auth.uid()/auth.role()/auth.jwt(): réplica do que a imagem
-- supabase/postgres fornecia. O Express assina o JWT (mesmo
-- formato que o GoTrue emitia — sub/role/user_metadata) e o
-- PostgREST, ao validar esse JWT, seta a GUC "request.jwt.claims"
-- por request — é isso que essas funções leem. Sem isso, toda
-- RLS que já existe quebra silenciosamente (relação não existe).
--
-- auth_internal: credenciais reais (hash de senha, refresh/reset
-- tokens). Schema NÃO listado em PGRST_DB_SCHEMAS — nunca exposto
-- via PostgREST/anon/authenticated. Só o Express acessa, via
-- conexão pg direta com a role app_backend.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(auth.jwt()->>'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(auth.jwt()->>'role', '')
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

-- ============================================================
-- Role de login do backend Express (substitui a service-role key
-- do Supabase, mas agora é uma role Postgres real com senha,
-- usada via pg.Pool direto, não via PostgREST).
--
-- ATENÇÃO: 'changeme_in_prod' é só um placeholder de dev/staging. Antes do
-- corte em produção (Fase 3), trocar via `ALTER ROLE app_backend PASSWORD
-- '<senha real>';` e ajustar DATABASE_URL correspondente — não subir este
-- script como está num ambiente com dados reais.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_backend') THEN
    CREATE ROLE app_backend LOGIN PASSWORD 'changeme_in_prod' BYPASSRLS;
  END IF;
END
$$;

-- ============================================================
-- auth_internal.users — credenciais reais
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth_internal;

GRANT USAGE ON SCHEMA barber, public, auth, auth_internal TO app_backend;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA barber, public, auth_internal TO app_backend;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA barber, public, auth_internal TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber, public, auth_internal GRANT ALL ON TABLES TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber, public, auth_internal GRANT ALL ON SEQUENCES TO app_backend;

CREATE TABLE auth_internal.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES barber.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text,
    google_sub text UNIQUE,
    role text DEFAULT 'tenant_admin'::text NOT NULL
        CHECK (role = ANY (ARRAY['super_admin'::text, 'tenant_admin'::text, 'tenant_professional'::text, 'customer'::text])),
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    email_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT uq_user_email_tenant UNIQUE (tenant_id, email),
    CONSTRAINT chk_has_credential CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL)
);

CREATE INDEX idx_auth_users_tenant ON auth_internal.users USING btree (tenant_id);
CREATE INDEX idx_auth_users_email ON auth_internal.users USING btree (email);

-- Refresh tokens: opacos, hash SHA-256 armazenado (nunca o token em si),
-- rotativos — reuso de um token já revogado indica roubo, ver plano §2.
CREATE TABLE auth_internal.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth_internal.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);

CREATE INDEX idx_refresh_tokens_user ON auth_internal.refresh_tokens USING btree (user_id);

CREATE TABLE auth_internal.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth_internal.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);

CREATE INDEX idx_password_reset_tokens_user ON auth_internal.password_reset_tokens USING btree (user_id);

-- Verificação de email no cadastro (substitui auth.admin.generateLink do GoTrue)
CREATE TABLE auth_internal.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth_internal.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);

CREATE INDEX idx_email_verification_tokens_user ON auth_internal.email_verification_tokens USING btree (user_id);
