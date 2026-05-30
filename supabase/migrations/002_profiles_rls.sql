-- ============================================================
-- Migration 002: Profiles + RLS para autenticação Supabase
-- Execute no SQL Editor do Supabase após criar o projeto
-- ============================================================

-- 1. Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela profiles — estende auth.users com role e tenant
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('super_admin','tenant_admin','tenant_professional','customer')),
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles(role);

-- 3. Trigger: cria profile ao registrar usuário no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    CASE
      WHEN NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'tenant_id')::UUID
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Funções helper para RLS
CREATE OR REPLACE FUNCTION public.my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 5. RLS — profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON public.profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "super_admin_all_profiles" ON public.profiles
  FOR ALL USING (public.my_role() = 'super_admin');

-- 6. RLS — tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_tenants" ON public.tenants
  FOR ALL USING (public.my_role() = 'super_admin');

CREATE POLICY "tenant_read_own" ON public.tenants
  FOR SELECT USING (id = public.my_tenant_id());

-- 7. RLS — services, professionals, customers, appointments, payments, products
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['services','professionals','customers','appointments','payments','products'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('
      CREATE POLICY "tenant_isolation_%s" ON public.%I
        FOR ALL USING (tenant_id = public.my_tenant_id() OR public.my_role() = ''super_admin'')
    ', t, t);
    -- Inserção pública para booking (sem auth) em appointments e customers
  END LOOP;
END $$;

-- 8. Policy extra: clientes finais podem inserir agendamentos sem login
CREATE POLICY "public_insert_appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_customers" ON public.customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read_services" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "public_read_professionals" ON public.professionals
  FOR SELECT USING (true);

CREATE POLICY "public_read_tenants" ON public.tenants
  FOR SELECT USING (status != 'blocked');

-- 9. Seed: Super Admin inicial
-- Após executar esta migration, crie o usuário no Supabase Auth:
--   Authentication → Users → Invite user → admin@barberflow.com.br
-- Depois execute:
--   UPDATE public.profiles SET role = 'super_admin', tenant_id = NULL
--   WHERE email = 'admin@barberflow.com.br';

-- 10. Como criar um Tenant Admin:
-- 1. Crie a barbearia em tenants (pelo Super Admin no painel)
-- 2. Crie o usuário em Authentication → Users
-- 3. Execute:
--    UPDATE public.profiles
--    SET role = 'tenant_admin', tenant_id = '<uuid-do-tenant>'
--    WHERE email = 'admin@barbearia.com.br';
