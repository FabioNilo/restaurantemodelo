import { Hono } from 'hono';
import { isDeliveryClosed, SITE_CLOSED_MESSAGE } from '../../src/lib/site-settings.js';
import { getConfiguracoes, getPublicCatalog } from '../catalog.js';
import { fail, ok, publicCache } from '../http.js';

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

publicRoutes.post('/pedidos', (c) => fail(c, 501, 'Registro de pedidos ainda não habilitado. O pedido segue pelo WhatsApp.'));
