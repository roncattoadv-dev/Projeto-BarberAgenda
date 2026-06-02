// src/pages/admin/TenantAdminPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ClientAdminPanel from '../../components/ClientAdminPanel';
import { Scissors } from 'lucide-react';
import {
  getTenants, getServices, getProfessionals, getProducts,
  getCustomers, getAppointments, getPayments,
  updateTenant, createService, createProfessional, createProduct,
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}>
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
            // Dispara confirmação WhatsApp em background (não bloqueia UI)
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.access_token) {
                notifyAppointmentWhatsApp(a.tenantId, c.id, session.access_token).catch(() => {});
              }
            });
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
