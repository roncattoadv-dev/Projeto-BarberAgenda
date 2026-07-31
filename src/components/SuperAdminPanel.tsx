import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tenant, Coupon, SupportTicket, AuditLog } from '../types';
import {
  LayoutDashboard, Users, HeartHandshake, ShieldCheck,
  Plug, TrendingUp, TrendingDown, CheckCircle2, Ban, Plus, Send,
  Search, AlertTriangle, ArrowUpRight, Zap,
  DollarSign, Activity, Clock, ChevronDown, ChevronUp,
  ExternalLink, Phone, MapPin, Instagram, Mail,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle, LogOut,
  ChevronLeft, ChevronRight, RefreshCw, XCircle, FlaskConical, Globe, Trash2,
  Megaphone, Eye, CalendarCheck, User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || '').replace(/\/$/, '');
}

interface SuperAdminPanelProps {
  tenants: Tenant[];
  tenantEmails: Record<string, string>;
  onUpdateTenantStatus: (tenantId: string, status: 'active' | 'blocked' | 'trial') => void;
  onExtendTrial: (tenantId: string) => void;
  onDeleteTenant?: (tenantId: string) => Promise<void>;
  coupons: Coupon[];
  onAddCoupon: (code: string, discount: number, expiresAt: string) => void;
  supportTickets: SupportTicket[];
  onResolveTicket: (ticketId: string, replyMessage?: string) => void;
  auditLogs: AuditLog[];
  onSignOut: () => void;
}

type Tab = 'overview' | 'tenants' | 'suporte' | 'logs' | 'integracoes' | 'marketing';

const NAV: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Visão Geral',  Icon: LayoutDashboard },
  { id: 'tenants',     label: 'Assinantes',   Icon: Users           },
  { id: 'suporte',     label: 'Suporte',      Icon: HeartHandshake  },
  { id: 'logs',        label: 'Logs',         Icon: ShieldCheck     },
  { id: 'integracoes', label: 'Integrações',  Icon: Plug            },
  { id: 'marketing',   label: 'Marketing',    Icon: Megaphone       },
];

const PAGE_TITLES: Record<Tab, string> = {
  overview:    'Visão Geral',
  tenants:     'Assinantes',
  suporte:     'Suporte',
  logs:        'Audit Log',
  integracoes: 'Integrações',
  marketing:   'Email Marketing',
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
      <p style={{ fontSize: 26, fontWeight: 800, color: color ?? C.text, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Dropdown multi-select (igual AgendaTab) ───────────────────────────────────
function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  const displayLabel = selected.length === 0 ? label
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? label)
    : `${selected.length} filtros`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif', background: selected.length > 0 ? C.accentBg : C.surface, border: `1px solid ${selected.length > 0 ? C.accentBd : C.border}`, borderRadius: 10, color: selected.length > 0 ? C.accent : C.secondary, cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap' as const }}>
        {displayLabel}
        <ChevronDown size={12} style={{ color: C.muted, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, minWidth: 200, padding: 6 }}>
          {selected.length > 0 && (
            <button type="button" onClick={() => { onChange([]); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left' as const, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', borderRadius: 6, marginBottom: 2 }}>
              Limpar filtros
            </button>
          )}
          {options.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 8, background: selected.includes(o.value) ? C.accentBg : 'transparent' }}>
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)}
                style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: selected.includes(o.value) ? 700 : 500, color: selected.includes(o.value) ? C.accent : C.text, fontFamily: 'Outfit, sans-serif', flex: 1 }}>
                {o.label}
              </span>
              {o.count !== undefined && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.muted }}>{o.count}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdminPanel({
  tenants, tenantEmails, onUpdateTenantStatus, onExtendTrial, onDeleteTenant,
  coupons, onAddCoupon,
  supportTickets, onResolveTicket,
  auditLogs, onSignOut,
}: SuperAdminPanelProps) {
  const { session } = useAuth();

  const [activeTab,        setActiveTab]        = useState<Tab>('overview');

  // ── Integrações: status e toggle ─────────────────────────────────────────
  type SvcStatus = { ok: boolean; message: string; sandbox?: boolean } | null;
  const [intStatus,    setIntStatus]    = useState<{ evogo: SvcStatus; asaas: SvcStatus & { sandbox?: boolean } | null; resend: SvcStatus; checkedAt: string | null }>({ evogo: null, asaas: null, resend: null, checkedAt: null });
  const [intLoading,   setIntLoading]   = useState(false);
  const [modeToggling, setModeToggling] = useState(false);

  const fetchIntStatus = useCallback(async () => {
    setIntLoading(true);
    try {
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
  const [statusFilter,     setStatusFilter]     = useState<string[]>([]);
  const [expandedTenant,   setExpandedTenant]   = useState<string | null>(null);
  const [deleteConfirm,    setDeleteConfirm]    = useState<{ id: string; name: string } | null>(null);
  const [deleting,         setDeleting]         = useState(false);
  const [sortKey,          setSortKey]          = useState<'name' | 'mrr' | 'expiry'>('mrr');
  const [sortDir,          setSortDir]          = useState<'asc' | 'desc'>('desc');
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
      .filter(t => statusFilter.length === 0 || statusFilter.includes(t.status))
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

  const handleSendReply = () => {
    if (!selectedTicketId || !adminReply.trim()) return;
    onResolveTicket(selectedTicketId, adminReply.trim());
    setAdminReply(''); setSelectedTicketId(null);
  };

  const selectedTicket = supportTickets.find(t => t.id === selectedTicketId);
  const fmtBrl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Marketing ──────────────────────────────────────────────────────────────
  type MktCampaign = {
    id: string; name: string; campaign_type: string; subject: string;
    filters: Record<string, any>; last_sent_at: string | null; last_sent_count: number | null; created_at: string;
  };
  const CAMPAIGN_PRESETS = [
    { id: 'trial_welcome',    label: 'Boas-vindas Trial',      period: 'Ao criar conta',         filters: { status: ['trial'] } },
    { id: 'trial_activation', label: 'Ativar WhatsApp',        period: 'Dia 2 do trial',          filters: { status: ['trial'] } },
    { id: 'trial_expiring',   label: 'Trial expirando',        period: '2 dias antes de vencer',  filters: { status: ['trial'], trial_expiring_in_days: 2 } },
    { id: 'trial_expired',    label: 'Trial expirado',         period: 'Após vencer',             filters: { status: ['blocked'] } },
    { id: 'reactivation',     label: 'Reativação',             period: 'Mensal para bloqueados',  filters: { status: ['blocked'] } },
    { id: 'annual_upgrade',   label: 'Upgrade Anual',          period: 'Trimestral para mensais', filters: { status: ['active'], plan: ['mensal'] } },
    { id: 'newsletter',       label: 'Newsletter Mensal',      period: 'Todo dia 1º do mês',      filters: { status: ['active', 'trial'] } },
    { id: 'nps',              label: 'Pesquisa NPS',           period: 'Trimestral 30d+',         filters: { status: ['active'], subscription_days_min: 30 } },
  ];
  const [mktCampaigns,   setMktCampaigns]   = useState<MktCampaign[]>([]);
  const [mktLoading,     setMktLoading]     = useState(false);
  const [mktForm,        setMktForm]        = useState<{ name: string; campaign_type: string; subject: string; filters: Record<string, any> } | null>(null);
  const [mktPreview,     setMktPreview]     = useState<{ count: number; sample: { email: string; name: string }[]; html: string } | null>(null);
  const [mktSending,     setMktSending]     = useState<string | null>(null);
  const [mktResult,      setMktResult]      = useState<{ sent: number; skipped: number } | null>(null);
  const [mktPreviewOpen, setMktPreviewOpen] = useState(false);

  const fetchMktCampaigns = useCallback(async () => {
    setMktLoading(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/marketing/campaigns`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      if (r.ok) setMktCampaigns(await r.json());
    } catch {}
    setMktLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'marketing') fetchMktCampaigns(); }, [activeTab, fetchMktCampaigns]);

  const mktPreviewCampaign = async (form: typeof mktForm) => {
    if (!form) return;
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/marketing/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: form.filters, campaign_type: form.campaign_type }),
      });
      if (r.ok) { setMktPreview(await r.json()); setMktPreviewOpen(true); }
    } catch {}
  };

  const mktSaveCampaign = async () => {
    if (!mktForm) return;
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/marketing/campaigns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mktForm),
      });
      if (r.ok) { setMktForm(null); fetchMktCampaigns(); }
    } catch {}
  };

  const mktDeleteCampaign = async (id: string) => {
    if (!confirm('Apagar esta campanha?')) return;
    try {
      await fetch(`${getApiUrl()}/api/admin/marketing/campaigns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      fetchMktCampaigns();
    } catch {}
  };

  const mktSendCampaign = async (id: string) => {
    if (!confirm('Disparar esta campanha agora? Os emails serão enviados para todos os destinatários filtrados.')) return;
    setMktSending(id); setMktResult(null);
    try {
      const r = await fetch(`${getApiUrl()}/api/admin/marketing/campaigns/${id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      if (r.ok) { setMktResult(await r.json()); fetchMktCampaigns(); }
    } catch {}
    setMktSending(null);
  };

  const PAGE_TRANS = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.2, ease: 'easeOut' } };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Outfit, sans-serif', background: C.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: SIDEBAR_W.open }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.04)', zIndex: 10 }}
      >
        {/* Logo + collapse toggle */}
        <div style={{ padding: '18px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, minHeight: 68 }}>
          <AnimatePresence>
            {true && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png"
                  alt="WorkAgenda"
                  style={{ height: 72, objectFit: 'contain', flexShrink: 0 }}
                />
                <p style={{ fontSize: 10, color: C.muted, margin: 0, whiteSpace: 'nowrap' }}>Super Admin</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            const badge = id === 'suporte' ? openTickets.length : id === 'tenants' ? tenants.length : 0;
            return (
              <motion.button key={id} onClick={() => setActiveTab(id)}
                whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', justifyContent: 'flex-start', borderRadius: 10, cursor: 'pointer', border: isActive ? `1px solid ${C.accentBd}` : '1px solid transparent', background: isActive ? C.accentBg : 'transparent', color: isActive ? C.accent : C.secondary, fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: isActive ? 700 : 500, width: '100%', position: 'relative', transition: 'background 150ms, color 150ms' }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {true && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {badge > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: id === 'suporte' ? C.amberBg : C.accentBg, color: id === 'suporte' ? C.amber : C.accent, padding: '1px 7px', borderRadius: 20, fontFamily: 'monospace', border: `1px solid ${id === 'suporte' ? C.amberBd : C.accentBd}` }}>{badge}</span>
                )}
                {false && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: id === 'suporte' ? C.amber : C.accent }} />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button onClick={onSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', justifyContent: 'flex-start', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500, width: '100%', transition: 'color 150ms' }}
            onMouseEnter={e => (e.currentTarget.style.color = C.red)}
            onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
            <LogOut size={14} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {true && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>Sair</motion.span>
              )}
            </AnimatePresence>
          </button>
          {true && (
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

                  {/* ── KPIs financeiros ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    {[
                      {
                        label: 'MRR — Receita Mensal Recorrente',
                        value: fmtBrl(mrr),
                        desc: 'Total gerado mensalmente por todas as assinaturas ativas. Principal indicador de saúde financeira do SaaS.',
                        color: C.accent, icon: DollarSign,
                      },
                      {
                        label: 'ARR — Receita Anual Recorrente',
                        value: fmtBrl(arr),
                        desc: `Projeção anual baseada no MRR atual (MRR × 12). Representa o valor contratado para os próximos 12 meses.`,
                        color: C.accent, icon: TrendingUp,
                      },
                      {
                        label: 'ARPU — Receita Média por Usuário',
                        value: fmtBrl(arpu),
                        desc: 'Quanto cada assinante ativo gera em média por mês. Aumenta com upsell de planos maiores.',
                        color: C.accent, icon: Activity,
                      },
                    ].map(k => (
                      <div key={k.label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: C.secondary, margin: 0, lineHeight: 1.4 }}>{k.label}</p>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <k.icon style={{ width: 15, height: 15, color: C.accent }} />
                          </div>
                        </div>
                        <p style={{ fontSize: 28, fontWeight: 900, color: k.color, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', margin: 0 }}>{k.value}</p>
                        <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.55 }}>{k.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── KPIs de clientes ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {[
                      {
                        label: 'Assinantes Ativos',
                        value: String(active.length),
                        badge: `${convRate.toFixed(0)}% de conversão`,
                        badgeColor: C.accent, badgeBg: C.accentBg, badgeBd: C.accentBd,
                        desc: 'Negócios com assinatura paga e em dia. São a base de receita real da plataforma.',
                        color: C.accent, icon: Users,
                      },
                      {
                        label: 'Em Período de Teste (Trial)',
                        value: String(trial.length),
                        badge: `${trial.length} potenciais clientes`,
                        badgeColor: C.amber, badgeBg: C.amberBg, badgeBd: C.amberBd,
                        desc: 'Negócios no trial gratuito de 7 dias. Ainda não converteram para assinatura paga.',
                        color: C.amber, icon: Clock,
                      },
                      {
                        label: 'Taxa de Cancelamento (Churn)',
                        value: `${churnRate.toFixed(1)}%`,
                        badge: `${blocked.length} bloqueado${blocked.length !== 1 ? 's' : ''}`,
                        badgeColor: churnRate > 10 ? C.red : C.muted,
                        badgeBg: churnRate > 10 ? C.redBg : C.bg,
                        badgeBd: churnRate > 10 ? C.redBd : C.border,
                        desc: 'Percentual de clientes cancelados ou bloqueados sobre o total. Saudável abaixo de 5%.',
                        color: churnRate > 10 ? C.red : C.muted, icon: TrendingDown,
                      },
                    ].map(k => (
                      <div key={k.label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: C.secondary, margin: 0, lineHeight: 1.4 }}>{k.label}</p>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <k.icon style={{ width: 15, height: 15, color: C.accent }} />
                          </div>
                        </div>
                        <p style={{ fontSize: 32, fontWeight: 900, color: k.color, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px', margin: 0 }}>{k.value}</p>
                        <span style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: k.badgeBg, color: k.badgeColor, border: `1px solid ${k.badgeBd}` }}>{k.badge}</span>
                        <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.55 }}>{k.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Gráficos de distribuição e vencimentos ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                    {/* Distribuição — barras azuis com tonalidades */}
                    <div style={card}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Distribuição de Assinantes</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 16px', lineHeight: 1.5 }}>Proporção de clientes por status. Ideal: maior fatia em Ativos, menor em Bloqueados.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[
                          { key: 'Assinantes Ativos',          count: active.length,  bar: C.accent,   label: 'Pagando e com acesso completo' },
                          { key: 'Em Trial (teste gratuito)',   count: trial.length,   bar: '#60A5FA',  label: 'Dentro do período experimental' },
                          { key: 'Bloqueados (inadimplentes)',  count: blocked.length, bar: '#93C5FD',  label: 'Acesso suspenso por falta de pagamento' },
                        ].map(row => {
                          const pct = tenants.length ? (row.count / tenants.length) * 100 : 0;
                          return (
                            <div key={row.key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 5 }}>
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>{row.key}</p>
                                  <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>{row.label}</p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                                  <span style={{ fontSize: 16, fontWeight: 900, color: row.bar, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{row.count}</span>
                                  <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>{pct.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div style={{ height: 8, borderRadius: 6, background: C.bg, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${row.bar}, ${row.bar}cc)`, borderRadius: 6, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Barra total empilhada */}
                      {tenants.length > 0 && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 10, color: C.muted, margin: '0 0 6px' }}>Visão consolidada — {tenants.length} assinantes total</p>
                          <div style={{ height: 10, borderRadius: 6, display: 'flex', overflow: 'hidden', border: `1px solid ${C.border}` }}>
                            {[
                              { count: active.length,  color: C.accent  },
                              { count: trial.length,   color: '#60A5FA' },
                              { count: blocked.length, color: '#93C5FD' },
                            ].map((seg, i) => (
                              <div key={i} style={{ width: `${(seg.count / tenants.length) * 100}%`, background: seg.color, transition: 'width 0.6s ease' }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vencimentos próximos */}
                    <div style={card}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Vencimentos nos Próximos 7 Dias</p>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 14px', lineHeight: 1.5 }}>Assinantes com trial ou assinatura expirando em breve. Atenção para converter ou renovar.</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <AlertTriangle style={{ width: 13, height: 13, color: C.amber }} />
                        <span style={{ fontSize: 12, color: C.secondary }}>{soon.length === 0 ? 'Nenhum vencimento próximo' : `${soon.length} assinante${soon.length !== 1 ? 's' : ''} a vencer`}</span>
                        {soon.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: C.amber, fontFamily: 'monospace', background: C.amberBg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${C.amberBd}` }}>{soon.length}</span>}
                      </div>
                      {soon.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', background: C.accentBg, borderRadius: 12, border: `1px solid ${C.accentBd}` }}>
                          <CheckCircle2 style={{ width: 24, height: 24, color: C.accent, display: 'block', margin: '0 auto 6px' }} />
                          <p style={{ fontSize: 12, color: C.accent, fontWeight: 600, margin: 0 }}>Sem vencimentos nos próximos 7 dias</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {soon.slice(0, 5).map(t => {
                            const expDate = t.status === 'trial' ? t.trialEndsAt : t.subscriptionEndsAt;
                            const d = daysUntil(expDate || '');
                            return (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amberBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 900, color: C.amber, fontFamily: 'Outfit, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                                  {d}d
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                                  <p style={{ fontSize: 10, color: C.secondary, margin: 0 }}>{t.status === 'trial' ? 'Trial expira em' : 'Assinatura expira em'} {expDate}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Atividade + Tickets ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Atividade Recente</p>
                        <button onClick={() => setActiveTab('logs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                          Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 14px' }}>Últimas ações registradas no audit log de administração.</p>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Chamados de Suporte Abertos</p>
                        <button onClick={() => setActiveTab('suporte')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                          Ver tudo <ArrowUpRight style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 14px' }}>Tickets enviados por assinantes aguardando resposta.</p>
                      {openTickets.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 8, background: C.accentBg, borderRadius: 12, border: `1px solid ${C.accentBd}` }}>
                          <CheckCircle2 style={{ width: 28, height: 28, color: C.accent }} />
                          <p style={{ fontSize: 13, color: C.accent, fontWeight: 600, margin: 0 }}>Nenhum chamado em aberto</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {openTickets.slice(0, 4).map(ticket => (
                            <div key={ticket.id} onClick={() => { setActiveTab('suporte'); setSelectedTicketId(ticket.id); }}
                              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.accentBd}`, background: C.accentBg, cursor: 'pointer' }}>
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <MultiSelect
                      label="Status"
                      selected={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: 'active',  label: 'Ativos',     count: tenants.filter(t => t.status === 'active').length  },
                        { value: 'trial',   label: 'Em Trial',   count: tenants.filter(t => t.status === 'trial').length   },
                        { value: 'blocked', label: 'Bloqueados', count: tenants.filter(t => t.status === 'blocked').length },
                      ]}
                    />
                    <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                      <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: C.muted, pointerEvents: 'none' }} />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou telefone…" style={{ ...inp, paddingLeft: 30, fontSize: 12 }} />
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
                                    {t.logo && (t.logo.startsWith('data:') || t.logo.startsWith('http')) ? (
                                      <img src={t.logo} alt={t.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}`, flexShrink: 0 }} />
                                    ) : (
                                      <div style={{ width: 36, height: 36, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <User size={16} style={{ color: C.muted }} />
                                      </div>
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
                                          {tenantEmails[t.id] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                              <Mail style={{ width: 12, height: 12, color: C.accent, flexShrink: 0 }} />
                                              <a href={`mailto:${tenantEmails[t.id]}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600 }}>{tenantEmails[t.id]}</a>
                                              <span style={{ fontSize: 9, background: C.accentBg, color: C.accent, border: `1px solid ${C.accentBd}`, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>login</span>
                                            </div>
                                          )}
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
                                              <Clock style={{ width: 12, height: 12 }} /> Estender trial +7d
                                            </button>
                                          )}
                                          {t.status !== 'blocked' && (
                                            <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(t.id, 'blocked'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBd}`, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <Ban style={{ width: 12, height: 12 }} /> Bloquear acesso
                                            </button>
                                          )}
                                          {t.status !== 'trial' && (
                                            <button onClick={e => { e.stopPropagation(); onUpdateTenantStatus(t.id, 'trial'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box' }}>
                                              <Clock style={{ width: 12, height: 12 }} /> Recolocar em trial
                                            </button>
                                          )}
                                          {onDeleteTenant && (
                                            <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: t.id, name: t.name }); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBd}`, color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%', boxSizing: 'border-box', marginTop: 4 }}>
                                              <Trash2 style={{ width: 12, height: 12 }} /> Apagar conta permanentemente
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

                      {/* Toggle sandbox / produção */}
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        {/* Label do modo atual */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {intStatus.asaas?.sandbox
                            ? <><FlaskConical size={15} color={C.amber} /><div><p style={{ fontSize: 13, fontWeight: 700, color: C.amber, margin: 0 }}>Modo Sandbox</p><p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Transações de teste — não cobra de verdade</p></div></>
                            : <><Globe size={15} color={C.green} /><div><p style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: 0 }}>Modo Produção</p><p style={{ fontSize: 11, color: C.secondary, margin: 0 }}>Transações reais — cobra clientes</p></div></>
                          }
                        </div>

                        {/* Toggle switch */}
                        <button
                          onClick={() => toggleAsaasMode(!intStatus.asaas?.sandbox)}
                          disabled={modeToggling || intStatus.asaas === null}
                          title={intStatus.asaas?.sandbox ? 'Clique para ativar Produção' : 'Clique para ativar Sandbox'}
                          style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'none', border: 'none', cursor: (modeToggling || intStatus.asaas === null) ? 'default' : 'pointer', padding: 0, opacity: modeToggling ? 0.6 : 1 }}>
                          {/* Track */}
                          <div style={{ width: 52, height: 28, borderRadius: 99, background: intStatus.asaas?.sandbox ? C.amberBg : C.greenBg, border: `2px solid ${intStatus.asaas?.sandbox ? C.amberBd : C.greenBd}`, position: 'relative', transition: 'background 0.25s, border-color 0.25s', flexShrink: 0 }}>
                            {/* Thumb */}
                            <div style={{ position: 'absolute', top: 2, left: intStatus.asaas?.sandbox ? 2 : 22, width: 20, height: 20, borderRadius: '50%', background: intStatus.asaas?.sandbox ? C.amber : C.green, transition: 'left 0.25s, background 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {modeToggling
                                ? <RefreshCw size={10} color="#fff" style={{ animation: 'spin 0.8s linear infinite' }} />
                                : intStatus.asaas?.sandbox
                                  ? <FlaskConical size={10} color="#fff" />
                                  : <Globe size={10} color="#fff" />
                              }
                            </div>
                          </div>
                        </button>
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

            {/* ── Marketing tab ─────────────────────────────────────────────── */}
              {activeTab === 'marketing' && (() => {
                const presetMap = Object.fromEntries(CAMPAIGN_PRESETS.map(p => [p.id, p]));
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Header + new campaign button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, color: C.secondary }}>Crie e dispare campanhas de email para grupos segmentados de usuários.</p>
                      </div>
                      <button onClick={() => setMktForm({ name: '', campaign_type: 'newsletter', subject: '', filters: {} })}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                        <Plus size={14} /> Nova Campanha
                      </button>
                    </div>

                    {/* Result banner */}
                    {mktResult && (
                      <div style={{ padding: '12px 16px', borderRadius: 12, background: C.greenBg, border: `1px solid ${C.greenBd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                          ✓ Campanha disparada — {mktResult.sent} enviados, {mktResult.skipped} já recebidos anteriormente
                        </span>
                        <button onClick={() => setMktResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, fontWeight: 700, fontSize: 16, lineHeight: 1 }}>×</button>
                      </div>
                    )}

                    {/* Presets reference */}
                    <div style={{ ...card }}>
                      <p style={{ ...sLbl, marginBottom: 12 }}>Tipos de campanha disponíveis</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
                        {CAMPAIGN_PRESETS.map(p => (
                          <div key={p.id} style={{ padding: '10px 14px', borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.label}</span>
                            <span style={{ fontSize: 11, color: C.muted }}>{p.period}</span>
                            <span style={{ fontSize: 10, color: C.secondary, fontFamily: 'monospace', marginTop: 2 }}>{p.id}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Campaign form */}
                    {mktForm && (
                      <div style={{ ...card, border: `1px solid ${C.accentBd}`, background: C.accentBg }}>
                        <p style={{ ...sLbl, color: C.accent, marginBottom: 14 }}>Nova Campanha</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                          <div>
                            <label style={sLbl}>Nome interno</label>
                            <input style={inp} value={mktForm.name} onChange={e => setMktForm(f => f && ({ ...f, name: e.target.value }))} placeholder="Ex: Trial expirando — Jun/26" />
                          </div>
                          <div>
                            <label style={sLbl}>Tipo de campanha</label>
                            <select style={{ ...inp }}
                              value={mktForm.campaign_type}
                              onChange={e => {
                                const preset = CAMPAIGN_PRESETS.find(p => p.id === e.target.value);
                                setMktForm(f => f && ({ ...f, campaign_type: e.target.value, filters: preset?.filters ?? f.filters }));
                              }}>
                              {CAMPAIGN_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                          </div>
                          <div style={{ gridColumn: '1/-1' }}>
                            <label style={sLbl}>Assunto do email</label>
                            <input style={inp} value={mktForm.subject} onChange={e => setMktForm(f => f && ({ ...f, subject: e.target.value }))} placeholder="Ex: Seu trial vence em 2 dias — assine agora" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => mktPreviewCampaign(mktForm)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: C.surface, border: `1px solid ${C.accentBd}`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.accent, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                            <Eye size={13} /> Pré-visualizar
                          </button>
                          <button onClick={mktSaveCampaign} disabled={!mktForm.name || !mktForm.subject}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: C.accent, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: !mktForm.name || !mktForm.subject ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', opacity: !mktForm.name || !mktForm.subject ? 0.5 : 1 }}>
                            <CheckCircle size={13} /> Salvar
                          </button>
                          <button onClick={() => setMktForm(null)}
                            style={{ padding: '9px 14px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.secondary, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Campaigns list */}
                    {mktLoading ? (
                      <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Carregando campanhas…</div>
                    ) : mktCampaigns.length === 0 ? (
                      <div style={{ ...card, textAlign: 'center', padding: 40, color: C.muted }}>
                        <Megaphone size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: 14 }}>Nenhuma campanha criada ainda.</p>
                        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Crie sua primeira campanha acima.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {mktCampaigns.map(c => {
                          const preset = presetMap[c.campaign_type];
                          return (
                            <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: C.accentBg, border: `1px solid ${C.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Megaphone size={16} color={C.accent} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{c.subject}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', padding: '2px 8px', borderRadius: 20, background: C.accentBg, color: C.accent, border: `1px solid ${C.accentBd}` }}>{preset?.label ?? c.campaign_type}</span>
                                  {c.last_sent_at && (
                                    <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <CalendarCheck size={11} />
                                      Último envio: {new Date(c.last_sent_at).toLocaleDateString('pt-BR')} — {c.last_sent_count ?? 0} emails
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                                <button onClick={() => mktSendCampaign(c.id)} disabled={!!mktSending}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.green, border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#fff', cursor: mktSending ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', opacity: mktSending === c.id ? 0.6 : 1 }}>
                                  {mktSending === c.id ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</> : <><Send size={12} /> Disparar</>}
                                </button>
                                <button onClick={() => mktDeleteCampaign(c.id)}
                                  style={{ padding: '8px 10px', background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Trash2 size={13} color={C.red} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Modal de pré-visualização de email ──────────────────────────────── */}
      {mktPreviewOpen && mktPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setMktPreviewOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Pré-visualização do email</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{mktPreview.count} destinatário{mktPreview.count !== 1 ? 's' : ''} · Amostra: {mktPreview.sample.map(s => s.email).join(', ')}</p>
              </div>
              <button onClick={() => setMktPreviewOpen(false)}
                style={{ padding: '6px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.secondary, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Fechar
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              <iframe srcDoc={mktPreview.html} style={{ width: '100%', height: 600, border: 'none' }} title="Email preview" />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação de exclusão ─────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => !deleting && setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 18, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.redBg, border: `1px solid ${C.redBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={20} color={C.red} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: 0 }}>Apagar conta permanentemente</p>
                <p style={{ fontSize: 12, color: C.secondary, margin: '2px 0 0' }}>{deleteConfirm.name}</p>
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 12, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: C.red, fontWeight: 700, margin: '0 0 6px' }}>Esta ação é irreversível.</p>
              <p style={{ fontSize: 12, color: C.red, margin: 0, lineHeight: 1.6 }}>
                Todos os dados do tenant serão removidos permanentemente: agendamentos, clientes, serviços, profissionais, pagamentos e usuários associados.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ flex: 1, padding: '12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: C.secondary, cursor: deleting ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!onDeleteTenant) return;
                  setDeleting(true);
                  try {
                    await onDeleteTenant(deleteConfirm.id);
                    setDeleteConfirm(null);
                  } catch (err: any) {
                    alert(`Erro ao apagar: ${err?.message ?? 'tente novamente'}`);
                  }
                  setDeleting(false);
                }}
                disabled={deleting}
                style={{ flex: 1, padding: '12px', background: C.red, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', cursor: deleting ? 'default' : 'pointer', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: deleting ? 0.7 : 1 }}>
                {deleting ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Apagando…</> : <><Trash2 size={14} /> Apagar permanentemente</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
