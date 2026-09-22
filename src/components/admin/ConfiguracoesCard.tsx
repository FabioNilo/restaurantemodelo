import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Loader2,
  MessageSquareText,
  Phone,
  Power,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useConfiguracoesSite } from '@/hooks/useConfiguracoesSite';
import {
  DEFAULT_SITE_SETTINGS,
  SITE_OPEN_MESSAGE,
  isDeliveryClosed,
  normalizeTimeInputValue,
  toDatabaseTimeValue,
  type ConfiguracoesSite
} from '@/lib/site-settings';
import { cn } from '@/lib/utils';

const DELIVERY_DAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 }
];

export function ConfiguracoesCard() {
  const { toast } = useToast();
  const { settings, loading, saving, error, saveSettings } = useConfiguracoesSite();
  const [form, setForm] = useState<ConfiguracoesSite>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const deliveryClosed = isDeliveryClosed(form);

  const toggleDay = (dayValue: number) => {
    setForm((current) => {
      const hasDay = current.dias_entrega.includes(dayValue);
      const nextDays = hasDay
        ? current.dias_entrega.filter((day) => day !== dayValue)
        : [...current.dias_entrega, dayValue].sort((left, right) => left - right);

      return {
        ...current,
        dias_entrega: nextDays
      };
    });
  };

  const handleSave = async () => {
    if (!form.whatsapp_numero.trim()) {
      toast({
        title: 'WhatsApp obrigatório',
        description: 'Informe o número que será usado nos links do site.',
        variant: 'destructive'
      });
      return;
    }

    if (!form.mensagem_fechado.trim()) {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Informe a mensagem exibida quando as entregas estiverem fechadas.',
        variant: 'destructive'
      });
      return;
    }

    if (form.dias_entrega.length === 0) {
      toast({
        title: 'Selecione ao menos um dia',
        description: 'Escolha os dias em que a entrega pode ficar disponível.',
        variant: 'destructive'
      });
      return;
    }

    const result = await saveSettings({
      entregas_ativas: form.entregas_ativas,
      whatsapp_numero: form.whatsapp_numero,
      hora_abertura: toDatabaseTimeValue(form.hora_abertura),
      hora_fechamento: toDatabaseTimeValue(form.hora_fechamento),
      dias_entrega: form.dias_entrega,
      mensagem_fechado: form.mensagem_fechado,
      timezone: DEFAULT_SITE_SETTINGS.timezone
    });

    if (result.success) {
      toast({
        title: 'Configurações salvas',
        description: 'O site e o n8n já podem usar os novos valores.'
      });
      return;
    }

    toast({
      title: 'Erro ao salvar',
      description: 'Não foi possível atualizar as configurações.',
      variant: 'destructive'
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">Configurações</CardTitle>
            <CardDescription>
              Ajuste o WhatsApp, o horário padrão, os dias de entrega e o aviso discreto exibido na home.
            </CardDescription>
          </div>
          <Badge
            variant={deliveryClosed ? 'secondary' : 'default'}
            className={cn(
              'w-fit px-3 py-1 text-xs',
              deliveryClosed
                ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
            )}
          >
            {deliveryClosed ? 'Fechado agora' : 'Aberto agora'}
          </Badge>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Pedidos continuam sendo enviados do site para o WhatsApp. Essas configurações controlam o aviso na home,
          o número de celular que será enviado o resumo do pedido.
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Power className="h-4 w-4 text-primary" />
                        Entregas ativas
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Use o interruptor para pausar ou liberar entregas manualmente.
                      </p>
                    </div>
                    <Switch
                      checked={form.entregas_ativas}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          entregas_ativas: checked
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site-whatsapp" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    WhatsApp do site
                  </Label>
                  <Input
                    id="site-whatsapp"
                    type="tel"
                    inputMode="tel"
                    value={form.whatsapp_numero}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        whatsapp_numero: event.target.value
                      }))
                    }
                    placeholder="5573999542245"
                  />
                  <p className="text-xs text-muted-foreground">
                    Esse número será usado no rodapé e no botão de envio do pedido.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hora-abertura" className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Horário de abertura
                    </Label>
                    <Input
                      id="hora-abertura"
                      type="time"
                      value={normalizeTimeInputValue(form.hora_abertura)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hora_abertura: event.target.value
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hora-fechamento" className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Horário de fechamento
                    </Label>
                    <Input
                      id="hora-fechamento"
                      type="time"
                      value={normalizeTimeInputValue(form.hora_fechamento)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hora_fechamento: event.target.value
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Dias com entrega
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_DAYS.map((day) => {
                      const isActive = form.dias_entrega.includes(day.value);

                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={isActive ? 'default' : 'outline'}
                          size="sm"
                          className={cn(!isActive && 'text-muted-foreground')}
                          onClick={() => toggleDay(day.value)}
                        >
                          {day.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fuso fixo usado nos cálculos: America/Bahia.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mensagem-fechado" className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    Mensagem quando fechado
                  </Label>
                  <Textarea
                    id="mensagem-fechado"
                    rows={4}
                    value={form.mensagem_fechado}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mensagem_fechado: event.target.value
                      }))
                    }
                    placeholder="Estamos fechados! Nosso horário é de quinta a domingo, das 11 às 22h."
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Preview do aviso</p>
                <p className="text-sm text-muted-foreground">
                  {deliveryClosed ? form.mensagem_fechado : SITE_OPEN_MESSAGE}
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
