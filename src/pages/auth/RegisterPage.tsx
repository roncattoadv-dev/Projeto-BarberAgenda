// src/pages/auth/RegisterPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PrivacyModal from '../../components/PrivacyModal';

const API_URL = (() => {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
})();

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

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.09)'}`,
  borderRadius: 12,
  padding: '12px 16px',
  color: 'rgba(255,255,255,0.88)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'Outfit, sans-serif',
  boxSizing: 'border-box',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  color: 'rgba(255,255,255,0.38)',
  marginBottom: 6,
};

const errorStyle: React.CSSProperties = { fontSize: 11, color: '#fca5a5', marginTop: 4 };

// ─────────────────────────────────────────────────────────────────────────────
// Subformulário: configuração da barbearia (usado após Google OAuth)
// ─────────────────────────────────────────────────────────────────────────────
function BarberSetupForm({
  googleName,
  onDone,
  onSignOut,
}: {
  googleName: string;
  onDone: (result: { slug: string; trialEndsAt: string }) => void;
  onSignOut: () => void;
}) {
  const toast = useToast();
  const [name,          setName]          = useState(googleName);
  const [slug,          setSlug]          = useState(slugify(googleName));
  const [slugEdited,    setSlugEdited]    = useState(false);
  const [phone,         setPhone]         = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())                     e.name  = 'Nome obrigatório.';
    if (!slug.trim())                     e.slug  = 'Endereço obrigatório.';
    if (!/^[a-z0-9-]+$/.test(slug))      e.slug  = 'Apenas letras minúsculas, números e hífens.';
    if (!acceptedTerms)                   e.terms = 'Você precisa aceitar os Termos de Uso para continuar.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sessão expirada. Tente novamente.'); setBusy(false); return; }

      const res = await fetch(`${API_URL}/api/register-google`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, slug, phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar. Tente novamente.');
        setBusy(false);
        return;
      }

      await supabase.auth.refreshSession();
      onDone({ slug: data.slug, trialEndsAt: data.trialEndsAt });
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 200, objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
            Configure seu negócio
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' }}>
            Conta Google conectada. Só falta o nome do negócio.
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 32 }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label style={labelStyle}>Nome do negócio <span style={{ color: '#fca5a5' }}>*</span></label>
              <input
                type="text" value={name} onChange={e => handleNameChange(e.target.value)} autoFocus
                placeholder="Ex: Barbearia Dom Pedro"
                style={inputStyle(!!errors.name)}
              />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>

            <div>
              <label style={labelStyle}>Endereço do agendamento <span style={{ color: '#fca5a5' }}>*</span></label>
              <div style={{
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${errors.slug ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: 12, overflow: 'hidden',
              }}>
                <span style={{
                  padding: '12px 12px', color: 'rgba(255,255,255,0.38)', fontSize: 13,
                  borderRight: '1px solid rgba(255,255,255,0.09)',
                  background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap',
                }}>
                  workagenda.org/
                </span>
                <input
                  type="text" value={slug}
                  onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                  placeholder="meu-negocio"
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px 12px',
                    color: errors.slug ? '#fca5a5' : 'rgba(255,255,255,0.88)',
                    fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>
              {errors.slug
                ? <p style={errorStyle}>{errors.slug}</p>
                : <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4 }}>Seus clientes vão agendar neste endereço.</p>
              }
            </div>

            <div>
              <label style={labelStyle}>Telefone</label>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                style={inputStyle()}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#ffffff', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                  Li e aceito os{' '}
                  <button type="button" onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.88)', textDecoration: 'underline', fontSize: 12, fontFamily: 'Outfit, sans-serif' }}>
                    Termos de Uso e Política de Privacidade
                  </button>
                </span>
              </label>
              {errors.terms && <p style={{ ...errorStyle, marginTop: 6 }}>{errors.terms}</p>}
            </div>

            {showModal && <PrivacyModal onClose={() => setShowModal(false)} />}

            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', padding: '14px',
                background: busy ? 'rgba(255,255,255,0.55)' : '#ffffff',
                color: '#0F172A', fontWeight: 700, fontSize: 14,
                border: 'none', borderRadius: 12,
                cursor: busy ? 'not-allowed' : 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {busy ? 'Criando seu negócio…' : 'Criar negócio →'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Já tem uma conta?{' '}
          <button
            onClick={onSignOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: 12, fontFamily: 'Outfit, sans-serif', textDecoration: 'underline', padding: 0 }}
          >
            Entrar com outra conta
          </button>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tela de sucesso
// ─────────────────────────────────────────────────────────────────────────────
function SuccessScreen({ slug, trialEndsAt, onGoToDashboard }: { slug: string; trialEndsAt: string; onGoToDashboard: () => void }) {
  const labelStyle2: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '2px',
    color: 'rgba(255,255,255,0.38)', marginBottom: 6,
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div style={{ fontSize: 56 }}>🎉</div>
        <div>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Cadastro concluído!</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
            Sua barbearia tem <strong style={{ color: 'rgba(255,255,255,0.88)' }}>7 dias grátis</strong> para testar tudo.<br />
            Após o período, o plano é <strong style={{ color: 'rgba(255,255,255,0.88)' }}>R$ 89,90/mês</strong> — você receberá o link de pagamento por email.
          </p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, textAlign: 'left' }}>
          <div className="mb-4">
            <p style={labelStyle2}>Link de agendamento</p>
            <code style={{ display: 'block', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'rgba(255,255,255,0.88)', fontFamily: 'monospace' }}>
              {window.location.origin}/{slug}/agendamento
            </code>
          </div>
          <div>
            <p style={labelStyle2}>Trial gratuito até</p>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 15 }}>
              {new Date(trialEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button
          onClick={onGoToDashboard}
          style={{ width: '100%', padding: '14px', background: '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
        >
          Acessar o painel →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal de cadastro
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const toast    = useToast();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, needsOnboarding, signOut } = useAuth();

  const [step,       setStep]       = useState<1 | 2>(1);
  const [busy,       setBusy]       = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [done,       setDone]       = useState<{ slug: string; trialEndsAt: string } | null>(null);

  // Campos do fluxo email
  const [name,       setName]       = useState('');
  const [slug,       setSlug]       = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [cpfCnpj,       setCpfCnpj]       = useState('');
  const [acceptedTerms2, setAcceptedTerms2] = useState(false);
  const [showModal2,     setShowModal2]     = useState(false);
  const [errors,         setErrors]         = useState<Record<string, string>>({});

  // Redireciona se já tem conta completa
  useEffect(() => {
    if (authLoading) return;
    if (profile?.role === 'tenant_admin') navigate('/admin/painel', { replace: true });
    if (profile?.role === 'super_admin')  navigate('/admin/super',  { replace: true });
  }, [authLoading, profile]);

  // ── Fluxo Google OAuth ─────────────────────────────────────────────────────
  const handleGoogleSignUp = async () => {
    setGoogleBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/cadastro' },
    });
    setGoogleBusy(false);
  };

  // Após retornar do Google e completar o setup da barbearia
  const handleSetupDone = (result: { slug: string; trialEndsAt: string }) => {
    setDone(result);
  };

  // ── Fluxo email/senha ──────────────────────────────────────────────────────
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  };

  const validate1 = () => {
    const e: Record<string, string> = {};
    if (!name.trim())                e.name = 'Nome obrigatório.';
    if (!slug.trim())                e.slug = 'Endereço obrigatório.';
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Apenas letras minúsculas, números e hífens.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Record<string, string> = {};
    if (!email.trim())        e.email    = 'Email obrigatório.';
    if (password.length < 8)  e.password = 'Mínimo 8 caracteres.';
    if (password !== confirm)  e.confirm  = 'As senhas não coincidem.';
    if (!acceptedTerms2)       e.terms2   = 'Você precisa aceitar os Termos de Uso para continuar.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate2()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, email, password, phone, cpfCnpj }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao cadastrar. Tente novamente.'); setBusy(false); return; }
      setDone({ slug: data.slug, trialEndsAt: data.trialEndsAt });
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  // ── Renderização condicional ───────────────────────────────────────────────

  // Spinner enquanto verifica auth
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F172A' }}>
      <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  // Sucesso
  if (done) return (
    <SuccessScreen
      slug={done.slug}
      trialEndsAt={done.trialEndsAt}
      onGoToDashboard={() => navigate('/login')}
    />
  );

  // Pós-OAuth: usuário autenticado mas sem barbearia → mostra só o form de setup
  if (needsOnboarding) {
    const googleName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '';
    return (
      <BarberSetupForm
        googleName={googleName}
        onDone={handleSetupDone}
        onSignOut={async () => { await signOut(); navigate('/login', { replace: true }); }}
      />
    );
  }

  // ── Formulário principal ───────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0F172A', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%209%20de%20jun.%20de%202026,%2000_00_23%20(1).png"
            alt="WorkAgenda"
            style={{ height: 220, objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            Crie sua conta grátis
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, textAlign: 'center' }}>
            7 dias grátis · depois R$ 89,90/mês · cancele quando quiser
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 32 }}>

          {/* ── Botão Google — sempre visível no topo ── */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleBusy || busy}
            style={{
              width: '100%', padding: '13px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.88)',
              fontWeight: 600, fontSize: 14,
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 12,
              cursor: googleBusy || busy ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'Outfit, sans-serif',
              opacity: googleBusy || busy ? 0.55 : 1,
              marginBottom: 20,
            }}
          >
            <GoogleIcon />
            {googleBusy ? 'Redirecionando…' : 'Criar conta com Google'}
          </button>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600, letterSpacing: '1px' }}>OU</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.09)' }} />
          </div>

          {/* Steps indicator */}
          <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 26px', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {/* Círculo 1 */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
              background: step === 1 ? '#ffffff' : 'rgba(255,255,255,0.18)',
              border: `2px solid ${step === 1 ? '#ffffff' : 'rgba(255,255,255,0.38)'}`,
              color: step === 1 ? '#0F172A' : 'rgba(255,255,255,0.65)',
            }}>
              {step > 1 ? '✓' : '1'}
            </div>
            {/* Linha */}
            <div style={{ height: 1, background: step > 1 ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.09)', transition: 'all 0.3s' }} />
            {/* Círculo 2 */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
              background: step === 2 ? '#ffffff' : 'transparent',
              border: `2px solid ${step === 2 ? '#ffffff' : 'rgba(255,255,255,0.18)'}`,
              color: step === 2 ? '#0F172A' : 'rgba(255,255,255,0.38)',
            }}>
              2
            </div>
          </div>

          {/* ── Step 1: dados da barbearia ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Seu negócio</h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>Informações básicas do seu negócio</p>
              </div>

              <div>
                <label style={labelStyle}>Nome do negócio <span style={{ color: '#fca5a5' }}>*</span></label>
                <input
                  type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ex: Barbearia Dom Pedro"
                  style={inputStyle(!!errors.name)}
                />
                {errors.name && <p style={errorStyle}>{errors.name}</p>}
              </div>

              <div>
                <label style={labelStyle}>Endereço do agendamento <span style={{ color: '#fca5a5' }}>*</span></label>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${errors.slug ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.09)'}`,
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <span style={{ padding: '12px 12px', color: 'rgba(255,255,255,0.38)', fontSize: 13, borderRight: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)', whiteSpace: 'nowrap' }}>
                    workagenda.org/
                  </span>
                  <input
                    type="text" value={slug}
                    onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                    placeholder="meu-negocio"
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px 12px', color: errors.slug ? '#fca5a5' : 'rgba(255,255,255,0.88)', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                  />
                </div>
                {errors.slug
                  ? <p style={errorStyle}>{errors.slug}</p>
                  : <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4 }}>Seus clientes vão agendar neste endereço.</p>
                }
              </div>

              <div>
                <label style={labelStyle}>Telefone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" style={inputStyle()} />
              </div>

              <button
                type="button"
                onClick={() => { if (validate1()) setStep(2); }}
                style={{ width: '100%', padding: '14px', background: '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 2: email + senha ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStep(1)} style={{ color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
                <div>
                  <h2 style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Acesso ao painel</h2>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>Crie suas credenciais de administrador</p>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus placeholder="voce@barbearia.com.br" style={inputStyle(!!errors.email)} />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>

              <div>
                <label style={labelStyle}>Senha <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle(!!errors.password)} />
                {errors.password && <p style={errorStyle}>{errors.password}</p>}
              </div>

              <div>
                <label style={labelStyle}>Confirmar senha <span style={{ color: '#fca5a5' }}>*</span></label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" style={inputStyle(!!errors.confirm)} />
                {errors.confirm && <p style={errorStyle}>{errors.confirm}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  CPF ou CNPJ{' '}
                  <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span>
                </label>
                <input type="text" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} placeholder="000.000.000-00 ou 00.000.000/0001-00" style={inputStyle()} />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Resumo do plano</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 3 }}>✓ <strong style={{ color: 'rgba(255,255,255,0.88)' }}>7 dias grátis</strong> — sem cobrar nada agora</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 3 }}>✓ Após o trial: <strong style={{ color: 'rgba(255,255,255,0.88)' }}>R$ 89,90/mês</strong> via boleto ou Pix</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>✓ Cancele quando quiser, sem fidelidade</p>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms2}
                    onChange={e => setAcceptedTerms2(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#ffffff', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    Li e aceito os{' '}
                    <button type="button" onClick={() => setShowModal2(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.88)', textDecoration: 'underline', fontSize: 12, fontFamily: 'Outfit, sans-serif' }}>
                      Termos de Uso e Política de Privacidade
                    </button>
                  </span>
                </label>
                {errors.terms2 && <p style={{ ...errorStyle, marginTop: 6 }}>{errors.terms2}</p>}
              </div>

              {showModal2 && <PrivacyModal onClose={() => setShowModal2(false)} />}

              <button
                type="submit" disabled={busy}
                style={{ width: '100%', padding: '14px', background: busy ? 'rgba(255,255,255,0.55)' : '#ffffff', color: '#0F172A', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                {busy ? 'Criando sua conta…' : 'Criar conta grátis →'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
          Já tem uma conta?{' '}
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600, textDecoration: 'underline' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
