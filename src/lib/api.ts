import { getConfigValue } from '@/lib/runtime-config';

const rawBaseUrl = getConfigValue(
  'VITE_CHIPTRACK_WEBHOOK_BASE_URL',
  'CHIPTRACK_WEBHOOK_BASE_URL',
  'VITE_N8N_BASE_URL'
);
const rawWebhookKey = getConfigValue(
  'VITE_CHIPTRACK_WEBHOOK_KEY',
  'CHIPTRACK_WEBHOOK_KEY',
  'VITE_N8N_WEBHOOK_KEY'
);

export const N8N_BASE_URL = rawBaseUrl?.replace(/\/$/, '') ?? '';
export const N8N_WEBHOOK_KEY = rawWebhookKey?.trim() ?? '';

export const MARMITAS_PUBLIC_API =
  (getConfigValue('VITE_MARMITAS_PUBLIC_API') as 'n8n' | undefined) ?? 'n8n';
export const MARMITAS_AUTH_API =
  (getConfigValue('VITE_MARMITAS_AUTH_API') as 'n8n' | undefined) ?? 'n8n';
export const MARMITAS_ADMIN_API =
  (getConfigValue('VITE_MARMITAS_ADMIN_API') as 'n8n' | undefined) ?? 'n8n';

export function isN8nPublicApiEnabled() {
  return MARMITAS_PUBLIC_API === 'n8n';
}

export function isN8nAdminApiEnabled() {
  return MARMITAS_ADMIN_API === 'n8n';
}

export function hasN8NBaseUrl() {
  return N8N_BASE_URL.length > 0;
}

export function hasN8NWebhookKey() {
  return N8N_WEBHOOK_KEY.length > 0;
}

export function buildN8nUrl(path: string) {
  if (!hasN8NBaseUrl()) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (N8N_BASE_URL.endsWith('/webhook') && normalizedPath.startsWith('/webhook/')) {
    return `${N8N_BASE_URL}${normalizedPath.replace(/^\/webhook/, '')}`;
  }

  return `${N8N_BASE_URL}${normalizedPath}`;
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: { allowEmptyBody?: boolean } = {}
): Promise<T> {
  if (!hasN8NBaseUrl()) {
    throw new Error(
      'Webhook não configurado. Defina CHIPTRACK_WEBHOOK_BASE_URL e CHIPTRACK_WEBHOOK_KEY no .env.local e reinicie o preview.'
    );
  }

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const headers = new Headers(init.headers ?? undefined);

  if (!isFormData) {
    headers.set('content-type', 'application/json');
  }

  if (hasN8NWebhookKey()) {
    headers.set('x-webhook-key', N8N_WEBHOOK_KEY);
    headers.set('Xi-Api-Key', N8N_WEBHOOK_KEY);
  }

  const response = await fetch(buildN8nUrl(path), {
    ...init,
    headers,
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      rawBody || `Request failed with status ${response.status} (${response.url || buildN8nUrl(path)})`
    );
  }

  if (!rawBody.trim()) {
    if (options.allowEmptyBody) {
      return {} as T;
    }

    throw new Error(
      `O webhook respondeu sem corpo JSON (${response.status}) em ${response.url || buildN8nUrl(path)}.`
    );
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(
      `O webhook respondeu em formato invalido em ${response.url || buildN8nUrl(path)}: ${rawBody.slice(0, 200)}.`
    );
  }
}
