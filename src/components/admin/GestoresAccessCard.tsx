import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { createGestorN8n, fetchGestoresN8n } from '@/features/integrations/marmitas-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const GESTORES_QUERY_KEY = ['admin', 'gestores'] as const;

export function GestoresAccessCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const gestoresQuery = useQuery({
    queryKey: GESTORES_QUERY_KEY,
    queryFn: fetchGestoresN8n,
  });

  const createMutation = useMutation({
    mutationFn: createGestorN8n,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GESTORES_QUERY_KEY });
    },
  });

  const handleCreate = async () => {
    if (!username.trim() || password.length < 6) {
      toast({
        title: 'Dados obrigatórios',
        description: 'Informe usuário e senha com pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        username: username.trim(),
        password,
        name: name.trim() || username.trim(),
      });
      setName('');
      setUsername('');
      setPassword('');
      toast({
        title: 'Gestor criado',
        description: 'O novo acesso já pode entrar no painel com permissões limitadas.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar gestor',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UserCog className="h-5 w-5 text-primary" />
          Gestores de acesso
        </CardTitle>
        <CardDescription>
          Crie acessos limitados para operar CRM e atualizar estoque, sem abrir configurações ou caixa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="gestor-name">Nome</Label>
            <Input
              id="gestor-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do gestor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gestor-username">Usuário</Label>
            <Input
              id="gestor-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Gestor"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gestor-password">Senha</Label>
            <Input
              id="gestor-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="gestor123*"
              autoComplete="new-password"
            />
          </div>
          <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </Button>
        </div>

        <div className="rounded-2xl border bg-muted/20">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Acessos limitados cadastrados
          </div>
          <div className="divide-y">
            {gestoresQuery.isLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando gestores...
              </div>
            ) : gestoresQuery.data?.length ? (
              gestoresQuery.data.map((gestor) => (
                <div key={gestor.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{gestor.name || gestor.username}</div>
                    <div className="text-sm text-muted-foreground">{gestor.username}</div>
                  </div>
                  <Badge variant="secondary">Gestor</Badge>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                Nenhum gestor cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
