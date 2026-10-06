import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import { Marmita, SEM_CATEGORIA, type MarmitaAdminListItem, type MarmitaFiltros } from '@/types/product';
import { BarraSelecao } from '@/components/admin/cardapio/BarraSelecao';
import { DisponivelSwitch } from '@/components/admin/cardapio/DisponivelSwitch';
import { FiltrosRapidos, type FiltroRapidoParam } from '@/components/admin/cardapio/FiltrosRapidos';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getDefaultCategoryOrder, sortCategoriesByDisplayOrder } from '@/lib/product-category';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { getCatalogImageSrc } from '@/lib/catalog-image';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Table2,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Package,
  Search,
  Tag,
  X
} from 'lucide-react';

function slugifyCategoriaId(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function MarmitasManager() {
  const { toast } = useToast();
  // Busca, categoria e página ficam na URL: ao voltar da edição, a lista continua filtrada.
  const [searchParams, setSearchParams] = useSearchParams();
  const busca = searchParams.get('q') ?? '';
  const categoriaFiltro = searchParams.get('cat') ?? '';
  const page = Math.max(1, Number(searchParams.get('pagina')) || 1);
  const [buscaDigitada, setBuscaDigitada] = useState(busca);
  // Filtros rápidos (chips): também na URL.
  const rapidos = {
    foto: searchParams.get('foto') ?? undefined,
    disp: searchParams.get('disp') ?? undefined,
    custo: searchParams.get('custo') ?? undefined,
    estoque: searchParams.get('estoque') ?? undefined,
  };
  const filtrosLista: MarmitaFiltros = {
    busca,
    categoria_id: categoriaFiltro,
    foto: rapidos.foto === 'com' || rapidos.foto === 'sem' ? rapidos.foto : undefined,
    disponibilidade: rapidos.disp === 'disponivel' || rapidos.disp === 'indisponivel' ? rapidos.disp : undefined,
    sem_custo: rapidos.custo === 'sem' || undefined,
    estoque: rapidos.estoque === 'baixo' || rapidos.estoque === 'zerado' ? rapidos.estoque : undefined,
  };

  const atualizarParams = (mudancas: Record<string, string | null>) => {
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        for (const [chave, valor] of Object.entries(mudancas)) {
          if (valor) proximo.set(chave, valor);
          else proximo.delete(chave);
        }
        return proximo;
      },
      { replace: true }
    );
  };

  const setPage = (valor: number | ((atual: number) => number)) => {
    const proxima = typeof valor === 'function' ? valor(page) : valor;
    atualizarParams({ pagina: proxima > 1 ? String(proxima) : null });
  };

  // Espera a pessoa parar de digitar antes de buscar (e volta para a página 1).
  useEffect(() => {
    if (buscaDigitada.trim() === busca) return;
    const timer = window.setTimeout(() => atualizarParams({ q: buscaDigitada.trim() || null, pagina: null }), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDigitada]);

  const filtrando = !!busca || !!categoriaFiltro || Object.values(rapidos).some(Boolean);
  const limparFiltros = () => {
    setBuscaDigitada('');
    atualizarParams({ q: null, cat: null, foto: null, disp: null, custo: null, estoque: null, pagina: null });
  };
  const alterarFiltroRapido = (param: FiltroRapidoParam, valor: string | null) => atualizarParams({ [param]: valor, pagina: null });

  const {
    marmitas,
    totalCount,
    categorias,
    loading,
    error,
    refetch,
    deleteMarmita,
    updateMarmita,
    updateMarmitasMassa,
    createCategoria,
    updateCategoria,
    deleteCategoria
  } = useMarmitasAdmin(page, filtrosLista);
  const navigate = useNavigate();

  const [deleteItem, setDeleteItem] = useState<Marmita | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [newCategoriaName, setNewCategoriaName] = useState('');
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [deletingCategoria, setDeletingCategoria] = useState<string | null>(null);
  const [movingCategoria, setMovingCategoria] = useState<string | null>(null);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [aplicandoMassa, setAplicandoMassa] = useState(false);

  // A seleção vale para o que está na tela: trocar filtro ou página limpa.
  const chaveLista = searchParams.toString();
  useEffect(() => setSelecionados(new Set()), [chaveLista]);

  const alternarSelecao = (id: string) =>
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const alternarDisponivel = async (marmita: MarmitaAdminListItem, disponivel: boolean) => {
    setAlternandoId(marmita.id);
    const result = await updateMarmita(marmita.id, { disponivel });
    setAlternandoId(null);

    if (!result.success) {
      toast({ title: 'Não foi possível alterar', description: getApiErrorMessage(result.error), variant: 'destructive' });
      return;
    }

    toast({
      title: disponivel ? `${marmita.nome} à venda` : `${marmita.nome} oculto do cardápio`,
      description: disponivel && (marmita.estoque ?? 0) <= 0 ? 'Está sem estoque: só aparece no site quando tiver estoque.' : undefined,
    });
  };

  const aplicarMassa = async (mudanca: { disponivel?: boolean; categoria_id?: string }) => {
    setAplicandoMassa(true);
    const result = await updateMarmitasMassa({ ids: [...selecionados], ...mudanca });
    setAplicandoMassa(false);

    if (!result.success) {
      toast({ title: 'Não foi possível aplicar', description: getApiErrorMessage(result.error), variant: 'destructive' });
      return;
    }

    setSelecionados(new Set());
    toast({ title: `${result.atualizados} produto(s) atualizado(s)` });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const orderedCategorias = useMemo(() => sortCategoriesByDisplayOrder(categorias), [categorias]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages]);

  const handleOpenCreate = () => {
    navigate('/admin/marmitas/nova');
  };

  const handleOpenEdit = (marmitaId: string) => {
    navigate(`/admin/marmitas/${marmitaId}/editar`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;

    setDeleting(true);
    const result = await deleteMarmita(deleteItem.id);
    setDeleting(false);

    if (result.success) {
      toast({ title: 'Produto excluído com sucesso!' });
      setDeleteItem(null);
      return;
    }

    toast({ title: 'Erro ao excluir', description: 'Tente novamente.', variant: 'destructive' });
  };

  const handleCreateCategoria = async () => {
    const nome = newCategoriaName.trim();

    if (!nome) return;

    const categoriaJaExiste = categorias.some(
      (categoria) => categoria.nome.trim().toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')
    );

    if (categoriaJaExiste) {
      toast({
        title: 'Categoria já existe',
        description: `A categoria "${nome}" já está cadastrada.`,
      });
      return;
    }

    const categoryId = slugifyCategoriaId(nome);
    const defaultOrder = getDefaultCategoryOrder({ id: categoryId, nome });
    const nextOrder = defaultOrder ?? Math.max(0, ...categorias.map((categoria) => Number(categoria.ordem ?? 0))) + 1;

    setSavingCategoria(true);
    const result = await createCategoria({
      id: categoryId,
      nome,
      ordem: nextOrder,
      ativo: true,
    });
    setSavingCategoria(false);

    if (result.success) {
      toast({ title: 'Categoria criada com sucesso!' });
      setNewCategoriaName('');
      return;
    }

    const errorMessage = result.error instanceof Error
      ? result.error.message
      : 'Não foi possível criar a categoria. Verifique sua sessão e tente novamente.';

    toast({
      title: 'Erro ao criar categoria',
      description: errorMessage,
      variant: 'destructive',
    });
  };

  const handleDeleteCategoria = async (id: string) => {
    setDeletingCategoria(id);
    const result = await deleteCategoria(id);
    setDeletingCategoria(null);

    if (result.success) {
      toast({ title: 'Categoria excluída!' });
      return;
    }

    toast({ title: 'Erro ao excluir categoria', variant: 'destructive' });
  };

  const handleMoveCategoria = async (categoriaId: string, direction: 'up' | 'down') => {
    const currentIndex = orderedCategorias.findIndex((categoria) => categoria.id === categoriaId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedCategorias.length) {
      return;
    }

    const reordered = [...orderedCategorias];
    const [movedCategoria] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedCategoria);

    setMovingCategoria(categoriaId);
    const results = await Promise.all(
      reordered.map((categoria, index) => updateCategoria(categoria.id, { ordem: index + 1 }))
    );
    setMovingCategoria(null);

    if (results.every((result) => result.success)) {
      toast({ title: 'Ordem das categorias atualizada!' });
      return;
    }

    toast({
      title: 'Erro ao reordenar categorias',
      description: 'Tente novamente em alguns instantes.',
      variant: 'destructive',
    });
  };

  const getCategoriaName = (categoriaId: string | null) => {
    if (!categoriaId) return '-';
    const categoria = categorias.find((item) => item.id === categoriaId);
    return categoria?.nome || '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gold-ink" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
        <Button variant="outline" onClick={refetch} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)} className="h-11 sm:h-10">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting} className="h-11 sm:h-10">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Adicione ou remova categorias para organizar seu cardápio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Sobremesa"
                value={newCategoriaName}
                onChange={(e) => setNewCategoriaName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategoria()}
              />
              <Button onClick={handleCreateCategoria} disabled={savingCategoria || !newCategoriaName.trim()}>
                {savingCategoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {!categorias.some((categoria) => categoria.nome.trim().toLocaleLowerCase('pt-BR') === 'sobremesa') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewCategoriaName('Sobremesa')}
                className="w-full justify-start"
              >
                <Plus className="mr-2 h-4 w-4" />
                Preparar categoria Sobremesa
              </Button>
            )}

            {!categorias.some((categoria) => categoria.nome.trim().toLocaleLowerCase('pt-BR') === 'bebidas') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewCategoriaName('Bebidas')}
                className="w-full justify-start"
              >
                <Plus className="mr-2 h-4 w-4" />
                Preparar categoria Bebidas
              </Button>
            )}

            <div className="space-y-2">
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma categoria cadastrada
                </p>
              ) : (
                orderedCategorias.map((cat, index) => (
                  <div key={cat.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span>{cat.nome}</span>
                      {!cat.ativo && <Badge variant="secondary">Inativa</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveCategoria(cat.id, 'up')}
                        disabled={index === 0 || movingCategoria !== null}
                        aria-label={`Mover ${cat.nome} para cima`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveCategoria(cat.id, 'down')}
                        disabled={index === orderedCategorias.length - 1 || movingCategoria !== null}
                        aria-label={`Mover ${cat.nome} para baixo`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCategoria(cat.id)}
                        disabled={deletingCategoria === cat.id || movingCategoria !== null}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingCategoria === cat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 justify-between items-center sm:gap-4">
        <div className="flex gap-2">
          <Button onClick={handleOpenCreate} className="hidden sm:inline-flex">
            <Plus className="h-4 w-4 mr-2" />
            Novo produto
          </Button>
          <Button variant="outline" onClick={() => setCategoriaDialogOpen(true)} className="h-11 sm:h-10">
            <Tag className="h-4 w-4 mr-2" />
            Categorias
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/cardapio/lote${categoriaFiltro ? `?cat=${encodeURIComponent(categoriaFiltro)}` : ''}`)}
            className="h-11 sm:h-10"
          >
            <Table2 className="h-4 w-4 mr-2" />
            Editar em lote
          </Button>
        </div>
        <Button variant="ghost" onClick={refetch} className="h-11 sm:h-10">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Celular: "Novo produto" flutuante, acima da barra de navegação. */}
      <Button
        onClick={handleOpenCreate}
        className={cn('fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 rounded-full px-5 font-bold shadow-card sm:hidden', selecionados.size > 0 && 'hidden')}
        aria-label="Novo produto"
      >
        <Plus className="mr-1 h-5 w-5" /> Novo
      </Button>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cardápio
          </CardTitle>
          <CardDescription aria-live="polite">
            {filtrando ? `${totalCount} produto(s) encontrado(s)` : `${totalCount} produto(s) cadastrado(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6">
          {/* Busca fica presa no topo ao rolar a lista no celular. */}
          <div className="sticky top-14 z-10 -mx-3 flex flex-col gap-3 bg-card px-3 py-2 sm:static sm:mx-0 sm:flex-row sm:items-center sm:p-0 lg:top-0">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={buscaDigitada}
                onChange={(event) => setBuscaDigitada(event.target.value)}
                placeholder="Buscar produto pelo nome"
                aria-label="Buscar produto pelo nome"
                className="h-11 pl-9 sm:h-10"
              />
            </div>
            <Select
              value={categoriaFiltro || 'all'}
              onValueChange={(valor) => atualizarParams({ cat: valor === 'all' ? null : valor, pagina: null })}
            >
              <SelectTrigger className="hidden sm:flex sm:w-56" aria-label="Filtrar por categoria">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {orderedCategorias.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </SelectItem>
                ))}
                <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
              </SelectContent>
            </Select>
            <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none sm:hidden" role="group" aria-label="Filtrar por categoria">
              {[{ id: '', nome: 'Todas' }, ...orderedCategorias, { id: SEM_CATEGORIA, nome: 'Sem categoria' }].map((categoria) => (
                <button
                  key={categoria.id || 'todas'}
                  type="button"
                  aria-pressed={categoriaFiltro === categoria.id}
                  onClick={() => atualizarParams({ cat: categoria.id || null, pagina: null })}
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-4 text-sm font-medium',
                    categoriaFiltro === categoria.id ? 'border-secondary bg-secondary text-primary' : 'bg-background text-muted-foreground'
                  )}
                >
                  {categoria.nome}
                </button>
              ))}
            </div>
            {filtrando && (
              <Button variant="ghost" onClick={limparFiltros} className="h-11 gap-1 sm:h-10">
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            )}
          </div>

          <FiltrosRapidos valores={rapidos} onChange={alterarFiltroRapido} />

          {marmitas.length === 0 && filtrando ? (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Nenhum produto encontrado com esses filtros.</p>
              <Button variant="outline" onClick={limparFiltros} className="mt-4">
                Limpar filtros
              </Button>
            </div>
          ) : marmitas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto cadastrado</p>
              <Button variant="outline" onClick={handleOpenCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro produto
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <ul className="divide-y rounded-xl border md:hidden">
                {marmitas.map((marmita) => {
                  const foto = getCatalogImageSrc(marmita.imagem_url);
                  return (
                    <li key={marmita.id} className={cn('flex items-center gap-2 p-3', selecionados.has(marmita.id) && 'bg-primary/10')}>
                      <Checkbox
                        checked={selecionados.has(marmita.id)}
                        onCheckedChange={() => alternarSelecao(marmita.id)}
                        aria-label={`Selecionar ${marmita.nome}`}
                        className="h-5 w-5"
                      />
                      <button type="button" onClick={() => handleOpenEdit(marmita.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        {foto ? (
                          <img src={foto} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-muted object-cover" />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Package className="h-6 w-6" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{marmita.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {getCategoriaName(marmita.categoria_id)} · estoque {marmita.estoque ?? 0}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="font-bold text-gold-ink">R$ {Number(marmita.preco).toFixed(2).replace('.', ',')}</span>
                          </span>
                        </span>
                      </button>
                      <DisponivelSwitch
                        compacto
                        nome={marmita.nome}
                        disponivel={!!marmita.disponivel}
                        estoque={marmita.estoque ?? 0}
                        carregando={alternandoId === marmita.id}
                        onChange={(disponivel) => alternarDisponivel(marmita, disponivel)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteItem(marmita as Marmita)}
                        aria-label={`Excluir ${marmita.nome}`}
                        className="h-11 w-9 shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={marmitas.length > 0 && marmitas.every((m) => selecionados.has(m.id))}
                          onCheckedChange={(marcar) => setSelecionados(marcar ? new Set(marmitas.map((m) => m.id)) : new Set())}
                          aria-label="Selecionar todos desta página"
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marmitas.map((marmita) => (
                        <TableRow key={marmita.id} data-state={selecionados.has(marmita.id) ? 'selected' : undefined}>
                          <TableCell>
                            <Checkbox
                              checked={selecionados.has(marmita.id)}
                              onCheckedChange={() => alternarSelecao(marmita.id)}
                              aria-label={`Selecionar ${marmita.nome}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{marmita.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCategoriaName(marmita.categoria_id)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-gold-ink">
                            R$ {Number(marmita.preco).toFixed(2).replace('.', ',')}
                          </TableCell>
                          <TableCell className="text-center">{marmita.estoque ?? 0}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <DisponivelSwitch
                                nome={marmita.nome}
                                disponivel={!!marmita.disponivel}
                                estoque={marmita.estoque ?? 0}
                                carregando={alternandoId === marmita.id}
                                onChange={(disponivel) => alternarDisponivel(marmita, disponivel)}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(marmita.id)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteItem(marmita as Marmita)}
                                title="Excluir"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-9"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
          {selecionados.size > 0 && <div className="h-36 lg:h-20" aria-hidden="true" />}
        </CardContent>
      </Card>

      <BarraSelecao
        quantidade={selecionados.size}
        categorias={orderedCategorias}
        enviando={aplicandoMassa}
        onDisponivel={(disponivel) => aplicarMassa({ disponivel })}
        onMoverCategoria={(categoria_id) => aplicarMassa({ categoria_id })}
        onLimpar={() => setSelecionados(new Set())}
      />
    </div>
  );
}
