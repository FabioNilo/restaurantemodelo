// Demo offline: sem base URL de webhook, o app usa o cardápio local
// (src/data/cardapio.ts) e o pedido segue direto pelo WhatsApp,
// sem depender de nenhum backend real.
window.__MARMITAS_CONFIG__ = {
  VITE_CHIPTRACK_WEBHOOK_BASE_URL: '',
  VITE_CHIPTRACK_WEBHOOK_KEY: '',
  VITE_MARMITAS_PUBLIC_API: 'n8n',
  VITE_MARMITAS_AUTH_API: 'n8n',
  VITE_MARMITAS_ADMIN_API: 'n8n',
};
