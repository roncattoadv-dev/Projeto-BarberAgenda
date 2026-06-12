-- Migration 009: leitura pública de professional_services
-- Necessário para a página de agendamento (anon) montar a lista de profissionais
-- com seus serviços via join. Sem esta policy, getProfessionals falha com 42501.

ALTER TABLE barber.professional_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_professional_services" ON barber.professional_services
  FOR SELECT USING (true);

-- Permissão de tabela (GRANT) — necessária além da RLS
GRANT SELECT ON barber.professional_services TO anon, authenticated;
