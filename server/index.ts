// server/index.ts
// Backend Express — duas responsabilidades:
//  1. POST /api/register  → cadastro de nova barbearia (trial)
//  2. POST /api/webhook/asaas → recebe eventos do Asaas e ativa/bloqueia tenants
//
// Rodar: npx tsx server/index.ts
// Build: npx esbuild server/index.ts --bundle --platform=node --outfile=server.js

import express from 'express';
import cors    from 'cors';
import { createClient } from '@supabase/supabase-js';
import {
  createAsaasCustomer,
  createSubscription,
  cancelSubscription,
  type AsaasWebhookPayload,
} from './asaas';

// ── Config ────────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.SERVER_PORT || '4000');
const SUPABASE_URL    = process.env.SUPABASE_URL    || '';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || ''; // service_role key (bypass RLS)
const WEBHOOK_SECRET  = process.env.ASAAS_WEBHOOK_SECRET || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Server] SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios');
  process.exit(1);
}

// Service role key — bypassa RLS para operações administrativas
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/register
// Cadastro público de nova barbearia — cria tenant + usuário + assinatura Asaas
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, slug, email, password, phone, cpfCnpj } = req.body;

  // Validações básicas
  if (!name || !slug || !email || !password) {
    return res.status(400).json({ error: 'name, slug, email e password são obrigatórios.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug deve conter apenas letras minúsculas, números e hífens.' });
  }

  try {
    // 1. Verifica se slug já existe
    const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Este endereço já está em uso. Escolha outro.' });

    // 2. Calcula datas do trial (10 dias)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 10);
    const trialDate = trialEndsAt.toISOString().split('T')[0];

    // 3. Cria o tenant no Supabase
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name,
        slug: slug.toLowerCase().trim(),
        phone: phone || '',
        address: '',
        status:  'trial',
        plan:    'trial',
        trial_ends_at: trialDate,
        mrr: 0,
      })
      .select()
      .single();

    if (tenantErr) throw tenantErr;

    // 4. Cria usuário no Supabase Auth
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirma automaticamente (sem email de verificação)
      user_metadata: {
        name,
        role:      'tenant_admin',
        tenant_id: tenant.id,
      },
    });

    if (authErr) {
      // Rollback: remove o tenant se o usuário não foi criado
      await supabase.from('tenants').delete().eq('id', tenant.id);
      if (authErr.message?.includes('already')) {
        return res.status(409).json({ error: 'Este email já está cadastrado.' });
      }
      throw authErr;
    }

    // 5. Garante que o profile existe com role correto
    await supabase.from('profiles').upsert({
      id:        authUser.user.id,
      name,
      email,
      role:      'tenant_admin',
      tenant_id: tenant.id,
    });

    // 6. Cria cliente e assinatura no Asaas (com 10 dias de trial)
    let asaasCustomerId    = null;
    let asaasSubscriptionId = null;

    try {
      const asaasCustomer = await createAsaasCustomer({ name, email, phone, cpfCnpj });
      asaasCustomerId     = asaasCustomer.id;

      const subscription    = await createSubscription(asaasCustomer.id, 10);
      asaasSubscriptionId   = subscription.id;

      // Salva os IDs do Asaas no tenant
      await supabase.from('tenants').update({
        asaas_customer_id:     asaasCustomerId,
        asaas_subscription_id: asaasSubscriptionId,
      }).eq('id', tenant.id);
    } catch (asaasErr) {
      // Asaas falhou — não bloqueia o cadastro, apenas loga
      console.error('[Register] Asaas error (non-fatal):', asaasErr);
    }

    // 7. Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id,
      user_id:   authUser.user.id,
      user_name: name,
      action:    'Cadastro de nova barbearia',
      details:   `Trial de 10 dias iniciado. Asaas subscription: ${asaasSubscriptionId ?? 'pendente'}`,
    });

    return res.status(201).json({
      ok:       true,
      tenantId: tenant.id,
      slug:     tenant.slug,
      trialEndsAt: trialDate,
      message:  'Cadastro realizado! Acesse o painel para configurar sua barbearia.',
    });

  } catch (err: any) {
    console.error('[Register] Error:', err);
    return res.status(500).json({ error: 'Erro interno ao processar cadastro. Tente novamente.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/asaas
// Recebe eventos do Asaas — ativa ou bloqueia tenants conforme pagamento
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/webhook/asaas', async (req, res) => {
  // Verifica token de segurança se configurado
  if (WEBHOOK_SECRET) {
    const token = req.headers['asaas-access-token'] || req.headers['authorization'];
    if (token !== WEBHOOK_SECRET && token !== `Bearer ${WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const payload: AsaasWebhookPayload = req.body;
  const { event, payment, subscription } = payload;

  console.log(`[Webhook] ${event}`, { paymentId: payment?.id, subscriptionId: subscription?.id || payment?.subscription });

  const subscriptionId = subscription?.id || payment?.subscription;

  if (!subscriptionId) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    // Busca o tenant pelo asaas_subscription_id
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('asaas_subscription_id', subscriptionId)
      .maybeSingle();

    if (!tenant) {
      console.warn(`[Webhook] Tenant não encontrado para subscription ${subscriptionId}`);
      return res.status(200).json({ ok: true, ignored: true });
    }

    let newStatus: 'active' | 'blocked' | 'trial' | null = null;
    let logAction = '';
    let logDetails = '';

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Pagamento confirmado → ativa e calcula próxima renovação
        const nextRenewal = new Date();
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        await supabase.from('tenants').update({
          status: 'active',
          plan:   'mensal',
          mrr:    89.90,
          subscription_ends_at: nextRenewal.toISOString().split('T')[0],
        }).eq('id', tenant.id);
        newStatus  = 'active';
        logAction  = 'Pagamento confirmado';
        logDetails = `Asaas payment ${payment?.id} — R$ ${payment?.value?.toFixed(2)}. Plano ativo até ${nextRenewal.toISOString().split('T')[0]}.`;
        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Venceu sem pagamento → bloqueia
        await supabase.from('tenants').update({ status: 'blocked', mrr: 0 }).eq('id', tenant.id);
        newStatus  = 'blocked';
        logAction  = 'Pagamento vencido — acesso bloqueado';
        logDetails = `Asaas payment ${payment?.id} vencido em ${payment?.dueDate}. Tenant bloqueado.`;
        break;
      }

      case 'SUBSCRIPTION_INACTIVATED': {
        // Assinatura cancelada → bloqueia
        await supabase.from('tenants').update({ status: 'blocked', mrr: 0 }).eq('id', tenant.id);
        newStatus  = 'blocked';
        logAction  = 'Assinatura cancelada';
        logDetails = `Asaas subscription ${subscriptionId} cancelada. Tenant bloqueado.`;
        break;
      }

      default:
        // Outros eventos — apenas loga
        logAction  = `Webhook: ${event}`;
        logDetails = `Subscription ${subscriptionId}`;
    }

    // Audit log
    if (logAction) {
      await supabase.from('audit_logs').insert({
        tenant_id: tenant.id,
        user_name: 'Asaas Webhook',
        action:    logAction,
        details:   logDetails,
      });
    }

    return res.status(200).json({ ok: true, tenantId: tenant.id, newStatus });

  } catch (err: any) {
    console.error('[Webhook] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] BarberFlow API rodando na porta ${PORT}`);
  console.log(`[Server] Supabase: ${SUPABASE_URL ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Asaas: ${process.env.ASAAS_API_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Modo: ${process.env.ASAAS_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUÇÃO'}`);
});
