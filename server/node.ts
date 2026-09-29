// Roda a API num servidor Node comum: desenvolvimento local (npm run dev:api,
// com o Vite fazendo proxy de /api) ou produção numa VPS (npm run start:api,
// atrás de um Nginx/pm2). As variáveis vêm do ambiente ou do .env.local.
import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API do Nosso Bistrô em http://localhost:${info.port}/api`);
});
