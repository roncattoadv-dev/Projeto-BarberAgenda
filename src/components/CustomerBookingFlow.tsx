/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Tenant, Service, Professional, Appointment, Customer, WaitlistEntry } from '../types';
import {
  Calendar,
  Users,
  Clock,
  ArrowLeft,
  ArrowRight,
  Phone,
  Instagram,
  MapPin,
  History,
  Star,
  ChevronLeft,
  ChevronRight,
  Globe,
  Share2,
  Scissors,
  CheckCircle
} from 'lucide-react';

interface CustomerBookingFlowProps {
  activeTenant: Tenant;
  services: Service[];
  professionals: Professional[];
  appointments: Appointment[];
  customers: Customer[];
  onAddAppointment: (appt: Omit<Appointment, 'id'>) => Promise<Appointment>;
  onUpdateAppointmentStatus: (apptId: string, status: Appointment['status']) => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onRegisterReview: (stars: number, comment: string, apptId: string) => void;
  onGetOccupiedSlots?: (professionalId: string, date: string) => Promise<{time: string; duration: number}[]>;
  onAddWaitlistEntry?: (e: Pick<WaitlistEntry, 'tenantId' | 'customerName' | 'customerPhone' | 'date' | 'professionalId' | 'timePreference'>) => Promise<void>;
}

export default function CustomerBookingFlow({
  activeTenant,
  services,
  professionals,
  appointments,
  customers,
  onAddAppointment,
  onUpdateAppointmentStatus,
  onAddCustomer,
  onRegisterReview,
  onGetOccupiedSlots,
  onAddWaitlistEntry,
}: CustomerBookingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [activeTab, setActiveTab] = useState<'booking' | 'history'>('booking');

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  });
  const [selectedTime, setSelectedTime] = useState('');

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  // Client account login/identification states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Completed booking tracker
  const [recentBookedId, setRecentBookedId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Client dynamic filter for History tracking
  const [historySearchPhone, setHistorySearchPhone] = useState('');
  const [searchedHistory, setSearchedHistory] = useState<Appointment[] | null>(null);

  // Review states
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingApptId, setReviewingApptId] = useState<string | null>(null);

  // Lista de espera
  const [showWlForm,   setShowWlForm]   = useState(false);
  const [wlName,       setWlName]       = useState('');
  const [wlPhone,      setWlPhone]      = useState('');
  const [wlTimePref,   setWlTimePref]   = useState<string[]>([]); // [] = qualquer
  const [wlProfPref,   setWlProfPref]   = useState<string | null>(null);
  const [wlSaving,     setWlSaving]     = useState(false);
  const [wlDone,       setWlDone]       = useState(false);

  // Occupied slots fetched from DB (authoritative source)
  const [occupiedSlots, setOccupiedSlots] = useState<{time: string; duration: number}[]>([]);
  useEffect(() => {
    if (!selectedProfId || !selectedDate || !onGetOccupiedSlots) {
      setOccupiedSlots([]);
      return;
    }
    onGetOccupiedSlots(selectedProfId, selectedDate).then(setOccupiedSlots).catch(() => setOccupiedSlots([]));
  }, [selectedProfId, selectedDate]);

  // Filters
  const myServices = services.filter(s => s.tenantId === activeTenant.id);
  const myProfessionals = professionals.filter(p => p.tenantId === activeTenant.id);
  const myAppointments = appointments.filter(a => a.tenantId === activeTenant.id);

  const selectedService = myServices.find(s => s.id === selectedServiceId);
  const selectedProfessional = myProfessionals.find(p => p.id === selectedProfId);
  const assignedToService = selectedServiceId
    ? myProfessionals.filter(p => p.services.includes(selectedServiceId))
    : [];
  const professionalsForService = selectedServiceId && assignedToService.length > 0
    ? assignedToService
    : myProfessionals;

  // Get the selected date's day of the week
  const getWeekdayKeyFromDate = (dateStr: string) => {
    if (!dateStr) return 'seg';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'seg';
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay();
    const WEEKDAYS_MAP = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return WEEKDAYS_MAP[dayOfWeek] || 'seg';
  };

  const selectedWeekdayKey = getWeekdayKeyFromDate(selectedDate);

  // Use custom operational hours if configured for this day of week, priority to selected professional, fallback to tenant
  const HOURLY_SLOTS = (selectedProfessional?.businessHoursByDay?.[selectedWeekdayKey]?.length ?? 0) > 0
    ? selectedProfessional!.businessHoursByDay![selectedWeekdayKey]
    : (activeTenant.businessHoursByDay?.[selectedWeekdayKey]?.length ?? 0) > 0
    ? activeTenant.businessHoursByDay![selectedWeekdayKey]
    : activeTenant.businessHours && activeTenant.businessHours.length > 0
    ? activeTenant.businessHours
    : [
      '09:40',
      '10:20',
      '11:00',
      '13:30',
      '14:10',
      '14:50',
      '15:30',
      '16:10',
      '16:50',
      '17:30',
      '18:10'
    ];

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const newDur = selectedService?.durationMinutes ?? 60;

  const checkSlotOccupied = (timeSlot: string) => {
    const slotStart = toMin(timeSlot);
    const slotEnd   = slotStart + newDur;
    if (onGetOccupiedSlots) {
      return occupiedSlots.some(a => {
        const aStart = toMin(a.time);
        const aEnd   = aStart + (a.duration ?? 60);
        return slotStart < aEnd && slotEnd > aStart;
      });
    }
    return myAppointments.some(appt => {
      if (appt.date !== selectedDate || appt.professionalId !== selectedProfId || appt.status === 'cancelled') return false;
      const aStart = toMin(appt.time);
      const aEnd   = aStart + (appt.durationMinutes ?? 60);
      return slotStart < aEnd && slotEnd > aStart;
    });
  };

  const getInitials = (name: string) => {
    const clean = name.replace(/barbearia|salao|studio|estetica/gi, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return (clean.substring(0, 2) || 'BR').toUpperCase();
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0, Sunday is 6
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setSelectedTime('');
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    setSelectedDate(`${viewYear}-${formattedMonth}-${formattedDay}`);
    setSelectedTime('');
  };

  const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatPTBRDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const dateObj = new Date(year, month, day);
    const dayNum = dateObj.getDate();
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const yearNum = dateObj.getFullYear();

    return `${dayNum} de ${monthName} de ${yearNum}`;
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlName.trim() || !wlPhone.trim() || !onAddWaitlistEntry) return;
    setWlSaving(true);
    try {
      await onAddWaitlistEntry({
        tenantId: activeTenant.id,
        customerName: wlName.trim(),
        customerPhone: wlPhone.trim(),
        date: selectedDate,
        professionalId: wlProfPref,
        timePreference: wlTimePref.length === 0 ? 'qualquer' : wlTimePref.join(','),
      });
      setWlDone(true);
      setShowWlForm(false);
    } catch {}
    setWlSaving(false);
  };

  const handleFormSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!clientName.trim() || !clientPhone.trim()) return;
    if (!selectedService || !selectedProfessional || !selectedTime) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Check / Add Customer records — identifica por phone + name (mesmo número, nomes diferentes = clientes distintos)
      let matchedCustomer = customers.find(c =>
        c.tenantId === activeTenant.id &&
        c.phone === clientPhone.trim() &&
        c.name.toLowerCase() === clientName.trim().toLowerCase()
      );

      if (!matchedCustomer) {
        onAddCustomer({
          tenantId: activeTenant.id,
          name: clientName.trim(),
          email: clientEmail.trim() || `${clientName.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}@gmail.com`,
          phone: clientPhone.trim()
        });
        matchedCustomer = {
          id: `cust-gen-${Date.now()}`,
          tenantId: activeTenant.id,
          name: clientName.trim(),
          phone: clientPhone.trim(),
          email: clientEmail.trim() || `${clientName.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}@gmail.com`
        };
      }

      // Alphanumeric booking code like '231NW1E5'
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let randCode = '';
      for (let i = 0; i < 8; i++) randCode += chars.charAt(Math.floor(Math.random() * chars.length));
      setBookingCode(randCode);

      const created = await onAddAppointment({
        tenantId: activeTenant.id,
        serviceId: selectedServiceId,
        professionalId: selectedProfId,
        customerId: matchedCustomer.id,
        customerName: matchedCustomer.name,
        customerPhone: matchedCustomer.phone,
        customerEmail: clientEmail.trim() || undefined,
        date: selectedDate,
        time: selectedTime,
        durationMinutes: selectedService.durationMinutes,
        price: selectedService.price,
        status: 'confirmed'
      });

      setOccupiedSlots(prev => [...prev, { time: selectedTime, duration: selectedService?.durationMinutes ?? 60 }]);
      setRecentBookedId(created.id);
      setStep(5);
    } catch (err: any) {
      setSubmitError(err?.message || 'Erro ao confirmar agendamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!historySearchPhone.trim()) return;
    const records = appointments.filter(a =>
      a.customerPhone.replace(/\s/g, '').includes(historySearchPhone.trim().replace(/\s/g, ''))
    );
    setSearchedHistory(records);
  };

  const handleCancelMyAppointment = (apptId: string) => {
    onUpdateAppointmentStatus(apptId, 'cancelled');
    alert("Seu agendamento foi cancelado com sucesso. A vaga está liberada novamente.");
    if (searchedHistory) {
      setSearchedHistory(prev => prev ? prev.map(a => a.id === apptId ? { ...a, status: 'cancelled' } : a) : null);
    }
  };

  const handleAddReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingApptId) return;

    onRegisterReview(reviewStars, reviewComment, reviewingApptId);
    setReviewingApptId(null);
    setReviewComment('');
    alert("Agradecemos muito seu feedback! Sua avaliação foi registrada na equipe.");
  };

  // Rendering of calendar days array
  const offset = getFirstDayOffset(viewYear, viewMonth);
  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const daysArray: (number | null)[] = [];
  for (let i = 0; i < offset; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(d);
  }

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  })();

  const checkSlotPast = (timeSlot: string) => {
    if (selectedDate !== todayStr) return false;
    const now = new Date();
    return toMin(timeSlot) <= now.getHours() * 60 + now.getMinutes();
  };

  const allSlotsOccupied = step === 3 && HOURLY_SLOTS.length > 0 && HOURLY_SLOTS.every(t => checkSlotOccupied(t) || checkSlotPast(t));

  // Horários ocupados E futuros (para lista de espera)
  const occupiedFutureSlots = step === 3 ? HOURLY_SLOTS.filter(t => checkSlotOccupied(t) && !checkSlotPast(t)) : [];

  // Verifica se todos os slots de hoje já passaram (independente de selectedDate)
  const allTodaySlotsArePast = (() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return HOURLY_SLOTS.length > 0 && HOURLY_SLOTS.every(t => toMin(t) <= nowMin);
  })();

  // Auto-avança para amanhã se hoje estiver completamente no passado
  useEffect(() => {
    if (selectedDate !== todayStr || !allTodaySlotsArePast) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
    setViewYear(tomorrow.getFullYear());
    setViewMonth(tomorrow.getMonth());
    setSelectedTime('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset waitlist form when date/prof changes
  useEffect(() => { setShowWlForm(false); setWlDone(false); setWlName(''); setWlPhone(''); setWlTimePref([]); }, [selectedDate, selectedProfId]);

  /* ── dynamic theme from bookingPageConfig ── */
  const pc = activeTenant.bookingPageConfig?.primaryColor ?? '#2563eb';
  const cfg = activeTenant.bookingPageConfig;
  const hexRgba = (hex: string, a: number) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const pcLight  = hexRgba(pc, 0.08);
  const pcBorder = hexRgba(pc, 0.28);

  /* ── hook: detecta tela ≥768px ── */
  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  React.useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  /* ── helpers ── */
  const avBg = pc.replace('#', '');
  const av = (n: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=${avBg}&color=fff&size=128`;

  const WEEKDAYS_MAP = ['dom','seg','ter','qua','qui','sex','sab'];

  /* ── sidebar info (steps 2-4) ── */
  const SidebarInfo = () => (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={() => setStep(s => (s - 1) as any)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, color: pc, fontWeight: 700, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div>
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}>{activeTenant.name}</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>{selectedService?.name}</h2>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {selectedProfessional && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              <img src={selectedProfessional.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = av(selectedProfessional!.name); }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{selectedProfessional.name}</span>
          </div>
        )}
        {selectedService && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12 }}>
            <Clock size={14} style={{ flexShrink: 0 }} /> {selectedService.durationMinutes} min
          </div>
        )}
        {selectedService && selectedService.price > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>R$</span> R$ {selectedService.price.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );

  /* ── compact mobile top bar ── */
  const TopBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <button onClick={() => setStep(s => (s - 1) as any)}
        style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0', color: pc, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <ArrowLeft size={16} />
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTenant.name}</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedService?.name}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {selectedProfessional && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
              <img src={selectedProfessional.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = av(selectedProfessional!.name); }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#334155', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedProfessional.name}</span>
          </div>
        )}
        {selectedService && selectedService.price > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: pc, background: pcLight, border: `1px solid ${pcBorder}`, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            R$ {selectedService.price.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     RETURN
  ═══════════════════════════════════════════════════════════════ */
  // Primeira página (seleção de serviço) sem moldura — só logo/infos/botões
  // soltos sobre o fundo da página. Demais passos mantêm o card branco.
  const isLandingStep = activeTab === 'booking' && step === 1;
  return (
    <div style={{
      width: '100%', maxWidth: 1060, margin: '0 auto', borderRadius: 12, fontFamily: 'inherit', overflow: 'hidden',
      background: isLandingStep ? 'transparent' : '#fff',
      boxShadow: isLandingStep ? 'none' : '0 10px 30px rgba(0,0,0,0.15)',
      border: isLandingStep ? 'none' : '1px solid #e2e8f0',
    }}>

      {/* ══ Steps 2 / 3 / 4 ══ */}
      {activeTab === 'booking' && step > 1 && step < 5 && (isDesktop ? (
        /* ── DESKTOP: flex row ── */
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ width: 280, background: '#f8fafc', borderRight: '1px solid #e2e8f0', flexShrink: 0, borderRadius: '12px 0 0 12px' }}>
            <SidebarInfo />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>{/* desktop step content below */}

            {/* Step 2: professionals */}
            {step === 2 && (
              <div style={{ padding: '24px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 20, margin: '0 0 20px' }}>
                  Selecione o profissional
                </h3>
                {professionalsForService.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    Nenhum profissional disponível para este serviço.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
                    {professionalsForService.map(prof => (
                      <button key={prof.id}
                        onClick={() => { setSelectedProfId(prof.id); setStep(3); }}
                        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', transition: 'all 120ms', gap: 8 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = pc; (e.currentTarget as HTMLElement).style.borderColor = pc; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid #f1f5f9', flexShrink: 0 }}>
                          <img src={prof.avatar} alt={prof.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).src = av(prof.name); }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{prof.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{prof.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: calendar */}
            {step === 3 && (
              <div style={{ padding: '30px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', textTransform: 'capitalize' }}>
                    {MONTH_NAMES_PT[viewMonth].toLowerCase()} {viewYear}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={handleGoToToday} style={{ color: pc, fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Hoje</button>
                    <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: pc, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>&#8249;</button>
                    <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: pc, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>&#8250;</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 10 }}>
                  {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', paddingBottom: 14 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 6 }}>
                  {daysArray.map((day, idx) => {
                    if (!day) return <div key={`e-${idx}`} style={{ height: 36 }} />;
                    const dow = new Date(viewYear, viewMonth, day).getDay();
                    const isClosed = selectedProfessional?.businessDays?.length
                      ? !selectedProfessional.businessDays.includes(WEEKDAYS_MAP[dow])
                      : activeTenant.businessDays?.length
                      ? !activeTenant.businessDays.includes(WEEKDAYS_MAP[dow])
                      : false;
                    const dk = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isPast = dk < todayStr || (dk === todayStr && allTodaySlotsArePast);
                    const isBlocked = (activeTenant.blockedDates ?? []).includes(dk) || (selectedProfessional?.blockedDates ?? []).includes(dk);
                    const ps = selectedDate.split('-');
                    const isSel = ps.length === 3 && +ps[0] === viewYear && +ps[1]-1 === viewMonth && +ps[2] === day;
                    const cellD: React.CSSProperties = { width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 13, fontFamily: 'monospace', border: 'none', margin: '0 auto' };
                    if (isPast) return <div key={dk} style={{ ...cellD }}><span style={{ color: '#9fa7b3' }}>{day}</span></div>;
                    if (isClosed) return <div key={dk} style={{ ...cellD, cursor: 'not-allowed' }}><span style={{ textDecoration: 'line-through', color: '#9fa7b3' }}>{day}</span></div>;
                    if (isBlocked) return <div key={dk} style={{ ...cellD, cursor: 'not-allowed' }}><span style={{ textDecoration: 'line-through', color: '#fca5a5' }}>{day}</span></div>;
                    return (
                      <button key={dk} onClick={() => handleSelectDay(day)} type="button"
                        style={{ ...cellD, background: isSel ? pc : 'transparent', color: isSel ? '#fff' : '#1e293b', fontWeight: isSel ? 700 : 600, cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                        onMouseOut={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4: client info */}
            {step === 4 && (
              <div style={{ padding: '24px 20px', maxWidth: 480 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Suas informações</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontWeight: 600 }}>
                  <Calendar size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  {formatPTBRDate(selectedDate)} às {selectedTime}
                </div>
                <form onSubmit={handleFormSubmission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Seu nome *</label>
                    <input type="text" required placeholder="Seu nome" value={clientName} onChange={e => setClientName(e.target.value)}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Telefone *</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', background: '#f8fafc', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🇧🇷</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0', paddingRight: 10 }}>+55</span>
                      <input type="tel" required placeholder="(11) 99999-8888" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Email (opcional)</label>
                    <input type="email" placeholder="seuemail@exemplo.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  {submitError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>{submitError}</div>
                  )}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <button type="button" onClick={() => setStep(3)} style={{ color: '#64748b', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Voltar</button>
                    <button type="submit" disabled={submitting} style={{ padding: '10px 24px', background: submitting ? '#93C5FD' : pc, color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 12, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                      {submitting ? 'Confirmando…' : 'Concluir agendamento'}
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>{/* end desktop step content */}
          {step === 3 && (
            <div style={{ width: 280, borderLeft: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '30px 24px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20, margin: '0 0 20px' }}>
                {selectedDate
                  ? `${parseInt(selectedDate.split('-')[2])} de ${MONTH_NAMES_PT[parseInt(selectedDate.split('-')[1])-1].toLowerCase()}`
                  : '—'}
              </h2>
              {selectedProfessional && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Exibindo horários para:</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#1e293b', fontWeight: 500 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                      <img src={selectedProfessional.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = av(selectedProfessional!.name); }} />
                    </div>
                    {selectedProfessional.name}
                  </div>
                  {myProfessionals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => { setStep(2); setSelectedTime(''); }}
                      style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: pc, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      Trocar profissional
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16, flex: 1 }}>
                {HOURLY_SLOTS.map(time => {
                  const occ = checkSlotOccupied(time) || checkSlotPast(time);
                  const sel = selectedTime === time;
                  if (occ) return (
                    <div key={time} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', color: '#9fa7b3', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textDecoration: 'line-through', userSelect: 'none' }}>{time}</div>
                  );
                  return (
                    <button key={time} onClick={() => setSelectedTime(time)}
                      style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, borderRadius: 8, border: sel ? 'none' : `1px solid ${pcBorder}`, background: sel ? pc : '#fff', color: sel ? '#fff' : pc, cursor: 'pointer', transition: 'all 120ms' }}>
                      {time}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(4)} disabled={!selectedTime}
                style={{ width: '100%', padding: '12px 0', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 8, border: 'none', cursor: selectedTime ? 'pointer' : 'not-allowed', opacity: selectedTime ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Continuar <ArrowRight size={16} />
              </button>

              {/* ── Lista de espera (desktop) ── */}
              {onAddWaitlistEntry && !wlDone && occupiedFutureSlots.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {allSlotsOccupied ? (
                    /* Dia lotado — destaque total */
                    <div style={{ padding: '14px 16px', background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 12 }}>
                      <p style={{ fontSize: 12, color: '#92400E', margin: '0 0 10px', fontWeight: 700 }}>
                        😔 Nenhum horário disponível neste dia.
                      </p>
                      {!showWlForm ? (
                        <button onClick={() => { setWlProfPref(selectedProfId || null); setShowWlForm(true); }}
                          style={{ width: '100%', padding: '10px', background: pc, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Entrar na lista de espera →
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    /* Dia com slots — link discreto */
                    !showWlForm && (
                      <button onClick={() => { setWlProfPref(selectedProfId || null); setShowWlForm(true); }}
                        style={{ width: '100%', padding: '8px', background: 'transparent', color: '#94a3b8', fontWeight: 500, fontSize: 11, border: '1px dashed #cbd5e1', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Horário já está ocupado? Entrar na lista de espera.
                      </button>
                    )
                  )}

                  {showWlForm && (
                    <div style={{ padding: '14px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                      <p style={{ fontSize: 12, color: '#475569', margin: '0 0 10px', fontWeight: 600 }}>Lista de espera — te avisamos via WhatsApp se abrir uma vaga.</p>
                      <form onSubmit={handleWaitlistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input required placeholder="Seu nome *" value={wlName} onChange={e => setWlName(e.target.value)}
                          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }} />
                        <input required placeholder="Telefone (WhatsApp) * — ex: (xx)00000-0000" value={wlPhone} onChange={e => setWlPhone(e.target.value)}
                          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }} />
                        {(() => {
                          const occupiedFuture = occupiedFutureSlots;
                          return (
                            <div style={{ border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
                              {/* Qualquer */}
                              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer', padding: '8px 10px', fontWeight: wlTimePref.length === 0 ? 700 : 500, background: wlTimePref.length === 0 ? '#EFF6FF' : 'transparent' }}>
                                <input type="checkbox" checked={wlTimePref.length === 0} onChange={() => setWlTimePref([])} style={{ accentColor: pc, cursor: 'pointer', flexShrink: 0 }} />
                                Qualquer horário que cancelar
                              </label>
                              {occupiedFuture.length > 0 && (
                                <div style={{ borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column' as const }}>
                                  {occupiedFuture.map(t => (
                                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', padding: '6px 10px', background: wlTimePref.includes(t) ? '#EFF6FF' : 'transparent', color: wlTimePref.includes(t) ? pc : '#374151', fontWeight: wlTimePref.includes(t) ? 700 : 400, borderTop: '1px solid #F1F5F9' }}>
                                      <input type="checkbox" checked={wlTimePref.includes(t)} onChange={() => setWlTimePref(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} style={{ accentColor: pc, cursor: 'pointer', flexShrink: 0 }} />
                                      {t} — ocupado
                                    </label>
                                  ))}
                                </div>
                              )}
                              {wlTimePref.length > 0 && (
                                <p style={{ fontSize: 10, color: '#6B7280', margin: 0, padding: '6px 10px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                                  {wlTimePref.length} horário{wlTimePref.length > 1 ? 's' : ''} selecionado{wlTimePref.length > 1 ? 's' : ''} · Aviso se algum deles cancelar.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => setShowWlForm(false)}
                            style={{ flex: 1, padding: '9px', background: '#F1F5F9', color: '#6B7280', fontWeight: 600, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancelar
                          </button>
                          <button type="submit" disabled={wlSaving}
                            style={{ flex: 2, padding: '9px', background: pc, color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8, cursor: wlSaving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: wlSaving ? 0.7 : 1 }}>
                            {wlSaving ? 'Salvando…' : 'Confirmar lista de espera'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
              {onAddWaitlistEntry && wlDone && (
                <div style={{ marginTop: 12, padding: '14px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 22, margin: '0 0 6px' }}>✅</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#166534', margin: '0 0 4px' }}>Você está na lista!</p>
                  <p style={{ fontSize: 12, color: '#15803D', margin: 0 }}>Avisaremos via WhatsApp se uma vaga aparecer neste dia.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── MOBILE: pure block, sem flex wrapper ── */
        <div>
          <TopBar />
          {step === 2 && (
            <div style={{ padding: '24px 20px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 20, margin: '0 0 20px' }}>
                Selecione o profissional
              </h3>
              {myProfessionals.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Nenhum profissional disponível no momento.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {myProfessionals.map(prof => (
                    <button key={prof.id}
                      onClick={() => { setSelectedProfId(prof.id); setStep(3); }}
                      style={{ background: '#fff', border: '2px solid #e2e8f0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', gap: 8, width: '100%' }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid #dbeafe', flexShrink: 0 }}>
                        <img src={prof.avatar} alt={prof.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).src = av(prof.name); }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{prof.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{prof.role}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div style={{ padding: '20px' }}>
              {/* Calendar */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', textTransform: 'capitalize' }}>{MONTH_NAMES_PT[viewMonth].toLowerCase()} {viewYear}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={handleGoToToday} style={{ color: pc, fontWeight: 600, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Hoje</button>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: pc, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>&#8249;</button>
                      <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: pc, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>&#8250;</button>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
                  {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', paddingBottom: 10 }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
                  {daysArray.map((day, idx) => {
                    if (!day) return <div key={`e-${idx}`} style={{ height: 34 }} />;
                    const dow = new Date(viewYear, viewMonth, day).getDay();
                    const isClosed = selectedProfessional?.businessDays?.length ? !selectedProfessional.businessDays.includes(WEEKDAYS_MAP[dow]) : activeTenant.businessDays?.length ? !activeTenant.businessDays.includes(WEEKDAYS_MAP[dow]) : false;
                    const dk = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isPast = dk < todayStr || (dk === todayStr && allTodaySlotsArePast);
                    const isBlocked = (activeTenant.blockedDates ?? []).includes(dk) || (selectedProfessional?.blockedDates ?? []).includes(dk);
                    const ps = selectedDate.split('-');
                    const isSel = ps.length === 3 && +ps[0] === viewYear && +ps[1]-1 === viewMonth && +ps[2] === day;
                    const cellM: React.CSSProperties = { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 12, fontFamily: 'monospace', border: 'none', margin: '0 auto' };
                    if (isPast) return <div key={dk} style={{ ...cellM }}><span style={{ color: '#9fa7b3' }}>{day}</span></div>;
                    if (isClosed) return <div key={dk} style={{ ...cellM, cursor: 'not-allowed' }}><span style={{ textDecoration: 'line-through', color: '#9fa7b3' }}>{day}</span></div>;
                    if (isBlocked) return <div key={dk} style={{ ...cellM, cursor: 'not-allowed' }}><span style={{ textDecoration: 'line-through', color: '#fca5a5' }}>{day}</span></div>;
                    return <button key={dk} onClick={() => handleSelectDay(day)} type="button" style={{ ...cellM, background: isSel ? pc : 'transparent', color: isSel ? '#fff' : '#1e293b', fontWeight: isSel ? 700 : 600, cursor: 'pointer' }}>{day}</button>;
                  })}
                </div>
              </div>
              {/* Time slots */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{selectedDate ? selectedDate.split('-').reverse().join('/') : '—'}</p>
                  {selectedProfessional && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid #e2e8f0', flexShrink: 0 }}><img src={selectedProfessional.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).src = av(selectedProfessional!.name); }} /></div>
                        {selectedProfessional.name}
                      </div>
                      {myProfessionals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { setStep(2); setSelectedTime(''); }}
                          style={{ fontSize: 11, fontWeight: 600, color: pc, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
                        >
                          Trocar
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {HOURLY_SLOTS.map(time => {
                    const occ = checkSlotOccupied(time) || checkSlotPast(time); const sel = selectedTime === time;
                    if (occ) return <div key={time} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', color: '#cbd5e1', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', textDecoration: 'line-through' }}>{time}</div>;
                    return <button key={time} onClick={() => setSelectedTime(time)} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, borderRadius: 10, border: sel ? 'none' : `1px solid ${pcBorder}`, background: sel ? pc : '#fff', color: sel ? '#fff' : pc, cursor: 'pointer' }}>{time}</button>;
                  })}
                </div>
                <button onClick={() => setStep(4)} disabled={!selectedTime} style={{ width: '100%', padding: '12px 0', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: selectedTime ? 'pointer' : 'not-allowed', opacity: selectedTime ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  Continuar <ArrowRight size={16} />
                </button>

                {/* ── Lista de espera (mobile) ── */}
                {onAddWaitlistEntry && !wlDone && occupiedFutureSlots.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {allSlotsOccupied ? (
                      <div style={{ padding: '14px 16px', background: '#FEF9C3', border: '1px solid #FCD34D', borderRadius: 12 }}>
                        <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 10px', fontWeight: 700 }}>
                          😔 Nenhum horário disponível neste dia.
                        </p>
                        {!showWlForm && (
                          <button onClick={() => { setWlProfPref(selectedProfId || null); setShowWlForm(true); }}
                            style={{ width: '100%', padding: '11px', background: pc, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Entrar na lista de espera →
                          </button>
                        )}
                      </div>
                    ) : (
                      !showWlForm && (
                        <button onClick={() => { setWlProfPref(selectedProfId || null); setShowWlForm(true); }}
                          style={{ width: '100%', padding: '9px', background: 'transparent', color: '#94a3b8', fontWeight: 500, fontSize: 12, border: '1px dashed #cbd5e1', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Horário já está ocupado? Entrar na lista de espera.
                        </button>
                      )
                    )}
                    {showWlForm && (
                      <div style={{ padding: '14px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12 }}>
                        <p style={{ fontSize: 12, color: '#475569', margin: '0 0 10px', fontWeight: 600 }}>Lista de espera — te avisamos via WhatsApp se abrir uma vaga.</p>
                        <form onSubmit={handleWaitlistSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                          <input required placeholder="Seu nome *" value={wlName} onChange={e => setWlName(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }} />
                          <input required placeholder="Telefone (WhatsApp) * — ex: (xx)00000-0000" value={wlPhone} onChange={e => setWlPhone(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const }} />
                          {(() => {
                            const occupiedFuture = HOURLY_SLOTS.filter(t => checkSlotOccupied(t) && !checkSlotPast(t));
                            return (
                              <div style={{ border: '1px solid #D1D5DB', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', padding: '10px 12px', fontWeight: wlTimePref.length === 0 ? 700 : 500, background: wlTimePref.length === 0 ? '#EFF6FF' : 'transparent' }}>
                                  <input type="checkbox" checked={wlTimePref.length === 0} onChange={() => setWlTimePref([])} style={{ accentColor: pc, cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }} />
                                  Qualquer horário que cancelar
                                </label>
                                {occupiedFuture.length > 0 && (
                                  <div style={{ borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column' as const }}>
                                    {occupiedFuture.map(t => (
                                      <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: 'monospace', cursor: 'pointer', padding: '9px 12px', background: wlTimePref.includes(t) ? '#EFF6FF' : 'transparent', color: wlTimePref.includes(t) ? pc : '#374151', fontWeight: wlTimePref.includes(t) ? 700 : 400, borderTop: '1px solid #F1F5F9' }}>
                                        <input type="checkbox" checked={wlTimePref.includes(t)} onChange={() => setWlTimePref(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} style={{ accentColor: pc, cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }} />
                                        {t} — ocupado
                                      </label>
                                    ))}
                                  </div>
                                )}
                                {wlTimePref.length > 0 && (
                                  <p style={{ fontSize: 11, color: '#6B7280', margin: 0, padding: '7px 12px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                                    {wlTimePref.length} horário{wlTimePref.length > 1 ? 's' : ''} selecionado{wlTimePref.length > 1 ? 's' : ''} · Aviso se algum deles cancelar.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setShowWlForm(false)}
                              style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#6B7280', fontWeight: 600, fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancelar
                            </button>
                            <button type="submit" disabled={wlSaving}
                              style={{ flex: 2, padding: '10px', background: pc, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: wlSaving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: wlSaving ? 0.7 : 1 }}>
                              {wlSaving ? 'Salvando…' : 'Entrar na lista'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
                {onAddWaitlistEntry && wlDone && (
                  <div style={{ marginTop: 12, padding: '16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ fontSize: 24, margin: '0 0 6px' }}>✅</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#166534', margin: '0 0 4px' }}>Você está na lista!</p>
                    <p style={{ fontSize: 12, color: '#15803D', margin: 0 }}>Avisaremos via WhatsApp se uma vaga aparecer neste dia.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 4 && (
            <div style={{ padding: '24px 20px' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Suas informações</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', marginBottom: 20, fontWeight: 600 }}>
                <Calendar size={14} style={{ color: '#94a3b8', flexShrink: 0 }} /> {formatPTBRDate(selectedDate)} às {selectedTime}
              </div>
              <form onSubmit={handleFormSubmission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Seu nome *</label>
                  <input type="text" required placeholder="Seu nome" value={clientName} onChange={e => setClientName(e.target.value)}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Telefone *</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', background: '#f8fafc', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>🇧🇷</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0', paddingRight: 10 }}>+55</span>
                    <input type="tel" required placeholder="(11) 99999-8888" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Email (opcional)</label>
                  <input type="email" placeholder="seuemail@exemplo.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                {submitError && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>{submitError}</div>
                )}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <button type="button" onClick={() => setStep(3)} style={{ color: '#64748b', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Voltar</button>
                  <button type="submit" disabled={submitting} style={{ padding: '10px 24px', background: submitting ? '#93C5FD' : pc, color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 12, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                    {submitting ? 'Confirmando…' : 'Concluir agendamento'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ))}

      {/* ══ Step 1 / 5 / History ══ */}
      {(activeTab === 'booking' && (step === 1 || step === 5)) || activeTab === 'history' ? (
        <div style={{ padding: 0 }}>

          {/* Step 1: select service */}
          {activeTab === 'booking' && step === 1 && (
            <div style={{ maxWidth: 420, margin: '0 auto', padding: isDesktop ? '32px 20px' : '24px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {(activeTenant.logo?.startsWith('http') || activeTenant.logo?.startsWith('data:'))
                ? <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', marginBottom: 28, border: `2px solid ${pcBorder}`, flexShrink: 0 }}>
                    <img src={activeTenant.logo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                : <div style={{ width: 112, height: 112, borderRadius: '50%', border: `2px solid ${pc}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 28, background: '#fff', position: 'relative', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 8, right: 8, transform: 'rotate(45deg)', color: pc, fontSize: 14 }}>✂</span>
                    <span style={{ fontSize: 36, fontWeight: 300, color: pc, lineHeight: 1 }}>{getInitials(activeTenant.name)}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: pc, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6, textAlign: 'center', maxWidth: 90, lineHeight: 1.3 }}>
                      {activeTenant.name.replace(/barbearia|salao|studio|estetica/gi,'').trim()}
                    </span>
                  </div>
              }
              {(cfg?.showPhone || cfg?.showAddress || cfg?.showInstagram) && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {cfg?.showPhone && activeTenant.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                      <Phone size={12} style={{ color: pc, flexShrink: 0 }} />
                      <span>{activeTenant.phone}</span>
                    </div>
                  )}
                  {cfg?.showAddress && activeTenant.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                      <MapPin size={12} style={{ color: pc, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTenant.address}</span>
                    </div>
                  )}
                  {cfg?.showInstagram && activeTenant.instagram && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', background: '#f8fafc', borderRadius: 10, padding: '7px 12px', border: '1px solid #f1f5f9' }}>
                      <Instagram size={12} style={{ color: pc, flexShrink: 0 }} />
                      <span>{activeTenant.instagram}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myServices.map(srv => (
                  <button key={srv.id} onClick={() => { setSelectedServiceId(srv.id); setSelectedProfId(''); setStep(2); }}
                    style={{ width: '100%', padding: isDesktop ? '14px 20px' : '16px 18px', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: isDesktop ? 16 : 10, border: `1px solid ${pc}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                    <span>{srv.name}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {srv.durationMinutes} min ▶
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: success */}
          {activeTab === 'booking' && step === 5 && (
            <div style={{ maxWidth: 380, margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
              <button onClick={() => { navigator.clipboard.writeText(`${activeTenant.name}: ${selectedService?.name} dia ${selectedDate} às ${selectedTime}. Código: ${bookingCode}`); alert('Copiado!'); }}
                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <Share2 size={18} />
              </button>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, marginBottom: 16 }}>✓</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Detalhes do agendamento</h3>
              <div style={{ width: '100%', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, textAlign: 'left', marginBottom: 20 }}>
                {[
                  ['Quando',       `${formatPTBRDate(selectedDate)} às ${selectedTime}`],
                  ['O que',        selectedService?.name ?? '—'],
                  ['Duração',      `${selectedService?.durationMinutes ?? 0} min`],
                  ['Profissional', selectedProfessional?.name ?? '—'],
                  ['Status',       'Confirmado'],
                  ['Código',       bookingCode || '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 2 }}>{label}</span>
                    <strong style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{value}</strong>
                  </div>
                ))}
              </div>
              {/* Botão primário: Novo agendamento */}
              <button onClick={() => { setRecentBookedId(null); setSelectedServiceId(''); setSelectedProfId(''); setSelectedTime(''); setStep(1); }}
                style={{ width: '100%', padding: '13px', background: pc, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                + Fazer novo agendamento
              </button>

              {/* Botão secundário: Como chegar */}
              {activeTenant.bookingPageConfig?.mapsUrl && (
                <a href={activeTenant.bookingPageConfig.mapsUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '12px', background: '#fff', border: `1.5px solid ${pcBorder}`, borderRadius: 12, color: pc, fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 10, boxSizing: 'border-box' as const }}>
                  <MapPin size={14} /> Como chegar
                </a>
              )}

              {/* Botão perigo: Cancelar */}
              <button onClick={async () => {
                if (!recentBookedId || !confirm('Tem certeza que deseja cancelar este agendamento?')) return;
                try {
                  await onUpdateAppointmentStatus(recentBookedId, 'cancelled');
                  alert('Agendamento cancelado.');
                  setStep(1);
                } catch {
                  alert('Não foi possível cancelar. Entre em contato com a barbearia.');
                }
              }}
                style={{ width: '100%', padding: '11px', background: '#FEF2F2', color: '#EF4444', fontWeight: 600, fontSize: 13, border: '1.5px solid #FECACA', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ✕ Cancelar agendamento
              </button>
            </div>
          )}

          {/* History */}
          {activeTab === 'history' && (
            <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
                <button onClick={() => setActiveTab('booking')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: pc, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ArrowLeft size={14} /> Voltar
                </button>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Meus agendamentos</h3>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Digite seu telefone para ver seu histórico.</p>
              <form onSubmit={handleSearchHistory} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', background: '#f8fafc', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🇧🇷</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', borderRight: '1px solid #e2e8f0', paddingRight: 10 }}>+55</span>
                  <input type="tel" required placeholder="(11) 99999-8888" value={historySearchPhone} onChange={e => setHistorySearchPhone(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontFamily: 'monospace' }} />
                </div>
                <button type="submit" style={{ padding: '0 16px', background: pc, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer' }}>Buscar</button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!searchedHistory && <p style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>Digite seu telefone para buscar agendamentos.</p>}
                {searchedHistory?.length === 0 && <p style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>Nenhum agendamento encontrado.</p>}
                {searchedHistory?.map(appt => {
                  const srv  = services.find(s => s.id === appt.serviceId);
                  const prof = professionals.find(p => p.id === appt.professionalId);
                  const statusColor = appt.status === 'attended' ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' } : appt.status === 'cancelled' ? { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' } : { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
                  const statusLabel = appt.status === 'attended' ? 'Atendido' : appt.status === 'cancelled' ? 'Cancelado' : 'Agendado';
                  return (
                    <div key={appt.id} style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700 }}>{formatPTBRDate(appt.date)} às {appt.time}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 8px', borderRadius: 20, background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}>{statusLabel}</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{srv?.name}</p>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>Profissional: {prof?.name}</p>
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669', fontSize: 13 }}>R$ {appt.price.toFixed(2)}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {appt.status === 'confirmed' && (
                            <button onClick={() => handleCancelMyAppointment(appt.id)}
                              style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Cancelar
                            </button>
                          )}
                          {appt.status === 'attended' && (
                            <button onClick={() => setReviewingApptId(appt.id)}
                              style={{ padding: '4px 10px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Star size={12} style={{ fill: '#f59e0b', color: '#f59e0b' }} /> Avaliar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {reviewingApptId && (
                <div style={{ marginTop: 16, background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #fde68a', paddingBottom: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 1 }}>Como foi o atendimento?</span>
                    <button onClick={() => setReviewingApptId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14 }}>✕</button>
                  </div>
                  <form onSubmit={handleAddReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} type="button" onClick={() => setReviewStars(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <Star size={20} style={{ fill: s <= reviewStars ? '#f59e0b' : 'none', color: s <= reviewStars ? '#f59e0b' : '#cbd5e1' }} />
                        </button>
                      ))}
                    </div>
                    <input type="text" required placeholder="Seu comentário…" value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
                    <button type="submit" style={{ padding: '8px 0', background: '#f59e0b', color: '#fff', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                      Enviar avaliação
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

        </div>
      ) : null}

    </div>
  );
}
