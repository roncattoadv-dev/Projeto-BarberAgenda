/**
 * WhatsApp Service — Evolution Go (Evo Go)
 * Documentação: https://github.com/evolution-foundation/evolution-go
 *
 * Variáveis de ambiente (.env.local):
 *   VITE_EVO_URL      = https://evo.seudominio.com.br   ← URL do Evo Go no EasyPanel
 *   VITE_EVO_INSTANCE = barberflow                       ← nome da instância
 *   VITE_EVO_APIKEY   = SUA_GLOBAL_API_KEY              ← GLOBAL_API_KEY do .env do Evo Go
 */

export const EVO_URL      = (import.meta.env.VITE_EVO_URL      || '').replace(/\/$/, '');
export const EVO_INSTANCE = import.meta.env.VITE_EVO_INSTANCE  || 'barberflow';
export const EVO_APIKEY   = import.meta.env.VITE_EVO_APIKEY    || '';

export const EVO_CONFIGURED = !!(EVO_URL && EVO_APIKEY);

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type ConnectionState = 'open' | 'close' | 'connecting' | 'error' | 'checking';
export type WppStatus       = 'sent' | 'error' | 'not_configured';

export interface InstanceInfo {
  instanceName: string;
  connectionStatus: ConnectionState;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
}

export interface QRCodeData {
  code: string;        // string base64 do QR
  base64: string;      // data:image/png;base64,...
  count?: number;
}

// ── Helper de request ──────────────────────────────────────────────────────────
async function evoFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!EVO_CONFIGURED) throw new Error('Evo Go não configurado.');
  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVO_APIKEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[EvoGo ${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Gerenciamento de instância ─────────────────────────────────────────────────

/** Cria uma nova instância no Evo Go */
export async function createInstance(name: string): Promise<{ instance: InstanceInfo; hash: { apikey: string } }> {
  return evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
}

/** Lista todas as instâncias */
export async function fetchInstances(): Promise<InstanceInfo[]> {
  const data = await evoFetch<{ instance: InstanceInfo }[]>('/instance/fetchInstances');
  return data.map(d => d.instance);
}

/** Estado de conexão de uma instância */
export async function checkEvoStatus(instance = EVO_INSTANCE): Promise<ConnectionState> {
  if (!EVO_CONFIGURED) return 'error';
  try {
    const data = await evoFetch<{ instance: { state: ConnectionState } }>(
      `/instance/connectionState/${instance}`
    );
    return data?.instance?.state ?? 'error';
  } catch {
    return 'error';
  }
}

/** Busca QR Code para conectar o WhatsApp */
export async function fetchQRCode(instance = EVO_INSTANCE): Promise<QRCodeData | null> {
  try {
    const data = await evoFetch<{ base64?: string; code?: string; qrcode?: QRCodeData }>(
      `/instance/connect/${instance}`
    );
    // Evo Go pode retornar em formatos ligeiramente diferentes por versão
    if (data?.base64)           return { base64: data.base64, code: data.code || '' };
    if (data?.qrcode?.base64)   return data.qrcode;
    return null;
  } catch {
    return null;
  }
}

/** Desconecta (logout) uma instância */
export async function logoutInstance(instance = EVO_INSTANCE): Promise<void> {
  await evoFetch(`/instance/logout/${instance}`, { method: 'DELETE' });
}

/** Deleta uma instância */
export async function deleteInstance(instance = EVO_INSTANCE): Promise<void> {
  await evoFetch(`/instance/delete/${instance}`, { method: 'DELETE' });
}

/** Info detalhada da instância (nome, foto, número) */
export async function fetchInstanceInfo(instance = EVO_INSTANCE): Promise<InstanceInfo | null> {
  try {
    const data = await evoFetch<{ instance: InstanceInfo }>(`/instance/fetchInstances?instanceName=${instance}`);
    return Array.isArray(data) ? (data as any[])[0]?.instance ?? null : data?.instance ?? null;
  } catch {
    return null;
  }
}

// ── Mensagens ──────────────────────────────────────────────────────────────────

/** Normaliza número BR: remove formatação, garante DDI 55 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10)   return `55${digits}`;
  return digits;
}

/** Envia mensagem de texto simples */
export async function sendWhatsApp(
  phone: string,
  message: string,
  instance = EVO_INSTANCE
): Promise<WppStatus> {
  if (!EVO_CONFIGURED) {
    console.warn('[EvoGo] Não configurado — defina VITE_EVO_URL e VITE_EVO_APIKEY');
    return 'not_configured';
  }
  try {
    await evoFetch(`/message/sendText/${instance}`, {
      method: 'POST',
      body: JSON.stringify({
        number: normalizePhone(phone),
        text:   message,
        delay:  1200,
      }),
    });
    return 'sent';
  } catch (err) {
    console.error('[EvoGo] sendWhatsApp:', err);
    return 'error';
  }
}

/** Configura webhook para receber eventos da instância */
export async function setWebhook(
  webhookUrl: string,
  instance = EVO_INSTANCE
): Promise<void> {
  await evoFetch(`/webhook/set/${instance}`, {
    method: 'POST',
    body: JSON.stringify({
      url:      webhookUrl,
      enabled:  true,
      events:   ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      webhook_by_events: false,
    }),
  });
}

// ── Templates de mensagem ──────────────────────────────────────────────────────
export interface ApptData {
  customerName:     string;
  customerPhone:    string;
  serviceName:      string;
  professionalName: string;
  date:  string;  // YYYY-MM-DD
  time:  string;  // HH:MM
  tenantName:   string;
  tenantPhone?: string;
}

export function formatDatePT(dateStr: string): string {
  try {
    const [, m, d] = dateStr.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${Number(d)} de ${months[Number(m) - 1]}`;
  } catch { return dateStr; }
}

export function buildConfirmationMsg(appt: ApptData): string {
  return [
    `Olá ${appt.customerName}! 😊`,
    '',
    `✅ *Agendamento Confirmado*`,
    '',
    `📅 Data: ${formatDatePT(appt.date)}`,
    `⏰ Horário: ${appt.time}`,
    `✂️ Serviço: ${appt.serviceName}`,
    `👤 Profissional: ${appt.professionalName}`,
    '',
    `📍 ${appt.tenantName}`,
    appt.tenantPhone ? `📞 ${appt.tenantPhone}` : '',
    '',
    'Para cancelar ou remarcar, responda esta mensagem.',
    '_Powered by BarberFlow_ 💈',
  ].filter(l => l !== null).join('\n');
}

export function buildReminderMsg(appt: ApptData): string {
  return [
    `Olá ${appt.customerName}! 👋`,
    '',
    `⏰ *Lembrete — Amanhã*`,
    '',
    `✂️ ${appt.serviceName} com ${appt.professionalName}`,
    `📅 Amanhã, ${formatDatePT(appt.date)} às ${appt.time}`,
    '',
    `📍 ${appt.tenantName}`,
    '',
    'Te esperamos! Se precisar cancelar, responda esta mensagem.',
    '_BarberFlow_ 💈',
  ].join('\n');
}

export function buildCancellationMsg(appt: ApptData): string {
  return [
    `Olá ${appt.customerName},`,
    '',
    `❌ Seu agendamento de *${appt.serviceName}* em ${formatDatePT(appt.date)} às ${appt.time} foi *cancelado*.`,
    '',
    'Para reagendar, acesse nosso link ou responda esta mensagem.',
    '',
    `📍 ${appt.tenantName}`,
    '_BarberFlow_ 💈',
  ].join('\n');
}

export function buildCustomMsg(template: string, appt: ApptData): string {
  return template
    .replace(/\{cliente\}/g,      appt.customerName)
    .replace(/\{servico\}/g,      appt.serviceName)
    .replace(/\{profissional\}/g, appt.professionalName)
    .replace(/\{data\}/g,         formatDatePT(appt.date))
    .replace(/\{hora\}/g,         appt.time)
    .replace(/\{salao\}/g,        appt.tenantName);
}
