-- Bairros atendidos pelo delivery, com taxa única por bairro.
-- Só bairros ativos aparecem no carrinho; fora da lista o site não aceita o pedido.

create table if not exists bairros (
  id          serial primary key,
  nome        text not null,
  taxa        numeric(10, 2) not null check (taxa >= 0),
  -- "Pausar bairro": some do carrinho sem apagar o cadastro (chuva, sem motoboy...).
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Mesmo nome com maiúsculas/minúsculas diferentes conta como repetido.
create unique index if not exists bairros_nome_unico on bairros (lower(nome));

-- O pedido guarda o bairro escolhido (o nome e a taxa ficam copiados no pedido,
-- então apagar ou mudar a taxa do bairro depois não altera pedidos antigos).
alter table pedidos_delivery add column if not exists bairro_id integer references bairros(id) on delete set null;
