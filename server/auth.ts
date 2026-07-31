// server/auth.ts
// Auth própria — substitui GoTrue (Supabase Auth). Mantém o mesmo formato de
// claims que o GoTrue emitia (sub/role/user_metadata), porque o frontend
// (AuthContext.tsx: profileFromUser) e o PostgREST (auth.uid()/auth.role(),
// ver postgres/init/003_auth.sql e 004_rls.sql) já esperam esse shape.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { pool } from './db';

const JWT_SECRET             = process.env.JWT_SECRET || '';
const ACCESS_TOKEN_TTL_SEC   = 15 * 60;           // 15 min — mesma ordem de grandeza do access token do GoTrue
const REFRESH_TOKEN_TTL_DAYS = 30;
const BCRYPT_COST            = 12;                // mesmo cost do hash já existente em produção

if (!JWT_SECRET) {
  console.error('[Auth] JWT_SECRET é obrigatório');
  process.exit(1);
}

export type Role = 'super_admin' | 'tenant_admin' | 'tenant_professional' | 'customer';

export interface UserRow {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  password_hash: string | null;
  google_sub: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AccessTokenClaims {
  sub: string;
  role: 'authenticated';
  email: string;
  user_metadata: { name: string; role: Role; tenant_id: string | null; phone: string | null };
  iat: number;
  exp: number;
}

// ── Senhas ──────────────────────────────────────────────────────────────────
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Access token (JWT curto, o mesmo que hoje vai no Authorization: Bearer) ──
export function signAccessToken(user: UserRow): string {
  const payload: Omit<AccessTokenClaims, 'iat' | 'exp'> = {
    sub: user.id,
    role: 'authenticated',
    email: user.email,
    user_metadata: { name: user.name, role: user.role, tenant_id: user.tenant_id, phone: user.phone },
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as AccessTokenClaims;
}

// ── Refresh token (opaco, hash SHA-256 no banco, rotativo) ───────────────────
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function newOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_internal.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  return token;
}

/**
 * Troca um refresh token pelo próximo (rotação). Se o token apresentado já
 * tiver sido revogado antes, trata como possível roubo e revoga TODOS os
 * refresh tokens do usuário — força relogin em todas as sessões.
 */
export async function rotateRefreshToken(token: string): Promise<{ user: UserRow; refreshToken: string } | null> {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at FROM auth_internal.refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  if (row.revoked_at) {
    await pool.query(`UPDATE auth_internal.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
    return null;
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const user = await getUserById(row.user_id);
  if (!user || !user.is_active) return null;

  await pool.query(`UPDATE auth_internal.refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
  const refreshToken = await issueRefreshToken(user.id);
  return { user, refreshToken };
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await pool.query(`UPDATE auth_internal.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await pool.query(`UPDATE auth_internal.refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [hashToken(token)]);
}

// ── Lookup de usuário (sempre a fonte de verdade para re-derivar claims) ─────
export async function getUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active, created_at FROM auth_internal.users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string, tenantId: string | null = null): Promise<UserRow | null> {
  const { rows } = await pool.query(
    tenantId === null
      ? `SELECT id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active, created_at FROM auth_internal.users WHERE email = $1 AND tenant_id IS NULL`
      : `SELECT id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active, created_at FROM auth_internal.users WHERE email = $1 AND tenant_id = $2`,
    tenantId === null ? [email] : [email, tenantId],
  );
  return rows[0] ?? null;
}

/** Busca por email em qualquer tenant — usado no login, onde ainda não se sabe o tenant_id */
export async function findUserForLogin(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, name, email, role, phone, password_hash, google_sub, is_active, created_at FROM auth_internal.users WHERE email = $1 ORDER BY created_at ASC LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

// ── Reset de senha ────────────────────────────────────────────────────────
const PASSWORD_RESET_TTL_MIN = 60;

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_internal.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<UserRow | null> {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT id, user_id, expires_at, used_at FROM auth_internal.password_reset_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;

  const user = await getUserById(row.user_id);
  if (!user) return null;

  await pool.query(`UPDATE auth_internal.password_reset_tokens SET used_at = now() WHERE id = $1`, [row.id]);
  return user;
}

// ── Verificação de email (substitui auth.admin.generateLink do GoTrue) ──────
const EMAIL_VERIFICATION_TTL_HOURS = 24;

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_internal.email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<UserRow | null> {
  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT id, user_id, expires_at, used_at FROM auth_internal.email_verification_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;

  const user = await getUserById(row.user_id);
  if (!user) return null;

  await pool.query(`UPDATE auth_internal.email_verification_tokens SET used_at = now() WHERE id = $1`, [row.id]);
  await pool.query(`UPDATE auth_internal.users SET email_verified_at = now() WHERE id = $1`, [user.id]);
  return user;
}

// ── Google OAuth ──────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export function googleOAuthClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const client = googleOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error('Google id_token sem sub/email.');
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    emailVerified: !!payload.email_verified,
  };
}
