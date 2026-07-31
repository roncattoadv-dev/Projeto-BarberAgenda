import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SuperAdminPanel from '../../components/SuperAdminPanel';
import { getTenants, getCoupons, getAuditLogs, updateTenant, createCoupon, logAudit, getSupportTickets, resolveTicket } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import type { Tenant, Coupon, AuditLog, SupportTicket } from '../../types';

export default function SuperAdminPage() {
  const { profile, signOut, session } = useAuth();

  const [tenants,        setTenants]        = useState<Tenant[]>([]);
  const [coupons,        setCoupons]        = useState<Coupon[]>([]);
  const [auditLogs,      setAuditLogs]      = useState<AuditLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading,        setLoading]        = useState(true);

  const [tenantEmails, setTenantEmails] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, a, s] = await Promise.all([getTenants(), getCoupons(), getAuditLogs(null), getSupportTickets()]);
      setTenants(t); setCoupons(c); setAuditLogs(a); setSupportTickets(s);

      // Busca emails dos tenant_admins via profiles (cross-schema: public.profiles)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('tenant_id, email')
        .eq('role', 'tenant_admin')
        .in('tenant_id', t.map(x => x.id).filter(Boolean));
      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach((p: any) => { if (p.tenant_id && p.email) map[p.tenant_id] = p.email; });
        setTenantEmails(map);
      }
    } catch (err) {
      console.error('[SuperAdmin] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async (tenantId: string, status: Tenant['status']) => {
    const patch: Partial<Tenant> = { status };
    if (status === 'active') {
      const t = tenants.find(x => x.id === tenantId);
      if (!t?.plan || t.plan === 'trial') patch.plan = 'mensal';
      const base = new Date();
      const subEnd = t?.subscriptionEndsAt ? new Date(t.subscriptionEndsAt) : null;
      const d = subEnd && subEnd > base ? subEnd : base;
      d.setDate(d.getDate() + 30);
      patch.subscriptionEndsAt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    if (status === 'trial') {
      patch.plan = 'trial';
      patch.subscriptionEndsAt = '';
    }
    await updateTenant(tenantId, patch);
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, ...patch } : t));
    await logAudit('Status Tenant', `Status de ${tenantId} → ${status}`, null, profile?.name ?? 'Super Admin', profile?.id);
  };

  const handleExtendTrial = async (tenantId: string) => {
    const t = tenants.find(x => x.id === tenantId);
    if (!t) return;
    // Base: o maior entre hoje e a data atual de trial (evita contar a partir do passado)
    const base = new Date(Math.max(Date.now(), t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : 0));
    base.setDate(base.getDate() + 7);
    const n = base;
    const newDate = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
    const patch: any = { trialEndsAt: newDate };
    if (t.status === 'blocked') patch.status = 'trial';
    await updateTenant(tenantId, patch);
    setTenants(prev => prev.map(x => x.id === tenantId ? { ...x, ...patch } : x));
  };

  const handleAddCoupon = async (code: string, discount: number, expiresAt: string) => {
    const c = await createCoupon({ code, discountPercentage: discount, status: 'active', usageCount: 0, expiresAt });
    setCoupons(prev => [c, ...prev]);
  };

  const handleDeleteTenant = async (tenantId: string) => {
    const r = await fetch(`${(window as any).__BARBER_CONFIG__?.API_URL || ''}/api/account?tenantId=${tenantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Erro ao apagar tenant'); }
    setTenants(prev => prev.filter(t => t.id !== tenantId));
    await logAudit('Tenant Apagado', `Tenant ${tenantId} removido pelo Super Admin`, null, profile?.name ?? 'Super Admin', profile?.id);
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
      onDeleteTenant={handleDeleteTenant}
      tenantEmails={tenantEmails}
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
