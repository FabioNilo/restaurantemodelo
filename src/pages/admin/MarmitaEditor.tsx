import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { MarmitaForm } from '@/components/admin/MarmitaForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMarmitaDetailQuery, useMarmitasAdmin } from '@/hooks/useMarmitasAdmin';
import type { Marmita } from '@/types/product';

export default function MarmitaEditor() {
  const { loading: authLoading, permissions } = useAuth();
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

  // Dentro do AdminLayout (que já exige login); voltar = lista do cardápio.
  const handleBackToAdmin = () => {
    navigate('/admin/cardapio');
  };

  const handleSave = async (data: Omit<Marmita, 'id' | 'created_at' | 'updated_at'>) => {
    if (marmitaId) {
      const result = await updateMarmita(marmitaId, data);

      if (result.success) {
        toast({ title: 'Produto atualizado com sucesso!' });
        navigate('/admin/cardapio');
        return true;
      }

      toast({ title: 'Erro ao atualizar', description: 'Tente novamente.', variant: 'destructive' });
      return false;
    }

    const result = await createMarmita(data);

    if (result.success) {
      toast({ title: 'Produto criado com sucesso!' });
      navigate('/admin/cardapio');
      return true;
    }

    toast({ title: 'Erro ao criar', description: 'Tente novamente.', variant: 'destructive' });
    return false;
  };

  if (authLoading || (permissions.canManageFullMenu && loadingAdminData) || (isEditing && marmitaQuery.isLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-ink" />
      </div>
    );
  }

  if (!permissions.canManageFullMenu) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <CardTitle className="text-destructive">Acesso negado</CardTitle>
            <CardDescription>
              Seu perfil pode atualizar estoque, mas não pode editar o cadastro completo do cardápio.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/admin/cardapio')}>
              Voltar ao cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditing && marmitaQuery.error) {
    return (
      <div>
        <div>
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
        </div>
      </div>
    );
  }

  return (
    <div>
        <div className="mb-6">
          <Button variant="ghost" onClick={handleBackToAdmin} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao cardápio
          </Button>
          <h1 className="font-display text-4xl font-bold text-secondary">
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
    </div>
  );
}
