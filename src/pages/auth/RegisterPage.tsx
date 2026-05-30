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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
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

  // ── Sucesso ──────────────────────────────────────────────────────────────────
  if (done) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro concluído!</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Sua barbearia tem <strong>10 dias grátis</strong> para testar tudo.<br />
            Após o período, o plano é <strong>R$ 89,90/mês</strong> — você receberá o link de pagamento por email.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left space-y-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Link de agendamento</p>
            <code className="text-sm text-blue-600 font-mono bg-blue-50 px-3 py-1.5 rounded-lg block">
              {window.location.origin}/{done.slug}/agendamento
            </code>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Trial gratuito até</p>
            <p className="text-sm font-semibold text-slate-700">{
              new Date(done.trialEndsAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
            }</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition text-sm"
        >
          Acessar o painel →
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💈</div>
          <h1 className="text-2xl font-bold text-slate-900">Crie sua conta grátis</h1>
          <p className="text-sm text-slate-500 mt-1">10 dias grátis · depois R$ 89,90/mês · cancele quando quiser</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1,2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition ${
                step === s ? 'bg-slate-900 text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
              }`}>{step > s ? '✓' : s}</div>
              {s === 1 && <div className={`h-0.5 flex-1 transition-all ${step > 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8">

          {/* ── Step 1: dados da barbearia ──────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-0.5">Sua barbearia</h2>
                <p className="text-xs text-slate-400">Informações básicas do seu negócio</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nome da barbearia <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={name} onChange={e => handleNameChange(e.target.value)}
                  placeholder="Ex: Barbearia Dom Pedro"
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.name ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Endereço do agendamento <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition">
                  <span className="px-3 py-3 text-slate-400 text-sm border-r border-slate-200 bg-white whitespace-nowrap">
                    barberflow.com/
                  </span>
                  <input
                    type="text" value={slug}
                    onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                    placeholder="minha-barbearia"
                    className={`flex-1 bg-transparent px-3 py-3 text-slate-900 text-sm focus:outline-none font-mono ${errors.slug ? 'text-red-500' : ''}`}
                  />
                </div>
                {errors.slug ? (
                  <p className="text-xs text-red-500 mt-1">{errors.slug}</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Seus clientes vão agendar neste endereço.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefone</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => { if (validate1()) setStep(2); }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 2: dados de acesso ──────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-700 transition">←</button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 mb-0.5">Acesso ao painel</h2>
                  <p className="text-xs text-slate-400">Crie suas credenciais de administrador</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                  placeholder="voce@barbearia.com.br"
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Senha <span className="text-red-500">*</span>
                </label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.password ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirmar senha <span className="text-red-500">*</span>
                </label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.confirm ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CPF ou CNPJ <span className="text-slate-300">(opcional — para emissão de boleto)</span></label>
                <input
                  type="text" value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Resumo do plano */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
                <p className="font-bold text-blue-800">📋 Resumo do plano</p>
                <p>✓ <strong>10 dias grátis</strong> — sem cobrar nada agora</p>
                <p>✓ Após o trial: <strong>R$ 89,90/mês</strong> via boleto ou Pix</p>
                <p>✓ Cancele quando quiser, sem fidelidade</p>
              </div>

              <button
                type="submit" disabled={busy}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition active:scale-[0.99]"
              >
                {busy ? 'Criando sua conta…' : 'Criar conta grátis →'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Já tem uma conta? <Link to="/login" className="text-blue-600 hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
