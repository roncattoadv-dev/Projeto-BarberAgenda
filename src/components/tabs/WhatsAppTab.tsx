import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tenant } from '../../types';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../lib/supabase';
import {
  checkStatusServer, fetchQRCodeServer, disconnectServer,
  buildCustomMsg,
  type ConnectionState, type QRCodeData, type ApptData,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  onStatusChange?: (state: ConnectionState, name: string | null) => void;
}

type ActiveView = 'connection' | 'templates';

function getApiUrl() {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 46,
        height: 26,
        borderRadius: 13,
        background: on ? '#4ade80' : 'rgba(255,255,255,0.15)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 4,
        left: on ? 24 : 4,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        display: 'block',
      }} />
    </button>
  );
}

export default function WhatsAppTab({ activeTenant, onStatusChange }: Props) {
  const toast = useToast();

  // ── Auth token ─────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string>('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAuthToken(session?.access_token || ''));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthToken(session?.access_token || ''));
    return () => subscription.unsubscribe();
  }, []);

  // ── Channel toggles (saved server-side) ───────────────────
  const [wppEnabled,   setWppEnabled]   = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [toggling,     setToggling]     = useState(false);

  const saveChannelToggle = async (wpp: boolean, email: boolean) => {
    if (!authToken) return;
    setToggling(true);
    try {
      await fetch(`${getApiUrl()}/api/whatsapp/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ wppEnabled: wpp, emailEnabled: email }),
      });
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const handleToggleWpp = async () => {
    const next = !wppEnabled;
    setWppEnabled(next);
    await saveChannelToggle(next, emailEnabled);
    toast.success(next ? 'WhatsApp automático ativado' : 'WhatsApp automático desativado');
  };

  const handleToggleEmail = async () => {
    const next = !emailEnabled;
    setEmailEnabled(next);
    await saveChannelToggle(wppEnabled, next);
    toast.success(next ? 'E-mail automático ativado' : 'E-mail automático desativado');
  };

  // ── WhatsApp connection state ──────────────────────────────
  const [connState, setConnState]   = useState<ConnectionState>('checking');
  const [connName,  setConnName]    = useState<string | null>(null);
  const [qrData,    setQrData]      = useState<QRCodeData | null>(null);
  const [qrLoading, setQrLoading]   = useState(false);
  const [qrRefreshCount, setQrRefreshCount] = useState(0);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI state ────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ActiveView>('connection');
  const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'cancellation'>('confirmation');

  // ── Auto templates ─────────────────────────────────────────
  const [autoConfirmDraft, setAutoConfirmDraft] = useState('');
  const [autoRemindDraft,  setAutoRemindDraft]  = useState('');
  const [reminderMinutes,  setReminderMinutes]  = useState(60);
  const [tplSaving,        setTplSaving]        = useState(false);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${getApiUrl()}/api/whatsapp/templates?tenantId=${activeTenant.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    }).then(r => r.json()).then(d => {
      if (d.ok) {
        setAutoConfirmDraft(d.confirm);
        setAutoRemindDraft(d.remind);
        if (d.reminderMinutes) setReminderMinutes(d.reminderMinutes);
        setWppEnabled(d.wppEnabled ?? true);
        setEmailEnabled(d.emailEnabled ?? true);
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

  // ── Manual templates ───────────────────────────────────────
  const LS_TPL = `barber_wpp_tpl_${activeTenant.id}`;
  const defaultTpls = {
    confirm: 'Olá {cliente}! Seu agendamento de {servico} com {profissional} no dia {data} às {hora} está CONFIRMADO. — {salao}',
    remind:  'Lembrete: {cliente}, amanhã ({data}) às {hora} você tem {servico} com {profissional}. Aguardamos você! — {salao}',
    cancel:  '{cliente}, seu agendamento de {servico} em {data} às {hora} foi cancelado. Para reagendar responda esta mensagem. — {salao}',
  };
  const loadTpls = () => { try { const s = localStorage.getItem(LS_TPL); if (s) return JSON.parse(s); } catch {} return defaultTpls; };
  const [tpls,      setTpls]      = useState(loadTpls);
  const [tplsDraft, setTplsDraft] = useState(loadTpls);

  // ── Connection status ──────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!authToken) return;
    const { state, name } = await checkStatusServer(activeTenant.id, authToken);
    setConnState(state);
    setConnName(name);
    onStatusChange?.(state, name);
    if (state === 'open') { setQrData(null); stopQrPolling(); }
  }, [authToken, activeTenant.id, onStatusChange]);

  const stopQrPolling = () => {
    if (qrIntervalRef.current) { clearInterval(qrIntervalRef.current); qrIntervalRef.current = null; }
  };

  const fetchQR = useCallback(async () => {
    if (!authToken) return;
    setQrLoading(true);
    try {
      const qr = await fetchQRCodeServer(activeTenant.id, authToken);
      if (qr) { setQrData({ ...qr, count: qrRefreshCount + 1 }); setQrRefreshCount(c => c + 1); }
      else     { await refreshStatus(); }
    } catch (err) { console.error('[QR]', err); }
    finally { setQrLoading(false); }
  }, [authToken, activeTenant.id, qrRefreshCount]);

  const startQrPolling = useCallback(() => {
    fetchQR();
    stopQrPolling();
    qrIntervalRef.current = setInterval(() => {
      refreshStatus().then(() => { if (connState !== 'open') fetchQR(); });
    }, 30_000);
  }, [fetchQR, refreshStatus, connState]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 20_000);
    return () => { clearInterval(interval); stopQrPolling(); };
  }, [refreshStatus]);

  // ── Connection actions ─────────────────────────────────────
  const handleConnect = () => { setConnState('connecting'); startQrPolling(); };
  const handleLogout  = async () => {
    if (!window.confirm('Desconectar o WhatsApp? Será necessário escanear o QR Code novamente.')) return;
    try {
      await disconnectServer(activeTenant.id, authToken);
      setConnState('close'); setConnName(null); setQrData(null);
      toast.info('WhatsApp desconectado.');
    } catch (err: any) { toast.error('Erro ao desconectar: ' + err.message); }
  };

  const handleSaveTpls = () => {
    setTpls(tplsDraft);
    localStorage.setItem(LS_TPL, JSON.stringify(tplsDraft));
    toast.success('Modelos salvos!');
  };

  // ── UI helpers ─────────────────────────────────────────────
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
  const connLabel    = { open: 'Conectado', close: 'Desconectado', connecting: 'Aguardando QR…', error: 'Erro de conexão', checking: 'Verificando…' }[connState];

  const connBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600 };
    if (connState === 'open')       return { ...base, background: '#E6F4EC', color: '#0A4A2C', borderColor: '#A7D7BC' };
    if (connState === 'connecting') return { ...base, background: '#FEF9EC', color: '#7A4B0A', borderColor: '#F5DCB0' };
    if (connState === 'close')      return { ...base, background: '#FEECEC', color: '#7A0A0A', borderColor: '#F5B8B8' };
    return { ...base, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', borderColor: 'rgba(255,255,255,0.09)' };
  };

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 24,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    margin: 0,
  };

  const tabs: { id: ActiveView; label: string; dot?: boolean }[] = [
    { id: 'connection', label: '📶 Conexão',   dot: connState !== 'open' && connState !== 'checking' },
    { id: 'templates',  label: '✏️ Templates' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.92)', margin: '0 0 4px' }}>Automações</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
          Gerencie notificações automáticas por WhatsApp e e-mail
        </p>
      </div>

      {/* ── Channel toggle cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* WhatsApp card */}
        <div style={{
          ...card,
          border: wppEnabled ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(255,255,255,0.07)',
          background: wppEnabled ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: wppEnabled ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                📱
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14, margin: 0 }}>WhatsApp</p>
                <div style={{ marginTop: 4 }}>
                  <div style={connBadgeStyle()}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: connDotColor, flexShrink: 0 }} />
                    {connLabel}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Toggle on={wppEnabled} onChange={handleToggleWpp} disabled={toggling} />
              <span style={{ fontSize: 10, color: wppEnabled ? '#4ade80' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                {wppEnabled ? 'Automático ativo' : 'Automático inativo'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '14px 0 0', lineHeight: 1.5 }}>
            {wppEnabled
              ? 'Confirmações e lembretes enviados automaticamente via WhatsApp'
              : 'Envio automático de WhatsApp desativado — disparos manuais ainda funcionam'}
          </p>
        </div>

        {/* Email card */}
        <div style={{
          ...card,
          border: emailEnabled ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.07)',
          background: emailEnabled ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.03)',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: emailEnabled ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                📧
              </div>
              <div>
                <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 14, margin: 0 }}>E-mail</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
                  Confirmação para clientes com e-mail
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Toggle on={emailEnabled} onChange={handleToggleEmail} disabled={toggling} />
              <span style={{ fontSize: 10, color: emailEnabled ? '#818cf8' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                {emailEnabled ? 'Automático ativo' : 'Automático inativo'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: '14px 0 0', lineHeight: 1.5 }}>
            {emailEnabled
              ? 'E-mail de confirmação enviado quando o cliente informa seu e-mail ao agendar'
              : 'Envio automático de e-mail desativado'}
          </p>
        </div>

      </div>

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveView(t.id)}
            style={{
              position: 'relative',
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 20,
              border: `1px solid ${activeView === t.id ? '#ffffff' : 'rgba(255,255,255,0.09)'}`,
              background: activeView === t.id ? '#ffffff' : 'rgba(255,255,255,0.04)',
              color: activeView === t.id ? '#0F172A' : 'rgba(255,255,255,0.55)',
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
          VIEW: CONEXÃO
      ══════════════════════════════════════════════════════ */}
      {activeView === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div style={card} className="space-y-5">
            <h4 style={{ ...sectionTitle, borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12 }}>Status da Instância</h4>

            <div style={{
              padding: 20, borderRadius: 14, textAlign: 'center',
              border: `2px solid ${connState === 'open' ? 'rgba(74,222,128,0.35)' : connState === 'connecting' ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.09)'}`,
              background: connState === 'open' ? 'rgba(74,222,128,0.06)' : connState === 'connecting' ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {connState === 'open' ? '✅' : connState === 'connecting' ? '📱' : connState === 'error' ? '❌' : '⏳'}
              </div>
              <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: '0 0 4px' }}>
                {connState === 'open' ? 'Conectado ✓' : connLabel}
              </p>
              {connState === 'open' && connName && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{connName}</p>}
              {connState === 'close' && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: 0 }}>Escaneie o QR Code para conectar</p>}
              {connState === 'connecting' && <p style={{ fontSize: 11, color: '#fbbf24', margin: 0 }}>Aguardando leitura do QR Code…</p>}
            </div>

            <div className="space-y-3">
              <button onClick={refreshStatus}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                ↻ Verificar status
              </button>
              {connState !== 'open' && (
                <button onClick={handleConnect} disabled={qrLoading || !authToken}
                  style={{ width: '100%', padding: '13px', background: '#E6F4EC', color: '#0A4A2C', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: (qrLoading || !authToken) ? 'not-allowed' : 'pointer', opacity: (qrLoading || !authToken) ? 0.5 : 1, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {qrLoading ? '⏳ Gerando QR…' : '📱 Conectar WhatsApp'}
                </button>
              )}
              {connState === 'open' && (
                <button onClick={handleLogout}
                  style={{ width: '100%', padding: '11px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 700, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  🔌 Desconectar
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

          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }} className="space-y-5">
            <h4 style={{ ...sectionTitle, borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12, width: '100%' }}>QR Code</h4>

            {connState === 'open' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
                <p style={{ fontWeight: 700, color: '#4ade80', fontSize: 16 }}>WhatsApp Conectado!</p>
                {connName && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.09)' }}>
                    <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontSize: 13, margin: 0 }}>{connName}</p>
                  </div>
                )}
              </div>
            ) : qrLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
                <div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.65)', borderRadius: '50%' }} className="animate-spin" />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>Gerando QR Code…</p>
              </div>
            ) : qrData?.base64 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ padding: 12, background: '#ffffff', borderRadius: 16 }}>
                  <img src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`} alt="QR Code" style={{ width: 200, height: 200, objectFit: 'contain' }} />
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0', textAlign: 'center' }}>
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
          VIEW: TEMPLATES
      ══════════════════════════════════════════════════════ */}
      {activeView === 'templates' && (
        <div className="space-y-6">

          {/* Auto templates */}
          <div style={card} className="space-y-5">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 14 }}>
              <h4 style={sectionTitle}>Mensagens Automáticas</h4>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Enviadas automaticamente pelo servidor</span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', margin: 0 }}>
                {'Variáveis: {nome}  {salao}  {servico}  {data}  {hora}  {duracao}  {profissional}  {codigo}'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', margin: '4px 0 0' }}>
                {'  {link} — link de cancelamento automático'}
              </p>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.65)' }}>
                ✅ Confirmação (enviada ao agendar)
              </label>
              <textarea value={autoConfirmDraft} onChange={e => setAutoConfirmDraft(e.target.value)} rows={6}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(255,255,255,0.65)' }}>⏰ Lembrete automático</label>
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
              <textarea value={autoRemindDraft} onChange={e => setAutoRemindDraft(e.target.value)} rows={6}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleSaveAutoTpls} disabled={tplSaving}
              style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: tplSaving ? 'wait' : 'pointer', opacity: tplSaving ? 0.7 : 1, fontFamily: 'Outfit, sans-serif' }}>
              {tplSaving ? 'Salvando…' : 'Salvar Templates Automáticos'}
            </button>
          </div>

          {/* Manual templates + preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div style={card} className="space-y-5">
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 14 }}>
                <h4 style={sectionTitle}>Modelos — Disparo Manual</h4>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', margin: 0 }}>
                    {'{cliente}  {servico}  {profissional}  {data}  {hora}  {salao}'}
                  </p>
                </div>
              </div>
              {([
                { key: 'confirm' as const, label: '✅ Confirmação', preview: 'confirmation' as const },
                { key: 'remind'  as const, label: '⏰ Lembrete', preview: 'reminder' as const },
                { key: 'cancel'  as const, label: '❌ Cancelamento', preview: 'cancellation' as const },
              ]).map(t => (
                <div key={t.key} onClick={() => setActivePreview(t.preview)}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 6, cursor: 'pointer', color: activePreview === t.preview ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.38)' }}>{t.label}</label>
                  <textarea
                    value={tplsDraft[t.key]}
                    onChange={e => setTplsDraft(prev => ({ ...prev, [t.key]: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', background: activePreview === t.preview ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${activePreview === t.preview ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 10, padding: '10px 14px', color: 'rgba(255,255,255,0.88)', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button onClick={handleSaveTpls}
                style={{ width: '100%', padding: '13px', background: '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Salvar Modelos
              </button>
            </div>

            <div style={card} className="space-y-5">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.09)', paddingBottom: 12 }}>
                <h4 style={sectionTitle}>Preview</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['confirmation', 'reminder', 'cancellation'] as const).map(t => (
                    <button key={t} onClick={() => setActivePreview(t)}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: activePreview === t ? '#ffffff' : 'rgba(255,255,255,0.07)', color: activePreview === t ? '#0F172A' : 'rgba(255,255,255,0.55)', border: `1px solid ${activePreview === t ? '#ffffff' : 'rgba(255,255,255,0.09)'}` }}>
                      {t === 'confirmation' ? 'Confirm.' : t === 'reminder' ? 'Lembrete' : 'Cancel.'}
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
                    <span className="text-[#8696a0] text-[10px]">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
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
