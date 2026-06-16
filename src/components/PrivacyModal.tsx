import React from 'react';
import { X } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Quem somos',
    text: 'A WorkAgenda é uma plataforma SaaS de gestão para barbearias e salões de beleza. Operamos como controladora dos dados pessoais coletados nesta plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).',
  },
  {
    title: '2. Dados que coletamos',
    text: 'Coletamos dados fornecidos diretamente por você (nome, e-mail, telefone, dados de estabelecimento) e dados gerados pelo uso da plataforma (agendamentos, histórico de atendimentos, movimentações financeiras). Não coletamos dados de pagamento sensíveis — as transações são processadas por parceiros certificados.',
  },
  {
    title: '3. Como usamos seus dados',
    text: 'Seus dados são usados exclusivamente para: (a) fornecer e melhorar os serviços da plataforma; (b) enviar notificações operacionais via WhatsApp, como confirmações e lembretes de agendamento; (c) gerar relatórios financeiros e de desempenho para o seu negócio; (d) cumprir obrigações legais.',
  },
  {
    title: '4. Compartilhamento',
    text: 'Não vendemos nem alugamos seus dados. Compartilhamos apenas com prestadores de serviço essenciais à operação da plataforma (infraestrutura de nuvem, gateway de WhatsApp), sempre sob acordos de confidencialidade e com as mesmas obrigações desta política.',
  },
  {
    title: '5. Retenção de dados',
    text: 'Mantemos seus dados enquanto sua conta estiver ativa. Após solicitação de exclusão, os dados são removidos em até 30 dias, exceto os que precisamos reter por obrigação legal (ex.: registros fiscais, conforme legislação vigente).',
  },
  {
    title: '6. Seus direitos (LGPD)',
    text: 'Você tem o direito de: acessar seus dados, corrigir informações incorretas, solicitar a exclusão (através da opção "Excluir Conta" em Configurações → Conta), revogar consentimento e obter informações sobre o tratamento realizado. Para exercer esses direitos, entre em contato pelo Suporte.',
  },
  {
    title: '7. Segurança',
    text: 'Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, incluindo criptografia em trânsito (TLS), autenticação segura e controles de acesso por função. Ainda assim, nenhum sistema é 100% inviolável — notificaremos você em caso de incidente que afete seus dados.',
  },
  {
    title: '8. Cookies e rastreamento',
    text: 'Utilizamos apenas cookies estritamente necessários à sessão de autenticação. Não utilizamos cookies de rastreamento ou publicidade de terceiros.',
  },
  {
    title: '9. Alterações nesta política',
    text: 'Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas por e-mail ou por aviso dentro da plataforma com antecedência mínima de 15 dias.',
  },
  {
    title: '10. Contato',
    text: 'Dúvidas ou solicitações relacionadas à privacidade podem ser enviadas pelo canal de Suporte da plataforma. Responderemos em até 5 dias úteis.',
  },
];

export default function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0d2240', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>Termos de Uso e Política de Privacidade</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Outfit, sans-serif' }}>WorkAgenda · Atualizada em junho de 2025</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Outfit, sans-serif' }}>
          {SECTIONS.map(({ title, text }) => (
            <div key={title}>
              <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h4>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '11px', background: '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
