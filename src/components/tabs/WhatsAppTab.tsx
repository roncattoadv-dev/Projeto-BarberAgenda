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

  const connColor  = { open:'bg-emerald-500', close:'bg-red-500', connecting:'bg-amber-400', error:'bg-slate-400', checking:'bg-slate-300' }[connState];
  const connLabel  = { open:'Conectado ✓', close:'Desconectado', connecting:'Aguardando QR…', error:'Erro de conexão', checking:'Verificando…' }[connState];
  const connBadge  = { open:'bg-emerald-50 text-emerald-700 border-emerald-200', close:'bg-red-50 text-red-700 border-red-200', connecting:'bg-amber-50 text-amber-700 border-amber-200', error:'bg-slate-100 text-slate-600 border-slate-200', checking:'bg-slate-100 text-slate-500 border-slate-200' }[connState];

  const btnLabel = (key: string) => ({ idle:'Enviar', sending:'⏳…', done:'✓ Enviado', error:'✕ Erro' }[sendStates[key]||'idle']);
  const btnCls   = (key: string) => {
    const s = sendStates[key]||'idle';
    const b = 'px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap ';
    return b + ({ idle:'bg-slate-900 text-white hover:bg-slate-700', sending:'bg-amber-50 text-amber-700 cursor-wait', done:'bg-emerald-50 text-emerald-700', error:'bg-red-50 text-red-700' }[s]);
  };

  const tabs: { id: ActiveView; label: string; dot?: boolean }[] = [
    { id:'connection', label:'📶 Conexão',   dot: connState !== 'open' && connState !== 'checking' },
    { id:'dispatch',   label:'📤 Disparar',  dot: pendingAppts.length > 0 },
    { id:'templates',  label:'✏️ Modelos' },
    { id:'config',     label:'⚙️ Config' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">WhatsApp</span>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Evolution Go
            <span className="text-xs font-normal text-slate-400 font-mono">
              instância: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{cfg.instance}</code>
            </span>
          </h3>
          {instanceInfo?.profileName && (
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
              {instanceInfo.profilePicUrl && <img src={instanceInfo.profilePicUrl} className="w-5 h-5 rounded-full" alt="" />}
              {instanceInfo.profileName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${connBadge}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${connColor} ${connState==='open'?'animate-pulse':''}`} />
            {connLabel}
          </div>
          <button onClick={refreshStatus} className="size-9 rounded-full border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 text-lg transition" title="Verificar status">↻</button>
        </div>
      </div>

      {/* ── Alerta sem config ───────────────────────────────── */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <strong>Evo Go não configurado.</strong> Vá para a aba <button onClick={()=>setActiveView('config')} className="underline font-bold">⚙️ Config</button> e preencha a URL, instância e API Key do seu Evo Go no EasyPanel.
          </div>
        </div>
      )}

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveView(t.id)}
            className={`relative px-5 py-2.5 text-sm font-semibold rounded-full transition-all ${activeView===t.id?'bg-slate-900 text-white shadow-md':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
            {t.dot && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          VIEW: CONEXÃO — QR Code
      ══════════════════════════════════════════════════════ */}
      {activeView === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Painel de estado + ações */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Status da Instância</h4>

            {/* Info card */}
            <div className={`p-5 rounded-2xl border-2 text-center space-y-2 ${
              connState==='open' ? 'bg-emerald-50 border-emerald-200'
              : connState==='connecting' ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-4xl">
                {connState==='open' ? '✅' : connState==='connecting' ? '📱' : connState==='error' ? '❌' : '⏳'}
              </div>
              <p className="font-bold text-slate-900">{connLabel}</p>
              {connState==='open' && instanceInfo && (
                <p className="text-sm text-slate-600">{instanceInfo.profileName || cfg.instance}</p>
              )}
              {connState==='close' && (
                <p className="text-xs text-slate-500">Escaneie o QR Code para conectar</p>
              )}
              {connState==='connecting' && (
                <p className="text-xs text-amber-700">Aguardando leitura do QR Code…</p>
              )}
            </div>

            {/* Botões de ação */}
            <div className="space-y-3">
              {connState !== 'open' && (
                <button onClick={handleConnect} disabled={!isConfigured || qrLoading}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-full transition flex items-center justify-center gap-2 text-sm shadow-sm">
                  {qrLoading ? '⏳ Gerando QR…' : '📱 Conectar WhatsApp (QR Code)'}
                </button>
              )}
              {connState !== 'open' && (
                <button onClick={handleCreateInstance} disabled={!isConfigured}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-full transition text-sm border border-slate-200">
                  ➕ Criar instância "{cfg.instance}"
                </button>
              )}
              {connState === 'open' && (
                <button onClick={handleLogout}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-full transition text-sm border border-red-200">
                  🔌 Desconectar WhatsApp
                </button>
              )}
              {(connState === 'connecting' || qrData) && (
                <button onClick={fetchQR} disabled={qrLoading}
                  className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-full transition text-sm border border-amber-200">
                  🔄 Novo QR Code
                </button>
              )}
            </div>

            {/* Info técnica */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1 font-mono">
              <p><span className="text-slate-400">URL:</span> {cfg.url || '—'}</p>
              <p><span className="text-slate-400">Instância:</span> {cfg.instance}</p>
              <p><span className="text-slate-400">API Key:</span> {cfg.apikey ? '••••' + cfg.apikey.slice(-4) : '—'}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-6 min-h-[340px]">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider w-full border-b border-slate-100 pb-3">QR Code</h4>

            {connState === 'open' ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl">✅</div>
                <p className="font-bold text-emerald-700 text-lg">WhatsApp Conectado!</p>
                {instanceInfo?.profileName && (
                  <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200">
                    {instanceInfo.profilePicUrl && <img src={instanceInfo.profilePicUrl} className="w-10 h-10 rounded-full border border-slate-200" alt="" />}
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{instanceInfo.profileName}</p>
                      <p className="text-xs text-slate-500">{instanceInfo.ownerJid?.replace('@s.whatsapp.net','')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Gerando QR Code…</p>
              </div>
            ) : qrData?.base64 ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-md">
                  <img
                    src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52 object-contain"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">Abra o WhatsApp no celular</p>
                  <p className="text-xs text-slate-500">⋯ → Dispositivos conectados → Conectar dispositivo</p>
                  <p className="text-[10px] text-amber-600 font-mono mt-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    ⏰ QR expira em ~45s — atualizado automaticamente
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl">📱</div>
                <p className="text-slate-600 font-medium text-sm max-w-[220px]">
                  Clique em <strong>"Conectar WhatsApp"</strong> para gerar o QR Code
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
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Disparar Notificações</h4>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${connBadge}`}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${connColor}`} />{connLabel}
              </span>
              <span className="text-xs font-mono text-slate-400">{pendingAppts.length} agendamento(s)</span>
            </div>
          </div>

          {connState !== 'open' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-center gap-3">
              <span>⚠️</span>
              <span>WhatsApp desconectado. <button onClick={()=>setActiveView('connection')} className="underline font-bold">Conecte na aba Conexão</button> para enviar mensagens.</span>
            </div>
          )}

          {pendingAppts.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-sm">Nenhum agendamento confirmado ou pendente.</p>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {pendingAppts.map(appt => {
                const srv  = myServices.find(s => s.id === appt.serviceId);
                const prof = myProfessionals.find(p => p.id === appt.professionalId);
                return (
                  <div key={appt.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="bg-slate-900 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-lg whitespace-nowrap">{appt.date} · {appt.time}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${appt.status==='confirmed'?'bg-blue-50 text-blue-700 border-blue-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {appt.status==='confirmed'?'Confirmado':'Pendente'}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm truncate">{appt.customerName}</p>
                      <p className="text-xs text-slate-500">{srv?.name} · {prof?.name} · <span className="font-mono">{appt.customerPhone}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {([
                        { type:'confirmation' as const, label:'✓ Confirmar' },
                        { type:'reminder'     as const, label:'⏰ Lembrete' },
                        { type:'cancellation' as const, label:'✕ Cancelar' },
                      ]).map(({ type, label }) => {
                        const key  = `${appt.id}-${type}`;
                        const busy = sendStates[key] === 'sending';
                        return (
                          <button key={type} disabled={busy || connState!=='open'} onClick={() => doSend(appt, type)} className={btnCls(key)}>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Modelos de Mensagem</h4>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Variáveis: <code className="bg-slate-200 px-1 rounded">{'{'}</code>cliente{'}'}  {'{'}{'}'}servico{'{'}{'}'}  profissional{'{'}{'}'}  data{'{'}{'}'}  hora{'{'}{'}'}  salao{'}'}
            </p>
            {([
              { key:'confirm' as const, label:'✅ Confirmação', preview:'confirmation' as const },
              { key:'remind'  as const, label:'⏰ Lembrete (T-24h)', preview:'reminder' as const },
              { key:'cancel'  as const, label:'❌ Cancelamento', preview:'cancellation' as const },
            ]).map(t => (
              <div key={t.key} onClick={() => setActivePreview(t.preview)}>
                <label className={`text-xs font-semibold uppercase block mb-1 transition ${activePreview===t.preview?'text-blue-600':'text-slate-500'}`}>{t.label}</label>
                <textarea
                  value={tplsDraft[t.key]}
                  onChange={e => setTplsDraft(prev => ({ ...prev, [t.key]: e.target.value }))}
                  rows={3}
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm resize-none focus:outline-none transition ${activePreview===t.preview?'border-blue-400 ring-1 ring-blue-200':'border-slate-200 focus:border-blue-400'}`}
                />
              </div>
            ))}
            <button onClick={handleSaveTpls} className="w-full py-3.5 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 transition text-sm">Salvar Modelos</button>
          </div>

          {/* Preview estilo WhatsApp */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Preview</h4>
              <div className="flex gap-2">
                {(['confirmation','reminder','cancellation'] as const).map(t => (
                  <button key={t} onClick={() => setActivePreview(t)}
                    className={`text-xs px-3 py-1 rounded-full font-semibold transition ${activePreview===t?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Configuração Evolution Go</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Preencha com os dados do seu Evo Go rodando no EasyPanel. As configurações ficam salvas localmente no navegador.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">URL do Evo Go <span className="text-red-500">*</span></label>
                <input type="url" placeholder="https://evo.seudominio.com.br" value={cfgDraft.url}
                  onChange={e => setCfgDraft(p => ({...p, url: e.target.value}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-mono" />
                <p className="text-[10px] text-slate-400 mt-1">Ex: https://evo.barberflow.com.br (sem barra no final)</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome da Instância <span className="text-red-500">*</span></label>
                <input type="text" placeholder="barberflow" value={cfgDraft.instance}
                  onChange={e => setCfgDraft(p => ({...p, instance: e.target.value.trim()}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-mono" />
                <p className="text-[10px] text-slate-400 mt-1">Nome da instância criada no painel do Evo Go</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">GLOBAL_API_KEY <span className="text-red-500">*</span></label>
                <input type="password" placeholder="SUA_CHAVE_FORTE_AQUI" value={cfgDraft.apikey}
                  onChange={e => setCfgDraft(p => ({...p, apikey: e.target.value.trim()}))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-blue-500 font-mono" />
                <p className="text-[10px] text-slate-400 mt-1">A mesma chave definida em <code className="bg-slate-100 px-1 rounded">GLOBAL_API_KEY</code> no .env do Evo Go</p>
              </div>

              <button onClick={handleSaveConfig}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition shadow-sm text-sm">
                Salvar e Verificar Conexão
              </button>
              <button onClick={() => { setCfgDraft(getWindowDefaults()); }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-full transition text-sm border border-slate-200 text-xs">
                Restaurar valores das variáveis de ambiente
              </button>
            </div>
          </div>

          {/* Guia de configuração */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">Guia rápido — EasyPanel</h4>
            <div className="space-y-4 text-sm text-slate-600">
              {[
                { step:'1', title:'Acesse o EasyPanel', desc:'Abra seu EasyPanel e localize o serviço Evolution Go.' },
                { step:'2', title:'Copie a URL', desc:'A URL pública do Evo Go geralmente tem formato: https://evo.seudominio.com.br ou https://seudominio.com/evo.' },
                { step:'3', title:'Pegue a GLOBAL_API_KEY', desc:'No .env do serviço Evo Go no EasyPanel, copie o valor de GLOBAL_API_KEY. É essa chave que vai no campo API Key acima.' },
                { step:'4', title:'Nome da instância', desc:'Pode ser qualquer nome (ex: barberflow). Se ainda não criou, clique em "Criar instância" na aba Conexão após salvar a config.' },
                { step:'5', title:'Conecte o WhatsApp', desc:'Vá para a aba Conexão, clique em "Conectar WhatsApp" e escaneie o QR Code com o celular.' },
              ].map(item => (
                <div key={item.step} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Referência .env Evo Go */}
            <div className="bg-slate-950 rounded-2xl p-4 text-xs font-mono space-y-1">
              <p className="text-slate-400 mb-2"># .env do Evo Go (EasyPanel)</p>
              <p><span className="text-amber-400">SERVER_PORT</span>=<span className="text-emerald-400">8080</span></p>
              <p><span className="text-amber-400">CLIENT_NAME</span>=<span className="text-emerald-400">evolution</span></p>
              <p><span className="text-blue-400">GLOBAL_API_KEY</span>=<span className="text-red-400">SUA_CHAVE_FORTE_AQUI</span> <span className="text-slate-500">← copie esta</span></p>
              <p><span className="text-amber-400">POSTGRES_AUTH_DB</span>=<span className="text-emerald-400">postgresql://...</span></p>
              <p><span className="text-amber-400">POSTGRES_USERS_DB</span>=<span className="text-emerald-400">postgresql://...</span></p>
              <p><span className="text-amber-400">CONNECT_ON_STARTUP</span>=<span className="text-emerald-400">true</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
