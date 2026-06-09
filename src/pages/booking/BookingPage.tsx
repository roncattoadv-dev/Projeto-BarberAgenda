// src/pages/booking/BookingPage.tsx
// Rota pública: /:slug/agendamento  (ex: /barbeariaespacoreal/agendamento)
// Não requer autenticação — qualquer cliente pode acessar

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CustomerBookingFlow from '../../components/CustomerBookingFlow';
import { supabase } from '../../lib/supabase';
import { getTenantBySlug, getServices, getProfessionals, getAppointments, getCustomers, createAppointment, updateAppointmentStatus, upsertCustomerByPhone, notifyAppointmentWhatsApp, getOccupiedSlots } from '../../lib/db';
import type { Tenant, Service, Professional, Appointment, Customer } from '../../types';

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();

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
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="text-center space-y-4">
        <div style={{ fontSize: 40 }} className="animate-pulse">💈</div>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: 500 }}>Carregando agendamento…</p>
      </div>
    </div>
  );

  if (notFound || !tenant) return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
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
  const tintBg = (() => {
    const r = parseInt(pc.slice(1, 3), 16);
    const g = parseInt(pc.slice(3, 5), 16);
    const b = parseInt(pc.slice(5, 7), 16);
    return `rgb(${Math.round(4 + r * 0.13)},${Math.round(4 + g * 0.13)},${Math.round(4 + b * 0.13)})`;
  })();
  const tintHeader = (() => {
    const r = parseInt(pc.slice(1, 3), 16);
    const g = parseInt(pc.slice(3, 5), 16);
    const b = parseInt(pc.slice(5, 7), 16);
    return `rgb(${Math.round(2 + r * 0.08)},${Math.round(2 + g * 0.08)},${Math.round(2 + b * 0.08)})`;
  })();

  return (
    <div className="min-h-screen" style={{ backgroundColor: tintBg, fontFamily: 'Outfit, sans-serif' }}>
      {/* Minimal public header */}
      <div
        style={{
          backgroundColor: tintHeader,
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {(tenant.logo?.startsWith('http') || tenant.logo?.startsWith('data:'))
          ? <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
              <img src={tenant.logo} alt={tenant.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          : <span style={{ fontSize: 22, flexShrink: 0 }}>{tenant.logo}</span>
        }
        <div>
          <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 1.3 }}>{tenant.name}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{tenant.address}</p>
        </div>
      </div>

      {/* Booking widget */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <CustomerBookingFlow
          activeTenant={tenant}
          services={services}
          professionals={professionals}
          appointments={appointments}
          customers={customers}
          onAddAppointment={async a => {
            // Garante customer real no banco antes de inserir o agendamento
            // (CustomerBookingFlow pode passar customerId fake para novos clientes)
            const customer = await upsertCustomerByPhone(a.tenantId, a.customerPhone, a.customerName);
            setCustomers(prev => prev.find(x => x.id === customer.id) ? prev : [customer, ...prev]);
            const c = await createAppointment({ ...a, customerId: customer.id });
            setAppointments(p => [c, ...p]);
            notifyAppointmentWhatsApp(a.tenantId, c.id, '').catch(() => {});
          }}
          onUpdateAppointmentStatus={async (id, status) => {
            await updateAppointmentStatus(id, status);
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
        />
      </div>

      {/* Powered by footer */}
      <div className="pb-8" />
    </div>
  );
}
