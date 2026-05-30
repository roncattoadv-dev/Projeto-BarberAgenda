import React from 'react';
import { Service, Professional, Appointment, Customer, Payment } from '../../types';

interface Props {
  myServices: Service[];
  myProfessionals: Professional[];
  myAppointments: Appointment[];
  myCustomers: Customer[];
  myPayments: Payment[];
}

export default function DashboardTab({ myServices, myProfessionals, myAppointments, myCustomers, myPayments }: Props) {
  const totalRevenue  = myPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalExpenses = myPayments.filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
  const netEarnings   = totalRevenue - totalExpenses;

  const today = new Date().toISOString().split('T')[0];
  const appointmentsToday = myAppointments.filter(a => a.date === today);
  const attendedToday  = appointmentsToday.filter(a => a.status === 'attended').length;
  const confirmedToday = appointmentsToday.filter(a => a.status === 'confirmed').length;

  const serviceSalesFrequency = myServices.map(srv => ({
    name: srv.name,
    occurrences: myAppointments.filter(a => a.serviceId === srv.id && a.status !== 'cancelled').length,
    revenueGenerated: myAppointments.filter(a => a.serviceId === srv.id && a.status !== 'cancelled').length * srv.price,
  })).sort((a, b) => b.occurrences - a.occurrences);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Faturamento Líquido', value: `R$ ${netEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'mensal' },
          { label: 'Agendamentos Hoje', value: String(appointmentsToday.length), sub: `${attendedToday} concluídos · ${confirmedToday} confirmados` },
          { label: 'Equipe', value: String(myProfessionals.length), sub: 'profissionais ativos' },
          { label: 'Catálogo', value: String(myServices.length), sub: 'serviços configurados' },
        ].map(card => (
          <div key={card.label} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3">{card.label}</span>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{card.value}</p>
            <div className="text-sm text-slate-500 mt-2 font-medium">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Serviços mais vendidos */}
        <div className="glass-card p-5 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            Serviços Mais Vendidos
          </h3>
          <div className="space-y-3.5">
            {serviceSalesFrequency.map((srv, idx) => {
              const maxOccur = Math.max(...serviceSalesFrequency.map(s => s.occurrences), 1);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 font-semibold">{srv.name}</span>
                    <span className="text-slate-500 font-mono font-bold">{srv.occurrences} agend. (R$ {srv.revenueGenerated})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(srv.occurrences / maxOccur) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clientes recentes */}
        <div className="glass-card p-5 rounded-xl space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
            Cadastro de Clientes
          </h3>
          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
            {myCustomers.map(cust => (
              <div key={cust.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-700">{cust.name}</p>
                  <span className="text-[10px] text-slate-400 font-mono">{cust.phone}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{cust.email}</span>
              </div>
            ))}
          </div>
          <p className="bg-slate-50 p-3 rounded border border-slate-200 text-[11px] text-slate-500 font-mono">
            💡 Atualizado a cada novo agendamento no portal online.
          </p>
        </div>
      </div>
    </div>
  );
}
