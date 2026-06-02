/**
 * ClientAdminPanel — Orquestrador (lean)
 * Estado e handlers ficam aqui; cada tab é um componente separado.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Tenant, Service, Professional, Product, Appointment, Payment, Customer } from '../types';
import { Calendar, Users, ShoppingBag, DollarSign, Plus, Scissors, MessageSquare,
         ExternalLink, Trash, Check, X, RefreshCw, Smartphone, LayoutDashboard,
         Settings, CreditCard, ChevronRight, Menu, BookOpen } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { uploadTenantLogo } from '../lib/db';
import LogoCropModal from './LogoCropModal';
import DashboardTab   from './tabs/DashboardTab';
import FinanceiroTab  from './tabs/FinanceiroTab';
import WhatsAppTab    from './tabs/WhatsAppTab';

interface ClientAdminPanelProps {
  activeTenant: Tenant;
  services: Service[];
  professionals: Professional[];
  products: Product[];
  customers: Customer[];
  appointments: Appointment[];
  payments: Payment[];
  onAddService: (s: Omit<Service, 'id'>) => void;
  onAddProfessional: (p: Omit<Professional, 'id'>) => void;
  onAddProduct: (p: Omit<Product, 'id'>) => void;
  onUpdateProductStock: (id: string, stock: number) => void;
  onAddAppointment: (a: Omit<Appointment, 'id'>) => void;
  onUpdateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  onAddPayment: (pay: Omit<Payment, 'id'>) => void;
  onAddCustomer: (c: Omit<Customer, 'id'>) => void;
  onUpdateTenantDetails: (tenantId: string, details: Partial<Tenant>) => void | Promise<void>;
  onSwitchToBookingFlow: (slug: string) => void;
}

export default function ClientAdminPanel({
  activeTenant, services, professionals, products, customers, appointments, payments,
  onAddService, onAddProfessional, onAddProduct, onUpdateProductStock,
  onAddAppointment, onUpdateAppointmentStatus, onAddPayment, onAddCustomer,
  onUpdateTenantDetails, onSwitchToBookingFlow
}: ClientAdminPanelProps) {
  const toast = useToast();
  type Tab = 'dashboard' | 'agenda' | 'clientes' | 'financeiro' | 'catalogo' | 'whatsapp' | 'configuracoes';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [catalogoTab, setCatalogoTab] = useState<'servicos' | 'equipe'>('servicos');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filtered by tenant
  const myServices      = services.filter(s => s.tenantId === activeTenant.id);
  const myProfessionals = professionals.filter(p => p.tenantId === activeTenant.id);
  const myProducts      = products.filter(p => p.tenantId === activeTenant.id);
  const myCustomers     = customers.filter(c => c.tenantId === activeTenant.id);
  const myAppointments  = appointments.filter(a => a.tenantId === activeTenant.id);
  const myPayments      = payments.filter(p => p.tenantId === activeTenant.id);

  // ── Agenda state ──────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const [scheduleFilterDate, setScheduleFilterDate] = useState(today);
  const [adminViewYear,  setAdminViewYear]  = useState(new Date().getFullYear());
  const [adminViewMonth, setAdminViewMonth] = useState(new Date().getMonth());
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);
  const [apptSrvId,  setApptSrvId]  = useState('');
  const [apptProfId, setApptProfId] = useState('');
  const [apptCustId, setApptCustId] = useState('');
  const [apptDate,   setApptDate]   = useState(today);
  const [apptTime,   setApptTime]   = useState('09:00');
  const [apptNotes,  setApptNotes]  = useState('');
  const [custName,   setCustName]   = useState('');
  const [custPhone,  setCustPhone]  = useState('');
  const [custEmail,  setCustEmail]  = useState('');
  const [custSearch, setCustSearch] = useState('');

  // ── Config state ──────────────────────────────────────────
  const [uploadingLogo,   setUploadingLogo]   = useState(false);
  const [cropSrc,         setCropSrc]         = useState<string | null>(null);
  const [tenantLogo,      setTenantLogo]      = useState(activeTenant.logo    || '💈');
  const [tenantName,      setTenantName]      = useState(activeTenant.name    || '');
  const [tenantPhone,     setTenantPhone]     = useState(activeTenant.phone   || '');
  const [tenantAddress,   setTenantAddress]   = useState(activeTenant.address || '');
  const [tenantInstagram, setTenantInstagram] = useState(activeTenant.instagram || '');
  const [editedDays,      setEditedDays]      = useState<string[]>(activeTenant.businessDays || ['seg','ter','qua','qui','sex','sab']);
  const [selectedHoursDay, setSelectedHoursDay] = useState('seg');
  const [editedHoursByDay, setEditedHoursByDay] = useState<Record<string,string[]>>(
    activeTenant.businessHoursByDay || Object.fromEntries(
      ['seg','ter','qua','qui','sex','sab','dom'].map(d => [d, activeTenant.businessHours || ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00']])
    )
  );
  const [newHourInput, setNewHourInput] = useState('');

  // ── Service / Prof form ───────────────────────────────────
  const [srvName,     setSrvName]     = useState('');
  const [srvPrice,    setSrvPrice]    = useState(50);
  const [srvDuration, setSrvDuration] = useState(30);
  const [srvCategory, setSrvCategory] = useState<Service['category']>('Cabelo');
  const [profName,       setProfName]       = useState('');
  const [profRole,       setProfRole]       = useState('Barbeiro');
  const [profCommission, setProfCommission] = useState(40);
  const [profAvatar,     setProfAvatar]     = useState('https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80');
  const [profDays,       setProfDays]       = useState<string[]>(['seg','ter','qua','qui','sex','sab']);
  const [profHoursDay,   setProfHoursDay]   = useState('seg');
  const [profHoursByDay, setProfHoursByDay] = useState<Record<string,string[]>>({
    seg:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    ter:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    qua:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    qui:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    sex:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    sab:['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'],
    dom:[]
  });
  const [profNewHour, setProfNewHour] = useState('');

  const logoInputRef   = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTenantLogo(activeTenant.logo || '💈');
    setTenantName(activeTenant.name || '');
    setTenantPhone(activeTenant.phone || '');
    setTenantAddress(activeTenant.address || '');
    setTenantInstagram(activeTenant.instagram || '');
    setEditedDays(activeTenant.businessDays || ['seg','ter','qua','qui','sex','sab']);
    setEditedHoursByDay(activeTenant.businessHoursByDay || {});
  }, [activeTenant.id]);

  // ── Handlers ──────────────────────────────────────────────
  const fileToDataURL = (f: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f);
  });

  const handleManualAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptSrvId || !apptProfId || !apptCustId) { toast.error('Selecione serviço, profissional e cliente.'); return; }
    const srv  = myServices.find(s => s.id === apptSrvId);
    const cust = myCustomers.find(c => c.id === apptCustId);
    if (!srv || !cust) return;
    const conflict = myAppointments.some(a => a.date === apptDate && a.time === apptTime && a.professionalId === apptProfId && a.status !== 'cancelled');
    if (conflict) { toast.error(`Conflito: profissional já ocupado em ${apptDate} às ${apptTime}.`); return; }
    onAddAppointment({ tenantId: activeTenant.id, serviceId: apptSrvId, professionalId: apptProfId, customerId: apptCustId, customerName: cust.name, customerPhone: cust.phone, date: apptDate, time: apptTime, durationMinutes: srv.durationMinutes, price: srv.price, status: 'confirmed', notes: apptNotes });
    setApptNotes('');
    toast.success('Agendamento criado com sucesso!');
  };

  const handleAddManualCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) { toast.error('Nome e telefone são obrigatórios.'); return; }
    onAddCustomer({ tenantId: activeTenant.id, name: custName, email: custEmail || `${custName.toLowerCase().replace(/\s/g,'')}@barber.com`, phone: custPhone });
    setCustName(''); setCustPhone(''); setCustEmail('');
    toast.success('Cliente cadastrado!');
  };

  const handleCompleteAppointment = (appt: Appointment) => {
    onUpdateAppointmentStatus(appt.id, 'attended');
    onAddPayment({ tenantId: activeTenant.id, appointmentId: appt.id, amount: appt.price, method: 'pix', status: 'paid', date: new Date().toISOString().replace('T',' ').substring(0,19), description: `Atendimento: ${appt.customerName} — ${myServices.find(s=>s.id===appt.serviceId)?.name}` });
    toast.success(`Atendimento de ${appt.customerName} concluído! R$ ${appt.price.toFixed(2)} registrado.`);
  };

  const MONTHS_PT  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const formatDate = (d: string) => { try { const [y,m,dd] = d.split('-'); return `${Number(dd)} de ${MONTHS_PT[Number(m)-1]} de ${y}`; } catch { return d; } };
  const getDaysInMonth    = (y:number,m:number) => new Date(y,m+1,0).getDate();
  const getFirstDayOffset = (y:number,m:number) => { const d = new Date(y,m,1).getDay(); return d===0?6:d-1; };
  const selectedDayAppts = myAppointments.filter(a => a.date === scheduleFilterDate && a.status !== 'cancelled').sort((a,b) => a.time.localeCompare(b.time));
  const filteredCustomers = myCustomers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch));

  // ── Sidebar nav items ─────────────────────────────────────
  const navGroups = [
    {
      label: 'Principal',
      items: [
        { id: 'dashboard'  as Tab, label: 'Painel',      icon: LayoutDashboard },
        { id: 'agenda'     as Tab, label: 'Agenda',      icon: Calendar },
        { id: 'clientes'   as Tab, label: 'Clientes',    icon: Users },
        { id: 'financeiro' as Tab, label: 'Financeiro',  icon: CreditCard },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { id: 'catalogo'   as Tab, label: 'Catálogo',    icon: Scissors },
        { id: 'whatsapp'   as Tab, label: 'WhatsApp',    icon: MessageSquare },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { id: 'configuracoes' as Tab, label: 'Configurações', icon: Settings },
      ],
    },
  ];

  const navBadge: Partial<Record<Tab, number>> = {
    agenda:   myAppointments.filter(a => a.date === today && a.status !== 'cancelled').length || 0,
    clientes: myCustomers.length,
    catalogo: myServices.length,
  };

  const pageTitles: Record<Tab, string> = {
    dashboard: 'Painel', agenda: 'Agenda', clientes: 'Clientes',
    financeiro: 'Financeiro', catalogo: 'Catálogo', whatsapp: 'WhatsApp',
    configuracoes: 'Configurações',
  };

  const sidebarStyle: React.CSSProperties = {
    width: 220,
    flexShrink: 0,
    background: '#021340',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'sticky' as const,
    top: 0,
    overflowY: 'auto',
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
    border: active ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'left' as const,
  });

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    setUploadingLogo(true);
    try {
      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
      const url = await uploadTenantLogo(activeTenant.id, file);
      setTenantLogo(url);
      toast.success('Logo carregado!');
    } catch {
      toast.error('Falha ao enviar logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#031D3C', minHeight: '100vh', fontFamily: 'Outfit, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {cropSrc && (
        <LogoCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── Topbar ── */}
      <div style={{ background: '#021340', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 20px', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 50 }}>
        {/* Left: hamburger (mobile) + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ display: 'none', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, cursor: 'pointer' }}
            className="mobile-menu-btn"
          >
            <Menu style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.65)' }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{activeTenant.name}</span>
            <ChevronRight style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.18)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{pageTitles[activeTab]}</span>
          </div>
        </div>
        {/* Right: link público + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: '1px',
            background: activeTenant.status === 'active' ? '#E6F4EC' : activeTenant.status === 'trial' ? '#FEF9EC' : '#FEECEC',
            color: activeTenant.status === 'active' ? '#0A4A2C' : activeTenant.status === 'trial' ? '#7A4B0A' : '#7A0A0A',
          }}>
            {activeTenant.status === 'active' ? 'Ativo' : activeTenant.status === 'trial' ? 'Teste' : 'Inadimplente'}
          </span>
          <button
            onClick={() => onSwitchToBookingFlow(activeTenant.slug)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
          >
            Link público <ExternalLink style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── Sidebar ── */}
        <aside style={sidebarStyle}>
          {/* Nav groups */}
          <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }} className="no-scrollbar">
            {navGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '2px', padding: '0 8px', marginBottom: 6 }}>{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const badge = navBadge[item.id];
                    return (
                      <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} style={navItemStyle(isActive)}>
                        <Icon style={{ width: 15, height: 15, flexShrink: 0 }} strokeWidth={isActive ? 2.5 : 2} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {badge !== undefined && badge > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)', padding: '1px 7px', borderRadius: 20, fontFamily: 'monospace' }}>{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* CTA: Novo Agendamento */}
          <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <button
              onClick={() => { setActiveTab('agenda'); setSidebarOpen(false); }}
              style={{ width: '100%', padding: '11px 14px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'Outfit, sans-serif', letterSpacing: '0.5px' }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Novo Agendamento
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, padding: '28px 24px', overflowX: 'hidden', minWidth: 0 }}>

          {/* ── Dashboard ── */}
          {activeTab === 'dashboard' && (
            <DashboardTab myServices={myServices} myProfessionals={myProfessionals} myAppointments={myAppointments} myCustomers={myCustomers} myPayments={myPayments} />
          )}

          {/* ── Agenda ── */}
          {activeTab === 'agenda' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.3px' }}>Agenda</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{myAppointments.filter(a=>a.date===today&&a.status!=='cancelled').length} agendamentos hoje</p>
                </div>
                <button
                  onClick={() => { setScheduleFilterDate(today); setAdminViewYear(new Date().getFullYear()); setAdminViewMonth(new Date().getMonth()); }}
                  style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 12, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Outfit, sans-serif' }}
                >
                  <Calendar style={{ width: 13, height: 13 }} /> Hoje
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{MONTHS_PT[adminViewMonth]} {adminViewYear}</h4>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { if(adminViewMonth===0){setAdminViewYear(y=>y-1);setAdminViewMonth(11);}else setAdminViewMonth(m=>m-1); }} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                      <button onClick={() => { if(adminViewMonth===11){setAdminViewYear(y=>y+1);setAdminViewMonth(0);}else setAdminViewMonth(m=>m+1); }} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1" style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({length: getFirstDayOffset(adminViewYear,adminViewMonth)}, (_,i) => <div key={`b${i}`}/>)}
                    {Array.from({length: getDaysInMonth(adminViewYear,adminViewMonth)}, (_,i) => {
                      const d = i+1;
                      const dateStr = `${adminViewYear}-${String(adminViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                      const hasAppts = myAppointments.some(a => a.date === dateStr && a.status !== 'cancelled');
                      const isSelected = scheduleFilterDate === dateStr;
                      return (
                        <button key={d} onClick={() => setScheduleFilterDate(dateStr)}
                          style={{ aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, position: 'relative' as const, background: isSelected ? '#ffffff' : 'transparent', color: isSelected ? '#031D3C' : 'rgba(255,255,255,0.65)', border: 'none', cursor: 'pointer', transition: 'all 0.15s', padding: '6px 4px' }}
                        >
                          {d}
                          {hasAppts && <span style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#031D3C' : '#4ade80' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day detail */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: 0 }}>{formatDate(scheduleFilterDate)}</h4>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', padding: '3px 10px', borderRadius: 20 }}>{selectedDayAppts.length} serviços</span>
                  </div>
                  <div className="space-y-3 no-scrollbar" style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
                    {selectedDayAppts.length > 0 ? selectedDayAppts.map(appt => {
                      const srv  = myServices.find(s => s.id === appt.serviceId);
                      const prof = myProfessionals.find(p => p.id === appt.professionalId);
                      const isExpanded = expandedApptId === appt.id;
                      return (
                        <div key={appt.id} style={{ padding: 16, borderRadius: 12, border: `1px solid ${appt.status==='attended' ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.12)'}`, background: appt.status==='attended' ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)', transition: 'all 0.15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)', fontFamily: 'monospace' }}>{appt.time}</span>
                              <div>
                                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14 }}>{appt.customerName}</span>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>✂️ {srv?.name} · <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{prof?.name}</span></p>
                              </div>
                            </div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4ade80', fontSize: 14 }}>R$ {appt.price.toFixed(2)}</span>
                          </div>
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            {appt.status !== 'attended' && (
                              <button onClick={() => handleCompleteAppointment(appt)} style={{ padding: '6px 12px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}>✅ Concluir & Pag</button>
                            )}
                            <button onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                              style={{ padding: '6px 12px', background: isExpanded ? '#ffffff' : 'rgba(255,255,255,0.07)', color: isExpanded ? '#031D3C' : 'rgba(255,255,255,0.65)', fontWeight: 700, borderRadius: 8, border: `1px solid ${isExpanded ? '#ffffff' : 'rgba(255,255,255,0.09)'}`, cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}>💬 Zap</button>
                            <button onClick={() => { if(window.confirm(`Cancelar agendamento de ${appt.customerName}?`)) { onUpdateAppointmentStatus(appt.id,'cancelled'); toast.info('Agendamento cancelado.'); }}}
                              style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontWeight: 700, borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontSize: 11, fontFamily: 'Outfit, sans-serif' }}>Cancelar</button>
                          </div>
                          {isExpanded && (
                            <div className="animate-fade-in" style={{ marginTop: 10, padding: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10 }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: 8 }}>WhatsApp — Enviar via Evo Go</p>
                              <div className="grid grid-cols-2 gap-2">
                                {([['confirmation','✓ Confirmação'],['reminder','⏰ Lembrete']] as const).map(([type,label]) => (
                                  <button key={type} onClick={() => { setActiveTab('whatsapp'); }}
                                    style={{ padding: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Outfit, sans-serif' }}>
                                    {label}<span style={{ display: 'block', color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 2 }}>Ir para WhatsApp →</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 16 }}>
                        <span style={{ fontSize: 36, display: 'block', marginBottom: 12, opacity: 0.5 }}>☕</span>
                        <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>Agenda livre neste dia</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>Use o formulário abaixo para agendar.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reserva manual */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-4">
                <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Reserva Manual</h4>
                <form onSubmit={handleManualAppointment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="navy-label">Cliente</label>
                      <select value={apptCustId} onChange={e=>setApptCustId(e.target.value)} required className="navy-select">
                        <option value="">-- Selecionar --</option>
                        {myCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="navy-label">Serviço</label>
                      <select value={apptSrvId} onChange={e=>setApptSrvId(e.target.value)} required className="navy-select">
                        <option value="">-- Selecionar --</option>
                        {myServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="navy-label">Profissional</label>
                      <select value={apptProfId} onChange={e=>setApptProfId(e.target.value)} required className="navy-select">
                        <option value="">-- Selecionar --</option>
                        {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="navy-label">Data</label><input type="date" value={apptDate} onChange={e=>setApptDate(e.target.value)} required className="navy-input" /></div>
                    <div><label className="navy-label">Horário</label><input type="time" value={apptTime} onChange={e=>setApptTime(e.target.value)} required className="navy-input" /></div>
                  </div>
                  <textarea placeholder="Notas internas (opcional)" value={apptNotes} onChange={e=>setApptNotes(e.target.value)} className="navy-input" style={{ height: 72, resize: 'none' as const }} />
                  <button type="submit" style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Gravar Agendamento</button>
                </form>
              </div>
            </div>
          )}

          {/* ── Clientes ── */}
          {activeTab === 'clientes' && (
            <div className="space-y-6 animate-fade-in">
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.3px' }}>Clientes</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{myCustomers.length} clientes cadastrados</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Adicionar cliente */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-4">
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Novo Cliente</h4>
                  <form onSubmit={handleAddManualCustomer} className="space-y-3">
                    <input type="text" placeholder="Nome completo" value={custName} onChange={e=>setCustName(e.target.value)} required className="navy-input" />
                    <input type="tel" placeholder="(DDD) Telefone" value={custPhone} onChange={e=>setCustPhone(e.target.value)} required className="navy-input" />
                    <input type="email" placeholder="Email (opcional)" value={custEmail} onChange={e=>setCustEmail(e.target.value)} className="navy-input" />
                    <button type="submit" style={{ width: '100%', padding: '12px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Adicionar Cliente</button>
                  </form>
                </div>

                {/* Lista de clientes */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, gridColumn: 'span 2' }} className="space-y-4">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      placeholder="Buscar por nome ou telefone…"
                      value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      className="navy-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="space-y-2 no-scrollbar" style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed rgba(255,255,255,0.09)', borderRadius: 12 }}>
                        <Users style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.18)', margin: '0 auto 12px' }} />
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13 }}>{custSearch ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
                      </div>
                    ) : filteredCustomers.map(c => {
                      const lastAppt = myAppointments.filter(a => a.customerId === c.id && a.status === 'attended').sort((a,b)=>b.date.localeCompare(a.date))[0];
                      const totalSpent = myPayments.filter(p => myAppointments.find(a=>a.id===p.appointmentId&&a.customerId===c.id)).reduce((s,p)=>s+p.amount,0);
                      return (
                        <div key={c.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.65)', flexShrink: 0 }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{c.phone}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', fontFamily: 'monospace' }}>R$ {totalSpent.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{lastAppt ? `Último: ${lastAppt.date}` : 'Sem visitas'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Financeiro ── */}
          {activeTab === 'financeiro' && (
            <FinanceiroTab activeTenant={activeTenant} myPayments={myPayments} myProfessionals={myProfessionals} myAppointments={myAppointments} myServices={myServices} onAddPayment={onAddPayment} />
          )}

          {/* ── Catálogo ── */}
          {activeTab === 'catalogo' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.3px' }}>Catálogo</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>{myServices.length} serviços · {myProfessionals.length} profissionais</p>
              </div>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0 }}>
                {([['servicos','Serviços'], ['equipe','Equipe']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setCatalogoTab(id)}
                    style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', borderBottom: catalogoTab===id ? '2px solid #ffffff' : '2px solid transparent', color: catalogoTab===id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: -1 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Serviços */}
              {catalogoTab === 'servicos' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <form onSubmit={e=>{e.preventDefault();if(!srvName.trim())return;onAddService({tenantId:activeTenant.id,name:srvName.trim(),price:srvPrice,durationMinutes:srvDuration,category:srvCategory});toast.success(`Serviço "${srvName}" cadastrado!`);setSrvName('');}} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-4">
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Novo Serviço</h4>
                    <input type="text" required placeholder="Nome do serviço" value={srvName} onChange={e=>setSrvName(e.target.value)} className="navy-input" />
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="navy-label">Preço R$</label><input type="number" value={srvPrice} onChange={e=>setSrvPrice(Number(e.target.value))} className="navy-input" /></div>
                      <div><label className="navy-label">Duração min</label><input type="number" value={srvDuration} onChange={e=>setSrvDuration(Number(e.target.value))} className="navy-input" /></div>
                      <div><label className="navy-label">Categoria</label><select value={srvCategory} onChange={e=>setSrvCategory(e.target.value as any)} className="navy-select"><option>Cabelo</option><option>Barba</option><option>Estética</option><option>Unhas</option><option>Combo</option></select></div>
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Cadastrar Serviço</button>
                  </form>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, maxHeight: 420, overflowY: 'auto' }} className="space-y-3 no-scrollbar">
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 16px' }}>Serviços Cadastrados</h4>
                    {myServices.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px' }}><p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Nenhum serviço cadastrado</p></div>
                    ) : myServices.map(s => (
                      <div key={s.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{s.category} · {s.durationMinutes}min</div>
                        </div>
                        <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)', fontSize: 15, fontFamily: 'monospace' }}>R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipe */}
              {catalogoTab === 'equipe' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <form onSubmit={e=>{e.preventDefault();if(!profName.trim())return;onAddProfessional({tenantId:activeTenant.id,name:profName.trim(),role:profRole,avatar:profAvatar,rating:5,services:myServices.map(s=>s.id),commissionPercentage:profCommission,businessDays:profDays,businessHoursByDay:profHoursByDay});toast.success(`${profName} adicionado à equipe!`);setProfName('');}} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-4">
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Novo Colaborador</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={profAvatar} alt="avatar" style={{ width: 52, height: 52, borderRadius: 14, border: '1px solid rgba(255,255,255,0.09)', objectFit: 'cover' }} />
                      <input ref={avatarInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e=>{ if(e.target.files?.[0]) setProfAvatar(await fileToDataURL(e.target.files[0])); }} />
                      <button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textDecoration: 'underline' }}>Trocar foto</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" required placeholder="Nome" value={profName} onChange={e=>setProfName(e.target.value)} className="navy-input" />
                      <input type="text" placeholder="Cargo" value={profRole} onChange={e=>setProfRole(e.target.value)} className="navy-input" />
                    </div>
                    <div><label className="navy-label">Comissão %</label><input type="number" min={0} max={100} value={profCommission} onChange={e=>setProfCommission(Number(e.target.value))} className="navy-input" /></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {['seg','ter','qua','qui','sex','sab','dom'].map(d=>(
                        <button key={d} type="button" onClick={()=>{ setProfDays(prev=>prev.includes(d)?prev.filter(x=>x!==d):[...prev,d]); }}
                          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: profDays.includes(d) ? '#ffffff' : 'rgba(255,255,255,0.07)', color: profDays.includes(d) ? '#031D3C' : 'rgba(255,255,255,0.38)', border: `1px solid ${profDays.includes(d) ? '#ffffff' : 'rgba(255,255,255,0.09)'}` }}>{d}</button>
                      ))}
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Adicionar à Equipe</button>
                  </form>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24, maxHeight: 420, overflowY: 'auto' }} className="space-y-3 no-scrollbar">
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: '0 0 16px' }}>Equipe</h4>
                    {myProfessionals.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px' }}><p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Nenhum profissional cadastrado</p></div>
                    ) : myProfessionals.map(p => (
                      <div key={p.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={p.avatar} alt={p.name} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)', objectFit: 'cover', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>{p.role} · {p.commissionPercentage}% comissão</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 3 }}>
                            {(p.businessDays||[]).map(d=><span key={d} style={{ fontSize: 9, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>{d}</span>)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── WhatsApp ── */}
          {activeTab === 'whatsapp' && (
            <WhatsAppTab activeTenant={activeTenant} myAppointments={myAppointments} myServices={myServices} myProfessionals={myProfessionals} />
          )}

          {/* ── Configurações ── */}
          {activeTab === 'configuracoes' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, letterSpacing: '-0.3px' }}>Configurações</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>Identidade do salão e horários de funcionamento</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Branding */}
                <form onSubmit={async e => { e.preventDefault(); try { await onUpdateTenantDetails(activeTenant.id, { name: tenantName, logo: tenantLogo, phone: tenantPhone, address: tenantAddress, instagram: tenantInstagram, businessDays: editedDays, businessHoursByDay: editedHoursByDay, businessHours: editedHoursByDay['seg'] || [] }); toast.success('Configurações salvas!'); } catch { toast.error('Erro ao salvar. Tente novamente.'); } }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-5">
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Identidade Visual</h4>
                  <input ref={logoInputRef as any} type="file" className="hidden" accept="image/*" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => setCropSrc(reader.result as string);
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} />
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: uploadingLogo ? 'wait' : 'pointer', flexShrink: 0, opacity: uploadingLogo ? 0.6 : 1 }}>
                      {uploadingLogo ? <RefreshCw style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.55)', animation: 'spin 1s linear infinite' }} /> : (tenantLogo.startsWith('http') || tenantLogo.startsWith('data:')) ? <img src={tenantLogo} alt="logo" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 10 }} /> : tenantLogo}
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                      {['💈','💅','✂️','💄','🧖','💇','🧔','🌟','👑','🔥'].map(em => (
                        <button key={em} type="button" onClick={() => setTenantLogo(em)} style={{ width: 34, height: 34, fontSize: 16, borderRadius: 8, border: `1px solid ${tenantLogo===em ? '#ffffff' : 'rgba(255,255,255,0.09)'}`, background: tenantLogo===em ? '#ffffff' : 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>{em}</button>
                      ))}
                    </div>
                  </div>
                  <input value={tenantName} onChange={e=>setTenantName(e.target.value)} placeholder="Nome do salão" className="navy-input" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={tenantPhone} onChange={e=>setTenantPhone(e.target.value)} placeholder="Telefone" className="navy-input" />
                    <input value={tenantInstagram} onChange={e=>setTenantInstagram(e.target.value)} placeholder="@instagram" className="navy-input" />
                  </div>
                  <input value={tenantAddress} onChange={e=>setTenantAddress(e.target.value)} placeholder="Endereço" className="navy-input" />
                  <button type="submit" style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Salvar Alterações</button>
                </form>

                {/* Horários */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }} className="space-y-5">
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Horários por Dia</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {['seg','ter','qua','qui','sex','sab','dom'].map(d => (
                      <button key={d} type="button" onClick={() => setSelectedHoursDay(d)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: selectedHoursDay===d ? '#ffffff' : 'rgba(255,255,255,0.07)', color: selectedHoursDay===d ? '#031D3C' : 'rgba(255,255,255,0.55)', border: `1px solid ${selectedHoursDay===d ? '#ffffff' : 'rgba(255,255,255,0.09)'}` }}>{d}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Dia Ativo:</span>
                    <button type="button" onClick={() => { if(editedDays.includes(selectedHoursDay)) setEditedDays(prev=>prev.filter(d=>d!==selectedHoursDay)); else setEditedDays(prev=>[...prev,selectedHoursDay]); }}
                      style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: editedDays.includes(selectedHoursDay) ? '#E6F4EC' : 'rgba(239,68,68,0.1)', color: editedDays.includes(selectedHoursDay) ? '#0A4A2C' : '#fca5a5', border: `1px solid ${editedDays.includes(selectedHoursDay) ? '#A7D7BC' : 'rgba(239,68,68,0.3)'}` }}>
                      {editedDays.includes(selectedHoursDay) ? 'Aberto' : 'Fechado'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {(editedHoursByDay[selectedHoursDay]||[]).map(h => (
                      <span key={h} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.65)' }}>
                        {h}
                        <button type="button" onClick={() => setEditedHoursByDay(prev=>({...prev,[selectedHoursDay]:prev[selectedHoursDay].filter(x=>x!==h)}))} style={{ color: '#fca5a5', marginLeft: 4, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="time" value={newHourInput} onChange={e=>setNewHourInput(e.target.value)} className="navy-input" style={{ flex: 1 }} />
                    <button type="button" onClick={() => { if(newHourInput){ setEditedHoursByDay(prev=>({...prev,[selectedHoursDay]:Array.from(new Set([...(prev[selectedHoursDay]||[]),newHourInput])).sort()})); setNewHourInput(''); }}} style={{ padding: '0 18px', background: '#ffffff', color: '#031D3C', fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Outfit, sans-serif' }}>+ Add</button>
                  </div>
                  <button type="button" onClick={() => { const h = editedHoursByDay[selectedHoursDay]||[]; const all = Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d=>[d,[...h]])); setEditedHoursByDay(all); toast.info('Horários copiados para todos os dias.'); }}
                    style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', padding: 0, textDecoration: 'underline' }}>Copiar para todos os dias</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
