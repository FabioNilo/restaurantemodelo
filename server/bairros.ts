import { z } from 'zod';
import { query } from './db.js';
import { ApiError } from './http.js';
import { money } from './mesas.js';

// Bairros atendidos pelo delivery, com taxa única. Cadastrados em
// /admin/configuracoes; o carrinho só oferece os ativos (fora da lista, o
// site não aceita o pedido). "Pausar" = ativo false, sem perder o cadastro.

interface BairroRow {
  id: number;
  nome: string;
  taxa: string | number;
  ativo: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

const COLUNAS = 'id, nome, taxa, ativo, created_at, updated_at';

const nomeSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome do bairro.')
  .max(80, 'Nome do bairro muito longo.')
  .transform((nome) => nome.replace(/\s+/g, ' '));
const taxaSchema = z.coerce.number().min(0, 'A taxa não pode ser negativa.').max(1000, 'Taxa alta demais.');

export const criarBairroSchema = z.object({ nome: nomeSchema, taxa: taxaSchema, ativo: z.boolean().default(true) });
export const atualizarBairroSchema = z.object({
  id: z.coerce.number().int().positive(),
  nome: nomeSchema.optional(),
  taxa: taxaSchema.optional(),
  ativo: z.boolean().optional(),
});
export const excluirBairroSchema = z.object({ id: z.coerce.number().int().positive() });

function toBairro(row: BairroRow) {
  return {
    id: row.id,
    nome: row.nome,
    taxa: money(row.taxa),
    ativo: row.ativo,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export type Bairro = ReturnType<typeof toBairro>;

function nomeRepetido(error: unknown) {
  return (error as { code?: string })?.code === '23505';
}

// --- Público (carrinho) ---

// Formato DeliveryZone que o carrinho já consome (taxa única repetida nos campos antigos).
export async function listarZonasEntrega() {
  const rows = await query<BairroRow>(`select ${COLUNAS} from bairros where ativo order by lower(nome)`);
  return rows.map((row) => {
    const taxa = money(row.taxa);
    return { id: row.id, bairro: row.nome, taxa, taxa_quinta_sexta: taxa, taxa_sab_dom_feriado: taxa, ativo: true };
  });
}

export async function buscarBairroAtivo(nome: string) {
  const [row] = await query<BairroRow>(`select ${COLUNAS} from bairros where lower(nome) = lower($1) and ativo`, [
    nome.trim().replace(/\s+/g, ' '),
  ]);
  return row ? toBairro(row) : null;
}

// Formato DeliveryFeeResponse.
export async function consultarTaxaEntrega(nome: string) {
  const bairro = await buscarBairroAtivo(nome);

  if (!bairro) {
    return {
      bairro: nome,
      taxa: null,
      encontrado: false,
      entrega_disponivel: false,
      motivo_indisponivel: 'Ainda não entregamos neste bairro.',
    };
  }

  return { bairro: bairro.nome, taxa: bairro.taxa, encontrado: true, entrega_disponivel: true, motivo_indisponivel: null };
}

// --- Admin ---

export async function listarBairros() {
  const rows = await query<BairroRow>(`select ${COLUNAS} from bairros order by lower(nome)`);
  return rows.map(toBairro);
}

export async function criarBairro(input: z.infer<typeof criarBairroSchema>) {
  try {
    const [row] = await query<BairroRow>(
      `insert into bairros (nome, taxa, ativo) values ($1, $2, $3) returning ${COLUNAS}`,
      [input.nome, input.taxa, input.ativo]
    );
    return toBairro(row);
  } catch (error) {
    if (nomeRepetido(error)) throw new ApiError(409, 'Este bairro já está cadastrado.');
    throw error;
  }
}

export async function atualizarBairro(input: z.infer<typeof atualizarBairroSchema>) {
  try {
    const [row] = await query<BairroRow>(
      `update bairros
          set nome = coalesce($2, nome), taxa = coalesce($3, taxa), ativo = coalesce($4, ativo), updated_at = now()
        where id = $1
        returning ${COLUNAS}`,
      [input.id, input.nome ?? null, input.taxa ?? null, input.ativo ?? null]
    );

    if (!row) throw new ApiError(404, 'Bairro não encontrado.');
    return toBairro(row);
  } catch (error) {
    if (nomeRepetido(error)) throw new ApiError(409, 'Já existe outro bairro com este nome.');
    throw error;
  }
}

// Pedidos antigos guardam nome e taxa copiados, então excluir não os altera.
export async function excluirBairro(input: z.infer<typeof excluirBairroSchema>) {
  const rows = await query<{ id: number }>('delete from bairros where id = $1 returning id', [input.id]);
  if (rows.length === 0) throw new ApiError(404, 'Bairro não encontrado.');
  return { id: input.id };
}
