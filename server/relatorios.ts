import { z } from 'zod';
import { query } from './db.js';
import { ApiError } from './http.js';
import { money, type ItemPedidoMesa } from './mesas.js';

// Caixa por período, métricas e desempenho. As regras puras (exportadas) são
// testadas; as consultas usam o fuso da loja (configuracoes_site.timezone).

const CFG = `cfg as (select coalesce((select timezone from configuracoes_site where id = 1), 'America/Bahia') as tz)`;
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');

// --- Caixa ---

export const periodoSchema = z
  .object({ de: dataSchema, ate: dataSchema })
  .refine((p) => p.de <= p.ate, 'A data inicial deve ser antes da final.')
  .refine((p) => diasEntre(p.de, p.ate) <= 366, 'Escolha um período de até 1 ano.');

export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000) + 1;
}

export interface Movimento {
  id: string;
  data: string; // horário local da loja, "YYYY-MM-DDTHH:mm:ss"
  canal: 'mesa' | 'delivery';
  referencia: string;
  cliente: string | null;
  metodo: string;
  valor: number;
}

export async function getMovimentosCaixa(periodo: z.infer<typeof periodoSchema>): Promise<Movimento[]> {
  const rows = await query<{ id: string; data: string; canal: 'mesa' | 'delivery'; referencia: string; cliente: string | null; metodo: string; valor: string }>(
    `with ${CFG}
     select p.id,
            to_char(p.created_at at time zone cfg.tz, 'YYYY-MM-DD"T"HH24:MI:SS') as data,
            p.canal,
            case when p.canal = 'mesa' then coalesce(m.nome, 'Mesa') else 'Delivery nº ' || d.numero end as referencia,
            case when p.canal = 'delivery' then d.nome end as cliente,
            p.metodo, p.valor
       from pagamentos p
       cross join cfg
       left join contas_mesa c on c.id = p.conta_id
       left join mesas m on m.id = c.mesa_id
       left join pedidos_delivery d on d.id = p.pedido_delivery_id
      where p.created_at >= (($1::date)::timestamp at time zone cfg.tz)
        and p.created_at < ((($2::date) + 1)::timestamp at time zone cfg.tz)
      order by p.created_at`,
    [periodo.de, periodo.ate]
  );

  return rows.map((row) => ({ ...row, valor: money(row.valor) }));
}

// --- Vendas (métricas e desempenho) ---

interface VendaRow {
  canal: 'mesa' | 'delivery';
  dia: string;
  status: string;
  valor: string | number;
  itens: ItemPedidoMesa[];
}

async function getVendas(desdeDias: number) {
  // Pedidos de mesa e delivery dos últimos `desdeDias` dias (inclui hoje), com o dia local.
  return query<VendaRow & { hoje: string }>(
    `with ${CFG}, base as (
       select (now() at time zone cfg.tz)::date as hoje, cfg.tz from cfg
     )
     select 'mesa' as canal, to_char(p.created_at at time zone base.tz, 'YYYY-MM-DD') as dia, p.status, p.valor_total as valor, p.itens,
            to_char(base.hoje, 'YYYY-MM-DD') as hoje
       from pedidos_mesa p, base
      where p.created_at >= ((base.hoje - ($1::int - 1))::timestamp at time zone base.tz)
     union all
     select 'delivery', to_char(d.created_at at time zone base.tz, 'YYYY-MM-DD'), d.status, d.valor_total, d.itens,
            to_char(base.hoje, 'YYYY-MM-DD')
       from pedidos_delivery d, base
      where d.created_at >= ((base.hoje - ($1::int - 1))::timestamp at time zone base.tz)`,
    [desdeDias]
  );
}

async function getHoje() {
  const [{ hoje }] = await query<{ hoje: string }>(`with ${CFG} select to_char((now() at time zone cfg.tz)::date, 'YYYY-MM-DD') as hoje from cfg`);
  return hoje;
}

export function addDias(data: string, dias: number) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

type Venda = { canal: 'mesa' | 'delivery'; dia: string; status: string; valor: number; itens: ItemPedidoMesa[] };

// Indicadores do período [inicio, fim] (datas locais), comparados ao período anterior de mesmo tamanho.
export function calcularMetricas(vendas: Venda[], hoje: string, dias: number) {
  const inicio = addDias(hoje, -(dias - 1));
  const inicioAnterior = addDias(inicio, -dias);
  const validas = vendas.filter((v) => v.status !== 'cancelado');
  const atual = validas.filter((v) => v.dia >= inicio && v.dia <= hoje);
  const anterior = validas.filter((v) => v.dia >= inicioAnterior && v.dia < inicio);
  const soma = (lista: Venda[]) => Math.round(lista.reduce((s, v) => s + Math.round(v.valor * 100), 0)) / 100;

  const vendasAtual = soma(atual);
  const vendasAnterior = soma(anterior);
  const ticket = atual.length ? Math.round((vendasAtual / atual.length) * 100) / 100 : 0;
  const ticketAnterior = anterior.length ? vendasAnterior / anterior.length : 0;

  const porDia = Array.from({ length: dias }, (_, i) => addDias(inicio, i)).map((dia) => {
    const doDia = atual.filter((v) => v.dia === dia);
    return { dia, vendas: soma(doDia), pedidos: doDia.length };
  });

  const produtos = new Map<string, number>();
  for (const venda of atual) {
    for (const item of venda.itens) produtos.set(item.nome, (produtos.get(item.nome) ?? 0) + item.quantidade);
  }

  return {
    periodo: { inicio, fim: hoje, dias },
    vendas: { valor: vendasAtual, variacao: variacao(vendasAtual, vendasAnterior) },
    pedidos: { valor: atual.length, variacao: variacao(atual.length, anterior.length) },
    ticket_medio: { valor: ticket, variacao: variacao(ticket, ticketAnterior) },
    cancelados: vendas.filter((v) => v.status === 'cancelado' && v.dia >= inicio && v.dia <= hoje).length,
    por_canal: {
      mesa: soma(atual.filter((v) => v.canal === 'mesa')),
      delivery: soma(atual.filter((v) => v.canal === 'delivery')),
    },
    por_dia: porDia,
    top_produtos: [...produtos.entries()]
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome))
      .slice(0, 8),
  };
}

export const metricasSchema = z.object({ dias: z.coerce.number().pipe(z.union([z.literal(1), z.literal(7), z.literal(30)])) });
export const desempenhoSchema = z.object({ dias: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])) });

export async function getMetricas(dias: number) {
  const [rows, hoje] = await Promise.all([getVendas(dias * 2), getHoje()]);
  return calcularMetricas(
    rows.map((r) => ({ ...r, valor: money(r.valor) })),
    hoje,
    dias
  );
}

// --- Ranking (porta de plataforma-restaurantes/lib/domain/ranking.ts) ---

export type SoldItem = { productId: string | null; name: string; quantity: number; unitPrice: number };
export type CatalogProduct = { id: string; name: string };

export type RankingRow = {
  key: string;
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
  share: number;
  avgPrice: number;
  prevQuantity: number;
  prevRevenue: number;
  revenueChange: number | null;
};

type Acc = { productId: string | null; name: string; quantity: number; cents: number };

function aggregate(items: SoldItem[]) {
  const map = new Map<string, Acc>();
  for (const i of items) {
    const key = i.productId ?? `nome:${i.name}`;
    const acc = map.get(key) ?? { productId: i.productId, name: i.name, quantity: 0, cents: 0 };
    acc.quantity += i.quantity;
    acc.cents += Math.round(i.unitPrice * 100) * i.quantity;
    map.set(key, acc);
  }
  return map;
}

// Ranking do período atual vs anterior. Produtos do cardápio sem venda entram com zero (pratos parados).
export function productRanking(current: SoldItem[], previous: SoldItem[], catalog: CatalogProduct[] = []): RankingRow[] {
  const now = aggregate(current);
  const before = aggregate(previous);
  const names = new Map(catalog.map((p) => [p.id, p.name]));
  for (const p of catalog) if (!now.has(p.id)) now.set(p.id, { productId: p.id, name: p.name, quantity: 0, cents: 0 });

  const totalCents = [...now.values()].reduce((s, a) => s + a.cents, 0);

  return [...now.entries()]
    .map(([key, a]) => {
      const prev = before.get(key);
      const prevCents = prev?.cents ?? 0;
      return {
        key,
        productId: a.productId,
        name: (a.productId && names.get(a.productId)) || a.name,
        quantity: a.quantity,
        revenue: a.cents / 100,
        share: totalCents ? Math.round((a.cents / totalCents) * 1000) / 10 : 0,
        avgPrice: a.quantity ? Math.round(a.cents / a.quantity) / 100 : 0,
        prevQuantity: prev?.quantity ?? 0,
        prevRevenue: prevCents / 100,
        revenueChange: prevCents ? Math.round(((a.cents - prevCents) / prevCents) * 1000) / 10 : null,
      };
    })
    .sort((x, y) => y.revenue - x.revenue || y.quantity - x.quantity || x.name.localeCompare(y.name));
}

export function topMovers(rows: RankingRow[], n = 3) {
  const comparable = rows.filter((r) => r.revenueChange !== null);
  return {
    up: comparable.filter((r) => r.revenueChange! > 0).sort((a, b) => b.revenueChange! - a.revenueChange!).slice(0, n),
    down: comparable.filter((r) => r.revenueChange! < 0).sort((a, b) => a.revenueChange! - b.revenueChange!).slice(0, n),
  };
}

const toSold = (vendas: Venda[]): SoldItem[] =>
  vendas.flatMap((v) => v.itens.map((i) => ({ productId: i.produto_id, name: i.nome, quantity: i.quantidade, unitPrice: Number(i.preco) })));

export async function getDesempenho(dias: number) {
  const [rows, hoje, catalogo] = await Promise.all([
    getVendas(dias * 2),
    getHoje(),
    query<{ id: string; nome: string }>('select id, nome from produtos where disponivel and estoque > 0'),
  ]);

  const inicio = addDias(hoje, -(dias - 1));
  const vendas = rows.filter((r) => r.status !== 'cancelado').map((r) => ({ ...r, valor: money(r.valor) }));
  const linhas = productRanking(
    toSold(vendas.filter((v) => v.dia >= inicio)),
    toSold(vendas.filter((v) => v.dia < inicio)),
    catalogo.map((p) => ({ id: p.id, name: p.nome }))
  );
  const vendidos = linhas.filter((r) => r.quantity > 0);

  return {
    periodo: { inicio, fim: hoje, dias },
    faturamento: Math.round(vendidos.reduce((s, r) => s + r.revenue * 100, 0)) / 100,
    itens_vendidos: vendidos.reduce((s, r) => s + r.quantity, 0),
    com_venda: vendidos.length,
    parados: linhas.filter((r) => r.quantity === 0).length,
    movers: topMovers(linhas),
    ranking: linhas,
  };
}

export function assertPeriodo(periodo: unknown) {
  const parsed = periodoSchema.safeParse(periodo);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Período inválido.');
  return parsed.data;
}
