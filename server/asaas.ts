// server/asaas.ts
// Documentação: https://docs.asaas.com
// Ambiente sandbox: https://sandbox.asaas.com/api/v3
// Ambiente produção: https://api.asaas.com/v3

const ASAAS_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_URL = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const BASE_PRICE = 89.90; // R$ por mês (preço base)

export const PLAN_PRICES: Record<string, { label: string; months: number; discountPct: number; cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' }> = {
  mensal:     { label: 'Plano Mensal',     months: 1,  discountPct: 0,  cycle: 'MONTHLY'   },
  trimestral: { label: 'Plano Trimestral', months: 3,  discountPct: 15, cycle: 'QUARTERLY'  },
  anual:      { label: 'Plano Anual',      months: 12, discountPct: 25, cycle: 'YEARLY'     },
};

export function getPlanMonthlyPrice(plan: string): number {
  const p = PLAN_PRICES[plan];
  return p ? parseFloat((BASE_PRICE * (1 - p.discountPct / 100)).toFixed(2)) : BASE_PRICE;
}

export function getPlanTotal(plan: string): number {
  const p = PLAN_PRICES[plan];
  return p ? parseFloat((getPlanMonthlyPrice(plan) * p.months).toFixed(2)) : BASE_PRICE;
}

interface AsaasCustomer {
  id:    string;
  name:  string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

interface AsaasSubscription {
  id:         string;
  status:     'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'OVERDUE';
  customer:   string;
  nextDueDate: string;
  value:      number;
  cycle:      'MONTHLY';
}

async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Asaas ${res.status}] ${body}`);
  }
  return res.json();
}

// ── Clientes ───────────────────────────────────────────────────────────────────

export async function createAsaasCustomer(data: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  tenantId?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name:              data.name,
      email:             data.email,
      cpfCnpj:           data.cpfCnpj     || undefined,
      mobilePhone:       data.phone       || undefined,
      externalReference: data.tenantId    || undefined,
      observations:      data.tenantId ? `WorkAgenda SaaS · tenantId: ${data.tenantId}` : 'WorkAgenda SaaS',
      notificationDisabled: false,
    }),
  });
}

// ── Assinaturas mensais ────────────────────────────────────────────────────────

export async function createSubscription(customerId: string, plan = 'mensal', trialDays = 7): Promise<AsaasSubscription> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  const nextDueDate = trialEnd.toISOString().split('T')[0];

  const planInfo = PLAN_PRICES[plan] ?? PLAN_PRICES.mensal;
  const value    = getPlanTotal(plan);

  return asaasFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer:     customerId,
      billingType:  'UNDEFINED',
      value,
      cycle:        planInfo.cycle,
      nextDueDate,
      description:  `WorkAgenda — ${planInfo.label}`,
    }),
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function getPendingPaymentLink(subscriptionId: string): Promise<string | null> {
  const data = await asaasFetch<{ data: Array<{ status: string; invoiceUrl?: string; bankSlipUrl?: string }> }>(
    `/payments?subscription=${subscriptionId}&limit=5`
  );
  // Prioriza o boleto/cobrança mais recente que ainda não foi pago
  const pending = data.data?.find(p => ['PENDING', 'OVERDUE'].includes(p.status));
  if (pending) return pending.invoiceUrl || pending.bankSlipUrl || null;
  // Se não há cobrança pendente, retorna a da assinatura mais recente
  const latest = data.data?.[0];
  return latest?.invoiceUrl || latest?.bankSlipUrl || null;
}

export async function getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch(`/subscriptions/${subscriptionId}`);
}

// ── Webhook payload types ──────────────────────────────────────────────────────

export type AsaasWebhookEvent =
  | 'PAYMENT_RECEIVED'         // pagamento confirmado → ativa tenant
  | 'PAYMENT_OVERDUE'          // venceu → bloqueia
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_INACTIVATED' // assinatura cancelada
  | string;

export interface AsaasWebhookPayload {
  event:   AsaasWebhookEvent;
  payment?: {
    id:           string;
    subscription: string;
    customer:     string;
    value:        number;
    status:       'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'PENDING';
    dueDate:      string;
  };
  subscription?: {
    id:     string;
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'OVERDUE';
  };
}
