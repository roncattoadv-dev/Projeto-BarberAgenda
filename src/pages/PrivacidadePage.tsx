import React from 'react';
import { Link } from 'react-router-dom';

const sectionTitle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.88)',
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 8,
  marginTop: 28,
};

const body: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: 13,
  lineHeight: 1.75,
};

export default function PrivacidadePage() {
  return (
    <div style={{ backgroundColor: '#0F172A', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', padding: '48px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
            ← Voltar
          </Link>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            Política de Privacidade
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>
            WorkAgenda · Última atualização: junho de 2026
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '32px 36px' }}>

          <p style={body}>
            A sua privacidade é importante para nós. Esta Política descreve quais dados coletamos, como os utilizamos e quais são seus direitos, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>

          <h2 style={sectionTitle}>1. Dados que Coletamos</h2>
          <p style={body}>
            Ao utilizar o WorkAgenda, podemos coletar os seguintes dados:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Dados de cadastro:</strong> nome, e-mail, telefone, CPF/CNPJ (opcional) e senha (armazenada de forma criptografada);</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Dados do negócio:</strong> nome da barbearia/salão, endereço da página de agendamento (slug);</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Dados dos clientes finais:</strong> nome e telefone dos clientes que realizam agendamentos via sua página pública;</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Dados de uso:</strong> logs de acesso, horários de login, ações realizadas na plataforma;</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: 'rgba(255,255,255,0.75)' }}>Dados técnicos:</strong> endereço IP, tipo de navegador, dispositivo.</li>
          </ul>

          <h2 style={sectionTitle}>2. Como Usamos seus Dados</h2>
          <p style={body}>
            Utilizamos seus dados para:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Criar e manter sua conta na plataforma;</li>
            <li style={{ marginBottom: 6 }}>Enviar confirmações, lembretes e notificações de agendamento via WhatsApp e e-mail;</li>
            <li style={{ marginBottom: 6 }}>Cobrar pela assinatura do plano pago;</li>
            <li style={{ marginBottom: 6 }}>Melhorar nossos serviços e corrigir problemas técnicos;</li>
            <li style={{ marginBottom: 6 }}>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h2 style={sectionTitle}>3. Armazenamento e Segurança</h2>
          <p style={body}>
            Seus dados são armazenados em servidores seguros utilizando a plataforma <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Supabase</strong>, com criptografia em trânsito (TLS) e em repouso. Adotamos boas práticas de segurança, incluindo autenticação com hashing de senhas (bcrypt) e controle de acesso por papel (RBAC).
          </p>
          <p style={{ ...body, marginTop: 8 }}>
            Apesar de nossos esforços, nenhum sistema é completamente inviolável. Em caso de incidente de segurança que afete seus dados, notificaremos os usuários impactados dentro do prazo legal.
          </p>

          <h2 style={sectionTitle}>4. Compartilhamento de Dados</h2>
          <p style={body}>
            Não vendemos seus dados pessoais. Podemos compartilhá-los somente:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Com prestadores de serviços essenciais ao funcionamento da plataforma (ex: Supabase para banco de dados, Resend para envio de e-mails, Evolution API para WhatsApp);</li>
            <li style={{ marginBottom: 6 }}>Quando exigido por lei, ordem judicial ou autoridade competente.</li>
          </ul>

          <h2 style={sectionTitle}>5. Cookies e Rastreamento</h2>
          <p style={body}>
            Utilizamos cookies de sessão para manter você autenticado. Nossa página inicial utiliza o <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Meta Pixel</strong> para mensurar o desempenho de anúncios. O painel administrativo e a página de agendamento não utilizam rastreamento de terceiros.
          </p>

          <h2 style={sectionTitle}>6. Seus Direitos (LGPD)</h2>
          <p style={body}>
            Como titular de dados, você tem direito a:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Confirmar a existência de tratamento de seus dados;</li>
            <li style={{ marginBottom: 6 }}>Acessar os dados que temos sobre você;</li>
            <li style={{ marginBottom: 6 }}>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li style={{ marginBottom: 6 }}>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li style={{ marginBottom: 6 }}>Revogar o consentimento a qualquer momento;</li>
            <li style={{ marginBottom: 6 }}>Solicitar a portabilidade dos seus dados.</li>
          </ul>
          <p style={{ ...body, marginTop: 8 }}>
            Para exercer qualquer desses direitos, entre em contato pelo e-mail <strong style={{ color: 'rgba(255,255,255,0.75)' }}>suporte@workagenda.org</strong>.
          </p>

          <h2 style={sectionTitle}>7. Retenção de Dados</h2>
          <p style={body}>
            Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta, os dados são retidos por até 90 dias para fins de auditoria e depois excluídos, salvo obrigação legal em contrário.
          </p>

          <h2 style={sectionTitle}>8. Alterações nesta Política</h2>
          <p style={body}>
            Podemos atualizar esta Política periodicamente. Notificaremos usuários ativos por e-mail com antecedência mínima de 15 dias antes de alterações relevantes. O uso continuado da plataforma após esse prazo implica aceitação da nova versão.
          </p>

          <h2 style={sectionTitle}>9. Contato e DPO</h2>
          <p style={body}>
            Para dúvidas, solicitações ou reclamações relacionadas à privacidade, entre em contato:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>E-mail: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>suporte@workagenda.org</strong></li>
            <li style={{ marginBottom: 6 }}>Você também pode registrar reclamações perante a Autoridade Nacional de Proteção de Dados (ANPD): <strong style={{ color: 'rgba(255,255,255,0.75)' }}>www.gov.br/anpd</strong></li>
          </ul>

        </div>

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
          © 2026 WorkAgenda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
