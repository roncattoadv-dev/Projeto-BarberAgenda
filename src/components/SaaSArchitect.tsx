/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, Cpu, Layers, Network, DollarSign, Terminal, ArrowRight, CheckCircle, FileText, Code, Settings, MessageSquare, Play } from 'lucide-react';

export default function SaaSArchitect() {
  const [activeTab, setActiveTab] = useState<'arquitetura' | 'banco' | 'apis' | 'monetizacao' | 'roadmap'>('arquitetura');
  const [activeApiRoute, setActiveApiRoute] = useState<'get_appointments' | 'post_appointment' | 'create_tenant'>('get_appointments');
  const [testResult, setTestResult] = useState<any>(null);
  const [simulatingApi, setSimulatingApi] = useState(false);
  const [customPriceMultiplier, setCustomPriceMultiplier] = useState(1);
  const [activeUsersSim, setActiveUsersSim] = useState(150);

  const sqlSchema = `-- ==========================================
-- SAAS SCHEDULE PLATFORM - POSTGRESQL SCHEMA
-- AUTORES: SaaS de Agendamento Online
-- COESO, SEGURO E OPTIMIZADO PARA MULTI-TENANCY
-- ==========================================

-- 1. TENANTS (Organizações Isoladas)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    phone VARCHAR(30) NOT NULL,
    address TEXT NOT NULL,
    instagram VARCHAR(100),
    status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('active', 'blocked', 'trial')),
    plan VARCHAR(20) DEFAULT 'trial' CHECK (plan IN ('mensal', 'semestral', 'anual', 'trial')),
    trial_ends_at TIMESTAMP NOT NULL,
    subscription_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index para busca rápida por slug (sub-domínios)
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- 2. ROLES (Controle de Acesso RBAC)
CREATE TABLE roles (
    id VARCHAR(50) PRIMARY KEY, -- 'super_admin', 'tenant_admin', 'professional', 'customer'
    description TEXT NOT NULL
);

-- 3. USERS (Autenticação Multi-Tenant)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL para Super Admins da plataforma
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) REFERENCES roles(id),
    phone VARCHAR(30),
    is_mfa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_email_per_tenant UNIQUE (tenant_id, email) -- Permite mesmo email em tenants diferentes mas isolados
);

-- 4. SERVICES (Serviços Oferecidos por Tenant)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_tenant ON services(tenant_id);

-- 5. PROFESSIONALS (Barbeiros / Cabeleireiros)
CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    commission_percentage DECIMAL(5, 2) NOT NULL DEFAULT 40.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relacionamento profissional_services (Muitos para Muitos)
CREATE TABLE professional_services (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, service_id)
);

-- 6. CUSTOMERS (Base de Clientes Finais por Empresa)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_phone_per_tenant UNIQUE (tenant_id, phone)
);

-- 7. SCHEDULES (Pausas e Bloqueios Customizados)
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 para Domingo
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start TIME,
    break_end TIME
);

-- 8. APPOINTMENTS (Agendamentos Inteligentes)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    professional_id UUID NOT NULL REFERENCES professionals(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    duration_minutes INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'attended')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evitar agendamentos simultâneos para o mesmo profissional (Exclusão no BD)
CREATE INDEX idx_appointments_validation ON appointments(tenant_id, professional_id, scheduled_date, scheduled_time) WHERE status != 'cancelled';

-- 9. PAYMENTS (Transações Financeiras)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('pix', 'credit_card', 'cash')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- 10. NOTIFICATIONS (Fila de Envios Agendados - WhatsApp, SMS, Email)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('confirmation', 'reminder', 'cancellation')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
    message TEXT NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed'))
);

-- 11. NOTIFICATIONS_LOG (Log de disparo do sistema)
-- Esta tabela armazena o histórico detalhado das mensagens expedidas
-- para auditoria e controle de faturamento de consumo de SMS/Whats.

-- 12. REVIEWS (Feedbacks do Cliente Final)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. AUDIT_LOGS (Logs de Segurança e Rastreamento)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NOT NULL,
    user_id UUID NOT NULL,
    user_name VARCHAR(150) NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL
);`;

  const apiSpecs = {
    get_appointments: {
      method: 'GET',
      endpoint: '/api/v1/appointments',
      desc: 'Retorna a lista de agendamentos do tenant logado no dia ou período especificado.',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsIn...',
        'X-Tenant-Slug': 'dompedro'
      },
      queryParams: '?date=2026-05-29&status=confirmed',
      response: {
        success: true,
        count: 2,
        data: [
          {
            id: "appt-823a-f472",
            customerName: "Thiago Alencar",
            service: "Corte Degradê Premium",
            professional: "Gustavo Lima (Guga)",
            time: "09:00",
            duration: 40,
            price: 60.00,
            status: "confirmed"
          },
          {
            id: "appt-912b-b230",
            customerName: "Rodrigo Mello",
            service: "Barboterapia Real",
            professional: "Gustavo Lima",
            time: "10:30",
            duration: 30,
            price: 50.00,
            status: "confirmed"
          }
        ]
      }
    },
    post_appointment: {
      method: 'POST',
      endpoint: '/api/v1/appointments',
      desc: 'Cria um novo agendamento validando conflitos de horários de forma isolada.',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsIn...',
        'X-Tenant-Slug': 'dompedro'
      },
      body: {
        serviceId: "srv-corte-dp",
        professionalId: "prof-gustavo",
        customerName: "Julio Cesar",
        customerPhone: "(11) 99999-8888",
        customerEmail: "julio@gmail.com",
        date: "2026-05-29",
        time: "15:00",
        notes: "Gosta de máquina zero na lateral."
      },
      response: {
        success: true,
        message: "Agendamento reservado e confirmado com sucesso.",
        appointment: {
          id: "appt-new-9812",
          tenantId: "tenant-dom-pedro",
          serviceId: "srv-corte-dp",
          professionalId: "prof-gustavo",
          customerName: "Julio Cesar",
          date: "2026-05-29",
          time: "15:00",
          status: "confirmed",
          notification_queued: {
            channel: "whatsapp",
            scheduled_for: "2026-05-28 15:00"
          }
        }
      }
    },
    create_tenant: {
      method: 'POST',
      endpoint: '/api/v1/saas/tenants',
      desc: 'Provisiona uma nova empresa SaaS (Tenant) na plataforma com isolamento e banco de teste.',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsIn... (Super Admin Token)'
      },
      body: {
        companyName: "Barbearia Imperial",
        slug: "imperial",
        ownerName: "Victor Hugo",
        ownerEmail: "victor@imperial.com",
        ownerPhone: "(11) 95555-5555",
        plan: "mensal",
        applyTrialDays: 10
      },
      response: {
        success: true,
        tenantId: "tenant-imperial-829",
        setupUrl: "https://imperial.saasbarber.io/setup",
        status: "trial",
        trialEndsAt: "2026-06-08",
        message: "Infraestrutura lógica do tenant inicializada e banco de dados isolado com sucesso."
      }
    }
  };

  const simulateApiCall = () => {
    setSimulatingApi(true);
    setTestResult(null);
    setTimeout(() => {
      setSimulatingApi(false);
      setTestResult(apiSpecs[activeApiRoute].response);
    }, 850);
  };

  const calculatedMRR = (activeUsersSim * 149.90 * customPriceMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const calculatedARR = (activeUsersSim * 149.90 * customPriceMultiplier * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div id="saas-architect-root" className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-900/30 to-amber-900/10 p-6 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-400/10 text-blue-600 border border-teal-500/20">
                Lançamento SaaS v1.0
              </span>
              <span className="text-xs font-mono text-slate-500">Pronto para Comercialização</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">
              Mecanismo e Planejamento Técnico SaaS
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Arquitetura de microsserviços, modelagem física, fluxos mapeados, estimativas financeiras e APIs REST multi-tenant.
            </p>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-full flex gap-2 overflow-x-auto max-w-full shadow-sm p-2 no-scrollbar mx-4 mt-4">
            {[
              { id: 'arquitetura', label: 'Arquitetura & Fluxo', icon: Network },
              { id: 'banco', label: 'BD Model (SQL DDL)', icon: Database },
              { id: 'apis', label: 'API Explorer', icon: Terminal },
              { id: 'monetizacao', label: 'Monetização Sim', icon: DollarSign },
              { id: 'roadmap', label: 'Regras e Roadmap', icon: Layers }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id.substring(0, 3)}`}
                  onClick={() => setActiveTab(tab.id as 'arquitetura' | 'banco' | 'apis' | 'monetizacao' | 'roadmap')}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md scale-100' 
                      : 'text-slate-500 hover:bg-slate-100 scale-95 hover:scale-100 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        
        {/* TAB 1: ARQUITETURA & FLUXOS */}
        {activeTab === 'arquitetura' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-2 bg-teal-500/10 text-blue-600 w-fit rounded-lg mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold">Isolamento de Dados (Tenant-Level)</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Para garantir performance e segurança em conformidade com a LGPD, o SaaS é projetado usando arquitetura de <strong>Shared Database com Schemas Dinâmicos ou Row Level Security (RLS)</strong> do PostgreSQL. Uma coluna indexada <span className="text-blue-600 font-mono">tenant_id</span> assegura que cada query filtra exclusivamente dados do cliente correspondente.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Isolamento estrito a nível de Conexão</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Middlewares injetando ID no Contexto</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div> Criptografia em repouso AES-256</div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-2 bg-amber-500/10 text-amber-400 w-fit rounded-lg mb-3">
                  <Network className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold">Notificações Automáticas</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Utilização de filas de mensagens assíncronas via <strong>BullMQ (Redis)</strong> executadas por timers cron. Sempre que um agendamento é marcado/alterado, eventos de fila disparam webhooks customizados com APIs integradas de disparo de mensagens do WhatsApp (Z-API/Chatpro) sem engasgar o servidor principal.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Gatilho Lembrete T-2h e T-24h</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Envio automático de Pix Copia e Cola</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Mensagens customizadas com Tags dinâmicas</div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-2 bg-blue-500/10 text-blue-400 w-fit rounded-lg mb-3">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold">Gateway de Pagamentos Integrado</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Controle de assinaturas do SaaS integrado via Gateway <strong>Asaas API</strong>. A criação da conta do Tenant Admin ativa o período de teste de 7 dias de forma imediata. Ao expirar ou inadimplir, o sistema utiliza o webhook do financeiro para bloquear dinamicamente o acesso do painel do salão.
                </p>
                <div className="mt-4 flex flex-col gap-1.5 text-[10px] font-mono text-slate-500">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Cobrança Recorrente (Cartão/Pix)</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Tentativas de reenvio inteligentes</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Split de Pagamento dinâmico</div>
                </div>
              </div>
            </div>

            {/* FLUXO INTERATIVO DOS USUÁRIOS */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold mb-4">Fluxo Unificado de Usuários & Roles</h3>
              
              <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4">
                
                <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">1</span>
                    <h4 className="text-xs font-semibold text-slate-900">SUPER ADMIN</h4>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2">
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                      <span>Monitoramento do MRR total e Churn</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                      <span>Faturamento e Aprovação/Bloqueio de Contas</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                      <span>Gerenciamento de Cupons de Campanhas Globais</span>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-center text-slate-600">
                  <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
                </div>

                <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-blue-600 text-xs flex items-center justify-center font-bold">2</span>
                    <h4 className="text-xs font-semibold text-slate-900">TENANT ADMIN (SALÃO)</h4>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2">
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <span>Setup da Página e Link Único de Reservas</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <span>Controle de Estoque e Comissões Financeiras</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                      <span>Painel de Horários com Drag & Drop Inteligente</span>
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-center text-slate-600">
                  <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
                </div>

                <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">3</span>
                    <h4 className="text-xs font-semibold text-slate-900">CLIENTE FINAL</h4>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2">
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>Acesso via QRCode ou link direto em dispositivo móvel</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>Seleção inteligente de Serviço, Barbeiro e Data/Hora</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>Confirmação rápida sem senha (Identificador Único)</span>
                    </li>
                  </ul>
                </div>

              </div>
            </div>

            {/* ESTRUTURA DE PASTAS */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold mb-2">Estrutura de Pastas Recomendada (Full-Stack CLI)</h3>
              <p className="text-xs text-slate-500 mb-4">Organização modular escalável ideal para produção robusta com NestJS backend e Vite frontend.</p>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 overflow-x-auto leading-relaxed">
                <div>📁 <span className="text-blue-600 font-semibold">saas-barber-mono/</span></div>
                <div className="pl-4">📁 <span className="text-amber-400 font-semibold">apps/backend/</span> <span className="text-slate-500">// NestJS API REST Framework</span></div>
                <div className="pl-8">📁 src/</div>
                <div className="pl-12">📁 <span className="text-blue-400">auth/</span> <span className="text-slate-500">// RBAC & JWT Guards</span></div>
                <div className="pl-12">📁 <span className="text-blue-400">tenant/</span> <span className="text-slate-500">// Subdomain router, multi-tenant decorator</span></div>
                <div className="pl-12">📁 <span className="text-blue-400">appointments/</span> <span className="text-slate-500">// Core logic & conflict validation checks</span></div>
                <div className="pl-12">📁 <span className="text-blue-400">notifications/</span> <span className="text-slate-500">// WhatsApp queue engines</span></div>
                <div className="pl-12">📄 main.ts</div>
                <div className="pl-8">📄 prisma.schema <span className="text-slate-500">// PostgreSQL models & composite indexes</span></div>
                <div className="pl-8">📄 Dockerfile</div>
                
                <div className="pl-4 mt-2">📁 <span className="text-amber-400 font-semibold">apps/frontend/</span> <span className="text-slate-500">// React SPA client dashboard</span></div>
                <div className="pl-8">📁 src/</div>
                <div className="pl-12">📁 components/ <span className="text-slate-500">// Reusable global UI / tailwind cards</span></div>
                <div className="pl-12">📁 views/super-admin/</div>
                <div className="pl-12">📁 views/salon-admin/</div>
                <div className="pl-12">📁 views/customer-flow/</div>
                <div className="pl-12">📁 hooks/ <span className="text-slate-500">// useTenant, useApi requests</span></div>
                <div className="pl-8">📄 index.html</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MODELAGEM DO BANCO */}
        {activeTab === 'banco' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold">Modelagem Física SQL (PostgreSQL DDL)</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlSchema);
                  alert("Código SQL copiado para a área de transferência!");
                }}
                className="px-3 py-1 bg-slate-850 hover:bg-slate-800 text-blue-600 hover:text-teal-300 font-mono text-[11px] rounded border border-slate-700 transition"
              >
                Copiar SQL schema
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Cada tabela requer herança ou mapeamento de chave estrangeira ao <span className="text-blue-600 font-mono">tenant_id</span> (exceto a tabela global de Tenants e o controle global de usuários SaaS como Super Admins). Foram inseridos índices compostos visando otimização extrema de performance em buscas simultâneas na agenda.
            </p>
            <div className="relative">
              <div className="absolute top-3 right-3 text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
                POSTGRESQL
              </div>
              <pre className="p-4 bg-slate-955 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-700 max-h-[420px] overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                {sqlSchema}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: API EXPLORER */}
        {activeTab === 'apis' && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest font-bold mb-3">API Interactive REST Explorer</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setActiveApiRoute('get_appointments'); setTestResult(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition ${
                    activeApiRoute === 'get_appointments' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span className="px-1 text-[9px] font-bold bg-green-500/20 text-green-400 rounded">GET</span>
                  appointments
                </button>
                <button
                  onClick={() => { setActiveApiRoute('post_appointment'); setTestResult(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition ${
                    activeApiRoute === 'post_appointment' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span className="px-1 text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded">POST</span>
                  appointments
                </button>
                <button
                  onClick={() => { setActiveApiRoute('create_tenant'); setTestResult(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition ${
                    activeApiRoute === 'create_tenant' ? 'bg-indigo-650 text-white' : 'bg-slate-50 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span className="px-1 text-[9px] font-bold bg-purple-500/20 text-purple-400 rounded">POST</span>
                  tenants (SaaS)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* API REQUEST DETAIL */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    apiSpecs[activeApiRoute].method === 'GET' ? 'bg-green-500/20 text-green-400' :
                    apiSpecs[activeApiRoute].method === 'POST' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {apiSpecs[activeApiRoute].method}
                  </span>
                  <span className="font-mono text-slate-900 font-semibold">{apiSpecs[activeApiRoute].endpoint}</span>
                </div>
                
                <p className="text-slate-500 leading-relaxed text-xs">{apiSpecs[activeApiRoute].desc}</p>
                
                <div>
                  <h5 className="font-mono text-[10px] uppercase text-slate-500 mb-1.5 font-bold">Headers obrigatórios</h5>
                  <pre className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[10px] text-slate-500 overflow-x-auto leading-relaxed">
                    {JSON.stringify(apiSpecs[activeApiRoute].headers, null, 2)}
                  </pre>
                </div>

                {apiSpecs[activeApiRoute].queryParams && (
                  <div>
                    <h5 className="font-mono text-[10px] uppercase text-slate-500 mb-1.5 font-bold">Query Parameters</h5>
                    <pre className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-[11px] text-blue-600">
                      {apiSpecs[activeApiRoute].queryParams}
                    </pre>
                  </div>
                )}

                {(apiSpecs[activeApiRoute] as any).body && (
                  <div>
                    <h5 className="font-mono text-[10px] uppercase text-slate-500 mb-1.5 font-bold font-bold">Request Body (JSON)</h5>
                    <pre className="p-3 bg-slate-50 rounded border border-slate-200 font-mono text-[10px] text-slate-350 overflow-x-auto leading-relaxed">
                      {JSON.stringify((apiSpecs[activeApiRoute] as any).body, null, 2)}
                    </pre>
                  </div>
                )}

                <button
                  id="btn-test-api"
                  onClick={simulateApiCall}
                  disabled={simulatingApi}
                  className="w-full py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-lg active:scale-[0.99] transition flex items-center justify-center gap-2 hover:bg-teal-400 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {simulatingApi ? 'Simulando requisição...' : 'Enviar Chamada ao Servidor (Simulado)'}
                </button>
              </div>

              {/* API RESPONSE PANEL */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest font-bold">Resposta HTTP do Servidor</h4>
                    <span className="text-[10px] font-mono text-slate-500">Formato: JSON</span>
                  </div>

                  {testResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                        <span className="font-mono text-green-400 font-bold">200 OK</span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-500 font-mono">Tempo: 41ms</span>
                      </div>
                      <pre className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-mono text-slate-700 leading-relaxed overflow-x-auto max-h-[300px]">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </div>
                  ) : simulatingApi ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs font-mono text-slate-500">Processando resposta no tenant sandbox...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-2 text-slate-500">
                      <Code className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs">Aguardando envio da requisição técnica...</p>
                      <p className="text-[10px] text-slate-600">Selecione uma rota e clique em "Enviar Chamada"</p>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono bg-slate-50/40 p-3 rounded border border-slate-200 mt-4">
                  💡 <strong>Segurança Act:</strong> Cada endpoint possui Rate Limit nativo por IP (máx 120 requisições/minuto) e sanitização estrita de payload contra SQL Injection e ataques XSS.
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: PLANO FINANCEIRO E MONETIZAÇÃO */}
        {activeTab === 'monetizacao' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Opção Plano Mensal</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 font-mono">R$ 149</span>
                    <span className="text-xs text-slate-500">,90/mês</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Ideal para pequenas barbearias e profissionais autônomos que desejam automatizar o fluxo básico sem burocracia.
                  </p>
                </div>
                <ul className="text-[10.5px] text-slate-500 mt-4 space-y-2 border-t border-slate-200 pt-4">
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Até 2 Profissionais</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Suporte via Email</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Notificação WhatsApp inclusa</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-teal-500/30 relative flex flex-col justify-between">
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-semibold text-[9px] uppercase tracking-wider border border-teal-500/30">
                  Mais Vendido (Ganho 15%)
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Plano Semestral</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-blue-600 font-mono">R$ 129</span>
                    <span className="text-xs text-slate-700">,90/mês</span>
                  </div>
                  <p className="text-xs text-slate-450 mt-2 leading-relaxed">
                    Excelente custo-benefício para salões consolidados com fluxo constante de clientes.
                  </p>
                </div>
                <ul className="text-[10.5px] text-slate-500 mt-4 space-y-2 border-t border-slate-200 pt-4">
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Até 6 Profissionais</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Suporte Whatsapp Prioritário</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Histórico & Configuração Completa</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plano Anual Premium</h4>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 font-mono">R$ 99</span>
                    <span className="text-xs text-slate-500">,90/mês</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Foco em redes de salões de beleza e franquias que necessitam de domínio personalizado e múltiplas filiais.
                  </p>
                </div>
                <ul className="text-[10.5px] text-slate-500 mt-4 space-y-2 border-t border-slate-200 pt-4">
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Profissionais ilimitados</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Domínio .com.br do salão</li>
                  <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Gerente dedicado de conta</li>
                </ul>
              </div>
            </div>

            {/* INTERACTIVE METRIC ESTIMATOR */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold mb-4">Calculadora de Escala SaaS do Platform Owner</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Número de Barbearias Clientes Ativos</span>
                      <strong className="text-blue-600 font-mono">{activeUsersSim}</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="1000"
                      step="10"
                      value={activeUsersSim}
                      onChange={(e) => setActiveUsersSim(Number(e.target.value))}
                      className="w-full accent-teal-500 h-1 rounded-lg bg-slate-800 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Multiplicador por Premium/SMS Adicionais</span>
                      <strong className="text-blue-600 font-mono">x {customPriceMultiplier.toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={customPriceMultiplier}
                      onChange={(e) => setCustomPriceMultiplier(Number(e.target.value))}
                      className="w-full accent-teal-500 h-1 rounded-lg bg-slate-800 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-white duration-200 p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center text-center">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 tracking-wider">MRR Projetado (Mensal)</span>
                      <p className="text-xl md:text-2xl font-bold font-mono text-blue-600 mt-1">R$ {calculatedMRR}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 tracking-wider">ARR Projetado (Anual)</span>
                      <p className="text-xl md:text-2xl font-bold font-mono text-indigo-600 mt-1">R$ {calculatedARR}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-550 mt-4 italic leading-relaxed">
                    *Assumindo um ticket médio ponderado aproximado baseado no setup padrão da nossa API de cobrança e descontando Churn mensal estimado de 1.8%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ROADMAP & REGRAS DE NEGÓCIO */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest font-bold border-b border-slate-200 pb-2">Regras Críticas de Negócio</h4>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-blue-600 font-semibold block">⏳ Regra Trial Grátis de 10 Dias</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      Não exige cartão no setup. No 11º dia sem assinatura contratada, a agenda pública é pausada, impedindo novos agendamentos e exibindo tela de "Bloqueio Temporário" por falta de pagamento.
                    </p>
                  </div>

                  <div>
                    <span className="text-blue-600 font-semibold block">💬 Lembretes Inteligentes via Whatsapp</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      O lembrete envia automaticamente um link de "Confirmar Presença" e outro de "Cancelar de Forma Segura". Se confirmado pelo cliente final via Whatsapp, o status é alterado de forma automatizada na agenda para <strong>confirmado</strong> sem ação do gerente do salão.
                    </p>
                  </div>

                  <div>
                    <span className="text-blue-600 font-semibold block">📊 Relatórios & Histórico em Tempo Real</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      Armazena, computa e exibe dados analíticos detalhados de ticket médio, faturamento líquido, assiduidade por cliente e evolução das comissões financeiras dos barbeiros visagistas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest font-bold border-b border-slate-200 pb-2">Estratégia de Escalabilidade Técnica</h4>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-indigo-600 font-semibold block">📦 Infraestrutura de Contêineres Automáticos</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      Hospedagem em nuvem Docker/Kubernetes na AWS com auto-scaling ativado no gateway. O processador gerencia picos de tráfego de forma otimizada escalando novas réplicas de execução automaticamente se a CPU passar de 65%.
                    </p>
                  </div>

                  <div>
                    <span className="text-indigo-600 font-semibold block">🚀 Otimização do Banco (Replicação de Leitura)</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      O aplicativo separa rotas de gravação de agendamento (escrita) da renderização pública de horários das barbearias (leitura). A exibição pública consome de réplicas de leitura PostgreSQL, reduzindo concorrência.
                    </p>
                  </div>

                  <div>
                    <span className="text-indigo-600 font-semibold block">⚡ Cache Atômico com Redis</span>
                    <p className="text-slate-500 text-xs leading-relaxed mt-1">
                      Os horários de funcionamento e slots já preenchidos das próximas 48 horas são armazenados em cache atômico Redis. Isso impede queries pesadas ao banco em acessos repetitivos de usuários via smartphone.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* ROADMAP CRONOLÓGICO */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest font-bold mb-4">Roadmap do Produto (Fase de Evolução Comercial)</h4>
              
              <div className="relative border-l border-slate-200 ml-4 py-2 space-y-8">
                
                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-500/10"></div>
                  <span className="text-[10px] font-mono text-blue-600 font-bold">Fase 01 - MVP Consolidado (Atual)</span>
                  <h5 className="text-xs font-bold text-slate-900 mt-0.5">Lançamento dos Dashboards e Agendamentos Básicos</h5>
                  <p className="text-xs text-slate-500 mt-1">Estrutura SaaS com suporte a multi-tenancy, agenda móvel e simulação de automações via Whatsapp.</p>
                </div>

                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  <span className="text-[10px] font-mono text-slate-500">Fase 02 - Q2 2026</span>
                  <h5 className="text-xs font-bold text-slate-700 mt-0.5">Integração Real de APIs e Split de Pagamentos</h5>
                  <p className="text-xs text-slate-500 mt-1">Ativação de Webhooks oficiais do WhatsApp Business API e Split automatizado de Pix e Cartão com taxas reduzidas.</p>
                </div>

                <div className="relative pl-6">
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  <span className="text-[10px] font-mono text-slate-500">Fase 03 - Q3 2026</span>
                  <h5 className="text-xs font-bold text-slate-700 mt-0.5">Inteligência Artificial & Otimização de Slots</h5>
                  <p className="text-xs text-slate-500 mt-1">Treinamento de IA de agendamento por comandos de voz automatizado e reorganização inteligente de gaps na agenda.</p>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
