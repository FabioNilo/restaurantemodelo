import { useEffect, useState } from 'react';
import {
  CaixaMovimentacao,
  useCaixaActions,
  useCaixaListQuery,
  useCaixaResumoQuery,
  useCaixaSeriesQuery,
} from '@/hooks/useCaixaMovimentacoes';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  CalendarIcon,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useToast } from '@/hooks/use-toast';

export function CaixaTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const [editingItem, setEditingItem] = useState<CaixaMovimentacao | null>(null);
  const [deleteItem, setDeleteItem] = useState<CaixaMovimentacao | null>(null);
  const [editForm, setEditForm] = useState({
    tipo: '',
    descricao: '',
    valor: '',
    origem: '',
  });
  const [saving, setSaving] = useState(false);

  const { updateMovimentacao, deleteMovimentacao } = useCaixaActions();
  const listaQuery = useCaixaListQuery(page, dataInicio, dataFim);
  const resumoQuery = useCaixaResumoQuery(dataInicio, dataFim);
  const seriesQuery = useCaixaSeriesQuery(dataInicio, dataFim);

  const movimentacoes = listaQuery.data?.data ?? [];
  const totalCount = listaQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const resumo = resumoQuery.data ?? {
    totalEntradas: 0,
    totalSaidas: 0,
    saldo: 0,
  };
  const chartData = seriesQuery.data ?? [];

  useEffect(() => {
    setPage(1);
  }, [dataInicio, dataFim]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const clearFilters = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const handleEdit = (movimentacao: CaixaMovimentacao) => {
    setEditingItem(movimentacao);
    setEditForm({
      tipo: movimentacao.tipo,
      descricao: movimentacao.descricao || '',
      valor: String(movimentacao.valor),
      origem: movimentacao.origem || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    setSaving(true);
    const success = await updateMovimentacao(editingItem.id, {
      tipo: editForm.tipo,
      descricao: editForm.descricao || null,
      valor: parseFloat(editForm.valor),
      origem: editForm.origem || null,
    });
    setSaving(false);

    if (success) {
      toast({ title: 'Movimentação atualizada com sucesso!' });
      setEditingItem(null);
      return;
    }

    toast({ title: 'Erro ao atualizar', description: 'Tente novamente.', variant: 'destructive' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;

    setSaving(true);
    const success = await deleteMovimentacao(deleteItem.id);
    setSaving(false);

    if (success) {
      toast({ title: 'Movimentação excluída com sucesso!' });
      setDeleteItem(null);
      return;
    }

    toast({ title: 'Erro ao excluir', description: 'Tente novamente.', variant: 'destructive' });
  };

  const refetchAll = async () => {
    await Promise.all([listaQuery.refetch(), resumoQuery.refetch(), seriesQuery.refetch()]);
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar movimentação</DialogTitle>
            <DialogDescription>Altere os dados da movimentação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editForm.tipo} onValueChange={(value) => setEditForm({ ...editForm, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.valor}
                onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input
                value={editForm.origem}
                onChange={(e) => setEditForm({ ...editForm, origem: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta movimentação de R$ {deleteItem?.valor.toFixed(2)}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data início</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data fim</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="ghost" onClick={clearFilters} disabled={!dataInicio && !dataFim}>
              Limpar filtros
            </Button>

            <Button variant="outline" onClick={refetchAll} className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-primary" />
              Total de Entradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-3xl font-bold text-primary">
                R$ {resumo.totalEntradas.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
              Total de saídas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-destructive" />
              <span className="text-3xl font-bold text-destructive">
                R$ {resumo.totalSaidas.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-secondary" />
              Saldo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="h-6 w-6 text-secondary" />
              <span className={cn("text-3xl font-bold", resumo.saldo >= 0 ? "text-primary" : "text-destructive")}>
                R$ {resumo.saldo.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evolução do fluxo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date_label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="entradas"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.3)"
                    name="Entradas"
                  />
                  <Area
                    type="monotone"
                    dataKey="saidas"
                    stackId="2"
                    stroke="hsl(var(--destructive))"
                    fill="hsl(var(--destructive) / 0.3)"
                    name="Saidas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparativo diário</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date_label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="entradas" fill="hsl(var(--primary))" name="Entradas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="hsl(var(--destructive))" name="Saidas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de movimentações</CardTitle>
          <CardDescription>
            {totalCount} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listaQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : listaQuery.error ? (
            <div className="text-center py-12 text-destructive">
              <p>Erro ao carregar movimentações.</p>
              <Button variant="outline" onClick={refetchAll} className="mt-4">
                Tentar novamente
              </Button>
            </div>
          ) : movimentacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="font-medium">
                          {mov.created_at
                            ? format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={mov.tipo === 'entrada' ? 'default' : 'destructive'}
                            className="flex items-center gap-1 w-fit"
                          >
                            {mov.tipo === 'entrada' ? (
                              <ArrowUpCircle className="h-3 w-3" />
                            ) : (
                              <ArrowDownCircle className="h-3 w-3" />
                            )}
                            {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell>{mov.descricao || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mov.origem || 'manual'}</Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-bold",
                            mov.tipo === 'entrada' ? 'text-primary' : 'text-destructive'
                          )}
                        >
                          {mov.tipo === 'entrada' ? '+' : '-'} R$ {Number(mov.valor).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(mov)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteItem(mov)}
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
