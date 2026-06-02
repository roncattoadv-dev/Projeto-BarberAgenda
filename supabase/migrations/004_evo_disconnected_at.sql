-- Migration 004: rastreia quando a instância EvoGo foi desconectada
-- Usado pelo job diário do servidor para limpar instâncias inativas > 30 dias.

ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS evo_disconnected_at TIMESTAMPTZ;
