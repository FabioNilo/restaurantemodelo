-- Pedidos de mesa passam por confirmação do atendente (protege contra pedidos de quem
-- não está no local) e o bistrô não tem cozinha: o fluxo vira
--   pendente (aguardando confirmação) -> novo (recebido/confirmado) -> entregue | cancelado.
-- 'em_preparo' deixa de ser usado; pedidos que estavam nele viram 'novo'.

alter table pedidos_mesa drop constraint if exists pedidos_mesa_status_check;
update pedidos_mesa set status = 'novo' where status = 'em_preparo';
alter table pedidos_mesa
  add constraint pedidos_mesa_status_check check (status in ('pendente', 'novo', 'em_preparo', 'entregue', 'cancelado'));
alter table pedidos_mesa alter column status set default 'pendente';

-- Contato de quem pediu, para o atendente confirmar com a pessoa. Só aparece no painel.
alter table pedidos_mesa add column if not exists telefone_cliente text;
