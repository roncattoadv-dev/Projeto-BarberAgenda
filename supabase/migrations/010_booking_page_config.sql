-- Migration 010: Configuração visual da página de agendamento por tenant
ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS booking_page_config JSONB;
