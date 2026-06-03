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

function BlockedScreen({ tenant, signOut, onUnblocked }: { tenant: Tenant; signOut: () => void; onUnblocked: () => void }) {
  const [payUrl, setPayUrl]         = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [verifying, setVerifying]   = useState(false);
  const [verifyMsg, setVerifyMsg]   = useState('');

  const isTrialEnd = tenant.plan === 'trial';

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  // Busca link de pagamento
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${getApiUrl()}/api/billing/payment-link?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setPayUrl((await r.json()).url);
      } catch (e) { console.error('[BlockedScreen] payment-link error:', e); }
      finally { setLoading(false); }
    })();
  }, [tenant.id]);

  // Polling: verifica status no banco a cada 10s e desbloqueia se ativo
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from('tenants').select('status').eq('id', tenant.id).maybeSingle();
      if (data?.status === 'active') { clearInterval(interval); onUnblocked(); }
    }, 10000);
    return () => clearInterval(interval);
  }, [tenant.id]);

  // Verificação manual via Asaas
  const handleVerify = async () => {
    setVerifying(true);
    setVerifyMsg('');
    try {
      const token = await getToken();
      const r = await fetch(`${getApiUrl()}/api/billing/verify-payment?tenantId=${tenant.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await r.json();
      if (json.activated) { onUnblocked(); return; }
      setVerifyMsg(json.message ?? 'Pagamento ainda não confirmado.');
    } catch { setVerifyMsg('Erro ao verificar. Tente novamente.'); }
    finally { setVerifying(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 440, padding: '40px 32px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>{isTrialEnd ? '⏰' : '🔒'}</div>

        {isTrialEnd ? (
          <>
            <h2 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Seu período de teste encerrou
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7, margin: '0 0 8px' }}>
              Esperamos que tenha aproveitado o BarberFlow! 😊
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, margin: '0 0 28px' }}>
              Para continuar usando o sistema e manter seus agendamentos e clientes, realize o pagamento da assinatura mensal.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ color: '#fca5a5', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Acesso suspenso
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, margin: '0 0 28px' }}>
              Sua assinatura está com pagamento pendente.<br />
              Regularize para reativar o acesso ao painel.
            </p>
          </>
        )}

        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Buscando link de pagamento…</div>
        ) : payUrl ? (
          <a href={payUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', padding: '12px 28px', background: '#22c55e', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            Pagar agora — R$ 89,90/mês
          </a>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Nenhuma cobrança pendente encontrada.
          </p>
        )}

        {/* Verificação após pagamento */}
        <div style={{ marginTop: 20 }}>
          <button onClick={handleVerify} disabled={verifying}
            style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, cursor: verifying ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            {verifying ? 'Verificando…' : 'Já paguei — verificar agora'}
          </button>
          {verifyMsg && <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{verifyMsg}</p>}
        </div>

        <div style={{ marginTop: 16 }}>
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
  createProfessional, createProduct,
  updateProductStock, createAppointment, updateAppointmentStatus,
  createPayment, upsertCustomerByPhone, logAudit, notifyAppointmentWhatsApp,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
import type { Tenant, Service, Professional, Product, Customer, Appointment, Payment } from '../../types';

export default function TenantAdminPage() {
  const { profile, signOut } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [tenant,        setTenant]        = useState<Tenant | null>(null);
  const [services,      setServices]      = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [products,      setProducts]      = useState<Product[]>([]);
  const [customers,     setCustomers]     = useState<Customer[]>([]);
  const [appointments,  setAppointments]  = useState<Appointment[]>([]);
  const [payments,      setPayments]      = useState<Payment[]>([]);
  const [loading,       setLoading]       = useState(true);

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

  const daysUntilExpiry = (() => {
    if (!tenant?.subscriptionEndsAt) return null;
    const diff = Math.ceil((new Date(tenant.subscriptionEndsAt).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    return diff >= 0 && diff <= 5 ? diff : null;
  })();

  const handleExpiryClick = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${((window as any).__BARBER_CONFIG__?.API_URL || '').replace(/\/$/, '')}/api/billing/payment-link?tenantId=${tenant!.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (r.ok) { const { url } = await r.json(); window.open(url, '_blank'); }
    } catch {}
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}>
      {/* Barra de aviso de vencimento */}
      {daysUntilExpiry !== null && (
        <button onClick={handleExpiryClick} style={{ width: '100%', background: '#f59e0b', color: '#1c1000', padding: '8px 20px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Outfit, sans-serif', border: 'none', cursor: 'pointer' }}>
          <span>⚠️</span>
          <span>
            {daysUntilExpiry === 0
              ? 'Sua assinatura vence hoje! Clique aqui para renovar.'
              : `Sua assinatura vence em ${daysUntilExpiry} dia${daysUntilExpiry > 1 ? 's' : ''}. Clique aqui para renovar.`}
          </span>
        </button>
      )}
      {/* Top bar */}
      <div
        style={{
          backgroundColor: '#021340',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%201%20de%20jun.%20de%202026,%2011_34_59%20(1).png"
            alt="BarberFlow"
            style={{ height: 40, objectFit: 'contain' }}
          />
          {tenant && (
            <>
              <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.18)' }} />
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500 }}>{tenant.name}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>{profile?.name}</span>
          <button
            onClick={signOut}
            style={{
              color: 'rgba(255,255,255,0.65)',
              background: 'none',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8,
              padding: '5px 14px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
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
          onAddPayment={async p => {
            const c = await createPayment(p);
            setPayments(prev => [c, ...prev]);
          }}
          onAddCustomer={async c => {
            const created = await upsertCustomerByPhone(c.tenantId, c.phone, c.name, c.email);
            setCustomers(prev => prev.find(x => x.id === created.id) ? prev : [created, ...prev]);
          }}
          onUpdateTenantDetails={async (id, details) => {
            await updateTenant(id, details);
            setTenant(t => t ? { ...t, ...details } : t);
          }}
          onSwitchToBookingFlow={slug => {
            window.open(`/${slug}/agendamento`, '_blank');
          }}
        />
      )}
    </div>
  );
}
