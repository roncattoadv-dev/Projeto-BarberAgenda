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
  getPendingPaymentLink,
  type AsaasWebhookPayload,
} from './asaas';
import {
  sendWelcomeEmail,
  sendPaymentConfirmedEmail,
  sendPaymentOverdueEmail,
  sendBookingConfirmationEmail,
} from './email';

// ── Config ────────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.PORT || process.env.SERVER_PORT || '4000');
const SUPABASE_URL    = process.env.SUPABASE_URL    || '';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || ''; // service_role key (bypass RLS)
const WEBHOOK_SECRET  = process.env.ASAAS_WEBHOOK_SECRET || '';
const EVO_URL         = (process.env.EVO_URL || '').replace(/\/$/, '');
const EVO_GLOBAL_KEY  = process.env.EVO_GLOBAL_KEY || process.env.EVO_APIKEY || '';
const SITE_URL        = (process.env.SITE_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Server] SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios');
  process.exit(1);
}

// Client para tabelas de negócio (schema barber)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'barber' },
});

// Client para tabelas de auth (schema public: profiles, auth.admin)
const supabasePublic = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/whatsapp')) {
    console.log(`[HTTP] ${req.method} ${req.path} auth=${req.headers.authorization?.slice(0,20)}...`);
  }
  next();
});

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

    // 2. Verifica se o email já usou trial (anti-abuso)
    const { data: usedTrial } = await supabasePublic.from('used_trials').select('email').eq('email', email).maybeSingle();

    // 3. Calcula datas do trial (10 dias apenas para novos; emails com trial anterior iniciam bloqueados)
    const trialEndsAt = new Date();
    if (!usedTrial) trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    const trialDate = trialEndsAt.toISOString().split('T')[0];
    const initialStatus = usedTrial ? 'blocked' : 'trial';
    const initialPlan   = 'trial';

    // 4. Cria o tenant no Supabase
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name,
        slug: slug.toLowerCase().trim(),
        phone: phone || '',
        address: '',
        status:  initialStatus,
        plan:    initialPlan,
        trial_ends_at: trialDate,
        mrr: 0,
      })
      .select()
      .single();

    if (tenantErr) throw tenantErr;

    // 4. Cria usuário no Supabase Auth
    const { data: authUser, error: authErr } = await supabasePublic.auth.admin.createUser({
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
    await supabasePublic.from('profiles').upsert({
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
      details:   `Trial de 7 dias iniciado. Asaas subscription: ${asaasSubscriptionId ?? 'pendente'}`,
    });

    // 8. Email de boas-vindas (non-fatal)
    sendWelcomeEmail(email, name, tenant.slug, trialDate).catch(err =>
      console.error('[Register] Email error (non-fatal):', err.message),
    );

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
// GET /api/billing/payment-link
// Retorna o link de pagamento Asaas para o tenant reativar a assinatura
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/billing/payment-link', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token obrigatório.' });

  const { data: { user }, error: userErr } = await supabasePublic.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Token inválido.' });

  const tenantId = req.query.tenantId as string;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório.' });

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, asaas_customer_id, asaas_subscription_id, status')
      .eq('id', tenantId)
      .maybeSingle();

    if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });

    const asaasBase = process.env.ASAAS_SANDBOX === 'true'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';
    const asaasKey = process.env.ASAAS_API_KEY || '';

    const getPixForPayment = async (paymentId: string) => {
      try {
        const r = await fetch(`${asaasBase}/payments/${paymentId}/pixQrCode`, {
          headers: { 'access_token': asaasKey },
        });
        if (!r.ok) return {};
        const d = await r.json();
        return { pixImage: d.encodedImage as string | undefined, pixCode: d.payload as string | undefined };
      } catch { return {}; }
    };

    const getPendingPaymentId = async (subscriptionId: string) => {
      const r = await fetch(`${asaasBase}/payments?subscription=${subscriptionId}&limit=5`, {
        headers: { 'access_token': asaasKey },
      });
      const d = await r.json();
      const pending = (d.data ?? []).find((p: any) => ['PENDING', 'OVERDUE'].includes(p.status));
      return (pending ?? d.data?.[0]) as { id: string; invoiceUrl?: string; bankSlipUrl?: string } | undefined;
    };

    const plan    = (req.query.plan    as string) || 'mensal';
    const cpfCnpj = (req.query.cpfCnpj as string) || undefined;

    // Se já tem assinatura UNDEFINED (multi-método), reutiliza
    if (tenant.asaas_subscription_id) {
      try {
        const subRes = await fetch(`${asaasBase}/subscriptions/${tenant.asaas_subscription_id}`, {
          headers: { 'access_token': asaasKey },
        });
        const sub = subRes.ok ? await subRes.json() : null;
        if (sub && sub.billingType === 'UNDEFINED') {
          const payment = await getPendingPaymentId(tenant.asaas_subscription_id);
          if (payment) {
            const pix = await getPixForPayment(payment.id);
            return res.json({ url: payment.invoiceUrl || payment.bankSlipUrl, ...pix });
          }
        } else {
          // Assinatura antiga com tipo errado — cancela para recriar
          await fetch(`${asaasBase}/subscriptions/${tenant.asaas_subscription_id}`, {
            method: 'DELETE', headers: { 'access_token': asaasKey },
          }).catch(() => {});
          await supabase.from('tenants').update({ asaas_subscription_id: null }).eq('id', tenantId);
        }
      } catch {}
    }

    // Cria ou atualiza cliente no Asaas
    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const customer = await createAsaasCustomer({ name: tenant.name, email: user.email!, cpfCnpj });
      customerId = customer.id;
    } else if (cpfCnpj) {
      // Atualiza CPF no cliente existente (pode ter sido criado sem CPF)
      await fetch(`${asaasBase}/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfCnpj }),
      }).catch(e => console.warn('[PaymentLink] CPF update warning:', e.message));
    }

    const subscription = await createSubscription(customerId, plan, 0);
    await supabase.from('tenants').update({
      asaas_customer_id:     customerId,
      asaas_subscription_id: subscription.id,
    }).eq('id', tenantId);

    const payment = await getPendingPaymentId(subscription.id);
    const pix = payment ? await getPixForPayment(payment.id) : {};
    return res.json({ url: payment?.invoiceUrl || payment?.bankSlipUrl || `https://www.asaas.com/c/${customerId}`, ...pix });

  } catch (err: any) {
    console.error('[PaymentLink] Error:', err);
    return res.status(500).json({ error: err.message ?? 'Erro ao gerar cobrança.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/account
// Exclui a conta do tenant: cancela Asaas, remove dados e usuário
// Requer: Authorization: Bearer <access_token>  +  ?tenantId=<uuid>
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/account', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token de autenticação obrigatório.' });

  const { data: { user }, error: userErr } = await supabasePublic.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado.' });

  const tenantId = req.query.tenantId as string;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório.' });

  try {
    // Verifica que o usuário é dono deste tenant
    const { data: tenant } = await supabase
      .from('tenants').select('id, asaas_subscription_id').eq('id', tenantId).maybeSingle();
    if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });

    const { data: profile } = await supabasePublic
      .from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
    if (profile?.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Registra email em used_trials ANTES de deletar (impede abuso de trial)
    const email = user.email ?? '';
    if (email) {
      await supabasePublic.from('used_trials').upsert({ email, deleted_at: new Date().toISOString() });
    }

    // Cancela assinatura Asaas se existir
    if (tenant.asaas_subscription_id) {
      try { await cancelSubscription(tenant.asaas_subscription_id); } catch {}
    }

    // Deleta tenant — CASCADE remove appointments, professionals, services, etc.
    await supabase.from('tenants').delete().eq('id', tenantId);

    // Deleta profile público
    await supabasePublic.from('profiles').delete().eq('id', user.id);

    // Deleta usuário do auth (remove sessões e identidades OAuth)
    await supabasePublic.auth.admin.deleteUser(user.id);

    console.log(`[DeleteAccount] Conta excluída: tenant=${tenantId} user=${user.id} email=${email}`);
    return res.status(200).json({ ok: true });

  } catch (err: any) {
    console.error('[DeleteAccount] Error:', err);
    return res.status(500).json({ error: 'Erro interno ao excluir conta.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/register-google
// Completa cadastro de usuário que autenticou via Google OAuth (sem senha)
// Requer: Authorization: Bearer <access_token>
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/register-google', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token de autenticação obrigatório.' });

  // Verifica o JWT e obtém o usuário
  const { data: { user }, error: userErr } = await supabasePublic.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: 'Token inválido ou expirado.' });

  const { name, slug, phone } = req.body;

  if (!name || !slug) return res.status(400).json({ error: 'name e slug são obrigatórios.' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'Slug deve conter apenas letras minúsculas, números e hífens.' });

  const email = user.email || '';

  try {
    // Verifica se o usuário já tem um tenant (cadastro duplicado)
    const { data: existingProfile } = await supabasePublic
      .from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
    if (existingProfile?.tenant_id) {
      return res.status(409).json({ error: 'Esta conta Google já está associada a uma barbearia.' });
    }

    // Verifica se slug já existe
    const { data: existingSlug } = await supabase.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (existingSlug) return res.status(409).json({ error: 'Este endereço já está em uso. Escolha outro.' });

    // Verifica se o email já usou trial (anti-abuso)
    const { data: usedTrial } = await supabasePublic.from('used_trials').select('email').eq('email', email).maybeSingle();

    // Calcula datas do trial (10 dias apenas para novos; emails com trial anterior iniciam bloqueados)
    const trialEndsAt = new Date();
    if (!usedTrial) trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    const trialDate    = trialEndsAt.toISOString().split('T')[0];
    const initialStatus = usedTrial ? 'blocked' : 'trial';
    const initialPlan   = 'trial';

    // Cria o tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name,
        slug: slug.toLowerCase().trim(),
        phone: phone || '',
        address: '',
        status:  initialStatus,
        plan:    initialPlan,
        trial_ends_at: trialDate,
        mrr: 0,
      })
      .select()
      .single();

    if (tenantErr) throw tenantErr;

    // Atualiza user_metadata com role e tenant_id
    await supabasePublic.auth.admin.updateUserById(user.id, {
      user_metadata: {
        name:      name,
        role:      'tenant_admin',
        tenant_id: tenant.id,
      },
    });

    // Upsert do profile
    await supabasePublic.from('profiles').upsert({
      id:        user.id,
      name,
      email,
      role:      'tenant_admin',
      tenant_id: tenant.id,
    });

    // Cria cliente e assinatura no Asaas (não bloqueia o cadastro se falhar)
    let asaasSubscriptionId = null;
    try {
      const asaasCustomer   = await createAsaasCustomer({ name, email, phone });
      const subscription    = await createSubscription(asaasCustomer.id, 10);
      asaasSubscriptionId   = subscription.id;
      await supabase.from('tenants').update({
        asaas_customer_id:     asaasCustomer.id,
        asaas_subscription_id: asaasSubscriptionId,
      }).eq('id', tenant.id);
    } catch (asaasErr) {
      console.error('[RegisterGoogle] Asaas error (non-fatal):', asaasErr);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenant.id,
      user_id:   user.id,
      user_name: name,
      action:    'Cadastro via Google OAuth',
      details:   `Trial de 7 dias iniciado. Asaas subscription: ${asaasSubscriptionId ?? 'pendente'}`,
    });

    // Email de boas-vindas (non-fatal)
    sendWelcomeEmail(email, name, tenant.slug, trialDate).catch(err =>
      console.error('[RegisterGoogle] Email error (non-fatal):', err.message),
    );

    return res.status(201).json({
      ok:       true,
      tenantId: tenant.id,
      slug:     tenant.slug,
      trialEndsAt: trialDate,
      message:  'Cadastro realizado! Acesse o painel para configurar sua barbearia.',
    });

  } catch (err: any) {
    console.error('[RegisterGoogle] Error:', err);
    return res.status(500).json({ error: 'Erro interno ao processar cadastro. Tente novamente.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/asaas
// Recebe eventos do Asaas — ativa ou bloqueia tenants conforme pagamento
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/webhook/asaas', async (req, res) => {
  const receivedToken = (req.headers['asaas-access-token'] || req.headers['authorization'] || '') as string;
  console.log(`[Webhook] Recebido — token: ${receivedToken ? receivedToken.slice(0, 12) + '…' : '(none)'}`);

  // Verifica token de segurança se configurado
  if (WEBHOOK_SECRET) {
    if (receivedToken !== WEBHOOK_SECRET && receivedToken !== `Bearer ${WEBHOOK_SECRET}`) {
      console.warn(`[Webhook] Token inválido — esperado: ${WEBHOOK_SECRET.slice(0, 12)}…`);
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
      .select('id, name, status, subscription_ends_at')
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
        // Base = max(dias restantes do plano atual, dueDate do pagamento)
        // Garante que dias restantes não são perdidos ao trocar/renovar plano
        const today     = new Date();
        const dueBase   = payment?.dueDate ? new Date(payment.dueDate + 'T12:00:00Z') : today;
        const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at + 'T12:00:00Z') : today;
        const base = currentEnd > dueBase ? currentEnd : dueBase;
        base.setMonth(base.getMonth() + 1);
        const subscriptionEndsAt = base.toISOString().split('T')[0];
        await supabase.from('tenants').update({
          status: 'active',
          plan:   'mensal',
          mrr:    89.90,
          subscription_ends_at: subscriptionEndsAt,
        }).eq('id', tenant.id);
        newStatus  = 'active';
        logAction  = 'Pagamento confirmado';
        logDetails = `Asaas payment ${payment?.id} — R$ ${payment?.value?.toFixed(2)}. Plano ativo até ${subscriptionEndsAt}.`;
        // Email de confirmação (non-fatal)
        supabasePublic.from('profiles').select('email').eq('tenant_id', tenant.id).maybeSingle()
          .then(({ data }) => {
            if (data?.email) {
              sendPaymentConfirmedEmail(data.email, tenant.name, payment?.value ?? 89.90, subscriptionEndsAt)
                .catch(err => console.error('[Webhook] Payment email error:', err.message));
            }
          });
        break;
      }

      case 'PAYMENT_OVERDUE': {
        // Venceu sem pagamento → bloqueia
        await supabase.from('tenants').update({ status: 'blocked', mrr: 0 }).eq('id', tenant.id);
        newStatus  = 'blocked';
        logAction  = 'Pagamento vencido — acesso bloqueado';
        logDetails = `Asaas payment ${payment?.id} vencido em ${payment?.dueDate}. Tenant bloqueado.`;
        // Email de aviso (non-fatal)
        supabasePublic.from('profiles').select('email').eq('tenant_id', tenant.id).maybeSingle()
          .then(({ data }) => {
            if (data?.email) {
              sendPaymentOverdueEmail(data.email, tenant.name, payment?.dueDate ?? '')
                .catch(err => console.error('[Webhook] Overdue email error:', err.message));
            }
          });
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/billing/verify-payment
// Consulta o Asaas e ativa o tenant se houver pagamento confirmado
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/billing/verify-payment', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase
    .from('tenants').select('asaas_subscription_id, asaas_customer_id, status, subscription_ends_at').eq('id', tenantId).maybeSingle();

  if (!tenant?.asaas_customer_id && !tenant?.asaas_subscription_id) {
    return res.status(404).json({ error: 'Assinatura não encontrada.' });
  }

  try {
    const asaasUrl = process.env.ASAAS_SANDBOX === 'true'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';
    const key = process.env.ASAAS_API_KEY || '';

    const [rSub, rCust] = await Promise.all([
      tenant.asaas_subscription_id
        ? fetch(`${asaasUrl}/payments?subscription=${tenant.asaas_subscription_id}&limit=10`, { headers: { 'access_token': key } }).then(r => r.json())
        : { data: [] },
      tenant.asaas_customer_id
        ? fetch(`${asaasUrl}/payments?customer=${tenant.asaas_customer_id}&limit=10`, { headers: { 'access_token': key } }).then(r => r.json())
        : { data: [] },
    ]);

    const allPayments = [...(rSub?.data ?? []), ...(rCust?.data ?? [])];
    const seen = new Set();
    const unique = allPayments.filter((p: any) => !seen.has(p.id) && seen.add(p.id));
    const confirmed = unique.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');

    if (!confirmed) {
      return res.json({ activated: false, message: 'Nenhum pagamento confirmado encontrado.' });
    }

    const today2      = new Date();
    const dueBase2    = confirmed.dueDate ? new Date(confirmed.dueDate + 'T12:00:00Z') : today2;
    const currentEnd2 = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at + 'T12:00:00Z') : today2;
    const base2 = currentEnd2 > dueBase2 ? currentEnd2 : dueBase2;
    base2.setMonth(base2.getMonth() + 1);
    const subscriptionEndsAt = base2.toISOString().split('T')[0];
    await supabase.from('tenants').update({
      status: 'active', plan: 'mensal', mrr: 89.90,
      subscription_ends_at: subscriptionEndsAt,
    }).eq('id', tenantId);

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, user_name: 'Billing Verify',
      action: 'Pagamento verificado manualmente',
      details: `Payment ${confirmed.id} — R$ ${confirmed.value?.toFixed(2)}. Tenant ativado até ${subscriptionEndsAt}.`,
    });

    return res.json({ activated: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/payment-link
// Retorna o link de pagamento da cobrança pendente/vencida do tenant
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/billing/payment-link', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase
    .from('tenants').select('asaas_subscription_id, asaas_customer_id, plan').eq('id', tenantId).maybeSingle();

  if (!tenant?.asaas_subscription_id && !tenant?.asaas_customer_id) {
    return res.status(404).json({ error: 'Assinatura não encontrada.' });
  }

  try {
    const asaasUrl = process.env.ASAAS_SANDBOX === 'true'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';
    const key = process.env.ASAAS_API_KEY || '';

    const [rSub, rCust] = await Promise.all([
      tenant.asaas_subscription_id
        ? fetch(`${asaasUrl}/payments?subscription=${tenant.asaas_subscription_id}&limit=10`, { headers: { 'access_token': key } }).then(r => r.json())
        : { data: [] },
      tenant.asaas_customer_id
        ? fetch(`${asaasUrl}/payments?customer=${tenant.asaas_customer_id}&limit=10`, { headers: { 'access_token': key } }).then(r => r.json())
        : { data: [] },
    ]);

    const allPayments = [...(rSub?.data ?? []), ...(rCust?.data ?? [])];
    const seen = new Set();
    const unique = allPayments.filter((p: any) => !seen.has(p.id) && seen.add(p.id));

    const priority = ['OVERDUE', 'PENDING'];
    let payment = unique.find((p: any) => priority.includes(p.status));
    if (!payment) {
      payment = unique.sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];
    }

    if (!payment?.invoiceUrl) return res.status(404).json({ error: 'Nenhuma cobrança encontrada.' });

    return res.json({ url: payment.invoiceUrl, dueDate: payment.dueDate, value: payment.value });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/account
// Exclui todos os dados do tenant (LGPD) — irreversível
// ─────────────────────────────────────────────────────────────────────────────
app.delete('/api/account', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;

  try {
    const { data: tenant } = await supabase
      .from('tenants').select('id, slug, asaas_subscription_id').eq('id', tenantId).maybeSingle();

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' });

    // 1. Cancela assinatura no Asaas (non-fatal)
    if (tenant.asaas_subscription_id) {
      try { await cancelSubscription(tenant.asaas_subscription_id); } catch {}
    }

    // 2. Remove instância WhatsApp no EvoGo (non-fatal)
    if (EVO_URL && EVO_GLOBAL_KEY) {
      try {
        await fetch(`${EVO_URL}/instance/delete/${tenant.slug}`, {
          method: 'DELETE',
          headers: { apikey: EVO_GLOBAL_KEY },
        });
      } catch {}
    }

    // 3. Deleta dados do tenant em cascata (FK ON DELETE CASCADE cobre a maioria)
    // Deleta explicitamente audit_logs (sem FK para tenant)
    await supabasePublic.from('audit_logs').delete().eq('tenant_id', tenantId);

    // 4. Deleta o tenant (cascade: appointments, customers, services, professionals, etc.)
    await supabase.from('tenants').delete().eq('id', tenantId);

    // 5. Deleta usuários do auth vinculados ao tenant
    const { data: profiles } = await supabasePublic
      .from('profiles').select('id').eq('tenant_id', tenantId);

    for (const profile of profiles ?? []) {
      try { await supabasePublic.auth.admin.deleteUser(profile.id); } catch {}
    }

    console.log(`[Account] Tenant ${tenantId} (${tenant.slug}) excluído por solicitação LGPD.`);
    return res.json({ ok: true });

  } catch (err: any) {
    console.error('[Account] Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Templates de notificação WhatsApp — padrões editáveis por tenant
// ─────────────────────────────────────────────────────────────────────────────

const TPL_CONFIRM_DEFAULT = `Olá, {nome}
o seu agendamento está confirmado em {salao}

Serviço: {servico}
Quando: {data} às {hora}
Duração: {duracao} min
Profissional: {profissional}
Código: {codigo}

Gostaríamos de lembrar que caso não compareça no horário reservado, será cobrado o valor do serviço agendado. Agradecemos pela compreensão e estamos à disposição para qualquer dúvida!

Para mais informações ou cancelar o agendamento: {link}`;

const TPL_REMIND_DEFAULT = `Olá, {nome}
o seu agendamento está próximo em {salao}

Serviço: {servico}
Quando: {data} às {hora}
Duração: {duracao} min
Profissional: {profissional}
Código: {codigo}

Gostaríamos de lembrar que caso não compareça no horário reservado, será cobrado o valor do serviço agendado. Agradecemos pela compreensão e estamos à disposição para qualquer dúvida!

Para mais informações ou cancelar o agendamento: {link}`;

const DAYS_PT   = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatDatePT(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_PT[dow]}, ${d} de ${MONTHS_PT[m - 1]} de ${y}`;
}

function bookingCode(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

function buildLink(tenant: { slug: string }, appointmentId: string): string {
  return SITE_URL ? `${SITE_URL}/${tenant.slug}/cancelar/${appointmentId}` : '';
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((msg, [k, v]) => msg.replaceAll(`{${k}}`, v), tpl);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/templates?tenantId=xxx
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/whatsapp/templates', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data } = await supabase
    .from('tenants')
    .select('wpp_template_confirm, wpp_template_remind, wpp_booking_url, wpp_reminder_minutes')
    .eq('id', tenantId)
    .maybeSingle();
  res.json({
    ok: true,
    confirm:         data?.wpp_template_confirm   ?? TPL_CONFIRM_DEFAULT,
    remind:          data?.wpp_template_remind    ?? TPL_REMIND_DEFAULT,
    bookingUrl:      data?.wpp_booking_url        ?? '',
    reminderMinutes: data?.wpp_reminder_minutes   ?? 60,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/whatsapp/templates
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/whatsapp/templates', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { confirm, remind, bookingUrl, reminderMinutes } = req.body as { confirm?: string; remind?: string; bookingUrl?: string; reminderMinutes?: number };
  await supabase.from('tenants').update({
    wpp_template_confirm:  confirm          ?? null,
    wpp_template_remind:   remind           ?? null,
    wpp_booking_url:       bookingUrl       ?? null,
    wpp_reminder_minutes:  reminderMinutes  ?? 60,
  }).eq('id', tenantId);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/notify
// Envia confirmação de agendamento via WhatsApp.
// Chamado pelo frontend após criar um appointment.
// Não exige JWT — segurança garantida pela validação tenantId+appointmentId no DB.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/notify', async (req, res) => {
  const { tenantId, appointmentId } = req.body as { tenantId?: string; appointmentId?: string };
  if (!tenantId || !appointmentId) { res.status(400).json({ error: 'tenantId e appointmentId obrigatórios.' }); return; }
  if (!appointmentId) { res.status(400).json({ error: 'appointmentId obrigatório.' }); return; }

  try {
    const [apptRes, tenantRes] = await Promise.all([
      supabase.from('appointments')
        .select('*, services(name), professionals(name)')
        .eq('id', appointmentId).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('tenants')
        .select('name, slug, wpp_template_confirm, wpp_booking_url, contact_email')
        .eq('id', tenantId).maybeSingle(),
    ]);

    const appt   = apptRes.data;
    const tenant = tenantRes.data;
    if (!appt || !tenant) { res.status(404).json({ error: 'Dados não encontrados.' }); return; }

    const phone = appt.customer_phone?.replace(/\D/g, '');
    const code  = bookingCode(appt.id);
    const link  = buildLink(tenant, appt.id);
    const vars  = {
      nome:          appt.customer_name    ?? '',
      salao:         tenant.name           ?? '',
      servico:       (appt.services as any)?.name      ?? '',
      data:          formatDatePT(appt.scheduled_date),
      hora:          appt.scheduled_time?.slice(0,5)   ?? '',
      duracao:       String(appt.duration_minutes),
      profissional:  (appt.professionals as any)?.name ?? '',
      codigo:        code,
      link,
    };

    // WhatsApp (se tem telefone)
    if (phone) {
      const msg           = applyTemplate(tenant.wpp_template_confirm ?? TPL_CONFIRM_DEFAULT, vars);
      const instanceToken = evoInstanceToken(tenant.slug, tenantId);
      await evoInstance(instanceToken, '/send/text', {
        method: 'POST',
        body: JSON.stringify({ instanceId: tenant.slug, number: `55${phone}`, text: msg }),
      });
      await supabase.from('appointments').update({ wpp_confirm_sent: true }).eq('id', appointmentId);
    }

    // Email (se tem email e ainda não foi enviado)
    if (appt.customer_email && !appt.email_confirm_sent) {
      const replyTo = await getTenantReplyEmail(tenantId, tenant.contact_email);
      sendBookingConfirmationEmail({
        to:             appt.customer_email,
        replyTo,
        customerName:   appt.customer_name              ?? '',
        salonName:      tenant.name                      ?? '',
        service:        (appt.services as any)?.name     ?? '',
        professional:   (appt.professionals as any)?.name ?? '',
        date:           formatDatePT(appt.scheduled_date),
        time:           appt.scheduled_time?.slice(0, 5) ?? '',
        durationMinutes: appt.duration_minutes,
        code,
        cancelLink:     link,
      })
      .then(() => supabase.from('appointments').update({ email_confirm_sent: true }).eq('id', appointmentId))
      .catch(err => console.error('[Notify] Email error:', err.message));
    }

    if (!phone && !appt.customer_email) {
      res.json({ ok: true, skipped: 'sem telefone e sem email' }); return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Notify]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/remind  — envia lembrete manualmente para um agendamento
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/remind', async (req, res) => {
  const { tenantId, appointmentId } = req.body as { tenantId?: string; appointmentId?: string };
  if (!tenantId || !appointmentId) { res.status(400).json({ error: 'tenantId e appointmentId obrigatórios.' }); return; }

  try {
    const [apptRes, tenantRes] = await Promise.all([
      supabase.from('appointments')
        .select('*, services(name), professionals(name)')
        .eq('id', appointmentId).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('tenants')
        .select('name, slug, wpp_template_remind, wpp_booking_url')
        .eq('id', tenantId).maybeSingle(),
    ]);

    const appt   = apptRes.data;
    const tenant = tenantRes.data;
    if (!appt || !tenant) { res.status(404).json({ error: 'Dados não encontrados.' }); return; }

    const phone = appt.customer_phone?.replace(/\D/g, '');
    if (!phone) { res.json({ ok: true, skipped: 'sem telefone' }); return; }

    const code  = bookingCode(appt.id);
    const link  = buildLink(tenant, appt.id);
    const vars  = {
      nome:         appt.customer_name              ?? '',
      salao:        tenant.name                     ?? '',
      servico:      (appt.services as any)?.name    ?? '',
      data:         formatDatePT(appt.scheduled_date),
      hora:         appt.scheduled_time?.slice(0,5) ?? '',
      duracao:      String(appt.duration_minutes),
      profissional: (appt.professionals as any)?.name ?? '',
      codigo:       code,
      link,
    };

    const msg           = applyTemplate(tenant.wpp_template_remind ?? TPL_REMIND_DEFAULT, vars);
    const instanceToken = evoInstanceToken(tenant.slug, tenantId);

    await evoInstance(instanceToken, '/send/text', {
      method: 'POST',
      body: JSON.stringify({ instanceId: tenant.slug, number: `55${phone}`, text: msg }),
    });

    await supabase.from('appointments').update({ wpp_reminder_sent: true }).eq('id', appointmentId);

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Remind]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp / Evolution Go — helpers de servidor
// O EVO_GLOBAL_KEY nunca é exposto ao frontend.
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o email de resposta do tenant: contact_email configurado ou email do perfil admin */
async function getTenantReplyEmail(tenantId: string, contactEmail?: string | null): Promise<string> {
  if (contactEmail) return contactEmail;
  const { data } = await supabasePublic
    .from('profiles')
    .select('email')
    .eq('tenant_id', tenantId)
    .eq('role', 'tenant_admin')
    .maybeSingle();
  return data?.email ?? 'noreply@workagenda.org';
}

/** Token determinístico por tenant: slug + primeiros 8 chars do id sem hífens */
function evoInstanceToken(slug: string, tenantId: string): string {
  return slug + '-' + tenantId.replace(/-/g, '').slice(0, 8);
}

/** Operações admin (global key): /instance/all, /instance/create, /instance/delete */
async function evoAdmin<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!EVO_URL || !EVO_GLOBAL_KEY) throw new Error('EvoGo não configurado (EVO_URL / EVO_GLOBAL_KEY).');
  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'apikey': EVO_GLOBAL_KEY, ...(options.headers as object ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`[EvoGo ${res.status}] ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Operações de instância (token da instância): /instance/status, /instance/qr, /send/text */
async function evoInstance<T = unknown>(instanceToken: string, path: string, options: RequestInit = {}): Promise<T> {
  if (!EVO_URL) throw new Error('EvoGo não configurado (EVO_URL).');
  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'apikey': instanceToken, ...(options.headers as object ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`[EvoGo ${res.status}] ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Garante que a instância existe; usa /instance/all para verificar (global key) */
async function ensureInstance(instanceName: string, token: string): Promise<void> {
  const all = await evoAdmin<{ data: any[] }>('/instance/all');
  const exists = (all.data ?? []).some((i: any) => i.name === instanceName);
  if (!exists) {
    await evoAdmin('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ name: instanceName, token }),
    });
  }
}

/** Middleware: verifica JWT Supabase e confirma acesso ao tenant solicitado */
async function verifyTenant(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido.' });
    return;
  }
  const { data: { user }, error } = await supabasePublic.auth.getUser(auth.slice(7));
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }
  const tenantId = (req.query.tenantId as string) || (req.body?.tenantId as string);
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId é obrigatório.' });
    return;
  }
  const role         = user.user_metadata?.role as string | undefined;
  const userTenantId = user.user_metadata?.tenant_id as string | undefined;
  if (role !== 'super_admin' && userTenantId !== tenantId) {
    res.status(403).json({ error: 'Sem permissão para este tenant.' });
    return;
  }
  (req as any).verifiedTenantId = tenantId;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/status?tenantId=xxx
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/whatsapp/status', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado.' }); return; }

  if (!EVO_URL || !EVO_GLOBAL_KEY) {
    res.json({ ok: true, connected: false, loggedIn: false, name: null });
    return;
  }

  const instanceToken = evoInstanceToken(tenant.slug, tenantId);
  try {
    const data = await evoInstance<{ data: { Connected: boolean; LoggedIn: boolean; Name: string } }>(
      instanceToken, `/instance/status?instanceId=${tenant.slug}`
    );
    const loggedIn = !!data?.data?.LoggedIn;
    // Reconectou → limpa o timestamp de desconexão
    if (loggedIn) {
      await supabase.from('tenants').update({ evo_disconnected_at: null }).eq('id', tenantId);
    }
    res.json({ ok: true, connected: !!data?.data?.Connected, loggedIn, name: data?.data?.Name || null });
  } catch {
    res.json({ ok: true, connected: false, loggedIn: false, name: null });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/whatsapp/qr?tenantId=xxx
// Auto-cria a instância se necessário e retorna o QR Code.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/whatsapp/qr', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado.' }); return; }

  if (!EVO_URL || !EVO_GLOBAL_KEY) {
    res.status(503).json({ error: 'WhatsApp não configurado. Contate o suporte.' });
    return;
  }

  const instanceName  = tenant.slug;
  const instanceToken = evoInstanceToken(tenant.slug, tenantId);

  try {
    await ensureInstance(instanceName, instanceToken);
    const data = await evoInstance<{ data: { Qrcode: string; Code: string } }>(
      instanceToken, `/instance/qr?instanceId=${instanceName}`
    );
    if (data?.data?.Qrcode) {
      res.json({ ok: true, qrcode: data.data.Qrcode, code: data.data.Code || '' });
    } else {
      // Já conectado — sem QR
      res.json({ ok: true, qrcode: null, code: '' });
    }
  } catch (err: any) {
    console.error('[WhatsApp QR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/disconnect
// Faz logout do WhatsApp mantendo a instância no EvoGo.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/disconnect', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado.' }); return; }

  const instanceToken = evoInstanceToken(tenant.slug, tenantId);

  try {
    await evoInstance(instanceToken, '/instance/disconnect', {
      method: 'POST',
      body: JSON.stringify({ instanceId: tenant.slug }),
    });
    // Registra quando foi desconectado para o job de limpeza de 30 dias
    await supabase.from('tenants').update({ evo_disconnected_at: new Date().toISOString() }).eq('id', tenantId);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[WhatsApp Disconnect]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/send
// Envia mensagem de texto via instância do tenant.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/send', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message) { res.status(400).json({ error: 'phone e message são obrigatórios.' }); return; }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado.' }); return; }

  const instanceToken = evoInstanceToken(tenant.slug, tenantId);
  try {
    await evoInstance(instanceToken, '/send/text', {
      method: 'POST',
      body: JSON.stringify({ instanceId: tenant.slug, number: phone, text: message }),
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[WhatsApp Send]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cancel
// Cancela agendamento publicamente (sem auth) — usa service key para bypasaar RLS.
// Segurança: verifica que o appointmentId pertence ao slug informado.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cancel', async (req, res) => {
  const { slug, appointmentId } = req.body as { slug?: string; appointmentId?: string };
  if (!slug || !appointmentId) {
    res.status(400).json({ error: 'slug e appointmentId obrigatórios.' });
    return;
  }

  try {
    // Verifica que o agendamento pertence ao tenant com este slug
    const { data: appt } = await supabase
      .from('appointments')
      .select('id, status, tenant_id, tenants(slug)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appt) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
    if ((appt.tenants as any)?.slug !== slug) { res.status(403).json({ error: 'Acesso negado.' }); return; }
    if (appt.status === 'cancelled')  { res.json({ ok: true, alreadyCancelled: true }); return; }
    if (appt.status === 'attended' || appt.status === 'completed') {
      res.status(400).json({ error: 'Agendamento já realizado, não pode ser cancelado.' });
      return;
    }

    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Cancel]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Job diário: remove instâncias EvoGo desconectadas há mais de 30 dias
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupStaleInstances(): Promise<void> {
  if (!EVO_URL || !EVO_GLOBAL_KEY) return;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from('tenants')
    .select('id, slug')
    .not('evo_disconnected_at', 'is', null)
    .lt('evo_disconnected_at', cutoff);

  if (!stale?.length) { console.log('[Cleanup] Nenhuma instância para remover.'); return; }

  const all = await evoAdmin<{ data: any[] }>('/instance/all').catch(() => ({ data: [] }));

  for (const tenant of stale) {
    try {
      const inst = (all.data ?? []).find((i: any) => i.name === tenant.slug);
      if (inst?.id) {
        await evoAdmin(`/instance/delete/${inst.id}`, { method: 'DELETE' });
        console.log(`[Cleanup] Instância "${tenant.slug}" removida (desconectada > 30 dias).`);
      }
      await supabase.from('tenants').update({ evo_disconnected_at: null }).eq('id', tenant.id);
    } catch (err: any) {
      console.error(`[Cleanup] Erro ao remover "${tenant.slug}":`, err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Job a cada 1 min: envia confirmação para agendamentos novos ainda não notificados
// ─────────────────────────────────────────────────────────────────────────────
async function sendConfirmations(): Promise<void> {
  if (!EVO_URL || !EVO_GLOBAL_KEY) return;

  // Agendamentos criados nos últimos 10 minutos sem confirmação enviada
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: appts } = await supabase
    .from('appointments')
    .select('*, tenants(id, name, slug, wpp_template_confirm, wpp_booking_url, contact_email), services(name), professionals(name)')
    .eq('wpp_confirm_sent', false)
    .neq('status', 'cancelled')
    .gte('created_at', since);

  for (const appt of appts ?? []) {
    const tenant = (appt.tenants as any);
    if (!tenant) continue;
    const phone = appt.customer_phone?.replace(/\D/g, '');
    if (!phone) continue;

    try {
      const code = bookingCode(appt.id);
      const link = buildLink(tenant, appt.id);
      const vars = {
        nome:         appt.customer_name                  ?? '',
        salao:        tenant.name                         ?? '',
        servico:      (appt.services as any)?.name        ?? '',
        data:         formatDatePT(appt.scheduled_date),
        hora:         appt.scheduled_time?.slice(0, 5)    ?? '',
        duracao:      String(appt.duration_minutes),
        profissional: (appt.professionals as any)?.name   ?? '',
        codigo:       code,
        link,
      };
      const msg           = applyTemplate(tenant.wpp_template_confirm ?? TPL_CONFIRM_DEFAULT, vars);
      const instanceToken = evoInstanceToken(tenant.slug, tenant.id);

      await evoInstance(instanceToken, '/send/text', {
        method: 'POST',
        body: JSON.stringify({ instanceId: tenant.slug, number: `55${phone}`, text: msg }),
      });

      await supabase.from('appointments').update({ wpp_confirm_sent: true }).eq('id', appt.id);
      console.log(`[Confirm] Confirmação enviada: ${appt.customer_name} (${appt.scheduled_date} ${appt.scheduled_time?.slice(0,5)})`);

      // Email de confirmação (se o cliente informou email e ainda não foi enviado)
      if (appt.customer_email && !appt.email_confirm_sent) {
        const replyTo = await getTenantReplyEmail(tenant.id, tenant.contact_email);
        sendBookingConfirmationEmail({
          to:             appt.customer_email,
          replyTo,
          customerName:   appt.customer_name          ?? '',
          salonName:      tenant.name                  ?? '',
          service:        (appt.services as any)?.name ?? '',
          professional:   (appt.professionals as any)?.name ?? '',
          date:           formatDatePT(appt.scheduled_date),
          time:           appt.scheduled_time?.slice(0, 5) ?? '',
          durationMinutes: appt.duration_minutes,
          code:           bookingCode(appt.id),
          cancelLink:     buildLink(tenant, appt.id),
        })
        .then(() => supabase.from('appointments').update({ email_confirm_sent: true }).eq('id', appt.id))
        .catch(err => console.error(`[Confirm] Email error para ${appt.customer_name}:`, err.message));
      }
    } catch (err: any) {
      console.error(`[Confirm] Erro ao enviar para ${appt.customer_name}:`, err.message);
    }
  }
}

// Job a cada 5 min: envia lembrete antes do atendimento (tempo configurável por tenant)
// ─────────────────────────────────────────────────────────────────────────────
// Brasília = UTC-3
const BRASILIA_MS = -3 * 60 * 60 * 1000;
function nowBrasilia(): Date { return new Date(Date.now() + BRASILIA_MS); }
function toBrasiliaStr(d: Date) { return new Date(d.getTime() + BRASILIA_MS).toISOString(); }

async function sendReminders(): Promise<void> {
  if (!EVO_URL || !EVO_GLOBAL_KEY) return;

  // Data de hoje em horário de Brasília
  const todayBrasilia = toBrasiliaStr(new Date()).split('T')[0];

  const { data: appts } = await supabase
    .from('appointments')
    .select('*, tenants(id, name, slug, wpp_template_remind, wpp_booking_url, wpp_reminder_minutes), services(name), professionals(name)')
    .eq('wpp_reminder_sent', false)
    .neq('status', 'cancelled')
    .gte('scheduled_date', todayBrasilia);

  // "Agora" em horário de Brasília
  const now = nowBrasilia();

  for (const appt of appts ?? []) {
    const tenant = appt.tenants as any;
    // Janela ±5 min em torno do tempo configurado pelo tenant (padrão 60 min)
    const reminderMin = Number(tenant?.wpp_reminder_minutes ?? 60);
    // lo/hi já estão em Brasília (comparação direta com scheduled_time)
    const lo = new Date(now.getTime() + (reminderMin - 5) * 60_000);
    const hi = new Date(now.getTime() + (reminderMin + 5) * 60_000);
    const loDate = lo.toISOString().split('T')[0];
    const hiDate = hi.toISOString().split('T')[0];
    const loTime = lo.toISOString().split('T')[1].slice(0, 5);
    const hiTime = hi.toISOString().split('T')[1].slice(0, 5);

    // Filtra pela janela de hora do tenant
    const apptTime = appt.scheduled_time?.slice(0, 5) ?? '';
    if (appt.scheduled_date < loDate || appt.scheduled_date > hiDate) continue;
    if (appt.scheduled_date === loDate && apptTime < loTime) continue;
    if (appt.scheduled_date === hiDate && apptTime > hiTime) continue;

    if (!tenant) continue;

    const phone = appt.customer_phone?.replace(/\D/g, '');
    if (!phone) continue;

    try {
      const code  = bookingCode(appt.id);
      const link  = buildLink(tenant, appt.id);
      const vars  = {
        nome:         appt.customer_name             ?? '',
        salao:        tenant.name                    ?? '',
        servico:      (appt.services as any)?.name      ?? '',
        data:         formatDatePT(appt.scheduled_date),
        hora:         apptTime,
        duracao:      String(appt.duration_minutes),
        profissional: (appt.professionals as any)?.name ?? '',
        codigo:       code,
        link,
      };
      const msg           = applyTemplate(tenant.wpp_template_remind ?? TPL_REMIND_DEFAULT, vars);
      const instanceToken = evoInstanceToken(tenant.slug, tenant.id);

      await evoInstance(instanceToken, '/send/text', {
        method: 'POST',
        body: JSON.stringify({ instanceId: tenant.slug, number: `55${phone}`, text: msg }),
      });

      await supabase.from('appointments').update({ wpp_reminder_sent: true }).eq('id', appt.id);
      console.log(`[Reminder] Lembrete enviado: ${appt.customer_name} (${appt.scheduled_date} ${apptTime})`);
    } catch (err: any) {
      console.error(`[Reminder] Erro ao enviar para ${appt.customer_name}:`, err.message);
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] WorkAgenda API rodando na porta ${PORT}`);
  console.log(`[Server] Supabase: ${SUPABASE_URL ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Asaas: ${process.env.ASAAS_API_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Modo: ${process.env.ASAAS_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUÇÃO'}`);
  console.log(`[Server] EvoGo: ${EVO_URL && EVO_GLOBAL_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Resend: ${process.env.RESEND_API_KEY ? '✓' : '✗ não configurado'}`);

  // Cleanup de instâncias: 1 min após boot, depois a cada 24h
  setTimeout(() => {
    cleanupStaleInstances();
    setInterval(cleanupStaleInstances, 24 * 60 * 60 * 1000);
  }, 60_000);

  // Confirmações de agendamentos novos: a cada 1 min
  sendConfirmations(); // roda imediatamente no boot
  setInterval(sendConfirmations, 60_000);

  // Lembretes 1h antes: a cada 5 min
  setInterval(sendReminders, 5 * 60_000);
});
