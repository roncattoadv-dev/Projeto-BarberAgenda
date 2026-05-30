/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  INITIAL_TENANTS,
  INITIAL_SERVICES,
  INITIAL_PROFESSIONALS,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_APPOINTMENTS,
  INITIAL_PAYMENTS,
  INITIAL_COUPONS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_AUDIT_LOGS
} from './data';
import { Tenant, Service, Professional, Product, Customer, Appointment, Payment, Coupon, SupportTicket, AuditLog } from './types';
import SuperAdminPanel from './components/SuperAdminPanel';
import ClientAdminPanel from './components/ClientAdminPanel';
import CustomerBookingFlow from './components/CustomerBookingFlow';
import SaaSArchitect from './components/SaaSArchitect';
import { Scissors, ShieldCheck, Users, Layers, Smartphone, Settings, Clock, Ban, DollarSign, Database, HelpCircle } from 'lucide-react';

export default function App() {
  // Master SaaS Reactive States
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [services, setServices] = useState<Service[]>(INITIAL_SERVICES);
  const [professionals, setProfessionals] = useState<Professional[]>(INITIAL_PROFESSIONALS);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // View state controller
  // 'blueprints' | 'superadmin' | 'salonadmin' | 'booking'
  const [activeRole, setActiveRole] = useState<'blueprints' | 'superadmin' | 'salonadmin' | 'booking'>('salonadmin');

  // Currently selected Salon Tenant (for the business dashboard view and booking widget)
  const [selectedTenantId, setSelectedTenantId] = useState<string>('tenant-dom-pedro');

  // System time ticker clock helper (Simulated UTC)
  const [currentTime, setCurrentTime] = useState<string>('2026-05-29 20:09:14');

  useEffect(() => {
    // Keep a simulated realistic steady clock running
    const interval = setInterval(() => {
      const now = new Date();
      // Format as YYYY-MM-DD HH:mm:ss
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const min = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      setCurrentTime(`${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeTenant = tenants.find(t => t.id === selectedTenantId) || tenants[0];

  // ----------------------------------------------------
  // EVENT HANDLERS & REACTIVE STATE MODIFICATION FLOWS
  // ----------------------------------------------------

  const logEvent = (action: string, details: string, tenantId: string | null = null, userName: string = 'Sistema Central') => {
    const newLog: AuditLog = {
      id: `log-gen-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      timestamp: currentTime,
      ip: '177.104.22.40',
      userId: tenantId ? 'usr-tenant-admin' : 'super-usr-1',
      userName,
      tenantId,
      action,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleUpdateTenantStatus = (tenantId: string, status: Tenant['status']) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const isAct = status === 'active';
        return {
          ...t,
          status,
          mrr: isAct ? (t.plan === 'mensal' ? 149.90 : t.plan === 'semestral' ? 129.90 : 99.90) : 0
        };
      }
      return t;
    }));
    
    const targetTenantName = tenants.find(t => t.id === tenantId)?.name || tenantId;
    logEvent(
      'Atualização de Status Tenant',
      `O status da empresa [${targetTenantName}] foi modificado para [${status}] de forma manual pelo Super Admin.`,
      null,
      'Super Admin Principal'
    );
  };

  const handleExtendTrial = (tenantId: string) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        // Extend 10 days
        const originalEnds = new Date(t.trialEndsAt);
        originalEnds.setDate(originalEnds.getDate() + 10);
        const yyyy = originalEnds.getUTCFullYear();
        const mm = String(originalEnds.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(originalEnds.getUTCDate()).padStart(2, '0');
        return {
          ...t,
          trialEndsAt: `${yyyy}-${mm}-${dd}`
        };
      }
      return t;
    }));

    const targetTenantName = tenants.find(t => t.id === tenantId)?.name || tenantId;
    logEvent(
      'Extensão de Período Trial',
      `O período de testes gratuitos para o tenant [${targetTenantName}] foi estendido por mais 10 dias de cortesia.`,
      null,
      'Super Admin Principal'
    );
  };

  const handleUpdateTenantDetails = (tenantId: string, details: Partial<Tenant>) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        return {
          ...t,
          ...details
        };
      }
      return t;
    }));
    logEvent(
      'Configurações Alteradas',
      `Configurações do salão atualizadas pelo Administrador do Cliente.`,
      tenantId,
      'Gerente de Loja'
    );
  };

  const handleAddService = (newSrv: Omit<Service, 'id'>) => {
    const fresh: Service = {
      ...newSrv,
      id: `srv-gen-${Date.now()}`
    };
    setServices(prev => [fresh, ...prev]);
    logEvent('Serviço Cadastrado', `Novo serviço "${newSrv.name}" adicionado à grade. Preço: R$ ${newSrv.price.toFixed(2)}`, newSrv.tenantId, 'Gerente de Loja');
  };

  const handleAddProfessional = (newProf: Omit<Professional, 'id'>) => {
    const fresh: Professional = {
      ...newProf,
      id: `prof-gen-${Date.now()}`
    };
    setProfessionals(prev => [...prev, fresh]);
    logEvent('Profissional Contratado', `Profissional "${newProf.name}" vinculado à equipe do salão com comissão de ${newProf.commissionPercentage}%.`, newProf.tenantId, 'Gerente de Loja');
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const fresh: Product = {
      ...newProd,
      id: `prod-gen-${Date.now()}`
    };
    setProducts(prev => [fresh, ...prev]);
    logEvent('Produto Cadastrado', `Produto "${newProd.name}" adicionado ao banco de estoque comercial.`, newProd.tenantId, 'Gerente de Loja');
  };

  const handleUpdateProductStock = (productId: string, newStock: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, stock: newStock };
      }
      return p;
    }));
    
    const prod = products.find(p => p.id === productId);
    if (prod && newStock <= prod.minStock) {
      logEvent('Estoque Crítico Alerta', `O produto [${prod.name}] recuou para apenas ${newStock} unidades em estoque. Alerta de reposição ativado.`, prod.tenantId);
    }
  };

  const handleAddCustomer = (newCust: Omit<Customer, 'id' | 'createdAt'>) => {
    const fresh: Customer = {
      ...newCust,
      id: `cust-gen-${Date.now()}`,
      createdAt: '2026-05-29'
    };
    setCustomers(prev => [fresh, ...prev]);
    logEvent('Novo Cliente Cadastrado', `Cliente "${newCust.name}" registrado na base de contatos local. Celular: ${newCust.phone}`, newCust.tenantId, 'Gerente de Loja');
  };

  const handleAddAppointment = (newAppt: Omit<Appointment, 'id'>) => {
    const fresh: Appointment = {
      ...newAppt,
      id: `appt-gen-${Date.now()}`
    };
    setAppointments(prev => [fresh, ...prev]);

    logEvent('Novo Agendamento Marcado', `Reserva marcada para dia ${newAppt.date} às ${newAppt.time}. Cliente: ${newAppt.customerName}`, newAppt.tenantId, 'Motor do Agendamento');
  };

  const handleUpdateAppointmentStatus = (apptId: string, status: Appointment['status']) => {
    setAppointments(prev => prev.map(a => {
      if (a.id === apptId) {
        return { ...a, status };
      }
      return a;
    }));

    const appt = appointments.find(a => a.id === apptId);
    if (appt) {
      logEvent('Status do Agendamento Modificado', `O agendamento do cliente [${appt.customerName}] foi marcado como [${status}].`, appt.tenantId);
    }
  };

  const handleAddPayment = (newPay: Omit<Payment, 'id'>) => {
    const fresh: Payment = {
      ...newPay,
      id: `pay-gen-${Date.now()}`
    };
    setPayments(prev => [fresh, ...prev]);
    logEvent('Transação Financeira Registrada', `${newPay.description} de R$ ${newPay.amount.toFixed(2)} registrado nos caixas.`, newPay.tenantId, 'Motor de Faturamento');
  };

  const handleAddCoupon = (code: string, discount: number, expiresAt: string) => {
    const fresh: Coupon = {
      id: `cp-gen-${Date.now()}`,
      code,
      discountPercentage: discount,
      status: 'active',
      usageCount: 0,
      expiresAt
    };
    setCoupons(prev => [fresh, ...prev]);
    logEvent('Cupom Promocional Criado', `Novo cupom global "${code}" (${discount}% desconto) cadastrado na plataforma para novos assinantes.`, null, 'Super Admin principal');
  };

  const handleResolveSupportTicket = (ticketId: string, replyMessage?: string) => {
    setSupportTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        const updatedMsgs = [...t.messages];
        if (replyMessage) {
          updatedMsgs.push({
            sender: 'superadmin',
            content: replyMessage,
            timestamp: currentTime.substring(11, 16)
          });
        }
        return {
          ...t,
          status: 'resolved',
          messages: updatedMsgs
        };
      }
      return t;
    }));
    logEvent('Chamado Respondido e Resolvido', `Suporte técnico respondeu o ticket #${ticketId} e atualizou status para Resolvido.`, null, 'Suporte Corporativo SaaS');
  };

  const handleRegisterReview = (stars: number, comment: string, apptId: string) => {
    // Register visual reviews link to Professional score
    const targetAppt = appointments.find(a => a.id === apptId);
    if (!targetAppt) return;

    setProfessionals(prev => prev.map(p => {
      if (p.id === targetAppt.professionalId) {
        // Simple recalculation mapping slightly upwards with weight
        const oldRating = p.rating;
        const newRating = Number(((oldRating * 4 + stars) / 5).toFixed(2));
        return {
          ...p,
          rating: newRating
        };
      }
      return p;
    }));

    logEvent('Nova Avaliação Recebida', `Feedback recebido para agendamento #${apptId}. Classificação: ${stars} estrelas.`, targetAppt.tenantId, 'Mecanismo de Avaliação');
  };

  return (
    <div id="saas-scheduler-main-container" className="min-h-screen bg-slate-50 font-sans text-slate-900 transition-colors">
      
      {/* Dynamic System Alert Line */}
      <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2 text-center text-[11px] font-mono tracking-wide flex flex-col md:flex-row items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span>Ambiente SaaS Multi-Tenant Isolado: <strong className="text-blue-400">ONLINE</strong></span>
        </div>
        <div className="flex bg-slate-950 p-0.5 border border-slate-800 rounded bg-slate-900/60 px-2 select-none">
          <span className="text-slate-300">Relógio de Controle (UTC): {currentTime}</span>
        </div>
        <div className="text-[10.5px] text-blue-300 font-medium">
          Suas alterações persistem em memória local ⚡
        </div>
      </div>

      {/* Main SaaS Central Header and Navigator */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
          <div className="h-16 flex items-center justify-between gap-4">
            
            {/* Logo and Brand Title */}
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-1.5 bg-blue-600 text-white rounded-xl shadow-md border border-blue-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </span>
              <div>
                <span className="text-[9.5px] font-extrabold text-blue-600 uppercase font-mono block tracking-widest leading-none">BarberFlow SaaS</span>
                <h1 className="text-base font-bold text-slate-800 mt-1 uppercase tracking-tight">Agendamento Multi-Tenant</h1>
              </div>
            </div>

            {/* Central role toggler - representing standard SaaS workspace switchers */}
            <nav className="bg-white/80 backdrop-blur-md px-2 py-2 border border-slate-200/60 rounded-full flex gap-2 overflow-x-auto max-w-full shadow-sm ring-1 ring-slate-900/5 no-scrollbar">
              {[
                { id: 'blueprints', label: 'Especificações (10 Entregas)', icon: Layers },
                { id: 'superadmin', label: 'Super Admin', icon: ShieldCheck },
                { id: 'salonadmin', label: 'Administrador Cliente', icon: Scissors },
                { id: 'booking', label: 'Link de Agendamento Online', icon: Smartphone }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeRole === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`btn-role-${tab.id}`}
                    onClick={() => setActiveRole(tab.id as 'blueprints' | 'superadmin' | 'salonadmin' | 'booking')}
                    className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md scale-100' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 scale-95 hover:scale-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-100' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Tenant Global Switcher Indicator */}
            <div className="hidden lg:flex items-center bg-slate-50 border border-slate-205 rounded-xl p-1.5 select-none gap-2 font-mono text-[11px] h-10">
              <span className="text-slate-500">Tenant Ativo:</span>
              <select
                id="tenant-global-selector"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none focus:ring-0 border-none py-0 pr-6"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.status === 'blocked' ? 'BLOQUEADO' : 'T-10d'})</option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 font-sans">
        
        {/* Switcher details depending on tenant blocked states */}
        {activeRole === 'salonadmin' && activeTenant.status === 'blocked' ? (
          /* BLOCKED TENANT PREVENTER SCREEN CARD */
          <div className="bg-white border border-slate-200 p-8 md:p-12 text-center rounded-3xl max-w-lg mx-auto space-y-6 shadow-xl relative overflow-hidden">
            <span className="absolute top-0 inset-x-0 h-1.5 bg-red-500"></span>
            <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-3xl mx-auto shadow animate-pulse">
              🔒
            </div>
            
            <div>
              <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest block mb-1">Acesso Suspenso</span>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight">Acesso Bloqueado para {activeTenant.name}</h2>
              <p className="text-xs text-slate-550 mt-2 leading-relaxed">
                Detector automático de conformidade do gateway Asaas: A recorrência para a empresa <strong>{activeTenant.name}</strong> encontra-se vencida e vencendo há mais de 5 dias úteis sem compensação de Pix ou Cartão de assinatura SaaS. 
              </p>
            </div>

            <div className="bg-slate-50 font-mono text-[10.5px] p-4 text-left border border-slate-200 rounded-2xl space-y-1.5">
              <p className="flex justify-between"><span className="text-slate-450">Fatura SaaS Vencida:</span> <strong>15/05/2026</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">Valor do Plano ({activeTenant.plan}):</span> <strong>R$ 149,90/mês</strong></p>
              <p className="flex justify-between"><span className="text-slate-450">Modo de Quitação:</span> <strong className="text-teal-600">Disparado no Pix ou Cartão</strong></p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                id="btn-block-remedy"
                onClick={() => handleUpdateTenantStatus(activeTenant.id, 'active')}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow transition"
              >
                Pagar Fatura SaaS Simulada (Ativar Tenant)
              </button>
              <button
                onClick={() => setActiveRole('superadmin')}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-205 text-slate-700 rounded-xl transition border border-slate-300"
              >
                Ir para Super Admin
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 italic font-mono">*Como Super Admin você pode aprovar a adimplência e liberar o acesso com 1 clique.</p>
          </div>
        ) : (
          /* REGULAR INTEGRATED VIEWS SCREEN */
          <div className="space-y-6">
            
            {/* Context alert header */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-xl shrink-0">💡</span>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {activeRole === 'blueprints' && "Visualizando as especificações de arquitetura do produto SaaS solicitadas."}
                  {activeRole === 'superadmin' && "Como Super Admin você governa todos os planos, cupons, faturamento e aprova as barbearias."}
                  {activeRole === 'salonadmin' && `Gerenciando a agenda interna, finanças, estoque de vendas e profissionais da barbearia: `}
                  {activeRole === 'booking' && `Abaixo está o Widget com link exclusivo personalizado para as reservas de `}
                  {activeRole !== 'blueprints' && <strong>{activeTenant.name}</strong>}
                </p>
              </div>

              {/* Real-time tenant switcher visible across roles */}
              {activeRole !== 'blueprints' && (
                <div className="flex items-center bg-slate-50 border border-slate-205 rounded-xl p-1 shrink-0 select-none text-[10.5px]">
                  <span className="text-slate-500 px-2">Mudança rápida de Barbearia:</span>
                  <select
                    id="tenant-quick-switcher"
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="bg-transparent text-slate-800 font-bold focus:outline-none focus:ring-0 border-none py-1 pr-6 cursor-pointer text-[10.5px]"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.status === 'blocked' ? 'BLOQUEADO' : 'SaaS Ativo'})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* SWITCH PORTAL FOR ACTIVE VIEWS */}
            {activeRole === 'blueprints' && <SaaSArchitect />}

            {activeRole === 'superadmin' && (
              <SuperAdminPanel
                tenants={tenants}
                onUpdateTenantStatus={handleUpdateTenantStatus}
                onExtendTrial={handleExtendTrial}
                coupons={coupons}
                onAddCoupon={handleAddCoupon}
                supportTickets={supportTickets}
                onResolveTicket={handleResolveSupportTicket}
                auditLogs={auditLogs}
              />
            )}

            {activeRole === 'salonadmin' && (
              <ClientAdminPanel
                activeTenant={activeTenant}
                services={services}
                professionals={professionals}
                products={products}
                customers={customers}
                appointments={appointments}
                payments={payments}
                
                onAddService={handleAddService}
                onAddProfessional={handleAddProfessional}
                onAddProduct={handleAddProduct}
                onUpdateProductStock={handleUpdateProductStock}
                onAddAppointment={handleAddAppointment}
                onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
                onAddPayment={handleAddPayment}
                onAddCustomer={handleAddCustomer}
                onUpdateTenantDetails={handleUpdateTenantDetails}
                onSwitchToBookingFlow={(slug) => {
                  const t = tenants.find(x => x.slug === slug);
                  if (t) {
                    setSelectedTenantId(t.id);
                    setActiveRole('booking');
                  }
                }}
              />
            )}

            {activeRole === 'booking' && (
              <div className="py-6 bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-4 md:p-12 relative">
                <span className="absolute top-4 left-4 text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 font-bold uppercase select-none">Preview Dispositivo Móvel Cliente</span>
                <CustomerBookingFlow
                  activeTenant={activeTenant}
                  services={services}
                  professionals={professionals}
                  appointments={appointments}
                  customers={customers}
                  onAddAppointment={handleAddAppointment}
                  onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
                  onAddCustomer={handleAddCustomer}
                  onRegisterReview={handleRegisterReview}
                />
              </div>
            )}

          </div>
        )}
      </main>

      {/* Corporate Platform Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20 py-8 text-xs text-slate-500 font-medium font-sans">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">💈</span>
            <span>© 2026 SaaS de Agendamentos Corporativo Ltd. Feito pronto para distribuição real.</span>
          </div>
          <div className="flex gap-4 text-slate-400 font-mono text-[10px]">
            <span>Estrito LGPD Comp</span>
            <span>•</span>
            <span>PostgreSQL Multi-tenant Ativo</span>
            <span>•</span>
            <span>SaaS de Distribuição</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
