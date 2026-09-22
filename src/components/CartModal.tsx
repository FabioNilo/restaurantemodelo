import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, MapPin, MessageCircle, Minus, Plus, QrCode, Trash2, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ProductImageFallback } from '@/components/ProductImageFallback';
import { useCart } from '@/context/CartContext';
import { createPedidoN8n, fetchDeliveryFeeN8n, fetchDeliveryZonesN8n } from '@/features/integrations/marmitas-api';
import type { DeliveryZone } from '@/features/integrations/n8n-contracts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toast } from '@/hooks/use-toast';
import { getCatalogImageSrc } from '@/lib/catalog-image';
import { buildWhatsAppUrl, DEFAULT_SITE_SETTINGS } from '@/lib/site-settings';
import type { CustomerData } from '@/types/product';
import { calcularTaxaEntrega } from '@/utils/deliveryFee';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber?: string;
}

const PAYMENT_LABELS = {
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
} as const;

interface DeliveryQuote {
  bairro: string;
  taxa: number | null;
  encontrado: boolean;
  entrega_disponivel: boolean;
  motivo_indisponivel?: string | null;
  regra_aplicada?: string | null;
  observacao?: string | null;
}

type DeliveryFeePayload = Record<string, unknown> & {
  taxa?: unknown;
  entrega_disponivel?: unknown;
};

const DELIVERY_FEE_FIELDS = [
  'taxa',
  'taxa_entrega',
  'valor_entrega',
  'delivery_fee',
  'valor_delivery',
  'fee',
] as const;

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLocaleLowerCase('pt-BR');

    if (['true', '1', 'sim', 's', 'yes'].includes(normalizedValue)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalizedValue)) return false;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return fallback;
}

function parseMoneyValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleanValue = value
    .trim()
    .replace(/[R$\s]/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsedValue = Number(cleanValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeNeighborhoodValue(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function getDeliveryFeeFromPayload(payload: DeliveryFeePayload) {
  for (const field of DELIVERY_FEE_FIELDS) {
    const parsedValue = parseMoneyValue(payload[field]);

    if (parsedValue !== null) {
      return parsedValue;
    }
  }

  return null;
}

function getZoneFeeLabel(zone: DeliveryZone) {
  return zone.bairro;
}

function findDeliveryZoneByNeighborhood(zones: DeliveryZone[], neighborhood: string) {
  const normalizedNeighborhood = normalizeNeighborhoodValue(neighborhood);

  return zones.find((zone) => normalizeNeighborhoodValue(zone.bairro) === normalizedNeighborhood) ?? null;
}

function getConfiguredDeliveryFee(zone: DeliveryZone | null) {
  if (!zone) return null;

  const legacyFee = parseMoneyValue(zone.taxa);

  if (legacyFee !== null) {
    return legacyFee;
  }

  return calcularTaxaEntrega(zone, Date.now(), []);
}

function getConfirmedDeliveryFee(quote: DeliveryQuote) {
  return quote.entrega_disponivel && quote.taxa !== null ? quote.taxa : null;
}

function isDeliveryExplicitlyUnavailable(quote: DeliveryQuote) {
  return quote.encontrado && !quote.entrega_disponivel && quote.regra_aplicada === 'sem_entrega';
}

function normalizeDeliveryQuote(rawQuote: DeliveryFeePayload, fallbackNeighborhood: string): DeliveryQuote {
  const parsedTaxa = getDeliveryFeeFromPayload(rawQuote);

  return {
    bairro: typeof rawQuote.bairro === 'string' && rawQuote.bairro.trim() ? rawQuote.bairro : fallbackNeighborhood,
    taxa: parsedTaxa,
    encontrado: parseBoolean(rawQuote.encontrado),
    entrega_disponivel: parseBoolean(rawQuote.entrega_disponivel, parsedTaxa !== null),
    motivo_indisponivel: typeof rawQuote.motivo_indisponivel === 'string' ? rawQuote.motivo_indisponivel : null,
    regra_aplicada: typeof rawQuote.regra_aplicada === 'string' ? rawQuote.regra_aplicada : null,
    observacao: typeof rawQuote.observacao === 'string' ? rawQuote.observacao : null,
  };
}

export function CartModal({
  isOpen,
  onClose,
  whatsappNumber = DEFAULT_SITE_SETTINGS.whatsapp_numero,
}: CartModalProps) {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote>({
    bairro: 'Entrega',
    taxa: null,
    encontrado: false,
    entrega_disponivel: false,
    observacao: 'Selecione o bairro para consultar a entrega de hoje',
  });
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [deliveryZonesLoading, setDeliveryZonesLoading] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState(false);
  const [deliveryFeeLoading, setDeliveryFeeLoading] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
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
  const debouncedNeighborhood = useDebouncedValue(customerData.neighborhood.trim(), 500);

  const selectedDeliveryZone = findDeliveryZoneByNeighborhood(deliveryZones, customerData.neighborhood);
  const configuredDeliveryFee = getConfiguredDeliveryFee(selectedDeliveryZone);
  const confirmedDeliveryFee = getConfirmedDeliveryFee(deliveryQuote);
  const hasCheckedDelivery =
    normalizeNeighborhoodValue(deliveryQuote.bairro) === normalizeNeighborhoodValue(customerData.neighborhood) &&
    (deliveryQuote.entrega_disponivel || Boolean(deliveryQuote.motivo_indisponivel));
  const deliveryUnavailable = hasCheckedDelivery && isDeliveryExplicitlyUnavailable(deliveryQuote);
  const effectiveDeliveryFee = !deliveryUnavailable ? (confirmedDeliveryFee ?? configuredDeliveryFee) : null;
  const deliveryFeeValue = effectiveDeliveryFee ?? 0;
  const deliveryFeePending = hasCheckedDelivery && effectiveDeliveryFee === null && !deliveryUnavailable;
  const orderTotal = totalPrice + deliveryFeeValue;
  const deliveryFeeSummaryLabel = deliveryFeeLoading
    ? 'Consultando...'
    : effectiveDeliveryFee !== null
      ? formatCurrency(effectiveDeliveryFee)
      : deliveryFeePending
        ? 'A confirmar'
        : 'Informe o bairro';
  const orderTotalSummaryLabel = deliveryFeePending ? 'A confirmar' : formatCurrency(orderTotal);

  useEffect(() => {
    if (!isOpen || step !== 'checkout' || deliveryZones.length > 0) {
      return;
    }

    let ignore = false;
    setDeliveryZonesLoading(true);
    setDeliveryZonesError(false);

    fetchDeliveryZonesN8n()
      .then((zones) => {
        if (ignore) return;
        setDeliveryZones(zones.filter((zone) => zone.ativo));
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
  }, [deliveryZones.length, isOpen, step]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setCustomerData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNeighborhoodChange = (bairro: string) => {
    setCustomerData((prev) => ({ ...prev, neighborhood: bairro }));
    setDeliveryQuote({
      bairro,
      taxa: null,
      encontrado: false,
      entrega_disponivel: false,
      observacao: null,
    });
  };

  const resolveDeliveryFee = useCallback(async (bairro: string, silent = true): Promise<DeliveryQuote> => {
    const normalizedNeighborhood = bairro.trim();

    if (!normalizedNeighborhood) {
      return deliveryQuote;
    }

    setDeliveryFeeLoading(true);

    try {
      const quote = await fetchDeliveryFeeN8n({ bairro: normalizedNeighborhood });
      const nextQuote = normalizeDeliveryQuote(quote as unknown as DeliveryFeePayload, normalizedNeighborhood);

      setDeliveryQuote(nextQuote);
      return nextQuote;
    } catch (error) {
      const fallbackQuote: DeliveryQuote = {
        bairro: normalizedNeighborhood,
        taxa: null,
        encontrado: false,
        entrega_disponivel: false,
        motivo_indisponivel: 'Não foi possível consultar a entrega agora.',
        observacao: 'Consulta indisponível',
      };

      setDeliveryQuote(fallbackQuote);

      if (!silent) {
        toast({
          title: 'Entrega indisponível',
          description: 'Não consegui consultar a taxa do bairro agora. Tente novamente em alguns instantes.',
          variant: 'destructive',
        });
      }

      return fallbackQuote;
    } finally {
      setDeliveryFeeLoading(false);
    }
  }, [deliveryQuote]);

  useEffect(() => {
    if (!isOpen || step !== 'checkout') {
      return;
    }

    if (!debouncedNeighborhood) {
      if (
        deliveryQuote.bairro === 'Entrega' &&
        deliveryQuote.taxa === null &&
        !deliveryQuote.entrega_disponivel &&
        deliveryQuote.observacao === 'Informe o bairro para consultar a entrega de hoje'
      ) {
        return;
      }

      setDeliveryQuote({
        bairro: 'Entrega',
        taxa: null,
        encontrado: false,
        entrega_disponivel: false,
        observacao: 'Informe o bairro para consultar a entrega de hoje',
      });
      return;
    }

    const hasCurrentQuote =
      normalizeNeighborhoodValue(deliveryQuote.bairro) === normalizeNeighborhoodValue(debouncedNeighborhood) &&
      (deliveryQuote.entrega_disponivel || Boolean(deliveryQuote.motivo_indisponivel));

    if (hasCurrentQuote) {
      return;
    }

    void resolveDeliveryFee(debouncedNeighborhood, true);
  }, [debouncedNeighborhood, deliveryQuote, isOpen, resolveDeliveryFee, step]);

  if (!isOpen) return null;

  const generateWhatsAppMessage = (deliveryFee: number | null, trackingUrl?: string) => {
    const finalTotal = deliveryFee === null ? null : totalPrice + deliveryFee;
    const itemsList = items
      .map((item) => {
        const size = item.tamanho_nome ? ` (${item.tamanho_nome}${item.tamanho_serve ? ` - ${item.tamanho_serve}` : ''})` : '';
        return `- ${item.quantidade}x ${item.nome}${size} - ${formatCurrency(item.preco * item.quantidade)}`;
      })
      .join('\n');

    const messageLines = [
      '*NOVO PEDIDO - Restaurante Modelo*',
      '',
      '*Cliente*',
      `Nome: ${customerData.name}`,
      `WhatsApp: ${customerData.phone}`,
      `Endereço: ${customerData.address}`,
      `Bairro: ${customerData.neighborhood}`,
      `Ponto de referência: ${customerData.complement}`,
      '',
      '*Entrega e pagamento*',
      'Tipo: Delivery',
      `Pagamento: ${PAYMENT_LABELS[customerData.paymentMethod ?? 'pix']}`,
      '',
      '*Itens do pedido*',
      itemsList,
      '',
      '*Resumo*',
      `Subtotal: ${formatCurrency(totalPrice)}`,
      `Taxa de delivery: ${deliveryFee === null ? 'A confirmar' : formatCurrency(deliveryFee)}`,
      `Total do pedido: ${finalTotal === null ? 'A confirmar' : formatCurrency(finalTotal)}`,
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
    if (!customerData.name || !customerData.phone || !customerData.address || !customerData.neighborhood || !customerData.complement?.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const finalDeliveryQuote = await resolveDeliveryFee(customerData.neighborhood, false);

    if (isDeliveryExplicitlyUnavailable(finalDeliveryQuote)) {
      setSubmitting(false);
      toast({
        title: 'Hoje não há entrega normal para este bairro',
        description: finalDeliveryQuote.motivo_indisponivel ?? 'Tente em um dia com delivery ou em uma data especial.',
        variant: 'destructive',
      });
      return;
    }

    const configuredDeliveryFee = getConfiguredDeliveryFee(findDeliveryZoneByNeighborhood(deliveryZones, customerData.neighborhood));
    const finalDeliveryFee = getConfirmedDeliveryFee(finalDeliveryQuote) ?? configuredDeliveryFee;
    const finalOrderTotal = totalPrice + (finalDeliveryFee ?? 0);
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
        taxa_entrega: finalDeliveryFee ?? undefined,
        valor_total: finalOrderTotal,
        nome_cliente: customerData.name,
        telefone_cliente: customerData.phone,
        endereco_cliente: customerData.address,
        bairro_cliente: customerData.neighborhood,
        complemento_cliente: customerData.complement.trim(),
        observacoes_cliente: customerData.observations || null,
        tipo_entrega: 'delivery',
        forma_pagamento: customerData.paymentMethod ?? 'pix',
        tracking_base_url: buildTrackingBaseUrl(),
      });

      trackingPath = getTrackingPath(pedido.id, pedido.tracking_token);
      whatsappUrl = buildWhatsAppUrl(
        whatsappNumber,
        generateWhatsAppMessage(
          finalDeliveryFee,
          pedido.tracking_url ?? (trackingPath ? `${window.location.origin}${trackingPath}` : undefined)
        )
      );
    } catch (error) {
      console.warn('Pedido seguirá pelo WhatsApp, mas não foi registrado no n8n:', error);
      toast({
        title: 'Abrindo WhatsApp',
        description: 'Não consegui registrar no sistema agora, mas seu pedido será enviado pelo WhatsApp.',
      });
    }

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
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-secondary to-[#4a0b10] p-5 text-secondary-foreground">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Restaurante Modelo</p>
            <h2 className="font-display text-2xl font-black">
              {step === 'cart' ? 'Seu carrinho' : 'Delivery'}
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
              {items.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-display text-xl font-bold">Seu carrinho está vazio</p>
                  <p className="mt-2 text-sm text-muted-foreground">Escolha um item do cardápio para continuar.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const imageSrc = getCatalogImageSrc(item.imagem_url);

                    return (
                      <div key={item.id} className="grid grid-cols-[5.5rem_1fr] gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft">
                        {imageSrc ? (
                          <img src={imageSrc} alt={item.nome} className="h-24 w-24 rounded-xl object-cover" />
                        ) : (
                          <ProductImageFallback name={item.nome} compact className="h-24 w-24 shrink-0 rounded-xl" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="font-display text-base font-black leading-tight">{item.nome}</h4>
                              {item.tamanho_nome && (
                                <p className="mt-1 text-xs font-bold text-secondary">
                                  {item.tamanho_nome} · {item.tamanho_serve}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 font-display text-lg font-black text-primary">
                              {formatCurrency(item.preco)}
                            </p>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
                              aria-label={`Diminuir ${item.nome}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center font-black">{item.quantidade}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-colors hover:bg-accent"
                              aria-label={`Aumentar ${item.nome}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                              aria-label={`Remover ${item.nome}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4">
                <div className="flex items-center gap-2 font-display text-lg font-black">
                  <Truck className="h-5 w-5 text-primary" />
                  Entrega apenas por delivery
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Retirada no local não está disponível neste pedido.
                </p>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="address">Endereço para entrega *</Label>
                <Input id="address" name="address" type="text" autoComplete="street-address" value={customerData.address} onChange={handleInputChange} placeholder="Rua, número" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  {deliveryZones.length > 0 ? (
                    <Select value={customerData.neighborhood} onValueChange={handleNeighborhoodChange}>
                      <SelectTrigger id="neighborhood" aria-label="Bairro">
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryZones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.bairro}>
                            {getZoneFeeLabel(zone)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="neighborhood"
                      name="neighborhood"
                      type="text"
                      value={customerData.neighborhood}
                      onChange={handleInputChange}
                      placeholder={deliveryZonesLoading ? 'Carregando bairros...' : 'Seu bairro'}
                      disabled={deliveryZonesLoading}
                    />
                  )}
                  <p className={`text-xs ${deliveryUnavailable ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {deliveryZonesLoading
                      ? 'Carregando bairros atendidos...'
                      : deliveryZonesError
                        ? 'Não consegui carregar a lista. Informe o bairro manualmente.'
                        : deliveryUnavailable
                            ? (deliveryQuote.motivo_indisponivel ?? 'Hoje não há entrega normal para este bairro.')
                            : hasCheckedDelivery && getConfirmedDeliveryFee(deliveryQuote) === null
                              ? 'Taxa de entrega será confirmada pelo WhatsApp.'
                            : 'Informe o bairro para finalizar o pedido.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement">Ponto de referência *</Label>
                  <Input id="complement" name="complement" type="text" value={customerData.complement} onChange={handleInputChange} placeholder="Apto, referência" />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Forma de pagamento *</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCustomerData((prev) => ({ ...prev, paymentMethod: 'pix' }))}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${customerData.paymentMethod === 'pix' ? 'border-primary bg-primary/15 shadow-soft' : 'border-border bg-card hover:border-primary/50'}`}
                  >
                    <QrCode className="h-5 w-5 text-primary" />
                    <span className="font-bold">Pix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerData((prev) => ({ ...prev, paymentMethod: 'cartao_credito' }))}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${customerData.paymentMethod === 'cartao_credito' ? 'border-primary bg-primary/15 shadow-soft' : 'border-border bg-card hover:border-primary/50'}`}
                  >
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="font-bold">Cartão de crédito</span>
                  </button>
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
                <MapPin className="h-4 w-4 text-primary" />
                Delivery
              </span>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground">Subtotal: {formatCurrency(totalPrice)}</p>
                {step === 'checkout' ? (
                  <p className="text-xs font-bold text-muted-foreground">Entrega: {deliveryFeeSummaryLabel}</p>
                ) : null}
                <span className="font-display text-3xl font-black text-primary">{orderTotalSummaryLabel}</span>
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
                  disabled={submitting || deliveryFeeLoading || deliveryUnavailable}
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
