-- Atendimento pelo WhatsApp (workflow do n8n "Nosso Bistrô / Atendimento WhatsApp").
-- O agente consulta o cardápio e monta o carrinho do cliente só por estas funções,
-- todas "security definer": o usuário do n8n (n8n_atendimento) recebe EXECUTE nelas
-- e mais nada, então não lê pedidos, pagamentos nem usuários do painel.
-- O pedido em si continua sendo registrado pela API (POST /api/massas/pedidos),
-- que recalcula os preços e valida o bairro.

create extension if not exists unaccent;

create schema if not exists atendimento;

-- Um carrinho por telefone (só dígitos, como vem do WhatsApp).
-- itens: [{ produto_id, tamanho_codigo, quantidade }]
create table if not exists atendimento.carrinhos (
  telefone    text primary key,
  itens       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Texto sem acento e em minúsculas, para a busca.
create or replace function atendimento.normalizar(texto text)
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select lower(public.unaccent(coalesce(texto, '')))
$$;

-- Loja aberta agora? Mesma regra de isDeliveryClosed (src/lib/site-settings.ts).
create or replace function atendimento.status_loja()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select c.*, (now() at time zone coalesce(nullif(c.timezone, ''), 'America/Bahia')) as agora
      from configuracoes_site c
     where c.id = 1
  ), calc as (
    select cfg.*,
           extract(dow from agora)::int as dia,
           (extract(hour from agora) * 60 + extract(minute from agora))::int as minutos,
           (extract(hour from hora_abertura) * 60 + extract(minute from hora_abertura))::int as abre,
           (extract(hour from hora_fechamento) * 60 + extract(minute from hora_fechamento))::int as fecha
      from cfg
  )
  select jsonb_build_object(
           'aberta_agora',
             entregas_ativas
             and dia = any (dias_entrega)
             and case when fecha >= abre then minutos between abre and fecha
                      else minutos >= abre or minutos <= fecha end,
           'horario', to_char(hora_abertura, 'HH24:MI') || ' às ' || to_char(hora_fechamento, 'HH24:MI'),
           'dias_entrega', dias_entrega,
           'mensagem_fechado', coalesce(nullif(mensagem_fechado, ''), 'Estamos fechados para o delivery agora.'),
           'whatsapp_equipe', whatsapp_numero
         )
    from calc
$$;

create or replace function atendimento.bairros()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('bairro', nome, 'taxa', taxa) order by nome), '[]'::jsonb)
    from bairros
   where ativo
$$;

create or replace function atendimento.categorias()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('categoria', c.nome, 'produtos', x.qtd) order by c.ordem nulls last, c.nome), '[]'::jsonb)
    from categorias c
    join lateral (
      select count(*)::int as qtd
        from produtos p
       where p.categoria_id = c.id and p.disponivel and p.estoque > 0
    ) x on x.qtd > 0
   where c.ativo
$$;

-- Produtos à venda (disponível e com estoque), filtrando por termo e/ou categoria.
create or replace function atendimento.buscar_cardapio(termo text default '', categoria text default '', limite int default 15)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtro as (
    select atendimento.normalizar(trim(termo)) as t,
           atendimento.normalizar(trim(categoria)) as c,
           least(greatest(coalesce(limite, 15), 1), 40) as lim
  ), achados as (
    select p.id, p.nome, p.descricao, p.preco, p.tamanhos, cat.nome as categoria, cat.ordem
      from produtos p
      left join categorias cat on cat.id = p.categoria_id
      cross join filtro f
     where p.disponivel
       and p.estoque > 0
       and (cat.id is null or cat.ativo)
       and (f.c = '' or atendimento.normalizar(cat.nome) like '%' || f.c || '%')
       and (
         f.t = ''
         or atendimento.normalizar(p.nome || ' ' || coalesce(p.descricao, '') || ' ' || coalesce(cat.nome, '')) like '%' || f.t || '%'
         or exists (
           select 1 from jsonb_array_elements(p.tamanhos) o
            where atendimento.normalizar(o->>'nome') like '%' || f.t || '%'
         )
       )
  )
  select jsonb_build_object(
           'total_encontrado', (select count(*) from achados),
           'produtos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'produto_id', a.id,
                      'nome', a.nome,
                      'descricao', a.descricao,
                      'categoria', a.categoria,
                      'preco', a.preco,
                      'opcoes', (
                        select coalesce(jsonb_agg(jsonb_build_object(
                                 'tamanho_codigo', o->>'codigo',
                                 'nome', o->>'nome',
                                 'detalhe', nullif(o->>'serve', ''),
                                 'preco', (o->>'preco')::numeric)), '[]'::jsonb)
                          from jsonb_array_elements(a.tamanhos) o)
                    ) order by a.ordem nulls last, a.categoria, a.nome)
               from (select * from achados order by ordem nulls last, categoria, nome limit (select lim from filtro)) a
           ), '[]'::jsonb)
         )
$$;

-- Carrinho com preços atuais do cardápio. Itens que saíram do cardápio vêm marcados.
create or replace function atendimento.ver_carrinho(p_telefone text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with itens as (
    select i.ord,
           i.item->>'produto_id' as produto_id,
           nullif(i.item->>'tamanho_codigo', '') as tamanho_codigo,
           (i.item->>'quantidade')::int as quantidade,
           p.nome,
           (p.id is not null and p.disponivel and p.estoque > 0) as disponivel,
           o.opcao
      from atendimento.carrinhos c
      cross join lateral jsonb_array_elements(c.itens) with ordinality as i(item, ord)
      left join produtos p on p.id = i.item->>'produto_id'
      left join lateral (
        select x as opcao
          from jsonb_array_elements(coalesce(p.tamanhos, '[]'::jsonb)) x
         where x->>'codigo' = i.item->>'tamanho_codigo'
         limit 1
      ) o on true
     where c.telefone = regexp_replace(p_telefone, '\D', '', 'g')
  ), precificados as (
    select *,
           coalesce((opcao->>'preco')::numeric, (select preco from produtos where id = itens.produto_id)) as preco_unitario
      from itens
  )
  select jsonb_build_object(
           'itens', coalesce(jsonb_agg(jsonb_build_object(
                      'produto_id', produto_id,
                      'tamanho_codigo', tamanho_codigo,
                      'nome', coalesce(nome, produto_id) || coalesce(' (' || (opcao->>'nome') || ')', ''),
                      'quantidade', quantidade,
                      'preco_unitario', preco_unitario,
                      'total_item', round(preco_unitario * quantidade, 2),
                      'disponivel', disponivel
                    ) order by ord), '[]'::jsonb),
           'quantidade_itens', coalesce(sum(quantidade), 0),
           'subtotal', coalesce(round(sum(preco_unitario * quantidade) filter (where disponivel), 2), 0),
           'tem_item_indisponivel', coalesce(bool_or(not disponivel), false)
         )
    from precificados
$$;

-- Adiciona (ou soma) um item. Valida produto, estoque e opção como a API faz.
create or replace function atendimento.adicionar_item(p_telefone text, p_produto_id text, p_tamanho_codigo text, p_quantidade int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_prod produtos%rowtype;
  v_codigo text := nullif(trim(coalesce(p_tamanho_codigo, '')), '');
  v_itens jsonb;
  v_qtd int := coalesce(p_quantidade, 1);
begin
  if length(v_tel) < 10 then
    return jsonb_build_object('ok', false, 'erro', 'Telefone do cliente inválido.');
  end if;
  if v_qtd < 1 or v_qtd > 50 then
    return jsonb_build_object('ok', false, 'erro', 'A quantidade deve ser de 1 a 50.');
  end if;

  select * into v_prod from produtos where id = trim(p_produto_id);
  if not found or not v_prod.disponivel or v_prod.estoque <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado ou indisponível. Use buscar_cardapio para achar o produto_id certo.');
  end if;

  if jsonb_array_length(v_prod.tamanhos) > 0 then
    if v_codigo is null then
      return jsonb_build_object('ok', false, 'erro', 'Este produto tem opções; pergunte qual o cliente quer.',
        'opcoes', (select jsonb_agg(jsonb_build_object('tamanho_codigo', o->>'codigo', 'nome', o->>'nome', 'preco', (o->>'preco')::numeric))
                     from jsonb_array_elements(v_prod.tamanhos) o));
    end if;
    if not exists (select 1 from jsonb_array_elements(v_prod.tamanhos) o where o->>'codigo' = v_codigo) then
      return jsonb_build_object('ok', false, 'erro', 'Opção inexistente para este produto.',
        'opcoes', (select jsonb_agg(jsonb_build_object('tamanho_codigo', o->>'codigo', 'nome', o->>'nome', 'preco', (o->>'preco')::numeric))
                     from jsonb_array_elements(v_prod.tamanhos) o));
    end if;
  else
    v_codigo := null;
  end if;

  insert into atendimento.carrinhos (telefone) values (v_tel) on conflict (telefone) do nothing;
  select itens into v_itens from atendimento.carrinhos where telefone = v_tel for update;

  if exists (select 1 from jsonb_array_elements(v_itens) i
              where i->>'produto_id' = v_prod.id and coalesce(i->>'tamanho_codigo', '') = coalesce(v_codigo, '')) then
    select jsonb_agg(case
             when i->>'produto_id' = v_prod.id and coalesce(i->>'tamanho_codigo', '') = coalesce(v_codigo, '')
               then jsonb_set(i, '{quantidade}', to_jsonb(least((i->>'quantidade')::int + v_qtd, 50)))
             else i end order by ord)
      into v_itens
      from jsonb_array_elements(v_itens) with ordinality as t(i, ord);
  else
    if jsonb_array_length(v_itens) >= 40 then
      return jsonb_build_object('ok', false, 'erro', 'O carrinho já tem 40 itens diferentes, o máximo por pedido.');
    end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('produto_id', v_prod.id, 'tamanho_codigo', v_codigo, 'quantidade', v_qtd));
  end if;

  update atendimento.carrinhos set itens = v_itens, updated_at = now() where telefone = v_tel;
  return jsonb_build_object('ok', true, 'carrinho', atendimento.ver_carrinho(v_tel));
end
$$;

-- Tira um item (p_quantidade nula ou 0 = tira tudo daquele item).
create or replace function atendimento.remover_item(p_telefone text, p_produto_id text, p_tamanho_codigo text, p_quantidade int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_codigo text := nullif(trim(coalesce(p_tamanho_codigo, '')), '');
  v_itens jsonb;
begin
  select itens into v_itens from atendimento.carrinhos where telefone = v_tel for update;

  if v_itens is null or not exists (
    select 1 from jsonb_array_elements(v_itens) i
     where i->>'produto_id' = trim(p_produto_id) and (v_codigo is null or i->>'tamanho_codigo' = v_codigo)
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Este item não está no carrinho.', 'carrinho', atendimento.ver_carrinho(v_tel));
  end if;

  select coalesce(jsonb_agg(novo order by ord) filter (where novo is not null), '[]'::jsonb)
    into v_itens
    from (
      select ord,
             case
               when i->>'produto_id' = trim(p_produto_id) and (v_codigo is null or i->>'tamanho_codigo' = v_codigo) then
                 case when coalesce(p_quantidade, 0) > 0 and (i->>'quantidade')::int > p_quantidade
                      then jsonb_set(i, '{quantidade}', to_jsonb((i->>'quantidade')::int - p_quantidade))
                      else null end
               else i
             end as novo
        from jsonb_array_elements(v_itens) with ordinality as t(i, ord)
    ) x;

  update atendimento.carrinhos set itens = v_itens, updated_at = now() where telefone = v_tel;
  return jsonb_build_object('ok', true, 'carrinho', atendimento.ver_carrinho(v_tel));
end
$$;

create or replace function atendimento.limpar_carrinho(p_telefone text)
returns jsonb
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  delete from atendimento.carrinhos where telefone = regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  select jsonb_build_object('ok', true);
$$;

-- Tudo o que o agente precisa no início de cada mensagem. Carrinho parado há
-- mais de 12 h é descartado (o cliente voltou outro dia).
create or replace function atendimento.contexto(p_telefone text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  delete from atendimento.carrinhos where telefone = v_tel and updated_at < now() - interval '12 hours';
  return jsonb_build_object(
    'loja', atendimento.status_loja(),
    'bairros', atendimento.bairros(),
    'carrinho', atendimento.ver_carrinho(v_tel)
  );
end
$$;

-- Corpo "itens" do POST /api/massas/pedidos (só itens ainda à venda).
create or replace function atendimento.itens_para_pedido(p_telefone text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i->>'produto_id',
           'tamanho_codigo', nullif(i->>'tamanho_codigo', ''),
           'quantidade', (i->>'quantidade')::int) order by ord), '[]'::jsonb)
    from atendimento.carrinhos c
    cross join lateral jsonb_array_elements(c.itens) with ordinality as t(i, ord)
    join produtos p on p.id = i->>'produto_id' and p.disponivel and p.estoque > 0
   where c.telefone = regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')
$$;

-- Ninguém além do dono chama as funções, exceto o usuário do n8n (se existir neste branch).
revoke all on schema atendimento from public;
revoke all on all functions in schema atendimento from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'n8n_atendimento') then
    grant usage on schema atendimento to n8n_atendimento;
    grant execute on all functions in schema atendimento to n8n_atendimento;
  end if;
end
$$;
