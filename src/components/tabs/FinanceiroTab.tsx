import React, { useState, useMemo } from 'react';
import { Payment, Professional, Appointment, Service, Tenant } from '../../types';
import {
  TrendingUp, TrendingDown, DollarSign, Users,
  ShoppingBag, Trash2, RefreshCw, Calendar,
  ArrowUpRight, ArrowDownRight, Printer, LayoutDashboard, FileText,
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
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const PIE_COLORS = ['#38BDF8', '#818CF8', '#34D399', '#FB923C', '#A78BFA', '#F472B6'];

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isoWeekStr(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function weekToRange(weekStr: string): { start: string; end: string } {
  const [y, w] = weekStr.split('-W').map(Number);
  const jan4 = new Date(y, 0, 4);
  const dow = jan4.getDay() || 7;
  const mon = new Date(jan4);
  mon.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: fmtDate(mon), end: fmtDate(sun) };
}

function inRange(dateStr: string, start: string, end: string): boolean {
  const d = dateStr.substring(0, 10);
  return d >= start && d <= end;
}
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

  const [view, setView] = useState<'dashboard' | 'relatorio'>('dashboard');
  const [periodType, setPeriodType] = useState<'semana' | 'mes' | 'trimestre'>('mes');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(() => isoWeekStr(now));
  const [selectedQuarter, setSelectedQuarter] = useState(() => Math.floor(now.getMonth() / 3) + 1);
  const [filterProfId, setFilterProfId] = useState('');

  const [directSaleDesc, setDirectSaleDesc] = useState('');
  const [directSaleAmount, setDirectSaleAmount] = useState(0);
  const [directSaleMethod, setDirectSaleMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expenseDesc, setExpenseDesc] = useState('');

  // ── Date ranges from period type ───────────────────────────────────────────
  const dateRange = useMemo((): { start: string; end: string } => {
    if (periodType === 'semana') return weekToRange(selectedWeek);
    if (periodType === 'trimestre') {
      const mStart = (selectedQuarter - 1) * 3;
      const start = `${selectedYear}-${String(mStart + 1).padStart(2, '0')}-01`;
      const end = fmtDate(new Date(selectedYear, mStart + 3, 0));
      return { start, end };
    }
    // mes
    const start = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const end = fmtDate(new Date(selectedYear, selectedMonth + 1, 0));
    return { start, end };
  }, [periodType, selectedMonth, selectedYear, selectedWeek, selectedQuarter]);

  const prevDateRange = useMemo((): { start: string; end: string } => {
    if (periodType === 'semana') {
      const cur = weekToRange(selectedWeek);
      const prevMon = new Date(cur.start);
      prevMon.setDate(prevMon.getDate() - 7);
      const prevSun = new Date(prevMon);
      prevSun.setDate(prevMon.getDate() + 6);
      return { start: fmtDate(prevMon), end: fmtDate(prevSun) };
    }
    if (periodType === 'trimestre') {
      const prevQ = selectedQuarter === 1 ? 4 : selectedQuarter - 1;
      const prevY = selectedQuarter === 1 ? selectedYear - 1 : selectedYear;
      const mStart = (prevQ - 1) * 3;
      return { start: `${prevY}-${String(mStart + 1).padStart(2, '0')}-01`, end: fmtDate(new Date(prevY, mStart + 3, 0)) };
    }
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return { start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }, [periodType, selectedMonth, selectedYear, selectedWeek, selectedQuarter]);

  // Human-readable period label
  const periodLabel = useMemo(() => {
    if (periodType === 'semana') {
      const { start, end } = weekToRange(selectedWeek);
      return `${start.substring(8, 10)}/${start.substring(5, 7)} – ${end.substring(8, 10)}/${end.substring(5, 7)}/${end.substring(0, 4)}`;
    }
    if (periodType === 'trimestre') return `T${selectedQuarter} ${selectedYear}`;
    return `${MONTHS_FULL[selectedMonth]} ${selectedYear}`;
  }, [periodType, selectedMonth, selectedYear, selectedWeek, selectedQuarter]);

  // ── Appointment IDs for prof filter ───────────────────────────────────────
  const profApptIds = useMemo(() => {
    if (!filterProfId) return null;
    return new Set(myAppointments.filter(a => a.professionalId === filterProfId).map(a => a.id));
  }, [myAppointments, filterProfId]);

  const apptFilter = (a: { date: string; status: string; professionalId: string }) =>
    inRange(a.date, dateRange.start, dateRange.end) && a.status === 'attended' && (!filterProfId || a.professionalId === filterProfId);

  const prevApptFilter = (a: { date: string; status: string; professionalId: string }) =>
    inRange(a.date, prevDateRange.start, prevDateRange.end) && a.status === 'attended' && (!filterProfId || a.professionalId === filterProfId);

  // ── Filtered payments ──────────────────────────────────────────────────────
  const periodPayments = useMemo(() => myPayments.filter(p => {
    if (!inRange(p.date, dateRange.start, dateRange.end)) return false;
    if (filterProfId) return !!p.appointmentId && !!profApptIds?.has(p.appointmentId);
    return true;
  }), [myPayments, dateRange, filterProfId, profApptIds]);

  const prevPayments = useMemo(() => myPayments.filter(p => {
    if (!inRange(p.date, prevDateRange.start, prevDateRange.end)) return false;
    if (filterProfId) return !!p.appointmentId && !!profApptIds?.has(p.appointmentId);
    return true;
  }), [myPayments, prevDateRange, filterProfId, profApptIds]);

  const totalRevenue = periodPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpenses = periodPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const periodAtendimentos = myAppointments.filter(apptFilter).length;

  const prevRevenue = prevPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const prevExpenses = prevPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const prevAtendimentos = myAppointments.filter(prevApptFilter).length;

  // ── Trend chart (always last 6 months anchored on today) ──────────────────
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const apptIdsInMonth = filterProfId
        ? new Set(myAppointments.filter(a => a.professionalId === filterProfId).map(a => a.id))
        : null;
      const pay = myPayments.filter(p => p.date.startsWith(key) && (!filterProfId || (!!p.appointmentId && !!apptIdsInMonth?.has(p.appointmentId))));
      return { month: MONTHS[d.getMonth()], Receitas: pay.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0), Despesas: pay.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0) };
    });
  }, [myPayments, myAppointments, filterProfId]);

  const [pieMode, setPieMode] = useState<'servico' | 'profissional'>('servico');

  // Use paid payments as source so the charts match KPI totals exactly
  const paidPayments = useMemo(() =>
    periodPayments.filter(p => p.status === 'paid'),
  [periodPayments]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    paidPayments.forEach(p => {
      const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
      const svc  = appt ? myServices.find(s => s.id === appt.serviceId) : undefined;
      const cat  = svc?.category ?? (appt ? 'Outros' : 'Avulso');
      map[cat] = (map[cat] || 0) + p.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [paidPayments, myAppointments, myServices]);

  const pieDataByProf = useMemo(() => {
    const map: Record<string, number> = {};
    paidPayments.forEach(p => {
      const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
      const prof = appt ? myProfessionals.find(pr => pr.id === appt.professionalId) : undefined;
      const name = prof?.name ?? (p.appointmentId ? 'Prof. removido' : 'Avulso');
      map[name] = (map[name] || 0) + p.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [paidPayments, myAppointments, myProfessionals]);

  const commissions = useMemo(() => {
    const profsToShow = filterProfId ? myProfessionals.filter(p => p.id === filterProfId) : myProfessionals;
    return profsToShow.map(prof => {
      const closed = myAppointments.filter(a => a.professionalId === prof.id && a.status === 'attended' && inRange(a.date, dateRange.start, dateRange.end));
      const total = closed.reduce((s, a) => s + a.price, 0);
      const comm = total * (prof.commissionPercentage / 100);
      return { id: prof.id, name: prof.name, closedCount: closed.length, commissionPct: prof.commissionPercentage, totalEarned: total, dueCommission: comm };
    });
  }, [myProfessionals, myAppointments, dateRange, filterProfId]);

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

  // ── Print: open new window with clean HTML document ───────────────────────
  const handlePrint = () => {
    const profName = filterProfId ? myProfessionals.find(p => p.id === filterProfId)?.name : '';
    const genDate = now.toLocaleDateString('pt-BR');
    const genTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const th = (label: string, align = 'left') =>
      `<th style="padding:8px 12px;text-align:${align};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;border-bottom:2px solid #E2E8F0;background:#F8FAFC;">${label}</th>`;
    const td = (val: string, align = 'left', extra = '') =>
      `<td style="padding:9px 12px;text-align:${align};border-bottom:1px solid #E2E8F0;${extra}">${val}</td>`;

    const kpiCards = [
      { label: 'Faturamento Bruto', val: fmtCurrency(totalRevenue),       color: '#10B981', bg: '#ECFDF5' },
      { label: 'Despesas Totais',   val: fmtCurrency(totalExpenses),       color: '#EF4444', bg: '#FEF2F2' },
      { label: 'Lucro Líquido',     val: fmtCurrency(netProfit),           color: netProfit >= 0 ? '#10B981' : '#EF4444', bg: netProfit >= 0 ? '#ECFDF5' : '#FEF2F2' },
      { label: 'Atendimentos',      val: String(periodAtendimentos),       color: '#0EA5E9', bg: '#F0F9FF' },
    ].map(k => `
      <div style="background:${k.bg};border-radius:10px;padding:16px 18px;flex:1;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748B;margin-bottom:6px;">${k.label}</div>
        <div style="font-size:22px;font-weight:800;color:${k.color};font-family:monospace;">${k.val}</div>
      </div>`).join('');

    const serviceRows = byService.map((s, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'};">
      ${td(`<strong>${s.name}</strong>`)}${td(String(s.count),'right')}${td(fmtCurrency(s.revenue),'right','color:#10B981;font-weight:700;font-family:monospace;')}${td(totalRevenue>0?((s.revenue/totalRevenue)*100).toFixed(1)+'%':'—','right','color:#64748B;')}
    </tr>`).join('');

    const profRows = commissions.filter(c => c.closedCount > 0).map((c, i) => `<tr style="background:${i%2===0?'#fff':'#F8FAFC'};">
      ${td(`<strong>${c.name}</strong>`)}${td(String(c.closedCount),'right')}${td(fmtCurrency(c.totalEarned),'right','color:#10B981;font-weight:700;font-family:monospace;')}${td(c.commissionPct+'%','right','color:#64748B;')}${td(fmtCurrency(c.dueCommission),'right','color:#EF4444;font-weight:700;font-family:monospace;')}${td(fmtCurrency(c.totalEarned-c.dueCommission),'right','font-weight:700;font-family:monospace;')}
    </tr>`).join('');

    const txRows = [...periodPayments].reverse().map((p, i) => {
      const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
      const prof = appt ? myProfessionals.find(pr => pr.id === appt.professionalId) : undefined;
      const isOut = p.status === 'refunded';
      return `<tr style="background:${i%2===0?'#fff':'#F8FAFC'};">
        ${td(`<span style="font-family:monospace;font-size:11px;color:#64748B;">${p.date.substring(0,10)}</span>`)}
        ${td(p.description,'left','font-weight:600;')}
        ${td(prof?.name ?? '<span style="color:#CBD5E1;">—</span>')}
        ${td(`<span style="background:#F1F5F9;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;">${methodLabel[p.method]??p.method}</span>`)}
        ${td(`<span style="color:${isOut?'#EF4444':'#10B981'};font-weight:800;font-family:monospace;">${isOut?'−':'+'} ${fmtCurrency(p.amount)}</span>`,'right')}
        ${td(`<span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${isOut?'#FEF2F2':'#ECFDF5'};color:${isOut?'#EF4444':'#10B981'};">${isOut?'Saída':'Pago'}</span>`,'right')}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório ${periodLabel} — ${activeTenant.name}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0F172A; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8; margin-bottom: 10px; margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .kpi-row { display: flex; gap: 12px; margin-bottom: 4px; }
    .section-break { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
    tfoot td { background: #F1F5F9; font-weight: 700; padding: 10px 12px; border-top: 2px solid #E2E8F0; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #E2E8F0;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${activeTenant.logo ? `<img src="${activeTenant.logo}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;" />` : ''}
      <div>
        <div style="font-size:20px;font-weight:800;letter-spacing:-0.4px;">${activeTenant.name}</div>
        ${activeTenant.address ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">${activeTenant.address}</div>` : ''}
        ${activeTenant.phone ? `<div style="font-size:11px;color:#94A3B8;">${activeTenant.phone}</div>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:700;">Relatório Mensal</div>
      <div style="font-size:13px;color:#475569;margin-top:2px;">${periodLabel}</div>
      ${profName ? `<div style="font-size:12px;color:#0EA5E9;font-weight:600;margin-top:2px;">${profName}</div>` : ''}
      <div style="font-size:11px;color:#94A3B8;margin-top:2px;">Gerado em ${genDate} às ${genTime}</div>
    </div>
  </div>

  <!-- KPIs -->
  <h2>Resumo do Período</h2>
  <div class="kpi-row">${kpiCards}</div>

  <!-- By service -->
  ${byService.length > 0 ? `
  <div class="section-break">
    <h2>Desempenho por Serviço</h2>
    <table>
      <thead><tr>${th('Serviço')}${th('Atendimentos','right')}${th('Faturamento','right')}${th('% do Total','right')}</tr></thead>
      <tbody>${serviceRows}</tbody>
    </table>
  </div>` : ''}

  <!-- By professional -->
  ${commissions.filter(c=>c.closedCount>0).length > 0 ? `
  <div class="section-break">
    <h2>Desempenho por Profissional</h2>
    <table>
      <thead><tr>${th('Profissional')}${th('Atendimentos','right')}${th('Faturamento','right')}${th('Comissão (%)','right')}${th('Valor Comissão','right')}${th('Repasse Salão','right')}</tr></thead>
      <tbody>${profRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Transactions -->
  <div class="section-break">
    <h2>Lançamentos do Período</h2>
    ${periodPayments.length > 0 ? `
    <table>
      <thead><tr>${th('Data')}${th('Descrição')}${th('Profissional')}${th('Método')}${th('Valor','right')}${th('Status','right')}</tr></thead>
      <tbody>${txRows}</tbody>
      <tfoot><tr>
        <td colspan="4">Total do Período</td>
        <td style="text-align:right;color:${netProfit>=0?'#10B981':'#EF4444'};font-family:monospace;">${netProfit>=0?'+':''} ${fmtCurrency(netProfit)}</td>
        <td></td>
      </tr></tfoot>
    </table>` : `<p style="color:#94A3B8;">Nenhuma transação em ${periodLabel}.</p>`}
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:10px;color:#CBD5E1;">
    <span>Gerado pelo WorkAgenda · workagenda.org</span>
    <span>${genDate} às ${genTime}</span>
  </div>

  <script>window.onload=function(){window.print();}<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Permita pop-ups para exportar o relatório.'); return; }
    win.document.write(html);
    win.document.close();
  };

  // ── By service (for report) ──────────────────────────────────────────────
  const byService = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    paidPayments.forEach(p => {
      const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
      if (!appt) return;
      const svc  = myServices.find(s => s.id === appt.serviceId);
      const name = svc ? `${svc.name} (${svc.category})` : 'Serviço removido';
      if (!map[name]) map[name] = { count: 0, revenue: 0 };
      map[name].count++;
      map[name].revenue += p.amount;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [paidPayments, myAppointments, myServices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-fade-in">

      {/* Top bar: period type + period selector + prof filter + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Period type toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['semana', 'mes', 'trimestre'] as const).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={{ padding: '5px 11px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: periodType === t ? 'rgba(255,255,255,0.14)' : 'transparent', color: periodType === t ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', transition: 'all 150ms', textTransform: 'capitalize' }}>
                {t === 'mes' ? 'Mês' : t === 'semana' ? 'Semana' : 'Trimestre'}
              </button>
            ))}
          </div>

          {/* Week picker */}
          {periodType === 'semana' && (
            <input
              type="week"
              value={selectedWeek}
              onChange={e => e.target.value && setSelectedWeek(e.target.value)}
              className="navy-input"
              style={{ maxWidth: 170, padding: '8px 12px', fontSize: 13 }}
            />
          )}

          {/* Month + year selects */}
          {periodType === 'mes' && (<>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="navy-select" style={{ maxWidth: 130 }}>
              {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="navy-select" style={{ maxWidth: 100 }}>
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>)}

          {/* Quarter + year selects */}
          {periodType === 'trimestre' && (<>
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))} className="navy-select" style={{ maxWidth: 100 }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>T{q}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="navy-select" style={{ maxWidth: 100 }}>
              {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>)}

          {/* Professional filter */}
          {myProfessionals.length > 0 && (
            <select value={filterProfId} onChange={e => setFilterProfId(e.target.value)} className="navy-select" style={{ maxWidth: 190 }}>
              <option value="">Todos os profissionais</option>
              {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4, gap: 2 }}>
          {([['dashboard', LayoutDashboard, 'Dashboard'], ['relatorio', FileText, 'Relatório']] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: view === v ? 'rgba(255,255,255,0.12)' : 'transparent', color: view === v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)', transition: 'all 150ms' }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── REPORT VIEW ── */}
      {view === 'relatorio' && (
        <>
          {/* Print button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#38BDF8', color: '#0C1A26', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              <Printer size={15} /> Imprimir / Exportar PDF
            </button>
          </div>

          {/* A4 report body */}
          <div id="monthly-report" style={{ background: '#fff', color: '#0F172A', borderRadius: 16, padding: '40px 48px', maxWidth: 900, width: '100%', margin: '0 auto', fontFamily: 'Outfit, sans-serif', lineHeight: 1.5 }}>

            {/* Report header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {activeTenant.logo && (
                  <img src={activeTenant.logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.4px' }}>{activeTenant.name}</h1>
                  {activeTenant.address && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{activeTenant.address}</p>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Relatório Financeiro</p>
                <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>{periodLabel}</p>
                {filterProfId && <p style={{ fontSize: 12, color: '#0EA5E9', fontWeight: 600, margin: '2px 0 0' }}>{myProfessionals.find(p => p.id === filterProfId)?.name}</p>}
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Gerado em {now.toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* KPI summary */}
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94A3B8', marginBottom: 12 }}>Resumo do Período</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
              {[
                { label: 'Faturamento Bruto', value: totalRevenue, color: '#10B981', bg: '#ECFDF5' },
                { label: 'Despesas Totais',   value: totalExpenses, color: '#EF4444', bg: '#FEF2F2' },
                { label: 'Lucro Líquido',     value: netProfit,    color: netProfit >= 0 ? '#10B981' : '#EF4444', bg: netProfit >= 0 ? '#ECFDF5' : '#FEF2F2' },
                { label: 'Atendimentos',      value: periodAtendimentos, color: '#0EA5E9', bg: '#F0F9FF', isCnt: true },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '16px 18px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>{k.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0, fontFamily: 'monospace' }}>{k.isCnt ? String(k.value) : fmtCurrency(Number(k.value))}</p>
                </div>
              ))}
            </div>

            {/* By service */}
            {byService.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94A3B8', marginBottom: 12 }}>Desempenho por Serviço</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Serviço', 'Atendimentos', 'Faturamento', '% do Total'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Serviço' ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byService.map((s, i) => (
                      <tr key={s.name} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>{s.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{s.count}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#10B981', fontFamily: 'monospace', borderBottom: '1px solid #E2E8F0' }}>{fmtCurrency(s.revenue)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{totalRevenue > 0 ? ((s.revenue / totalRevenue) * 100).toFixed(1) + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* By professional */}
            {commissions.filter(c => c.closedCount > 0).length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94A3B8', marginBottom: 12 }}>Desempenho por Profissional</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Profissional', 'Atendimentos', 'Faturamento', 'Comissão (%)', 'Valor Comissão', 'Repasse Salão'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Profissional' ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.filter(c => c.closedCount > 0).map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>{c.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{c.closedCount}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#10B981', fontFamily: 'monospace', borderBottom: '1px solid #E2E8F0' }}>{fmtCurrency(c.totalEarned)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{c.commissionPct}%</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#EF4444', fontFamily: 'monospace', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{fmtCurrency(c.dueCommission)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0F172A', fontFamily: 'monospace', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>{fmtCurrency(c.totalEarned - c.dueCommission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transactions */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94A3B8', marginBottom: 12 }}>Lançamentos do Período</h2>
              {periodPayments.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Data', 'Descrição', 'Profissional', 'Método', 'Valor', 'Status'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Valor' || h === 'Status' ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...periodPayments].reverse().map((p, i) => {
                      const appt = p.appointmentId ? myAppointments.find(a => a.id === p.appointmentId) : undefined;
                      const prof = appt ? myProfessionals.find(pr => pr.id === appt.professionalId) : undefined;
                      return (
                        <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                          <td style={{ padding: '9px 12px', color: '#64748B', fontFamily: 'monospace', fontSize: 11, borderBottom: '1px solid #E2E8F0' }}>{p.date.substring(0, 10)}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0F172A', borderBottom: '1px solid #E2E8F0' }}>{p.description}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{prof?.name ?? '—'}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>{methodLabel[p.method] ?? p.method}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: p.status === 'refunded' ? '#EF4444' : '#10B981', borderBottom: '1px solid #E2E8F0' }}>
                            {p.status === 'refunded' ? '−' : '+'} {fmtCurrency(p.amount)}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: p.status === 'paid' ? '#ECFDF5' : '#FEF2F2', color: p.status === 'paid' ? '#10B981' : '#EF4444' }}>
                              {p.status === 'paid' ? 'Pago' : 'Saída'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F1F5F9' }}>
                      <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, color: '#475569' }}>Total do Período</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', color: netProfit >= 0 ? '#10B981' : '#EF4444' }}>
                        {netProfit >= 0 ? '+' : ''} {fmtCurrency(netProfit)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhuma transação em {periodLabel}.</p>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#CBD5E1' }}>Gerado pelo WorkAgenda · workagenda.org</span>
              <span style={{ fontSize: 11, color: '#CBD5E1' }}>{now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </>
      )}

      {/* ── DASHBOARD VIEW ── */}
      {view === 'dashboard' && (<>

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
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Tendência — últimos 6 meses</span>
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Nenhuma transação em {periodLabel}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

    </div>
  );
}
