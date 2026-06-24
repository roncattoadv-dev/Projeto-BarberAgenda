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
  Mail, Lock, Clock, Shield, Trash2, LogOut,
} from 'lucide-react';

import { Tenant, Service, Professional, Product, Appointment, Payment, Customer } from '../types';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { UseNotificationsReturn } from '../hooks/useNotifications';
import { uploadTenantLogo, remindAppointmentWhatsApp, createSupportTicket, getWaitlistEntries, markWaitlistNotified } from '../lib/db';
import { supabase } from '../lib/supabase';
import { sendWhatsAppServer, buildWaitlistMsg } from '../services/whatsapp';
import LogoCropModal from './LogoCropModal';
import TourOverlay, { TourStep } from './TourOverlay';
import WaitlistModal from './WaitlistModal';
import AgendaTab       from './tabs/AgendaTab';
import AgendamentosTab from './tabs/AgendamentosTab';
import FinanceiroTab   from './tabs/FinanceiroTab';
import WhatsAppTab     from './tabs/WhatsAppTab';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'agenda' | 'agendamentos' | 'financeiro' | 'clientes' | 'negocio' | 'automacoes' | 'configuracoes';
type CfgTab = 'identidade' | 'horarios' | 'equipe' | 'catalogo' | 'pagina-cliente' | 'assinatura' | 'conta' | 'notificacoes' | 'agenda-config';

interface Props {
  activeTenant: Tenant;
  services: Service[];
  professionals: Professional[];
  products: Product[];
  customers: Customer[];
  appointments: Appointment[];
  payments: Payment[];
  onAddService: (s: Omit<Service, 'id'>) => Promise<Service | void>;
  onUpdateService: (id: string, s: Partial<Omit<Service, 'id'>>) => void | Promise<void>;
  onDeleteService: (id: string) => void | Promise<void>;
  onAddProfessional: (p: Omit<Professional, 'id'>) => void;
  onUpdateProfessional: (id: string, p: Partial<Omit<Professional, 'id' | 'tenantId'>>) => void;
  onDeleteProfessional: (id: string) => Promise<void>;
  onSetServiceProfessionals: (serviceId: string, profIds: string[]) => Promise<void>;
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProductStock: (id: string, stock: number) => void;
  onAddAppointment: (a: Omit<Appointment, 'id'>) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onRescheduleAppointment: (id: string, date: string, time: string) => Promise<void>;
  onAddPayment: (pay: Omit<Payment, 'id'>) => void;
  onAddCustomer: (c: Omit<Customer, 'id'>) => Promise<Customer>;
  onUpdateCustomer: (id: string, updates: { name?: string; phone?: string; email?: string }) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onUpdateTenantDetails: (tenantId: string, details: Partial<Tenant>) => void | Promise<void>;
  onSwitchToBookingFlow: (slug: string) => void;
  onDeleteAccount: () => Promise<void>;
  onSignOut?: () => void;
  openSubscriptionTab?: boolean;
  onSubscriptionTabOpened?: () => void;
  notifications: UseNotificationsReturn;
}

// ── Motion presets ─────────────────────────────────────────────────────────────
const PAGE_TRANSITION = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22, ease: 'easeOut' } };
const SIDEBAR_W = { open: 242, closed: 70 };

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'agenda',        label: 'Agenda',       Icon: Calendar      },
  { id: 'agendamentos',  label: 'Agendamentos', Icon: List          },
  { id: 'financeiro',    label: 'Financeiro',   Icon: CreditCard    },
  { id: 'clientes',      label: 'Clientes',     Icon: Users         },
  { id: 'negocio',       label: 'Meu Negócio',  Icon: Store         },
  { id: 'automacoes',    label: 'Automações',   Icon: MessageSquare },
  { id: 'configuracoes', label: 'Config.',      Icon: Settings      },
];

const PAGE_TITLES: Record<Tab, string> = {
  agenda: 'Agenda', agendamentos: 'Agendamentos', financeiro: 'Financeiro',
  clientes: 'Clientes', negocio: 'Meu Negócio', automacoes: 'Automações', configuracoes: 'Configurações',
};

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = { confirmed: '#22c55e', pending: '#f59e0b', cancelled: '#ef4444', attended: '#3b82f6' };

export default function ClientAdminPanel({
  activeTenant, services, professionals, products, customers, appointments, payments,
  onAddService, onUpdateService, onDeleteService,
  onAddProfessional, onUpdateProfessional, onDeleteProfessional, onSetServiceProfessionals, onAddProduct, onUpdateProductStock,
  onAddAppointment, onUpdateAppointmentStatus, onRescheduleAppointment, onAddPayment, onAddCustomer, onUpdateCustomer, onDeleteCustomer,
  onUpdateTenantDetails, onSwitchToBookingFlow, onDeleteAccount, onSignOut,
  openSubscriptionTab, onSubscriptionTabOpened,
  notifications,
}: Props) {
  const toast = useToast();
  const { user } = useAuth();

  // ── Conta / senha ─────────────────────────────────────────────────────────
  const [senhaAtual,     setSenhaAtual]     = useState('');
  const [novaSenha,      setNovaSenha]      = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha,  setShowNovaSenha]  = useState(false);
  const [showConfSenha,  setShowConfSenha]  = useState(false);
  const [salvandoSenha,  setSalvandoSenha]  = useState(false);

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
  const [deleteCustomerPending, setDeleteCustomerPending] = useState<{ id: string; name: string } | null>(null);
  const [deletingCustomer,      setDeletingCustomer]      = useState(false);
  const [deleteStep,      setDeleteStep]      = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deleteInput,     setDeleteInput]     = useState('');
  const [pixCopied,      setPixCopied]      = useState(false);
  const [wppConnState,   setWppConnState]   = useState<string>('checking');
  const [wppConnName,    setWppConnName]    = useState<string | null>(null);
  const [autoTab,        setAutoTab]        = useState<'whatsapp' | 'email'>('whatsapp');
  const [privacyModal,   setPrivacyModal]   = useState(false);
  const [supportModal,   setSupportModal]   = useState(false);
  const [supportTitle,   setSupportTitle]   = useState('');
  const [supportMsg,     setSupportMsg]     = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportSent,    setSupportSent]    = useState(false);

  const TOUR_KEY = `workagenda_setup_v2_${activeTenant.id}`;
  const [tourOpen, setTourOpen] = useState(() => !localStorage.getItem(TOUR_KEY));
  const [tourKey,  setTourKey]  = useState(0);
  const finishTour  = () => { localStorage.setItem(TOUR_KEY, '1'); setTourOpen(false); };
  const restartTour = () => {
    localStorage.removeItem(TOUR_KEY);
    setTourKey(k => k + 1);
    setTourOpen(true);
  };

  const TOUR_STEPS: TourStep[] = [
    {
      targetId: '__welcome__',
      emoji: '👋',
      title: `Bem-vindo, ${activeTenant.name}!`,
      description: 'Vamos configurar seu negócio em 5 passos rápidos. Ao final, seu link de agendamento estará pronto para compartilhar com seus clientes.',
    },
    {
      targetId: 'tour-cfgtab-identidade',
      emoji: '🏪',
      title: 'Identidade do negócio',
      description: 'Preencha o nome, telefone, endereço e faça upload da sua logo. Quando terminar, clique em "Pronto, avançar" no canto da tela.',
      cta: 'Ir preencher',
      onEnter: () => { setActiveTab('negocio'); setTimeout(() => setCfgTab('identidade'), 60); },
    },
    {
      targetId: 'tour-cfgtab-equipe',
      emoji: '✂️',
      title: 'Equipe & Horários',
      description: 'Adicione os profissionais e configure os horários de atendimento individuais de cada um. Quando terminar, clique em "Pronto, avançar" para continuar.',
      cta: 'Ir configurar',
      onEnter: () => setCfgTab('equipe'),
    },
    {
      targetId: 'tour-cfgtab-catalogo',
      emoji: '💈',
      title: 'Serviços e preços',
      description: 'Crie os serviços que você oferece informando nome, preço e duração. Adicione ao menos um serviço e clique em "Pronto, avançar".',
      cta: 'Ir criar',
      onEnter: () => setCfgTab('catalogo'),
    },
    {
      targetId: 'tour-cfgtab-pagina-cliente',
      emoji: '🔗',
      title: 'Seu link está pronto! 🎉',
      description: 'Em "Link do Cliente" você visualiza e copia seu endereço de agendamento. Em "Personalizar URL" pode trocar o nome no link — o sistema verifica a disponibilidade antes de salvar. Compartilhe pelo WhatsApp ou Instagram e seu cliente agenda em menos de 1 minuto.',
      cta: 'Ver meu link',
      onEnter: () => setCfgTab('pagina-cliente'),
    },
  ];
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

  const handleCopyBookingLink = () => {
    const url = `${window.location.origin}/${activeTenant.slug}/agendamento`;
    navigator.clipboard.writeText(url).then(() => {
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 2000);
    });
  };

  const handleSlugChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setSlugInput(sanitized);
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!sanitized || sanitized === activeTenant.slug) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    slugTimerRef.current = setTimeout(async () => {
      const { data } = await supabase.from('tenants').select('id').eq('slug', sanitized).neq('id', activeTenant.id).maybeSingle();
      setSlugStatus(data ? 'taken' : 'available');
    }, 600);
  };

  const handleSaveSlug = async () => {
    if (slugStatus !== 'available' || !slugInput) return;
    setSlugStatus('saving');
    try {
      await onUpdateTenantDetails(activeTenant.id, { slug: slugInput });
      toast.success('URL atualizada! Compartilhe o novo link.');
      setSlugStatus('idle');
    } catch {
      toast.error('Erro ao salvar a URL.');
      setSlugStatus('available');
    }
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
  const [custSearch,         setCustSearch]         = useState('');
  const [custName,           setCustName]           = useState('');
  const [custPhone,          setCustPhone]          = useState('');
  const [custEmail,          setCustEmail]          = useState('');
  const [editingCust,        setEditingCust]        = useState<Customer | null>(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewApptModal,   setShowNewApptModal]   = useState(false);
  const [showWaitlistModal,  setShowWaitlistModal]  = useState(false);
  const [quickApptCust,      setQuickApptCust]      = useState<Customer | null>(null);
  const [quickApptSrvId,     setQuickApptSrvId]     = useState('');
  const [quickApptProfId,    setQuickApptProfId]    = useState('');
  const [quickApptDate,      setQuickApptDate]      = useState('');
  const [quickApptTime,      setQuickApptTime]      = useState('');
  const [quickApptSaving,    setQuickApptSaving]    = useState(false);

  const startEditCust = (c: Customer) => {
    setEditingCust(c);
    setCustName(c.name); setCustPhone(c.phone); setCustEmail(c.email || '');
    setShowNewClientModal(true);
  };
  const cancelEditCust = () => {
    setEditingCust(null);
    setCustName(''); setCustPhone(''); setCustEmail('');
    setShowNewClientModal(false);
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
  const [vacProfIds,       setVacProfIds]       = useState<string[]>([]); // [] = todos

  // ── Booking page config ────────────────────────────────────────────────────
  const [bookingPrimaryColor,    setBookingPrimaryColor]    = useState(activeTenant.bookingPageConfig?.primaryColor    ?? '#2563EB');
  const [bookingShowPhone,       setBookingShowPhone]       = useState(activeTenant.bookingPageConfig?.showPhone       ?? true);
  const [bookingShowAddress,     setBookingShowAddress]     = useState(activeTenant.bookingPageConfig?.showAddress     ?? true);
  const [bookingShowInstagram,   setBookingShowInstagram]   = useState(activeTenant.bookingPageConfig?.showInstagram   ?? true);
  const [bookingMapsUrl,         setBookingMapsUrl]         = useState(activeTenant.bookingPageConfig?.mapsUrl         ?? '');
  const [bookingWaitlistEnabled, setBookingWaitlistEnabled] = useState(activeTenant.bookingPageConfig?.waitlistEnabled ?? true);

  // Configurações da agenda
  const [agendaMode,        setAgendaMode]        = useState<'auto_complete' | 'auto_cancel' | 'manual'>(activeTenant.agendaMode ?? 'auto_complete');
  const [agendaTimeMinutes, setAgendaTimeMinutes] = useState(activeTenant.agendaTimeMinutes ?? 30);
  const [agendaTimezone,    setAgendaTimezone]    = useState(activeTenant.timezone ?? 'America/Sao_Paulo');
  const [agendaSaving,      setAgendaSaving]      = useState(false);

  // ── Slug / link editing ────────────────────────────────────────────────────
  const [slugInput,  setSlugInput]  = useState(activeTenant.slug);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'saving'>('idle');
  const [slugCopied, setSlugCopied] = useState(false);
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [srvProfIds,     setSrvProfIds]     = useState<string[]>([]);
  const [editingSrv,     setEditingSrv]     = useState<Service | null>(null);
  const [srvProfPanel,   setSrvProfPanel]   = useState<Service | null>(null);
  const [showNewSrvModal, setShowNewSrvModal] = useState(false);
  const hiddenPresetsKey = `wa_hidden_presets_${activeTenant.id}`;
  const [hiddenPresets, setHiddenPresets] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(hiddenPresetsKey) || '[]'); } catch { return []; }
  });
  const [profName,       setProfName]       = useState('');
  const [profRole,       setProfRole]       = useState('Barbeiro');
  const [profCommission, setProfCommission] = useState(40);
  const [profAvatar,     setProfAvatar]     = useState('');
  const [profDays,         setProfDays]         = useState<string[]>(['seg','ter','qua','qui','sex','sab']);
  const [profHoursByDay,   setProfHoursByDay]   = useState<Record<string, string[]>>(
    Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d => [d, []]))
  );
  const [profSelectedDay,  setProfSelectedDay]  = useState('seg');
  const [profNewHourInput, setProfNewHourInput] = useState('');
  const [profPickerOpen,   setProfPickerOpen]   = useState(false);
  const [editingProf,      setEditingProf]      = useState<Professional | null>(null);
  const [showNewProfModal, setShowNewProfModal] = useState(false);

  const startEditProf = (p: Professional) => {
    setEditingProf(p);
    setProfName(p.name);
    setProfRole(p.role);
    setProfAvatar(p.avatar || '');
    setProfCommission(p.commissionPercentage);
    setProfDays(p.businessDays || ['seg','ter','qua','qui','sex','sab']);
    setProfHoursByDay(
      p.businessHoursByDay && Object.keys(p.businessHoursByDay).length > 0
        ? p.businessHoursByDay
        : Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d => [d, []]))
    );
    setProfSelectedDay('seg');
    setShowNewProfModal(true);
  };
  const cancelEditProf = () => {
    setEditingProf(null);
    setProfName(''); setProfRole('Barbeiro'); setProfAvatar('');
    setProfCommission(40);
    setProfDays(['seg','ter','qua','qui','sex','sab']);
    setProfHoursByDay(Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d => [d, []])));
    setProfSelectedDay('seg');
    setShowNewProfModal(false);
  };

  const handleSaveProf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) return;
    if (!editingProf && myProfessionals.length >= 6) { toast.error('Limite de 6 colaboradores atingido.'); return; }
    if (editingProf) {
      await onUpdateProfessional(editingProf.id, { name: profName, role: profRole, avatar: profAvatar || editingProf.avatar, commissionPercentage: profCommission, businessDays: profDays, businessHoursByDay: profHoursByDay });
      toast.success(`${profName} atualizado!`);
    } else {
      onAddProfessional({ tenantId: activeTenant.id, name: profName, role: profRole, avatar: profAvatar || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80', rating: 5, services: myServices.map(s => s.id), commissionPercentage: profCommission, businessDays: profDays, businessHoursByDay: profHoursByDay });
      toast.success(`${profName} adicionado!`);
    }
    cancelEditProf();
  };

  const logoInputRef    = useRef<HTMLInputElement>(null);
  const avatarInputRef  = useRef<HTMLInputElement>(null);

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
    setBookingMapsUrl(activeTenant.bookingPageConfig?.mapsUrl ?? '');
    setSlugInput(activeTenant.slug);
    setSlugStatus('idle');
  }, [activeTenant.id]);

  // ── ⌘K handler ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape') { setCmdOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (cmdOpen) setTimeout(() => cmdRef.current?.focus(), 50); }, [cmdOpen]);

  const NEGOCIO_TABS: CfgTab[] = ['identidade', 'equipe', 'catalogo', 'pagina-cliente'];
  const CONFIG_TABS:  CfgTab[] = ['assinatura', 'notificacoes', 'agenda-config', 'conta'];
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

  const handleCancelAndNotifyWaitlist = useCallback(async (id: string, status: Appointment['status']) => {
    onUpdateAppointmentStatus(id, status);
    if (status !== 'cancelled') return;
    const cancelled = myAppointments.find(a => a.id === id);
    if (!cancelled) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const LINK  = `https://workagenda.org/${activeTenant.slug}/agendamento`;
      const LS_KEY = `barber_wpp_tpl_${activeTenant.id}`;
      let savedTpls: Record<string, string> = {};
      try { const s = localStorage.getItem(LS_KEY); if (s) savedTpls = JSON.parse(s); } catch {}

      // ── 1. Mensagem de cancelamento para o cliente ──────────────────────────
      if (cancelled.customerPhone) {
        const srv  = myServices.find(s => s.id === cancelled.serviceId);
        const prof = myProfessionals.find(p => p.id === cancelled.professionalId);
        const cancelTpl = savedTpls.cancel || '{cliente}, seu agendamento de {servico} em {data} às {hora} foi cancelado. Para reagendar acesse: {link_agendamento} — {salao}';
        const cancelMsg = cancelTpl
          .replace(/\{cliente\}/g,          cancelled.customerName)
          .replace(/\{nome\}/g,             cancelled.customerName)
          .replace(/\{servico\}/g,          srv?.name ?? 'Serviço')
          .replace(/\{profissional\}/g,     prof?.name ?? '')
          .replace(/\{data\}/g,             cancelled.date)
          .replace(/\{hora\}/g,             cancelled.time)
          .replace(/\{salao\}/g,            activeTenant.name)
          .replace(/\{link_agendamento\}/g, LINK)
          .replace(/\{link_cancelamento\}/g, LINK)
          .replace(/\{link\}/g,             LINK);
        sendWhatsAppServer(activeTenant.id, token, cancelled.customerPhone, cancelMsg).catch(() => {});
      }

      // ── 2. Lista de espera ─────────────────────────────────────────────────
      const allEntries = await getWaitlistEntries(activeTenant.id);
      const pendentes  = allEntries.filter(e => !e.notified);

      console.log('[Waitlist] cancelado:', { date: cancelled.date, time: cancelled.time, profId: cancelled.professionalId });
      console.log('[Waitlist] entradas pendentes:', pendentes.map(e => ({ nome: e.customerName, date: e.date, time: e.timePreference, profId: e.professionalId })));

      if (pendentes.length === 0) {
        toast.success('Nenhum cliente na lista de espera para este dia.');
        return;
      }

      const waitlistTpl = savedTpls.waitlist || '';

      // Cada entrada já tem proteção via notified=true — sem limite adicional
      const compatible = pendentes
        .filter(e =>
          e.date === cancelled.date &&
          (e.professionalId === null || e.professionalId === cancelled.professionalId) &&
          (e.timePreference === 'qualquer' || e.timePreference.split(',').includes(cancelled.time))
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      console.log('[Waitlist] compatíveis para notificar:', compatible.length, compatible.map(e => e.customerName));

      if (compatible.length === 0) {
        const sameDateCount = pendentes.filter(e => e.date === cancelled.date).length;
        toast.success(sameDateCount > 0
          ? `${sameDateCount} cliente(s) aguardam neste dia mas sem horário/profissional compatível.`
          : `Nenhum cliente na lista de espera para ${cancelled.date}.`);
        return;
      }

      toast.success(`⏳ Avisando ${compatible.length} cliente(s) da lista de espera…`);

      compatible.forEach((entry, idx) => {
        setTimeout(async () => {
          const msg = waitlistTpl
            ? waitlistTpl
                .replace(/\{cliente\}/g,          entry.customerName)
                .replace(/\{nome\}/g,             entry.customerName)
                .replace(/\{salao\}/g,            activeTenant.name)
                .replace(/\{data\}/g,             entry.date)
                .replace(/\{link_agendamento\}/g, LINK)
                .replace(/\{link\}/g,             LINK)
            : buildWaitlistMsg({ customerName: entry.customerName, tenantName: activeTenant.name, tenantSlug: activeTenant.slug, date: entry.date, timePreference: entry.timePreference });

          const result = await sendWhatsAppServer(activeTenant.id, token, entry.customerPhone, msg);
          if (result === 'sent') {
            await markWaitlistNotified(entry.id).catch(() => {});
            toast.success(`✅ ${entry.customerName} notificado via WhatsApp`);
          } else {
            toast.error(`WhatsApp não conectado — ${entry.customerName} não foi avisado`);
          }
        }, idx * 3000); // 0s, 3s, 6s, 9s...
      });
    } catch (err) {
      console.error('[Waitlist] erro ao notificar:', err);
      toast.error('Erro ao processar lista de espera');
    }
  }, [myAppointments, myServices, myProfessionals, activeTenant, onUpdateAppointmentStatus]);

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
      setShowNewClientModal(false);
      toast.success('Cliente cadastrado!');
    }
  };

  const handleQuickAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickApptCust || !quickApptSrvId || !quickApptDate || !quickApptTime) return;
    const srv = myServices.find(s => s.id === quickApptSrvId);
    if (!srv) return;
    setQuickApptSaving(true);
    try {
      await onAddAppointment({
        tenantId: activeTenant.id, serviceId: quickApptSrvId, professionalId: quickApptProfId,
        customerId: quickApptCust.id, customerName: quickApptCust.name, customerPhone: quickApptCust.phone,
        date: quickApptDate, time: quickApptTime, durationMinutes: srv.durationMinutes,
        price: srv.price, status: 'confirmed', notes: '',
      });
      toast.success('Agendamento criado!');
      setQuickApptCust(null);
      setQuickApptSrvId(''); setQuickApptProfId(''); setQuickApptDate(''); setQuickApptTime('');
    } catch { toast.error('Erro ao agendar.'); }
    finally { setQuickApptSaving(false); }
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
    <div style={{ backgroundColor: '#F8FAFC', flex: 1, minHeight: 0, overflow: 'hidden', fontFamily: 'Outfit, sans-serif', display: 'flex', flexDirection: 'column' }}>

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
              style={{ width: '100%', maxWidth: 520, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #F1F5F9', gap: 10 }}>
                <Search size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <input ref={cmdRef} value={cmdQuery} onChange={e => setCmdQuery(e.target.value)}
                  placeholder="Buscar cliente…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#111827', fontSize: 15, fontFamily: 'Outfit, sans-serif' }} />
                <kbd style={{ fontSize: 10, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 4, padding: '2px 6px', color: '#9CA3AF', fontFamily: 'monospace' }}>ESC</kbd>
              </div>
              {cmdResults.length > 0 && (
                <div style={{ maxHeight: 320, overflowY: 'auto' }} className="no-scrollbar">
                  {cmdResults.map(c => (
                    <div key={c.id} onClick={() => { setActiveTab('clientes'); setCmdOpen(false); setCmdQuery(''); }}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: '1px solid #F9FAFB', transition: 'background 120ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#374151', fontSize: 14 }}>{c.name[0]}</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{c.phone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cmdQuery && cmdResults.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum cliente encontrado</div>
              )}
              {!cmdQuery && (
                <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[['📅 Agenda', 'agenda'], ['📋 Agendamentos', 'agendamentos'], ['👥 Clientes', 'clientes']].map(([label, tab]) => (
                    <button key={tab} onClick={() => { setActiveTab(tab as Tab); setCmdOpen(false); }}
                      style={{ padding: '6px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body (sem topbar) ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Sidebar ── */}
        <motion.aside
          animate={{ width: collapsed ? SIDEBAR_W.closed : SIDEBAR_W.open }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: '#F8FAFC', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0, alignSelf: 'stretch' }}
        >
          {/* ── Estabelecimento (topo) ── */}
          <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            {(activeTenant.logo?.startsWith('http') || activeTenant.logo?.startsWith('data:')) ? (
              <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
                <img src={activeTenant.logo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ) : (
              <div onClick={() => setCollapsed(c => !c)} style={{ width: 44, height: 44, borderRadius: 12, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                <Scissors size={18} style={{ color: '#64748B' }} />
              </div>
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: 'Outfit, sans-serif' }}>
                  {activeTenant.name}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* ── Nav ── */}
          <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              const badge = id === 'agendamentos' ? pendingCount : id === 'agenda' ? todayAppts.length : 0;
              return (
                <motion.button key={id} id={`tour-nav-${id}`} onClick={() => setActiveTab(id)}
                  whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 10, cursor: 'pointer', border: active ? '1px solid #BFDBFE' : '1px solid transparent', background: active ? '#EFF6FF' : 'transparent', color: active ? '#1D4ED8' : '#6B7280', fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: active ? 700 : 500, width: '100%', position: 'relative', transition: 'background 150ms, color 150ms' }}>
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {badge > 0 && !collapsed && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: active ? '#BFDBFE' : '#FEF3C7', color: active ? '#1D4ED8' : '#D97706', padding: '1px 7px', borderRadius: 20, fontFamily: 'monospace' }}>{badge}</span>
                  )}
                  {badge > 0 && collapsed && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                  )}
                </motion.button>
              );
            })}
          </nav>

          {/* ── Sidebar footer ── */}
          <div style={{ borderTop: '1px solid #E2E8F0', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
            {/* Link público */}
            <button onClick={() => onSwitchToBookingFlow(activeTenant.slug)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500, width: '100%', transition: 'color 150ms' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
              <ExternalLink size={14} style={{ flexShrink: 0 }} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    Link público
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Sair */}
            {onSignOut && (
              <button onClick={onSignOut}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '9px 0' : '9px 12px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500, width: '100%', transition: 'color 150ms' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
                <LogOut size={14} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      Sair
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}

            {/* Suporte + privacidade + copyright */}
            {!collapsed && (
              <div style={{ paddingTop: 6, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button onClick={() => { setSupportSent(false); setSupportTitle(''); setSupportMsg(''); setSupportModal(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#9CA3AF', fontFamily: 'Outfit, sans-serif', padding: '2px 12px', textAlign: 'left', transition: 'color 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
                  Suporte
                </button>
                <button onClick={() => setPrivacyModal(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#9CA3AF', fontFamily: 'Outfit, sans-serif', padding: '2px 12px', textAlign: 'left', transition: 'color 150ms' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
                  Política de Privacidade
                </button>
                <p style={{ margin: 0, fontSize: 10, color: '#D1D5DB', fontFamily: 'Outfit, sans-serif', letterSpacing: '0.5px', padding: '0 12px' }}>
                  © WorkAgenda {new Date().getFullYear()}
                </p>
              </div>
            )}
          </div>
        </motion.aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, padding: activeTab === 'agenda' ? '0' : '24px', overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} {...PAGE_TRANSITION} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: (activeTab === 'agenda' || activeTab === 'agendamentos') ? 'hidden' : 'auto', overscrollBehavior: 'contain' }}>

              {/* Page header */}
              {activeTab !== 'agenda' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0, paddingBottom: 16, borderBottom: '1px solid #E2E8F0' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>{PAGE_TITLES[activeTab]}</h2>
                  {activeTab === 'agenda' && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{todayAppts.length} atendimentos hoje</p>}
                  {activeTab === 'agendamentos' && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{myAppointments.filter(a => a.status !== 'cancelled').length} no total · {pendingCount} pendentes</p>}
                  {activeTab === 'clientes' && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{myCustomers.length} clientes cadastrados</p>}
                  {activeTab === 'automacoes' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: wppConnState === 'open' ? '#22C55E' : wppConnState === 'connecting' ? '#F59E0B' : '#EF4444', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#6B7280' }}>
                        {wppConnState === 'open'
                          ? <>WhatsApp conectado{wppConnName ? <> · <span style={{ color: '#374151', fontWeight: 600 }}>{wppConnName}</span></> : null}</>
                          : wppConnState === 'connecting' ? 'Aguardando conexão…'
                          : wppConnState === 'checking'   ? 'Verificando…'
                          : 'WhatsApp desconectado'}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {activeTab === 'agendamentos' && (
                    <>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowWaitlistModal(true)}
                        title={!bookingWaitlistEnabled ? 'Lista de espera está desativada em Configurações → Agenda' : undefined}
                        style={{ padding: '9px 14px', background: bookingWaitlistEnabled ? '#FFFFFF' : '#F8FAFC', color: bookingWaitlistEnabled ? '#374151' : '#9CA3AF', fontWeight: 700, fontSize: 12, border: `1px solid ${bookingWaitlistEnabled ? '#E2E8F0' : '#E2E8F0'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        <Clock size={13} style={{ color: bookingWaitlistEnabled ? '#374151' : '#9CA3AF' }} />
                        Lista de Espera
                        {!bookingWaitlistEnabled && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#92400E', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.3px' }}>OFF</span>
                        )}
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => { setApptCustId(''); setApptSrvId(''); setApptProfId(''); setApptDate(new Date().toISOString().split('T')[0]); setApptTime(''); setApptNotes(''); setApptNewClient(false); setApptNewClientName(''); setApptNewClientPhone(''); setShowNewApptModal(true); }}
                        style={{ padding: '9px 18px', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}>
                        <Plus size={13} /> Novo Agendamento
                      </motion.button>
                    </>
                  )}
                  {activeTab === 'agenda' && (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setShowApptForm(o => !o)}
                      style={{ padding: '9px 18px', background: showApptForm ? '#1D4ED8' : '#FFFFFF', color: showApptForm ? '#FFFFFF' : '#374151', fontWeight: 700, fontSize: 12, border: `1px solid ${showApptForm ? '#1D4ED8' : '#E2E8F0'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}>
                      <Plus size={13} /> {showApptForm ? 'Fechar' : 'Agendar'}
                    </motion.button>
                  )}
                </div>
              </div>}

              {/* ─────────── AGENDA ─────────── */}
              {activeTab === 'agenda' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: showApptForm ? 16 : 0, minHeight: 0 }}>
                  {/* Quick add form */}
                  <AnimatePresence>
                    {showApptForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 0, padding: '16px 20px', overflow: 'hidden', flexShrink: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 14px' }}>Novo Agendamento</p>
                        <form onSubmit={handleManualAppointment}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Cliente</span>
                                <button type="button" onClick={() => { setApptNewClient(v => !v); setApptCustId(''); setApptNewClientName(''); setApptNewClientPhone(''); }}
                                  style={{ fontSize: 10, fontWeight: 700, color: apptNewClient ? '#2563EB' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                                  {apptNewClient ? '← Existente' : '+ Novo'}
                                </button>
                              </div>
                              {!apptNewClient
                                ? <select value={apptCustId} onChange={e => setApptCustId(e.target.value)} className="navy-select"><option value="">Selecionar…</option>{myCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <input placeholder="Nome *" value={apptNewClientName} onChange={e => setApptNewClientName(e.target.value)} className="navy-input" style={{ fontSize: 12 }} />
                                    <div style={{ position: 'relative' }}>
                                      <input placeholder="Telefone (opcional)" value={apptNewClientPhone} onChange={e => setApptNewClientPhone(e.target.value)} className="navy-input" style={{ fontSize: 12, width: '100%', boxSizing: 'border-box' as const }} />
                                      {!apptNewClientPhone && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#9CA3AF', pointerEvents: 'none' as const, whiteSpace: 'nowrap' }}>sem tel = sem msg</span>}
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
                            <button type="submit" style={{ padding: '0 24px', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Gravar</button>
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
                      onUpdateAppointmentStatus={handleCancelAndNotifyWaitlist}
                      onAddAppointment={onAddAppointment}
                      onAddCustomer={onAddCustomer}
                      onCompleteAppointment={handleCompleteAppointment}
                      onResendReminder={apptId => remindAppointmentWhatsApp(activeTenant.id, apptId)}
                      onRescheduleAppointment={onRescheduleAppointment}
                      tenantId={activeTenant.id}
                    />
                  </div>
                </div>
              )}

              {/* ─────────── AGENDAMENTOS ─────────── */}
              {activeTab === 'agendamentos' && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <AgendamentosTab
                    activeTenant={activeTenant}
                    myAppointments={myAppointments}
                    myServices={myServices}
                    myProfessionals={myProfessionals}
                    onUpdateAppointmentStatus={handleCancelAndNotifyWaitlist}
                    onCompleteAppointment={handleCompleteAppointment}
                    reminderMinutes={activeTenant.reminderMinutes ?? 60}
                  />
                </div>
              )}

              {/* ─────────── FINANCEIRO ─────────── */}
              {activeTab === 'financeiro' && (
                <FinanceiroTab
                  activeTenant={activeTenant}
                  myPayments={myPayments}
                  myProfessionals={myProfessionals}
                  myAppointments={myAppointments}
                  myServices={myServices}
                  onAddPayment={onAddPayment}
                />
              )}

              {/* ─────────── CLIENTES ─────────── */}
              {activeTab === 'clientes' && (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* Header: busca + botão novo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input placeholder="Buscar cliente…" value={custSearch} onChange={e => setCustSearch(e.target.value)} className="navy-input" style={{ paddingLeft: 34 }} />
                    </div>
                    <button
                      onClick={() => { setCustName(''); setCustPhone(''); setCustEmail(''); setEditingCust(null); setShowNewClientModal(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                      <Plus size={13} /> Novo
                    </button>
                  </div>

                  {/* Lista */}
                  <div className="no-scrollbar" style={{ maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {myCustomers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).map(c => {
                      const totalSpent = myPayments.filter(p => myAppointments.find(a => a.id === p.appointmentId && a.customerId === c.id)).reduce((s, p) => s + p.amount, 0);
                      const visits = myAppointments.filter(a => a.customerId === c.id && a.status === 'attended').length;
                      return (
                        <motion.div key={c.id} whileHover={{ x: 2 }} transition={{ duration: 0.12 }}
                          style={{ padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 150ms' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#374151', fontSize: 14, flexShrink: 0 }}>
                            {c.name[0]}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#6B7280' }}>{c.phone} · {visits} visita{visits !== 1 ? 's' : ''}</div>
                          </div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#059669', fontSize: 13, flexShrink: 0 }}>R$ {totalSpent.toFixed(2)}</span>
                          <button
                            onClick={() => { setQuickApptCust(c); setQuickApptSrvId(''); setQuickApptProfId(''); setQuickApptDate(new Date().toISOString().slice(0,10)); setQuickApptTime(''); }}
                            title="Novo agendamento"
                            style={{ width: 28, height: 28, borderRadius: 7, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Calendar size={12} />
                          </button>
                          <button
                            onClick={() => startEditCust(c)}
                            title="Editar cliente"
                            style={{ width: 28, height: 28, borderRadius: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteCustomerPending({ id: c.id, name: c.name })}
                            title="Apagar cliente"
                            style={{ width: 28, height: 28, borderRadius: 7, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Trash2 size={12} />
                          </button>
                        </motion.div>
                      );
                    })}
                    {myCustomers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)).length === 0 && (
                      <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '32px 0', margin: 0 }}>Nenhum cliente encontrado.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ─────────── AUTOMAÇÕES ─────────── */}
              {activeTab === 'automacoes' && (
                <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* Sidebar vertical */}
                  <nav style={{ width: 210, borderRight: '1px solid #E2E8F0', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                    {([
                      ['whatsapp', 'WhatsApp'],
                      ['email',    'E-mail'],
                    ] as ['whatsapp' | 'email', string][]).map(([id, label]) => (
                      <button key={id} onClick={() => setAutoTab(id)}
                        style={{ padding: '9px 14px', fontSize: 13, fontWeight: autoTab === id ? 700 : 500, background: autoTab === id ? '#EFF6FF' : 'transparent', border: `1px solid ${autoTab === id ? '#BFDBFE' : 'transparent'}`, borderRadius: 9, color: autoTab === id ? '#1D4ED8' : '#6B7280', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'left' as const, transition: 'all 150ms', whiteSpace: 'nowrap' as const }}>
                        {label}
                      </button>
                    ))}
                  </nav>
                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 }} className="no-scrollbar">
                    <WhatsAppTab
                      activeTenant={activeTenant}
                      section={autoTab}
                      onStatusChange={(state, name) => { setWppConnState(state); setWppConnName(name); }} />
                  </div>
                </div>
              )}

              {/* ─────────── MEU NEGÓCIO + CONFIGURAÇÕES ─────────── */}
              {(activeTab === 'negocio' || activeTab === 'configuracoes') && (
                <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

                  {/* Sub-nav — sidebar vertical */}
                  <nav style={{ width: 210, borderRight: '1px solid #E2E8F0', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                    {((activeTab === 'negocio'
                      ? [['identidade','Identidade'], ['equipe','Equipe & Horários'], ['catalogo','Catálogo'], ['pagina-cliente','Página do Cliente']]
                      : [['assinatura','Assinatura'], ['notificacoes','Notificações'], ['agenda-config','Agenda'], ['conta','Conta']]
                    ) as [CfgTab, string][]).map(([id, label]) => (
                      <button key={id} id={`tour-cfgtab-${id}`} onClick={() => setCfgTab(id as CfgTab)}
                        style={{ padding: '9px 14px', fontSize: 13, fontWeight: cfgTab === id ? 700 : 500, background: cfgTab === id ? '#EFF6FF' : 'transparent', border: `1px solid ${cfgTab === id ? '#BFDBFE' : 'transparent'}`, borderRadius: 9, color: cfgTab === id ? '#1D4ED8' : '#6B7280', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'left' as const, transition: 'all 150ms', whiteSpace: 'nowrap' as const }}>
                        {label}
                      </button>
                    ))}
                  </nav>

                  <AnimatePresence mode="wait">
                    <motion.div key={cfgTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                      style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 }}
                      className="no-scrollbar">

                      {/* Identidade */}
                      {cfgTab === 'identidade' && (
                        <form onSubmit={async e => { e.preventDefault(); try { await onUpdateTenantDetails(activeTenant.id, { name: tenantName, logo: tenantLogo, phone: tenantPhone, address: tenantAddress, instagram: tenantInstagram, businessDays: editedDays, businessHoursByDay: editedHoursByDay, businessHours: editedHoursByDay['seg'] || [] }); toast.success('Salvo!'); } catch { toast.error('Erro ao salvar.'); } }}
                          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
                          <input ref={logoInputRef as any} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setCropSrc(r.result as string); r.readAsDataURL(f); e.target.value = ''; }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                              style={{ width: 56, height: 56, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer', flexShrink: 0, opacity: uploadingLogo ? 0.6 : 1 }}>
                              {uploadingLogo ? <RefreshCw size={20} style={{ color: '#9CA3AF', animation: 'spin 1s linear infinite' }} /> : (tenantLogo?.startsWith('http') || tenantLogo?.startsWith('data:')) ? <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden' }}><img src={tenantLogo} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div> : <Scissors size={20} style={{ color: '#9CA3AF' }} />}
                            </button>
                            <span style={{ fontSize: 12, color: '#6B7280' }}>Clique para enviar a logo do salão</span>
                          </div>
                          <input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Nome do salão" className="navy-input" />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="Telefone" className="navy-input" />
                            <input value={tenantInstagram} onChange={e => setTenantInstagram(e.target.value)} placeholder="@instagram" className="navy-input" />
                          </div>
                          <input value={tenantAddress} onChange={e => setTenantAddress(e.target.value)} placeholder="Endereço" className="navy-input" />
                          <button type="submit" style={{ padding: 13, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Salvar Alterações</button>
                        </form>
                      )}

                      {/* Equipe & Horários (fusão) */}
                      {cfgTab === 'equipe' && (() => {
                        const profCurHours = profHoursByDay[profSelectedDay] || [];
                        const profDayOpen  = profDays.includes(profSelectedDay);

                        const addVacationRange = async () => {
                          if (!vacStartDate) return;
                          const end  = vacEndDate || vacStartDate;
                          const dates: string[] = [];
                          let cur = new Date(vacStartDate + 'T12:00:00');
                          const endD = new Date(end + 'T12:00:00');
                          while (cur <= endD) {
                            dates.push(cur.toISOString().split('T')[0]);
                            cur.setDate(cur.getDate() + 1);
                          }
                          if (vacProfIds.length === 0) {
                            // bloqueia para todos (tenant)
                            setBlockedDates(prev => Array.from(new Set([...prev, ...dates])).sort());
                          } else {
                            // bloqueia só para os profissionais selecionados
                            for (const pid of vacProfIds) {
                              const prof = myProfessionals.find(p => p.id === pid);
                              if (!prof) continue;
                              const newDates = Array.from(new Set([...(prof.blockedDates ?? []), ...dates])).sort();
                              await onUpdateProfessional(pid, { blockedDates: newDates });
                            }
                          }
                          setVacStartDate(''); setVacEndDate(''); setVacProfIds([]);
                        };

                        const groupRanges = (dates: string[]) => {
                          if (!dates.length) return [];
                          const sorted = [...dates].sort();
                          const ranges: { start: string; end: string; dates: string[] }[] = [];
                          let group = [sorted[0]];
                          for (let i = 1; i < sorted.length; i++) {
                            const prev = new Date(sorted[i - 1] + 'T12:00:00');
                            const curr = new Date(sorted[i] + 'T12:00:00');
                            if ((curr.getTime() - prev.getTime()) / 86400000 === 1) { group.push(sorted[i]); }
                            else { ranges.push({ start: group[0], end: group[group.length - 1], dates: [...group] }); group = [sorted[i]]; }
                          }
                          ranges.push({ start: group[0], end: group[group.length - 1], dates: [...group] });
                          return ranges;
                        };

                        const fmtDate = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
                        const upcomingBlocked = blockedDates.filter(d => d >= new Date().toISOString().split('T')[0]);
                        const vacRanges = groupRanges(upcomingBlocked);

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* ── placeholder removido — form foi para o modal ── */}
                            {false && <form onSubmit={e => e.preventDefault()}
                              style={{ background: '#FFFFFF', border: `1px solid ${editingProf ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>

                              {/* Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: editingProf ? '#374151' : '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                                  {editingProf ? `Editando: ${editingProf.name}` : 'Novo Colaborador'}
                                </p>
                                {editingProf && (
                                  <button type="button" onClick={cancelEditProf}
                                    style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                                    Cancelar
                                  </button>
                                )}
                              </div>

                              {/* Foto + nome + cargo */}
                              <input ref={avatarInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfAvatar(await fileToDataURL(e.target.files[0])); }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => avatarInputRef.current?.click()}>
                                  {(profAvatar || editingProf?.avatar)
                                    ? <img src={profAvatar || editingProf?.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <User size={18} style={{ color: '#9CA3AF' }} />}
                                </div>
                                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <input placeholder="Nome" value={profName} onChange={e => setProfName(e.target.value)} required className="navy-input" />
                                  <input placeholder="Cargo" value={profRole} onChange={e => setProfRole(e.target.value)} className="navy-input" />
                                </div>
                              </div>

                              <div>
                                <label className="navy-label">Comissão %</label>
                                <input type="number" min={0} max={100} value={profCommission} onChange={e => setProfCommission(Number(e.target.value))} className="navy-input" />
                              </div>

                              {/* Divisor */}
                              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>Horários de Atendimento</p>

                                {/* Seletor de dia */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                                  {ALL_DAYS.map(d => {
                                    const active = profSelectedDay === d;
                                    const open   = profDays.includes(d);
                                    return (
                                      <button key={d} type="button" onClick={() => setProfSelectedDay(d)}
                                        style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: active ? '#1D4ED8' : '#F8FAFC', color: active ? '#FFFFFF' : open ? '#374151' : '#9CA3AF', border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`, opacity: open ? 1 : 0.55 }}>
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Toggle aberto/fechado */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '7px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                                  <span style={{ fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>
                                    {profSelectedDay} — {profDayOpen ? `${profCurHours.length} horários` : 'Folga'}
                                  </span>
                                  <button type="button" onClick={() => setProfDays(prev => prev.includes(profSelectedDay) ? prev.filter(d => d !== profSelectedDay) : [...prev, profSelectedDay])}
                                    style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: profDayOpen ? '#DCFCE7' : '#FEE2E2', color: profDayOpen ? '#166534' : '#DC2626', border: `1px solid ${profDayOpen ? '#86EFAC' : '#FCA5A5'}` }}>
                                    {profDayOpen ? 'Trabalha' : 'Folga'}
                                  </button>
                                </div>

                                {/* Horários salvos */}
                                {profCurHours.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                                    {profCurHours.map(h => (
                                      <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#374151' }}>
                                        {h}
                                        <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: (prev[profSelectedDay] || []).filter(x => x !== h) }))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Botão fixo + mini janela de escolha de horário */}
                                <div style={{ position: 'relative' }}>
                                  <button type="button"
                                    onClick={() => { setProfNewHourInput(''); setProfPickerOpen(o => !o); }}
                                    style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: '#1D4ED8', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                    + Adicionar Horário
                                  </button>

                                  {profPickerOpen && (
                                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 210 }}>
                                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                                        Novo horário — {profSelectedDay}
                                      </p>
                                      <input
                                        type="time"
                                        value={profNewHourInput}
                                        onChange={e => setProfNewHourInput(e.target.value)}
                                        autoFocus
                                        className="navy-input"
                                        style={{ fontSize: 22, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2 }}
                                      />
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <button type="button"
                                          onClick={() => {
                                            if (profNewHourInput) {
                                              setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: Array.from(new Set([...(prev[profSelectedDay] || []), profNewHourInput])).sort() }));
                                            }
                                            setProfPickerOpen(false);
                                            setProfNewHourInput('');
                                          }}
                                          style={{ flex: 1, padding: '9px 0', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 800, fontSize: 13, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                          OK
                                        </button>
                                        <button type="button"
                                          onClick={() => { setProfPickerOpen(false); setProfNewHourInput(''); }}
                                          style={{ padding: '9px 14px', background: '#F1F5F9', color: '#6B7280', fontWeight: 600, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                  <button type="button" onClick={() => { const h = profHoursByDay[profSelectedDay] || []; setProfHoursByDay(Object.fromEntries(ALL_DAYS.map(d => [d, profDays.includes(d) ? [...h] : []]))); toast.info('Horários copiados para todos os dias de trabalho.'); }}
                                    style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Copiar p/ todos</button>
                                  <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: [...DEFAULT_HOURS] }))}
                                    style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Resetar padrão</button>
                                  <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: [] }))}
                                    style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Limpar dia</button>
                                </div>
                              </div>

                              <button type="submit"
                                disabled={!editingProf && myProfessionals.length >= 6}
                                style={{ padding: 12, marginTop: 2, background: !editingProf && myProfessionals.length >= 6 ? '#F1F5F9' : '#1D4ED8', color: !editingProf && myProfessionals.length >= 6 ? '#9CA3AF' : '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: !editingProf && myProfessionals.length >= 6 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                {!editingProf && myProfessionals.length >= 6 ? 'Limite de 6 atingido' : editingProf ? 'Salvar alterações' : 'Adicionar colaborador'}
                              </button>
                            </form>}

                              {/* Lista da equipe */}
                              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>Equipe ({myProfessionals.length})</p>
                                  <button type="button"
                                    onClick={() => { setEditingProf(null); setProfName(''); setProfRole('Barbeiro'); setProfAvatar(''); setProfCommission(40); setProfDays(['seg','ter','qua','qui','sex','sab']); setProfHoursByDay(Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d=>[d,[]]))); setShowNewProfModal(true); }}
                                    disabled={myProfessionals.length >= 6}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: myProfessionals.length >= 6 ? '#F1F5F9' : '#1D4ED8', color: myProfessionals.length >= 6 ? '#9CA3AF' : '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 9, cursor: myProfessionals.length >= 6 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                                    <Plus size={13} /> Novo Membro
                                  </button>
                                </div>
                                {myProfessionals.length === 0 && (
                                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 12 }}>Nenhum colaborador ainda.</p>
                                )}
                                {myProfessionals.map(p => {
                                  const totalH = Object.values(p.businessHoursByDay || {}).reduce((s, arr) => s + arr.length, 0);
                                  return (
                                    <div key={p.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: editingProf?.id === p.id ? '#EFF6FF' : '#FFFFFF', border: `1px solid ${editingProf?.id === p.id ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: 10, transition: 'all 150ms' }}>
                                      <img src={p.avatar} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                        <div style={{ fontSize: 10, color: '#6B7280' }}>
                                          {p.role} · {p.commissionPercentage}%
                                          {totalH > 0 && <span style={{ color: '#9CA3AF', marginLeft: 4 }}>· {totalH} slots/sem</span>}
                                        </div>
                                      </div>
                                      <button onClick={() => startEditProf(p)}
                                        title="Editar"
                                        style={{ width: 28, height: 28, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Pencil size={12} />
                                      </button>
                                      <button onClick={async () => { if (!confirm(`Remover ${p.name} da equipe?`)) return; await onDeleteProfessional(p.id); toast.success(`${p.name} removido.`); }}
                                        title="Remover"
                                        style={{ width: 28, height: 28, borderRadius: 8, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Férias & Bloqueios */}
                              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>Férias & Folgas</p>

                                {/* Período */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>De</label>
                                    <input type="date" value={vacStartDate} onChange={e => setVacStartDate(e.target.value)} className="navy-input" />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>Até (opcional)</label>
                                    <input type="date" value={vacEndDate} onChange={e => setVacEndDate(e.target.value)} min={vacStartDate} className="navy-input" />
                                  </div>
                                </div>

                                {/* Quem vai de férias */}
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: 6 }}>Profissionais</label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    <button type="button"
                                      onClick={() => setVacProfIds([])}
                                      style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: vacProfIds.length === 0 ? '#1D4ED8' : '#F8FAFC', color: vacProfIds.length === 0 ? '#FFFFFF' : '#6B7280', border: `1px solid ${vacProfIds.length === 0 ? '#1D4ED8' : '#E2E8F0'}` }}>
                                      Todos
                                    </button>
                                    {myProfessionals.map(p => {
                                      const sel = vacProfIds.includes(p.id);
                                      return (
                                        <button key={p.id} type="button"
                                          onClick={() => setVacProfIds(prev => sel ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: sel ? '#FEF3C7' : '#F8FAFC', color: sel ? '#92400E' : '#6B7280', border: `1px solid ${sel ? '#FCD34D' : '#E2E8F0'}` }}>
                                          <img src={p.avatar} style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          {p.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <button type="button" onClick={addVacationRange} disabled={!vacStartDate}
                                  style={{ width: '100%', padding: '9px 0', background: vacStartDate ? '#FEF3C7' : '#F9FAFB', border: `1px solid ${vacStartDate ? '#FCD34D' : '#E2E8F0'}`, borderRadius: 8, color: vacStartDate ? '#92400E' : '#9CA3AF', fontWeight: 700, fontSize: 12, cursor: vacStartDate ? 'pointer' : 'default', fontFamily: 'Outfit, sans-serif' }}>
                                  Bloquear {vacStartDate && vacEndDate && vacStartDate !== vacEndDate ? 'período' : 'data'}{vacProfIds.length > 0 ? ` para ${vacProfIds.length} profissional${vacProfIds.length > 1 ? 'is' : ''}` : ' para todos'}
                                </button>

                                {/* Bloqueios globais (tenant) */}
                                {vacRanges.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Bloqueios gerais</p>
                                    {vacRanges.map(r => (
                                      <div key={r.start} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                                          {r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} → ${fmtDate(r.end)}`}
                                          <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 5 }}>{r.dates.length}d · todos</span>
                                        </span>
                                        <button type="button" onClick={() => setBlockedDates(prev => prev.filter(d => !r.dates.includes(d)))}
                                          style={{ padding: '2px 7px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 5, color: '#DC2626', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                          Remover
                                        </button>
                                      </div>
                                    ))}
                                    <button type="button" onClick={async () => { try { await onUpdateTenantDetails(activeTenant.id, { blockedDates }); toast.success('Bloqueios gerais salvos!'); } catch { toast.error('Erro ao salvar.'); } }}
                                      style={{ padding: '7px 0', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, color: '#6B7280', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                      Salvar bloqueios gerais
                                    </button>
                                  </div>
                                )}

                                {/* Bloqueios por profissional */}
                                {myProfessionals.some(p => (p.blockedDates ?? []).length > 0) && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Bloqueios individuais</p>
                                    {myProfessionals.filter(p => (p.blockedDates ?? []).length > 0).map(p => {
                                      const profRanges = groupRanges((p.blockedDates ?? []).filter(d => d >= new Date().toISOString().split('T')[0]));
                                      if (!profRanges.length) return null;
                                      return (
                                        <div key={p.id} style={{ padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                            <img src={p.avatar} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{p.name}</span>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {profRanges.map(r => (
                                              <div key={r.start} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#92400E' }}>
                                                  {r.start === r.end ? fmtDate(r.start) : `${fmtDate(r.start)} → ${fmtDate(r.end)}`}
                                                  <span style={{ color: '#9CA3AF', marginLeft: 4 }}>{r.dates.length}d</span>
                                                </span>
                                                <button type="button" onClick={async () => {
                                                  const newDates = (p.blockedDates ?? []).filter(d => !r.dates.includes(d));
                                                  await onUpdateProfessional(p.id, { blockedDates: newDates });
                                                  toast.success('Bloqueio removido.');
                                                }} style={{ padding: '2px 6px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 5, color: '#DC2626', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                                  Remover
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {vacRanges.length === 0 && !myProfessionals.some(p => (p.blockedDates ?? []).length > 0) && (
                                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#9CA3AF', fontSize: 12 }}>Nenhuma data bloqueada</div>
                                )}
                              </div>
                          </div>
                        );
                      })()}

                      {/* Catálogo */}
                      {cfgTab === 'catalogo' && (() => {
                        const isAdded = (name: string) => myServices.some(s => s.name === name);
                        const visiblePresets = PRESET_SERVICES.filter(p => !hiddenPresets.includes(p.name));
                        const addPreset = (preset: typeof PRESET_SERVICES[0]) => {
                          if (isAdded(preset.name)) return;
                          onAddService({ tenantId: activeTenant.id, name: preset.name, price: presetPrices[preset.name] || 0, durationMinutes: preset.durationMinutes, category: preset.category });
                          toast.success(`"${preset.name}" adicionado!`);
                        };
                        const allPresetsAdded = visiblePresets.length === 0 || visiblePresets.every(p => isAdded(p.name));
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                            {/* ── Serviços padrão ── */}
                            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>Serviços Padrão</p>
                                  <p style={{ fontSize: 11, color: '#6B7280', margin: '3px 0 0' }}>Defina o preço e clique para adicionar</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                {hiddenPresets.length > 0 && (
                                  <button type="button" onClick={() => { setHiddenPresets([]); localStorage.removeItem(hiddenPresetsKey); }}
                                    style={{ padding: '7px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#6B7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                                    Restaurar ocultos ({hiddenPresets.length})
                                  </button>
                                )}
                                {!allPresetsAdded && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      PRESET_SERVICES.filter(p => !isAdded(p.name)).forEach(p =>
                                        onAddService({ tenantId: activeTenant.id, name: p.name, price: presetPrices[p.name] || 0, durationMinutes: p.durationMinutes, category: p.category })
                                      );
                                      toast.success('Todos os serviços padrão adicionados!');
                                    }}
                                    style={{ padding: '7px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                                    + Adicionar todos
                                  </button>
                                )}
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                                {visiblePresets.map(preset => {
                                  const added = isAdded(preset.name);
                                  return (
                                    <motion.div key={preset.name} layout
                                      style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${added ? '#86EFAC' : '#E2E8F0'}`, background: added ? '#F0FDF4' : '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: 13, color: added ? '#6B7280' : '#111827', lineHeight: 1.3 }}>{preset.name}</div>
                                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{preset.category} · {preset.durationMinutes} min</div>
                                        </div>
                                        {added && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', background: '#DCFCE7', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>✓ Adicionado</span>
                                            <button type="button"
                                              onClick={async () => {
                                                const srv = myServices.find(s => s.name === preset.name);
                                                if (!srv) return;
                                                if (!window.confirm(`Remover "${preset.name}" do catálogo?`)) return;
                                                await onDeleteService(srv.id);
                                                toast.success(`"${preset.name}" removido.`);
                                              }}
                                              title="Remover do catálogo"
                                              style={{ width: 22, height: 22, borderRadius: 6, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              <X size={11} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      {!added && (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                          <div style={{ position: 'relative', flex: 1 }}>
                                            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', pointerEvents: 'none' }}>R$</span>
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
                                            style={{ padding: '8px 12px', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
                                            + Add
                                          </motion.button>
                                          <button type="button"
                                            onClick={() => setHiddenPresets(h => { const next = [...h, preset.name]; localStorage.setItem(hiddenPresetsKey, JSON.stringify(next)); return next; })}
                                            title="Remover da lista"
                                            style={{ width: 32, height: 32, borderRadius: 8, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <X size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* ── Lista de serviços ativos ── */}
                            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
                                  Serviços Ativos <span style={{ fontFamily: 'monospace', color: '#9CA3AF' }}>({myServices.length})</span>
                                </p>
                                <button type="button"
                                  onClick={() => { setSrvName(''); setSrvPrice(50); setSrvDuration(30); setSrvCategory('Cabelo'); setSrvProfIds([]); setEditingSrv(null); setShowNewSrvModal(true); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                                  <Plus size={13} /> Novo Serviço
                                </button>
                              </div>
                              <div className="no-scrollbar" style={{ maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {myServices.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>Nenhum serviço cadastrado</div>
                                ) : myServices.map(s => (
                                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, color: '#111827', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                                      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{s.category} · {s.durationMinutes} min</div>
                                    </div>
                                    <span style={{ fontWeight: 800, color: s.price > 0 ? '#059669' : '#9CA3AF', fontFamily: 'monospace', fontSize: 13, flexShrink: 0 }}>
                                      {s.price > 0 ? `R$ ${s.price.toFixed(2)}` : '—'}
                                    </span>
                                    <button onClick={() => setSrvProfPanel(s)} title="Profissionais"
                                      style={{ width: 28, height: 28, borderRadius: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <Users size={12} />
                                    </button>
                                    <button onClick={() => { setEditingSrv({ ...s }); setShowNewSrvModal(true); }} title="Editar"
                                      style={{ width: 28, height: 28, borderRadius: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={async () => { if (!window.confirm(`Remover "${s.name}"?`)) return; await onDeleteService(s.id); toast.success(`"${s.name}" removido.`); }} title="Remover"
                                      style={{ width: 28, height: 28, borderRadius: 7, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        );
                      })()}

                      {/* ── Página do Cliente ── */}
                      {cfgTab === 'pagina-cliente' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                          {/* Form */}
                          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* Link do Cliente */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ExternalLink size={13} /> Link do Cliente
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px' }}>
                                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {window.location.origin}/{activeTenant.slug}/agendamento
                                </span>
                                <button type="button" onClick={handleCopyBookingLink} title="Copiar link"
                                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: slugCopied ? '#DCFCE7' : '#F8FAFC', border: `1px solid ${slugCopied ? '#86EFAC' : '#E2E8F0'}`, color: slugCopied ? '#166534' : '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}>
                                  {slugCopied ? <CheckCheck size={13} /> : <Copy size={13} />}
                                </button>
                                <button type="button" onClick={() => window.open(`${window.location.origin}/${activeTenant.slug}/agendamento`, '_blank')} title="Abrir link"
                                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <ExternalLink size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Personalizar URL */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Pencil size={13} /> Personalizar URL
                              </p>
                              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                                Edite o nome que aparece no link de agendamento. Use apenas letras, números e hífens.
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: `1px solid ${slugStatus === 'available' ? '#86EFAC' : slugStatus === 'taken' ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 12, padding: '10px 14px', gap: 4, transition: 'border-color 200ms' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>{window.location.origin}/</span>
                                <input
                                  value={slugInput}
                                  onChange={e => handleSlugChange(e.target.value)}
                                  placeholder={activeTenant.slug}
                                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 13, color: '#111827', minWidth: 60 }}
                                />
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>/agendamento</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  {slugStatus === 'checking' && <><RefreshCw size={12} style={{ color: '#6B7280', animation: 'spin 1s linear infinite' }} /><span style={{ color: '#6B7280' }}>Verificando…</span></>}
                                  {slugStatus === 'available' && <><Check size={12} style={{ color: '#16a34a' }} /><span style={{ color: '#16a34a' }}>Disponível</span></>}
                                  {slugStatus === 'taken' && <><X size={12} style={{ color: '#DC2626' }} /><span style={{ color: '#DC2626' }}>Já está em uso</span></>}
                                  {slugStatus === 'saving' && <><RefreshCw size={12} style={{ color: '#6B7280', animation: 'spin 1s linear infinite' }} /><span style={{ color: '#6B7280' }}>Salvando…</span></>}
                                  {slugStatus === 'idle' && slugInput === activeTenant.slug && <span style={{ color: '#9CA3AF', fontSize: 11 }}>URL atual</span>}
                                </span>
                                <button type="button" onClick={handleSaveSlug}
                                  disabled={slugStatus !== 'available'}
                                  style={{ padding: '7px 16px', background: slugStatus === 'available' ? '#1D4ED8' : '#F1F5F9', color: slugStatus === 'available' ? '#FFFFFF' : '#9CA3AF', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 9, cursor: slugStatus === 'available' ? 'pointer' : 'not-allowed', fontFamily: 'Outfit, sans-serif', transition: 'all 200ms' }}>
                                  Salvar URL
                                </button>
                              </div>
                            </div>

                            {/* Cor principal */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                                <span style={{ fontSize: 12, color: '#374151', fontFamily: 'Outfit, sans-serif' }}>Personalizada:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '6px 12px' }}>
                                  <input type="color" value={bookingPrimaryColor} onChange={e => setBookingPrimaryColor(e.target.value)}
                                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#374151', letterSpacing: '0.05em' }}>{bookingPrimaryColor.toUpperCase()}</span>
                                </div>
                              </div>
                            </div>

                            {/* Informações visíveis */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Eye size={13} /> Informações Visíveis
                              </p>
                              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>
                                Escolha quais dados aparecem para o cliente na página de agendamento.
                              </p>
                              {([
                                { key: 'phone',     label: 'Telefone',  icon: <Phone size={14} />,     value: bookingShowPhone,     setter: setBookingShowPhone },
                                { key: 'address',   label: 'Endereço',  icon: <MapPin size={14} />,    value: bookingShowAddress,   setter: setBookingShowAddress },
                                { key: 'instagram', label: 'Instagram', icon: <Instagram size={14} />, value: bookingShowInstagram, setter: setBookingShowInstagram },
                              ] as { key: string; label: string; icon: React.ReactNode; value: boolean; setter: (v: boolean) => void }[]).map(row => (
                                <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '11px 14px', marginBottom: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#374151', fontSize: 13 }}>
                                    {row.icon} {row.label}
                                  </div>
                                  <button type="button" onClick={() => row.setter(!row.value)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s',
                                      background: row.value ? '#E6F4EC' : '#F8FAFC',
                                      color:      row.value ? '#0A4A2C'  : '#6B7280',
                                      border:     `1px solid ${row.value ? '#A7D7BC' : '#E2E8F0'}` }}>
                                    {row.value ? <Eye size={11} /> : <EyeOff size={11} />}
                                    {row.value ? 'Visível' : 'Oculto'}
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Link Google Maps */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MapPin size={13} /> Localização no Maps
                              </p>
                              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                                Cole o link do Google Maps do estabelecimento. Aparece na confirmação e no cancelamento do agendamento.
                              </p>
                              <input
                                type="url"
                                placeholder="https://maps.app.goo.gl/..."
                                value={bookingMapsUrl}
                                onChange={e => setBookingMapsUrl(e.target.value)}
                                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#111827', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }}
                              />
                            </div>

                            <button type="button"
                              onClick={async () => { try { await onUpdateTenantDetails(activeTenant.id, { bookingPageConfig: { primaryColor: bookingPrimaryColor, showPhone: bookingShowPhone, showAddress: bookingShowAddress, showInstagram: bookingShowInstagram, mapsUrl: bookingMapsUrl || undefined, waitlistEnabled: bookingWaitlistEnabled } }); toast.success('Página do cliente atualizada!'); } catch { toast.error('Erro ao salvar.'); } }}
                              style={{ padding: 13, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                              Salvar Configurações
                            </button>
                          </div>

                          {/* Pré-visualização */}
                          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 16 }}>Pré-visualização</p>
                            {(() => {
                              const h = bookingPrimaryColor.replace('#', '');
                              const pr = parseInt(h.slice(0,2),16), pg = parseInt(h.slice(2,4),16), pb = parseInt(h.slice(4,6),16);
                              const mix = (ch: number, n: number) => Math.round(n + (ch-n)*0.18);
                              const tintBg  = `rgb(${mix(pr,110)},${mix(pg,116)},${mix(pb,98)})`;
                              const pcBorder = `rgba(${pr},${pg},${pb},0.28)`;
                              const getInitials = (name: string) => {
                                const clean = name.replace(/barbearia|salao|studio|estetica/gi,'').trim();
                                const words = clean.split(/\s+/);
                                return words.length >= 2 ? (words[0][0]+words[1][0]).toUpperCase() : (clean.substring(0,2)||'BR').toUpperCase();
                              };
                              const previewServices = myServices.length > 0 ? myServices.slice(0,4) : [
                                { id:'p1', name:'Corte + Barba', durationMinutes:45 },
                                { id:'p2', name:'Barba',         durationMinutes:30 },
                              ];
                              return (
                                <div style={{ background: tintBg, borderRadius: 12, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                  {/* Logo */}
                                  {(tenantLogo?.startsWith('http') || tenantLogo?.startsWith('data:'))
                                    ? <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${pcBorder}`, flexShrink: 0 }}>
                                        <img src={tenantLogo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                    : <div style={{ width: 112, height: 112, borderRadius: '50%', border: `2px solid ${bookingPrimaryColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', position: 'relative', flexShrink: 0 }}>
                                        <span style={{ position: 'absolute', top: 8, right: 8, transform: 'rotate(45deg)', color: bookingPrimaryColor, fontSize: 14 }}>✂</span>
                                        <span style={{ fontSize: 36, fontWeight: 300, color: bookingPrimaryColor, lineHeight: 1 }}>{getInitials(activeTenant.name)}</span>
                                        <span style={{ fontSize: 8, fontWeight: 700, color: bookingPrimaryColor, letterSpacing: 2, textTransform: 'uppercase' as const, marginTop: 6, textAlign: 'center' as const, maxWidth: 90, lineHeight: 1.3 }}>
                                          {activeTenant.name.replace(/barbearia|salao|studio|estetica/gi,'').trim()}
                                        </span>
                                      </div>
                                  }
                                  {/* Infos de contato */}
                                  {(bookingShowPhone || bookingShowAddress || bookingShowInstagram) && (
                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {bookingShowPhone && activeTenant.phone && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                                          <Phone size={12} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                          <span>{activeTenant.phone}</span>
                                        </div>
                                      )}
                                      {bookingShowAddress && activeTenant.address && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                                          <MapPin size={12} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTenant.address}</span>
                                        </div>
                                      )}
                                      {bookingShowInstagram && activeTenant.instagram && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                                          <Instagram size={12} style={{ color: bookingPrimaryColor, flexShrink: 0 }} />
                                          <span>{activeTenant.instagram}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {/* Serviços */}
                                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {previewServices.map((srv, i) => (
                                      <div key={srv.id} style={{ width: '100%', padding: '14px 20px', background: bookingPrimaryColor, color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: `0 4px 12px rgba(${pr},${pg},${pb},0.25)`, opacity: myServices.length === 0 && i === 1 ? 0.7 : 1 }}>
                                        <span>{srv.name}</span>
                                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 6 }}>{srv.durationMinutes} min ▶</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {cfgTab === 'assinatura' && (() => {
                        const BASE = 89.90;
                        const ACCENT = '#2563EB';
                        type PlanKey = 'mensal' | 'trimestral' | 'anual';
                        const PLANS: Array<{ key: PlanKey; label: string; months: number; discountPct: number; hot: boolean; badge: string | null; billing: string }> = [
                          { key: 'mensal',     label: 'Mensal',     months: 1,  discountPct: 0,  hot: false, badge: null,           billing: 'Cobrado mensalmente' },
                          { key: 'trimestral', label: 'Trimestral', months: 3,  discountPct: 15, hot: true,  badge: '15% OFF',      billing: `R$ ${(BASE*0.85*3).toFixed(2).replace('.',',')} / 3 meses` },
                          { key: 'anual',      label: 'Anual',      months: 12, discountPct: 25, hot: false, badge: 'Melhor valor', billing: `R$ ${(BASE*0.75*12).toFixed(2).replace('.',',')} / ano` },
                        ];
                        const FEATURES = [
                          'Agendamento online ilimitado',
                          'WhatsApp automático (confirmação + lembrete)',
                          'Gestão financeira completa',
                          'Multi-profissional com comissões automáticas',
                          'Página pública personalizada com seu link',
                          'Histórico de clientes',
                          'Relatórios e métricas',
                          'Suporte via chat',
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
                            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

                              {/* Cabeçalho com gradiente */}
                              <div style={{ background: isTrial ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : isActive ? 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', padding: '24px 24px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 6px' }}>Plano atual</p>
                                  <p style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>{planLabels[activeTenant.plan] ?? activeTenant.plan}</p>
                                </div>
                                <span style={{ padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' as const, letterSpacing: '0.3px' }}>
                                  {statusLabel}
                                </span>
                              </div>

                              {/* Corpo */}
                              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

                                {/* Métricas */}
                                <div style={{ display: 'grid', gridTemplateColumns: isActive && !isTrial ? '1fr 1fr' : '1fr', gap: 10 }}>
                                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                                    <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px', fontWeight: 600 }}>
                                      {isTrial ? 'Trial encerra em' : 'Válido até'}
                                    </p>
                                    <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>{fmtDate(endDate)}</p>
                                    {daysLeft !== null && (
                                      <p style={{ fontSize: 11, color: daysLeft <= 10 ? '#f59e0b' : '#22c55e', margin: '3px 0 0', fontWeight: 700 }}>
                                        {daysLeft > 0
                                          ? `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`
                                          : 'Vence hoje'}
                                      </p>
                                    )}
                                  </div>
                                  {isActive && !isTrial && (
                                    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                                      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px', fontWeight: 600 }}>Valor pago</p>
                                      <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>
                                        {activeTenant.mrr > 0 ? `R$ ${Number(activeTenant.mrr).toFixed(2).replace('.', ',')}` : '—'}
                                      </p>
                                      <p style={{ fontSize: 10, color: '#9CA3AF', margin: '3px 0 0', fontWeight: 600 }}>via Asaas · Pix / Boleto / Cartão</p>
                                    </div>
                                  )}
                                </div>

                                {/* Banner contextual */}
                                {showAlert && (
                                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                                    <p style={{ fontSize: 12, color: '#92400e', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                      {isTrial
                                        ? `Trial encerra em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Escolha um plano abaixo.`
                                        : `Assinatura vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renove para não perder o acesso.`}
                                    </p>
                                  </div>
                                )}
                                {isTrial && !showAlert && (
                                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>✨</span>
                                    <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                      Período de teste gratuito de 7 dias. Explore tudo e escolha seu plano abaixo.
                                    </p>
                                  </div>
                                )}
                                {isActive && !isTrial && !showAlert && (
                                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>
                                    <p style={{ fontSize: 12, color: '#14532d', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                      Assinatura ativa e em dia. Você pode adicionar mais tempo ao seu plano a qualquer momento.
                                    </p>
                                  </div>
                                )}

                                {/* Botão renovar */}
                                {!isTrial && (
                                  <button
                                    onClick={() => handleSubscribe(activeTenant.plan as 'mensal' | 'trimestral' | 'anual')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', background: showAlert ? '#f59e0b' : '#2563EB', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: showAlert ? '0 4px 14px rgba(245,158,11,0.35)' : '0 4px 14px rgba(37,99,235,0.30)', transition: 'all 0.2s' }}>
                                    <RefreshCw size={15} />
                                    {showAlert ? 'Renovar agora — não perca o acesso' : 'Renovar plano agora'}
                                  </button>
                                )}
                                {isTrial && (
                                  <button
                                    onClick={() => handleSubscribe('trimestral')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 4px 14px rgba(37,99,235,0.30)', transition: 'all 0.2s' }}>
                                    <Zap size={15} />
                                    Assinar agora
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Planos */}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 20px' }}>
                                {isActive && !isTrial && !showAlert ? 'Alterar plano' : 'Escolha seu plano'}
                              </p>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                                {PLANS.map(p => {
                                  const monthly   = parseFloat((BASE * (1 - p.discountPct / 100)).toFixed(2));
                                  const isCurrent = activeTenant.plan === p.key;
                                  const isRenew   = isCurrent && showAlert;

                                  return (
                                    <div key={p.key} style={{
                                      position: 'relative' as const,
                                      background: p.hot ? ACCENT : isCurrent ? '#EFF6FF' : '#FFFFFF',
                                      border: `1px solid ${p.hot ? ACCENT : isCurrent ? '#BFDBFE' : '#E2E8F0'}`,
                                      borderRadius: 28,
                                      padding: '36px 24px 24px',
                                      display: 'flex',
                                      flexDirection: 'column' as const,
                                      boxShadow: p.hot ? '0 20px 56px rgba(37,99,235,0.28)' : '0 2px 12px rgba(0,0,0,0.05)',
                                      transform: p.hot ? 'scale(1.03)' : 'none',
                                      zIndex: p.hot ? 1 : 0,
                                    }}>
                                      {/* Badge */}
                                      {(p.badge || isCurrent) && (
                                        <div style={{ position: 'absolute' as const, top: -14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const }}>
                                          <span style={{ background: isCurrent ? '#22c55e' : p.hot ? '#fff' : ACCENT, color: isCurrent ? '#fff' : p.hot ? ACCENT : '#fff', fontSize: 11, fontWeight: 800, padding: '5px 16px', borderRadius: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                                            {isCurrent ? '✓ PLANO ATUAL' : p.badge}
                                          </span>
                                        </div>
                                      )}

                                      {/* Label */}
                                      <p style={{ fontSize: 12, fontWeight: 700, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569', textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '0 0 14px' }}>{p.label}</p>

                                      {/* Preço */}
                                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569', fontWeight: 600 }}>R$</span>
                                        <span style={{ fontSize: 46, fontWeight: 900, color: p.hot ? '#fff' : '#111111', lineHeight: 1, letterSpacing: '-2px' }}>
                                          {monthly.toFixed(2).replace('.', ',')}
                                        </span>
                                        <span style={{ fontSize: 14, color: p.hot ? 'rgba(255,255,255,0.65)' : '#475569' }}>/mês</span>
                                      </div>

                                      {/* Billing */}
                                      <p style={{ fontSize: 12, color: p.hot ? 'rgba(255,255,255,0.45)' : '#94a3b8', margin: '0 0 20px' }}>{p.billing}</p>

                                      {/* Features */}
                                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column' as const, gap: 9, flex: 1 }}>
                                        {FEATURES.map(f => (
                                          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: p.hot ? 'rgba(255,255,255,0.85)' : '#475569', lineHeight: 1.5 }}>
                                            <span style={{ flexShrink: 0, marginTop: 2, width: 17, height: 17, borderRadius: 99, background: p.hot ? 'rgba(255,255,255,0.2)' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.hot ? '#fff' : '#16a34a' }}>
                                              <Check size={10} strokeWidth={3} />
                                            </span>
                                            <span>{f}</span>
                                          </li>
                                        ))}
                                      </ul>

                                      {/* Botão */}
                                      <button
                                        disabled={isCurrent && !isTrial && !isRenew}
                                        onClick={() => { if (!isCurrent || isRenew || isTrial) handleSubscribe(p.key); }}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '14px',
                                          fontWeight: 700,
                                          fontSize: 14,
                                          background: p.hot ? '#fff' : isCurrent && !isTrial && !isRenew ? '#F1F5F9' : ACCENT,
                                          color: p.hot ? ACCENT : isCurrent && !isTrial && !isRenew ? '#374151' : '#fff',
                                          border: isCurrent && !isTrial && !isRenew && !p.hot ? '1px solid #E2E8F0' : 'none',
                                          borderRadius: 14,
                                          cursor: isCurrent && !isTrial && !isRenew ? 'default' : 'pointer',
                                          fontFamily: 'Outfit, sans-serif',
                                          boxShadow: p.hot ? '0 4px 16px rgba(0,0,0,0.10)' : 'none',
                                          transition: 'all 0.2s',
                                        }}
                                      >
                                        {isRenew ? 'Renovar agora' : isCurrent && !isTrial ? 'Plano atual' : isTrial ? 'Assinar' : 'Mudar plano'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' as const, margin: '16px 0 0', lineHeight: 1.5 }}>
                                Pagamentos processados via Asaas · Boleto, Pix ou Cartão de Crédito
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Configurações da Agenda ── */}
                      {cfgTab === 'agenda-config' && (() => {
                        const MODES: { id: 'auto_complete' | 'auto_cancel' | 'manual'; icon: string; label: string; badge: string; badgeColor: string; desc: string; waitlistNote: string; pros: string; cons: string }[] = [
                          {
                            id: 'auto_complete',
                            icon: '✅',
                            label: 'Conclusão Automática',
                            badge: 'Recomendado',
                            badgeColor: '#059669',
                            desc: `Após o tempo definido desde o fim do atendimento, o serviço é marcado como Concluído e o faturamento é registrado automaticamente.`,
                            waitlistNote: '✅ O link de cancelamento do cliente e cancelamentos manuais pelo painel sempre disparam a lista de espera, em qualquer cenário.\n⚠️ Após o tempo X sem cancelamento, o serviço é concluído automaticamente — a lista de espera não é notificada.',
                            pros: 'Faturamento sempre registrado. Sem necessidade de marcar manualmente cada atendimento.',
                            cons: 'No-shows são registrados como Concluídos. Para cancelar uma falta, é preciso agir antes do tempo X.',
                          },
                          {
                            id: 'auto_cancel',
                            icon: '❌',
                            label: 'Cancelamento Automático',
                            badge: 'Maximiza lista de espera',
                            badgeColor: '#2563EB',
                            desc: `Se o atendimento não for marcado como Concluído dentro do tempo definido após o fim, ele é cancelado automaticamente.`,
                            waitlistNote: '✅ O link de cancelamento do cliente e cancelamentos manuais sempre disparam a lista de espera.\n✅ Após o tempo X sem conclusão, o cancelamento automático também notifica a lista de espera.',
                            pros: 'No-shows liberam a vaga automaticamente. A lista de espera é ativada sem intervenção manual.',
                            cons: 'Se esquecer de concluir um atendimento real, ele pode ser cancelado. Ação de "concluir" passa a ser obrigatória.',
                          },
                          {
                            id: 'manual',
                            icon: '⚙️',
                            label: 'Manual',
                            badge: 'Controle total',
                            badgeColor: '#6B7280',
                            desc: `Nenhuma automação. Você define o status de cada atendimento manualmente — concluído, cancelado ou deixa pendente.`,
                            waitlistNote: '✅ O link de cancelamento do cliente sempre dispara a lista de espera, em qualquer cenário.\n⚠️ Sem automação, no-shows precisam ser cancelados manualmente — esquecimentos fazem a lista de espera perder a oportunidade.',
                            pros: 'Controle total sobre cada atendimento. Sem risco de ação automática inesperada.',
                            cons: 'Sem automação de faturamento ou cancelamento. No-shows não liberam vaga automaticamente.',
                          },
                        ];

                        const handleSave = async () => {
                          setAgendaSaving(true);
                          try {
                            await onUpdateTenantDetails(activeTenant.id, {
                              agendaMode, agendaTimeMinutes, timezone: agendaTimezone,
                              bookingPageConfig: { ...activeTenant.bookingPageConfig, primaryColor: activeTenant.bookingPageConfig?.primaryColor ?? '#2563EB', showPhone: activeTenant.bookingPageConfig?.showPhone ?? true, showAddress: activeTenant.bookingPageConfig?.showAddress ?? true, showInstagram: activeTenant.bookingPageConfig?.showInstagram ?? true, waitlistEnabled: bookingWaitlistEnabled },
                            });
                            toast.success('Configurações da agenda salvas!');
                          } catch { toast.error('Erro ao salvar.'); }
                          setAgendaSaving(false);
                        };

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>

                              <div>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 4px' }}>Modo de conclusão de atendimentos</p>
                                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>Define o que acontece quando o horário de um atendimento passa.</p>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                                  {MODES.map(m => {
                                    const sel = agendaMode === m.id;
                                    return (
                                      <button key={m.id} type="button" onClick={() => setAgendaMode(m.id)}
                                        style={{ textAlign: 'left' as const, padding: 16, borderRadius: 14, border: `2px solid ${sel ? '#2563EB' : '#E2E8F0'}`, background: sel ? '#EFF6FF' : '#FAFAFA', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                          <span style={{ fontSize: 22 }}>{m.icon}</span>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <span style={{ fontSize: 14, fontWeight: 800, color: sel ? '#1E40AF' : '#111827' }}>{m.label}</span>
                                              <span style={{ fontSize: 10, fontWeight: 700, background: m.badgeColor + '18', color: m.badgeColor, borderRadius: 20, padding: '2px 8px', border: `1px solid ${m.badgeColor}30` }}>{m.badge}</span>
                                              {sel && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#2563EB' }}>✓ Selecionado</span>}
                                            </div>
                                          </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>{m.desc}</p>
                                        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                                          <p style={{ fontSize: 11, color: '#475569', margin: 0, lineHeight: 1.5 }}>{m.waitlistNote}</p>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                          <div style={{ fontSize: 11, color: '#15803D' }}>✓ {m.pros}</div>
                                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>⚠ {m.cons}</div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {(() => {
                                const endMin  = 14 * 60 + 30;
                                const actMin  = endMin + agendaTimeMinutes;
                                const actTime = `${String(Math.floor(actMin / 60)).padStart(2,'0')}:${String(actMin % 60).padStart(2,'0')}`;
                                const exampleText = agendaMode === 'auto_complete'
                                  ? `Ex: serviço das 14:00 (30 min) → fim às 14:30 → concluído automaticamente ${agendaTimeMinutes} min depois, às ${actTime}`
                                  : agendaMode === 'auto_cancel'
                                  ? `Ex: serviço das 14:00 (30 min) → fim às 14:30 → se não concluído, cancelado automaticamente ${agendaTimeMinutes} min depois, às ${actTime}`
                                  : 'Ex: sem automação — o status de cada atendimento deve ser definido manualmente pelo painel.';
                                return (
                                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
                                    {agendaMode !== 'manual' && (
                                      <>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 12px' }}>Tempo de espera após fim do atendimento</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                          <input
                                            type="number" min={5} max={240} value={agendaTimeMinutes}
                                            onChange={e => setAgendaTimeMinutes(Math.max(5, Math.min(240, Number(e.target.value))))}
                                            style={{ width: 80, padding: '9px 12px', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 16, fontWeight: 700, color: '#111827', textAlign: 'center' as const, outline: 'none', fontFamily: 'Outfit, sans-serif' }}
                                          />
                                          <span style={{ fontSize: 13, color: '#374151' }}>minutos após o fim do atendimento</span>
                                        </div>
                                      </>
                                    )}
                                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px' }}>
                                      <p style={{ fontSize: 11, color: '#374151', margin: 0, lineHeight: 1.6 }}>
                                        <strong>Exemplo atual:</strong> {exampleText}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Fuso horário */}
                              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 6px' }}>Fuso Horário</p>
                                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px' }}>
                                  Define o horário local usado nos agendamentos e nas automações.
                                </p>
                                <select value={agendaTimezone} onChange={e => setAgendaTimezone(e.target.value)}
                                  style={{ width: '100%', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}>
                                  <optgroup label="Brasil">
                                    <option value="America/Sao_Paulo">Brasília / São Paulo / Rio de Janeiro (UTC-3)</option>
                                    <option value="America/Fortaleza">Nordeste — CE, RN, PB, PI, MA, SE, AL (UTC-3)</option>
                                    <option value="America/Belem">Pará / Amapá (UTC-3)</option>
                                    <option value="America/Manaus">Amazonas / Mato Grosso (UTC-4)</option>
                                    <option value="America/Porto_Velho">Rondônia (UTC-4)</option>
                                    <option value="America/Boa_Vista">Roraima (UTC-4)</option>
                                    <option value="America/Rio_Branco">Acre (UTC-5)</option>
                                    <option value="America/Noronha">Fernando de Noronha (UTC-2)</option>
                                    <option value="America/Cuiaba">Mato Grosso do Sul (UTC-4)</option>
                                  </optgroup>
                                  <optgroup label="América do Norte">
                                    <option value="America/New_York">Nova York / Miami (UTC-5/-4)</option>
                                    <option value="America/Chicago">Chicago / Houston (UTC-6/-5)</option>
                                    <option value="America/Denver">Denver (UTC-7/-6)</option>
                                    <option value="America/Los_Angeles">Los Angeles / Seattle (UTC-8/-7)</option>
                                    <option value="America/Toronto">Toronto / Ottawa (UTC-5/-4)</option>
                                  </optgroup>
                                  <optgroup label="Europa">
                                    <option value="Europe/Lisbon">Lisboa (UTC+0/+1)</option>
                                    <option value="Europe/London">Londres (UTC+0/+1)</option>
                                    <option value="Europe/Madrid">Madri / Paris / Roma (UTC+1/+2)</option>
                                    <option value="Europe/Berlin">Berlim / Amsterdã (UTC+1/+2)</option>
                                  </optgroup>
                                  <optgroup label="Outros">
                                    <option value="UTC">UTC / GMT (sem offset)</option>
                                    <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
                                    <option value="America/Santiago">Santiago (UTC-4/-3)</option>
                                    <option value="America/Bogota">Bogotá / Lima (UTC-5)</option>
                                    <option value="America/Mexico_City">Cidade do México (UTC-6/-5)</option>
                                  </optgroup>
                                </select>
                                {(() => {
                                  try {
                                    const nowLocal = new Date().toLocaleTimeString('pt-BR', { timeZone: agendaTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
                                    return <p style={{ fontSize: 11, color: '#6B7280', margin: '8px 0 0' }}>🕐 Horário atual neste fuso: <strong>{nowLocal}</strong></p>;
                                  } catch { return null; }
                                })()}
                              </div>

                              {/* Lista de Espera */}
                              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 12px' }}>Lista de Espera</p>
                                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14 }}>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Ativar lista de espera no link de agendamento</p>
                                    <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                                      Quando ativa, clientes podem entrar em uma fila ao selecionar um dia sem horários disponíveis. Ao cancelar qualquer agendamento, o sistema avisa automaticamente os candidatos compatíveis na fila.
                                    </p>
                                  </div>
                                  <button type="button" onClick={() => setBookingWaitlistEnabled(v => !v)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', flexShrink: 0, alignSelf: 'center', transition: 'all 0.15s',
                                      background: bookingWaitlistEnabled ? '#DCFCE7' : '#F1F5F9',
                                      color:      bookingWaitlistEnabled ? '#166534'  : '#6B7280',
                                      border:     `1px solid ${bookingWaitlistEnabled ? '#86EFAC' : '#E2E8F0'}` }}>
                                    {bookingWaitlistEnabled ? <><CheckCheck size={13} /> Ativada</> : <><EyeOff size={13} /> Desativada</>}
                                  </button>
                                </div>
                              </div>

                              {/* Boas práticas */}
                              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 20 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  💡 Boas práticas para melhor desempenho
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                                  {[
                                    { icon: '📲', text: 'Instrua os clientes a cancelarem pelo link de cancelamento recebido no WhatsApp caso não possam comparecer — isso libera a vaga automaticamente e ativa a lista de espera.' },
                                    { icon: '⏰', text: 'Configure um lembrete automático em Automações → Templates para reforçar o pedido de cancelamento antecipado com antecedência de 12 a 24 horas.' },
                                    { icon: '📋', text: 'Adicione no template de confirmação: "Não conseguirá comparecer? Cancele pelo link abaixo para liberar a vaga para outro cliente."' },
                                    { icon: '🔄', text: 'Com a Conclusão Automática ativa, você só precisa atender — o sistema registra e conclui. Reserve a ação de cancelar para faltas reais.' },
                                    { icon: '🎯', text: 'Com a lista de espera ativa, cada cancelamento vira uma oportunidade de faturamento — o sistema notifica automaticamente quem estava esperando.' },
                                  ].map(({ icon, text }) => (
                                    <div key={icon} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                                      <span style={{ flexShrink: 0 }}>{icon}</span>
                                      <span>{text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <button type="button" onClick={handleSave} disabled={agendaSaving}
                                style={{ padding: 13, background: agendaSaving ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: agendaSaving ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                {agendaSaving ? 'Salvando…' : 'Salvar Configurações da Agenda'}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {cfgTab === 'conta' && (() => {
                        const createdAt  = user?.created_at ? new Date(user.created_at) : null;
                        const ageDays    = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) : null;
                        const ageText    = ageDays === null ? '—'
                          : ageDays === 0 ? 'Hoje'
                          : ageDays < 30  ? `${ageDays} dia${ageDays > 1 ? 's' : ''}`
                          : ageDays < 365 ? `${Math.floor(ageDays / 30)} mês${Math.floor(ageDays / 30) > 1 ? 'es' : ''}`
                          : `${Math.floor(ageDays / 365)} ano${Math.floor(ageDays / 365) > 1 ? 's' : ''}`;
                        const dataCadastro = createdAt
                          ? createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                          : '—';

                        const isGoogleUser = user?.app_metadata?.provider === 'google'
                          || (user?.identities ?? []).some((id: { provider: string }) => id.provider === 'google');

                        const handleTrocarSenha = async (e: React.FormEvent) => {
                          e.preventDefault();
                          if (novaSenha.length < 6) { toast.error('A nova senha deve ter ao menos 6 caracteres.'); return; }
                          if (novaSenha !== confirmarSenha) { toast.error('As senhas não coincidem.'); return; }
                          setSalvandoSenha(true);
                          if (!isGoogleUser) {
                            if (!senhaAtual) { setSalvandoSenha(false); toast.error('Informe sua senha atual.'); return; }
                            const { error: authError } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: senhaAtual });
                            if (authError) { setSalvandoSenha(false); toast.error('Senha atual incorreta.'); return; }
                          }
                          const { error } = await supabase.auth.updateUser({ password: novaSenha });
                          setSalvandoSenha(false);
                          if (error) { toast.error('Erro ao trocar senha: ' + error.message); return; }
                          toast.success('Senha definida com sucesso!');
                          setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
                        };

                        const infoRow: React.CSSProperties = {
                          display: 'flex', alignItems: 'center', gap: 14,
                          background: '#F8FAFC', border: '1px solid #E2E8F0',
                          borderRadius: 12, padding: '14px 18px',
                        };
                        const iconWrap: React.CSSProperties = {
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#F1F5F9', border: '1px solid #E2E8F0',
                        };

                        return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                          {/* Informações da conta */}
                          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, margin: '0 0 6px' }}>
                              Informações da Conta
                            </h4>
                            <div style={infoRow}>
                              <div style={iconWrap}><Mail style={{ width: 15, height: 15, color: '#6B7280' }} /></div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: 2 }}>E-mail</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{user?.email ?? '—'}</div>
                              </div>
                            </div>
                            <div style={infoRow}>
                              <div style={iconWrap}><Clock style={{ width: 15, height: 15, color: '#6B7280' }} /></div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: 2 }}>Membro há</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{ageText}</div>
                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Desde {dataCadastro}</div>
                              </div>
                            </div>
                            <div style={infoRow}>
                              <div style={iconWrap}><Shield style={{ width: 15, height: 15, color: '#6B7280' }} /></div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: 4 }}>Status</div>
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                                  background: activeTenant.status === 'active' ? '#E6F4EC' : activeTenant.status === 'trial' ? '#FEF9EC' : '#FEECEC',
                                  color: activeTenant.status === 'active' ? '#0A4A2C' : activeTenant.status === 'trial' ? '#7A4B0A' : '#7A0A0A' }}>
                                  {activeTenant.status === 'active' ? 'Plano Ativo' : activeTenant.status === 'trial' ? 'Em Teste' : 'Inadimplente'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Trocar / Definir senha */}
                          <form onSubmit={handleTrocarSenha} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Lock style={{ width: 12, height: 12 }} /> {isGoogleUser ? 'Definir Senha' : 'Trocar Senha'}
                            </h4>
                            {isGoogleUser && (
                              <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                                Sua conta usa login pelo Google. Você pode definir uma senha para também acessar por e-mail e senha.
                              </p>
                            )}
                            {!isGoogleUser && (
                              <div style={{ position: 'relative' as const }}>
                                <input type={showSenhaAtual ? 'text' : 'password'} placeholder="Senha atual"
                                  value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} required
                                  className="navy-input" style={{ paddingRight: 44 }} />
                                <button type="button" onClick={() => setShowSenhaAtual(v => !v)}
                                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                                  {showSenhaAtual ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                                </button>
                              </div>
                            )}
                            <div style={{ position: 'relative' as const }}>
                              <input type={showNovaSenha ? 'text' : 'password'} placeholder="Nova senha (mín. 6 caracteres)"
                                value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required
                                className="navy-input" style={{ paddingRight: 44 }} />
                              <button type="button" onClick={() => setShowNovaSenha(v => !v)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                                {showNovaSenha ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                              </button>
                            </div>
                            <div style={{ position: 'relative' as const }}>
                              <input type={showConfSenha ? 'text' : 'password'} placeholder="Confirmar nova senha"
                                value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} required
                                className="navy-input" style={{ paddingRight: 44 }} />
                              <button type="button" onClick={() => setShowConfSenha(v => !v)}
                                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
                                {showConfSenha ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                              </button>
                            </div>
                            {novaSenha && confirmarSenha && novaSenha !== confirmarSenha && (
                              <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>As senhas não coincidem.</p>
                            )}
                            <button type="submit" disabled={salvandoSenha}
                              style={{ padding: '12px', background: salvandoSenha ? '#F1F5F9' : '#1D4ED8', color: salvandoSenha ? '#9CA3AF' : '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: salvandoSenha ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s' }}>
                              {salvandoSenha ? 'Salvando…' : isGoogleUser ? 'Definir Senha' : 'Alterar Senha'}
                            </button>
                          </form>

                          {/* Guia de configuração */}
                          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: 6 }}>Guia de Configuração</h4>
                              <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                                Rever o assistente que guia a configuração do negócio e do link de agendamento.
                              </p>
                            </div>
                            <button onClick={restartTour}
                              style={{ padding: '9px 18px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              🗺️ Rever guia
                            </button>
                          </div>

                          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16, padding: 24 }}>
                            <h4 style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid #FECACA', paddingBottom: 12, margin: '0 0 16px' }}>Excluir Conta</h4>

                            {deleteStep === 'idle' && (
                              <div>
                                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '0 0 12px' }}>
                                  Em conformidade com a <strong style={{ color: '#111827' }}>LGPD (Lei 13.709/2018)</strong>, você pode solicitar a exclusão permanente de todos os seus dados, incluindo agendamentos, clientes, serviços, profissionais e histórico financeiro.
                                </p>
                                <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 16px' }}>⚠️ Esta ação é irreversível e não pode ser desfeita.</p>
                                <button onClick={() => setDeleteStep('confirm')}
                                  style={{ padding: '8px 20px', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                  Solicitar exclusão de dados
                                </button>
                              </div>
                            )}

                            {deleteStep === 'confirm' && (
                              <div>
                                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '0 0 8px' }}>Ao confirmar, serão excluídos permanentemente:</p>
                                <ul style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.9, margin: '0 0 20px', paddingLeft: 20 }}>
                                  <li>Todos os agendamentos e histórico</li>
                                  <li>Cadastro de clientes</li>
                                  <li>Serviços e profissionais</li>
                                  <li>Dados financeiros</li>
                                  <li>Assinatura e conta de acesso</li>
                                </ul>
                                <p style={{ fontSize: 13, color: '#374151', margin: '0 0 10px' }}>
                                  Digite <strong style={{ color: '#DC2626' }}>EXCLUIR</strong> para confirmar:
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
                                  style={{ marginTop: 12, background: 'none', border: 'none', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                                  Cancelar
                                </button>
                              </div>
                            )}

                            {deleteStep === 'deleting' && (
                              <p style={{ fontSize: 13, color: '#6B7280' }}>Excluindo todos os dados… aguarde.</p>
                            )}
                          </div>
                        </div>
                        );
                      })()}

                      {cfgTab === 'notificacoes' && (() => {
                        const permLabels: Record<string, { label: string; color: string; bg: string }> = {
                          granted: { label: 'Permitida',      color: '#16a34a', bg: '#E6F4EC' },
                          denied:  { label: 'Bloqueada',      color: '#dc2626', bg: '#FEECEC' },
                          default: { label: 'Não solicitada', color: '#92400e', bg: '#FEF9EC' },
                        };
                        const perm = permLabels[notifications.permission] ?? permLabels.default;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
                            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Bell style={{ width: 12, height: 12 }} /> Notificações do Navegador
                              </h4>

                              {!notifications.supported && (
                                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                                  Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
                                </p>
                              )}

                              {notifications.supported && (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                                      <Bell style={{ width: 15, height: 15, color: '#6B7280' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: 4 }}>Permissão do navegador</div>
                                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: perm.bg, color: perm.color }}>
                                        {perm.label}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px' }}>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>Novos agendamentos</div>
                                      <div style={{ fontSize: 11, color: '#6B7280' }}>Receba um alerta quando um cliente agendar online</div>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={notifications.permission !== 'granted'}
                                      onClick={() => notifications.setEnabled(!notifications.enabled)}
                                      style={{
                                        width: 44, height: 24, borderRadius: 12, border: 'none',
                                        cursor: notifications.permission === 'granted' ? 'pointer' : 'not-allowed',
                                        background: notifications.enabled && notifications.permission === 'granted' ? '#22c55e' : '#D1D5DB',
                                        position: 'relative', transition: 'background 200ms', flexShrink: 0,
                                        opacity: notifications.permission !== 'granted' ? 0.4 : 1,
                                      }}
                                    >
                                      <span style={{
                                        position: 'absolute', top: 3,
                                        left: notifications.enabled && notifications.permission === 'granted' ? 23 : 3,
                                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                        transition: 'left 200ms', display: 'block',
                                      }} />
                                    </button>
                                  </div>

                                  {notifications.permission === 'default' && (
                                    <button
                                      type="button"
                                      onClick={() => notifications.requestPermission()}
                                      style={{ padding: '11px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
                                      <Bell style={{ width: 14, height: 14 }} /> Habilitar notificações
                                    </button>
                                  )}

                                  {notifications.permission === 'denied' && (
                                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
                                      <p style={{ margin: 0, fontSize: 12, color: '#DC2626', lineHeight: 1.6 }}>
                                        As notificações estão bloqueadas no seu navegador. Para habilitar, clique no cadeado na barra de endereços e permita notificações para este site.
                                      </p>
                                    </div>
                                  )}

                                  {notifications.enabled && notifications.permission === 'granted' && (
                                    <button
                                      type="button"
                                      onClick={() => notifications.notify('Notificação de teste ✅', { body: 'As notificações estão funcionando corretamente!' })}
                                      style={{ padding: '9px 18px', background: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', alignSelf: 'flex-start' }}>
                                      Enviar notificação de teste
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Modal: confirmar exclusão de cliente ──────────────────────────────── */}
      {deleteCustomerPending && (
        <div
          onClick={() => { if (!deletingCustomer) setDeleteCustomerPending(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <X size={20} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 8px', fontFamily: 'Outfit, sans-serif' }}>
              Apagar cliente?
            </h3>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px', lineHeight: 1.6, fontFamily: 'Outfit, sans-serif' }}>
              <strong style={{ color: '#111827' }}>{deleteCustomerPending.name}</strong> será removido permanentemente.
            </p>
            <p style={{ fontSize: 12, color: '#DC2626', margin: '0 0 24px', lineHeight: 1.6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', fontFamily: 'Outfit, sans-serif' }}>
              ⚠️ Todos os agendamentos deste cliente também serão apagados.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteCustomerPending(null)}
                disabled={deletingCustomer}
                style={{ flex: 1, padding: '11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setDeletingCustomer(true);
                  await onDeleteCustomer(deleteCustomerPending.id);
                  setDeletingCustomer(false);
                  setDeleteCustomerPending(null);
                  toast.success('Cliente apagado.');
                }}
                disabled={deletingCustomer}
                style={{ flex: 1, padding: '11px', background: deletingCustomer ? 'rgba(239,68,68,0.4)' : '#ef4444', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: deletingCustomer ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s' }}
              >
                {deletingCustomer ? 'Apagando…' : 'Sim, apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tour ──────────────────────────────────────────────────────────────── */}
      {tourOpen && <TourOverlay key={tourKey} steps={TOUR_STEPS} onFinish={finishTour} />}

      {/* ── Modal: Política de Privacidade ────────────────────────────────────── */}
      {privacyModal && (
        <div onClick={() => setPrivacyModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'Outfit, sans-serif' }}>Política de Privacidade</h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280', fontFamily: 'Outfit, sans-serif' }}>WorkAgenda · Atualizada em junho de 2025</p>
              </div>
              <button onClick={() => setPrivacyModal(false)}
                style={{ width: 32, height: 32, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Outfit, sans-serif' }} className="no-scrollbar">
              {([
                {
                  title: '1. Quem somos',
                  text: 'A WorkAgenda é uma plataforma SaaS de gestão para barbearias e salões de beleza. Operamos como controladora dos dados pessoais coletados nesta plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).',
                },
                {
                  title: '2. Dados que coletamos',
                  text: 'Coletamos dados fornecidos diretamente por você (nome, e-mail, telefone, dados de estabelecimento) e dados gerados pelo uso da plataforma (agendamentos, histórico de atendimentos, movimentações financeiras). Não coletamos dados de pagamento sensíveis — as transações são processadas por parceiros certificados.',
                },
                {
                  title: '3. Como usamos seus dados',
                  text: 'Seus dados são usados exclusivamente para: (a) fornecer e melhorar os serviços da plataforma; (b) enviar notificações operacionais via WhatsApp, como confirmações e lembretes de agendamento; (c) gerar relatórios financeiros e de desempenho para o seu negócio; (d) cumprir obrigações legais.',
                },
                {
                  title: '4. Compartilhamento',
                  text: 'Não vendemos nem alugamos seus dados. Compartilhamos apenas com prestadores de serviço essenciais à operação da plataforma (infraestrutura de nuvem, gateway de WhatsApp), sempre sob acordos de confidencialidade e com as mesmas obrigações desta política.',
                },
                {
                  title: '5. Retenção de dados',
                  text: 'Mantemos seus dados enquanto sua conta estiver ativa. Após solicitação de exclusão, os dados são removidos em até 30 dias, exceto os que precisamos reter por obrigação legal (ex.: registros fiscais, conforme legislação vigente).',
                },
                {
                  title: '6. Seus direitos (LGPD)',
                  text: 'Você tem o direito de: acessar seus dados, corrigir informações incorretas, solicitar a exclusão (através da opção "Excluir Conta" em Configurações → Conta), revogar consentimento e obter informações sobre o tratamento realizado. Para exercer esses direitos, entre em contato pelo Suporte.',
                },
                {
                  title: '7. Segurança',
                  text: 'Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, incluindo criptografia em trânsito (TLS), autenticação segura e controles de acesso por função. Ainda assim, nenhum sistema é 100% inviolável — notificaremos você em caso de incidente que afete seus dados.',
                },
                {
                  title: '8. Cookies e rastreamento',
                  text: 'Utilizamos apenas cookies estritamente necessários à sessão de autenticação. Não utilizamos cookies de rastreamento ou publicidade de terceiros.',
                },
                {
                  title: '9. Alterações nesta política',
                  text: 'Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas por e-mail ou por aviso dentro da plataforma com antecedência mínima de 15 dias.',
                },
                {
                  title: '10. Contato',
                  text: 'Dúvidas ou solicitações relacionadas à privacidade podem ser enviadas pelo canal de Suporte da plataforma. Responderemos em até 5 dias úteis.',
                },
              ] as { title: string; text: string }[]).map(({ title, text }) => (
                <div key={title}>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
              <button onClick={() => setPrivacyModal(false)}
                style={{ width: '100%', padding: '11px', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Suporte ──────────────────────────────────────────────────── */}
      {supportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSupportModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, width: 440, maxWidth: '100%', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'Outfit, sans-serif' }}>Central de Suporte</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280', fontFamily: 'Outfit, sans-serif' }}>Envie uma mensagem para nossa equipe</p>
              </div>
              <button onClick={() => setSupportModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {supportSent ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={24} style={{ color: '#16a34a' }} />
                </div>
                <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>Mensagem enviada!</h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontFamily: 'Outfit, sans-serif' }}>Nossa equipe responderá em breve. Acompanhe pela aba Suporte.</p>
                <button onClick={() => setSupportModal(false)} style={{ marginTop: 24, padding: '10px 28px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  Fechar
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Assunto
                  </label>
                  <input value={supportTitle} onChange={e => setSupportTitle(e.target.value)}
                    placeholder="Ex: Problema com agendamentos…"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'Outfit, sans-serif' }}>
                    Mensagem
                  </label>
                  <textarea value={supportMsg} onChange={e => setSupportMsg(e.target.value)}
                    placeholder="Descreva o problema ou dúvida com o máximo de detalhes…"
                    rows={5}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#0f172a', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button
                  disabled={!supportTitle.trim() || !supportMsg.trim() || supportSending}
                  onClick={async () => {
                    if (!supportTitle.trim() || !supportMsg.trim()) return;
                    setSupportSending(true);
                    try {
                      await createSupportTicket(activeTenant.id, activeTenant.name, supportTitle.trim(), supportMsg.trim());
                      setSupportSent(true);
                    } catch (e) {
                      console.error('[Support] error:', e);
                    } finally {
                      setSupportSending(false);
                    }
                  }}
                  style={{ width: '100%', padding: '12px', background: (!supportTitle.trim() || !supportMsg.trim() || supportSending) ? '#F1F5F9' : '#1D4ED8', color: (!supportTitle.trim() || !supportMsg.trim() || supportSending) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (!supportTitle.trim() || !supportMsg.trim() || supportSending) ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'background 150ms' }}>
                  {supportSending ? 'Enviando…' : 'Enviar mensagem'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Novo / Editar Serviço ────────────────────────────────────── */}
      {showNewSrvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { setShowNewSrvModal(false); setEditingSrv(null); }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{editingSrv ? `Editando: ${editingSrv.name}` : 'Novo Serviço'}</p>
              <button onClick={() => { setShowNewSrvModal(false); setEditingSrv(null); }} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (editingSrv) {
                  await onUpdateService(editingSrv.id, { name: editingSrv.name, price: editingSrv.price, durationMinutes: editingSrv.durationMinutes, category: editingSrv.category });
                  toast.success('Serviço atualizado!');
                } else {
                  if (!srvName.trim()) return;
                  const created = await onAddService({ tenantId: activeTenant.id, name: srvName, price: srvPrice, durationMinutes: srvDuration, category: srvCategory });
                  if (created && srvProfIds.length) await onSetServiceProfessionals(created.id, srvProfIds);
                  toast.success(`"${srvName}" cadastrado!`);
                  setSrvName(''); setSrvProfIds([]);
                }
                setShowNewSrvModal(false); setEditingSrv(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                placeholder="Nome do serviço *"
                value={editingSrv ? editingSrv.name : srvName}
                onChange={e => editingSrv ? setEditingSrv(v => v && ({ ...v, name: e.target.value })) : setSrvName(e.target.value)}
                required className="navy-input" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="navy-label">Preço R$</label>
                  <input type="number" min={0}
                    value={editingSrv ? editingSrv.price : srvPrice}
                    onChange={e => editingSrv ? setEditingSrv(v => v && ({ ...v, price: Number(e.target.value) })) : setSrvPrice(Number(e.target.value))}
                    className="navy-input" />
                </div>
                <div>
                  <label className="navy-label">Duração min</label>
                  <input type="number" min={5}
                    value={editingSrv ? editingSrv.durationMinutes : srvDuration}
                    onChange={e => editingSrv ? setEditingSrv(v => v && ({ ...v, durationMinutes: Number(e.target.value) })) : setSrvDuration(Number(e.target.value))}
                    className="navy-input" />
                </div>
                <div>
                  <label className="navy-label">Categoria</label>
                  <select
                    value={editingSrv ? editingSrv.category : srvCategory}
                    onChange={e => editingSrv ? setEditingSrv(v => v && ({ ...v, category: e.target.value as Service['category'] })) : setSrvCategory(e.target.value as any)}
                    className="navy-select">
                    <option>Cabelo</option><option>Barba</option><option>Estética</option><option>Unhas</option><option>Combo</option>
                  </select>
                </div>
              </div>
              {!editingSrv && myProfessionals.length > 0 && (
                <div>
                  <label className="navy-label">Profissionais</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {myProfessionals.map(p => {
                      const sel = srvProfIds.includes(p.id);
                      return (
                        <button type="button" key={p.id}
                          onClick={() => setSrvProfIds(ids => sel ? ids.filter(id => id !== p.id) : [...ids, p.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px 5px 6px', borderRadius: 20, background: sel ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${sel ? '#BFDBFE' : '#E2E8F0'}`, color: sel ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          <img src={p.avatar} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />{p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => { setShowNewSrvModal(false); setEditingSrv(null); }}
                  style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                <button type="submit"
                  style={{ flex: 2, padding: 12, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {editingSrv ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Profissionais do Serviço ──────────────────────────────────── */}
      {srvProfPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSrvProfPanel(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Profissionais</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 2px' }}>{srvProfPanel.name}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Marque quem realiza este serviço</p>
              </div>
              <button onClick={() => setSrvProfPanel(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            {myProfessionals.length === 0 ? (
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>Nenhum colaborador cadastrado. Adicione na aba Equipe.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {myProfessionals.map(p => {
                  const checked = p.services.includes(srvProfPanel.id);
                  return (
                    <button key={p.id} type="button"
                      onClick={async () => {
                        const newIds = checked
                          ? myProfessionals.filter(x => x.services.includes(srvProfPanel.id) && x.id !== p.id).map(x => x.id)
                          : myProfessionals.filter(x => x.services.includes(srvProfPanel.id)).map(x => x.id).concat(p.id);
                        await onSetServiceProfessionals(srvProfPanel.id, newIds);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: checked ? '#EFF6FF' : '#FFFFFF', border: `1px solid ${checked ? '#BFDBFE' : '#E2E8F0'}`, cursor: 'pointer', transition: 'all 150ms', fontFamily: 'Outfit, sans-serif', textAlign: 'left' as const }}>
                      <img src={p.avatar} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? '#2563EB' : '#111827' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{p.role}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: checked ? '#2563EB' : '#9CA3AF', flexShrink: 0 }}>{checked ? '✓ Ativo' : '+ Add'}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setSrvProfPanel(null)}
              style={{ width: '100%', marginTop: 16, padding: 11, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Fechar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Novo / Editar Membro da Equipe ───────────────────────────── */}
      {showNewProfModal && (() => {
        const profCurHours = profHoursByDay[profSelectedDay] || [];
        const profDayOpen  = profDays.includes(profSelectedDay);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={cancelEditProf}>
            <div onClick={e => e.stopPropagation()}
              className="no-scrollbar"
              style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontFamily: 'Outfit, sans-serif' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{editingProf ? `Editando: ${editingProf.name}` : 'Novo Colaborador'}</p>
                <button onClick={cancelEditProf} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
              </div>
              <form onSubmit={handleSaveProf} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Foto + nome + cargo */}
                <input ref={avatarInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e => { if (e.target.files?.[0]) setProfAvatar(await fileToDataURL(e.target.files[0])); }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={() => avatarInputRef.current?.click()}>
                    {(profAvatar || editingProf?.avatar)
                      ? <img src={profAvatar || editingProf?.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User size={20} style={{ color: '#9CA3AF' }} />}
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input placeholder="Nome *" value={profName} onChange={e => setProfName(e.target.value)} required className="navy-input" />
                    <input placeholder="Cargo" value={profRole} onChange={e => setProfRole(e.target.value)} className="navy-input" />
                  </div>
                </div>
                <div>
                  <label className="navy-label">Comissão %</label>
                  <input type="number" min={0} max={100} value={profCommission} onChange={e => setProfCommission(Number(e.target.value))} className="navy-input" />
                </div>
                {/* Horários */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>Horários de Atendimento</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    {ALL_DAYS.map(d => {
                      const active = profSelectedDay === d;
                      const open   = profDays.includes(d);
                      return (
                        <button key={d} type="button" onClick={() => setProfSelectedDay(d)}
                          style={{ padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: active ? '#1D4ED8' : '#F8FAFC', color: active ? '#FFFFFF' : open ? '#374151' : '#9CA3AF', border: `1px solid ${active ? '#1D4ED8' : '#E2E8F0'}`, opacity: open ? 1 : 0.55 }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '7px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>{profSelectedDay} — {profDayOpen ? `${profCurHours.length} horários` : 'Folga'}</span>
                    <button type="button" onClick={() => setProfDays(prev => prev.includes(profSelectedDay) ? prev.filter(d => d !== profSelectedDay) : [...prev, profSelectedDay])}
                      style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: profDayOpen ? '#DCFCE7' : '#FEE2E2', color: profDayOpen ? '#166534' : '#DC2626', border: `1px solid ${profDayOpen ? '#86EFAC' : '#FCA5A5'}` }}>
                      {profDayOpen ? 'Trabalha' : 'Folga'}
                    </button>
                  </div>
                  {profCurHours.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                      {profCurHours.map(h => (
                        <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#374151' }}>
                          {h}
                          <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: (prev[profSelectedDay] || []).filter(x => x !== h) }))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <button type="button" onClick={() => { setProfNewHourInput(''); setProfPickerOpen(o => !o); }}
                      style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: '#1D4ED8', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      + Adicionar Horário
                    </button>
                    {profPickerOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 60, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 210 }}>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Novo horário — {profSelectedDay}</p>
                        <input type="time" value={profNewHourInput} onChange={e => setProfNewHourInput(e.target.value)} autoFocus className="navy-input" style={{ fontSize: 22, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => { if (profNewHourInput) setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: Array.from(new Set([...(prev[profSelectedDay] || []), profNewHourInput])).sort() })); setProfPickerOpen(false); setProfNewHourInput(''); }}
                            style={{ flex: 1, padding: '9px 0', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 800, fontSize: 13, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>OK</button>
                          <button type="button" onClick={() => { setProfPickerOpen(false); setProfNewHourInput(''); }}
                            style={{ padding: '9px 14px', background: '#F1F5F9', color: '#6B7280', fontWeight: 600, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => { const h = profHoursByDay[profSelectedDay] || []; setProfHoursByDay(Object.fromEntries(ALL_DAYS.map(d => [d, profDays.includes(d) ? [...h] : []]))); toast.info('Horários copiados para todos os dias de trabalho.'); }}
                      style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Copiar p/ todos</button>
                    <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: [...DEFAULT_HOURS] }))}
                      style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Resetar padrão</button>
                    <button type="button" onClick={() => setProfHoursByDay(prev => ({ ...prev, [profSelectedDay]: [] }))}
                      style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Limpar dia</button>
                  </div>
                </div>
                {/* Ações */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={cancelEditProf} style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                  <button type="submit" style={{ flex: 2, padding: 12, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                    {editingProf ? 'Salvar' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Novo / Editar Cliente ────────────────────────────────────── */}
      {showNewClientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={cancelEditCust}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{editingCust ? 'Editar Cliente' : 'Novo Cliente'}</p>
              <button onClick={cancelEditCust} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Nome completo" value={custName} onChange={e => setCustName(e.target.value)} required className="navy-input" />
              <input placeholder="(DDD) Telefone" value={custPhone} onChange={e => setCustPhone(e.target.value)} required className="navy-input" />
              <input placeholder="Email (opcional)" value={custEmail} onChange={e => setCustEmail(e.target.value)} className="navy-input" />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {editingCust && (
                  <button type="button" onClick={cancelEditCust} style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                )}
                <button type="submit" style={{ flex: 2, padding: 12, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {editingCust ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Lista de Espera ────────────────────────────────────────────── */}
      {showWaitlistModal && (
        <WaitlistModal
          tenantId={activeTenant.id}
          tenantName={activeTenant.name}
          tenantSlug={activeTenant.slug}
          professionals={myProfessionals}
          onClose={() => setShowWaitlistModal(false)}
        />
      )}

      {/* ── Modal: Novo Agendamento (do menu Agendamentos) ───────────────────── */}
      {showNewApptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowNewApptModal(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Novo Agendamento</p>
              <button onClick={() => setShowNewApptModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            <form onSubmit={async e => { await handleManualAppointment(e); setShowNewApptModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Cliente */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Cliente</span>
                  <button type="button" onClick={() => { setApptNewClient(v => !v); setApptCustId(''); setApptNewClientName(''); setApptNewClientPhone(''); }}
                    style={{ fontSize: 11, fontWeight: 700, color: apptNewClient ? '#2563EB' : '#6B7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0 }}>
                    {apptNewClient ? '← Cliente existente' : '+ Novo cliente'}
                  </button>
                </div>
                {!apptNewClient
                  ? <select value={apptCustId} onChange={e => setApptCustId(e.target.value)} className="navy-select" style={{ width: '100%' }}>
                      <option value="">Selecionar cliente…</option>
                      {myCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input placeholder="Nome *" value={apptNewClientName} onChange={e => setApptNewClientName(e.target.value)} className="navy-input" />
                      <input placeholder="Telefone (opcional)" value={apptNewClientPhone} onChange={e => setApptNewClientPhone(e.target.value)} className="navy-input" />
                    </div>
                }
              </div>
              <select value={apptSrvId} onChange={e => setApptSrvId(e.target.value)} required className="navy-select" style={{ width: '100%' }}>
                <option value="">Serviço…</option>
                {myServices.map(s => <option key={s.id} value={s.id}>{s.name} — R$ {s.price}</option>)}
              </select>
              <select value={apptProfId} onChange={e => setApptProfId(e.target.value)} required className="navy-select" style={{ width: '100%' }}>
                <option value="">Profissional…</option>
                {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} required className="navy-input" />
                <input type="time" value={apptTime} onChange={e => setApptTime(e.target.value)} required className="navy-input" />
              </div>
              <textarea placeholder="Notas (opcional)" value={apptNotes} onChange={e => setApptNotes(e.target.value)} className="navy-input" style={{ height: 60, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowNewApptModal(false)} style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, padding: 12, background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Gravar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Agendamento rápido por cliente ────────────────────────────── */}
      {quickApptCust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setQuickApptCust(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Novo Agendamento</p>
              <button onClick={() => setQuickApptCust(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#2563EB', fontSize: 13, flexShrink: 0 }}>
                {quickApptCust.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: 13 }}>{quickApptCust.name}</div>
                {quickApptCust.phone && <div style={{ fontSize: 11, color: '#6B7280' }}>{quickApptCust.phone}</div>}
              </div>
            </div>
            <form onSubmit={handleQuickAppt} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={quickApptSrvId} onChange={e => setQuickApptSrvId(e.target.value)} required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#111827', background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }}>
                <option value="">Serviço…</option>
                {myServices.map(s => <option key={s.id} value={s.id}>{s.name} — R$ {s.price}</option>)}
              </select>
              <select value={quickApptProfId} onChange={e => setQuickApptProfId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#111827', background: '#fff', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }}>
                <option value="">Qualquer profissional</option>
                {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="date" value={quickApptDate} onChange={e => setQuickApptDate(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
                <input type="time" value={quickApptTime} onChange={e => setQuickApptTime(e.target.value)} required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setQuickApptCust(null)} style={{ flex: 1, padding: 12, background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                <button type="submit" disabled={quickApptSaving}
                  style={{ flex: 2, padding: 12, background: quickApptSaving ? '#93C5FD' : '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: quickApptSaving ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {quickApptSaving ? 'Agendando…' : 'Agendar →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#F1F5F9', textTransform: 'uppercase' as const, letterSpacing: '1.5px', margin: '0 0 2px' }}>WorkAgenda · Assinatura</p>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {billingModal.step === 'payment' ? 'Concluir pagamento' : 'Assinar plano'}
                  </h3>
                </div>
                <button onClick={() => setBillingModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F1F5F9', padding: 4, display: 'flex', alignItems: 'center' }}>
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
                  <p style={{ fontSize: 10, color: '#F1F5F9', margin: 0 }}>Total {pm.months > 1 ? `(${pm.months} meses)` : ''}</p>
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
                      <p style={{ fontSize: 11, color: '#F1F5F9', margin: '6px 0 0' }}>Necessário para emissão da cobrança via Asaas.</p>
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
                            <p style={{ fontSize: 11, color: '#F1F5F9', margin: '0 0 6px' }}>Copia e cola:</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input readOnly value={billingModal.pixCode}
                                style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, color: '#475569', fontFamily: 'monospace', background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} />
                              <button onClick={() => { navigator.clipboard.writeText(billingModal.pixCode!); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                                style={{ padding: '8px 14px', background: pixCopied ? '#10b981' : '#1D4ED8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
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
                            <span style={{ fontSize: 12, color: '#F1F5F9', fontWeight: 600 }}>ou</span>
                            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                          </div>
                        )}
                        <a href={billingModal.payUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', textAlign: 'center' as const, padding: '13px 0', background: billingModal.pixImage ? '#f1f5f9' : pm.color, color: billingModal.pixImage ? '#374151' : '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', border: billingModal.pixImage ? '1.5px solid #e2e8f0' : 'none' }}>
                          {billingModal.pixImage ? 'Pagar via Boleto ou Cartão →' : 'Acessar link de pagamento →'}
                        </a>
                      </>
                    )}

                    <p style={{ fontSize: 11, color: '#F1F5F9', textAlign: 'center' as const, margin: '16px 0 0', lineHeight: 1.5 }}>
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
                      Obrigado por assinar o WorkAgenda! 🎉
                    </p>
                    <p style={{ fontSize: 13, color: '#F1F5F9', margin: '0 0 24px' }}>
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
