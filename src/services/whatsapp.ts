/**
 * WhatsApp Service — Evolution API (Evo Go)
 * Envia mensagens reais via instância configurada no EasyPanel
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   VITE_EVO_URL       = https://evo.seudominio.com.br
 *   VITE_EVO_INSTANCE  = barberflow          (nome da instância)
 *   VITE_EVO_APIKEY    = sua-api-key-aqui
 */

const EVO_URL      = import.meta.env.VITE_EVO_URL      || '';
const EVO_INSTANCE = import.meta.env.VITE_EVO_INSTANCE || 'barberflow';
const EVO_APIKEY   = import.meta.env.VITE_EVO_APIKEY   || '';

export type WppStatus = 'sent' | 'error' | 'not_configured';

interface EvoResponse {
  key?: { id: string };
  error?: string;
}

/** Normaliza número brasileiro: remove tudo que não é dígito, garante 55 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Adiciona 55 se não tiver código do país
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

/**
 * Envia uma mensagem de texto pelo Evo Go.
 * Retorna: 'sent' | 'error' | 'not_configured'
 */
export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<WppStatus> {
  if (!EVO_URL || !EVO_APIKEY) {
    console.warn('[EvoGo] VITE_EVO_URL ou VITE_EVO_APIKEY não configurados.');
    return 'not_configured';
  }

  const number = normalizePhone(phone);
  const url    = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_APIKEY,
      },
      body: JSON.stringify({
        number,
        text: message,
        delay: 1000, // 1s de delay humanizado
      }),
    });

    const data: EvoResponse = await res.json();

    if (!res.ok || data.error) {
      console.error('[EvoGo] Erro ao enviar:', data);
      return 'error';
    }

    console.info('[EvoGo] Mensagem enviada:', data.key?.id);
    return 'sent';
  } catch (err) {
    console.error('[EvoGo] Falha na requisição:', err);
    return 'error';
  }
}

/** Verifica o status de conexão da instância */
export async function checkEvoStatus(): Promise<'open' | 'close' | 'connecting' | 'error'> {
  if (!EVO_URL || !EVO_APIKEY) return 'error';

  try {
    const res = await fetch(
      `${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`,
      { headers: { 'apikey': EVO_APIKEY } }
    );
    const data = await res.json();
    return data?.instance?.state || 'error';
  } catch {
    return 'error';
  }
}

// ── Templates de mensagem ──────────────────────────────────

interface ApptData {
  customerName:  string;
  customerPhone: string;
  serviceName:   string;
  professionalName: string;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  tenantName:    string;
  tenantPhone?:  string;
}

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${Number(d)} de ${months[Number(m)-1]}`;
  } catch {
    return dateStr;
  }
}

export function buildConfirmationMsg(appt: ApptData): string {
  return `Olá ${appt.customerName}! 😊

✅ *Agendamento Confirmado*

📅 Data: ${formatDate(appt.date)}
⏰ Horário: ${appt.time}
✂️ Serviço: ${appt.serviceName}
👤 Profissional: ${appt.professionalName}

📍 ${appt.tenantName}
${appt.tenantPhone ? `📞 ${appt.tenantPhone}` : ''}

Para cancelar ou remarcar, responda esta mensagem.
_Powered by BarberFlow_ 💈`;
}

export function buildReminderMsg(appt: ApptData): string {
  return `Olá ${appt.customerName}! 👋

⏰ *Lembrete de Amanhã*

Você tem um agendamento marcado:
✂️ ${appt.serviceName} com ${appt.professionalName}
📅 Amanhã, ${formatDate(appt.date)} às ${appt.time}

📍 ${appt.tenantName}

Te esperamos! Se precisar cancelar, responda esta mensagem.
_BarberFlow_ 💈`;
}

export function buildCancellationMsg(appt: ApptData): string {
  return `Olá ${appt.customerName},

❌ Seu agendamento de *${appt.serviceName}* em ${formatDate(appt.date)} às ${appt.time} foi *cancelado*.

Para reagendar, acesse nosso link de agendamento ou responda esta mensagem.

📍 ${appt.tenantName}
_BarberFlow_ 💈`;
}

export function buildCustomMsg(template: string, appt: ApptData): string {
  return template
    .replace(/\{cliente\}/g,       appt.customerName)
    .replace(/\{servico\}/g,       appt.serviceName)
    .replace(/\{profissional\}/g,  appt.professionalName)
    .replace(/\{data\}/g,          formatDate(appt.date))
    .replace(/\{hora\}/g,          appt.time)
    .replace(/\{salao\}/g,         appt.tenantName);
}
