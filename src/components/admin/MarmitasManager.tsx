import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import { Marmita } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getDefaultCategoryOrder, sortCategoriesByDisplayOrder } from '@/lib/product-category';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Package,
  Tag
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
  const [page, setPage] = useState(1);
  const {
    marmitas,
    totalCount,
    categorias,
    loading,
    error,
    refetch,
    deleteMarmita,
    createCategoria,
    updateCategoria,
    deleteCategoria
  } = useMarmitasAdmin(page);
  const navigate = useNavigate();

  const [deleteItem, setDeleteItem] = useState<Marmita | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [newCategoriaName, setNewCategoriaName] = useState('');
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [deletingCategoria, setDeletingCategoria] = useState<string | null>(null);
  const [movingCategoria, setMovingCategoria] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const orderedCategorias = useMemo(() => sortCategoriesByDisplayOrder(categorias), [categorias]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{deleteItem?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
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

      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo produto
          </Button>
          <Button variant="outline" onClick={() => setCategoriaDialogOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Categorias
          </Button>
        </div>
        <Button variant="ghost" onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cardápio
          </CardTitle>
          <CardDescription>
            {totalCount} produto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {marmitas.length === 0 ? (
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableRow key={marmita.id}>
                          <TableCell className="font-medium">{marmita.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCategoriaName(marmita.categoria_id)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            R$ {Number(marmita.preco).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">{marmita.estoque ?? 0}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={marmita.disponivel ? 'default' : 'secondary'}>
                              {marmita.disponivel ? 'Disponível' : 'Indisponível'}
                            </Badge>
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
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
