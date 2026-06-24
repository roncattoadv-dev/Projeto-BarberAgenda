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

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Faturamento Líquido', value: `R$ ${netEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'receita − despesas', highlight: true },
          { label: 'Agendamentos Hoje', value: String(appointmentsToday.length), sub: `${attendedToday} concluídos · ${confirmedToday} confirmados`, highlight: false },
          { label: 'Equipe', value: String(myProfessionals.length), sub: 'profissionais ativos', highlight: false },
          { label: 'Catálogo', value: String(myServices.length), sub: 'serviços configurados', highlight: false },
        ].map(c => (
          <div key={c.label} style={card}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#6B7280', marginBottom: 12 }}>{c.label}</span>
            <p style={{ fontSize: 28, fontWeight: 800, color: c.highlight ? '#16A34A' : '#111827', fontFamily: 'monospace', marginBottom: 6 }}>{c.value}</p>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Serviços mais vendidos */}
        <div style={card}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
            Serviços Mais Vendidos
          </h3>
          <div className="space-y-4">
            {serviceSalesFrequency.map((srv, idx) => {
              const maxOccur = Math.max(...serviceSalesFrequency.map(s => s.occurrences), 1);
              return (
                <div key={idx} className="space-y-1">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{srv.name}</span>
                    <span style={{ color: '#6B7280', fontFamily: 'monospace', fontWeight: 700 }}>{srv.occurrences} agend. (R$ {srv.revenueGenerated})</span>
                  </div>
                  <div style={{ width: '100%', background: '#F1F5F9', height: 6, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ background: '#22C55E', height: 6, borderRadius: 4, transition: 'width 0.5s', width: `${(srv.occurrences / maxOccur) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clientes recentes */}
        <div style={card}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
            Cadastro de Clientes
          </h3>
          <div style={{ maxHeight: 220, overflowY: 'auto' }} className="no-scrollbar">
            {myCustomers.map(cust => (
              <div key={cust.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#374151' }}>{cust.name}</p>
                  <span style={{ fontSize: 10, color: '#6B7280', fontFamily: 'monospace' }}>{cust.phone}</span>
                </div>
                <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{cust.email}</span>
              </div>
            ))}
          </div>
          <p style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 12 }}>
            💡 Atualizado a cada novo agendamento no portal online.
          </p>
        </div>
      </div>
    </div>
  );
}
