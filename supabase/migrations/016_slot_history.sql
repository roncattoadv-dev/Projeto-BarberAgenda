-- Migration 016: histórico de vagas canceladas e preenchidas
CREATE TABLE barber.slot_history (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  slot_date                DATE NOT NULL,
  slot_time                TEXT NOT NULL,
  professional_name        TEXT,
  service_name             TEXT,
  cancelled_customer_name  TEXT NOT NULL,
  cancelled_customer_phone TEXT,
  filled_customer_name     TEXT,
  filled_customer_phone    TEXT,
  filled_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slot_history_tenant ON barber.slot_history(tenant_id, created_at DESC);

ALTER TABLE barber.slot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant manage own slot history"
  ON barber.slot_history FOR ALL TO authenticated
  USING  (tenant_id = (SELECT tenant_id FROM barber.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM barber.profiles WHERE id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON barber.slot_history TO authenticated;
