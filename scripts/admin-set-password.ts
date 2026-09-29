// Cria ou redefine a senha de um usuário do painel e derruba as sessões abertas dele.
// Rode com: npm run admin:password -- <usuario> <nova-senha> [admin|gestor]
// (produção: ENV_FILE=.env.vercel-production.local npm run admin:password -- ...)
import bcrypt from 'bcryptjs';
import { connectDb, describeDatabase, loadScriptEnv } from './lib/env';

async function run() {
  loadScriptEnv();
  const [usernameArg, password, roleArg = 'admin'] = process.argv.slice(2);
  const username = usernameArg?.trim().toLowerCase();

  if (!username || !password) {
    throw new Error('Uso: npm run admin:password -- <usuario> <nova-senha> [admin|gestor]');
  }

  if (password.length < 8) {
    throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  }

  if (roleArg !== 'admin' && roleArg !== 'gestor') {
    throw new Error('O papel deve ser "admin" ou "gestor".');
  }

  const client = await connectDb();
  console.log(`Banco: ${describeDatabase()}`);

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await client.query<{ created: boolean }>(
      `insert into usuarios_admin (username, password_hash, role)
       values ($1, $2, $3)
       on conflict (username) do update
         set password_hash = excluded.password_hash,
             token_version = usuarios_admin.token_version + 1,
             updated_at = now()
       returning (xmax = 0) as created`,
      [username, passwordHash, roleArg]
    );

    console.log(`Usuário "${username}" ${result.rows[0]?.created ? 'criado' : 'atualizado; sessões antigas encerradas'}.`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
