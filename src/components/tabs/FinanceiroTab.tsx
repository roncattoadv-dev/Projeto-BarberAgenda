import React, { useState, useMemo } from 'react';
import { Payment, Professional, Appointment, Service, Tenant } from '../../types';
import {
  TrendingUp, TrendingDown, DollarSign, Users,
  ShoppingBag, Trash2, RefreshCw, Calendar,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

interface Props {
  activeTenant: Tenant;
  myPayments: Payment[];
  myProfessionals: Professional[];
  myAppointments: Appointment[];
  myServices: Service[];
  onAddPayment: (payment: Omit<Payment, 'id'>) => void;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PIE_COLORS = ['#38BDF8', '#818CF8', '#34D399', '#FB923C', '#A78BFA', '#F472B6'];
const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function trendPct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function TrendBadge({ pct, invertColor }: { pct: number | null; invertColor?: boolean }) {
  if (pct === null) return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const up = pct >= 0;
  const good = invertColor ? !up : up;
  const color = good ? '#4ade80' : '#fca5a5';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color }}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(pct).toFixed(1)}% vs mês anterior
    </span>
  );
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding: 24,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.55)',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
};

const subText: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.38)',
  borderBottom: '1px solid rgba(255,255,255,0.09)',
  paddingBottom: 14,
  marginBottom: 14,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function FinanceiroTab({
  activeTenant, myPayments, myProfessionals, myAppointments, myServices, onAddPayment,
}: Props) {
  const toast = useToast();
  const now = new Date();
  const nowStr = now.toISOString().replace('T', ' ').substring(0, 19);

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [directSaleDesc, setDirectSaleDesc] = useState('');
  const [directSaleAmount, setDirectSaleAmount] = useState(0);
  const [directSaleMethod, setDirectSaleMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseDesc, setExpenseDesc] = useState('');

  const periodStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
  const prevPeriodStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const periodPayments = myPayments.filter(p => p.date.startsWith(periodStr));
  const prevPayments = myPayments.filter(p => p.date.startsWith(prevPeriodStr));

  const totalRevenue = periodPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpenses = periodPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const periodAtendimentos = myAppointments.filter(a => a.date.startsWith(periodStr) && a.status === 'attended').length;

  const prevRevenue = prevPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const prevExpenses = prevPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const prevAtendimentos = myAppointments.filter(a => a.date.startsWith(prevPeriodStr) && a.status === 'attended').length;

  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(selectedYear, selectedMonth - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rev = myPayments.filter(p => p.status === 'paid' && p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0);
      const exp = myPayments.filter(p => p.status === 'refunded' && p.date.startsWith(key)).reduce((s, p) => s + p.amount, 0);
      return { month: MONTHS[d.getMonth()], Receitas: rev, Despesas: exp };
    });
  }, [myPayments, selectedMonth, selectedYear]);

  const [pieMode, setPieMode] = useState<'servico' | 'profissional'>('servico');

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    myAppointments
      .filter(a => a.date.startsWith(periodStr) && a.status === 'attended')
      .forEach(a => {
        const svc = myServices.find(s => s.id === a.serviceId);
        const cat = svc?.category ?? 'Outros';
        map[cat] = (map[cat] || 0) + a.price;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [myAppointments, myServices, periodStr]);

  const pieDataByProf = useMemo(() => {
    const map: Record<string, number> = {};
    myAppointments
      .filter(a => a.date.startsWith(periodStr) && a.status === 'attended')
      .forEach(a => {
        const prof = myProfessionals.find(p => p.id === a.professionalId);
        const name = prof?.name ?? 'Sem profissional';
        map[name] = (map[name] || 0) + a.price;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [myAppointments, myProfessionals, periodStr]);

  const commissions = myProfessionals.map(prof => {
    const closed = myAppointments.filter(a => a.professionalId === prof.id && a.status === 'attended' && a.date.startsWith(periodStr));
    const total = closed.reduce((s, a) => s + a.price, 0);
    const comm = total * (prof.commissionPercentage / 100);
    return { id: prof.id, name: prof.name, closedCount: closed.length, commissionPct: prof.commissionPercentage, totalEarned: total, dueCommission: comm };
  });

  const handleDirectSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSaleDesc.trim() || directSaleAmount <= 0) { toast.error('Preencha descrição e valor.'); return; }
    onAddPayment({ tenantId: activeTenant.id, amount: directSaleAmount, method: directSaleMethod, status: 'paid', date: nowStr, description: `PDV: ${directSaleDesc.trim()}` });
    toast.success(`R$ ${directSaleAmount.toFixed(2)} registrado!`);
    setDirectSaleDesc(''); setDirectSaleAmount(0);
  };

  const handleExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseDesc.trim()) { toast.error('Preencha valor e descrição.'); return; }
    onAddPayment({ tenantId: activeTenant.id, amount: expenseAmount, method: 'cash', status: 'refunded', date: nowStr, description: `Despesa: ${expenseDesc}` });
    toast.success('Despesa lançada!');
    setExpenseAmount(0); setExpenseDesc('');
  };

  const methodLabel: Record<string, string> = { pix: 'PIX', cash: 'Dinheiro', credit_card: 'Cartão' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">

      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Calendar size={15} style={{ color: 'rgba(255,255,255,0.35)' }} />
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="navy-select"
          style={{ maxWidth: 130 }}
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="navy-select"
          style={{ maxWidth: 100 }}
        >
          {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
          {MONTHS[selectedMonth]} {selectedYear}
        </span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {/* Faturamento Bruto */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Faturamento Bruto</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={17} style={{ color: '#4ade80' }} />
            </div>
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.5px', fontFamily: 'monospace' }}>
            {fmtCurrency(totalRevenue)}
          </span>
          <TrendBadge pct={trendPct(totalRevenue, prevRevenue)} />
        </div>

        {/* Despesas */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Despesas Totais</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(252,165,165,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={17} style={{ color: '#fca5a5' }} />
            </div>
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.5px', fontFamily: 'monospace' }}>
            {fmtCurrency(totalExpenses)}
          </span>
          <TrendBadge pct={trendPct(totalExpenses, prevExpenses)} invertColor />
        </div>

        {/* Lucro Líquido */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Lucro Líquido</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={17} style={{ color: '#38BDF8' }} />
            </div>
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', fontFamily: 'monospace', color: netProfit >= 0 ? '#4ade80' : '#fca5a5' }}>
            {fmtCurrency(netProfit)}
          </span>
          <TrendBadge pct={trendPct(netProfit, prevRevenue - prevExpenses)} />
        </div>

        {/* Atendimentos */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Atendimentos</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={17} style={{ color: 'rgba(255,255,255,0.55)' }} />
            </div>
          </div>
          <span style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.5px', fontFamily: 'monospace' }}>
            {periodAtendimentos}
          </span>
          <TrendBadge pct={trendPct(periodAtendimentos, prevAtendimentos)} />
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Line chart */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Desempenho Semestral</span>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingTop: 8 }} />
              <Line type="monotone" dataKey="Receitas" stroke="#38BDF8" strokeWidth={2.5} dot={{ r: 3, fill: '#38BDF8' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Despesas" stroke="#fca5a5" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#fca5a5' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Faturamento</span>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3, gap: 2 }}>
              {(['servico', 'profissional'] as const).map(mode => (
                <button key={mode} onClick={() => setPieMode(mode)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: pieMode === mode ? 'rgba(255,255,255,0.14)' : 'transparent', color: pieMode === mode ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', transition: 'all 150ms' }}>
                  {mode === 'servico' ? 'Serviço' : 'Profissional'}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const data = pieMode === 'servico' ? pieData : pieDataByProf;
            return data.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {data.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmtCurrency(v)}
                      contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{d.name}</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>
                        {fmtCurrency(d.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                Nenhum atendimento neste período.
              </div>
            );
          })()}
        </div>
      </div>

      {/* Forms row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        {/* Receita Avulsa */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={sectionLabel}>
            <ShoppingBag style={{ width: 14, height: 14, color: '#4ade80' }} /> Receita Avulsa
          </h3>
          <p style={subText}>Faturamento direto de balcão.</p>
          <form onSubmit={handleDirectSale} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="navy-label">Descrição</label>
              <input type="text" required placeholder="Ex: Venda de produto" value={directSaleDesc} onChange={e => setDirectSaleDesc(e.target.value)} className="navy-input" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="navy-label">Valor (R$)</label>
                <input type="number" required min={1} value={directSaleAmount || ''} onChange={e => setDirectSaleAmount(Number(e.target.value))} className="navy-input" />
              </div>
              <div>
                <label className="navy-label">Forma</label>
                <select value={directSaleMethod} onChange={e => setDirectSaleMethod(e.target.value as any)} className="navy-select">
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão</option>
                </select>
              </div>
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Lançar Receita
            </button>
          </form>
        </div>

        {/* Despesa */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={sectionLabel}>
            <Trash2 style={{ width: 14, height: 14, color: '#fca5a5' }} /> Registrar Despesa
          </h3>
          <p style={subText}>Débito manual de pagamentos.</p>
          <form onSubmit={handleExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="navy-label">Valor (R$)</label>
              <input type="number" required min={1} value={expenseAmount || ''} onChange={e => setExpenseAmount(Number(e.target.value))} className="navy-input" />
            </div>
            <div>
              <label className="navy-label">Descrição</label>
              <input type="text" required placeholder="Ex: Lavanderia" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="navy-input" />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Confirmar Despesa
            </button>
          </form>
        </div>

        {/* Comissões */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={sectionLabel}>
            <DollarSign style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.55)' }} /> Comissões
          </h3>
          <p style={subText}>Repasse do período selecionado.</p>
          <div style={{ maxHeight: 210, overflowY: 'auto' }} className="no-scrollbar">
            {commissions.length > 0 ? commissions.map(c => (
              <div key={c.id} style={{ padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, marginBottom: 2 }}>{c.name}</p>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{c.closedCount} atend. · {c.commissionPct}%</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{fmtCurrency(c.dueCommission)}</span>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Salão: {fmtCurrency(c.totalEarned - c.dueCommission)}</p>
                </div>
              </div>
            )) : (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, paddingTop: 8 }}>Sem atendimentos no período.</p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 14 }}>
          <h3 style={{ ...sectionLabel, marginBottom: 0 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Lançamentos do Período
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: 'monospace' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>+ {fmtCurrency(totalRevenue)}</span>
            <span style={{ color: '#fca5a5', fontWeight: 700 }}>− {fmtCurrency(totalExpenses)}</span>
            <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>= {fmtCurrency(netProfit)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                {['Data', 'Descrição', 'Profissional', 'Método', 'Valor', 'Status'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Status' ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodPayments.length > 0 ? [...periodPayments].reverse().map((p, idx) => {
                const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
                const prof = appt ? myProfessionals.find(pr => pr.id === appt.professionalId) : undefined;
                return (
                  <tr key={p.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{p.date.substring(0, 10)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{p.description}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: prof ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)' }}>
                      {prof?.name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace' }}>{methodLabel[p.method] ?? p.method}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontFamily: 'monospace' }}>
                      {p.status === 'refunded'
                        ? <span style={{ color: '#fca5a5' }}>− {fmtCurrency(p.amount)}</span>
                        : <span style={{ color: '#4ade80' }}>+ {fmtCurrency(p.amount)}</span>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: p.status === 'paid' ? 'rgba(74,222,128,0.12)' : 'rgba(252,165,165,0.12)', color: p.status === 'paid' ? '#4ade80' : '#fca5a5' }}>
                        {p.status === 'paid' ? 'Pago' : 'Saída'}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Nenhuma transação em {MONTHS[selectedMonth]} {selectedYear}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
