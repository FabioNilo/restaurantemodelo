-- Retirada no balcão (pedido pelo site) + notificações push do painel.

-- Pedido de retirada: sem endereço, bairro nem taxa. Divide a fila e o número com o delivery.
alter table pedidos_delivery add column if not exists tipo text not null default 'entrega'
  check (tipo in ('entrega', 'retirada'));
alter table pedidos_delivery alter column endereco drop not null;
alter table pedidos_delivery alter column bairro drop not null;

-- Interruptor da retirada no balcão (Configurações). Começa desligado: o admin liga quando quiser.
-- O horário e os dias são os mesmos do delivery.
alter table configuracoes_site add column if not exists retirada_ativa boolean not null default false;

-- Aparelhos que ativaram as notificações do painel. Um usuário pode ter vários (celular, tablet, PC).
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios_admin(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_usuario_idx on push_subscriptions (usuario_id);
