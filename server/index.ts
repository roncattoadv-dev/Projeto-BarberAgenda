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
const PORT            = parseInt(process.env.PORT || process.env.SERVER_PORT || '4000');
const SUPABASE_URL    = process.env.SUPABASE_URL    || '';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || ''; // service_role key (bypass RLS)
const WEBHOOK_SECRET  = process.env.ASAAS_WEBHOOK_SECRET || '';
const EVO_URL         = (process.env.EVO_URL || '').replace(/\/$/, '');
const EVO_GLOBAL_KEY  = process.env.EVO_GLOBAL_KEY || process.env.EVO_APIKEY || '';

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

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp / Evolution Go — helpers de servidor
// O EVO_GLOBAL_KEY nunca é exposto ao frontend.
// ─────────────────────────────────────────────────────────────────────────────

/** Token determinístico por tenant: slug + primeiros 8 chars do id sem hífens */
function evoInstanceToken(slug: string, tenantId: string): string {
  return slug + '-' + tenantId.replace(/-/g, '').slice(0, 8);
}

/** Fetch genérico contra o EvoGo usando a global key */
async function evoFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!EVO_URL || !EVO_GLOBAL_KEY) throw new Error('EvoGo não configurado no servidor (EVO_URL / EVO_GLOBAL_KEY).');
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

/** Garante que a instância existe; cria se não existir */
async function ensureInstance(instanceName: string, token: string): Promise<void> {
  try {
    await evoFetch(`/instance/status?instanceId=${instanceName}`);
  } catch {
    await evoFetch('/instance/create', {
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

  try {
    const data = await evoFetch<{ data: { Connected: boolean; LoggedIn: boolean; Name: string } }>(
      `/instance/status?instanceId=${tenant.slug}`
    );
    res.json({ ok: true, connected: !!data?.data?.Connected, loggedIn: !!data?.data?.LoggedIn, name: data?.data?.Name || null });
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
    const data = await evoFetch<{ data: { Qrcode: string; Code: string } }>(
      `/instance/qr?instanceId=${instanceName}`
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
// Deleta e recria a instância (equivalente a desconectar).
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/disconnect', verifyTenant, async (req, res) => {
  const tenantId = (req as any).verifiedTenantId as string;
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
  if (!tenant) { res.status(404).json({ error: 'Tenant não encontrado.' }); return; }

  const instanceName  = tenant.slug;
  const instanceToken = evoInstanceToken(tenant.slug, tenantId);

  try {
    const all = await evoFetch<{ data: any[] }>('/instance/all');
    const inst = (all.data ?? []).find((i: any) => i.name === instanceName);
    if (inst?.id) {
      await evoFetch(`/instance/delete/${inst.id}`, { method: 'DELETE' });
    }
    await evoFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ name: instanceName, token: instanceToken }),
    });
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

  try {
    await evoFetch('/send/text', {
      method: 'POST',
      body: JSON.stringify({ instanceId: tenant.slug, number: phone, text: message }),
    });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[WhatsApp Send]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Server] BarberFlow API rodando na porta ${PORT}`);
  console.log(`[Server] Supabase: ${SUPABASE_URL ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Asaas: ${process.env.ASAAS_API_KEY ? '✓' : '✗ não configurado'}`);
  console.log(`[Server] Modo: ${process.env.ASAAS_SANDBOX === 'true' ? 'SANDBOX' : 'PRODUÇÃO'}`);
  console.log(`[Server] EvoGo: ${EVO_URL && EVO_GLOBAL_KEY ? '✓' : '✗ não configurado'}`);
});
