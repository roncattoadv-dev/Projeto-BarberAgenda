// src/pages/admin/TenantAdminPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ClientAdminPanel from '../../components/ClientAdminPanel';
import { Scissors } from 'lucide-react';
import { supabase } from '../../lib/supabase';
function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

const BASE_PRICE = 89.90;
const PLAN_META = {
  mensal:     { label: 'Mensal',     months: 1,  discountPct: 0,  color: '#3b82f6', desc: 'R$ 89,90/mês' },
  trimestral: { label: 'Trimestral', months: 3,  discountPct: 15, color: '#8b5cf6', desc: 'R$ 76,42/mês · 15% off' },
  anual:      { label: 'Anual',      months: 12, discountPct: 25, color: '#10b981', desc: 'R$ 67,43/mês · 25% off' },
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '32px 32px 24px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{isTrialEnd ? '⏰' : '🔒'}</div>
          {isTrialEnd ? (
            <>
              <h2 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Seu período de teste encerrou</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                Escolha um plano para continuar usando o WorkAgenda e manter todos os seus dados.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ color: '#fca5a5', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Acesso suspenso</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                Regularize sua assinatura para reativar o acesso ao painel.
              </p>
            </>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px 28px' }}>

          {/* Loading */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.5)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>Verificando assinatura…</p>
            </div>
          )}

          {/* Selecionar plano */}
          {step === 'select-plan' && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 14px' }}>Escolha seu plano</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {(Object.entries(PLAN_META) as [PlanKey, typeof PLAN_META[PlanKey]][]).map(([key, p]) => (
                  <button key={key} onClick={() => { setPlan(key); setStep('cpf-form'); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: `${p.color}15`, border: `1.5px solid ${p.color}44`, borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = p.color)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = `${p.color}44`)}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{p.label}</p>
                      <p style={{ fontSize: 12, color: p.color, margin: '2px 0 0' }}>{p.desc}</p>
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>→</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Formulário CPF */}
          {step === 'cpf-form' && (
            <>
              <button onClick={() => setStep('select-plan')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Voltar
              </button>
              <div style={{ background: `${pm.color}12`, border: `1px solid ${pm.color}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 800, color: pm.color, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 2px' }}>Plano {pm.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0 }}>R$ {monthly.toFixed(2).replace('.', ',')} /mês</p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.88)', margin: 0 }}>R$ {total.toFixed(2).replace('.', ',')}</p>
              </div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>CPF ou CNPJ *</label>
              <input autoFocus type="text" placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={cpfCnpj} onChange={e => { setCpfCnpj(e.target.value); setCpfError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${cpfError ? '#f87171' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, color: 'rgba(255,255,255,0.88)', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'Outfit, sans-serif' }} />
              {cpfError && <p style={{ color: '#f87171', fontSize: 12, margin: '6px 0 0' }}>{cpfError}</p>}
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: '6px 0 16px' }}>Necessário para emissão da cobrança.</p>
              {genError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}><p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{genError}</p></div>}
              <button onClick={handleGenerate}
                style={{ width: '100%', padding: '13px 0', background: pm.color, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Gerar cobrança →
              </button>
            </>
          )}

          {/* Gerando */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ width: 32, height: 32, border: `3px solid ${pm.color}33`, borderTopColor: pm.color, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>Gerando cobrança…</p>
            </div>
          )}

          {/* Pagamento — cobrança existente */}
          {step === 'has-link' && (
            <div style={{ textAlign: 'center' }}>
              {pixImage && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Pagar via PIX</p>
                  <div style={{ display: 'inline-block', padding: 10, border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, marginBottom: 12 }}>
                    <img src={`data:image/png;base64,${pixImage}`} alt="QR Code PIX" style={{ width: 180, height: 180, display: 'block' }} />
                  </div>
                  {pixCode && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <input readOnly value={pixCode} style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} />
                      <button onClick={() => { navigator.clipboard.writeText(pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                        style={{ padding: '8px 14px', background: pixCopied ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {pixCopied ? '✓' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <a href={payUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '12px 0', background: '#22c55e', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', textAlign: 'center' }}>
                Pagar via boleto / outro método
              </a>
            </div>
          )}

          {/* Pagamento — cobrança recém-gerada */}
          {step === 'payment' && (
            <div style={{ textAlign: 'center' }}>
              {pixImage && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Pagar via PIX</p>
                  <div style={{ display: 'inline-block', padding: 10, border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, marginBottom: 12 }}>
                    <img src={`data:image/png;base64,${pixImage}`} alt="QR Code PIX" style={{ width: 180, height: 180, display: 'block' }} />
                  </div>
                  {pixCode && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <input readOnly value={pixCode} style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} />
                      <button onClick={() => { navigator.clipboard.writeText(pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                        style={{ padding: '8px 14px', background: pixCopied ? '#10b981' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {pixCopied ? '✓' : 'Copiar'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {payUrl && (
                <a href={payUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', padding: '12px 0', background: pm.color, color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', textAlign: 'center', marginBottom: 8 }}>
                  Pagar via boleto / outro método
                </a>
              )}
            </div>
          )}

          {/* Verificar pagamento — mostrado após ter cobrança */}
          {(step === 'has-link' || step === 'payment') && (
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <button onClick={handleVerify} disabled={verifying}
                style={{ padding: '9px 22px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, cursor: verifying ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                {verifying ? 'Verificando…' : 'Já paguei — verificar agora'}
              </button>
              {verifyMsg && <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{verifyMsg}</p>}
            </div>
          )}
        </div>

        <div style={{ padding: '0 32px 20px', textAlign: 'center' }}>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
import {
  getTenants, getServices, getProfessionals, getProducts,
  getCustomers, getAppointments, getPayments,
  updateTenant, createService, updateService, deleteService,
  createProfessional, updateProfessional, createProduct, updateCustomer, deleteCustomer,
  updateProductStock, createAppointment, updateAppointmentStatus, rescheduleAppointment,
  createPayment, upsertCustomerByPhone, createCustomerDirect, logAudit, notifyAppointmentWhatsApp,
  syncProfessionalsHours,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
import type { Tenant, Service, Professional, Product, Customer, Appointment, Payment } from '../../types';

export default function TenantAdminPage() {
  const { profile, signOut } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [tenant,              setTenant]              = useState<Tenant | null>(null);
  const [services,            setServices]            = useState<Service[]>([]);
  const [professionals,       setProfessionals]       = useState<Professional[]>([]);
  const [products,            setProducts]            = useState<Product[]>([]);
  const [customers,           setCustomers]           = useState<Customer[]>([]);
  const [appointments,        setAppointments]        = useState<Appointment[]>([]);
  const [payments,            setPayments]            = useState<Payment[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [openSubscription,    setOpenSubscription]    = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [ts, svcs, profs, prods, custs, appts, pays] = await Promise.all([
      getTenants(),
      getServices(tenantId),
      getProfessionals(tenantId),
      getProducts(tenantId),
      getCustomers(tenantId),
      getAppointments(tenantId),
      getPayments(tenantId),
    ]);
    setTenant(ts.find(t => t.id === tenantId) ?? null);
    setServices(svcs); setProfessionals(profs); setProducts(prods);
    setCustomers(custs); setAppointments(appts); setPayments(pays);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  if (!tenant && !loading) return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#031D3C', color: 'rgba(255,255,255,0.38)', fontFamily: 'Outfit, sans-serif' }}
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
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}>
      {/* Barra de aviso de vencimento */}
      {daysUntilExpiry !== null && (
        <button onClick={handleExpiryClick} style={{ width: '100%', background: '#f59e0b', color: '#1c1000', padding: '8px 20px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Outfit, sans-serif', border: 'none', cursor: 'pointer' }}>
          <span>⚠️</span>
          <span>
            {isTenantTrial
              ? daysUntilExpiry === 0
                ? 'Seu período de teste encerra hoje! Assine um plano para continuar.'
                : `Seu período de teste encerra em ${daysUntilExpiry} dia${daysUntilExpiry! > 1 ? 's' : ''}. Assine agora para não perder o acesso.`
              : daysUntilExpiry === 0
                ? 'Sua assinatura vence hoje! Clique aqui para renovar.'
                : `Sua assinatura vence em ${daysUntilExpiry} dia${daysUntilExpiry! > 1 ? 's' : ''}. Clique aqui para renovar.`}
          </span>
        </button>
      )}
      {/* Top bar */}
      <div style={{ backgroundColor: '#021340', borderBottom: '1px solid rgba(255,255,255,0.09)', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 36, objectFit: 'contain' }}
          />
          {tenant && (
            <>
              <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)' }} />
              {(tenant.logo?.startsWith('http') || tenant.logo?.startsWith('data:')) && (
                <div style={{ width: 28, height: 28, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
                  <img src={tenant.logo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{tenant.name}</span>
            </>
          )}
        </div>
        <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 500, padding: '4px 8px', borderRadius: 6, transition: 'color 150ms' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}>
          Sair
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid rgba(255,255,255,0.09)',
              borderTopColor: 'rgba(255,255,255,0.65)',
              borderRadius: '50%',
            }}
            className="animate-spin"
          />
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
          }}
          onUpdateService={async (id, s) => {
            await updateService(id, s);
            setServices(p => p.map(x => x.id === id ? { ...x, ...s } : x));
          }}
          onDeleteService={async id => {
            await deleteService(id);
            setServices(p => p.filter(x => x.id !== id));
          }}
          onAddProfessional={async (p, sIds) => {
            const c = await createProfessional(p, sIds ?? []);
            setProfessionals(prev => [...prev, c]);
          }}
          onUpdateProfessional={async (id, updates) => {
            await updateProfessional(id, updates);
            setProfessionals(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x));
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
          }}
          onRescheduleAppointment={async (id, date, time) => {
            await rescheduleAppointment(id, date, time);
            setAppointments(p => p.map(a => a.id === id ? { ...a, date, time } : a));
          }}
          onAddPayment={async p => {
            const c = await createPayment(p);
            setPayments(prev => [c, ...prev]);
          }}
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
            // Sincroniza horários para todos os profissionais quando os horários do salão mudam
            if (details.businessHoursByDay && details.businessDays) {
              await syncProfessionalsHours(id, details.businessDays, details.businessHoursByDay);
              setProfessionals(prev => prev.map(p => ({ ...p, businessDays: details.businessDays!, businessHoursByDay: details.businessHoursByDay! })));
            }
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
          openSubscriptionTab={openSubscription}
          onSubscriptionTabOpened={() => setOpenSubscription(false)}
        />
      )}
    </div>
  );
}
