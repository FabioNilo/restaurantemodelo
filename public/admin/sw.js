// Service worker do PWA do painel (escopo /admin/). Faz duas coisas:
//  1. mostra a notificação quando chega um pedido novo (Web Push), mesmo com o app fechado;
//  2. ao tocar nela, abre/foca o painel na tela do pedido.
// Não guarda NADA em cache: o painel precisa sempre dos dados atuais (mesas, caixa, estoque),
// e o site público fica fora deste escopo.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Sem cache: deixa toda requisição seguir direto para a rede. (Alguns navegadores
// só tratam o app como instalável quando existe um handler de fetch.)
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data ? event.data.text() : '' };
  }

  const titulo = dados.title || 'Nosso Bistrô';

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: '/admin/icon-192.png',
      badge: '/admin/icon-192.png',
      // Mesma tag substitui a anterior (ex.: vários pedidos da mesma mesa); renotify faz tocar de novo.
      tag: dados.tag || undefined,
      renotify: Boolean(dados.tag),
      // Pedido novo fica na tela até alguém tocar, para não passar batido no balcão.
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: typeof dados.url === 'string' && dados.url.startsWith('/admin') ? dados.url : '/admin/mesas' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/mesas';

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // O navegador informa a URL em que a janela foi CARREGADA: quem entrou por /auth e foi levado
      // ao painel sem recarregar continua constando como /auth.
      const painel = janelas.find((janela) => {
        const caminho = new URL(janela.url).pathname;
        return caminho.startsWith('/admin') || caminho === '/auth';
      });

      if (painel) {
        // O painel já está aberto: só troca de tela (sem recarregar) e traz para a frente.
        painel.postMessage({ tipo: 'abrir', url });
        await painel.focus();
        return;
      }

      await self.clients.openWindow(url);
    })()
  );
});
