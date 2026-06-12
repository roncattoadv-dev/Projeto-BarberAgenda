// src/pages/admin/SuperAdminPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SuperAdminPanel from '../../components/SuperAdminPanel';
import { getTenants, getCoupons, getAuditLogs, updateTenant, createCoupon, logAudit, getSupportTickets, resolveTicket } from '../../lib/db';
import type { Tenant, Coupon, AuditLog, SupportTicket } from '../../types';
import { ShieldCheck } from 'lucide-react';

export default function SuperAdminPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
      {/* Top bar */}
      <div
        style={{
          backgroundColor: '#1E293B',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 40, objectFit: 'contain' }}
          />
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.18)' }} />
          <ShieldCheck style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.65)' }} />
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500 }}>Super Admin Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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
              transition: 'color 0.15s',
            }}
          >
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              style={{
                width: 36,
                height: 144,
                border: '3px solid rgba(255,255,255,0.09)',
                borderTopColor: 'rgba(255,255,255,0.65)',
                borderRadius: '50%',
              }}
              className="animate-spin"
            />
          </div>
        ) : (
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
          />
        )}
      </div>
    </div>
  );
}
