-- Migration 012: email de confirmação para cliente + email de contato do tenant

ALTER TABLE barber.appointments
  ADD COLUMN IF NOT EXISTS customer_email      TEXT,
  ADD COLUMN IF NOT EXISTS email_confirm_sent  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
