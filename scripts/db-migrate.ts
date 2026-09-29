// Aplica os arquivos de db/migrations em ordem, cada um uma única vez.
// Rode com: npm run db:migrate   (produção: ENV_FILE=.env.vercel-production.local npm run db:migrate)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connectDb, describeDatabase, loadScriptEnv } from './lib/env';

const MIGRATIONS_DIR = path.resolve('db/migrations');

async function run() {
  loadScriptEnv();
  const client = await connectDb();
  console.log(`Banco: ${describeDatabase()}`);

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.query<{ name: string }>('select name from schema_migrations')).rows.map((row) => row.name)
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`= ${file} (já aplicada)`);
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');

      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`+ ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
