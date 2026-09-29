import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Carrega o arquivo de ambiente dos scripts de banco. Por padrão .env.local
// (branch "dev" do Neon); para a produção, rode com
// ENV_FILE=.env.vercel-production.local.
export function loadScriptEnv() {
  const file = path.resolve(process.env.ENV_FILE ?? '.env.local');

  if (existsSync(file)) {
    process.loadEnvFile(file);
  }

  return file;
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Defina ${name} (em .env.local ou no arquivo apontado por ENV_FILE).`);
  }

  return value;
}

export async function connectDb() {
  const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') });
  await client.connect();
  return client;
}

// Mostra só o host do banco, nunca a senha.
export function describeDatabase() {
  try {
    return new URL(requireEnv('DATABASE_URL')).host;
  } catch {
    return '(DATABASE_URL inválida)';
  }
}
