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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Receita avulsa */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" /> Receita Avulsa
          </h3>
          <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Faturamento direto de balcão.</p>
          <form onSubmit={handleDirectSale} className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descrição</label>
              <input type="text" required placeholder="Ex: Venda de produto" value={directSaleDesc} onChange={e => setDirectSaleDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                <input type="number" required min={1} value={directSaleAmount || ''} onChange={e => setDirectSaleAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Forma</label>
                <select value={directSaleMethod} onChange={e => setDirectSaleMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900">
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-full hover:bg-emerald-700 transition">
              Lançar Receita
            </button>
          </form>
        </div>

        {/* Despesa */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Trash className="w-5 h-5 text-red-600" /> Registrar Despesa
          </h3>
          <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Débito manual de pagamentos.</p>
          <form onSubmit={handleExpense} className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Valor (R$)</label>
              <input type="number" required min={1} value={expenseAmount || ''} onChange={e => setExpenseAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Descrição</label>
              <input type="text" required placeholder="Ex: Lavanderia" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-red-500" />
            </div>
            <button type="submit" className="w-full py-3.5 bg-red-50 text-red-600 font-semibold rounded-full hover:bg-red-100 transition">
              Confirmar Despesa
            </button>
          </form>
        </div>

        {/* Comissões */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" /> Comissões
          </h3>
          <p className="text-sm text-slate-500 border-b border-slate-100 pb-4">Repasse colaborativo da equipe.</p>
          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-2">
            {calculatedCommissions.map(c => (
              <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                  <span className="text-slate-500">{c.closedCount} cortes · {c.commissionPct}%</span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-600 font-extrabold text-[15px]">R$ {c.dueCommission.toFixed(2)}</span>
                  <p className="text-[10px] text-slate-400 uppercase">Salão: R$ {(c.totalEarned - c.dueCommission).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" /> Fluxo de Caixa
          </h3>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-emerald-600 font-bold">+ R$ {totalRevenue.toFixed(2)}</span>
            <span className="text-red-600 font-bold">- R$ {totalExpenses.toFixed(2)}</span>
            <span className="text-slate-700 font-bold">= R$ {(totalRevenue - totalExpenses).toFixed(2)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest bg-slate-50/50">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {myPayments.length > 0 ? myPayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 text-xs text-slate-600">{p.date}</td>
                  <td className="py-4 px-4 font-semibold text-slate-800">{p.description}</td>
                  <td className="py-4 px-4">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-[10px] font-bold uppercase">{p.method}</span>
                  </td>
                  <td className="py-4 px-4 font-extrabold">
                    {p.status === 'refunded' ? <span className="text-red-600">- R$ {p.amount.toFixed(2)}</span>
                      : <span className="text-emerald-600">+ R$ {p.amount.toFixed(2)}</span>}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold border ${
                      p.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                    }`}>{p.status === 'paid' ? 'Pago' : 'Saída'}</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Nenhuma transação registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
