// src/pages/admin/TenantAdminPage.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ClientAdminPanel from '../../components/ClientAdminPanel';
import { Scissors, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

const BASE_PRICE = 89.90;
const ACCENT = '#2563EB';
const LOGO_URL = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png';
const FEATURES = [
  'Agendamento online ilimitado',
  'WhatsApp automático (confirmação + lembrete)',
  'Gestão financeira completa',
  'Multi-profissional com comissões automáticas',
  'Página pública personalizada com seu link',
  'Histórico de clientes',
  'Relatórios e métricas',
  'Suporte via chat',
];
const PLAN_META = {
  mensal:     { label: 'Mensal',     months: 1,  discountPct: 0,  hot: false, badge: null as string|null, billing: 'Cobrado mensalmente' },
  trimestral: { label: 'Trimestral', months: 3,  discountPct: 15, hot: true,  badge: '15% OFF',           billing: `R$ ${(BASE_PRICE*0.85*3).toFixed(2).replace('.',',')} / 3 meses` },
  anual:      { label: 'Anual',      months: 12, discountPct: 25, hot: false, badge: 'Melhor valor',      billing: `R$ ${(BASE_PRICE*0.75*12).toFixed(2).replace('.',',')} / ano` },
} as const;
type PlanKey = keyof typeof PLAN_META;

function BlockedScreen({ tenant, signOut, onUnblocked }: { tenant: Tenant; signOut: () => void; onUnblocked: () => void }) {
  // step: 'loading' | 'select-plan' | 'cpf-form' | 'generating' | 'payment' | 'has-link'
  const [step,       setStep]       = useState<'loading' | 'select-plan' | 'cpf-form' | 'generating' | 'payment' | 'has-link'>('loading');
  const [payUrl,     setPayUrl]     = useState('');
  const [pixImage,   setPixImage]   = useState('');
  const [pixCode,    setPixCode]    = useState('');
  const [plan,       setPlan]       = useState<PlanKey>('mensal');
  const [cpfCnpj,    setCpfCnpj]    = useState('');
  const [cpfError,   setCpfError]   = useState('');
  const [genError,   setGenError]   = useState('');
  const [pixCopied,  setPixCopied]  = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const [verifyMsg,  setVerifyMsg]  = useState('');

  const isTrialEnd = tenant.plan === 'trial';

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  // Tenta buscar cobrança existente
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${getApiUrl()}/api/billing/payment-link?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const json = await r.json();
          if (json.url) { setPayUrl(json.url); setPixImage(json.pixImage ?? ''); setPixCode(json.pixCode ?? ''); setStep('has-link'); return; }
        }
      } catch {}
      setStep('select-plan');
    })();
  }, [tenant.id]);

  // Polling: desbloqueia automaticamente quando status virar 'active'
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from('tenants').select('status').eq('id', tenant.id).maybeSingle();
      if (data?.status === 'active') { clearInterval(interval); onUnblocked(); }
    }, 10000);
    return () => clearInterval(interval);
  }, [tenant.id]);

  const handleGenerate = async () => {
    const clean = cpfCnpj.replace(/\D/g, '');
    if (clean.length !== 11 && clean.length !== 14) { setCpfError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.'); return; }
    setCpfError('');
    setGenError('');
    setStep('generating');
    try {
      const token = await getToken();
      const r = await fetch(
        `${getApiUrl()}/api/billing/payment-link?tenantId=${tenant.id}&plan=${plan}&cpfCnpj=${clean}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await r.json();
      if (!r.ok) { setGenError(json.error ?? 'Erro ao gerar cobrança.'); setStep('cpf-form'); return; }
      setPayUrl(json.url ?? ''); setPixImage(json.pixImage ?? ''); setPixCode(json.pixCode ?? '');
      setStep('payment');
    } catch { setGenError('Erro de conexão. Tente novamente.'); setStep('cpf-form'); }
  };

  const handleVerify = async () => {
    setVerifying(true); setVerifyMsg('');
    try {
      const token = await getToken();
      const r = await fetch(`${getApiUrl()}/api/billing/verify-payment?tenantId=${tenant.id}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await r.json();
      if (json.activated) { onUnblocked(); return; }
      setVerifyMsg(json.message ?? 'Pagamento ainda não confirmado.');
    } catch { setVerifyMsg('Erro ao verificar. Tente novamente.'); }
    finally { setVerifying(false); }
  };

  const pm = PLAN_META[plan];
  const monthly = parseFloat((BASE_PRICE * (1 - pm.discountPct / 100)).toFixed(2));
  const total   = parseFloat((monthly * pm.months).toFixed(2));

  const isWide = step === 'loading' || step === 'select-plan';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', fontFamily: 'Outfit, sans-serif', padding: '32px 20px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Logo */}
      <img src={LOGO_URL} alt="WorkAgenda" style={{ height: 210, objectFit: 'contain', marginBottom: 28 }} />

      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: isWide ? 36 : 28 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{isTrialEnd ? '⏰' : '🔒'}</div>
        {isTrialEnd ? (
          <>
            <h2 style={{ color: '#111827', fontSize: 24, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Seu período de teste encerrou</h2>
            <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Escolha um plano para continuar usando o WorkAgenda.<br />
              <span style={{ fontSize: 12 }}>Todos os planos têm as mesmas funcionalidades.</span>
            </p>
          </>
        ) : (
          <>
            <h2 style={{ color: '#111827', fontSize: 24, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Acesso suspenso</h2>
            <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Regularize sua assinatura para reativar o acesso ao painel.
            </p>
          </>
        )}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #BFDBFE', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>Verificando assinatura…</p>
        </div>
      )}

      {/* ── Selecionar plano — cards estilo landing page ─────────────────── */}
      {step === 'select-plan' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20, width: '100%', maxWidth: 920 }}>
          {(Object.entries(PLAN_META) as [PlanKey, typeof PLAN_META[PlanKey]][]).map(([key, p]) => {
            const cardMonthly = parseFloat((BASE_PRICE * (1 - p.discountPct / 100)).toFixed(2));
            return (
              <div key={key} style={{ position: 'relative' as const, background: p.hot ? ACCENT : '#FFFFFF', border: `1px solid ${p.hot ? ACCENT : '#E2E8F0'}`, borderRadius: 28, padding: '36px 28px 24px', display: 'flex', flexDirection: 'column' as const, boxShadow: p.hot ? '0 20px 56px rgba(37,99,235,0.28)' : '0 2px 12px rgba(0,0,0,0.05)', transform: p.hot ? 'scale(1.03)' : 'none', zIndex: p.hot ? 1 : 0 }}>
                {p.badge && (
                  <div style={{ position: 'absolute' as const, top: -14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const }}>
                    <span style={{ background: p.hot ? '#fff' : ACCENT, color: p.hot ? ACCENT : '#fff', fontSize: 11, fontWeight: 800, padding: '5px 16px', borderRadius: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>{p.badge}</span>
                  </div>
                )}
                <p style={{ fontSize: 12, fontWeight: 700, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569', textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '0 0 14px' }}>{p.label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569', fontWeight: 600 }}>R$</span>
                  <span style={{ fontSize: 46, fontWeight: 900, color: p.hot ? '#fff' : '#111111', lineHeight: 1, letterSpacing: '-2px' }}>{cardMonthly.toFixed(2).replace('.', ',')}</span>
                  <span style={{ fontSize: 14, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569' }}>/mês</span>
                </div>
                <p style={{ fontSize: 12, color: p.hot ? 'rgba(255,255,255,0.45)' : '#94a3b8', margin: '0 0 20px' }}>{p.billing}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column' as const, gap: 9, flex: 1 }}>
                  {FEATURES.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: p.hot ? 'rgba(255,255,255,0.85)' : '#475569', lineHeight: 1.5 }}>
                      <span style={{ flexShrink: 0, marginTop: 2, width: 17, height: 17, borderRadius: 99, background: p.hot ? 'rgba(255,255,255,0.2)' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.hot ? '#fff' : '#16a34a' }}>
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => { setPlan(key); setStep('cpf-form'); }}
                  style={{ display: 'block', width: '100%', padding: '14px', fontWeight: 700, fontSize: 14, background: p.hot ? '#fff' : ACCENT, color: p.hot ? ACCENT : '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: p.hot ? '0 4px 16px rgba(0,0,0,0.10)' : '0 4px 16px rgba(37,99,235,0.30)', transition: 'all 0.2s' }}>
                  Assinar agora →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Steps pós-seleção: CPF, gerando, pagamento ─────────────────────── */}
      {!isWide && (
        <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* Formulário CPF */}
          {step === 'cpf-form' && (
            <>
              <button onClick={() => setStep('select-plan')} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Voltar aos planos
              </button>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: ACCENT, textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 2px' }}>Plano {pm.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>R$ {monthly.toFixed(2).replace('.', ',')} /mês</p>
                </div>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>R$ {total.toFixed(2).replace('.', ',')}</p>
              </div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#6B7280', marginBottom: 8 }}>CPF ou CNPJ *</label>
              <input autoFocus type="text" placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={cpfCnpj} onChange={e => { setCpfCnpj(e.target.value); setCpfError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                style={{ width: '100%', padding: '11px 14px', background: '#FFFFFF', border: `1.5px solid ${cpfError ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 10, color: '#111827', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Outfit, sans-serif' }} />
              {cpfError && <p style={{ color: '#EF4444', fontSize: 12, margin: '6px 0 0' }}>{cpfError}</p>}
              <p style={{ color: '#9CA3AF', fontSize: 11, margin: '6px 0 18px' }}>Necessário para emissão da cobrança via Asaas.</p>
              {genError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}><p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{genError}</p></div>}
              <button onClick={handleGenerate}
                style={{ width: '100%', padding: '14px 0', background: ACCENT, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 14px rgba(37,99,235,0.30)' }}>
                Gerar cobrança →
              </button>
            </>
          )}

          {/* Gerando */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #BFDBFE', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              <p style={{ color: '#6B7280', fontSize: 14, margin: 0, fontWeight: 600 }}>Gerando cobrança…</p>
            </div>
          )}

          {/* Pagamento */}
          {(step === 'has-link' || step === 'payment') && (
            <div style={{ textAlign: 'center' }}>
              {pixImage && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 12px' }}>Pagar via PIX</p>
                  <div style={{ display: 'inline-block', padding: 10, border: '1.5px solid #E2E8F0', borderRadius: 14, marginBottom: 12, background: '#FFFFFF' }}>
                    <img src={`data:image/png;base64,${pixImage}`} alt="QR Code PIX" style={{ width: 180, height: 180, display: 'block' }} />
                  </div>
                  {pixCode && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <input readOnly value={pixCode} style={{ flex: 1, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 10, color: '#374151', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} />
                      <button onClick={() => { navigator.clipboard.writeText(pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                        style={{ padding: '8px 14px', background: pixCopied ? '#16a34a' : ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                        {pixCopied ? '✓' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {(payUrl) && (
                <a href={payUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', padding: '13px 0', background: '#16a34a', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', textAlign: 'center' as const, boxShadow: '0 4px 14px rgba(22,163,74,0.30)', marginBottom: 16 }}>
                  Pagar via boleto / outro método
                </a>
              )}
              <button onClick={handleVerify} disabled={verifying}
                style={{ width: '100%', padding: '11px 0', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 10, color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: verifying ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                {verifying ? 'Verificando…' : 'Já paguei — verificar agora'}
              </button>
              {verifyMsg && <p style={{ marginTop: 8, fontSize: 12, color: '#9CA3AF' }}>{verifyMsg}</p>}
            </div>
          )}
        </div>
      )}

      <button onClick={signOut} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 24 }}>
        Sair da conta
      </button>
    </div>
  );
}
import {
  getTenants, getServices, getProfessionals, getProducts,
  getCustomers, getAppointments, getPayments,
  updateTenant, createService, updateService, deleteService,
  createProfessional, updateProfessional, deleteProfessional, setServiceProfessionals, createProduct, updateCustomer, deleteCustomer,
  updateProductStock, createAppointment, updateAppointmentStatus, rescheduleAppointment,
  createPayment, upsertCustomerByPhone, createCustomerDirect, logAudit, notifyAppointmentWhatsApp,
  syncProfessionalsHours, mapAppointment,
  getRecurringExpenses, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense,
  getWaitlistEntries, markWaitlistNotified,
  getSlotHistory, createSlotHistory, updateSlotHistoryFilled,
} from '../../lib/db';
import { sendWhatsAppServer, buildWaitlistMsg } from '../../services/whatsapp';
import type { Tenant, Service, Professional, Product, Customer, Appointment, Payment, RecurringExpense, SlotHistory } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';

export default function TenantAdminPage() {
  const { profile, signOut } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const notifications = useNotifications();
  const notifyRef = useRef(notifications.notify);
  useEffect(() => { notifyRef.current = notifications.notify; }, [notifications.notify]);

  const [tenant,              setTenant]              = useState<Tenant | null>(null);
  const [services,            setServices]            = useState<Service[]>([]);
  const [professionals,       setProfessionals]       = useState<Professional[]>([]);
  const [products,            setProducts]            = useState<Product[]>([]);
  const [customers,           setCustomers]           = useState<Customer[]>([]);
  const [appointments,        setAppointments]        = useState<Appointment[]>([]);
  const [payments,            setPayments]            = useState<Payment[]>([]);
  const [recurringExpenses,   setRecurringExpenses]   = useState<RecurringExpense[]>([]);
  const [waitlistFailedIds,   setWaitlistFailedIds]   = useState<Set<string>>(new Set());
  const [slotHistory,         setSlotHistory]         = useState<SlotHistory[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [openSubscription,    setOpenSubscription]    = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [ts, svcs, profs, prods, custs, appts, pays, recExp, hist] = await Promise.all([
      getTenants(),
      getServices(tenantId),
      getProfessionals(tenantId),
      getProducts(tenantId),
      getCustomers(tenantId),
      getAppointments(tenantId),
      getPayments(tenantId),
      getRecurringExpenses(tenantId),
      getSlotHistory(tenantId),
    ]);
    setTenant(ts.find(t => t.id === tenantId) ?? null);
    setServices(svcs); setProfessionals(profs); setProducts(prods);
    setCustomers(custs); setAppointments(appts); setPayments(pays);
    setRecurringExpenses(recExp); setSlotHistory(hist);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Sincroniza INSERT e UPDATE de appointments via WebSocket + polling de fallback
  useEffect(() => {
    if (!tenantId) return;

    const applyUpdate = (prev: Appointment[], row: Record<string, unknown>) =>
      prev.map(a => a.id !== row.id ? a : {
        ...a,
        ...(row.wpp_confirm_sent  !== undefined && { wppConfirmSent:  row.wpp_confirm_sent  as boolean }),
        ...(row.wpp_reminder_sent !== undefined && { wppReminderSent: row.wpp_reminder_sent as boolean }),
        ...(row.status            !== undefined && { status:           row.status            as Appointment['status'] }),
        ...(row.scheduled_date    !== undefined && { date:             row.scheduled_date    as string }),
        ...(row.scheduled_time    !== undefined && { time:            (row.scheduled_time as string).slice(0, 5) }),
      });

    const channel = supabase
      .channel(`appt-updates-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'barber', table: 'appointments' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.tenant_id !== tenantId) return;
          setAppointments(prev => {
            if (prev.some(a => a.id === row.id)) return prev; // já existe (admin criou via UI)
            return [mapAppointment(row), ...prev];
          });
          const appt = mapAppointment(row);
          notifyRef.current('Novo agendamento! 📅', {
            body: `${appt.customerName} — ${appt.date.split('-').reverse().join('/')} às ${appt.time}`,
            tag: appt.id,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'barber', table: 'appointments' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.tenant_id !== tenantId) return;
          setAppointments(prev => applyUpdate(prev, row));
        }
      )
      .subscribe();

    // Polling de 30s como fallback caso o WebSocket não entregue o evento
    const pollId = setInterval(async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, wpp_confirm_sent, wpp_reminder_sent')
        .eq('tenant_id', tenantId);
      if (!data) return;
      setAppointments(prev =>
        prev.map(a => {
          const r = (data as any[]).find(d => d.id === a.id);
          if (!r) return a;
          if (r.wpp_confirm_sent === a.wppConfirmSent && r.wpp_reminder_sent === a.wppReminderSent) return a;
          return { ...a, wppConfirmSent: r.wpp_confirm_sent, wppReminderSent: r.wpp_reminder_sent };
        })
      );
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [tenantId]);

  if (!tenant && !loading) return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0F172A', color: 'rgba(255,255,255,0.38)', fontFamily: 'Outfit, sans-serif' }}
    >
      Tenant não encontrado. Contate o administrador.
    </div>
  );

  if (tenant?.status === 'blocked') return (
    <BlockedScreen tenant={tenant} signOut={signOut} onUnblocked={load} />
  );

  const isTenantTrial = tenant?.plan === 'trial';
  const daysUntilExpiry = (() => {
    const dateStr = isTenantTrial ? tenant?.trialEndsAt : tenant?.subscriptionEndsAt;
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    return diff >= 0 && diff <= 10 ? diff : null;
  })();

  const handleExpiryClick = () => setOpenSubscription(true);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
      {/* Barra de aviso de vencimento */}
      {daysUntilExpiry !== null && (
        <div style={{ width: '100%', background: '#1d4ed8', padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'Outfit, sans-serif', flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e0eaff' }}>
            {isTenantTrial
              ? daysUntilExpiry === 0
                ? 'Seu período de teste encerra hoje!'
                : `Seu período de teste encerra em ${daysUntilExpiry} dia${daysUntilExpiry! > 1 ? 's' : ''}.`
              : daysUntilExpiry === 0
                ? 'Sua assinatura vence hoje!'
                : `Sua assinatura vence em ${daysUntilExpiry} dia${daysUntilExpiry! > 1 ? 's' : ''}.`}
          </span>
          <button
            onClick={handleExpiryClick}
            style={{ background: '#ffffff', color: '#1d4ed8', padding: '5px 16px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.3px', flexShrink: 0 }}
          >
            {isTenantTrial ? 'Assinar agora' : 'Pagar agora'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#F8FAFC 0%,#EFF6FF 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, fontFamily: 'Outfit, sans-serif' }}>
          <style>{`
            @keyframes wlFadeIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
            @keyframes wlShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
            @keyframes wlBounce0{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
            @keyframes wlBounce1{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
            @keyframes wlBounce2{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}
          `}</style>
          <img src={LOGO_URL} alt="WorkAgenda" style={{ height: 140, objectFit: 'contain', animation: 'wlFadeIn 0.6s ease-out both' }} />
          <div style={{ position: 'relative', width: 200, height: 3, background: '#DBEAFE', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,#2563EB,transparent)', animation: 'wlShimmer 1.4s ease-in-out infinite' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2].map(n => (
              <div key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', opacity: 0.7, animation: `wlBounce${n} 1.2s ease-in-out ${n*0.18}s infinite` }} />
            ))}
          </div>
        </div>
      ) : tenant && (
        <ClientAdminPanel
          activeTenant={tenant}
          services={services}
          professionals={professionals}
          products={products}
          customers={customers}
          appointments={appointments}
          payments={payments}

          onAddService={async s => {
            const c = await createService(s);
            setServices(p => [c, ...p]);
            await logAudit('Serviço cadastrado', s.name, tenantId, profile?.name ?? '');
            return c;
          }}
          onUpdateService={async (id, s) => {
            await updateService(id, s);
            setServices(p => p.map(x => x.id === id ? { ...x, ...s } : x));
          }}
          onDeleteService={async id => {
            await deleteService(id);
            setServices(p => p.filter(x => x.id !== id));
          }}
          onSetServiceProfessionals={async (serviceId, profIds) => {
            await setServiceProfessionals(serviceId, profIds);
            setProfessionals(prev => prev.map(p => ({
              ...p,
              services: profIds.includes(p.id)
                ? [...new Set([...p.services, serviceId])]
                : p.services.filter(sid => sid !== serviceId),
            })));
          }}
          onAddProfessional={async (p, sIds) => {
            if (professionals.length >= 6) return;
            const c = await createProfessional(p, sIds ?? []);
            setProfessionals(prev => [...prev, c]);
          }}
          onUpdateProfessional={async (id, updates) => {
            await updateProfessional(id, updates);
            setProfessionals(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
          }}
          onDeleteProfessional={async id => {
            await deleteProfessional(id);
            setProfessionals(prev => prev.filter(x => x.id !== id));
          }}
          onAddProduct={async p => {
            const c = await createProduct(p);
            setProducts(prev => [c, ...prev]);
          }}
          onUpdateProductStock={async (id, stock) => {
            await updateProductStock(id, stock);
            setProducts(p => p.map(x => x.id === id ? { ...x, stock } : x));
          }}
          onAddAppointment={async a => {
            const c = await createAppointment(a);
            setAppointments(p => [c, ...p]);
            notifyAppointmentWhatsApp(a.tenantId, c.id, '').catch(() => {});
          }}
          onUpdateAppointmentStatus={async (id, status) => {
            await updateAppointmentStatus(id, status);
            setAppointments(p => p.map(a => a.id === id ? { ...a, status } : a));

            if (status === 'cancelled') {
              const appt = appointments.find(a => a.id === id);
              if (!appt || !tenant) return;
              const prof = professionals.find(p => p.id === appt.professionalId);
              const svc  = services.find(s => s.id === appt.serviceId);
              try {
                // Registra o cancelamento no histórico
                const histEntry = await createSlotHistory({
                  tenantId, slotDate: appt.date, slotTime: appt.time,
                  professionalName: prof?.name ?? null, serviceName: svc?.name ?? null,
                  cancelledCustomerName: appt.customerName, cancelledCustomerPhone: appt.customerPhone,
                  filledCustomerName: null, filledCustomerPhone: null, filledAt: null,
                });
                setSlotHistory(prev => [histEntry, ...prev]);

                // Tenta notificar o primeiro da lista de espera
                const { data: { session } } = await (await import('../../lib/supabase')).supabase.auth.getSession();
                const token = session?.access_token ?? '';
                const pending = await getWaitlistEntries(tenantId, appt.date);
                const first = pending.find(e => !e.notified);
                if (!first || !token) return;
                const msg = buildWaitlistMsg({ customerName: first.customerName, tenantName: tenant.name, tenantSlug: tenant.slug, date: first.date, timePreference: first.timePreference });
                const result = await sendWhatsAppServer(tenantId, token, first.customerPhone, msg);
                if (result === 'sent') {
                  await markWaitlistNotified(first.id).catch(() => {});
                  await updateSlotHistoryFilled(histEntry.id, first.customerName, first.customerPhone).catch(() => {});
                  setSlotHistory(prev => prev.map(h =>
                    h.id === histEntry.id
                      ? { ...h, filledCustomerName: first.customerName, filledCustomerPhone: first.customerPhone, filledAt: new Date().toISOString() }
                      : h
                  ));
                } else {
                  setWaitlistFailedIds(prev => new Set([...prev, first.id]));
                }
              } catch {
                // falha silenciosa
              }
            }
          }}
          onRescheduleAppointment={async (id, date, time) => {
            await rescheduleAppointment(id, date, time);
            setAppointments(p => p.map(a => a.id === id ? { ...a, date, time } : a));
            const appt = appointments.find(a => a.id === id);
            if (appt) notifyAppointmentWhatsApp(appt.tenantId, id).catch(() => {});
          }}
          onAddPayment={async p => {
            const c = await createPayment(p);
            setPayments(prev => [c, ...prev]);
          }}
          recurringExpenses={recurringExpenses}
          onAddRecurringExpense={async r => {
            const c = await createRecurringExpense(r);
            setRecurringExpenses(prev => [...prev, c]);
          }}
          onUpdateRecurringExpense={async (id, updates) => {
            await updateRecurringExpense(id, updates);
            setRecurringExpenses(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
          }}
          onDeleteRecurringExpense={async id => {
            await deleteRecurringExpense(id);
            setRecurringExpenses(prev => prev.filter(r => r.id !== id));
          }}
          waitlistFailedIds={waitlistFailedIds}
          slotHistory={slotHistory}
          onAddCustomer={async c => {
            const created = c.phone
              ? await upsertCustomerByPhone(c.tenantId, c.phone, c.name, c.email)
              : await createCustomerDirect(c.tenantId, c.name, undefined, c.email);
            setCustomers(prev => prev.find(x => x.id === created.id) ? prev : [created, ...prev]);
            return created;
          }}
          onUpdateCustomer={async (id, updates) => {
            await updateCustomer(id, updates);
            setCustomers(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
          }}
          onDeleteCustomer={async id => {
            await deleteCustomer(id);
            setCustomers(prev => prev.filter(x => x.id !== id));
          }}
          onUpdateTenantDetails={async (id, details) => {
            await updateTenant(id, details);
            setTenant(t => t ? { ...t, ...details } : t);
          }}
          onSwitchToBookingFlow={slug => {
            window.open(`/${slug}/agendamento`, '_blank');
          }}
          onDeleteAccount={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const r = await fetch(`${getApiUrl()}/api/account?tenantId=${tenant!.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
            await signOut();
          }}
          onSignOut={signOut}
          openSubscriptionTab={openSubscription}
          onSubscriptionTabOpened={() => setOpenSubscription(false)}
          notifications={notifications}
        />
      )}
    </div>
  );
}
