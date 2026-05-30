// src/pages/admin/SuperAdminPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import SuperAdminPanel from '../../components/SuperAdminPanel';
import { getTenants, getCoupons, getAuditLogs, updateTenant, createCoupon, logAudit } from '../../lib/db';
import type { Tenant, Coupon, AuditLog, SupportTicket } from '../../types';
import { ShieldCheck } from 'lucide-react';

export default function SuperAdminPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [tenants,    setTenants]    = useState<Tenant[]>([]);
  const [coupons,    setCoupons]    = useState<Coupon[]>([]);
  const [auditLogs,  setAuditLogs]  = useState<AuditLog[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, c, a] = await Promise.all([getTenants(), getCoupons(), getAuditLogs(null)]);
    setTenants(t); setCoupons(c); setAuditLogs(a);
    setLoading(false);
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
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="text-blue-300 font-bold">BarberFlow</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">Super Admin Console</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">{profile?.name}</span>
          <button onClick={signOut} className="text-slate-400 hover:text-white transition">Sair</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : (
          <SuperAdminPanel
            tenants={tenants}
            onUpdateTenantStatus={handleUpdateStatus}
            onExtendTrial={handleExtendTrial}
            coupons={coupons}
            onAddCoupon={handleAddCoupon}
            supportTickets={[] as SupportTicket[]}
            onResolveTicket={async () => {}}
            auditLogs={auditLogs}
          />
        )}
      </div>
    </div>
  );
}
