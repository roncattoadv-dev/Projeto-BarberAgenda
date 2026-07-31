-- ============================================================
-- BarberFlow — Views de compatibilidade + RLS
--
-- public.profiles agora é uma VIEW read-only sobre auth_internal.users
-- (nunca expõe password_hash/google_sub). Substitui a antiga tabela +
-- trigger handle_new_user() — o Express grava direto em
-- auth_internal.users numa transação ao registrar/logar via Google.
--
-- barber.tenants_live: não existia como objeto algum em produção
-- (achado do rebuild de 31/07) apesar de ~40 call sites em
-- server/index.ts já assumirem que existe. Criado aqui como view real.
--
-- Bug corrigido: supabase/migrations/011_support_tickets.sql comparava
-- profiles.role = 'superadmin' (sem underscore) contra um CHECK que só
-- permite 'super_admin' — a policy nunca deu match pra ninguém.
-- ============================================================

CREATE VIEW public.profiles AS
 SELECT id, tenant_id, name, email, role, phone, created_at
 FROM auth_internal.users;

CREATE VIEW barber.profiles AS
 SELECT id, tenant_id, name, email, role, phone, created_at
 FROM public.profiles;

CREATE VIEW barber.tenants_live AS
 SELECT * FROM barber.tenants;

-- ============================================================
-- Helpers de RLS (idênticos aos originais — já não confiam no JWT
-- diretamente, sempre re-consultam profiles por auth.uid())
-- ============================================================
CREATE FUNCTION public.my_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE FUNCTION public.my_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- RLS — profiles (via view, mas policies vivem na tabela real)
-- ============================================================
ALTER TABLE auth_internal.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_internal.users FORCE ROW LEVEL SECURITY;
-- Sem policies: nenhuma role de PostgREST (anon/authenticated) acessa
-- auth_internal.users diretamente — só via public.profiles/barber.profiles
-- (views) ou pela role app_backend (BYPASSRLS, usada só pelo Express).

-- ============================================================
-- RLS — tenants
-- ============================================================
ALTER TABLE barber.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY super_admin_tenants ON barber.tenants
    USING (public.my_role() = 'super_admin'::text);

CREATE POLICY tenant_read_own ON barber.tenants FOR SELECT
    USING (id = public.my_tenant_id());

CREATE POLICY public_read_tenants ON barber.tenants FOR SELECT
    USING (status <> 'blocked'::text);

CREATE POLICY tenant_admin_update_own ON barber.tenants FOR UPDATE TO authenticated
    USING (id = public.my_tenant_id() AND public.my_role() = 'tenant_admin'::text)
    WITH CHECK (id = public.my_tenant_id() AND public.my_role() = 'tenant_admin'::text);

-- ============================================================
-- RLS — tabelas tenant-scoped (isolamento padrão)
-- ============================================================
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['services','professionals','customers','appointments','payments','products'] LOOP
    EXECUTE format('ALTER TABLE barber.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('
      CREATE POLICY "tenant_isolation_%s" ON barber.%I
        USING (tenant_id = public.my_tenant_id() OR public.my_role() = ''super_admin'')
    ', t, t);
  END LOOP;
END $$;

-- Exceções públicas (fluxo de booking sem login)
CREATE POLICY public_insert_appointments ON barber.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY public_read_appointments ON barber.appointments FOR SELECT TO anon
    USING (EXISTS (SELECT 1 FROM barber.tenants WHERE tenants.id = appointments.tenant_id AND tenants.status <> 'blocked'::text));

CREATE POLICY public_insert_customers ON barber.customers FOR INSERT WITH CHECK (true);

CREATE POLICY public_read_services ON barber.services FOR SELECT USING (true);

CREATE POLICY public_read_professionals ON barber.professionals FOR SELECT USING (true);

ALTER TABLE barber.professional_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_read_professional_services ON barber.professional_services FOR SELECT USING (true);
CREATE POLICY tenant_admin_write_professional_services ON barber.professional_services TO authenticated
    USING (professional_id IN (SELECT professionals.id FROM barber.professionals WHERE professionals.tenant_id = public.my_tenant_id()))
    WITH CHECK (professional_id IN (SELECT professionals.id FROM barber.professionals WHERE professionals.tenant_id = public.my_tenant_id()));

-- ============================================================
-- RLS — recurring_expenses / slot_history
-- ============================================================
ALTER TABLE barber.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant manage own recurring expenses" ON barber.recurring_expenses TO authenticated
    USING (tenant_id = (SELECT profiles.tenant_id FROM barber.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM barber.profiles WHERE profiles.id = auth.uid()));

ALTER TABLE barber.slot_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant manage own slot history" ON barber.slot_history TO authenticated
    USING (tenant_id = (SELECT profiles.tenant_id FROM barber.profiles WHERE profiles.id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM barber.profiles WHERE profiles.id = auth.uid()));

-- ============================================================
-- RLS — support_tickets (bug 'superadmin' -> 'super_admin' corrigido)
-- ============================================================
ALTER TABLE barber.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY superadmin_all ON barber.support_tickets
    USING (EXISTS (SELECT 1 FROM barber.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'::text));

CREATE POLICY tenant_own ON barber.support_tickets
    USING (tenant_id IN (
      SELECT t.id FROM barber.tenants t
      WHERE EXISTS (SELECT 1 FROM barber.profiles p WHERE p.id = auth.uid() AND p.tenant_id = t.id)
    ));

-- ============================================================
-- RLS — waitlist (fluxo público de lista de espera, sem login)
-- ============================================================
ALTER TABLE barber.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_select ON barber.waitlist FOR SELECT USING (true);
CREATE POLICY public_insert ON barber.waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY public_update ON barber.waitlist FOR UPDATE USING (true);
CREATE POLICY public_delete ON barber.waitlist FOR DELETE USING (true);
