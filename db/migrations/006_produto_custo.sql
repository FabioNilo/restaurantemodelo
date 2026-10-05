-- Custo do produto (opcional): base do lucro/margem exibidos no admin e na planilha de estoque.
-- Nunca é exposto no catálogo público.
alter table produtos add column if not exists custo numeric(10, 2) check (custo is null or custo >= 0);
