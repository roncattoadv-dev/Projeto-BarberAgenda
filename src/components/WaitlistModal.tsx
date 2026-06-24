import React, { useState, useEffect, useCallback } from 'react';
import { X, MessageSquare, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { WaitlistEntry } from '../types';
import { getWaitlistEntries, markWaitlistNotified, deleteWaitlistEntry } from '../lib/db';
import { sendWhatsAppServer, buildWaitlistMsg } from '../services/whatsapp';
import { supabase } from '../lib/supabase';

interface Props {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  professionals: { id: string; name: string }[];
  failedIds: Set<string>;
  onClose: () => void;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function isToday(d: string) {
  return d === new Date().toISOString().split('T')[0];
}

export default function WaitlistModal({ tenantId, tenantName, tenantSlug, professionals, failedIds, onClose }: Props) {
  const [entries,  setEntries]  = useState<WaitlistEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setAuthToken(session?.access_token || ''));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getWaitlistEntries(tenantId)); } catch {}
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().split('T')[0];

  const aguardando = entries
    .filter(e => !e.notified && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const notificados = entries
    .filter(e => e.notified)
    .sort((a, b) => (b.notifiedAt ?? '').localeCompare(a.notifiedAt ?? ''));

  const profName = (id: string | null) =>
    id ? (professionals.find(p => p.id === id)?.name ?? 'Profissional') : 'Qualquer';

  const buildMsg = (entry: WaitlistEntry) => {
    const LS_TPL = `barber_wpp_tpl_${tenantId}`;
    let tpl = '';
    try { const s = localStorage.getItem(LS_TPL); if (s) tpl = JSON.parse(s).waitlist ?? ''; } catch {}
    const lnk = `https://workagenda.org/${tenantSlug}/agendamento`;
    if (tpl) return tpl
      .replace(/\{cliente\}/g,          entry.customerName)
      .replace(/\{nome\}/g,             entry.customerName)
      .replace(/\{salao\}/g,            tenantName)
      .replace(/\{data\}/g,             entry.date)
      .replace(/\{link_agendamento\}/g, lnk)
      .replace(/\{link\}/g,             lnk);
    return buildWaitlistMsg({ customerName: entry.customerName, tenantName, tenantSlug, date: entry.date, timePreference: entry.timePreference });
  };

  const sendOne = async (entry: WaitlistEntry) => {
    if (!authToken) return;
    setSending(s => ({ ...s, [entry.id]: true }));
    try {
      const result = await sendWhatsAppServer(tenantId, authToken, entry.customerPhone, buildMsg(entry));
      if (result === 'sent') {
        await markWaitlistNotified(entry.id);
        setEntries(prev => prev.map(e =>
          e.id === entry.id ? { ...e, notified: true, notifiedAt: new Date().toISOString() } : e
        ));
      }
    } catch {}
    setSending(s => ({ ...s, [entry.id]: false }));
  };

  const deleteOne = async (id: string) => {
    setDeleting(d => ({ ...d, [id]: true }));
    try {
      await deleteWaitlistEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
    setDeleting(d => ({ ...d, [id]: false }));
  };

  const ACCENT = '#2563EB';

  const EntryRow = ({ e }: { e: WaitlistEntry }) => {
    const hasFailed = failedIds.has(e.id);
    const isSending = sending[e.id];

    return (
      <div style={{ padding: '12px 16px', background: '#FFFFFF', border: `1px solid ${hasFailed ? '#FCA5A5' : '#E2E8F0'}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: ACCENT + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>
          {e.customerName[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{e.customerName}</span>
            {isToday(e.date) && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 4, padding: '1px 6px' }}>Hoje</span>
            )}
            {hasFailed && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlertCircle size={9} /> envio falhou
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>{fmtDate(e.date)}</span>
            <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>
            <span>{profName(e.professionalId)}</span>
            <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>
            <span>{e.timePreference === 'qualquer' ? 'Qualquer horário' : e.timePreference.split(',').join(' · ')}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{e.customerPhone}</div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {hasFailed && (
            <button onClick={() => sendOne(e)} disabled={isSending || !authToken}
              title="Tentar enviar novamente"
              style={{ width: 30, height: 30, borderRadius: 8, background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', cursor: isSending ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSending ? 0.5 : 1 }}>
              {isSending ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={12} />}
            </button>
          )}
          <button onClick={() => deleteOne(e.id)} disabled={deleting[e.id]}
            title="Remover"
            style={{ width: 30, height: 30, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', cursor: deleting[e.id] ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting[e.id] ? 0.5 : 1 }}>
            {deleting[e.id] ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,29,60,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Lista de Espera</p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
              {aguardando.length} aguardando · {notificados.length} notificados
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} title="Atualizar"
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }} className="no-scrollbar">
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>Carregando…</div>
          ) : (
            <>
              {/* ── AGUARDANDO ───────────────────────────────────────────── */}
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                    Aguardando vaga
                  </span>
                  {aguardando.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 20, padding: '1px 8px' }}>
                      {aguardando.length}
                    </span>
                  )}
                </div>

                {aguardando.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0 12px', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #E2E8F0' }}>
                    <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Nenhum cliente aguardando vaga</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {aguardando.map(e => <EntryRow key={e.id} e={e} />)}
                  </div>
                )}
              </div>

              <div style={{ margin: '20px 20px 0', borderTop: '1px solid #E2E8F0' }} />

              {/* ── NOTIFICADOS ──────────────────────────────────────────── */}
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                    Notificados de vaga aberta
                  </span>
                  {notificados.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 20, padding: '1px 8px' }}>
                      {notificados.length}
                    </span>
                  )}
                </div>

                {notificados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0 8px', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #E2E8F0' }}>
                    <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Nenhum cliente notificado ainda</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {notificados.map(e => (
                      <div key={e.id} style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#166534', flexShrink: 0 }}>
                          {e.customerName[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{e.customerName}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#166534', borderRadius: 4, padding: '1px 6px' }}>✓ Avisado</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            <span style={{ fontWeight: 600 }}>{fmtDate(e.date)}</span>
                            <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>
                            <span>{profName(e.professionalId)}</span>
                            {e.notifiedAt && <>
                              <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>
                              <span>Notificado em {new Date(e.notifiedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            </>}
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{e.customerPhone}</div>
                        </div>
                        <button onClick={() => deleteOne(e.id)} disabled={deleting[e.id]}
                          style={{ width: 28, height: 28, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #F1F5F9', flexShrink: 0, background: '#F8FAFC' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
            Notificação automática ao cancelar horário · botão manual aparece apenas se o envio falhar
          </p>
        </div>
      </div>
    </div>
  );
}
