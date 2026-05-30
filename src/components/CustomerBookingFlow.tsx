/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Tenant, Service, Professional, Appointment, Customer } from '../types';
import {
  Calendar,
  Users,
  Clock,
  ArrowLeft,
  ArrowRight,
  Phone,
  Instagram,
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
  onAddAppointment: (appt: Omit<Appointment, 'id'>) => void;
  onUpdateAppointmentStatus: (apptId: string, status: Appointment['status']) => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onRegisterReview: (stars: number, comment: string, apptId: string) => void;
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
  onRegisterReview
}: CustomerBookingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [activeTab, setActiveTab] = useState<'booking' | 'history'>('booking');

  // Booking selections - Default to June 18th, 2026 to match Image 3 screenshot exactly
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-06-18');
  const [selectedTime, setSelectedTime] = useState('');

  // Calendar month/year navigation state (Default to index 5 = June, year 2026)
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(5);

  // Client account login/identification states
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Completed booking tracker
  const [recentBookedId, setRecentBookedId] = useState<string | null>(null);
  const [bookingCode, setBookingCode] = useState('');

  // Client dynamic filter for History tracking
  const [historySearchPhone, setHistorySearchPhone] = useState('');
  const [searchedHistory, setSearchedHistory] = useState<Appointment[] | null>(null);

  // Review states
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingApptId, setReviewingApptId] = useState<string | null>(null);

  // Filters
  const myServices = services.filter(s => s.tenantId === activeTenant.id);
  const myProfessionals = professionals.filter(p => p.tenantId === activeTenant.id);
  const myAppointments = appointments.filter(a => a.tenantId === activeTenant.id);

  const selectedService = myServices.find(s => s.id === selectedServiceId);
  const selectedProfessional = myProfessionals.find(p => p.id === selectedProfId);

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
  const HOURLY_SLOTS = (selectedProfessional?.businessHoursByDay && selectedProfessional.businessHoursByDay[selectedWeekdayKey])
    ? selectedProfessional.businessHoursByDay[selectedWeekdayKey]
    : (activeTenant.businessHoursByDay && activeTenant.businessHoursByDay[selectedWeekdayKey])
    ? activeTenant.businessHoursByDay[selectedWeekdayKey]
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

  const checkSlotOccupied = (timeSlot: string) => {
    return myAppointments.some(appt =>
      appt.date === selectedDate &&
      appt.time === timeSlot &&
      appt.professionalId === selectedProfId &&
      appt.status !== 'cancelled'
    );
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

  const handleFormSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) return;
    if (!selectedService || !selectedProfessional || !selectedTime) return;

    // Check / Add Customer records
    let matchedCustomer = customers.find(c => c.tenantId === activeTenant.id && c.phone === clientPhone.trim());

    if (!matchedCustomer) {
      const generatedCustId = `cust-gen-${Date.now()}`;
      onAddCustomer({
        tenantId: activeTenant.id,
        name: clientName.trim(),
        email: clientEmail.trim() || `${clientName.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}@gmail.com`,
        phone: clientPhone.trim()
      });
      matchedCustomer = {
        id: generatedCustId,
        tenantId: activeTenant.id,
        name: clientName.trim(),
        phone: clientPhone.trim(),
        email: clientEmail.trim() || `${clientName.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}@gmail.com`
      };
    }

    // Alphanumeric booking code like '231NW1E5'
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randCode = '';
    for (let i = 0; i < 8; i++) {
      randCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setBookingCode(randCode);

    const generatedApptId = `appt-user-gen-${Date.now()}`;

    onAddAppointment({
      tenantId: activeTenant.id,
      serviceId: selectedServiceId,
      professionalId: selectedProfId,
      customerId: matchedCustomer.id,
      customerName: matchedCustomer.name,
      customerPhone: matchedCustomer.phone,
      date: selectedDate,
      time: selectedTime,
      durationMinutes: selectedService.durationMinutes,
      price: selectedService.price,
      status: 'confirmed'
    });

    setRecentBookedId(generatedApptId);
    setStep(5);
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

  return (
    <div id="customer-booking-modern-wrapper" className="w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-100 min-h-[580px] flex flex-col md:flex-row font-sans">
      
      {/* 1. LEFT PINNED SUMMARY BAR (Steps 2, 3, 4 only) */}
      {activeTab === 'booking' && step > 1 && step < 5 && (
        <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200/80 p-6 flex flex-col justify-between">
          <div>
            {/* Voltar button */}
            <button
              onClick={() => setStep(prev => (prev - 1) as any)}
              className="group flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-xs cursor-pointer mb-8 transition-transform duration-100 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> 
              <span>Voltar</span>
            </button>

            {/* Tenant Title */}
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 font-mono">{activeTenant.name}</p>

            {/* Service Title */}
            <h2 className="text-3xl font-extrabold text-slate-800 leading-tight mb-6">{selectedService?.name}</h2>

            {/* Selected Attributes Summary */}
            <div className="space-y-4 pt-5 border-t border-slate-200">
              {selectedProfessional && (
                <div className="flex items-center gap-3 text-slate-700">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold">{selectedProfessional.name}</span>
                </div>
              )}

              {selectedService && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium">{selectedService.durationMinutes} min</span>
                </div>
              )}

              {selectedService && (
                <div className="flex items-center gap-3 text-slate-800">
                  <span className="text-slate-400 font-semibold font-mono text-sm shrink-0">R$</span>
                  <span className="text-sm font-bold">R$ {selectedService.price.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom language indicator customized */}
          <div className="pt-8">
            <div className="flex items-center gap-2 border border-slate-200 bg-white shadow-3xs rounded-xl px-3 py-1.5 text-[10.5px] font-medium text-slate-500 w-fit select-none">
              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Português</span>
              <span className="text-[7px] text-slate-400 mt-0.5">▼</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. RIGHT CORE VIEW CONTENT CONTAINER */}
      <div className={`flex-grow flex flex-col justify-between ${step === 1 || step === 5 || activeTab === 'history' ? 'w-full' : 'w-full md:w-[calc(100%-20rem)]'}`}>
        
        {/* VIEW A: BOOKING PROCESS FLOW */}
        {activeTab === 'booking' && (
          <div className="flex-grow p-5 md:p-8 flex flex-col justify-between h-full bg-white">
            
            {/* STEP 1: SELECT SERVICE (Image 1 replica) */}
            {step === 1 && (
              <div className="flex flex-col items-center py-6 px-4 max-w-md mx-auto w-full transition-all animate-fade-in">
                
                {/* Circular Brand Initials + Scissors Ring Logo */}
                <div className="relative w-32 h-32 rounded-full border border-blue-600 flex flex-col items-center justify-center mb-8 bg-white shadow-sm">
                  {/* Scissors Icon floating on top-right trim */}
                  <div className="absolute top-[8px] right-[8px] transform rotate-45 text-blue-600">
                    <Scissors className="w-5 h-5 fill-current" />
                  </div>

                  {/* Brand Initials */}
                  <span className="text-[38px] font-light leading-none tracking-tight text-blue-600 font-sans">
                    {getInitials(activeTenant.name)}
                  </span>

                  {/* Tenant Capitalized text spaced */}
                  <span className="text-[9px] font-bold text-blue-600 tracking-[0.2em] uppercase mt-2.5 text-center max-w-[110px] leading-tight">
                    {activeTenant.name.replace(/barbearia|salao|studio|estetica/gi, '').trim()}
                  </span>

                  {/* Barber label */}
                  <span className="text-[7px] font-semibold text-blue-405 tracking-[0.3em] uppercase mt-1 font-mono leading-none">
                    BARBEARIA
                  </span>
                </div>

                {/* History link button at top container of Step 1 */}
                <div className="w-full flex justify-end mb-4">
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-[10px] font-mono text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-105 px-3 py-1.5 rounded-full font-bold focus:outline-none flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-3xs"
                  >
                    <History className="w-3 h-3" />
                    <span>Meus Agendamentos</span>
                  </button>
                </div>

                {/* Vertical Services buttons list */}
                <div className="w-full space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {myServices.map(srv => (
                    <button
                      key={srv.id}
                      onClick={() => {
                        setSelectedServiceId(srv.id);
                        setStep(2);
                      }}
                      className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-100 flex items-center justify-between shadow-md cursor-pointer border border-blue-500 group"
                    >
                      <span className="font-sans font-semibold tracking-wide text-left text-sm">{srv.name}</span>
                      <span className="flex items-center gap-2 text-xs text-blue-100 group-hover:text-white font-sans font-medium transition-colors">
                        {srv.durationMinutes} min
                        <span className="text-[8px] translate-x-0.5">▶</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: CHOOSE BARBER / PROFESSIONAL (Image 2 replica) */}
            {step === 2 && (
              <div className="flex-grow flex flex-col justify-center min-h-[320px] transition-all animate-fade-in">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-6 select-none">
                  Selecione o profissional
                </h3>

                <div className="grid grid-cols-2 gap-4 max-w-lg">
                  {myProfessionals.map(prof => (
                    <button
                      key={prof.id}
                      onClick={() => {
                        setSelectedProfId(prof.id);
                        setStep(3);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer shadow-md text-white border border-blue-500 group"
                    >
                      <img
                        src={prof.avatar}
                        alt={prof.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md mb-3 group-hover:border-blue-100 transition-colors"
                      />
                      <span className="text-xs font-bold leading-tight select-none">{prof.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: PICK DATE & SLOTS (Image 3 replica) */}
            {step === 3 && (
              <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 transition-all animate-fade-in">
                
                {/* MIDDLE CONTAINER: MONTH VIEW CALENDAR */}
                <div className="md:col-span-7 flex flex-col justify-between pr-0 md:pr-4">
                  <div>
                    {/* Header Month section */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                      <span className="text-sm font-semibold text-slate-700 select-none">
                        {MONTH_NAMES_PT[viewMonth].toLowerCase()} {viewYear}
                      </span>
                      
                      <div className="flex items-center gap-4 text-xs font-bold text-blue-600">
                        <button
                          onClick={handleGoToToday}
                          className="hover:text-blue-700 cursor-pointer select-none active:scale-95"
                        >
                          Hoje
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer transition-colors active:scale-90"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer transition-colors active:scale-90"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Week Header */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest gap-y-2 mb-3">
                      <div>seg</div>
                      <div>ter</div>
                      <div>qua</div>
                      <div>qui</div>
                      <div>sex</div>
                      <div>sab</div>
                      <div>dom</div>
                    </div>

                    {/* Calendar Days grid */}
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-700 gap-y-2 gap-x-1.5 select-none">
                      {daysArray.map((day, idx) => {
                        if (day === null) {
                          return <div key={`empty-${idx}`} />;
                        }

                        // Check if the business is open on this day of the week
                        const dateObj = new Date(viewYear, viewMonth, day);
                        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
                        const WEEKDAYS_MAP = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
                        let isClosed = false;
                        
                        if (selectedProfessional && selectedProfessional.businessDays && selectedProfessional.businessDays.length > 0) {
                          isClosed = !selectedProfessional.businessDays.includes(WEEKDAYS_MAP[dayOfWeek]);
                        } else if (activeTenant.businessDays && activeTenant.businessDays.length > 0) {
                          isClosed = !activeTenant.businessDays.includes(WEEKDAYS_MAP[dayOfWeek]);
                        }

                        if (isClosed) {
                          return (
                            <div
                              key={`day-${day}`}
                              className="aspect-square flex flex-col items-center justify-center rounded-xl text-[10px] font-mono text-slate-350 bg-slate-50/50 cursor-not-allowed select-none border border-slate-100/50"
                              title="Estabelecimento fechado neste dia"
                            >
                              <span className="line-through">{day}</span>
                              <span className="text-[7.5px] scale-90 text-red-400 font-bold block leading-none select-none">fechado</span>
                            </div>
                          );
                        }

                        const parsedSelected = selectedDate.split('-');
                        const isSel = parsedSelected.length === 3 &&
                          parseInt(parsedSelected[0]) === viewYear &&
                          parseInt(parsedSelected[1]) - 1 === viewMonth &&
                          parseInt(parsedSelected[2]) === day;

                        return (
                          <button
                            key={`day-${day}`}
                            type="button"
                            onClick={() => handleSelectDay(day)}
                            className={`aspect-square w-full flex items-center justify-center rounded-full text-xs font-mono font-medium transition-all cursor-pointer focus:outline-none ${
                              isSel
                                ? 'bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700'
                                : 'hover:bg-slate-100 hover:text-slate-900 text-slate-755'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT CONTAINER: TIMEFRAME SLOTS SELECTION */}
                <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-205 pt-5 md:pt-0 md:pl-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Selected Date Header */}
                    <h4 className="text-sm font-bold text-slate-800 leading-none pb-2 select-none">
                      {formatPTBRDate(selectedDate)}
                    </h4>

                    {/* Exibindo horários display box */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-sans font-medium text-slate-400 uppercase block select-none">Exibindo horários para:</label>
                      <div className="flex items-center gap-2 border border-slate-200 bg-slate-50/50 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium select-none shadow-3xs">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{selectedProfessional?.name || 'Selecione o profissional'}</span>
                      </div>
                    </div>

                    {/* Hours list and scrollable */}
                    <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                      {HOURLY_SLOTS.map(time => {
                        const isOccupied = checkSlotOccupied(time);
                        const isSel = selectedTime === time;

                        if (isOccupied) {
                          return (
                            <div
                              key={time}
                              className="p-2.5 border border-slate-150 text-slate-350 bg-slate-50 text-center text-xs font-mono rounded-xl cursor-not-allowed select-none"
                              title="Horário já reservado"
                            >
                              Ocupado
                            </div>
                          );
                        }

                        return (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`w-full py-2.5 rounded-xl border text-center text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSel
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white border-blue-600/20 text-blue-600 hover:text-blue-700 hover:bg-blue-50/40 hover:border-blue-600/40'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Continuar button for step 3 selection */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setStep(4)}
                      disabled={!selectedTime}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>Continuar para informações</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* STEP 4: CLIENT IDENTIFICATION (Image 4 replica) */}
            {step === 4 && (
              <div className="flex-grow flex flex-col justify-between min-h-[380px] max-w-lg transition-all animate-fade-in">
                
                <div className="space-y-4">
                  {/* Title bar */}
                  <h3 className="text-xl font-bold text-slate-800 leading-tight">Suas informações</h3>

                  {/* Selected Slot receipt visual */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 font-semibold select-none shadow-3xs">
                    <Calendar className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    <span>{formatPTBRDate(selectedDate)} - {selectedTime}</span>
                  </div>

                  {/* Interactive Input details form */}
                  <form onSubmit={handleFormSubmission} className="space-y-4 font-sans text-xs">
                    
                    {/* Name input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-650 block select-none">Seu nome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Seu nome"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-xs tracking-wide placeholder-slate-400"
                      />
                    </div>

                    {/* BR Flag country phone input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-650 block select-none">Telefone *</label>
                      <div className="relative flex items-center border border-slate-200 bg-slate-50/55 rounded-xl px-3 py-2 text-xs focus-within:ring-1 focus-within:ring-blue-600 focus-within:border-blue-600 transition-all font-mono">
                        <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 mr-2.5 select-none">
                          <span className="text-base">🇧🇷</span>
                          <span className="text-slate-500 font-bold text-[11px]">+55</span>
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="Telefone"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          className="w-full bg-transparent p-0 border-none focus:ring-0 text-slate-800 font-mono tracking-wide placeholder-slate-400 outline-none text-xs"
                        />
                      </div>
                    </div>

                    {/* Optional Email input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-650 block select-none">Email para Notificações</label>
                      <input
                        type="email"
                        placeholder="seuemail@exemplo.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 text-xs tracking-wide placeholder-slate-400"
                      />
                    </div>

                    {/* Actions bar at bottom of step 4 */}
                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer select-none active:scale-95"
                      >
                        Voltar
                      </button>
                      
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Concluir agendamento
                      </button>
                    </div>

                  </form>
                </div>

              </div>
            )}

            {/* STEP 5: SUCCESS RECEIPT DETAIL SCREEN (Image 5 replica) */}
            {step === 5 && (
              <div className="relative flex flex-col items-center justify-center py-4 text-center max-w-sm mx-auto w-full transition-all animate-fade-in">
                
                {/* Share action top right */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Agendado para ${clientName} em ${activeTenant.name}: ${selectedService?.name} no dia ${selectedDate} as ${selectedTime}. Código: ${bookingCode}`);
                    alert("Informações do agendamento copiadas para a área de transferência!");
                  }}
                  className="absolute top-0 right-0 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition active:scale-90 cursor-pointer"
                  title="Compartilhar agendamento"
                >
                  <Share2 className="w-5 h-5" />
                </button>

                {/* Animated Green circular check badge */}
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-2xl shadow-sm mb-4 animate-bounce font-bold select-none">
                  ✓
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-slate-800 leading-tight mb-6">
                  Detalhes do agendamento
                </h3>

                {/* Grid layout parameters representing receipts list with border outlines */}
                <div className="w-full bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 text-left font-sans text-xs space-y-4 mb-8">
                  
                  {/* Quando */}
                  <div className="border-b border-slate-110 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">Quando</span>
                    <strong className="text-slate-800 font-semibold text-xs leading-tight">
                      {formatPTBRDate(selectedDate)} às {selectedTime}
                    </strong>
                  </div>

                  {/* O que */}
                  <div className="border-b border-slate-110 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">O que</span>
                    <strong className="text-slate-800 font-semibold text-xs leading-tight">
                      {selectedService?.name}
                    </strong>
                  </div>

                  {/* Duração */}
                  <div className="border-b border-slate-110 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">Duração</span>
                    <strong className="text-slate-800 font-semibold text-xs leading-tight">
                      {selectedService?.durationMinutes} min
                    </strong>
                  </div>

                  {/* Profissional */}
                  <div className="border-b border-slate-110 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">Profissional</span>
                    <strong className="text-slate-800 font-semibold text-xs leading-tight">
                      {selectedProfessional?.name}
                    </strong>
                  </div>

                  {/* Status */}
                  <div className="border-b border-slate-110 pb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">Status</span>
                    <strong className="text-slate-800 font-normal text-xs leading-tight">
                      Confirmado
                    </strong>
                  </div>

                  {/* Código */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5 select-none">Código</span>
                    <strong className="text-slate-800 font-bold font-mono text-[13px] tracking-wide block mt-0.5">
                      {bookingCode || '231NW1E5'}
                    </strong>
                  </div>

                </div>

                {/* Cancel action nested inside success element block */}
                <button
                  onClick={() => {
                    if (confirm("Você tem certeza de que deseja cancelar este agendamento?")) {
                      if (recentBookedId) onUpdateAppointmentStatus(recentBookedId, 'cancelled');
                      alert("Agendamento cancelado com sucesso.");
                      setRecentBookedId(null);
                      setStep(1);
                    }
                  }}
                  className="text-slate-500 hover:text-red-600 transition font-medium text-xs border-b border-slate-300 hover:border-red-400 pb-0.5 select-none cursor-pointer mb-6 active:scale-95"
                >
                  Cancelar agendamento
                </button>

                {/* New appointment link button situated outside/below the card block frame container */}
                <button
                  onClick={() => {
                    setRecentBookedId(null);
                    setSelectedServiceId('');
                    setSelectedProfId('');
                    setSelectedTime('');
                    setStep(1);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer select-none pb-0.5 border-b-2 border-blue-605/10 hover:border-blue-650 transition-all active:scale-95"
                >
                  Novo agendamento
                </button>

              </div>
            )}

          </div>
        )}

        {/* VIEW B: PERSONAL BOOKINGS HISTORY FEED & FEEDBACKS */}
        {activeTab === 'history' && (
          <div className="p-6 md:p-8 space-y-5 text-xs flex flex-col justify-between h-full bg-white transition-all animate-fade-in max-w-2xl mx-auto w-full">
            
            <div className="space-y-5">
              
              {/* Back link and Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => setActiveTab('booking')}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold cursor-pointer select-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> 
                  <span>Voltar para agendar</span>
                </button>
                <h3 className="text-base font-bold text-slate-800">Meus agendamentos</h3>
              </div>

              <p className="text-[11px] text-slate-500 select-none leading-relaxed">
                Digite seu número de telefone celular cadastrado para listar todo o seu histórico em tempo real.
              </p>

              {/* Tel Input field form search */}
              <form onSubmit={handleSearchHistory} className="flex gap-2 font-sans">
                <div className="relative flex items-center border border-slate-200 bg-slate-55/40 rounded-xl px-3 py-2 text-xs focus-within:ring-1 focus-within:ring-blue-600 focus-within:border-blue-600 transition-all font-mono flex-grow">
                  <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 mr-2.5 select-none">
                    <span className="text-base">🇧🇷</span>
                    <span className="text-slate-500 font-bold text-[11px]">+55</span>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="(11) 99999-8888"
                    value={historySearchPhone}
                    onChange={(e) => setHistorySearchPhone(e.target.value)}
                    className="w-full bg-transparent p-0 border-none focus:ring-0 text-slate-800 font-mono tracking-wide outline-none text-xs"
                  />
                </div>
                
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs border border-blue-600 rounded-xl cursor-pointer shadow-3xs hover:scale-[1.01] active:scale-[0.98] transition-all"
                >
                  Pesquisar
                </button>
              </form>

              {/* LIST SEARCHED CLIENT HISTORY */}
              <div className="space-y-3.5 max-h-[310px] overflow-y-auto pr-1">
                {searchedHistory ? (
                  searchedHistory.length > 0 ? (
                    searchedHistory.map(appt => {
                      const srv = services.find(s => s.id === appt.serviceId);
                      const prof = professionals.find(p => p.id === appt.professionalId);

                      return (
                        <div key={appt.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-205 space-y-3 text-xs shadow-3xs transition-all hover:border-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{formatPTBRDate(appt.date)} às {appt.time}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${
                              appt.status === 'attended' ? 'bg-green-50 text-green-700 border border-green-200/60' :
                              appt.status === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200/60' :
                              'bg-blue-50 text-blue-750 border border-blue-200/60'
                            }`}>
                              {appt.status === 'attended' ? 'Atendido' :
                               appt.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                            </span>
                          </div>

                          <div className="text-[11px] leading-relaxed">
                            <p className="font-bold text-slate-800 text-xs">{srv?.name}</p>
                            <span className="text-slate-500 font-medium mt-0.5 block">Profissional: {prof?.name}</span>
                          </div>

                          <div className="border-t border-slate-200/80 pt-2.5 mt-2 flex justify-between items-center bg-transparent">
                            <span className="font-mono text-emerald-600 font-bold">R$ {appt.price.toFixed(2)}</span>
                            
                            <div className="flex gap-1.5">
                              {appt.status === 'confirmed' && (
                                <button
                                  onClick={() => handleCancelMyAppointment(appt.id)}
                                  className="px-3 py-1 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-[10.5px] border border-red-200 cursor-pointer font-bold transition-all active:scale-95"
                                >
                                  Cancelar Vaga
                                </button>
                              )}
                              
                              {appt.status === 'attended' && (
                                <button
                                  onClick={() => setReviewingApptId(appt.id)}
                                  className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-[10.5px] border border-amber-200 flex items-center gap-1 cursor-pointer font-bold transition-all active:scale-95"
                                >
                                  <Star className="w-3.5 h-3.5 fill-current text-amber-500" /> 
                                  <span>Avaliar Barbeiro</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center py-6 text-slate-400 italic text-[11px] font-mono font-medium">Nenhum agendamento encontrado para o celular fornecido.</p>
                  )
                ) : (
                  <p className="text-center py-6 text-slate-400 italic text-[11px] font-mono font-medium">Consulte seu telefone acima para carregar seus horários.</p>
                )}
              </div>
            </div>

            {/* REVIEW MODAL ACCORDION */}
            {reviewingApptId && (
              <div className="bg-amber-50/20 p-4 rounded-xl border border-amber-200 space-y-3 mt-4 animate-fade-in">
                <div className="flex justify-between items-center border-b border-amber-110 pb-2">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Como foi o seu atendimento?</span>
                  <button onClick={() => setReviewingApptId(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">✕ Fechar</button>
                </div>

                <form onSubmit={handleAddReviewSubmit} className="space-y-3">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(stars => (
                      <button
                        key={stars}
                        type="button"
                        onClick={() => setReviewStars(stars)}
                        className="focus:outline-none cursor-pointer"
                      >
                        <Star className={`w-5 h-5 transition-transform hover:scale-110 ${stars <= reviewStars ? 'fill-current text-amber-500' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Escreva seu comentário de feedback..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-550 hover:bg-amber-600 text-white font-bold rounded text-[11px] transition shadow-sm cursor-pointer"
                  >
                    Enviar Nota de Avaliação
                  </button>
                </form>
              </div>
            )}

            <div className="text-[9.5px] text-slate-400 leading-relaxed font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 text-center select-none">
              🛡️ Os agendamentos geram notificações push reais automatizadas por nossa API em tempo real.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
