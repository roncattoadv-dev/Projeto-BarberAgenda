import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'pending',   label: 'Pendentes'   },
  { value: 'cancelled', label: 'Cancelados'  },
  { value: 'attended',  label: 'Concluídos'  },
];

type DatePreset = 'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'custom';
const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'todos',  label: 'Todas as datas' },
  { value: 'hoje',   label: 'Hoje'           },
  { value: 'ontem',  label: 'Ontem'          },
  { value: 'semana', label: 'Esta semana'    },
  { value: 'mes',    label: 'Este mês'       },
  { value: 'custom', label: 'Personalizado'  },
];

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
    ? (options.find(o => o.value === selected[0])?.label ?? label)
    : `${selected.length} selecionados`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'Outfit, sans-serif', background: selected.length > 0 ? '#EFF6FF' : '#FFFFFF', border: `1px solid ${selected.length > 0 ? '#BFDBFE' : '#D1D5DB'}`, borderRadius: 8, color: selected.length > 0 ? '#1D4ED8' : '#374151', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' as const }}>
        {displayLabel}
        <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 180, padding: 6 }}>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])}
              style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', borderRadius: 6, marginBottom: 2 }}>
              Limpar seleção
            </button>
          )}
          {options.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderRadius: 6, background: selected.includes(o.value) ? '#EFF6FF' : 'transparent' }}>
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
                style={{ width: 14, height: 14, accentColor: '#2563EB', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: selected.includes(o.value) ? 700 : 500, color: selected.includes(o.value) ? '#1D4ED8' : '#374151', fontFamily: 'Outfit, sans-serif' }}>
                {o.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function DateFilter({ preset, from, to, onPreset, onFrom, onTo }: {
  preset: DatePreset; from: string; to: string;
  onPreset: (p: DatePreset) => void; onFrom: (d: string) => void; onTo: (d: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = preset !== 'todos';
  const displayLabel = isActive ? (DATE_PRESETS.find(p => p.value === preset)?.label ?? 'Data') : 'Data';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', fontSize: 11, fontWeight: 600, fontFamily: 'Outfit, sans-serif', background: isActive ? '#EFF6FF' : '#FFFFFF', border: `1px solid ${isActive ? '#BFDBFE' : '#D1D5DB'}`, borderRadius: 8, color: isActive ? '#1D4ED8' : '#374151', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' as const }}>
        {displayLabel}
        <ChevronDown size={11} style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 180, padding: 6 }}>
          {DATE_PRESETS.map(p => (
            <button key={p.value} type="button"
              onClick={() => { onPreset(p.value); if (p.value !== 'custom') setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '7px 10px', fontSize: 12, fontWeight: preset === p.value ? 700 : 500, color: preset === p.value ? '#1D4ED8' : '#374151', background: preset === p.value ? '#EFF6FF' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', borderRadius: 6 }}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div style={{ padding: '8px 10px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6B7280', width: 24, flexShrink: 0 }}>De</span>
                <input type="date" value={from} onChange={e => onFrom(e.target.value)}
                  style={{ flex: 1, padding: '5px 8px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 7, outline: 'none', fontFamily: 'Outfit, sans-serif', color: '#111827' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6B7280', width: 24, flexShrink: 0 }}>Até</span>
                <input type="date" value={to} onChange={e => onTo(e.target.value)}
                  style={{ flex: 1, padding: '5px 8px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 7, outline: 'none', fontFamily: 'Outfit, sans-serif', color: '#111827' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  confirmed: { label: 'Confirmado', dot: '#22C55E', bg: '#DCFCE7',  border: '#86EFAC',  text: '#166534' },
  pending:   { label: 'Pendente',   dot: '#F59E0B', bg: '#FEF9C3',  border: '#FCD34D',  text: '#92400E' },
  cancelled: { label: 'Cancelado',  dot: '#EF4444', bg: '#FEE2E2',  border: '#FCA5A5',  text: '#DC2626' },
  attended:  { label: 'Concluído',  dot: '#3B82F6', bg: '#DBEAFE',  border: '#93C5FD',  text: '#1D4ED8' },
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
  background: '#FFFFFF',
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  color: '#374151',
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
      <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6B7280', pointerEvents: 'none' }} />
    </div>
  );
}

const LS_KEY = 'bf_agend_filters';
function loadFilters() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

export default function AgendamentosTab({ activeTenant, myAppointments, myServices, myProfessionals, onUpdateAppointmentStatus, onCompleteAppointment, reminderMinutes = 60 }: Props & { reminderMinutes?: number }) {
  const [search,       setSearch]       = useState('');
  const [profFilter,   setProfFilter]   = useState<string[]>(() => loadFilters().profFilter   ?? []);
  const [statusFilter, setStatusFilter] = useState<string[]>(() => loadFilters().statusFilter ?? []);
  const [sortOrder,    setSortOrder]    = useState<'desc' | 'asc'>(() => loadFilters().sortOrder  ?? 'desc');
  const [datePreset,   setDatePreset]   = useState<DatePreset>(() => loadFilters().datePreset  ?? 'todos');
  const [dateFrom,     setDateFrom]     = useState<string>(() => loadFilters().dateFrom    ?? '');
  const [dateTo,       setDateTo]       = useState<string>(() => loadFilters().dateTo      ?? '');

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ profFilter, statusFilter, sortOrder, datePreset, dateFrom, dateTo }));
  }, [profFilter, statusFilter, sortOrder, datePreset, dateFrom, dateTo]);

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

  // Timestamp do último reenvio manual (persiste no localStorage via LS_SENT_PREFIX)
  const getLastSentStr = (key: string): string | null => {
    const raw = localStorage.getItem(LS_SENT_PREFIX + key);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    if (!ts) return null;
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const connDotColor = { open: '#4ade80', close: '#ef4444', connecting: '#fbbf24', error: '#F1F5F9', checking: '#64748b' }[connState];
  const connLabel    = { open: 'Conectado', close: 'Desconectado', connecting: 'Aguardando…', error: 'Erro', checking: 'Verificando…' }[connState];

  // ── Filter ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...myAppointments];

    if (statusFilter.length > 0) list = list.filter(a => statusFilter.includes(displayStatus(a)));
    if (profFilter.length > 0)   list = list.filter(a => profFilter.includes(a.professionalId));

    if (datePreset !== 'todos') {
      const today = new Date().toISOString().split('T')[0];
      if (datePreset === 'hoje') {
        list = list.filter(a => a.date === today);
      } else if (datePreset === 'ontem') {
        const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        list = list.filter(a => a.date === y);
      } else if (datePreset === 'semana') {
        const d = new Date(); const dow = d.getDay();
        const mon = new Date(d.getTime() - (dow === 0 ? 6 : dow - 1) * 86400000).toISOString().split('T')[0];
        const sun = new Date(d.getTime() + (dow === 0 ? 0 : 7 - dow) * 86400000).toISOString().split('T')[0];
        list = list.filter(a => a.date >= mon && a.date <= sun);
      } else if (datePreset === 'mes') {
        const ym = today.substring(0, 7);
        list = list.filter(a => a.date.startsWith(ym));
      } else if (datePreset === 'custom') {
        if (dateFrom) list = list.filter(a => a.date >= dateFrom);
        if (dateTo)   list = list.filter(a => a.date <= dateTo);
      }
    }

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
  }, [myAppointments, statusFilter, profFilter, datePreset, dateFrom, dateTo, search, sortOrder]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>

      {/* ── Search ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input
          placeholder="Buscar cliente ou telefone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="navy-input"
          style={{ paddingLeft: 34, background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }}
        />
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelect
          label="Profissional"
          options={myProfessionals.map(p => ({ value: p.id, label: p.name }))}
          selected={profFilter}
          onChange={setProfFilter}
        />
        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <DateFilter
          preset={datePreset}
          from={dateFrom}
          to={dateTo}
          onPreset={setDatePreset}
          onFrom={setDateFrom}
          onTo={setDateTo}
        />
        <SelectWrap>
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'desc' | 'asc')} style={selectStyle}>
            <option value="desc">Mais novo</option>
            <option value="asc">Mais antigo</option>
          </select>
        </SelectWrap>
      </div>

      {/* ── WhatsApp status bar ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
          {filtered.length} agendamento{filtered.length !== 1 ? 's' : ''} · disparos: 5 min entre reenvios
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 20, border: '1px solid', fontSize: 10, fontWeight: 600, ...(connState === 'open' ? { background: '#E6F4EC', color: '#0A4A2C', borderColor: '#A7D7BC' } : { background: '#F1F5F9', color: '#6B7280', borderColor: '#E2E8F0' }) }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
          WhatsApp · {connLabel}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed #D1D5DB', borderRadius: 16, background: '#F8FAFC', color: '#9CA3AF', fontSize: 13 }}>
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
                style={{ padding: '10px 14px', background: '#FFFFFF', border: `1px solid ${sm.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
              >
                {/* Dot */}
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: sm.dot, flexShrink: 0 }} />

                {/* Info (flex: 1) */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {appt.customerName}
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '0 5px' }}>
                    <span>{appt.date} · {appt.time}</span>
                    {srv && <span>· {srv.name}</span>}
                    {prof && <span>· {prof.name}</span>}
                  </div>
                </div>

                {/* Status + price */}
                <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: sm.bg, color: sm.text, border: `1px solid ${sm.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {sm.label}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#16A34A', flexShrink: 0 }}>
                  R$ {appt.price.toFixed(2)}
                </span>

                {/* WA pills + auto-action inline */}
                {active && (() => {
                  const apptPast   = new Date(`${appt.date}T${appt.time}`) <= new Date();
                  const mode       = activeTenant.agendaMode;
                  const bufMin     = activeTenant.agendaTimeMinutes ?? 30;
                  const duration   = srv?.durationMinutes ?? 60;
                  const [ah, am]   = appt.time.split(':').map(Number);
                  const endMin     = ah * 60 + am + duration;
                  const actMin     = endMin + bufMin;
                  const actTime    = `${String(Math.floor(actMin / 60)).padStart(2,'0')}:${String(actMin % 60).padStart(2,'0')}`;
                  const actPast    = new Date(`${appt.date}T${actTime}`) <= new Date();
                  const isComplete = mode === 'auto_complete';

                  const mkPill = (type: 'confirmation' | 'reminder', icon: React.ReactNode, label: string, sent: boolean, scheduledInfo: string, failIfNotSent: boolean) => {
                    const key      = `${appt.id}-${type}`;
                    const state    = sendStates[key] || 'idle';
                    const busy     = state === 'sending';
                    const onCd     = (btnCooldowns[key] ?? 0) > 0;
                    const cdLabel  = btnCooldownLabel(key);
                    const lastSent = getLastSentStr(key);

                    const isSent     = sent || state === 'done' || !!lastSent;
                    const isFailed   = !isSent && failIfNotSent;
                    const showResend = isFailed;
                    const disabled   = busy || onCd || connState !== 'open';

                    const sentText = lastSent ? `Reenviado ${lastSent}` : sent ? 'Auto' : state === 'done' ? 'Enviado' : scheduledInfo;
                    const sentColor  = isSent ? '#166534' : isFailed ? '#DC2626' : '#92400E';
                    const pillBg     = isSent ? '#F0FDF4' : isFailed ? '#FEF2F2' : '#FEFCE8';
                    const pillBorder = isSent ? '#86EFAC' : isFailed ? '#FECACA' : '#FCD34D';

                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', background: pillBg, border: `1px solid ${pillBorder}`, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '3px 7px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: sentColor, whiteSpace: 'nowrap' }}>
                            {icon} {label}
                          </div>
                          <div style={{ fontSize: 8, color: sentColor, opacity: 0.8, whiteSpace: 'nowrap' }}>{sentText}</div>
                        </div>
                        {showResend && (
                          <button
                            disabled={disabled}
                            onClick={() => doSend(appt, type)}
                            title={onCd ? `Aguarde ${cdLabel}` : `Reenviar ${label}`}
                            style={{ alignSelf: 'stretch', padding: '0 8px', background: 'rgba(220,38,38,0.08)', border: 'none', borderLeft: `1px solid ${pillBorder}`, color: '#DC2626', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 3, opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                            {busy ? '⏳' : onCd ? `⏱ ${cdLabel}` : '↺ Reenviar'}
                          </button>
                        )}
                      </div>
                    );
                  };

                  // Horário previsto do lembrete
                  const remMin  = ah * 60 + am - reminderMinutes;
                  const remTime = remMin >= 0
                    ? `${String(Math.floor(remMin/60)).padStart(2,'0')}:${String(remMin%60).padStart(2,'0')}`
                    : null;

                  // Lembrete suspenso: janela do lembrete já passou mas agendamento ainda não ocorreu
                  const remDt        = new Date(`${appt.date}T${appt.time}`);
                  remDt.setMinutes(remDt.getMinutes() - reminderMinutes);
                  const reminderSuspenso = !appt.wppReminderSent && !apptPast && remDt <= new Date();

                  return (
                    <>
                      {/* WA pills */}
                      {mkPill('confirmation', <MessageSquare size={8} />, 'Confirm.', appt.wppConfirmSent, 'Não enviada', true)}
                      {reminderSuspenso ? (
                        <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 7, padding: '3px 7px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>
                              <Clock size={8} /> {remTime ? `Lemb. ${remTime}` : 'Lembrete'}
                            </div>
                            <div style={{ fontSize: 8, color: '#94A3B8', whiteSpace: 'nowrap' }}>Suspenso</div>
                          </div>
                        </div>
                      ) : (
                        mkPill('reminder', <Clock size={8} />, remTime ? `Lemb. ${remTime}` : 'Lembrete', appt.wppReminderSent, remTime ? `Previsto ${remTime}` : 'Auto', apptPast)
                      )}

                      {/* Badge de automação */}
                      {!actPast && mode && mode !== 'manual' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700, flexShrink: 0,
                          background: isComplete ? '#F0FDF4' : '#FEF3C7',
                          color:      isComplete ? '#166534' : '#92400E',
                          border:     `1px solid ${isComplete ? '#86EFAC' : '#FCD34D'}` }}>
                          {isComplete ? '⚡' : '⚠️'} {isComplete ? `Auto-concluir ${actTime}` : `Auto-cancelar ${actTime}`}
                        </span>
                      )}

                      {/* Botões de ação */}
                      <button onClick={() => onCompleteAppointment(appt)} title="Concluir atendimento"
                        style={{ height: 24, padding: '0 8px', borderRadius: 7, background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Check size={10} /> Concluir
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Cancelar o agendamento de ${appt.customerName}?\n\nUma mensagem de cancelamento será enviada via WhatsApp automaticamente.`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }}
                        title="Cancelar e notificar via WhatsApp"
                        style={{ height: 24, padding: '0 8px', borderRadius: 7, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <X size={10} /> Cancelar
                      </button>
                    </>
                  );
                })()}

              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
