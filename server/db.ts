import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { requireEnv } from './env.js';

let client: NeonQueryFunction<false, false> | null = null;

// Driver HTTP do Neon: cada consulta é um fetch, sem pool nem conexão aberta —
// ideal para funções serverless (e funciona igual num servidor Node comum).
export function getSql() {
  client ??= neon(requireEnv('DATABASE_URL'));
  return client;
}

// Consulta com texto + parâmetros ($1, $2...), para SQL montado dinamicamente.
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await getSql().query(text, params)) as T[];
}
