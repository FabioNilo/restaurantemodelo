// Popula o banco com o cardápio de src/data/cardapio.ts, as configurações
// padrão e o usuário admin (ADMIN_USERNAME / ADMIN_PASSWORD). Idempotente:
// não sobrescreve o que o dono já editou pelo admin.
// Rode com: npm run db:seed   (produção: ENV_FILE=.env.vercel-production.local npm run db:seed)
import bcrypt from 'bcryptjs';
import { categoriasCardapio, produtosCardapio } from '../src/data/cardapio';
import { DEFAULT_SITE_SETTINGS } from '../src/lib/site-settings';
import { connectDb, describeDatabase, loadScriptEnv, requireEnv } from './lib/env';

async function run() {
  loadScriptEnv();
  const adminUsername = requireEnv('ADMIN_USERNAME').toLowerCase();
  const adminPassword = requireEnv('ADMIN_PASSWORD');

  if (adminPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  }

  const client = await connectDb();
  console.log(`Banco: ${describeDatabase()}`);

  try {
    await client.query('begin');

    let categorias = 0;
    for (const categoria of categoriasCardapio) {
      const result = await client.query(
        `insert into categorias (id, nome, ordem, ativo) values ($1, $2, $3, true)
         on conflict (id) do nothing`,
        [categoria.id, categoria.nome, categoria.ordem]
      );
      categorias += result.rowCount ?? 0;
    }

    let produtos = 0;
    for (const produto of produtosCardapio) {
      const result = await client.query(
        `insert into produtos (id, categoria_id, nome, descricao, preco, estoque, disponivel, imagem_url, tamanhos)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         on conflict (id) do nothing`,
        [
          produto.id,
          produto.categoria_id,
          produto.nome,
          produto.descricao,
          produto.preco,
          produto.estoque ?? 0,
          produto.disponivel ?? true,
          produto.imagem_url,
          JSON.stringify(produto.tamanhos ?? []),
        ]
      );
      produtos += result.rowCount ?? 0;
    }

    const settings = DEFAULT_SITE_SETTINGS;
    const config = await client.query(
      `insert into configuracoes_site
         (id, whatsapp_numero, entregas_ativas, hora_abertura, hora_fechamento, dias_entrega, mensagem_fechado, timezone)
       values (1, $1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do nothing`,
      [
        settings.whatsapp_numero,
        settings.entregas_ativas,
        settings.hora_abertura,
        settings.hora_fechamento,
        settings.dias_entrega,
        settings.mensagem_fechado,
        settings.timezone,
      ]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await client.query(
      `insert into usuarios_admin (username, password_hash, name, role)
       values ($1, $2, 'Administrador', 'admin')
       on conflict (username) do nothing`,
      [adminUsername, passwordHash]
    );

    await client.query('commit');

    console.log(`Categorias novas: ${categorias} de ${categoriasCardapio.length}`);
    console.log(`Produtos novos: ${produtos} de ${produtosCardapio.length}`);
    console.log(`Configurações: ${config.rowCount ? 'criadas' : 'já existiam'}`);
    console.log(`Admin "${adminUsername}": ${admin.rowCount ? 'criado' : 'já existia (senha mantida)'}`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
