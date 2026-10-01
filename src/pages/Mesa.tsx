import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, ReceiptText, ShoppingCart } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ProductsSection } from '@/components/ProductsSection';
import { MesaCartModal } from '@/components/mesa/MesaCartModal';
import { MinhaContaSheet } from '@/components/mesa/MinhaContaSheet';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useMesaQuery } from '@/hooks/useMesaQuery';
import { getApiErrorMessage } from '@/lib/api';
import { BRAND } from '@/lib/brand';

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Cardápio aberto pelo QR code da mesa (/mesa/:token): os pedidos vão direto
// para o painel do caixa, sem WhatsApp. Sem hero/sobre para abrir rápido.
export default function Mesa() {
  const { token = '' } = useParams();
  const { data, isLoading, error } = useMesaQuery(token);
  const { totalItems, totalPrice } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [contaOpen, setContaOpen] = useState(false);

  const mesa = data?.mesa;
  const podePedir = Boolean(mesa?.ativa);
  const aviso = error
    ? getApiErrorMessage(error, 'Não encontramos esta mesa. Peça ajuda no caixa.')
    : mesa && !mesa.ativa
      ? 'Esta mesa não está recebendo pedidos pelo celular agora. Faça seu pedido no caixa.'
      : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header onCartClick={() => setCartOpen(true)} mesaLabel={mesa?.nome ?? 'Mesa'} />

      <main className="pt-[4.25rem] md:pt-16">
        <section className="bg-brand-deep text-secondary-foreground">
          <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img src={BRAND.logo.sm} alt="" aria-hidden="true" width={56} height={56} className="h-14 w-14 rounded-full ring-1 ring-primary/50" />
              <div>
                <p className="brand-caps text-[0.65rem] text-primary">Pedido na mesa</p>
                <h1 className="font-display text-4xl font-bold text-primary">{isLoading ? '…' : mesa?.nome ?? 'Mesa'}</h1>
                <p className="text-sm text-secondary-foreground/75">Escolha no cardápio: o pedido vai direto para o caixa. Pague no caixa ao sair.</p>
              </div>
            </div>
            {data?.conta && (
              <Button variant="outline" className="rounded-full border-primary/50 bg-white/5 text-primary hover:text-primary-foreground" onClick={() => setContaOpen(true)}>
                <ReceiptText className="mr-2 h-4 w-4" />
                Minha conta · {formatCurrency(data.conta.total)}
              </Button>
            )}
          </div>

          {aviso && (
            <div className="container mx-auto px-4 pb-5">
              <p className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {aviso}
              </p>
            </div>
          )}
        </section>

        <ProductsSection modoMesa />
      </main>

      <Footer />

      {/* Barra inferior no celular: carrinho e conta sempre à mão. */}
      {podePedir && (totalItems > 0 || data?.conta) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/30 bg-brand-deep/95 p-3 backdrop-blur">
          <div className="container mx-auto flex gap-2 px-1">
            {data?.conta && (
              <Button variant="outline" className="flex-1 rounded-full border-primary/50 bg-white/5 text-primary hover:text-primary-foreground" onClick={() => setContaOpen(true)}>
                <ReceiptText className="mr-2 h-4 w-4" />
                Minha conta
              </Button>
            )}
            {totalItems > 0 && (
              <Button variant="hero" className="flex-[2] rounded-full font-bold" onClick={() => setCartOpen(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Ver pedido ({totalItems}) · {formatCurrency(totalPrice)}
              </Button>
            )}
          </div>
        </div>
      )}

      {podePedir && mesa && (
        <MesaCartModal
          isOpen={cartOpen}
          onClose={() => setCartOpen(false)}
          token={token}
          mesaNome={mesa.nome}
          onVerConta={() => setContaOpen(true)}
        />
      )}

      {!podePedir && cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setCartOpen(false)}>
          <p className="max-w-sm rounded-2xl bg-background p-6 text-center text-sm">{aviso ?? 'Carregando a mesa…'}</p>
        </div>
      )}

      <MinhaContaSheet token={token} open={contaOpen} onOpenChange={setContaOpen} />
    </div>
  );
}
