import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tenant } from '../../types';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';
import {
  checkStatusServer, fetchQRCodeServer, disconnectServer,
  buildCustomMsg,
  type ConnectionState, type QRCodeData, type ApptData,
} from '../../services/whatsapp';

interface Props {
  activeTenant: Tenant;
  onStatusChange?: (state: ConnectionState, name: string | null) => void;
  section?: 'whatsapp' | 'email';
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

export default function WhatsAppTab({ activeTenant, onStatusChange, section }: Props) {
  const toast = useToast();
  const { session } = useAuth();

  // Ref estável para onStatusChange — evita que re-renders do pai recriem refreshStatus
  const onStatusChangeRef = React.useRef(onStatusChange);
  React.useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  // ── Auth token ─────────────────────────────────────────────
  const [authToken, setAuthToken] = useState<string>('');
  useEffect(() => {
    setAuthToken(session?.access_token || '');
  }, [session]);

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
        body: JSON.stringify({ tenantId: activeTenant.id, wppEnabled: wpp, emailEnabled: email }),
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
  const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'cancellation' | 'waitlist'>('confirmation');
  const [showQrModal,       setShowQrModal]       = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const disconnectingRef = React.useRef(false); // bloqueia poll por 8s após logout

  // ── Auto templates ─────────────────────────────────────────
  const [autoConfirmDraft, setAutoConfirmDraft] = useState('');
  const [autoRemindDraft,  setAutoRemindDraft]  = useState('');
  const [reminderMinutes,  setReminderMinutes]  = useState(60);
  const [tplSaving,        setTplSaving]        = useState(false);
  const [manualSaving,     setManualSaving]     = useState(false);
  const [waitlistSaving,   setWaitlistSaving]   = useState(false);

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
        // Preenche template de lista de espera do banco se existir
        if (d.waitlist) setTplsDraft(prev => ({ ...prev, waitlist: d.waitlist }));
      }
    }).catch(() => {});
  }, [authToken, activeTenant.id]);

  const handleSaveAutoTpls = async () => {
    setTplSaving(true);
    try {
      await fetch(`${getApiUrl()}/api/whatsapp/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ tenantId: activeTenant.id, confirm: autoConfirmDraft, remind: autoRemindDraft, reminderMinutes }),
      });
      toast.success('Templates salvos!');
    } catch { toast.error('Erro ao salvar templates.'); }
    finally { setTplSaving(false); }
  };

  // ── Manual templates ───────────────────────────────────────
  const LS_TPL = `barber_wpp_tpl_${activeTenant.id}`;
  const defaultTpls = {
    confirm:   'Olá {cliente}! Seu agendamento de {servico} com {profissional} no dia {data} às {hora} está CONFIRMADO. — {salao}',
    remind:    'Lembrete: {cliente}, amanhã ({data}) às {hora} você tem {servico} com {profissional}. Aguardamos você! — {salao}',
    cancel:    '{cliente}, seu agendamento de {servico} em {data} às {hora} foi cancelado. Para reagendar acesse: {link_agendamento} — {salao}',
    waitlist:  'Olá, *{cliente}*!\n\nTemos uma ótima notícia: surgiu uma disponibilidade na *{salao}* para o dia *{data}*.\n\nPara confirmar seu agendamento, acesse o link abaixo:\n\n🔗 {link_agendamento}\n\nA disponibilidade é limitada e poderá ser reservada a qualquer momento.\n\nAtenciosamente,\n\n*{salao}*\n*Enviado automaticamente pelo WorkAgenda.*',
  };
  const loadTpls = () => { try { const s = localStorage.getItem(LS_TPL); if (s) return { ...defaultTpls, ...JSON.parse(s) }; } catch {} return { ...defaultTpls }; };
  const [tpls,      setTpls]      = useState(loadTpls);
  const [tplsDraft, setTplsDraft] = useState(loadTpls);

  // ── Connection status ──────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!authToken) return;
    if (disconnectingRef.current) return; // aguarda EvoGo processar o logout
    const { state, name } = await checkStatusServer(activeTenant.id, authToken);
    setConnState(state);
    setConnName(name);
    onStatusChangeRef.current?.(state, name);
    if (state === 'open') { setQrData(null); stopQrPolling(); }
  }, [authToken, activeTenant.id]); // onStatusChange via ref — não recria ao re-render do pai

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

  // Auto-fecha modal QR ao conectar
  useEffect(() => {
    if (connState === 'open' && showQrModal) {
      const t = setTimeout(() => setShowQrModal(false), 1200);
      return () => clearTimeout(t);
    }
  }, [connState, showQrModal]);

  // ── Connection actions ─────────────────────────────────────
  const handleConnect = () => { setConnState('connecting'); startQrPolling(); setShowQrModal(true); };
  const handleQrCancel = () => { stopQrPolling(); setShowQrModal(false); setQrData(null); if (connState !== 'open') setConnState('close'); };
  const handleLogout  = async () => {
    setConfirmDisconnect(false);
    disconnectingRef.current = true;
    try {
      await disconnectServer(activeTenant.id, authToken);
      setConnState('close'); setConnName(null); setQrData(null);
      onStatusChangeRef.current?.('close', null);
      toast.info('WhatsApp desconectado.');
    } catch (err: any) {
      toast.error('Erro ao desconectar: ' + err.message);
    } finally {
      setTimeout(() => { disconnectingRef.current = false; }, 8000);
    }
  };

  const handleSaveTpls = () => {
    setTpls(tplsDraft);
    localStorage.setItem(LS_TPL, JSON.stringify(tplsDraft));
    toast.success('Modelos salvos!');
  };

  const handleSaveManual = () => {
    setManualSaving(true);
    const saved = { ...tplsDraft };
    setTpls(saved);
    localStorage.setItem(LS_TPL, JSON.stringify(saved));
    toast.success('Mensagens manuais salvas!');
    setTimeout(() => setManualSaving(false), 600);
  };

  const handleSaveWaitlist = async () => {
    setWaitlistSaving(true);
    const saved = { ...tplsDraft };
    setTpls(saved);
    localStorage.setItem(LS_TPL, JSON.stringify(saved));
    try {
      await fetch(`${getApiUrl()}/api/whatsapp/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ tenantId: activeTenant.id, waitlist: saved.waitlist }),
      });
      toast.success('Mensagem da lista de espera salva!');
    } catch { toast.error('Erro ao salvar no servidor.'); }
    setWaitlistSaving(false);
  };

  // ── UI helpers ─────────────────────────────────────────────
  const previewMsg = () => {
    const mock: ApptData = {
      customerName: 'João Silva', customerPhone: '5511999999999',
      serviceName: 'Corte Degradê', professionalName: 'Gustavo',
      date: new Date().toISOString().split('T')[0], time: '14:00',
      tenantName: activeTenant.name, tenantPhone: activeTenant.phone,
    };
    const bookingLink = `https://workagenda.org/${activeTenant.slug}/agendamento`;
    if (activePreview === 'confirmation') return buildCustomMsg(tplsDraft.confirm, mock);
    if (activePreview === 'reminder')     return buildCustomMsg(tplsDraft.remind, mock);
    if (activePreview === 'waitlist')     return (tplsDraft.waitlist ?? defaultTpls.waitlist).replace(/\{cliente\}/g, mock.customerName).replace(/\{salao\}/g, mock.tenantName).replace(/\{data\}/g, mock.date).replace(/\{link_agendamento\}/g, bookingLink);
    return buildCustomMsg(tplsDraft.cancel, { ...mock, tenantSlug: activeTenant.slug })
             .replace(/\{link_agendamento\}/g, bookingLink);
  };

  const connDotColor = { open: '#22C55E', close: '#EF4444', connecting: '#F59E0B', error: '#9CA3AF', checking: '#9CA3AF' }[connState];
  const connLabel    = { open: 'Conectado', close: 'Desconectado', connecting: 'Aguardando QR…', error: 'Erro de conexão', checking: 'Verificando…' }[connState];

  const connBadgeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid', fontSize: 11, fontWeight: 600 };
    if (connState === 'open')       return { ...base, background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' };
    if (connState === 'connecting') return { ...base, background: '#FEF9C3', color: '#92400E', borderColor: '#FCD34D' };
    if (connState === 'close')      return { ...base, background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' };
    return { ...base, background: '#F8FAFC', color: '#6B7280', borderColor: '#E2E8F0' };
  };

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    margin: 0,
  };

  const tabs: { id: ActiveView; label: string; dot?: boolean }[] = [
    { id: 'connection', label: 'Conexão',   dot: connState !== 'open' && connState !== 'checking' },
    { id: 'templates',  label: 'Templates' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header — only shown when no section filter ── */}
      {!section && (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>Automações</h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Gerencie notificações automáticas por WhatsApp e e-mail
          </p>
        </div>
      )}

      {/* ── Channel toggle cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* WhatsApp card */}
        {(!section || section === 'whatsapp') && (<>
        <div style={{
          ...card,
          border: wppEnabled ? '1px solid #86EFAC' : '1px solid #E2E8F0',
          background: wppEnabled ? '#F0FDF4' : '#FFFFFF',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: wppEnabled ? '#DCFCE7' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                📱
              </div>
              <div>
                <p style={{ fontWeight: 700, color: '#111827', fontSize: 14, margin: 0 }}>WhatsApp</p>
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
              <span style={{ fontSize: 10, color: wppEnabled ? '#16A34A' : '#9CA3AF', fontWeight: 600 }}>
                {wppEnabled ? 'Automático ativo' : 'Automático inativo'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '14px 0 0', lineHeight: 1.5 }}>
            {wppEnabled
              ? 'Confirmações e lembretes enviados automaticamente via WhatsApp'
              : 'Envio automático de WhatsApp desativado — disparos manuais ainda funcionam'}
          </p>
        </div>
        </>)}

        {/* Email card */}
        {(!section || section === 'email') && (<>
        <div style={{
          ...card,
          border: emailEnabled ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
          background: emailEnabled ? '#EFF6FF' : '#FFFFFF',
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: emailEnabled ? '#DBEAFE' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                📧
              </div>
              <div>
                <p style={{ fontWeight: 700, color: '#111827', fontSize: 14, margin: 0 }}>E-mail</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0' }}>
                  Confirmação para clientes com e-mail
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Toggle on={emailEnabled} onChange={handleToggleEmail} disabled={toggling} />
              <span style={{ fontSize: 10, color: emailEnabled ? '#1D4ED8' : '#9CA3AF', fontWeight: 600 }}>
                {emailEnabled ? 'Automático ativo' : 'Automático inativo'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '14px 0 0', lineHeight: 1.5 }}>
            {emailEnabled
              ? 'E-mail de confirmação enviado quando o cliente informa seu e-mail ao agendar'
              : 'Envio automático de e-mail desativado'}
          </p>
        </div>
        </>)}

      </div>

      {/* ── Sub-tabs + connection content (WhatsApp only) ─────── */}
      {(!section || section === 'whatsapp') && (
      <div style={{ display: 'flex', gap: 0, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* ── Sidebar de navegação ── */}
        <nav style={{ width: 180, borderRight: '1px solid #E2E8F0', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveView(t.id)}
              style={{ position: 'relative', padding: '9px 14px', fontSize: 13, fontWeight: activeView === t.id ? 700 : 500, borderRadius: 9, border: `1px solid ${activeView === t.id ? '#BFDBFE' : 'transparent'}`, background: activeView === t.id ? '#EFF6FF' : 'transparent', color: activeView === t.id ? '#1D4ED8' : '#6B7280', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'left' as const, transition: 'all 150ms', whiteSpace: 'nowrap' as const }}>
              {t.label}
              {t.dot && <span style={{ position: 'absolute', top: 9, right: 10, width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />}
            </button>
          ))}
        </nav>

        {/* ── Área de conteúdo ── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 }} className="no-scrollbar">

      {/* ══════════════════════════════════════════════════════
          VIEW: CONEXÃO
      ══════════════════════════════════════════════════════ */}
      {activeView === 'connection' && (<>
        <div>
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Card de status */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Linha de status no topo */}
              <div style={{
                height: 4,
                background: connState === 'open'
                  ? '#22c55e'
                  : connState === 'connecting' ? '#f59e0b'
                  : connState === 'error'      ? '#ef4444'
                  : '#E2E8F0',
                transition: 'background 400ms ease',
              }} />

              <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Status label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                    Status da instância
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: connState === 'open' ? '#DCFCE7' : connState === 'connecting' ? '#FEF3C7' : '#F1F5F9',
                    color:      connState === 'open' ? '#15803d' : connState === 'connecting' ? '#92400E' : '#6B7280',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: connState === 'open' ? '#22c55e' : connState === 'connecting' ? '#f59e0b' : '#94a3b8',
                    }} />
                    {connState === 'open' ? 'Conectado' : connState === 'connecting' ? 'Aguardando QR' : connState === 'error' ? 'Erro' : 'Desconectado'}
                  </span>
                </div>

                {/* Nome da conta */}
                {connState === 'open' && connName && (
                  <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{connName}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>Número vinculado</p>
                  </div>
                )}
                {connState === 'close' && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
                    Clique em conectar para vincular seu WhatsApp
                  </p>
                )}

                {/* Botões */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={refreshStatus}
                    style={{ width: '100%', padding: '9px', background: '#F8FAFC', color: '#374151', fontWeight: 600, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 9, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                    Verificar status
                  </button>
                  {connState !== 'open' && (
                    <button onClick={handleConnect} disabled={qrLoading || !authToken}
                      style={{ width: '100%', padding: '11px', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 9, cursor: (qrLoading || !authToken) ? 'not-allowed' : 'pointer', opacity: (qrLoading || !authToken) ? 0.5 : 1, fontFamily: 'Outfit, sans-serif' }}>
                      {qrLoading ? 'Gerando QR…' : 'Conectar WhatsApp'}
                    </button>
                  )}
                  {connState === 'open' && !confirmDisconnect && (
                    <button onClick={() => setConfirmDisconnect(true)}
                      style={{ width: '100%', padding: '9px', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5', borderRadius: 9, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      Desconectar
                    </button>
                  )}
                  {connState === 'open' && confirmDisconnect && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 9 }}>
                      <p style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, margin: 0, textAlign: 'center' }}>Confirmar desconexão?</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setConfirmDisconnect(false)}
                          style={{ flex: 1, padding: '8px', background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                          Cancelar
                        </button>
                        <button onClick={handleLogout}
                          style={{ flex: 1, padding: '8px', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                          Desconectar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* QR Code Modal */}
          {showQrModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', fontFamily: 'Outfit, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Conectar WhatsApp</p>
                  <button onClick={handleQrCancel} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>

                {connState === 'open' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <p style={{ fontWeight: 700, color: '#166534', fontSize: 15, margin: 0 }}>Conectado com sucesso!</p>
                    {connName && <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{connName}</p>}
                  </div>
                ) : qrLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, border: '4px solid #E2E8F0', borderTopColor: '#1D4ED8', borderRadius: '50%' }} className="animate-spin" />
                    <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Gerando QR Code…</p>
                  </div>
                ) : qrData?.base64 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div style={{ padding: 10, background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <img src={qrData.base64.startsWith('data:') ? qrData.base64 : `data:image/png;base64,${qrData.base64}`} alt="QR Code" style={{ width: 200, height: 200, objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>Abra o WhatsApp no celular</p>
                      <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>Menu → Dispositivos conectados → Conectar</p>
                    </div>
                    <button onClick={fetchQR} disabled={qrLoading}
                      style={{ padding: '8px 20px', background: '#F8FAFC', color: '#374151', fontWeight: 600, fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 9, cursor: qrLoading ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      Gerar novo QR
                    </button>
                  </div>
                ) : null}

                <button onClick={handleQrCancel}
                  style={{ width: '100%', padding: '11px', background: '#F1F5F9', color: '#6B7280', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
      </>)}

      {/* ══════════════════════════════════════════════════════
          VIEW: TEMPLATES
      ══════════════════════════════════════════════════════ */}
      {activeView === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── SEÇÃO 1: MENSAGENS AUTOMÁTICAS ───────────────────────────── */}
          <div style={{ ...card, borderRadius: '12px 12px 0 0', borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, marginBottom: 18, borderBottom: '2px solid #2563EB' }}>
              <div>
                <h4 style={{ ...sectionTitle, margin: 0 }}>Mensagens Automáticas</h4>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Enviadas pelo servidor ao agendar e lembrar</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', borderRadius: 20, padding: '3px 10px' }}>Servidor</span>
            </div>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ fontSize: 11, color: '#1D4ED8', fontFamily: 'monospace', margin: 0, lineHeight: 1.7 }}>
                {'Variáveis: {nome}  {salao}  {servico}  {data}  {hora}  {duracao}  {profissional}  {codigo}  {link}'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: '#374151' }}>
                  ✅ Confirmação — enviada ao agendar
                </label>
                <textarea value={autoConfirmDraft} onChange={e => setAutoConfirmDraft(e.target.value)} rows={5}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#374151' }}>⏰ Lembrete automático</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>Enviar</span>
                    <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}
                      style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 8, color: '#111827', fontSize: 12, fontWeight: 600, padding: '4px 8px', fontFamily: 'Outfit, sans-serif', cursor: 'pointer', outline: 'none' }}>
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
                <textarea value={autoRemindDraft} onChange={e => setAutoRemindDraft(e.target.value)} rows={5}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <button onClick={handleSaveAutoTpls} disabled={tplSaving}
              style={{ width: '100%', padding: '12px', marginTop: 18, background: tplSaving ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: tplSaving ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              {tplSaving ? 'Salvando…' : 'Salvar Mensagens Automáticas'}
            </button>
          </div>

          {/* linha divisória */}
          <div style={{ height: 2, background: 'linear-gradient(90deg,#2563EB,#7C3AED,#2563EB)', opacity: 0.25 }} />

          {/* ── SEÇÃO 2: MENSAGENS MANUAIS ───────────────────────────────── */}
          <div style={{ ...card, borderRadius: 0, borderTop: 'none', borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, marginBottom: 18, borderBottom: '2px solid #7C3AED' }}>
              <div>
                <h4 style={{ ...sectionTitle, margin: 0 }}>Mensagens Manuais</h4>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Disparadas manualmente pelo painel de Agendamentos</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD', borderRadius: 20, padding: '3px 10px' }}>Manual</span>
            </div>

            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ fontSize: 11, color: '#1D4ED8', fontFamily: 'monospace', margin: 0, lineHeight: 1.7 }}>
                {'Variáveis: {cliente}  {salao}  {servico}  {data}  {hora}  {profissional}  {link_agendamento}'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: '#374151' }}>
                  ✅ Confirmação
                </label>
                <textarea value={tplsDraft.confirm} onChange={e => setTplsDraft(prev => ({ ...prev, confirm: e.target.value }))} rows={4}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: '#374151' }}>
                  ⏰ Lembrete
                </label>
                <textarea value={tplsDraft.remind} onChange={e => setTplsDraft(prev => ({ ...prev, remind: e.target.value }))} rows={4}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: '#374151' }}>
                  ❌ Cancelamento — enviado automaticamente ao cancelar
                </label>
                <textarea value={tplsDraft.cancel} onChange={e => setTplsDraft(prev => ({ ...prev, cancel: e.target.value }))} rows={4}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
              </div>
            </div>

            <button onClick={handleSaveManual} disabled={manualSaving}
              style={{ width: '100%', padding: '12px', marginTop: 18, background: manualSaving ? '#C4B5FD' : '#7C3AED', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: manualSaving ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              {manualSaving ? 'Salvando…' : 'Salvar Mensagens Manuais'}
            </button>
          </div>

          {/* linha divisória */}
          <div style={{ height: 2, background: 'linear-gradient(90deg,#7C3AED,#059669,#7C3AED)', opacity: 0.25 }} />

          {/* ── SEÇÃO 3: LISTA DE ESPERA ─────────────────────────────────── */}
          <div style={{ ...card, borderRadius: '0 0 12px 12px', borderTop: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, marginBottom: 18, borderBottom: '2px solid #059669' }}>
              <div>
                <h4 style={{ ...sectionTitle, margin: 0 }}>Lista de Espera</h4>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Enviada automaticamente quando uma vaga cancela</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', borderRadius: 20, padding: '3px 10px' }}>Auto ao cancelar</span>
            </div>

            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ fontSize: 11, color: '#166534', fontFamily: 'monospace', margin: 0, lineHeight: 1.7 }}>
                {'Variáveis: {cliente}  {salao}  {data}  {link_agendamento}'}
              </p>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', display: 'block', marginBottom: 6, color: '#374151' }}>
                🕐 Mensagem de vaga disponível
              </label>
              <textarea value={tplsDraft.waitlist} onChange={e => setTplsDraft(prev => ({ ...prev, waitlist: e.target.value }))} rows={8}
                style={{ width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: 10, padding: '10px 14px', color: '#111827', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box' as const }} />
            </div>

            <button onClick={handleSaveWaitlist} disabled={waitlistSaving}
              style={{ width: '100%', padding: '12px', marginTop: 18, background: waitlistSaving ? '#6EE7B7' : '#059669', color: '#FFFFFF', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 10, cursor: waitlistSaving ? 'wait' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              {waitlistSaving ? 'Salvando…' : 'Salvar Mensagem de Lista de Espera'}
            </button>
          </div>

          {/* linha divisória */}
          <div style={{ height: 2, background: '#E2E8F0', marginTop: 16 }} />

          {/* ── PREVIEW ──────────────────────────────────────────────────── */}
          <div style={{ ...card, marginTop: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 12, marginBottom: 16 }}>
              <h4 style={sectionTitle}>Preview da Mensagem</h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {(['confirmation', 'reminder', 'cancellation', 'waitlist'] as const).map(t => (
                  <button key={t} onClick={() => setActivePreview(t)}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', background: activePreview === t ? '#EFF6FF' : '#F8FAFC', color: activePreview === t ? '#2563EB' : '#374151', border: `1px solid ${activePreview === t ? '#2563EB' : '#E2E8F0'}` }}>
                    {t === 'confirmation' ? '✅ Confirm.' : t === 'reminder' ? '⏰ Lembrete' : t === 'cancellation' ? '❌ Cancel.' : '🕐 Espera'}
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
      )}

        </div>
      </div>
      )}

    </div>
  );
}
