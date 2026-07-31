// src/pages/auth/GoogleCallbackPage.tsx
// Destino do redirect do backend após /api/auth/google/callback — troca o
// código de uso único (na URL) por uma sessão de verdade via POST, evita
// deixar o JWT visível na barra de endereço.
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function getApiUrl(): string {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
}

export default function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeSession } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    const code = params.get('code');
    if (!code) { setError(true); return; }

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok) { setError(true); return; }
        completeSession(data.access_token, data.user);
        navigate('/', { replace: true });
      } catch {
        setError(true);
      }
    })();
  }, [params]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}
    >
      {error ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            Não foi possível concluir o login com Google.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: '#93C5FD', cursor: 'pointer', fontSize: 13, fontFamily: 'Outfit, sans-serif' }}
          >
            Voltar para o login
          </button>
        </div>
      ) : (
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.09)', borderTopColor: 'rgba(255,255,255,0.65)', borderRadius: '50%' }} className="animate-spin" />
      )}
    </div>
  );
}
