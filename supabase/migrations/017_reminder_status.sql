-- Migration 017: status descritivo do lembrete WhatsApp
-- Valores: 'pendente' | 'enviado' | 'tempo_insuficiente'
-- 'tempo_insuficiente': agendamento criado com menos tempo que o wpp_reminder_minutes do tenant

ALTER TABLE barber.appointments
  ADD COLUMN IF NOT EXISTS wpp_reminder_status TEXT NOT NULL DEFAULT 'pendente';

-- Migra dados existentes: já enviados ficam como 'enviado'
UPDATE barber.appointments
  SET wpp_reminder_status = 'enviado'
  WHERE wpp_reminder_sent = TRUE;
