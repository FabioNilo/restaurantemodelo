import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { buscarBairroAtivo } from './bairros.js';
import { query } from './db.js';
import { ApiError } from './http.js';
import { carregarItensPrecificados, money, type ItemPedidoMesa } from './mesas.js';
import { formaPagamentoSchema, fromCents, toCents } from './pagamentos.js';

// Pedidos de delivery: o site registra o pedido (preços do cardápio, calculados
// aqui) e continua abrindo o WhatsApp. A equipe acompanha em /admin/delivery e,
// ao entregar, confirma a forma de pagamento — só então entra no caixa.

export const STATUS_DELIVERY = ['recebido', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado'] as const;
export const MAX_PEDIDOS_POR_TELEFONE = 5; // a cada 10 minutos

// Corpo enviado pelo CartModal (PedidoCreateRequest). Preços vindos do
// navegador são ignorados: só produto, opção e quantidade importam.
export const pedidoDeliverySchema = z.object({
  itens: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        tamanho_codigo: z.string().trim().max(80).nullish(),
        quantidade: z.coerce.number().int().min(1).max(50),
      })
    )
    .min(1, 'O pedido está vazio.')
    .max(40, 'Pedido grande demais. Divida em dois pedidos.'),
  nome_cliente: z.string().trim().min(2, 'Informe seu nome.').max(80),
  telefone_cliente: z.string().trim().min(8, 'Informe um telefone válido.').max(30),
  endereco_cliente: z.string().trim().min(3, 'Informe o endereço.').max(200),
  bairro_cliente: z.string().trim().min(2, 'Escolha o bairro.').max(80),
  complemento_cliente: z.string().trim().max(200).nullish(),
  observacoes_cliente: z.string().trim().max(500).nullish(),
  forma_pagamento: formaPagamentoSchema.default('pix'),
  tracking_base_url: z.string().url().max(300).optional(),
});

export const statusDeliverySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['recebido', 'em_preparo', 'saiu_entrega', 'cancelado']),
});

export const entregarSchema = z.object({
  id: z.string().uuid(),
  metodo: formaPagamentoSchema,
  taxa_entrega: z.coerce.number().min(0).max(1000).nullish(),
});

interface DeliveryRow {
  id: string;
  numero: string | number;
  tracking_token: string;
  nome: string;
  telefone: string;
  endereco: string;
  bairro: string;
  complemento: string | null;
  observacoes: string | null;
  itens: ItemPedidoMesa[];
  subtotal: string | number;
  taxa_entrega: string | number | null;
  valor_total: string | number;
  forma_pagamento: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  entregue_em: string | Date | null;
}

const COLUNAS =
  'id, numero, tracking_token, nome, telefone, endereco, bairro, complemento, observacoes, itens, subtotal, taxa_entrega, valor_total, forma_pagamento, status, created_at, updated_at, entregue_em';

const somenteDigitos = (value: string) => value.replace(/\D/g, '');

function toDelivery(row: DeliveryRow) {
  return {
    id: row.id,
    numero: Number(row.numero),
    nome: row.nome,
    telefone: row.telefone,
    endereco: row.endereco,
    bairro: row.bairro,
    complemento: row.complemento,
    observacoes: row.observacoes,
    itens: row.itens,
    subtotal: money(row.subtotal),
    taxa_entrega: row.taxa_entrega === null ? null : money(row.taxa_entrega),
    valor_total: money(row.valor_total),
    forma_pagamento: row.forma_pagamento,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    entregue_em: row.entregue_em ? new Date(row.entregue_em).toISOString() : null,
  };
}

// --- Público (site) ---

export async function criarPedidoDelivery(input: z.infer<typeof pedidoDeliverySchema>) {
  const telefone = somenteDigitos(input.telefone_cliente);

  if (telefone.length < 10) {
    throw new ApiError(400, 'Informe o telefone com DDD.');
  }

  const [{ recentes }] = await query<{ recentes: number }>(
    "select count(*)::int as recentes from pedidos_delivery where telefone = $1 and created_at > now() - interval '10 minutes'",
    [telefone]
  );

  if (recentes >= MAX_PEDIDOS_POR_TELEFONE) {
    throw new ApiError(429, 'Muitos pedidos em sequência. Aguarde alguns minutos ou fale conosco pelo WhatsApp.');
  }

  // Só bairros cadastrados e ativos; a taxa vem do cadastro, nunca do navegador.
  const bairro = await buscarBairroAtivo(input.bairro_cliente);

  if (!bairro) {
    throw new ApiError(400, 'Ainda não entregamos neste bairro. Escolha um bairro da lista.');
  }

  // O id do item no carrinho é "produto" ou "produto:opcao".
  const { itens, total } = await carregarItensPrecificados(
    input.itens.map((item) => ({
      produto_id: item.id.split(':')[0],
      tamanho_codigo: item.tamanho_codigo ?? null,
      quantidade: item.quantidade,
    }))
  );

  const token = randomBytes(18).toString('base64url');
  const [row] = await query<DeliveryRow>(
    `insert into pedidos_delivery
       (tracking_token, nome, telefone, endereco, bairro, bairro_id, complemento, observacoes, itens,
        subtotal, taxa_entrega, valor_total, forma_pagamento)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13)
     returning ${COLUNAS}`,
    [
      token,
      input.nome_cliente,
      telefone,
      input.endereco_cliente,
      bairro.nome,
      bairro.id,
      input.complemento_cliente || null,
      input.observacoes_cliente || null,
      JSON.stringify(itens),
      total,
      bairro.taxa,
      fromCents(toCents(total) + toCents(bairro.taxa)),
      input.forma_pagamento,
    ]
  );

  const base = input.tracking_base_url?.replace(/\/$/, '');
  return {
    id: row.id,
    status: row.status,
    subtotal: money(row.subtotal),
    taxa_entrega: bairro.taxa,
    valor_total: money(row.valor_total),
    created_at: new Date(row.created_at).toISOString(),
    tracking_token: token,
    ...(base ? { tracking_url: `${base}/${row.id}?token=${token}` } : {}),
  };
}

// Página de acompanhamento (/pedido/:id?token=...). Formato PedidoStatusResponse.
export async function getStatusPedidoDelivery(id: string, token: string) {
  const [row] = await query<DeliveryRow>(`select ${COLUNAS} from pedidos_delivery where id = $1 and tracking_token = $2`, [id, token]);

  if (!row) {
    throw new ApiError(404, 'Pedido não encontrado.');
  }

  const pedido = toDelivery(row);
  return {
    id: pedido.id,
    status: pedido.status,
    subtotal: pedido.subtotal,
    taxa_entrega: pedido.taxa_entrega,
    valor_total: pedido.valor_total,
    created_at: pedido.created_at,
    cancel_until: pedido.created_at,
    can_cancel: false,
    nome_cliente: pedido.nome,
    telefone_cliente: pedido.telefone,
    endereco_cliente: pedido.endereco,
    bairro_cliente: pedido.bairro,
    complemento_cliente: pedido.complemento,
    observacoes_cliente: pedido.observacoes,
    tipo_entrega: 'delivery',
    forma_pagamento: pedido.forma_pagamento,
    itens: pedido.itens.map((item) => ({
      nome: item.nome,
      quantidade: item.quantidade,
      preco: item.preco,
      tamanho_nome: item.tamanho_nome ?? undefined,
      tamanho_serve: item.tamanho_serve ?? undefined,
    })),
  };
}

// --- Admin (equipe) ---

// Abertos de qualquer dia + finalizados (entregues/cancelados) de hoje, no fuso da loja.
export async function listarDelivery() {
  const rows = await query<DeliveryRow>(
    `with cfg as (
       select coalesce((select timezone from configuracoes_site where id = 1), 'America/Bahia') as tz
     )
     select ${COLUNAS.split(', ').map((c) => `d.${c}`).join(', ')}
       from pedidos_delivery d, cfg
      where d.status in ('recebido', 'em_preparo', 'saiu_entrega')
         or d.updated_at >= (date_trunc('day', now() at time zone cfg.tz) at time zone cfg.tz)
      order by d.created_at desc
      limit 200`
  );

  return rows.map(toDelivery);
}

export async function atualizarStatusDelivery(input: z.infer<typeof statusDeliverySchema>) {
  const rows = await query<{ id: string }>(
    `update pedidos_delivery set status = $2, updated_at = now()
      where id = $1 and status not in ('entregue', 'cancelado')
      returning id`,
    [input.id, input.status]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Pedido não encontrado ou já finalizado.');
  }

  return { id: input.id, status: input.status };
}

// Baixa como entregue: confirma a forma de pagamento (e a taxa, se houver) e lança no caixa.
export async function entregarDelivery(input: z.infer<typeof entregarSchema>, usuarioId: string) {
  const [pedido] = await query<{ subtotal: string; taxa_entrega: string | null }>(
    "select subtotal, taxa_entrega from pedidos_delivery where id = $1 and status not in ('entregue', 'cancelado')",
    [input.id]
  );

  if (!pedido) {
    throw new ApiError(404, 'Pedido não encontrado ou já finalizado.');
  }

  const taxa = input.taxa_entrega ?? (pedido.taxa_entrega === null ? 0 : Number(pedido.taxa_entrega));
  const total = fromCents(toCents(Number(pedido.subtotal)) + toCents(taxa));

  const [entregue] = await query<{ id: string; valor_total: string }>(
    `with entregue as (
       update pedidos_delivery
          set status = 'entregue', entregue_em = now(), updated_at = now(),
              taxa_entrega = $3, valor_total = $4, forma_pagamento = $2
        where id = $1 and status not in ('entregue', 'cancelado')
        returning id, valor_total
     ), pago as (
       insert into pagamentos (canal, pedido_delivery_id, metodo, valor, registrado_por)
       select 'delivery', id, $2, valor_total, $5 from entregue where valor_total > 0
       returning id
     )
     select entregue.id, entregue.valor_total, (select count(*) from pago) as pagos from entregue`,
    [input.id, input.metodo, taxa, total, usuarioId]
  );

  if (!entregue) {
    throw new ApiError(409, 'Este pedido acabou de ser finalizado por outra pessoa.');
  }

  return { id: entregue.id, valor_total: money(entregue.valor_total) };
}
