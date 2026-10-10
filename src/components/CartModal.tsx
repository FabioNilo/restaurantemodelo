import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Landmark, Loader2, MapPin, MessageCircle, QrCode, Store, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CartItemsList } from '@/components/CartItemsList';
import { useCart } from '@/context/CartContext';
import { createPedidoN8n, fetchDeliveryZonesN8n } from '@/features/integrations/marmitas-api';
import type { DeliveryZone } from '@/features/integrations/n8n-contracts';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/api';
import { BRAND } from '@/lib/brand';
import { buildWhatsAppUrl, DEFAULT_SITE_SETTINGS } from '@/lib/site-settings';
import type { CustomerData } from '@/types/product';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber?: string;
  /** Retirada no balcão aberta agora (interruptor do admin ligado e dentro do horário). */
  retiradaDisponivel?: boolean;
}

// Formas aceitas em todo o site (src/lib/pagamentos.ts): Pix, Débito e Crédito.
const PAYMENT_LABELS = {
  pix: 'Pix',
  cartao_debito: 'Cartão de débito',
  cartao_credito: 'Cartão de crédito',
} as const;

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'Pix', icon: QrCode },
  { value: 'cartao_debito', label: 'Débito', icon: Landmark },
  { value: 'cartao_credito', label: 'Crédito', icon: CreditCard },
] as const;

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Recusas que o cliente consegue corrigir (bairro fora da lista, telefone,
// muitos pedidos seguidos): mostram o motivo e não abrem o WhatsApp.
const RECUSAS_DO_PEDIDO = [400, 409, 429];

export function CartModal({
  isOpen,
  onClose,
  whatsappNumber = DEFAULT_SITE_SETTINGS.whatsapp_numero,
  retiradaDisponivel = false,
}: CartModalProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryZonesLoading, setDeliveryZonesLoading] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState(false);
  const [deliveryZonesLoaded, setDeliveryZonesLoaded] = useState(false);
  const [deliveryZonesAttempt, setDeliveryZonesAttempt] = useState(0);
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [tipoPedido, setTipoPedido] = useState<'entrega' | 'retirada'>('entrega');
  const [submitting, setSubmitting] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    phone: '',
    address: '',
    neighborhood: '',
    complement: '',
    observations: '',
    paymentMethod: 'pix',
  });

  // Retirada no balcão: só se o admin liberou (e dentro do horário). Sem endereço, bairro nem taxa.
  const retirada = retiradaDisponivel && tipoPedido === 'retirada';

  // Bairros e taxas cadastrados em /admin/configuracoes. Só dá para pedir
  // escolhendo um bairro da lista; a taxa entra no total na hora.
  const selectedDeliveryZone = deliveryZones.find((zone) => zone.bairro === customerData.neighborhood) ?? null;
  const deliveryFee = retirada ? 0 : selectedDeliveryZone ? Number(selectedDeliveryZone.taxa ?? selectedDeliveryZone.taxa_quinta_sexta ?? 0) : null;
  const orderTotal = totalPrice + (deliveryFee ?? 0);
  const noDeliveryZones = deliveryZonesLoaded && deliveryZones.length === 0;
  const deliveryFeeSummaryLabel =
    retirada ? 'Sem taxa' : deliveryFee === null ? 'Escolha o bairro' : deliveryFee === 0 ? 'Grátis' : formatCurrency(deliveryFee);

  useEffect(() => {
    if (!isOpen || step !== 'checkout') {
      return;
    }

    let ignore = false;
    setDeliveryZonesLoading(true);
    setDeliveryZonesError(false);

    fetchDeliveryZonesN8n()
      .then((zones) => {
        if (ignore) return;
        const ativas = zones.filter((zone) => zone.ativo);
        setDeliveryZones(ativas);
        setDeliveryZonesLoaded(true);
        // Bairro escolhido antes e depois pausado: limpa a escolha.
        setCustomerData((prev) =>
          prev.neighborhood && !ativas.some((zone) => zone.bairro === prev.neighborhood) ? { ...prev, neighborhood: '' } : prev
        );
      })
      .catch(() => {
        if (ignore) return;
        setDeliveryZonesError(true);
      })
      .finally(() => {
        if (!ignore) setDeliveryZonesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [deliveryZonesAttempt, isOpen, step]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setCustomerData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNeighborhoodChange = (bairro: string) => {
    setCustomerData((prev) => ({ ...prev, neighborhood: bairro }));
  };

  if (!isOpen) return null;

  const generateWhatsAppMessage = (deliveryFee: number, trackingUrl?: string) => {
    const finalTotal = totalPrice + deliveryFee;
    const itemsList = items
      .map((item) => {
        const size = item.tamanho_nome ? ` (${item.tamanho_nome}${item.tamanho_serve ? ` - ${item.tamanho_serve}` : ''})` : '';
        return `- ${item.quantidade}x ${item.nome}${size} - ${formatCurrency(item.preco * item.quantidade)}`;
      })
      .join('\n');

    const messageLines = [
      `*NOVO PEDIDO - ${BRAND.name}*`,
      '',
      '*Cliente*',
      `Nome: ${customerData.name}`,
      `WhatsApp: ${customerData.phone}`,
      ...(retirada
        ? []
        : [`Endereço: ${customerData.address}`, `Bairro: ${customerData.neighborhood}`, `Ponto de referência: ${customerData.complement}`]),
      '',
      retirada ? '*Retirada e pagamento*' : '*Entrega e pagamento*',
      retirada ? 'Tipo: Retirada no balcão (pagamento na retirada)' : 'Tipo: Delivery',
      `Pagamento: ${PAYMENT_LABELS[customerData.paymentMethod ?? 'pix']}`,
      '',
      '*Itens do pedido*',
      itemsList,
      '',
      '*Resumo*',
      `Subtotal: ${formatCurrency(totalPrice)}`,
      ...(retirada ? [] : [`Taxa de entrega (${customerData.neighborhood}): ${formatCurrency(deliveryFee)}`]),
      `Total do pedido: ${formatCurrency(finalTotal)}`,
    ];

    if (trackingUrl) {
      messageLines.push('', '*Acompanhe seu pedido*', trackingUrl);
    }

    if (customerData.observations) {
      messageLines.push('', '*Observações*', customerData.observations);
    }

    messageLines.push('', 'Agradecemos seu pedido!');

    return messageLines.join('\n');
  };

  const buildTrackingBaseUrl = () => `${window.location.origin}/pedido`;

  const getTrackingPath = (id: string, token?: string) => {
    if (!token) return null;
    return `/pedido/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`;
  };

  const handleSubmitOrder = async () => {
    const faltaDado = retirada
      ? !customerData.name || !customerData.phone
      : !customerData.name || !customerData.phone || !customerData.address || !customerData.complement?.trim();

    if (faltaDado) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!retirada && (!selectedDeliveryZone || deliveryFee === null)) {
      toast({
        title: 'Escolha o bairro',
        description: 'Selecione o bairro de entrega na lista para ver a taxa e finalizar o pedido.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    let finalDeliveryFee = deliveryFee;
    let whatsappUrl = buildWhatsAppUrl(whatsappNumber, generateWhatsAppMessage(finalDeliveryFee));
    let trackingPath: string | null = null;

    try {
      const pedidoItens = items.map((item) => ({
        id: item.id,
        nome: item.nome,
        preco: item.preco,
        quantidade: item.quantidade,
        tamanho_codigo: item.tamanho_codigo,
        tamanho_nome: item.tamanho_nome,
        tamanho_serve: item.tamanho_serve,
      }));

      const pedido = await createPedidoN8n({
        itens: pedidoItens,
        subtotal: totalPrice,
        taxa_entrega: finalDeliveryFee,
        valor_total: orderTotal,
        nome_cliente: customerData.name,
        telefone_cliente: customerData.phone,
        ...(retirada
          ? {}
          : {
              endereco_cliente: customerData.address,
              bairro_cliente: selectedDeliveryZone!.bairro,
              complemento_cliente: customerData.complement?.trim(),
            }),
        observacoes_cliente: customerData.observations || null,
        tipo_entrega: retirada ? 'retirada' : 'delivery',
        forma_pagamento: customerData.paymentMethod ?? 'pix',
        tracking_base_url: buildTrackingBaseUrl(),
      });

      // A taxa que vale é a do servidor (cadastro do bairro).
      if (typeof pedido.taxa_entrega === 'number') finalDeliveryFee = pedido.taxa_entrega;
      trackingPath = getTrackingPath(pedido.id, pedido.tracking_token);
      whatsappUrl = buildWhatsAppUrl(
        whatsappNumber,
        generateWhatsAppMessage(
          finalDeliveryFee,
          pedido.tracking_url ?? (trackingPath ? `${window.location.origin}${trackingPath}` : undefined)
        )
      );
    } catch (error) {
      const status = getApiErrorStatus(error);

      if (status !== undefined && RECUSAS_DO_PEDIDO.includes(status)) {
        setSubmitting(false);
        toast({ title: 'Não foi possível enviar o pedido', description: getApiErrorMessage(error), variant: 'destructive' });

        // Bairro pausado enquanto o cliente preenchia: recarrega a lista.
        if (status === 400 && !retirada) setDeliveryZonesAttempt((n) => n + 1);
        return;
      }

      console.warn('Pedido seguirá pelo WhatsApp, mas não foi registrado no sistema:', error);
      toast({
        title: 'Abrindo WhatsApp',
        description: 'Não consegui registrar no sistema agora, mas seu pedido será enviado pelo WhatsApp.',
      });
    }

    setSubmitting(false);
    clearCart();
    setStep('cart');
    setCustomerData({
      name: '',
      phone: '',
      address: '',
      neighborhood: '',
      complement: '',
      observations: '',
      paymentMethod: 'pix',
    });
    onClose();

    toast({
      title: 'Pedido pronto para envio!',
      description: 'Abrindo o WhatsApp para você confirmar.',
    });

    // Navegação direta e síncrona (sem window.open/aba nova, sem setTimeout):
    // no Safari do iOS, abrir outro app (o WhatsApp) só é permitido enquanto
    // a navegação ainda está ligada à ativação do toque do usuário — um
    // setTimeout (mesmo curto) já quebra esse vínculo e o WhatsApp
    // simplesmente não abre, sem erro nenhum. O link de acompanhamento já
    // vai dentro da própria mensagem do WhatsApp.
    window.location.assign(whatsappUrl);
  };

  const handleClose = () => {
    setStep('cart');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-white/60 bg-background shadow-card animate-scale-in">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-brand-deep to-secondary p-5 text-secondary-foreground">
          <div>
            <p className="brand-caps text-[0.65rem] text-primary">{BRAND.name}</p>
            <h2 className="font-display text-2xl font-black">
              {step === 'cart' ? 'Seu carrinho' : retirada ? 'Retirada no balcão' : 'Delivery'}
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

        <div className="max-h-[calc(92vh-210px)] overflow-y-auto p-5">
          {step === 'cart' ? (
            <>
              <CartItemsList />
            </>
          ) : (
            <div className="grid gap-5">
              {retiradaDisponivel ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3" role="group" aria-label="Como você quer receber">
                    {(
                      [
                        { value: 'entrega', label: 'Entrega', detalhe: 'Receba em casa', icon: Truck },
                        { value: 'retirada', label: 'Retirada no balcão', detalhe: 'Sem taxa de entrega', icon: Store },
                      ] as const
                    ).map(({ value, label, detalhe, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={tipoPedido === value}
                        onClick={() => setTipoPedido(value)}
                        className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all sm:p-4 ${tipoPedido === value ? 'border-primary bg-primary/15 shadow-soft' : 'border-border bg-card hover:border-primary/50'}`}
                      >
                        <span className="flex items-center gap-2 font-display text-base font-black sm:text-lg">
                          <Icon className="h-5 w-5 text-gold-ink" />
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground">{detalhe}</span>
                      </button>
                    ))}
                  </div>
                  {retirada && (
                    <p className="text-sm text-muted-foreground">Você retira e paga no balcão. Avisamos pelo WhatsApp quando estiver pronto.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4">
                  <div className="flex items-center gap-2 font-display text-lg font-black">
                    <Truck className="h-5 w-5 text-gold-ink" />
                    Entrega apenas por delivery
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Retirada no local não está disponível neste pedido.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" name="name" type="text" autoComplete="name" value={customerData.name} onChange={handleInputChange} placeholder="Seu nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                  <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={customerData.phone} onChange={handleInputChange} placeholder="(73) 99999-9999" />
                </div>
              </div>

              {!retirada && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço para entrega *</Label>
                    <Input id="address" name="address" type="text" autoComplete="street-address" value={customerData.address} onChange={handleInputChange} placeholder="Rua, número" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Select value={customerData.neighborhood} onValueChange={handleNeighborhoodChange} disabled={deliveryZones.length === 0}>
                        <SelectTrigger id="neighborhood" aria-label="Bairro">
                          <SelectValue placeholder={deliveryZonesLoading && deliveryZones.length === 0 ? 'Carregando bairros...' : 'Selecione o bairro'} />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryZones.map((zone) => (
                            <SelectItem key={zone.id} value={zone.bairro}>
                              {zone.bairro} — {Number(zone.taxa ?? 0) === 0 ? 'entrega grátis' : formatCurrency(Number(zone.taxa ?? 0))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {deliveryZonesError ? (
                        <p className="text-xs text-destructive">
                          Não consegui carregar os bairros atendidos.{' '}
                          <button type="button" className="font-bold underline" onClick={() => setDeliveryZonesAttempt((n) => n + 1)}>
                            Tentar de novo
                          </button>
                        </p>
                      ) : noDeliveryZones ? (
                        <p className="text-xs text-destructive">No momento não há bairros com entrega disponível. Fale conosco pelo WhatsApp.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {deliveryZonesLoading && deliveryZones.length === 0
                            ? 'Carregando bairros atendidos...'
                            : selectedDeliveryZone
                              ? `Taxa de entrega para ${selectedDeliveryZone.bairro}: ${deliveryFeeSummaryLabel}`
                              : 'Entregamos apenas nos bairros da lista.'}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complement">Ponto de referência *</Label>
                      <Input id="complement" name="complement" type="text" value={customerData.complement} onChange={handleInputChange} placeholder="Apto, referência" />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-3">
                <Label>Forma de pagamento *</Label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={customerData.paymentMethod === value}
                      onClick={() => setCustomerData((prev) => ({ ...prev, paymentMethod: value }))}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all sm:flex-row sm:gap-3 sm:p-4 sm:text-left ${customerData.paymentMethod === value ? 'border-primary bg-primary/15 shadow-soft' : 'border-border bg-card hover:border-primary/50'}`}
                    >
                      <Icon className="h-5 w-5 text-gold-ink" />
                      <span className="font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea id="observations" name="observations" value={customerData.observations} onChange={handleInputChange} placeholder="Alguma observação sobre o pedido?" rows={3} />
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                {retirada ? <Store className="h-4 w-4 text-gold-ink" /> : <MapPin className="h-4 w-4 text-gold-ink" />}
                {retirada ? 'Retirada no balcão' : 'Delivery'}
              </span>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground">Subtotal: {formatCurrency(totalPrice)}</p>
                {step === 'checkout' ? (
                  <p className="text-xs font-bold text-muted-foreground">{retirada ? 'Retirada' : 'Entrega'}: {deliveryFeeSummaryLabel}</p>
                ) : null}
                <span className="font-display text-3xl font-black text-gold-ink">{formatCurrency(step === 'checkout' ? orderTotal : totalPrice)}</span>
              </div>
            </div>

            {step === 'cart' ? (
              <Button variant="hero" size="lg" className="w-full rounded-full font-black" onClick={() => setStep('checkout')}>
                Finalizar pedido
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full rounded-full font-black"
                  onClick={handleSubmitOrder}
                  disabled={submitting || (!retirada && !selectedDeliveryZone)}
                >
                  {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageCircle className="mr-2 h-5 w-5" />}
                  {submitting ? 'Enviando...' : 'Enviar pedido no WhatsApp'}
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
