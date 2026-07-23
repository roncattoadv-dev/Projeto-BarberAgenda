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

export default function TermosPage() {
  return (
    <div style={{ backgroundColor: '#0F172A', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', padding: '48px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
            ← Voltar
          </Link>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            Termos de Uso
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>
            WorkAgenda · Última atualização: junho de 2026
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '32px 36px' }}>

          <p style={body}>
            Bem-vindo ao WorkAgenda. Ao criar uma conta e utilizar nossa plataforma, você concorda com os termos e condições descritos abaixo. Leia-os com atenção antes de prosseguir.
          </p>

          <h2 style={sectionTitle}>1. Sobre o Serviço</h2>
          <p style={body}>
            O WorkAgenda é uma plataforma de gestão de agendamentos voltada para barbearias, salões e negócios do setor de beleza. Oferecemos ferramentas para agendamento online, gerenciamento de clientes, disparo de notificações via WhatsApp e e-mail, e controle de agenda de profissionais.
          </p>

          <h2 style={sectionTitle}>2. Cadastro e Elegibilidade</h2>
          <p style={body}>
            Para utilizar o WorkAgenda, você deve ter ao menos 18 anos de idade e possuir capacidade legal para celebrar contratos. Ao se cadastrar, você se responsabiliza por manter suas credenciais de acesso em sigilo e por todas as ações realizadas em sua conta.
          </p>

          <h2 style={sectionTitle}>3. Período de Teste Gratuito</h2>
          <p style={body}>
            Toda conta nova tem direito a <strong style={{ color: 'rgba(255,255,255,0.88)' }}>7 (sete) dias de uso gratuito</strong>, sem necessidade de informar dados de pagamento. Ao término do período de teste, o acesso às funcionalidades pode ser suspenso até a contratação de um plano pago.
          </p>

          <h2 style={sectionTitle}>4. Planos e Pagamento</h2>
          <p style={body}>
            Após o período de teste, o plano padrão custa <strong style={{ color: 'rgba(255,255,255,0.88)' }}>R$ 89,90 por mês</strong>. O link de pagamento será enviado ao e-mail cadastrado. O acesso permanece ativo enquanto o plano estiver em dia. Não realizamos cobranças automáticas sem anuência prévia do usuário.
          </p>

          <h2 style={sectionTitle}>5. Cancelamento</h2>
          <p style={body}>
            Você pode cancelar sua assinatura a qualquer momento, sem multa ou fidelidade. Após o cancelamento, sua conta permanece acessível até o final do período já pago. Não realizamos reembolso de períodos parciais.
          </p>

          <h2 style={sectionTitle}>6. Responsabilidades do Usuário</h2>
          <p style={body}>
            Você é responsável por:
          </p>
          <ul style={{ ...body, paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Manter os dados cadastrais atualizados e verdadeiros;</li>
            <li style={{ marginBottom: 6 }}>Garantir que o uso das funcionalidades de mensagens (WhatsApp e e-mail) está em conformidade com a legislação vigente e com as políticas das plataformas de envio;</li>
            <li style={{ marginBottom: 6 }}>Obter consentimento de seus clientes para receber comunicações;</li>
            <li style={{ marginBottom: 6 }}>Não utilizar a plataforma para fins ilícitos, ofensivos ou que violem direitos de terceiros.</li>
          </ul>

          <h2 style={sectionTitle}>7. Disponibilidade do Serviço</h2>
          <p style={body}>
            O WorkAgenda se esforça para manter a plataforma disponível 24 horas por dia, 7 dias por semana. No entanto, não garantimos disponibilidade ininterrupta, podendo ocorrer manutenções programadas ou indisponibilidades por motivos técnicos. Comunicaremos interrupções planejadas com antecedência sempre que possível.
          </p>

          <h2 style={sectionTitle}>8. Propriedade Intelectual</h2>
          <p style={body}>
            Todos os direitos sobre a plataforma WorkAgenda, incluindo código-fonte, design, marca e conteúdos, são de propriedade exclusiva de seus desenvolvedores. É vedada a reprodução, redistribuição ou engenharia reversa sem autorização prévia por escrito.
          </p>

          <h2 style={sectionTitle}>9. Limitação de Responsabilidade</h2>
          <p style={body}>
            O WorkAgenda não se responsabiliza por perdas indiretas, danos emergentes ou lucros cessantes decorrentes do uso ou impossibilidade de uso da plataforma. Nossa responsabilidade total fica limitada ao valor pago pelo usuário nos últimos 30 dias.
          </p>

          <h2 style={sectionTitle}>10. Alterações nos Termos</h2>
          <p style={body}>
            Podemos atualizar estes Termos periodicamente. Notificaremos usuários ativos por e-mail com antecedência mínima de 15 dias antes de alterações materiais entrarem em vigor. O uso continuado da plataforma após esse prazo implica aceitação dos novos termos.
          </p>

          <h2 style={sectionTitle}>11. Lei Aplicável e Foro</h2>
          <p style={body}>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>

          <h2 style={sectionTitle}>12. Contato</h2>
          <p style={body}>
            Em caso de dúvidas sobre estes Termos, entre em contato pelo e-mail <strong style={{ color: 'rgba(255,255,255,0.75)' }}>suporte@workagenda.org</strong>.
          </p>

        </div>

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
          © 2026 WorkAgenda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
