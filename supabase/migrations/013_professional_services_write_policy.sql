-- Migration 013: permite tenant_admin inserir e remover vínculos professional_services
-- Sem esta policy, os botões de atribuição de profissional falhavam silenciosamente (RLS bloqueava INSERT/DELETE)

GRANT INSERT, DELETE ON barber.professional_services TO authenticated;

CREATE POLICY "tenant_admin_write_professional_services" ON barber.professional_services
  FOR ALL TO authenticated
  USING (
    professional_id IN (
      SELECT id FROM barber.professionals
      WHERE tenant_id = public.my_tenant_id()
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT id FROM barber.professionals
      WHERE tenant_id = public.my_tenant_id()
    )
  );
