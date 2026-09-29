import { Hono } from 'hono';
import { z } from 'zod';
import {
  authenticate,
  buildSessionResponse,
  checkPassword,
  findUserByUsername,
  hashPassword,
  requireRole,
  toPublicUser,
  type AuthEnv,
} from '../auth.js';
import { query } from '../db.js';
import { ApiError, noStore, ok } from '../http.js';

export const authRoutes = new Hono<AuthEnv>();

authRoutes.use('*', async (c, next) => {
  noStore(c);
  await next();
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
});

authRoutes.post('/login', async (c) => {
  const { username, password } = loginSchema.parse(await c.req.json());
  const user = await findUserByUsername(username);
  // Compara mesmo sem usuário (hash falso) para não revelar quais usuários existem.
  const valid = await checkPassword(password, user?.password_hash);

  if (!user || !valid) {
    throw new ApiError(401, 'Usuário ou senha incorretos');
  }

  return ok(c, await buildSessionResponse(toPublicUser(user)));
});

// Renova o token (mais 12 h) enquanto o admin continua usando o painel.
authRoutes.get('/session', async (c) => ok(c, await buildSessionResponse(await authenticate(c))));

// Sessão sem estado (JWT): sair é só o front descartar o token.
authRoutes.post('/logout', (c) => ok(c, { ok: true }));

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newUsername: z.string().trim().min(3, 'O usuário deve ter no mínimo 3 caracteres.').max(120),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres.').max(200),
});

authRoutes.post('/change-password', requireRole('admin', 'gestor'), async (c) => {
  const { currentPassword, newUsername, newPassword } = changePasswordSchema.parse(await c.req.json());
  const sessionUser = c.get('user');
  const user = await findUserByUsername(sessionUser.username);

  if (!user || !(await checkPassword(currentPassword, user.password_hash))) {
    throw new ApiError(401, 'Senha atual incorreta.');
  }

  const username = newUsername.toLowerCase();
  const [conflict] = await query<{ id: string }>('select id from usuarios_admin where username = $1 and id <> $2', [username, user.id]);

  if (conflict) {
    throw new ApiError(409, 'Esse nome de usuário já está em uso.');
  }

  // token_version + 1 derruba as sessões abertas em outros aparelhos.
  const [updated] = await query<{ id: string; username: string; name: string | null; role: 'admin' | 'gestor'; token_version: number }>(
    `update usuarios_admin
        set username = $1, password_hash = $2, token_version = token_version + 1, updated_at = now()
      where id = $3
      returning id, username, name, role, token_version`,
    [username, await hashPassword(newPassword), user.id]
  );

  return ok(c, await buildSessionResponse(updated));
});
