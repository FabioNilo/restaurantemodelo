import bcrypt from 'bcryptjs';
import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, SignJWT } from 'jose';
import { query } from './db.js';
import { requireEnv } from './env.js';
import { ApiError } from './http.js';

export type AdminRole = 'admin' | 'gestor';

export interface AdminUserRow {
  id: string;
  username: string;
  name: string | null;
  role: AdminRole;
  password_hash: string;
  token_version: number;
}

export interface SessionClaims {
  sub: string;
  role: AdminRole;
  tv: number;
}

export type AdminUser = Omit<AdminUserRow, 'password_hash'>;

export type AuthEnv = { Variables: { user: AdminUser } };

const SESSION_TTL_SECONDS = 12 * 60 * 60;
// Hash válido de uma senha aleatória: comparar contra ele quando o usuário
// não existe mantém o tempo de resposta igual (não revela usuários válidos).
const DUMMY_HASH = '$2b$12$nnhXhBeisTgRQZgYlZf5kuxQ/LLuyiZJEAFyNqLsjLlECvyK.FMyO';

function getSecret() {
  const secret = requireEnv('SESSION_SECRET');

  if (secret.length < 32) {
    throw new Error('SESSION_SECRET precisa ter pelo menos 32 caracteres.');
  }

  return new TextEncoder().encode(secret);
}

export async function signSession(user: Pick<AdminUserRow, 'id' | 'role' | 'token_version'>, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + SESSION_TTL_SECONDS;

  const token = await new SignJWT({ role: user.role, tv: user.token_version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });

    if (typeof payload.sub !== 'string' || typeof payload.tv !== 'number' || (payload.role !== 'admin' && payload.role !== 'gestor')) {
      throw new Error('claims');
    }

    return { sub: payload.sub, role: payload.role, tv: payload.tv };
  } catch {
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password: string, hash: string | null | undefined) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}

export async function findUserByUsername(username: string) {
  const [row] = await query<AdminUserRow>(
    'select id, username, name, role, password_hash, token_version from usuarios_admin where username = $1',
    [username.trim().toLowerCase()]
  );
  return row ?? null;
}

async function findUserById(id: string) {
  const [row] = await query<AdminUserRow>(
    'select id, username, name, role, password_hash, token_version from usuarios_admin where id = $1',
    [id]
  );
  return row ?? null;
}

// Formato AuthSession que o front guarda (n8n-contracts.ts).
export async function buildSessionResponse(user: AdminUser) {
  const { token, expiresAt } = await signSession(user);

  return {
    access_token: token,
    expires_at: expiresAt,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  };
}

export function toPublicUser({ password_hash: _passwordHash, ...user }: AdminUserRow): AdminUser {
  return user;
}

function readBearerToken(c: Context) {
  const header = c.req.header('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }

  return match[1].trim();
}

// Valida o token e confere no banco se o usuário existe e se a senha não foi
// trocada depois da emissão (token_version).
export async function authenticate(c: Context) {
  const claims = await verifySessionToken(readBearerToken(c));
  const user = await findUserById(claims.sub);

  if (!user || user.token_version !== claims.tv) {
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }

  return toPublicUser(user);
}

export function requireRole(...roles: AdminRole[]): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const user = await authenticate(c);

    if (!roles.includes(user.role)) {
      throw new ApiError(403, 'Você não tem permissão para esta ação.');
    }

    c.set('user', user);
    await next();
  };
}
