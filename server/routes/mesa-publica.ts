import { Hono } from 'hono';
import { z } from 'zod';
import { noStore, ok } from '../http.js';
import { criarPedidoMesa, getMesaPublica, pedidoMesaSchema } from '../mesas.js';

// Rotas do cliente sentado à mesa, identificadas pelo token do QR code.
export const mesaPublicaRoutes = new Hono();

const tokenSchema = z.string().trim().min(10).max(64).regex(/^[A-Za-z0-9_-]+$/);

mesaPublicaRoutes.use('*', async (c, next) => {
  noStore(c);
  await next();
});

mesaPublicaRoutes.get('/:token', async (c) => ok(c, await getMesaPublica(tokenSchema.parse(c.req.param('token')))));

mesaPublicaRoutes.post('/:token/pedidos', async (c) => {
  const token = tokenSchema.parse(c.req.param('token'));
  const input = pedidoMesaSchema.parse(await c.req.json());
  return ok(c, await criarPedidoMesa(token, input), 201);
});
