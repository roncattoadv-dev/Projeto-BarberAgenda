// src/pages/auth/RegisterPage.tsx
// Cadastro público — barbearia cria sua própria conta com 10 dias de trial
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

const API_URL = (() => {
  const w = (window as any).__BARBER_CONFIG__ || {};
  return (w.API_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
})();

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

export default function RegisterPage() {
  const toast    = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ slug: string; trialEndsAt: string } | null>(null);

  // Campos
  const [name,     setName]     = useState('');
  const [slug,     setSlug]     = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [cpfCnpj,  setCpfCnpj]  = useState('');
  const [errors,   setErrors]   = useState<Record<string,string>>({});

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited) setSlug(slugify(val));
  };

  const validate1 = () => {
    const e: Record<string,string> = {};
    if (!name.trim())          e.name  = 'Nome obrigatório.';
    if (!slug.trim())          e.slug  = 'Endereço obrigatório.';
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Apenas letras minúsculas, números e hífens.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Record<string,string> = {};
    if (!email.trim())         e.email    = 'Email obrigatório.';
    if (password.length < 8)   e.password = 'Mínimo 8 caracteres.';
    if (password !== confirm)  e.confirm  = 'As senhas não coincidem.';
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

      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar. Tente novamente.');
        setBusy(false);
        return;
      }

      setDone({ slug: data.slug, trialEndsAt: data.trialEndsAt });
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

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

  const errorStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#fca5a5',
    marginTop: 4,
  };

  // ── Sucesso ──────────────────────────────────────────────────────────────────
  if (done) return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        <div style={{ fontSize: 56 }}>🎉</div>
        <div>
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Cadastro concluído!</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
            Sua barbearia tem <strong style={{ color: 'rgba(255,255,255,0.88)' }}>10 dias grátis</strong> para testar tudo.<br />
            Após o período, o plano é <strong style={{ color: 'rgba(255,255,255,0.88)' }}>R$ 89,90/mês</strong> — você receberá o link de pagamento por email.
          </p>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 16,
            padding: 20,
            textAlign: 'left',
          }}
        >
          <div className="mb-4">
            <p style={labelStyle}>Link de agendamento</p>
            <code
              style={{
                display: 'block',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.88)',
                fontFamily: 'monospace',
              }}
            >
              {window.location.origin}/{done.slug}/agendamento
            </code>
          </div>
          <div>
            <p style={labelStyle}>Trial gratuito até</p>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 15 }}>{
              new Date(done.trialEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            }</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login')}
          style={{
            width: '100%',
            padding: '14px',
            background: '#ffffff',
            color: '#031D3C',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          Acessar o painel →
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#031D3C', fontFamily: 'Outfit, sans-serif' }}
    >
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://oyepfoizulceyyxozgwv.supabase.co/storage/v1/object/public/prova%20real/ChatGPT%20Image%201%20de%20jun.%20de%202026,%2011_34_59%20(1).png"
            alt="BarberFlow"
            style={{ height: 256, objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 style={{ color: 'rgba(255,255,255,0.88)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            Crie sua conta grátis
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, textAlign: 'center' }}>
            10 dias grátis · depois R$ 89,90/mês · cancele quando quiser
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  background: step === s
                    ? '#ffffff'
                    : step > s
                    ? 'rgba(255,255,255,0.18)'
                    : 'transparent',
                  border: `2px solid ${step === s ? '#ffffff' : step > s ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.18)'}`,
                  color: step === s ? '#031D3C' : step > s ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.38)',
                }}
              >
                {step > s ? '✓' : s}
              </div>
              {s === 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: step > 1 ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.09)',
                    transition: 'all 0.3s',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20,
            padding: 32,
          }}
        >

          {/* ── Step 1: dados da barbearia ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Sua barbearia</h2>
                <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>Informações básicas do seu negócio</p>
              </div>

              <div>
                <label style={labelStyle}>
                  Nome da barbearia <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <input
                  type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ex: Barbearia Dom Pedro"
                  style={inputStyle(!!errors.name)}
                />
                {errors.name && <p style={errorStyle}>{errors.name}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  Endereço do agendamento <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${errors.slug ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.09)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      padding: '12px 12px',
                      color: 'rgba(255,255,255,0.38)',
                      fontSize: 13,
                      borderRight: '1px solid rgba(255,255,255,0.09)',
                      background: 'rgba(255,255,255,0.02)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    barberflow.com/
                  </span>
                  <input
                    type="text" value={slug}
                    onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                    placeholder="minha-barbearia"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      padding: '12px 12px',
                      color: errors.slug ? '#fca5a5' : 'rgba(255,255,255,0.88)',
                      fontSize: 14,
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                {errors.slug ? (
                  <p style={errorStyle}>{errors.slug}</p>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, marginTop: 4 }}>Seus clientes vão agendar neste endereço.</p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Telefone</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  style={inputStyle()}
                />
              </div>

              <button
                type="button"
                onClick={() => { if (validate1()) setStep(2); }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#ffffff',
                  color: '#031D3C',
                  fontWeight: 700,
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 2: dados de acesso ──────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0 }}
                >
                  ←
                </button>
                <div>
                  <h2 style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>Acesso ao painel</h2>
                  <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>Crie suas credenciais de administrador</p>
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Email <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                  placeholder="voce@barbearia.com.br"
                  style={inputStyle(!!errors.email)}
                />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  Senha <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  style={inputStyle(!!errors.password)}
                />
                {errors.password && <p style={errorStyle}>{errors.password}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  Confirmar senha <span style={{ color: '#fca5a5' }}>*</span>
                </label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle(!!errors.confirm)}
                />
                {errors.confirm && <p style={errorStyle}>{errors.confirm}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  CPF ou CNPJ{' '}
                  <span style={{ color: 'rgba(255,255,255,0.25)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                    (opcional — para emissão de boleto)
                  </span>
                </label>
                <input
                  type="text" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  style={inputStyle()}
                />
              </div>

              {/* Resumo do plano */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Resumo do plano</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 3 }}>✓ <strong style={{ color: 'rgba(255,255,255,0.88)' }}>10 dias grátis</strong> — sem cobrar nada agora</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 3 }}>✓ Após o trial: <strong style={{ color: 'rgba(255,255,255,0.88)' }}>R$ 89,90/mês</strong> via boleto ou Pix</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>✓ Cancele quando quiser, sem fidelidade</p>
              </div>

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
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {busy ? 'Criando sua conta…' : 'Criar conta grátis →'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
          Já tem uma conta?{' '}
          <Link
            to="/login"
            style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600, textDecoration: 'underline' }}
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
