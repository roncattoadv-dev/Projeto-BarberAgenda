import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import PrivacyModal from '../../components/PrivacyModal';

const LOGO   = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2019%20de%20jun.%20de%202026,%2014_46_16.png';
const BG     = 'https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%2025%20de%20jun.%20de%202026,%2016_12_48.png';
const ACCENT = '#2563EB';

const API_URL = (() => {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || (import.meta as any).env?.VITE_API_URL || '').replace(/\/$/, '');
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
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%', background: '#FFFFFF',
  border: `1px solid ${hasError ? '#FCA5A5' : '#D1D5DB'}`,
  borderRadius: 10, padding: '11px 14px', color: '#111827', fontSize: 14,
  outline: 'none', fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
});

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '1.5px',
  color: '#6B7280', marginBottom: 6,
};

const errorStyle: React.CSSProperties = { fontSize: 11, color: '#EF4444', marginTop: 4 };

// ── BarberSetupForm (pós-Google OAuth) ─────────────────────────────────────
function BarberSetupForm({ googleName, onDone, onSignOut }: {
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
    setErrors(e); return Object.keys(e).length === 0;
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ name, slug, phone }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao cadastrar. Tente novamente.'); setBusy(false); return; }
      await supabase.auth.refreshSession();
      onDone({ slug: data.slug, trialEndsAt: data.trialEndsAt });
    } catch {
      toast.error('Erro de conexão. Tente novamente.'); setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: `url(${BG}) center/cover no-repeat`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <img src={LOGO} alt="WorkAgenda" style={{ height: 210, objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Configure seu negócio</h1>
          <p style={{ color: '#6B7280', fontSize: 13 }}>Conta Google conectada. Só falta o nome do negócio.</p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome do negócio <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="text" value={name} onChange={e => handleNameChange(e.target.value)} autoFocus
                placeholder="Ex: Barbearia Dom Pedro" style={inputStyle(!!errors.name)} />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Endereço do agendamento <span style={{ color: '#EF4444' }}>*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: `1px solid ${errors.slug ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 10, overflow: 'hidden' }}>
                <span style={{ padding: '11px 12px', color: '#9CA3AF', fontSize: 13, borderRight: '1px solid #E2E8F0', background: '#F8FAFC', whiteSpace: 'nowrap' }}>
                  workagenda.org/
                </span>
                <input type="text" value={slug}
                  onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                  placeholder="meu-negocio"
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 12px', color: '#111827', fontSize: 14, outline: 'none', fontFamily: 'monospace' }} />
              </div>
              {errors.slug
                ? <p style={errorStyle}>{errors.slug}</p>
                : <p style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>Seus clientes vão agendar neste endereço.</p>
              }
            </div>
            <div>
              <label style={labelStyle}>Telefone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-9999" style={inputStyle()} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: 2, accentColor: ACCENT, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                  Li e aceito os{' '}
                  <button type="button" onClick={() => setShowModal(true)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ACCENT, textDecoration: 'underline', fontSize: 12, fontFamily: 'Outfit, sans-serif' }}>
                    Termos de Uso e Política de Privacidade
                  </button>
                </span>
              </label>
              {errors.terms && <p style={{ ...errorStyle, marginTop: 6 }}>{errors.terms}</p>}
            </div>
            {showModal && <PrivacyModal onClose={() => setShowModal(false)} />}
            <button type="submit" disabled={busy}
              style={{ width: '100%', padding: 14, background: busy ? '#93C5FD' : ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
              {busy ? 'Criando seu negócio…' : 'Criar negócio →'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9CA3AF' }}>
          Já tem uma conta?{' '}
          <button onClick={onSignOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontWeight: 600, fontSize: 12, fontFamily: 'Outfit, sans-serif', padding: 0 }}>
            Entrar com outra conta
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Tela: verificação de email pendente ───────────────────────────────────────
function VerifyEmailScreen({ email, onBackToLogin }: { email: string; onBackToLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: `url(${BG}) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <img src={LOGO} alt="WorkAgenda" style={{ height: 110, objectFit: 'contain' }} />
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: 36, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>
            ✉️
          </div>
          <h1 style={{ color: '#111827', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Confirme seu email</h1>
          <p style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            Enviamos um link de confirmação para:
          </p>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{email}</p>
          </div>
          <p style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
            Clique no link do email para ativar sua conta e acessar o painel. Verifique também a pasta de <strong>spam</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            <button onClick={onBackToLogin}
              style={{ width: '100%', padding: 14, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              Ir para o login →
            </button>
          </div>
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF' }}>
          O link expira em 24 horas. Após confirmar, faça login normalmente.
        </p>
      </div>
    </div>
  );
}

// ── Página principal de cadastro ───────────────────────────────────────────
export default function RegisterPage() {
  const toast    = useToast();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, needsOnboarding, signOut } = useAuth();

  const [step,         setStep]         = useState<1 | 2>(1);
  const [busy,         setBusy]         = useState(false);
  const [googleBusy,   setGoogleBusy]   = useState(false);
  const [done,         setDone]         = useState<{ slug: string; trialEndsAt: string } | null>(null);
  const [verifyEmail,  setVerifyEmail]  = useState<string | null>(null);

  const [name,          setName]          = useState('');
  const [slug,          setSlug]          = useState('');
  const [slugEdited,    setSlugEdited]    = useState(false);
  const [phone,         setPhone]         = useState('');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [confirm,       setConfirm]       = useState('');
  const [cpfCnpj,       setCpfCnpj]       = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role === 'tenant_admin') navigate('/admin/painel', { replace: true });
    if (profile?.role === 'super_admin')  navigate('/admin/super',  { replace: true });
  }, [authLoading, profile]);

  const handleGoogleSignUp = async () => {
    setGoogleBusy(true);
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/cadastro' } });
    setGoogleBusy(false);
  };

  const handleNameChange = (val: string) => { setName(val); if (!slugEdited) setSlug(slugify(val)); };

  const validate1 = () => {
    const e: Record<string, string> = {};
    if (!name.trim())                e.name = 'Nome obrigatório.';
    if (!slug.trim())                e.slug = 'Endereço obrigatório.';
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Apenas letras minúsculas, números e hífens.';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Record<string, string> = {};
    if (!email.trim())        e.email    = 'Email obrigatório.';
    if (password.length < 8)  e.password = 'Mínimo 8 caracteres.';
    if (password !== confirm)  e.confirm  = 'As senhas não coincidem.';
    if (!acceptedTerms)        e.terms    = 'Você precisa aceitar os Termos de Uso para continuar.';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate2()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, email, password, phone, cpfCnpj }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao cadastrar. Tente novamente.'); setBusy(false); return; }
      if (data.needsEmailVerification) {
        setVerifyEmail(email);
      } else {
        setDone({ slug: data.slug, trialEndsAt: data.trialEndsAt });
      }
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally { setBusy(false); }
  };

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: `url(${BG}) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid #BFDBFE`, borderTopColor: ACCENT, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (verifyEmail) return <VerifyEmailScreen email={verifyEmail} onBackToLogin={() => navigate('/login')} />;
  if (done) return <VerifyEmailScreen email={email} onBackToLogin={() => navigate('/login')} />;

  if (needsOnboarding) {
    const googleName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || '';
    return <BarberSetupForm googleName={googleName} onDone={setDone} onSignOut={async () => { await signOut(); navigate('/login', { replace: true }); }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: `url(${BG}) center/cover no-repeat`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <img src={LOGO} alt="WorkAgenda" style={{ height: 210, objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ color: '#111827', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Crie sua conta grátis</h1>
          <p style={{ color: '#9CA3AF', fontSize: 12 }}>7 dias grátis · depois R$ 89,90/mês · cancele quando quiser</p>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 20, padding: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

          {/* Google */}
          <button type="button" onClick={handleGoogleSignUp} disabled={googleBusy || busy}
            style={{ width: '100%', padding: 13, background: '#FFFFFF', color: '#374151', fontWeight: 600, fontSize: 14, border: '1px solid #D1D5DB', borderRadius: 12, cursor: googleBusy || busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'Outfit, sans-serif', opacity: googleBusy || busy ? 0.6 : 1, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <GoogleIcon />
            {googleBusy ? 'Redirecionando…' : 'Criar conta com Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 600, letterSpacing: '1px' }}>OU</span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step === 1 ? ACCENT : '#DCFCE7', border: `2px solid ${step === 1 ? ACCENT : '#86EFAC'}`, color: step === 1 ? '#fff' : '#166534', transition: 'all 0.2s' }}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div style={{ height: 2, background: step > 1 ? ACCENT : '#E2E8F0', borderRadius: 2, transition: 'all 0.3s' }} />
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step === 2 ? ACCENT : 'transparent', border: `2px solid ${step === 2 ? ACCENT : '#D1D5DB'}`, color: step === 2 ? '#fff' : '#9CA3AF', transition: 'all 0.2s' }}>
              2
            </div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ color: '#111827', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Seu negócio</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12 }}>Informações básicas do seu negócio</p>
              </div>
              <div>
                <label style={labelStyle}>Nome do negócio <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ex: Barbearia Dom Pedro" style={inputStyle(!!errors.name)} />
                {errors.name && <p style={errorStyle}>{errors.name}</p>}
              </div>
              <div>
                <label style={labelStyle}>Endereço do agendamento <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: `1px solid ${errors.slug ? '#FCA5A5' : '#D1D5DB'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <span style={{ padding: '11px 12px', color: '#9CA3AF', fontSize: 13, borderRight: '1px solid #E2E8F0', background: '#F8FAFC', whiteSpace: 'nowrap' }}>
                    workagenda.org/
                  </span>
                  <input type="text" value={slug}
                    onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                    placeholder="meu-negocio"
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 12px', color: '#111827', fontSize: 14, outline: 'none', fontFamily: 'monospace' }} />
                </div>
                {errors.slug
                  ? <p style={errorStyle}>{errors.slug}</p>
                  : <p style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>Seus clientes vão agendar neste endereço.</p>
                }
              </div>
              <div>
                <label style={labelStyle}>Telefone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999" style={inputStyle()} />
              </div>
              <button type="button" onClick={() => { if (validate1()) setStep(2); }}
                style={{ width: '100%', padding: 14, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
                Continuar →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>←</button>
                <div>
                  <h2 style={{ color: '#111827', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Acesso ao painel</h2>
                  <p style={{ color: '#9CA3AF', fontSize: 12 }}>Crie suas credenciais de administrador</p>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                  placeholder="voce@barbearia.com.br" style={inputStyle(!!errors.email)} />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>
              <div>
                <label style={labelStyle}>Senha <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres" style={inputStyle(!!errors.password)} />
                {errors.password && <p style={errorStyle}>{errors.password}</p>}
              </div>
              <div>
                <label style={labelStyle}>Confirmar senha <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" style={inputStyle(!!errors.confirm)} />
                {errors.confirm && <p style={errorStyle}>{errors.confirm}</p>}
              </div>
              <div>
                <label style={labelStyle}>
                  CPF ou CNPJ{' '}
                  <span style={{ color: '#9CA3AF', textTransform: 'none' as const, letterSpacing: 0, fontWeight: 400 }}>(opcional)</span>
                </label>
                <input type="text" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00" style={inputStyle()} />
              </div>
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ color: '#166534', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Resumo do plano</p>
                <p style={{ color: '#15803D', fontSize: 12, marginBottom: 3 }}>✓ <strong>7 dias grátis</strong> — sem cobrar nada agora</p>
                <p style={{ color: '#15803D', fontSize: 12, marginBottom: 3 }}>✓ Após o trial: <strong>R$ 89,90/mês</strong> via boleto ou Pix</p>
                <p style={{ color: '#15803D', fontSize: 12 }}>✓ Cancele quando quiser, sem fidelidade</p>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                    style={{ marginTop: 2, accentColor: ACCENT, width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                    Li e aceito os{' '}
                    <button type="button" onClick={() => setShowModal(true)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ACCENT, textDecoration: 'underline', fontSize: 12, fontFamily: 'Outfit, sans-serif' }}>
                      Termos de Uso e Política de Privacidade
                    </button>
                  </span>
                </label>
                {errors.terms && <p style={{ ...errorStyle, marginTop: 6 }}>{errors.terms}</p>}
              </div>
              {showModal && <PrivacyModal onClose={() => setShowModal(false)} />}
              <button type="submit" disabled={busy}
                style={{ width: '100%', padding: 14, background: busy ? '#93C5FD' : ACCENT, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 4 }}>
                {busy ? 'Criando sua conta…' : 'Criar conta grátis →'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
          Já tem uma conta?{' '}
          <Link to="/login" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
}
