-- ============================================================
-- Script formal de asserção de RLS por role
-- Roda contra o schema canônico (postgres/init/001-005.sql) com dados
-- de teste (ver scripts/rls-assert-seed.sql): 2 tenants (A, B), cada um
-- com tenant_admin + tenant_professional, mais 1 super_admin global.
--
-- Uso: docker exec -i <container-postgres> psql -U postgres -d barberflow
--        -v ON_ERROR_STOP=1 -f scripts/rls-assert.sql
--
-- Cada bloco testa: "role X só vê/edita os dados do seu próprio tenant".
-- Falha = a asserção RAISE EXCEPTION interrompe o script (ON_ERROR_STOP).
-- ============================================================

\set ADMIN_A '00000000-0000-0000-0000-0000000000a1'
\set ADMIN_B '00000000-0000-0000-0000-0000000000b1'
\set SUPER   '00000000-0000-0000-0000-0000000000c1'
\set TENANT_A '00000000-0000-0000-0000-00000000000a'
\set TENANT_B '00000000-0000-0000-0000-00000000000b'

DO $$
DECLARE
  n int;
BEGIN
  -- ── tenant_admin A só vê seu próprio tenant nas tabelas isoladas ──────────
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  PERFORM set_config('role', 'authenticated', false);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM barber.customers; -- tem policy tenant_isolation, sem exceção pública
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % customers (esperado 1)', n; END IF;

  SELECT count(*) INTO n FROM barber.appointments WHERE tenant_id = '00000000-0000-0000-0000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: tenant_admin A conseguiu ver appointments do tenant B'; END IF;

  SELECT count(*) INTO n FROM barber.payments;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % payments (esperado 1)', n; END IF;

  SELECT count(*) INTO n FROM barber.products;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % products (esperado 1)', n; END IF;

  SELECT count(*) INTO n FROM barber.recurring_expenses;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % recurring_expenses (esperado 1)', n; END IF;

  SELECT count(*) INTO n FROM barber.slot_history;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % slot_history (esperado 1)', n; END IF;

  -- support_tickets usa policy própria (tenant_own via subquery em profiles)
  SELECT count(*) INTO n FROM barber.support_tickets;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin A vê % support_tickets (esperado 1)', n; END IF;

  -- tentativa de UPDATE cross-tenant deve afetar 0 linhas (RLS bloqueia via WITH CHECK/USING)
  UPDATE barber.customers SET name = 'HACK' WHERE tenant_id = '00000000-0000-0000-0000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: tenant_admin A conseguiu UPDATE em customer do tenant B'; END IF;

  -- tentativa de DELETE cross-tenant deve afetar 0 linhas
  DELETE FROM barber.appointments WHERE tenant_id = '00000000-0000-0000-0000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: tenant_admin A conseguiu DELETE em appointment do tenant B'; END IF;

  RESET ROLE;
  RAISE NOTICE 'OK — tenant_admin A: isolamento correto em todas as tabelas testadas';
END $$;

DO $$
DECLARE
  n int;
BEGIN
  -- ── super_admin vê TUDO (bypass explícito via my_role() = 'super_admin') ─
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM barber.customers;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA: super_admin vê % customers (esperado 2, todos os tenants)', n; END IF;

  SELECT count(*) INTO n FROM barber.appointments;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA: super_admin vê % appointments (esperado 2)', n; END IF;

  SELECT count(*) INTO n FROM barber.tenants;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA: super_admin vê % tenants (esperado 2)', n; END IF;

  RESET ROLE;
  RAISE NOTICE 'OK — super_admin: vê todos os tenants em todas as tabelas testadas';
END $$;

DO $$
DECLARE
  n int;
BEGIN
  -- ── anon (sem JWT) — só as tabelas com policy pública explícita ──────────
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;

  -- services/professionals têm policy pública USING(true) — comportamento
  -- já existente antes desta migração, não é regressão (ver plano de corte).
  SELECT count(*) INTO n FROM barber.services;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA: anon vê % services (esperado 2, policy pública)', n; END IF;

  -- customers NÃO tem policy pública de SELECT — só INSERT público
  SELECT count(*) INTO n FROM barber.customers;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: anon conseguiu SELECT em customers (esperado 0)'; END IF;

  -- payments não tem GRANT nenhum para anon (nem chega a avaliar RLS) —
  -- mais travado que uma policy vazia, e correto: é dado financeiro.
  BEGIN
    PERFORM count(*) FROM barber.payments;
    RAISE EXCEPTION 'FALHA: anon conseguiu SELECT em payments (deveria dar permission denied)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK — payments corretamente inacessível para anon (sem GRANT)';
  END;

  -- auth_internal.users nunca deve ser alcançável, nem por anon nem authenticated
  BEGIN
    PERFORM count(*) FROM auth_internal.users;
    RAISE EXCEPTION 'FALHA: anon conseguiu acessar auth_internal.users (deveria dar permission denied)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK — auth_internal.users corretamente inacessível para anon';
  END;

  RESET ROLE;
  RAISE NOTICE 'OK — anon: só enxerga tabelas com policy pública explícita';
END $$;

DO $$
DECLARE
  n int;
BEGIN
  -- ── tenant_admin B simétrico ao A (garante que não é side-effect de ordem) ─
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM barber.customers;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_admin B vê % customers (esperado 1)', n; END IF;

  SELECT count(*) INTO n FROM barber.customers WHERE tenant_id = '00000000-0000-0000-0000-00000000000a';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: tenant_admin B conseguiu ver customer do tenant A'; END IF;

  RESET ROLE;
  RAISE NOTICE 'OK — tenant_admin B: isolamento correto (simétrico ao A)';
END $$;

DO $$
DECLARE
  n int;
BEGIN
  -- ── tenant_professional: mesmo isolamento por tenant que tenant_admin,   ──
  -- ── mas NÃO pode editar o registro do tenant (só tenant_admin pode)      ──
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM barber.customers;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA: tenant_professional A vê % customers (esperado 1, mesmo isolamento do admin)', n; END IF;

  UPDATE barber.tenants SET name = 'HACK' WHERE id = '00000000-0000-0000-0000-00000000000a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA: tenant_professional conseguiu editar o próprio tenant (só tenant_admin deveria poder)'; END IF;

  RESET ROLE;
  RAISE NOTICE 'OK — tenant_professional: mesmo isolamento de dados, mas sem permissão de editar o tenant';
END $$;

DO $$
BEGIN
  RAISE NOTICE '=== TODAS AS ASSERÇÕES DE RLS PASSARAM ===';
END $$;
