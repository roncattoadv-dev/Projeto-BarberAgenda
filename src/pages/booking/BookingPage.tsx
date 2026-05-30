// src/pages/booking/BookingPage.tsx
// Rota pública: /:slug/agendamento  (ex: /barbeariaespacoreal/agendamento)
// Não requer autenticação — qualquer cliente pode acessar

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CustomerBookingFlow from '../../components/CustomerBookingFlow';
import { supabase } from '../../lib/supabase';
import { getTenantBySlug, getServices, getProfessionals, getAppointments, getCustomers, createAppointment, updateAppointmentStatus, upsertCustomerByPhone } from '../../lib/db';
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
      const t = await getTenantBySlug(slug);
      if (!t) { setNotFound(true); setLoading(false); return; }
      if (t.status === 'blocked') { setNotFound(true); setLoading(false); return; }

      setTenant(t);
      const [svcs, profs, appts, custs] = await Promise.all([
        getServices(t.id),
        getProfessionals(t.id),
        getAppointments(t.id, 500),
        getCustomers(t.id),
      ]);
      setServices(svcs); setProfessionals(profs);
      setAppointments(appts); setCustomers(custs);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-4xl animate-pulse">💈</div>
        <p className="text-slate-400 text-sm font-medium">Carregando agendamento…</p>
      </div>
    </div>
  );

  if (notFound || !tenant) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-900">Barbearia não encontrada</h1>
        <p className="text-slate-500 text-sm">
          O endereço <code className="bg-slate-100 px-1 rounded">/{slug}/agendamento</code> não existe ou está inativo.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal public header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">{tenant.logo}</span>
        <div>
          <p className="font-bold text-slate-900 text-sm leading-tight">{tenant.name}</p>
          <p className="text-xs text-slate-400">{tenant.address}</p>
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
            const c = await createAppointment(a);
            setAppointments(p => [c, ...p]);
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
        />
      </div>

      {/* Powered by footer */}
      <div className="text-center pb-8 pt-4">
        <p className="text-xs text-slate-300">Agendamento online por <span className="font-semibold">BarberFlow</span></p>
      </div>
    </div>
  );
}
