import { AdminCredentialsCard } from '@/components/admin/AdminCredentialsCard';
import { BairrosEntregaCard } from '@/components/admin/BairrosEntregaCard';
import { ConfiguracoesCard } from '@/components/admin/ConfiguracoesCard';

// Configurações da loja (WhatsApp, horário, mensagem de fechado), bairros e
// taxas de entrega, e credenciais do admin.
export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold text-secondary">Configurações</h1>
        <p className="text-sm text-muted-foreground">WhatsApp, horário de funcionamento, bairros e taxas de entrega, e acesso ao painel.</p>
      </div>
      <ConfiguracoesCard />
      <BairrosEntregaCard />
      <AdminCredentialsCard />
    </div>
  );
}
