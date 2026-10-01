import { GestorStockManager } from '@/components/admin/GestorStockManager';
import { MarmitasManager } from '@/components/admin/MarmitasManager';
import { useAuth } from '@/context/AuthContext';

// Cardápio: o admin edita produtos, fotos e categorias; o gestor (caixa) só ajusta o estoque.
export default function CardapioPage() {
  const { permissions } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold text-secondary">Cardápio</h1>
        <p className="text-sm text-muted-foreground">
          {permissions.canManageFullMenu ? 'Produtos, fotos, opções e categorias. As mudanças aparecem no site em até 1 minuto.' : 'Ajuste o estoque dos produtos.'}
        </p>
      </div>
      {permissions.canManageFullMenu ? <MarmitasManager /> : <GestorStockManager />}
    </div>
  );
}
