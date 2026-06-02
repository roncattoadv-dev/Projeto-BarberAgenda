// src/pages/booking/CancelPage.tsx
// Rota pública: /:slug/cancelar/:appointmentId
// Permite ao cliente visualizar e cancelar seu agendamento sem login.

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ApptInfo {
  id: string;
  customerName: string;
  date: string;
  time: string;
  serviceName: string;
  professionalName: string;
  tenantName: string;
  status: string;
}

const DAYS_PT   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_PT[dow]}, ${d} de ${MONTHS_PT[m - 1]} de ${y}`;
}

export default function CancelPage() {
  const { slug, appointmentId } = useParams<{ slug: string; appointmentId: string }>();

  const [appt,      setAppt]      = useState<ApptInfo | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!slug || !appointmentId) { setNotFound(true); setLoading(false); return; }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, customer_name, scheduled_date, scheduled_time, status, services(name), professionals(name), tenants(name, slug)')
          .eq('id', appointmentId)
          .maybeSingle();

        if (error || !data) { setNotFound(true); setLoading(false); return; }

        // Verifica se o agendamento pertence ao slug correto
        if ((data.tenants as any)?.slug !== slug) { setNotFound(true); setLoading(false); return; }

        setAppt({
          id:               data.id,
          customerName:     data.customer_name,
          date:             data.scheduled_date,
          time:             data.scheduled_time?.slice(0, 5) ?? '',
          serviceName:      (data.services as any)?.name ?? '',
          professionalName: (data.professionals as any)?.name ?? '',
          tenantName:       (data.tenants as any)?.name ?? '',
          status:           data.status,
        });

        if (data.status === 'cancelled') setCancelled(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, appointmentId]);

  const handleCancel = async () => {
    if (!appt || !window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    setCancelling(true);
    setError('');
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id)
        .eq('status', 'pending'); // só cancela se ainda estiver pendente

      if (error) throw error;
      setCancelled(true);
    } catch {
      setError('Não foi possível cancelar. O agendamento pode já ter sido confirmado. Entre em contato com a barbearia.');
    } finally {
      setCancelling(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#031D3C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !appt) return (
    <div style={{ minHeight: '100vh', background: '#031D3C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Agendamento não encontrado</p>
        <p style={{ fontSize: 14 }}>O link pode estar desatualizado ou o agendamento não existe.</p>
      </div>
    </div>
  );

  // ── Cancelled ────────────────────────────────────────────────────────────────
  if (cancelled) return (
    <div style={{ minHeight: '100vh', background: '#031D3C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 56, marginBottom: 16 }}>✅</p>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>Agendamento cancelado</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Seu agendamento foi cancelado com sucesso.</p>
      </div>
    </div>
  );

  // ── Main ─────────────────────────────────────────────────────────────────────
  const alreadyCancelled = appt.status === 'cancelled';
  const alreadyAttended  = appt.status === 'attended' || appt.status === 'completed';

  return (
    <div style={{ minHeight: '100vh', background: '#031D3C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Outfit, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✂️</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{appt.tenantName}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>Gerenciar agendamento</p>
        </div>

        {/* Card do agendamento */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, marginBottom: 24 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
            <div>
              <p style={{ fontWeight: 700, color: '#fff', fontSize: 16, margin: 0 }}>{appt.customerName}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, marginTop: 2 }}>Cliente</p>
            </div>
          </div>

          {[
            { icon: '📅', label: 'Data',         value: formatDate(appt.date) },
            { icon: '⏰', label: 'Horário',       value: appt.time },
            { icon: '✂️', label: 'Serviço',       value: appt.serviceName },
            { icon: '👤', label: 'Profissional',  value: appt.professionalName },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{row.icon}</span>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{row.label}</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', margin: 0, fontWeight: 500 }}>{row.value}</p>
              </div>
            </div>
          ))}

          {/* Status badge */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              background: alreadyCancelled ? 'rgba(239,68,68,0.12)' : alreadyAttended ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
              color:      alreadyCancelled ? '#fca5a5' : alreadyAttended ? '#4ade80' : '#fbbf24',
              border:     `1px solid ${alreadyCancelled ? 'rgba(239,68,68,0.3)' : alreadyAttended ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
            }}>
              {alreadyCancelled ? 'Cancelado' : alreadyAttended ? 'Realizado' : 'Agendado'}
            </span>
          </div>
        </div>

        {/* Ação */}
        {!alreadyCancelled && !alreadyAttended && (
          <>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button
              onClick={handleCancel}
              disabled={cancelling}
              style={{ width: '100%', padding: '15px', background: 'rgba(239,68,68,0.85)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14, cursor: cancelling ? 'wait' : 'pointer', opacity: cancelling ? 0.7 : 1, fontFamily: 'Outfit, sans-serif', transition: 'opacity 0.15s' }}
            >
              {cancelling ? 'Cancelando…' : '🗑️ Cancelar Agendamento'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
              Apenas agendamentos pendentes podem ser cancelados por aqui.
            </p>
          </>
        )}

        {alreadyAttended && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Este agendamento já foi realizado e não pode ser cancelado.</p>
        )}
      </div>
    </div>
  );
}
