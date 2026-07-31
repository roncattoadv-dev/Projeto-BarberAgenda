-- ============================================================
-- BarberFlow — Grants para PostgREST (schemas barber, public)
--
-- auth_internal NÃO aparece aqui de propósito — nunca deve ser
-- listado em PGRST_DB_SCHEMAS. Só app_backend (Express, via pg
-- direto) acessa essa role. supabase_realtime_admin não existe
-- mais (Realtime foi eliminado, ver plano §4).
-- ============================================================

GRANT USAGE ON SCHEMA barber TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Views de perfil — somente leitura (writes de auth vão por
-- auth_internal.users via Express, nunca via PostgREST)
GRANT SELECT ON public.profiles TO anon, authenticated, service_role;
GRANT SELECT ON barber.profiles TO anon, authenticated, service_role;

-- Tenants
GRANT SELECT ON barber.tenants TO anon;
GRANT ALL ON barber.tenants TO authenticated, service_role;
GRANT SELECT ON barber.tenants_live TO anon;
GRANT ALL ON barber.tenants_live TO authenticated, service_role;

-- Tabelas de negócio, tenant-scoped (RLS faz o isolamento)
GRANT SELECT, INSERT ON barber.customers TO anon;
GRANT ALL ON barber.customers TO authenticated, service_role;

GRANT SELECT, INSERT ON barber.appointments TO anon;
GRANT ALL ON barber.appointments TO authenticated, service_role;

GRANT ALL ON barber.audit_logs TO authenticated, service_role;
GRANT ALL ON barber.coupons TO authenticated, service_role;

GRANT ALL ON barber.marketing_campaigns TO service_role;
GRANT ALL ON barber.marketing_sends TO service_role;

GRANT ALL ON barber.payments TO authenticated, service_role;
GRANT ALL ON barber.products TO authenticated, service_role;

GRANT SELECT ON barber.professional_services TO anon;
GRANT ALL ON barber.professional_services TO authenticated, service_role;

GRANT SELECT ON barber.professionals TO anon;
GRANT ALL ON barber.professionals TO authenticated, service_role;

GRANT SELECT, INSERT, DELETE, UPDATE ON barber.recurring_expenses TO authenticated;
GRANT ALL ON barber.recurring_expenses TO service_role;

GRANT ALL ON barber.reviews TO authenticated, service_role;

GRANT SELECT ON barber.services TO anon;
GRANT ALL ON barber.services TO authenticated, service_role;

GRANT SELECT, INSERT, DELETE, UPDATE ON barber.slot_history TO authenticated;
GRANT ALL ON barber.slot_history TO service_role;

GRANT ALL ON barber.support_tickets TO authenticated, service_role;

GRANT SELECT, INSERT, DELETE, UPDATE ON barber.waitlist TO anon, authenticated;
GRANT ALL ON barber.waitlist TO service_role;

GRANT ALL ON public.used_trials TO anon, authenticated, service_role;

-- Sequências e privilégios padrão para objetos futuros
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA barber TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA barber GRANT ALL ON TABLES TO service_role;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Funções utilitárias
GRANT EXECUTE ON FUNCTION barber.public_upsert_customer(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION barber.upsert_customer(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_tenant_id() TO anon, authenticated, service_role;
