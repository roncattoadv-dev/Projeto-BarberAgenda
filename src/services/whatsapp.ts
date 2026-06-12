/**
 * WhatsApp Service — Evolution Go (EvoGo v0.6.1)
 *
 * Endpoints reais confirmados:
 *   POST /instance/create          { name, token }
 *   GET  /instance/all             → { data: [...] }          (global key)
 *   GET  /instance/status?instanceId=  → { data: { Connected, LoggedIn, Name } }
 *   GET  /instance/qr?instanceId=  → { data: { Qrcode, Code } }
 *   POST /instance/disconnect      { instanceId }
 *   POST /send/text                { instanceId, number, text }
 *
 * Auth: global key para admin ops / token da instância para ops da instância
 */

function getRuntimeConfig() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return {
    url:      (w.EVO_URL      || import.meta.env.VITE_EVO_URL      || '').replace(/\/$/, ''),
    instance: (w.EVO_INSTANCE || import.meta.env.VITE_EVO_INSTANCE || 'barberflow'),
    apikey:   (w.EVO_APIKEY   || import.meta.env.VITE_EVO_APIKEY   || ''),
  };
}

export const EVO_URL      = getRuntimeConfig().url;
export const EVO_INSTANCE = getRuntimeConfig().instance;
export const EVO_APIKEY   = getRuntimeConfig().apikey;
export const EVO_CONFIGURED = !!(EVO_URL && EVO_APIKEY);

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type ConnectionState = 'open' | 'close' | 'connecting' | 'error' | 'checking';
export type WppStatus       = 'sent' | 'error' | 'not_configured';

export interface InstanceInfo {
  instanceName:     string;
  connectionStatus: ConnectionState;
  ownerJid?:        string;
  profileName?:     string;
  profilePicUrl?:   string;
}

export interface QRCodeData {
  code:    string;
  base64:  string;   // já vem como data:image/png;base64,...
  count?:  number;
}

// ── Helper fetch ───────────────────────────────────────────────────────────────
async function evoFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  if (!EVO_CONFIGURED) throw new Error('EvoGo não configurado.');
  const res = await fetch(`${EVO_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'apikey': EVO_APIKEY, ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[EvoGo ${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Gerenciamento de instância ─────────────────────────────────────────────────

/** Cria instância no EvoGo. name = nome da instância, token = chave de acesso */
export async function createInstance(name: string, token: string): Promise<any> {
  return evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ name, token }),
  });
}

/** Lista todas as instâncias (requer global key) */
export async function fetchInstances(): Promise<InstanceInfo[]> {
  const data = await evoFetch<{ data: any[]; message: string }>('/instance/all');
  return (data.data ?? []).map(d => ({
    instanceName:     d.name,
    connectionStatus: d.connected ? 'open' : 'close',
    ownerJid:         d.jid || undefined,
    profileName:      d.name,
  }));
}

/** Status de conexão — { Connected, LoggedIn, Name } */
export async function checkEvoStatus(instance = EVO_INSTANCE): Promise<ConnectionState> {
  if (!EVO_CONFIGURED) return 'error';
  try {
    const data = await evoFetch<{ data: { Connected: boolean; LoggedIn: boolean; Name: string }; message: string }>(
      `/instance/status?instanceId=${instance}`
    );
    if (data?.data?.LoggedIn)   return 'open';
    if (data?.data?.Connected)  return 'connecting';
    return 'close';
  } catch {
    return 'error';
  }
}

/** QR Code para conectar — resposta: { data: { Qrcode, Code } } */
export async function fetchQRCode(instance = EVO_INSTANCE): Promise<QRCodeData | null> {
  try {
    const data = await evoFetch<{ data: { Qrcode: string; Code: string }; message: string }>(
      `/instance/qr?instanceId=${instance}`
    );
    if (data?.data?.Qrcode) {
      return { base64: data.data.Qrcode, code: data.data.Code || '' };
    }
    return null;
  } catch {
    return null;
  }
}

/** Desconecta (logout) a instância */
export async function logoutInstance(instance = EVO_INSTANCE): Promise<void> {
  await evoFetch('/instance/disconnect', {
    method: 'POST',
    body: JSON.stringify({ instanceId: instance }),
  });
}

/** Deleta a instância */
export async function deleteInstance(instance = EVO_INSTANCE): Promise<void> {
  await evoFetch(`/instance/delete/${instance}`, { method: 'DELETE' });
}

/** Info da instância via status */
export async function fetchInstanceInfo(instance = EVO_INSTANCE): Promise<InstanceInfo | null> {
  try {
    const data = await evoFetch<{ data: { Connected: boolean; LoggedIn: boolean; Name: string }; message: string }>(
      `/instance/status?instanceId=${instance}`
    );
    if (!data?.data) return null;
    return {
      instanceName:     instance,
      connectionStatus: data.data.LoggedIn ? 'open' : data.data.Connected ? 'connecting' : 'close',
      profileName:      data.data.Name || undefined,
    };
  } catch {
    return null;
  }
}

// ── Envio de mensagens ─────────────────────────────────────────────────────────

/** Normaliza número BR para formato internacional */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10)   return `55${digits}`;
  return digits;
}

/** Envia mensagem de texto — POST /send/text { instanceId, number, text } */
export async function sendWhatsApp(
  phone:    string,
  message:  string,
  instance: string = EVO_INSTANCE
): Promise<WppStatus> {
  if (!EVO_CONFIGURED) return 'not_configured';
  try {
    await evoFetch('/send/text', {
      method: 'POST',
      body: JSON.stringify({
        instanceId: instance,
        number:     normalizePhone(phone),
        text:       message,
      }),
    });
    return 'sent';
  } catch (err) {
    console.error('[EvoGo] sendWhatsApp:', err);
    return 'error';
  }
}

/** Configura webhook da instância */
export async function setWebhook(webhookUrl: string, instance = EVO_INSTANCE): Promise<void> {
  await evoFetch(`/webhook/set/${instance}`, {
    method: 'POST',
    body: JSON.stringify({
      url:                webhookUrl,
      enabled:            true,
      events:             ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      webhook_by_events:  false,
    }),
  });
}

// ── Proxy de servidor (sem expor credenciais EvoGo ao browser) ────────────────

function getApiUrl(): string {
  const w = (window as any).__BARBER_CONFIG__ || {};
  const env = (import.meta as any).env || {};
  return (w.API_URL || env.VITE_API_URL || '').replace(/\/$/, '');
}

async function serverFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(getApiUrl() + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers as object ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Verifica status da instância via servidor */
export async function checkStatusServer(tenantId: string, token: string): Promise<{ state: ConnectionState; name: string | null }> {
  try {
    const data = await serverFetch<{ ok: boolean; connected: boolean; loggedIn: boolean; name?: string | null }>(
      `/api/whatsapp/status?tenantId=${tenantId}`, token
    );
    const state: ConnectionState = data.loggedIn ? 'open' : data.connected ? 'connecting' : 'close';
    return { state, name: data.name ?? null };
  } catch {
    return { state: 'error', name: null };
  }
}

/** Garante instância e retorna QR Code via servidor */
export async function fetchQRCodeServer(tenantId: string, token: string): Promise<QRCodeData | null> {
  const data = await serverFetch<{ ok: boolean; qrcode: string | null; code: string }>(
    `/api/whatsapp/qr?tenantId=${tenantId}`, token
  );
  if (!data.qrcode) return null;
  const base64 = data.qrcode.startsWith('data:') ? data.qrcode : `data:image/png;base64,${data.qrcode}`;
  return { base64, code: data.code || '' };
}

/** Desconecta e recria instância via servidor */
export async function disconnectServer(tenantId: string, token: string): Promise<void> {
  await serverFetch('/api/whatsapp/disconnect', token, {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  });
}

/** Envia mensagem de texto via servidor */
export async function sendWhatsAppServer(
  tenantId: string,
  token:    string,
  phone:    string,
  message:  string,
): Promise<WppStatus> {
  try {
    await serverFetch('/api/whatsapp/send', token, {
      method: 'POST',
      body: JSON.stringify({ tenantId, phone: normalizePhone(phone), message }),
    });
    return 'sent';
  } catch (err) {
    console.error('[WApp Server Send]', err);
    return 'error';
  }
}

// ── Templates de mensagem ──────────────────────────────────────────────────────
export interface ApptData {
  customerName:     string;
  customerPhone:    string;
  serviceName:      string;
  professionalName: string;
  date:             string;
  time:             string;
  tenantName:       string;
  tenantPhone?:     string;
  id?:              string;
  tenantSlug?:      string;
}

export function formatDatePT(dateStr: string): string {
  try {
    const [, m, d] = dateStr.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${Number(d)} de ${months[Number(m) - 1]}`;
  } catch { return dateStr; }
}

function buildApptLink(appt: ApptData): string {
  if (appt.id && appt.tenantSlug) {
    return `https://workagenda.org/${appt.tenantSlug}/cancelar/${appt.id}`;
  }
  return '';
}

export function buildConfirmationMsg(appt: ApptData): string {
  const link = buildApptLink(appt);
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
    link ? `Ver ou cancelar agendamento:\n${link}` : 'Para cancelar ou remarcar, responda esta mensagem.',
    '_Powered by WorkAgenda_ 💈',
  ].filter(Boolean).join('\n');
}

export function buildReminderMsg(appt: ApptData): string {
  const link = buildApptLink(appt);
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
    link ? `Ver ou cancelar agendamento:\n${link}` : 'Se precisar cancelar, responda esta mensagem.',
    '_WorkAgenda_ 💈',
  ].filter(Boolean).join('\n');
}

export function buildCancellationMsg(appt: ApptData): string {
  const link = appt.tenantSlug ? `https://workagenda.org/${appt.tenantSlug}/agendamento` : '';
  return [
    `Olá ${appt.customerName},`,
    '',
    `❌ Seu agendamento de *${appt.serviceName}* em ${formatDatePT(appt.date)} às ${appt.time} foi *cancelado*.`,
    '',
    link ? `Para reagendar acesse:\n${link}` : 'Para reagendar, responda esta mensagem.',
    '',
    `📍 ${appt.tenantName}`,
    '_WorkAgenda_ 💈',
  ].filter(Boolean).join('\n');
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
