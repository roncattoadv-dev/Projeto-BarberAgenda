import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, MessageSquare, Clock } from 'lucide-react';
import { Appointment, Service, Professional, Customer } from '../../types';

interface Props {
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
  myCustomers: Customer[];
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onAddAppointment: (a: Omit<Appointment, 'id'>) => void;
  onCompleteAppointment: (appt: Appointment) => void;
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
const HOUR_HEIGHT = 72;
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

export default function AgendaTab({ myAppointments, myServices, myProfessionals, onUpdateAppointmentStatus, onCompleteAppointment }: Props) {
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: 'Outfit, sans-serif' }}>

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
        style={{ flex: 1, overflowY: 'auto', borderRadius: 12, border: `1px solid ${C.border}`, background: C.gridBg, position: 'relative' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.headerBg, zIndex: 2 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)` }}>

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
                <div key={dateKey} style={{ position: 'relative', height: totalH, borderLeft: `1px solid ${C.borderLight}`, background: C.cellBg }}>

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

                    const sc      = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
                    const srv     = myServices.find(s => s.id === appt.serviceId);
                    const prof    = myProfessionals.find(p => p.id === appt.professionalId);
                    const isHov   = hoveredAppt === appt.id;

                    return (
                      <div
                        key={appt.id}
                        onMouseEnter={() => setHoveredAppt(appt.id)}
                        onMouseLeave={() => setHoveredAppt(null)}
                        style={{
                          position: 'absolute', top, height, left, width,
                          background: sc.bg,
                          borderRadius: 6,
                          borderLeft: `3px solid ${sc.dot}`,
                          padding: '3px 6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          zIndex: isHov ? 4 : 1,
                          boxShadow: isHov ? '0 3px 10px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.07)',
                          transition: 'box-shadow 0.15s',
                        }}
                      >
                        {/* Nome sempre visível */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                          {appt.customerName}
                        </div>
                        {/* Hora + serviço (só se tiver espaço) */}
                        {height >= 36 && (
                          <div style={{ fontSize: 10, color: C.textSm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                            {appt.time.slice(0, 5)}{srv ? ` · ${srv.name}` : ''}
                          </div>
                        )}
                        {/* Profissional */}
                        {height >= 54 && prof && (
                          <div style={{ fontSize: 9, color: C.textSm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, marginTop: 1 }}>
                            {prof.name}
                          </div>
                        )}
                        {/* Indicadores de mensagens — canto superior direito, sempre visíveis */}
                        {(appt.wppConfirmSent || appt.wppReminderSent) && (
                          <div style={{ position: 'absolute', top: 3, right: 4, display: 'flex', gap: 3, alignItems: 'center', zIndex: 2, pointerEvents: 'none' }}>
                            {appt.wppConfirmSent  && (
                              <span title="Confirmação enviada" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: 3, background: '#dcfce7', border: '1px solid #86efac' }}>
                                <MessageSquare size={8} color="#16a34a" />
                              </span>
                            )}
                            {appt.wppReminderSent && (
                              <span title="Lembrete enviado" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: 3, background: '#fef9c3', border: '1px solid #fde68a' }}>
                                <Clock size={8} color="#b45309" />
                              </span>
                            )}
                          </div>
                        )}
                        {/* Ações no hover — sobrepostas no canto inferior direito */}
                        {isHov && appt.status !== 'attended' && appt.status !== 'cancelled' && (
                          <div
                            style={{ position: 'absolute', bottom: 3, right: 3, display: 'flex', gap: 3, zIndex: 5 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => onCompleteAppointment(appt)}
                              title="Concluir"
                              style={{ width: 22, height: 22, borderRadius: 4, background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <Check size={10} />
                            </button>
                            <button
                              onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }}
                              title="Cancelar"
                              style={{ width: 22, height: 22, borderRadius: 4, background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >
                              <X size={10} />
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
  );
}
