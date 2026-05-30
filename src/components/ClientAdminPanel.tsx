/**
 * ClientAdminPanel — Orquestrador (lean)
 * Estado e handlers ficam aqui; cada tab é um componente separado.
 * Tamanho reduzido de 1.851 → ~300 linhas.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Tenant, Service, Professional, Product, Appointment, Payment, Customer } from '../types';
import { Calendar, Users, ShoppingBag, DollarSign, Plus, Scissors, MessageSquare,
         ExternalLink, Trash, Check, X, RefreshCw, Smartphone, LayoutDashboard,
         Settings, CreditCard } from 'lucide-react';
import { useToast } from '../hooks/useToast';
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
  onUpdateTenantDetails: (tenantId: string, details: Partial<Tenant>) => void;
  onSwitchToBookingFlow: (slug: string) => void;
}

export default function ClientAdminPanel({
  activeTenant, services, professionals, products, customers, appointments, payments,
  onAddService, onAddProfessional, onAddProduct, onUpdateProductStock,
  onAddAppointment, onUpdateAppointmentStatus, onAddPayment, onAddCustomer,
  onUpdateTenantDetails, onSwitchToBookingFlow
}: ClientAdminPanelProps) {
  const toast = useToast();
  type Tab = 'dashboard' | 'agenda' | 'financeiro' | 'whatsapp' | 'configuracoes';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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

  // ── Config state ──────────────────────────────────────────
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

  const getDaysInMonth     = (y:number,m:number) => new Date(y,m+1,0).getDate();
  const getFirstDayOffset  = (y:number,m:number) => { const d = new Date(y,m,1).getDay(); return d===0?6:d-1; };

  const selectedDayAppts = myAppointments.filter(a => a.date === scheduleFilterDate && a.status !== 'cancelled').sort((a,b) => a.time.localeCompare(b.time));

  // ── Render ────────────────────────────────────────────────
  return (
    <div id="client-admin-root" className="bg-slate-50 min-h-screen p-4 md:p-10">

      {/* Header */}
      <div className="bg-white px-8 py-8 border border-slate-100 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm mb-8">
        <div className="flex items-center gap-5">
          <span className="text-5xl bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-center shadow-inner">
            {tenantLogo.startsWith('data:') ? <img src={tenantLogo} alt="Logo" className="w-12 h-12 object-cover rounded-2xl" /> : tenantLogo}
          </span>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{activeTenant.name}</h1>
              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${
                activeTenant.status==='active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : activeTenant.status==='trial' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-200'}`}>
                {activeTenant.status==='active'?'Ativo':activeTenant.status==='trial'?'Período Teste':'Inadimplente'}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{activeTenant.address}</p>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex flex-col items-end shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Link Público</span>
          <button onClick={() => onSwitchToBookingFlow(activeTenant.slug)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-2">
            saasbarber.io/book/{activeTenant.slug} <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs nav */}
      <div className="bg-white/80 backdrop-blur-md px-2 py-2 border border-slate-200/60 rounded-full flex flex-wrap gap-2 mb-10 w-fit shadow-sm ring-1 ring-slate-900/5">
        {([
          { id:'dashboard',     label:'Painel',         icon:LayoutDashboard },
          { id:'agenda',        label:'Agenda',         icon:Calendar },
          { id:'financeiro',    label:'Financeiro',     icon:CreditCard },
          { id:'whatsapp',      label:'WhatsApp',       icon:MessageSquare },
          { id:'configuracoes', label:'Configurações',  icon:Settings },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 scale-95 hover:scale-100'}`}>
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-300' : 'text-slate-400'}`} strokeWidth={isActive?2.5:2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div>
        {activeTab === 'dashboard' && (
          <DashboardTab myServices={myServices} myProfessionals={myProfessionals} myAppointments={myAppointments} myCustomers={myCustomers} myPayments={myPayments} />
        )}

        {activeTab === 'agenda' && (
          <div className="space-y-8 animate-fade-in">
            {/* Calendar header */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Gestão de Agenda</span>
                <h3 className="text-2xl font-bold text-slate-900">Agenda Operacional</h3>
              </div>
              <button onClick={() => { setScheduleFilterDate(today); setAdminViewYear(new Date().getFullYear()); setAdminViewMonth(new Date().getMonth()); }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-semibold transition flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Hoje
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Calendar */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-semibold text-slate-900">{MONTHS_PT[adminViewMonth]} {adminViewYear}</h4>
                  <div className="flex gap-2">
                    <button onClick={() => { if(adminViewMonth===0){setAdminViewYear(y=>y-1);setAdminViewMonth(11);}else setAdminViewMonth(m=>m-1); }} className="size-10 rounded-full hover:bg-slate-100 flex items-center justify-center">‹</button>
                    <button onClick={() => { if(adminViewMonth===11){setAdminViewYear(y=>y+1);setAdminViewMonth(0);}else setAdminViewMonth(m=>m+1); }} className="size-10 rounded-full hover:bg-slate-100 flex items-center justify-center">›</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 mb-3">
                  {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({length: getFirstDayOffset(adminViewYear,adminViewMonth)}, (_,i) => <div key={`b${i}`}/>)}
                  {Array.from({length: getDaysInMonth(adminViewYear,adminViewMonth)}, (_,i) => {
                    const d = i+1;
                    const dateStr = `${adminViewYear}-${String(adminViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    const hasAppts = myAppointments.some(a => a.date === dateStr && a.status !== 'cancelled');
                    return (
                      <button key={d} onClick={() => setScheduleFilterDate(dateStr)}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-sm font-medium transition relative ${scheduleFilterDate===dateStr?'bg-slate-900 text-white':'hover:bg-slate-100'}`}>
                        {d}
                        {hasAppts && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${scheduleFilterDate===dateStr?'bg-white':'bg-blue-500'}`}/>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day detail */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-slate-900">{formatDate(scheduleFilterDate)}</h4>
                  <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full font-bold">{selectedDayAppts.length} serviços</span>
                </div>
                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                  {selectedDayAppts.length > 0 ? selectedDayAppts.map(appt => {
                    const srv  = myServices.find(s => s.id === appt.serviceId);
                    const prof = myProfessionals.find(p => p.id === appt.professionalId);
                    const isExpanded = expandedApptId === appt.id;
                    return (
                      <div key={appt.id} className={`p-5 rounded-2xl border transition-all shadow-sm ${appt.status==='attended'?'bg-emerald-50 border-emerald-100':'bg-blue-50 border-blue-100 border-b-2 border-b-blue-200'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <span className="px-3 py-1.5 bg-slate-900 rounded-xl text-sm font-extrabold text-white font-mono">{appt.time}</span>
                            <div>
                              <span className="font-extrabold text-slate-900 text-[15px]">{appt.customerName}</span>
                              <p className="text-xs text-slate-500 mt-1">✂️ {srv?.name} · <span className="text-blue-600 font-bold">{prof?.name}</span></p>
                            </div>
                          </div>
                          <span className="font-mono font-extrabold text-emerald-600 text-[15px]">R$ {appt.price.toFixed(2)}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-wrap items-center justify-end gap-2">
                          {appt.status !== 'attended' && (
                            <button onClick={() => handleCompleteAppointment(appt)} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border-r border-slate-100 transition text-xs flex items-center gap-1.5">
                              ✅ Concluir & Pag
                            </button>
                          )}
                          <button onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${isExpanded?'bg-blue-600 text-white':'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'}`}>
                            💬 Zap
                          </button>
                          <button onClick={() => { if(window.confirm(`Cancelar agendamento de ${appt.customerName}?`)) { onUpdateAppointmentStatus(appt.id,'cancelled'); toast.info('Agendamento cancelado. Vaga liberada.'); }}}
                            className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 rounded-xl border border-slate-200 text-xs font-bold transition">
                            Cancelar
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-lg animate-fade-in space-y-2.5">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">WhatsApp — Enviar via Evo Go</p>
                            <div className="grid grid-cols-2 gap-2">
                              {([['confirmation','✓ Confirmação'],['reminder','⏰ Lembrete']] as const).map(([type,label]) => (
                                <button key={type} onClick={() => { setActiveTab('whatsapp'); }}
                                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition text-left">
                                  {label}<span className="block text-slate-400 text-[10px] mt-0.5">Ir para WhatsApp →</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="text-center py-16 border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl space-y-3">
                      <span className="text-4xl grayscale opacity-60">☕</span>
                      <p className="font-extrabold text-slate-700">Agenda livre neste dia</p>
                      <p className="text-sm text-slate-500">Use o formulário abaixo para agendar.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick forms */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Agendamento manual */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Reserva Manual</h4>
                <form onSubmit={handleManualAppointment} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cliente</label>
                      <select value={apptCustId} onChange={e=>setApptCustId(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500">
                        <option value="">-- Cliente --</option>
                        {myCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Serviço</label>
                        <select value={apptSrvId} onChange={e=>setApptSrvId(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500">
                          <option value="">--</option>
                          {myServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Profissional</label>
                        <select value={apptProfId} onChange={e=>setApptProfId(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500">
                          <option value="">--</option>
                          {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Data</label>
                      <input type="date" value={apptDate} onChange={e=>setApptDate(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Horário</label>
                      <input type="time" value={apptTime} onChange={e=>setApptTime(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <textarea placeholder="Notas internas (opcional)" value={apptNotes} onChange={e=>setApptNotes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 h-20 resize-none text-sm" />
                  <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-md transition text-sm">Gravar Agendamento</button>
                </form>
              </div>

              {/* Cadastro rápido cliente */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Cadastrar Cliente</h4>
                <form onSubmit={handleAddManualCustomer} className="space-y-4">
                  <input type="text" placeholder="Nome completo" value={custName} onChange={e=>setCustName(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="tel" placeholder="(DDD) Telefone" value={custPhone} onChange={e=>setCustPhone(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                    <input type="email" placeholder="Email (opcional)" value={custEmail} onChange={e=>setCustEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                  </div>
                  <button type="submit" className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full border border-slate-300 transition">Adicionar Cliente</button>
                </form>
                <p className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-[11px] text-slate-500 italic">💡 Clientes cadastrados ficam disponíveis no seletor de reserva manual.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <FinanceiroTab activeTenant={activeTenant} myPayments={myPayments} myProfessionals={myProfessionals} myAppointments={myAppointments} myServices={myServices} onAddPayment={onAddPayment} />
        )}

        {activeTab === 'whatsapp' && (
          <WhatsAppTab activeTenant={activeTenant} myAppointments={myAppointments} myServices={myServices} myProfessionals={myProfessionals} />
        )}

        {activeTab === 'configuracoes' && (
          <div className="space-y-6 animate-fade-in">
            {/* Settings header */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-2">Configurações</span>
                <h3 className="text-xl font-extrabold text-slate-900">Serviços, Equipe e Horários</h3>
              </div>
              <div className="flex bg-slate-50 border border-slate-200 p-4 rounded-2xl items-center gap-4 shrink-0">
                <span className="text-4xl p-2 bg-white rounded-xl border border-slate-200">{tenantLogo}</span>
                <div>
                  <p className="text-slate-800 font-bold text-sm">{tenantName}</p>
                  <p className="text-emerald-600 text-[10px] font-bold uppercase">{editedDays.length} dias ativos</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Branding */}
              <form onSubmit={e => { e.preventDefault(); onUpdateTenantDetails(activeTenant.id, { name: tenantName, logo: tenantLogo, phone: tenantPhone, address: tenantAddress, instagram: tenantInstagram, businessDays: editedDays, businessHoursByDay: editedHoursByDay, businessHours: editedHoursByDay['seg'] || [] }); toast.success('Configurações salvas!'); }} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Identidade Visual</h4>
                <input ref={logoInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e => { if(e.target.files?.[0]) setTenantLogo(await fileToDataURL(e.target.files[0])); }} />
                <div className="flex gap-3">
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="size-14 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-2xl hover:bg-slate-100 transition">
                    {tenantLogo.startsWith('data:') ? <img src={tenantLogo} alt="logo" className="size-12 object-cover rounded-xl" /> : tenantLogo}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {['💈','💅','✂️','💄','🧖','💇','🧔','🌟','👑','🔥'].map(e => (
                      <button key={e} type="button" onClick={() => setTenantLogo(e)} className={`size-9 text-lg rounded-xl border transition ${tenantLogo===e?'bg-blue-600 text-white':'bg-slate-50 border-slate-200'}`}>{e}</button>
                    ))}
                  </div>
                </div>
                <input value={tenantName} onChange={e=>setTenantName(e.target.value)} placeholder="Nome" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={tenantPhone} onChange={e=>setTenantPhone(e.target.value)} placeholder="Telefone" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                  <input value={tenantInstagram} onChange={e=>setTenantInstagram(e.target.value)} placeholder="@instagram" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                </div>
                <input value={tenantAddress} onChange={e=>setTenantAddress(e.target.value)} placeholder="Endereço" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow transition">Salvar</button>
              </form>

              {/* Horários */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Horários por Dia</h4>
                <div className="flex flex-wrap gap-2">
                  {['seg','ter','qua','qui','sex','sab','dom'].map(d => (
                    <button key={d} type="button" onClick={() => setSelectedHoursDay(d)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition ${selectedHoursDay===d?'bg-blue-600 text-white shadow-md':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{d}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-900">Dia Ativo:</span>
                  <button type="button" onClick={() => { if(editedDays.includes(selectedHoursDay)) setEditedDays(prev=>prev.filter(d=>d!==selectedHoursDay)); else setEditedDays(prev=>[...prev,selectedHoursDay]); }}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition ${editedDays.includes(selectedHoursDay)?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-red-50 text-red-600 border-red-200'}`}>
                    {editedDays.includes(selectedHoursDay) ? 'Aberto' : 'Fechado'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(editedHoursByDay[selectedHoursDay]||[]).map(h => (
                    <span key={h} className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-xs font-mono text-slate-700">
                      {h}
                      <button type="button" onClick={() => setEditedHoursByDay(prev=>({...prev,[selectedHoursDay]:prev[selectedHoursDay].filter(x=>x!==h)}))} className="text-red-500 ml-1 font-bold hover:text-red-700">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="time" value={newHourInput} onChange={e=>setNewHourInput(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm flex-grow" />
                  <button type="button" onClick={() => { if(newHourInput){ setEditedHoursByDay(prev=>({...prev,[selectedHoursDay]:Array.from(new Set([...(prev[selectedHoursDay]||[]),newHourInput])).sort()})); setNewHourInput(''); }}} className="px-5 bg-slate-900 text-white font-semibold rounded-xl text-sm hover:bg-slate-800 transition">+ Add</button>
                </div>
                <button type="button" onClick={() => { const h = editedHoursByDay[selectedHoursDay]||[]; const all = Object.fromEntries(['seg','ter','qua','qui','sex','sab','dom'].map(d=>[d,[...h]])); setEditedHoursByDay(all); toast.info('Horários copiados para todos os dias.'); }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700">Copiar horários para todos os dias</button>
              </div>
            </div>

            {/* Serviços */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                <Scissors className="w-5 h-5 text-blue-600" /> Serviços
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={e=>{e.preventDefault();if(!srvName.trim())return;onAddService({tenantId:activeTenant.id,name:srvName.trim(),price:srvPrice,durationMinutes:srvDuration,category:srvCategory});toast.success(`Serviço "${srvName}" cadastrado!`);setSrvName('');}} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Novo Serviço</h5>
                  <input type="text" required placeholder="Nome do serviço" value={srvName} onChange={e=>setSrvName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Preço R$</label><input type="number" value={srvPrice} onChange={e=>setSrvPrice(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Duração min</label><input type="number" value={srvDuration} onChange={e=>setSrvDuration(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Categoria</label><select value={srvCategory} onChange={e=>setSrvCategory(e.target.value as any)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm"><option>Cabelo</option><option>Barba</option><option>Estética</option><option>Unhas</option><option>Combo</option></select></div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full text-sm hover:bg-blue-700 transition">Cadastrar</button>
                </form>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 max-h-72 overflow-y-auto">
                  {myServices.map(s => (
                    <div key={s.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between text-sm">
                      <div><h6 className="font-bold text-slate-900">{s.name}</h6><p className="text-xs text-slate-500">{s.category} · {s.durationMinutes}min</p></div>
                      <span className="font-bold text-slate-900">R$ {s.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Equipe */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                <Users className="w-5 h-5 text-blue-600" /> Equipe
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={e=>{e.preventDefault();if(!profName.trim())return;onAddProfessional({tenantId:activeTenant.id,name:profName.trim(),role:profRole,avatar:profAvatar,rating:5,services:myServices.map(s=>s.id),commissionPercentage:profCommission,businessDays:profDays,businessHoursByDay:profHoursByDay});toast.success(`${profName} adicionado à equipe!`);setProfName('');}} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Novo Colaborador</h5>
                  <div className="flex items-center gap-4">
                    <img src={profAvatar} alt="avatar" className="size-14 rounded-2xl border border-slate-200 object-cover" />
                    <input ref={avatarInputRef as any} type="file" className="hidden" accept="image/*" onChange={async e=>{ if(e.target.files?.[0]) setProfAvatar(await fileToDataURL(e.target.files[0])); }} />
                    <button type="button" onClick={()=>avatarInputRef.current?.click()} className="text-xs text-blue-600 font-semibold hover:text-blue-800">Trocar foto</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" required placeholder="Nome" value={profName} onChange={e=>setProfName(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                    <input type="text" placeholder="Cargo" value={profRole} onChange={e=>setProfRole(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none" />
                  </div>
                  <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Comissão %</label><input type="number" min={0} max={100} value={profCommission} onChange={e=>setProfCommission(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm" /></div>
                  <div className="flex flex-wrap gap-2">
                    {['seg','ter','qua','qui','sex','sab','dom'].map(d=>(
                      <button key={d} type="button" onClick={()=>{ setProfDays(prev=>prev.includes(d)?prev.filter(x=>x!==d):[...prev,d]); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${profDays.includes(d)?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-500'}`}>{d}</button>
                    ))}
                  </div>
                  <button type="submit" className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full text-sm hover:bg-blue-700 transition">Adicionar</button>
                </form>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3 max-h-72 overflow-y-auto">
                  {myProfessionals.map(p => (
                    <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 text-sm">
                      <img src={p.avatar} alt={p.name} className="size-12 rounded-full border border-slate-200 object-cover" />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.role} · {p.commissionPercentage}%</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(p.businessDays||[]).map(d=><span key={d} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">{d}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
