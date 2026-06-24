import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ChevronLeft, CheckCircle, Sparkles } from 'lucide-react';

export interface TourStep {
  /** '__welcome__' → modal centralizado sem spotlight */
  targetId: string;
  emoji: string;
  title: string;
  description: string;
  onEnter?: () => void;
  cta?: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

const PAD    = 8;
const CARD_W = 320;
const ARROW  = 10;
const ACCENT = '#2563EB';

export default function TourOverlay({ steps, onFinish }: Props) {
  const [step,      setStep]      = useState(0);
  const [rect,      setRect]      = useState<Rect | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [minimized, setMinimized] = useState(false);

  const current   = steps[step];
  const isWelcome = current.targetId === '__welcome__';
  const isLast    = step === steps.length - 1;

  const measure = useCallback((attempt = 0) => {
    if (isWelcome) { setRect(null); setVisible(true); return; }
    const el = document.getElementById(current.targetId);
    if (!el) {
      if (attempt === 0) setTimeout(() => measure(1), 200);
      else { setRect(null); setVisible(true); }
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setVisible(true);
  }, [current.targetId, isWelcome]); // eslint-disable-line

  useEffect(() => {
    setVisible(false); setRect(null); setMinimized(false);
    const delay = current.onEnter ? 300 : 80;
    current.onEnter?.();
    const t = setTimeout(() => measure(0), delay);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFinish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  const advance  = () => (isLast ? onFinish() : setStep(s => s + 1));
  const retreat  = () => { if (step > 0) setStep(s => s - 1); };
  const handleCTA = () => { if (isWelcome || isLast) advance(); else setMinimized(true); };

  const cardBelow = rect ? rect.top < window.innerHeight * 0.5 : false;

  const spotlightCardStyle = (): React.CSSProperties => {
    if (!rect) return { position: 'fixed', top: 80, left: '50%', marginLeft: -(CARD_W / 2) };
    if (cardBelow) {
      return {
        position: 'fixed',
        top:  rect.top + rect.height + PAD + ARROW + 6,
        left: Math.min(Math.max(12, rect.left + rect.width / 2 - CARD_W / 2), window.innerWidth - CARD_W - 12),
      };
    }
    return {
      position: 'fixed',
      top:  Math.max(12, rect.top + rect.height / 2 - 130),
      left: rect.left + rect.width + PAD + ARROW + 6,
    };
  };

  const arrowStyle = (): React.CSSProperties => {
    if (!rect) return { display: 'none' };
    if (cardBelow) {
      const cardLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - CARD_W / 2), window.innerWidth - CARD_W - 12);
      return {
        position: 'absolute', top: -ARROW,
        left: Math.max(16, rect.left + rect.width / 2 - cardLeft - ARROW),
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderBottom: `${ARROW}px solid #fff`,
      };
    }
    const cardTop = Math.max(12, rect.top + rect.height / 2 - 130);
    return {
      position: 'absolute', left: -ARROW,
      top: Math.min(Math.max(16, rect.top + rect.height / 2 - cardTop), 200),
      width: 0, height: 0,
      borderTop: `${ARROW}px solid transparent`,
      borderBottom: `${ARROW}px solid transparent`,
      borderRight: `${ARROW}px solid #fff`,
    };
  };

  const progress = Math.round(((step + 1) / steps.length) * 100);

  // ── Card body ──────────────────────────────────────────────────────────────
  const CardBody = () => (
    <>
      {/* Barra colorida no topo */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${ACCENT} 0%, #7C3AED ${progress}%, #E2E8F0 ${progress}%)`,
        borderRadius: '14px 14px 0 0',
      }} />

      {/* Header */}
      <div style={{ padding: isWelcome ? '20px 22px 16px' : '14px 16px 12px', background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: isWelcome ? 44 : 36, height: isWelcome ? 44 : 36, borderRadius: 12, background: ACCENT + '12', border: `1px solid ${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isWelcome ? 22 : 18, flexShrink: 0 }}>
              {current.emoji}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'Outfit, sans-serif' }}>
                {step === 0 ? 'Configuração inicial' : `Passo ${step} de ${steps.length - 1}`}
              </p>
              <h3 style={{ margin: '2px 0 0', fontSize: isWelcome ? 17 : 14, fontWeight: 800, color: '#111827', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                {current.title}
              </h3>
            </div>
          </div>
          <button onClick={onFinish}
            style={{ background: '#F1F5F9', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '5px 7px', display: 'flex', borderRadius: 8, flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: isWelcome ? '16px 22px 20px' : '12px 16px 16px', background: '#FFFFFF' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#374151', lineHeight: 1.65, fontFamily: 'Outfit, sans-serif' }}>
          {current.description}
        </p>

        {/* Welcome: checklist de etapas */}
        {isWelcome && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18, background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
            {[
              'Identidade do negócio (nome, logo, contato)',
              'Horários de funcionamento',
              'Equipe de profissionais',
              'Serviços e preços',
              'Link de agendamento pronto ✓',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#4B5563', fontFamily: 'Outfit, sans-serif' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: ACCENT + '15', border: `1.5px solid ${ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT }}>{i + 1}</span>
                </div>
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Spotlight: dots de progresso */}
        {!isWelcome && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
            {steps.slice(1).map((_, i) => {
              const idx = i + 1;
              return (
                <div key={i} style={{
                  width: idx === step ? 20 : 6, height: 6, borderRadius: 3, flexShrink: 0, transition: 'all 0.25s',
                  background: idx < step ? '#22C55E' : idx === step ? ACCENT : '#E2E8F0',
                }} />
              );
            })}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button onClick={retreat}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', background: '#F1F5F9', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#6B7280', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              <ChevronLeft size={13} /> Voltar
            </button>
          )}
          <button onClick={handleCTA}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '10px 16px',
              background: isLast ? '#059669' : ACCENT,
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              boxShadow: isLast ? '0 3px 10px rgba(5,150,105,0.35)' : `0 3px 10px ${ACCENT}40`,
            }}>
            {isLast
              ? <><CheckCircle size={14} /><span>Concluir configuração</span></>
              : isWelcome
                ? <><Sparkles size={13} /><span>Começar configuração</span><ArrowRight size={13} /></>
                : <><span>{current.cta ?? 'Ir configurar'}</span><ArrowRight size={13} /></>
            }
          </button>
        </div>

        <button onClick={onFinish}
          style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', fontSize: 11, color: '#9CA3AF', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
          Pular configuração
        </button>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>

        {/* ── Overlay ──────────────────────────────────────────────── */}
        {visible && !minimized && isWelcome && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(2px)', pointerEvents: 'auto' }} />
        )}
        {visible && !minimized && !isWelcome && rect && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.top - PAD, background: 'rgba(15,23,42,0.72)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.72)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: 0, width: rect.left - PAD, height: rect.height + PAD * 2, background: 'rgba(15,23,42,0.72)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2, background: 'rgba(15,23,42,0.72)', pointerEvents: 'auto' }} />
          </>
        )}
        {visible && !minimized && !isWelcome && !rect && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.72)', pointerEvents: 'auto' }} />
        )}

        {/* ── Spotlight ring ───────────────────────────────────────── */}
        {visible && !isWelcome && rect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: rect.top - PAD, left: rect.left - PAD,
              width: rect.width + PAD * 2, height: rect.height + PAD * 2,
              borderRadius: 10,
              border: `2px solid ${minimized ? '#22C55E' : ACCENT}`,
              boxShadow: minimized
                ? '0 0 0 3px rgba(34,197,94,0.2)'
                : `0 0 0 4px ${ACCENT}22, 0 0 28px ${ACCENT}30`,
              pointerEvents: 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
          />
        )}

        {/* ── WELCOME card ─────────────────────────────────────────── */}
        {visible && isWelcome && !minimized && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div
              key={`welcome-${step}`}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              style={{
                pointerEvents: 'auto', width: 400,
                background: '#fff', borderRadius: 18,
                boxShadow: '0 24px 72px rgba(0,0,0,0.30)', overflow: 'hidden',
                border: '1px solid #E2E8F0',
              }}
              onClick={e => e.stopPropagation()}
            >
              {CardBody()}
            </motion.div>
          </div>
        )}

        {/* ── SPOTLIGHT card ───────────────────────────────────────── */}
        {visible && !isWelcome && !minimized && (
          <motion.div
            key={`spotlight-${step}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto', width: CARD_W,
              background: '#fff', borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.22)', overflow: 'hidden',
              border: '1px solid #E2E8F0',
              ...spotlightCardStyle(),
            }}
            onClick={e => e.stopPropagation()}
          >
            {rect && <div style={arrowStyle()} />}
            {CardBody()}
          </motion.div>
        )}

        {/* ── PILL (minimizado) ────────────────────────────────────── */}
        <AnimatePresence>
          {minimized && (
            <motion.div
              key="pill"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, pointerEvents: 'auto', zIndex: 9001 }}
            >
              {/* Pill principal */}
              <button onClick={advance}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#FFFFFF', border: `1.5px solid ${ACCENT}30`,
                  borderRadius: 50, padding: '12px 20px', cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
                  fontFamily: 'Outfit, sans-serif',
                }}>
                <span style={{ fontSize: 18 }}>{current.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
                  Passo {step}/{steps.length - 1}
                </span>
                <span style={{ width: 1, height: 14, background: '#E2E8F0' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Pronto, avançar <ArrowRight size={12} />
                </span>
              </button>

              {/* Sub-botões */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setMinimized(false)}
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: '#6B7280', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  Ver guia
                </button>
                <button onClick={onFinish}
                  style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: '#9CA3AF', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  Fechar guia
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AnimatePresence>
  );
}
