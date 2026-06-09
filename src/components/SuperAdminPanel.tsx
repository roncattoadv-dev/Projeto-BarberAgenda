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
  const [activeSubTab, setActiveSubTab] = useState<'tenants' | 'coupons' | 'suporte' | 'logs' | 'integracoes'>('tenants');

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

  const tabs = [
    { id: 'tenants', label: `Assinantes (${tenants.length})`,   icon: Users },
    { id: 'coupons', label: `Cupons (${coupons.length})`,        icon: Ticket },
    { id: 'suporte', label: `Suporte (${supportTickets.filter(t => t.status === 'open').length})`, icon: HeartHandshake },
    { id: 'logs',    label: 'Rastreio',                           icon: ShieldCheck },
    { id: 'integracoes', label: 'Integrações',                      icon: RefreshCw },
  ] as const;

  // Shared input style for the dark forms
  const darkInput: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    padding: '9px 12px',
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'Outfit, monospace',
    boxSizing: 'border-box',
  };

  return (
    <div
      id="super-admin-root"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 20,
        overflow: 'hidden',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          background: '#021340',
          padding: '24px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.65)', display: 'inline-block' }} className="animate-pulse" />
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>
                Mecanismo Central SaaS
              </span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.5px' }}>
              CONSOLE MASTER DE GOVERNANÇA
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
              Painel analítico para gestão multi-tenant, controle de faturamento e liberação de assinaturas.
            </p>
          </div>

          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12,
              padding: 4,
              alignSelf: 'flex-start',
            }}
          >
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#031D3C' : 'rgba(255,255,255,0.55)',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} strokeWidth={2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Metric Cards ────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          padding: '20px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        {[
          { label: 'MRR Atual',       value: `R$ ${mrrTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,           sub: 'Recorrência Mensal',   color: '#4ade80' },
          { label: 'ARR Estimado',     value: `R$ ${estimatedAnnualRunRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'Anualizado',           color: 'rgba(255,255,255,0.65)' },
          { label: 'Clientes Ativos',  value: String(activeCount),                                                                                           sub: 'Empresas Adimplentes', color: 'rgba(255,255,255,0.88)' },
          { label: 'Em Teste Ativo',   value: String(trialCount),                                                                                            sub: '10 dias gratuitos',    color: '#fbbf24' },
          { label: 'Churn Mensal',     value: '1,8%',                                                                                                        sub: 'Benchmark de Mercado', color: 'rgba(255,255,255,0.55)' },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12,
              padding: '16px',
            }}
          >
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>
              {card.label}
            </span>
            <p style={{ fontSize: 20, fontWeight: 800, color: card.color, fontFamily: 'monospace', marginBottom: 4 }}>
              {card.value}
            </p>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace' }}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div style={{ padding: '24px 28px' }}>

        {/* SUBTAB 1: TENANTS */}
        {activeSubTab === 'tenants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.55)' }}>
                Lista Geral de Barbearias &amp; Salões Assinantes
              </h3>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                Modificações aplicadas em Tempo Real
              </p>
            </div>

            <div className="overflow-x-auto" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#021340', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                    {['Salão / Barbearia', 'Plano', 'MRR', 'Status', 'Vencimento', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Ações' ? 'right' : 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant, idx) => (
                    <tr
                      key={tenant.id}
                      style={{
                        background: idx % 2 === 0 ? '#ffffff' : '#F6F9FC',
                        borderBottom: '1px solid #e8edf3',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20, background: '#F0F4F8', padding: '6px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            {tenant.logo}
                          </span>
                          <div>
                            <p style={{ fontWeight: 700, color: '#141E2D', fontSize: 13 }}>{tenant.name}</p>
                            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>slug: {tenant.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: tenant.plan === 'anual' ? '#EEF2FF' : tenant.plan === 'trimestral' ? '#F5F3FF' : tenant.plan === 'mensal' ? '#EFF6FF' : '#F1F5F9',
                          color: tenant.plan === 'anual' ? '#4338CA' : tenant.plan === 'trimestral' ? '#6D28D9' : tenant.plan === 'mensal' ? '#1D4ED8' : '#64748B',
                        }}>
                          {tenant.plan}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#141E2D', fontSize: 13 }}>
                        R$ {tenant.mrr.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: tenant.status === 'active' ? '#E6F4EC' : tenant.status === 'trial' ? '#FEF9EC' : '#FEECEC',
                          color: tenant.status === 'active' ? '#0A4A2C' : tenant.status === 'trial' ? '#7A4B0A' : '#7A0A0A',
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: tenant.status === 'active' ? '#16a34a' : tenant.status === 'trial' ? '#d97706' : '#dc2626',
                            flexShrink: 0,
                          }} />
                          {tenant.status === 'active' ? 'Ativo' : tenant.status === 'trial' ? 'Teste Grátis' : 'Bloqueado'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: 12 }}>
                        <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                          {tenant.status === 'trial' ? 'Vence teste em' : 'Vence assinatura em'}
                        </span>
                        <strong style={{ color: '#141E2D' }}>{tenant.trialEndsAt}</strong>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {tenant.status !== 'active' && (
                            <button
                              id={`btn-approve-${tenant.id}`}
                              onClick={() => {
                                onUpdateTenantStatus(tenant.id, 'active');
                                alert(`${tenant.name} ativado e plano liberado com sucesso!`);
                              }}
                              style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, background: '#E6F4EC', color: '#0A4A2C', border: '1px solid #A7D7BC', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCircle style={{ width: 12, height: 12 }} /> Liberar
                            </button>
                          )}
                          {tenant.status !== 'blocked' && (
                            <button
                              id={`btn-block-${tenant.id}`}
                              onClick={() => {
                                onUpdateTenantStatus(tenant.id, 'blocked');
                                alert(`${tenant.name} bloqueado por atraso de pagamento de assinatura.`);
                              }}
                              style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, background: '#FEECEC', color: '#7A0A0A', border: '1px solid #F5B8B8', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Ban style={{ width: 12, height: 12 }} /> Bloquear
                            </button>
                          )}
                          {tenant.status === 'trial' && (
                            <button
                              id={`btn-extend-${tenant.id}`}
                              onClick={() => {
                                onExtendTrial(tenant.id);
                                alert(`Prazo estendido em mais 10 dias para ${tenant.name}! Nova expiração: ${tenants.find(t => t.id === tenant.id)?.trialEndsAt}`);
                              }}
                              style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, background: '#FEF9EC', color: '#7A4B0A', border: '1px solid #F5DCB0', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace' }}
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

        {/* SUBTAB 2: COUPONS */}
        {activeSubTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Coupon Creation Form */}
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                padding: 20,
              }}
              className="space-y-4 h-fit"
            >
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.38)' }} /> Cadastrar Novo Cupom
              </h4>

              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Código do Cupom
                  </label>
                  <input
                    type="text" required maxLength={15} value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="EX: INVERNO30"
                    style={{ ...darkInput, letterSpacing: '2px' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Desconto (%)
                    </label>
                    <input
                      type="number" required min={5} max={100} value={newDiscount}
                      onChange={(e) => setNewDiscount(Number(e.target.value))}
                      style={darkInput}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      Expiração
                    </label>
                    <input
                      type="date" required value={newExpiry}
                      onChange={(e) => setNewExpiry(e.target.value)}
                      style={darkInput}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#ffffff',
                    color: '#031D3C',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  Confirmar Cadastro
                </button>
              </form>
            </div>

            {/* Coupons List */}
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                padding: 20,
              }}
              className="lg:col-span-2 space-y-3"
            >
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
                Cupons Ativos no SaaS
              </h4>

              <div className="overflow-x-auto" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#021340', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                      {['Código', 'Desconto', 'Expira em', 'Usos', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.38)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((coupon, idx) => (
                      <tr key={coupon.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#F6F9FC', borderBottom: '1px solid #e8edf3' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#141E2D', letterSpacing: '1px' }}>{coupon.code}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#141E2D' }}>{coupon.discountPercentage}% OFF</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b', fontSize: 11 }}>{coupon.expiresAt}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{coupon.usageCount} usos</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: coupon.status === 'active' ? '#E6F4EC' : '#FEECEC',
                            color: coupon.status === 'active' ? '#0A4A2C' : '#7A0A0A',
                          }}>
                            {coupon.status === 'active' ? 'Ativo' : 'Expirado'}
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

        {/* SUBTAB 3: SUPPORT TICKETS */}
        {activeSubTab === 'suporte' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                padding: 20,
              }}
              className="space-y-4"
            >
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 10 }}>
                Chamados de Suporte Recentes
              </h4>

              <div className="space-y-3 max-h-[380px] overflow-y-auto">
                {supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: `1px solid ${selectedTicketId === ticket.id ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.09)'}`,
                      background: selectedTicketId === ticket.id ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', fontWeight: 700 }}>{ticket.tenantName}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: ticket.status === 'open' ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)',
                        color: ticket.status === 'open' ? '#fbbf24' : '#4ade80',
                        border: `1px solid ${ticket.status === 'open' ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}`,
                      }}>
                        {ticket.status === 'open' ? 'Aberto' : 'Resolvido'}
                      </span>
                    </div>
                    <h5 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>{ticket.title}</h5>
                    <div className="flex justify-between items-center mt-2" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
                      <span>Iniciado: {ticket.createdAt}</span>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>Conversar →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 380,
              }}
            >
              {selectedTicket ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', gap: 16 }}>
                  <div>
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' }}>{selectedTicket.tenantName}</h4>
                        <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{selectedTicket.title}</p>
                      </div>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>#{selectedTicket.id}</span>
                    </div>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {selectedTicket.messages.map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            fontSize: 12,
                            lineHeight: 1.5,
                            maxWidth: '85%',
                            background: msg.sender === 'tenant' ? 'rgba(255,255,255,0.06)' : msg.sender === 'system' ? 'transparent' : 'rgba(255,255,255,0.12)',
                            border: msg.sender === 'system' ? '1px dashed rgba(255,255,255,0.09)' : '1px solid rgba(255,255,255,0.09)',
                            color: 'rgba(255,255,255,0.88)',
                            marginLeft: msg.sender === 'admin' ? 'auto' : 0,
                            textAlign: msg.sender === 'system' ? 'center' : 'left',
                            maxWidth: msg.sender === 'system' ? '100%' : '85%',
                          } as React.CSSProperties}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 9, color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace', marginBottom: 4 }}>
                            <span style={{ fontWeight: 700 }}>
                              {msg.sender === 'tenant' ? 'Cliente' : msg.sender === 'system' ? 'Sistema' : 'Suporte'}
                            </span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <p>{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTicket.status === 'open' ? (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.09)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text" value={adminReply}
                          onChange={(e) => setAdminReply(e.target.value)}
                          placeholder="Digite a resposta do suporte..."
                          style={{ ...darkInput, flex: 1 }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(); }}
                        />
                        <button
                          onClick={handleSendReply}
                          id="btn-reply-support"
                          style={{
                            padding: '8px 14px',
                            background: '#ffffff',
                            color: '#031D3C',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Send style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 4, display: 'block' }}>
                        *Ao enviar, o ticket é marcado como "Resolvido"
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 12,
                        padding: 16,
                        textAlign: 'center',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.38)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <CheckCircle style={{ width: 18, height: 18, color: '#4ade80' }} />
                      <span>Este chamado já foi solucionado e fechado.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 8, color: 'rgba(255,255,255,0.25)', height: '100%' }}>
                  <HeartHandshake style={{ width: 36, height: 36, marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: 12 }}>Central de Suporte Unificado</p>
                  <p style={{ fontSize: 11, maxWidth: 260 }}>Selecione um chamado à esquerda para ler as mensagens e responder ao cliente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: AUDIT LOGS */}
        {activeSubTab === 'logs' && (
          <div className="space-y-4">
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16,
                padding: 20,
              }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck style={{ width: 14, height: 14, color: '#4ade80' }} /> Registro Geral de Logs &amp; Conformidade LGPD
                  </h4>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>Rastreabilidade de requisições de alteração de dados do SaaS.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle style={{ width: 10, height: 10 }} /> LGPD Ativa
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {auditLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      fontSize: 12,
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{log.userName}</span>
                        <span>({log.userId})</span>
                        {log.tenantId && (
                          <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)', fontSize: 9 }}>
                            Tenant: {log.tenantId}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>IP: {log.ip}</span>
                        <span>•</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(255,255,255,0.07)', color: '#5eead4', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {log.action}
                      </span>
                      <p style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 500, fontSize: 12 }}>{log.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.09)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.38)',
                  lineHeight: 1.6,
                  fontFamily: 'monospace',
                }}
              >
                🔒 Em obediência à LGPD (nº 13.709), o SaaS bloqueia requisições brutas de dump de banco, remove registros após 30 dias de cancelamento e audita tentativas de acesso não autorizadas.
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'integracoes' && (
          <div className="space-y-6 animate-fade-in">
            {/* EvoGo */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 24 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw style={{ width: 13, height: 13 }} /> Evolution Go — WhatsApp API
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[
                  { label: 'URL do EvoGo', key: 'EVO_URL', desc: 'Domínio público do serviço EvoGo no EasyPanel' },
                  { label: 'Chave Global (Admin)', key: 'EVO_GLOBAL_KEY', desc: 'GLOBAL_API_KEY do .env do EvoGo — para criar/deletar instâncias' },
                  { label: 'Instância padrão', key: 'EVO_INSTANCE', desc: 'Nome da instância padrão (substituído pelo slug do tenant)' },
                  { label: 'Token padrão', key: 'EVO_APIKEY', desc: 'Token da instância padrão (cada tenant recebe token próprio)' },
                ].map(({ label, key, desc }) => {
                  const val = (window as any).__BARBER_CONFIG__?.[key] || '—';
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 6 }}>{label}</div>
                      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: key.includes('KEY') || key === 'EVO_APIKEY' ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.75)', letterSpacing: '0.3px' }}>
                        {key.includes('KEY') || key === 'EVO_APIKEY' ? (val !== '—' ? '••••' + val.slice(-6) : '—') : val}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{desc}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 20, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#fbbf24' }}>
                ⚙️ Para alterar as configurações, edite as variáveis de ambiente do serviço <code style={{ background: 'rgba(251,191,36,0.1)', padding: '1px 6px', borderRadius: 4 }}>barberflow-app</code> no EasyPanel e faça redeploy.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
