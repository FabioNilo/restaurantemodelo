import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Leaf, Loader2, LogOut, Package, Settings, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AdminCredentialsCard } from '@/components/admin/AdminCredentialsCard';
import { CaixaTab } from '@/components/admin/CaixaTab';
import { ConfiguracoesCard } from '@/components/admin/ConfiguracoesCard';
import { DeliveryZonesCard } from '@/components/admin/DeliveryZonesCard';
import { GestoresAccessCard } from '@/components/admin/GestoresAccessCard';
import { GestorStockManager } from '@/components/admin/GestorStockManager';
import { MarmitasManager } from '@/components/admin/MarmitasManager';
import { PedidosCRM } from '@/components/admin/PedidosCRM';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Admin() {
  const { user, loading: authLoading, permissions, signOut } = useAuth();
  const navigate = useNavigate();

  const availableTabs = useMemo(() => {
    const tabs = [];

    if (permissions.canManageSettings) {
      tabs.push('configuracoes');
    }

    if (permissions.canManageStock || permissions.canManageFullMenu) {
      tabs.push('cardapio');
    }

    if (permissions.canManageCrm) {
      tabs.push('pedidos');
    }

    if (permissions.canManageCashier) {
      tabs.push('caixa');
    }

    return tabs;
  }, [permissions]);

  const [activeTab, setActiveTab] = useState('cardapio');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!permissions.canAccessAdminPanel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <CardTitle className="text-destructive">Acesso negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta área. Entre em contato com o administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              Voltar ao site
            </Button>
            <Button variant="ghost" onClick={() => signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-bold text-gradient">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user?.username ?? user?.email}
              {permissions.role === 'gestor' ? ' · Gestor' : ''}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Painel administrativo</h1>
          <p className="mt-2 text-muted-foreground">
            {permissions.role === 'gestor'
              ? 'Gerencie pedidos e estoque do cardápio.'
              : 'Gerencie configurações, cardápio, pedidos e movimentações financeiras.'}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1 sm:max-w-3xl sm:grid-cols-4">
            {permissions.canManageSettings && (
              <TabsTrigger value="configuracoes" className="flex min-h-11 items-center gap-2 rounded-xl">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            )}
            {(permissions.canManageStock || permissions.canManageFullMenu) && (
              <TabsTrigger value="cardapio" className="flex min-h-11 items-center gap-2 rounded-xl">
                <Package className="h-4 w-4" />
                Cardápio
              </TabsTrigger>
            )}
            {permissions.canManageCrm && (
              <TabsTrigger value="pedidos" className="flex min-h-11 items-center gap-2 rounded-xl">
                <Users className="h-4 w-4" />
                CRM
              </TabsTrigger>
            )}
            {permissions.canManageCashier && (
              <TabsTrigger value="caixa" className="flex min-h-11 items-center gap-2 rounded-xl">
                <DollarSign className="h-4 w-4" />
                Caixa
              </TabsTrigger>
            )}
          </TabsList>

          {permissions.canManageSettings && (
            <TabsContent value="configuracoes" className="space-y-6">
              <ConfiguracoesCard />
              <DeliveryZonesCard />
              <AdminCredentialsCard />
              <GestoresAccessCard />
            </TabsContent>
          )}

          {(permissions.canManageStock || permissions.canManageFullMenu) && (
            <TabsContent value="cardapio">
              {permissions.canManageFullMenu ? <MarmitasManager /> : <GestorStockManager />}
            </TabsContent>
          )}

          {permissions.canManageCrm && (
            <TabsContent value="pedidos">
              <PedidosCRM />
            </TabsContent>
          )}

          {permissions.canManageCashier && (
            <TabsContent value="caixa">
              <CaixaTab />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
