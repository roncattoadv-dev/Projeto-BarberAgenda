-- Migration 003: Colunas Asaas no tenant + índices
-- Execute no SQL Editor do Supabase

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS asaas_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_asaas_sub ON public.tenants(asaas_subscription_id);

-- RLS: service role (backend) pode update qualquer tenant (para webhook)
-- Já coberto pelo service_role key que bypassa RLS.
-- Nenhuma policy adicional necessária.

COMMENT ON COLUMN public.tenants.asaas_customer_id     IS 'ID do cliente no Asaas';
COMMENT ON COLUMN public.tenants.asaas_subscription_id IS 'ID da assinatura mensal no Asaas';
