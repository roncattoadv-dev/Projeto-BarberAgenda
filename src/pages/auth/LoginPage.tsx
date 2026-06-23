import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

const LOGO = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png';
const ACCENT = '#2563EB';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.083 17.64 11.927 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { signIn, signInWithGoogle, signOut, resetPassword, profile, loading, needsOnboarding } = useAuth();
  const navigate = useNavigate();
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [busy,       setBusy]       = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [view,       setView]       = useState<'login' | 'forgot' | 'sent'>('login');
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    if (loading) return;
    if (profile?.role === 'super_admin')  navigate('/admin/super',  { replace: true });
    if (profile?.role === 'tenant_admin') navigate('/admin/painel', { replace: true });
  }, [profile, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true); setError(null);
    await signInWithGoogle(window.location.origin + '/login');
    setGoogleBusy(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await signIn(email, password);
    if (error) { setError('Email ou senha inválidos.'); setBusy(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await resetPassword(resetEmail);
    setBusy(false);
    if (error) { setError('Não foi possível enviar o email. Verifique o endereço e tente novamente.'); return; }
    setView('sent');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#FFFFFF', border: '1px solid #D1D5DB',
    borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#111827',
    outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '1.5px', color: '#6B7280', marginBottom: 6,
  };

  // ── Onboarding: Google autenticado mas sem barbearia ────────────────────────
  if (!loading && needsOnboarding) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Outfit, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src={LOGO} alt="WorkAgenda" style={{ height: 120, objectFit: 'contain' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <GoogleIcon />
            </div>
            <p style={{ color: '#111827', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Conta Google conectada</p>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Esta conta ainda não tem uma barbearia cadastrada no WorkAgenda.
            </p>
            <button onClick={() => navigate('/cadastro')}
              style={{ width: '100%', padding: 14, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: 10 }}>
              Criar minha barbearia →
            </button>
            <button onClick={async () => { await signOut(); }}
              style={{ width: '100%', padding: 13, background: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Usar outra conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <img src={LOGO} alt="WorkAgenda" style={{ height: 210, objectFit: 'contain', marginBottom: 10 }} />
          <p style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Painel de gestão
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: 36, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

          {/* ── Login ─────────────────────────────────────────────────────── */}
          {view === 'login' && (
            <>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="voce@workagenda.org" style={inputStyle} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Senha</label>
                    <button type="button"
                      onClick={() => { setResetEmail(email); setError(null); setView('forgot'); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 11, fontFamily: 'Outfit, sans-serif', padding: 0, textDecoration: 'underline' }}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" style={inputStyle} />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '11px 14px', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={busy || googleBusy}
                  style={{ width: '100%', padding: 14, background: busy ? '#93C5FD' : ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'background 0.15s' }}>
                  {busy ? 'Entrando…' : 'Entrar'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
                <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600, letterSpacing: '1px' }}>OU</span>
                <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
              </div>

              <button type="button" onClick={handleGoogleSignIn} disabled={busy || googleBusy}
                style={{ width: '100%', padding: 13, background: '#FFFFFF', color: '#374151', fontWeight: 600, fontSize: 14, border: '1px solid #D1D5DB', borderRadius: 12, cursor: busy || googleBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'Outfit, sans-serif', opacity: busy || googleBusy ? 0.6 : 1, transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <GoogleIcon />
                {googleBusy ? 'Redirecionando…' : 'Entrar com Google'}
              </button>
            </>
          )}

          {/* ── Esqueci minha senha ───────────────────────────────────────── */}
          {view === 'forgot' && (
            <>
              <button type="button" onClick={() => { setError(null); setView('login'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12, fontFamily: 'Outfit, sans-serif', padding: 0, marginBottom: 20 }}>
                <ArrowLeft size={14} /> Voltar para o login
              </button>
              <p style={{ color: '#111827', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Recuperar senha</p>
              <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Informe o email da sua conta e enviaremos um link para criar uma nova senha.
              </p>
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Email cadastrado</label>
                  <input type="email" required autoFocus value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    placeholder="voce@workagenda.org" style={inputStyle} />
                </div>
                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 10, padding: '11px 14px', fontSize: 13 }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={busy}
                  style={{ width: '100%', padding: 14, background: busy ? '#93C5FD' : ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                  {busy ? 'Enviando…' : 'Enviar link de recuperação'}
                </button>
              </form>
            </>
          )}

          {/* ── Email enviado ─────────────────────────────────────────────── */}
          {view === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>
                ✉️
              </div>
              <p style={{ color: '#111827', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Email enviado!</p>
              <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
                Enviamos um link de recuperação para <strong style={{ color: '#111827' }}>{resetEmail}</strong>. Verifique sua caixa de entrada e spam.
              </p>
              <button type="button" onClick={() => { setError(null); setView('login'); }}
                style={{ width: '100%', padding: 13, background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                Voltar para o login
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
