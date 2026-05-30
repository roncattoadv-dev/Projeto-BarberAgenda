-- ============================================================
-- BarberAgenda — Init Script PostgreSQL
-- Executado automaticamente pelo docker-entrypoint ao criar
-- o container pela primeira vez.
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Schema de aplicação isolado
CREATE SCHEMA IF NOT EXISTS barber;

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  logo                  TEXT DEFAULT '💈',
  banner                TEXT,
  phone                 TEXT NOT NULL,
  address               TEXT NOT NULL,
  instagram             TEXT,
  status                TEXT NOT NULL DEFAULT 'trial'
                          CHECK (status IN ('active', 'blocked', 'trial')),
  plan                  TEXT NOT NULL DEFAULT 'trial'
                          CHECK (plan IN ('mensal', 'semestral', 'anual', 'trial')),
  mrr                   NUMERIC(10,2) NOT NULL DEFAULT 0,
  trial_ends_at         DATE NOT NULL DEFAULT (NOW() + INTERVAL '10 days'),
  subscription_ends_at  DATE,
  business_hours        TEXT[],
  business_days         TEXT[],
  business_hours_by_day JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug   ON barber.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON barber.tenants(status);

-- ============================================================
-- USERS — perfis de acesso
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES barber.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'tenant_admin'
                CHECK (role IN ('super_admin','tenant_admin','tenant_professional','customer')),
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_email_tenant UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON barber.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email  ON barber.users(email);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category         TEXT NOT NULL CHECK (category IN ('Cabelo','Barba','Estética','Unhas','Combo')),
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON barber.services(tenant_id);

-- ============================================================
-- PROFESSIONALS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.professionals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'Barbeiro',
  avatar                TEXT,
  rating                NUMERIC(3,2) NOT NULL DEFAULT 5.00
                          CHECK (rating BETWEEN 1 AND 5),
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  business_days         TEXT[],
  business_hours_by_day JSONB,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barber.professional_services (
  professional_id UUID NOT NULL REFERENCES barber.professionals(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES barber.services(id)      ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_professionals_tenant ON barber.professionals(tenant_id);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_phone_tenant UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON barber.customers(tenant_id);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES barber.tenants(id)       ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES barber.services(id),
  professional_id  UUID NOT NULL REFERENCES barber.professionals(id),
  customer_id      UUID NOT NULL REFERENCES barber.customers(id),
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  scheduled_date   DATE NOT NULL,
  scheduled_time   TIME NOT NULL,
  duration_minutes INT  NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('pending','confirmed','cancelled','attended')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Previne conflito de horário para o mesmo profissional
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_overlap
  ON barber.appointments(professional_id, scheduled_date, scheduled_time)
  WHERE status NOT IN ('cancelled');

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date
  ON barber.appointments(tenant_id, scheduled_date);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES barber.tenants(id)    ON DELETE CASCADE,
  appointment_id UUID REFERENCES barber.appointments(id)         ON DELETE SET NULL,
  amount         NUMERIC(10,2) NOT NULL,
  method         TEXT NOT NULL CHECK (method IN ('pix','credit_card','cash')),
  status         TEXT NOT NULL DEFAULT 'paid'
                   CHECK (status IN ('pending','paid','failed','refunded')),
  description    TEXT,
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON barber.payments(tenant_id);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock      INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock  INT NOT NULL DEFAULT 0,
  category   TEXT NOT NULL DEFAULT 'Geral',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON barber.products(tenant_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES barber.tenants(id)        ON DELETE CASCADE,
  appointment_id UUID UNIQUE      REFERENCES barber.appointments(id) ON DELETE CASCADE,
  stars          INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.coupons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT UNIQUE NOT NULL,
  discount_percentage INT NOT NULL CHECK (discount_percentage BETWEEN 1 AND 100),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  usage_count         INT NOT NULL DEFAULT 0,
  expires_at          DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.support_tickets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','pending')),
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS barber.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES barber.tenants(id) ON DELETE SET NULL,
  user_id    UUID,
  user_name  TEXT NOT NULL,
  ip         TEXT,
  action     TEXT NOT NULL,
  details    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON barber.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts     ON barber.audit_logs(created_at DESC);

-- ============================================================
-- SEED: Super Admin inicial
-- Senha padrão: BarberAdmin@2026! (mude imediatamente!)
-- ============================================================
INSERT INTO barber.tenants (id, name, slug, phone, address, status, plan, trial_ends_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'BarberFlow Platform', 'platform', '(11) 00000-0000', 'Plataforma SaaS', 'active', 'anual',
  (NOW() + INTERVAL '10 years')::DATE
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO barber.users (tenant_id, name, email, password_hash, role)
VALUES (
  NULL, -- super_admin não pertence a tenant
  'Super Admin',
  'admin@barberflow.com.br',
  crypt('BarberAdmin@2026!', gen_salt('bf', 12)),
  'super_admin'
) ON CONFLICT DO NOTHING;

\echo '✅ Schema barber criado com sucesso!'
