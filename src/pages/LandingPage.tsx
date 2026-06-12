// src/pages/LandingPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ── Icons (inline SVG para zero dependência extra) ────────────────────────────
const Icon = {
  Calendar: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  WhatsApp: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.065-1.112l-.291-.173-3.014.896.896-3.014-.173-.291A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  Users: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Zap: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Shield: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Smartphone: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  Clock: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Scissors: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  ),
  Menu: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  X: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#030F22',
  surface:  'rgba(255,255,255,0.04)',
  border:   'rgba(255,255,255,0.08)',
  text:     'rgba(255,255,255,0.88)',
  muted:    'rgba(255,255,255,0.45)',
  faint:    'rgba(255,255,255,0.18)',
  blue:     '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.25)',
};

const PLANS = [
  {
    id: 'mensal',
    label: 'Mensal',
    price: 97,
    period: '/mês',
    billing: 'Cobrado mensalmente',
    highlight: false,
    badge: null,
    perks: [
      'Agendamento online ilimitado',
      'WhatsApp automático',
      'Até 5 profissionais',
      'Gestão financeira',
      'Suporte via chat',
    ],
  },
  {
    id: 'semestral',
    label: 'Semestral',
    price: 77,
    period: '/mês',
    billing: 'R$ 462 cobrado a cada 6 meses',
    highlight: true,
    badge: 'Mais popular',
    perks: [
      'Tudo do plano Mensal',
      'Economia de 20%',
      'Profissionais ilimitados',
      'Templates WhatsApp personalizados',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
  },
  {
    id: 'anual',
    label: 'Anual',
    price: 67,
    period: '/mês',
    billing: 'R$ 804 cobrado anualmente',
    highlight: false,
    badge: 'Melhor custo-benefício',
    perks: [
      'Tudo do plano Semestral',
      'Economia de 31%',
      'Onboarding dedicado',
      'Personalização de domínio',
      'SLA de suporte 4h',
      '2 meses grátis',
    ],
  },
];

const FAQS = [
  {
    q: 'Preciso instalar algum aplicativo?',
    a: 'Não. O WorkAgenda funciona 100% no navegador, em qualquer dispositivo. Seus clientes agendam pelo link e você gerencia tudo pelo painel web.',
  },
  {
    q: 'Como funciona o agendamento online dos clientes?',
    a: 'Cada barbearia recebe uma página pública personalizada (ex: workagenda.org/minha-barbearia). O cliente escolhe o serviço, o profissional, a data e o horário — sem precisar criar conta.',
  },
  {
    q: 'O WhatsApp automático precisa de número exclusivo?',
    a: 'Sim. Recomendamos um chip dedicado para a barbearia. A conexão é feita via QR Code em menos de 1 minuto, e as mensagens de confirmação e lembrete são enviadas automaticamente.',
  },
  {
    q: 'Posso testar antes de contratar?',
    a: 'Sim. Oferecemos 7 dias de trial grátis, sem precisar de cartão de crédito. Você terá acesso a todas as funcionalidades do plano Semestral durante o período de teste.',
  },
  {
    q: 'Como é feito o pagamento?',
    a: 'Aceitamos PIX e cartão de crédito. O pagamento é processado de forma segura e você recebe confirmação imediata.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Não existe fidelidade. Você pode cancelar sua assinatura a qualquer momento pelo próprio painel, sem burocracia.',
  },
];

// ── Componentes menores ───────────────────────────────────────────────────────
function Badge({ children, color = C.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      background: color + '18', border: `1px solid ${color}44`,
      color, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 22px',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.blue}18`, border: `1px solid ${C.blue}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.blue }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
      <span style={{ marginTop: 2, flexShrink: 0, color: '#4ade80' }}><Icon.Check /></span>
      <span>{children}</span>
    </li>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{q}</span>
        <span style={{ color: C.muted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><Icon.ChevronDown /></span>
      </button>
      {open && <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: '0 0 20px', paddingRight: 32 }}>{a}</p>}
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 max(24px, calc((100vw - 1100px)/2))',
    height: 64,
    background: scrolled ? 'rgba(3,15,34,0.92)' : 'transparent',
    backdropFilter: scrolled ? 'blur(16px)' : 'none',
    borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
    transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
    fontFamily: 'Outfit, sans-serif',
  };

  const section = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '96px max(24px, calc((100vw - 1100px)/2))',
    fontFamily: 'Outfit, sans-serif',
    ...extra,
  });

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: 'Outfit, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .hero-anim { animation: fadeUp 0.7s ease both; }
        .hero-anim-2 { animation: fadeUp 0.7s 0.15s ease both; }
        .hero-anim-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .float { animation: float 4s ease-in-out infinite; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .stack-mobile { flex-direction: column !important; }
          .full-mobile { width: 100% !important; }
          .center-mobile { text-align: center !important; align-items: center !important; }
        }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 34, objectFit: 'contain' }}
          />
        </div>

        {/* Desktop links */}
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h]) => (
            <a key={h} href={h} style={{ fontSize: 14, color: C.muted, textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
              {l}
            </a>
          ))}
        </div>

        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/login" style={{ fontSize: 13, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '8px 16px' }}>
            Entrar
          </Link>
          <Link to="/cadastro" style={{
            fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none',
            padding: '9px 20px', background: C.blue, borderRadius: 10, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Teste grátis →
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="hide-desktop" onClick={() => setMenuOpen(v => !v)}
          style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', display: 'none' }}
          id="mobile-menu-btn">
          {menuOpen ? <Icon.X /> : <Icon.Menu />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99, background: C.bg,
          paddingTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
          fontFamily: 'Outfit, sans-serif',
        }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h]) => (
            <a key={h} href={h} onClick={() => setMenuOpen(false)}
              style={{ fontSize: 20, color: C.text, textDecoration: 'none', fontWeight: 600 }}>{l}</a>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '80%', marginTop: 16 }}>
            <Link to="/login" onClick={() => setMenuOpen(false)}
              style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '12px 0', border: `1px solid ${C.border}`, borderRadius: 12 }}>
              Entrar
            </Link>
            <Link to="/cadastro" onClick={() => setMenuOpen(false)}
              style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '13px 0', background: C.blue, borderRadius: 12 }}>
              Teste grátis →
            </Link>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ ...section({ paddingTop: 160, paddingBottom: 80 }), position: 'relative', textAlign: 'center' }}>
        {/* Glow background */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="hero-anim">
          <Badge color={C.blue}>✦ Plataforma para barbearias e salões</Badge>
        </div>

        <h1 className="hero-anim-2" style={{
          fontSize: 'clamp(36px, 6vw, 68px)', fontWeight: 800, lineHeight: 1.08,
          margin: '24px auto 20px', maxWidth: 820,
          background: 'linear-gradient(135deg, #fff 40%, rgba(255,255,255,0.45))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-1.5px',
        }}>
          Sua barbearia cheia,<br />sem esforço nenhum
        </h1>

        <p className="hero-anim-3" style={{ fontSize: 'clamp(15px,2vw,18px)', color: C.muted, maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.65 }}>
          Agendamento online, lembretes automáticos no WhatsApp e gestão financeira — tudo numa plataforma feita para barbearias e salões.
        </p>

        <div className="hero-anim-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/cadastro" style={{
            fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
            padding: '14px 32px', background: C.blue, borderRadius: 12,
            boxShadow: `0 0 40px ${C.blueGlow}`, transition: 'all 0.2s',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 40px ${C.blueGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 40px ${C.blueGlow}`; }}>
            Começar 7 dias grátis →
          </Link>
          <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '14px 24px', border: `1px solid ${C.border}`, borderRadius: 12, transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.faint)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
            Ver funcionalidades
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 20 }}>Sem cartão de crédito · Cancele quando quiser</p>

        {/* Stats bar */}
        <div className="hero-anim-3" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(24px,5vw,64px)', marginTop: 72, flexWrap: 'wrap',
        }}>
          {[
            ['Agendamentos', 'realizados'],
            ['Mensagens WhatsApp', 'enviadas/mês'],
            ['Barbearias', 'ativas na plataforma'],
            ['Uptime', 'garantido'],
          ].map(([n, l], i) => {
            const vals = ['12.000+', '45.000+', '200+', '99.9%'];
            return (
              <div key={i} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>{vals[i]}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{n}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>{l}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pilares principais ────────────────────────────────────────────────── */}
      <section id="features" style={section({ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Badge color="#a78bfa">Funcionalidades</Badge>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Tudo que sua barbearia precisa
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 480, margin: '0 auto' }}>
            Uma plataforma completa para você focar no que realmente importa: atender bem.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          <FeatureCard icon={<Icon.Calendar />} title="Agendamento Online" desc="Página de booking pública e personalizável. O cliente agenda em menos de 2 minutos, de qualquer dispositivo, sem criar conta." />
          <FeatureCard icon={<Icon.WhatsApp />} title="WhatsApp Automático" desc="Confirmação e lembrete enviados automaticamente no WhatsApp. Reduza faltas e mantenha seus clientes informados." />
          <FeatureCard icon={<Icon.Chart />} title="Gestão Financeira" desc="Receitas, despesas, comissões por profissional e fluxo de caixa em tempo real. Tudo numa visão clara e organizada." />
          <FeatureCard icon={<Icon.Users />} title="Multi-Profissional" desc="Cadastre toda sua equipe, defina horários individuais, acompanhe comissões e rendimentos por profissional." />
          <FeatureCard icon={<Icon.Smartphone />} title="100% Mobile" desc="Seu cliente agenda pelo celular, você gerencia pelo celular. Interface responsiva e rápida em qualquer tela." />
          <FeatureCard icon={<Icon.Shield />} title="Dados Seguros" desc="Plataforma em conformidade com a LGPD. Logs de auditoria, dados criptografados e controle total sobre suas informações." />
        </div>
      </section>

      {/* ── Agendamento Online (detalhe) ──────────────────────────────────────── */}
      <section style={section()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
          {/* Visual mockup */}
          <div className="float full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 24, padding: 28, maxWidth: 360 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#2563EB18', border: '1px solid #2563EB33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💈</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 13 }}>Barbearia Dom Pedro</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>workagenda.org/dom-pedro</p>
                </div>
              </div>
              {[['Corte Degradê Premium', '45min', 'R$ 55'],['Barba Completa', '30min', 'R$ 35'],['Combo Cabelo + Barba', '60min', 'R$ 80']].map(([name,dur,price]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8, background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text }}>{name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{dur}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>{price}</span>
                </div>
              ))}
              <button style={{ width: '100%', padding: '12px', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', marginTop: 8 }}>
                Escolher horário →
              </button>
            </div>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <Badge color="#3B82F6">Agendamento Online</Badge>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              Seu cliente agenda em qualquer hora, de qualquer lugar
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>
              Chega de responder "qual horário está disponível?" no WhatsApp. Sua barbearia tem uma página profissional com todos os serviços, profissionais e horários disponíveis em tempo real.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckItem>Página personalizada com sua logo e cor</CheckItem>
              <CheckItem>Seleção de profissional, data e horário</CheckItem>
              <CheckItem>Confirmação imediata com código único</CheckItem>
              <CheckItem>Histórico de agendamentos por telefone</CheckItem>
              <CheckItem>Sistema de avaliação 5 estrelas</CheckItem>
              <CheckItem>Zero login necessário para o cliente</CheckItem>
            </ul>
          </div>
        </div>
      </section>

      {/* ── WhatsApp Automático (detalhe) ─────────────────────────────────────── */}
      <section style={section({ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
          {/* Text */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <Badge color="#25D366">WhatsApp Automático</Badge>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              Reduza faltas em até 70% com lembretes automáticos
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>
              Assim que o cliente agenda, ele recebe uma confirmação no WhatsApp. No dia anterior, recebe um lembrete. Tudo automático, sem você precisar fazer nada.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckItem>Confirmação automática ao agendar</CheckItem>
              <CheckItem>Lembrete configurável (1h, 2h, 24h antes)</CheckItem>
              <CheckItem>Mensagem de cancelamento automática</CheckItem>
              <CheckItem>Templates personalizáveis por barbearia</CheckItem>
              <CheckItem>Link direto para cancelar ou reagendar</CheckItem>
              <CheckItem>Envio em lote para múltiplos agendamentos</CheckItem>
            </ul>
          </div>

          {/* Visual mockup */}
          <div className="float full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <div style={{ background: '#111B21', borderRadius: 24, padding: 20, maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D36618', border: '1px solid #25D36644', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💈</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#e9edef', fontSize: 13 }}>Barbearia Dom Pedro</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#8696a0' }}>WorkAgenda</p>
                </div>
              </div>
              {[
                { msg: 'Olá João! 😊\n\n✅ *Agendamento Confirmado*\n\n📅 Data: 18 de Jun\n⏰ Horário: 14:00\n✂️ Serviço: Corte Degradê\n👤 Profissional: Gustavo\n\n📍 Barbearia Dom Pedro\n\nVer agendamento:\nhttps://workagenda.org/...', time: '14:23', received: true },
                { msg: 'Olá João! 👋\n\n⏰ *Lembrete — Amanhã*\n\n✂️ Corte Degradê com Gustavo\n📅 Amanhã, 18 Jun às 14:00\n\nTe esperamos!', time: '08:00', received: true },
              ].map((m, i) => (
                <div key={i} style={{ background: m.received ? '#1f2c34' : '#005c4b', borderRadius: m.received ? '0 10px 10px 10px' : '10px 0 10px 10px', padding: '10px 12px', marginBottom: 10, maxWidth: '90%', marginLeft: m.received ? 0 : 'auto' }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#e9edef', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.msg}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#8696a0', textAlign: 'right' }}>{m.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Financeiro (detalhe) ──────────────────────────────────────────────── */}
      <section style={section()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
          {/* Mockup */}
          <div className="float full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: 24, maxWidth: 360 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[['Receita Mensal','R$ 8.450','#4ade80'],['Comissões','R$ 3.380','#60a5fa'],['Despesas','R$ 620','#f87171'],['Resultado','R$ 4.450','#a78bfa']].map(([l,v,c]) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Comissões da equipe</p>
                {[['Gustavo Lima', '40%','R$ 1.820'],['Felipe Melo', '40%','R$ 980'],['Carlos Silva', '35%','R$ 580']].map(([n,p,v]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3B82F618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✂️</div>
                      <span style={{ fontSize: 13, color: C.text }}>{n}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{v}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{p} comissão</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <Badge color="#f59e0b">Gestão Financeira</Badge>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              Saiba exatamente quanto sua barbearia ganha
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>
              Chega de planilha. Veja receitas, despesas e comissões de cada profissional em tempo real. Tome decisões com base em dados, não em achismo.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckItem>Receita e despesas em tempo real</CheckItem>
              <CheckItem>Comissões calculadas automaticamente</CheckItem>
              <CheckItem>Divisão por profissional detalhada</CheckItem>
              <CheckItem>Fluxo de caixa com histórico completo</CheckItem>
              <CheckItem>Vendas diretas (PDV) pelo painel</CheckItem>
              <CheckItem>MRR, ARR e métricas do negócio</CheckItem>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Para quem é ──────────────────────────────────────────────────────── */}
      <section style={section({ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Badge color="#f59e0b">Para quem é</Badge>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Feito para quem trabalha com beleza
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            ['💈', 'Barbearias', 'Do profissional solo ao estabelecimento com vários cadeiras.'],
            ['✂️', 'Salões de Beleza', 'Cabelo, manicure, design de sobrancelha — tudo organizado.'],
            ['💅', 'Estúdios de Estética', 'Limpeza de pele, design de sobrancelha, maquiagem e mais.'],
            ['🪒', 'Profissionais Autônomos', 'Trabalha sozinho? Organize seus horários e elimine o vai e vem no WhatsApp.'],
          ].map(([emoji, title, desc]) => (
            <div key={title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: '0 0 12px' }}>{emoji}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{title}</p>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Depoimentos ──────────────────────────────────────────────────────── */}
      <section style={section()}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Badge color="#f59e0b">Depoimentos</Badge>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            O que dizem nossos clientes
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
          {[
            { name: 'Bruno Almeida', role: 'Dono — Barbearia Dom Pedro', text: 'Antes eu ficava o dia inteiro respondendo WhatsApp pra confirmar horário. Hoje o sistema faz tudo. Minhas faltas caíram mais de 60%.', stars: 5 },
            { name: 'Camila Ferreira', role: 'Gerente — Studio Bella Donna', text: 'A gestão de comissões era um pesadelo. Agora em dois cliques sei exatamente quanto cada profissional vai receber. Economizo horas todo mês.', stars: 5 },
            { name: 'Rafael Santos', role: 'Barbeiro autônomo', text: 'Trabalho sozinho e precisava de algo simples. O WorkAgenda é exatamente isso — simples de configurar e os clientes adoraram poder agendar pelo link.', stars: 5 },
          ].map(({ name, role, text, stars }) => (
            <div key={name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: stars }).map((_, i) => (
                  <span key={i} style={{ color: '#fbbf24' }}><Icon.Star /></span>
                ))}
              </div>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: 0, flex: 1 }}>"{text}"</p>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 14 }}>{name}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Preços ───────────────────────────────────────────────────────────── */}
      <section id="precos" style={section({ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Badge color="#a78bfa">Preços</Badge>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Planos simples e transparentes
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 420, margin: '0 auto' }}>
            7 dias grátis em qualquer plano. Sem cartão de crédito, sem pegadinhas.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.highlight ? 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.08))' : C.surface,
              border: `1px solid ${plan.highlight ? 'rgba(59,130,246,0.4)' : C.border}`,
              borderRadius: 20, padding: '32px 28px', position: 'relative',
              boxShadow: plan.highlight ? `0 0 40px ${C.blueGlow}` : 'none',
              display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                  <span style={{ background: plan.highlight ? C.blue : '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 12px' }}>{plan.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>R$</span>
                <span style={{ fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: C.muted }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 28px' }}>{plan.billing}</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {plan.perks.map(p => <CheckItem key={p}>{p}</CheckItem>)}
              </ul>

              <Link to="/cadastro" style={{
                display: 'block', textAlign: 'center', padding: '13px', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                background: plan.highlight ? C.blue : 'rgba(255,255,255,0.07)',
                color: plan.highlight ? '#fff' : C.text,
                border: `1px solid ${plan.highlight ? 'transparent' : C.border}`,
                borderRadius: 12, transition: 'all 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Começar grátis →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" style={section()}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Badge color="#4ade80">Dúvidas frequentes</Badge>
            <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '16px 0 0', letterSpacing: '-0.5px' }}>
              Tem alguma dúvida?
            </h2>
          </div>
          {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      {/* ── CTA Final ────────────────────────────────────────────────────────── */}
      <section style={{ ...section({ paddingTop: 80, paddingBottom: 96 }), textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 'clamp(40px,6vw,72px) clamp(24px,6vw,72px)', maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 40, margin: '0 0 16px' }}>🚀</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
            Pronto para transformar sua barbearia?
          </h2>
          <p style={{ fontSize: 16, color: C.muted, margin: '0 0 36px', lineHeight: 1.6 }}>
            Junte-se a centenas de barbearias que já usam o WorkAgenda. Configure em menos de 10 minutos.
          </p>
          <Link to="/cadastro" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 16, fontWeight: 700, color: '#fff', textDecoration: 'none',
            padding: '16px 40px', background: C.blue, borderRadius: 14,
            boxShadow: `0 0 40px ${C.blueGlow}`, transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${C.blueGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 40px ${C.blueGlow}`; }}>
            Criar minha conta grátis →
          </Link>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 16 }}>7 dias grátis · Sem cartão · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px max(24px,calc((100vw - 1100px)/2))', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
              alt="WorkAgenda"
              style={{ height: 28, objectFit: 'contain' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq'],['Login','/login'],['Criar conta','/cadastro']].map(([l,h]) => (
              h.startsWith('/') ?
                <Link key={l} to={h} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.muted)}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>{l}</Link> :
                <a key={l} href={h} style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.muted)}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
            © {new Date().getFullYear()} WorkAgenda · workagenda.org
          </p>
        </div>
      </footer>
    </div>
  );
}
