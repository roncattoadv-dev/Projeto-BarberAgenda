// server/index.ts
// Backend Express — duas responsabilidades:
//  1. POST /api/register  → cadastro de nova barbearia (trial)
//  2. POST /api/webhook/asaas → recebe eventos do Asaas e ativa/bloqueia tenants
//
// Rodar: npx tsx server/index.ts
// Build: npx esbuild server/index.ts --bundle --platform=node --outfile=server.js

import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import {
  createAsaasCustomer,
  createSubscription,
  cancelSubscription,
  getPendingPaymentLink,
  PLAN_PRICES,
  type AsaasWebhookPayload,
} from './asaas';
import {
  sendWelcomeEmail,
  sendPaymentConfirmedEmail,
  sendPaymentOverdueEmail,
  sendBookingConfirmationEmail,
  sendEmailVerificationEmail,
  generateMarketingHtml,
  sendMarketingEmail,
} from './email';

// ── Config ────────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.PORT || process.env.SERVER_PORT || '4000');
const SUPABASE_URL    = process.env.SUPABASE_URL    || '';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || ''; // service_role key (bypass RLS)
const WEBHOOK_SECRET  = process.env.ASAAS_WEBHOOK_SECRET || '';
const EVO_URL         = (process.env.EVO_URL || '').replace(/\/$/, '');
const EVO_GLOBAL_KEY  = process.env.EVO_GLOBAL_KEY || process.env.EVO_APIKEY || '';
const SITE_URL        = (process.env.SITE_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
const API_PUBLIC_URL  = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');

// Modo Asaas — pode ser alternado em runtime via /api/admin/asaas-mode
let asaasSandboxOverride: boolean | null = null;
function isAsaasSandbox() {
  return asaasSandboxOverride !== null ? asaasSandboxOverride : process.env.ASAAS_SANDBOX === 'true';
}
function getAsaasKey() {
  return isAsaasSandbox()
    ? (process.env.ASAAS_SANDBOX_KEY || process.env.ASAAS_API_KEY || '')
    : (process.env.ASAAS_API_KEY || '');
}
function getAsaasUrl() {
  return isAsaasSandbox() ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
}

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
const CORS_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'https://workagenda.org',
].filter(Boolean) as string[];

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origem não permitida — ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Rate limiting — público (registro, booking, cancelamento, emails)
const publicLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

// Rate limiting restrito — endpoints que disparam WhatsApp/email
const strictLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de envios atingido. Tente novamente em 1 hora.' },
});

app.use('/api/register',          publicLimit);
app.use('/api/booking',           publicLimit);
app.use('/api/appointments',      publicLimit);
app.use('/api/whatsapp/remind',   strictLimit);
app.use('/api/whatsapp/notify',   strictLimit);
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/whatsapp')) {
    console.log(`[HTTP] ${req.method} ${req.path} auth=${req.headers.authorization?.slice(0,20)}...`);
  }
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Proxy de verificação de email ─────────────────────────────────────────────
// Recebe token da URL do email e redireciona internamente para o Supabase Auth,
// mantendo a URL pública limpa (api.workagenda.org em vez de kong:8000)
app.get('/api/verify-email', async (req, res) => {
  const { token, redirect_to } = req.query as Record<string, string>;
  if (!token) return res.status(400).send('Token inválido ou ausente.');

  const safeRedirect = redirect_to?.startsWith(SITE_URL) ? redirect_to : `${SITE_URL}/login`;
  const internalUrl  = `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(token)}&type=signup&redirect_to=${encodeURIComponent(safeRedirect)}`;

  try {
    const r = await fetch(internalUrl, { redirect: 'manual' });
    const location = r.headers.get('location');
    if (location) return res.redirect(location);
    // Supabase retornou sem redirect → erro
    return res.redirect(`${SITE_URL}/login?error=email_verification_failed`);
  } catch (err: any) {
    console.error('[VerifyEmail] Proxy error:', err.message);
    return res.redirect(`${SITE_URL}/login?error=email_verification_failed`);
  }
});

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

    // 3. Calcula datas do trial (7 dias para novos; emails com trial anterior iniciam bloqueados)
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

    // 4. Cria usuário no Supabase Auth (sem confirmar — requer verificação de email)
    const { data: authUser, error: authErr } = await supabasePublic.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
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

    // 6. Gera link de verificação e envia email customizado
    try {
      const { data: linkData } = await supabasePublic.auth.admin.generateLink({
        type: 'signup',
        email,
        options: { redirectTo: `${SITE_URL}/login` },
      });
      const actionLink = (linkData as any)?.properties?.action_link as string | undefined;
      if (actionLink) {
        // Extrai o token interno e constrói URL limpa via proxy próprio
        const parsed = new URL(actionLink);
        const token  = parsed.searchParams.get('token') || parsed.searchParams.get('hashed_token') || '';
        const cleanUrl = `${API_PUBLIC_URL}/api/verify-email?token=${encodeURIComponent(token)}&redirect_to=${encodeURIComponent(`${SITE_URL}/login`)}`;
        await sendEmailVerificationEmail(email, name, cleanUrl);
      }
    } catch (verifyErr: any) {
      console.error('[Register] Verification email error (non-fatal):', verifyErr.message);
    }

    // 8. Cria cliente e assinatura no Asaas
    // trialDays: 7 para novos tenants; 0 para bloqueados (cobrança vence hoje, pagamento imediato)
    let asaasCustomerId    = null;
    let asaasSubscriptionId = null;

    try {
      const asaasCustomer = await createAsaasCustomer({ name, email, phone, cpfCnpj, tenantId: tenant.id });
      asaasCustomerId     = asaasCustomer.id;
      // Salva customer_id imediatamente — evita criar duplicata se subscription falhar
      await supabase.from('tenants').update({ asaas_customer_id: asaasCustomerId }).eq('id', tenant.id);

      const subscription    = await createSubscription(asaasCustomer.id, 'mensal', usedTrial ? 0 : 7);
      asaasSubscriptionId   = subscription.id;

      await supabase.from('tenants').update({ asaas_subscription_id: asaasSubscriptionId }).eq('id', tenant.id);
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
      ok:                    true,
      needsEmailVerification: true,
      tenantId:              tenant.id,
      slug:                  tenant.slug,
      trialEndsAt:           trialDate,
      message:               'Cadastro realizado! Confirme seu email para acessar o painel.',
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

    const asaasBase = getAsaasUrl();
    const asaasKey  = getAsaasKey();

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

    // Verifica assinatura existente — reutiliza somente se ciclo for o mesmo
    if (tenant.asaas_subscription_id) {
      try {
        const subRes = await fetch(`${asaasBase}/subscriptions/${tenant.asaas_subscription_id}`, {
          headers: { 'access_token': asaasKey },
        });
        const sub = subRes.ok ? await subRes.json() : null;
        const requestedCycle = PLAN_PRICES[plan]?.cycle ?? 'MONTHLY';
        const sameCycle = sub?.cycle === requestedCycle;

        if (sub && sub.billingType === 'UNDEFINED' && sameCycle) {
          // Mesmo plano — reutiliza cobrança pendente
          const payment = await getPendingPaymentId(tenant.asaas_subscription_id);
          if (payment) {
            const pix = await getPixForPayment(payment.id);
            return res.json({ url: payment.invoiceUrl || payment.bankSlipUrl, ...pix });
          }
        } else if (sub) {
          // Plano diferente ou tipo errado — cancela para recriar com o novo ciclo
          console.log(`[PaymentLink] Trocando plano: ${sub.cycle} → ${requestedCycle}`);
          await fetch(`${asaasBase}/subscriptions/${tenant.asaas_subscription_id}`, {
            method: 'DELETE', headers: { 'access_token': asaasKey },
          }).catch(() => {});
          await supabase.from('tenants').update({ asaas_subscription_id: null }).eq('id', tenantId);
        }
      } catch {}
    }

    // Cria ou reutiliza cliente no Asaas
    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      // Verifica se já existe cliente com externalReference = tenantId (evita duplicata)
      const existingRes = await fetch(`${asaasBase}/customers?externalReference=${tenant.id}&limit=1`, {
        headers: { 'access_token': asaasKey },
      });
      const existingData = existingRes.ok ? await existingRes.json() : null;
      const existing = existingData?.data?.[0];
      if (existing) {
        customerId = existing.id;
      } else {
        const customer = await createAsaasCustomer({ name: tenant.name, email: user.email!, cpfCnpj, tenantId: tenant.id });
        customerId = customer.id;
      }
      // Salva imediatamente — evita criar duplicata se a subscription falhar a seguir
      await supabase.from('tenants').update({ asaas_customer_id: customerId }).eq('id', tenantId);
    }

    if (cpfCnpj) {
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
      plan,
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
    const { data: tenant } = await supabase
      .from('tenants').select('id, slug, asaas_subscription_id').eq('id', tenantId).maybeSingle();
    if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });

    const { data: callerProfile } = await supabasePublic
      .from('profiles').select('tenant_id, role').eq('id', user.id).maybeSingle();
    const isSuperAdmin = callerProfile?.role === 'super_admin';
    if (!isSuperAdmin && callerProfile?.tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    // Busca TODOS os profiles do tenant ANTES de deletar qualquer dado
    const { data: allProfiles } = await supabasePublic
      .from('profiles').select('id, role, email').eq('tenant_id', tenantId);

    const adminProfile = allProfiles?.find(p => p.role === 'tenant_admin');
    const adminEmail   = adminProfile
      ? (await supabasePublic.auth.admin.getUserById(adminProfile.id).then(r => r.data.user?.email ?? '')).catch(() => '') ?? ''
      : '';

    // Registra email em used_trials ANTES de deletar (impede abuso de trial)
    if (adminEmail) {
      await supabasePublic.from('used_trials').upsert({ email: adminEmail, deleted_at: new Date().toISOString() });
    }

    // 1. Cancela assinatura Asaas (non-fatal)
    if (tenant.asaas_subscription_id) {
      try { await cancelSubscription(tenant.asaas_subscription_id); } catch {}
    }

    // 2. Remove instância WhatsApp no EvoGo (non-fatal)
    if (EVO_URL && EVO_GLOBAL_KEY && tenant.slug) {
      try {
        await fetch(`${EVO_URL}/instance/delete/${tenant.slug}`, {
          method: 'DELETE',
          headers: { apikey: EVO_GLOBAL_KEY },
        });
      } catch {}
    }

    // 3. Deleta audit_logs (sem FK para tenant, precisa ser explícito)
    await supabasePublic.from('audit_logs').delete().eq('tenant_id', tenantId);

    // 4. Deleta tenant — CASCADE remove appointments, professionals, services, etc.
    await supabase.from('tenants').delete().eq('id', tenantId);

    // 5. Deleta profiles (podem ter sido cascadeados mas garante explicitamente)
    await supabasePublic.from('profiles').delete().eq('tenant_id', tenantId);

    // 6. Deleta TODOS os auth users do tenant (admin + profissionais)
    for (const p of allProfiles ?? []) {
      try { await supabasePublic.auth.admin.deleteUser(p.id); } catch {}
    }

    console.log(`[DeleteAccount] Tenant ${tenantId} (${tenant.slug}) excluído. Users: ${(allProfiles ?? []).length}`);
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

    // Calcula datas do trial (7 dias para novos; emails com trial anterior iniciam bloqueados)
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
    const { error: metaErr } = await supabasePublic.auth.admin.updateUserById(user.id, {
      user_metadata: { name, role: 'tenant_admin', tenant_id: tenant.id },
    });
    if (metaErr) {
      // Rollback: remove tenant órfão
      await supabase.from('tenants').delete().eq('id', tenant.id);
      throw metaErr;
    }

    // Upsert do profile
    const { error: profileErr } = await supabasePublic.from('profiles').upsert({
      id: user.id, name, email, role: 'tenant_admin', tenant_id: tenant.id,
    });
    if (profileErr) {
      // Rollback: remove tenant e reverte metadata
      await supabase.from('tenants').delete().eq('id', tenant.id);
      await supabasePublic.auth.admin.updateUserById(user.id, {
        user_metadata: { name, role: 'tenant_admin', tenant_id: null },
      }).catch(() => {});
      throw profileErr;
    }

    // Cria cliente e assinatura no Asaas (não bloqueia o cadastro se falhar)
    // trialDays: 7 para novos tenants; 0 para bloqueados (cobrança vence hoje)
    let asaasSubscriptionId = null;
    try {
      const asaasCustomer   = await createAsaasCustomer({ name, email, phone, tenantId: tenant.id });
      // Salva customer_id imediatamente — evita criar duplicata se subscription falhar
      await supabase.from('tenants').update({ asaas_customer_id: asaasCustomer.id }).eq('id', tenant.id);

      const subscription    = await createSubscription(asaasCustomer.id, 'mensal', usedTrial ? 0 : 7);
      asaasSubscriptionId   = subscription.id;
      await supabase.from('tenants').update({ asaas_subscription_id: asaasSubscriptionId }).eq('id', tenant.id);
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
      .select('id, name, status, plan, subscription_ends_at')
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
        // Determina quantos meses adicionar conforme o plano armazenado no tenant
        const planInfo   = PLAN_PRICES[tenant.plan ?? ''] ?? PLAN_PRICES.mensal;
        const planMonths = planInfo.months; // 1 = mensal, 3 = trimestral, 12 = anual
        const planName   = tenant.plan && PLAN_PRICES[tenant.plan] ? tenant.plan : 'mensal';
        const monthlyValue = planInfo.months > 0
          ? parseFloat((payment?.value ?? 89.90) / planInfo.months).toFixed(2)
          : 89.90;

        // Base = max(dias restantes do plano atual, dueDate do pagamento)
        const today     = new Date();
        const dueBase   = payment?.dueDate ? new Date(payment.dueDate + 'T12:00:00Z') : today;
        const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at + 'T12:00:00Z') : today;
        const base = currentEnd > dueBase ? currentEnd : dueBase;
        base.setMonth(base.getMonth() + planMonths);
        const subscriptionEndsAt = base.toISOString().split('T')[0];
        await supabase.from('tenants').update({
          status: 'active',
          plan:   planName,
          mrr:    parseFloat(monthlyValue as string),
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
    .from('tenants').select('asaas_subscription_id, asaas_customer_id, status, plan, subscription_ends_at').eq('id', tenantId).maybeSingle();

  if (!tenant?.asaas_customer_id && !tenant?.asaas_subscription_id) {
    return res.status(404).json({ error: 'Assinatura não encontrada.' });
  }

  try {
    const asaasUrl = getAsaasUrl();
    const key = getAsaasKey();

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
    // Ordena por dueDate desc para pegar o pagamento mais recente confirmado
    const confirmed = unique
      .filter((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED')
      .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];

    if (!confirmed) {
      return res.json({ activated: false, message: 'Nenhum pagamento confirmado encontrado.' });
    }

    const planInfo   = PLAN_PRICES[tenant.plan ?? ''] ?? PLAN_PRICES.mensal;
    const planMonths = planInfo.months;
    const planName   = tenant.plan && PLAN_PRICES[tenant.plan] ? tenant.plan : 'mensal';
    const mrr        = parseFloat(((confirmed.value ?? 89.90) / planMonths).toFixed(2));

    const today2      = new Date();
    const dueBase2    = confirmed.dueDate ? new Date(confirmed.dueDate + 'T12:00:00Z') : today2;
    const currentEnd2 = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at + 'T12:00:00Z') : today2;
    const base2 = currentEnd2 > dueBase2 ? currentEnd2 : dueBase2;
    base2.setMonth(base2.getMonth() + planMonths);
    const subscriptionEndsAt = base2.toISOString().split('T')[0];

    await supabase.from('tenants').update({
      status: 'active', plan: planName, mrr,
      subscription_ends_at: subscriptionEndsAt,
    }).eq('id', tenantId);

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId, user_name: 'Billing Verify',
      action: 'Pagamento verificado manualmente',
      details: `Payment ${confirmed.id} — R$ ${confirmed.value?.toFixed(2)} (${planName}, ${planMonths}m). Tenant ativado até ${subscriptionEndsAt}.`,
    });

    return res.json({ activated: true });
  } catch (err: any) {
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
  const base = API_PUBLIC_URL || SITE_URL;
  return base ? `${base}/api/og/${tenant.slug}/cancelar/${appointmentId}` : '';
}

function buildCancelUrl(slug: string, appointmentId: string): string {
  return SITE_URL ? `${SITE_URL}/${slug}/cancelar/${appointmentId}` : '';
}

async function evoSendWpp(
  instanceToken: string,
  slug: string,
  number: string,
  text: string,
  link?: { url: string; title: string; description: string }
) {
  if (link) {
    await evoInstance(instanceToken, '/send/link', {
      method: 'POST',
      body: JSON.stringify({ instanceId: slug, number, text, url: link.url, title: link.title, description: link.description }),
    });
  } else {
    await evoInstance(instanceToken, '/send/text', {
      method: 'POST',
      body: JSON.stringify({ instanceId: slug, number, text }),
    });
  }
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
    .select('wpp_template_confirm, wpp_template_remind, wpp_template_waitlist, wpp_booking_url, wpp_reminder_minutes, wpp_enabled, email_enabled')
    .eq('id', tenantId)
    .maybeSingle();
  res.json({
    ok: true,
    confirm:         data?.wpp_template_confirm   ?? TPL_CONFIRM_DEFAULT,
    remind:          data?.wpp_template_remind    ?? TPL_REMIND_DEFAULT,
    waitlist:        data?.wpp_template_waitlist  ?? '',
    bookingUrl:      data?.wpp_booking_url        ?? '',
    reminderMinutes: data?.wpp_reminder_minutes   ?? 60,
    wppEnabled:      data?.wpp_enabled            ?? true,
    emailEnabled:    data?.email_enabled          ?? true,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/whatsapp/templates
// ─────────────────────────────────────────────────────────────────────────────
app.put('/api/whatsapp/templates', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { confirm, remind, waitlist, bookingUrl, reminderMinutes, wppEnabled, emailEnabled } = req.body as { confirm?: string; remind?: string; waitlist?: string; bookingUrl?: string; reminderMinutes?: number; wppEnabled?: boolean; emailEnabled?: boolean };
  await supabase.from('tenants').update({
    wpp_template_confirm:   confirm          ?? null,
    wpp_template_remind:    remind           ?? null,
    ...(waitlist    !== undefined ? { wpp_template_waitlist: waitlist || null } : {}),
    wpp_booking_url:        bookingUrl       ?? null,
    wpp_reminder_minutes:   reminderMinutes  ?? 60,
    ...(wppEnabled   !== undefined ? { wpp_enabled:   wppEnabled   } : {}),
    ...(emailEnabled !== undefined ? { email_enabled: emailEnabled } : {}),
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
        .select('name, slug, wpp_template_confirm, wpp_booking_url, contact_email, wpp_enabled, email_enabled')
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

    // WhatsApp (se tem telefone e canal habilitado)
    if (phone && tenant.wpp_enabled !== false) {
      const msg           = applyTemplate(tenant.wpp_template_confirm ?? TPL_CONFIRM_DEFAULT, vars);
      const instanceToken = evoInstanceToken(tenant.slug, tenantId);
      await evoSendWpp(instanceToken, tenant.slug, `55${phone}`, msg, link ? {
        url: link,
        title: `${tenant.name} — Agendamento confirmado`,
        description: `${vars.servico} · ${vars.data} às ${vars.hora} · Toque para ver os detalhes ou cancelar`,
      } : undefined);
      await supabase.from('appointments').update({ wpp_confirm_sent: true }).eq('id', appointmentId);
    }

    // Email (se tem email, ainda não foi enviado, e canal habilitado)
    if (appt.customer_email && !appt.email_confirm_sent && tenant.email_enabled !== false) {
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

    await evoSendWpp(instanceToken, tenant.slug, `55${phone}`, msg, link ? {
      url: link,
      title: `${tenant.name} — Lembrete de agendamento`,
      description: `${vars.servico} · ${vars.data} às ${vars.hora} · Toque para ver os detalhes ou cancelar`,
    } : undefined);

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
// GET /api/admin/integrations/status  — health de cada serviço externo
// POST /api/admin/asaas-mode          — alterna sandbox/produção (in-memory)
// ─────────────────────────────────────────────────────────────────────────────
async function verifySuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Token não fornecido.' }); return; }
  const { data: { user }, error } = await supabasePublic.auth.getUser(auth.slice(7));
  if (error || !user) { res.status(401).json({ error: 'Token inválido.' }); return; }
  const { data: profile } = await supabasePublic.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') { res.status(403).json({ error: 'Acesso negado.' }); return; }
  next();
}

app.get('/api/admin/integrations/status', verifySuperAdmin, async (_req, res) => {
  const checkedAt = new Date().toISOString();

  // EvoGo — endpoint correto: /instance/all
  let evogo: { ok: boolean; message: string } = { ok: false, message: 'Não configurado' };
  if (EVO_URL && EVO_GLOBAL_KEY) {
    try {
      const r = await fetch(`${EVO_URL}/instance/all`, { headers: { 'apikey': EVO_GLOBAL_KEY }, signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const json = await r.json() as any;
        const count = json?.data?.length ?? 0;
        evogo = { ok: true, message: `Conectado · ${count} instância${count !== 1 ? 's' : ''}` };
      } else {
        evogo = { ok: false, message: `HTTP ${r.status}` };
      }
    } catch (e: any) { evogo = { ok: false, message: e.message ?? 'Timeout' }; }
  }

  // Asaas — sandbox usa /api/v3/ com ASAAS_SANDBOX_KEY; produção usa /v3/ com ASAAS_API_KEY
  let asaas: { ok: boolean; message: string; sandbox: boolean } = { ok: false, message: 'Não configurado', sandbox: isAsaasSandbox() };
  const asaasKey = getAsaasKey();
  const asaasUrl = getAsaasUrl();
  if (asaasKey) {
    try {
      const r = await fetch(`${asaasUrl}/customers?limit=1`, { headers: { 'access_token': asaasKey }, signal: AbortSignal.timeout(6000) });
      const text = await r.text();
      if (r.ok) {
        try {
          const json = JSON.parse(text) as any;
          asaas = { ok: true, message: `${isAsaasSandbox() ? 'Sandbox' : 'Produção'} · ${json?.totalCount ?? 0} clientes`, sandbox: isAsaasSandbox() };
        } catch {
          asaas = { ok: false, message: 'Resposta inválida (não JSON)', sandbox: isAsaasSandbox() };
        }
      } else if (r.status === 401) {
        asaas = { ok: false, message: isAsaasSandbox() ? 'Sandbox: chave de produção não é válida no ambiente sandbox' : 'Chave inválida (401)', sandbox: isAsaasSandbox() };
      } else {
        asaas = { ok: false, message: `HTTP ${r.status}`, sandbox: isAsaasSandbox() };
      }
    } catch (e: any) { asaas = { ok: false, message: e.message ?? 'Timeout', sandbox: isAsaasSandbox() }; }
  }

  // Resend
  let resend: { ok: boolean; message: string } = { ok: false, message: 'Não configurado' };
  const resendKey = process.env.RESEND_API_KEY || '';
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/domains', { headers: { 'Authorization': `Bearer ${resendKey}` }, signal: AbortSignal.timeout(5000) });
      resend = r.ok ? { ok: true, message: 'Conectado' } : { ok: false, message: `HTTP ${r.status}` };
    } catch (e: any) { resend = { ok: false, message: e.message ?? 'Timeout' }; }
  }

  res.json({ evogo, asaas, resend, checkedAt });
});

app.post('/api/admin/asaas-mode', verifySuperAdmin, async (req, res) => {
  const { sandbox } = req.body as { sandbox: boolean };
  if (typeof sandbox !== 'boolean') { res.status(400).json({ error: 'sandbox deve ser boolean.' }); return; }
  asaasSandboxOverride = sandbox;
  console.log(`[Admin] Asaas modo alterado para: ${sandbox ? 'SANDBOX' : 'PRODUÇÃO'}`);
  res.json({ sandbox: asaasSandboxOverride });
});

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
// GET /api/og/:slug/cancelar/:appointmentId
// Serve HTML mínimo com Open Graph meta tags para preview no WhatsApp,
// depois redireciona via JS/meta-refresh para a página real da SPA.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/og/:slug/cancelar/:appointmentId', async (req, res) => {
  const { slug, appointmentId } = req.params;
  const cancelUrl = buildCancelUrl(slug, appointmentId);
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  try {
    const { data: appt } = await supabase
      .from('appointments')
      .select('customer_name, scheduled_date, scheduled_time, services(name), tenants(name, slug)')
      .eq('id', appointmentId)
      .maybeSingle();

    const tenant = appt?.tenants as any;
    if (!appt || tenant?.slug !== slug) { res.redirect(302, cancelUrl); return; }

    const salonName   = esc(tenant?.name ?? 'Barbearia');
    const serviceName = esc((appt.services as any)?.name ?? '');
    const date        = appt.scheduled_date ? formatDatePT(appt.scheduled_date) : '';
    const time        = appt.scheduled_time?.slice(0, 5) ?? '';
    const title       = `${salonName} — Agendamento`;
    const description = serviceName && date
      ? `${serviceName} · ${date} às ${time} · Toque para ver detalhes ou cancelar.`
      : 'Toque para ver os detalhes ou cancelar seu agendamento.';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>${title}</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${cancelUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="WorkAgenda" />
<meta http-equiv="refresh" content="0; url=${cancelUrl}" />
</head><body>
<script>window.location.replace(${JSON.stringify(cancelUrl)});</script>
</body></html>`);
  } catch {
    res.redirect(302, cancelUrl);
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
      .select('id, status, tenant_id, customer_name, customer_phone, scheduled_date, scheduled_time, professional_id, service_id, professionals(name), services(name), tenants(id, slug, name)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!appt) { res.status(404).json({ error: 'Agendamento não encontrado.' }); return; }
    const tenant = appt.tenants as any;
    if (tenant?.slug !== slug) { res.status(403).json({ error: 'Acesso negado.' }); return; }
    if (appt.status === 'cancelled')  { res.json({ ok: true, alreadyCancelled: true }); return; }
    if (appt.status === 'attended' || appt.status === 'completed') {
      res.status(400).json({ error: 'Agendamento já realizado, não pode ser cancelado.' });
      return;
    }

    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);
    res.json({ ok: true });

    // ── Registrar histórico + Notificar lista de espera (fire-and-forget) ──
    (async () => {
      try {
        const tenantId   = appt.tenant_id as string;
        const apptDate   = (appt.scheduled_date as string).substring(0, 10);
        const apptTime   = (appt.scheduled_time as string).substring(0, 5);
        const apptProfId = appt.professional_id as string;

        // Grava no slot_history
        const { data: histRow } = await supabase.from('slot_history').insert({
          tenant_id:               tenantId,
          slot_date:               apptDate,
          slot_time:               apptTime,
          professional_name:       (appt.professionals as any)?.name ?? null,
          service_name:            (appt.services as any)?.name ?? null,
          cancelled_customer_name: (appt.customer_name as string) ?? '',
          cancelled_customer_phone:(appt.customer_phone as string) ?? null,
          filled_customer_name:    null,
          filled_customer_phone:   null,
          filled_at:               null,
        }).select('id').single();
        const histId = histRow?.id as string | undefined;
        const bookingUrl = `https://workagenda.org/${slug}/agendamento`;

        // Busca todas as entradas da lista
        const { data: allWl } = await supabase
          .from('waitlist')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at');
        if (!allWl?.length) return;

        // Cada entrada já tem proteção via notified=true — sem limite adicional
        const compatible = allWl.filter(e =>
          !e.notified &&
          e.date === apptDate &&
          (e.professional_id === null || e.professional_id === apptProfId) &&
          (e.time_preference === 'qualquer' || e.time_preference.split(',').includes(apptTime))
        ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (!compatible.length) {
          console.log(`[Waitlist/Cancel] nenhum candidato compatível para ${apptDate} ${apptTime}`);
          return;
        }

        console.log(`[Waitlist/Cancel] ${compatible.length} candidato(s) para notificar`);
        const instanceToken = evoInstanceToken(slug, tenantId);

        // Template do banco ou padrão
        const { data: tplData } = await supabase.from('tenants')
          .select('wpp_template_waitlist')
          .eq('id', tenantId).maybeSingle();
        const TPL_WAITLIST = tplData?.wpp_template_waitlist ||
          `🎉 Olá, *{cliente}*!\n\nUma vaga abriu na *{salao}* para o dia *{data}* que você estava aguardando!\n\n⚡ Corra antes que alguém reserve:\n{link_agendamento}\n\n_Caso não queira mais agendar, é só ignorar esta mensagem._\n💈 _WorkAgenda_`;

        compatible.forEach((entry: any, idx: number) => {
          setTimeout(async () => {
            try {
              const phone = (entry.customer_phone as string).replace(/\D/g, '');
              const msg   = applyTemplate(TPL_WAITLIST, {
                cliente:          entry.customer_name,
                salao:            tenant?.name ?? '',
                data:             apptDate,
                link_agendamento: bookingUrl,
                link:             bookingUrl,
              });
              await evoSendWpp(instanceToken, slug, `55${phone}`, msg);
              await supabase.from('waitlist')
                .update({ notified: true, notified_at: new Date().toISOString() })
                .eq('id', entry.id);
              // Marca histórico como preenchido pelo primeiro notificado
              if (histId && idx === 0) {
                await supabase.from('slot_history').update({
                  filled_customer_name:  entry.customer_name,
                  filled_customer_phone: entry.customer_phone,
                  filled_at:             new Date().toISOString(),
                }).eq('id', histId);
              }
              console.log(`[Waitlist/Cancel] ✓ ${entry.customer_name} notificado`);
            } catch (err: any) {
              console.error(`[Waitlist/Cancel] erro ao notificar ${entry.customer_name}:`, err.message);
            }
          }, idx * 3000);
        });
      } catch (err: any) {
        console.error('[Waitlist/Cancel] erro geral:', err.message);
      }
    })();

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
    .select('*, tenants(id, name, slug, wpp_template_confirm, wpp_booking_url, contact_email, wpp_enabled, email_enabled, wpp_reminder_minutes), services(name), professionals(name)')
    .eq('wpp_confirm_sent', false)
    .neq('status', 'cancelled')
    .gte('created_at', since);

  for (const appt of appts ?? []) {
    const tenant = (appt.tenants as any);
    if (!tenant) continue;
    const phone = appt.customer_phone?.replace(/\D/g, '');

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

      if (phone && tenant.wpp_enabled !== false) {
        const msg           = applyTemplate(tenant.wpp_template_confirm ?? TPL_CONFIRM_DEFAULT, vars);
        const instanceToken = evoInstanceToken(tenant.slug, tenant.id);

        await evoSendWpp(instanceToken, tenant.slug, `55${phone}`, msg, link ? {
          url: link,
          title: `${tenant.name} — Agendamento confirmado`,
          description: `${vars.servico} · ${vars.data} às ${vars.hora} · Toque para ver os detalhes ou cancelar`,
        } : undefined);

        console.log(`[Confirm] Confirmação WPP enviada: ${appt.customer_name} (${appt.scheduled_date} ${appt.scheduled_time?.slice(0,5)})`);
      }
      await supabase.from('appointments').update({ wpp_confirm_sent: true }).eq('id', appt.id);

      // Se o agendamento foi feito com menos tempo que o lembrete configurado,
      // o job sendReminders nunca alcançará esta janela — marca como tempo insuficiente.
      const reminderMin = Number(tenant?.wpp_reminder_minutes ?? 60);
      const apptDateTime = new Date(`${appt.scheduled_date}T${appt.scheduled_time?.slice(0,5) ?? '00:00'}`);
      const minutesUntil = (apptDateTime.getTime() - Date.now()) / 60_000;
      if (minutesUntil < reminderMin) {
        await supabase.from('appointments')
          .update({ wpp_reminder_status: 'tempo_insuficiente' })
          .eq('id', appt.id)
          .eq('wpp_reminder_status', 'pendente'); // só se ainda pendente
        console.log(`[Confirm] Lembrete desabilitado (${minutesUntil.toFixed(0)}min < ${reminderMin}min): ${appt.customer_name}`);
      }

      // Email de confirmação (se o cliente informou email, canal habilitado e ainda não foi enviado)
      if (appt.customer_email && !appt.email_confirm_sent && tenant.email_enabled !== false) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Job a cada 5 min: auto-conclusão ou auto-cancelamento conforme agenda_mode do tenant
// ─────────────────────────────────────────────────────────────────────────────
async function processAutoActions(): Promise<void> {
  try {
    // Busca tenants com modo automático configurado
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, slug, name, agenda_mode, agenda_time_minutes, timezone')
      .in('agenda_mode', ['auto_complete', 'auto_cancel']);
    if (!tenants?.length) return;

    const now = Date.now();

    for (const tenant of tenants) {
      const bufferMs = ((tenant.agenda_time_minutes ?? 30) as number) * 60_000;

      // Busca agendamentos confirmados que ainda não foram processados
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, scheduled_date, scheduled_time, duration_minutes, price, customer_name, customer_phone, professional_id, tenant_id')
        .eq('tenant_id', tenant.id)
        .eq('status', 'confirmed');

      if (!appts?.length) continue;

      for (const appt of appts) {
        // Calcula o fim do atendimento convertendo do fuso do tenant para UTC
        const tz = (tenant.timezone as string) || 'America/Sao_Paulo';
        const [h, m] = (appt.scheduled_time as string).split(':').map(Number);
        const duration = (appt.duration_minutes as number) ?? 60;
        const endMin   = h * 60 + m + duration;
        const endH     = Math.floor(endMin / 60);
        const endM     = endMin % 60;
        const endTimeStr = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`;
        // Obtém o offset UTC do fuso do tenant no momento atual
        const tzOffset = (() => {
          try {
            const d = new Date();
            const utc  = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
            const local = new Date(d.toLocaleString('en-US', { timeZone: tz }));
            return local.getTime() - utc.getTime(); // ms que o local está à frente de UTC
          } catch { return -3 * 60 * 60 * 1000; } // fallback Brasília
        })();
        // Timestamp UTC do fim do atendimento = data local + hora local - offset
        const endTs = new Date(`${appt.scheduled_date}T${endTimeStr}`).getTime() - tzOffset;

        const actionAt = endTs + bufferMs;
        if (now < actionAt) continue; // ainda não chegou a hora

        if (tenant.agenda_mode === 'auto_complete') {
          await supabase.from('appointments').update({ status: 'attended' }).eq('id', appt.id);
          // Registra pagamento automático
          try {
            await supabase.from('payments').insert({
              tenant_id:      tenant.id,
              appointment_id: appt.id,
              amount:         appt.price,
              method:         'pix',
              status:         'paid',
              description:    `[Auto] ${appt.customer_name}`,
            });
          } catch {}
          console.log(`[AutoComplete] ${tenant.name} — ${appt.customer_name} (${appt.scheduled_date} ${appt.scheduled_time})`);

        } else if (tenant.agenda_mode === 'auto_cancel') {
          await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
          console.log(`[AutoCancel] ${tenant.name} — ${appt.customer_name} (${appt.scheduled_date} ${appt.scheduled_time})`);

          // Notifica lista de espera (reutiliza a mesma lógica do /api/cancel)
          try {
            const apptDate = appt.scheduled_date as string;
            const apptTime = (appt.scheduled_time as string).substring(0, 5);
            const apptProfId = appt.professional_id as string;
            const bookingUrl = `https://workagenda.org/${tenant.slug}/agendamento`;

            const { data: allWl } = await supabase.from('waitlist').select('*')
              .eq('tenant_id', tenant.id).order('created_at');

            const { data: tplData } = await supabase.from('tenants')
              .select('wpp_template_waitlist').eq('id', tenant.id).maybeSingle();
            const TPL = tplData?.wpp_template_waitlist ||
              `🎉 Olá, *{cliente}*!\n\nUma vaga abriu na *{salao}* para o dia *{data}* que você estava aguardando!\n\n⚡ Corra antes que alguém reserve:\n{link_agendamento}\n\n_Caso não queira mais agendar, é só ignorar esta mensagem._\n💈 _WorkAgenda_`;

            const compatible = (allWl ?? []).filter((e: any) =>
              !e.notified &&
              e.date === apptDate &&
              (e.professional_id === null || e.professional_id === apptProfId) &&
              (e.time_preference === 'qualquer' || e.time_preference.split(',').includes(apptTime))
            ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const instanceToken = evoInstanceToken(tenant.slug, tenant.id);
            compatible.forEach((entry: any, idx: number) => {
              setTimeout(async () => {
                try {
                  const phone = (entry.customer_phone as string).replace(/\D/g, '');
                  const msg   = applyTemplate(TPL, { cliente: entry.customer_name, salao: tenant.name, data: apptDate, link_agendamento: bookingUrl, link: bookingUrl });
                  await evoSendWpp(instanceToken, tenant.slug, `55${phone}`, msg);
                  await supabase.from('waitlist').update({ notified: true, notified_at: new Date().toISOString() }).eq('id', entry.id);
                  console.log(`[AutoCancel/Waitlist] ${entry.customer_name} notificado`);
                } catch {}
              }, idx * 3000);
            });
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('[processAutoActions] erro:', err.message);
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
    .select('*, tenants(id, name, slug, wpp_template_remind, wpp_booking_url, wpp_reminder_minutes, wpp_enabled), services(name), professionals(name)')
    .eq('wpp_reminder_sent', false)
    .neq('wpp_reminder_status', 'tempo_insuficiente')
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
    if (tenant.wpp_enabled === false) continue;

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

      await evoSendWpp(instanceToken, tenant.slug, `55${phone}`, msg, link ? {
        url: link,
        title: `${tenant.name} — Lembrete de agendamento`,
        description: `${vars.servico} · ${vars.data} às ${vars.hora} · Toque para ver os detalhes ou cancelar`,
      } : undefined);

      await supabase.from('appointments')
        .update({ wpp_reminder_sent: true, wpp_reminder_status: 'enviado' })
        .eq('id', appt.id);
      console.log(`[Reminder] Lembrete enviado: ${appt.customer_name} (${appt.scheduled_date} ${apptTime})`);
    } catch (err: any) {
      console.error(`[Reminder] Erro ao enviar para ${appt.customer_name}:`, err.message);
    }
  }
}

// ── Marketing Campaigns ───────────────────────────────────────────────────────

app.get('/api/admin/marketing/campaigns', verifySuperAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

app.post('/api/admin/marketing/campaigns', verifySuperAdmin, async (req, res) => {
  const { id, name, campaign_type, subject, filters } = req.body;
  if (!name || !campaign_type || !subject) return res.status(400).json({ error: 'name, campaign_type e subject são obrigatórios' });
  if (id) {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update({ name, campaign_type, subject, filters: filters ?? {}, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .insert({ name, campaign_type, subject, filters: filters ?? {} })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

app.delete('/api/admin/marketing/campaigns/:id', verifySuperAdmin, async (req, res) => {
  const { error } = await supabase
    .from('marketing_campaigns')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

async function getMarketingRecipients(filters: Record<string, any>): Promise<{ tenantId: string; email: string; name: string; slug: string }[]> {
  let query = supabase.from('tenants').select('id, name, slug, status, plan, trial_ends_at, created_at');

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.plan?.length)   query = query.in('plan', filters.plan);

  const { data: tenants } = await query;
  if (!tenants?.length) return [];

  let list = tenants;

  if (filters.trial_expiring_in_days != null) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + Number(filters.trial_expiring_in_days) + 1);
    const from = new Date();
    list = list.filter(t => {
      if (!t.trial_ends_at) return false;
      const d = new Date(t.trial_ends_at);
      return d >= from && d <= horizon;
    });
  }
  if (filters.subscription_days_min != null) {
    const minDays = Number(filters.subscription_days_min);
    list = list.filter(t => {
      const d = new Date(t.created_at);
      return (Date.now() - d.getTime()) / 86400000 >= minDays;
    });
  }

  if (!list.length) return [];
  const tenantIds = list.map(t => t.id).filter(id => id !== '00000000-0000-0000-0000-000000000001');

  const { data: profiles } = await supabasePublic
    .from('profiles')
    .select('tenant_id, email, name')
    .in('tenant_id', tenantIds)
    .eq('role', 'tenant_admin');

  if (!profiles?.length) return [];

  const tenantMap = Object.fromEntries(list.map(t => [t.id, t]));
  return profiles
    .filter(p => p.email)
    .map(p => ({
      tenantId: p.tenant_id,
      email:    p.email,
      name:     (p as any).name ?? tenantMap[p.tenant_id]?.name ?? 'Olá',
      slug:     tenantMap[p.tenant_id]?.slug ?? '',
    }));
}

app.post('/api/admin/marketing/preview', verifySuperAdmin, async (req, res) => {
  const { filters, campaign_type } = req.body;
  const recipients = await getMarketingRecipients(filters ?? {});
  const sample = recipients.slice(0, 5).map(r => ({ email: r.email, name: r.name }));
  const html = generateMarketingHtml(campaign_type ?? 'newsletter', sample[0]?.name ?? 'Usuário', sample[0]?.slug ?? '');
  return res.json({ count: recipients.length, sample, html });
});

app.post('/api/admin/marketing/campaigns/:id/send', verifySuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: campaign, error: ce } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single();
  if (ce || !campaign) return res.status(404).json({ error: 'Campanha não encontrada' });

  const recipients = await getMarketingRecipients(campaign.filters ?? {});
  if (!recipients.length) return res.json({ sent: 0, skipped: 0 });

  let sent = 0, skipped = 0;
  for (const r of recipients) {
    try {
      const { data: prev } = await supabase
        .from('marketing_sends')
        .select('id')
        .eq('campaign_id', id)
        .eq('tenant_id', r.tenantId)
        .maybeSingle();
      if (prev) { skipped++; continue; }
      const html = generateMarketingHtml(campaign.campaign_type, r.name, r.slug);
      await sendMarketingEmail(r.email, campaign.subject, html);
      await supabase.from('marketing_sends').insert({ campaign_id: id, tenant_id: r.tenantId, email: r.email });
      sent++;
    } catch (err: any) {
      console.error('[Marketing] Erro ao enviar para', r.email, err.message);
    }
  }

  await supabase.from('marketing_campaigns')
    .update({ last_sent_at: new Date().toISOString(), last_sent_count: sent })
    .eq('id', id);

  return res.json({ sent, skipped });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] WorkAgenda API rodando na porta ${PORT}`);
  console.log(`[Server] Supabase: ${SUPABASE_URL ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Asaas: ${process.env.ASAAS_API_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Modo: ${process.env.ASAAS_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUÇÃO'}`);
  console.log(`[Server] EvoGo: ${EVO_URL && EVO_GLOBAL_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Resend: ${process.env.RESEND_API_KEY ? '✓' : '✗ não configurado'}`);

  // Auto-ações: roda 30s após o boot para dar tempo de inicializar
  setTimeout(processAutoActions, 30_000);

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

  // Auto-conclusão / auto-cancelamento de agendamentos: a cada 5 min
  setInterval(processAutoActions, 5 * 60_000);
});
