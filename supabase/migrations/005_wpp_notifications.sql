-- Migration 005: templates de notificação WhatsApp e controle de lembrete enviado

ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS wpp_template_confirm  TEXT,
  ADD COLUMN IF NOT EXISTS wpp_template_remind   TEXT,
  ADD COLUMN IF NOT EXISTS wpp_booking_url       TEXT;

ALTER TABLE barber.appointments
  ADD COLUMN IF NOT EXISTS wpp_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
