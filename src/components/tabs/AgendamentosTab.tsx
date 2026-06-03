import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Search } from 'lucide-react';
import { Appointment, Service, Professional } from '../../types';

interface Props {
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onCompleteAppointment: (appt: Appointment) => void;
}

type Filter = 'todos' | 'confirmados' | 'pendentes' | 'cancelados' | 'historico';

const FILTER_LABELS: Record<Filter, string> = {
  todos: 'Todos', confirmados: 'Confirmados', pendentes: 'Pendentes', cancelados: 'Cancelados', historico: 'Histórico',
};

const STATUS_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  confirmed: { label: 'Confirmado', dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)',  text: '#86efac' },
  pending:   { label: 'Pendente',   dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d' },
  cancelled: { label: 'Cancelado',  dot: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',   text: '#fca5a5' },
  attended:  { label: 'Concluído',  dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)', text: '#93c5fd' },
};

export default function AgendamentosTab({ myAppointments, myServices, myProfessionals, onUpdateAppointmentStatus, onCompleteAppointment }: Props) {
  const [filter, setFilter] = useState<Filter>('todos');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = [...myAppointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    if (filter === 'confirmados') list = list.filter(a => a.status === 'confirmed');
    else if (filter === 'pendentes')   list = list.filter(a => a.status === 'pending');
    else if (filter === 'cancelados')  list = list.filter(a => a.status === 'cancelled');
    else if (filter === 'historico')   list = list.filter(a => a.status === 'attended');
    else list = list.filter(a => a.status !== 'cancelled');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.customerName.toLowerCase().includes(q) || a.customerPhone.includes(q));
    }
    return list;
  }, [myAppointments, filter, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* Search */}
      <div style={{ position: 'relative' }}>
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
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0, overflowX: 'auto' }} className="no-scrollbar">
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
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>R$ {appt.price.toFixed(2)}</span>
                  <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sm.bg, color: sm.text, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                  {appt.status !== 'attended' && appt.status !== 'cancelled' && (
                    <>
                      <button onClick={() => onCompleteAppointment(appt)}
                        title="Concluir" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} />
                      </button>
                      <button onClick={() => { if (window.confirm(`Cancelar ${appt.customerName}?`)) onUpdateAppointmentStatus(appt.id, 'cancelled'); }}
                        title="Cancelar" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    </div>
  );
}
