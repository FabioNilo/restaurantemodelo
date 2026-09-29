// Única Vercel Function do projeto (o plano Hobby permite até 12 por deploy).
// O vercel.json reescreve /api/<rota> para /api/index?__path=<rota>; aqui a URL
// original é reconstruída e entregue ao app Hono em server/app.ts.
import { app } from '../server/app.js';

export function restoreOriginalUrl(request: Request) {
  const url = new URL(request.url);
  const originalPath = url.searchParams.get('__path');

  if (originalPath === null) {
    return request;
  }

  url.searchParams.delete('__path');
  url.pathname = `/api/${originalPath.replace(/^\/+/, '')}`;

  // Corpo em stream exige duplex: 'half' no Node ao criar um novo Request.
  const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers: request.headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

function handler(request: Request) {
  return app.fetch(restoreOriginalUrl(request));
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
