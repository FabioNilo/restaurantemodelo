-- Pagamento em dinheiro (com valor recebido e troco) e venda no balcão.
-- Dinheiro existe só no caixa (fechar conta da mesa e venda no balcão); o site e a baixa de
-- delivery/retirada seguem só com Pix, Débito e Crédito.

-- Venda lançada pela equipe direto no painel, sem mesa e sem cliente cadastrado.
-- Paga na hora: nasce 'paga' junto com os pagamentos. Cancelar só muda o status (o histórico fica).
create table if not exists vendas_balcao (
  id             uuid primary key default gen_random_uuid(),
  numero         bigint generated always as identity unique,
  nome           text,
  observacoes    text,
  -- Mesmo formato dos pedidos de mesa e delivery; preços calculados no servidor a partir do cardápio.
  itens          jsonb not null,
  valor_total    numeric(10, 2) not null check (valor_total > 0),
  status         text not null default 'paga' check (status in ('paga', 'cancelada')),
  registrado_por uuid references usuarios_admin(id) on delete set null,
  created_at     timestamptz not null default now(),
  cancelada_em   timestamptz
);

create index if not exists vendas_balcao_created_at_idx on vendas_balcao (created_at);

-- "pagamentos" passa a aceitar canal 'balcao', método 'dinheiro' e o par valor recebido / troco.
-- As regras antigas (nomes gerados automaticamente) são recriadas todas de uma vez.
do $$
declare
  c record;
begin
  for c in select conname from pg_constraint where conrelid = 'pagamentos'::regclass and contype = 'c' loop
    execute format('alter table pagamentos drop constraint %I', c.conname);
  end loop;
end
$$;

alter table pagamentos add column if not exists venda_balcao_id uuid references vendas_balcao(id) on delete restrict;
-- valor = parte da venda quitada nesta forma (é o que conta como receita). Em dinheiro,
-- valor_recebido é o que o cliente entregou e troco = valor_recebido - valor.
alter table pagamentos add column if not exists valor_recebido numeric(10, 2);
alter table pagamentos add column if not exists troco numeric(10, 2);

alter table pagamentos add constraint pagamentos_valor_positivo check (valor > 0);
alter table pagamentos add constraint pagamentos_canal_check check (canal in ('mesa', 'delivery', 'balcao'));
alter table pagamentos add constraint pagamentos_metodo_check check (metodo in ('pix', 'cartao_debito', 'cartao_credito', 'dinheiro'));
alter table pagamentos add constraint pagamentos_origem_check check (
  (canal = 'mesa' and conta_id is not null and pedido_delivery_id is null and venda_balcao_id is null)
  or (canal = 'delivery' and pedido_delivery_id is not null and conta_id is null and venda_balcao_id is null)
  or (canal = 'balcao' and venda_balcao_id is not null and conta_id is null and pedido_delivery_id is null)
);
alter table pagamentos add constraint pagamentos_dinheiro_check check (
  (metodo = 'dinheiro' and valor_recebido is not null and troco is not null and valor_recebido >= valor and troco = valor_recebido - valor)
  or (metodo <> 'dinheiro' and valor_recebido is null and troco is null)
);

create index if not exists pagamentos_venda_balcao_idx on pagamentos (venda_balcao_id);
