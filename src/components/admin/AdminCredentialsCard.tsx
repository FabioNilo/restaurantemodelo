import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function AdminCredentialsCard() {
  const { user, changeCredentials } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState(user?.username ?? user?.email ?? '');
  const [newUsername, setNewUsername] = useState(user?.username ?? user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentUsername = user?.username ?? user?.email ?? '';
    setUsername(currentUsername);
    setNewUsername(currentUsername);
  }, [user?.email, user?.username]);

  const handleSave = async () => {
    if (!username.trim() || !newUsername.trim()) {
      toast({
        title: 'Usuário obrigatório',
        description: 'Informe o usuário atual e o novo usuário.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentPassword || !newPassword) {
      toast({
        title: 'Senha obrigatória',
        description: 'Informe a senha atual e a nova senha.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A nova senha deve ter no mínimo 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Confirmação inválida',
        description: 'A confirmação precisa ser igual à nova senha.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const result = await changeCredentials({
      username: username.trim(),
      currentPassword,
      newUsername: newUsername.trim(),
      newPassword,
    });
    setSaving(false);

    if (result.error) {
      toast({
        title: 'Erro ao atualizar credenciais',
        description: result.error.message,
        variant: 'destructive',
      });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast({
      title: 'Credenciais atualizadas',
      description: 'Use o novo usuário e senha no próximo acesso.',
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Credenciais de acesso
        </CardTitle>
        <CardDescription>
          Edite abaixo quando quiser trocar o acesso administrativo. As credenciais iniciais devem ser
          definidas e rotacionadas apenas no backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="current-username">Usuário atual</Label>
            <Input
              id="current-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-username">Novo usuário</Label>
            <Input
              id="new-username"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Ao salvar, suas alterações serão aplicadas e salvas no banco de dados.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar credenciais'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
