import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { hasN8NBaseUrl } from '@/lib/api';
import { DEMO_ADMIN_PASSWORD, DEMO_ADMIN_USERNAME } from '@/lib/demo-backend';

const authSchema = z.object({
  username: z.string().min(3, 'Usuário deve ter no mínimo 3 caracteres'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Auth() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      const result = authSchema.safeParse({ username, password });
      if (!result.success) {
        toast({
          title: 'Erro de validação',
          description: result.error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }

      setLoading(true);

      const { error } = await signIn(username, password);

      if (error) {
        let message = error.message;
        if (error.message.includes('Invalid login credentials')) {
          message = 'Usuário ou senha incorretos';
        }

        toast({
          title: 'Erro',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-bold text-gradient">Restaurante Modelo</span>
          </div>
          <CardTitle>Área Administrativa</CardTitle>
          <CardDescription>
            Entre com as credenciais fornecidas pelo administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Seu usuario"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Use as credenciais fornecidas pelo administrador.</p>
          </div>
          {!hasN8NBaseUrl() && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
              Demo offline — use <strong>{DEMO_ADMIN_USERNAME}</strong> / <strong>{DEMO_ADMIN_PASSWORD}</strong> para
              entrar.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
          </div>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Entrar
          </Button>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => navigate('/')}>
              Voltar para o site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
