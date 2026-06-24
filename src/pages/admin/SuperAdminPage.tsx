import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SuperAdminPanel from '../../components/SuperAdminPanel';
import { getTenants, getCoupons, getAuditLogs, updateTenant, createCoupon, logAudit, getSupportTickets, resolveTicket } from '../../lib/db';
import type { Tenant, Coupon, AuditLog, SupportTicket } from '../../types';

export default function SuperAdminPage() {
  const { profile, signOut } = useAuth();

  const [tenants,        setTenants]        = useState<Tenant[]>([]);
  const [coupons,        setCoupons]        = useState<Coupon[]>([]);
  const [auditLogs,      setAuditLogs]      = useState<AuditLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading,        setLoading]        = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, a, s] = await Promise.all([getTenants(), getCoupons(), getAuditLogs(null), getSupportTickets()]);
      setTenants(t); setCoupons(c); setAuditLogs(a); setSupportTickets(s);
    } catch (err) {
      console.error('[SuperAdmin] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (tenantId: string, status: Tenant['status']) => {
    await updateTenant(tenantId, { status });
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status } : t));
    await logAudit('Status Tenant', `Status de ${tenantId} → ${status}`, null, profile?.name ?? 'Super Admin', profile?.id);
  };

  const handleExtendTrial = async (tenantId: string) => {
    const t = tenants.find(x => x.id === tenantId);
    if (!t) return;
    const d = new Date(t.trialEndsAt);
    d.setDate(d.getDate() + 10);
    const newDate = d.toISOString().split('T')[0];
    await updateTenant(tenantId, { trialEndsAt: newDate } as any);
    setTenants(prev => prev.map(x => x.id === tenantId ? { ...x, trialEndsAt: newDate } : x));
  };

  const handleAddCoupon = async (code: string, discount: number, expiresAt: string) => {
    const c = await createCoupon({ code, discountPercentage: discount, status: 'active', usageCount: 0, expiresAt });
    setCoupons(prev => [c, ...prev]);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%' }} className="animate-spin" />
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <SuperAdminPanel
      tenants={tenants}
      onUpdateTenantStatus={handleUpdateStatus}
      onExtendTrial={handleExtendTrial}
      coupons={coupons}
      onAddCoupon={handleAddCoupon}
      supportTickets={supportTickets}
      onResolveTicket={async (ticketId, reply) => {
        if (!reply) return;
        await resolveTicket(ticketId, reply);
        setSupportTickets(prev => prev.map(t => t.id === ticketId
          ? { ...t, status: 'resolved', messages: [...t.messages, { sender: 'superadmin', content: reply, timestamp: new Date().toISOString() }] }
          : t
        ));
      }}
      auditLogs={auditLogs}
      onSignOut={signOut}
    />
  );
}
