import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Bell, BellOff, RefreshCw, Clock } from 'lucide-react';
import { Appointment, Service, Professional, Customer } from '../../types';
import { useToast } from '../../hooks/useToast';

interface Props {
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
  myCustomers: Customer[];
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onAddAppointment: (a: Omit<Appointment, 'id'>) => void;
  onAddCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer>;
  onCompleteAppointment: (appt: Appointment) => void;
  onResendReminder: (apptId: string) => Promise<void>;
  onRescheduleAppointment: (id: string, date: string, time: string) => Promise<void>;
  tenantId: string;
}

type ViewMode = 'day' | 'week' | 'month';

// ── Paleta light ──────────────────────────────────────────────────────────────
const C = {
  // Fundo da página (atrás do grid) — branco puro
  pageBg:      '#ffffff',
  // Superfície do grid (frente) — cinza levemente mais escuro para criar profundidade
  gridBg:      '#f0f2f5',
  // Células do grid — branco, para contrastar com a superfície do grid
  cellBg:      '#ffffff',
  // Cabeçalhos sticky (dias da semana, nomes dos meses)
  headerBg:    '#e4e7ec',
  // Bordas externas do grid
  border:      '#c9cdd6',
  // Divisórias internas entre células
  borderLight: '#dde0e6',
  // Texto — contrastes garantidos (WCAG AA mínimo 4.5:1 sobre branco)
  text:        '#0f1115',  // quase preto — 19:1 sobre branco
  textMd:      '#1f2937',  // 16:1
  textSm:      '#374151',  // 11:1
  textXs:      '#4b5563',  // 8:1 — ainda passa AA
  textMuted:   '#6b7280',  // 5:1 — para info menos crítica
  today:       '#031D3C',
  todayText:   '#ffffff',
};

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  confirmed: { bg: '#dcfce7', border: '#86efac', text: '#16a34a', dot: '#22c55e' },
  pending:   { bg: '#fef9c3', border: '#fde68a', text: '#b45309', dot: '#f59e0b' },
  cancelled: { bg: '#fee2e2', border: '#fca5a5', text: '#dc2626', dot: '#ef4444' },
  attended:  { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8', dot: '#3b82f6' },
};

const STATUS_SOLID: Record<string, { bg: string; shadow: string }> = {
  confirmed: { bg: '#16a34a', shadow: 'rgba(22,163,74,0.35)' },
  pending:   { bg: '#d97706', shadow: 'rgba(217,119,6,0.35)' },
  attended:  { bg: '#2563eb', shadow: 'rgba(37,99,235,0.35)' },
  cancelled: { bg: '#dc2626', shadow: 'rgba(220,38,38,0.35)' },
};

const FOOTER_H = 20;

// Paleta de cores para chips de profissionais (saturadas, legíveis em fundo branco)
const PROF_COLORS = [
  { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6', dot: '#7c3aed' },
  { bg: '#ccfbf1', border: '#5eead4', text: '#0f766e', dot: '#14b8a6' },
  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d', dot: '#ec4899' },
  { bg: '#dcfce7', border: '#86efac', text: '#166534', dot: '#22c55e' },
  { bg: '#ffedd5', border: '#fdba74', text: '#9a3412', dot: '#fb923c' },
];

const HOURS    = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);
const HOUR_HEIGHT = 90;
const FIRST_HOUR  = 8;
const DAYS_PT  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d); r.setDate(1); r.setMonth(r.getMonth() + n); return r;
}
function monthGrid(d: Date): Date[] {
  const year = d.getFullYear(), month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const start = addDays(firstDay, -startOffset);
  const endOffset = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();
  return Array.from({ length: startOffset + lastDay.getDate() + endOffset }, (_, i) => addDays(start, i));
}

// Distribui agendamentos sobrepostos em colunas (algoritmo greedy)
function layoutDay(appts: Appointment[]): Array<{ appt: Appointment; col: number; totalCols: number }> {
  if (!appts.length) return [];
  const toMin = (t: string) => parseInt(t) * 60 + parseInt(t.slice(3, 5));
  const sorted = [...appts].sort((a, b) => a.time.localeCompare(b.time));
  const colEnds: number[] = [];
  const placed: Array<{ appt: Appointment; col: number }> = [];
  for (const appt of sorted) {
    const start = toMin(appt.time);
    const end   = start + Math.max(appt.durationMinutes ?? 60, 15);
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else colEnds[col] = end;
    placed.push({ appt, col });
  }
  const totalCols = colEnds.length;
  return placed.map(p => ({ ...p, totalCols }));
}

function isPastAppt(date: string, time: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min]  = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min) < new Date();
}

export default function AgendaTab({ myAppointments, myServices, myProfessionals, myCustomers, onUpdateAppointmentStatus, onAddAppointment, onAddCustomer, onCompleteAppointment, onResendReminder, onRescheduleAppointment, tenantId }: Props) {
  const [view, setView] = useState<ViewMode>(() => {
    const s = localStorage.getItem('bf_agenda_view');
    return (s === 'day' || s === 'week' || s === 'month') ? s : 'day';
  });
  const [baseDate, setBaseDate] = useState(new Date());
  const [hoveredAppt, setHoveredAppt]   = useState<string | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);
  const [selectedProfIds, setSelectedProfIds] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('bf_agenda_prof_filter'); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });
  const [now, setNow] = useState(new Date());
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [remindedIds,  setRemindedIds]  = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // ── Novo agendamento via clique no slot ──────────────────────────────────────
  type NewSlot = { date: string; time: string; px: number; py: number };
  const [newSlot,    setNewSlot]    = useState<NewSlot | null>(null);
  const [slotCustId, setSlotCustId] = useState('');
  const [slotCustQ,  setSlotCustQ]  = useState('');
  const [slotSrvId,  setSlotSrvId]  = useState('');
  const [slotProfId, setSlotProfId] = useState('');
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotNewCustMode,  setSlotNewCustMode]  = useState(false);
  const [slotNewCustName,  setSlotNewCustName]  = useState('');
  const [slotNewCustPhone, setSlotNewCustPhone] = useState('');
  const [slotCreating,     setSlotCreating]     = useState(false);

  // ── Painel de detalhes do agendamento ────────────────────────────────────────
  const [apptPanel,     setApptPanel]     = useState<Appointment | null>(null);
  const [panelPx,       setPanelPx]       = useState(0);
  const [panelPy,       setPanelPy]       = useState(0);
  const [reschedMode,   setReschedMode]   = useState(false);
  const [reschedDate,   setReschedDate]   = useState('');
  const [reschedTime,   setReschedTime]   = useState('');
  const [rescheduling,  setRescheduling]  = useState(false);

  const closeAll = () => { setNewSlot(null); setApptPanel(null); setReschedMode(false); setSlotNewCustMode(false); setSlotNewCustName(''); setSlotNewCustPhone(''); };

  const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>, dateKey: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relY  = e.clientY - rect.top;
    const hourF = FIRST_HOUR + relY / HOUR_HEIGHT;
    const h     = Math.min(Math.max(FIRST_HOUR, Math.floor(hourF)), FIRST_HOUR + HOURS.length - 1);
    const m     = Math.round(((hourF - Math.floor(hourF)) * 2)) * 30;
    const time  = `${String(h).padStart(2,'0')}:${String(m >= 60 ? 0 : m).padStart(2,'0')}`;
    const px = Math.min(e.clientX + 12, window.innerWidth  - 300);
    const py = Math.min(e.clientY - 20, window.innerHeight - 340);
    setSlotCustId(''); setSlotCustQ(''); setSlotSrvId(''); setSlotProfId('');
    setSlotNewCustMode(false); setSlotNewCustName(''); setSlotNewCustPhone('');
    setApptPanel(null);
    setNewSlot({ date: dateKey, time, px, py });
  };

  const handleApptClick = (e: React.MouseEvent, appt: Appointment) => {
    e.stopPropagation();
    const px = Math.min(e.clientX + 12, window.innerWidth  - 300);
    const py = Math.min(e.clientY - 40, window.innerHeight - 360);
    setNewSlot(null);
    setReschedMode(false);
    setReschedDate(appt.date); setReschedTime(appt.time);
    setApptPanel(appt);
    setPanelPx(px); setPanelPy(py);
  };

  const handleSlotSubmit = async () => {
    if (!newSlot || !slotCustId || !slotSrvId) return;
    const cust = myCustomers.find(c => c.id === slotCustId);
    const srv  = myServices.find(s => s.id === slotSrvId);
    if (!cust || !srv) return;
    setSlotSaving(true);
    try {
      await onAddAppointment({
        tenantId, serviceId: slotSrvId, professionalId: slotProfId || myProfessionals[0]?.id || '',
        customerId: cust.id, customerName: cust.name, customerPhone: cust.phone,
        date: newSlot.date, time: newSlot.time, durationMinutes: srv.durationMinutes,
        price: srv.price, status: 'confirmed', notes: '',
        wppConfirmSent: false, wppReminderSent: false,
      });
      toast.success('Agendamento criado!');
      setNewSlot(null);
    } catch { toast.error('Erro ao criar agendamento.'); }
    finally { setSlotSaving(false); }
  };

  const handleReschedule = async () => {
    if (!apptPanel || !reschedDate || !reschedTime) return;
    setRescheduling(true);
    try {
      await onRescheduleAppointment(apptPanel.id, reschedDate, reschedTime);
      toast.success('Reagendado!');
      setApptPanel(prev => prev ? { ...prev, date: reschedDate, time: reschedTime } : null);
      setReschedMode(false);
    } catch { toast.error('Erro ao reagendar.'); }
    finally { setRescheduling(false); }
  };

  const filtCusts = myCustomers.filter(c =>
    !slotCustQ || c.name.toLowerCase().includes(slotCustQ.toLowerCase()) || c.phone.includes(slotCustQ)
  ).slice(0, 6);

  const handleResend = async (apptId: string) => {
    setResendingIds(prev => new Set(prev).add(apptId));
    try {
      await onResendReminder(apptId);
      setRemindedIds(prev => new Set(prev).add(apptId));
      toast.success('Lembrete reenviado!');
    } catch {
      toast.error('Falha ao reenviar lembrete.');
    } finally {
      setResendingIds(prev => { const n = new Set(prev); n.delete(apptId); return n; });
    }
  };

  const today = formatDateKey(new Date());

  const toggleProf = (id: string) => {
    setSelectedProfIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('bf_agenda_prof_filter', JSON.stringify([...next]));
      return next;
    });
  };
  const clearProfFilter = () => { setSelectedProfIds(new Set()); localStorage.removeItem('bf_agenda_prof_filter'); };

  const filteredAppointments = useMemo(() =>
    selectedProfIds.size === 0 ? myAppointments : myAppointments.filter(a => selectedProfIds.has(a.professionalId)),
    [myAppointments, selectedProfIds]);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (view === 'month') return;
    const h = now.getHours(), m = now.getMinutes();
    if (h < FIRST_HOUR || h >= FIRST_HOUR + HOURS.length) return;
    scrollRef.current?.scrollTo({ top: Math.max(0, ((h - FIRST_HOUR) + m / 60) * HOUR_HEIGHT - 120), behavior: 'smooth' });
  }, [view]);

  const timeLineTop = (() => {
    const h = now.getHours(), m = now.getMinutes();
    if (h < FIRST_HOUR || h >= FIRST_HOUR + HOURS.length) return null;
    return ((h - FIRST_HOUR) + m / 60) * HOUR_HEIGHT;
  })();

  const navigate = (dir: number) => {
    if (view === 'day')   setBaseDate(d => addDays(d, dir));
    if (view === 'week')  setBaseDate(d => addDays(d, dir * 7));
    if (view === 'month') setBaseDate(d => addMonths(d, dir));
  };

  const weekDays = useMemo(() => {
    if (view === 'week') { const s = startOfWeek(baseDate); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    return [baseDate];
  }, [view, baseDate]);

  const monthDays = useMemo(() => view === 'month' ? monthGrid(baseDate) : [], [view, baseDate]);

  const isTodayVisible = view === 'day'
    ? formatDateKey(baseDate) === today
    : weekDays.some(d => formatDateKey(d) === today);

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
      (map[a.date] ??= []).push(a);
    });
    return map;
  }, [filteredAppointments]);

  const apptsByDateHour = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    filteredAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
      const key = `${a.date}__${a.time.substring(0,2)}:00`;
      (map[key] ??= []).push(a);
    });
    return map;
  }, [filteredAppointments]);

  const headerLabel = view === 'day'
    ? `${baseDate.getDate()} de ${MONTHS_PT[baseDate.getMonth()]} de ${baseDate.getFullYear()}`
    : view === 'week'
    ? `${weekDays[0].getDate()} ${MONTHS_SHORT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS_SHORT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
    : `${MONTHS_PT[baseDate.getMonth()]} ${baseDate.getFullYear()}`;

  // ── Estilos de botão reutilizáveis ────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 150ms',
  };
  // Toolbar fica sobre fundo navy → cores claras (light-on-dark)
  const iconBtn: React.CSSProperties = {
    ...btnBase, width: 30, height: 30, borderRadius: 8,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: 'Outfit, sans-serif', padding: '12px 16px 0' }}>

      {/* ── Toolbar — sobre fundo navy, usa cores claras ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setBaseDate(new Date())}
            style={{ ...btnBase, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)' }}>
            Hoje
          </button>
          <button onClick={() => navigate(-1)} style={iconBtn}><ChevronLeft size={14} /></button>
          <button onClick={() => navigate(1)}  style={iconBtn}><ChevronRight size={14} /></button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.92)', marginLeft: 4 }}>{headerLabel}</span>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          {([['day','Dia'],['week','Semana'],['month','Mês']] as [ViewMode,string][]).map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); localStorage.setItem('bf_agenda_view', v); }}
              style={{ ...btnBase, padding: '5px 14px', fontSize: 12, fontWeight: 700, border: 'none',
                background: view === v ? 'rgba(255,255,255,0.16)' : 'transparent',
                color: view === v ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros por profissional — também sobre fundo navy ── */}
      {myProfessionals.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={clearProfFilter}
            style={{ ...btnBase, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: selectedProfIds.size === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${selectedProfIds.size === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: selectedProfIds.size === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
            }}>
            Todos
          </button>
          {myProfessionals.map((prof, i) => {
            const c = PROF_COLORS[i % PROF_COLORS.length];
            const active = selectedProfIds.has(prof.id);
            return (
              <button key={prof.id} onClick={() => toggleProf(prof.id)}
                style={{ ...btnBase, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: active ? c.bg : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${active ? c.border : 'rgba(255,255,255,0.12)'}`,
                  color: active ? c.text : 'rgba(255,255,255,0.5)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? c.dot : 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                {prof.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Calendar grid ── */}
      <motion.div
        ref={scrollRef}
        key={view + formatDateKey(baseDate)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', borderRadius: 12, border: `1px solid ${C.border}`, background: C.gridBg, position: 'relative' }}
        className="no-scrollbar"
      >

        {/* ── Month grid ── */}
        {view === 'month' && (() => {
          const currentMonth = baseDate.getMonth();
          const weeks: Date[][] = [];
          for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.headerBg, zIndex: 2 }}>
                {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.textSm }}>{d}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${C.borderLight}` }}>
                  {week.map(d => {
                    const key = formatDateKey(d);
                    const isToday = key === today;
                    const isCurrentMonth = d.getMonth() === currentMonth;
                    const dayAppts = apptsByDate[key] ?? [];
                    return (
                      <div key={key} style={{ minHeight: 90, padding: '6px 8px', borderLeft: `1px solid ${C.borderLight}`, background: C.cellBg, opacity: isCurrentMonth ? 1 : 0.35 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: isToday ? C.today : 'transparent', color: isToday ? C.todayText : C.textSm, fontWeight: isToday ? 800 : 600, fontSize: 12, marginBottom: 4 }}>
                          {d.getDate()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {dayAppts.slice(0, 3).map(appt => {
                            const sc = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
                            return (
                              <div key={appt.id} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: sc.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {appt.time.substring(0,5)} {appt.customerName}
                                </span>
                                {appt.wppConfirmSent  && <MessageSquare size={7} color={STATUS_COLOR.confirmed.dot} style={{ flexShrink: 0 }} />}
                                {appt.wppReminderSent && <Clock size={7} color={STATUS_COLOR.pending.dot} style={{ flexShrink: 0 }} />}
                              </div>
                            );
                          })}
                          {dayAppts.length > 3 && (
                            <div style={{ fontSize: 9, color: C.textSm, fontWeight: 700, paddingLeft: 4 }}>+{dayAppts.length - 3} mais</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          );
        })()}

        {/* ── Week header ── */}
        {view === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.headerBg, zIndex: 2 }}>
            <div />
            {weekDays.map(d => {
              const key = formatDateKey(d);
              const isToday = key === today;
              const count = filteredAppointments.filter(a => a.date === key && a.status !== 'cancelled').length;
              return (
                <div key={key} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: `1px solid ${C.borderLight}`, background: isToday ? `rgba(3,29,60,0.06)` : 'transparent' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.textSm, marginBottom: 4 }}>{DAYS_PT[d.getDay()]}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: isToday ? C.today : 'transparent', color: isToday ? C.todayText : C.textMd, fontWeight: 800, fontSize: 14 }}>{d.getDate()}</div>
                  {count > 0 && <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>{count}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Grid de horas — posicionamento absoluto estilo Google Calendar ── */}
        {view !== 'month' && (
          <div style={{ display: 'grid', gridTemplateColumns: `64px repeat(${weekDays.length}, 1fr)` }}>

            {/* Coluna de rótulos de hora */}
            <div>
              {HOURS.map(hour => (
                <div key={hour} style={{ height: HOUR_HEIGHT, borderBottom: `1px solid ${C.borderLight}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '6px 8px 0 0', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textSm, fontWeight: 500 }}>{hour}</span>
                </div>
              ))}
            </div>

            {/* Colunas de dias */}
            {weekDays.map(d => {
              const dateKey    = formatDateKey(d);
              const isToday    = dateKey === today;
              const isCurrentDay = isTodayVisible && isToday;
              const dayAppts   = filteredAppointments.filter(a => a.date === dateKey && a.status !== 'cancelled');
              const laid       = layoutDay(dayAppts);
              const totalH     = HOURS.length * HOUR_HEIGHT;

              return (
                <div key={dateKey} onClick={e => handleSlotClick(e, dateKey)} style={{ position: 'relative', height: totalH, borderLeft: `1px solid ${C.borderLight}`, background: C.cellBg, cursor: 'crosshair' }}>

                  {/* Linhas de hora */}
                  {HOURS.map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: (i + 1) * HOUR_HEIGHT, left: 0, right: 0, height: 1, background: C.borderLight }} />
                  ))}

                  {/* Barra vermelha de horário atual */}
                  {isCurrentDay && timeLineTop !== null && (
                    <div style={{ position: 'absolute', top: timeLineTop, left: -1, right: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', transform: 'translateY(-50%)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginLeft: -5 }} />
                      <div style={{ flex: 1, height: 2, background: '#ef4444' }} />
                    </div>
                  )}

                  {/* Agendamentos — posicionados por hora e com altura proporcional à duração */}
                  {laid.map(({ appt, col, totalCols }) => {
                    const [hh, mm] = appt.time.split(':').map(Number);
                    const top    = ((hh - FIRST_HOUR) + mm / 60) * HOUR_HEIGHT;
                    const height = Math.max(24, ((appt.durationMinutes ?? 60) / 60) * HOUR_HEIGHT) - 3;
                    const colW   = 100 / totalCols;
                    const left   = `calc(${col * colW}% + 3px)`;
                    const width  = `calc(${colW}% - 6px)`;

                    const sc      = STATUS_SOLID[appt.status] ?? STATUS_SOLID.pending;
                    const srv     = myServices.find(s => s.id === appt.serviceId);
                    const prof    = myProfessionals.find(p => p.id === appt.professionalId);
                    const isHov   = hoveredAppt === appt.id;

                    const confirmSent  = appt.wppConfirmSent  === true;
                    const reminderSent = appt.wppReminderSent === true || remindedIds.has(appt.id);
                    const reminderFailed  = !reminderSent && isPastAppt(appt.date, appt.time);
                    const isResending     = resendingIds.has(appt.id);

                    const showFooter = height >= 32;

                    return (
                      <div
                        key={appt.id}
                        onMouseEnter={() => setHoveredAppt(appt.id)}
                        onMouseLeave={() => setHoveredAppt(null)}
                        onClick={e => handleApptClick(e, appt)}
                        style={{
                          position: 'absolute', top, height, left, width,
                          background: sc.bg,
                          borderRadius: 6,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          zIndex: isHov ? 4 : 1,
                          boxShadow: isHov ? `0 4px 14px ${sc.shadow}` : `0 1px 4px ${sc.shadow}`,
                          transition: 'box-shadow 0.15s',
                        }}
                      >
                        {/* Conteúdo principal */}
                        <div style={{ padding: `3px 6px ${showFooter ? FOOTER_H + 2 : 3}px 6px`, boxSizing: 'border-box' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, paddingRight: isHov ? 46 : 0 }}>
                            {appt.customerName}
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
                              {` · ${appt.time.slice(0, 5)}`}
                              {srv  && ` · ${srv.name}`}
                              {prof && ` · ${prof.name}`}
                              {appt.price > 0 && ` · R$${appt.price % 1 === 0 ? appt.price : appt.price.toFixed(2)}`}
                            </span>
                          </div>
                        </div>

                        {/* Footer: sinal de confirmação + lembrete */}
                        {showFooter && (
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: FOOTER_H,
                            background: 'rgba(0,0,0,0.22)',
                            display: 'flex', alignItems: 'center', gap: 4, padding: '0 5px',
                            pointerEvents: reminderFailed ? 'auto' : 'none',
                          }}>
                            {/* Sinal de confirmação WhatsApp */}
                            <span
                              title={confirmSent ? 'Confirmação enviada' : 'Confirmação não enviada'}
                              style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', borderRadius: 3,
                                background: confirmSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                                border: `1px solid ${confirmSent ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}`,
                              }}>
                              <MessageSquare size={8} color={confirmSent ? '#fff' : 'rgba(255,255,255,0.35)'} />
                              {confirmSent
                                ? <Check size={7} color="#fff" strokeWidth={3} />
                                : <X    size={7} color="rgba(255,255,255,0.35)" strokeWidth={3} />
                              }
                            </span>

                            {/* Sinal de lembrete */}
                            {reminderSent ? (
                              <span title="Lembrete enviado"
                                style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', borderRadius: 3,
                                  background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
                                }}>
                                <Bell size={8} color="#fff" />
                                <Check size={7} color="#fff" strokeWidth={3} />
                              </span>
                            ) : reminderFailed ? (
                              <button
                                onClick={e => { e.stopPropagation(); if (!isResending) handleResend(appt.id); }}
                                disabled={isResending}
                                title="Lembrete não enviado — clique para reenviar"
                                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 5px', borderRadius: 3,
                                  background: 'rgba(251,191,36,0.28)', border: '1px solid rgba(251,191,36,0.55)',
                                  cursor: isResending ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif',
                                }}>
                                {isResending
                                  ? <RefreshCw size={8} color="#fcd34d" style={{ animation: 'spin 1s linear infinite' }} />
                                  : <BellOff   size={8} color="#fcd34d" />
                                }
                                <span style={{ fontSize: 8, color: '#fcd34d', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {isResending ? 'Enviando…' : 'Reenviar'}
                                </span>
                              </button>
                            ) : (
                              <span title="Lembrete será enviado automaticamente"
                                style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '1px 4px', borderRadius: 3,
                                  background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)',
                                }}>
                                <Bell size={8} color="rgba(255,255,255,0.38)" />
                                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>auto</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Ações no hover — canto superior direito */}
                        {isHov && appt.status !== 'attended' && appt.status !== 'cancelled' && (
                          <div
                            style={{ position: 'absolute', top: 3, right: 4, display: 'flex', gap: 3, zIndex: 5 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => onCompleteAppointment(appt)}
                              title="Concluir"
                              style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.45)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <Check size={9} />
                            </button>
                            <button
                              onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }}
                              title="Cancelar"
                              style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <X size={9} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>

    {/* ── Overlay fecha ao clicar fora ── */}
    {(newSlot || apptPanel) && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={closeAll} />
    )}

    {/* ── Card de novo agendamento ── */}
    {newSlot && (
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: newSlot.py, left: newSlot.px, width: 280, zIndex: 1001, background: '#fff', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.22)', overflow: 'hidden', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ background: '#031D3C', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '1px' }}>Novo agendamento</p>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {DAYS_PT[new Date(newSlot.date + 'T12:00:00').getDay()]}, {newSlot.date.slice(8)}/{newSlot.date.slice(5,7)} · {newSlot.time}
            </p>
          </div>
          <button onClick={closeAll} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 2 }}><X size={14} /></button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Cliente */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Cliente</label>
            {!slotNewCustMode ? (
              <>
                <input value={slotCustQ} onChange={e => { setSlotCustQ(e.target.value); setSlotCustId(''); }}
                  placeholder="Buscar cliente…"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const, color: '#0f172a' }} />
                {slotCustQ && !slotCustId && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 7, marginTop: 2, overflow: 'hidden' }}>
                    {filtCusts.map(c => (
                      <div key={c.id} onClick={() => { setSlotCustId(c.id); setSlotCustQ(c.name); }}
                        style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        {c.phone && <span style={{ color: '#94a3b8', marginLeft: 6 }}>{c.phone}</span>}
                      </div>
                    ))}
                    <div onClick={() => { setSlotNewCustMode(true); setSlotNewCustName(slotCustQ); setSlotNewCustPhone(''); }}
                      style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, background: '#f8faff' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#f8faff')}>
                      + Criar cliente "{slotCustQ}"
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px', background: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>Novo cliente</p>
                <input value={slotNewCustName} onChange={e => setSlotNewCustName(e.target.value)}
                  placeholder="Nome *"
                  style={{ width: '100%', padding: '6px 9px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const, color: '#0f172a' }} />
                <input value={slotNewCustPhone} onChange={e => setSlotNewCustPhone(e.target.value)}
                  placeholder="Telefone (opcional)"
                  style={{ width: '100%', padding: '6px 9px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const, color: '#0f172a' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setSlotNewCustMode(false); setSlotNewCustName(''); setSlotNewCustPhone(''); }}
                    style={{ flex: 1, padding: '6px', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Voltar</button>
                  <button disabled={!slotNewCustName.trim() || slotCreating}
                    onClick={async () => {
                      if (!slotNewCustName.trim()) return;
                      setSlotCreating(true);
                      try {
                        const created = await onAddCustomer({ tenantId, name: slotNewCustName.trim(), phone: slotNewCustPhone.trim(), email: '' });
                        setSlotCustId(created.id);
                        setSlotCustQ(created.name);
                        setSlotNewCustMode(false);
                      } catch { toast.error('Erro ao criar cliente.'); }
                      finally { setSlotCreating(false); }
                    }}
                    style={{ flex: 2, padding: '6px', background: (!slotNewCustName.trim() || slotCreating) ? '#94a3b8' : '#2563eb', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', cursor: (!slotNewCustName.trim() || slotCreating) ? 'not-allowed' : 'pointer' }}>
                    {slotCreating ? 'Criando…' : 'Criar cliente'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Serviço */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Serviço</label>
            <select value={slotSrvId} onChange={e => setSlotSrvId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' as const }}>
              <option value="">Selecionar…</option>
              {myServices.map(s => <option key={s.id} value={s.id}>{s.name} — R${s.price}</option>)}
            </select>
          </div>
          {/* Profissional */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Profissional</label>
            <select value={slotProfId} onChange={e => setSlotProfId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#0f172a', boxSizing: 'border-box' as const }}>
              <option value="">Qualquer</option>
              {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button onClick={closeAll} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSlotSubmit} disabled={!slotCustId || !slotSrvId || slotSaving}
              style={{ flex: 2, padding: '8px', background: (!slotCustId || !slotSrvId || slotSaving) ? '#94a3b8' : '#031D3C', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: (!slotCustId || !slotSrvId || slotSaving) ? 'not-allowed' : 'pointer' }}>
              {slotSaving ? 'Agendando…' : 'Agendar →'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Painel de detalhes do agendamento ── */}
    {apptPanel && (() => {
      const srv  = myServices.find(s => s.id === apptPanel.serviceId);
      const prof = myProfessionals.find(p => p.id === apptPanel.professionalId);
      const sc   = STATUS_COLOR[apptPanel.status] ?? STATUS_COLOR.pending;
      const statusLabel: Record<string, string> = { confirmed: 'Confirmado', pending: 'Pendente', attended: 'Concluído', cancelled: 'Cancelado' };
      return (
        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: panelPy, left: panelPx, width: 280, zIndex: 1001, background: '#fff', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.22)', overflow: 'hidden', fontFamily: 'Outfit, sans-serif' }}>
          {/* Header */}
          <div style={{ background: '#031D3C', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.text, marginBottom: 4 }}>{statusLabel[apptPanel.status] ?? apptPanel.status}</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{apptPanel.customerName}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                {DAYS_PT[new Date(apptPanel.date + 'T12:00:00').getDay()]}, {apptPanel.date.slice(8)}/{apptPanel.date.slice(5,7)} · {apptPanel.time.slice(0,5)}
                {srv && ` · ${srv.durationMinutes}min`}
                {apptPanel.price > 0 && ` · R$${apptPanel.price}`}
              </p>
              {srv  && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{srv.name}{prof ? ` · ${prof.name}` : ''}</p>}
            </div>
            <button onClick={closeAll} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2, flexShrink: 0 }}><X size={14} /></button>
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!reschedMode ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button onClick={() => setReschedMode(true)}
                    style={{ padding: '9px 6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    📅 Reagendar
                  </button>
                  <button onClick={async () => { await handleResend(apptPanel.id); }}
                    style={{ padding: '9px 6px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    💬 Lembrete
                  </button>
                </div>
                {apptPanel.status !== 'attended' && apptPanel.status !== 'cancelled' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button onClick={() => { onCompleteAppointment(apptPanel); closeAll(); }}
                      style={{ padding: '9px 6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      ✓ Concluir
                    </button>
                    <button onClick={() => { onUpdateAppointmentStatus(apptPanel.id, 'cancelled'); closeAll(); }}
                      style={{ padding: '9px 6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      ✗ Cancelar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Reagendar para</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Data</label>
                    <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Hora</label>
                    <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setReschedMode(false)} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>Voltar</button>
                  <button onClick={handleReschedule} disabled={rescheduling}
                    style={{ flex: 2, padding: '8px', background: rescheduling ? '#94a3b8' : '#031D3C', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: rescheduling ? 'not-allowed' : 'pointer' }}>
                    {rescheduling ? 'Salvando…' : 'Confirmar →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    })()}
    </>
  );
}
