import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { DecimalInput } from '@/components/admin/DecimalInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createBairroAdmin, deleteBairroAdmin, fetchBairrosAdmin, updateBairroAdmin } from '@/features/integrations/marmitas-api';
import type { BairroEntrega } from '@/features/integrations/painel-contracts';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { formatBRL, toCents } from '@/lib/pagamentos';
import { cn } from '@/lib/utils';

const QUERY_KEY = ['admin', 'bairros'] as const;

function useInvalidarBairros() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}

const erro = (error: unknown) => toast({ title: 'Não foi possível salvar', description: getApiErrorMessage(error), variant: 'destructive' });

function LinhaBairro({ bairro }: { bairro: BairroEntrega }) {
  const invalidar = useInvalidarBairros();
  const [nome, setNome] = useState(bairro.nome);
  const [taxa, setTaxa] = useState(bairro.taxa);
  const alterado = nome.trim() !== bairro.nome || toCents(taxa) !== toCents(bairro.taxa);

  const salvar = useMutation({
    mutationFn: (data: { nome?: string; taxa?: number; ativo?: boolean }) => updateBairroAdmin(bairro.id, data),
    onSuccess: (atualizado) => {
      setNome(atualizado.nome);
      setTaxa(atualizado.taxa);
      void invalidar();
    },
    onError: erro,
  });

  const excluir = useMutation({
    mutationFn: () => deleteBairroAdmin(bairro.id),
    onSuccess: () => {
      toast({ title: `${bairro.nome} excluído` });
      void invalidar();
    },
    onError: erro,
  });

  const gravar = () => alterado && salvar.mutate({ nome: nome.trim(), taxa });

  return (
    <li className={cn('flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap', !bairro.ativo && 'opacity-60')}>
      <Input
        aria-label={`Nome do bairro ${bairro.nome}`}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && gravar()}
        className="h-9 min-w-0 flex-1 basis-40"
      />
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">R$</span>
        <DecimalInput
          aria-label={`Taxa de ${bairro.nome}`}
          value={taxa}
          onValueChange={setTaxa}
          onKeyDown={(e) => e.key === 'Enter' && gravar()}
          className="h-9 w-24 text-right"
        />
      </div>
      <Button size="sm" variant={alterado ? 'hero' : 'ghost'} disabled={!alterado || salvar.isPending} onClick={gravar} aria-label={`Salvar ${bairro.nome}`}>
        {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
      <label className="flex w-28 items-center gap-2 text-sm">
        <Switch
          checked={bairro.ativo}
          disabled={salvar.isPending}
          onCheckedChange={(ativo) => salvar.mutate({ ativo })}
          aria-label={bairro.ativo ? `Pausar ${bairro.nome}` : `Reativar ${bairro.nome}`}
        />
        {bairro.ativo ? 'Ativo' : 'Pausado'}
      </label>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={excluir.isPending}
        onClick={() => window.confirm(`Excluir o bairro ${bairro.nome}? Para parar de entregar só por um tempo, use "Pausar".`) && excluir.mutate()}
        aria-label={`Excluir ${bairro.nome}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

// Bairros atendidos e taxa de entrega de cada um. O carrinho mostra só os
// ativos; a taxa entra no total do pedido, no cupom e no caixa.
export function BairrosEntregaCard() {
  const invalidar = useInvalidarBairros();
  const bairros = useQuery({ queryKey: QUERY_KEY, queryFn: fetchBairrosAdmin });
  const [nome, setNome] = useState('');
  const [taxa, setTaxa] = useState(0);

  const criar = useMutation({
    mutationFn: () => createBairroAdmin({ nome: nome.trim(), taxa }),
    onSuccess: (novo) => {
      toast({ title: `${novo.nome} adicionado`, description: `Taxa de entrega ${formatBRL(novo.taxa)}` });
      setNome('');
      setTaxa(0);
      void invalidar();
    },
    onError: erro,
  });

  const lista = bairros.data ?? [];
  const ativos = lista.filter((b) => b.ativo).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-gold-ink" /> Bairros e taxas de entrega
        </CardTitle>
        <CardDescription>
          O cliente escolhe o bairro numa lista no carrinho e a taxa é somada ao pedido. Bairro fora da lista não pode pedir.
          Use <strong>Pausar</strong> para suspender um bairro por um tempo sem perder o cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim().length < 2) return erro(new Error('Informe o nome do bairro.'));
            criar.mutate();
          }}
        >
          <div className="min-w-0 flex-1 basis-48 space-y-1">
            <Label htmlFor="novo-bairro">Bairro</Label>
            <Input id="novo-bairro" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Centro" maxLength={80} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nova-taxa">Taxa (R$)</Label>
            <DecimalInput id="nova-taxa" value={taxa} onValueChange={setTaxa} className="w-28 text-right" />
          </div>
          <Button type="submit" variant="hero" disabled={criar.isPending}>
            {criar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Adicionar
          </Button>
        </form>

        {bairros.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold-ink" />}
        {bairros.error && <p className="text-sm text-destructive">{getApiErrorMessage(bairros.error)}</p>}

        {!bairros.isLoading && !bairros.error && ativos === 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Nenhum bairro ativo: o site não aceita pedidos de delivery até você cadastrar ou reativar um bairro.
          </p>
        )}

        {lista.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {ativos} ativo(s){lista.length > ativos ? `, ${lista.length - ativos} pausado(s)` : ''}. Altere nome ou taxa e clique em salvar
              (ou Enter).
            </p>
            <ul className="divide-y">
              {lista.map((bairro) => (
                <LinhaBairro key={`${bairro.id}-${bairro.updated_at}`} bairro={bairro} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
