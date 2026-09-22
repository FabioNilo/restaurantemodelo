import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Leaf, Loader2, ShieldAlert } from 'lucide-react';
import { MarmitaForm } from '@/components/admin/MarmitaForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMarmitaDetailQuery, useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import type { Marmita } from '@/types/product';

export default function MarmitaEditor() {
  const { user, loading: authLoading, permissions } = useAuth();
  const { marmitaId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!marmitaId;

  const {
    categorias,
    loading: loadingAdminData,
    createMarmita,
    updateMarmita,
  } = useMarmitasAdmin(1);
  const marmitaQuery = useMarmitaDetailQuery(marmitaId ?? null, isEditing && permissions.canManageFullMenu);

  const categoriasAtivas = useMemo(
    () => categorias.filter((categoria) => categoria.ativo),
    [categorias]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, navigate, user]);

  const handleBackToAdmin = () => {
    navigate('/admin');
  };

  const handleSave = async (data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>) => {
    if (marmitaId) {
      const result = await updateMarmita(marmitaId, data);

      if (result.success) {
        toast({ title: 'Produto atualizado com sucesso!' });
        navigate('/admin');
        return true;
      }

      toast({ title: 'Erro ao atualizar', description: 'Tente novamente.', variant: 'destructive' });
      return false;
    }

    const result = await createMarmita(data);

    if (result.success) {
      toast({ title: 'Produto criado com sucesso!' });
      navigate('/admin');
      return true;
    }

    toast({ title: 'Erro ao criar', description: 'Tente novamente.', variant: 'destructive' });
    return false;
  };

  if (authLoading || (permissions.canManageFullMenu && loadingAdminData) || (isEditing && marmitaQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!permissions.canManageFullMenu) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <CardTitle className="text-destructive">Acesso negado</CardTitle>
            <CardDescription>
              Seu perfil pode atualizar estoque, mas não pode editar o cadastro completo do cardápio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Voltar ao painel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditing && marmitaQuery.error) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={handleBackToAdmin} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Erro ao carregar produto</CardTitle>
              <CardDescription>
                Não foi possível buscar os dados para edição. Tente novamente.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold text-gradient">Admin</span>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">{user?.username ?? user?.email}</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBackToAdmin} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao cardápio
          </Button>
          <h1 className="font-display text-3xl font-bold">
            {isEditing ? 'Editar produto' : 'Novo produto'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Preencha os dados e escolha uma imagem com mais espaço de visualização.
          </p>
        </div>

        <MarmitaForm
          layout="page"
          marmita={marmitaQuery.data ?? null}
          categorias={categoriasAtivas}
          isEditing={isEditing}
          loadingInitialData={isEditing && marmitaQuery.isLoading}
          onCancel={handleBackToAdmin}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
