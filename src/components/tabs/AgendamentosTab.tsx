import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Search, MessageSquare } from 'lucide-react';
import { Appointment, Service, Professional, Tenant } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  checkStatusServer, sendWhatsAppServer,
  buildConfirmationMsg, buildReminderMsg, buildCancellationMsg,
  type ConnectionState, type ApptData,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onCompleteAppointment: (appt: Appointment) => void;
}

type View   = 'lista' | 'disparar';
type Filter = 'todos' | 'confirmados' | 'pendentes' | 'cancelados' | 'historico';
type SendState = 'idle' | 'sending' | 'done' | 'error';

const FILTER_LABELS: Record<Filter, string> = {
  todos: 'Todos', confirmados: 'Confirmados', pendentes: 'Pendentes', cancelados: 'Cancelados', historico: 'Histórico',
};

const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  confirmed: { label: 'Confirmado', dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  text: '#86efac' },
  pending:   { label: 'Pendente',   dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d' },
  cancelled: { label: 'Cancelado',  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',   text: '#fca5a5' },
  attended:  { label: 'Concluído',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#93c5fd' },
};

const ACTIVE_STATUSES = new Set(['confirmed', 'pending']);

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

export default function AgendamentosTab({ activeTenant, myAppointments, myServices, myProfessionals, onUpdateAppointmentStatus, onCompleteAppointment }: Props) {
  const [view,   setView]   = useState<View>('lista');
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');

  // ── Active-first sort + filter ─────────────────────────────
  const filtered = useMemo(() => {
    let list = [...myAppointments];

    if (filter === 'confirmados') list = list.filter(a => a.status === 'confirmed');
    else if (filter === 'pendentes')   list = list.filter(a => a.status === 'pending');
    else if (filter === 'cancelados')  list = list.filter(a => a.status === 'cancelled');
    else if (filter === 'historico')   list = list.filter(a => a.status === 'attended');
    else list = list.filter(a => a.status !== 'cancelled');

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.customerName.toLowerCase().includes(q) || a.customerPhone.includes(q));
    }

    // Active (confirmed/pending) first, then the rest — both groups by date desc
    list.sort((a, b) => {
      const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
      const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return (b.date + b.time).localeCompare(a.date + a.time);
    });

    return list;
  }, [myAppointments, filter, search]);

  const pendingAppts = useMemo(() =>
    myAppointments
      .filter(a => a.status === 'confirmed' || a.status === 'pending')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [myAppointments]
  );

  // ── Dispatch: auth token ───────────────────────────────────
  const [authToken,  setAuthToken]  = useState('');
  const [connState,  setConnState]  = useState<ConnectionState>('checking');
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAuthToken(session?.access_token || ''));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setAuthToken(s?.access_token || ''));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authToken || view !== 'disparar') return;
    checkStatusServer(activeTenant.id, authToken).then(({ state }) => setConnState(state));
  }, [authToken, activeTenant.id, view]);

  // ── Per-button cooldown (5 min) ────────────────────────────
  const LS_SENT_PREFIX = `barberflow_sent_${activeTenant.id}_`;
  const [btnCooldowns, setBtnCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    const tick = () => {
      const updated: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (!k.startsWith(LS_SENT_PREFIX)) continue;
        const btnKey = k.slice(LS_SENT_PREFIX.length);
        const last   = parseInt(localStorage.getItem(k) || '0', 10);
        const secs   = Math.ceil(Math.max(0, 300 - (Date.now() - last) / 1000));
        if (secs > 0) updated[btnKey] = secs;
      }
      setBtnCooldowns(updated);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [LS_SENT_PREFIX]);

  const btnCooldownLabel = (key: string) => {
    const s = btnCooldowns[key] ?? 0;
    if (s <= 0) return null;
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // ── Send ───────────────────────────────────────────────────
  const getApptData = (appt: Appointment): ApptData => ({
    customerName:     appt.customerName,
    customerPhone:    appt.customerPhone,
    serviceName:      myServices.find(s => s.id === appt.serviceId)?.name           || 'Serviço',
    professionalName: myProfessionals.find(p => p.id === appt.professionalId)?.name || 'Profissional',
    date: appt.date, time: appt.time,
    tenantName:  activeTenant.name,
    tenantPhone: activeTenant.phone,
    id:          appt.id,
    tenantSlug:  activeTenant.slug,
  });

  const doSend = async (appt: Appointment, type: 'confirmation' | 'reminder' | 'cancellation') => {
    const key = `${appt.id}-${type}`;
    if ((btnCooldowns[key] ?? 0) > 0) return;
    localStorage.setItem(LS_SENT_PREFIX + key, Date.now().toString());
    setBtnCooldowns(prev => ({ ...prev, [key]: 300 }));
    setSendStates(prev => ({ ...prev, [key]: 'sending' }));
    const data = getApptData(appt);
    const msg  = type === 'confirmation' ? buildConfirmationMsg(data)
               : type === 'reminder'     ? buildReminderMsg(data)
               :                           buildCancellationMsg(data);
    const result = await sendWhatsAppServer(activeTenant.id, authToken, appt.customerPhone, msg);
    setSendStates(prev => ({ ...prev, [key]: result === 'sent' ? 'done' : 'error' }));
    setTimeout(() => setSendStates(prev => ({ ...prev, [key]: 'idle' })), 4000);
  };

  const btnLabel = (key: string) => ({ idle: '', sending: '⏳', done: '✓', error: '✕' }[sendStates[key] || 'idle']);

  const connDotColor = { open: '#4ade80', close: '#ef4444', connecting: '#fbbf24', error: '#94a3b8', checking: '#64748b' }[connState];
  const connLabel    = { open: 'Conectado', close: 'Desconectado', connecting: 'Aguardando…', error: 'Erro', checking: 'Verificando…' }[connState];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* ── View toggle ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {([['lista', '📋 Lista'], ['disparar', '📤 Disparar']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{
              padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 20, fontFamily: 'Outfit, sans-serif',
              border: `1px solid ${view === id ? '#ffffff' : 'rgba(255,255,255,0.09)'}`,
              background: view === id ? '#ffffff' : 'rgba(255,255,255,0.04)',
              color: view === id ? '#0F172A' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {label}
            {id === 'disparar' && pendingAppts.length > 0 && (
              <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          LISTA
      ══════════════════════════════════════════════════════ */}
      {view === 'lista' && (
        <>
          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input
              placeholder="Buscar cliente ou telefone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="navy-input"
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0, overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
            {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', borderBottom: filter === f ? '2px solid #ffffff' : '2px solid transparent', color: filter === f ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 150ms' }}>
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 16, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                  Nenhum agendamento neste filtro
                </motion.div>
              ) : filtered.map((appt, i) => {
                const srv  = myServices.find(s => s.id === appt.serviceId);
                const prof = myProfessionals.find(p => p.id === appt.professionalId);
                const sm   = STATUS_META[appt.status] ?? STATUS_META.pending;
                return (
                  <motion.div
                    key={appt.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.15) }}
                    style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${sm.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.customerName}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                          {appt.date} · {appt.time} · {srv?.name} · <span style={{ color: 'rgba(255,255,255,0.55)' }}>{prof?.name}</span>
                        </div>
                        {(appt.wppConfirmSent || appt.wppReminderSent) && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                            {appt.wppConfirmSent && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', fontSize: 9, fontWeight: 700 }}>
                                <MessageSquare size={8} /> Confirmação
                              </span>
                            )}
                            {appt.wppReminderSent && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d', fontSize: 9, fontWeight: 700 }}>
                                <Clock size={8} /> Lembrete
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>R$ {appt.price.toFixed(2)}</span>
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sm.bg, color: sm.text, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                      {appt.status !== 'attended' && appt.status !== 'cancelled' && (
                        <>
                          <button onClick={() => onCompleteAppointment(appt)} title="Concluir"
                            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} />
                          </button>
                          <button onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }} title="Cancelar"
                            style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          DISPARAR
      ══════════════════════════════════════════════════════ */}
      {view === 'disparar' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>

          {/* Status bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {pendingAppts.length} agendamento{pendingAppts.length !== 1 ? 's' : ''} ativo{pendingAppts.length !== 1 ? 's' : ''} · 5 min entre reenvios
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600, ...(connState === 'open' ? { background: '#E6F4EC', color: '#0A4A2C', borderColor: '#A7D7BC' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.09)' }) }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
              WhatsApp · {connLabel}
            </div>
          </div>

          {connState !== 'open' && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '11px 14px', fontSize: 12, color: '#fbbf24', flexShrink: 0 }}>
              ⚠️ WhatsApp desconectado — conecte na aba <strong>Automações → Conexão</strong>
            </div>
          )}

          {pendingAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 16, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
              Nenhum agendamento ativo no momento
            </div>
          ) : (
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingAppts.map(appt => {
                const srv  = myServices.find(s => s.id === appt.serviceId);
                const prof = myProfessionals.find(p => p.id === appt.professionalId);
                const sm   = STATUS_META[appt.status] ?? STATUS_META.pending;
                return (
                  <div key={appt.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${sm.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot, flexShrink: 0 }} />
                        <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, padding: '1px 6px', borderRadius: 5 }}>{appt.date} · {appt.time}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: sm.text }}>{sm.label}</span>
                      </div>
                      <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{appt.customerName}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{srv?.name}{prof ? ` · ${prof.name}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
                      {([
                        { type: 'confirmation' as const, label: '✓ Confirmar' },
                        { type: 'reminder'     as const, label: '⏰ Lembrete' },
                        { type: 'cancellation' as const, label: '✕ Cancelar' },
                      ]).map(({ type, label }) => {
                        const key      = `${appt.id}-${type}`;
                        const state    = sendStates[key] || 'idle';
                        const busy     = state === 'sending';
                        const cooldown = btnCooldowns[key] ?? 0;
                        const onCd     = cooldown > 0;
                        const disabled = busy || onCd || connState !== 'open';
                        const cdLabel  = btnCooldownLabel(key);

                        const bg    = onCd ? 'rgba(255,255,255,0.06)' : state === 'done' ? '#E6F4EC' : state === 'error' ? '#FEECEC' : state === 'sending' ? '#FEF9EC' : 'rgba(255,255,255,0.88)';
                        const color = onCd ? 'rgba(255,255,255,0.3)' : state === 'done' ? '#0A4A2C' : state === 'error' ? '#7A0A0A' : state === 'sending' ? '#7A4B0A' : '#0F172A';

                        return (
                          <button
                            key={type}
                            disabled={disabled}
                            onClick={() => doSend(appt, type)}
                            title={onCd ? `Aguarde ${cdLabel}` : label}
                            style={{ padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s', background: bg, color, minWidth: onCd ? 60 : undefined }}
                          >
                            {busy ? '⏳' : onCd ? `⏱ ${cdLabel}` : state !== 'idle' ? btnLabel(key) : label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
