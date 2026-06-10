// src/pages/auth/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

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
  const { signIn, signInWithGoogle, signOut, profile, loading, needsOnboarding } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Redirect se já tem conta completa
  useEffect(() => {
    if (loading) return;
    if (profile?.role === 'super_admin')  navigate('/admin/super',  { replace: true });
    if (profile?.role === 'tenant_admin') navigate('/admin/painel', { replace: true });
    // needsOnboarding: NÃO redireciona automaticamente — mostra opções na tela
  }, [profile, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setError(null);
    await signInWithGoogle(window.location.origin + '/login');
    // O browser redireciona para o Google; se voltar aqui sem sucesso, libera o estado
    setGoogleBusy(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);

    const { error } = await signIn(email, password);
    if (error) {
      setError('Email ou senha inválidos.');
      setBusy(false);
      return;
    }
    // Redirect tratado pelo useEffect quando o AuthContext atualizar
  };

  // ── Tela intermédia: Google conectado mas sem barbearia ──────────────────────
  if (!loading && needsOnboarding) {
    const googleEmail = (window as any).__supabase_session?.user?.email
      || localStorage.getItem('bf_pending_email') || '';
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
      >
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img
              src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
              alt="WorkAgenda"
              style={{ height: 220, objectFit: 'contain', marginBottom: 12 }}
            />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', border: '1px solid rgba(66,133,244,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <GoogleIcon />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              Conta Google conectada
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Esta conta ainda não tem uma barbearia cadastrada no WorkAgenda.
            </p>
            <button
              onClick={() => navigate('/cadastro')}
              style={{ width: '100%', padding: '14px', background: '#ffffff', color: '#031D3C', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginBottom: 12 }}
            >
              Criar minha barbearia →
            </button>
            <button
              onClick={async () => { await signOut(); }}
              style={{ width: '100%', padding: '13px', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
            >
              Usar outra conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 288, objectFit: 'contain' }}
            className="mb-4"
          />
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Painel de gestão
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20,
            padding: 40,
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="navy-label">Email</label>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="voce@barberflow.com.br"
                className="navy-input"
              />
            </div>
            <div>
              <label className="navy-label">Senha</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="navy-input"
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  borderRadius: 10,
                  padding: '12px 16px',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit" disabled={busy || googleBusy}
              style={{
                width: '100%',
                padding: '14px',
                background: busy ? 'rgba(255,255,255,0.55)' : '#ffffff',
                color: '#031D3C',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                borderRadius: 12,
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600, letterSpacing: '1px' }}>OU</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
          </div>

          {/* Botão Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy || googleBusy}
            style={{
              width: '100%',
              padding: '13px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.88)',
              fontWeight: 600,
              fontSize: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              cursor: busy || googleBusy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'Outfit, sans-serif',
              opacity: busy || googleBusy ? 0.55 : 1,
              transition: 'opacity 0.15s, border-color 0.15s',
            }}
          >
            <GoogleIcon />
            {googleBusy ? 'Redirecionando…' : 'Entrar com Google'}
          </button>
        </div>

        <p className="text-center mt-6" style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
          Acesso restrito a administradores cadastrados.
        </p>
        <p className="text-center mt-2" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
          Ainda não tem conta?{' '}
          <Link
            to="/cadastro"
            style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600, textDecoration: 'underline' }}
          >
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
