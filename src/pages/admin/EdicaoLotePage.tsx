import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import { DecimalInput } from '@/components/admin/DecimalInput';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirmar } from '@/hooks/useConfirmar';
import { useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { calcularLucro } from '@/lib/estoque-lucro';
import { formatBRL } from '@/lib/pagamentos';
import { sortCategoriesByDisplayOrder } from '@/lib/product-category';
import { cn } from '@/lib/utils';
import { centavos, chaveCusto, chaveOpcao, chavePreco, montarAlteracoes, valoresOriginais } from '@/lib/edicao-lote';
import { MAX_PRODUTOS_LOTE, SEM_CATEGORIA } from '@/types/product';

function Margem({ preco, custo }: { preco: number; custo: number }) {
  const { lucro, margem } = calcularLucro(preco, custo > 0 ? custo : null);
  if (lucro === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('tabular-nums', lucro < 0 ? 'font-semibold text-destructive' : margem !== null && margem < 30 ? 'text-orange-700' : 'text-secondary')}>
      {formatBRL(lucro)} <span className="text-xs">({String(margem ?? 0).replace('.', ',')}%)</span>
    </span>
  );
}

// Edição de preço e custo de uma categoria inteira, até 25 produtos por página.
export default function EdicaoLotePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaParam = searchParams.get('cat') ?? '';
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1);
  const [rascunho, setRascunho] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);
  const { confirmar, dialogo } = useConfirmar();

  // Sem categoria escolhida ainda: lista nada até a pessoa escolher (ou usa a primeira).
  const { categorias, loading: carregandoCategorias, updateMarmitasLote } = useMarmitasAdmin(1);
  const ordenadas = useMemo(() => sortCategoriesByDisplayOrder(categorias), [categorias]);
  const categoriaId = categoriaParam || ordenadas[0]?.id || '';
  const lista = useMarmitasAdmin(pagina, { categoria_id: categoriaId || SEM_CATEGORIA }, MAX_PRODUTOS_LOTE);
  const produtos = lista.marmitas;
  const totalPaginas = Math.max(1, Math.ceil(lista.totalCount / MAX_PRODUTOS_LOTE));
  const originais = useMemo(() => valoresOriginais(produtos), [produtos]);
  const alteracoes = useMemo(() => montarAlteracoes(produtos, rascunho), [produtos, rascunho]);
  const qtdAlterados = Object.keys(rascunho).length;

  const invalidas = new Set(
    Object.entries(rascunho)
      .filter(([chave, valor]) => !chave.endsWith(':custo') && valor <= 0)
      .map(([chave]) => chave)
  );

  // Fechar a aba com alterações não salvas pede confirmação do navegador.
  useEffect(() => {
    if (qtdAlterados === 0) return;
    const avisar = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [qtdAlterados]);

  const valor = (chave: string) => rascunho[chave] ?? originais[chave] ?? 0;
  const alterar = (chave: string, novo: number) =>
    setRascunho((atual) => {
      const proximo = { ...atual };
      if (centavos(novo) === centavos(originais[chave] ?? 0)) delete proximo[chave];
      else proximo[chave] = novo;
      return proximo;
    });

  // Trocar categoria/página ou sair com alterações pendentes pede confirmação.
  const podeDescartar = async () =>
    qtdAlterados === 0 ||
    confirmar({ titulo: 'Descartar alterações?', descricao: `${qtdAlterados} valor(es) alterado(s) ainda não foram salvos.`, confirmar: 'Descartar', perigo: true });

  const irPara = async (mudancas: { cat?: string; pagina?: number }) => {
    if (!(await podeDescartar())) return;
    setRascunho({});
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        if (mudancas.cat !== undefined) {
          proximo.set('cat', mudancas.cat);
          proximo.delete('pagina');
        }
        if (mudancas.pagina !== undefined) {
          if (mudancas.pagina > 1) proximo.set('pagina', String(mudancas.pagina));
          else proximo.delete('pagina');
        }
        return proximo;
      },
      { replace: true }
    );
  };

  const voltar = async () => {
    if (await podeDescartar()) navigate(`/admin/cardapio${categoriaId ? `?cat=${encodeURIComponent(categoriaId)}` : ''}`);
  };

  const salvar = async () => {
    if (invalidas.size > 0) {
      toast({ title: 'Confira os preços', description: 'Preço de venda precisa ser maior que zero.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const result = await updateMarmitasLote(alteracoes);
    setSalvando(false);

    if (!result.success) {
      toast({ title: 'Nada foi salvo', description: getApiErrorMessage(result.error), variant: 'destructive' });
      return;
    }
    setRascunho({});
    toast({ title: `${result.atualizados} produto(s) atualizado(s)` });
  };

  const campo = (chave: string, rotulo: string, opcional = false) => (
    <DecimalInput
      value={valor(chave)}
      onValueChange={(novo) => alterar(chave, novo)}
      aria-label={rotulo}
      placeholder={opcional ? 'sem custo' : '0,00'}
      aria-invalid={invalidas.has(chave) || undefined}
      className={cn(
        'h-11 text-right tabular-nums sm:h-9',
        rascunho[chave] !== undefined && 'border-primary bg-primary/10',
        invalidas.has(chave) && 'border-destructive bg-destructive/10'
      )}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" onClick={voltar} className="mb-2 h-11 px-2 sm:h-9">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cardápio
        </Button>
        <h1 className="font-display text-3xl font-bold text-secondary sm:text-4xl">Edição em lote</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste custo e preço de venda da categoria inteira e salve tudo de uma vez. Até {MAX_PRODUTOS_LOTE} produtos por página; produtos com opções mostram o preço de cada opção.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={categoriaId} onValueChange={(cat) => irPara({ cat })} disabled={carregandoCategorias}>
          <SelectTrigger className="h-11 sm:w-72" aria-label="Categoria">
            <SelectValue placeholder="Escolha a categoria" />
          </SelectTrigger>
          <SelectContent>
            {ordenadas.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </SelectItem>
            ))}
            <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {lista.loading ? 'Carregando…' : `${lista.totalCount} produto(s) na categoria`}
        </p>
      </div>

      {lista.loading || (!categoriaParam && carregandoCategorias) ? (
        <Loader2 className="mx-auto mt-10 h-8 w-8 animate-spin text-gold-ink" />
      ) : lista.error ? (
        <p className="text-destructive">{lista.error}</p>
      ) : produtos.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Nenhum produto nesta categoria.</p>
      ) : (
        <>
          {/* Celular: um card por produto. */}
          <ul className="space-y-3 md:hidden">
            {produtos.map((produto) => {
              const custo = valor(chaveCusto(produto.id));
              return (
                <li key={produto.id} className="rounded-2xl border bg-card p-3 shadow-soft">
                  <p className="font-semibold">{produto.nome}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      Custo (R$)
                      {campo(chaveCusto(produto.id), `Custo de ${produto.nome}`, true)}
                    </label>
                    <label className="space-y-1 text-xs text-muted-foreground">
                      {produto.tamanhos?.length ? 'Preço base (R$)' : 'Venda (R$)'}
                      {campo(chavePreco(produto.id), `Preço de ${produto.nome}`)}
                    </label>
                  </div>
                  <p className="mt-1 text-right text-xs">
                    <Margem preco={valor(chavePreco(produto.id))} custo={custo} />
                  </p>
                  {(produto.tamanhos ?? []).map((opcao) => {
                    const chave = chaveOpcao(produto.id, opcao.codigo);
                    return (
                      <div key={opcao.codigo} className="mt-2 grid grid-cols-[1fr_7.5rem] items-center gap-2 border-t pt-2">
                        <span className="min-w-0 text-sm">
                          <span className="block truncate">↳ {opcao.nome}</span>
                          <span className="text-xs">
                            <Margem preco={valor(chave)} custo={custo} />
                          </span>
                        </span>
                        {campo(chave, `Preço de ${produto.nome} ${opcao.nome}`)}
                      </div>
                    );
                  })}
                </li>
              );
            })}
          </ul>

          {/* Computador: tabela. */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-36 text-right">Custo (R$)</TableHead>
                  <TableHead className="w-36 text-right">Venda (R$)</TableHead>
                  <TableHead className="w-44 text-right">Lucro (margem)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => {
                  const custo = valor(chaveCusto(produto.id));
                  return (
                    <Fragment key={produto.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          {produto.nome}
                          {produto.tamanhos?.length ? <span className="ml-2 text-xs text-muted-foreground">preço base</span> : null}
                        </TableCell>
                        <TableCell>{campo(chaveCusto(produto.id), `Custo de ${produto.nome}`, true)}</TableCell>
                        <TableCell>{campo(chavePreco(produto.id), `Preço de ${produto.nome}`)}</TableCell>
                        <TableCell className="text-right">
                          <Margem preco={valor(chavePreco(produto.id))} custo={custo} />
                        </TableCell>
                      </TableRow>
                      {(produto.tamanhos ?? []).map((opcao) => {
                        const chave = chaveOpcao(produto.id, opcao.codigo);
                        return (
                          <TableRow key={opcao.codigo} className="bg-muted/30">
                            <TableCell className="pl-8 text-sm text-muted-foreground">↳ {opcao.nome}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">custo do produto</TableCell>
                            <TableCell>{campo(chave, `Preço de ${produto.nome} ${opcao.nome}`)}</TableCell>
                            <TableCell className="text-right">
                              <Margem preco={valor(chave)} custo={custo} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 sm:h-9" disabled={pagina === 1} onClick={() => irPara({ pagina: pagina - 1 })}>
                  Anterior
                </Button>
                <Button variant="outline" className="h-11 sm:h-9" disabled={pagina >= totalPaginas} onClick={() => irPara({ pagina: pagina + 1 })}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {qtdAlterados > 0 && (
        <>
          <div className="h-20" aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t bg-card px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:bottom-4 lg:left-auto lg:right-8 lg:rounded-2xl lg:border">
            <p className="mr-auto text-sm font-semibold" aria-live="polite">
              {alteracoes.length} produto(s) alterado(s)
            </p>
            <Button variant="ghost" className="h-11 sm:h-9" onClick={() => setRascunho({})} disabled={salvando}>
              <RotateCcw className="mr-1 h-4 w-4" /> Desfazer
            </Button>
            <Button className="h-11 sm:h-9" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </>
      )}
      {dialogo}
    </div>
  );
}
