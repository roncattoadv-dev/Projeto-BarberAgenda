import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Search, MessageSquare, ChevronDown } from 'lucide-react';
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

type SendState = 'idle' | 'sending' | 'done' | 'error';

const STATUS_OPTIONS = [
  { value: 'todos',       label: 'Todos os status' },
  { value: 'confirmed',   label: 'Confirmados' },
  { value: 'pending',     label: 'Pendentes' },
  { value: 'cancelled',   label: 'Cancelados' },
  { value: 'attended',    label: 'Histórico' },
];

const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  confirmed: { label: 'Confirmado', dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  text: '#86efac' },
  pending:   { label: 'Pendente',   dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d' },
  cancelled: { label: 'Cancelado',  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',   text: '#fca5a5' },
  attended:  { label: 'Concluído',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#93c5fd' },
};

const ACTIVE_STATUSES = new Set(['confirmed', 'pending']);

// Retorna 'pending' se o horário do agendamento já passou e ainda está confirmed
function displayStatus(appt: Appointment): string {
  if (appt.status !== 'confirmed') return appt.status;
  const apptTime = new Date(`${appt.date}T${appt.time}`);
  return apptTime <= new Date() ? 'pending' : 'confirmed';
}

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

const selectStyle: React.CSSProperties = {
  padding: '7px 26px 7px 10px',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'Outfit, sans-serif',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.75)',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  outline: 'none',
  width: '100%',
};

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
    </div>
  );
}

export default function AgendamentosTab({ activeTenant, myAppointments, myServices, myProfessionals, onUpdateAppointmentStatus, onCompleteAppointment }: Props) {
  const [search,      setSearch]      = useState('');
  const [profFilter,  setProfFilter]  = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortOrder,   setSortOrder]   = useState<'desc' | 'asc'>('desc');

  // ── WhatsApp connection ────────────────────────────────────
  const [authToken,  setAuthToken]  = useState('');
  const [connState,  setConnState]  = useState<ConnectionState>('checking');
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAuthToken(session?.access_token || ''));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setAuthToken(s?.access_token || ''));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authToken) return;
    checkStatusServer(activeTenant.id, authToken).then(({ state }) => setConnState(state));
  }, [authToken, activeTenant.id]);

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

  // ── Filter ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...myAppointments];

    if (statusFilter !== 'todos') {
      list = list.filter(a => displayStatus(a) === statusFilter);
    }

    if (profFilter !== 'todos') list = list.filter(a => a.professionalId === profFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.customerName.toLowerCase().includes(q) || a.customerPhone.includes(q));
    }

    list.sort((a, b) => {
      const aDs = displayStatus(a);
      const bDs = displayStatus(b);
      const aActive = ACTIVE_STATUSES.has(aDs) ? 0 : 1;
      const bActive = ACTIVE_STATUSES.has(bDs) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      const cmp = (a.date + a.time).localeCompare(b.date + b.time);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [myAppointments, statusFilter, profFilter, search, sortOrder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>

      {/* ── Search ─────────────────────────────────────────── */}
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

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
        <SelectWrap>
          <select value={profFilter} onChange={e => setProfFilter(e.target.value)} style={selectStyle}>
            <option value="todos">Profissional</option>
            {myProfessionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'desc' | 'asc')} style={selectStyle}>
            <option value="desc">Mais novo</option>
            <option value="asc">Mais antigo</option>
          </select>
        </SelectWrap>
      </div>

      {/* ── WhatsApp status bar ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          {filtered.length} agendamento{filtered.length !== 1 ? 's' : ''} · disparos: 5 min entre reenvios
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 20, border: '1px solid', fontSize: 10, fontWeight: 600, ...(connState === 'open' ? { background: '#E6F4EC', color: '#0A4A2C', borderColor: '#A7D7BC' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.08)' }) }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
          WhatsApp · {connLabel}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 16, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              Nenhum agendamento neste filtro
            </motion.div>
          ) : filtered.map((appt, i) => {
            const srv    = myServices.find(s => s.id === appt.serviceId);
            const prof   = myProfessionals.find(p => p.id === appt.professionalId);
            const ds     = displayStatus(appt);
            const sm     = STATUS_META[ds] ?? STATUS_META.pending;
            const active = ACTIVE_STATUSES.has(ds);

            return (
              <motion.div
                key={appt.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.03, 0.15) }}
                style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${sm.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {/* Row 1: info + status actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  {/* Left: client info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, flexShrink: 0, marginTop: 3 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {appt.customerName}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
                        <span>{appt.date} · {appt.time}</span>
                        {srv && <span>· {srv.name}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: professional + status + action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {prof && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                        {prof.name}
                      </span>
                    )}
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sm.bg, color: sm.text, border: `1px solid ${sm.border}`, whiteSpace: 'nowrap' }}>
                      {sm.label}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>
                      R$ {appt.price.toFixed(2)}
                    </span>
                    {active && (
                      <>
                        <button onClick={() => onCompleteAppointment(appt)} title="Concluir"
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} />
                        </button>
                        <button onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }} title="Cancelar"
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={11} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 2: wpp sent badges + dispatch buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, paddingLeft: 18 }}>
                  {/* Sent badges */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {appt.wppConfirmSent && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', fontSize: 9, fontWeight: 700 }}>
                        <MessageSquare size={8} /> Confirmação
                      </span>
                    )}
                    {active && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                        ...(appt.wppReminderSent
                          ? { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }
                          : { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' })
                      }}>
                        <Clock size={8} /> Lembrete
                      </span>
                    )}
                  </div>

                  {/* Dispatch buttons — only for active appointments */}
                  {active && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {([
                        { type: 'confirmation' as const, label: '✓ Confirmar' },
                        { type: 'reminder'     as const, label: '⏰ Lembrete' },
                        { type: 'cancellation' as const, label: '✕ Cancelar'  },
                      ]).map(({ type, label }) => {
                        const key      = `${appt.id}-${type}`;
                        const state    = sendStates[key] || 'idle';
                        const busy     = state === 'sending';
                        const cooldown = btnCooldowns[key] ?? 0;
                        const onCd     = cooldown > 0;
                        const disabled = busy || onCd || connState !== 'open';
                        const cdLabel  = btnCooldownLabel(key);

                        const bg    = onCd ? 'rgba(255,255,255,0.06)' : state === 'done' ? '#E6F4EC' : state === 'error' ? '#FEECEC' : state === 'sending' ? '#FEF9EC' : 'rgba(255,255,255,0.88)';
                        const color = onCd ? 'rgba(255,255,255,0.3)'  : state === 'done' ? '#0A4A2C' : state === 'error' ? '#7A0A0A' : state === 'sending' ? '#7A4B0A' : '#0F172A';

                        return (
                          <button
                            key={type}
                            disabled={disabled}
                            onClick={() => doSend(appt, type)}
                            title={onCd ? `Aguarde ${cdLabel}` : label}
                            style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s', background: bg, color, minWidth: onCd ? 56 : undefined }}
                          >
                            {busy ? '⏳' : onCd ? `⏱ ${cdLabel}` : state !== 'idle' ? btnLabel(key) : label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
