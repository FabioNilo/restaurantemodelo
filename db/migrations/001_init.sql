-- Schema inicial do Nosso Bistrô Café (cardápio, configurações e login do admin).
-- Aplicado por scripts/db-migrate.ts; cada arquivo roda uma única vez (tabela schema_migrations).

create table if not exists categorias (
  id          text primary key,
  nome        text not null,
  ordem       integer,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists produtos (
  id            text primary key,
  categoria_id  text references categorias(id) on update cascade on delete set null,
  nome          text not null,
  descricao     text,
  preco         numeric(10, 2) not null check (preco >= 0),
  estoque       integer not null default 0 check (estoque >= 0),
  disponivel    boolean not null default true,
  -- URL pública no bucket "produtos" do Neon Object Storage, e a chave do objeto
  -- (para apagar a foto antiga quando for trocada ou o produto excluído).
  imagem_url    text,
  imagem_key    text,
  -- Opções/sabores/tamanhos: [{ codigo, nome, serve, preco }] (ProdutoTamanho no front).
  tamanhos      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists produtos_categoria_id_idx on produtos (categoria_id);

create table if not exists configuracoes_site (
  id                integer primary key default 1 check (id = 1),
  whatsapp_numero   text not null,
  entregas_ativas   boolean not null default true,
  hora_abertura     time not null,
  hora_fechamento   time not null,
  dias_entrega      integer[] not null default '{0,1,2,3,4,5,6}',
  mensagem_fechado  text not null default '',
  timezone          text not null default 'America/Bahia',
  updated_at        timestamptz not null default now()
);

create table if not exists usuarios_admin (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique,
  password_hash  text not null,
  name           text,
  role           text not null default 'admin' check (role in ('admin', 'gestor')),
  -- Incrementado ao trocar a senha: invalida todos os tokens emitidos antes.
  token_version  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
