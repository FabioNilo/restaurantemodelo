import { Hono } from 'hono';
import { z } from 'zod';
import { isDeliveryClosed, SITE_CLOSED_MESSAGE } from '../../src/lib/site-settings.js';
import { getConfiguracoes, getPublicCatalog } from '../catalog.js';
import { criarPedidoDelivery, getStatusPedidoDelivery, pedidoDeliverySchema } from '../delivery.js';
import { fail, noStore, ok, publicCache } from '../http.js';

export const publicRoutes = new Hono();

publicRoutes.get('/catalogo', async (c) => {
  publicCache(c, 30, 60);
  return ok(c, await getPublicCatalog());
});

publicRoutes.get('/site-status', async (c) => {
  publicCache(c, 30, 60);
  const settings = await getConfiguracoes();

  return ok(c, {
    whatsapp_numero: settings.whatsapp_numero,
    mensagem_fechado: settings.mensagem_fechado || SITE_CLOSED_MESSAGE,
    mostrar_aviso_fechado: true,
    entregas_abertas_agora: !isDeliveryClosed(settings),
  });
});

// Módulos ainda não habilitados nesta versão (Pedidos e Taxas de entrega).
// As respostas abaixo fazem o carrinho cair no fluxo que já existe: bairro
// digitado à mão, taxa "a combinar" e pedido enviado direto pelo WhatsApp.
publicRoutes.get('/delivery-zones', (c) => {
  publicCache(c, 300);
  return ok(c, []);
});

publicRoutes.post('/delivery-fee', async (c) => {
  const body = await c.req.json<{ bairro?: string }>().catch(() => ({ bairro: '' }));

  return ok(c, {
    bairro: body.bairro ?? '',
    taxa: null,
    encontrado: false,
    entrega_disponivel: true,
    motivo_indisponivel: null,
  });
});

// Pedido de delivery: registrado aqui (preços do cardápio) e o site abre o WhatsApp em seguida.
publicRoutes.post('/pedidos', async (c) => {
  noStore(c);
  return ok(c, await criarPedidoDelivery(pedidoDeliverySchema.parse(await c.req.json())), 201);
});

publicRoutes.get('/pedidos/status', async (c) => {
  noStore(c);
  const id = z.string().uuid().parse(c.req.query('id'));
  const token = z.string().min(10).max(64).parse(c.req.query('token'));
  return ok(c, await getStatusPedidoDelivery(id, token));
});

publicRoutes.post('/pedidos/cancelar', (c) => fail(c, 409, 'Para cancelar, fale conosco pelo WhatsApp.'));
