import React, { useState } from 'react';
import { Payment, Professional, Appointment, Service, Tenant } from '../../types';
import { ShoppingBag, DollarSign, RefreshCw, Trash } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface Props {
  activeTenant: Tenant;
  myPayments: Payment[];
  myProfessionals: Professional[];
  myAppointments: Appointment[];
  myServices: Service[];
  onAddPayment: (payment: Omit<Payment, 'id'>) => void;
}

export default function FinanceiroTab({ activeTenant, myPayments, myProfessionals, myAppointments, myServices, onAddPayment }: Props) {
  const toast = useToast();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const [directSaleDesc,   setDirectSaleDesc]   = useState('');
  const [directSaleAmount, setDirectSaleAmount] = useState(0);
  const [directSaleMethod, setDirectSaleMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');
  const [expenseAmount,    setExpenseAmount]    = useState(0);
  const [expenseDesc,      setExpenseDesc]      = useState('');

  const totalRevenue  = myPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpenses = myPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);

  const calculatedCommissions = myProfessionals.map(prof => {
    const closed = myAppointments.filter(a => a.professionalId === prof.id && a.status === 'attended');
    const total  = closed.reduce((s, a) => s + a.price, 0);
    const comm   = total * (prof.commissionPercentage / 100);
    return { id: prof.id, name: prof.name, closedCount: closed.length, commissionPct: prof.commissionPercentage, totalEarned: total, dueCommission: comm };
  });

  const handleDirectSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSaleDesc.trim() || directSaleAmount <= 0) {
      toast.error('Preencha descrição e valor.');
      return;
    }
    onAddPayment({ tenantId: activeTenant.id, amount: directSaleAmount, method: directSaleMethod, status: 'paid', date: now, description: `PDV: ${directSaleDesc.trim()}` });
    toast.success(`R$ ${directSaleAmount.toFixed(2)} registrado!`);
    setDirectSaleDesc(''); setDirectSaleAmount(0);
  };

  const handleExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseDesc.trim()) {
      toast.error('Preencha valor e descrição da despesa.');
      return;
    }
    onAddPayment({ tenantId: activeTenant.id, amount: expenseAmount, method: 'cash', status: 'refunded', date: now, description: `Despesa: ${expenseDesc}` });
    toast.success('Despesa lançada no caixa!');
    setExpenseAmount(0); setExpenseDesc('');
  };

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Receita avulsa */}
        <div style={card} className="space-y-4">
          <h3 style={sectionLabel}>
            <ShoppingBag style={{ width: 14, height: 14, color: '#4ade80' }} /> Receita Avulsa
          </h3>
          <p style={subText}>Faturamento direto de balcão.</p>
          <form onSubmit={handleDirectSale} className="space-y-4">
            <div>
              <label className="navy-label">Descrição</label>
              <input type="text" required placeholder="Ex: Venda de produto" value={directSaleDesc} onChange={e => setDirectSaleDesc(e.target.value)} className="navy-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <button type="submit" style={{ width: '100%', padding: '13px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Lançar Receita
            </button>
          </form>
        </div>

        {/* Despesa */}
        <div style={card} className="space-y-4">
          <h3 style={sectionLabel}>
            <Trash style={{ width: 14, height: 14, color: '#fca5a5' }} /> Registrar Despesa
          </h3>
          <p style={subText}>Débito manual de pagamentos.</p>
          <form onSubmit={handleExpense} className="space-y-4">
            <div>
              <label className="navy-label">Valor (R$)</label>
              <input type="number" required min={1} value={expenseAmount || ''} onChange={e => setExpenseAmount(Number(e.target.value))} className="navy-input" />
            </div>
            <div>
              <label className="navy-label">Descrição</label>
              <input type="text" required placeholder="Ex: Lavanderia" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="navy-input" />
            </div>
            <button type="submit" style={{ width: '100%', padding: '13px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Confirmar Despesa
            </button>
          </form>
        </div>

        {/* Comissões */}
        <div style={card} className="space-y-4">
          <h3 style={sectionLabel}>
            <DollarSign style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.55)' }} /> Comissões
          </h3>
          <p style={subText}>Repasse colaborativo da equipe.</p>
          <div style={{ maxHeight: 220, overflowY: 'auto' }} className="no-scrollbar">
            {calculatedCommissions.map(c => (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, marginBottom: 2 }}>{c.name}</p>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{c.closedCount} cortes · {c.commissionPct}%</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#4ade80', fontWeight: 800, fontSize: 14, fontFamily: 'monospace' }}>R$ {c.dueCommission.toFixed(2)}</span>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Salão: R$ {(c.totalEarned - c.dueCommission).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div style={card} className="space-y-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 14 }}>
          <h3 style={sectionLabel}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Fluxo de Caixa
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: 'monospace' }}>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>+ R$ {totalRevenue.toFixed(2)}</span>
            <span style={{ color: '#fca5a5', fontWeight: 700 }}>− R$ {totalExpenses.toFixed(2)}</span>
            <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>= R$ {(totalRevenue - totalExpenses).toFixed(2)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
                {['Data','Descrição','Método','Valor','Status'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Status' ? 'right' : 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myPayments.length > 0 ? myPayments.map((p, idx) => (
                <tr key={p.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#F6F9FC', borderBottom: '1px solid #e8edf3' }}>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{p.date}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#141E2D', fontSize: 13 }}>{p.description}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: '#F0F4F8', color: '#64748b', padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace' }}>{p.method}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 800, fontFamily: 'monospace' }}>
                    {p.status === 'refunded'
                      ? <span style={{ color: '#dc2626' }}>− R$ {p.amount.toFixed(2)}</span>
                      : <span style={{ color: '#16a34a' }}>+ R$ {p.amount.toFixed(2)}</span>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: p.status === 'paid' ? '#E6F4EC' : '#FEECEC',
                      color: p.status === 'paid' ? '#0A4A2C' : '#7A0A0A',
                    }}>
                      {p.status === 'paid' ? 'Pago' : 'Saída'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Nenhuma transação registrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
