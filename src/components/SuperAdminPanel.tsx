import React, { useState, useMemo } from 'react';
import { Tenant, Coupon, SupportTicket, AuditLog } from '../types';
import {
  LayoutDashboard, Users, Ticket, HeartHandshake, ShieldCheck,
  Plug, TrendingUp, TrendingDown, CheckCircle2, Ban, Plus, Send,
  Search, AlertTriangle, ArrowUpRight, Zap,
  DollarSign, Activity, Clock, ChevronDown, ChevronUp,
  ExternalLink, Phone, MapPin, Instagram, Mail,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle,
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

// ── Design tokens (light, igual ao TenantAdmin) ──────────────────────────────
const C = {
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  border:    '#E2E8F0',
  borderHi:  '#CBD5E1',
  text:      '#111827',
  secondary: '#475569',
  muted:     '#9CA3AF',
  accent:    '#2563EB',
  accentBg:  'rgba(37,99,235,0.07)',
  accentBd:  'rgba(37,99,235,0.20)',
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

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: C.muted,
  marginBottom: 6,
  display: 'block',
};

const lightInput: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '9px 12px',
  color: C.text,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'Outfit, sans-serif',
  boxSizing: 'border-box' as const,
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Tenant['status'] }) {
  const cfg = {
    active:  { label: 'Ativo',     bg: C.greenBg,  bd: C.greenBd,  color: C.green  },
    trial:   { label: 'Trial',     bg: C.amberBg,  bd: C.amberBd,  color: C.amber  },
    blocked: { label: 'Bloqueado', bg: C.redBg,    bd: C.redBd,    color: C.red    },
  }[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.bg, border: `1px solid ${cfg.bd}`, color: cfg.color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label: lbl, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ElementType;
}) {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={sectionLabel}>{lbl}</span>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
            <Icon style={{ width: 15, height: 15 }} />
          </div>
        )}
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
  auditLogs,
}: SuperAdminPanelProps) {
  const [activeTab,       setActiveTab]       = useState<'overview' | 'tenants' | 'coupons' | 'suporte' | 'logs' | 'integracoes'>('overview');
  const [search,          setSearch]          = useState('');
  const [statusFilter,    setStatusFilter]    = useState<'all' | Tenant['status']>('all');
  const [expandedTenant,  setExpandedTenant]  = useState<string | null>(null);
  const [sortKey,         setSortKey]         = useState<'name' | 'mrr' | 'expiry'>('mrr');
  const [sortDir,         setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [newCode,         setNewCode]         = useState('');
  const [newDiscount,     setNewDiscount]     = useState(15);
  const [newExpiry,       setNewExpiry]       = useState('2026-12-31');
  const [selectedTicketId,setSelectedTicketId]= useState<string | null>(null);
  const [adminReply,      setAdminReply]      = useState('');

  // ── Metrics ───────────────────────────────────────────────────────────────
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
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [tenants, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: 'name' | 'mrr' | 'expiry') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'mrr' ? 'desc' : 'asc'); }
  };

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return -999;
    return Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
  };

  const expiryColor = (days: number) => {
    if (days < 0)   return C.red;
    if (days <= 7)  return C.amber;
    if (days <= 14) return '#D97706';
    return C.green;
  };

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

  const tabs = [
    { id: 'overview',    label: 'Visão Geral',                                         icon: LayoutDashboard },
    { id: 'tenants',     label: `Assinantes (${tenants.length})`,                      icon: Users           },
    { id: 'coupons',     label: `Cupons (${coupons.length})`,                          icon: Ticket          },
    { id: 'suporte',     label: `Suporte${openTickets.length ? ` (${openTickets.length})` : ''}`, icon: HeartHandshake },
    { id: 'logs',        label: 'Logs',                                                icon: ShieldCheck     },
    { id: 'integracoes', label: 'Integrações',                                         icon: Plug            },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: 'Outfit, sans-serif' }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '4px', display: 'flex', gap: 2, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
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
                padding: '8px 16px', fontSize: 12, fontWeight: 600,
                borderRadius: 12, border: 'none', cursor: 'pointer',
                whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif',
                background: isActive ? C.accent : 'transparent',
                color: isActive ? '#FFFFFF' : C.secondary,
                transition: 'all 0.15s',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {tab.label}
              {hasAlert && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', position: 'absolute', top: 6, right: 6 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ══ VISÃO GERAL ════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            <KpiCard label="MRR"            value={fmtBrl(mrr)} sub="Receita mensal recorrente"                    color={C.accent} icon={DollarSign}  />
            <KpiCard label="ARR"            value={fmtBrl(arr)} sub="Run rate anualizado"                          color={C.text}   icon={TrendingUp}  />
            <KpiCard label="ARPU"           value={fmtBrl(arpu)} sub="Por cliente ativo"                          color={C.text}   icon={Activity}    />
            <KpiCard label="Clientes Ativos" value={String(active.length)} sub={`${convRate.toFixed(0)}% conversão`} color={C.green} icon={Users}      />
            <KpiCard label="Em Trial"       value={String(trial.length)}                                           color={C.amber}  icon={Clock}       />
            <KpiCard label="Churn"          value={`${churnRate.toFixed(1)}%`} sub={`${blocked.length} bloqueado${blocked.length !== 1 ? 's' : ''}`} color={churnRate > 10 ? C.red : C.muted} icon={TrendingDown} />
          </div>

          {/* Distribuição + Vencendo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div style={card}>
              <p style={sectionLabel}>Distribuição de Status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                {[
                  { key: 'Ativos',     count: active.length,  color: C.green, bg: C.greenBg  },
                  { key: 'Trial',      count: trial.length,   color: C.amber, bg: C.amberBg  },
                  { key: 'Bloqueados', count: blocked.length, color: C.red,   bg: C.redBg    },
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
                <p style={{ ...sectionLabel, margin: 0 }}>Vencem em 7 dias</p>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: C.amber, fontFamily: 'monospace', background: C.amberBg, padding: '1px 8px', borderRadius: 20, border: `1px solid ${C.amberBd}` }}>{soon.length}</span>
              </div>
              {soon.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted, fontSize: 13 }}>Nenhum vencimento próximo</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {soon.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}` }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{t.name}</p>
                        <p style={{ fontSize: 10, color: C.amber, margin: 0 }}>{t.status === 'trial' ? 'trial' : 'assinatura'}</p>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.amber, fontWeight: 700 }}>
                        {t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Atividade recente + Tickets abertos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ ...sectionLabel, margin: 0 }}>Atividade Recente</p>
                <button onClick={() => setActiveTab('logs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                  Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                <p style={{ ...sectionLabel, margin: 0 }}>Tickets Abertos</p>
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
                    <div key={ticket.id}
                      onClick={() => { setActiveTab('suporte'); setSelectedTicketId(ticket.id); }}
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

      {/* ══ ASSINANTES ═════════════════════════════════════════════════════════ */}
      {activeTab === 'tenants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.muted, pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, slug ou telefone…"
                style={{ ...lightInput, paddingLeft: 30, fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'active', 'trial', 'blocked'] as const).map(s => {
                const colors: Record<string, string> = { all: C.accent, active: C.green, trial: C.amber, blocked: C.red };
                const bgs: Record<string, string>    = { all: C.accentBg, active: C.greenBg, trial: C.amberBg, blocked: C.redBg };
                const bds: Record<string, string>    = { all: C.accentBd, active: C.greenBd, trial: C.amberBd, blocked: C.redBd };
                const isActive = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    padding: '7px 13px', fontSize: 11, fontWeight: 700, borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    border: `1px solid ${isActive ? bds[s] : C.border}`,
                    background: isActive ? bgs[s] : C.surface,
                    color: isActive ? colors[s] : C.secondary,
                    transition: 'all 0.15s',
                  }}>
                    {{ all: 'Todos', active: 'Ativos', trial: 'Trial', blocked: 'Bloqueados' }[s]}
                    <span style={{ marginLeft: 5, fontSize: 9, fontFamily: 'monospace', opacity: 0.8 }}>
                      {s === 'all' ? tenants.length : tenants.filter(t => t.status === s).length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabela */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  {([
                    { key: 'name',   label: 'Assinante',  sortable: true  },
                    { key: 'plan',   label: 'Plano',      sortable: false },
                    { key: 'mrr',    label: 'MRR',        sortable: true  },
                    { key: 'status', label: 'Status',     sortable: false },
                    { key: 'expiry', label: 'Vencimento', sortable: true  },
                    { key: 'actions',label: '',           sortable: false },
                  ] as const).map(col => (
                    <th key={col.key}
                      onClick={() => col.sortable && toggleSort(col.key as any)}
                      style={{ padding: '11px 14px', textAlign: col.key === 'actions' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: sortKey === col.key ? C.accent : C.muted, whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.label}
                        {col.sortable && (sortKey === col.key
                          ? sortDir === 'asc' ? <ArrowUp style={{ width: 10, height: 10 }} /> : <ArrowDown style={{ width: 10, height: 10 }} />
                          : <ArrowUpDown style={{ width: 10, height: 10, opacity: 0.35 }} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <Users style={{ width: 28, height: 28, color: C.muted, display: 'block', margin: '0 auto 8px' }} />
                      <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Nenhum resultado encontrado</p>
                    </td>
                  </tr>
                ) : filteredTenants.map((tenant, idx) => {
                  const isExpanded = expandedTenant === tenant.id;
                  const expiryDate = tenant.status === 'trial' ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
                  const days       = daysUntil(expiryDate);
                  const eColor     = expiryColor(days);
                  const planCfg: Record<string, [string, string]> = {
                    anual:      [C.violetBg, C.violet],
                    mensal:     [C.accentBg, C.accent],
                    trimestral: [C.greenBg,  C.green ],
                    trial:      [C.amberBg,  C.amber ],
                  };
                  const [planBg, planFg] = planCfg[tenant.plan] ?? [C.bg, C.muted];

                  return (
                    <React.Fragment key={tenant.id}>
                      <tr onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}
                        style={{ borderBottom: isExpanded ? 'none' : `1px solid ${C.border}`, background: isExpanded ? C.accentBg : idx % 2 === 0 ? C.surface : C.bg, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#EFF6FF'; }}
                        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? C.surface : C.bg; }}>

                        {/* Assinante */}
                        <td style={{ padding: '13px 14px', maxWidth: 220 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                            {tenant.logo.startsWith('data:') || tenant.logo.startsWith('http') ? (
                              <img src={tenant.logo} alt={tenant.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                            ) : (
                              <span style={{ fontSize: 20, background: C.bg, padding: '5px 6px', borderRadius: 8, border: `1px solid ${C.border}`, lineHeight: 1, display: 'block', flexShrink: 0 }}>{tenant.logo}</span>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontWeight: 700, color: C.text, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.name}</p>
                              <p style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.slug}</p>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace', background: planBg, color: planFg, border: `1px solid ${planFg}33` }}>
                            {tenant.plan}
                          </span>
                        </td>

                        {/* MRR */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: tenant.mrr > 0 ? C.green : C.muted }}>
                            {tenant.mrr > 0 ? `R$ ${tenant.mrr.toFixed(2)}` : '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '13px 14px' }}><StatusBadge status={tenant.status} /></td>

                        {/* Vencimento */}
                        <td style={{ padding: '13px 14px' }}>
                          {expiryDate ? (
                            <div>
                              <p style={{ fontSize: 11, fontFamily: 'monospace', color: eColor, fontWeight: 700, margin: 0 }}>{expiryDate}</p>
                              <p style={{ fontSize: 10, color: eColor, margin: '1px 0 0', opacity: 0.8 }}>
                                {days < 0 ? `venceu há ${Math.abs(days)}d` : days === 0 ? 'vence hoje' : `${days}d restantes`}
                              </p>
                            </div>
                          ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                        </td>

                        {/* Chevron */}
                        <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                          {isExpanded ? <ChevronUp style={{ width: 15, height: 15, color: C.accent }} /> : <ChevronDown style={{ width: 15, height: 15, color: C.muted }} />}
                        </td>
                      </tr>

                      {/* Expanded */}
                      {isExpanded && (
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td colSpan={6} style={{ padding: '0 14px 16px', background: C.accentBg }}>
                            <div style={{ borderTop: `1px solid ${C.accentBd}`, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

                              {/* Contato */}
                              <div>
                                <p style={sectionLabel}>Contato</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                  {tenant.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      <Phone style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                      <a href={`https://wa.me/${tenant.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>{tenant.phone}</a>
                                    </div>
                                  )}
                                  {tenant.contactEmail && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      <Mail style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                      <span style={{ fontSize: 12, color: C.text }}>{tenant.contactEmail}</span>
                                    </div>
                                  )}
                                  {tenant.address && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                                      <MapPin style={{ width: 12, height: 12, color: C.muted, flexShrink: 0, marginTop: 1 }} />
                                      <span style={{ fontSize: 12, color: C.secondary, lineHeight: 1.4 }}>{tenant.address}</span>
                                    </div>
                                  )}
                                  {tenant.instagram && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                      <Instagram style={{ width: 12, height: 12, color: C.muted, flexShrink: 0 }} />
                                      <a href={`https://instagram.com/${tenant.instagram.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>{tenant.instagram}</a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Financeiro */}
                              <div>
                                <p style={sectionLabel}>Financeiro</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {[
                                    { k: 'MRR',   v: tenant.mrr > 0 ? `R$ ${tenant.mrr.toFixed(2)}` : '—' },
                                    { k: 'ARR',   v: tenant.mrr > 0 ? `R$ ${(tenant.mrr * 12).toFixed(2)}` : '—' },
                                    { k: 'Plano', v: tenant.plan },
                                    { k: tenant.status === 'trial' ? 'Trial até' : 'Assinatura até', v: expiryDate || '—' },
                                  ].map(r => (
                                    <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.accentBd}` }}>
                                      <span style={{ fontSize: 11, color: C.secondary }}>{r.k}</span>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: r.k === 'Plano' ? 'Outfit, sans-serif' : 'monospace' }}>{r.v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Ações */}
                              <div>
                                <p style={sectionLabel}>Ações</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                  <a href={`https://workagenda.org/${tenant.slug}/agendamento`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 600, boxSizing: 'border-box', width: '100%' }}>
                                    <ExternalLink style={{ width: 12, height: 12, flexShrink: 0 }} /> Ver barbearia
                                  </a>
                                  {tenant.status !== 'active' && (
                                    <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'active'); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.greenBg, border: `1px solid ${C.greenBd}`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                      <CheckCircle style={{ width: 12, height: 12, flexShrink: 0 }} /> Ativar acesso
                                    </button>
                                  )}
                                  {tenant.status === 'trial' && (
                                    <button onClick={e => { e.stopPropagation(); onExtendTrial(tenant.id); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                      <Clock style={{ width: 12, height: 12, flexShrink: 0 }} /> Estender trial +10d
                                    </button>
                                  )}
                                  {tenant.status !== 'blocked' && (
                                    <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'blocked'); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBd}`, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                      <Ban style={{ width: 12, height: 12, flexShrink: 0 }} /> Bloquear acesso
                                    </button>
                                  )}
                                  {tenant.status === 'blocked' && (
                                    <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(tenant.id, 'trial'); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
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

          {filteredTenants.length > 0 && (
            <p style={{ fontSize: 11, color: C.muted, textAlign: 'right', margin: 0 }}>
              Exibindo {filteredTenants.length} de {tenants.length} assinantes{search && ` · busca: "${search}"`}
            </p>
          )}
        </div>
      )}

      {/* ══ CUPONS ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'coupons' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div style={{ ...card, alignSelf: 'flex-start' }}>
            <p style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Plus style={{ width: 13, height: 13 }} /> Novo Cupom
            </p>
            <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span style={sectionLabel}>Código</span>
                <input type="text" required maxLength={15} value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="EX: INVERNO30" style={{ ...lightInput, letterSpacing: '2px', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span style={sectionLabel}>Desconto (%)</span>
                  <input type="number" required min={5} max={100} value={newDiscount} onChange={e => setNewDiscount(Number(e.target.value))} style={lightInput} />
                </div>
                <div>
                  <span style={sectionLabel}>Expira em</span>
                  <input type="date" required value={newExpiry} onChange={e => setNewExpiry(e.target.value)} style={lightInput} />
                </div>
              </div>
              <button type="submit" style={{ width: '100%', padding: '11px', background: C.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Criar Cupom
              </button>
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
                {coupons.map((coupon, idx) => (
                  <tr key={coupon.id} style={{ background: idx % 2 === 0 ? C.surface : C.bg, borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: C.text, letterSpacing: '1.5px' }}>{coupon.code}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: C.accent }}>{coupon.discountPercentage}% OFF</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: C.secondary, fontSize: 11 }}>{coupon.expiresAt}</td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: C.secondary }}>{coupon.usageCount}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: coupon.status === 'active' ? C.greenBg : C.redBg, color: coupon.status === 'active' ? C.green : C.red, border: `1px solid ${coupon.status === 'active' ? C.greenBd : C.redBd}` }}>
                        {coupon.status === 'active' ? 'Ativo' : 'Expirado'}
                      </span>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhum cupom cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SUPORTE ════════════════════════════════════════════════════════════ */}
      {activeTab === 'suporte' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Lista de tickets */}
          <div style={card}>
            <p style={{ ...sectionLabel, marginBottom: 14 }}>Chamados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
              {supportTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}
                  style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${selectedTicketId === ticket.id ? C.accent : C.border}`, background: selectedTicketId === ticket.id ? C.accentBg : C.surface }}>
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

          {/* Chat */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 440 }}>
            {selectedTicket ? (
              <>
                <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{selectedTicket.tenantName}</p>
                    <p style={{ fontSize: 11, color: C.secondary, margin: '2px 0 0' }}>{selectedTicket.title}</p>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.muted }}>#{selectedTicket.id.slice(0, 8)}</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, marginBottom: 16 }}>
                  {selectedTicket.messages.map((msg, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                      maxWidth: msg.sender === 'system' ? '100%' : '85%',
                      marginLeft: msg.sender === 'superadmin' ? 'auto' : 0,
                      background: msg.sender === 'tenant' ? C.bg : msg.sender === 'system' ? 'transparent' : C.accentBg,
                      border: msg.sender === 'system' ? `1px dashed ${C.border}` : `1px solid ${msg.sender === 'superadmin' ? C.accentBd : C.border}`,
                      color: C.text,
                      textAlign: msg.sender === 'system' ? 'center' : 'left',
                    } as React.CSSProperties}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 9, color: C.muted, fontFamily: 'monospace', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{msg.sender === 'tenant' ? 'Cliente' : msg.sender === 'system' ? 'Sistema' : 'Suporte'}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p style={{ margin: 0 }}>{msg.content}</p>
                    </div>
                  ))}
                </div>

                {selectedTicket.status === 'open' ? (
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" value={adminReply} onChange={e => setAdminReply(e.target.value)}
                        placeholder="Responder…" style={{ ...lightInput, flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }} />
                      <button onClick={handleSendReply} style={{ padding: '8px 14px', background: C.accent, color: '#FFFFFF', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Send style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <p style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>Enviar encerra o ticket</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0', color: C.muted }}>
                    <CheckCircle2 style={{ width: 20, height: 20, color: C.green }} />
                    <p style={{ fontSize: 12, margin: 0 }}>Chamado encerrado</p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.muted }}>
                <HeartHandshake style={{ width: 32, height: 32, opacity: 0.3 }} />
                <p style={{ fontSize: 12, margin: 0 }}>Selecione um chamado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ LOGS ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck style={{ width: 15, height: 15, color: C.green }} />
              <p style={{ ...sectionLabel, margin: 0 }}>Audit Log · LGPD</p>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}>
              LGPD Ativa
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
            {auditLogs.map(log => (
              <div key={log.id} style={{ padding: '12px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{log.userName}</span>
                    {log.tenantId && (
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: C.violetBg, color: C.violet, fontSize: 9, fontWeight: 700, border: `1px solid ${C.violetBd}` }}>
                        tenant
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.muted }}>{log.timestamp}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: C.accentBg, color: C.accent, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, flexShrink: 0, border: `1px solid ${C.accentBd}` }}>
                    {log.action}
                  </span>
                  <p style={{ color: C.secondary, fontSize: 12, margin: 0 }}>{log.details}</p>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>Nenhum log registrado</p>}
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, fontSize: 11, color: C.secondary, lineHeight: 1.6, fontFamily: 'monospace' }}>
            Registros removidos após 30 dias do cancelamento. Dumps brutos de banco bloqueados por política.
          </div>
        </div>
      )}

      {/* ══ INTEGRAÇÕES ════════════════════════════════════════════════════════ */}
      {activeTab === 'integracoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { name: 'Evolution Go', desc: 'WhatsApp API — instâncias por tenant',                         icon: <Zap size={18} color={C.green} />,    fields: [{ label: 'EVO_URL', key: 'EVO_URL', mask: false }, { label: 'Global API Key', key: 'EVO_GLOBAL_KEY', mask: true }] },
            { name: 'Asaas',        desc: 'Gateway de pagamento — assinaturas e cobranças',               icon: <DollarSign size={18} color={C.accent} />, fields: [{ label: 'API Key', key: 'ASAAS_API_KEY', mask: true }, { label: 'Webhook Secret', key: 'ASAAS_WEBHOOK_TOKEN', mask: true }, { label: 'Modo', key: 'ASAAS_SANDBOX', mask: false }] },
            { name: 'Resend',       desc: 'Emails transacionais — boas-vindas, pagamentos, agendamentos', icon: <Mail size={18} color={C.violet} />,   fields: [{ label: 'API Key', key: 'RESEND_API_KEY', mask: true }, { label: 'Remetente', key: 'FROM_EMAIL', mask: false }] },
          ].map(integration => (
            <div key={integration.name} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {integration.icon}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{integration.name}</p>
                  <p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>{integration.desc}</p>
                </div>
                <span style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBd}` }}>
                  Configurado
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {integration.fields.map(({ label: lbl, key, mask }) => {
                  const val = (window as any).__BARBER_CONFIG__?.[key] || '—';
                  const display = mask && val !== '—' ? '••••••••' + val.slice(-4) : val;
                  return (
                    <div key={key}>
                      <span style={sectionLabel}>{lbl}</span>
                      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: mask ? C.muted : C.text }}>
                        {display}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ padding: '12px 16px', borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}`, fontSize: 12, color: C.amber, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} />
            Para alterar credenciais, edite as variáveis de ambiente do serviço <code style={{ background: 'rgba(180,83,9,0.12)', padding: '1px 6px', borderRadius: 4 }}>api</code> no EasyPanel e faça redeploy.
          </div>
        </div>
      )}

    </div>
  );
}
