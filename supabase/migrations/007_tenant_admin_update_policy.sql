-- Migration 007: Permite tenant_admin atualizar o próprio registro de tenant
-- Sem esta policy, o UPDATE de logo/nome/horários falha silenciosamente por RLS.

CREATE POLICY "tenant_admin_update_own" ON barber.tenants
  FOR UPDATE TO authenticated
  USING     (id = public.my_tenant_id() AND public.my_role() = 'tenant_admin')
  WITH CHECK (id = public.my_tenant_id() AND public.my_role() = 'tenant_admin');
