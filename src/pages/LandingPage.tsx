// src/pages/LandingPage.tsx — Premium minimalist · sem emojis · animações de scroll
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ── Paleta ─────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  text:      '#111111',
  secondary: '#475569',
  border:    '#E2E8F0',
  accent:    '#2563EB',
  accentBg:  'rgba(37,99,235,0.07)',
  accentBdr: 'rgba(37,99,235,0.20)',
  success:   '#22C55E',
  warning:   '#F59E0B',
  purple:    '#8B5CF6',
};

// ── Dados ─────────────────────────────────────────────────────────────────────
const BASE = 89.90;
const PLANS = [
  { id:'mensal',     label:'Mensal',     price:BASE,
    billing:'Cobrado mensalmente',                                            badge:null as string|null, hot:false },
  { id:'trimestral', label:'Trimestral', price:+(BASE*0.85).toFixed(2),
    billing:`R$ ${(BASE*0.85*3).toFixed(2).replace('.',',')} / 3 meses`,    badge:'15% OFF',       hot:true  },
  { id:'anual',      label:'Anual',      price:+(BASE*0.75).toFixed(2),
    billing:`R$ ${(BASE*0.75*12).toFixed(2).replace('.',',')} / ano`,        badge:'Melhor valor',  hot:false },
];

const FEATURES_LIST = [
  'Agendamento online ilimitado',
  'WhatsApp automático (confirmação + lembrete)',
  'Gestão financeira completa',
  'Multi-profissional com comissões automáticas',
  'Página pública personalizada com seu link',
  'Histórico de clientes',
  'Relatórios e métricas',
  '7 dias grátis para começar',
  'Suporte via chat',
];

const FAQS = [
  { q:'Preciso instalar algum aplicativo?',           a:'Não. O WorkAgenda funciona 100% no navegador, em qualquer dispositivo. Seus clientes agendam pelo link e você gerencia tudo pelo painel web.' },
  { q:'Como funciona o agendamento online?',          a:'Cada negócio recebe uma página pública personalizada (ex: workagenda.org/meu-negocio). O cliente escolhe o serviço, o profissional, a data e o horário — sem precisar criar conta.' },
  { q:'O WhatsApp automático precisa de número exclusivo?', a:'Sim. Recomendamos um chip dedicado ao negócio. A conexão é feita via QR Code em menos de 1 minuto, e as mensagens são enviadas automaticamente.' },
  { q:'Posso testar antes de contratar?',             a:'Sim. 7 dias de trial grátis, sem cartão de crédito. Você terá acesso a todas as funcionalidades durante o período de teste.' },
  { q:'Qual a diferença entre os planos?',            a:'Todos os planos têm as mesmas funcionalidades. A diferença é só o período: mensal, trimestral (15% OFF) ou anual (25% OFF).' },
  { q:'Posso cancelar a qualquer momento?',           a:'Sim. Sem fidelidade. Você cancela pelo próprio painel, sem burocracia.' },
];

const IMGS = [
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20image%201%20(2).png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20image%201%20(3).png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20image%201%20(4).png',
  'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20image%201%20(5).png',
];

// ── Ícones SVG ────────────────────────────────────────────────────────────────
const Ico = {
  Calendar:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Whatsapp:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.065-1.112l-.291-.173-3.014.896.896-3.014-.173-.291A7.96 7.96 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8z"/></svg>,
  Chart:     ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Users:     ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Phone:     ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  Shield:    ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Scissors:  ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  Sparkle:   ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  Zap:       ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Check:     ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Star:      ()=><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Menu:      ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Close:     ()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Chevron:   ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  TrendUp:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Dot:       ()=><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>,
};

// ── Hook: scroll reveal ───────────────────────────────────────────────────────
function useReveal(threshold = 0.14): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ── Componente Reveal ─────────────────────────────────────────────────────────
interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  from?: 'bottom' | 'left' | 'right' | 'none';
  style?: React.CSSProperties;
  className?: string;
}
function Reveal({ children, delay = 0, from = 'bottom', style, className }: RevealProps) {
  const [ref, visible] = useReveal();
  const hidden: React.CSSProperties = {
    bottom: { opacity:0, transform:'translateY(32px)' },
    left:   { opacity:0, transform:'translateX(-40px)' },
    right:  { opacity:0, transform:'translateX(40px)'  },
    none:   { opacity:0 },
  }[from];
  return (
    <div ref={ref} className={className} style={{
      ...(visible ? { opacity:1, transform:'none' } : hidden),
      transition:`opacity 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.65s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
      willChange:'opacity, transform',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Pill / Badge ──────────────────────────────────────────────────────────────
function Pill({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:99, background:`${color}12`, border:`1px solid ${color}28`, color, fontSize:12, fontWeight:700, letterSpacing:'0.4px', fontFamily:'Outfit, sans-serif' }}>
      {children}
    </span>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent = C.accent }: { icon:React.ReactNode; title:string; desc:string; accent?:string }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:C.surface, border:`1px solid ${hov ? accent+'50' : C.border}`, borderRadius:24, padding:'28px 26px', display:'flex', flexDirection:'column', gap:14, transition:'border-color 0.25s, box-shadow 0.25s, transform 0.25s', boxShadow:hov?'0 12px 40px rgba(0,0,0,0.09)':'0 1px 4px rgba(0,0,0,0.04)', transform:hov?'translateY(-3px)':'none' }}>
      <div style={{ width:46, height:46, borderRadius:14, background:`${accent}10`, border:`1px solid ${accent}20`, display:'flex', alignItems:'center', justifyContent:'center', color:accent, transition:'background 0.2s' }}>
        {icon}
      </div>
      <h3 style={{ fontSize:15, fontWeight:700, color:C.text, margin:0, letterSpacing:'-0.2px' }}>{title}</h3>
      <p style={{ fontSize:14, color:C.secondary, lineHeight:1.65, margin:0 }}>{desc}</p>
    </div>
  );
}

// ── Check row ─────────────────────────────────────────────────────────────────
function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color:C.secondary, lineHeight:1.55 }}>
      <span style={{ flexShrink:0, marginTop:1, width:20, height:20, borderRadius:99, background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', color:'#16a34a' }}><Ico.Check /></span>
      <span>{children}</span>
    </li>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q:string; a:string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom:`1px solid ${C.border}` }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'20px 0', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontFamily:'Outfit, sans-serif' }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.text }}>{q}</span>
        <span style={{ color:C.secondary, flexShrink:0, transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)', transform:open?'rotate(180deg)':'none' }}><Ico.Chevron /></span>
      </button>
      <div style={{ overflow:'hidden', maxHeight:open?400:0, opacity:open?1:0, transition:'max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease' }}>
        <p style={{ fontSize:14, color:C.secondary, lineHeight:1.75, margin:'0 0 20px', paddingRight:32 }}>{a}</p>
      </div>
    </div>
  );
}

// ── Floating card ─────────────────────────────────────────────────────────────
function FloatCard({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div style={{ position:'absolute', background:'#fff', borderRadius:16, padding:'14px 18px', boxShadow:'0 8px 40px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.05)', border:`1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

// ── Screenshot com sombra ─────────────────────────────────────────────────────
function Screenshot({ src, alt }: { src:string; alt:string }) {
  return (
    <div style={{ borderRadius:24, overflow:'hidden', border:`1px solid ${C.border}`, boxShadow:'0 28px 80px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08)' }}>
      <img src={src} alt={alt} style={{ width:'100%', display:'block' }} />
    </div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimCounter({ to, suffix='' }: { to:number; suffix?:string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = Date.now();
      const dur = 1400;
      const tick = () => {
        const p = Math.min((Date.now()-start)/dur, 1);
        const ease = 1-Math.pow(1-p, 4);
        setVal(Math.round(ease*to));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold:0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString('pt-BR')}{suffix}</span>;
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive:true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Meta Pixel
  useEffect(() => {
    if ((window as any).fbq) { (window as any).fbq('track','PageView'); return; }
    const s = document.createElement('script');
    s.async = true;
    s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','1333043925464739');fbq('track','PageView');`;
    document.head.appendChild(s);
  }, []);

  const PX = 'max(24px, calc((100vw - 1120px) / 2))';

  return (
    <div style={{ background:C.bg, color:C.text, fontFamily:'Outfit, sans-serif', overflowX:'hidden' }}>
      <style>{`
        *{box-sizing:border-box;} body{margin:0;}
        @keyframes floatA{0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)}}
        @keyframes floatB{0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)}}
        @keyframes floatC{0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)}}
        @keyframes heroIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(-32px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}
        .h1{animation:heroIn 0.7s 0.05s cubic-bezier(0.16,1,0.3,1) both}
        .h2{animation:heroIn 0.7s 0.18s cubic-bezier(0.16,1,0.3,1) both}
        .h3{animation:heroIn 0.7s 0.30s cubic-bezier(0.16,1,0.3,1) both}
        .h4{animation:heroIn 0.7s 0.42s cubic-bezier(0.16,1,0.3,1) both}
        .h5{animation:scaleIn 0.8s 0.55s cubic-bezier(0.16,1,0.3,1) both}
        .fa{animation:floatA 5.5s ease-in-out infinite}
        .fb{animation:floatB 4.5s 0.8s ease-in-out infinite}
        .fc{animation:floatC 5s 1.6s ease-in-out infinite}
        .blink{animation:blink 2s ease-in-out infinite}
        @media(max-width:768px){
          .hide-m{display:none!important}
          .col-m{flex-direction:column!important}
          .full-m{width:100%!important;min-width:0!important}
          .center-m{text-align:center!important;align-items:center!important}
          .show-m{display:flex!important}
          .float-m{display:none!important}
          section{padding-top:48px!important;padding-bottom:48px!important}
          .hero-s{padding-top:96px!important;padding-bottom:32px!important}
          .stats-inner{padding:20px 18px!important;gap:20px!important}
          .footer-row{flex-direction:column!important;align-items:center!important;text-align:center!important;gap:16px!important}
          .footer-links{justify-content:center!important}
          .col-m.gap-m-32{gap:32px!important}
        }
        @media(min-width:769px){.show-m{display:none!important}}
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, height:64, display:'flex', alignItems:'center', justifyContent:'space-between', padding:`0 ${PX}`, background:scrolled?'rgba(255,255,255,0.94)':'rgba(248,250,252,0.7)', backdropFilter:'blur(20px)', borderBottom:`1px solid ${scrolled?C.border:'transparent'}`, transition:'background 0.35s, border-color 0.35s' }}>
        <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png" alt="WorkAgenda" style={{ height:90, objectFit:'contain', filter:'brightness(0)' }} />
        <div className="hide-m" style={{ display:'flex', alignItems:'center', gap:32 }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h])=>(
            <a key={h} href={h} style={{ fontSize:14, color:C.secondary, textDecoration:'none', fontWeight:500, transition:'color 0.18s' }}
              onMouseEnter={e=>(e.currentTarget.style.color=C.text)}
              onMouseLeave={e=>(e.currentTarget.style.color=C.secondary)}>{l}</a>
          ))}
        </div>
        <div className="hide-m" style={{ display:'flex', gap:8 }}>
          <Link to="/login" style={{ fontSize:13, fontWeight:600, color:C.secondary, textDecoration:'none', padding:'8px 16px', borderRadius:10, transition:'background 0.18s' }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(0,0,0,0.05)')}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>Entrar</Link>
          <Link to="/cadastro" style={{ fontSize:13, fontWeight:700, color:'#fff', textDecoration:'none', padding:'9px 20px', background:C.accent, borderRadius:10, boxShadow:'0 2px 10px rgba(37,99,235,0.35)', transition:'all 0.2s' }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(37,99,235,0.45)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 2px 10px rgba(37,99,235,0.35)'}}>
            Teste grátis
          </Link>
        </div>
        <button className="show-m" onClick={()=>setMenuOpen(v=>!v)} style={{ background:'none', border:'none', color:C.text, cursor:'pointer', display:'none', padding:4 }}>
          {menuOpen ? <Ico.Close /> : <Ico.Menu />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:199, background:'#fff', paddingTop:80, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h])=>(
            <a key={h} href={h} onClick={()=>setMenuOpen(false)} style={{ fontSize:18, color:C.text, textDecoration:'none', fontWeight:600, padding:'12px 0', width:'80%', textAlign:'center', borderRadius:12 }}>{l}</a>
          ))}
          <div style={{ width:'80%', marginTop:16, display:'flex', flexDirection:'column', gap:10 }}>
            <Link to="/login" onClick={()=>setMenuOpen(false)} style={{ textAlign:'center', padding:'13px', fontSize:15, fontWeight:600, color:C.secondary, textDecoration:'none', border:`1px solid ${C.border}`, borderRadius:12 }}>Entrar</Link>
            <Link to="/cadastro" onClick={()=>setMenuOpen(false)} style={{ textAlign:'center', padding:'13px', fontSize:15, fontWeight:700, color:'#fff', textDecoration:'none', background:C.accent, borderRadius:12 }}>Teste grátis</Link>
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="hero-s" style={{ padding:`140px ${PX} 80px`, position:'relative', overflow:'hidden' }}>
        {/* blobs */}
        <div style={{ position:'absolute', top:-80, right:'0%', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:'5%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 65%)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:48, flexWrap:'nowrap' }} className="col-m gap-m-32">

          {/* Copy */}
          <div style={{ flex:'1 1 380px', minWidth:0 }} className="center-m">
            <div className="h1">
              <Pill>Plataforma para barbearias e salões</Pill>
            </div>
            <h1 className="h2" style={{ fontSize:'clamp(38px,5.5vw,66px)', fontWeight:900, lineHeight:1.05, margin:'22px 0 20px', letterSpacing:'-2.5px', color:C.text }}>
              Sua barbearia<br />
              <span style={{ color:C.accent }}>cheia</span>, sem<br />esforço nenhum
            </h1>
            <p className="h3" style={{ fontSize:'clamp(15px,1.8vw,18px)', color:C.secondary, maxWidth:460, lineHeight:1.72, margin:'0 0 36px' }}>
              Agendamento online, confirmações automáticas no WhatsApp e gestão financeira — numa plataforma feita para barbearias e salões.
            </p>
            <div className="h4" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <Link to="/cadastro" style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700, color:'#fff', textDecoration:'none', padding:'14px 30px', background:C.accent, borderRadius:12, boxShadow:'0 4px 20px rgba(37,99,235,0.40)', transition:'all 0.22s' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 32px rgba(37,99,235,0.50)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 20px rgba(37,99,235,0.40)'}}>
                Começar 7 dias grátis
              </Link>
              <a href="#features" style={{ fontSize:14, fontWeight:600, color:C.secondary, textDecoration:'none', padding:'13px 22px', border:`1.5px solid ${C.border}`, borderRadius:12, background:'#fff', transition:'all 0.2s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+'50';e.currentTarget.style.color=C.text}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.secondary}}>
                Ver funcionalidades
              </a>
            </div>
            <p className="h4" style={{ fontSize:12, color:'#94a3b8', marginTop:18 }}>Sem cartão de crédito · Cancele quando quiser</p>

            {/* Micro-stats */}
            <div className="h4" style={{ display:'flex', gap:36, marginTop:44, flexWrap:'wrap' }}>
              {[['200+','negócios ativos'],['12 mil+','agendamentos'],['99.9%','uptime']].map(([v,l])=>(
                <div key={l}>
                  <p style={{ fontSize:22, fontWeight:800, color:C.text, margin:0, letterSpacing:'-0.5px' }}>{v}</p>
                  <p style={{ fontSize:12, color:C.secondary, margin:'2px 0 0', fontWeight:500 }}>{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Produto visual */}
          <div className="h5 full-m" style={{ flex:'1 1 520px', minWidth:0, position:'relative' }}>
            {/* Wrapper relativo à imagem para ancorar os cards */}
            <div style={{ position:'relative', display:'inline-block', width:'100%', maxWidth:864 }}>
              <div className="fa" style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 28px 80px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06)', border:`1px solid ${C.border}` }}>
                <img src={IMGS[0]} alt="WorkAgenda painel" style={{ width:'100%', display:'block' }} />
              </div>

              {/* Card: novo agendamento — canto superior direito */}
              <FloatCard className="fb float-m" style={{ position:'absolute', top:20, right:-20, minWidth:230, zIndex:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'#EFF6FF', border:'1px solid #BFDBFE', display:'flex', alignItems:'center', justifyContent:'center', color:C.accent, flexShrink:0 }}>
                    <Ico.Calendar />
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.text }}>Novo agendamento</p>
                    <p style={{ margin:0, fontSize:11, color:C.secondary }}>João Silva · Corte + Barba</p>
                    <p style={{ margin:0, fontSize:10, color:'#94a3b8', marginTop:2 }}>Hoje às 14h00</p>
                  </div>
                </div>
              </FloatCard>

              {/* Card: receita — canto inferior esquerdo */}
              <FloatCard className="fc float-m" style={{ position:'absolute', bottom:32, left:-28, zIndex:2 }}>
                <p style={{ margin:'0 0 6px', fontSize:11, color:C.secondary, fontWeight:600 }}>Receita do mês</p>
                <p style={{ margin:0, fontSize:24, fontWeight:900, color:C.text, letterSpacing:'-1px' }}>R$ 8.240</p>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:5 }}>
                  <span style={{ color:C.success, display:'flex', alignItems:'center', gap:3 }}><Ico.TrendUp /><span style={{ fontSize:11, fontWeight:700 }}>+23%</span></span>
                  <span style={{ fontSize:11, color:C.secondary }}>vs. mês anterior</span>
                </div>
              </FloatCard>

              {/* Card: WhatsApp — canto inferior direito */}
              <FloatCard className="fb float-m" style={{ position:'absolute', bottom:32, right:20, zIndex:2 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="blink" style={{ color:C.success }}><Ico.Dot /></span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>WhatsApp conectado</span>
                </div>
                <p style={{ margin:'4px 0 0', fontSize:11, color:C.secondary }}>3 lembretes enviados hoje</p>
              </FloatCard>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────────── */}
      <Reveal style={{ padding:`0 ${PX} clamp(40px,6vw,72px)` }}>
        <div className="stats-inner" style={{ background:'#fff', borderRadius:20, border:`1px solid ${C.border}`, padding:'28px 40px', display:'flex', alignItems:'center', justifyContent:'center', gap:'clamp(20px,6vw,80px)', flexWrap:'wrap', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
          {[['12000','Agendamentos realizados','+'],['45000','Mensagens WhatsApp/mês','+'],['200','Negócios ativos','+'],['99.9','Uptime garantido','%']].map(([v,l,s])=>(
            <div key={l} style={{ textAlign:'center' }}>
              <p style={{ fontSize:'clamp(22px,3vw,30px)', fontWeight:900, color:C.text, margin:0, letterSpacing:'-0.5px' }}>
                <AnimCounter to={Number(v)} suffix={s} />
              </p>
              <p style={{ fontSize:12, color:C.secondary, margin:'5px 0 0', fontWeight:500 }}>{l}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── FUNCIONALIDADES ──────────────────────────────────────────────────── */}
      <section id="features" style={{ padding:`80px ${PX}` }}>
        <Reveal style={{ textAlign:'center', marginBottom:52 }}>
          <Pill>Funcionalidades</Pill>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, margin:'16px 0 14px', letterSpacing:'-1.2px', color:C.text }}>
            Tudo que seu negócio precisa
          </h2>
          <p style={{ fontSize:17, color:C.secondary, maxWidth:480, margin:'0 auto', lineHeight:1.65 }}>
            Uma plataforma completa para você focar no que importa: atender bem.
          </p>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:16 }}>
          {[
            { icon:<Ico.Calendar />, title:'Agendamento Online',   desc:'Página pública personalizada com serviços, horários e profissionais. O cliente agenda em 2 minutos, sem criar conta.', accent:C.secondary },
            { icon:<Ico.Whatsapp />, title:'WhatsApp Automático',  desc:'Confirmação imediata e lembrete automático no dia anterior. Reduza faltas e mantenha clientes informados sem esforço.', accent:C.secondary },
            { icon:<Ico.Chart />,    title:'Gestão Financeira',    desc:'Receitas, despesas e comissões por profissional em tempo real. Tome decisões com dados, não com achismo.', accent:C.secondary },
            { icon:<Ico.Users />,    title:'Multi-Profissional',   desc:'Cadastre a equipe, defina horários individuais e acompanhe rendimentos de cada profissional separadamente.', accent:C.secondary },
            { icon:<Ico.Phone />,    title:'Feito para o Celular', desc:'O cliente acessa pelo smartphone e confirma o horário em segundos. Sem app, sem cadastro — só o link.', accent:C.secondary },
            { icon:<Ico.Shield />,   title:'Seguro e Confiável',   desc:'Conforme com a LGPD. Dados criptografados, logs de auditoria e controle total sobre as informações do negócio.', accent:C.secondary },
          ].map(({ icon, title, desc, accent }, i) => (
            <Reveal key={title} delay={i * 0.07} from="bottom">
              <FeatureCard icon={icon} title={title} desc={desc} accent={accent} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PRODUTO: Agendamento ─────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX}`, background:'#fff', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:72, flexWrap:'wrap' }} className="col-m gap-m-32">
          <Reveal from="left" style={{ flex:'1 1 560px', minWidth:0 }} className="full-m">
            <Screenshot src={IMGS[1]} alt="Agendamento online" />
          </Reveal>
          <Reveal from="right" style={{ flex:'1 1 320px', minWidth:0 }} className="full-m">
            <Pill color={C.accent}>Agendamento Online</Pill>
            <h2 style={{ fontSize:'clamp(26px,3.5vw,40px)', fontWeight:900, margin:'16px 0', lineHeight:1.15, letterSpacing:'-0.8px', color:C.text }}>
              Seu cliente agenda a qualquer hora, de qualquer lugar
            </h2>
            <p style={{ fontSize:15, color:C.secondary, lineHeight:1.75, marginBottom:28 }}>
              Chega de responder "qual horário está disponível?" no WhatsApp. Seu negócio ganha uma página profissional com todos os serviços, profissionais e horários em tempo real.
            </p>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
              <CheckRow>Página personalizada com sua logo e cor</CheckRow>
              <CheckRow>Seleção de profissional, data e horário</CheckRow>
              <CheckRow>Confirmação imediata com código único</CheckRow>
              <CheckRow>Histórico de agendamentos por telefone</CheckRow>
              <CheckRow>Link direto para cancelar ou reagendar</CheckRow>
              <CheckRow>Zero login necessário para o cliente</CheckRow>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── PRODUTO: WhatsApp ────────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:72, flexWrap:'wrap' }} className="col-m gap-m-32">
          <Reveal from="left" style={{ flex:'1 1 320px', minWidth:0 }} className="full-m center-m">
            <Pill color="#25D366">WhatsApp Automático</Pill>
            <h2 style={{ fontSize:'clamp(26px,3.5vw,40px)', fontWeight:900, margin:'16px 0', lineHeight:1.15, letterSpacing:'-0.8px', color:C.text }}>
              Reduza faltas em até 70% com lembretes automáticos
            </h2>
            <p style={{ fontSize:15, color:C.secondary, lineHeight:1.75, marginBottom:28 }}>
              Assim que o cliente agenda, ele recebe uma confirmação no WhatsApp. No dia anterior, recebe um lembrete. Tudo automático — você não precisa fazer nada.
            </p>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
              <CheckRow>Confirmação automática ao agendar</CheckRow>
              <CheckRow>Lembrete configurável (1h, 2h, 24h antes)</CheckRow>
              <CheckRow>Mensagem de cancelamento automática</CheckRow>
              <CheckRow>Link direto para cancelar ou reagendar</CheckRow>
              <CheckRow>Conexão via QR Code em menos de 1 minuto</CheckRow>
              <CheckRow>Um número exclusivo por negócio</CheckRow>
            </ul>
          </Reveal>
          <Reveal from="right" style={{ flex:'1 1 560px', minWidth:0 }} className="full-m">
            <Screenshot src={IMGS[2]} alt="WhatsApp automático" />
          </Reveal>
        </div>
      </section>

      {/* ── PRODUTO: Financeiro ──────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX}`, background:'#fff', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:72, flexWrap:'wrap' }} className="col-m gap-m-32">
          <Reveal from="left" style={{ flex:'1 1 560px', minWidth:0 }} className="full-m">
            <Screenshot src={IMGS[3]} alt="Gestão financeira" />
          </Reveal>
          <Reveal from="right" style={{ flex:'1 1 320px', minWidth:0 }} className="full-m">
            <Pill color={C.warning}>Gestão Financeira</Pill>
            <h2 style={{ fontSize:'clamp(26px,3.5vw,40px)', fontWeight:900, margin:'16px 0', lineHeight:1.15, letterSpacing:'-0.8px', color:C.text }}>
              Saiba exatamente quanto seu negócio ganha
            </h2>
            <p style={{ fontSize:15, color:C.secondary, lineHeight:1.75, marginBottom:28 }}>
              Chega de planilha. Veja receitas, despesas e comissões de cada profissional em tempo real. Tome decisões com dados, não com achismo.
            </p>
            <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
              <CheckRow>Receita e despesas em tempo real</CheckRow>
              <CheckRow>Comissões calculadas automaticamente</CheckRow>
              <CheckRow>Divisão por profissional detalhada</CheckRow>
              <CheckRow>Fluxo de caixa com histórico completo</CheckRow>
              <CheckRow>Vendas diretas (PDV) pelo painel</CheckRow>
              <CheckRow>Métricas e relatórios do negócio</CheckRow>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── PARA QUEM É ──────────────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX}` }}>
        <Reveal style={{ textAlign:'center', marginBottom:48 }}>
          <Pill color={C.warning}>Para quem é</Pill>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, margin:'16px 0 12px', letterSpacing:'-0.8px', color:C.text }}>
            Feito para quem trabalha com beleza
          </h2>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
          {[
            { Icon:Ico.Scissors, label:'Barbearias',         color:C.secondary, desc:'Do profissional solo ao estabelecimento com várias cadeiras.' },
            { Icon:Ico.Users,    label:'Salões de Beleza',   color:C.secondary, desc:'Cabelo, manicure, design de sobrancelha — tudo organizado.' },
            { Icon:Ico.Sparkle,  label:'Estúdios de Estética', color:C.secondary, desc:'Limpeza de pele, sobrancelha, maquiagem e muito mais.' },
            { Icon:Ico.Zap,      label:'Autônomos',          color:C.secondary, desc:'Trabalha sozinho? Organize horários e elimine o vai-e-vem no WhatsApp.' },
          ].map(({ Icon, label, color, desc }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <div style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:24, padding:'28px 22px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'box-shadow 0.25s, transform 0.25s', height:'100%' }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 10px 36px rgba(0,0,0,0.09)';e.currentTarget.style.transform='translateY(-3px)'}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';e.currentTarget.style.transform='none'}}>
                <div style={{ width:52, height:52, borderRadius:16, background:`${color}12`, border:`1px solid ${color}25`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color }}>
                  <Icon />
                </div>
                <p style={{ fontSize:15, fontWeight:700, color:C.text, margin:'0 0 8px' }}>{label}</p>
                <p style={{ fontSize:13, color:C.secondary, lineHeight:1.65, margin:0 }}>{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX}`, background:'#fff', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
        <Reveal style={{ textAlign:'center', marginBottom:48 }}>
          <Pill color={C.warning}>Depoimentos</Pill>
          <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, margin:'16px 0', letterSpacing:'-0.8px', color:C.text }}>
            O que dizem nossos clientes
          </h2>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))', gap:20 }}>
          {[
            { name:'Bruno Almeida',   role:'Dono — Barbearia Dom Pedro',   text:'Antes eu ficava o dia inteiro respondendo WhatsApp para confirmar horário. Hoje o sistema faz tudo. Minhas faltas caíram mais de 60%.', stars:5 },
            { name:'Camila Ferreira', role:'Gerente — Studio Bella Donna', text:'A gestão de comissões era um pesadelo. Agora em dois cliques sei exatamente quanto cada profissional vai receber. Economizo horas todo mês.', stars:5 },
            { name:'Rafael Santos',   role:'Barbeiro autônomo',            text:'Trabalho sozinho e precisava de algo simples. O WorkAgenda é exatamente isso — simples de configurar e os clientes adoraram poder agendar pelo link.', stars:5 },
          ].map(({ name, role, text, stars }, i) => (
            <Reveal key={name} delay={i * 0.1}>
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:24, padding:'28px 24px', display:'flex', flexDirection:'column', gap:16, height:'100%' }}>
                <div style={{ display:'flex', gap:3 }}>
                  {Array.from({length:stars}).map((_,j)=><span key={j} style={{ color:'#FBBF24' }}><Ico.Star /></span>)}
                </div>
                <p style={{ fontSize:14, color:C.secondary, lineHeight:1.78, margin:0, flex:1 }}>"{text}"</p>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                  <p style={{ margin:0, fontWeight:700, color:C.text, fontSize:14 }}>{name}</p>
                  <p style={{ margin:0, fontSize:12, color:'#94a3b8', marginTop:2 }}>{role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PREÇOS ───────────────────────────────────────────────────────────── */}
      <section id="precos" style={{ padding:`80px ${PX}` }}>
        <Reveal style={{ textAlign:'center', marginBottom:56 }}>
          <Pill color={C.purple}>Preços</Pill>
          <h2 style={{ fontSize:'clamp(28px,4vw,44px)', fontWeight:900, margin:'16px 0 14px', letterSpacing:'-1.2px', color:C.text }}>
            Simples e transparente
          </h2>
          <p style={{ fontSize:17, color:C.secondary, maxWidth:480, margin:'0 auto', lineHeight:1.65 }}>
            7 dias grátis em qualquer plano. Sem cartão, sem pegadinhas.<br />
            <span style={{ fontSize:14 }}>Todos os planos têm as mesmas funcionalidades.</span>
          </p>
        </Reveal>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20, maxWidth:960, margin:'0 auto' }}>
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.09}>
              <div style={{ background:plan.hot ? C.accent : '#fff', border:`1px solid ${plan.hot ? C.accent : C.border}`, borderRadius:28, padding:'36px 30px', position:'relative', display:'flex', flexDirection:'column', boxShadow:plan.hot?'0 20px 56px rgba(37,99,235,0.28)':'0 2px 12px rgba(0,0,0,0.05)', transform:plan.hot?'scale(1.03)':'none', zIndex:plan.hot?1:0, height:'100%' }}>
                {plan.badge && (
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', whiteSpace:'nowrap' }}>
                    <span style={{ background:plan.hot?'#fff':C.accent, color:plan.hot?C.accent:'#fff', fontSize:11, fontWeight:800, padding:'5px 16px', borderRadius:99, boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>{plan.badge}</span>
                  </div>
                )}
                <p style={{ fontSize:12, fontWeight:700, color:plan.hot?'rgba(255,255,255,0.65)':C.secondary, textTransform:'uppercase', letterSpacing:'1.5px', margin:'0 0 14px' }}>{plan.label}</p>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
                  <span style={{ fontSize:14, color:plan.hot?'rgba(255,255,255,0.65)':C.secondary, fontWeight:600 }}>R$</span>
                  <span style={{ fontSize:52, fontWeight:900, color:plan.hot?'#fff':C.text, lineHeight:1, letterSpacing:'-2.5px' }}>{plan.price.toFixed(2).replace('.',',')}</span>
                  <span style={{ fontSize:14, color:plan.hot?'rgba(255,255,255,0.65)':C.secondary }}>/mês</span>
                </div>
                <p style={{ fontSize:12, color:plan.hot?'rgba(255,255,255,0.45)':'#94a3b8', margin:'0 0 28px' }}>{plan.billing}</p>
                <ul style={{ listStyle:'none', padding:0, margin:'0 0 28px', display:'flex', flexDirection:'column', gap:10, flex:1 }}>
                  {FEATURES_LIST.map(f=>(
                    <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color:plan.hot?'rgba(255,255,255,0.85)':C.secondary, lineHeight:1.5 }}>
                      <span style={{ flexShrink:0, marginTop:1, width:20, height:20, borderRadius:99, background:plan.hot?'rgba(255,255,255,0.2)':'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', color:plan.hot?'#fff':'#16a34a' }}><Ico.Check /></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro" style={{ display:'block', textAlign:'center', padding:'14px', fontWeight:700, fontSize:14, textDecoration:'none', background:plan.hot?'#fff':C.accent, color:plan.hot?C.accent:'#fff', borderRadius:14, transition:'all 0.2s', boxShadow:plan.hot?'0 4px 16px rgba(0,0,0,0.10)':'0 4px 16px rgba(37,99,235,0.30)' }}
                  onMouseEnter={e=>(e.currentTarget.style.opacity='0.88')}
                  onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                  Começar grátis
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding:`80px ${PX}`, background:'#fff', borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:700, margin:'0 auto' }}>
          <Reveal style={{ textAlign:'center', marginBottom:48 }}>
            <Pill color={C.success}>Dúvidas frequentes</Pill>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, margin:'16px 0 0', letterSpacing:'-0.8px', color:C.text }}>
              Tem alguma dúvida?
            </h2>
          </Reveal>
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.06}>
              <FAQItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────────── */}
      <section style={{ padding:`80px ${PX} 96px`, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.07) 0%, transparent 60%)', pointerEvents:'none' }} />
        <Reveal from="bottom" style={{ position:'relative', background:'#fff', border:`1px solid ${C.border}`, borderRadius:32, padding:'clamp(32px,5vw,64px) clamp(24px,5vw,64px)', maxWidth:1040, margin:'0 auto', boxShadow:'0 8px 48px rgba(0,0,0,0.07)' }}>
          {/* Barra decorativa no topo */}
          <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:3, background:`linear-gradient(90deg, transparent, ${C.accent}, transparent)`, borderRadius:99 }} />

          <div style={{ display:'flex', alignItems:'center', gap:56, flexWrap:'nowrap' }} className="col-m gap-m-32">
            {/* Imagem */}
            <div style={{ flex:'1 1 500px', minWidth:0 }} className="full-m">
              <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/Generated%20image%201%20(6).png" alt="Barbearia WorkAgenda" style={{ width:'100%', display:'block', borderRadius:20, objectFit:'cover', boxShadow:'0 24px 72px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.09)' }} />
            </div>

            {/* Texto */}
            <div style={{ flex:'1 1 300px', minWidth:0 }} className="full-m">
              <div style={{ width:56, height:56, borderRadius:16, background:C.accentBg, border:`1px solid ${C.accentBdr}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, color:C.accent }}>
                <Ico.Zap />
              </div>
              <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, margin:'0 0 16px', letterSpacing:'-1px', color:C.text }}>
                Pronto para transformar<br />seu negócio?
              </h2>
              <p style={{ fontSize:16, color:C.secondary, margin:'0 0 32px', lineHeight:1.70 }}>
                Junte-se a centenas de negócios que já usam o WorkAgenda. Configure em menos de 10 minutos.
              </p>
              <Link to="/cadastro" style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700, color:'#fff', textDecoration:'none', padding:'15px 36px', background:C.accent, borderRadius:14, boxShadow:'0 4px 24px rgba(37,99,235,0.40)', transition:'all 0.22s' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 36px rgba(37,99,235,0.52)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 24px rgba(37,99,235,0.40)'}}>
                Criar minha conta grátis
              </Link>
              <p style={{ fontSize:12, color:'#94a3b8', marginTop:14 }}>7 dias grátis · Sem cartão · Cancele quando quiser</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:`1px solid ${C.border}`, padding:`36px ${PX}`, background:'#fff' }}>
        <div className="footer-row" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20 }}>
          <img src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png" alt="WorkAgenda" style={{ height:84, objectFit:'contain', filter:'brightness(0)' }} />
          <div className="footer-links" style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {[['Funcionalidades','#features'],['Preços','#precos'],['FAQ','#faq']].map(([l,h])=>(
              <a key={l} href={h} style={{ fontSize:13, color:C.secondary, textDecoration:'none', transition:'color 0.18s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=C.text)}
                onMouseLeave={e=>(e.currentTarget.style.color=C.secondary)}>{l}</a>
            ))}
            {[['Login','/login'],['Criar conta','/cadastro']].map(([l,h])=>(
              <Link key={l} to={h} style={{ fontSize:13, color:C.secondary, textDecoration:'none', transition:'color 0.18s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=C.text)}
                onMouseLeave={e=>(e.currentTarget.style.color=C.secondary)}>{l}</Link>
            ))}
          </div>
          <p style={{ fontSize:12, color:'#94a3b8', margin:0 }}>© {new Date().getFullYear()} WorkAgenda · workagenda.org</p>
        </div>
      </footer>
    </div>
  );
}
