import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, Clock, Loader2, Plus, Printer, QrCode, Receipt, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { createMesaAdmin, fetchMesasAdmin, regenerarTokenMesaAdmin, updateMesaAdmin } from '@/features/integrations/marmitas-api';
import { useAlertaNovosPedidos } from '@/hooks/useAlertaNovosPedidos';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { formatBRL } from '@/lib/pagamentos';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));

// Mapa das mesas (como plataforma-restaurantes/app/painel/mesas/page.tsx):
// livre/ocupada, há quanto tempo, total e pedidos em andamento. A comanda de
// cada mesa fica em /admin/mesas/:id.
export default function MesasPage() {
  const queryClient = useQueryClient();
  const { permissions } = useAuth();
  const isAdmin = permissions.role === 'admin';
  const [numero, setNumero] = useState('');

  const mesas = useQuery({
    queryKey: queryKeys.admin.mesas,
    queryFn: fetchMesasAdmin,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: false,
  });

  const idsNovos = mesas.data?.flatMap((mesa) => mesa.ids_novos);
  const { somAtivo, alternarSom } = useAlertaNovosPedidos(idsNovos, (n) => (n === 1 ? 'Novo pedido em uma mesa' : `${n} novos pedidos nas mesas`));

  const atualizar = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.mesas });
  const onError = (titulo: string) => (error: unknown) => toast({ title: titulo, description: getApiErrorMessage(error), variant: 'destructive' });

  const criar = useMutation({
    mutationFn: () => createMesaAdmin({ numero: Number(numero) }),
    onSuccess: () => {
      setNumero('');
      toast({ title: 'Mesa criada' });
      atualizar();
    },
    onError: onError('Não foi possível criar a mesa'),
  });

  const alterar = useMutation({
    mutationFn: ({ id, ativa }: { id: number; ativa: boolean }) => updateMesaAdmin(id, { ativa }),
    onSuccess: atualizar,
    onError: onError('Não foi possível alterar a mesa'),
  });

  const regenerar = useMutation({
    mutationFn: (id: number) => regenerarTokenMesaAdmin(id),
    onSuccess: () => {
      toast({ title: 'Novo QR gerado', description: 'Imprima de novo: o QR antigo não funciona mais.' });
      atualizar();
    },
    onError: onError('Não foi possível gerar o QR'),
  });

  const lista = mesas.data ?? [];
  const ocupadas = lista.filter((mesa) => mesa.conta_id).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary">Mesas</h1>
          <p className="text-sm text-muted-foreground">
            {ocupadas} de {lista.length} ocupadas. O cliente escaneia o QR da mesa e pede pelo celular; a conta fecha na comanda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={somAtivo ? 'secondary' : 'outline'} size="sm" onClick={alternarSom} className={cn(somAtivo && 'text-primary')}>
            {somAtivo ? <Volume2 className="mr-1 h-4 w-4" /> : <VolumeX className="mr-1 h-4 w-4" />}
            {somAtivo ? 'Som ativado' : 'Ativar som'}
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => window.open('/admin/mesas/qr', '_blank')} disabled={!lista.length}>
                <Printer className="mr-1 h-4 w-4" /> Imprimir QR
              </Button>
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (Number(numero) > 0) criar.mutate();
                }}
              >
                <Input
                  value={numero}
                  onChange={(event) => setNumero(event.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="Nº"
                  aria-label="Número da nova mesa"
                  className="h-9 w-20"
                />
                <Button type="submit" size="sm" disabled={!numero || criar.isPending}>
                  {criar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Mesa
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {mesas.isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-ink" />}
      {mesas.error && <p className="text-destructive">{getApiErrorMessage(mesas.error)}</p>}

      {!mesas.isLoading && lista.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <Armchair className="h-10 w-10 text-muted-foreground/50" />
          {isAdmin ? 'Cadastre as mesas do salão (campo "Nº" acima) para gerar os QR codes.' : 'Nenhuma mesa cadastrada ainda.'}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {lista.map((mesa) => {
          const aberta = Boolean(mesa.conta_id);
          return (
            <article
              key={mesa.id}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft',
                aberta && 'border-primary/50',
                mesa.novos > 0 && 'ring-2 ring-primary',
                !mesa.ativa && 'opacity-55'
              )}
            >
              <Link to={`/admin/mesas/${mesa.id}`} className={cn('flex items-start justify-between gap-3 p-4', aberta && 'bg-primary/10')}>
                <div>
                  <p className="flex items-center gap-2 font-display text-2xl font-bold text-secondary">
                    <Armchair className={cn('h-5 w-5', aberta ? 'text-gold-ink' : 'text-muted-foreground')} /> {mesa.nome}
                  </p>
                  {aberta && mesa.aberta_em ? (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> aberta há {minutosDesde(mesa.aberta_em)} min
                      {mesa.em_andamento > 0 && (
                        <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-gold-ink">
                          {mesa.novos > 0 ? `${mesa.novos} a confirmar` : `${mesa.em_andamento} a entregar`}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{mesa.ativa ? 'Livre' : 'Desativada'}</p>
                  )}
                </div>
                {aberta && <span className="font-display text-2xl font-bold text-gold-ink">{formatBRL(mesa.total)}</span>}
              </Link>

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t p-3 text-sm">
                <Button asChild size="sm" variant="secondary" className="text-primary">
                  <Link to={`/admin/mesas/${mesa.id}`}>
                    <Receipt className="mr-1 h-4 w-4" /> Comanda
                  </Link>
                </Button>
                {isAdmin && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/admin/mesas/qr?id=${mesa.id}`, '_blank')}>
                      <QrCode className="mr-1 h-4 w-4" /> QR
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Gerar novo QR da ${mesa.nome}`}
                      onClick={() => {
                        if (window.confirm(`Gerar um novo QR para a ${mesa.nome}? O QR impresso atual vai parar de funcionar.`)) regenerar.mutate(mesa.id);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <button
                      className="ml-auto px-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => alterar.mutate({ id: mesa.id, ativa: !mesa.ativa })}
                    >
                      {mesa.ativa ? 'Desativar' : 'Ativar'}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
