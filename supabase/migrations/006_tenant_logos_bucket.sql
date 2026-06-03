-- Migration 006: Bucket de armazenamento para logos de barbearias
-- Execute no SQL Editor do Supabase (dashboard → SQL Editor)

-- Bucket público para logos dos tenants
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Leitura pública (logos exibidas no site de agendamento)
CREATE POLICY "tenant_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'tenant-logos');

-- Upload autenticado (apenas admins logados)
CREATE POLICY "tenant_logos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-logos');

-- Substituição de logo existente
CREATE POLICY "tenant_logos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-logos');

-- Remoção de logo
CREATE POLICY "tenant_logos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-logos');
