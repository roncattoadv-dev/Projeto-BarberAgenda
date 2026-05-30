/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Tenant, Service, Professional, Product, Appointment, Payment, Customer } from '../types';
import { Calendar, Users, ShoppingBag, DollarSign, Plus, Scissors, ShieldAlert, MessageSquare, ExternalLink, Trash, Check, X, RefreshCw, Smartphone, LayoutDashboard, Settings, CreditCard } from 'lucide-react';

interface ClientAdminPanelProps {
  activeTenant: Tenant;
  services: Service[];
  professionals: Professional[];
  products: Product[];
  customers: Customer[];
  appointments: Appointment[];
  payments: Payment[];
  
  onAddService: (service: Omit<Service, 'id'>) => void;
  onAddProfessional: (prof: Omit<Professional, 'id'>) => void;
  onAddProduct: (prod: Omit<Product, 'id'>) => void;
  onUpdateProductStock: (productId: string, newStock: number) => void;
  onAddAppointment: (appt: Omit<Appointment, 'id'>) => void;
  onUpdateAppointmentStatus: (apptId: string, status: Appointment['status']) => void;
  onAddPayment: (payment: Omit<Payment, 'id'>) => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onUpdateTenantDetails: (tenantId: string, details: Partial<Tenant>) => void;
  onSwitchToBookingFlow: (slug: string) => void;
}

export default function ClientAdminPanel({
  activeTenant,
  services,
  professionals,
  products,
  customers,
  appointments,
  payments,
  onAddService,
  onAddProfessional,
  onAddProduct,
  onUpdateProductStock,
  onAddAppointment,
  onUpdateAppointmentStatus,
  onAddPayment,
  onAddCustomer,
  onUpdateTenantDetails,
  onSwitchToBookingFlow
}: ClientAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'financeiro' | 'whatsapp' | 'configuracoes'>('dashboard');
  
  // Filtering datasets by Active Tenant ID
  const myServices = services.filter(s => s.tenantId === activeTenant.id);
  const myProfessionals = professionals.filter(p => p.tenantId === activeTenant.id);
  const myProducts = products.filter(p => p.tenantId === activeTenant.id);
  const myCustomers = customers.filter(c => c.tenantId === activeTenant.id);
  const myAppointments = appointments.filter(a => a.tenantId === activeTenant.id);
  const myPayments = payments.filter(pay => pay.tenantId === activeTenant.id);

  // New Service states
  const [srvName, setSrvName] = useState('');
  const [srvPrice, setSrvPrice] = useState(50);
  const [srvDuration, setSrvDuration] = useState(30);
  const [srvCategory, setSrvCategory] = useState<'Cabelo' | 'Barba' | 'Estética' | 'Unhas' | 'Combo'>('Cabelo');
  const [srvDesc, setSrvDesc] = useState('');

  // New Professional states
  const [profName, setProfName] = useState('');
  const [profRole, setProfRole] = useState('Barbeiro');
  const [profCommission, setProfCommission] = useState(40);
  const [profSelectedHoursDay, setProfSelectedHoursDay] = useState<string>('seg');
  const [profEditedDays, setProfEditedDays] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  const [profEditedHoursByDay, setProfEditedHoursByDay] = useState<Record<string, string[]>>({
    seg: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    ter: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    qua: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    qui: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    sex: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    sab: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    dom: []
  });
  const [profNewHourInput, setProfNewHourInput] = useState('');

  // New Product states
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState(40);
  const [prodCost, setProdCost] = useState(15);
  const [prodStock, setProdStock] = useState(10);
  const [prodMinStock, setProdMinStock] = useState(4);
  const [prodCat, setProdCat] = useState('Finalizadores');

  // Simple Cash desk Entry states
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDesc, setExpenseDesc] = useState('');

  // Counter product sale states
  const [selectedSellProduct, setSelectedSellProduct] = useState('');
  const [selectedSellQty, setSelectedSellQty] = useState(1);

  // New Customer states (modal-less quick form)
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  // Manual Appointment creation states
  const [apptSrvId, setApptSrvId] = useState('');
  const [apptProfId, setApptProfId] = useState('');
  const [apptCustId, setApptCustId] = useState('');
  const [apptDate, setApptDate] = useState('2026-05-29');
  const [apptTime, setApptTime] = useState('11:30');
  const [apptNotes, setApptNotes] = useState('');

  // Filter day for interactive scheduler grid
  const [scheduleFilterDate, setScheduleFilterDate] = useState('2026-05-29');

  // Interactive monthly calendar navigation state
  const [adminViewYear, setAdminViewYear] = useState(2026);
  const [adminViewMonth, setAdminViewMonth] = useState(4); // 0-indexed May
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);

  // Custom Whatsapp Templates State
  const [confirmTemplate, setConfirmTemplate] = useState('Olá {cliente}! Seu agendamento de {servico} com o profissional {profissional} no dia {data} às {hora} está CONFIRMADO.');
  const [reminderTemplate, setReminderTemplate] = useState('Lembrete Amigo! 😊 {cliente}, você tem um compromisso marcado amanhã ({data}) às {hora} para {servico}. Aguardamos você!');

  // Calculations
  const totalRevenue = myPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = myPayments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + p.amount, 0);
  const netEarnings = totalRevenue - totalExpenses;

  // Customization & Branding Edit States
  const [tenantLogo, setTenantLogo] = useState(activeTenant.logo || '💈');
  const [tenantName, setTenantName] = useState(activeTenant.name || '');
  const [tenantPhone, setTenantPhone] = useState(activeTenant.phone || '');
  const [tenantAddress, setTenantAddress] = useState(activeTenant.address || '');
  const [tenantInstagram, setTenantInstagram] = useState(activeTenant.instagram || '');
  const [editedDays, setEditedDays] = useState<string[]>(activeTenant.businessDays || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  const [editedHours, setEditedHours] = useState<string[]>(activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10']);
  
  // Custom hour insert state
  const [newHourInput, setNewHourInput] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profAvatar, setProfAvatar] = useState('https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80');

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const dataURL = await fileToDataURL(e.target.files[0]);
      setTenantLogo(dataURL);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const dataURL = await fileToDataURL(e.target.files[0]);
      setProfAvatar(dataURL);
    }
  };

  // Daily Operational Hours customization
  const [selectedHoursDay, setSelectedHoursDay] = useState<string>('seg');
  const [editedHoursByDay, setEditedHoursByDay] = useState<Record<string, string[]>>({
    seg: activeTenant.businessHoursByDay?.seg || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    ter: activeTenant.businessHoursByDay?.ter || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    qua: activeTenant.businessHoursByDay?.qua || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    qui: activeTenant.businessHoursByDay?.qui || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    sex: activeTenant.businessHoursByDay?.sex || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    sab: activeTenant.businessHoursByDay?.sab || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
    dom: activeTenant.businessHoursByDay?.dom || activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10']
  });

  // Direct cash desk inflow states (custom sale)
  const [directSaleDesc, setDirectSaleDesc] = useState('');
  const [directSaleAmount, setDirectSaleAmount] = useState<number>(0);
  const [directSaleMethod, setDirectSaleMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');

  // Keep settings edit form in sync with activeTenant when admin switches tenant selection
  React.useEffect(() => {
    setTenantLogo(activeTenant.logo || '💈');
    setTenantName(activeTenant.name || '');
    setTenantPhone(activeTenant.phone || '');
    setTenantAddress(activeTenant.address || '');
    setTenantInstagram(activeTenant.instagram || '');
    setEditedDays(activeTenant.businessDays || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
    setEditedHours(activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10']);
    setEditedHoursByDay(activeTenant.businessHoursByDay || {
      seg: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      ter: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      qua: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      qui: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      sex: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:10', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      sab: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:15', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10'],
      dom: activeTenant.businessHours || ['09:40', '10:20', '11:00', '13:30', '14:15', '14:50', '15:30', '16:10', '16:50', '17:30', '18:10']
    });
  }, [activeTenant.id]);

  // Real-time daily appointment count
  const appointmentsToday = myAppointments.filter(appt => appt.date === '2026-05-29');
  const pendingToday = appointmentsToday.filter(a => a.status === 'pending').length;
  const confirmedToday = appointmentsToday.filter(a => a.status === 'confirmed').length;
  const attendedToday = appointmentsToday.filter(a => a.status === 'attended').length;

  // Commissions Calculations
  const calculatedCommissions = myProfessionals.map(prof => {
    const closedAppts = myAppointments.filter(a => a.professionalId === prof.id && a.status === 'attended');
    const totalEarnings = closedAppts.reduce((sum, a) => sum + a.price, 0);
    const commAmt = totalEarnings * (prof.commissionPercentage / 100);
    return {
      id: prof.id,
      name: prof.name,
      rating: prof.rating,
      closedCount: closedAppts.length,
      commissionPct: prof.commissionPercentage,
      totalEarnedForSalon: totalEarnings,
      dueCommission: commAmt
    };
  });

  // Services sold chart approximation
  const serviceSalesFrequency = myServices.map(srv => {
    const occurrences = myAppointments.filter(a => a.serviceId === srv.id && a.status !== 'cancelled').length;
    return {
      name: srv.name,
      occurrences,
      revenueGenerated: occurrences * srv.price
    };
  }).sort((a,b) => b.occurrences - a.occurrences);

  // Handlers
  const handleAddServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;
    onAddService({
      tenantId: activeTenant.id,
      name: srvName,
      price: srvPrice,
      durationMinutes: srvDuration,
      category: srvCategory,
      description: srvDesc
    });
    setSrvName('');
    setSrvDesc('');
    alert(`Serviço "${srvName}" cadastrado com sucesso!`);
  };

  const handleAddProfessionalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) return;
    onAddProfessional({
      tenantId: activeTenant.id,
      name: profName,
      role: profRole,
      avatar: profAvatar,
      rating: 5.0,
      services: myServices.map(s => s.id),
      commissionPercentage: profCommission,
      businessDays: profEditedDays,
      businessHoursByDay: profEditedHoursByDay
    });
    setProfName('');
    setProfAvatar('https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80');
    alert(`Profissional "${profName}" inserido na equipe.`);
  };

  const handleCreateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    onAddProduct({
      tenantId: activeTenant.id,
      name: prodName,
      price: prodPrice,
      costPrice: prodCost,
      stock: prodStock,
      minStock: prodMinStock,
      category: prodCat
    });
    setProdName('');
    alert(`Produto ${prodName} cadastrado no estoque!`);
  };

  const handleAddManualCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;
    onAddCustomer({
      tenantId: activeTenant.id,
      name: custName,
      email: custEmail || `${custName.toLowerCase().replace(/\s/g, '')}@example.com`,
      phone: custPhone
    });
    setCustName('');
    setCustPhone('');
    setCustEmail('');
    alert('Cliente cadastrado com sucesso!');
  };

  const handleManualAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptSrvId || !apptProfId || !apptCustId) {
      alert('Selecione Serviço, Profissional e Cliente antes de reservar.');
      return;
    }
    const selectedSrv = myServices.find(s => s.id === apptSrvId);
    const selectedCust = myCustomers.find(c => c.id === apptCustId);
    
    if (!selectedSrv || !selectedCust) return;

    // Check for professional time conflict in state (simplified simulation)
    const hasConflict = myAppointments.some(a => 
      a.date === apptDate && 
      a.time === apptTime && 
      a.professionalId === apptProfId && 
      a.status !== 'cancelled'
    );

    if (hasConflict) {
      alert(`⚠️ Erro de Agendamento: O profissional selecionado já possui um serviço agendado neste exato dia (${apptDate}) e horário (${apptTime})! Evitando conflito no banco.`);
      return;
    }

    onAddAppointment({
      tenantId: activeTenant.id,
      serviceId: apptSrvId,
      professionalId: apptProfId,
      customerId: apptCustId,
      customerName: selectedCust.name,
      customerPhone: selectedCust.phone,
      date: apptDate,
      time: apptTime,
      durationMinutes: selectedSrv.durationMinutes,
      price: selectedSrv.price,
      status: 'confirmed',
      notes: apptNotes
    });

    setApptNotes('');
    alert('Reserva manual inserida na agenda física com sucesso!');
  };

  // Perform a Direct Sell at counter (custom entry)
  const handlePerformSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSaleDesc.trim() || directSaleAmount <= 0) {
      alert("Por favor, preencha a descrição e o valor do faturamento!");
      return;
    }

    // Create payment inflow ledger
    onAddPayment({
      tenantId: activeTenant.id,
      amount: directSaleAmount,
      method: directSaleMethod,
      status: 'paid',
      date: '2026-05-29 20:09:14',
      description: `Lançamento Avulso (PDV): ${directSaleDesc.trim()}`
    });

    alert(`Lançamento de Receita avulsa efetuado com sucesso! Faturamento de R$ ${directSaleAmount.toFixed(2)} registrado.`);
    setDirectSaleDesc('');
    setDirectSaleAmount(0);
  };

  const handleRegisterExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseDesc.trim()) return;

    onAddPayment({
      tenantId: activeTenant.id,
      amount: expenseAmount,
      method: 'cash',
      status: 'refunded', // refund signifies business payout / expense in our payment ledgers
      date: '2026-05-29 20:09:14',
      description: `Despesa Registrada: ${expenseDesc}`
    });

    setExpenseAmount(0);
    setExpenseDesc('');
    alert('Despesa debitada do caixa com sucesso!');
  };

  // Triggering visual appointment state change triggers financial records automatically
  const handleCompleteAppointment = (appt: Appointment) => {
    onUpdateAppointmentStatus(appt.id, 'attended');
    
    // Auto-create payout ledger flow
    onAddPayment({
      tenantId: activeTenant.id,
      appointmentId: appt.id,
      amount: appt.price,
      method: 'pix',
      status: 'paid',
      date: '2026-05-29 20:09:14',
      description: `Encerramento de Serviço na Agenda - Cliente: ${appt.customerName} (${myServices.find(s=>s.id === appt.serviceId)?.name})`
    });

    alert(`Atendimento concluído! Fluxo financeiro cadastrado: +R$ ${appt.price.toFixed(2)} e comissão do barbeiro creditada.`);
  };

  // Hours array for Grid
  const BUSINESS_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const activeHoursList = BUSINESS_HOURS;
  const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const formatFullPTDate = (dateStr: string) => {
    if(!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${Math.abs(Number(d))} de ${MONTHS_PT[Number(m)-1]} de ${y}`;
    } catch (e) {
      return dateStr;
    }
  };

  const copyWhatsAppMsg = (appt: Appointment, type: 'confirmation' | 'reminder') => {
    const srv = myServices.find(s => s.id === appt.serviceId)?.name || 'Serviço';
    const msg = type === 'confirmation'
      ? `Olá ${appt.customerName}, seu agendamento de ${srv} está confirmado para o dia ${appt.date} às ${appt.time}.`
      : `Olá ${appt.customerName}, lembrete do seu agendamento de ${srv} amanhã às ${appt.time}.`;
    navigator.clipboard.writeText(msg).then(() => alert('Mensagem copiada para transferência!'));
  };

  return (
    <div id="client-admin-root" className="bg-slate-50 min-h-screen p-4 md:p-10">
      
      {/* Top Tenant Header - Premium Aesthetic */}
      <div className="bg-white px-8 py-8 border border-slate-100 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm mb-8">
        <div className="flex items-center gap-5">
          <span className="text-5xl bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-center shadow-inner">
            {tenantLogo.startsWith('data:') ? <img src={tenantLogo} alt="Logo" className="w-12 h-12 object-cover rounded-2xl" /> : tenantLogo}
          </span>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{activeTenant.name}</h1>
              {activeTenant.status === 'trial' ? (
                <span className="px-3 py-1 rounded-full text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold tracking-wide">
                  Período Teste
                </span>
              ) : activeTenant.status === 'active' ? (
                <span className="px-3 py-1 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold tracking-wide">
                  Ativo
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[11px] bg-red-50 text-red-700 border border-red-200 font-semibold tracking-wide">
                  Inadimplente
                </span>
              )}
            </div>
            
            <p className="text-sm text-slate-500 font-medium tracking-tight">
              {activeTenant.address}
            </p>
          </div>
        </div>

        {/* Exclusive booking url simulator */}
        <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex flex-col items-end shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Link Público</span>
          <button
            id="btn-public-booking"
            onClick={() => onSwitchToBookingFlow(activeTenant.slug)}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-2 focus:outline-none"
          >
            saasbarber.io/book/{activeTenant.slug}
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Internal Navigation Menu - Premium Tabs */}
      <div className="bg-white/80 backdrop-blur-md px-2 py-2 border border-slate-200/60 rounded-full flex flex-wrap gap-2 mb-10 w-fit shadow-sm ring-1 ring-slate-900/5">
        {[
          { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
          { id: 'agenda', label: 'Agenda', icon: Calendar },
          { id: 'financeiro', label: 'Financeiro', icon: CreditCard },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
          { id: 'configuracoes', label: 'Configurações', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-md scale-100' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 scale-95 hover:scale-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-300' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Panels */}
      <div className="p-6">
        
        {/* PANEL A: DASHBOARD OUTLOOK */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Quick dashboard cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Faturamento</span>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  R$ {netEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="text-sm text-slate-500 mt-2 font-medium">Líquido mensal</div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Agendamentos</span>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {appointmentsToday.length}
                </p>
                <div className="flex gap-4 text-sm text-slate-500 mt-2 font-medium">
                  <span>{attendedToday} Concluídos</span>
                  <span>{confirmedToday} Confirmados</span>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Equipe</span>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {myProfessionals.length}
                </p>
                <div className="text-sm text-slate-500 mt-2 font-medium">Profissionais ativos</div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Catálogo</span>
                <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {myServices.length}
                </p>
                <div className="text-sm text-slate-500 mt-2 font-medium">Serviços configurados</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Daily analytics chart representation */}
              <div className="glass-card p-5 rounded-xl space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                  Serviços Mais Vendidos (Volume)
                </h3>
                
                <div className="space-y-3.5">
                  {serviceSalesFrequency.map((srv, idx) => {
                    const maxOccur = Math.max(...serviceSalesFrequency.map(s => s.occurrences), 1);
                    const percentWidth = (srv.occurrences / maxOccur) * 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-700 font-semibold">{srv.name}</span>
                          <span className="text-slate-500 font-mono font-bold">{srv.occurrences} agendamentos (R$ {srv.revenueGenerated})</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentWidth}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Client activity summaries */}
              <div className="glass-card p-5 rounded-xl space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                  Cadastro de Clientes
                </h3>
                
                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto w-full">
                  {myCustomers.map(cust => (
                    <div key={cust.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-700">{cust.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{cust.phone}</span>
                      </div>
                      
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400 font-mono">{cust.email}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[11px] text-slate-500 leading-relaxed font-mono">
                  💡 Os contatos e históricos dos clientes são atualizados em tempo real a cada novo agendamento marcado no portal de agendamento online.
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PANEL B: WEEKLY/DAILY ACTIVE CALENDAR (INTERACTIVE SCHEDULER - NOW EXTENSIVE INTERACTIVE CALENDAR) */}
        {activeTab === 'agenda' && (() => {
          // Inner helper functions for Calendar rendering
          const getDaysInMonth = (year: number, month: number) => {
            return new Date(year, month + 1, 0).getDate();
          };

          const getFirstDayOffset = (year: number, month: number) => {
            const day = new Date(year, month, 1).getDay();
            return day === 0 ? 6 : day - 1; // Mon-Sun indexed (0-6)
          };

          const MONTHS_PT = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];

          const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

          // Month navigation
          const handlePrevMonth = () => {
            setAdminViewMonth(prev => {
              if (prev === 0) {
                setAdminViewYear(y => y - 1);
                return 11;
              }
              return prev - 1;
            });
          };

          const handleNextMonth = () => {
            setAdminViewMonth(prev => {
              if (prev === 11) {
                setAdminViewYear(y => y + 1);
                return 0;
              }
              return prev + 1;
            });
          };

          const handleJumpToToday = () => {
            setScheduleFilterDate('2026-05-29');
            setAdminViewYear(2026);
            setAdminViewMonth(4); // May
          };

          // Filter appointments for the selected day
          const selectedDayAppointments = myAppointments.filter(
            appt => appt.date === scheduleFilterDate && appt.status !== 'cancelled'
          ).sort((a, b) => a.time.localeCompare(b.time));

          // Calculate estimations for selected day
          const dayEstimateEarnings = selectedDayAppointments
            .reduce((sum, a) => sum + (a.price || 0), 0);
          const dayConfirmedCount = selectedDayAppointments.filter(a => a.status === 'confirmed').length;
          const dayAttendedCount = selectedDayAppointments.filter(a => a.status === 'attended').length;
          const dayPendingCount = selectedDayAppointments.filter(a => a.status === 'pending').length;

          return (
            <div className="space-y-8 animate-fade-in">
              {/* Informative Dashboard Heading */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 shadow-sm">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Gestão de Agenda</span>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Agenda Física Operacional</h3>
                  <p className="text-sm text-slate-500 mt-2">Gerencie as reservas do salão, consulte vagas e organize a equipe.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleJumpToToday}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-semibold transition flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" /> Ir para Hoje
                  </button>
                </div>
              </div>

              {/* Main Calendar View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar Board */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-slate-900">
                      {MONTHS_PT[adminViewMonth]} {adminViewYear}
                    </h4>
                    <div className="flex gap-2">
                       <button onClick={handlePrevMonth} className="size-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition">‹</button>
                       <button onClick={handleNextMonth} className="size-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition">›</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 mb-3">
                      {WEEKDAYS_PT.map(d => <div key={d}>{d}</div>)}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const totalDays = getDaysInMonth(adminViewYear, adminViewMonth);
                      const offset = getFirstDayOffset(adminViewYear, adminViewMonth);
                      const gridCells = [];
                      for (let i = 0; i < offset; i++) gridCells.push(<div key={`blank-${i}`} />);
                      for (let d = 1; d <= totalDays; d++) {
                        const currentFormatted = `${adminViewYear}-${String(adminViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        gridCells.push(
                          <button
                            key={d}
                            onClick={() => setScheduleFilterDate(currentFormatted)}
                            className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-medium transition ${
                              scheduleFilterDate === currentFormatted ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                            }`}
                          >
                            {d}
                          </button>
                        );
                      }
                      return gridCells;
                    })()}
                  </div>
                </div>

                {/* Day Details */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900 mb-6">Agendamentos - {scheduleFilterDate}</h4>
                    {/* Appointment list content */}
                
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">Inspeção Detalhada</span>
                      <h4 className="text-sm font-extrabold text-slate-800 uppercase mt-0.5 tracking-tight font-sans">
                      {formatFullPTDate(scheduleFilterDate)}
                      </h4>
                    </div>
                    <span className="text-[11px] text-blue-600 font-mono bg-blue-50 border border-blue-100 px-3 py-1 rounded-full font-bold shrink-0 self-start sm:self-center select-none shadow-3xs">
                      {selectedDayAppointments.length} Serviços Mapeados
                    </span>
                    
                    {/* Appointments listing under the selected day */}
                    <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 mt-4">
                      {selectedDayAppointments.length > 0 ? (
                        selectedDayAppointments.map(appt => {
                          const serviceObj = myServices.find(s => s.id === appt.serviceId);
                          const professionalObj = myProfessionals.find(p => p.id === appt.professionalId);
                          const isExpanded = expandedApptId === appt.id;

                          return (
                            <div
                              key={appt.id}
                              className={`p-5 rounded-2xl border transition-all shadow-sm ${
                                appt.status === 'attended'
                                  ? 'bg-emerald-50 border-emerald-100/60 text-slate-700'
                                  : appt.status === 'confirmed'
                                  ? 'bg-blue-50 border-blue-100/60 text-slate-700 shadow-md border-b-2 border-b-blue-200'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-amber-200 hover:shadow-md'
                              }`}
                            >
                              
                              {/* Header metrics card */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                  <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-extrabold text-white font-mono whitespace-nowrap shadow-sm tracking-tight text-center">
                                    {appt.time}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-slate-900 font-sans tracking-tight text-[15px]">{appt.customerName}</span>
                                      <span className="text-[11px] text-slate-500 font-mono font-medium">({appt.customerPhone})</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                                      <span>✂️ {serviceObj?.name || 'Serviço Personalizado'}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-blue-600 font-bold">{professionalObj?.name || 'Funcionário'}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right flex flex-col items-end shrink-0 select-none">
                                  <span className="font-mono font-extrabold text-emerald-600 text-[15px] tracking-tight">R$ {(appt.price || 50).toFixed(2)}</span>
                                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 font-semibold">{(appt.durationMinutes || 30)} min</span>
                                </div>
                              </div>

                              {/* Customer notes */}
                              {appt.notes && (
                                <div className="mt-3 text-[11px] bg-amber-50/70 p-3 rounded-xl text-amber-700 italic font-medium border border-amber-100/50 shadow-3xs leading-relaxed">
                                  🗣️ Obs: &ldquo;{appt.notes}&rdquo;
                                </div>
                              )}

                              {/* ACTIONS COLLAPSIBLE & ACTIONS DISPATCH OPTIONS */}
                              <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-4">
                                
                                {/* Status indicators tag */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status:</span>
                                  {appt.status === 'attended' ? (
                                    <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-md font-bold font-mono text-[9px] uppercase tracking-widest">
                                      Atendido & Pago
                                    </span>
                                  ) : appt.status === 'confirmed' ? (
                                    <span className="px-2.5 py-1 bg-blue-100 border border-blue-200 text-blue-700 rounded-md font-bold font-mono text-[9px] uppercase tracking-widest">
                                      Confirmado
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 bg-amber-100 border border-amber-200 text-amber-700 rounded-md font-bold font-mono text-[9px] uppercase tracking-widest">
                                      Pendente
                                    </span>
                                  )}
                                </div>

                                {/* OPTIONS BUTTONS BAR */}
                                <div className="flex flex-wrap items-center bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                                  
                                  {/* Conclude & Pay Button */}
                                  {appt.status !== 'attended' && (
                                    <button
                                      id={`btn-agenda-complete-${appt.id}`}
                                      type="button"
                                      onClick={() => handleCompleteAppointment(appt)}
                                      className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border-r border-slate-100 transition flex items-center gap-1.5 cursor-pointer text-xs"
                                      title="Registrar conclusão do serviço e lançar pagamento correspondente no caixa"
                                    >
                                      <span className="text-sm">✅</span> Concluir & Pag
                                    </button>
                                  )}

                                  {/* Expand / Setup Notifications Switch */}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                                    className={`px-4 py-2 border-r border-slate-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                      isExpanded 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-white hover:bg-slate-50 text-slate-600'
                                    }`}
                                    title="Disparar lembretes WhatsApp e avisos"
                                  >
                                    💬 Zap
                                  </button>

                                  {/* Cancel Option */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Deseja cancelar o agendamento de ${appt.customerName} das ${appt.time}? Esta ação irá liberar o horário na agenda online.`)) {
                                        onUpdateAppointmentStatus(appt.id, 'cancelled');
                                        alert("Agendamento desmarcado com sucesso. Vaga online disponível!");
                                      }
                                    }}
                                    className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 transition text-xs font-bold"
                                    title="Desmarcar horário da vaga e avisar"
                                  >
                                    Cancelar
                                  </button>
                                </div>

                              </div>

                              {/* EXPANDABLE WHATSAPP NOTIFICATION DISPATCH PANEL */}
                              {isExpanded && (
                                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 select-none">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Canal de Comunicação Whatsapp</span>
                                    <span className="text-[10px] italic text-blue-600 font-semibold">Selecione o modelo abaixo para enviar:</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => copyWhatsAppMsg(appt, 'confirmation')}
                                      className="p-3 text-left bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-700 transition flex flex-col gap-1 cursor-pointer shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                      <span className="text-[11px] font-extrabold text-blue-600">✓ Confirmar Vaga</span>
                                      <span className="text-[9px] text-slate-500 truncate leading-none uppercase tracking-widest font-bold">Notificar agendamento</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => copyWhatsAppMsg(appt, 'reminder')}
                                      className="p-3 text-left bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-700 transition flex flex-col gap-1 cursor-pointer shadow-sm hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                      <span className="text-[11px] font-extrabold text-amber-600">⏰ Enviar Lembrete</span>
                                      <span className="text-[9px] text-slate-500 truncate leading-none uppercase tracking-widest font-bold">Aviso preventivo</span>
                                    </button>
                                  </div>

                                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                                    💡 Nota: O sistema copia o conteúdo customizado com as tags preenchidas diretamente para a Área de Transferência. Cole o texto no App do WhatsApp para enviar imediatamente.
                                  </p>
                                </div>
                              )}

                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-16 border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl flex flex-col items-center justify-center p-6 space-y-4">
                          <span className="text-4xl filter grayscale opacity-60">☕</span>
                          <div>
                            <p className="font-extrabold text-slate-700 text-lg tracking-tight">Nenhum agendamento para este dia</p>
                            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed font-medium">A grade está totalmente livre para atendimento. Você pode agendar novos clientes usando o painel rápido abaixo.</p>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              {/* TWO SECURE INLINE FORMS: RE-SCHEDULE MANUAL & QUICK CUSTOMER ADDITION */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* 1. AGENDAMENTO MANUAL */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2h-2 rounded-full bg-blue-600"></span>
                      Lançamento de Reserva Manual
                    </h4>
                    <p className="text-[11.5px] text-slate-500 mt-2 font-medium">Insira clientes vindos de balcão ou ligações diretamente na agenda.</p>
                  </div>

                  <form onSubmit={handleManualAppointment} className="space-y-4 text-xs font-sans">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block mb-1">Passo 1: Selecionar Cliente</label>
                        <select
                          value={apptCustId}
                          onChange={(e) => setApptCustId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                          required
                        >
                          <option value="">-- Escolher Cliente --</option>
                          {myCustomers.map(cust => (
                            <option key={cust.id} value={cust.id}>{cust.name} ({cust.phone})</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block mb-1">Passo 2: Serviço</label>
                          <select
                            value={apptSrvId}
                            onChange={(e) => setApptSrvId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                            required
                          >
                            <option value="">-- Escolher --</option>
                            {myServices.map(srv => (
                              <option key={srv.id} value={srv.id}>{srv.name} (R$ {srv.price})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block mb-1">Passo 3: Atendente</label>
                          <select
                            value={apptProfId}
                            onChange={(e) => setApptProfId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                            required
                          >
                            <option value="">-- Barbeiro --</option>
                            {myProfessionals.map(prof => (
                              <option key={prof.id} value={prof.id}>{prof.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-mono">
                      <div>
                        <label className="text-[10px] font-sans font-bold tracking-widest uppercase text-slate-400 block mb-1">Passe 4: Data de Atendimento</label>
                        <input
                          type="date"
                          value={apptDate}
                          onChange={(e) => setApptDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-sans font-bold tracking-widest uppercase text-slate-400 block mb-1">Passo 5: Horário do Slot</label>
                        <select
                          value={apptTime}
                          onChange={(e) => setApptTime(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                          required
                        >
                          <option value="">-- Escolher horário --</option>
                          {activeHoursList.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-sans font-bold tracking-widest uppercase text-slate-400 block mb-1">Notas Internas ou Preferências (Opcional)</label>
                      <textarea
                        placeholder="Ex: Cabelo lavado com água fria, aparador número 2 baixo..."
                        value={apptNotes}
                        onChange={(e) => setApptNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 h-20 resize-none outline-none text-sm focus:border-blue-500 transition shadow-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-md transition hover:-translate-y-0.5 active:translate-y-0 text-sm mt-2"
                      id="btn-confirm-reserve"
                    >
                      Gravar Agendamento na Agenda
                    </button>
                  </form>
                </div>

                {/* 2. CADASTRAR CLIENTE DE FORMA RÁPIDA NO BALCÃO */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        Painel de Clientes Rápidos (Balcão)
                      </h4>
                      <p className="text-[11.5px] text-slate-500 mt-2 font-medium">Crie clientes no banco de dados para poder selecioná-los no menu de agendamentos ou comandas de vendas.</p>
                    </div>

                    <form onSubmit={handleAddManualCustomer} className="space-y-4 pt-4 font-sans">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block">Nome Completo do Cliente</label>
                        <input
                          type="text"
                          placeholder="Nome Completo do Cliente"
                          value={custName}
                          onChange={(e) => setCustName(e.target.value)}
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block">Número de Telefone</label>
                          <input
                            type="tel"
                            placeholder="Telefone (DDD + Número)"
                            value={custPhone}
                            onChange={(e) => setCustPhone(e.target.value)}
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold tracking-widest uppercase text-slate-400 block font-sans">Endereço de E-mail (Opcional)</label>
                          <input
                            type="email"
                            placeholder="cliente@exemplo.com"
                            value={custEmail}
                            onChange={(e) => setCustEmail(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none text-sm focus:border-blue-500 transition shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-full border border-slate-300 transition cursor-pointer"
                        >
                          Adicionar Novo Registro de Cliente
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 text-[11px] text-slate-500 font-medium leading-relaxed italic mt-4">
                    💡 Dica: Após adicionar o cliente aqui, ele ficará disponível imediatamente para seleção no menu "Lançamento de Reserva Manual" ao lado para que você agende horários nele.
                  </div>
                </div>

              </div>

            </div>
          );
        })()}

        {/* PANEL D: CASH FLUIDITY & TEAM COMMISSIONS */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            
            {/* Quick cash registers entries */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Lançamento Avulso de Receita (Faturamento de Balcão) */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-600" /> Receita Geral (Avulsa)
                </h3>
                <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Registre faturamento imediato direto de balcão.</p>
                
                <form onSubmit={handlePerformSell} className="space-y-4 text-sm">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descrição</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Venda de produto"
                      value={directSaleDesc}
                      onChange={(e) => setDirectSaleDesc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        placeholder="Ex: 50"
                        value={directSaleAmount || ''}
                        onChange={(e) => setDirectSaleAmount(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Forma</label>
                      <select
                        value={directSaleMethod}
                        onChange={(e) => setDirectSaleMethod(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                      >
                        <option value="pix">Pix</option>
                        <option value="cash">Dinheiro</option>
                        <option value="credit_card">Cartão</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-700 transition"
                    id="btn-direct-sale"
                  >
                    Lançar Receita
                  </button>
                </form>
              </div>

              {/* Expense/Payout manual register */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Trash className="w-5 h-5 text-red-600" /> Registrar Despesa
                </h3>
                  <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Débito manual para pagamentos diversos.</p>
                
                <form onSubmit={handleRegisterExpense} className="space-y-4 text-sm">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descrição</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Lavanderia"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-red-50 text-red-600 font-semibold rounded-full hover:bg-red-100 transition"
                    id="btn-add-expense"
                  >
                    Confirmar Despesa
                  </button>
                </form>
              </div>

              {/* COMMISSIONS DYNAMIC SPLIT CALCULATOR */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" /> Repasse de Comissões Colaborativas
                </h3>
                <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Visão geral dos ganhos da equipe a serem repassados.</p>
                
                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-2">
                  {calculatedCommissions.map(comm => (
                    <div key={comm.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{comm.name}</p>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {comm.closedCount} cortes fechados • {comm.commissionPct}% quota
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-emerald-600 font-extrabold text-[15px] tracking-tight">
                          R$ {comm.dueCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">Lucro Salão: R$ {(comm.totalEarnedForSalon - comm.dueCommission).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-slate-500 bg-blue-50/50 p-4 rounded-2xl mt-4 leading-relaxed border border-blue-100/50 flex gap-3 items-start">
                  <span className="text-lg">ℹ️</span>
                  <p><strong>Comitê de Repasse:</strong> Os valores de comissão sintonizam em Tempo Real assim que novos horários na Agenda são sinalizados como "Presença Confirmada (Concluir)".</p>
                </div>
              </div>

            </div>

            {/* TRANSACTIONS HISTORIC LOG TABLE */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" /> Histórico de Fluxo de Caixa
              </h3>
              <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Balancete consolidado de entradas, saídas e movimentações diárias.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-500">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest bg-slate-50/50">
                      <th className="py-3 px-4 rounded-tl-xl rounded-bl-xl">Data / Hora</th>
                      <th className="py-3 px-4">Origem / Descrição</th>
                      <th className="py-3 px-4">Método</th>
                      <th className="py-3 px-4">Entrada / Saída</th>
                      <th className="py-3 px-4 text-right rounded-tr-xl rounded-br-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {myPayments.length > 0 ? (
                      myPayments.map(payment => (
                        <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-4 font-medium text-slate-600 text-xs">{payment.date}</td>
                          <td className="py-4 px-4 font-semibold text-slate-800">{payment.description}</td>
                          <td className="py-4 px-4">
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">
                              {payment.method}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-extrabold tracking-tight">
                            {payment.status === 'refunded' ? (
                              <span className="text-red-600">- R$ {payment.amount.toFixed(2)}</span>
                            ) : (
                              <span className="text-emerald-600">+ R$ {payment.amount.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest border ${
                              payment.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {payment.status === 'paid' ? 'Pago' : 'Saída'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400 font-medium bg-slate-50/50 rounded-xl mt-2 border border-dashed border-slate-200">
                          Nenhuma transação registrada no fechamento do caixa hoje.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* PANEL E: WHATSAPP AUTOMATION TEMPLATES */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-4">Configuração de Disparos</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Configure o padrão de disparo automático dos gatilhos enviados às filiais de clientes finais. Nossos processadores do SaaS disparam as Mensagens conforme reservas sofrem alterações no sistema.
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Confirmação Imediata</label>
                    <textarea
                      value={confirmTemplate}
                      onChange={(e) => setConfirmTemplate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-sans text-sm h-32 resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Lembrete (T-24h)</label>
                    <textarea
                      value={reminderTemplate}
                      onChange={(e) => setReminderTemplate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-sans text-sm h-32 resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={() => alert("Configurações salvas!")}
                    className="w-full py-3.5 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 transition"
                  >
                    Salvar Modelos
                  </button>
                </div>
              </div>

              {/* WHATSAPP VISUAL PREVIEW */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-4 mb-4">Simulador de Notificação</h3>
                  <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="flex gap-4 items-center mb-6">
                      <div className="size-12 bg-emerald-500 rounded-full flex items-center justify-center text-white text-2xl">💬</div>
                      <div>
                        <div className="text-white font-bold">{activeTenant.name}</div>
                        <div className="text-emerald-400 text-xs">Verificado</div>
                      </div>
                    </div>
                    <div className="bg-white text-slate-900 text-sm p-5 rounded-2xl leading-relaxed">
                      {confirmTemplate
                        .replace('{cliente}', 'Thiago')
                        .replace('{servico}', 'Corte Degradê')
                        .replace('{profissional}', 'Gustavo Guga')
                        .replace('{data}', '29/05')
                        .replace('{hora}', '11:00')
                      }
                    </div>
                  </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL F: CUSTOMIZATION, BRANDING, DAYS AND HOURS SETTINGS */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-6 transition-all animate-fade-in text-xs font-sans">
            
            {/* Header banner */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-2">Configurações Gerais de Operação</span>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Serviços, Equipe, Personalização & Horários</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">Defina sua identidade visual, configure horários de funcionamento específicos para cada dia da semana, gerencie colaboradores e edite o catálogo de atendimentos.</p>
              </div>
              <div className="flex bg-slate-50 border border-slate-200 p-4 rounded-2xl md:items-center text-center select-none shrink-0 gap-4 shadow-3xs">
                <span className="text-4xl p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">{tenantLogo}</span>
                <div className="text-left">
                  <p className="text-slate-800 font-bold text-sm tracking-tight">{tenantName || 'Sem Nome'}</p>
                  <p className="text-emerald-600 font-semibold text-[10px] tracking-wide uppercase mt-1">{editedDays.length} Dias ativos • Configuração individual de horários ativa</p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              onUpdateTenantDetails(activeTenant.id, {
                name: tenantName.trim(),
                logo: tenantLogo.trim(),
                phone: tenantPhone.trim(),
                address: tenantAddress.trim(),
                instagram: tenantInstagram.trim(),
                businessDays: editedDays,
                businessHours: editedHoursByDay['seg'] || [], // fallback for backward-compatibility
                businessHoursByDay: editedHoursByDay
              });
              alert("✨ Configurações de Personalização e Horários por dia salvas com sucesso!");
            }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* BRANDING CARD (LOGO & VISUAL IDENTITY) */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                    1. Identidade Visual
                  </h4>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase block">Nome da Barbearia / Salão</label>
                    <input
                      type="text"
                      required
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* Logo preset picker and custom typing */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase block">Sua Logo</label>
                    <div className="flex gap-4">
                      <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="size-16 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl text-2xl focus:outline-none hover:bg-slate-100 transition"
                      >
                        {tenantLogo.startsWith('data:') ? <img src={tenantLogo} alt="Logo" className="size-12 object-cover rounded-xl" /> : tenantLogo}
                      </button>
                      <div className="flex-grow bg-slate-50 rounded-2xl p-4 flex items-center text-slate-500 text-xs">
                        Clique no ícone para subir uma imagem, ou selecione um emoji abaixo.
                      </div>
                    </div>

                    {/* Fast presets selection */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {['💈', '💅', '✂️', '💄', '🧖', '💇', '🧔', '🌟', '👑', '🔥', '⚔️', '💡'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTenantLogo(preset)}
                          className={`size-10 text-lg rounded-xl flex items-center justify-center border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            tenantLogo === preset ? 'bg-blue-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-600'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operational Contacts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase block">Telefone</label>
                      <input
                        type="text"
                        value={tenantPhone}
                        onChange={(e) => setTenantPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase block">Instagram</label>
                      <input
                        type="text"
                        value={tenantInstagram}
                        onChange={(e) => setTenantInstagram(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase block">Endereço</label>
                    <input
                      type="text"
                      value={tenantAddress}
                      onChange={(e) => setTenantAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow transition"
                  >
                    Salvar Configurações Gerais
                  </button>
                </div>
              </div>

              {/* OPERATING DAYS AND OPERATING TIME SLOTS PER DAY */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                    2. Horários por Dia
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const slotsToCopy = editedHoursByDay[selectedHoursDay] || [];
                      const copyMatrix = {
                        seg: [...slotsToCopy],
                        ter: [...slotsToCopy],
                        qua: [...slotsToCopy],
                        qui: [...slotsToCopy],
                        sex: [...slotsToCopy],
                        sab: [...slotsToCopy],
                        dom: [...slotsToCopy]
                      };
                      setEditedHoursByDay(copyMatrix);
                      alert(`📋 Horários copiados para todos os dias.`);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    Copiar para todos
                  </button>
                </div>

                {/* Days of week selector tabs */}
                <div className="space-y-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Selecione o Dia:</label>
                  <div className="bg-slate-100 p-1.5 rounded-full flex flex-wrap gap-2 shadow-sm border border-slate-200/60 max-w-fit">
                    {[
                      { id: 'seg', label: 'Seg' },
                      { id: 'ter', label: 'Ter' },
                      { id: 'qua', label: 'Qua' },
                      { id: 'qui', label: 'Qui' },
                      { id: 'sex', label: 'Sex' },
                      { id: 'sab', label: 'Sáb' },
                      { id: 'dom', label: 'Dom' }
                    ].map(day => {
                      const isSelected = selectedHoursDay === day.id;
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedHoursDay(day.id)}
                          className={`px-4 py-2 text-center font-bold text-xs rounded-full transition-all duration-300 ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md scale-100'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-white scale-95 hover:scale-100'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-900">Dia Ativo:</span>
                  <button
                    type="button"
                    onClick={() => {
                        const isOpened = editedDays.includes(selectedHoursDay);
                        if (isOpened) setEditedDays(prev => prev.filter(d => d !== selectedHoursDay));
                        else setEditedDays(prev => [...prev, selectedHoursDay]);
                    }}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition ${
                      editedDays.includes(selectedHoursDay)
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-red-50 text-red-600 border-red-200'
                    }`}
                  >
                    {editedDays.includes(selectedHoursDay) ? 'Aberto' : 'Fechado'}
                  </button>
                </div>

                {/* Slots manager */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase">Grade de Vagas:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={newHourInput}
                      onChange={(e) => setNewHourInput(e.target.value)}
                      className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 text-sm flex-grow"
                    />
                    <button
                      type="button"
                      onClick={() => {
                          // ... implementation ...
                      }}
                      className="px-6 bg-blue-600 text-white font-semibold rounded-xl text-sm"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* SERVICES SETUP SECTION (3) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-blue-600" />
                  3. Atendimentos
                </h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                
                <div className="lg:col-span-12 xl:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Novo Atendimento</h5>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!srvName.trim()) return;
                    onAddService({
                      tenantId: activeTenant.id,
                      name: srvName.trim(),
                      price: srvPrice,
                      durationMinutes: srvDuration,
                      category: srvCategory,
                      description: srvDesc.trim() || undefined
                    });
                    setSrvName('');
                    setSrvDesc('');
                    alert(`Serviço "${srvName}" adicionado!`);
                  }} className="space-y-4">
                    
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Nome</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Corte Degrade"
                        value={srvName}
                        onChange={(e) => setSrvName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Preço (R$)</label>
                        <input
                          type="number"
                          required
                          value={srvPrice}
                          onChange={(e) => setSrvPrice(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Duração (Min)</label>
                        <input
                          type="number"
                          required
                          value={srvDuration}
                          onChange={(e) => setSrvDuration(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full text-sm transition"
                    >
                      Cadastrar Serviço
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-12 xl:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Serviços Ativos</h5>
                  
                  <div className="space-y-3 max-h-[385px] overflow-y-auto">
                    {myServices.map(service => (
                      <div
                        key={service.id}
                        className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between text-sm"
                      >
                        <div>
                          <h6 className="font-bold text-slate-900">{service.name}</h6>
                          <p className="text-xs text-slate-500">{service.category}</p>
                        </div>
                        <div className="font-bold text-slate-900">R$ {service.price.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* TEAM AND PROFESSIONALS SECTION (4) */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  4. Equipe
                </h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                
                <div className="lg:col-span-12 xl:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Novo Colaborador</h5>
                  
                  <form onSubmit={handleAddProfessionalSubmit} className="space-y-4">
                    <div className="space-y-1 relative">
                      <label className="text-xs font-semibold text-slate-500 uppercase block">Foto (Opcional)</label>
                      <div className="flex items-center gap-4">
                        <img src={profAvatar} alt="Preview" className="size-16 rounded-2xl border border-slate-200 object-cover" />
                        <input
                           type="file"
                           accept="image/*"
                           onChange={handleAvatarUpload}
                           className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase block">Nome</label>
                      <input
                        type="text"
                        required
                        value={profName}
                        onChange={(e) => setProfName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm"
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                       <label className="text-xs font-semibold text-slate-500 uppercase block">Horários de Atendimento</label>
                       
                       <div className="flex flex-wrap gap-2 mb-3">
                         {['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].map(d => (
                           <button
                             key={d}
                             type="button"
                             onClick={() => setProfSelectedHoursDay(d)}
                             className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${profSelectedHoursDay === d ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                           >
                             {d}
                           </button>
                         ))}
                       </div>
                       
                       <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                         <div className="flex items-center justify-between">
                           <span className="text-xs font-medium text-slate-900">Atenderá na {profSelectedHoursDay}?</span>
                           <button
                             type="button"
                             onClick={() => {
                               const isOpen = profEditedDays.includes(profSelectedHoursDay);
                               if (isOpen) setProfEditedDays(prev => prev.filter(x => x !== profSelectedHoursDay));
                               else setProfEditedDays(prev => [...prev, profSelectedHoursDay]);
                             }}
                             className={`text-xs font-bold px-3 py-1 rounded-full border transition ${
                               profEditedDays.includes(profSelectedHoursDay) ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                             }`}
                           >
                             {profEditedDays.includes(profSelectedHoursDay) ? 'Sim' : 'Não'}
                           </button>
                         </div>
                         
                         {profEditedDays.includes(profSelectedHoursDay) && (
                           <div className="space-y-2 pt-2 border-t border-slate-100">
                             <div className="flex flex-wrap gap-1">
                               {(profEditedHoursByDay[profSelectedHoursDay] || []).map(hour => (
                                 <span key={hour} className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded font-mono font-semibold text-slate-700 flex items-center gap-1">
                                   {hour}
                                   <button type="button" onClick={() => {
                                     setProfEditedHoursByDay(prev => ({
                                       ...prev,
                                       [profSelectedHoursDay]: prev[profSelectedHoursDay].filter(h => h !== hour)
                                     }));
                                   }} className="text-red-500 hover:text-red-700 font-bold ml-1">×</button>
                                 </span>
                               ))}
                             </div>
                             <div className="flex gap-2 pt-2">
                               <input type="time" value={profNewHourInput} onChange={e => setProfNewHourInput(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900"/>
                               <button type="button" onClick={() => {
                                 if (profNewHourInput) {
                                   setProfEditedHoursByDay(prev => ({
                                     ...prev,
                                     [profSelectedHoursDay]: Array.from(new Set([...(prev[profSelectedHoursDay]||[]), profNewHourInput])).sort()
                                   }));
                                   setProfNewHourInput('');
                                 }
                               }} className="px-3 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800">Add</button>
                             </div>
                           </div>
                         )}
                       </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full text-sm transition"
                    >
                      Adicionar Colaborador
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-12 xl:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h5 className="text-xs font-bold text-slate-900 uppercase">Profissionais</h5>
                  
                  <div className="space-y-3">
                    {myProfessionals.map(prof => (
                      <div
                        key={prof.id}
                        className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between gap-4 text-sm shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <img src={prof.avatar} alt={prof.name} className="size-12 rounded-full border border-slate-200 object-cover" />
                          <div>
                            <div className="font-bold text-slate-900">{prof.name}</div>
                            <div className="text-xs text-slate-500 font-medium">{prof.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex flex-wrap justify-end gap-1 max-w-[200px]">
                            {(prof.businessDays || []).map(day => (
                              <span key={day} className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase" title={(prof.businessHoursByDay?.[day] || []).join(', ')}>
                                {day}
                              </span>
                            ))}
                          </div>
                          {(prof.businessDays || []).length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">Horário Padrão do Salão</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

      </div>
    </div>
  );
}
