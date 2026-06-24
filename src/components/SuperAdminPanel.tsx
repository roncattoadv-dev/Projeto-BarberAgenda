import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tenant, Coupon, SupportTicket, AuditLog } from '../types';
import {
  LayoutDashboard, Users, Ticket, HeartHandshake, ShieldCheck,
  Plug, TrendingUp, TrendingDown, CheckCircle2, Ban, Plus, Send,
  Search, AlertTriangle, ArrowUpRight, Zap,
  DollarSign, Activity, Clock, ChevronDown, ChevronUp,
  ExternalLink, Phone, MapPin, Instagram, Mail,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, LogOut,
  ChevronLeft, ChevronRight, RefreshCw, XCircle, FlaskConical, Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || '').replace(/\/$/, '');
}

interface SuperAdminPanelProps {
  tenants: Tenant[];
  onUpdateTenantStatus: (tenantId: string, status: 'active' | 'blocked' | 'trial') => void;
  onExtendTrial: (tenantId: string) => void;
  coupons: Coupon[];
  onAddCoupon: (code: string, discount: number, expiresAt: string) => void;
  supportTickets: SupportTicket[];
  onResolveTicket: (ticketId: string, replyMessage?: string) => void;
  auditLogs: AuditLog[];
  onSignOut: () => void;
}

type Tab = 'overview' | 'tenants' | 'coupons' | 'suporte' | 'logs' | 'integracoes';

const NAV: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Visão Geral',  Icon: LayoutDashboard },
  { id: 'tenants',     label: 'Assinantes',   Icon: Users           },
  { id: 'coupons',     label: 'Cupons',       Icon: Ticket          },
  { id: 'suporte',     label: 'Suporte',      Icon: HeartHandshake  },
  { id: 'logs',        label: 'Logs',         Icon: ShieldCheck     },
  { id: 'integracoes', label: 'Integrações',  Icon: Plug            },
];

const PAGE_TITLES: Record<Tab, string> = {
  overview:    'Visão Geral',
  tenants:     'Assinantes',
  coupons:     'Cupons',
  suporte:     'Suporte',
  logs:        'Audit Log',
  integracoes: 'Integrações',
};

const SIDEBAR_W = { open: 232, closed: 64 };

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  border:    '#E2E8F0',
  text:      '#111827',
  secondary: '#475569',
  muted:     '#9CA3AF',
  faint:     '#D1D5DB',
  accent:    '#2563EB',
  accentBg:  '#EFF6FF',
  accentBd:  '#BFDBFE',
  green:     '#16A34A',
  greenBg:   '#DCFCE7',
  greenBd:   '#86EFAC',
  amber:     '#B45309',
  amberBg:   '#FEF3C7',
  amberBd:   '#FCD34D',
  red:       '#DC2626',
  redBg:     '#FEE2E2',
  redBd:     '#FCA5A5',
  violet:    '#7C3AED',
  violetBg:  '#EDE9FE',
  violetBd:  '#DDD6FE',
};

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const sLbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '1.5px', color: C.muted, marginBottom: 6, display: 'block',
};

const inp: React.CSSProperties = {
  width: '100%', background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: '9px 12px', color: C.text, fontSize: 13,
  outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tenant['status'] }) {
  const cfg = {
    active:  { label: 'Ativo',     bg: C.greenBg, bd: C.greenBd, color: C.green },
    trial:   { label: 'Trial',     bg: C.amberBg, bd: C.amberBd, color: C.amber },
    blocked: { label: 'Bloqueado', bg: C.redBg,   bd: C.redBd,   color: C.red   },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label: lbl, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ElementType }) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={sLbl}>{lbl}</span>
        {Icon && <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}><Icon style={{ width: 15, height: 15 }} /></div>}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: color ?? C.text, fontFamily: 'monospace', letterSpacing: '-1px', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminPanel({
  tenants, onUpdateTenantStatus, onExtendTrial,
  coupons, onAddCoupon,
  supportTickets, onResolveTicket,
  auditLogs, onSignOut,
}: SuperAdminPanelProps) {

  const [activeTab,        setActiveTab]        = useState<Tab>('overview');
  const [collapsed,        setCollapsed]        = useState(false);

  // ── Integrações: status e toggle ─────────────────────────────────────────
  type SvcStatus = { ok: boolean; message: string; sandbox?: boolean } | null;
  const [intStatus,    setIntStatus]    = useState<{ evogo: SvcStatus; asaas: SvcStatus & { sandbox?: boolean } | null; resend: SvcStatus; checkedAt: string | null }>({ evogo: null, asaas: null, resend: null, checkedAt: null });
  const [intLoading,   setIntLoading]   = useState(false);
  const [modeToggling, setModeToggling] = useState(false);

  const fetchIntStatus = useCallback(async () => {
    setIntLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const r = await fetch(`${getApiUrl()}/api/admin/integrations/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setIntStatus(await r.json());
    } catch {}
    setIntLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'integracoes') fetchIntStatus();
  }, [activeTab, fetchIntStatus]);

  const toggleAsaasMode = async (sandbox: boolean) => {
    setModeToggling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      await fetch(`${getApiUrl()}/api/admin/asaas-mode`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandbox }),
      });
      await fetchIntStatus();
    } catch {}
    setModeToggling(false);
  };
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState<'all' | Tenant['status']>('all');
  const [expandedTenant,   setExpandedTenant]   = useState<string | null>(null);
  const [sortKey,          setSortKey]          = useState<'name' | 'mrr' | 'expiry'>('mrr');
  const [sortDir,          setSortDir]          = useState<'asc' | 'desc'>('desc');
  const [newCode,          setNewCode]          = useState('');
  const [newDiscount,      setNewDiscount]      = useState(15);
  const [newExpiry,        setNewExpiry]        = useState('2026-12-31');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminReply,       setAdminReply]       = useState('');

  const active  = useMemo(() => tenants.filter(t => t.status === 'active'),  [tenants]);
  const trial   = useMemo(() => tenants.filter(t => t.status === 'trial'),   [tenants]);
  const blocked = useMemo(() => tenants.filter(t => t.status === 'blocked'), [tenants]);
  const mrr     = useMemo(() => active.reduce((s, t) => s + t.mrr, 0), [active]);
  const arr     = mrr * 12;
  const arpu    = active.length ? mrr / active.length : 0;
  const churnRate = tenants.length ? (blocked.length / tenants.length) * 100 : 0;
  const convRate  = tenants.length ? (active.length / tenants.length) * 100 : 0;
  const openTickets = supportTickets.filter(t => t.status === 'open');

  const soon = useMemo(() => {
    const now = new Date(), week = new Date(now.getTime() + 7 * 86400000);
    return tenants.filter(t => {
      const d = t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt;
      if (!d) return false;
      const dt = new Date(d);
      return dt >= now && dt <= week;
    });
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    const q = search.toLowerCase();
    const list = tenants
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .filter(t => !q || t.name.toLowerCase().includes(q) || t.slug.includes(q) || (t.phone || '').includes(q));
    return list.sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortKey === 'name')   { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (sortKey === 'mrr')    { av = a.mrr; bv = b.mrr; }
      if (sortKey === 'expiry') {
        av = (a.status === 'trial' ? a.trialEndsAt : a.subscriptionEndsAt) || '';
        bv = (b.status === 'trial' ? b.trialEndsAt : b.subscriptionEndsAt) || '';
      }
      return av < bv ? (sortDir === 'asc' ? -1 : 1) : av > bv ? (sortDir === 'asc' ? 1 : -1) : 0;
    });
  }, [tenants, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: 'name' | 'mrr' | 'expiry') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'mrr' ? 'desc' : 'asc'); }
  };

  const daysUntil = (dateStr: string) => !dateStr ? -999 : Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
  const expiryColor = (d: number) => d < 0 ? C.red : d <= 7 ? C.amber : d <= 14 ? '#D97706' : C.green;

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    onAddCoupon(newCode.trim().toUpperCase(), newDiscount, newExpiry);
    setNewCode(''); setNewDiscount(15);
  };

  const handleSendReply = () => {
    if (!selectedTicketId || !adminReply.trim()) return;
    onResolveTicket(selectedTicketId, adminReply.trim());
    setAdminReply(''); setSelectedTicketId(null);
  };

  const selectedTicket = supportTickets.find(t => t.id === selectedTicketId);
  const fmtBrl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const PAGE_TRANS = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.2, ease: 'easeOut' } };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Outfit, sans-serif', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? SIDEBAR_W.closed : SIDEBAR_W.open }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.04)', zIndex: 10 }}
      >
        {/* Logo + collapse toggle */}
        <div style={{ padding: collapsed ? '18px 0' : '18px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0, minHeight: 68 }}>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={18} style={{ color: C.accent }} />
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0 }}>WorkAgenda</p>
                  <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Super Admin</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ width: 28, height: 28, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: C.muted }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            const badge = id === 'suporte' ? openTickets.length : id === 'tenants' ? tenants.length : 0;
            return (
              <motion.button key={id} onClick={() => setActiveTab(id)}
                whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 10, cursor: 'pointer', border: isActive ? `1px solid ${C.accentBd}` : '1px solid transparent', background: isActive ? C.accentBg : 'transparent', color: isActive ? C.accent : C.secondary, fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: isActive ? 700 : 500, width: '100%', position: 'relative', transition: 'background 150ms, color 150ms' }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {badge > 0 && !collapsed && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: id === 'suporte' ? C.amberBg : C.accentBg, color: id === 'suporte' ? C.amber : C.accent, padding: '1px 7px', borderRadius: 20, fontFamily: 'monospace', border: `1px solid ${id === 'suporte' ? C.amberBd : C.accentBd}` }}>{badge}</span>
                )}
                {badge > 0 && collapsed && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: id === 'suporte' ? C.amber : C.accent }} />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button onClick={onSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500, width: '100%', transition: 'color 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.color = C.red)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>Sair</motion.span>
              )}
            </AnimatePresence>
          </button>
          {!collapsed && (
            <p style={{ margin: 0, fontSize: 10, color: C.faint, padding: '4px 12px' }}>© WorkAgenda {new Date().getFullYear()}</p>
          )}
        </div>
      </motion.aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Page header */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.3px' }}>{PAGE_TITLES[activeTab]}</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>
              {activeTab === 'overview'    && `${tenants.length} tenants · ${active.length} ativos`}
              {activeTab === 'tenants'     && `${filteredTenants.length} de ${tenants.length} assinantes`}
              {activeTab === 'coupons'     && `${coupons.length} cupons cadastrados`}
              {activeTab === 'suporte'     && `${openTickets.length} abertos · ${supportTickets.filter(t => t.status === 'resolved').length} resolvidos`}
              {activeTab === 'logs'        && `${auditLogs.length} registros`}
              {activeTab === 'integracoes' && 'Credenciais e serviços externos'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green, background: C.greenBg, padding: '4px 10px', borderRadius: 20, border: `1px solid ${C.greenBd}`, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} className="animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} {...PAGE_TRANS}>

              {/* ══ VISÃO GERAL ══════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                    <KpiCard label="MRR"            value={fmtBrl(mrr)} sub="Receita mensal recorrente"                             color={C.accent} icon={DollarSign}  />
                    <KpiCard label="ARR"            value={fmtBrl(arr)} sub="Run rate anualizado"                                   color={C.text}   icon={TrendingUp}  />
                    <KpiCard label="ARPU"           value={fmtBrl(arpu)} sub="Por cliente ativo"                                   color={C.text}   icon={Activity}    />
                    <KpiCard label="Clientes Ativos" value={String(active.length)} sub={`${convRate.toFixed(0)}% conversão`}        color={C.green}  icon={Users}       />
                    <KpiCard label="Em Trial"       value={String(trial.length)}                                                    color={C.amber}  icon={Clock}       />
                    <KpiCard label="Churn"          value={`${churnRate.toFixed(1)}%`} sub={`${blocked.length} bloqueado${blocked.length !== 1 ? 's' : ''}`} color={churnRate > 10 ? C.red : C.muted} icon={TrendingDown} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={card}>
                      <p style={sLbl}>Distribuição de Status</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                        {[
                          { key: 'Ativos',     count: active.length,  color: C.green },
                          { key: 'Trial',      count: trial.length,   color: C.amber },
                          { key: 'Bloqueados', count: blocked.length, color: C.red   },
                        ].map(row => {
                          const pct = tenants.length ? (row.count / tenants.length) * 100 : 0;
                          return (
                            <div key={row.key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: C.secondary }}>{row.key}</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: row.color, fontFamily: 'monospace' }}>{row.count}</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 4, background: C.bg, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 4, transition: 'width 0.5s' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <AlertTriangle style={{ width: 14, height: 14, color: C.amber }} />
                        <p style={{ ...sLbl, margin: 0 }}>Vencem em 7 dias</p>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: C.amber, fontFamily: 'monospace', background: C.amberBg, padding: '1px 8px', borderRadius: 20, border: `1px solid ${C.amberBd}` }}>{soon.length}</span>
                      </div>
                      {soon.length === 0 ? (
                        <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Nenhum vencimento próximo</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {soon.slice(0, 5).map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}` }}>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{t.name}</p>
                                <p style={{ fontSize: 10, color: C.amber, margin: 0 }}>{t.status === 'trial' ? 'trial' : 'assinatura'}</p>
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.amber, fontWeight: 700 }}>{t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{ ...sLbl, margin: 0 }}>Atividade Recente</p>
                        <button onClick={() => setActiveTab('logs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                          Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {auditLogs.slice(0, 5).map(log => (
                          <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Activity style={{ width: 12, height: 12, color: C.accent }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</p>
                              <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{log.userName} · {log.timestamp?.slice(0, 10)}</p>
                            </div>
                          </div>
                        ))}
                        {auditLogs.length === 0 && <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Sem atividade registrada</p>}
                      </div>
                    </div>

                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{ ...sLbl, margin: 0 }}>Tickets Abertos</p>
                        <button onClick={() => setActiveTab('suporte')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                          Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                      {openTickets.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 8 }}>
                          <CheckCircle2 style={{ width: 28, height: 28, color: C.green }} />
                          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Tudo resolvido!</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {openTickets.slice(0, 4).map(ticket => (
                            <div key={ticket.id} onClick={() => { setActiveTab('suporte'); setSelectedTicketId(ticket.id); }}
                              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.amberBd}`, background: C.amberBg, cursor: 'pointer' }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>{ticket.title}</p>
                              <p style={{ fontSize: 10, color: C.secondary, margin: 0 }}>{ticket.tenantName}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ══ ASSINANTES ═══════════════════════════════════════════════ */}
              {activeTab === 'tenants' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                      <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.muted, pointerEvents: 'none' }} />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou telefone…" style={{ ...inp, paddingLeft: 30, fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(['all', 'active', 'trial', 'blocked'] as const).map(s => {
                        const colors: Record<string, string> = { all: C.accent, active: C.green, trial: C.amber, blocked: C.red };
                        const bgs:    Record<string, string> = { all: C.accentBg, active: C.greenBg, trial: C.amberBg, blocked: C.redBg };
                        const bds:    Record<string, string> = { all: C.accentBd, active: C.greenBd, trial: C.amberBd, blocked: C.redBd };
                        const isA = statusFilter === s;
                        return (
                          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '7px 13px', fontSize: 11, fontWeight: 700, borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', border: `1px solid ${isA ? bds[s] : C.border}`, background: isA ? bgs[s] : C.surface, color: isA ? colors[s] : C.secondary, transition: 'all 0.15s' }}>
                            {{ all: 'Todos', active: 'Ativos', trial: 'Trial', blocked: 'Bloqueados' }[s]}
                            <span style={{ marginLeft: 5, fontSize: 9, fontFamily: 'monospace', opacity: 0.8 }}>
                              {s === 'all' ? tenants.length : tenants.filter(t => t.status === s).length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                          {([
                            { key: 'name',    label: 'Assinante',  sortable: true  },
                            { key: 'plan',    label: 'Plano',      sortable: false },
                            { key: 'mrr',     label: 'MRR',        sortable: true  },
                            { key: 'status',  label: 'Status',     sortable: false },
                            { key: 'expiry',  label: 'Vencimento', sortable: true  },
                            { key: 'actions', label: '',           sortable: false },
                          ] as const).map(col => (
                            <th key={col.key} onClick={() => col.sortable && toggleSort(col.key as any)}
                              style={{ padding: '11px 14px', textAlign: col.key === 'actions' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: sortKey === col.key ? C.accent : C.muted, whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {col.label}
                                {col.sortable && (sortKey === col.key ? sortDir === 'asc' ? <ArrowUp style={{ width: 10, height: 10 }} /> : <ArrowDown style={{ width: 10, height: 10 }} /> : <ArrowUpDown style={{ width: 10, height: 10, opacity: 0.35 }} />)}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTenants.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                            <Users style={{ width: 28, height: 28, color: C.muted, display: 'block', margin: '0 auto 8px' }} />
                            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nenhum resultado encontrado</p>
                          </td></tr>
                        ) : filteredTenants.map((t, idx) => {
                          const isExp = expandedTenant === t.id;
                          const expD  = t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt;
                          const days  = daysUntil(expD);
                          const eClr  = expiryColor(days);
                          const planCfg: Record<string, [string, string]> = { anual: [C.violetBg, C.violet], mensal: [C.accentBg, C.accent], trimestral: [C.greenBg, C.green], trial: [C.amberBg, C.amber] };
                          const [planBg, planFg] = planCfg[t.plan] ?? [C.bg, C.muted];
                          return (
                            <React.Fragment key={t.id}>
                              <tr onClick={() => setExpandedTenant(isExp ? null : t.id)}
                                style={{ borderBottom: isExp ? 'none' : `1px solid ${C.border}`, background: isExp ? C.accentBg : idx % 2 === 0 ? C.surface : C.bg, cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
                                onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? C.surface : C.bg; }}>
                                <td style={{ padding: '13px 14px', maxWidth: 220 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                                    {t.logo.startsWith('data:') || t.logo.startsWith('http') ? (
                                      <img src={t.logo} alt={t.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                    ) : (
                                      <span style={{ fontSize: 20, background: C.bg, padding: '5px 6px', borderRadius: 8, border: `1px solid ${C.border}`, lineHeight: 1, display: 'block', flexShrink: 0 }}>{t.logo}</span>
                                    )}
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ fontWeight: 700, color: C.text, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                                      <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.slug}</p>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '13px 14px' }}>
                                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace', background: planBg, color: planFg, border: `1px solid ${planFg}33` }}>{t.plan}</span>
                                </td>
                                <td style={{ padding: '13px 14px' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: t.mrr > 0 ? C.green : C.muted }}>{t.mrr > 0 ? `R$ ${t.mrr.toFixed(2)}` : '—'}</span>
                                </td>
                                <td style={{ padding: '13px 14px' }}><StatusBadge status={t.status} /></td>
                                <td style={{ padding: '13px 14px' }}>
                                  {expD ? (
                                    <div>
                                      <p style={{ fontSize: 11, fontFamily: 'monospace', color: eClr, fontWeight: 700, margin: 0 }}>{expD}</p>
                                      <p style={{ fontSize: 10, color: eClr, margin: '1px 0 0', opacity: 0.8 }}>{days < 0 ? `venceu há ${Math.abs(days)}d` : days === 0 ? 'vence hoje' : `${days}d restantes`}</p>
                                    </div>
                                  ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                                  {isExp ? <ChevronUp style={{ width: 15, height: 15, color: C.accent }} /> : <ChevronDown style={{ width: 15, height: 15, color: C.muted }} />}
                                </td>
                              </tr>

                              {isExp && (
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <td colSpan={6} style={{ padding: '0 14px 16px', background: C.accentBg }}>
                                    <div style={{ borderTop: `1px solid ${C.accentBd}`, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                      <div>
                                        <p style={sLbl}>Contato</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                          {t.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Phone style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} /><a href={`https://wa.me/${t.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>{t.phone}</a></div>}
                                          {t.contactEmail && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Mail style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} /><span style={{ fontSize: 12, color: C.text }}>{t.contactEmail}</span></div>}
                                          {t.address && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}><MapPin style={{ width: 12, height: 12, color: C.muted, flexShrink: 0, marginTop: 1 }} /><span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>{t.address}</span></div>}
                                          {t.instagram && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Instagram style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} /><a href={`https://instagram.com/${t.instagram.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>{t.instagram}</a></div>}
                                        </div>
                                      </div>
                                      <div>
                                        <p style={sLbl}>Financeiro</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                          {[
                                            { k: 'MRR', v: t.mrr > 0 ? `R$ ${t.mrr.toFixed(2)}` : '—' },
                                            { k: 'ARR', v: t.mrr > 0 ? `R$ ${(t.mrr * 12).toFixed(2)}` : '—' },
                                            { k: 'Plano', v: t.plan },
                                            { k: t.status === 'trial' ? 'Trial até' : 'Assinatura até', v: expD || '—' },
                                          ].map(r => (
                                            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.accentBd}` }}>
                                              <span style={{ fontSize: 11, color: C.secondary }}>{r.k}</span>
                                              <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: r.k === 'Plano' ? 'Outfit, sans-serif' : 'monospace' }}>{r.v}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <p style={sLbl}>Ações</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                          <a href={`https://workagenda.org/${t.slug}/agendamento`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 600, boxSizing: 'border-box', width: '100%' }}>
                                            <ExternalLink style={{ width: 12, height: 12, flexShrink: 0 }} /> Ver barbearia
                                          </a>
                                          {t.status !== 'active' && (
                                            <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(t.id, 'active'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.greenBg, border: `1px solid ${C.greenBd}`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <CheckCircle style={{ width: 12, height: 12 }} /> Ativar acesso
                                            </button>
                                          )}
                                          {t.status === 'trial' && (
                                            <button onClick={e => { e.stopPropagation(); onExtendTrial(t.id); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <Clock style={{ width: 12, height: 12 }} /> Estender trial +10d
                                            </button>
                                          )}
                                          {t.status !== 'blocked' && (
                                            <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(t.id, 'blocked'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBd}`, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <Ban style={{ width: 12, height: 12 }} /> Bloquear acesso
                                            </button>
                                          )}
                                          {t.status === 'blocked' && (
                                            <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(t.id, 'trial'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <Clock style={{ width: 12, height: 12 }} /> Recolocar em trial
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredTenants.length > 0 && (
                    <p style={{ fontSize: 11, color: C.muted, textAlign: 'right', margin: 0 }}>
                      Exibindo {filteredTenants.length} de {tenants.length} assinantes{search && ` · busca: "${search}"`}
                    </p>
                  )}
                </div>
              )}

              {/* ══ CUPONS ═══════════════════════════════════════════════════ */}
              {activeTab === 'coupons' && (
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
                  <div style={{ ...card, alignSelf: 'flex-start' }}>
                    <p style={{ ...sLbl, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <Plus style={{ width: 13, height: 13 }} /> Novo Cupom
                    </p>
                    <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <span style={sLbl}>Código</span>
                        <input type="text" required maxLength={15} value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="EX: INVERNO30" style={{ ...inp, letterSpacing: '2px', fontFamily: 'monospace' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><span style={sLbl}>Desconto (%)</span><input type="number" required min={5} max={100} value={newDiscount} onChange={e => setNewDiscount(Number(e.target.value))} style={inp} /></div>
                        <div><span style={sLbl}>Expira em</span><input type="date" required value={newExpiry} onChange={e => setNewExpiry(e.target.value)} style={inp} /></div>
                      </div>
                      <button type="submit" style={{ width: '100%', padding: '11px', background: C.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Criar Cupom</button>
                    </form>
                  </div>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                          {['Código', 'Desconto', 'Expira', 'Usos', 'Status'].map(h => (
                            <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.muted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map((c, idx) => (
                          <tr key={c.id} style={{ background: idx % 2 === 0 ? C.surface : C.bg, borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: C.text, letterSpacing: '1.5px' }}>{c.code}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: C.accent }}>{c.discountPercentage}% OFF</td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: C.secondary, fontSize: 11 }}>{c.expiresAt}</td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: C.secondary }}>{c.usageCount}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: c.status === 'active' ? C.greenBg : C.redBg, color: c.status === 'active' ? C.green : C.red, border: `1px solid ${c.status === 'active' ? C.greenBd : C.redBd}` }}>
                                {c.status === 'active' ? 'Ativo' : 'Expirado'}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {coupons.length === 0 && <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhum cupom cadastrado</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ══ SUPORTE ══════════════════════════════════════════════════ */}
              {activeTab === 'suporte' && (
                <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, height: 'calc(100vh - 180px)' }}>
                  <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <p style={{ ...sLbl, marginBottom: 14 }}>Chamados</p>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {supportTickets.map(ticket => (
                        <div key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}
                          style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${selectedTicketId === ticket.id ? C.accent : C.border}`, background: selectedTicketId === ticket.id ? C.accentBg : C.surface, flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: C.muted }}>{ticket.tenantName}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', background: ticket.status === 'open' ? C.amberBg : C.greenBg, color: ticket.status === 'open' ? C.amber : C.green, border: `1px solid ${ticket.status === 'open' ? C.amberBd : C.greenBd}` }}>
                              {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{ticket.title}</p>
                          <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>{ticket.createdAt}</p>
                        </div>
                      ))}
                      {supportTickets.length === 0 && <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '32px 0' }}>Nenhum chamado</p>}
                    </div>
                  </div>

                  <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {selectedTicket ? (
                      <>
                        <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{selectedTicket.tenantName}</p>
                            <p style={{ fontSize: 12, color: C.secondary, margin: '2px 0 0' }}>{selectedTicket.title}</p>
                          </div>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.muted }}>#{selectedTicket.id.slice(0, 8)}</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                          {selectedTicket.messages.map((msg, i) => (
                            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, maxWidth: msg.sender === 'system' ? '100%' : '85%', marginLeft: msg.sender === 'superadmin' ? 'auto' : 0, background: msg.sender === 'tenant' ? C.bg : msg.sender === 'system' ? 'transparent' : C.accentBg, border: msg.sender === 'system' ? `1px dashed ${C.border}` : `1px solid ${msg.sender === 'superadmin' ? C.accentBd : C.border}`, color: C.text, textAlign: msg.sender === 'system' ? 'center' : 'left' } as React.CSSProperties}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 9, color: C.muted, fontFamily: 'monospace', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700 }}>{msg.sender === 'tenant' ? 'Cliente' : msg.sender === 'system' ? 'Sistema' : 'Suporte'}</span>
                                <span>{msg.timestamp}</span>
                              </div>
                              <p style={{ margin: 0 }}>{msg.content}</p>
                            </div>
                          ))}
                        </div>
                        {selectedTicket.status === 'open' ? (
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, flexShrink: 0 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input type="text" value={adminReply} onChange={e => setAdminReply(e.target.value)} placeholder="Responder…" style={{ ...inp, flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }} />
                              <button onClick={handleSendReply} style={{ padding: '9px 16px', background: C.accent, color: '#FFF', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 700 }}>
                                <Send style={{ width: 13, height: 13 }} /> Enviar
                              </button>
                            </div>
                            <p style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Enviar encerra o ticket</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0', flexShrink: 0 }}>
                            <CheckCircle2 style={{ width: 20, height: 20, color: C.green }} />
                            <p style={{ fontSize: 12, margin: 0, color: C.muted }}>Chamado encerrado</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted }}>
                        <HeartHandshake style={{ width: 36, height: 36, opacity: 0.25 }} />
                        <p style={{ fontSize: 13, margin: 0 }}>Selecione um chamado ao lado</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ LOGS ═════════════════════════════════════════════════════ */}
              {activeTab === 'logs' && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck style={{ width: 15, height: 15, color: C.green }} />
                      <p style={{ ...sLbl, margin: 0 }}>Audit Log · LGPD</p>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}>LGPD Ativa</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                    {auditLogs.map(log => (
                      <div key={log.id} style={{ padding: '12px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{log.userName}</span>
                            {log.tenantId && <span style={{ padding: '1px 6px', borderRadius: 4, background: C.violetBg, color: C.violet, fontSize: 9, fontWeight: 700, border: `1px solid ${C.violetBd}` }}>tenant</span>}
                          </div>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.muted }}>{log.timestamp}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: C.accentBg, color: C.accent, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, flexShrink: 0, border: `1px solid ${C.accentBd}` }}>{log.action}</span>
                          <p style={{ color: C.secondary, fontSize: 12, margin: 0 }}>{log.details}</p>
                        </div>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>Nenhum log registrado</p>}
                  </div>
                  <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, fontSize: 11, color: C.secondary, lineHeight: 1.6 }}>
                    Registros removidos após 30 dias do cancelamento. Dumps brutos de banco bloqueados por política.
                  </div>
                </div>
              )}

              {/* ══ INTEGRAÇÕES ══════════════════════════════════════════════ */}
              {activeTab === 'integracoes' && (() => {
                const StatusChip = ({ s }: { s: SvcStatus }) => {
                  if (!s) return <span style={{ fontSize: 11, color: C.muted }}>Verificando…</span>;
                  return s.ok
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} className="animate-pulse" />{s.message}</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}` }}><XCircle size={11} />{s.message}</span>;
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Barra de ação */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: C.secondary, margin: 0 }}>
                          {intStatus.checkedAt ? `Última verificação: ${new Date(intStatus.checkedAt).toLocaleTimeString('pt-BR')}` : 'Verificando serviços…'}
                        </p>
                      </div>
                      <button onClick={fetchIntStatus} disabled={intLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600, color: C.secondary, cursor: intLoading ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                        <RefreshCw size={13} style={{ animation: intLoading ? 'spin 1s linear infinite' : 'none' }} />
                        Verificar agora
                      </button>
                    </div>

                    {/* Evolution Go */}
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Zap size={20} color={C.green} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>Evolution Go</p>
                          <p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>WhatsApp API — instâncias por tenant</p>
                        </div>
                        <StatusChip s={intStatus.evogo} />
                      </div>
                      {intStatus.evogo && !intStatus.evogo.ok && (
                        <div style={{ marginTop: 14, padding: '10px 14px', background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 10, fontSize: 12, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <XCircle size={14} /> {intStatus.evogo.message}
                        </div>
                      )}
                    </div>

                    {/* Asaas */}
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DollarSign size={20} color={C.accent} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>Asaas</p>
                          <p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Gateway de pagamento — assinaturas e cobranças</p>
                        </div>
                        <StatusChip s={intStatus.asaas} />
                      </div>

                      {/* Modo sandbox / produção */}
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {intStatus.asaas?.sandbox
                            ? <><FlaskConical size={15} color={C.amber} /><div><p style={{ fontSize: 13, fontWeight: 700, color: C.amber, margin: 0 }}>Modo Sandbox</p><p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Transações de teste — não cobra de verdade</p></div></>
                            : <><Globe size={15} color={C.green} /><div><p style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: 0 }}>Modo Produção</p><p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Transações reais — cobra clientes</p></div></>
                          }
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => toggleAsaasMode(true)}
                            disabled={modeToggling || intStatus.asaas?.sandbox === true}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${C.amberBd}`, background: intStatus.asaas?.sandbox ? C.amberBg : C.surface, color: intStatus.asaas?.sandbox ? C.amber : C.secondary, cursor: (modeToggling || intStatus.asaas?.sandbox === true) ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', opacity: intStatus.asaas?.sandbox === true ? 0.7 : 1 }}>
                            <FlaskConical size={12} /> Sandbox
                          </button>
                          <button
                            onClick={() => toggleAsaasMode(false)}
                            disabled={modeToggling || intStatus.asaas?.sandbox === false}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${C.greenBd}`, background: intStatus.asaas?.sandbox === false ? C.greenBg : C.surface, color: intStatus.asaas?.sandbox === false ? C.green : C.secondary, cursor: (modeToggling || intStatus.asaas?.sandbox === false) ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', opacity: intStatus.asaas?.sandbox === false ? 0.7 : 1 }}>
                            <Globe size={12} /> Produção
                          </button>
                        </div>
                      </div>

                      {intStatus.asaas && !intStatus.asaas.ok && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 10, fontSize: 12, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <XCircle size={14} /> {intStatus.asaas.message}
                        </div>
                      )}

                      <div style={{ marginTop: 12, padding: '8px 12px', background: C.amberBg, border: `1px solid ${C.amberBd}`, borderRadius: 8, fontSize: 11, color: C.amber, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={12} />
                        A alternância de modo é temporária (reinicia com o servidor). Para tornar permanente, altere <code style={{ background: 'rgba(180,83,9,0.12)', padding: '1px 4px', borderRadius: 3 }}>ASAAS_SANDBOX</code> no EasyPanel.
                      </div>
                    </div>

                    {/* Resend */}
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Mail size={20} color={C.violet} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>Resend</p>
                          <p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Emails transacionais — boas-vindas, pagamentos, agendamentos</p>
                        </div>
                        <StatusChip s={intStatus.resend} />
                      </div>
                      {intStatus.resend && !intStatus.resend.ok && (
                        <div style={{ marginTop: 14, padding: '10px 14px', background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 10, fontSize: 12, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <XCircle size={14} /> {intStatus.resend.message}
                        </div>
                      )}
                    </div>

                    {/* Aviso geral */}
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, fontSize: 12, color: C.secondary, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={14} color={C.muted} />
                      Para alterar credenciais, edite as variáveis de ambiente do serviço <code style={{ background: C.accentBg, padding: '1px 6px', borderRadius: 4, color: C.accent }}>api</code> no EasyPanel e faça redeploy.
                    </div>
                  </div>
                );
              })()}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
