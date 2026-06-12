-- Migration 008: Datas bloqueadas (férias/feriados) por tenant
ALTER TABLE barber.tenants
  ADD COLUMN IF NOT EXISTS blocked_dates date[] DEFAULT '{}';
