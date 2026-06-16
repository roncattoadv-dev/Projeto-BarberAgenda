import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ChevronLeft, CheckCircle } from 'lucide-react';

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
const CARD_W = 300;
const ARROW  = 10;

export default function TourOverlay({ steps, onFinish }: Props) {
  const [step,      setStep]      = useState(0);
  const [rect,      setRect]      = useState<Rect | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [minimized, setMinimized] = useState(false);

  const current   = steps[step];
  const isWelcome = current.targetId === '__welcome__';
  const isLast    = step === steps.length - 1;

  // ── Measure spotlight target (with one retry) ─────────────────
  const measure = useCallback((attempt = 0) => {
    if (isWelcome) {
      setRect(null);
      setVisible(true);
      return;
    }
    const el = document.getElementById(current.targetId);
    if (!el) {
      if (attempt === 0) {
        setTimeout(() => measure(1), 200);
      } else {
        setRect(null);
        setVisible(true);
      }
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setVisible(true);
  }, [current.targetId, isWelcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On step change ────────────────────────────────────────────
  useEffect(() => {
    setVisible(false);
    setRect(null);
    setMinimized(false);

    const delay = current.onEnter ? 300 : 80;
    current.onEnter?.();
    const t = setTimeout(() => measure(0), delay);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => (isLast ? onFinish() : setStep(s => s + 1));
  const retreat = () => { if (step > 0) setStep(s => s - 1); };

  // CTA: welcome e último passo avançam direto; demais minimizam para pill
  const handleCTA = () => {
    if (isWelcome || isLast) {
      advance();
    } else {
      setMinimized(true);
    }
  };

  // ── Card position ─────────────────────────────────────────────
  const cardBelow = rect ? rect.top < window.innerHeight * 0.5 : false;

  const spotlightCardStyle = (): React.CSSProperties => {
    if (!rect) {
      return { position: 'fixed', top: 80, left: '50%', marginLeft: -(CARD_W / 2) };
    }
    if (cardBelow) {
      return {
        position: 'fixed',
        top:  rect.top + rect.height + PAD + ARROW + 6,
        left: Math.min(
          Math.max(12, rect.left + rect.width / 2 - CARD_W / 2),
          window.innerWidth - CARD_W - 12
        ),
      };
    }
    return {
      position: 'fixed',
      top:  Math.max(12, rect.top + rect.height / 2 - 110),
      left: rect.left + rect.width + PAD + ARROW + 6,
    };
  };

  const arrowStyle = (): React.CSSProperties => {
    if (!rect) return { display: 'none' };
    if (cardBelow) {
      const cardLeft = Math.min(
        Math.max(12, rect.left + rect.width / 2 - CARD_W / 2),
        window.innerWidth - CARD_W - 12
      );
      return {
        position: 'absolute', top: -ARROW,
        left: Math.max(16, rect.left + rect.width / 2 - cardLeft - ARROW),
        width: 0, height: 0,
        borderLeft: `${ARROW}px solid transparent`,
        borderRight: `${ARROW}px solid transparent`,
        borderBottom: `${ARROW}px solid #fff`,
      };
    }
    const cardTop = Math.max(12, rect.top + rect.height / 2 - 110);
    return {
      position: 'absolute', left: -ARROW,
      top: Math.min(Math.max(16, rect.top + rect.height / 2 - cardTop), 180),
      width: 0, height: 0,
      borderTop: `${ARROW}px solid transparent`,
      borderBottom: `${ARROW}px solid transparent`,
      borderRight: `${ARROW}px solid #fff`,
    };
  };

  const progress = Math.round(((step + 1) / steps.length) * 100);

  // ── Card body ─────────────────────────────────────────────────
  const CardBody = () => (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
        padding: isWelcome ? '22px 22px 18px' : '14px 16px',
      }}>
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

      <div style={{ padding: isWelcome ? '18px 22px 20px' : '14px 16px 16px' }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.65, fontFamily: 'Outfit, sans-serif' }}>
          {current.description}
        </p>

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

        {!isWelcome && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
            {steps.slice(1).map((_, i) => {
              const idx = i + 1;
              return (
                <div key={i} style={{
                  width: idx === step ? 18 : 6, height: 6, borderRadius: 3, flexShrink: 0,
                  background: idx < step ? '#4ade80' : idx === step ? '#0F172A' : '#e2e8f0',
                  transition: 'all 0.2s',
                }} />
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button onClick={retreat}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              <ChevronLeft size={13} /> Voltar
            </button>
          )}
          <button onClick={handleCTA}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 16px', background: isLast ? '#16a34a' : '#0F172A', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            {isLast
              ? <><CheckCircle size={14} /><span>Concluir configuração</span></>
              : isWelcome
                ? <><span>Começar configuração</span><ArrowRight size={13} /></>
                : <><span>{current.cta ?? 'Ir configurar'}</span><ArrowRight size={13} /></>
            }
          </button>
        </div>

        <button onClick={onFinish}
          style={{ display: 'block', width: '100%', marginTop: 9, background: 'none', border: 'none', fontSize: 11, color: '#94a3b8', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
          Pular configuração
        </button>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>

        {/* ── Overlay escuro (only when card visible) ──────────── */}
        {visible && !minimized && isWelcome && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,20,50,0.85)', pointerEvents: 'auto' }} />
        )}
        {visible && !minimized && !isWelcome && rect && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.top - PAD, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: 0, width: rect.left - PAD, height: rect.height + PAD * 2, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
            <div style={{ position: 'absolute', top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
          </>
        )}
        {visible && !minimized && !isWelcome && !rect && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,20,50,0.78)', pointerEvents: 'auto' }} />
        )}

        {/* ── Spotlight ring (stays visible when minimized) ────── */}
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
              border: `2px solid ${minimized ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.85)'}`,
              boxShadow: minimized
                ? '0 0 0 3px rgba(74,222,128,0.15)'
                : '0 0 0 4px rgba(255,255,255,0.1), 0 0 24px rgba(255,255,255,0.15)',
              pointerEvents: 'none',
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
          />
        )}

        {/* ── WELCOME card — flex centered ─────────────────────── */}
        {visible && isWelcome && !minimized && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <motion.div
              key={`welcome-${step}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                pointerEvents: 'auto', width: 380, background: '#fff',
                borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {CardBody()}
            </motion.div>
          </div>
        )}

        {/* ── SPOTLIGHT card — positioned beside element ────────── */}
        {visible && !isWelcome && !minimized && (
          <motion.div
            key={`spotlight-${step}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto', width: CARD_W, background: '#fff',
              borderRadius: 14, boxShadow: '0 20px 56px rgba(0,0,0,0.45)', overflow: 'hidden',
              ...spotlightCardStyle(),
            }}
            onClick={e => e.stopPropagation()}
          >
            {rect && <div style={arrowStyle()} />}
            {CardBody()}
          </motion.div>
        )}

        {/* ── PILL — aparece quando minimizado ─────────────────── */}
        <AnimatePresence>
          {minimized && (
            <motion.div
              key="pill"
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.92 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{
                position: 'fixed', bottom: 28, right: 28,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                gap: 8, pointerEvents: 'auto', zIndex: 9001,
              }}
            >
              <button
                onClick={advance}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#0F172A', border: 'none', borderRadius: 50,
                  padding: '13px 22px', cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <span style={{ fontSize: 18 }}>{current.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                  Passo {step}/{steps.length - 1}
                </span>
                <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                  Pronto, avançar <ArrowRight size={13} />
                </span>
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setMinimized(false)}
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', backdropFilter: 'blur(8px)' }}
                >
                  Ver guia
                </button>
                <button
                  onClick={onFinish}
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', backdropFilter: 'blur(8px)' }}
                >
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
