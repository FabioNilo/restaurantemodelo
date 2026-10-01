import { Hono } from 'hono';
import { ZodError } from 'zod';
import { ApiError, fail } from './http.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { mesaPublicaRoutes } from './routes/mesa-publica.js';
import { publicRoutes } from './routes/public.js';

// API do Nosso Bistrô. Não depende da Vercel: api/index.ts adapta para as
// Vercel Functions e server/node.ts roda o mesmo app num servidor Node (VPS).
// As rotas seguem o contrato de src/features/integrations/n8n-contracts.ts,
// então o front só precisa de VITE_API_BASE_URL=/api.
export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));

app.route('/massas', publicRoutes);
app.route('/massas/auth', authRoutes);
app.route('/massas/admin', adminRoutes);
app.route('/mesas', mesaPublicaRoutes);

app.notFound((c) => fail(c, 404, 'Rota não encontrada.'));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return fail(c, error.status, error.message);
  }

  if (error instanceof ZodError) {
    return fail(c, 400, error.issues[0]?.message ?? 'Dados inválidos.');
  }

  console.error(error);
  return fail(c, 500, 'Erro interno. Tente novamente em instantes.');
});
