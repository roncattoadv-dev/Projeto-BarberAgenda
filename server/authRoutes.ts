// server/authRoutes.ts
// Rotas de autenticação própria — substituem GoTrue (login, refresh, logout,
// Google OAuth, esqueci/redefinir senha). Mantém o mesmo contrato que o
// frontend (AuthContext.tsx) já espera: um access token curto devolvido no
// corpo da resposta, e o refresh acontece via cookie httpOnly (o frontend
// não precisa guardar o refresh token).

import express from 'express';
import crypto from 'crypto';
import {
  hashPassword, verifyPassword, signAccessToken,
  issueRefreshToken, rotateRefreshToken, revokeRefreshToken, revokeAllRefreshTokens,
  getUserById, findUserForLogin, getUserByEmail,
  createPasswordResetToken, consumePasswordResetToken,
  googleOAuthClient, exchangeGoogleCode,
  type UserRow,
} from './auth';
import { pool } from './db';
import { sendPasswordResetEmail, isEmailConfigured } from './email';

const SITE_URL       = (process.env.SITE_URL || process.env.CORS_ORIGIN || '').replace(/\/$/, '');
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
const GOOGLE_REDIRECT_URI = `${API_PUBLIC_URL}/api/auth/google/callback`;
const REFRESH_COOKIE = 'bf_refresh';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function userResponse(user: UserRow, accessToken: string) {
  return {
    access_token: accessToken,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      google_linked: !!user.google_sub,
      user_metadata: { name: user.name, role: user.role, tenant_id: user.tenant_id, phone: user.phone },
    },
  };
}

// ── Trocas de código único pós-OAuth (evita JWT na URL) ──────────────────────
// Processo único, poucos tenants — Map em memória com TTL curto é suficiente
// (mesmo padrão de estado in-memory já usado em index.ts p/ asaasSandboxOverride).
const oauthExchangeCodes = new Map<string, { userId: string; expiresAt: number }>();
function issueExchangeCode(userId: string): string {
  const code = crypto.randomBytes(24).toString('hex');
  oauthExchangeCodes.set(code, { userId, expiresAt: Date.now() + 60_000 });
  return code;
}
setInterval(() => {
  const now = Date.now();
  for (const [code, v] of oauthExchangeCodes) if (v.expiresAt < now) oauthExchangeCodes.delete(code);
}, 60_000).unref();

export const authRouter = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios.' });

  const user = await findUserForLogin(String(email).toLowerCase().trim());
  if (!user || !user.password_hash || !user.is_active) {
    return res.status(401).json({ error: 'Email ou senha inválidos.' });
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email ou senha inválidos.' });

  const accessToken  = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
  return res.json(userResponse(user, accessToken));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh — chamado silenciosamente pelo frontend antes do
// access token expirar (equivalente ao autoRefreshToken do supabase-js)
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Sessão não encontrada.' });

  const result = await rotateRefreshToken(token);
  if (!result) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  const { user, refreshToken } = result;
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
  return res.json(userResponse(user, signAccessToken(user)));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await revokeRefreshToken(token).catch(() => {});
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google — inicia o fluxo (login OU cadastro, mesma tela)
// ─────────────────────────────────────────────────────────────────────────────
authRouter.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('bf_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth', maxAge: 5 * 60 * 1000 });
  const client = googleOAuthClient(GOOGLE_REDIRECT_URI);
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
  res.redirect(url);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google/callback
// ─────────────────────────────────────────────────────────────────────────────
authRouter.get('/google/callback', async (req, res) => {
  const { code, state } = req.query as Record<string, string>;
  const expectedState = req.cookies?.bf_oauth_state;
  res.clearCookie('bf_oauth_state', { path: '/api/auth' });

  if (!code || !state || state !== expectedState) {
    return res.redirect(`${SITE_URL}/login?error=oauth_state_invalid`);
  }

  try {
    const profile = await exchangeGoogleCode(code, GOOGLE_REDIRECT_URI);
    if (!profile.emailVerified) {
      return res.redirect(`${SITE_URL}/login?error=oauth_email_unverified`);
    }

    // Encontra por google_sub (login recorrente) ou por email (primeira vez /
    // vincula a uma conta de senha já existente com o mesmo email)
    let user: UserRow | null = null;
    const bySub = await pool.query(
      `SELECT id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active FROM auth_internal.users WHERE google_sub = $1`,
      [profile.sub],
    );
    user = bySub.rows[0] ?? null;

    if (!user) {
      const byEmail = await findUserForLogin(profile.email);
      if (byEmail) {
        await pool.query(`UPDATE auth_internal.users SET google_sub = $1 WHERE id = $2`, [profile.sub, byEmail.id]);
        user = { ...byEmail, google_sub: profile.sub };
      }
    }

    if (!user) {
      // Conta nova — sem tenant ainda (equivalente ao trigger handle_new_user
      // do GoTrue criando profile com role 'customer'). O onboarding no
      // frontend chama /api/register-google para completar o cadastro.
      const inserted = await pool.query(
        `INSERT INTO auth_internal.users (name, email, google_sub, role, email_verified_at)
         VALUES ($1, $2, $3, 'customer', now())
         RETURNING id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active`,
        [profile.name, profile.email, profile.sub],
      );
      user = inserted.rows[0];
    }

    if (!user!.is_active) return res.redirect(`${SITE_URL}/login?error=account_disabled`);

    const refreshToken = await issueRefreshToken(user!.id);
    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    const exchangeCode = issueExchangeCode(user!.id);
    return res.redirect(`${SITE_URL}/auth/callback?code=${exchangeCode}`);
  } catch (err: any) {
    console.error('[GoogleOAuth] Error:', err.message);
    return res.redirect(`${SITE_URL}/login?error=oauth_failed`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/google/exchange — troca o código único (da URL) por uma sessão
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/google/exchange', async (req, res) => {
  const { code } = req.body || {};
  const entry = code && oauthExchangeCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) return res.status(400).json({ error: 'Código inválido ou expirado.' });
  oauthExchangeCodes.delete(code);

  const user = await getUserById(entry.userId);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Usuário não encontrado.' });

  return res.json(userResponse(user, signAccessToken(user)));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password — sempre 200 (anti-enumeração)
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (email) {
    const user = await findUserForLogin(String(email).toLowerCase().trim());
    if (user && user.password_hash && user.is_active) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${SITE_URL}/redefinir-senha?token=${token}`;
      if (!isEmailConfigured()) {
        // Resend não configurado (dev/staging) — loga em vez de enviar, só assim
        // dá pra testar o fluxo sem depender de SMTP real.
        console.log(`[ForgotPassword] RESEND_API_KEY ausente — link: ${resetUrl}`);
      } else {
        sendPasswordResetEmail(user.email, user.name, resetUrl).catch(err =>
          console.error('[ForgotPassword] Email error (non-fatal):', err.message),
        );
      }
    }
  }
  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'token e newPassword são obrigatórios.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });

  const user = await consumePasswordResetToken(token);
  if (!user) return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });

  const passwordHash = await hashPassword(newPassword);
  await pool.query(`UPDATE auth_internal.users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
  await revokeAllRefreshTokens(user.id);

  return res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/update-password — troca de senha estando logado (requer senha atual)
// ─────────────────────────────────────────────────────────────────────────────
authRouter.post('/update-password', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido.' });

  const { verifyAccessToken } = await import('./auth');
  let claims;
  try { claims = verifyAccessToken(auth.slice(7)); } catch { return res.status(401).json({ error: 'Token inválido ou expirado.' }); }

  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'newPassword é obrigatório.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres.' });

  const user = await getUserById(claims.sub);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  // Conta só-Google definindo a primeira senha: não há senha atual pra conferir.
  // Conta com senha: exige currentPassword e confere.
  if (user.password_hash) {
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword é obrigatório.' });
    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(`UPDATE auth_internal.users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);
  return res.json({ ok: true });
});
