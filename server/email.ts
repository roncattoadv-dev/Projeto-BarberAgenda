// server/email.ts
// Envio de emails transacionais via Resend API

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL     = 'WorkAgenda <noreply@workagenda.org>';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de layout
// ─────────────────────────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#031D3C;padding:28px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">WorkAgenda</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:20px 40px;border-top:1px solid #e9ecef;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
              WorkAgenda · <a href="https://workagenda.org" style="color:#9ca3af;">workagenda.org</a><br/>
              Você está recebendo este email porque tem uma conta no WorkAgenda.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#031D3C;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:10px;margin-top:8px;">${text}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e9ecef;margin:24px 0;"/>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

function tplWelcome(name: string, slug: string, trialEndsAt: string): string {
  const trialDate = new Date(trialEndsAt + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const bookingUrl = `https://workagenda.org/${slug}/agendamento`;
  const dashUrl    = 'https://workagenda.org/login';

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Bem-vindo ao WorkAgenda! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Olá, <strong>${name}</strong>! Sua barbearia está pronta. Você tem <strong>10 dias grátis</strong> para explorar tudo.
    </p>

    <div style="background:#f0f4ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Trial gratuito até</p>
      <p style="margin:0;font-size:18px;font-weight:800;color:#111827;">${trialDate}</p>
    </div>

    <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">Seu link de agendamento:</p>
    <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
      <code style="font-size:13px;color:#031D3C;word-break:break-all;">${bookingUrl}</code>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      Compartilhe esse link com seus clientes para que eles possam agendar online. Após o período gratuito, o plano é de <strong>R$ 89,90/mês</strong>.
    </p>

    ${btn('Acessar o painel →', dashUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      Ficou com dúvidas? Responda este email que nossa equipe te ajuda.
    </p>
  `;
  return layout('Bem-vindo ao WorkAgenda!', body);
}

function tplPaymentConfirmed(tenantName: string, amount: number, subscriptionEndsAt: string): string {
  const endDate = new Date(subscriptionEndsAt + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const dashUrl = 'https://workagenda.org/login';

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Pagamento confirmado ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Olá, <strong>${tenantName}</strong>! Recebemos seu pagamento e seu acesso está ativo.
    </p>

    <div style="background:#f0fff4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:12px;">
            <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Valor pago</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#111827;">R$ ${amount.toFixed(2).replace('.', ',')}</p>
          </td>
          <td align="right" style="padding-bottom:12px;">
            <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">PAGO</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:1px solid #bbf7d0;padding-top:12px;">
            <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Plano ativo até</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${endDate}</p>
          </td>
        </tr>
      </table>
    </div>

    ${btn('Acessar o painel →', dashUrl)}
  `;
  return layout('Pagamento confirmado — WorkAgenda', body);
}

function tplPaymentOverdue(tenantName: string, dueDate: string): string {
  const dueDateFmt = new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const payUrl = 'https://workagenda.org/login';

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Pagamento vencido ⚠️</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Olá, <strong>${tenantName}</strong>! Identificamos um pagamento vencido em <strong>${dueDateFmt}</strong> e seu acesso foi temporariamente suspenso.
    </p>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
        Para reativar seu acesso, acesse o painel e realize o pagamento via Pix ou boleto.
      </p>
    </div>

    ${btn('Reativar acesso →', payUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      Se já realizou o pagamento, acesse o painel e clique em "Verificar pagamento". Em caso de dúvidas, responda este email.
    </p>
  `;
  return layout('Pagamento vencido — WorkAgenda', body);
}

function tplBookingConfirmation(params: {
  customerName: string;
  salonName: string;
  service: string;
  professional: string;
  date: string;
  time: string;
  durationMinutes: number;
  code: string;
  cancelLink: string;
}): string {
  const { customerName, salonName, service, professional, date, time, durationMinutes, code, cancelLink } = params;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#111827;">Agendamento confirmado ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
      Olá, <strong>${customerName}</strong>! Seu agendamento em <strong>${salonName}</strong> está confirmado.
    </p>

    <div style="background:#f0f4ff;border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:14px;border-bottom:1px solid #e0e7ff;">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Serviço</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${service}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e0e7ff;">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Data e horário</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${date} às ${time}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Duração: ${durationMinutes} min</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Profissional</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">${professional}</p>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:24px;display:inline-block;">
      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Código do agendamento</p>
      <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#111827;font-family:monospace;letter-spacing:3px;">${code}</p>
    </div>

    ${divider()}

    <p style="margin:0 0 12px;font-size:13px;color:#6b7280;line-height:1.6;">
      Precisando cancelar? Você pode cancelar pelo link abaixo até o dia do atendimento.
    </p>
    <a href="${cancelLink}" style="font-size:13px;color:#6b7280;text-decoration:underline;">Cancelar agendamento</a>
  `;
  return layout(`Agendamento confirmado — ${salonName}`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Funções públicas de envio
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  name: string,
  slug: string,
  trialEndsAt: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  await getResend().emails.send({
    from:    FROM_EMAIL,
    to,
    subject: 'Bem-vindo ao WorkAgenda! Seu trial começa agora 🎉',
    html:    tplWelcome(name, slug, trialEndsAt),
  });
}

export async function sendPaymentConfirmedEmail(
  to: string,
  tenantName: string,
  amount: number,
  subscriptionEndsAt: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  await getResend().emails.send({
    from:    FROM_EMAIL,
    to,
    subject: `Pagamento confirmado — plano ativo até ${subscriptionEndsAt}`,
    html:    tplPaymentConfirmed(tenantName, amount, subscriptionEndsAt),
  });
}

export async function sendBookingConfirmationEmail(params: {
  to: string;
  replyTo: string;
  customerName: string;
  salonName: string;
  service: string;
  professional: string;
  date: string;
  time: string;
  durationMinutes: number;
  code: string;
  cancelLink: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  await getResend().emails.send({
    from:     FROM_EMAIL,
    to:       params.to,
    reply_to: params.replyTo,
    subject:  `Agendamento confirmado em ${params.salonName} — ${params.date} às ${params.time}`,
    html:     tplBookingConfirmation(params),
  });
}

export async function sendPaymentOverdueEmail(
  to: string,
  tenantName: string,
  dueDate: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  await getResend().emails.send({
    from:    FROM_EMAIL,
    to,
    subject: 'Seu acesso ao WorkAgenda foi suspenso — pagamento vencido',
    html:    tplPaymentOverdue(tenantName, dueDate),
  });
}
