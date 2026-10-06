import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { fetchMesasAdmin } from '@/features/integrations/marmitas-api';
import type { MesaAdmin } from '@/features/integrations/mesas-contracts';
import { getApiErrorMessage } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import { buildMesaUrl } from '@/lib/mesa';
import { queryKeys } from '@/lib/query-keys';

function QrCartao({ mesa }: { mesa: MesaAdmin }) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    // Nível de correção "M": aguenta um pouco de sujeira/dobra no papel.
    QRCode.toString(buildMesaUrl(mesa.token), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f1f14', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [mesa.token]);

  return (
    <div className="qr-cartao flex flex-col items-center justify-between rounded-2xl border-2 border-secondary p-5 text-center">
      <div className="flex items-center gap-2">
        <img src={BRAND.logo.sm} alt="" className="h-10 w-10 rounded-full" />
        <span className="font-display text-2xl font-bold text-secondary">{BRAND.name}</span>
      </div>
      <p className="font-display text-5xl font-bold text-secondary">{mesa.nome}</p>
      <div className="h-48 w-48" aria-label={`QR code da ${mesa.nome}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="brand-caps text-[0.6rem] text-secondary">Aponte a câmera · veja o cardápio · peça daqui</p>
    </div>
  );
}

// Folha A4 com um cartão de QR code por mesa ativa, para imprimir e plastificar.
export default function MesasQrPrint() {
  const { user, loading, permissions } = useAuth();
  // ?id=3 imprime só o QR da mesa 3 (botão "QR" no cartão da mesa).
  const somenteId = Number(useSearchParams()[0].get('id')) || null;
  const navigate = useNavigate();
  const mesas = useQuery({
    queryKey: queryKeys.admin.mesas,
    queryFn: fetchMesasAdmin,
    enabled: !!user && permissions.canManageFullMenu,
  });

  if (loading) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-gold-ink" />;

  if (!user || !permissions.canManageFullMenu) {
    return (
      <p className="p-10 text-center">
        Acesso restrito. <Link to="/auth" className="underline">Entrar</Link>
      </p>
    );
  }

  const ativas = mesas.data?.filter((mesa) => mesa.ativa && (somenteId === null || mesa.id === somenteId)) ?? [];

  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print { .qr-cartao { break-inside: avoid; } }
      `}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {/* Abre na mesma aba (o painel não usa abas novas): volta para as mesas. */}
        <Button variant="ghost" onClick={() => navigate('/admin/mesas')} className="h-11 w-full justify-start px-2 sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar às mesas
        </Button>
        <div className="w-full sm:w-auto sm:flex-1">
          <h1 className="font-display text-3xl font-bold text-secondary">QR codes das mesas</h1>
          <p className="text-sm text-muted-foreground">Só as mesas ativas. Imprima em A4 (6 por folha), recorte e deixe em cada mesa.</p>
        </div>
        <Button onClick={() => window.print()} disabled={ativas.length === 0} className="h-11 w-full sm:h-10 sm:w-auto">
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      {mesas.isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-ink" />}
      {mesas.error && <p className="text-destructive">{getApiErrorMessage(mesas.error)}</p>}

      <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2 print:gap-4">
        {ativas.map((mesa) => (
          <QrCartao key={mesa.id} mesa={mesa} />
        ))}
      </div>
    </div>
  );
}
