import React, { useState, useEffect } from 'react';
import { Appointment, Service, Professional, Tenant } from '../../types';
import { useToast } from '../../hooks/useToast';
import {
  sendWhatsApp,
  checkEvoStatus,
  buildConfirmationMsg,
  buildReminderMsg,
  buildCancellationMsg,
  buildCustomMsg,
  type WppStatus,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
}

type SendState = 'idle' | 'sending' | 'done' | 'error';

export default function WhatsAppTab({ activeTenant, myAppointments, myServices, myProfessionals }: Props) {
  const toast = useToast();

  const [confirmTemplate, setConfirmTemplate] = useState(
    'Olá {cliente}! Seu agendamento de {servico} com {profissional} no dia {data} às {hora} está CONFIRMADO. — {salao}'
  );
  const [reminderTemplate, setReminderTemplate] = useState(
    'Lembrete: {cliente}, amanhã ({data}) às {hora} você tem {servico} com {profissional}. Aguardamos você! — {salao}'
  );
  const [cancelTemplate, setCancelTemplate] = useState(
    '{cliente}, seu agendamento de {servico} em {data} às {hora} foi cancelado. Para reagendar responda esta mensagem. — {salao}'
  );

  // Evo Go status
  const [evoStatus, setEvoStatus]   = useState<'open' | 'close' | 'connecting' | 'error' | 'checking'>('checking');
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});
  const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'cancellation'>('confirmation');

  // Only show confirmed/pending appointments
  const pendingAppts = myAppointments
    .filter(a => a.status === 'confirmed' || a.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  useEffect(() => {
    checkEvoStatus().then(setEvoStatus);
    const interval = setInterval(() => checkEvoStatus().then(setEvoStatus), 30_000);
    return () => clearInterval(interval);
  }, []);

  const getApptData = (appt: Appointment) => ({
    customerName:     appt.customerName,
    customerPhone:    appt.customerPhone,
    serviceName:      myServices.find(s => s.id === appt.serviceId)?.name    || 'Serviço',
    professionalName: myProfessionals.find(p => p.id === appt.professionalId)?.name || 'Profissional',
    date:             appt.date,
    time:             appt.time,
    tenantName:       activeTenant.name,
    tenantPhone:      activeTenant.phone,
  });

  const doSend = async (appt: Appointment, type: 'confirmation' | 'reminder' | 'cancellation' | 'custom') => {
    const key = `${appt.id}-${type}`;
    setSendStates(prev => ({ ...prev, [key]: 'sending' }));

    const data = getApptData(appt);
    let msg = '';
    if      (type === 'confirmation')  msg = buildConfirmationMsg(data);
    else if (type === 'reminder')      msg = buildReminderMsg(data);
    else if (type === 'cancellation')  msg = buildCancellationMsg(data);
    else                               msg = buildCustomMsg(confirmTemplate, data);

    const result: WppStatus = await sendWhatsApp(appt.customerPhone, msg);

    setSendStates(prev => ({ ...prev, [key]: result === 'sent' ? 'done' : 'error' }));

    if (result === 'sent') {
      toast.success(`✓ Mensagem enviada para ${appt.customerName}`);
    } else if (result === 'not_configured') {
      toast.warning('Configure VITE_EVO_URL e VITE_EVO_APIKEY no .env.local');
    } else {
      toast.error(`Erro ao enviar para ${appt.customerName}. Verifique a instância Evo.`);
    }

    // Reset after 4s
    setTimeout(() => setSendStates(prev => ({ ...prev, [key]: 'idle' })), 4000);
  };

  const previewMsg = () => {
    const mock = {
      customerName: 'João Silva', customerPhone: '5511999999999',
      serviceName: 'Corte Degradê', professionalName: 'Gustavo',
      date: new Date().toISOString().split('T')[0], time: '14:00',
      tenantName: activeTenant.name, tenantPhone: activeTenant.phone,
    };
    if (activePreview === 'confirmation') return buildConfirmationMsg(mock);
    if (activePreview === 'reminder')     return buildReminderMsg(mock);
    return buildCancellationMsg(mock);
  };

  const statusColor = {
    open: 'bg-emerald-500', close: 'bg-red-500',
    connecting: 'bg-amber-500', error: 'bg-slate-400', checking: 'bg-slate-300',
  }[evoStatus];

  const statusLabel = {
    open: 'Conectado', close: 'Desconectado',
    connecting: 'Conectando…', error: 'Erro', checking: 'Verificando…',
  }[evoStatus];

  const btnLabel = (key: string) => {
    const s = sendStates[key] || 'idle';
    if (s === 'sending') return '⏳ Enviando…';
    if (s === 'done')    return '✓ Enviado';
    if (s === 'error')   return '✕ Erro';
    return 'Enviar';
  };

  const btnClass = (key: string) => {
    const s = sendStates[key] || 'idle';
    const base = 'px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ';
    if (s === 'sending') return base + 'bg-amber-50 text-amber-700 cursor-wait';
    if (s === 'done')    return base + 'bg-emerald-50 text-emerald-700';
    if (s === 'error')   return base + 'bg-red-50 text-red-700';
    return base + 'bg-slate-900 text-white hover:bg-slate-700';
  };

  const saveTemplates = () => {
    localStorage.setItem(`barber_wpp_templates_${activeTenant.id}`, JSON.stringify({
      confirmTemplate, reminderTemplate, cancelTemplate,
    }));
    toast.success('Modelos salvos com sucesso!');
  };

  // Load saved templates
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`barber_wpp_templates_${activeTenant.id}`);
      if (saved) {
        const { confirmTemplate: c, reminderTemplate: r, cancelTemplate: x } = JSON.parse(saved);
        if (c) setConfirmTemplate(c);
        if (r) setReminderTemplate(r);
        if (x) setCancelTemplate(x);
      }
    } catch {}
  }, [activeTenant.id]);

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header status */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Integração WhatsApp</span>
          <h3 className="text-xl font-bold text-slate-900">Evolution API (Evo Go)</h3>
          <p className="text-sm text-slate-500 mt-1">
            Instância: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{import.meta.env.VITE_EVO_INSTANCE || 'barberflow'}</code>
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
          <span className={`w-3 h-3 rounded-full ${statusColor} ${evoStatus === 'open' ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold text-slate-700">{statusLabel}</span>
          <button onClick={() => { setEvoStatus('checking'); checkEvoStatus().then(setEvoStatus); }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2">
            ↻ Verificar
          </button>
        </div>
      </div>

      {evoStatus === 'close' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong>Instância desconectada.</strong> Acesse o EasyPanel → Evo Go → QR Code para reconectar o WhatsApp.
            <br />Certifique-se que <code className="bg-amber-100 px-1 rounded">VITE_EVO_URL</code>, <code className="bg-amber-100 px-1 rounded">VITE_EVO_INSTANCE</code> e <code className="bg-amber-100 px-1 rounded">VITE_EVO_APIKEY</code> estão configurados no <code>.env.local</code>.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Templates */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
            Modelos de Mensagem
          </h4>
          <p className="text-xs text-slate-500">
            Variáveis disponíveis: <code className="bg-slate-100 px-1 rounded">{'{'}</code>cliente{' '}
            servico profissional data hora salao<code className="bg-slate-100 px-1 rounded">{'}'}</code>
          </p>

          {[
            { label: 'Confirmação de Agendamento', value: confirmTemplate, set: setConfirmTemplate, type: 'confirmation' as const },
            { label: 'Lembrete (enviar 24h antes)', value: reminderTemplate, set: setReminderTemplate, type: 'reminder' as const },
            { label: 'Cancelamento', value: cancelTemplate, set: setCancelTemplate, type: 'cancellation' as const },
          ].map(t => (
            <div key={t.label} onClick={() => setActivePreview(t.type)}>
              <label className={`text-xs font-semibold uppercase block mb-1 transition ${activePreview === t.type ? 'text-blue-600' : 'text-slate-500'}`}>
                {t.label}
              </label>
              <textarea
                value={t.value}
                onChange={(e) => t.set(e.target.value)}
                rows={3}
                className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 font-sans text-sm resize-none leading-relaxed transition focus:outline-none ${
                  activePreview === t.type ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200 focus:border-blue-400'
                }`}
              />
            </div>
          ))}

          <button onClick={saveTemplates}
            className="w-full py-3.5 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 transition text-sm">
            Salvar Modelos
          </button>
        </div>

        {/* Preview */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Preview</h4>
            <div className="flex gap-2">
              {(['confirmation', 'reminder', 'cancellation'] as const).map(t => (
                <button key={t} onClick={() => setActivePreview(t)}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition ${activePreview === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {t === 'confirmation' ? 'Confirmação' : t === 'reminder' ? 'Lembrete' : 'Cancelamento'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#075E54] rounded-3xl p-6 shadow-xl">
            <div className="flex gap-3 items-center mb-4">
              <div className="size-10 bg-emerald-400 rounded-full flex items-center justify-center text-white font-bold text-sm">B</div>
              <div>
                <div className="text-white font-bold text-sm">{activeTenant.name}</div>
                <div className="text-emerald-300 text-xs">✓ Verificado</div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 text-slate-800 text-sm leading-relaxed whitespace-pre-line shadow-md">
              {previewMsg()}
            </div>
            <div className="text-right mt-2">
              <span className="text-emerald-300 text-xs">09:00 ✓✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch panel — agendamentos pendentes */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Disparar Notificações
          </h4>
          <span className="text-xs font-mono text-slate-400">{pendingAppts.length} agendamento(s) ativo(s)</span>
        </div>

        {pendingAppts.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">Nenhum agendamento confirmado ou pendente no momento.</p>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {pendingAppts.map(appt => {
              const srv  = myServices.find(s => s.id === appt.serviceId);
              const prof = myProfessionals.find(p => p.id === appt.professionalId);
              return (
                <div key={appt.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-lg">{appt.date} · {appt.time}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        appt.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>{appt.status === 'confirmed' ? 'Confirmado' : 'Pendente'}</span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{appt.customerName}</p>
                    <p className="text-xs text-slate-500">{srv?.name} · {prof?.name} · {appt.customerPhone}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'confirmation' as const, label: '✓ Confirmar' },
                      { type: 'reminder'     as const, label: '⏰ Lembrete' },
                      { type: 'cancellation' as const, label: '✕ Cancelar' },
                    ].map(({ type, label }) => {
                      const key = `${appt.id}-${type}`;
                      const busy = (sendStates[key] || 'idle') === 'sending';
                      return (
                        <button key={type} disabled={busy} onClick={() => doSend(appt, type)} className={btnClass(key)}>
                          {sendStates[key] ? btnLabel(key) : label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
