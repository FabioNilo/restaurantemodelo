import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// Erro com status HTTP, convertido em { success: false, error } pelo onError do app.
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Mesmo envelope que o front já desembrulha em marmitas-api.ts (unwrap).
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ success: true, data }, status);
}

export function fail(c: Context, status: ContentfulStatusCode, message: string) {
  return c.json({ success: false, error: message }, status);
}

// Cache só na CDN da Vercel (a maioria das visitas é servida sem invocar a
// função). O navegador sempre revalida: com stale-while-revalidate no
// Cache-Control, ele próprio mostrava o cardápio antigo por minutos depois de
// uma edição no admin. Vercel-CDN-Cache-Control é lido só pela Vercel.
export function publicCache(c: Context, seconds: number, staleSeconds = seconds * 2) {
  c.header('Cache-Control', 'public, max-age=0, must-revalidate');
  c.header('Vercel-CDN-Cache-Control', `s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`);
}

export function noStore(c: Context) {
  c.header('Cache-Control', 'no-store');
}
