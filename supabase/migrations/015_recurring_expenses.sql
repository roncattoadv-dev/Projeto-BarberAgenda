-- Migration 015: despesas recorrentes por tenant
CREATE TABLE barber.recurring_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  frequency     TEXT NOT NULL CHECK (frequency IN ('semanal','quinzenal','mensal','anual')),
  next_due_date DATE NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE barber.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manage own recurring expenses"
  ON barber.recurring_expenses FOR ALL TO authenticated
  USING  (tenant_id = (SELECT tenant_id FROM barber.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM barber.profiles WHERE id = auth.uid()));
