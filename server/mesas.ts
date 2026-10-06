import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { ProdutoTamanho } from '../src/types/product.js';
import { query } from './db.js';
import { ApiError } from './http.js';
import { erroFechamento, fromCents, pagamentoSchema, toCents } from './pagamentos.js';

// Pedidos pela mesa (QR code). O cliente só manda produto, opção e quantidade;
// nome e preço de cada item são sempre lidos do cardápio aqui no servidor.

export const MAX_PEDIDOS_POR_MINUTO = 6;

// pendente = aguardando o atendente confirmar; novo = recebido (confirmado); sem cozinha, não há "em preparo".
// 'em_preparo' só existe em dados antigos (a migration 007 converte para 'novo').
export const STATUS_PEDIDO = ['pendente', 'novo', 'entregue', 'cancelado'] as const;
// O atendente só confirma, entrega ou cancela: pedido nunca volta a "pendente".
const STATUS_ATUALIZAVEIS = ['novo', 'entregue', 'cancelado'] as const;
// Pedido pendente ainda não vale na conta: só entra no total depois de confirmado.
// De quais status cada mudança é permitida (confirmar -> entregar; cancelar só antes de entregar).
const STATUS_ANTERIORES: Record<(typeof STATUS_ATUALIZAVEIS)[number], string[]> = {
  novo: ['pendente'],
  entregue: ['novo', 'em_preparo'],
  cancelado: ['pendente', 'novo', 'em_preparo'],
};
const FORA_DO_TOTAL = ['cancelado', 'pendente'];
const contaNoTotal = (status: string) => !FORA_DO_TOTAL.includes(status);
const emAndamento = (status: string) => status === 'pendente' || status === 'novo' || status === 'em_preparo';

export interface ItemPedidoMesa {
  produto_id: string;
  nome: string;
  tamanho_codigo: string | null;
  tamanho_nome: string | null;
  tamanho_serve: string | null;
  preco: number;
  quantidade: number;
}

interface MesaRow {
  id: number;
  numero: number;
  nome: string;
  token: string;
  ativa: boolean;
  created_at: string | Date;
}

// --- Validação ---

const itensPedidoSchema = z
  .array(
    z.object({
      produto_id: z.string().trim().min(1).max(120),
      tamanho_codigo: z.string().trim().max(80).nullish(),
      quantidade: z.coerce.number().int().min(1).max(50),
    })
  )
  .min(1, 'O pedido está vazio.')
  .max(40, 'Pedido grande demais. Divida em dois pedidos.');

export const pedidoMesaSchema = z.object({
  // Nome e telefone são obrigatórios: o atendente confirma o pedido com quem pediu.
  nome_cliente: z.string().trim().min(2, 'Informe seu nome.').max(60),
  telefone_cliente: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length >= 10 && value.length <= 11, 'Informe um telefone válido com DDD.'),
  observacoes: z.string().trim().max(300).nullish(),
  itens: itensPedidoSchema,
});

// Pedido lançado pelo atendente no painel: sem telefone e com nome opcional.
export const pedidoAtendenteSchema = z.object({
  token: z.string().trim().min(1).max(200),
  nome_cliente: z.string().trim().max(60).nullish(),
  observacoes: z.string().trim().max(300).nullish(),
  itens: itensPedidoSchema,
});

export const mesaCreateSchema = z.object({
  numero: z.coerce.number().int().min(1).max(9999),
  nome: z.string().trim().max(60).optional(),
});

export const mesaUpdateSchema = z.object({
  nome: z.string().trim().min(1).max(60).optional(),
  ativa: z.boolean().optional(),
});

export const statusPedidoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUS_ATUALIZAVEIS),
});

// Um ou mais pagamentos (Pix/Débito/Crédito) que somam exatamente o total da conta.
export const fecharContaSchema = z.object({
  id: z.string().uuid(),
  pagamentos: z.array(pagamentoSchema).min(1, 'Informe a forma de pagamento.').max(5, 'No máximo 5 pagamentos por conta.'),
});

// --- Helpers ---

export function novoTokenMesa() {
  return randomBytes(16).toString('base64url');
}

export const money = (value: unknown) => Math.round(Number(value) * 100) / 100;

export interface ProdutoPrecoRow {
  id: string;
  nome: string;
  preco: string | number;
  estoque: number;
  disponivel: boolean;
  tamanhos: ProdutoTamanho[] | null;
}

// Monta os itens com nome e preço do cardápio. Exportada para teste.
export function precificarItens(
  pedidos: z.infer<typeof pedidoMesaSchema>['itens'],
  produtos: ProdutoPrecoRow[]
): { itens: ItemPedidoMesa[]; total: number } {
  const porId = new Map(produtos.map((produto) => [produto.id, produto]));

  const itens = pedidos.map((pedido) => {
    const produto = porId.get(pedido.produto_id);

    if (!produto || !produto.disponivel || produto.estoque <= 0) {
      throw new ApiError(400, `${produto?.nome ?? 'Um dos itens'} não está disponível agora. Atualize o cardápio e tente de novo.`);
    }

    const opcoes = produto.tamanhos ?? [];
    let opcao: ProdutoTamanho | undefined;

    if (opcoes.length > 0) {
      opcao = opcoes.find((item) => item.codigo === pedido.tamanho_codigo) ?? (pedido.tamanho_codigo ? undefined : opcoes[0]);

      if (!opcao) {
        throw new ApiError(400, `A opção escolhida de ${produto.nome} não existe mais. Atualize o cardápio e tente de novo.`);
      }
    }

    return {
      produto_id: produto.id,
      nome: produto.nome,
      tamanho_codigo: opcao?.codigo ?? null,
      tamanho_nome: opcao?.nome ?? null,
      tamanho_serve: opcao?.serve || null,
      preco: money(opcao?.preco ?? produto.preco),
      quantidade: pedido.quantidade,
    };
  });

  const total = money(itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0));
  return { itens, total };
}

// Busca os produtos do pedido e devolve itens e total com preços do cardápio.
export async function carregarItensPrecificados(pedidos: z.infer<typeof pedidoMesaSchema>['itens']) {
  const ids = [...new Set(pedidos.map((item) => item.produto_id))];
  const produtos = await query<ProdutoPrecoRow>(
    'select id, nome, preco, estoque, disponivel, tamanhos from produtos where id = any($1)',
    [ids]
  );
  return precificarItens(pedidos, produtos);
}

async function getMesaPorToken(token: string) {
  const [mesa] = await query<MesaRow>('select id, numero, nome, token, ativa, created_at from mesas where token = $1', [token]);

  if (!mesa) {
    throw new ApiError(404, 'Mesa não encontrada. Peça ajuda no caixa.');
  }

  return mesa;
}

// --- Rotas públicas (cliente na mesa) ---

export async function getMesaPublica(token: string) {
  const mesa = await getMesaPorToken(token);

  const pedidos = await query<{ numero: string; status: string; itens: ItemPedidoMesa[]; valor_total: string; created_at: string | Date }>(
    `select p.numero, p.status, p.itens, p.valor_total, p.created_at
       from pedidos_mesa p
       join contas_mesa c on c.id = p.conta_id
      where c.mesa_id = $1 and c.status = 'aberta'
      order by p.created_at`,
    [mesa.id]
  );

  const lista = pedidos.map((pedido) => ({
    numero: Number(pedido.numero),
    status: pedido.status,
    itens: pedido.itens,
    valor_total: money(pedido.valor_total),
    created_at: new Date(pedido.created_at).toISOString(),
  }));

  return {
    mesa: { numero: mesa.numero, nome: mesa.nome, ativa: mesa.ativa },
    conta:
      lista.length > 0
        ? { pedidos: lista, total: money(lista.filter((p) => contaNoTotal(p.status)).reduce((s, p) => s + p.valor_total, 0)) }
        : null,
  };
}

interface NovoPedidoMesa {
  nome_cliente?: string | null;
  telefone_cliente?: string | null;
  observacoes?: string | null;
  itens: z.infer<typeof itensPedidoSchema>;
}

// 'cliente' (QR code): entra pendente, até o atendente confirmar. 'atendente' (painel,
// já autenticado): entra confirmado, pois quem lança é a própria equipe.
export async function criarPedidoMesa(token: string, input: NovoPedidoMesa, origem: 'cliente' | 'atendente' = 'cliente') {
  const mesa = await getMesaPorToken(token);

  if (!mesa.ativa) {
    throw new ApiError(409, 'Esta mesa não está recebendo pedidos agora. Faça seu pedido no caixa.');
  }

  const [{ recentes }] = await query<{ recentes: number }>(
    "select count(*)::int as recentes from pedidos_mesa where mesa_id = $1 and created_at > now() - interval '1 minute'",
    [mesa.id]
  );

  if (recentes >= MAX_PEDIDOS_POR_MINUTO) {
    throw new ApiError(429, 'Muitos pedidos em sequência. Aguarde um minuto e tente de novo.');
  }

  const { itens, total } = await carregarItensPrecificados(input.itens);

  // Um só comando: abre a conta da mesa se não houver uma aberta (o índice
  // parcial impede duas) e insere o pedido nela.
  const inserir = () =>
    query<{ numero: string; status: string; valor_total: string }>(
      `with nova as (
         insert into contas_mesa (mesa_id) values ($1)
         on conflict (mesa_id) where status = 'aberta' do nothing
         returning id
       ), conta as (
         select id from nova
         union all
         select id from contas_mesa where mesa_id = $1 and status = 'aberta'
         limit 1
       )
       insert into pedidos_mesa (conta_id, mesa_id, nome_cliente, telefone_cliente, observacoes, itens, valor_total, status)
       select id, $1, $2, $6, $3, $4::jsonb, $5, $7 from conta
       returning numero, status, valor_total`,
      [mesa.id, input.nome_cliente || null, input.observacoes || null, JSON.stringify(itens), total, input.telefone_cliente || null, origem === 'atendente' ? 'novo' : 'pendente']
    );

  // Se outro pedido da mesma mesa abriu a conta no mesmo instante, a primeira
  // tentativa não enxerga a conta nova (snapshot do comando); a segunda já enxerga.
  let [pedido] = await inserir();

  if (!pedido) {
    [pedido] = await inserir();
  }

  if (!pedido) {
    throw new ApiError(503, 'Não foi possível registrar o pedido agora. Tente de novo.');
  }

  return { numero: Number(pedido.numero), status: pedido.status, valor_total: money(pedido.valor_total) };
}

// --- Admin / caixa ---

export async function listarMesas() {
  const rows = await query<
    MesaRow & { total: string; pedidos: number; novos: number; em_andamento: number; conta_id: string | null; aberta_em: string | Date | null; ids_novos: string[] | null }
  >(
    `select m.id, m.numero, m.nome, m.token, m.ativa, m.created_at, c.id as conta_id, c.aberta_em,
            coalesce(sum(p.valor_total) filter (where p.status not in ('cancelado', 'pendente')), 0) as total,
            count(p.id)::int as pedidos,
            count(p.id) filter (where p.status = 'pendente')::int as novos,
            count(p.id) filter (where p.status in ('pendente', 'novo', 'em_preparo'))::int as em_andamento,
            array_agg(p.id::text) filter (where p.status = 'pendente') as ids_novos
       from mesas m
       left join contas_mesa c on c.mesa_id = m.id and c.status = 'aberta'
       left join pedidos_mesa p on p.conta_id = c.id
      group by m.id, c.id
      order by m.numero`
  );

  return rows.map((row) => ({
    id: row.id,
    numero: row.numero,
    nome: row.nome,
    token: row.token,
    ativa: row.ativa,
    conta_id: row.conta_id,
    aberta_em: row.aberta_em ? new Date(row.aberta_em).toISOString() : null,
    total: money(row.total),
    pedidos: row.pedidos,
    novos: row.novos,
    em_andamento: row.em_andamento,
    ids_novos: row.ids_novos ?? [],
  }));
}

interface PedidoMesaRow {
  id: string;
  numero: string | number;
  status: string;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  observacoes: string | null;
  itens: ItemPedidoMesa[];
  valor_total: string | number;
  created_at: string | Date;
}

function toPedidoMesa(row: PedidoMesaRow) {
  return {
    id: row.id,
    numero: Number(row.numero),
    status: row.status,
    nome_cliente: row.nome_cliente,
    telefone_cliente: row.telefone_cliente,
    observacoes: row.observacoes,
    itens: row.itens,
    valor_total: money(row.valor_total),
    created_at: new Date(row.created_at).toISOString(),
  };
}

const somaPedidos = (pedidos: Array<{ status: string; valor_total: number }>) =>
  fromCents(pedidos.filter((p) => contaNoTotal(p.status)).reduce((soma, p) => soma + toCents(p.valor_total), 0));

// Comanda da mesa: conta aberta com os pedidos e as últimas contas fechadas.
export async function getDetalheMesa(id: number) {
  const [mesa] = await query<MesaRow>('select id, numero, nome, token, ativa, created_at from mesas where id = $1', [id]);

  if (!mesa) {
    throw new ApiError(404, 'Mesa não encontrada.');
  }

  const [[conta], fechadas] = await Promise.all([
    query<{ id: string; aberta_em: string | Date }>("select id, aberta_em from contas_mesa where mesa_id = $1 and status = 'aberta'", [id]),
    query<{
      id: string;
      aberta_em: string | Date;
      fechada_em: string | Date;
      valor_total: string;
      pagamentos: Array<{ metodo: string; valor: number }>;
    }>(
      `select c.id, c.aberta_em, c.fechada_em, c.valor_total,
              coalesce(json_agg(json_build_object('metodo', p.metodo, 'valor', p.valor) order by p.created_at)
                       filter (where p.id is not null), '[]') as pagamentos
         from contas_mesa c
         left join pagamentos p on p.conta_id = c.id
        where c.mesa_id = $1 and c.status = 'fechada'
        group by c.id
        order by c.fechada_em desc
        limit 5`,
      [id]
    ),
  ]);

  const pedidos = conta
    ? (
        await query<PedidoMesaRow>(
          `select id, numero, status, nome_cliente, telefone_cliente, observacoes, itens, valor_total, created_at
             from pedidos_mesa where conta_id = $1 order by created_at`,
          [conta.id]
        )
      ).map(toPedidoMesa)
    : [];

  return {
    mesa: { id: mesa.id, numero: mesa.numero, nome: mesa.nome, token: mesa.token, ativa: mesa.ativa },
    conta: conta
      ? {
          id: conta.id,
          aberta_em: new Date(conta.aberta_em).toISOString(),
          pedidos,
          total: somaPedidos(pedidos),
          em_andamento: pedidos.filter((p) => emAndamento(p.status)).length,
        }
      : null,
    fechadas: fechadas.map((c) => ({
      id: c.id,
      aberta_em: new Date(c.aberta_em).toISOString(),
      fechada_em: new Date(c.fechada_em).toISOString(),
      valor_total: money(c.valor_total),
      pagamentos: c.pagamentos.map((p) => ({ metodo: p.metodo, valor: money(p.valor) })),
    })),
  };
}

export async function criarMesa(input: z.infer<typeof mesaCreateSchema>) {
  const [existente] = await query<{ id: number }>('select id from mesas where numero = $1', [input.numero]);

  if (existente) {
    throw new ApiError(409, `A mesa ${input.numero} já existe.`);
  }

  const [mesa] = await query<{ id: number }>('insert into mesas (numero, nome, token) values ($1, $2, $3) returning id', [
    input.numero,
    input.nome || `Mesa ${input.numero}`,
    novoTokenMesa(),
  ]);

  return { id: mesa.id };
}

export async function atualizarMesa(id: number, input: z.infer<typeof mesaUpdateSchema>) {
  const rows = await query<{ id: number }>(
    'update mesas set nome = coalesce($2, nome), ativa = coalesce($3, ativa) where id = $1 returning id',
    [id, input.nome ?? null, input.ativa ?? null]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Mesa não encontrada.');
  }

  return { id };
}

export async function regenerarTokenMesa(id: number) {
  const rows = await query<{ id: number }>('update mesas set token = $2 where id = $1 returning id', [id, novoTokenMesa()]);

  if (rows.length === 0) {
    throw new ApiError(404, 'Mesa não encontrada.');
  }

  return { id };
}

export async function excluirMesa(id: number) {
  const [{ contas }] = await query<{ contas: number }>('select count(*)::int as contas from contas_mesa where mesa_id = $1', [id]);

  if (contas > 0) {
    throw new ApiError(409, 'Esta mesa já tem histórico de pedidos. Desative-a em vez de excluir.');
  }

  const rows = await query<{ id: number }>('delete from mesas where id = $1 returning id', [id]);

  if (rows.length === 0) {
    throw new ApiError(404, 'Mesa não encontrada.');
  }

  return { id };
}

export async function getPainel() {
  const contas = await query<{
    id: string;
    aberta_em: string | Date;
    mesa_id: number;
    mesa_numero: number;
    mesa_nome: string;
    pedidos: Array<{
      id: string;
      numero: number;
      status: string;
      nome_cliente: string | null;
      telefone_cliente: string | null;
      observacoes: string | null;
      itens: ItemPedidoMesa[];
      valor_total: number;
      created_at: string;
    }>;
  }>(
    `select c.id, c.aberta_em, m.id as mesa_id, m.numero as mesa_numero, m.nome as mesa_nome,
            coalesce(
              json_agg(
                json_build_object(
                  'id', p.id, 'numero', p.numero, 'status', p.status, 'nome_cliente', p.nome_cliente, 'telefone_cliente', p.telefone_cliente,
                  'observacoes', p.observacoes, 'itens', p.itens, 'valor_total', p.valor_total, 'created_at', p.created_at
                ) order by p.created_at
              ) filter (where p.id is not null),
              '[]'
            ) as pedidos
       from contas_mesa c
       join mesas m on m.id = c.mesa_id
       left join pedidos_mesa p on p.conta_id = c.id
      where c.status = 'aberta'
      group by c.id, m.id
      order by m.numero`
  );

  // "Hoje" no fuso configurado da loja (America/Bahia por padrão).
  const resumo = await query<{ forma_pagamento: string; contas: number; total: string }>(
    `with cfg as (
       select coalesce((select timezone from configuracoes_site where id = 1), 'America/Bahia') as tz
     )
     select p.metodo as forma_pagamento, count(distinct p.conta_id)::int as contas, coalesce(sum(p.valor), 0) as total
       from pagamentos p, cfg
      where p.canal = 'mesa'
        and p.created_at >= (date_trunc('day', now() at time zone cfg.tz) at time zone cfg.tz)
      group by p.metodo`
  );

  return {
    contas: contas.map((conta) => {
      const pedidos = conta.pedidos.map((pedido) => ({ ...pedido, numero: Number(pedido.numero), valor_total: money(pedido.valor_total) }));
      return {
        id: conta.id,
        aberta_em: new Date(conta.aberta_em).toISOString(),
        mesa: { id: conta.mesa_id, numero: conta.mesa_numero, nome: conta.mesa_nome },
        pedidos,
        total: money(pedidos.filter((p) => contaNoTotal(p.status)).reduce((s, p) => s + p.valor_total, 0)),
      };
    }),
    hoje: {
      contas: resumo.reduce((soma, linha) => soma + linha.contas, 0),
      total: money(resumo.reduce((soma, linha) => soma + Number(linha.total), 0)),
      por_forma: Object.fromEntries(resumo.map((linha) => [linha.forma_pagamento, money(linha.total)])),
    },
  };
}

export async function atualizarStatusPedido(input: z.infer<typeof statusPedidoSchema>) {
  const rows = await query<{ id: string }>(
    `update pedidos_mesa p set status = $2, updated_at = now()
       from contas_mesa c
      where p.id = $1 and c.id = p.conta_id and c.status = 'aberta' and p.status = any($3::text[])
      returning p.id`,
    [input.id, input.status, STATUS_ANTERIORES[input.status]]
  );

  if (rows.length === 0) {
    throw new ApiError(409, 'Pedido não encontrado, conta já fechada ou o status dele já mudou. Atualize a tela.');
  }

  return { id: input.id, status: input.status };
}

export async function fecharConta(input: z.infer<typeof fecharContaSchema>, usuarioId: string) {
  const [conta] = await query<{ id: string }>("select id from contas_mesa where id = $1 and status = 'aberta'", [input.id]);

  if (!conta) {
    throw new ApiError(404, 'Conta não encontrada ou já fechada.');
  }

  const pedidos = (
    await query<{ status: string; valor_total: string }>('select status, valor_total from pedidos_mesa where conta_id = $1', [input.id])
  ).map((p) => ({ status: p.status, valor_total: money(p.valor_total) }));
  const total = somaPedidos(pedidos);
  const erro = erroFechamento({
    total,
    pagamentos: input.pagamentos,
    pedidosEmAndamento: pedidos.filter((p) => emAndamento(p.status)).length,
  });

  if (erro) {
    throw new ApiError(400, erro);
  }

  // Um só comando: fecha a conta só se continuar aberta, sem pedido em
  // andamento e com o mesmo total (nenhum pedido entrou nesse meio-tempo),
  // e grava os pagamentos.
  const [fechada] = await query<{ id: string; valor_total: string }>(
    `with total_atual as (
       select coalesce(sum(valor_total) filter (where status not in ('cancelado', 'pendente')), 0) as valor
         from pedidos_mesa where conta_id = $1
     ), fechada as (
       update contas_mesa c
          set status = 'fechada', fechada_em = now(), fechada_por = $2, valor_total = $3, forma_pagamento = $4
        where c.id = $1 and c.status = 'aberta'
          and (select valor from total_atual) = $3::numeric
          and not exists (select 1 from pedidos_mesa p where p.conta_id = $1 and p.status in ('pendente', 'novo', 'em_preparo'))
        returning c.id, c.valor_total
     ), pagos as (
       insert into pagamentos (canal, conta_id, metodo, valor, registrado_por)
       select 'mesa', fechada.id, pg.metodo, pg.valor, $2
         from fechada, jsonb_to_recordset($5::jsonb) as pg(metodo text, valor numeric)
       returning id
     )
     select fechada.id, fechada.valor_total, (select count(*) from pagos) as pagamentos from fechada`,
    [
      input.id,
      usuarioId,
      total,
      input.pagamentos.length === 1 ? input.pagamentos[0].metodo : 'dividido',
      JSON.stringify(input.pagamentos.map((p) => ({ metodo: p.metodo, valor: fromCents(toCents(p.valor)) }))),
    ]
  );

  if (!fechada) {
    throw new ApiError(409, 'A conta mudou enquanto você fechava (entrou ou mudou um pedido). Confira de novo.');
  }

  return { id: fechada.id, valor_total: money(fechada.valor_total) };
}

export async function cancelarConta(id: string) {
  const rows = await query<{ id: string }>(
    "update contas_mesa set status = 'cancelada', fechada_em = now(), valor_total = 0 where id = $1 and status = 'aberta' returning id",
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Conta não encontrada ou já fechada.');
  }

  return { id };
}
