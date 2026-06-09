/**
 * ClientAdminPanel — redesign SaaS-first
 * Sidebar 5-item colapsável · Command bar · FAB · Agenda como tela principal
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, MessageSquare, Settings, List, Store,
  Plus, Search, ExternalLink, ChevronLeft, ChevronRight,
  Check, X, RefreshCw, Scissors, CreditCard, Package,
  Menu, Bell, User, ChevronDown, Zap, Copy, CheckCheck, Pencil,
  Palette, Phone, MapPin, Instagram, Eye, EyeOff,
} from 'lucide-react';

import { Tenant, Service, Professional, Product, Appointment, Payment, Customer } from '../types';
import { useToast } from '../hooks/useToast';
import { uploadTenantLogo, remindAppointmentWhatsApp } from '../lib/db';
import { supabase } from '../lib/supabase';
import LogoCropModal from './LogoCropModal';
import AgendaTab       from './tabs/AgendaTab';
import AgendamentosTab from './tabs/AgendamentosTab';
import FinanceiroTab   from './tabs/FinanceiroTab';
import WhatsAppTab     from './tabs/WhatsAppTab';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'agenda' | 'agendamentos' | 'clientes' | 'negocio' | 'automacoes' | 'configuracoes';
type CfgTab = 'identidade' | 'horarios' | 'equipe' | 'catalogo' | 'financeiro' | 'pagina-cliente' | 'assinatura' | 'conta';

interface Props {
  activeTenant: Tenant;
  services: Service[];
  professionals: Professional[];
  products: Product[];
  customers: Customer[];
  appointments: Appointment[];
  payments: Payment[];
  onAddService: (s: Omit<Service, 'id'>) => void;
  onUpdateService: (id: string, s: Partial<Omit<Service, 'id'>>) => void | Promise<void>;
  onDeleteService: (id: string) => void | Promise<void>;
  onAddProfessional: (p: Omit<Professional, 'id'>) => void;
  onUpdateProfessional: (id: string, p: Partial<Omit<Professional, 'id' | 'tenantId'>>) => void;
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProductStock: (id: string, stock: number) => void;
  onAddAppointment: (a: Omit<Appointment, 'id'>) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onAddPayment: (pay: Omit<Payment, 'id'>) => void;
  onAddCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer>;
  onUpdateCustomer: (id: string, updates: { name?: string; phone?: string; email?: string }) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onUpdateTenantDetails: (tenantId: string, details: Partial<Tenant>) => void | Promise<void>;
  onSwitchToBookingFlow: (slug: string) => void;
  onDeleteAccount: () => Promise<void>;
  openSubscriptionTab?: boolean;
  onSubscriptionTabOpened?: () => void;
}

// ── Motion presets ─────────────────────────────────────────────────────────────
const PAGE_TRANSITION = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22, ease: 'easeOut' } };
const SIDEBAR_W = { open: 220, closed: 64 };

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'agenda',        label: 'Agenda',       Icon: Calendar      },
  { id: 'agendamentos',  label: 'Agendamentos', Icon: List          },
  { id: 'clientes',      label: 'Clientes',     Icon: Users         },
  { id: 'negocio',       label: 'Meu Negócio',  Icon: Store         },
  { id: 'automacoes',    label: 'Automações',   Icon: MessageSquare },
  { id: 'configuracoes', label: 'Config.',      Icon: Settings      },
];

const PAGE_TITLES: Record<Tab, string> = {
  agenda: 'Agenda', agendamentos: 'Agendamentos', clientes: 'Clientes',
  negocio: 'Meu Negócio', automacoes: 'Automações', configuracoes: 'Configurações',
};

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = { confirmed: '#22c55e', pending: '#f59e0b', cancelled: '#ef4444', attended: '#3b82f6' };

export default function ClientAdminPanel({
  activeTenant, services, professionals, products, customers, appointments, payments,
  onAddService, onUpdateService, onDeleteService,
  onAddProfessional, onUpdateProfessional, onAddProduct, onUpdateProductStock,
  onAddAppointment, onUpdateAppointmentStatus, onAddPayment, onAddCustomer, onUpdateCustomer, onDeleteCustomer,
  onUpdateTenantDetails, onSwitchToBookingFlow, onDeleteAccount,
  openSubscriptionTab, onSubscriptionTabOpened,
}: Props) {
  const toast = useToast();

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<Tab>('agenda');
  const [cfgTab,       setCfgTab]       = useState<CfgTab>('identidade');

  useEffect(() => {
    if (openSubscriptionTab) {
      setActiveTab('configuracoes');
      setCfgTab('assinatura');
      onSubscriptionTabOpened?.();
    }
  }, [openSubscriptionTab]);
  const [collapsed,    setCollapsed]    = useState(false);
  const [fabOpen,      setFabOpen]      = useState(false);
  const [cmdOpen,      setCmdOpen]      = useState(false);
  const [cmdQuery,     setCmdQuery]     = useState('');
  const cmdRef = useRef<HTMLInputElement>(null);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const myServices      = services.filter(s => s.tenantId === activeTenant.id);
  const myProfessionals = professionals.filter(p => p.tenantId === activeTenant.id);
  const myProducts      = products.filter(p => p.tenantId === activeTenant.id);
  const myCustomers     = customers.filter(c => c.tenantId === activeTenant.id);
  const myAppointments  = appointments.filter(a => a.tenantId === activeTenant.id);
  const myPayments      = payments.filter(p => p.tenantId === activeTenant.id);

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = myAppointments.filter(a => a.date === today && a.status !== 'cancelled');
  const pendingCount = myAppointments.filter(a => a.status === 'pending').length;

  const [linkCopied,      setLinkCopied]      = useState(false);
  const [deleteStep,      setDeleteStep]      = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deleteInput,     setDeleteInput]     = useState('');
  const [pixCopied,    setPixCopied]    = useState(false);
  const [billingModal, setBillingModal] = useState<null | {
    plan: 'mensal' | 'trimestral' | 'anual';
    step: 'form' | 'loading' | 'payment' | 'success';
    cpfCnpj: string;
    pixImage?: string;
    pixCode?: string;
    payUrl?: string;
    error?: string;
  }>(null);

  // Polling: detecta pagamento confirmado enquanto modal está aberto
  useEffect(() => {
    if (billingModal?.step !== 'payment') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('tenants').select('status').eq('id', activeTenant.id).maybeSingle();
      if (data?.status === 'active') {
        clearInterval(interval);
        setBillingModal(prev => prev ? { ...prev, step: 'success' } : null);
        setTimeout(() => window.location.reload(), 3500);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [billingModal?.step, activeTenant.id]);
  const handleCopyLink = () => {
    const url = `${window.location.origin}/${activeTenant.slug}/agendamento`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // ── Agenda form state ─────────────────────────────────────────────────────
  const [apptSrvId,  setApptSrvId]  = useState('');
  const [apptProfId, setApptProfId] = useState('');
  const [apptCustId, setApptCustId] = useState('');
  const [apptDate,   setApptDate]   = useState(today);
  const [apptTime,   setApptTime]   = useState('09:00');
  const [apptNotes,  setApptNotes]  = useState('');
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptNewClient,      setApptNewClient]      = useState(false);
  const [apptNewClientName,  setApptNewClientName]  = useState('');
  const [apptNewClientPhone, setApptNewClientPhone] = useState('');

  // ── Clientes state ────────────────────────────────────────────────────────
  const [custSearch,    setCustSearch]    = useState('');
  const [custName,      setCustName]      = useState('');
  const [custPhone,     setCustPhone]     = useState('');
  const [custEmail,     setCustEmail]     = useState('');
  const [editingCust,   setEditingCust]   = useState<Customer | null>(null);

  const startEditCust = (c: Customer) => {
    setEditingCust(c);
    setCustName(c.name); setCustPhone(c.phone); setCustEmail(c.email || '');
  };
  const cancelEditCust = () => {
    setEditingCust(null);
    setCustName(''); setCustPhone(''); setCustEmail('');
  };

  // ── Config state ──────────────────────────────────────────────────────────
  const [uploadingLogo,    setUploadingLogo]    = useState(false);
  const [cropSrc,          setCropSrc]          = useState<string | null>(null);
  const [tenantLogo,       setTenantLogo]       = useState(activeTenant.logo     || '');
  const [tenantName,       setTenantName]       = useState(activeTenant.name     || '');
  const [tenantPhone,      setTenantPhone]      = useState(activeTenant.phone    || '');
  const [tenantAddress,    setTenantAddress]    = useState(activeTenant.address  || '');
  const [tenantInstagram,  setTenantInstagram]  = useState(activeTenant.instagram || '');
  const DEFAULT_HOURS = ['09:40','10:20','11:00','13:30','14:10','14:50','15:30','16:10','16:50','17:30','18:10'];
  const ALL_DAYS = ['seg','ter','qua','qui','sex','sab','dom'];

  const [editedDays,       setEditedDays]       = useState<string[]>(activeTenant.businessDays || ['seg','ter','qua','qui','sex','sab']);
  const [selectedHoursDay, setSelectedHoursDay] = useState('seg');
  const [editedHoursByDay, setEditedHoursByDay] = useState<Record<string, string[]>>(
    activeTenant.businessHoursByDay && Object.keys(activeTenant.businessHoursByDay).length > 0
      ? activeTenant.businessHoursByDay
      : Object.fromEntries(ALL_DAYS.map(d => [d, d === 'dom' ? [] : [...DEFAULT_HOURS]]))
  );
  const [newHourInput,     setNewHourInput]     = useState('');
  const [blockedDates,     setBlockedDates]     = useState<string[]>(activeTenant.blockedDates ?? []);
  const [vacStartDate,     setVacStartDate]     = useState('');

  // ── Booking page config ────────────────────────────────────────────────────
  const [bookingPrimaryColor,  setBookingPrimaryColor]  = useState(activeTenant.bookingPageConfig?.primaryColor  ?? '#2563EB');
  const [bookingShowPhone,     setBookingShowPhone]     = useState(activeTenant.bookingPageConfig?.showPhone     ?? true);
  const [bookingShowAddress,   setBookingShowAddress]   = useState(activeTenant.bookingPageConfig?.showAddress   ?? true);
  const [bookingShowInstagram, setBookingShowInstagram] = useState(activeTenant.bookingPageConfig?.showInstagram ?? true);
  const [vacEndDate,       setVacEndDate]       = useState('');
  const PRESET_SERVICES: { name: string; durationMinutes: number; category: Service['category'] }[] = [
    { name: 'Barba',                        durationMinutes: 40, category: 'Barba'  },
    { name: 'Cabelo',                       durationMinutes: 40, category: 'Cabelo' },
    { name: 'Cabelo + Barba',               durationMinutes: 60, category: 'Combo'  },
    { name: 'Cabelo + Barba máquina',       durationMinutes: 40, category: 'Combo'  },
    { name: 'Cabelo + Barba + sobrancelha', durationMinutes: 60, category: 'Combo'  },
    { name: 'Cabelo + sobrancelha',         durationMinutes: 40, category: 'Cabelo' },
  ];
  const [presetPrices,   setPresetPrices]   = useState<Record<string, number>>(
    Object.fromEntries(PRESET_SERVICES.map(p => [p.name, 0]))
  );
  const [srvName,        setSrvName]        = useState('');
  const [srvPrice,       setSrvPrice]       = useState(50);
  const [srvDuration,    setSrvDuration]    = useState(30);
  const [srvCategory,    setSrvCategory]    = useState<Service['category']>('Cabelo');
  const [editingSrv,     setEditingSrv]     = useState<Service | null>(null);
  const [profName,       setProfName]       = useState('');
  const [profRole,       setProfRole]       = useState('Barbeiro');
  const [profCommission, setProfCommission] = useState(40);
  const [profAvatar,     setProfAvatar]     = useState('');
  const [profDays,       setProfDays]       = useState<string[]>(['seg','ter','qua','qui','sex','sab']);
  const [editingProf,    setEditingProf]    = useState<Professional | null>(null);

  const startEditProf = (p: Professional) => {
    setEditingProf(p);
    setProfName(p.name);
    setProfRole(p.role);
    setProfAvatar(p.avatar || '');
    setProfCommission(p.commissionPercentage);
    setProfDays(p.businessDays || ['seg','ter','qua','qui','sex','sab']);
  };
  const cancelEditProf = () => {
    setEditingProf(null);
    setProfName(''); setProfRole('Barbeiro'); setProfAvatar('');
    setProfCommission(40); setProfDays(['seg','ter','qua','qui','sex','sab']);
  };

  const logoInputRef   = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTenantLogo(activeTenant.logo || '');
    setTenantName(activeTenant.name || '');
    setTenantPhone(activeTenant.phone || '');
    setTenantAddress(activeTenant.address || '');
    setTenantInstagram(activeTenant.instagram || '');
    setEditedDays(activeTenant.businessDays || ['seg','ter','qua','qui','sex','sab']);
    setEditedHoursByDay(
      activeTenant.businessHoursByDay && Object.keys(activeTenant.businessHoursByDay).length > 0
        ? activeTenant.businessHoursByDay
        : Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d => [d, d === 'dom' ? [] : [...DEFAULT_HOURS]]))
    );
    setBlockedDates(activeTenant.blockedDates ?? []);
    setBookingPrimaryColor(activeTenant.bookingPageConfig?.primaryColor  ?? '#2563EB');
    setBookingShowPhone(activeTenant.bookingPageConfig?.showPhone     ?? true);
    setBookingShowAddress(activeTenant.bookingPageConfig?.showAddress   ?? true);
    setBookingShowInstagram(activeTenant.bookingPageConfig?.showInstagram ?? true);
  }, [activeTenant.id]);

  // ── ⌘K handler ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape') { setCmdOpen(false); setFabOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (cmdOpen) setTimeout(() => cmdRef.current?.focus(), 50); }, [cmdOpen]);

  const NEGOCIO_TABS: CfgTab[] = ['identidade', 'horarios', 'equipe', 'catalogo', 'financeiro'];
  const CONFIG_TABS:  CfgTab[] = ['assinatura', 'conta'];
  useEffect(() => {
    if (activeTab === 'negocio'       && !NEGOCIO_TABS.includes(cfgTab)) setCfgTab('identidade');
    if (activeTab === 'configuracoes' && !CONFIG_TABS.includes(cfgTab))  setCfgTab('assinatura');
  }, [activeTab]);

  const cmdResults = useMemo(() => {
    if (!cmdQuery.trim()) return [];
    const q = cmdQuery.toLowerCase();
    return myCustomers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [cmdQuery, myCustomers]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const fileToDataURL = (f: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f);
  });

  const handleCompleteAppointment = (appt: Appointment) => {
    onUpdateAppointmentStatus(appt.id, 'attended');
    onAddPayment({ tenantId: activeTenant.id, appointmentId: appt.id, amount: appt.price, method: 'pix', status: 'paid', date: new Date().toISOString().replace('T', ' ').substring(0, 19), description: `Atendimento: ${appt.customerName}` });
    toast.success(`${appt.customerName} concluído — R$ ${appt.price.toFixed(2)} registrado.`);
  };

  const handleManualAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptSrvId || !apptProfId) { toast.error('Selecione serviço e profissional.'); return; }
    if (!apptNewClient && !apptCustId) { toast.error('Selecione um cliente ou crie um novo.'); return; }
    if (apptNewClient && !apptNewClientName.trim()) { toast.error('Informe o nome do cliente.'); return; }
    const srv = myServices.find(s => s.id === apptSrvId);
    if (!srv) return;
    const conflict = myAppointments.some(a => a.date === apptDate && a.time === apptTime && a.professionalId === apptProfId && a.status !== 'cancelled');
    if (conflict) { toast.error(`Conflito: profissional já ocupado em ${apptDate} às ${apptTime}.`); return; }
    let custId: string, custName: string, custPhone: string;
    if (apptNewClient) {
      const created = await onAddCustomer({ tenantId: activeTenant.id, name: apptNewClientName.trim(), phone: apptNewClientPhone.trim(), email: '' });
      custId = created.id; custName = created.name; custPhone = created.phone;
    } else {
      const cust = myCustomers.find(c => c.id === apptCustId);
      if (!cust) return;
      custId = cust.id; custName = cust.name; custPhone = cust.phone;
    }
    onAddAppointment({ tenantId: activeTenant.id, serviceId: apptSrvId, professionalId: apptProfId, customerId: custId, customerName: custName, customerPhone: custPhone, date: apptDate, time: apptTime, durationMinutes: srv.durationMinutes, price: srv.price, status: 'confirmed', notes: apptNotes });
    setApptNotes(''); setApptNewClient(false); setApptNewClientName(''); setApptNewClientPhone(''); setShowApptForm(false);
    toast.success('Agendamento criado!');
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) { toast.error('Nome e telefone obrigatórios.'); return; }
    if (editingCust) {
      await onUpdateCustomer(editingCust.id, { name: custName, phone: custPhone, email: custEmail });
      toast.success('Cliente atualizado!');
      cancelEditCust();
    } else {
      await onAddCustomer({ tenantId: activeTenant.id, name: custName, email: custEmail || `${custName.replace(/\s/g, '')}@barber.com`, phone: custPhone });
      setCustName(''); setCustPhone(''); setCustEmail('');
      toast.success('Cliente cadastrado!');
    }
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    setUploadingLogo(true);
    try {
      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
      const baseUrl = await uploadTenantLogo(activeTenant.id, file);
      const url = `${baseUrl}?t=${Date.now()}`;
      setTenantLogo(url);
      await onUpdateTenantDetails(activeTenant.id, { logo: url });
      toast.success('Logo atualizado!');
    } catch { toast.error('Falha ao enviar logo.'); }
    finally { setUploadingLogo(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#031D3C', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Crop modal ── */}
      {cropSrc && <LogoCropModal imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />}

      {/* ── ⌘K Command palette ── */}
      <AnimatePresence>
        {cmdOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            onClick={() => setCmdOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}>
            <motion.div initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 520, background: '#021340', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 10 }}>
                <Search size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                <input ref={cmdRef} value={cmdQuery} onChange={e => setCmdQuery(e.target.value)}
                  placeholder="Buscar cliente…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.88)', fontSize: 15, fontFamily: 'Outfit, sans-serif' }} />
                <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>ESC</kbd>
              </div>
              {cmdResults.length > 0 && (
                <div style={{ maxHeight: 320, overflowY: 'auto' }} className="no-scrollbar">
                  {cmdResults.map(c => (
                    <div key={c.id} onClick={() => { setActiveTab('clientes'); setCmdOpen(false); setCmdQuery(''); }}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>{c.name[0]}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{c.phone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cmdQuery && cmdResults.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum cliente encontrado</div>
              )}
              {!cmdQuery && (
                <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['📅 Agenda', 'agenda'], ['📋 Agendamentos', 'agendamentos'], ['👥 Clientes', 'clientes']].map(([label, tab]) => (
                    <button key={tab} onClick={() => { setActiveTab(tab as Tab); setCmdOpen(false); }}
                      style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Topbar ── */}
      <header style={{ height: 48, background: '#021340', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 }}>
        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Menu size={14} />
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, overflow: 'hidden' }}>
          {(tenantLogo?.startsWith('http') || tenantLogo?.startsWith('data:'))
            ? <div style={{ width: 22, height: 22, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}><img src={tenantLogo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
            : <Scissors size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          }
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.38)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTenant.name}</span>
          <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{PAGE_TITLES[activeTab]}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* ⌘K search */}
        <button onClick={() => setCmdOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: 'rgba(255,255,255,0.38)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
          <Search size={12} />
          <span style={{ display: 'none' }} className="sm-show">Buscar</span>
          <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 5px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>⌘K</kbd>
        </button>

        {/* Pendentes badge */}
        {pendingCount > 0 && (
          <button onClick={() => setActiveTab('agendamentos')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, color: '#fcd34d', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
          </button>
        )}

        {/* Status + link público */}
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', background: activeTenant.status === 'active' ? '#E6F4EC' : '#FEF9EC', color: activeTenant.status === 'active' ? '#0A4A2C' : '#7A4B0A' }}>
          {activeTenant.status === 'active' ? 'Ativo' : 'Teste'}
        </span>
        <button onClick={() => onSwitchToBookingFlow(activeTenant.slug)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
          Link <ExternalLink size={11} />
        </button>
        <button onClick={handleCopyLink} title="Copiar link de agendamento"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: linkCopied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${linkCopied ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 8, color: linkCopied ? '#4ade80' : 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'all 200ms' }}>
          {linkCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <motion.aside
          animate={{ width: collapsed ? SIDEBAR_W.closed : SIDEBAR_W.open }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: '#021340', borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 48, height: 'calc(100vh - 48px)' }}
        >
          <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              const badge = id === 'agendamentos' ? pendingCount : id === 'agenda' ? todayAppts.length : 0;
              return (
                <motion.button key={id} onClick={() => setActiveTab(id)}
                  whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 10, cursor: 'pointer', border: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.42)', fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500, width: '100%', position: 'relative', transition: 'background 150ms, color 150ms' }}>
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {badge > 0 && !collapsed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: active ? 'rgba(255,255,255,0.15)' : 'rgba(245,158,11,0.2)', color: active ? 'rgba(255,255,255,0.9)' : '#fcd34d', padding: '1px 7px', borderRadius: 20, fontFamily: 'monospace' }}>{badge}</span>
                  )}
                  {badge > 0 && collapsed && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* CTA novo agendamento */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setActiveTab('agenda'); setShowApptForm(true); }}
              style={{ width: '100%', padding: collapsed ? '10px 0' : '10px 14px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}>
              <Plus size={14} />
              {!collapsed && 'Novo Agendamento'}
            </motion.button>
          </div>
        </motion.aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, padding: '24px', overflowX: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} {...PAGE_TRANSITION} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* Page header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.3px' }}>{PAGE_TITLES[activeTab]}</h2>
                  {activeTab === 'agenda' && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{todayAppts.length} atendimentos hoje</p>}
                  {activeTab === 'agendamentos' && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{myAppointments.filter(a => a.status !== 'cancelled').length} no total · {pendingCount} pendentes</p>}
                  {activeTab === 'clientes' && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{myCustomers.length} clientes cadastrados</p>}
                </div>
                {activeTab === 'agenda' && (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowApptForm(o => !o)}
                    style={{ padding: '9px 18px', background: showApptForm ? '#ffffff' : 'rgba(255,255,255,0.07)', color: showApptForm ? '#031D3C' : 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 12, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}>
                    <Plus size={13} /> {showApptForm ? 'Fechar' : 'Agendar'}
                  </motion.button>
                )}
              </div>

              {/* ─────────── AGENDA ─────────── */}
              {activeTab === 'agenda' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
                  {/* Quick add form */}
                  <AnimatePresence>
                    {showApptForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 20, overflow: 'hidden', flexShrink: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 14px' }}>Novo Agendamento</p>
                        <form onSubmit={handleManualAppointment}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Cliente</span>
                                <button type="button" onClick={() => { setApptNewClient(v => !v); setApptCustId(''); setApptNewClientName(''); setApptNewClientPhone(''); }}
                                  style={{ fontSize: 10, fontWeight: 700, color: apptNewClient ? '#fcd34d' : 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                                  {apptNewClient ? '← Existente' : '+ Novo'}
                                </button>
                              </div>
                              {!apptNewClient
                                ? <select value={apptCustId} onChange={e => setApptCustId(e.target.value)} className="navy-select"><option value="">Selecionar…</option>{myCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <input placeholder="Nome *" value={apptNewClientName} onChange={e => setApptNewClientName(e.target.value)} className="navy-input" style={{ fontSize: 12 }} />
                                    <div style={{ position: 'relative' }}>
                                      <input placeholder="Telefone (opcional)" value={apptNewClientPhone} onChange={e => setApptNewClientPhone(e.target.value)} className="navy-input" style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' as const }} />
                                      {!apptNewClientPhone && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' as const, whiteSpace: 'nowrap' }}>sem tel = sem msg</span>}
                                    </div>
                                  </div>
                              }
                            </div>
                            <select value={apptSrvId} onChange={e => setApptSrvId(e.target.value)} required className="navy-select"><option value="">Serviço</option>{myServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                            <select value={apptProfId} onChange={e => setApptProfId(e.target.value)} required className="navy-select"><option value="">Profissional</option>{myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                            <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} className="navy-input" />
                            <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} className="navy-input" />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <textarea placeholder="Notas (opcional)" value={apptNotes} onChange={e => setApptNotes(e.target.value)} className="navy-input" style={{ flex: 1, height: 52, resize: 'none' }} />
                            <button type="submit" style={{ padding: '0 24px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Gravar</button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Calendar */}
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <AgendaTab
                      myAppointments={myAppointments}
                      myServices={myServices}
                      myProfessionals={myProfessionals}
                      myCustomers={myCustomers}
                      onUpdateAppointmentStatus={onUpdateAppointmentStatus}
                      onAddAppointment={onAddAppointment}
                      onCompleteAppointment={handleCompleteAppointment}
                      onResendReminder={apptId => remindAppointmentWhatsApp(activeTenant.id, apptId)}
                      tenantId={activeTenant.id}
                    />
                  </div>
                </div>
              )}

              {/* ─────────── AGENDAMENTOS ─────────── */}
              {activeTab === 'agendamentos' && (
                <AgendamentosTab
                  myAppointments={myAppointments}
                  myServices={myServices}
                  myProfessionals={myProfessionals}
                  onUpdateAppointmentStatus={onUpdateAppointmentStatus}
                  onCompleteAppointment={handleCompleteAppointment}
                />
              )}

              {/* ─────────── CLIENTES ─────────── */}
              {activeTab === 'clientes' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

                  {/* Formulário: adicionar ou editar */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${editingCust ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: editingCust ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                        {editingCust ? `Editando: ${editingCust.name.split(' ')[0]}` : 'Novo Cliente'}
                      </p>
                      {editingCust && (
                        <button onClick={cancelEditCust} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                    <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input placeholder="Nome completo" value={custName} onChange={e => setCustName(e.target.value)} required className="navy-input" />
                      <input placeholder="(DDD) Telefone" value={custPhone} onChange={e => setCustPhone(e.target.value)} required className="navy-input" />
                      <input placeholder="Email (opcional)" value={custEmail} onChange={e => setCustEmail(e.target.value)} className="navy-input" />
                      <button type="submit" style={{ padding: 12, background: editingCust ? '#3b82f6' : '#ffffff', color: editingCust ? '#fff' : '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                        {editingCust ? 'Salvar alterações' : 'Adicionar'}
                      </button>
                    </form>
                  </div>

                  {/* Lista de clientes */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20 }}>
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                      <input placeholder="Buscar cliente…" value={custSearch} onChange={e => setCustSearch(e.target.value)} className="navy-input" style={{ paddingLeft: 34 }} />
                    </div>
                    <div className="no-scrollbar" style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {myCustomers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).map(c => {
                        const totalSpent = myPayments.filter(p => myAppointments.find(a => a.id === p.appointmentId && a.customerId === c.id)).reduce((s, p) => s + p.amount, 0);
                        const visits = myAppointments.filter(a => a.customerId === c.id && a.status === 'attended').length;
                        const isEditing = editingCust?.id === c.id;
                        return (
                          <motion.div key={c.id} whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                            style={{ padding: '12px 14px', background: isEditing ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isEditing ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: isEditing ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: isEditing ? '#60a5fa' : 'rgba(255,255,255,0.65)', fontSize: 14, flexShrink: 0 }}>
                              {c.name[0]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{c.phone} · {visits} visita{visits !== 1 ? 's' : ''}</div>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4ade80', fontSize: 13, flexShrink: 0 }}>R$ {totalSpent.toFixed(2)}</span>
                            <button
                              onClick={() => isEditing ? cancelEditCust() : startEditCust(c)}
                              title={isEditing ? 'Cancelar edição' : 'Editar cliente'}
                              style={{ width: 28, height: 28, borderRadius: 7, background: isEditing ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isEditing ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.09)'}`, color: isEditing ? '#60a5fa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isEditing ? <X size={12} /> : <Pencil size={12} />}
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Apagar ${c.name}? Esta ação não pode ser desfeita.`)) return;
                                if (isEditing) cancelEditCust();
                                await onDeleteCustomer(c.id);
                                toast.success('Cliente apagado.');
                              }}
                              title="Apagar cliente"
                              style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── AUTOMAÇÕES ─────────── */}
              {activeTab === 'automacoes' && (
                <WhatsAppTab activeTenant={activeTenant} myAppointments={myAppointments} myServices={myServices} myProfessionals={myProfessionals} />
              )}

              {/* ─────────── MEU NEGÓCIO + CONFIGURAÇÕES (sub-nav compartilhado) ─────────── */}
              {(activeTab === 'negocio' || activeTab === 'configuracoes') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Sub-nav — tabs dinâmicos conforme o menu ativo */}
                  <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0, overflowX: 'auto' }} className="no-scrollbar">
                    {(activeTab === 'negocio'
                      ? [['identidade','Identidade'], ['horarios','Horários'], ['equipe','Equipe'], ['catalogo','Catálogo'], ['financeiro','Financeiro'], ['pagina-cliente','Página do Cliente']] as [CfgTab, string][]
                      : [['assinatura','Assinatura'], ['conta','Conta']] as [CfgTab, string][]
                    ).map(([id, label]) => (
                      <button key={id} onClick={() => setCfgTab(id)}
                        style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', borderBottom: cfgTab === id ? '2px solid #ffffff' : '2px solid transparent', color: cfgTab === id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: -1, whiteSpace: 'nowrap', transition: 'color 150ms' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div key={cfgTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

                      {/* Identidade */}
                      {cfgTab === 'identidade' && (
                        <form onSubmit={async e => { e.preventDefault(); try { await onUpdateTenantDetails(activeTenant.id, { name: tenantName, logo: tenantLogo, phone: tenantPhone, address: tenantAddress, instagram: tenantInstagram, businessDays: editedDays, businessHoursByDay: editedHoursByDay, businessHours: editedHoursByDay['seg'] || [] }); toast.success('Salvo!'); } catch { toast.error('Erro ao salvar.'); } }}
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
                          <input ref={logoInputRef as any} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setCropSrc(r.result as string); r.readAsDataURL(f); e.target.value = ''; }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                              style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer', flexShrink: 0, opacity: uploadingLogo ? 0.6 : 1 }}>
                              {uploadingLogo ? <RefreshCw size={20} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} /> : (tenantLogo?.startsWith('http') || tenantLogo?.startsWith('data:')) ? <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden' }}><img src={tenantLogo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div> : <Scissors size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                            </button>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Clique para enviar a logo do salão</span>
                          </div>
                          <input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Nome do salão" className="navy-input" />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="Telefone" className="navy-input" />
                            <input value={tenantInstagram} onChange={e => setTenantInstagram(e.target.value)} placeholder="@instagram" className="navy-input" />
                          </div>
                          <input value={tenantAddress} onChange={e => setTenantAddress(e.target.value)} placeholder="Endereço" className="navy-input" />
                          <button type="submit" style={{ padding: 13, background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Salvar Alterações</button>
                        </form>
                      )}

                      {/* Horários */}
                      {cfgTab === 'horarios' && (() => {
                        const curHours = editedHoursByDay[selectedHoursDay] || [];
                        const isOpen   = editedDays.includes(selectedHoursDay);

                        const toggleHour = (h: string) => {
                          setEditedHoursByDay(prev => {
                            const cur = prev[selectedHoursDay] || [];
                            const next = cur.includes(h) ? cur.filter(x => x !== h) : [...cur, h].sort();
                            return { ...prev, [selectedHoursDay]: next };
                          });
                        };

                        const addVacationRange = () => {
                          if (!vacStartDate) return;
                          const end  = vacEndDate || vacStartDate;
                          const dates: string[] = [];
                          let cur = new Date(vacStartDate + 'T12:00:00');
                          const endD = new Date(end + 'T12:00:00');
                          while (cur <= endD) {
                            dates.push(cur.toISOString().split('T')[0]);
                            cur.setDate(cur.getDate() + 1);
                          }
                          setBlockedDates(prev => Array.from(new Set([...prev, ...dates])).sort());
                          setVacStartDate(''); setVacEndDate('');
                        };

                        const removeBlocked = (d: string) => setBlockedDates(prev => prev.filter(x => x !== d));

                        // Group consecutive blocked dates into ranges for display
                        const groupRanges = (dates: string[]) => {
                          if (!dates.length) return [];
                          const sorted = [...dates].sort();
                          const ranges: { start: string; end: string; dates: string[] }[] = [];
                          let group = [sorted[0]];
                          for (let i = 1; i < sorted.length; i++) {
                            const prev = new Date(sorted[i - 1] + 'T12:00:00');
                            const curr = new Date(sorted[i] + 'T12:00:00');
                            const diff = (curr.getTime() - prev.getTime()) / 86400000;
                            if (diff === 1) { group.push(sorted[i]); }
                            else { ranges.push({ start: group[0], end: group[group.length - 1], dates: [...group] }); group = [sorted[i]]; }
                          }
                          ranges.push({ start: group[0], end: group[group.length - 1], dates: [...group] });
                          return ranges;
                        };

                        const fmtDate = (s: string) => {
                          const [y, m, d] = s.split('-');
                          return `${d}/${m}/${y}`;
                        };

                        const upcomingBlocked = blockedDates.filter(d => d >= new Date().toISOString().split('T')[0]);
                        const ranges = groupRanges(upcomingBlocked);

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                            {/* ── Coluna 1: Horários por dia ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 14px' }}>Horários por Dia</p>

                                {/* Day selector */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                                  {ALL_DAYS.map(d => {
                                    const active = selectedHoursDay === d;
                                    const open   = editedDays.includes(d);
                                    return (
                                      <button key={d} type="button" onClick={() => setSelectedHoursDay(d)}
                                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', position: 'relative', background: active ? '#ffffff' : 'rgba(255,255,255,0.05)', color: active ? '#031D3C' : open ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.25)', border: `1px solid ${active ? '#ffffff' : 'rgba(255,255,255,0.09)'}`, opacity: open ? 1 : 0.5 }}>
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Open/closed toggle */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textTransform: 'capitalize' }}>{selectedHoursDay} — {isOpen ? `${curHours.length} horários` : 'Fechado'}</span>
                                  <button type="button" onClick={() => setEditedDays(prev => prev.includes(selectedHoursDay) ? prev.filter(d => d !== selectedHoursDay) : [...prev, selectedHoursDay])}
                                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: isOpen ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)', color: isOpen ? '#86efac' : '#fca5a5', border: `1px solid ${isOpen ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}` }}>
                                    {isOpen ? 'Aberto' : 'Fechado'}
                                  </button>
                                </div>

                                {/* Default hour chips — toggleable */}
                                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' }}>Horários padrão</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                  {DEFAULT_HOURS.map(h => {
                                    const on = curHours.includes(h);
                                    return (
                                      <motion.button key={h} type="button" onClick={() => toggleHour(h)}
                                        whileTap={{ scale: 0.93 }}
                                        style={{ padding: '5px 11px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer', background: on ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', color: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)', border: `1px solid ${on ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}`, transition: 'all 120ms' }}>
                                        {h}
                                      </motion.button>
                                    );
                                  })}
                                </div>

                                {/* Custom hours */}
                                {curHours.filter(h => !DEFAULT_HOURS.includes(h)).length > 0 && (
                                  <>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' }}>Horários extras</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                      {curHours.filter(h => !DEFAULT_HOURS.includes(h)).map(h => (
                                        <span key={h} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', fontWeight: 700, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}>
                                          {h}
                                          <button type="button" onClick={() => setEditedHoursByDay(prev => ({ ...prev, [selectedHoursDay]: prev[selectedHoursDay].filter(x => x !== h) }))} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                )}

                                {/* Add custom time */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input type="time" value={newHourInput} onChange={e => setNewHourInput(e.target.value)} className="navy-input" style={{ flex: 1 }} />
                                  <button type="button" onClick={() => { if (newHourInput) { setEditedHoursByDay(prev => ({ ...prev, [selectedHoursDay]: Array.from(new Set([...(prev[selectedHoursDay] || []), newHourInput])).sort() })); setNewHourInput(''); } }}
                                    style={{ padding: '0 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)', fontWeight: 700, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', fontSize: 13, fontFamily: 'Outfit, sans-serif' }}>+</button>
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                  <button type="button" onClick={() => { const h = editedHoursByDay[selectedHoursDay] || []; setEditedHoursByDay(Object.fromEntries(ALL_DAYS.map(d => [d, d === 'dom' ? [] : [...h]]))); toast.info('Copiado para todos os dias úteis.'); }}
                                    style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Copiar p/ todos</button>
                                  <button type="button" onClick={() => setEditedHoursByDay(prev => ({ ...prev, [selectedHoursDay]: [...DEFAULT_HOURS] }))}
                                    style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Resetar padrão</button>
                                </div>
                              </div>

                              <button onClick={async () => { try { await onUpdateTenantDetails(activeTenant.id, { businessDays: editedDays, businessHoursByDay: editedHoursByDay, businessHours: editedHoursByDay['seg'] || [], blockedDates }); toast.success('Horários salvos!'); } catch { toast.error('Erro ao salvar.'); } }}
                                style={{ padding: 13, background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                Salvar Horários
                              </button>
                            </div>

                            {/* ── Coluna 2: Férias / Bloqueios ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>Férias & Folgas</p>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '0 0 16px' }}>Datas bloqueadas não aparecem para agendamento</p>

                                {/* Date range picker */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                  <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>De</label>
                                    <input type="date" value={vacStartDate} onChange={e => setVacStartDate(e.target.value)} className="navy-input" />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>Até (opcional)</label>
                                    <input type="date" value={vacEndDate} onChange={e => setVacEndDate(e.target.value)} min={vacStartDate} className="navy-input" />
                                  </div>
                                </div>
                                <button type="button" onClick={addVacationRange} disabled={!vacStartDate}
                                  style={{ width: '100%', padding: '10px 0', background: vacStartDate ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${vacStartDate ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 8, color: vacStartDate ? '#fcd34d' : 'rgba(255,255,255,0.2)', fontWeight: 700, fontSize: 12, cursor: vacStartDate ? 'pointer' : 'default', fontFamily: 'Outfit, sans-serif' }}>
                                  Bloquear {vacStartDate && vacEndDate && vacStartDate !== vacEndDate ? 'período' : 'data'}
                                </button>

                                {/* Upcoming blocked ranges */}
                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {ranges.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                                      Nenhuma data bloqueada
                                    </div>
                                  ) : (
                                    <>
                                      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>Próximos bloqueios</p>
                                      {ranges.map(r => (
                                        <motion.div key={r.start} layout
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
                                          <div>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace' }}>
                                              {r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} → ${fmtDate(r.end)}`}
                                            </span>
                                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                                              {r.dates.length} dia{r.dates.length > 1 ? 's' : ''}
                                            </span>
                                          </div>
                                          <button type="button" onClick={() => setBlockedDates(prev => prev.filter(d => !r.dates.includes(d)))}
                                            style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                            Remover
                                          </button>
                                        </motion.div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })()}

                      {/* Equipe */}
                      {cfgTab === 'equipe' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                          {/* Formulário: adicionar ou editar */}
                          <form
                            onSubmit={async e => {
                              e.preventDefault();
                              if (!profName.trim()) return;
                              if (editingProf) {
                                await onUpdateProfessional(editingProf.id, {
                                  name: profName, role: profRole,
                                  avatar: profAvatar || editingProf.avatar,
                                  commissionPercentage: profCommission,
                                  businessDays: profDays,
                                });
                                toast.success(`${profName} atualizado!`);
                                cancelEditProf();
                              } else {
                                onAddProfessional({ tenantId: activeTenant.id, name: profName, role: profRole, avatar: profAvatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80', rating: 5, services: myServices.map(s => s.id), commissionPercentage: profCommission, businessDays: profDays, businessHoursByDay: {} });
                                toast.success(`${profName} adicionado!`);
                                setProfName(''); setProfAvatar('');
                              }
                            }}
                            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${editingProf ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: editingProf ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                                {editingProf ? `Editando: ${editingProf.name}` : 'Novo Colaborador'}
                              </p>
                              {editingProf && (
                                <button type="button" onClick={cancelEditProf}
                                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                                  Cancelar
                                </button>
                              )}
                            </div>

                            <input ref={avatarInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfAvatar(await fileToDataURL(e.target.files[0])); }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden', background: 'rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => avatarInputRef.current?.click()}>
                                {(profAvatar || editingProf?.avatar)
                                  ? <img src={profAvatar || editingProf?.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <User size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                              </div>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }} onClick={() => avatarInputRef.current?.click()}>
                                {profAvatar ? 'Trocar foto' : 'Foto do profissional'}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <input placeholder="Nome" value={profName} onChange={e => setProfName(e.target.value)} required className="navy-input" />
                              <input placeholder="Cargo" value={profRole} onChange={e => setProfRole(e.target.value)} className="navy-input" />
                            </div>
                            <div>
                              <label className="navy-label">Comissão %</label>
                              <input type="number" min={0} max={100} value={profCommission} onChange={e => setProfCommission(Number(e.target.value))} className="navy-input" />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {['seg','ter','qua','qui','sex','sab','dom'].map(d => (
                                <button key={d} type="button" onClick={() => setProfDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                                  style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', background: profDays.includes(d) ? '#ffffff' : 'rgba(255,255,255,0.07)', color: profDays.includes(d) ? '#031D3C' : 'rgba(255,255,255,0.38)', border: `1px solid ${profDays.includes(d) ? '#ffffff' : 'rgba(255,255,255,0.09)'}` }}>
                                  {d}
                                </button>
                              ))}
                            </div>
                            <button type="submit"
                              style={{ padding: 12, background: editingProf ? '#3b82f6' : '#ffffff', color: editingProf ? '#fff' : '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                              {editingProf ? 'Salvar alterações' : 'Adicionar'}
                            </button>
                          </form>

                          {/* Lista da equipe */}
                          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }} className="no-scrollbar">
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Equipe ({myProfessionals.length})</p>
                            {myProfessionals.length === 0 && (
                              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 20 }}>Nenhum colaborador ainda.</p>
                            )}
                            {myProfessionals.map(p => (
                              <div key={p.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: editingProf?.id === p.id ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${editingProf?.id === p.id ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, transition: 'all 150ms' }}>
                                <img src={p.avatar} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{p.role} · {p.commissionPercentage}%</div>
                                </div>
                                <button
                                  onClick={() => editingProf?.id === p.id ? cancelEditProf() : startEditProf(p)}
                                  title={editingProf?.id === p.id ? 'Cancelar edição' : 'Editar'}
                                  style={{ width: 30, height: 30, borderRadius: 8, background: editingProf?.id === p.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${editingProf?.id === p.id ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.09)'}`, color: editingProf?.id === p.id ? '#60a5fa' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {editingProf?.id === p.id ? <X size={13} /> : <Pencil size={13} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Catálogo */}
                      {cfgTab === 'catalogo' && (() => {
                        const isAdded = (name: string) => myServices.some(s => s.name === name);
                        const addPreset = (preset: typeof PRESET_SERVICES[0]) => {
                          if (isAdded(preset.name)) return;
                          onAddService({ tenantId: activeTenant.id, name: preset.name, price: presetPrices[preset.name] || 0, durationMinutes: preset.durationMinutes, category: preset.category });
                          toast.success(`"${preset.name}" adicionado!`);
                        };
                        const allPresetsAdded = PRESET_SERVICES.every(p => isAdded(p.name));
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* ── Serviços padrão ── */}
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Serviços Padrão</p>
                                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '3px 0 0' }}>Defina o preço e clique para adicionar</p>
                                </div>
                                {!allPresetsAdded && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      PRESET_SERVICES.filter(p => !isAdded(p.name)).forEach(p =>
                                        onAddService({ tenantId: activeTenant.id, name: p.name, price: presetPrices[p.name] || 0, durationMinutes: p.durationMinutes, category: p.category })
                                      );
                                      toast.success('Todos os serviços padrão adicionados!');
                                    }}
                                    style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                                    + Adicionar todos
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                                {PRESET_SERVICES.map(preset => {
                                  const added = isAdded(preset.name);
                                  return (
                                    <motion.div key={preset.name} layout
                                      style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${added ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`, background: added ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: 13, color: added ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>{preset.name}</div>
                                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{preset.category} · {preset.durationMinutes} min</div>
                                        </div>
                                        {added && (
                                          <span style={{ fontSize: 10, fontWeight: 700, color: '#86efac', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>✓ Adicionado</span>
                                        )}
                                      </div>
                                      {!added && (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <div style={{ position: 'relative', flex: 1 }}>
                                            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', pointerEvents: 'none' }}>R$</span>
                                            <input
                                              type="number"
                                              min={0}
                                              placeholder="0"
                                              value={presetPrices[preset.name] || ''}
                                              onChange={e => setPresetPrices(prev => ({ ...prev, [preset.name]: Number(e.target.value) }))}
                                              className="navy-input"
                                              style={{ paddingLeft: 28, fontSize: 12 }}
                                            />
                                          </div>
                                          <motion.button
                                            type="button"
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => addPreset(preset)}
                                            style={{ padding: '8px 12px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                                            + Add
                                          </motion.button>
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* ── Serviço personalizado + lista ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                              <form onSubmit={e => { e.preventDefault(); if (!srvName.trim()) return; onAddService({ tenantId: activeTenant.id, name: srvName, price: srvPrice, durationMinutes: srvDuration, category: srvCategory }); toast.success(`"${srvName}" cadastrado!`); setSrvName(''); }}
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Serviço Personalizado</p>
                                <input placeholder="Nome do serviço" value={srvName} onChange={e => setSrvName(e.target.value)} required className="navy-input" />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                  <div><label className="navy-label">Preço R$</label><input type="number" min={0} value={srvPrice} onChange={e => setSrvPrice(Number(e.target.value))} className="navy-input" /></div>
                                  <div><label className="navy-label">Duração min</label><input type="number" min={5} value={srvDuration} onChange={e => setSrvDuration(Number(e.target.value))} className="navy-input" /></div>
                                  <div><label className="navy-label">Categoria</label>
                                    <select value={srvCategory} onChange={e => setSrvCategory(e.target.value as any)} className="navy-select">
                                      <option>Cabelo</option><option>Barba</option><option>Estética</option><option>Unhas</option><option>Combo</option>
                                    </select>
                                  </div>
                                </div>
                                <button type="submit" style={{ padding: 12, background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cadastrar Serviço</button>
                              </form>

                              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 4px' }}>
                                  Serviços Ativos <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>({myServices.length})</span>
                                </p>
                                <div className="no-scrollbar" style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {myServices.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Nenhum serviço cadastrado</div>
                                  ) : myServices.map(s => {
                                    const isEditing = editingSrv?.id === s.id;
                                    return (
                                      <AnimatePresence key={s.id} mode="wait">
                                        {isEditing ? (
                                          /* ── Edição inline ── */
                                          <motion.div key="edit"
                                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            style={{ padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <input
                                              value={editingSrv!.name}
                                              onChange={e => setEditingSrv(v => v && ({ ...v, name: e.target.value }))}
                                              className="navy-input" style={{ fontSize: 13 }} />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                              <div>
                                                <label className="navy-label">Preço R$</label>
                                                <input type="number" min={0} value={editingSrv!.price}
                                                  onChange={e => setEditingSrv(v => v && ({ ...v, price: Number(e.target.value) }))}
                                                  className="navy-input" />
                                              </div>
                                              <div>
                                                <label className="navy-label">Duração min</label>
                                                <input type="number" min={5} value={editingSrv!.durationMinutes}
                                                  onChange={e => setEditingSrv(v => v && ({ ...v, durationMinutes: Number(e.target.value) }))}
                                                  className="navy-input" />
                                              </div>
                                              <div>
                                                <label className="navy-label">Categoria</label>
                                                <select value={editingSrv!.category}
                                                  onChange={e => setEditingSrv(v => v && ({ ...v, category: e.target.value as Service['category'] }))}
                                                  className="navy-select">
                                                  <option>Cabelo</option><option>Barba</option><option>Estética</option><option>Unhas</option><option>Combo</option>
                                                </select>
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                              <button
                                                onClick={async () => {
                                                  if (!editingSrv) return;
                                                  await onUpdateService(editingSrv.id, { name: editingSrv.name, price: editingSrv.price, durationMinutes: editingSrv.durationMinutes, category: editingSrv.category });
                                                  toast.success('Serviço atualizado!');
                                                  setEditingSrv(null);
                                                }}
                                                style={{ flex: 2, padding: '8px 0', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                                Salvar
                                              </button>
                                              <button onClick={() => setEditingSrv(null)}
                                                style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 12, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                                Cancelar
                                              </button>
                                            </div>
                                          </motion.div>
                                        ) : (
                                          /* ── Linha normal com ações no hover ── */
                                          <motion.div key="view" layout
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            whileHover="hovered"
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'default' }}>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.category} · {s.durationMinutes} min</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                              <span style={{ fontWeight: 800, color: s.price > 0 ? '#4ade80' : 'rgba(255,255,255,0.2)', fontFamily: 'monospace', fontSize: 13, minWidth: 72, textAlign: 'right' }}>
                                                {s.price > 0 ? `R$ ${s.price.toFixed(2)}` : '—'}
                                              </span>
                                              <button
                                                onClick={() => setEditingSrv({ ...s })}
                                                title="Editar"
                                                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              </button>
                                              <button
                                                onClick={async () => {
                                                  if (!window.confirm(`Remover "${s.name}"?`)) return;
                                                  await onDeleteService(s.id);
                                                  toast.success(`"${s.name}" removido.`);
                                                }}
                                                title="Remover"
                                                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <X size={12} />
                                              </button>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })()}

                      {/* Financeiro */}
                      {cfgTab === 'financeiro' && (
                        <FinanceiroTab activeTenant={activeTenant} myPayments={myPayments} myProfessionals={myProfessionals} myAppointments={myAppointments} myServices={myServices} onAddPayment={onAddPayment} />
                      )}

                      {/* ── Página do Cliente ── */}
                      {cfgTab === 'pagina-cliente' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                          {/* Form */}
                          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* Cor principal */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Palette size={13} /> Cor Principal
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                                {[
                                  { color: '#2563EB', label: 'Azul' },
                                  { color: '#9333EA', label: 'Roxo' },
                                  { color: '#DC2626', label: 'Vermelho' },
                                  { color: '#0F766E', label: 'Verde' },
                                  { color: '#D97706', label: 'Âmbar' },
                                  { color: '#DB2777', label: 'Rosa' },
                                  { color: '#0891B2', label: 'Ciano' },
                                  { color: '#1D2D44', label: 'Marinho' },
                                ].map(({ color, label }) => (
                                  <button key={color} type="button" title={label} onClick={() => setBookingPrimaryColor(color)}
                                    style={{ width: 36, height: 36, borderRadius: 10, background: color, cursor: 'pointer', border: bookingPrimaryColor === color ? '3px solid #ffffff' : '3px solid transparent', outline: bookingPrimaryColor === color ? `2px solid ${color}` : 'none', transition: 'all 0.15s' }} />
                                ))}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit, sans-serif' }}>Personalizada:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 12px' }}>
                                  <input type="color" value={bookingPrimaryColor} onChange={e => setBookingPrimaryColor(e.target.value)}
                                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>{bookingPrimaryColor.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Informações visíveis */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Eye size={13} /> Informações Visíveis
                              </p>
                              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
                                Escolha quais dados aparecem para o cliente na página de agendamento.
                              </p>
                              {([
                                { key: 'phone',     label: 'Telefone',  icon: <Phone size={14} />,     value: bookingShowPhone,     setter: setBookingShowPhone },
                                { key: 'address',   label: 'Endereço',  icon: <MapPin size={14} />,    value: bookingShowAddress,   setter: setBookingShowAddress },
                                { key: 'instagram', label: 'Instagram', icon: <Instagram size={14} />, value: bookingShowInstagram, setter: setBookingShowInstagram },
                              ] as { key: string; label: string; icon: React.ReactNode; value: boolean; setter: (v: boolean) => void }[]).map(row => (
                                <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '11px 14px', marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                                    {row.icon} {row.label}
                                  </div>
                                  <button type="button" onClick={() => row.setter(!row.value)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s',
                                      background: row.value ? '#E6F4EC' : 'rgba(255,255,255,0.07)',
                                      color:      row.value ? '#0A4A2C'  : 'rgba(255,255,255,0.4)',
                                      border:     `1px solid ${row.value ? '#A7D7BC' : 'rgba(255,255,255,0.12)'}` }}>
                                    {row.value ? <Eye size={11} /> : <EyeOff size={11} />}
                                    {row.value ? 'Visível' : 'Oculto'}
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button type="button"
                              onClick={async () => { try { await onUpdateTenantDetails(activeTenant.id, { bookingPageConfig: { primaryColor: bookingPrimaryColor, showPhone: bookingShowPhone, showAddress: bookingShowAddress, showInstagram: bookingShowInstagram } }); toast.success('Página do cliente atualizada!'); } catch { toast.error('Erro ao salvar.'); } }}
                              style={{ padding: 13, background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                              Salvar Configurações
                            </button>
                          </div>

                          {/* Pré-visualização */}
                          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 20 }}>Pré-visualização</p>
                            <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                              <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${bookingPrimaryColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 22, fontWeight: 300, color: bookingPrimaryColor }}>
                                  {activeTenant.name.replace(/barbearia|salao|studio|estetica/gi, '').trim().substring(0, 2).toUpperCase()}
                                </span>
                                <span style={{ fontSize: 6, fontWeight: 700, color: bookingPrimaryColor, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>BARBEARIA</span>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>{activeTenant.name}</span>
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {bookingShowPhone && activeTenant.phone && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>
                                    <Phone size={11} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                    <span>{activeTenant.phone}</span>
                                  </div>
                                )}
                                {bookingShowAddress && activeTenant.address && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>
                                    <MapPin size={11} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTenant.address}</span>
                                  </div>
                                )}
                                {bookingShowInstagram && activeTenant.instagram && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>
                                    <Instagram size={11} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                    <span>{activeTenant.instagram}</span>
                                  </div>
                                )}
                              </div>
                              <div style={{ width: '100%', background: bookingPrimaryColor, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Corte + Barba</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>45 min ▶</span>
                              </div>
                              <div style={{ width: '100%', background: bookingPrimaryColor, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Barba</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>30 min ▶</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {cfgTab === 'assinatura' && (() => {
                        const BASE = 89.90;
                        type PlanKey = 'mensal' | 'trimestral' | 'anual';
                        const PLANS: Array<{ key: PlanKey; label: string; months: number; discountPct: number; color: string; badge: string | null }> = [
                          { key: 'mensal',     label: '1 Mês',   months: 1,  discountPct: 0,  color: '#3b82f6', badge: null        },
                          { key: 'trimestral', label: '3 Meses', months: 3,  discountPct: 15, color: '#8b5cf6', badge: '15% OFF'   },
                          { key: 'anual',      label: '1 Ano',   months: 12, discountPct: 25, color: '#10b981', badge: '25% OFF'   },
                        ];

                        const isTrial      = activeTenant.plan === 'trial';
                        const isActive     = activeTenant.status === 'active';
                        const endDate      = isTrial ? activeTenant.trialEndsAt : activeTenant.subscriptionEndsAt;
                        const daysLeft     = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000) : null;
                        const fmtDate      = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
                        const statusColor  = isActive ? '#22c55e' : isTrial ? '#f59e0b' : '#ef4444';
                        const statusLabel  = isActive ? 'Ativo' : isTrial ? 'Em Teste' : 'Suspenso';
                        const showAlert    = daysLeft !== null && daysLeft <= 10;
                        const planLabels: Record<string, string> = { trial: 'Período de Teste', mensal: '1 Mês', trimestral: '3 Meses', anual: '1 Ano' };

                        const handleSubscribe = (planKey: 'mensal' | 'trimestral' | 'anual') => {
                          setBillingModal({ plan: planKey, step: 'form', cpfCnpj: '' });
                        };

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* Status card */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 6px' }}>Plano atual</p>
                                  <p style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{planLabels[activeTenant.plan] ?? activeTenant.plan}</p>
                                </div>
                                <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44`, whiteSpace: 'nowrap' as const }}>
                                  {statusLabel}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isActive && !isTrial ? '1fr 1fr' : '1fr', gap: 10 }}>
                                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', fontWeight: 600 }}>
                                    {isTrial ? 'Trial encerra em' : 'Próxima renovação'}
                                  </p>
                                  <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{fmtDate(endDate)}</p>
                                  {daysLeft !== null && (
                                    <p style={{ fontSize: 11, color: daysLeft <= 10 ? '#f59e0b' : 'rgba(255,255,255,0.35)', margin: '3px 0 0', fontWeight: 600 }}>
                                      {daysLeft > 0
                                        ? `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`
                                        : 'Vence hoje'}
                                    </p>
                                  )}
                                </div>
                                {isActive && !isTrial && (
                                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
                                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', fontWeight: 600 }}>Valor do plano</p>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', margin: 0 }}>
                                      {activeTenant.mrr > 0 ? `R$ ${Number(activeTenant.mrr).toFixed(2).replace('.', ',')}` : '—'}
                                    </p>
                                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0' }}>renovação automática</p>
                                  </div>
                                )}
                              </div>

                              {/* Alerta de vencimento próximo */}
                              {showAlert && (
                                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                                  <p style={{ fontSize: 13, color: '#fcd34d', margin: 0, lineHeight: 1.5 }}>
                                    {isTrial
                                      ? `Seu trial encerra em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Escolha um plano abaixo para continuar sem interrupção.`
                                      : `Sua assinatura vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renove agora para não perder o acesso.`}
                                  </p>
                                </div>
                              )}

                              {/* Info trial sem urgência */}
                              {isTrial && !showAlert && (
                                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 13, color: 'rgba(253,211,77,0.8)', margin: 0, lineHeight: 1.5 }}>
                                    Você está no período de teste gratuito de 10 dias. Explore todos os recursos e escolha seu plano abaixo.
                                  </p>
                                </div>
                              )}

                              {/* Info assinatura saudável */}
                              {isActive && !isTrial && !showAlert && (
                                <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                                  <p style={{ fontSize: 13, color: '#86efac', margin: 0, lineHeight: 1.5 }}>
                                    Assinatura ativa. O pagamento é renovado automaticamente via Asaas (boleto, Pix ou cartão).
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Planos */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 14px' }}>
                                {isActive && !isTrial && !showAlert ? 'Alterar plano' : 'Escolha seu plano'}
                              </p>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                                {PLANS.map(p => {
                                  const monthly   = parseFloat((BASE * (1 - p.discountPct / 100)).toFixed(2));
                                  const total     = parseFloat((monthly * p.months).toFixed(2));
                                  const saving    = parseFloat(((BASE - monthly) * p.months).toFixed(2));
                                  const isCurrent = activeTenant.plan === p.key;
                                  const isRenew   = isCurrent && showAlert;

                                  return (
                                    <div key={p.key} style={{
                                      position: 'relative' as const,
                                      background: isCurrent ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                                      border: `1.5px solid ${isCurrent ? p.color + '66' : p.key === 'trimestral' ? p.color + '33' : 'rgba(255,255,255,0.09)'}`,
                                      borderRadius: 14,
                                      padding: '22px 14px 14px',
                                      display: 'flex',
                                      flexDirection: 'column' as const,
                                      gap: 10,
                                    }}>
                                      {/* Badge topo */}
                                      {(p.badge || isCurrent) && (
                                        <div style={{ position: 'absolute' as const, top: -11, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                          <span style={{ background: isCurrent ? '#22c55e' : p.color, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.5px', whiteSpace: 'nowrap' as const }}>
                                            {isCurrent ? '✓ PLANO ATUAL' : p.badge}
                                          </span>
                                        </div>
                                      )}

                                      <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: 0 }}>{p.label}</p>

                                      {/* Preço */}
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>R$</span>
                                          <span style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                                            {monthly.toFixed(2).replace('.', ',')}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>/mês</span>
                                      </div>

                                      {/* Total e economia */}
                                      {p.months > 1 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                                            Total: R$ {total.toFixed(2).replace('.', ',')}
                                          </p>
                                          <p style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, margin: 0 }}>
                                            Economia de R$ {saving.toFixed(2).replace('.', ',')}
                                          </p>
                                        </div>
                                      ) : (
                                        <div style={{ height: 30 }} />
                                      )}

                                      <button
                                        disabled={isCurrent && !isTrial && !isRenew}
                                        onClick={() => { if (!isCurrent || isRenew || isTrial) handleSubscribe(p.key as 'mensal' | 'trimestral' | 'anual'); }}
                                        style={{
                                          marginTop: 4,
                                          padding: '10px 0',
                                          background: isRenew ? p.color : isCurrent && !isTrial ? 'rgba(255,255,255,0.07)' : p.color,
                                          color: '#fff',
                                          border: isCurrent && !isTrial && !isRenew ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                          borderRadius: 8,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: isCurrent && !isTrial && !isRenew ? 'default' : 'pointer',
                                          fontFamily: 'Outfit, sans-serif',
                                        }}
                                      >
                                        {isRenew ? 'Renovar agora' : isCurrent && !isTrial ? 'Plano atual' : isTrial ? 'Assinar' : 'Mudar plano'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center' as const, margin: '14px 0 0', lineHeight: 1.5 }}>
                                Pagamentos processados via Asaas · Boleto, Pix ou Cartão de Crédito
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {cfgTab === 'conta' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16, padding: 24 }}>
                            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(239,68,68,0.15)', paddingBottom: 12, margin: '0 0 16px' }}>Excluir Conta</h4>

                            {deleteStep === 'idle' && (
                              <div>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 12px' }}>
                                  Em conformidade com a <strong style={{ color: 'rgba(255,255,255,0.7)' }}>LGPD (Lei 13.709/2018)</strong>, você pode solicitar a exclusão permanente de todos os seus dados, incluindo agendamentos, clientes, serviços, profissionais e histórico financeiro.
                                </p>
                                <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', margin: '0 0 16px' }}>⚠️ Esta ação é irreversível e não pode ser desfeita.</p>
                                <button onClick={() => setDeleteStep('confirm')}
                                  style={{ padding: '8px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                  Solicitar exclusão de dados
                                </button>
                              </div>
                            )}

                            {deleteStep === 'confirm' && (
                              <div>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 8px' }}>Ao confirmar, serão excluídos permanentemente:</p>
                                <ul style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.9, margin: '0 0 20px', paddingLeft: 20 }}>
                                  <li>Todos os agendamentos e histórico</li>
                                  <li>Cadastro de clientes</li>
                                  <li>Serviços e profissionais</li>
                                  <li>Dados financeiros</li>
                                  <li>Assinatura e conta de acesso</li>
                                </ul>
                                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 10px' }}>
                                  Digite <strong style={{ color: '#fca5a5' }}>EXCLUIR</strong> para confirmar:
                                </p>
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                                    placeholder="EXCLUIR" className="navy-input" style={{ flex: 1 }} />
                                  <button disabled={deleteInput !== 'EXCLUIR'}
                                    onClick={async () => {
                                      if (deleteInput !== 'EXCLUIR') return;
                                      setDeleteStep('deleting');
                                      try { await onDeleteAccount(); }
                                      catch { setDeleteStep('confirm'); }
                                    }}
                                    style={{ padding: '0 20px', background: deleteInput === 'EXCLUIR' ? '#ef4444' : 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleteInput === 'EXCLUIR' ? 'pointer' : 'not-allowed', fontFamily: 'Outfit, sans-serif', opacity: deleteInput === 'EXCLUIR' ? 1 : 0.4, transition: 'all 200ms' }}>
                                    Excluir tudo
                                  </button>
                                </div>
                                <button onClick={() => { setDeleteStep('idle'); setDeleteInput(''); }}
                                  style={{ marginTop: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                  Cancelar
                                </button>
                              </div>
                            )}

                            {deleteStep === 'deleting' && (
                              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Excluindo todos os dados… aguarde.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── FAB ── */}
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 100 }}>
        <AnimatePresence>
          {fabOpen && (
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.18 }}
              style={{ position: 'absolute', bottom: 62, right: 0, background: '#021340', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden', minWidth: 200, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
              {[
                { icon: <Calendar size={14} />, label: 'Novo Agendamento', action: () => { setActiveTab('agenda'); setShowApptForm(true); setFabOpen(false); } },
                { icon: <Users size={14} />,    label: 'Novo Cliente',      action: () => { setActiveTab('clientes'); setFabOpen(false); } },
                { icon: <MessageSquare size={14} />, label: 'Enviar Aviso', action: () => { setActiveTab('automacoes'); setFabOpen(false); } },
              ].map((item, i) => (
                <motion.button key={i} onClick={item.action}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none', color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'left', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {item.icon} {item.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }} onClick={() => setFabOpen(o => !o)}
          style={{ width: 52, height: 52, borderRadius: '50%', background: fabOpen ? '#ffffff' : '#ffffff', color: '#031D3C', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', transition: 'transform 0.15s' }}>
          <motion.div animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.18 }}>
            <Plus size={22} strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>

      {/* ── Modal de Assinatura ─────────────────────────────────────────────── */}
      {billingModal && (() => {
        const BASE = 89.90;
        const PLAN_META = {
          mensal:     { label: '1 Mês',   months: 1,  discountPct: 0,  color: '#3b82f6' },
          trimestral: { label: '3 Meses', months: 3,  discountPct: 15, color: '#8b5cf6' },
          anual:      { label: '1 Ano',   months: 12, discountPct: 25, color: '#10b981' },
        } as const;
        const pm      = PLAN_META[billingModal.plan];
        const monthly = parseFloat((BASE * (1 - pm.discountPct / 100)).toFixed(2));
        const total   = parseFloat((monthly * pm.months).toFixed(2));
        const cpfClean = billingModal.cpfCnpj.replace(/\D/g, '');
        const cpfValid = cpfClean.length === 11 || cpfClean.length === 14;
        const handleSubmit = async () => {
          if (!cpfValid) {
            setBillingModal(prev => prev ? { ...prev, error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' } : null);
            return;
          }
          setBillingModal(prev => prev ? { ...prev, step: 'loading', error: undefined } : null);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const apiUrl = ((window as any).__BARBER_CONFIG__?.API_URL || '').replace(/\/$/, '');
            const r = await fetch(
              `${apiUrl}/api/billing/payment-link?tenantId=${activeTenant.id}&plan=${billingModal.plan}&cpfCnpj=${cpfClean}`,
              { headers: { Authorization: `Bearer ${session?.access_token}` } }
            );
            const json = await r.json();
            if (!r.ok) {
              setBillingModal(prev => prev ? { ...prev, step: 'form', error: json.error ?? 'Erro ao gerar cobrança.' } : null);
              return;
            }
            setBillingModal(prev => prev ? {
              ...prev,
              step: 'payment',
              pixImage: json.pixImage,
              pixCode:  json.pixCode,
              payUrl:   json.url,
            } : null);
          } catch {
            setBillingModal(prev => prev ? { ...prev, step: 'form', error: 'Erro de conexão. Tente novamente.' } : null);
          }
        };

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setBillingModal(null); }}
          >
            <div style={{ background: '#fff', borderRadius: 20, width: 460, maxWidth: '100%', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>

              {/* Cabeçalho */}
              <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '0 0 2px' }}>BarberFlow · Assinatura</p>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {billingModal.step === 'payment' ? 'Concluir pagamento' : 'Assinar plano'}
                  </h3>
                </div>
                <button onClick={() => setBillingModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Resumo do plano */}
              <div style={{ padding: '14px 24px', background: pm.color + '12', borderBottom: '1px solid ' + pm.color + '28', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: pm.color, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Plano {pm.label}</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', margin: '2px 0 0' }}>R$ {monthly.toFixed(2).replace('.', ',')} /mês</p>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Total {pm.months > 1 ? `(${pm.months} meses)` : ''}</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>R$ {total.toFixed(2).replace('.', ',')}</p>
                </div>
              </div>

              {/* Corpo */}
              <div style={{ padding: 24 }}>

                {/* Passo 1: formulário */}
                {billingModal.step === 'form' && (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>CPF ou CNPJ *</label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        value={billingModal.cpfCnpj}
                        onChange={e => setBillingModal(prev => prev ? { ...prev, cpfCnpj: e.target.value, error: undefined } : null)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                        style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${billingModal.error ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.15s' }}
                      />
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>Necessário para emissão da cobrança via Asaas.</p>
                    </div>
                    {billingModal.error && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                        <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{billingModal.error}</p>
                      </div>
                    )}
                    <button onClick={handleSubmit}
                      style={{ width: '100%', padding: '13px 0', background: pm.color, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      Gerar cobrança →
                    </button>
                  </>
                )}

                {/* Passo loading */}
                {billingModal.step === 'loading' && (
                  <div style={{ textAlign: 'center' as const, padding: '32px 0' }}>
                    <div style={{ width: 40, height: 40, border: `3px solid ${pm.color}33`, borderTopColor: pm.color, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Gerando cobrança…</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  </div>
                )}

                {/* Passo 2: pagamento */}
                {billingModal.step === 'payment' && (
                  <>
                    {billingModal.pixImage && (
                      <div style={{ textAlign: 'center' as const, marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '1px', marginBottom: 12 }}>Pagar via PIX</p>
                        <div style={{ display: 'inline-block', padding: 12, border: '1.5px solid #e2e8f0', borderRadius: 14, marginBottom: 14 }}>
                          <img src={`data:image/png;base64,${billingModal.pixImage}`} alt="QR Code PIX" style={{ width: 200, height: 200, display: 'block' }} />
                        </div>
                        {billingModal.pixCode && (
                          <div>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 6px' }}>Copia e cola:</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input readOnly value={billingModal.pixCode}
                                style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, color: '#475569', fontFamily: 'monospace', background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} />
                              <button onClick={() => { navigator.clipboard.writeText(billingModal.pixCode!); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                                style={{ padding: '8px 14px', background: pixCopied ? '#10b981' : '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                                {pixCopied ? '✓ Copiado' : 'Copiar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {billingModal.payUrl && (
                      <>
                        {billingModal.pixImage && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>ou</span>
                            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                          </div>
                        )}
                        <a href={billingModal.payUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', textAlign: 'center' as const, padding: '13px 0', background: billingModal.pixImage ? '#f1f5f9' : pm.color, color: billingModal.pixImage ? '#374151' : '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', border: billingModal.pixImage ? '1.5px solid #e2e8f0' : 'none' }}>
                          {billingModal.pixImage ? 'Pagar via Boleto ou Cartão →' : 'Acessar link de pagamento →'}
                        </a>
                      </>
                    )}

                    <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' as const, margin: '16px 0 0', lineHeight: 1.5 }}>
                      Após confirmação do pagamento, o acesso é liberado automaticamente.
                    </p>
                  </>
                )}

                {/* Passo success */}
                {billingModal.step === 'success' && (
                  <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <span style={{ fontSize: 32 }}>✅</span>
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>Pagamento confirmado!</h3>
                    <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 6px' }}>
                      Obrigado por assinar o BarberFlow! 🎉
                    </p>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>
                      Sua conta foi ativada. Recarregando em instantes…
                    </p>
                    <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#22c55e', borderRadius: 4, animation: 'grow 3.5s linear forwards' }} />
                    </div>
                    <style>{`@keyframes grow { from { width: 0% } to { width: 100% } }`}</style>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
