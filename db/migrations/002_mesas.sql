-- Pedidos pela mesa (QR code): mesas, conta aberta por mesa e pedidos da conta.

create table if not exists mesas (
  id          serial primary key,
  numero      integer not null unique check (numero > 0),
  nome        text not null,
  -- Vai no QR code (/mesa/<token>). Aleatório para ninguém pedir em nome de
  -- outra mesa trocando um número na URL; regenerável pelo admin.
  token       text not null unique,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists contas_mesa (
  id               uuid primary key default gen_random_uuid(),
  mesa_id          integer not null references mesas(id) on delete restrict,
  status           text not null default 'aberta' check (status in ('aberta', 'fechada', 'cancelada')),
  aberta_em        timestamptz not null default now(),
  fechada_em       timestamptz,
  forma_pagamento  text check (forma_pagamento in ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito')),
  valor_total      numeric(10, 2),
  fechada_por      uuid references usuarios_admin(id) on delete set null
);

-- No máximo uma conta aberta por mesa, mesmo com dois pedidos chegando juntos.
create unique index if not exists contas_mesa_uma_aberta_por_mesa on contas_mesa (mesa_id) where status = 'aberta';
create index if not exists contas_mesa_fechada_em_idx on contas_mesa (fechada_em) where status = 'fechada';

create table if not exists pedidos_mesa (
  id            uuid primary key default gen_random_uuid(),
  -- Número curto para o cupom e para chamar o cliente ("pedido 12").
  numero        bigint generated always as identity unique,
  conta_id      uuid not null references contas_mesa(id) on delete cascade,
  mesa_id       integer not null references mesas(id) on delete restrict,
  nome_cliente  text,
  observacoes   text,
  -- [{ produto_id, nome, tamanho_codigo, tamanho_nome, tamanho_serve, preco, quantidade }]
  -- Preços copiados do cardápio no momento do pedido (calculados no servidor).
  itens         jsonb not null,
  valor_total   numeric(10, 2) not null check (valor_total >= 0),
  status        text not null default 'novo' check (status in ('novo', 'em_preparo', 'entregue', 'cancelado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pedidos_mesa_conta_id_idx on pedidos_mesa (conta_id);
create index if not exists pedidos_mesa_mesa_created_idx on pedidos_mesa (mesa_id, created_at);
