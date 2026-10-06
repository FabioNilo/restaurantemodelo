import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { CartItemsList } from '@/components/CartItemsList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/context/CartContext';
import { createPedidoMesa, createPedidoMesaAtendente } from '@/features/integrations/marmitas-api';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/api';
import { toPedidoMesaItens } from '@/lib/mesa';
import { queryKeys } from '@/lib/query-keys';

interface MesaCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  mesaNome: string;
  onVerConta: () => void;
  // Atendente logado no painel lançando o pedido: sem telefone, nome opcional, já confirmado.
  atendente?: boolean;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Carrinho da mesa (QR code): sem endereço nem WhatsApp — o pedido vai direto
// para o painel do caixa. O fluxo de delivery continua no CartModal.
export function MesaCartModal({ isOpen, onClose, token, mesaNome, onVerConta, atendente = false }: MesaCartModalProps) {
  const { items, totalPrice, clearCart } = useCart();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'cart' | 'checkout' | 'enviado'>('cart');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (step === 'enviado') setStep('cart');
    onClose();
  };

  const telefoneValido = /^\d{10,11}$/.test(telefone.replace(/\D/g, ''));
  const contatoValido = atendente || (nome.trim().length >= 2 && telefoneValido);

  const handleEnviar = async () => {
    if (!contatoValido) {
      toast({ title: 'Informe seu nome e telefone', description: 'O atendente confirma o pedido com você. Use o telefone com DDD.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const pedido = atendente
        ? await createPedidoMesaAtendente(token, {
            nome_cliente: nome.trim() || null,
            observacoes: observacoes.trim() || null,
            itens: toPedidoMesaItens(items),
          })
        : await createPedidoMesa(token, {
            nome_cliente: nome.trim(),
            telefone_cliente: telefone.replace(/\D/g, ''),
            observacoes: observacoes.trim() || null,
            itens: toPedidoMesaItens(items),
          });

      clearCart();
      setObservacoes('');
      setPedidoNumero(pedido.numero);
      setStep('enviado');
      await queryClient.invalidateQueries({ queryKey: queryKeys.public.mesa(token) });
    } catch (error) {
      toast({ title: 'Pedido não enviado', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-t-[1.75rem] border border-white/60 bg-background shadow-card animate-scale-in sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-brand-deep to-secondary p-5 text-secondary-foreground">
          <div>
            <p className="brand-caps text-[0.65rem] text-primary">{mesaNome}</p>
            <h2 className="font-display text-2xl font-black">
              {step === 'cart' ? 'Seu pedido' : step === 'checkout' ? 'Enviar para o caixa' : 'Pedido enviado'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 transition-colors hover:bg-white/20"
            aria-label="Fechar carrinho"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(88vh-210px)] overflow-y-auto p-5">
          {step === 'cart' && <CartItemsList />}

          {step === 'checkout' && (
            <div className="grid gap-5">
              <p className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-sm text-foreground">
                Seu pedido vai direto para o caixa e é servido na <strong>{mesaNome}</strong>. {atendente ? 'Pedido da equipe: entra já confirmado na comanda.' : 'O pedido só vale depois que o atendente confirmar. O pagamento é feito no caixa ao final.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="mesa-nome">{atendente ? 'Nome de quem pediu (opcional)' : 'Seu nome *'}</Label>
                <Input
                  id="mesa-nome"
                  value={nome}
                  maxLength={60}
                  required={!atendente}
                  autoComplete="given-name"
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Para chamarmos você"
                />
              </div>
              {!atendente && (
              <div className="space-y-2">
                <Label htmlFor="mesa-telefone">Seu telefone (com DDD) *</Label>
                <Input
                  id="mesa-telefone"
                  type="tel"
                  inputMode="tel"
                  value={telefone}
                  maxLength={20}
                  required
                  autoComplete="tel"
                  onChange={(event) => setTelefone(event.target.value)}
                  placeholder="(73) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">Usado só pelo atendente para confirmar seu pedido.</p>
              </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mesa-observacoes">Observações</Label>
                <Textarea
                  id="mesa-observacoes"
                  value={observacoes}
                  maxLength={300}
                  rows={3}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Ex.: sem açúcar, trazer junto com o café"
                />
              </div>
            </div>
          )}

          {step === 'enviado' && (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-secondary" aria-hidden="true" />
              <p className="mt-4 font-display text-3xl font-bold text-secondary">Pedido nº {pedidoNumero} {atendente ? 'lançado' : 'enviado'}!</p>
              <p className="mt-2 text-sm text-muted-foreground">{atendente ? 'Já está confirmado na comanda da mesa.' : 'Aguarde a confirmação do atendente. Acompanhe em "Minha conta".'}</p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="secondary"
                  className="rounded-full font-bold text-primary"
                  onClick={() => {
                    handleClose();
                    onVerConta();
                  }}
                >
                  Ver minha conta
                </Button>
                <Button variant="ghost" className="rounded-full" onClick={handleClose}>
                  Pedir mais itens
                </Button>
              </div>
            </div>
          )}
        </div>

        {step !== 'enviado' && items.length > 0 && (
          <div className="border-t border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">Total deste pedido</span>
              <span className="font-display text-3xl font-black text-gold-ink">{formatCurrency(totalPrice)}</span>
            </div>

            {step === 'cart' ? (
              <Button variant="hero" size="lg" className="w-full rounded-full font-black" onClick={() => setStep('checkout')}>
                Continuar
              </Button>
            ) : (
              <div className="space-y-3">
                <Button variant="hero" size="lg" className="w-full rounded-full font-black" onClick={handleEnviar} disabled={submitting || !contatoValido}>
                  {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                  {submitting ? 'Enviando...' : 'Enviar pedido para o caixa'}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep('cart')} disabled={submitting}>
                  Voltar ao carrinho
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
