/**
 * WhatsAppTab — Painel completo de integração Evolution Go
 * Funcionalidades:
 *  - Status live da instância com polling
 *  - QR Code embutido para conectar o WhatsApp sem sair do SaaS
 *  - Gestão de instância (criar, conectar, logout)
 *  - Templates editáveis com preview dark
 *  - Dispatch de mensagens por agendamento (confirmar / lembrete / cancelar)
 *  - Configuração das variáveis Evo Go direto na interface
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, Service, Professional, Tenant } from '../../types';
import { useToast } from '../../hooks/useToast';
import {
  sendWhatsApp, checkEvoStatus, fetchQRCode, logoutInstance,
  createInstance, fetchInstanceInfo,
  buildConfirmationMsg, buildReminderMsg, buildCancellationMsg, buildCustomMsg,
  normalizePhone, formatDatePT,
  EVO_URL, EVO_INSTANCE, EVO_APIKEY, EVO_CONFIGURED,
  type ConnectionState, type WppStatus, type QRCodeData, type InstanceInfo, type ApptData,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  myAppointments: Appointment[];
  myServices: Service[];
  myProfessionals: Professional[];
}

type SendState = 'idle' | 'sending' | 'done' | 'error';
type ActiveView = 'connection' | 'templates' | 'dispatch' | 'config';

// Lê/salva config local — prioridade: localStorage > window runtime > vazio
const LS_KEY = 'barber_evo_config';
interface EvoConfig { url: string; instance: string; apikey: string; }

function getWindowDefaults(): EvoConfig {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return {
    url:      (w.EVO_URL      || EVO_URL      || '').replace(/\/$/, ''),
    instance: (w.EVO_INSTANCE || EVO_INSTANCE || 'barberflow'),
    apikey:   (w.EVO_APIKEY   || EVO_APIKEY   || ''),
  };
}

function loadConfig(): EvoConfig {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return getWindowDefaults();
}

function saveConfig(cfg: EvoConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

// Aplica config dinâmica sobrescrevendo as constantes do módulo para chamadas de fetch
// Usamos um wrapper que aceita cfg como parâmetro
async function evoFetchDynamic<T>(
  cfg: EvoConfig, path: string, options: RequestInit = {}
): Promise<T> {
  const url = cfg.url.replace(/\/$/, '') + path;
  const res  = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': cfg.apikey,
      ...options.headers,
    },
  });
  if (!res.ok) { const t = await res.text().catch(() => res.statusText); throw new Error(`[${res.status}] ${t}`); }
  return res.json();
}

export default function WhatsAppTab({ activeTenant, myAppointments, myServices, myProfessionals }: Props) {
  const toast = useToast();

  // ── Config Evo Go ──────────────────────────────────────────
  const [cfg, setCfg] = useState<EvoConfig>(loadConfig);
  const [cfgDraft, setCfgDraft] = useState<EvoConfig>(loadConfig);
  const isConfigured = !!(cfg.url && cfg.apikey);

  // ── Estado de conexão ──────────────────────────────────────
  const [connState, setConnState] = useState<ConnectionState>('checking');
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [qrData,    setQrData]    = useState<QRCodeData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrRefreshCount, setQrRefreshCount] = useState(0);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI ─────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('connection');
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({});
  const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'cancellation'>('confirmation');

  // ── Templates ──────────────────────────────────────────────
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
  const [tpls, setTpls]     = useState(loadTpls);
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
  });

  // ── Verificação de status ─────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!isConfigured) { setConnState('error'); return; }
    try {
      const res = await evoFetchDynamic<{ instance: { state: ConnectionState } }>(
        cfg, `/instance/connectionState/${cfg.instance}`
      );
      const state = res?.instance?.state ?? 'error';
      setConnState(state);
      if (state === 'open') {
        setQrData(null);
        stopQrPolling();
        // Busca info do perfil quando conectado
        try {
          const info = await evoFetchDynamic<any>(cfg, `/instance/fetchInstances?instanceName=${cfg.instance}`);
          const inst = Array.isArray(info) ? info[0]?.instance : info?.instance;
          if (inst) setInstanceInfo(inst);
        } catch {}
      }
    } catch {
      setConnState('error');
    }
  }, [cfg, isConfigured]);

  // ── QR Code polling ────────────────────────────────────────
  const stopQrPolling = () => {
    if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; }
  };

  const fetchQR = useCallback(async () => {
    if (!isConfigured) return;
    setQrLoading(true);
    try {
      const data = await evoFetchDynamic<any>(cfg, `/instance/connect/${cfg.instance}`);
      if (data?.base64 || data?.qrcode?.base64) {
        const qr: QRCodeData = {
          base64: data?.base64        || data?.qrcode?.base64 || '',
          code:   data?.code          || data?.qrcode?.code   || '',
          count:  (qrRefreshCount + 1),
        };
        setQrData(qr);
        setQrRefreshCount(c => c + 1);
      } else if (data?.instance?.state === 'open') {
        setConnState('open');
        setQrData(null);
        stopQrPolling();
      }
    } catch (err) {
      console.error('[QR]', err);
    } finally {
      setQrLoading(false);
    }
  }, [cfg, isConfigured, qrRefreshCount]);

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
  const handleConnect = async () => {
    setConnState('connecting');
    startQrPolling();
  };

  const handleLogout = async () => {
    if (!window.confirm('Desconectar o WhatsApp desta instância?')) return;
    try {
      await evoFetchDynamic(cfg, `/instance/logout/${cfg.instance}`, { method: 'DELETE' });
      setConnState('close');
      setInstanceInfo(null);
      setQrData(null);
      toast.info('WhatsApp desconectado.');
    } catch (err: any) {
      toast.error('Erro ao desconectar: ' + err.message);
    }
  };

  const handleCreateInstance = async () => {
    try {
      await evoFetchDynamic(cfg, '/instance/create', {
        method: 'POST',
        body: JSON.stringify({ instanceName: cfg.instance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      });
      toast.success(`Instância "${cfg.instance}" criada!`);
      await refreshStatus();
    } catch (err: any) {
      toast.error('Erro ao criar instância: ' + err.message);
    }
  };

  // ── Salvar config ──────────────────────────────────────────
  const handleSaveConfig = () => {
    if (!cfgDraft.url || !cfgDraft.apikey) { toast.error('URL e API Key são obrigatórios.'); return; }
    const cleaned = { ...cfgDraft, url: cfgDraft.url.replace(/\/$/, '') };
    setCfg(cleaned);
    saveConfig(cleaned);
    toast.success('Configuração salva! Verificando conexão…');
    setTimeout(refreshStatus, 500);
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

    // Usa fetch dinâmico com config atual
    let result: WppStatus = 'error';
    try {
      await evoFetchDynamic(cfg, `/message/sendText/${cfg.instance}`, {
        method: 'POST',
        body: JSON.stringify({ number: normalizePhone(appt.customerPhone), text: msg, delay: 1200 }),
      });
      result = 'sent';
    } catch { result = 'error'; }

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
    { id:'config',     label:'⚙️ Config' },
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
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.88)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Evolution Go
            <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace' }}>
              instância: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 4 }}>{cfg.instance}</code>
            </span>
          </h3>
          {instanceInfo?.profileName && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {instanceInfo.profilePicUrl && <img src={instanceInfo.profilePicUrl} style={{ width: 18, height: 18, borderRadius: '50%' }} alt="" />}
              {instanceInfo.profileName}
            </p>
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

      {/* ── Alerta sem config ───────────────────────────────── */}
      {!isConfigured && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 14, padding: '14px 18px', fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <strong>Evo Go não configurado.</strong> Vá para a aba <button onClick={()=>setActiveView('config')} style={{ color: '#fbbf24', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Outfit, sans-serif' }}>⚙️ Config</button> e preencha a URL, instância e API Key do seu Evo Go no EasyPanel.
          </div>
        </div>
      )}

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
              {connState==='open' && instanceInfo && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{instanceInfo.profileName || cfg.instance}</p>
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
                <button onClick={handleConnect} disabled={!isConfigured || qrLoading}
                  style={{ width: '100%', padding: '13px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: (!isConfigured || qrLoading) ? 'not-allowed' : 'pointer', opacity: (!isConfigured || qrLoading) ? 0.5 : 1, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {qrLoading ? '⏳ Gerando QR…' : '📱 Conectar WhatsApp (QR Code)'}
                </button>
              )}
              {connState !== 'open' && (
                <button onClick={handleCreateInstance} disabled={!isConfigured}
                  style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 13, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, cursor: !isConfigured ? 'not-allowed' : 'pointer', opacity: !isConfigured ? 0.5 : 1, fontFamily: 'Outfit, sans-serif' }}>
                  ➕ Criar instância "{cfg.instance}"
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

            {/* Info técnica */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'monospace', lineHeight: 1.8 }}>
              <p><span style={{ color: 'rgba(255,255,255,0.25)' }}>URL:</span> {cfg.url || '—'}</p>
              <p><span style={{ color: 'rgba(255,255,255,0.25)' }}>Instância:</span> {cfg.instance}</p>
              <p><span style={{ color: 'rgba(255,255,255,0.25)' }}>API Key:</span> {cfg.apikey ? '••••' + cfg.apikey.slice(-4) : '—'}</p>
            </div>
          </div>

          {/* QR Code */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: 340 }} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0, width: '100%' }}>QR Code</h4>

            {connState === 'open' ? (
              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16, padding: '24px 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
                <p style={{ fontWeight: 700, color: '#4ade80', fontSize: 16 }}>WhatsApp Conectado!</p>
                {instanceInfo?.profileName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.09)' }}>
                    {instanceInfo.profilePicUrl && <img src={instanceInfo.profilePicUrl} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.09)' }} alt="" />}
                    <div>
                      <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>{instanceInfo.profileName}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{instanceInfo.ownerJid?.replace('@s.whatsapp.net','')}</p>
                    </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div style={card} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Modelos de Mensagem</h4>
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
      )}

      {/* ══════════════════════════════════════════════════════
          VIEW: CONFIGURAÇÃO Evo Go
      ══════════════════════════════════════════════════════ */}
      {activeView === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div style={card} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Configuração Evolution Go</h4>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
              Preencha com os dados do seu Evo Go rodando no EasyPanel. As configurações ficam salvas localmente no navegador.
            </p>

            <div className="space-y-4">
              <div>
                <label className="navy-label">URL do Evo Go <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="url" placeholder="https://evo.seudominio.com.br" value={cfgDraft.url}
                  onChange={e => setCfgDraft(p => ({...p, url: e.target.value}))}
                  className="navy-input" style={{ fontFamily: 'monospace' }} />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Ex: https://evo.barberflow.com.br (sem barra no final)</p>
              </div>

              <div>
                <label className="navy-label">Nome da Instância <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="text" placeholder="barberflow" value={cfgDraft.instance}
                  onChange={e => setCfgDraft(p => ({...p, instance: e.target.value.trim()}))}
                  className="navy-input" style={{ fontFamily: 'monospace' }} />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Nome da instância criada no painel do Evo Go</p>
              </div>

              <div>
                <label className="navy-label">GLOBAL_API_KEY <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="password" placeholder="SUA_CHAVE_FORTE_AQUI" value={cfgDraft.apikey}
                  onChange={e => setCfgDraft(p => ({...p, apikey: e.target.value.trim()}))}
                  className="navy-input" style={{ fontFamily: 'monospace' }} />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>A mesma chave definida em <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4 }}>GLOBAL_API_KEY</code> no .env do Evo Go</p>
              </div>

              <button onClick={handleSaveConfig}
                style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Salvar e Verificar Conexão
              </button>
              <button onClick={() => { setCfgDraft(getWindowDefaults()); }}
                style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 12, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Restaurar valores das variáveis de ambiente
              </button>
            </div>
          </div>

          {/* Guia de configuração */}
          <div style={card} className="space-y-5">
            <h4 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' as const, letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, margin: 0 }}>Guia rápido — EasyPanel</h4>
            <div className="space-y-4">
              {[
                { step:'1', title:'Acesse o EasyPanel', desc:'Abra seu EasyPanel e localize o serviço Evolution Go.' },
                { step:'2', title:'Copie a URL', desc:'A URL pública do Evo Go geralmente tem formato: https://evo.seudominio.com.br ou https://seudominio.com/evo.' },
                { step:'3', title:'Pegue a GLOBAL_API_KEY', desc:'No .env do serviço Evo Go no EasyPanel, copie o valor de GLOBAL_API_KEY. É essa chave que vai no campo API Key acima.' },
                { step:'4', title:'Nome da instância', desc:'Pode ser qualquer nome (ex: barberflow). Se ainda não criou, clique em "Criar instância" na aba Conexão após salvar a config.' },
                { step:'5', title:'Conecte o WhatsApp', desc:'Vá para a aba Conexão, clique em "Conectar WhatsApp" e escaneie o QR Code com o celular.' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', color: '#031D3C', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{item.step}</span>
                  <div>
                    <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, marginBottom: 2 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Referência .env Evo Go */}
            <div style={{ background: '#050d14', borderRadius: 14, padding: '16px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8 }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}># .env do Evo Go (EasyPanel)</p>
              <p><span style={{ color: '#fbbf24' }}>SERVER_PORT</span>=<span style={{ color: '#4ade80' }}>8080</span></p>
              <p><span style={{ color: '#fbbf24' }}>CLIENT_NAME</span>=<span style={{ color: '#4ade80' }}>evolution</span></p>
              <p><span style={{ color: '#93c5fd' }}>GLOBAL_API_KEY</span>=<span style={{ color: '#fca5a5' }}>SUA_CHAVE_FORTE_AQUI</span> <span style={{ color: 'rgba(255,255,255,0.25)' }}>← copie esta</span></p>
              <p><span style={{ color: '#fbbf24' }}>POSTGRES_AUTH_DB</span>=<span style={{ color: '#4ade80' }}>postgresql://...</span></p>
              <p><span style={{ color: '#fbbf24' }}>POSTGRES_USERS_DB</span>=<span style={{ color: '#4ade80' }}>postgresql://...</span></p>
              <p><span style={{ color: '#fbbf24' }}>CONNECT_ON_STARTUP</span>=<span style={{ color: '#4ade80' }}>true</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
