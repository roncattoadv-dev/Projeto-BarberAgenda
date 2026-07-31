-- ============================================================
-- Dados de teste para scripts/rls-assert.sql
-- 2 tenants (A, B), cada um com tenant_admin + tenant_professional,
-- 1 super_admin global, e uma linha em cada tabela tenant-scoped por tenant.
-- Rodar contra um Postgres DESCARTÁVEL com o schema canônico já carregado
-- (postgres/init/001-005.sql) — nunca contra dados reais.
-- ============================================================

INSERT INTO barber.tenants (id, name, slug, phone, address, status)
VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Tenant A', 'tenant-a', '11900000000', 'Rua A', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'Tenant B', 'tenant-b', '11900000001', 'Rua B', 'active');

INSERT INTO auth_internal.users (id, tenant_id, name, email, password_hash, role)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'Admin A', 'admin-a@test.com', 'x', 'tenant_admin'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Prof A',  'prof-a@test.com',  'x', 'tenant_professional'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'Admin B', 'admin-b@test.com', 'x', 'tenant_admin'),
  ('00000000-0000-0000-0000-0000000000c1', NULL,                                    'Super',   'super@test.com',   'x', 'super_admin');

INSERT INTO barber.services (id, tenant_id, name, duration_minutes, price, category)
VALUES
  ('00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-00000000000a', 'Corte A', 30, 50, 'Cabelo'),
  ('00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-00000000000b', 'Corte B', 30, 50, 'Cabelo');

INSERT INTO barber.professionals (id, tenant_id, name)
VALUES
  ('00000000-0000-0000-0000-0000000011a1', '00000000-0000-0000-0000-00000000000a', 'Prof A'),
  ('00000000-0000-0000-0000-0000000011b1', '00000000-0000-0000-0000-00000000000b', 'Prof B');

INSERT INTO barber.customers (id, tenant_id, name, phone)
VALUES
  ('00000000-0000-0000-0000-0000000012a1', '00000000-0000-0000-0000-00000000000a', 'Cliente A', '11911111111'),
  ('00000000-0000-0000-0000-0000000012b1', '00000000-0000-0000-0000-00000000000b', 'Cliente B', '11922222222');

INSERT INTO barber.appointments (id, tenant_id, service_id, professional_id, customer_id, customer_name, customer_phone, scheduled_date, scheduled_time, duration_minutes, price)
VALUES
  ('00000000-0000-0000-0000-0000000013a1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-0000000011a1', '00000000-0000-0000-0000-0000000012a1', 'Cliente A', '11911111111', '2026-08-01', '10:00', 30, 50),
  ('00000000-0000-0000-0000-0000000013b1', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000011b1', '00000000-0000-0000-0000-0000000012b1', 'Cliente B', '11922222222', '2026-08-01', '10:00', 30, 50);

INSERT INTO barber.payments (id, tenant_id, amount, method)
VALUES
  ('00000000-0000-0000-0000-0000000014a1', '00000000-0000-0000-0000-00000000000a', 50, 'pix'),
  ('00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-00000000000b', 50, 'pix');

INSERT INTO barber.products (id, tenant_id, name, price)
VALUES
  ('00000000-0000-0000-0000-0000000015a1', '00000000-0000-0000-0000-00000000000a', 'Produto A', 20),
  ('00000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-00000000000b', 'Produto B', 20);

INSERT INTO barber.recurring_expenses (id, tenant_id, description, amount, frequency, next_due_date)
VALUES
  ('00000000-0000-0000-0000-0000000016a1', '00000000-0000-0000-0000-00000000000a', 'Aluguel A', 1000, 'mensal', '2026-08-05'),
  ('00000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-00000000000b', 'Aluguel B', 1000, 'mensal', '2026-08-05');

INSERT INTO barber.slot_history (id, tenant_id, slot_date, slot_time, cancelled_customer_name)
VALUES
  ('00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-00000000000a', '2026-08-01', '10:00', 'Cliente A'),
  ('00000000-0000-0000-0000-0000000017b1', '00000000-0000-0000-0000-00000000000b', '2026-08-01', '10:00', 'Cliente B');

INSERT INTO barber.support_tickets (id, tenant_id, title)
VALUES
  ('00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-00000000000a', 'Ticket A'),
  ('00000000-0000-0000-0000-0000000018b1', '00000000-0000-0000-0000-00000000000b', 'Ticket B');

INSERT INTO barber.waitlist (id, tenant_id, customer_name, customer_phone, date)
VALUES
  ('00000000-0000-0000-0000-0000000019a1', '00000000-0000-0000-0000-00000000000a', 'Cliente A', '11911111111', '2026-08-01'),
  ('00000000-0000-0000-0000-0000000019b1', '00000000-0000-0000-0000-00000000000b', 'Cliente B', '11922222222', '2026-08-01');
