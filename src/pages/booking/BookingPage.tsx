// src/pages/booking/BookingPage.tsx
// Rota pública: /:slug/agendamento  (ex: /barbeariaespacoreal/agendamento)
// Não requer autenticação — qualquer cliente pode acessar

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CustomerBookingFlow from '../../components/CustomerBookingFlow';
import { supabase } from '../../lib/supabase';
import { getTenantBySlug, getServices, getProfessionals, getAppointments, getCustomers, createAppointment, upsertCustomerByPhone, notifyAppointmentWhatsApp, getOccupiedSlots, addWaitlistEntry } from '../../lib/db';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}
import type { Tenant, Service, Professional, Appointment, Customer } from '../../types';

function deriveBg(pc: string): string {
  const r = parseInt(pc.slice(1, 3), 16);
  const g = parseInt(pc.slice(3, 5), 16);
  const b = parseInt(pc.slice(5, 7), 16);
  const mix = (ch: number, n: number) => Math.round(n + (ch - n) * 0.18);
  return `rgb(${mix(r, 110)},${mix(g, 116)},${mix(b, 98)})`;
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();

  const cachedPc  = (() => { try { return (slug && localStorage.getItem(`bfpc_${slug}`)) || ''; } catch { return ''; } })();
  const loadingBg = deriveBg(cachedPc || '#6b8096');

  const [tenant,        setTenant]        = useState<Tenant | null>(null);
  const [services,      setServices]      = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments,  setAppointments]  = useState<Appointment[]>([]);
  const [customers,     setCustomers]     = useState<Customer[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    (async () => {
      try {
        const t = await getTenantBySlug(slug);
        if (!t) { setNotFound(true); setLoading(false); return; }
        if (t.status === 'blocked') { setNotFound(true); setLoading(false); return; }

        const pc = t.bookingPageConfig?.primaryColor ?? '#2563EB';
        try { localStorage.setItem(`bfpc_${slug}`, pc); } catch {}

        setTenant(t);
        const [svcs, profs, appts, custs] = await Promise.allSettled([
          getServices(t.id),
          getProfessionals(t.id),
          getAppointments(t.id, 500),
          getCustomers(t.id),
        ]);
        if (svcs.status   === 'fulfilled') setServices(svcs.value);
        if (profs.status  === 'fulfilled') setProfessionals(profs.value);
        if (appts.status  === 'fulfilled') setAppointments(appts.value);
        if (custs.status  === 'fulfilled') setCustomers(custs.value);
      } catch (err) {
        console.error('[BookingPage] load error:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: loadingBg, fontFamily: 'Outfit, sans-serif' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: 48, height: 48 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'rgba(255,255,255,0.8)', animation: 'spin 0.85s linear infinite' }} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500, letterSpacing: '0.5px' }}>Carregando agendamento…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (notFound || !tenant) return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="text-center space-y-4 max-w-sm">
        <div style={{ fontSize: 48 }}>🔍</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.88)' }}>Barbearia não encontrada</h1>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>
          O endereço <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>/{slug}/agendamento</code> não existe ou está inativo.
        </p>
      </div>
    </div>
  );

  const pc = tenant.bookingPageConfig?.primaryColor ?? '#2563EB';
  const tintBg = deriveBg(pc);

  return (
    <div className="min-h-screen" style={{ backgroundColor: tintBg, fontFamily: 'Outfit, sans-serif', padding: '32px 16px' }}>
      {/* Booking widget */}
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <CustomerBookingFlow
          activeTenant={tenant}
          services={services}
          professionals={professionals}
          appointments={appointments}
          customers={customers}
          onAddAppointment={async a => {
            const customer = await upsertCustomerByPhone(a.tenantId, a.customerPhone, a.customerName);
            setCustomers(prev => prev.find(x => x.id === customer.id) ? prev : [customer, ...prev]);
            const c = await createAppointment({ ...a, customerId: customer.id });
            setAppointments(p => [c, ...p]);
            notifyAppointmentWhatsApp(a.tenantId, c.id, '').catch(() => {});
            return c;
          }}
          onUpdateAppointmentStatus={async (id, status) => {
            if (status === 'cancelled') {
              const res = await fetch(`${getApiUrl()}/api/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, appointmentId: id }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Erro ao cancelar.');
            }
            setAppointments(p => p.map(a => a.id === id ? { ...a, status } : a));
          }}
          onAddCustomer={async c => {
            const created = await upsertCustomerByPhone(c.tenantId, c.phone, c.name, c.email);
            setCustomers(prev => prev.find(x => x.id === created.id) ? prev : [created, ...prev]);
            return created;
          }}
          onRegisterReview={async (stars, comment, apptId) => {
            const appt = appointments.find(a => a.id === apptId);
            if (!appt) return;
            await supabase.from('reviews').insert({ tenant_id: appt.tenantId, appointment_id: apptId, stars, comment });
          }}
          onGetOccupiedSlots={(profId, date) => getOccupiedSlots(profId, date)}
          onAddWaitlistEntry={tenant.bookingPageConfig?.waitlistEnabled !== false
            ? async e => { await addWaitlistEntry(e); }
            : undefined}
        />
      </div>

      {/* Powered by footer */}
      <div style={{ textAlign: 'center', padding: '24px 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3px' }}>Powered by WorkAgenda</span>
        <img
          src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2023%20de%20jun.%20de%202026,%2014_55_26%20(1).png"
          alt="WorkAgenda"
          style={{ height: 28, display: 'inline-block', opacity: 0.4 }}
        />
      </div>
    </div>
  );
}
