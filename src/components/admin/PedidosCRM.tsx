import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  CreditCard,
  Eye,
  FileDown,
  Hash,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  usePedidoDetailQuery,
  usePedidosActions,
  usePedidosListQuery,
  usePedidosResumoQuery,
} from '@/hooks/usePedidos';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_PAGE_SIZE } from '@/lib/query-client';
import { downloadPedidoThermalLabelPdf } from '@/lib/thermal-label-pdf';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PedidoItemDetalhe {
  quantidade?: number;
  nome?: string;
  preco?: number;
  valor_total?: number;
  total?: number;
  tamanho_nome?: string;
  tamanho_serve?: string;
  observacao?: string | null;
  observacoes?: string | null;
  observacoes_item?: string | null;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function getPaymentLabel(value?: string | null) {
  if (value === 'cartao_credito') return 'Cartão de crédito';
  if (value === 'pix') return 'Pix';
  return value || 'Não informado';
}

function formatItensDetalhe(itens: unknown) {
  if (!Array.isArray(itens)) return [];
  return itens as PedidoItemDetalhe[];
}

function getItemTotal(item: PedidoItemDetalhe) {
  return Number(item.valor_total ?? item.total ?? (Number(item.preco) || 0) * Number(item.quantidade ?? 1)) || 0;
}

function getPedidoFinancialSummary(
  pedido: {
    subtotal?: number | null;
    taxa_entrega?: number | null;
    valor_entrega?: number | null;
    delivery_fee?: number | null;
    valor_total: number;
  },
  itens: PedidoItemDetalhe[]
) {
  const total = Number(pedido.valor_total) || 0;
  const itemsTotal = itens.reduce((sum, item) => sum + getItemTotal(item), 0);
  const explicitSubtotal = pedido.subtotal;
  const explicitDeliveryFee = pedido.taxa_entrega ?? pedido.valor_entrega ?? pedido.delivery_fee;
  const deliveryFee = explicitDeliveryFee !== undefined && explicitDeliveryFee !== null
    ? Number(explicitDeliveryFee) || 0
    : Math.max(0, total - itemsTotal);
  const subtotal = explicitSubtotal !== undefined && explicitSubtotal !== null
    ? Number(explicitSubtotal) || 0
    : Math.max(0, total - deliveryFee);

  return { subtotal, deliveryFee, total };
}

export function PedidosCRM() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [notePedidoId, setNotePedidoId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(searchTerm, 400);
  const { updateStatus, updateObservacoesAdmin } = usePedidosActions();
  const pedidosListQuery = usePedidosListQuery(page, debouncedSearch, statusFilter, dateFilter);
  const pedidosResumoQuery = usePedidosResumoQuery(debouncedSearch, statusFilter, dateFilter);
  const pedidoDetailQuery = usePedidoDetailQuery(selectedPedidoId, !!selectedPedidoId);
  const noteDetailQuery = usePedidoDetailQuery(notePedidoId, !!notePedidoId);

  const pedidos = pedidosListQuery.data?.data ?? [];
  const totalCount = pedidosListQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));
  const resumo = pedidosResumoQuery.data ?? {
    total_pedidos: 0,
    pendentes: 0,
    entregues: 0,
    faturamento: 0,
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (noteDetailQuery.data) {
      setNoteText(noteDetailQuery.data.observacoes_admin || '');
    }
  }, [noteDetailQuery.data]);

  const selectedPedido = pedidoDetailQuery.data;
  const notePedido = noteDetailQuery.data;
  const isLoading = pedidosListQuery.isLoading;
  const selectedItens = useMemo(
    () => formatItensDetalhe(selectedPedido?.itens),
    [selectedPedido?.itens]
  );
  const selectedFinancialSummary = selectedPedido
    ? getPedidoFinancialSummary(selectedPedido, selectedItens)
    : null;

  const handleStatusChange = async (id: string, status: string) => {
    const ok = await updateStatus(id, status);
    toast({
      title: ok ? 'Status atualizado!' : 'Erro ao atualizar',
      variant: ok ? 'default' : 'destructive',
    });
  };

  const handleSaveNote = async () => {
    if (!notePedidoId) return;

    setSaving(true);
    const ok = await updateObservacoesAdmin(notePedidoId, noteText);
    setSaving(false);

    if (ok) {
      toast({ title: 'Nota salva!' });
      setNotePedidoId(null);
      return;
    }

    toast({ title: 'Erro ao salvar nota', variant: 'destructive' });
  };

  const refetchAll = async () => {
    await Promise.all([pedidosListQuery.refetch(), pedidosResumoQuery.refetch()]);
  };

  const handleDownloadLabel = () => {
    if (!selectedPedido) return;
    downloadPedidoThermalLabelPdf(selectedPedido, selectedItens);
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!selectedPedidoId} onOpenChange={() => setSelectedPedidoId(null)}>
        <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader>
            <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="text-2xl">Detalhes do pedido</DialogTitle>
                  <DialogDescription>
                    {selectedPedido?.created_at
                      ? format(new Date(selectedPedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'Carregando informações do pedido'}
                  </DialogDescription>
                </div>
                {selectedPedido ? (
                  <Button onClick={handleDownloadLabel} className="gap-2 sm:shrink-0">
                    <FileDown className="h-4 w-4" />
                    Baixar impressão
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          {pedidoDetailQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : selectedPedido ? (
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Cliente</h4>
                      <Badge className={cn('border', STATUS_COLORS[selectedPedido.status || 'enviado_whatsapp'])}>
                        {STATUS_LABELS[selectedPedido.status || 'enviado_whatsapp']}
                      </Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedPedido.nome_cliente || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedPedido.telefone_cliente || 'Não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="break-all text-muted-foreground">{selectedPedido.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="mb-3 font-semibold">Entrega</h4>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-medium">
                          {selectedPedido.endereco_cliente || 'Endereço não informado'}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedPedido.bairro_cliente || 'Bairro não informado'}
                        </p>
                        <p className="break-words text-muted-foreground">
                          <span className="font-medium text-foreground">Referência: </span>
                          {selectedPedido.complemento_cliente || 'Não informada'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="mb-3 font-semibold">Pagamento</h4>
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span>{getPaymentLabel(selectedPedido.forma_pagamento)}</span>
                    </div>
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedFinancialSummary?.subtotal ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Entrega</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedFinancialSummary?.deliveryFee ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-black text-primary">
                          {formatCurrency(selectedFinancialSummary?.total ?? selectedPedido.valor_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="mb-3 font-semibold">Itens do pedido</h4>
                    {selectedItens.length > 0 ? (
                      <div className="space-y-2">
                        {selectedItens.map((item, index) => (
                          <div
                            key={`${item.nome}-${index}`}
                            className="rounded-lg border bg-muted/20 p-3 text-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold">
                                  {item.quantidade ?? 1}x {item.nome || 'Item'}
                                </p>
                                {item.tamanho_nome ? (
                                  <p className="text-xs text-muted-foreground">
                                    {item.tamanho_nome}
                                    {item.tamanho_serve ? ` - ${item.tamanho_serve}` : ''}
                                  </p>
                                ) : null}
                              </div>
                              <span className="shrink-0 font-semibold text-muted-foreground">
                                {formatCurrency(getItemTotal(item))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">N/A</p>
                    )}
                  </div>

                  {(selectedPedido.observacoes_cliente || selectedPedido.observacoes_admin) && (
                    <div className="rounded-xl border bg-card p-4">
                      <h4 className="mb-3 font-semibold">Observações</h4>
                      {selectedPedido.observacoes_cliente ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
                          <p className="text-sm text-muted-foreground">{selectedPedido.observacoes_cliente}</p>
                        </div>
                      ) : null}
                      {selectedPedido.observacoes_admin ? (
                        <div className="mt-3 space-y-1 border-t pt-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Interna</p>
                          <p className="text-sm text-muted-foreground">{selectedPedido.observacoes_admin}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-muted-foreground">Não foi possível carregar os detalhes.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!notePedidoId} onOpenChange={() => setNotePedidoId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas internas</DialogTitle>
            <DialogDescription>
              Pedido de {notePedido?.nome_cliente || 'cliente'}
            </DialogDescription>
          </DialogHeader>
          {noteDetailQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Observações do admin</Label>
              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Adicione uma nota interna..."
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotePedidoId(null)}>Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={saving || noteDetailQuery.isLoading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nome, telefone ou ID..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-[160px] justify-start text-left font-normal', !dateFilter && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, 'dd/MM/yyyy', { locale: ptBR }) : 'Filtrar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('todos');
                setDateFilter(undefined);
              }}
            >
              Limpar
            </Button>

            <Button variant="outline" onClick={refetchAll} className="ml-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{resumo.total_pedidos}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-yellow-600">{resumo.pendentes}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregues</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-600">{resumo.entregues}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(resumo.faturamento)}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pedidos.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Nenhum pedido encontrado.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {pedido.created_at
                            ? format(new Date(pedido.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{pedido.nome_cliente || '-'}</TableCell>
                        <TableCell className="text-sm">{pedido.telefone_cliente || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{pedido.itens_resumo || 'N/A'}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">
                          {formatCurrency(pedido.valor_total)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={pedido.status || 'enviado_whatsapp'}
                            onValueChange={(value) => handleStatusChange(pedido.id, value)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <Badge className={cn('border text-xs', STATUS_COLORS[pedido.status || 'enviado_whatsapp'])}>
                                {STATUS_LABELS[pedido.status || 'enviado_whatsapp']}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedPedidoId(pedido.id)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setNotePedidoId(pedido.id)}
                              title="Notas internas"
                            >
                              <MessageSquare className="h-4 w-4" />
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

