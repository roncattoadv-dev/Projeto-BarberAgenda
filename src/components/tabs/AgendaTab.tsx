import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Check, X, RefreshCw, MessageSquare, Clock, MessageCircle, Bell } from 'lucide-react';
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

type ViewMode = 'day' | 'week';

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

export default function AgendaTab({ myAppointments, myServices, myProfessionals, myCustomers, onUpdateAppointmentStatus, onAddAppointment, onCompleteAppointment, tenantId }: Props) {
  const [view, setView] = useState<ViewMode>('day');
  const [baseDate, setBaseDate] = useState(new Date());
  const [hoveredAppt, setHoveredAppt] = useState<string | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);

  const today = formatDateKey(new Date());

  const navigate = (dir: number) => {
    setBaseDate(d => addDays(d, view === 'day' ? dir : dir * 7));
  };

  const weekDays = useMemo(() => {
    const start = view === 'week' ? startOfWeek(baseDate) : baseDate;
    return view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [baseDate];
  }, [view, baseDate]);

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
    : `${weekDays[0].getDate()} ${MONTHS_PT[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTHS_PT[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;

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
          {(['day', 'week'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, background: view === v ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.38)', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 150ms' }}>
              {v === 'day' ? 'Dia' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <motion.div
        key={view + formatDateKey(baseDate)}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ flex: 1, overflowY: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
        className="no-scrollbar"
      >
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

        {/* Time rows */}
        {HOURS.map(hour => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)`, minHeight: 72, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {/* Hour label */}
            <div style={{ padding: '8px 10px 0', fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{hour}</div>
            {/* Day columns */}
            {weekDays.map(d => {
              const dateKey = formatDateKey(d);
              const cellAppts = apptsByDateHour[`${dateKey}__${hour}`] ?? [];
              return (
                <div key={dateKey} style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
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
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{srv?.name} · {prof?.name}</span>
                          <span title={appt.wppConfirmSent ? 'Confirmação enviada' : 'Confirmação não enviada'} style={{ flexShrink: 0 }}>
                            <MessageCircle size={10} style={{ color: appt.wppConfirmSent ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                          </span>
                          <span title={appt.wppReminderSent ? 'Lembrete enviado' : 'Lembrete não enviado'} style={{ flexShrink: 0 }}>
                            <Bell size={10} style={{ color: appt.wppReminderSent ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                          </span>
                        </div>

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
