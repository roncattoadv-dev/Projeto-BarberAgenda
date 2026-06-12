// src/pages/auth/ResetPasswordPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [ready,       setReady]       = useState(false);
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [done,        setDone]        = useState(false);

  useEffect(() => {
    // Supabase detecta o token de recuperação na URL e emite PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Se o fragmento da URL já tem access_token, o evento pode ter disparado antes
    // do listener ser registrado — verificamos a sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError('Não foi possível redefinir a senha. O link pode ter expirado.');
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login'), 3000);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-10">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 220, objectFit: 'contain' }}
            className="mb-4"
          />
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
            Redefinir senha
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 40 }}>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={26} color="#4ade80" />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Senha redefinida!
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6 }}>
                Redirecionando para o login…
              </p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.65)', borderRadius: '50%', margin: '0 auto 16px' }} className="animate-spin" />
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Verificando link…</p>
            </div>
          ) : (
            <>
              <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                Criar nova senha
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Escolha uma senha segura com pelo menos 6 caracteres.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="navy-label">Nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      required autoFocus
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="navy-input"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="navy-label">Confirmar nova senha</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="navy-input"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex' }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit" disabled={busy}
                  style={{ width: '100%', padding: '14px', background: busy ? 'rgba(255,255,255,0.55)' : '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s', fontFamily: 'Outfit, sans-serif' }}
                >
                  {busy ? 'Salvando…' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
