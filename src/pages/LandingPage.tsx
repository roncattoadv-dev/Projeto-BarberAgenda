// src/pages/LandingPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ── Icons ─────────────────────────────────────────────────────────────────────
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

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0F172A',
  surface:  '#1E293B',
  border:   '#334155',
  text:     'rgba(255,255,255,0.88)',
  muted:    'rgba(255,255,255,0.50)',
  faint:    'rgba(255,255,255,0.18)',
  blue:     '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.25)',
};

// ── Planos — idênticos ao SaaS (base R$ 89,90) ───────────────────────────────
const BASE = 89.90;
const PLANS = [
  {
    id: 'mensal', label: 'Mensal', months: 1, discountPct: 0,
    price: BASE, totalLabel: 'R$ 89,90/mês',
    billing: 'Cobrado mensalmente',
    highlight: false, badge: null as string | null,
    color: '#3b82f6',
  },
  {
    id: 'trimestral', label: 'Trimestral', months: 3, discountPct: 15,
    price: parseFloat((BASE * 0.85).toFixed(2)), totalLabel: `R$ ${(BASE * 0.85 * 3).toFixed(2).replace('.', ',')} a cada 3 meses`,
    billing: `R$ ${(BASE * 0.85 * 3).toFixed(2).replace('.', ',')} cobrado trimestral`,
    highlight: true, badge: '15% OFF',
    color: '#8b5cf6',
  },
  {
    id: 'anual', label: 'Anual', months: 12, discountPct: 25,
    price: parseFloat((BASE * 0.75).toFixed(2)), totalLabel: `R$ ${(BASE * 0.75 * 12).toFixed(2).replace('.', ',')} por ano`,
    billing: `R$ ${(BASE * 0.75 * 12).toFixed(2).replace('.', ',')} cobrado anualmente`,
    highlight: false, badge: 'Melhor valor',
    color: '#10b981',
  },
];

const PLAN_FEATURES = [
  'Agendamento online ilimitado',
  'WhatsApp automático (confirmação + lembrete)',
  'Gestão financeira completa',
  'Multi-profissional com comissões automáticas',
  'Página pública personalizada',
  'Histórico de clientes',
  'Relatórios e métricas',
  '7 dias grátis para começar',
  'Suporte via chat',
];

const FAQS = [
  {
    q: 'Preciso instalar algum aplicativo?',
    a: 'Não. O WorkAgenda funciona 100% no navegador, em qualquer dispositivo. Seus clientes agendam pelo link e você gerencia tudo pelo painel web.',
  },
  {
    q: 'Como funciona o agendamento online dos clientes?',
    a: 'Cada negócio recebe uma página pública personalizada (ex: workagenda.org/meu-negocio). O cliente escolhe o serviço, o profissional, a data e o horário — sem precisar criar conta.',
  },
  {
    q: 'O WhatsApp automático precisa de número exclusivo?',
    a: 'Sim. Recomendamos um chip dedicado ao negócio. A conexão é feita via QR Code em menos de 1 minuto, e as mensagens de confirmação e lembrete são enviadas automaticamente.',
  },
  {
    q: 'Posso testar antes de contratar?',
    a: 'Sim. Oferecemos 7 dias de trial grátis, sem precisar de cartão de crédito. Você terá acesso a todas as funcionalidades durante o período de teste.',
  },
  {
    q: 'Qual a diferença entre os planos?',
    a: 'Todos os planos têm exatamente as mesmas funcionalidades. A diferença é só o período de cobrança: mensal, trimestral (15% de desconto) ou anual (25% de desconto).',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Não existe fidelidade. Você pode cancelar sua assinatura a qualquer momento pelo próprio painel, sem burocracia.',
  },
];

// ── Imagens do sistema (16:9) ─────────────────────────────────────────────────
const IMGS = [
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20Image%20June%2012,%202026%20-%202_34AM.png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20Image%20June%2012,%202026%20-%202_36AM.png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20Image%20June%2012,%202026%20-%202_38AM.png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20Image%20June%2012,%202026%20-%202_46AM.png',
];

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Badge({ children, color = C.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      background: color + '20', border: `1px solid ${color}44`,
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
      display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#475569')}
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

// Imagem 16:9 com borda e sombra
function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', aspectRatio: '16/9', width: '100%' }}>
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
    background: scrolled ? 'rgba(15,23,42,0.95)' : 'transparent',
    backdropFilter: scrolled ? 'blur(16px)' : 'none',
    borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
    transition: 'background 0.3s, border-color 0.3s',
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
        .hero-anim  { animation: fadeUp 0.7s ease both; }
        .hero-anim-2{ animation: fadeUp 0.7s 0.15s ease both; }
        .hero-anim-3{ animation: fadeUp 0.7s 0.3s ease both; }
        .float { animation: float 4s ease-in-out infinite; }
        @media (max-width: 768px) {
          .hide-mobile  { display: none !important; }
          .stack-mobile { flex-direction: column !important; }
          .full-mobile  { width: 100% !important; }
          .center-mobile{ text-align: center !important; align-items: center !important; }
        }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 34, objectFit: 'contain' }}
          />
        </div>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h]) => (
            <a key={h} href={h} style={{ fontSize: 14, color: C.muted, textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>{l}</a>
          ))}
        </div>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/login" style={{ fontSize: 13, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '8px 16px' }}>Entrar</Link>
          <Link to="/cadastro" style={{ fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '9px 20px', background: C.blue, borderRadius: 10, transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Teste grátis →
          </Link>
        </div>
        <button className="hide-desktop" onClick={() => setMenuOpen(v => !v)}
          style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', display: 'none' }} id="mobile-menu-btn">
          {menuOpen ? <Icon.X /> : <Icon.Menu />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99, background: C.bg, paddingTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, fontFamily: 'Outfit, sans-serif' }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h]) => (
            <a key={h} href={h} onClick={() => setMenuOpen(false)} style={{ fontSize: 20, color: C.text, textDecoration: 'none', fontWeight: 600 }}>{l}</a>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '80%', marginTop: 16 }}>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '12px 0', border: `1px solid ${C.border}`, borderRadius: 12 }}>Entrar</Link>
            <Link to="/cadastro" onClick={() => setMenuOpen(false)} style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '13px 0', background: C.blue, borderRadius: 12 }}>Teste grátis →</Link>
          </div>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ ...section({ paddingTop: 160, paddingBottom: 72 }), position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="hero-anim">
          <Badge color={C.blue}>✦ Plataforma para barbearias e salões</Badge>
        </div>
        <h1 className="hero-anim-2" style={{ fontSize: 'clamp(36px,6vw,68px)', fontWeight: 800, lineHeight: 1.08, margin: '24px auto 20px', maxWidth: 820, background: 'linear-gradient(135deg,#fff 40%,rgba(255,255,255,0.45))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1.5px' }}>
          Sua barbearia cheia,<br />sem esforço nenhum
        </h1>
        <p className="hero-anim-3" style={{ fontSize: 'clamp(15px,2vw,18px)', color: C.muted, maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.65 }}>
          Agendamento online, lembretes automáticos no WhatsApp e gestão financeira — tudo numa plataforma feita para barbearias e salões.
        </p>
        <div className="hero-anim-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/cadastro" style={{ fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '14px 32px', background: C.blue, borderRadius: 12, boxShadow: `0 0 40px ${C.blueGlow}`, transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 40px ${C.blueGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 40px ${C.blueGlow}`; }}>
            Começar 7 dias grátis →
          </Link>
          <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: C.muted, textDecoration: 'none', padding: '14px 24px', border: `1px solid ${C.border}`, borderRadius: 12, transition: 'border-color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#475569')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
            Ver funcionalidades
          </a>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginTop: 20 }}>Sem cartão de crédito · Cancele quando quiser</p>

        {/* Stats bar */}
        <div className="hero-anim-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(24px,5vw,64px)', marginTop: 72, flexWrap: 'wrap' }}>
          {[['12.000+','Agendamentos','realizados'],['45.000+','Mensagens WhatsApp','enviadas/mês'],['200+','Negócios','ativos na plataforma'],['99.9%','Uptime','garantido']].map(([v,n,l],i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>{v}</p>
              <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{n}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Screenshot 1 — painel principal ─────────────────────────────────── */}
      <section style={{ padding: '0 max(24px, calc((100vw - 1100px)/2))', paddingBottom: 80, fontFamily: 'Outfit, sans-serif' }}>
        <Screenshot src={IMGS[0]} alt="WorkAgenda — painel de agendamentos" />
      </section>

      {/* ── Funcionalidades (cards) ──────────────────────────────────────────── */}
      <section id="features" style={section({ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Badge color="#a78bfa">Funcionalidades</Badge>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Tudo que seu negócio precisa
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
          <FeatureCard icon={<Icon.Smartphone />} title="Mobile para o cliente" desc="O cliente acessa pelo celular, escolhe o serviço e confirma em segundos. Sem app, sem cadastro, só o link." />
          <FeatureCard icon={<Icon.Shield />} title="Dados Seguros" desc="Plataforma em conformidade com a LGPD. Logs de auditoria, dados criptografados e controle total sobre suas informações." />
        </div>
      </section>

      {/* ── Detalhe: Agendamento Online ──────────────────────────────────────── */}
      <section style={section()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
          <div className="full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <Screenshot src={IMGS[1]} alt="WorkAgenda — agendamento online" />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Badge color="#3B82F6">Agendamento Online</Badge>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              Seu cliente agenda em qualquer hora, de qualquer lugar
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 28 }}>
              Chega de responder "qual horário está disponível?" no WhatsApp. Seu negócio tem uma página profissional com todos os serviços, profissionais e horários disponíveis em tempo real.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CheckItem>Página personalizada com sua logo e cor</CheckItem>
              <CheckItem>Seleção de profissional, data e horário</CheckItem>
              <CheckItem>Confirmação imediata com código único</CheckItem>
              <CheckItem>Histórico de agendamentos por telefone</CheckItem>
              <CheckItem>Link direto para cancelar ou reagendar</CheckItem>
              <CheckItem>Zero login necessário para o cliente</CheckItem>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Detalhe: WhatsApp ────────────────────────────────────────────────── */}
      <section style={section({ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
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
              <CheckItem>Link direto para cancelar ou reagendar</CheckItem>
              <CheckItem>Conexão via QR Code em menos de 1 minuto</CheckItem>
              <CheckItem>Um número exclusivo por negócio</CheckItem>
            </ul>
          </div>
          <div className="full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <Screenshot src={IMGS[2]} alt="WorkAgenda — WhatsApp automático" />
          </div>
        </div>
      </section>

      {/* ── Detalhe: Financeiro ──────────────────────────────────────────────── */}
      <section style={section()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
          <div className="full-mobile" style={{ flex: 1, minWidth: 280 }}>
            <Screenshot src={IMGS[3]} alt="WorkAgenda — gestão financeira" />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Badge color="#f59e0b">Gestão Financeira</Badge>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, margin: '16px 0 16px', lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              Saiba exatamente quanto seu negócio ganha
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
              <CheckItem>Métricas e relatórios do negócio</CheckItem>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Para quem é ─────────────────────────────────────────────────────── */}
      <section style={section({ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Badge color="#f59e0b">Para quem é</Badge>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Feito para quem trabalha com beleza
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            ['💈','Barbearias','Do profissional solo ao estabelecimento com várias cadeiras.'],
            ['✂️','Salões de Beleza','Cabelo, manicure, design de sobrancelha — tudo organizado.'],
            ['💅','Estúdios de Estética','Limpeza de pele, design de sobrancelha, maquiagem e mais.'],
            ['🪒','Profissionais Autônomos','Trabalha sozinho? Organize seus horários e elimine o vai e vem no WhatsApp.'],
          ].map(([emoji,title,desc]) => (
            <div key={title as string} style={{ background: '#0F172A', border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 40, margin: '0 0 12px' }}>{emoji}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{title}</p>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Depoimentos ─────────────────────────────────────────────────────── */}
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
                {Array.from({ length: stars }).map((_,i) => <span key={i} style={{ color: '#fbbf24' }}><Icon.Star /></span>)}
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

      {/* ── Preços ──────────────────────────────────────────────────────────── */}
      <section id="precos" style={section({ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` })}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Badge color="#a78bfa">Preços</Badge>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, margin: '16px 0 12px', letterSpacing: '-0.5px' }}>
            Planos simples e transparentes
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 480, margin: '0 auto' }}>
            7 dias grátis em qualquer plano. Sem cartão de crédito, sem pegadinhas.<br />
            <span style={{ fontSize: 14 }}>Todos os planos incluem as mesmas funcionalidades — só muda o período.</span>
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.highlight ? 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(139,92,246,0.08))' : '#0F172A',
              border: `1px solid ${plan.highlight ? 'rgba(59,130,246,0.45)' : C.border}`,
              borderRadius: 20, padding: '32px 28px', position: 'relative',
              boxShadow: plan.highlight ? `0 0 40px ${C.blueGlow}` : 'none',
              display: 'flex', flexDirection: 'column',
            }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                  <span style={{ background: plan.highlight ? C.blue : plan.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 12px' }}>{plan.label}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>R$</span>
                <span style={{ fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{plan.price.toFixed(2).replace('.', ',')}</span>
                <span style={{ fontSize: 14, color: C.muted }}>/mês</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 28px' }}>{plan.billing}</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {PLAN_FEATURES.map(f => <CheckItem key={f}>{f}</CheckItem>)}
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

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
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

      {/* ── CTA Final ───────────────────────────────────────────────────────── */}
      <section style={{ ...section({ paddingTop: 80, paddingBottom: 96 }), textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(59,130,246,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 28, padding: 'clamp(40px,6vw,72px) clamp(24px,6vw,72px)', maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 40, margin: '0 0 16px' }}>🚀</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
            Pronto para transformar seu negócio?
          </h2>
          <p style={{ fontSize: 16, color: C.muted, margin: '0 0 36px', lineHeight: 1.6 }}>
            Junte-se a centenas de negócios que já usam o WorkAgenda. Configure em menos de 10 minutos.
          </p>
          <Link to="/cadastro" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '16px 40px', background: C.blue, borderRadius: 14, boxShadow: `0 0 40px ${C.blueGlow}`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${C.blueGlow}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 0 40px ${C.blueGlow}`; }}>
            Criar minha conta grátis →
          </Link>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 16 }}>7 dias grátis · Sem cartão · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '40px max(24px,calc((100vw - 1100px)/2))', fontFamily: 'Outfit, sans-serif', background: C.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png" alt="WorkAgenda" style={{ height: 28, objectFit: 'contain' }} />
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
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>© {new Date().getFullYear()} WorkAgenda · workagenda.org</p>
        </div>
      </footer>
    </div>
  );
}
