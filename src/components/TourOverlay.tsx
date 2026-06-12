import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ChevronLeft } from 'lucide-react';

export interface TourStep {
  navId: string;
  emoji: string;
  title: string;
  description: string;
}

interface Props {
  steps: TourStep[];
  onFinish: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

export default function TourOverlay({ steps, onFinish }: Props) {
  const [step, setStep]       = useState(0);
  const [rect, setRect]       = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  const current = steps[step];

  const measure = useCallback(() => {
    const el = document.getElementById(`tour-nav-${current.navId}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setVisible(true);
  }, [current.navId]);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(measure, 80);
    return () => clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step]);

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else onFinish();
  };
  const handlePrev = () => { if (step > 0) setStep(s => s - 1); };

  const PAD = 6;
  const CARD_W = 280;
  const ARROW_SIZE = 10;

  return (
    <AnimatePresence>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>

        {/* Dark overlay — 4 rects around the spotlight */}
        {rect && visible && (
          <>
            {/* top */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.top - PAD, background: 'rgba(3,29,60,0.72)', pointerEvents: 'auto' }} onClick={onFinish} />
            {/* bottom */}
            <div style={{ position: 'absolute', top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(3,29,60,0.72)', pointerEvents: 'auto' }} onClick={onFinish} />
            {/* left */}
            <div style={{ position: 'absolute', top: rect.top - PAD, left: 0, width: rect.left - PAD, height: rect.height + PAD * 2, background: 'rgba(3,29,60,0.72)', pointerEvents: 'auto' }} onClick={onFinish} />
            {/* right of spotlight (up to sidebar edge) */}
            <div style={{ position: 'absolute', top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2, background: 'rgba(3,29,60,0.72)', pointerEvents: 'auto' }} onClick={onFinish} />
          </>
        )}

        {/* Spotlight ring */}
        {rect && visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.7)',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.12), 0 8px 32px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Card */}
        {rect && visible && (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: Math.max(12, rect.top + rect.height / 2 - 90),
              left: rect.left + rect.width + PAD + ARROW_SIZE + 10,
              width: CARD_W,
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute',
              left: -ARROW_SIZE,
              top: Math.min(
                Math.max(16, rect.top + rect.height / 2 - Math.max(12, rect.top + rect.height / 2 - 90)),
                120
              ),
              width: 0, height: 0,
              borderTop: `${ARROW_SIZE}px solid transparent`,
              borderBottom: `${ARROW_SIZE}px solid transparent`,
              borderRight: `${ARROW_SIZE}px solid #fff`,
            }} />

            {/* Header colorido */}
            <div style={{ background: '#0F172A', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{current.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1.2px', fontFamily: 'Outfit, sans-serif' }}>
                    Passo {step + 1} de {steps.length}
                  </p>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
                    {current.title}
                  </h3>
                </div>
              </div>
              <button onClick={onFinish} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <X size={15} />
              </button>
            </div>

            {/* Corpo */}
            <div style={{ padding: '14px 16px 16px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.6, fontFamily: 'Outfit, sans-serif' }}>
                {current.description}
              </p>

              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                {steps.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === step ? '#0F172A' : '#e2e8f0',
                    transition: 'all 0.2s',
                  }} />
                ))}
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && (
                  <button onClick={handlePrev}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                    <ChevronLeft size={13} /> Anterior
                  </button>
                )}
                <button onClick={handleNext}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: '#0F172A', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {step < steps.length - 1 ? (
                    <><span>Próximo</span><ArrowRight size={13} /></>
                  ) : (
                    <span>Começar agora 🚀</span>
                  )}
                </button>
              </div>

              <button onClick={onFinish}
                style={{ display: 'block', width: '100%', marginTop: 8, background: 'none', border: 'none', fontSize: 11, color: '#94a3b8', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}>
                Pular tour
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
