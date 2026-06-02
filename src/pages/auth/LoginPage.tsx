// src/pages/auth/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const { signIn, profile, loading } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  // Redirect se já estiver logado (ex: volta ao /login com sessão ativa)
  useEffect(() => {
    if (loading) return;
    if (profile?.role === 'super_admin')  navigate('/admin/super',  { replace: true });
    if (profile?.role === 'tenant_admin') navigate('/admin/painel', { replace: true });
  }, [profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);

    const { error } = await signIn(email, password);
    if (error) {
      setError('Email ou senha inválidos.');
      setBusy(false);
      return;
    }

    // Login OK — busca o profile pelo ID do usuário autenticado
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data?.role === 'super_admin')  { navigate('/admin/super',  { replace: true }); return; }
        if (data?.role === 'tenant_admin') { navigate('/admin/painel', { replace: true }); return; }
      }
    } catch {
      // Se a busca falhar, o useEffect redireciona quando o contexto atualizar
    }

    setBusy(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%201%20de%20jun.%20de%202026,%2011_34_59%20(1).png"
            alt="BarberFlow"
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
              type="submit" disabled={busy}
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
