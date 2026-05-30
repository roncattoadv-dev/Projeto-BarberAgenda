/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Tenant, Coupon, SupportTicket, AuditLog } from '../types';
import { TrendingUp, Users, ShieldAlert, DollarSign, Calendar, Eye, Ban, CheckCircle, Ticket, HeartHandshake, ShieldCheck, Plus, RefreshCw, Send } from 'lucide-react';

interface SuperAdminPanelProps {
  tenants: Tenant[];
  onUpdateTenantStatus: (tenantId: string, status: 'active' | 'blocked' | 'trial') => void;
  onExtendTrial: (tenantId: string) => void;
  coupons: Coupon[];
  onAddCoupon: (code: string, discount: number, expiresAt: string) => void;
  supportTickets: SupportTicket[];
  onResolveTicket: (ticketId: string, replyMessage?: string) => void;
  auditLogs: AuditLog[];
}

export default function SuperAdminPanel({
  tenants,
  onUpdateTenantStatus,
  onExtendTrial,
  coupons,
  onAddCoupon,
  supportTickets,
  onResolveTicket,
  auditLogs
}: SuperAdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tenants' | 'coupons' | 'suporte' | 'logs'>('tenants');
  
  // New coupon form states
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState(15);
  const [newExpiry, setNewExpiry] = useState('2026-12-31');

  // Interactive ticket response
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');

  // Calculate platform real-time metrics
  const activeCount = tenants.filter(t => t.status === 'active').length;
  const trialCount = tenants.filter(t => t.status === 'trial').length;
  const blockedCount = tenants.filter(t => t.status === 'blocked').length;
  
  const mrrTotal = tenants
    .filter(t => t.status === 'active')
    .reduce((sum, t) => sum + t.mrr, 0);

  const estimatedAnnualRunRate = mrrTotal * 12;

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    onAddCoupon(newCode.trim().toUpperCase(), newDiscount, newExpiry);
    setNewCode('');
    setNewDiscount(15);
  };

  const handleSendReply = () => {
    if (!selectedTicketId || !adminReply.trim()) return;
    onResolveTicket(selectedTicketId, adminReply.trim());
    setAdminReply('');
    setSelectedTicketId(null);
  };

  const selectedTicket = supportTickets.find(t => t.id === selectedTicketId);

  return (
    <div id="super-admin-root" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header banner */}
      <div className="bg-slate-50 p-6 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[10px] font-mono text-blue-600 font-bold uppercase tracking-wider">Mecanismo Central SaaS</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 font-sans tracking-tight uppercase">
              CONSOLE MASTER DE GOVERNANÇA (SUPER ADMIN)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Painel analítico para gestão multi-tenant, controle de faturamento, liberação de assinaturas, cupons e filtragem global.
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-md px-2 py-2 border border-slate-200/60 rounded-full flex flex-wrap gap-2 self-start md:self-center shadow-sm ring-1 ring-slate-900/5">
            {[
              { id: 'tenants', label: `Assinantes (${tenants.length})`, icon: Users },
              { id: 'coupons', label: `Cupons (${coupons.length})`, icon: Ticket },
              { id: 'suporte', label: `Suporte (${supportTickets.filter(t => t.status === 'open').length})`, icon: HeartHandshake },
              { id: 'logs', label: 'Rastreio', icon: ShieldCheck }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as 'tenants' | 'coupons' | 'suporte' | 'logs')}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full transition-all duration-300 cursor-pointer ${
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
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 p-6 border-b border-slate-200 bg-slate-50/20">
        
        <div className="glass-card p-4 rounded-xl shadow-3xs hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">MRR Atual</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg md:text-xl font-bold font-mono text-emerald-600 mt-2">
            R$ {mrrTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-slate-450 font-mono mt-0.5 block">Recorrência Mensal</span>
        </div>

        <div className="glass-card p-4 rounded-xl shadow-3xs hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">ARR Estimado</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-lg md:text-xl font-bold font-mono text-blue-600 mt-2">
            R$ {estimatedAnnualRunRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-slate-450 font-mono mt-0.5 block">Anualizado</span>
        </div>

        <div className="glass-card p-4 rounded-xl shadow-3xs hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Clientes Ativos</span>
            <Users className="w-4 h-4 text-slate-550" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800 mt-2">{activeCount}</p>
          <span className="text-[9px] text-blue-600 font-mono mt-0.5 block">Empresas Adimplentes</span>
        </div>

        <div className="glass-card p-4 rounded-xl shadow-3xs hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Em Teste Ativo</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-800 mt-2">{trialCount}</p>
          <span className="text-[9px] text-amber-600 font-mono mt-0.5 block">10 dias gratuitos</span>
        </div>

        <div className="glass-card p-4 rounded-xl shadow-3xs col-span-2 lg:col-span-1 hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Churn Mensal</span>
            <ShieldAlert className="w-4 h-4 text-red-550" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-850 mt-2">1,8%</p>
          <span className="text-[9px] text-slate-450 mt-0.5 block font-mono">Benchmark de Mercado</span>
        </div>

      </div>

      {/* Sub-tab content blocks */}
      <div className="p-6">
        
        {/* SUBTAB 1: MANAGING TENANTS/SUBSCRIBERS */}
        {activeSubTab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Lista Geral de Barbearias & Salões Assinantes</h3>
              <p className="text-xs font-mono text-slate-450">Modificações aqui se aplicam ao ambiente em Tempo Real</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border border-slate-150 rounded-xl overflow-hidden shadow-2xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase text-[10px] bg-slate-50">
                    <th className="py-3 px-4">Salão / Barbearia</th>
                    <th className="py-3 px-4">Plano</th>
                    <th className="py-3 px-4">MRR Recorrência</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Fim da Adimplência</th>
                    <th className="py-3 px-4 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 bg-white">
                  {tenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-4 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-xl bg-slate-50 p-1.5 rounded-lg border border-slate-150 shadow-3xs">{tenant.logo}</span>
                          <div>
                            <p className="font-semibold">{tenant.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono block">slug: {tenant.slug}.saasbarber.io</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-semibold uppercase text-slate-600">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          tenant.plan === 'anual' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' :
                          tenant.plan === 'semestral' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                          tenant.plan === 'mensal' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                          'bg-slate-100 text-slate-450'
                        }`}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-200">
                        R$ {tenant.mrr.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          tenant.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          tenant.status === 'trial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            tenant.status === 'active' ? 'bg-green-500' :
                            tenant.status === 'trial' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                          {tenant.status === 'active' ? 'Ativo' :
                           tenant.status === 'trial' ? 'Teste Grátis' : 'Inadimplente (Bloq)'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-450">
                        {tenant.status === 'trial' ? 'Vence Teste em' : 'Vence Assinatura em'}
                        <p className="text-slate-250 font-semibold">{tenant.trialEndsAt}</p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {tenant.status !== 'active' && (
                            <button
                              id={`btn-approve-${tenant.id}`}
                              onClick={() => {
                                onUpdateTenantStatus(tenant.id, 'active');
                                alert(`${tenant.name} ativado e plano liberado com sucesso!`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded font-mono border border-green-500/20 transition-all flex items-center gap-1"
                              title="Aprovar Pagamento e Ativar"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Liberar
                            </button>
                          )}
                          {tenant.status !== 'blocked' && (
                            <button
                              id={`btn-block-${tenant.id}`}
                              onClick={() => {
                                onUpdateTenantStatus(tenant.id, 'blocked');
                                alert(`${tenant.name} bloqueado por atraso de pagamento de assinatura.`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded font-mono border border-red-500/10 transition-all flex items-center gap-1"
                              title="Bloquear Acesso"
                            >
                              <Ban className="w-3.5 h-3.5" /> Bloquear
                            </button>
                          )}
                          {tenant.status === 'trial' && (
                            <button
                              id={`btn-extend-${tenant.id}`}
                              onClick={() => {
                                onExtendTrial(tenant.id);
                                alert(`Prazo estendido em mais 10 dias para ${tenant.name}! Nova expiração: ${tenants.find(t => t.id === tenant.id)?.trialEndsAt}`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded font-mono border border-amber-500/10 transition-all flex items-center gap-1"
                              title="Estender mais 10 dias de teste"
                            >
                              +10d Teste
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 2: MANAGING PROMOTIONAL COUPONS */}
        {activeSubTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Coupon Creation Form */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 h-fit">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" /> Cadastrar Novo Cupom
              </h4>
              
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Código do Cupom</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="EX: INVERNO30"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:outline-none rounded px-3 py-1.5 text-xs text-slate-200 font-mono tracking-wider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Desconto (%)</label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={100}
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:outline-none rounded px-3 py-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Expiração</label>
                    <input
                      type="date"
                      required
                      value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 focus:outline-none rounded px-3 py-1.5 text-xs text-slate-250 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all active:scale-[0.99]"
                >
                  Confirmar Cadastro
                </button>
              </form>
            </div>

            {/* Coupons List */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 lg:col-span-2 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">Cupons de Campanha Ativos no SaaS</h4>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-350">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-500 font-mono uppercase text-[9px]">
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Desconto [%]</th>
                      <th className="py-2.5 px-3">Expira em</th>
                      <th className="py-2.5 px-3">Qtd Usos</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {coupons.map(coupon => (
                      <tr key={coupon.id} className="hover:bg-slate-900/50">
                        <td className="py-3 px-3 font-mono text-teal-300 font-bold tracking-wider">{coupon.code}</td>
                        <td className="py-3 px-3 font-semibold text-slate-200">{coupon.discountPercentage}% OFF</td>
                        <td className="py-3 px-3 font-mono text-slate-450 text-[11px]">{coupon.expiresAt}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{coupon.usageCount} assinaturas</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                            coupon.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {coupon.status === 'active' ? 'Ativo' : 'Clausurado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* SUBTAB 3: SUPPORT TICKETS RECONCILIATION */}
        {activeSubTab === 'suporte' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tickets selector */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider border-b border-slate-850 pb-2">Chamados de Suporte Técnicos Recentes</h4>
              
              <div className="space-y-3 max-h-[380px] overflow-y-auto">
                {supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedTicketId === ticket.id ? 'border-purple-500 bg-slate-900 shadow-md' : 'border-slate-850 bg-slate-950 hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-slate-500 font-bold">{ticket.tenantName}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                        ticket.status === 'open' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-slate-200">{ticket.title}</h5>
                    <div className="flex justify-between items-center mt-3 text-[10px] text-slate-450">
                      <span>Iniciado: {ticket.createdAt}</span>
                      <span className="text-purple-400 text-xs">Conversar &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket messages log */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between min-h-[380px]">
              {selectedTicket ? (
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div>
                    <div className="border-b border-slate-850 pb-3 mb-4 flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">{selectedTicket.tenantName}</h4>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{selectedTicket.title}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Id: #{selectedTicket.id}</span>
                    </div>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {selectedTicket.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-xs leading-relaxed max-w-[85%] ${
                            msg.sender === 'tenant' ? 'bg-slate-900 border border-slate-850 text-slate-200 self-start' :
                            msg.sender === 'system' ? 'bg-slate-950 border border-dashed border-slate-800 text-slate-400 text-[11px] text-center max-w-full' :
                            'bg-purple-650 text-white ml-auto'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 text-[9px] text-slate-400 mb-1 font-mono">
                            <span className="font-bold">{
                              msg.sender === 'tenant' ? 'Abonado Tenant' :
                              msg.sender === 'system' ? 'Sistema SaaS' : 'Atendente SuperAdmin'
                            }</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <p>{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTicket.status === 'open' ? (
                    <div className="border-t border-slate-850 pt-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={adminReply}
                          onChange={(e) => setAdminReply(e.target.value)}
                          placeholder="Digite a resposta do suporte ou resolutiva..."
                          className="flex-grow bg-slate-900 text-xs focus:outline-none focus:border-purple-500 border border-slate-800 rounded px-3 py-1.5"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendReply();
                          }}
                        />
                        <button
                          onClick={handleSendReply}
                          className="px-3 bg-purple-600 hover:bg-purple-500 text-white rounded transition flex items-center justify-center"
                          id="btn-reply-support"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-550 mt-1 block">*Ao enviar, o status do ticket é automaticamente marcado para "Resolvido"</span>
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-850 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span>Este chamado já foi solucionado e fechado pelo suporte técnico corporativo.</span>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-2 text-slate-500 h-full">
                  <HeartHandshake className="w-10 h-10 text-slate-700 mb-2" />
                  <p className="text-xs">Central de Suporte Unificado</p>
                  <p className="text-[10px] text-slate-600 max-w-[280px]">Selecione um chamado pendente à esquerda para ler as mensagens e responder ao cliente.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* SUBTAB 4: LGPD SECURITY & TRACKING AUDIT LOGS */}
        {activeSubTab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Registro Geral de Logs Técnicos & Conformidade LGPD
                  </h4>
                  <p className="text-[11px] text-slate-450 mt-0.5">Visor obrigatório para rastreabilidade de requisições de alteração de dados do SaaS.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> LGPD Ativa
                  </span>
                  <span className="text-slate-500">|</span>
                  <span>IP Guard: Ativo</span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {auditLogs.map(log => (
                  <div key={log.id} className="bg-slate-900 p-3 rounded-xl border border-slate-850 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-500 font-mono mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-400">{log.userName}</span>
                        <span>({log.userId})</span>
                        {log.tenantId && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px]">
                            Tenant: {log.tenantId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>IP: {log.ip}</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.2 rounded bg-slate-800 text-teal-400 font-mono text-[10px] font-semibold shrink-0">
                        {log.action}
                      </span>
                      <p className="text-slate-300 font-medium">{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/40 p-3.5 rounded-lg border border-dashed border-slate-800 text-[11px] text-slate-450 leading-relaxed font-mono">
                🔒 <strong>Importante:</strong> Em obediência aos parágrafos da Lei Geral de Proteção de Dados (LGPD - nº 13.709), o SaaS de Agendamento bloqueia requisições brutas de dump de banco de dados por terceiros, remove registros de cache após 30 dias de cancelamento e audita tentativas não aprovadas de acessos de rotas que necessitem de políticas de RLS.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
