import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILES = ['.env.local', '.env.import.local', '.env.import', '.env.homolog', '.env'];

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');

    if (!process.env[key]) process.env[key] = value;
  }
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Defina ${name} antes de rodar este comando.`);
  return value;
}

function quoteIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Identificador PostgreSQL invalido: ${value}`);
  }

  return `"${value}"`;
}

async function hashPassword(password) {
  if (process.env.ADMIN_PASSWORD_HASH?.trim()) {
    return process.env.ADMIN_PASSWORD_HASH.trim();
  }

  try {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 12);
  } catch {
    // Continue to native bcrypt fallback.
  }

  try {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 12);
  } catch {
    throw new Error(
      'Instale bcryptjs/bcrypt ou informe ADMIN_PASSWORD_HASH para rotacionar a senha.'
    );
  }
}

function buildGeneratedPassword() {
  return randomBytes(27).toString('base64url');
}

async function main() {
  for (const fileName of ENV_FILES) loadEnvFile(fileName);

  const databaseUrl = getRequiredEnv('MASSAS_DATABASE_URL');
  const schema = quoteIdentifier(process.env.MASSAS_DATABASE_SCHEMA?.trim() || 'marmita_fit');
  const username = getRequiredEnv('ADMIN_USERNAME');
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || username;
  const roleSlug = process.env.ADMIN_ROLE_SLUG?.trim() || 'admin';
  const generatedPassword = !process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH;
  const password = process.env.ADMIN_PASSWORD?.trim() || buildGeneratedPassword();
  const passwordHash = await hashPassword(password);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.MASSAS_DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('begin');
    await client.query(`set local search_path to ${schema}`);

    const roleResult = await client.query(
      `insert into roles (slug, name)
       values ($1, $2)
       on conflict (slug) do update set name = excluded.name
       returning id`,
      [roleSlug, roleSlug === 'admin' ? 'Administrador' : roleSlug]
    );

    const roleId = roleResult.rows[0].id;
    const userResult = await client.query(
      `insert into users (role_id, full_name, email, password_hash, must_change_password, is_active, updated_at)
       values ($1, $2, $3, $4, true, true, now())
       on conflict (email) do update
       set role_id = excluded.role_id,
           full_name = excluded.full_name,
           password_hash = excluded.password_hash,
           must_change_password = true,
           is_active = true,
           updated_at = now()
       returning id, email`,
      [roleId, fullName, username, passwordHash]
    );

    await client.query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [
      userResult.rows[0].id,
    ]);

    await client.query('commit');

    console.log(`Credenciais rotacionadas para ${userResult.rows[0].email}.`);
    console.log('Sessoes existentes desse usuario foram revogadas.');
    if (generatedPassword) {
      console.log(`Nova senha temporaria: ${password}`);
      console.log('Guarde esta senha em um cofre e troque no primeiro login.');
    }
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
