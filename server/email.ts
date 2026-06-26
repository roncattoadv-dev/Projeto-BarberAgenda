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
      Olá, <strong>${name}</strong>! Sua barbearia está pronta. Você tem <strong>7 dias grátis</strong> para explorar tudo.
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

export async function sendEmailVerificationEmail(
  to: string,
  name: string,
  verificationUrl: string,
): Promise<void> {
  if (!isEmailConfigured()) return;
  const html = layout('Confirme seu email — WorkAgenda', `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Confirme seu email</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
      Olá, <strong style="color:#111827;">${name}</strong>! Para ativar sua conta no WorkAgenda, clique no botão abaixo e confirme seu endereço de email.
    </p>
    <div style="margin:0 0 28px;">
      <a href="${verificationUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 36px;border-radius:12px;letter-spacing:0.2px;">
        Confirmar email →
      </a>
    </div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Botão não funcionou?</p>
      <p style="margin:0 0 8px;font-size:12px;color:#6B7280;">Copie e cole o endereço abaixo diretamente no seu navegador:</p>
      <p style="margin:0;font-size:11px;color:#2563EB;word-break:break-all;font-family:monospace;">${verificationUrl}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.5;">
      Este link expira em 24 horas. Se você não criou uma conta no WorkAgenda, pode ignorar este email com segurança.
    </p>
  `);
  await getResend().emails.send({
    from:    FROM_EMAIL,
    to,
    subject: 'Confirme seu email para ativar sua conta no WorkAgenda',
    html,
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

// ─────────────────────────────────────────────────────────────────────────────
// MARKETING EMAILS — layout premium baseado na landing page
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_URL = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png';

function mktLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Outfit',-apple-system,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="${LOGO_URL}" alt="WorkAgenda" height="70" style="display:block;height:70px;width:auto;"/>
        </td></tr>
        <tr><td style="background:#FFFFFF;border-radius:20px;box-shadow:0 4px 32px rgba(0,0,0,0.09);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(90deg,#2563EB,#3B82F6);height:4px;font-size:0;border-radius:20px 20px 0 0;">&nbsp;</td></tr>
            <tr><td style="padding:36px 40px 32px;">${body}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 0 8px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">© ${new Date().getFullYear()} WorkAgenda · <a href="https://workagenda.org" style="color:#2563EB;text-decoration:none;">workagenda.org</a></p>
          <p style="margin:0;font-size:11px;color:#CBD5E1;">Você recebe este email por ter uma conta WorkAgenda.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function mktBtn(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td><a href="${href}" style="display:inline-block;background:#2563EB;color:#ffffff;font-family:'Outfit',-apple-system,sans-serif;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.2px;">${text}</a></td></tr></table>`;
}
function mktPill(text: string, color: string, bg: string): string {
  return `<div style="margin-bottom:14px;"><span style="background:${bg};color:${color};font-size:10px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:1px;text-transform:uppercase;">${text}</span></div>`;
}
function mktH(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:26px;font-weight:900;color:#111827;line-height:1.2;letter-spacing:-0.5px;">${text}</h1>`;
}
function mktP(text: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7;">${text}</p>`;
}
function mktBox(content: string, bg = '#EFF6FF', bd = '#BFDBFE'): string {
  return `<div style="background:${bg};border:1px solid ${bd};border-radius:12px;padding:20px 24px;margin:0 0 24px;">${content}</div>`;
}
function mktList(items: string[]): string {
  return `<ul style="margin:0 0 24px;padding:0;list-style:none;">${items.map(i =>
    `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:#374151;line-height:1.5;"><span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#DCFCE7;display:inline-flex;align-items:center;justify-content:center;color:#16A34A;font-size:11px;font-weight:700;margin-top:1px;">✓</span>${i}</li>`
  ).join('')}</ul>`;
}

// ── 8 Templates ───────────────────────────────────────────────────────────────

function tplMktTrialWelcome(name: string, slug: string): string {
  const bookingUrl = `https://workagenda.org/${slug}/agendamento`;
  return mktLayout('Bem-vindo ao WorkAgenda!', `
    ${mktPill('Boas-vindas', '#2563EB', '#EFF6FF')}
    ${mktH(`Olá, ${name}! 🎉 Seu trial começa agora.`)}
    ${mktP('Você tem <strong>7 dias gratuitos</strong> para descobrir como o WorkAgenda transforma a gestão do seu negócio. Agendamento online, WhatsApp automático e controle financeiro — tudo num lugar só.')}
    ${mktList(['Compartilhe seu link de agendamento com os clientes', 'Conecte o WhatsApp para confirmações automáticas', 'Cadastre serviços e profissionais', 'Acompanhe receitas e comissões em tempo real'])}
    ${mktBox(`<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;">Seu link de agendamento</p><code style="font-size:13px;color:#1D4ED8;word-break:break-all;">${bookingUrl}</code>`)}
    ${mktBtn('Acessar o painel →', 'https://workagenda.org/login')}
    <p style="margin:20px 0 0;font-size:13px;color:#94A3B8;">Dúvidas? Responda este email — adoramos ajudar.</p>
  `);
}

function tplMktTrialActivation(name: string, slug: string): string {
  return mktLayout('Conecte o WhatsApp — WorkAgenda', `
    ${mktPill('Dica de ativação', '#F59E0B', '#FEF3C7')}
    ${mktH(`${name}, conecte seu WhatsApp agora!`)}
    ${mktP('Você ainda não conectou o WhatsApp. Com ele ativo, o WorkAgenda envia <strong>confirmações e lembretes automáticos</strong> para cada cliente — sem você fazer nada.')}
    ${mktBox(`<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#111827;">Como conectar em 3 passos:</p><p style="margin:0 0 8px;font-size:13px;color:#374151;">1. Acesse o painel → menu <strong>Automações</strong></p><p style="margin:0 0 8px;font-size:13px;color:#374151;">2. Clique em <strong>Conectar WhatsApp</strong></p><p style="margin:0;font-size:13px;color:#374151;">3. Escaneie o QR Code com seu celular</p>`, '#FFFBEB', '#FDE68A')}
    ${mktP('Negócios com WhatsApp automático reduzem faltas em até <strong>70%</strong>. Leva menos de 1 minuto para configurar.')}
    ${mktBtn('Conectar WhatsApp agora →', 'https://workagenda.org/login')}
  `);
}

function tplMktTrialExpiring(name: string, daysLeft: number): string {
  const label = daysLeft <= 1 ? '⚠️ Último dia!' : `⏰ Faltam ${daysLeft} dias`;
  return mktLayout('Seu trial WorkAgenda vence em breve', `
    ${mktPill(label, '#DC2626', '#FEE2E2')}
    ${mktH(`${name}, seu trial encerra em breve.`)}
    ${mktP(`Seu período gratuito vence em <strong>${daysLeft} dia${daysLeft > 1 ? 's' : ''}</strong>. Assine agora e continue usando sem interrupção.`)}
    ${mktBox(`<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;">Plano mensal</p><p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111827;">R$ 89,90<span style="font-size:14px;color:#6B7280;font-weight:600;">/mês</span></p><p style="margin:0;font-size:13px;color:#374151;">Agendamento ilimitado · WhatsApp · Financeiro · Suporte</p>`)}
    ${mktBtn('Assinar agora →', 'https://workagenda.org/login')}
    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">Trimestral (15% OFF) e anual (25% OFF) também disponíveis.</p>
  `);
}

function tplMktTrialExpired(name: string): string {
  return mktLayout('Seu acesso WorkAgenda está pausado', `
    ${mktPill('Acesso pausado', '#6B7280', '#F1F5F9')}
    ${mktH(`${name}, seu acesso está pausado.`)}
    ${mktP('Seu trial encerrou. Seus dados, clientes e agendamentos estão seguros — assine para voltar a usar tudo.')}
    ${mktBox(`<p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;">O que você perde enquanto pausado:</p><ul style="margin:0;padding-left:16px;font-size:13px;color:#475569;"><li style="margin-bottom:4px;">Clientes não conseguem agendar</li><li style="margin-bottom:4px;">WhatsApp automático desligado</li><li>Relatórios financeiros inacessíveis</li></ul>`, '#FEF2F2', '#FCA5A5')}
    ${mktBtn('Reativar meu acesso →', 'https://workagenda.org/login')}
    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">R$ 89,90/mês · Sem fidelidade · Cancele quando quiser.</p>
  `);
}

function tplMktReactivation(name: string): string {
  return mktLayout('Volte para o WorkAgenda', `
    ${mktPill('Sentimos sua falta', '#8B5CF6', '#EDE9FE')}
    ${mktH(`${name}, o WorkAgenda evoluiu. Volte!`)}
    ${mktP('Desde que você saiu, melhoramos muito. Seus dados continuam guardados — é só reativar.')}
    ${mktList(['Lista de espera: preenche vagas canceladas automaticamente', 'Lembrete configurável: 1h, 2h ou 24h antes', 'Relatório de comissões por profissional', 'Página de agendamento com sua identidade visual'])}
    ${mktBtn('Voltar para o WorkAgenda →', 'https://workagenda.org/login')}
    <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">A partir de R$ 89,90/mês · Sem fidelidade.</p>
  `);
}

function tplMktAnnualUpgrade(name: string): string {
  const savings = (89.90 * 0.25 * 12).toFixed(2).replace('.', ',');
  const annualTotal = (89.90 * 0.75 * 12).toFixed(2).replace('.', ',');
  const monthlyTotal = (89.90 * 12).toFixed(2).replace('.', ',');
  return mktLayout('Economize 25% com o plano anual — WorkAgenda', `
    ${mktPill('Oferta exclusiva', '#16A34A', '#DCFCE7')}
    ${mktH(`${name}, economize R$&nbsp;${savings} por ano.`)}
    ${mktP('Você usa o WorkAgenda mensalmente. Migrando para o <strong>plano anual</strong>, você paga 25% menos — sem perder nenhuma funcionalidade.')}
    ${mktBox(`<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:12px;border-bottom:1px solid #E2E8F0;"><p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6B7280;">Atual — mensal</p><p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#9CA3AF;text-decoration:line-through;">R$ ${monthlyTotal}/ano</p></td></tr><tr><td style="padding-top:12px;"><p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16A34A;">Plano anual — 25% OFF</p><p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#111827;">R$ ${annualTotal}/ano</p><p style="margin:4px 0 0;font-size:13px;color:#16A34A;font-weight:700;">Você economiza R$ ${savings}</p></td></tr></table>`, '#F0FDF4', '#BBF7D0')}
    ${mktBtn('Migrar para plano anual →', 'https://workagenda.org/login')}
  `);
}

function tplMktNewsletter(name: string): string {
  const month = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return mktLayout(`Novidades WorkAgenda — ${month}`, `
    ${mktPill(`Novidades — ${month}`, '#2563EB', '#EFF6FF')}
    ${mktH(`Olá, ${name}! Veja o que chegou este mês.`)}
    ${mktP('Trabalhamos duro para deixar o WorkAgenda ainda melhor. Confira as novidades:')}
    ${mktBox(`<p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">🗑️ Exclusão de agendamentos</p><p style="margin:0 0 16px;font-size:13px;color:#475569;">Apague agendamentos concluídos ou cancelados direto do painel.</p><p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">💳 Método de pagamento padrão</p><p style="margin:0 0 16px;font-size:13px;color:#475569;">Defina o método padrão (Pix, Dinheiro ou Cartão) em Configurações → Agenda.</p><p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">⏱️ Indicador de tempo insuficiente</p><p style="margin:0;font-size:13px;color:#475569;">O painel agora mostra quando um lembrete não pode ser enviado por falta de antecedência.</p>`, '#F8FAFC', '#E2E8F0')}
    ${mktP('Continue gerenciando seu negócio com eficiência. Qualquer dúvida, nossa equipe está à disposição.')}
    ${mktBtn('Acessar o painel →', 'https://workagenda.org/login')}
  `);
}

function tplMktNPS(name: string): string {
  const baseUrl = 'https://workagenda.org/login';
  const scores  = [0,1,2,3,4,5,6,7,8,9,10];
  return mktLayout('Como está sua experiência com o WorkAgenda?', `
    ${mktPill('Sua opinião importa', '#F59E0B', '#FEF3C7')}
    ${mktH(`${name}, como está sendo sua experiência?`)}
    ${mktP('Você já usa o WorkAgenda há um tempo. Adoraríamos saber o que você acha — leva menos de 1 minuto.')}
    ${mktBox(`<p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#111827;">De 0 a 10, qual a probabilidade de você recomendar o WorkAgenda?</p><table cellpadding="0" cellspacing="3"><tr>${scores.map(n => `<td><a href="${baseUrl}?nps=${n}" style="display:inline-block;width:32px;height:32px;border-radius:7px;border:1px solid #E2E8F0;text-align:center;line-height:32px;font-size:12px;font-weight:700;color:#374151;text-decoration:none;background:#F8FAFC;">${n}</a></td>`).join('')}</tr></table><p style="margin:10px 0 0;font-size:11px;color:#94A3B8;">0 = muito improvável &nbsp;·&nbsp; 10 = com certeza</p>`, '#FFFBEB', '#FDE68A')}
    ${mktP('Tem sugestão específica? Responda este email — nossa equipe lê tudo.')}
  `);
}

export function generateMarketingHtml(campaignType: string, name: string, slug = ''): string {
  switch (campaignType) {
    case 'trial_welcome':    return tplMktTrialWelcome(name, slug);
    case 'trial_activation': return tplMktTrialActivation(name, slug);
    case 'trial_expiring':   return tplMktTrialExpiring(name, 2);
    case 'trial_expired':    return tplMktTrialExpired(name);
    case 'reactivation':     return tplMktReactivation(name);
    case 'annual_upgrade':   return tplMktAnnualUpgrade(name);
    case 'nps':              return tplMktNPS(name);
    default:                 return tplMktNewsletter(name);
  }
}

export async function sendMarketingEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) return;
  await getResend().emails.send({ from: FROM_EMAIL, to, subject, html });
}
