import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PackageCheck, RefreshCw, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { getAvailabilityFromStock, normalizeStock } from '@/lib/stock-rules';

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0));
}

export function GestorStockManager() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const { marmitas, totalCount, loading, error, refetch, updateMarmitaStock } = useMarmitasAdmin(page);

  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of marmitas) {
        if (next[item.id] === undefined) {
          next[item.id] = String(item.estoque ?? 0);
        }
      }
      return next;
    });
  }, [marmitas]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const changedItems = useMemo(
    () => marmitas.filter((item) => Number(drafts[item.id] ?? item.estoque ?? 0) !== Number(item.estoque ?? 0)),
    [drafts, marmitas]
  );

  const handleSave = async (id: string) => {
    const estoque = normalizeStock(drafts[id]);

    setSavingId(id);
    const result = await updateMarmitaStock(id, estoque);
    setSavingId(null);

    if (!result.success) {
      toast({
        title: 'Erro ao atualizar estoque',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
      return;
    }

    setDrafts((current) => ({ ...current, [id]: String(estoque) }));
    toast({
      title: estoque === 0 ? 'Produto indisponível' : 'Estoque atualizado',
      description: estoque === 0
        ? 'O item saiu da página inicial automaticamente.'
        : 'O item voltou a ficar disponível no cardápio público.',
    });
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
      <div className="py-12 text-center text-destructive">
        <p>{error}</p>
        <Button variant="outline" onClick={refetch} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Controle de estoque
          </CardTitle>
          <CardDescription>
            Atualize apenas a quantidade disponível. Estoque zero deixa o produto indisponível na página inicial.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {marmitas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum produto cadastrado.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marmitas.map((item) => {
                    const draftValue = drafts[item.id] ?? String(item.estoque ?? 0);
                    const estoque = normalizeStock(draftValue);
                    const isAvailable = getAvailabilityFromStock(estoque) && item.disponivel !== false;
                    const changed = Number(item.estoque ?? 0) !== estoque;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.nome}</div>
                          <div className="text-xs text-muted-foreground">Edição limitada ao estoque</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(item.preco)}
                        </TableCell>
                        <TableCell className="min-w-32 text-center">
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={draftValue}
                            onChange={(event) => {
                              setDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }));
                            }}
                            className="mx-auto w-24 text-center"
                            aria-label={`Estoque de ${item.nome}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isAvailable ? 'default' : 'secondary'}>
                            {isAvailable ? 'Disponível' : 'Indisponível'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSave(item.id)}
                            disabled={!changed || savingId === item.id}
                            className="gap-2"
                          >
                            {savingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : changed ? (
                              <Save className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Salvar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
                {changedItems.length > 0 ? ` · ${changedItems.length} alteração(ões) pendente(s)` : ''}
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
  );
}
