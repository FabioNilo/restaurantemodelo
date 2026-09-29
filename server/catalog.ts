import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Categoria, Marmita, MarmitaAdminListItem, MarmitaListItem, ProdutoTamanho } from '../src/types/product.js';
import type { ConfiguracoesSite } from '../src/lib/site-settings.js';
import { query } from './db.js';
import { ApiError } from './http.js';
import { deleteProductImage, isDataImageUrl, putProductImage } from './storage.js';

// --- Linhas do banco -> formatos que o front já usa ---

interface ProdutoRow {
  id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string | null;
  preco: string | number;
  estoque: number;
  disponivel: boolean;
  imagem_url: string | null;
  imagem_key: string | null;
  tamanhos: ProdutoTamanho[] | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
}

interface CategoriaRow {
  id: string;
  nome: string;
  ordem: number | null;
  ativo: boolean;
  created_at: string | Date | null;
}

interface ConfiguracoesRow {
  id: number;
  whatsapp_numero: string;
  entregas_ativas: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  dias_entrega: number[];
  mensagem_fechado: string;
  timezone: string;
  updated_at: string | Date | null;
}

function toIso(value: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toTamanhos(value: ProdutoTamanho[] | null): ProdutoTamanho[] {
  return (value ?? []).map((tamanho) => ({ ...tamanho, serve: tamanho.serve ?? '', preco: Number(tamanho.preco) }));
}

export function toMarmita(row: ProdutoRow): Marmita {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    categoria_id: row.categoria_id,
    preco: Number(row.preco),
    estoque: row.estoque,
    disponivel: row.disponivel,
    imagem_url: row.imagem_url,
    permite_troca_massa: false,
    tamanhos: toTamanhos(row.tamanhos),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toCategoria(row: CategoriaRow): Categoria {
  return { id: row.id, nome: row.nome, ordem: row.ordem, ativo: row.ativo, created_at: toIso(row.created_at) };
}

function toConfiguracoes(row: ConfiguracoesRow): ConfiguracoesSite {
  return {
    id: row.id,
    whatsapp_numero: row.whatsapp_numero,
    entregas_ativas: row.entregas_ativas,
    hora_abertura: row.hora_abertura,
    hora_fechamento: row.hora_fechamento,
    dias_entrega: row.dias_entrega,
    mensagem_fechado: row.mensagem_fechado,
    timezone: row.timezone,
    updated_at: toIso(row.updated_at),
  };
}

const PRODUTO_COLUMNS =
  'id, categoria_id, nome, descricao, preco, estoque, disponivel, imagem_url, imagem_key, tamanhos, created_at, updated_at';

// --- Validação dos payloads do admin ---

const tamanhoSchema = z.object({
  codigo: z.string().trim().min(1).max(80),
  nome: z.string().trim().min(1, 'Preencha o nome de todas as opções.').max(80),
  serve: z.string().trim().max(80).optional().default(''),
  preco: z.coerce.number().positive('O preço de cada opção deve ser maior que zero.'),
});

const produtoBaseSchema = z.object({
  nome: z.string().trim().min(1, 'O nome é obrigatório.').max(120),
  descricao: z.string().trim().max(500).nullish(),
  categoria_id: z.string().trim().min(1).nullish(),
  preco: z.coerce.number().min(0),
  estoque: z.coerce.number().int().min(0).default(0),
  disponivel: z.boolean().default(true),
  imagem_url: z.string().nullish(),
  tamanhos: z.array(tamanhoSchema).max(60).default([]),
});

export const produtoCreateSchema = produtoBaseSchema;
export const produtoUpdateSchema = produtoBaseSchema.partial();

export const categoriaCreateSchema = z.object({
  id: z.string().trim().max(80).optional(),
  nome: z.string().trim().min(1, 'O nome da categoria é obrigatório.').max(80),
  ordem: z.coerce.number().int().nullish(),
  ativo: z.boolean().optional(),
});

export const categoriaUpdateSchema = categoriaCreateSchema.omit({ id: true }).partial();

const horaSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Horário inválido.');

export const configuracoesSaveSchema = z
  .object({
    whatsapp_numero: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .refine((value) => value.length >= 10 && value.length <= 13, 'Número de WhatsApp inválido.'),
    entregas_ativas: z.boolean(),
    hora_abertura: horaSchema,
    hora_fechamento: horaSchema,
    dias_entrega: z.array(z.number().int().min(0).max(6)).max(7),
    mensagem_fechado: z.string().trim().max(500),
    timezone: z.string().trim().min(1).max(60),
  })
  .partial();

// --- Helpers ---

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function newProdutoId(nome: string) {
  return `${slugify(nome) || 'produto'}-${randomBytes(3).toString('hex')}`;
}

// Monta "coluna = $n" só com os campos enviados.
function buildUpdate(fields: Record<string, unknown>, casts: Record<string, string> = {}) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const sets = entries.map(([column], index) => `${column} = $${index + 1}${casts[column] ?? ''}`);
  const values = entries.map(([column, value]) => (casts[column] === '::jsonb' ? JSON.stringify(value) : value));
  return { sets, values };
}

// --- Catálogo público ---

export async function getPublicCatalog(): Promise<{ categorias: Array<Pick<Categoria, 'id' | 'nome' | 'ordem'>>; marmitas: MarmitaListItem[] }> {
  const [categorias, produtos] = await Promise.all([
    query<CategoriaRow>('select id, nome, ordem, ativo, created_at from categorias where ativo order by ordem nulls last, nome'),
    query<ProdutoRow>(`select ${PRODUTO_COLUMNS} from produtos where disponivel and estoque > 0 order by nome`),
  ]);

  return {
    categorias: categorias.map(({ id, nome, ordem }) => ({ id, nome, ordem })),
    marmitas: produtos.map((row) => {
      const { created_at: _created, updated_at: _updated, ...produto } = toMarmita(row);
      return produto;
    }),
  };
}

// --- Produtos (admin) ---

export async function listProdutos(page: number, pageSize: number) {
  const safePageSize = Math.min(Math.max(pageSize, 1), 200);
  const offset = (Math.max(page, 1) - 1) * safePageSize;

  const [rows, [{ count }]] = await Promise.all([
    query<ProdutoRow>(`select ${PRODUTO_COLUMNS} from produtos order by lower(nome) limit $1 offset $2`, [safePageSize, offset]),
    query<{ count: string }>('select count(*) from produtos'),
  ]);

  const data: MarmitaAdminListItem[] = rows.map((row) => {
    const produto = toMarmita(row);
    return {
      id: produto.id,
      nome: produto.nome,
      categoria_id: produto.categoria_id,
      preco: produto.preco,
      estoque: produto.estoque,
      disponivel: produto.disponivel,
      imagem_url: produto.imagem_url,
      created_at: produto.created_at,
    };
  });

  return { data, count: Number(count) };
}

async function getProdutoRow(id: string) {
  const [row] = await query<ProdutoRow>(`select ${PRODUTO_COLUMNS} from produtos where id = $1`, [id]);

  if (!row) {
    throw new ApiError(404, 'Produto não encontrado.');
  }

  return row;
}

export async function getProduto(id: string) {
  return toMarmita(await getProdutoRow(id));
}

export async function createProduto(input: z.infer<typeof produtoCreateSchema>) {
  const id = newProdutoId(input.nome);
  let image: { url: string | null; key: string | null } = { url: input.imagem_url?.trim() || null, key: null };

  if (input.imagem_url && isDataImageUrl(input.imagem_url)) {
    image = await putProductImage(input.imagem_url, id);
  }

  try {
    await query(
      `insert into produtos (id, categoria_id, nome, descricao, preco, estoque, disponivel, imagem_url, imagem_key, tamanhos)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
        id,
        input.categoria_id ?? null,
        input.nome,
        input.descricao || null,
        input.preco,
        input.estoque,
        input.disponivel,
        image.url,
        image.key,
        JSON.stringify(input.tamanhos),
      ]
    );
  } catch (error) {
    await deleteProductImage(image.key);
    throw error;
  }

  return { id };
}

export async function updateProduto(id: string, input: z.infer<typeof produtoUpdateSchema>) {
  const current = await getProdutoRow(id);
  const { imagem_url: imagemInput, descricao, ...rest } = input;
  const fields: Record<string, unknown> = { ...rest, descricao: descricao === undefined ? undefined : descricao || null };

  // Foto: data URL = upload novo; null/'' = remover; mesma URL = manter.
  let uploadedKey: string | null = null;
  let staleKey: string | null = null;

  if (imagemInput !== undefined && imagemInput !== current.imagem_url) {
    if (imagemInput && isDataImageUrl(imagemInput)) {
      const uploaded = await putProductImage(imagemInput, id);
      uploadedKey = uploaded.key;
      fields.imagem_url = uploaded.url;
      fields.imagem_key = uploaded.key;
    } else {
      fields.imagem_url = imagemInput?.trim() || null;
      fields.imagem_key = null;
    }

    staleKey = current.imagem_key;
  }

  const { sets, values } = buildUpdate(fields, { tamanhos: '::jsonb' });

  if (sets.length > 0) {
    try {
      await query(`update produtos set ${sets.join(', ')}, updated_at = now() where id = $${values.length + 1}`, [...values, id]);
    } catch (error) {
      await deleteProductImage(uploadedKey);
      throw error;
    }
  }

  await deleteProductImage(staleKey);
  return { id };
}

export async function updateProdutoEstoque(id: string, estoque: number) {
  const disponivel = estoque > 0;
  const rows = await query<{ id: string }>(
    'update produtos set estoque = $1, disponivel = $2, updated_at = now() where id = $3 returning id',
    [estoque, disponivel, id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Produto não encontrado.');
  }

  return { id, estoque, disponivel };
}

export async function deleteProduto(id: string) {
  const [row] = await query<{ imagem_key: string | null }>('delete from produtos where id = $1 returning imagem_key', [id]);

  if (!row) {
    throw new ApiError(404, 'Produto não encontrado.');
  }

  await deleteProductImage(row.imagem_key);
  return { id };
}

// --- Categorias (admin) ---

export async function listCategorias() {
  const rows = await query<CategoriaRow>('select id, nome, ordem, ativo, created_at from categorias order by ordem nulls last, nome');
  return rows.map(toCategoria);
}

export async function createCategoria(input: z.infer<typeof categoriaCreateSchema>) {
  const baseId = slugify(input.id || input.nome) || 'categoria';
  const existing = new Set(
    (await query<{ id: string }>('select id from categorias where id = $1 or id like $2', [baseId, `${baseId}-%`])).map((row) => row.id)
  );

  let id = baseId;
  for (let suffix = 2; existing.has(id); suffix += 1) {
    id = `${baseId}-${suffix}`;
  }

  const [{ next_ordem }] = await query<{ next_ordem: number }>('select coalesce(max(ordem), 0) + 1 as next_ordem from categorias');

  await query('insert into categorias (id, nome, ordem, ativo) values ($1, $2, $3, $4)', [
    id,
    input.nome,
    input.ordem ?? next_ordem,
    input.ativo ?? true,
  ]);

  return { id };
}

export async function updateCategoria(id: string, input: z.infer<typeof categoriaUpdateSchema>) {
  const { sets, values } = buildUpdate(input);

  if (sets.length === 0) {
    return { id };
  }

  const rows = await query<{ id: string }>(`update categorias set ${sets.join(', ')} where id = $${values.length + 1} returning id`, [
    ...values,
    id,
  ]);

  if (rows.length === 0) {
    throw new ApiError(404, 'Categoria não encontrada.');
  }

  return { id };
}

// Os produtos da categoria ficam "sem categoria" (FK on delete set null).
export async function deleteCategoria(id: string) {
  const rows = await query<{ id: string }>('delete from categorias where id = $1 returning id', [id]);

  if (rows.length === 0) {
    throw new ApiError(404, 'Categoria não encontrada.');
  }

  return { id };
}

// --- Configurações do site ---

export async function getConfiguracoes() {
  const [row] = await query<ConfiguracoesRow>('select * from configuracoes_site where id = 1');

  if (!row) {
    throw new ApiError(500, 'Configurações do site não encontradas. Rode npm run db:seed.');
  }

  return toConfiguracoes(row);
}

export async function saveConfiguracoes(input: z.infer<typeof configuracoesSaveSchema>) {
  const { sets, values } = buildUpdate(input);

  if (sets.length > 0) {
    await query(`update configuracoes_site set ${sets.join(', ')}, updated_at = now() where id = 1`, values);
  }

  return getConfiguracoes();
}
