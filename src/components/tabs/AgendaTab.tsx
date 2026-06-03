import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Check, X, RefreshCw, MessageSquare, Clock } from 'lucide-react';
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

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  confirmed:  { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  text: '#86efac', dot: '#22c55e' },
  pending:    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fcd34d', dot: '#f59e0b' },
  cancelled:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  text: '#fca5a5', dot: '#ef4444' },
  attended:   { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: '#93c5fd', dot: '#3b82f6' },
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmado', pending: 'Pendente', cancelled: 'Cancelado', attended: 'Concluído',
};

const HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);
const HOUR_HEIGHT = 72;  // minHeight de cada linha — deve bater com o grid
const FIRST_HOUR  = 8;
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  return r;
}
function monthGrid(d: Date): Date[] {
  const year = d.getFullYear(), month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Começa na segunda-feira da semana do primeiro dia
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const start = addDays(firstDay, -startOffset);
  // Termina no domingo da semana do último dia
  const endOffset = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();
  const total = startOffset + lastDay.getDate() + endOffset;
  return Array.from({ length: total }, (_, i) => addDays(start, i));
}

export default function AgendaTab({ myAppointments, myServices, myProfessionals, myCustomers, onUpdateAppointmentStatus, onAddAppointment, onCompleteAppointment, tenantId }: Props) {
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('bf_agenda_view');
    return (saved === 'day' || saved === 'week' || saved === 'month') ? saved : 'day';
  });
  const [baseDate, setBaseDate] = useState(new Date());
  const [hoveredAppt, setHoveredAppt] = useState<string | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = formatDateKey(new Date());

  // Atualiza o horário a cada minuto para mover a barra
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll para o horário atual ao mudar de view ou carregar
  useEffect(() => {
    if (view === 'month') return;
    const h = now.getHours(), m = now.getMinutes();
    if (h < FIRST_HOUR || h >= FIRST_HOUR + HOURS.length) return;
    const offset = ((h - FIRST_HOUR) + m / 60) * HOUR_HEIGHT;
    scrollRef.current?.scrollTo({ top: Math.max(0, offset - 120), behavior: 'smooth' });
  }, [view]);

  // Posição da barra vermelha (null = fora do range visível)
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
    if (view === 'week') {
      const start = startOfWeek(baseDate);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [baseDate];
  }, [view, baseDate]);

  const monthDays = useMemo(() => view === 'month' ? monthGrid(baseDate) : [], [view, baseDate]);

  // Hoje está visível na view atual?
  const isTodayVisible = view === 'day'
    ? formatDateKey(baseDate) === today
    : weekDays.some(d => formatDateKey(d) === today);

  // Índice da coluna de hoje na view semana (0-6), -1 se hoje não está visível
  const todayColIndex = view === 'week'
    ? weekDays.findIndex(d => formatDateKey(d) === today)
    : -1;

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    myAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [myAppointments]);

  const apptsByDateHour = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    myAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
      const hour = a.time.substring(0, 2) + ':00';
      const key = `${a.date}__${hour}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [myAppointments]);

  const headerLabel = view === 'day'
    ? `${baseDate.getDate()} de ${MONTHS_PT[baseDate.getMonth()]} de ${baseDate.getFullYear()}`
    : view === 'week'
    ? `${weekDays[0].getDate()} ${MONTHS_PT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS_PT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
    : `${MONTHS_PT[baseDate.getMonth()]} ${baseDate.getFullYear()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setBaseDate(new Date()); }}
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            Hoje
          </button>
          <button onClick={() => navigate(-1)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => navigate(1)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={14} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginLeft: 4 }}>{headerLabel}</span>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']] as [ViewMode, string][]).map(([v, label]) => (
            <button key={v} onClick={() => { setView(v); localStorage.setItem('bf_agenda_view', v); }}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, background: view === v ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 150ms' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <motion.div
        ref={scrollRef}
        key={view + formatDateKey(baseDate)}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ flex: 1, overflowY: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', position: 'relative' }}
        className="no-scrollbar"
      >
        {/* ── Month grid ── */}
        {view === 'month' && (() => {
          const currentMonth = baseDate.getMonth();
          const weeks: Date[][] = [];
          for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));
          return (
            <>
              {/* Day-of-week header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: '#021340', zIndex: 2 }}>
                {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.35)' }}>{d}</div>
                ))}
              </div>
              {/* Weeks */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {week.map(d => {
                    const key = formatDateKey(d);
                    const isToday = key === today;
                    const isCurrentMonth = d.getMonth() === currentMonth;
                    const dayAppts = apptsByDate[key] ?? [];
                    return (
                      <div key={key} style={{ minHeight: 90, padding: '6px 8px', borderLeft: '1px solid rgba(255,255,255,0.04)', opacity: isCurrentMonth ? 1 : 0.3 }}>
                        {/* Day number */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: isToday ? '#ffffff' : 'transparent', color: isToday ? '#021340' : 'rgba(255,255,255,0.65)', fontWeight: isToday ? 800 : 600, fontSize: 12, marginBottom: 4 }}>
                          {d.getDate()}
                        </div>
                        {/* Appointments (max 3 + overflow) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {dayAppts.slice(0, 3).map(appt => {
                            const sc = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
                            return (
                              <div key={appt.id} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {appt.time.substring(0,5)} {appt.customerName}
                                </span>
                                {appt.wppConfirmSent && <MessageSquare size={7} color="#86efac" title="Confirmação enviada" style={{ flexShrink: 0 }} />}
                                {appt.wppReminderSent && <Clock size={7} color="#fcd34d" title="Lembrete enviado" style={{ flexShrink: 0 }} />}
                              </div>
                            );
                          })}
                          {dayAppts.length > 3 && (
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', fontWeight: 700, paddingLeft: 4 }}>+{dayAppts.length - 3} mais</div>
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

        {/* Day headers (week view) */}
        {view === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: '#021340', zIndex: 2 }}>
            <div />
            {weekDays.map(d => {
              const key = formatDateKey(d);
              const isToday = key === today;
              const count = myAppointments.filter(a => a.date === key && a.status !== 'cancelled').length;
              return (
                <div key={key} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{DAYS_PT[d.getDay()]}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: isToday ? '#ffffff' : 'transparent', color: isToday ? '#021340' : 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: 14 }}>{d.getDate()}</div>
                  {count > 0 && <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, marginTop: 2 }}>{count}</div>}
                </div>
              );
            })}
          </div>
        )}


        {/* Time rows (dia e semana) */}
        {view !== 'month' && HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)`, minHeight: 72, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Hour label */}
            <div style={{ padding: '8px 10px 0', fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{hour}</div>
            {/* Day columns */}
            {weekDays.map(d => {
              const dateKey = formatDateKey(d);
              const cellAppts = apptsByDateHour[`${dateKey}__${hour}`] ?? [];
              // Indicador de hora atual: dentro da célula do dia atual, na hora correta
              const isCurrentHourCell = isTodayVisible
                && dateKey === today
                && timeLineTop !== null
                && now.getHours() === parseInt(hour);
              const minutePct = `${(now.getMinutes() / 60) * 100}%`;
              return (
                <div key={dateKey} style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
                  {/* ── Barra vermelha da hora atual ── */}
                  {isCurrentHourCell && (
                    <div style={{ position: 'absolute', top: minutePct, left: -1, right: 0, zIndex: 10, pointerEvents: 'none', display: 'flex', alignItems: 'center', transform: 'translateY(-50%)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginLeft: -5 }} />
                      <div style={{ flex: 1, height: 2, background: '#ef4444' }} />
                    </div>
                  )}
                  {cellAppts.map(appt => {
                    const srv  = myServices.find(s => s.id === appt.serviceId);
                    const prof = myProfessionals.find(p => p.id === appt.professionalId);
                    const sc   = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
                    const isHovered = hoveredAppt === appt.id;
                    const isExpanded = expandedAppt === appt.id;
                    return (
                      <motion.div
                        key={appt.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -1 }}
                        transition={{ duration: 0.15 }}
                        onHoverStart={() => setHoveredAppt(appt.id)}
                        onHoverEnd={() => setHoveredAppt(null)}
                        onClick={() => setExpandedAppt(isExpanded ? null : appt.id)}
                        style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', position: 'relative' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.customerName}</span>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: sc.text, marginLeft: 'auto', flexShrink: 0 }}>{appt.time}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srv?.name} · {prof?.name}</div>

                        {/* Indicadores de mensagens automáticas */}
                        {(appt.wppConfirmSent || appt.wppReminderSent) && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {appt.wppConfirmSent && (
                              <span title="Confirmação enviada" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', fontSize: 9, fontWeight: 700 }}>
                                <MessageSquare size={8} /> Confirmação
                              </span>
                            )}
                            {appt.wppReminderSent && (
                              <span title="Lembrete enviado" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d', fontSize: 9, fontWeight: 700 }}>
                                <Clock size={8} /> Lembrete
                              </span>
                            )}
                          </div>
                        )}

                        {/* Hover actions */}
                        <AnimatePresence>
                          {(isHovered || isExpanded) && appt.status !== 'attended' && appt.status !== 'cancelled' && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.12 }}
                              style={{ display: 'flex', gap: 4, marginTop: 6 }}
                              onClick={e => e.stopPropagation()}
                            >
                              <button onClick={() => onCompleteAppointment(appt)}
                                style={{ flex: 1, padding: '4px 0', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: '#86efac', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: 'Outfit, sans-serif' }}>
                                <Check size={10} /> Concluir
                              </button>
                              <button onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }}
                                style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#fca5a5', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
                                <X size={10} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
