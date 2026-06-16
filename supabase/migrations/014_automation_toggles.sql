-- Migration 014: toggles de automação por canal (WhatsApp e Email)
ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS wpp_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
