// src/pages/booking/CancelPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

interface ApptInfo {
  id: string;
  customerName: string;
  date: string;
  time: string;
  durationMinutes: number;
  serviceName: string;
  professionalName: string;
  tenantName: string;
  tenantLogo: string;
  tenantAddress: string;
  primaryColor: string;
  mapsUrl: string;
  status: string;
}

const DAYS_PT   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${DAYS_PT[dow]}, ${d} de ${MONTHS_PT[m - 1]}`;
}

// Mesma função da BookingPage
function deriveBg(pc: string): string {
  const r = parseInt(pc.slice(1, 3), 16);
  const g = parseInt(pc.slice(3, 5), 16);
  const b = parseInt(pc.slice(5, 7), 16);
  const mix = (ch: number, n: number) => Math.round(n + (ch - n) * 0.18);
  return `rgb(${mix(r, 110)},${mix(g, 116)},${mix(b, 98)})`;
}

function bookingCode(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

const LOGO_WA = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2023%20de%20jun.%20de%202026,%2014_55_26%20(1).png';

export default function CancelPage() {
  const { slug, appointmentId } = useParams<{ slug: string; appointmentId: string }>();
  const navigate = useNavigate();

  const [appt,       setAppt]       = useState<ApptInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled,  setCancelled]  = useState(false);
  const [error,      setError]      = useState('');

  // Cor cacheada para o loading screen
  const cachedPc  = (() => { try { return (slug && localStorage.getItem(`bfpc_${slug}`)) || ''; } catch { return ''; } })();
  const loadingBg = deriveBg(cachedPc || '#6b8096');

  useEffect(() => {
    if (!slug || !appointmentId) { setNotFound(true); setLoading(false); return; }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id, customer_name, scheduled_date, scheduled_time, status,
            duration_minutes,
            services(name),
            professionals(name),
            tenants(name, slug, logo, address, booking_page_config)
          `)
          .eq('id', appointmentId)
          .maybeSingle();

        if (error || !data) { setNotFound(true); setLoading(false); return; }

        const tenant = data.tenants as any;
        if (tenant?.slug !== slug) { setNotFound(true); setLoading(false); return; }

        const pc = tenant?.booking_page_config?.primaryColor ?? '#2563EB';
        try { localStorage.setItem(`bfpc_${slug}`, pc); } catch {}

        setAppt({
          id:               data.id,
          customerName:     data.customer_name,
          date:             data.scheduled_date,
          time:             data.scheduled_time?.slice(0, 5) ?? '',
          durationMinutes:  data.duration_minutes ?? 0,
          serviceName:      (data.services as any)?.name ?? '',
          professionalName: (data.professionals as any)?.name ?? '',
          tenantName:       tenant?.name ?? '',
          tenantLogo:       tenant?.logo ?? '',
          tenantAddress:    tenant?.address ?? '',
          primaryColor:     pc,
          mapsUrl:          tenant?.booking_page_config?.mapsUrl ?? '',
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
      const res  = await fetch(`${getApiUrl()}/api/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, appointmentId: appt.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao cancelar.');
      setCancelled(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível cancelar. Entre em contato com a barbearia.');
    } finally {
      setCancelling(false);
    }
  };

  // ── Loading — igual ao BookingPage ───────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: loadingBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 48, height: 48 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'rgba(255,255,255,0.8)', animation: 'spin 0.85s linear infinite' }} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px' }}>Carregando…</p>
      </div>
    </div>
  );

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !appt) return (
    <div style={{ minHeight: '100vh', backgroundColor: loadingBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 8 }}>Agendamento não encontrado</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>O link pode estar desatualizado ou o agendamento não existe.</p>
      </div>
    </div>
  );

  const pc        = appt.primaryColor;
  const tintBg    = deriveBg(pc);
  const pcBorder  = pc + '44';

  const alreadyCancelled = appt.status === 'cancelled' || cancelled;
  const alreadyAttended  = appt.status === 'attended' || appt.status === 'completed';

  const statusLabel  = alreadyCancelled ? 'Cancelado' : alreadyAttended ? 'Realizado' : 'Confirmado';
  const statusColor  = alreadyCancelled ? '#ef4444'  : alreadyAttended ? '#10b981'  : '#059669';
  const statusBg     = alreadyCancelled ? '#fef2f2'  : alreadyAttended ? '#f0fdf4'  : '#ecfdf5';
  const statusBorder = alreadyCancelled ? '#fecaca'  : alreadyAttended ? '#a7f3d0'  : '#a7f3d0';

  const rows = [
    ['Quando',       `${formatDate(appt.date)} às ${appt.time}`],
    ['Serviço',      appt.serviceName],
    ['Duração',      `${appt.durationMinutes} min`],
    ['Profissional', appt.professionalName],
    ['Status',       statusLabel],
    ['Código',       bookingCode(appt.id)],
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tintBg, fontFamily: 'Outfit, sans-serif', padding: '32px 16px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* ── Card ──────────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

          {/* Header do tenant — igual ao booking */}
          <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12, backgroundColor: tintBg }}>
            {(appt.tenantLogo?.startsWith('http') || appt.tenantLogo?.startsWith('data:'))
              ? <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={appt.tenantLogo} alt={appt.tenantName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              : <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✂</div>
            }
            <div>
              <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.3, margin: 0 }}>{appt.tenantName}</p>
              {appt.tenantAddress && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>{appt.tenantAddress}</p>}
            </div>
          </div>

          {/* Corpo do card */}
          <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Ícone de status */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, marginBottom: 16 }}>
              {alreadyCancelled ? '✕' : '✓'}
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
              {alreadyCancelled ? 'Agendamento cancelado' : 'Detalhes do agendamento'}
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>{appt.customerName}</p>

            {/* Linhas de info */}
            <div style={{ width: '100%', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: '4px 20px', textAlign: 'left', marginBottom: 24 }}>
              {rows.map(([label, value], i) => (
                <div key={label} style={{ paddingTop: 12, paddingBottom: 12, borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 2, display: 'block', marginBottom: 2 }}>{label}</span>
                  <strong style={{ fontSize: 13, fontWeight: 600, color: label === 'Status' ? statusColor : '#0f172a' }}>{value}</strong>
                </div>
              ))}
            </div>

            {/* Ações */}
            {/* Status messages */}
            {alreadyAttended && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Este agendamento já foi realizado.</p>
            )}
            {alreadyCancelled && (
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Seu agendamento foi cancelado com sucesso.</p>
            )}

            {/* Erro */}
            {error && (
              <div style={{ width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#dc2626', fontSize: 13, marginBottom: 16, textAlign: 'left' }}>
                {error}
              </div>
            )}

            {/* Botão primário: Novo agendamento */}
            <button onClick={() => navigate(`/${slug}/agendamento`)}
              style={{ width: '100%', padding: '13px', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              + Fazer novo agendamento
            </button>

            {/* Botão secundário: Como chegar */}
            {appt.mapsUrl && (
              <a href={appt.mapsUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px', background: '#fff', border: `1.5px solid ${pcBorder}`, borderRadius: 12, color: pc, fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' as const }}>
                📍 Como chegar
              </a>
            )}

            {/* Botão perigo: Cancelar (só quando ativo) */}
            {!alreadyCancelled && !alreadyAttended && (
              <button onClick={handleCancel} disabled={cancelling}
                style={{ width: '100%', padding: '11px', background: '#FEF2F2', color: '#EF4444', fontWeight: 600, fontSize: 13, border: '1.5px solid #FECACA', borderRadius: 12, cursor: cancelling ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: cancelling ? 0.6 : 1 }}>
                {cancelling ? '⏳ Cancelando…' : '✕ Cancelar agendamento'}
              </button>
            )}
          </div>
        </div>

        {/* Footer — igual ao BookingPage */}
        <div style={{ textAlign: 'center', padding: '24px 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' }}>Powered by WorkAgenda</span>
          <img src={LOGO_WA} alt="WorkAgenda" style={{ height: 28, display: 'inline-block', opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}
