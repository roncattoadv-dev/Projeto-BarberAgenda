-- ============================================================
-- BarberFlow — Schema canônico (barber + public)
-- Fonte: rescue dump de produção (rescue-20260731_0100/schema_barber_public.sql),
-- NÃO as migrations em supabase/migrations/ (essas ficaram desatualizadas —
-- faltam marketing_campaigns, marketing_sends, waitlist, used_trials, que
-- foram criadas direto em produção via SQL editor e nunca commitadas).
--
-- Diferenças deliberadas em relação ao dump de produção:
--   - Owner uniforme "postgres" (dump original tinha supabase_admin em
--     algumas funções, artefato da imagem supabase/postgres que não existe mais).
--   - barber.users NÃO existe aqui — vira auth_internal.users (003_auth.sql),
--     fora dos schemas expostos ao PostgREST.
--   - public.profiles NÃO é mais tabela própria — vira view read-only sobre
--     auth_internal.users (004_rls.sql), eliminando a necessidade do trigger
--     on_auth_user_created (GoTrue não existe mais; o Express cria o registro
--     em auth_internal.users diretamente, numa transação, no registro/OAuth).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS barber;

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE barber.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    logo text DEFAULT '💈'::text,
    banner text,
    phone text NOT NULL,
    address text NOT NULL,
    instagram text,
    status text DEFAULT 'trial'::text NOT NULL
        CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'trial'::text])),
    plan text DEFAULT 'trial'::text NOT NULL
        CHECK (plan = ANY (ARRAY['mensal'::text, 'semestral'::text, 'anual'::text, 'trial'::text])),
    mrr numeric(10,2) DEFAULT 0 NOT NULL,
    trial_ends_at date DEFAULT (now() + '10 days'::interval) NOT NULL,
    subscription_ends_at date,
    business_hours text[],
    business_days text[],
    business_hours_by_day jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    asaas_customer_id text,
    asaas_subscription_id text,
    evo_disconnected_at timestamp with time zone,
    wpp_template_confirm text,
    wpp_template_remind text,
    wpp_booking_url text,
    blocked_dates date[] DEFAULT '{}'::date[],
    wpp_reminder_minutes integer DEFAULT 60 NOT NULL,
    booking_page_config jsonb,
    contact_email text,
    wpp_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    wpp_template_waitlist text,
    agenda_mode text DEFAULT 'auto_complete'::text,
    agenda_time_minutes integer DEFAULT 30,
    timezone text DEFAULT 'America/Sao_Paulo'::text,
    default_payment_method text DEFAULT 'pix'::text NOT NULL
);

COMMENT ON COLUMN barber.tenants.asaas_customer_id IS 'ID do cliente no Asaas';
COMMENT ON COLUMN barber.tenants.asaas_subscription_id IS 'ID da assinatura mensal no Asaas';

CREATE INDEX idx_tenants_slug ON barber.tenants USING btree (slug);
CREATE INDEX idx_tenants_status ON barber.tenants USING btree (status);
CREATE INDEX idx_tenants_asaas_sub ON barber.tenants USING btree (asaas_subscription_id);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE barber.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
    price numeric(10,2) NOT NULL CHECK (price >= 0::numeric),
    category text NOT NULL
        CHECK (category = ANY (ARRAY['Cabelo'::text, 'Barba'::text, 'Estética'::text, 'Unhas'::text, 'Combo'::text])),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_services_tenant ON barber.services USING btree (tenant_id);

-- ============================================================
-- PROFESSIONALS
-- ============================================================
CREATE TABLE barber.professionals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text DEFAULT 'Barbeiro'::text NOT NULL,
    avatar text,
    rating numeric(3,2) DEFAULT 5.00 NOT NULL CHECK (rating >= 1::numeric AND rating <= 5::numeric),
    commission_percentage numeric(5,2) DEFAULT 40.00 NOT NULL,
    business_days text[],
    business_hours_by_day jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_dates text[] DEFAULT '{}'::text[]
);

CREATE INDEX idx_professionals_tenant ON barber.professionals USING btree (tenant_id);

CREATE FUNCTION barber.check_professionals_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (SELECT count(*) FROM barber.professionals WHERE tenant_id = NEW.tenant_id AND is_active = true) >= 6 THEN
    RAISE EXCEPTION 'Limite de 6 colaboradores atingido para este tenant.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_professionals_limit BEFORE INSERT ON barber.professionals
    FOR EACH ROW EXECUTE FUNCTION barber.check_professionals_limit();

CREATE TABLE barber.professional_services (
    professional_id uuid NOT NULL REFERENCES barber.professionals(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES barber.services(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, service_id)
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE barber.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    phone text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT uq_customer_phone_name_tenant UNIQUE (tenant_id, phone, name)
);

CREATE INDEX idx_customers_tenant ON barber.customers USING btree (tenant_id);

CREATE FUNCTION barber.public_upsert_customer(p_tenant_id uuid, p_name text, p_phone text, p_email text DEFAULT NULL::text) RETURNS barber.customers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'barber', 'public'
    AS $$
DECLARE
  v_customer barber.customers;
BEGIN
  SELECT * INTO v_customer FROM barber.customers
  WHERE tenant_id = p_tenant_id AND phone = p_phone LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO barber.customers (tenant_id, name, phone, email)
    VALUES (p_tenant_id, p_name, p_phone, p_email)
    RETURNING * INTO v_customer;
  END IF;

  RETURN v_customer;
END;
$$;

CREATE FUNCTION barber.upsert_customer(p_tenant_id uuid, p_phone text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text) RETURNS barber.customers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'barber', 'public'
    AS $$
DECLARE
  v_customer barber.customers;
  v_name     TEXT := COALESCE(NULLIF(TRIM(p_name), ''), p_phone);
BEGIN
  INSERT INTO barber.customers (tenant_id, phone, name, email)
  VALUES (p_tenant_id, p_phone, v_name, p_email)
  ON CONFLICT (tenant_id, phone, name) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, barber.customers.email)
  RETURNING * INTO v_customer;

  RETURN v_customer;
END;
$$;

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE barber.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES barber.services(id),
    professional_id uuid NOT NULL REFERENCES barber.professionals(id),
    customer_id uuid NOT NULL REFERENCES barber.customers(id),
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    price numeric(10,2) NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL
        CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'attended'::text])),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    wpp_reminder_sent boolean DEFAULT false NOT NULL,
    wpp_confirm_sent boolean DEFAULT false NOT NULL,
    customer_email text,
    email_confirm_sent boolean DEFAULT false NOT NULL,
    wpp_reminder_status text DEFAULT 'pendente'::text NOT NULL
);

ALTER TABLE ONLY barber.appointments REPLICA IDENTITY FULL;

CREATE UNIQUE INDEX idx_appointments_no_overlap ON barber.appointments USING btree (professional_id, scheduled_date, scheduled_time) WHERE (status <> 'cancelled'::text);
CREATE INDEX idx_appointments_tenant_date ON barber.appointments USING btree (tenant_id, scheduled_date);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE barber.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    appointment_id uuid REFERENCES barber.appointments(id) ON DELETE SET NULL,
    amount numeric(10,2) NOT NULL,
    method text NOT NULL CHECK (method = ANY (ARRAY['pix'::text, 'credit_card'::text, 'cash'::text])),
    status text DEFAULT 'paid'::text NOT NULL
        CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])),
    description text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_payments_tenant ON barber.payments USING btree (tenant_id);
CREATE INDEX idx_payments_date ON barber.payments USING btree (tenant_id, paid_at DESC);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE barber.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    price numeric(10,2) NOT NULL CHECK (price >= 0::numeric),
    cost_price numeric(10,2) DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL CHECK (stock >= 0),
    min_stock integer DEFAULT 0 NOT NULL,
    category text DEFAULT 'Geral'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_products_tenant ON barber.products USING btree (tenant_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE barber.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    appointment_id uuid UNIQUE REFERENCES barber.appointments(id) ON DELETE CASCADE,
    stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE barber.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    code text NOT NULL UNIQUE,
    discount_percentage integer NOT NULL CHECK (discount_percentage >= 1 AND discount_percentage <= 100),
    status text DEFAULT 'active'::text NOT NULL CHECK (status = ANY (ARRAY['active'::text, 'expired'::text])),
    usage_count integer DEFAULT 0 NOT NULL,
    expires_at date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- RECURRING EXPENSES
-- ============================================================
CREATE TABLE barber.recurring_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    frequency text NOT NULL CHECK (frequency = ANY (ARRAY['semanal'::text, 'quinzenal'::text, 'mensal'::text, 'anual'::text])),
    next_due_date date NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_recurring_expenses_tenant ON barber.recurring_expenses USING btree (tenant_id);

-- ============================================================
-- SLOT HISTORY
-- ============================================================
CREATE TABLE barber.slot_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    slot_date date NOT NULL,
    slot_time text NOT NULL,
    professional_name text,
    service_name text,
    cancelled_customer_name text NOT NULL,
    cancelled_customer_phone text,
    filled_customer_name text,
    filled_customer_phone text,
    filled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_slot_history_tenant ON barber.slot_history USING btree (tenant_id, created_at DESC);

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE barber.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    title text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'pending'::text])),
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE barber.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES barber.tenants(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    date text NOT NULL,
    professional_id uuid,
    time_preference text DEFAULT 'qualquer'::text,
    notified boolean DEFAULT false,
    notified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX waitlist_tenant_date_idx ON barber.waitlist USING btree (tenant_id, date);

-- ============================================================
-- MARKETING (existiam em produção mas nunca em supabase/migrations/)
-- ============================================================
CREATE TABLE barber.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    subject text NOT NULL,
    campaign_type text DEFAULT 'newsletter'::text NOT NULL,
    filter_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sent_at timestamp with time zone,
    recipient_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_sent_at timestamp with time zone,
    last_sent_count integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE barber.marketing_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    campaign_id uuid NOT NULL REFERENCES barber.marketing_campaigns(id) ON DELETE CASCADE,
    tenant_id uuid,
    email text NOT NULL,
    tenant_name text,
    status text DEFAULT 'sent'::text NOT NULL,
    sent_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_marketing_sends_campaign ON barber.marketing_sends USING btree (campaign_id);
CREATE INDEX idx_marketing_sends_tenant ON barber.marketing_sends USING btree (tenant_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE barber.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tenant_id uuid REFERENCES barber.tenants(id) ON DELETE SET NULL,
    user_id uuid,
    user_name text NOT NULL,
    ip text,
    action text NOT NULL,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_logs_tenant ON barber.audit_logs USING btree (tenant_id);
CREATE INDEX idx_audit_logs_ts ON barber.audit_logs USING btree (created_at DESC);

-- ============================================================
-- public.used_trials — anti-abuso de trial (schema public por herança do dump)
-- ============================================================
CREATE TABLE public.used_trials (
    email text NOT NULL PRIMARY KEY,
    deleted_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.used_trials IS 'Emails que já usaram o trial gratuito — impede abuso por deleção e recriação de conta';
