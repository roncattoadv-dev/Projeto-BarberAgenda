/**
 * WhatsAppTab — Painel de integração WhatsApp
 * A conexão com o provedor (instância, credenciais) é gerenciada
 * pelo servidor — o usuário vê apenas status + QR Code.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, Service, Professional, Tenant } from '../../types';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';
import {
  checkStatusServer, fetchQRCodeServer, disconnectServer, sendWhatsAppServer,
  buildConfirmationMsg, buildReminderMsg, buildCancellationMsg, buildCustomMsg,
  normalizePhone, formatDatePT,
  type ConnectionState, type WppStatus, type QRCodeData, type ApptData,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
  onStatusChange?: (state: ConnectionState, name: string | null) => void;
}

type SendState = 'idle' | 'sending' | 'done' | 'error';
type ActiveView = 'connection' | 'templates' | 'dispatch';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

export default function WhatsAppTab({ activeTenant, myAppointments, myServices, myProfessionals, onStatusChange }: Props) {
  const toast = useToast();

  // ── Auth token (para chamadas ao servidor) ─────────────────
  const [authToken, setAuthToken] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthToken(session?.access_token || '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthToken(session?.access_token || '');
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Estado de conexão ──────────────────────────────────────
  const [connState, setConnState]   = useState<ConnectionState>('checking');
  const [connName,  setConnName]    = useState<string | null>(null);
  const [qrData,    setQrData]      = useState<QRCodeData | null>(null);
  const [qrLoading, setQrLoading]   = useState(false);
  const [qrRefreshCount, setQrRefreshCount] = useState(0);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI ─────────────────────────────────────────────────────
  const [activeView,    setActiveView]    = useState<ActiveView>('connection');
  const [sendStates,    setSendStates]    = useState<Record<string, SendState>>({});
  const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'cancellation'>('confirmation');

  // ── Templates automáticos (salvos no banco) ────────────────
  const [autoConfirmDraft,   setAutoConfirmDraft]   = useState('');
  const [autoRemindDraft,    setAutoRemindDraft]    = useState('');
  const [reminderMinutes,    setReminderMinutes]    = useState(60);
  const [tplSaving,          setTplSaving]          = useState(false);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${getApiUrl()}/api/whatsapp/templates?tenantId=${activeTenant.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    }).then(r => r.json()).then(d => {
      if (d.ok) {
        setAutoConfirmDraft(d.confirm);
        setAutoRemindDraft(d.remind);
        if (d.reminderMinutes) setReminderMinutes(d.reminderMinutes);
      }
    }).catch(() => {});
  }, [authToken, activeTenant.id]);

  const handleSaveAutoTpls = async () => {
    setTplSaving(true);
    try {
      await fetch(`${getApiUrl()}/api/whatsapp/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ confirm: autoConfirmDraft, remind: autoRemindDraft, reminderMinutes }),
      });
      toast.success('Templates salvos!');
    } catch { toast.error('Erro ao salvar templates.'); }
    finally { setTplSaving(false); }
  };

  // ── Templates manuais (dispatch) ───────────────────────────
  const LS_TPL = `barber_wpp_tpl_${activeTenant.id}`;
  const defaultTpls = {
    confirm: 'Olá {cliente}! Seu agendamento de {servico} com {profissional} no dia {data} às {hora} está CONFIRMADO. — {salao}',
    remind:  'Lembrete: {cliente}, amanhã ({data}) às {hora} você tem {servico} com {profissional}. Aguardamos você! — {salao}',
    cancel:  '{cliente}, seu agendamento de {servico} em {data} às {hora} foi cancelado. Para reagendar responda esta mensagem. — {salao}',
  };
  const loadTpls = () => {
    try { const s = localStorage.getItem(LS_TPL); if (s) return JSON.parse(s); } catch {}
    return defaultTpls;
  };
  const [tpls, setTpls]         = useState(loadTpls);
  const [tplsDraft, setTplsDraft] = useState(loadTpls);

  // ── Agendamentos pendentes ─────────────────────────────────
  const pendingAppts = myAppointments
    .filter(a => a.status === 'confirmed' || a.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  // ── Helpers ────────────────────────────────────────────────
  const getApptData = (appt: Appointment): ApptData => ({
    customerName:     appt.customerName,
    customerPhone:    appt.customerPhone,
    serviceName:      myServices.find(s => s.id === appt.serviceId)?.name       || 'Serviço',
    professionalName: myProfessionals.find(p => p.id === appt.professionalId)?.name || 'Profissional',
    date:  appt.date, time: appt.time,
    tenantName:  activeTenant.name,
    tenantPhone: activeTenant.phone,
    id:          appt.id,
    tenantSlug:  activeTenant.slug,
  });

  // ── Verificação de status ─────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!authToken) return;
    const { state, name } = await checkStatusServer(activeTenant.id, authToken);
    setConnState(state);
    setConnName(name);
    onStatusChange?.(state, name);
    if (state === 'open') {
      setQrData(null);
      stopQrPolling();
    }
  }, [authToken, activeTenant.id, onStatusChange]);

  // ── QR Code polling ────────────────────────────────────────
  const stopQrPolling = () => {
    if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; }
  };

  const fetchQR = useCallback(async () => {
    if (!authToken) return;
    setQrLoading(true);
    try {
      const qr = await fetchQRCodeServer(activeTenant.id, authToken);
      if (qr) {
        setQrData({ ...qr, count: qrRefreshCount + 1 });
        setQrRefreshCount(c => c + 1);
      } else {
        // Sem QR = já conectado
        await refreshStatus();
      }
    } catch (err) {
      console.error('[QR]', err);
    } finally {
      setQrLoading(false);
    }
  }, [authToken, activeTenant.id, qrRefreshCount]);

  const startQrPolling = useCallback(() => {
    fetchQR();
    stopQrPolling();
    // QR do Evo Go expira em ~45s — renovamos a cada 30s
    qrIntervalRef.current = setInterval(() => {
      refreshStatus().then(state => {
        // Se ainda não conectou, busca novo QR
        if (connState !== 'open') fetchQR();
      });
    }, 30_000);
  }, [fetchQR, refreshStatus, connState]);

  // ── Status polling periódico ───────────────────────────────
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 20_000);
    return () => { clearInterval(interval); stopQrPolling(); };
  }, [refreshStatus]);

  // ── Ações de instância ─────────────────────────────────────
  const handleConnect = () => {
    setConnState('connecting');
    startQrPolling();
  };

  const handleLogout = async () => {
    if (!window.confirm('Desconectar o WhatsApp? Será necessário escanear o QR Code novamente.')) return;
    try {
      await disconnectServer(activeTenant.id, authToken);
      setConnState('close');
      setConnName(null);
      setQrData(null);
      toast.info('WhatsApp desconectado. Escaneie o QR para reconectar.');
    } catch (err: any) {
      toast.error('Erro ao desconectar: ' + err.message);
    }
  };

  const handleSaveTpls = () => {
    setTpls(tplsDraft);
    localStorage.setItem(LS_TPL, JSON.stringify(tplsDraft));
    toast.success('Modelos salvos!');
  };

  // ── Envio de mensagem ──────────────────────────────────────
  const doSend = async (appt: Appointment, type: 'confirmation' | 'reminder' | 'cancellation') => {
    const key = `${appt.id}-${type}`;
    setSendStates(prev => ({ ...prev, [key]: 'sending' }));
    const data = getApptData(appt);
    const msg  = type === 'confirmation' ? buildConfirmationMsg(data)
               : type === 'reminder'     ? buildReminderMsg(data)
               :                           buildCancellationMsg(data);

    const result = await sendWhatsAppServer(activeTenant.id, authToken, appt.customerPhone, msg);

    setSendStates(prev => ({ ...prev, [key]: result === 'sent' ? 'done' : 'error' }));
    if (result === 'sent')  toast.success(`✓ Enviado para ${appt.customerName}`);
    else                    toast.error(`Falha ao enviar para ${appt.customerName}`);
    setTimeout(() => setSendStates(prev => ({ ...prev, [key]: 'idle' })), 4000);
  };

  // ── Helpers de UI ──────────────────────────────────────────
  const previewMsg = () => {
    const mock: ApptData = {
      customerName: 'João Silva', customerPhone: '5511999999999',
      serviceName: 'Corte Degradê', professionalName: 'Gustavo',
      date: new Date().toISOString().split('T')[0], time: '14:00',
      tenantName: activeTenant.name, tenantPhone: activeTenant.phone,
    };
    if (activePreview === 'confirmation') return buildCustomMsg(tplsDraft.confirm, mock);
    if (activePreview === 'reminder')     return buildCustomMsg(tplsDraft.remind, mock);
    return buildCustomMsg(tplsDraft.cancel, mock);
  };

  const connDotColor = { open: '#4ade80', close: '#ef4444', connecting: '#fbbf24', error: '#94a3b8', checking: '#64748b' }[connState];
  const connLabel    = { open:'Conectado ✓', close:'Desconectado', connecting:'Aguardando QR…', error:'Erro de conexão', checking:'Verificando…' }[connState];

  const connBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600 };
    if (connState === 'open')       return { ...base, background: '#E6F4EC', color: '#0A4A2C', borderColor: '#A7D7BC' };
    if (connState === 'connecting') return { ...base, background: '#FEF9EC', color: '#7A4B0A', borderColor: '#F5DCB0' };
    if (connState === 'close')      return { ...base, background: '#FEECEC', color: '#7A0A0A', borderColor: '#F5B8B8' };
    return { ...base, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.09)' };
  };

  const btnLabel = (key: string) => ({ idle:'Enviar', sending:'⏳…', done:'✓ Enviado', error:'✕ Erro' }[sendStates[key]||'idle']);
  const btnStyle = (key: string): React.CSSProperties => {
    const s = sendStates[key] || 'idle';
    const base: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: s === 'sending' ? 'wait' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s' };
    if (s === 'idle')    return { ...base, background: 'rgba(255,255,255,0.88)', color: '#031D3C' };
    if (s === 'sending') return { ...base, background: '#FEF9EC', color: '#7A4B0A' };
    if (s === 'done')    return { ...base, background: '#E6F4EC', color: '#0A4A2C' };
    return { ...base, background: '#FEECEC', color: '#7A0A0A' };
  };

  const tabs: { id: ActiveView; label: string; dot?: boolean }[] = [
    { id:'connection', label:'📶 Conexão',   dot: connState !== 'open' && connState !== 'checking' },
    { id:'dispatch',   label:'📤 Disparar',  dot: pendingAppts.length > 0 },
    { id:'templates',  label:'✏️ Modelos' },
  ];

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 24,
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', display: 'block', marginBottom: 4 }}>WhatsApp</span>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
            WhatsApp
          </h3>
          {connName && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{connName}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={connBadgeStyle()}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connDotColor, flexShrink: 0, ...(connState === 'open' ? { animation: 'pulse 2s infinite' } : {}) }} />
            {connLabel}
          </div>
          <button onClick={refreshStatus} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Verificar status">↻</button>
        </div>
      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveView(t.id)}
            style={{
              position: 'relative' as const,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 20,
              border: `1px solid ${activeView===t.id ? '#ffffff' : 'rgba(255,255,255,0.09)'}`,
              background: activeView===t.id ? '#ffffff' : 'rgba(255,255,255,0.04)',
              color: activeView===t.id ? '#031D3C' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.dot && <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          VIEW: CONEXÃO — QR Code
      ══════════════════════════════════════════════════════ */}
      {activeView === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Painel de estado + ações */}
          <div style={card} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Status da Instância</h4>

            {/* Info card */}
            <div style={{
              padding: 20,
              borderRadius: 14,
              border: `2px solid ${connState==='open' ? 'rgba(74,222,128,0.35)' : connState==='connecting' ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.09)'}`,
              background: connState==='open' ? 'rgba(74,222,128,0.06)' : connState==='connecting' ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {connState==='open' ? '✅' : connState==='connecting' ? '📱' : connState==='error' ? '❌' : '⏳'}
              </div>
              <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>{connLabel}</p>
              {connState==='open' && connName && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{connName}</p>
              )}
              {connState==='close' && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>Escaneie o QR Code para conectar</p>
              )}
              {connState==='connecting' && (
                <p style={{ fontSize: 11, color: '#fbbf24' }}>Aguardando leitura do QR Code…</p>
              )}
            </div>

            {/* Botões de ação */}
            <div className="space-y-3">
              {connState !== 'open' && (
                <button onClick={handleConnect} disabled={qrLoading || !authToken}
                  style={{ width: '100%', padding: '13px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: (qrLoading || !authToken) ? 'not-allowed' : 'pointer', opacity: (qrLoading || !authToken) ? 0.5 : 1, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {qrLoading ? '⏳ Gerando QR…' : '📱 Conectar WhatsApp (QR Code)'}
                </button>
              )}
              {connState === 'open' && (
                <button onClick={handleLogout}
                  style={{ width: '100%', padding: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  🔌 Desconectar WhatsApp
                </button>
              )}
              {(connState === 'connecting' || qrData) && (
                <button onClick={fetchQR} disabled={qrLoading}
                  style={{ width: '100%', padding: '11px', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', fontWeight: 700, fontSize: 13, border: '1px solid rgba(251,191,36,0.25)', borderRadius: 12, cursor: qrLoading ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  🔄 Novo QR Code
                </button>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: 340 }} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0, width: '100%' }}>QR Code</h4>

            {connState === 'open' ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16, padding: '24px 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
                <p style={{ fontWeight: 700, color: '#4ade80', fontSize: 16 }}>WhatsApp Conectado!</p>
                {connName && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.09)' }}>
                    <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>{connName}</p>
                  </div>
                )}
              </div>
            ) : qrLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16, padding: '24px 0' }}>
                <div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.65)', borderRadius: '50%' }} className="animate-spin" />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>Gerando QR Code…</p>
              </div>
            ) : qrData?.base64 ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16 }}>
                <div style={{ padding: 12, background: '#ffffff', borderRadius: 16 }}>
                  <img
                    src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                    alt="QR Code WhatsApp"
                    style={{ width: 200, height: 200, objectFit: 'contain' }}
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>Abra o WhatsApp no celular</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>⋯ → Dispositivos conectados → Conectar dispositivo</p>
                  <p style={{ fontSize: 10, color: '#fbbf24', fontFamily: 'monospace', marginTop: 8, background: 'rgba(251,191,36,0.08)', padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(251,191,36,0.2)', display: 'inline-block' }}>
                    ⏰ QR expira em ~45s — atualizado automaticamente
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16, padding: '24px 0', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📱</div>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, maxWidth: 220 }}>
                  Clique em <strong style={{ color: 'rgba(255,255,255,0.65)' }}>"Conectar WhatsApp"</strong> para gerar o QR Code
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VIEW: DISPARAR MENSAGENS
      ══════════════════════════════════════════════════════ */}
      {activeView === 'dispatch' && (
        <div style={card} className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 14 }}>
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Disparar Notificações</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={connBadgeStyle()}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
                {connLabel}
              </div>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.38)' }}>{pendingAppts.length} agend.</span>
            </div>
          </div>

          {connState !== 'open' && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>⚠️</span>
              <span>WhatsApp desconectado. <button onClick={()=>setActiveView('connection')} style={{ color: '#fbbf24', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Outfit, sans-serif' }}>Conecte na aba Conexão</button> para enviar mensagens.</span>
            </div>
          )}

          {pendingAppts.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Nenhum agendamento confirmado ou pendente.</p>
          ) : (
            <div className="space-y-3 no-scrollbar" style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
              {pendingAppts.map(appt => {
                const srv  = myServices.find(s => s.id === appt.serviceId);
                const prof = myProfessionals.find(p => p.id === appt.professionalId);
                return (
                  <div key={appt.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.88)', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' as const }}>{appt.date} · {appt.time}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, textTransform: 'uppercase' as const, background: appt.status==='confirmed' ? 'rgba(99,102,241,0.12)' : 'rgba(251,191,36,0.1)', color: appt.status==='confirmed' ? '#a5b4fc' : '#fbbf24', border: `1px solid ${appt.status==='confirmed' ? 'rgba(99,102,241,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
                          {appt.status==='confirmed'?'Confirmado':'Pendente'}
                        </span>
                      </div>
                      <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{appt.customerName}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{srv?.name} · {prof?.name} · <span style={{ fontFamily: 'monospace' }}>{appt.customerPhone}</span></p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, flexShrink: 0 }}>
                      {([
                        { type:'confirmation' as const, label:'✓ Confirmar' },
                        { type:'reminder'     as const, label:'⏰ Lembrete' },
                        { type:'cancellation' as const, label:'✕ Cancelar' },
                      ]).map(({ type, label }) => {
                        const key  = `${appt.id}-${type}`;
                        const busy = sendStates[key] === 'sending';
                        return (
                          <button key={type} disabled={busy || connState!=='open'} onClick={() => doSend(appt, type)} style={{ ...btnStyle(key), opacity: (busy || connState!=='open') ? 0.5 : 1 }}>
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
      )}

      {/* ══════════════════════════════════════════════════════
          VIEW: MODELOS DE MENSAGEM
      ══════════════════════════════════════════════════════ */}
      {activeView === 'templates' && (
        <div className="space-y-6">

        {/* ── Notificações automáticas ─────────────────────── */}
        <div style={card} className="space-y-5">
          <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>
            Notificações Automáticas
          </h4>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace' }}>
            {'Variáveis: {nome}  {salao}  {servico}  {data}  {hora}  {duracao}  {profissional}  {codigo}'}
            <br />
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>{'  {link}'}</span>
            {' — link de cancelamento gerado automaticamente'}
          </p>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.65)' }}>
              ✅ Confirmação (enviada ao agendar)
            </label>
            <textarea value={autoConfirmDraft} onChange={e => setAutoConfirmDraft(e.target.value)} rows={8}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'vertical' as const, outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.65)' }}>
                ⏰ Lembrete automático
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Enviar</span>
                <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: 600, padding: '5px 10px', fontFamily: 'Outfit, sans-serif', cursor: 'pointer', outline: 'none' }}>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1h antes</option>
                  <option value={120}>2h antes</option>
                  <option value={180}>3h antes</option>
                  <option value={360}>6h antes</option>
                  <option value={720}>12h antes</option>
                  <option value={1440}>24h antes</option>
                </select>
              </div>
            </div>
            <textarea value={autoRemindDraft} onChange={e => setAutoRemindDraft(e.target.value)} rows={8}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'vertical' as const, outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
          </div>

          <button onClick={handleSaveAutoTpls} disabled={tplSaving}
            style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: tplSaving ? 'wait' : 'pointer', opacity: tplSaving ? 0.7 : 1, fontFamily: 'Outfit, sans-serif' }}>
            {tplSaving ? 'Salvando…' : 'Salvar Notificações Automáticas'}
          </button>
        </div>

        {/* ── Modelos manuais (dispatch) ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div style={card} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Modelos — Disparo Manual</h4>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace' }}>
              Variáveis: {'{cliente}  {servico}  {profissional}  {data}  {hora}  {salao}'}
            </p>
            {([
              { key:'confirm' as const, label:'✅ Confirmação', preview:'confirmation' as const },
              { key:'remind'  as const, label:'⏰ Lembrete (T-24h)', preview:'reminder' as const },
              { key:'cancel'  as const, label:'❌ Cancelamento', preview:'cancellation' as const },
            ]).map(t => (
              <div key={t.key} onClick={() => setActivePreview(t.preview)}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, cursor: 'pointer', color: activePreview===t.preview ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.38)' }}>{t.label}</label>
                <textarea
                  value={tplsDraft[t.key]}
                  onChange={e => setTplsDraft(prev => ({ ...prev, [t.key]: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', background: activePreview===t.preview ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activePreview===t.preview ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'none' as const, outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }}
                />
              </div>
            ))}
            <button onClick={handleSaveTpls} style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Salvar Modelos</button>
          </div>

          {/* Preview estilo WhatsApp — mantém dark theme original */}
          <div style={card} className="space-y-5">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', margin: 0 }}>Preview</h4>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['confirmation','reminder','cancellation'] as const).map(t => (
                  <button key={t} onClick={() => setActivePreview(t)}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: activePreview===t ? '#ffffff' : 'rgba(255,255,255,0.07)', color: activePreview===t ? '#031D3C' : 'rgba(255,255,255,0.55)', border: `1px solid ${activePreview===t ? '#ffffff' : 'rgba(255,255,255,0.09)'}` }}>
                    {t==='confirmation'?'Confirm.':t==='reminder'?'Lembrete':'Cancel.'}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#0b141a] rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex gap-3 items-center">
                <div className="size-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {activeTenant.name[0]}
                </div>
                <div>
                  <div className="text-white font-bold text-sm">{activeTenant.name}</div>
                  <div className="text-emerald-400 text-xs">✓ Verificado · online</div>
                </div>
              </div>
              <div className="bg-[#202c33] rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                <p className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-line">{previewMsg()}</p>
                <div className="flex justify-end mt-2">
                  <span className="text-[#8696a0] text-[10px]">{new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} ✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

    </div>
  );
}
