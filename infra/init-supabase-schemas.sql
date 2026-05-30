-- ============================================================
-- Supabase self-hosted: schemas, roles e extensões obrigatórias
-- Executado automaticamente na PRIMEIRA criação do volume postgres.
-- Se o volume já existe, execute manualmente pelo Studio.
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgjwt;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Schemas Supabase
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- Roles internas do Supabase
DO $$
BEGIN
  -- anon: papel para chamadas sem autenticação
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  -- authenticated: papel para usuários autenticados
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  -- service_role: papel para operações administrativas (bypassa RLS)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  -- authenticator: role de conexão usada pelo PostgREST
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
  -- supabase_admin: role administrativa geral
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD 'postgres';
  END IF;
  -- supabase_auth_admin: role do GoTrue
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
  -- supabase_storage_admin: role do Storage
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
END
$$;

-- Grants
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL ON SCHEMA public   TO postgres, supabase_admin;
GRANT ALL ON SCHEMA auth     TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage  TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Permissões de schema para o PostgREST
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

GRANT ALL ON SCHEMA _realtime TO supabase_admin;
GRANT ALL ON SCHEMA extensions TO supabase_admin, postgres;
