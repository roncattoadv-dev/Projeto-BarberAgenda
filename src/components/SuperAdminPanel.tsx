import React, { useState, useMemo } from 'react';
import { Tenant, Coupon, SupportTicket, AuditLog } from '../types';
import {
  LayoutDashboard, Users, Ticket, HeartHandshake, ShieldCheck,
  Plug, TrendingUp, TrendingDown, CheckCircle, Ban, Plus, Send,
  Search, AlertTriangle, ArrowUpRight, Zap,
  DollarSign, Activity, Clock, ChevronDown, ChevronUp,
  ExternalLink, Phone, MapPin, Instagram, Mail,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

interface SuperAdminPanelProps {
  tenants: Tenant[];
  onUpdateTenantStatus: (tenantId: string, status: 'active' | 'blocked' | 'trial') => void;
  onExtendTrial: (tenantId: string) => void;
  coupons: Coupon[];
  onAddCoupon: (code: string, discount: number, expiresAt: string) => void;
  supportTickets: SupportTicket[];
  onResolveTicket: (ticketId: string, replyMessage?: string) => void;
  auditLogs: AuditLog[];
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        '#030F22',
  surface:   'rgba(255,255,255,0.04)',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(255,255,255,0.16)',
  text:      'rgba(255,255,255,0.88)',
  muted:     'rgba(255,255,255,0.45)',
  faint:     'rgba(255,255,255,0.2)',
  green:     '#22c55e',
  greenBg:   'rgba(34,197,94,0.12)',
  greenBd:   'rgba(34,197,94,0.25)',
  amber:     '#f59e0b',
  amberBg:   'rgba(245,158,11,0.12)',
  amberBd:   'rgba(245,158,11,0.25)',
  red:       '#ef4444',
  redBg:     'rgba(239,68,68,0.12)',
  redBd:     'rgba(239,68,68,0.25)',
  blue:      '#60a5fa',
  blueBg:    'rgba(96,165,250,0.12)',
  blueBd:    'rgba(96,165,250,0.25)',
  violet:    '#a78bfa',
  violetBg:  'rgba(167,139,250,0.12)',
};

const card: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: C.muted,
  marginBottom: 6,
  display: 'block',
};

const darkInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '9px 12px',
  color: C.text,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'Outfit, sans-serif',
  boxSizing: 'border-box',
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tenant['status'] }) {
  const cfg = {
    active:  { label: 'Ativo',     bg: C.greenBg,  bd: C.greenBd,  dot: C.green  },
    trial:   { label: 'Trial',     bg: C.amberBg,  bd: C.amberBd,  dot: C.amber  },
    blocked: { label: 'Bloqueado', bg: C.redBg,    bd: C.redBd,    dot: C.red    },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.dot }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label: lbl, value, sub, color, icon: Icon, trend }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ElementType; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={label}>{lbl}</span>
        {Icon && <Icon style={{ width: 16, height: 16, color: C.muted }} />}
      </div>
      <div>
        <p style={{ fontSize: 26, fontWeight: 800, color: color ?? C.text, fontFamily: 'monospace', letterSpacing: '-1px', margin: 0 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</p>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          {trend === 'up'      && <TrendingUp   style={{ width: 13, height: 13, color: C.green }} />}
          {trend === 'down'    && <TrendingDown style={{ width: 13, height: 13, color: C.red   }} />}
          {trend === 'neutral' && <Activity     style={{ width: 13, height: 13, color: C.muted }} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminPanel({
  tenants,
  onUpdateTenantStatus,
  onExtendTrial,
  coupons,
  onAddCoupon,
  supportTickets,
  onResolveTicket,
  auditLogs,
}: SuperAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'coupons' | 'suporte' | 'logs' | 'integracoes'>('overview');
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Tenant['status']>('all');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [sortKey, setSortKey]   = useState<'name' | 'mrr' | 'expiry'>('mrr');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [newCode, setNewCode]       = useState('');
  const [newDiscount, setNewDiscount] = useState(15);
  const [newExpiry, setNewExpiry]   = useState('2026-12-31');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');

  // ── Metrics ───────────────────────────────────────────────────────────────
  const active  = useMemo(() => tenants.filter(t => t.status === 'active'),  [tenants]);
  const trial   = useMemo(() => tenants.filter(t => t.status === 'trial'),   [tenants]);
  const blocked = useMemo(() => tenants.filter(t => t.status === 'blocked'), [tenants]);

  const mrr  = useMemo(() => active.reduce((s, t) => s + t.mrr, 0), [active]);
  const arr  = mrr * 12;
  const arpu = active.length ? mrr / active.length : 0;
  const churnRate = tenants.length ? (blocked.length / tenants.length) * 100 : 0;
  const convRate  = tenants.length ? (active.length / tenants.length) * 100 : 0;

  const openTickets = supportTickets.filter(t => t.status === 'open');

  // Tenants expiring in next 7 days (trial or subscription)
  const soon = useMemo(() => {
    const now  = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    return tenants.filter(t => {
      const d = t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt;
      if (!d) return false;
      const dt = new Date(d);
      return dt >= now && dt <= week;
    });
  }, [tenants]);

  // ── Filtered tenants ──────────────────────────────────────────────────────
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
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [tenants, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: 'name' | 'mrr' | 'expiry') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'mrr' ? 'desc' : 'asc'); }
  };

  const daysUntil = (dateStr: string): number => {
    if (!dateStr) return -999;
    const diff = new Date(dateStr + 'T12:00:00').getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const expiryColor = (days: number) => {
    if (days < 0)  return C.red;
    if (days <= 7) return C.amber;
    if (days <= 14) return '#fbbf24';
    return C.green;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    onAddCoupon(newCode.trim().toUpperCase(), newDiscount, newExpiry);
    setNewCode('');
    setNewDiscount(15);
  };

  const handleSendReply = () => {
    if (!selectedTicketId || !adminReply.trim()) return;
    onResolveTicket(selectedTicketId, adminReply.trim());
    setAdminReply('');
    setSelectedTicketId(null);
  };

  const selectedTicket = supportTickets.find(t => t.id === selectedTicketId);

  const tabs = [
    { id: 'overview',     label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'tenants',      label: `Assinantes (${tenants.length})`, icon: Users },
    { id: 'coupons',      label: `Cupons (${coupons.length})`, icon: Ticket },
    { id: 'suporte',      label: `Suporte${openTickets.length ? ` (${openTickets.length})` : ''}`, icon: HeartHandshake },
    { id: 'logs',         label: 'Logs', icon: ShieldCheck },
    { id: 'integracoes',  label: 'Integrações', icon: Plug },
  ] as const;

  const fmtBrl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ background: C.bg, borderRadius: 20, overflow: 'hidden', fontFamily: 'Outfit, sans-serif', border: `1px solid ${C.border}` }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}`, padding: '20px 28px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap style={{ width: 18, height: 18, color: C.text }} />
              </div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>WorkAgenda Admin</h1>
                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Controle total do SaaS</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{tenants.length} tenants</span>
              <span style={{ width: 1, height: 14, background: C.border }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} className="animate-pulse" />
                Online
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 2 }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasAlert = tab.id === 'suporte' && openTickets.length > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px',
                    fontSize: 12, fontWeight: 600,
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#031D3C' : C.muted,
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  {tab.label}
                  {hasAlert && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, position: 'absolute', top: 5, right: 5 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ════════════════════════════════════════════════════════════════════
            TAB: VISÃO GERAL
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <KpiCard label="MRR" value={fmtBrl(mrr)} sub="Receita mensal recorrente" color={C.green} icon={DollarSign} trend="up" />
              <KpiCard label="ARR" value={fmtBrl(arr)} sub="Run rate anualizado" icon={TrendingUp} />
              <KpiCard label="ARPU" value={fmtBrl(arpu)} sub="Por cliente ativo" icon={Activity} />
              <KpiCard label="Clientes Ativos" value={String(active.length)} sub={`${convRate.toFixed(0)}% conversão`} color={C.text} icon={Users} />
              <KpiCard label="Em Trial" value={String(trial.length)} color={C.amber} icon={Clock} />
              <KpiCard label="Churn" value={`${churnRate.toFixed(1)}%`} sub={`${blocked.length} bloqueado${blocked.length !== 1 ? 's' : ''}`} color={churnRate > 10 ? C.red : C.muted} icon={TrendingDown} trend={churnRate > 10 ? 'down' : 'neutral'} />
            </div>

            {/* Status distribution + Expiring soon */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Distribution bar */}
              <div style={card}>
                <span style={label}>Distribuição de Status</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {[
                    { key: 'Ativos',     count: active.length,  color: C.green },
                    { key: 'Trial',      count: trial.length,   color: C.amber },
                    { key: 'Bloqueados', count: blocked.length, color: C.red   },
                  ].map(row => {
                    const pct = tenants.length ? (row.count / tenants.length) * 100 : 0;
                    return (
                      <div key={row.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: C.muted }}>{row.key}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: row.color, fontFamily: 'monospace' }}>{row.count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expiring soon */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: C.amber }} />
                  <span style={{ ...label, margin: 0 }}>Vencem em 7 dias</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.amber, fontFamily: 'monospace' }}>{soon.length}</span>
                </div>
                {soon.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.faint, textAlign: 'center', padding: '16px 0' }}>Nenhum vencimento próximo</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {soon.slice(0, 5).map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: `1px solid ${C.amberBd}` }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{t.name}</p>
                          <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{t.status === 'trial' ? 'trial' : 'assinatura'}</p>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.amber }}>
                          {t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent logs + Open tickets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Recent activity */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={label}>Atividade Recente</span>
                  <button onClick={() => setActiveTab('logs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif' }}>
                    Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {auditLogs.slice(0, 5).map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Activity style={{ width: 12, height: 12, color: C.muted }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</p>
                        <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{log.userName} · {log.timestamp?.slice(0, 10)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open tickets */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={label}>Tickets Abertos</span>
                  <button onClick={() => setActiveTab('suporte')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif' }}>
                    Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                  </button>
                </div>
                {openTickets.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 6 }}>
                    <CheckCircle style={{ width: 24, height: 24, color: C.green }} />
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Tudo resolvido!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {openTickets.slice(0, 4).map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => { setActiveTab('suporte'); setSelectedTicketId(ticket.id); }}
                        style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.amberBd}`, background: C.amberBg, cursor: 'pointer' }}
                      >
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>{ticket.title}</p>
                        <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{ticket.tenantName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: TENANTS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tenants' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Filters + search ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.muted, pointerEvents: 'none' }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nome, slug ou telefone…"
                  style={{ ...darkInput, paddingLeft: 30, fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'active', 'trial', 'blocked'] as const).map(s => {
                  const colors: Record<string, string> = { all: C.text, active: C.green, trial: C.amber, blocked: C.red };
                  const isActive = statusFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        padding: '6px 12px', fontSize: 11, fontWeight: 700,
                        borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                        border: `1px solid ${isActive ? colors[s] + '55' : C.border}`,
                        background: isActive ? colors[s] + '18' : 'transparent',
                        color: isActive ? colors[s] : C.muted,
                        transition: 'all 0.15s',
                      }}
                    >
                      {{ all: 'Todos', active: 'Ativos', trial: 'Trial', blocked: 'Bloqueados' }[s]}
                      <span style={{ marginLeft: 5, fontSize: 9, fontFamily: 'monospace', opacity: 0.8 }}>
                        {s === 'all' ? tenants.length : tenants.filter(t => t.status === s).length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${C.border}` }}>
                    {/* Sortable header helper */}
                    {([
                      { key: 'name',   label: 'Assinante',  sortable: true  },
                      { key: 'plan',   label: 'Plano',      sortable: false },
                      { key: 'mrr',    label: 'MRR',        sortable: true  },
                      { key: 'status', label: 'Status',     sortable: false },
                      { key: 'expiry', label: 'Vencimento', sortable: true  },
                      { key: 'actions',label: '',           sortable: false },
                    ] as const).map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.sortable && toggleSort(col.key as any)}
                        style={{
                          padding: '10px 14px',
                          textAlign: col.key === 'actions' ? 'right' : 'left',
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px',
                          color: sortKey === col.key ? C.text : C.muted,
                          whiteSpace: 'nowrap',
                          cursor: col.sortable ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col.label}
                          {col.sortable && (
                            sortKey === col.key
                              ? sortDir === 'asc'
                                ? <ArrowUp   style={{ width: 10, height: 10 }} />
                                : <ArrowDown style={{ width: 10, height: 10 }} />
                              : <ArrowUpDown style={{ width: 10, height: 10, opacity: 0.35 }} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <Users style={{ width: 28, height: 28, color: C.faint, display: 'block', margin: '0 auto 8px' }} />
                        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nenhum resultado encontrado</p>
                      </td>
                    </tr>
                  ) : filteredTenants.map(tenant => {
                    const isExpanded = expandedTenant === tenant.id;
                    const expiryDate = tenant.status === 'trial' ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
                    const days       = daysUntil(expiryDate);
                    const eColor     = expiryColor(days);
                    const planColors: Record<string, [string, string]> = {
                      anual:      [C.violetBg, C.violet],
                      mensal:     [C.blueBg,   C.blue  ],
                      trimestral: [C.greenBg,  C.green ],
                      trial:      [C.amberBg,  C.amber ],
                    };
                    const [planBg, planFg] = planColors[tenant.plan] ?? [C.surface, C.muted];

                    return (
                      <React.Fragment key={tenant.id}>
                        {/* ── Main row ── */}
                        <tr
                          onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}
                          style={{
                            borderBottom: isExpanded ? 'none' : `1px solid ${C.border}`,
                            background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.01)',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)'; }}
                        >
                          {/* Assinante */}
                          <td style={{ padding: '13px 14px', maxWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                              {tenant.logo.startsWith('data:') || tenant.logo.startsWith('http') ? (
                                <img src={tenant.logo} alt={tenant.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                              ) : (
                                <span style={{ fontSize: 20, background: 'rgba(255,255,255,0.06)', padding: '5px 6px', borderRadius: 8, border: `1px solid ${C.border}`, lineHeight: 1, display: 'block', flexShrink: 0 }}>
                                  {tenant.logo}
                                </span>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontWeight: 700, color: C.text, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.slug}</span>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: tenant.status === 'active' ? C.green : tenant.status === 'trial' ? C.amber : C.red }} />
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Plano */}
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace', background: planBg, color: planFg, border: `1px solid ${planFg}33` }}>
                              {tenant.plan}
                            </span>
                          </td>

                          {/* MRR */}
                          <td style={{ padding: '13px 14px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: tenant.mrr > 0 ? C.green : C.faint }}>
                              {tenant.mrr > 0 ? `R$ ${tenant.mrr.toFixed(2)}` : '—'}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '13px 14px' }}>
                            <StatusBadge status={tenant.status} />
                          </td>

                          {/* Vencimento */}
                          <td style={{ padding: '13px 14px' }}>
                            {expiryDate ? (
                              <div>
                                <p style={{ fontSize: 11, fontFamily: 'monospace', color: eColor, fontWeight: 700, margin: 0 }}>
                                  {expiryDate}
                                </p>
                                <p style={{ fontSize: 10, color: eColor, margin: '2px 0 0', opacity: 0.8 }}>
                                  {days < 0 ? `venceu há ${Math.abs(days)}d` : days === 0 ? 'vence hoje' : `${days}d restantes`}
                                </p>
                              </div>
                            ) : (
                              <span style={{ color: C.faint, fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* Chevron */}
                          <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                            {isExpanded
                              ? <ChevronUp   style={{ width: 15, height: 15, color: C.muted }} />
                              : <ChevronDown style={{ width: 15, height: 15, color: C.faint }} />
                            }
                          </td>
                        </tr>

                        {/* ── Expanded detail row ── */}
                        {isExpanded && (
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td colSpan={6} style={{ padding: '0 14px 16px', background: 'rgba(255,255,255,0.04)' }}>
                              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, overflow: 'hidden' }}>

                                {/* Contato */}
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <p style={{ ...label, marginBottom: 10 }}>Contato</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {tenant.phone && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                                        <Phone style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                        <a href={`https://wa.me/${tenant.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                          {tenant.phone}
                                        </a>
                                      </div>
                                    )}
                                    {tenant.contactEmail && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                                        <Mail style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.contactEmail}</span>
                                      </div>
                                    )}
                                    {tenant.address && (
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                                        <MapPin style={{ width: 12, height: 12, color: C.muted, flexShrink: 0, marginTop: 1 }} />
                                        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4, wordBreak: 'break-word' }}>{tenant.address}</span>
                                      </div>
                                    )}
                                    {tenant.instagram && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                                        <Instagram style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                        <a href={`https://instagram.com/${tenant.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.blue, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                                          {tenant.instagram}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Financeiro */}
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <p style={{ ...label, marginBottom: 10 }}>Financeiro</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                      { k: 'MRR',   v: tenant.mrr > 0 ? `R$ ${tenant.mrr.toFixed(2)}` : '—' },
                                      { k: 'ARR',   v: tenant.mrr > 0 ? `R$ ${(tenant.mrr * 12).toFixed(2)}` : '—' },
                                      { k: 'Plano', v: tenant.plan },
                                    ].map(r => (
                                      <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{r.k}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: r.k !== 'Plano' ? 'monospace' : 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.v}</span>
                                      </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{tenant.status === 'trial' ? 'Trial até' : 'Assinatura até'}</span>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: eColor, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{expiryDate || '—'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Ações */}
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ ...label, marginBottom: 10 }}>Ações</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    <a
                                      href={`https://workagenda.org/${tenant.slug}/agendamento`}
                                      target="_blank" rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 600, boxSizing: 'border-box', width: '100%' }}
                                    >
                                      <ExternalLink style={{ width: 12, height: 12, flexShrink: 0 }} />
                                      Ver barbearia
                                    </a>
                                    {tenant.status !== 'active' && (
                                      <button
                                        onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'active'); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBd}`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}
                                      >
                                        <CheckCircle style={{ width: 12, height: 12, flexShrink: 0 }} /> Ativar acesso
                                      </button>
                                    )}
                                    {tenant.status === 'trial' && (
                                      <button
                                        onClick={e => { e.stopPropagation(); onExtendTrial(tenant.id); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: C.amberBg, border: `1px solid ${C.amberBd}`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}
                                      >
                                        <Clock style={{ width: 12, height: 12, flexShrink: 0 }} /> Estender trial +10d
                                      </button>
                                    )}
                                    {tenant.status !== 'blocked' && (
                                      <button
                                        onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'blocked'); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBd}`, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}
                                      >
                                        <Ban style={{ width: 12, height: 12, flexShrink: 0 }} /> Bloquear acesso
                                      </button>
                                    )}
                                    {tenant.status === 'blocked' && (
                                      <button
                                        onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'trial'); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}
                                      >
                                        <Clock style={{ width: 12, height: 12, flexShrink: 0 }} /> Recolocar em trial
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

            {/* Footer count */}
            {filteredTenants.length > 0 && (
              <p style={{ fontSize: 11, color: C.faint, textAlign: 'right', margin: 0 }}>
                Exibindo {filteredTenants.length} de {tenants.length} assinantes
                {search && ` · busca: "${search}"`}
              </p>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: COUPONS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'coupons' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
            {/* Form */}
            <div style={{ ...card, alignSelf: 'flex-start' }}>
              <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <Plus style={{ width: 13, height: 13 }} /> Novo Cupom
              </span>
              <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <span style={label}>Código</span>
                  <input
                    type="text" required maxLength={15} value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="EX: INVERNO30"
                    style={{ ...darkInput, letterSpacing: '2px', fontFamily: 'monospace' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={label}>Desconto (%)</span>
                    <input type="number" required min={5} max={100} value={newDiscount} onChange={e => setNewDiscount(Number(e.target.value))} style={darkInput} />
                  </div>
                  <div>
                    <span style={label}>Expira em</span>
                    <input type="date" required value={newExpiry} onChange={e => setNewExpiry(e.target.value)} style={darkInput} />
                  </div>
                </div>
                <button type="submit" style={{ width: '100%', padding: '10px', background: '#ffffff', color: '#031D3C', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  Criar Cupom
                </button>
              </form>
            </div>

            {/* List */}
            <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${C.border}` }}>
                    {['Código', 'Desconto', 'Expira', 'Usos', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon, idx) => (
                    <tr key={coupon.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#F7F9FC', borderBottom: '1px solid #edf1f6' }}>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#111827', letterSpacing: '1.5px' }}>{coupon.code}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#111827' }}>{coupon.discountPercentage}% OFF</td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: '#64748b', fontSize: 11 }}>{coupon.expiresAt}</td>
                      <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{coupon.usageCount}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: coupon.status === 'active' ? '#E6F4EC' : '#FEECEC', color: coupon.status === 'active' ? '#0A4A2C' : '#7A0A0A' }}>
                          {coupon.status === 'active' ? 'Ativo' : 'Expirado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhum cupom cadastrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: SUPORTE
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'suporte' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Ticket list */}
            <div style={card}>
              <span style={{ ...label, marginBottom: 14, display: 'block' }}>Chamados</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    style={{
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                      border: `1px solid ${selectedTicketId === ticket.id ? C.borderHi : C.border}`,
                      background: selectedTicketId === ticket.id ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{ticket.tenantName}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        background: ticket.status === 'open' ? C.amberBg : C.greenBg,
                        color: ticket.status === 'open' ? C.amber : C.green,
                        border: `1px solid ${ticket.status === 'open' ? C.amberBd : C.greenBd}`,
                      }}>
                        {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{ticket.title}</p>
                    <p style={{ fontSize: 10, color: C.faint, margin: '4px 0 0' }}>{ticket.createdAt}</p>
                  </div>
                ))}
                {supportTickets.length === 0 && (
                  <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '32px 0' }}>Nenhum chamado</p>
                )}
              </div>
            </div>

            {/* Chat panel */}
            <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
              {selectedTicket ? (
                <>
                  <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{selectedTicket.tenantName}</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{selectedTicket.title}</p>
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.faint }}>#{selectedTicket.id}</span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, marginBottom: 16 }}>
                    {selectedTicket.messages.map((msg, i) => (
                      <div key={i} style={{
                        padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                        maxWidth: msg.sender === 'system' ? '100%' : '85%',
                        marginLeft: msg.sender === 'superadmin' ? 'auto' : 0,
                        background: msg.sender === 'tenant' ? 'rgba(255,255,255,0.05)' : msg.sender === 'system' ? 'transparent' : 'rgba(255,255,255,0.11)',
                        border: msg.sender === 'system' ? `1px dashed ${C.border}` : `1px solid ${C.border}`,
                        color: C.text,
                        textAlign: msg.sender === 'system' ? 'center' : 'left',
                      } as React.CSSProperties}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 9, color: C.faint, fontFamily: 'monospace', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>
                            {msg.sender === 'tenant' ? 'Cliente' : msg.sender === 'system' ? 'Sistema' : 'Suporte'}
                          </span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <p style={{ margin: 0 }}>{msg.content}</p>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status === 'open' ? (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text" value={adminReply} onChange={e => setAdminReply(e.target.value)}
                          placeholder="Responder…" style={{ ...darkInput, flex: 1 }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }}
                        />
                        <button onClick={handleSendReply} style={{ padding: '8px 14px', background: '#ffffff', color: '#031D3C', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Send style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                      <p style={{ fontSize: 9, color: C.faint, marginTop: 5 }}>Enviar encerra o ticket</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0', color: C.muted }}>
                      <CheckCircle style={{ width: 20, height: 20, color: C.green }} />
                      <p style={{ fontSize: 12, margin: 0 }}>Chamado encerrado</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.faint }}>
                  <HeartHandshake style={{ width: 32, height: 32, opacity: 0.4 }} />
                  <p style={{ fontSize: 12, margin: 0 }}>Selecione um chamado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: LOGS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck style={{ width: 15, height: 15, color: C.green }} />
                <span style={{ ...label, margin: 0 }}>Audit Log · LGPD</span>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}>
                LGPD Ativa
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
              {auditLogs.map(log => (
                <div key={log.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>
                      <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{log.userName}</span>
                      {log.tenantId && (
                        <span style={{ padding: '1px 6px', borderRadius: 3, background: C.violetBg, color: C.violet, fontSize: 9, border: `1px solid rgba(167,139,250,0.25)` }}>
                          tenant
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.faint }}>{log.timestamp}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(94,234,212,0.1)', color: '#5eead4', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {log.action}
                    </span>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>{log.details}</p>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '32px 0' }}>Nenhum log registrado</p>
              )}
            </div>

            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: `1px dashed ${C.border}`, fontSize: 11, color: C.faint, lineHeight: 1.6, fontFamily: 'monospace' }}>
              🔒 Registros removidos após 30 dias do cancelamento. Dumps brutos de banco bloqueados por política.
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: INTEGRAÇÕES
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'integracoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                name: 'Evolution Go',
                desc: 'WhatsApp API — instâncias por tenant',
                icon: '🟢',
                fields: [
                  { label: 'EVO_URL',        key: 'EVO_URL',        mask: false },
                  { label: 'Global API Key', key: 'EVO_GLOBAL_KEY', mask: true  },
                ],
              },
              {
                name: 'Asaas',
                desc: 'Gateway de pagamento — assinaturas e cobranças',
                icon: '💳',
                fields: [
                  { label: 'API Key',          key: 'ASAAS_API_KEY',        mask: true  },
                  { label: 'Webhook Secret',   key: 'ASAAS_WEBHOOK_TOKEN',  mask: true  },
                  { label: 'Modo',             key: 'ASAAS_SANDBOX',        mask: false },
                ],
              },
              {
                name: 'Resend',
                desc: 'Emails transacionais — boas-vindas, pagamentos, agendamentos',
                icon: '📧',
                fields: [
                  { label: 'API Key',    key: 'RESEND_API_KEY', mask: true  },
                  { label: 'Remetente', key: 'FROM_EMAIL',      mask: false },
                ],
              },
            ].map(integration => (
              <div key={integration.name} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 20 }}>{integration.icon}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{integration.name}</p>
                    <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{integration.desc}</p>
                  </div>
                  <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}>
                    Configurado
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {integration.fields.map(({ label: lbl, key, mask }) => {
                    const val = (window as any).__BARBER_CONFIG__?.[key] || '—';
                    const display = mask && val !== '—' ? '••••••••' + val.slice(-4) : val;
                    return (
                      <div key={key}>
                        <span style={label}>{lbl}</span>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: mask ? C.muted : 'rgba(255,255,255,0.7)' }}>
                          {display}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ padding: '12px 16px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}`, fontSize: 12, color: C.amber }}>
              ⚙️ Para alterar credenciais, edite as variáveis de ambiente do serviço <code style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 6px', borderRadius: 4 }}>api</code> no EasyPanel e faça redeploy.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
