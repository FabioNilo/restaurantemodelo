import { z } from 'zod';
import { query } from './db.js';
import { ApiError } from './http.js';
import { carregarItensPrecificados, itensPedidoSchema, money, type ItemPedidoMesa } from './mesas.js';
import { erroFechamento, fromCents, pagamentoSchema, toCents, trocoTotal } from './pagamentos.js';

// Venda no balcão: a equipe lança os itens direto no painel, sem mesa e sem cliente cadastrado,
// e recebe na hora (Pix, Débito, Crédito ou Dinheiro, podendo dividir). Entra direto no Caixa.
// Como nos pedidos de mesa e delivery, o preço de cada item vem sempre do cardápio, aqui no servidor.

export const vendaBalcaoSchema = z.object({
  itens: itensPedidoSchema,
  nome: z.string().trim().max(60).nullish(),
  observacoes: z.string().trim().max(300).nullish(),
  pagamentos: z.array(pagamentoSchema).min(1, 'Informe a forma de pagamento.').max(5, 'No máximo 5 pagamentos por venda.'),
});

export const cancelarVendaBalcaoSchema = z.object({ id: z.string().uuid() });

interface PagamentoVenda {
  metodo: string;
  valor: number;
  valor_recebido: number | null;
  troco: number | null;
}

interface VendaRow {
  id: string;
  numero: string | number;
  nome: string | null;
  observacoes: string | null;
  itens: ItemPedidoMesa[];
  valor_total: string | number;
  status: string;
  created_at: string | Date;
  pagamentos: PagamentoVenda[];
}

function toVenda(row: VendaRow) {
  return {
    id: row.id,
    numero: Number(row.numero),
    nome: row.nome,
    observacoes: row.observacoes,
    itens: row.itens,
    valor_total: money(row.valor_total),
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
    pagamentos: row.pagamentos.map((p) => ({
      metodo: p.metodo,
      valor: money(p.valor),
      valor_recebido: p.valor_recebido == null ? null : money(p.valor_recebido),
      troco: p.troco == null ? null : money(p.troco),
    })),
  };
}

export async function registrarVendaBalcao(input: z.infer<typeof vendaBalcaoSchema>, usuarioId: string) {
  const { itens, total } = await carregarItensPrecificados(input.itens);
  const erro = erroFechamento({ total, pagamentos: input.pagamentos, pedidosEmAndamento: 0 });

  if (erro) {
    throw new ApiError(400, erro);
  }

  const pagamentos = input.pagamentos.map((p) => ({
    metodo: p.metodo,
    valor: fromCents(toCents(p.valor)),
    valor_recebido: p.valor_recebido,
    troco: p.troco,
  }));

  // Um só comando: a venda e os pagamentos entram juntos ou nenhum dos dois.
  const [venda] = await query<{ id: string; numero: string; valor_total: string; created_at: string | Date }>(
    `with venda as (
       insert into vendas_balcao (nome, observacoes, itens, valor_total, registrado_por)
       values ($1, $2, $3::jsonb, $4, $5)
       returning id, numero, valor_total, created_at
     ), pagos as (
       insert into pagamentos (canal, venda_balcao_id, metodo, valor, valor_recebido, troco, registrado_por)
       select 'balcao', venda.id, pg.metodo, pg.valor, pg.valor_recebido, pg.troco, $5
         from venda, jsonb_to_recordset($6::jsonb) as pg(metodo text, valor numeric, valor_recebido numeric, troco numeric)
       returning id
     )
     select venda.id, venda.numero, venda.valor_total, venda.created_at, (select count(*) from pagos) as pagamentos from venda`,
    [input.nome || null, input.observacoes || null, JSON.stringify(itens), total, usuarioId, JSON.stringify(pagamentos)]
  );

  if (!venda) {
    throw new ApiError(503, 'Não foi possível registrar a venda agora. Tente de novo.');
  }

  return {
    id: venda.id,
    numero: Number(venda.numero),
    valor_total: money(venda.valor_total),
    troco: trocoTotal(pagamentos),
    created_at: new Date(venda.created_at).toISOString(),
    itens,
    pagamentos,
  };
}

// Vendas de hoje (fuso da loja), da mais recente para a mais antiga, com os pagamentos de cada uma.
export async function listarVendasBalcao() {
  const rows = await query<VendaRow>(
    `with cfg as (
       select coalesce((select timezone from configuracoes_site where id = 1), 'America/Bahia') as tz
     )
     select v.id, v.numero, v.nome, v.observacoes, v.itens, v.valor_total, v.status, v.created_at,
            coalesce(json_agg(json_build_object('metodo', p.metodo, 'valor', p.valor, 'valor_recebido', p.valor_recebido, 'troco', p.troco) order by p.created_at)
                     filter (where p.id is not null), '[]') as pagamentos
       from vendas_balcao v
       cross join cfg
       left join pagamentos p on p.venda_balcao_id = v.id
      where v.created_at >= (date_trunc('day', now() at time zone cfg.tz) at time zone cfg.tz)
      group by v.id
      order by v.created_at desc
      limit 100`
  );

  return rows.map(toVenda);
}

// Cancelar não apaga nada: a venda e os pagamentos ficam no histórico, mas saem do Caixa e das métricas.
export async function cancelarVendaBalcao(id: string) {
  const rows = await query<{ id: string }>(
    "update vendas_balcao set status = 'cancelada', cancelada_em = now() where id = $1 and status = 'paga' returning id",
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Venda não encontrada ou já cancelada.');
  }

  return { id };
}
