import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ChevronLeft, CheckCircle } from 'lucide-react';

export interface TourStep {
  /** '__welcome__' → step centralizado sem spotlight */
  targetId: string;
  emoji: string;
  title: string;
  description: string;
  /** Chamado quando o step fica ativo (use para navegar para o tab certo) */
  onEnter?: () => void;
  /** Rótulo do botão primário (padrão: "Próximo") */
  cta?: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

const PAD    = 8;
const CARD_W = 300;
const ARROW  = 10;

export default function TourOverlay({ steps, onFinish }: Props) {
  const [step,    setStep]    = useState(0);
  const [rect,    setRect]    = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const entered = useRef(false);

  const current   = steps[step];
  const isWelcome = current.targetId === '__welcome__';
  const isLast    = step === steps.length - 1;

  // ── Measure spotlight target ──────────────────────────────────
  const measure = useCallback(() => {
    if (isWelcome) { setRect(null); setVisible(true); return; }
    const el = document.getElementById(current.targetId);
    if (!el) { setVisible(true); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setVisible(true);
  }, [current.targetId, isWelcome]);

  // ── On step change: call onEnter, then wait for render ───────
  useEffect(() => {
    entered.current = false;
    setVisible(false);
    setRect(null);

    if (current.onEnter) {
      current.onEnter();
      // give React + framer time to navigate and render
      const t = setTimeout(measure, 220);
      return () => clearTimeout(t);
    }
    const t = setTimeout(measure, 100);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')                       onFinish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') advance();
      if (e.key === 'ArrowLeft')                    retreat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => isLast ? onFinish() : setStep(s => s + 1);
  const retreat = () => { if (step > 0) setStep(s => s - 1); };

  // ── Card position logic ───────────────────────────────────────
  // If element is in top 40% of screen → card appears below.
  // Otherwise → card appears to the right.
  const cardBelow  = rect ? rect.top < window.innerHeight * 0.45 : false;
  const cardStyle  = (): React.CSSProperties => {
    if (!rect) return {};
    if (cardBelow) {
      return {
        top:  rect.top + rect.height + PAD + ARROW + 8,
        left: Math.min(
          Math.max(12, rect.left + rect.width / 2 - CARD_W / 2),
          window.innerWidth - CARD_W - 12
        ),
      };
    }
    return {
      top:  Math.max(12, rect.top + rect.height / 2 - 110),
      left: rect.left + rect.width + PAD + ARROW + 8,
    };
  };

  const arrowStyle = (): React.CSSProperties => {
    if (!rect) return {};
    if (cardBelow) {
      // arrow pointing up
      const cardLeft = Math.min(
        Math.max(12, rect.left + rect.width / 2 - CARD_W / 2),
        window.innerWidth - CARD_W - 12
      );
      return {
        position: 'absolute',
        top: -ARROW,
        left: Math.max(16, rect.left + rect.width / 2 - cardLeft - ARROW),
        width: 0, height: 0,
        borderLeft:   `${ARROW}px solid transparent`,
        borderRight:  `${ARROW}px solid transparent`,
        borderBottom: `${ARROW}px solid #fff`,
      };
    }
    // arrow pointing left
    const cardTop = Math.max(12, rect.top + rect.height / 2 - 110);
    return {
      position: 'absolute',
      left: -ARROW,
      top:  Math.min(Math.max(16, rect.top + rect.height / 2 - cardTop), 180),
      width: 0, height: 0,
      borderTop:    `${ARROW}px solid transparent`,
      borderBottom: `${ARROW}px solid transparent`,
      borderRight:  `${ARROW}px solid #fff`,
    };
  };

  // ── Progress bar fill ─────────────────────────────────────────
  const progress = Math.round(((step + 1) / steps.length) * 100);

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>

        {/* ── Overlay (4 quadrants around spotlight) ──────────── */}
        {visible && !isWelcome && rect && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.top - PAD, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: 0, width: rect.left - PAD, height: rect.height + PAD * 2, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
          </>
        )}

        {/* ── Full overlay for welcome step ───────────────────── */}
        {visible && isWelcome && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,20,50,0.85)', pointerEvents: 'auto' }} />
        )}

        {/* ── Spotlight ring ───────────────────────────────────── */}
        {visible && !isWelcome && rect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top:    rect.top    - PAD,
              left:   rect.left   - PAD,
              width:  rect.width  + PAD * 2,
              height: rect.height + PAD * 2,
              borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.1), 0 0 24px rgba(255,255,255,0.15)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Card (welcome: centered; spotlight: beside element) ─ */}
        {visible && (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: isWelcome ? 20 : 0, x: isWelcome ? 0 : -10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              pointerEvents: 'auto',
              width: isWelcome ? 380 : CARD_W,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              ...(isWelcome
                ? {
                    top:  '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }
                : {
                    ...cardStyle(),
                  }
              ),
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Arrow (spotlight steps only) */}
            {!isWelcome && rect && (
              <div style={arrowStyle()} />
            )}

            {/* ── Header ───────────────────────────────────────── */}
            <div style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
              padding: isWelcome ? '22px 22px 18px' : '14px 16px',
            }}>
              {/* Progress bar */}
              <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, marginBottom: isWelcome ? 18 : 12, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ height: '100%', background: '#4ade80', borderRadius: 2 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: isWelcome ? 28 : 22 }}>{current.emoji}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', fontFamily: 'Outfit, sans-serif' }}>
                      {step === 0 ? 'Configuração inicial' : `Passo ${step} de ${steps.length - 1}`}
                    </p>
                    <h3 style={{ margin: '2px 0 0', fontSize: isWelcome ? 18 : 15, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                      {current.title}
                    </h3>
                  </div>
                </div>
                <button onClick={onFinish}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px 6px', display: 'flex', borderRadius: 7, flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────── */}
            <div style={{ padding: isWelcome ? '18px 22px 20px' : '14px 16px 16px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.65, fontFamily: 'Outfit, sans-serif' }}>
                {current.description}
              </p>

              {/* Steps checklist (welcome only) */}
              {isWelcome && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                  {[
                    'Identidade do negócio (nome, logo, contato)',
                    'Horários de funcionamento',
                    'Equipe de profissionais',
                    'Serviços e preços',
                    'Link de agendamento pronto ✓',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4b5563', fontFamily: 'Outfit, sans-serif' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', border: '1.5px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>{i + 1}</span>
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Progress dots (non-welcome steps) */}
              {!isWelcome && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                  {steps.slice(1).map((_, i) => {
                    const idx = i + 1;
                    return (
                      <div key={i} style={{
                        width:  idx === step ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        background: idx < step ? '#4ade80' : idx === step ? '#0F172A' : '#e2e8f0',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                      }} />
                    );
                  })}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && (
                  <button onClick={retreat}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                    <ChevronLeft size={13} /> Voltar
                  </button>
                )}
                <button onClick={advance}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 16px', background: isLast ? '#16a34a' : '#0F172A', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {isLast ? (
                    <><CheckCircle size={14} /><span>Concluir configuração</span></>
                  ) : step === 0 ? (
                    <><span>Começar configuração</span><ArrowRight size={13} /></>
                  ) : (
                    <><span>{current.cta ?? 'Próximo passo'}</span><ArrowRight size={13} /></>
                  )}
                </button>
              </div>

              <button onClick={onFinish}
                style={{ display: 'block', width: '100%', marginTop: 9, background: 'none', border: 'none', fontSize: 11, color: '#94a3b8', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
                Pular configuração
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
