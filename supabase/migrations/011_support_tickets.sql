-- Migration 011: Tabela de chamados de suporte interno
CREATE TABLE IF NOT EXISTS barber.support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES barber.tenants(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'pending')),
  messages    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Superadmin lê todos; tenant só lê/insere os seus
ALTER TABLE barber.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all" ON barber.support_tickets
  USING (
    EXISTS (SELECT 1 FROM barber.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "tenant_own" ON barber.support_tickets
  FOR ALL USING (tenant_id IN (
    SELECT id FROM barber.tenants WHERE id = tenant_id
      AND EXISTS (SELECT 1 FROM barber.profiles WHERE id = auth.uid() AND tenant_id = barber.tenants.id)
  ));
