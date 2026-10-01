-- Delivery registrado no sistema + pagamentos como fonte única do caixa.
-- Formas de pagamento aceitas em todo o site: pix, cartao_debito, cartao_credito.

create table if not exists pedidos_delivery (
  id              uuid primary key default gen_random_uuid(),
  numero          bigint generated always as identity unique,
  -- Para a página de acompanhamento (/pedido/:id?token=...), enviada no WhatsApp.
  tracking_token  text not null unique,
  nome            text not null,
  telefone        text not null,
  endereco        text not null,
  bairro          text not null,
  complemento     text,
  observacoes     text,
  -- [{ produto_id, nome, tamanho_codigo, tamanho_nome, tamanho_serve, preco, quantidade }]
  -- Preços calculados no servidor a partir do cardápio.
  itens           jsonb not null,
  subtotal        numeric(10, 2) not null check (subtotal >= 0),
  -- Nula = "a combinar"; definida pela equipe ao dar baixa como entregue.
  taxa_entrega    numeric(10, 2) check (taxa_entrega >= 0),
  valor_total     numeric(10, 2) not null check (valor_total >= 0),
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao_debito', 'cartao_credito')),
  status          text not null default 'recebido'
                  check (status in ('recebido', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  entregue_em     timestamptz
);

create index if not exists pedidos_delivery_status_idx on pedidos_delivery (status, created_at);
create index if not exists pedidos_delivery_telefone_idx on pedidos_delivery (telefone, created_at);

-- Cada valor recebido: uma conta de mesa pode ter vários (pagamento dividido);
-- um delivery tem um. O caixa e o Excel saem só daqui.
create table if not exists pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  canal               text not null check (canal in ('mesa', 'delivery')),
  conta_id            uuid references contas_mesa(id) on delete restrict,
  pedido_delivery_id  uuid references pedidos_delivery(id) on delete restrict,
  metodo              text not null check (metodo in ('pix', 'cartao_debito', 'cartao_credito')),
  valor               numeric(10, 2) not null check (valor > 0),
  registrado_por      uuid references usuarios_admin(id) on delete set null,
  created_at          timestamptz not null default now(),
  check (
    (canal = 'mesa' and conta_id is not null and pedido_delivery_id is null)
    or (canal = 'delivery' and pedido_delivery_id is not null and conta_id is null)
  )
);

create index if not exists pagamentos_created_at_idx on pagamentos (created_at);
create index if not exists pagamentos_conta_id_idx on pagamentos (conta_id);

-- A forma de pagamento da conta passa a morar em "pagamentos" (pode ser dividida).
-- A coluna antiga fica como legado, sem a regra que aceitava dinheiro.
alter table contas_mesa drop constraint if exists contas_mesa_forma_pagamento_check;

-- Contas já fechadas com Pix/Débito/Crédito entram no caixa novo.
insert into pagamentos (canal, conta_id, metodo, valor, registrado_por, created_at)
select 'mesa', c.id, c.forma_pagamento, c.valor_total, c.fechada_por, c.fechada_em
  from contas_mesa c
 where c.status = 'fechada'
   and c.forma_pagamento in ('pix', 'cartao_debito', 'cartao_credito')
   and c.valor_total > 0
   and not exists (select 1 from pagamentos p where p.conta_id = c.id);
