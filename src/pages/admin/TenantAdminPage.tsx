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
  createPayment, upsertCustomerByPhone, logAudit,
} from '../../lib/db';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
      Tenant não encontrado. Contate o administrador.
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Scissors className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-900">BarberFlow</span>
          {tenant && <span className="text-slate-400">· {tenant.name}</span>}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{profile?.name}</span>
          <button onClick={signOut} className="hover:text-slate-900 transition">Sair</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
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
