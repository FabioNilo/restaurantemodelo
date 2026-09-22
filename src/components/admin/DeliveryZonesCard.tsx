import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTaxasEntrega } from '@/hooks/useTaxasEntrega';
import type { DeliverySpecialDate, DeliveryZone } from '@/features/integrations/n8n-contracts';

interface EditableZone {
  bairro: string;
  zona: string;
  taxa_quinta_sexta: string;
  taxa_sab_dom_feriado: string;
  ativo: boolean;
  observacao: string;
}

interface EditableSpecialDate {
  data: string;
  descricao: string;
  ativo: boolean;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

function currencyToInput(value: number | null | undefined) {
  return String(Number(value ?? 0).toFixed(2)).replace('.', ',');
}

function zoneToForm(zone: DeliveryZone): EditableZone {
  const legacyTaxa = zone.taxa ?? 0;

  return {
    bairro: zone.bairro,
    zona: zone.zona ?? '',
    taxa_quinta_sexta: currencyToInput(zone.taxa_quinta_sexta ?? legacyTaxa),
    taxa_sab_dom_feriado: currencyToInput(zone.taxa_sab_dom_feriado ?? legacyTaxa),
    ativo: zone.ativo,
    observacao: zone.observacao ?? '',
  };
}

function specialDateToForm(item: DeliverySpecialDate): EditableSpecialDate {
  return {
    data: item.data,
    descricao: item.descricao ?? '',
    ativo: item.ativo,
  };
}

export function DeliveryZonesCard() {
  const { toast } = useToast();
  const {
    taxas,
    datasEspeciais,
    loading,
    error,
    creating,
    updating,
    deleting,
    creatingSpecialDate,
    updatingSpecialDate,
    deletingSpecialDate,
    createTaxa,
    updateTaxa,
    deleteTaxa,
    createSpecialDate,
    updateSpecialDate,
    deleteSpecialDate,
  } = useTaxasEntrega();
  const [drafts, setDrafts] = useState<Record<number, EditableZone>>({});
  const [specialDateDrafts, setSpecialDateDrafts] = useState<Record<number, EditableSpecialDate>>({});
  const [newZone, setNewZone] = useState<EditableZone>({
    bairro: '',
    zona: '',
    taxa_quinta_sexta: '',
    taxa_sab_dom_feriado: '',
    ativo: true,
    observacao: '',
  });
  const [newSpecialDate, setNewSpecialDate] = useState<EditableSpecialDate>({
    data: '',
    descricao: '',
    ativo: true,
  });

  useEffect(() => {
    setDrafts(Object.fromEntries(taxas.map((taxa) => [taxa.id, zoneToForm(taxa)])));
  }, [taxas]);

  useEffect(() => {
    setSpecialDateDrafts(Object.fromEntries(datasEspeciais.map((item) => [item.id, specialDateToForm(item)])));
  }, [datasEspeciais]);

  const parseZoneDraft = (draft: EditableZone) => {
    const taxaQuintaSexta = parseCurrencyInput(draft.taxa_quinta_sexta);
    const taxaSabDomFeriado = parseCurrencyInput(draft.taxa_sab_dom_feriado);

    if (!draft.bairro.trim() || !Number.isFinite(taxaQuintaSexta) || !Number.isFinite(taxaSabDomFeriado)) {
      return null;
    }

    if (taxaQuintaSexta < 0 || taxaSabDomFeriado < 0) {
      return null;
    }

    return {
      bairro: draft.bairro.trim(),
      zona: draft.zona.trim() || null,
      taxa_quinta_sexta: taxaQuintaSexta,
      taxa_sab_dom_feriado: taxaSabDomFeriado,
      ativo: draft.ativo,
      observacao: draft.observacao.trim() || null,
    };
  };

  const saveNewZone = async () => {
    const parsed = parseZoneDraft(newZone);

    if (!parsed) {
      toast({
        title: 'Dados incompletos',
        description: 'Informe bairro e taxas válidas para quinta/sexta e sábado/domingo/feriado.',
        variant: 'destructive',
      });
      return;
    }

    await createTaxa(parsed);

    setNewZone({
      bairro: '',
      zona: '',
      taxa_quinta_sexta: '',
      taxa_sab_dom_feriado: '',
      ativo: true,
      observacao: '',
    });
    toast({
      title: 'Bairro salvo',
      description: 'As novas regras já podem ser usadas no carrinho.',
    });
  };

  const saveExistingZone = async (id: number) => {
    const draft = drafts[id];
    const parsed = draft ? parseZoneDraft(draft) : null;

    if (!parsed) {
      toast({
        title: 'Dados incompletos',
        description: 'Confira o bairro e as taxas de entrega.',
        variant: 'destructive',
      });
      return;
    }

    await updateTaxa(id, parsed);

    toast({
      title: 'Taxas atualizadas',
      description: 'O carrinho usará esses valores na próxima seleção.',
    });
  };

  const deactivateZone = async (id: number) => {
    await deleteTaxa(id);
    toast({
      title: 'Bairro desativado',
      description: 'Ele não aparecerá mais na seleção pública.',
    });
  };

  const saveNewSpecialDate = async () => {
    if (!newSpecialDate.data) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe a data especial que deve cobrar como feriado.',
        variant: 'destructive',
      });
      return;
    }

    await createSpecialDate({
      data: newSpecialDate.data,
      descricao: newSpecialDate.descricao.trim() || null,
      ativo: newSpecialDate.ativo,
    });

    setNewSpecialDate({ data: '', descricao: '', ativo: true });
    toast({
      title: 'Data especial salva',
      description: 'Nesse dia, o carrinho cobrará a taxa de sábado/domingo/feriado.',
    });
  };

  const saveExistingSpecialDate = async (id: number) => {
    const draft = specialDateDrafts[id];

    if (!draft?.data) {
      toast({
        title: 'Data obrigatória',
        description: 'Informe uma data válida.',
        variant: 'destructive',
      });
      return;
    }

    await updateSpecialDate(id, {
      data: draft.data,
      descricao: draft.descricao.trim() || null,
      ativo: draft.ativo,
    });

    toast({ title: 'Data especial atualizada' });
  };

  const removeSpecialDate = async (id: number) => {
    await deleteSpecialDate(id);
    toast({ title: 'Data especial excluída' });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <MapPin className="h-5 w-5 text-primary" />
          Bairros e taxas de entrega
        </CardTitle>
        <CardDescription>
          Configure taxas por dia da semana e datas especiais que devem cobrar como feriado.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-border bg-background/70 p-4 lg:grid-cols-[1fr_0.7fr_0.55fr_0.55fr_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="novo-bairro">Novo bairro</Label>
              <Input
                id="novo-bairro"
                value={newZone.bairro}
                onChange={(event) => setNewZone((current) => ({ ...current, bairro: event.target.value }))}
                placeholder="Ex.: Pontal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-zona">Zona</Label>
              <Input
                id="nova-zona"
                value={newZone.zona}
                onChange={(event) => setNewZone((current) => ({ ...current, zona: event.target.value }))}
                placeholder="Sul"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-taxa-qs">Qui/Sex</Label>
              <Input
                id="nova-taxa-qs"
                type="text"
                inputMode="decimal"
                value={newZone.taxa_quinta_sexta}
                onChange={(event) => setNewZone((current) => ({ ...current, taxa_quinta_sexta: event.target.value }))}
                placeholder="8,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-taxa-feriado">Sáb/Dom/Feriado</Label>
              <Input
                id="nova-taxa-feriado"
                type="text"
                inputMode="decimal"
                value={newZone.taxa_sab_dom_feriado}
                onChange={(event) => setNewZone((current) => ({ ...current, taxa_sab_dom_feriado: event.target.value }))}
                placeholder="10,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-observacao">Observação</Label>
              <Input
                id="nova-observacao"
                value={newZone.observacao}
                onChange={(event) => setNewZone((current) => ({ ...current, observacao: event.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <Button onClick={saveNewZone} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="space-y-3">
              {taxas.map((zone) => {
                const draft = drafts[zone.id] ?? zoneToForm(zone);

                return (
                  <div
                    key={zone.id}
                    className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 lg:grid-cols-[1fr_0.7fr_0.55fr_0.55fr_1fr_auto_auto] lg:items-center"
                  >
                    <Input
                      aria-label={`Bairro ${zone.bairro}`}
                      value={draft.bairro}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...draft, bairro: event.target.value },
                        }))
                      }
                    />

                    <Input
                      aria-label={`Zona ${zone.bairro}`}
                      value={draft.zona}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...draft, zona: event.target.value },
                        }))
                      }
                      placeholder="Zona"
                    />

                    <Input
                      aria-label={`Taxa quinta sexta ${zone.bairro}`}
                      type="text"
                      inputMode="decimal"
                      value={draft.taxa_quinta_sexta}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...draft, taxa_quinta_sexta: event.target.value },
                        }))
                      }
                    />

                    <Input
                      aria-label={`Taxa feriado ${zone.bairro}`}
                      type="text"
                      inputMode="decimal"
                      value={draft.taxa_sab_dom_feriado}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...draft, taxa_sab_dom_feriado: event.target.value },
                        }))
                      }
                    />

                    <Input
                      aria-label={`Observação ${zone.bairro}`}
                      value={draft.observacao}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...draft, observacao: event.target.value },
                        }))
                      }
                      placeholder="Observação"
                    />

                    <div className="flex items-center justify-between gap-3 lg:justify-center">
                      <Badge variant={draft.ativo ? 'default' : 'secondary'}>
                        {draft.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Switch
                        checked={draft.ativo}
                        aria-label={`Ativar ${zone.bairro}`}
                        onCheckedChange={(checked) =>
                          setDrafts((current) => ({
                            ...current,
                            [zone.id]: { ...draft, ativo: checked },
                          }))
                        }
                      />
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveExistingZone(zone.id)}
                        disabled={updating}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Salvar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deactivateZone(zone.id)}
                        disabled={deleting || !zone.ativo}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Desativar
                      </Button>
                    </div>
                  </div>
                );
              })}

              {taxas.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  Nenhum bairro cadastrado ainda. Adicione o primeiro bairro para liberar a seleção no carrinho.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t pt-6">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <CalendarDays className="h-5 w-5 text-primary" />
              Datas especiais
            </h3>
            <p className="text-sm text-muted-foreground">
              Cadastre datas específicas que devem cobrar como sábado/domingo/feriado.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-background/70 p-4 lg:grid-cols-[0.45fr_1fr_auto_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="nova-data-especial">Data</Label>
              <Input
                id="nova-data-especial"
                type="date"
                value={newSpecialDate.data}
                onChange={(event) => setNewSpecialDate((current) => ({ ...current, data: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-data-descricao">Descrição</Label>
              <Input
                id="nova-data-descricao"
                value={newSpecialDate.descricao}
                onChange={(event) => setNewSpecialDate((current) => ({ ...current, descricao: event.target.value }))}
                placeholder="Ex.: Feriado - Independência da Bahia"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
              <Badge variant={newSpecialDate.ativo ? 'default' : 'secondary'}>
                {newSpecialDate.ativo ? 'Ativa' : 'Inativa'}
              </Badge>
              <Switch
                checked={newSpecialDate.ativo}
                aria-label="Ativar nova data especial"
                onCheckedChange={(checked) => setNewSpecialDate((current) => ({ ...current, ativo: checked }))}
              />
            </div>
            <Button onClick={saveNewSpecialDate} disabled={creatingSpecialDate} className="gap-2">
              {creatingSpecialDate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            {datasEspeciais.map((item) => {
              const draft = specialDateDrafts[item.id] ?? specialDateToForm(item);

              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 lg:grid-cols-[0.45fr_1fr_auto_auto] lg:items-center"
                >
                  <Input
                    aria-label={`Data especial ${item.data}`}
                    type="date"
                    value={draft.data}
                    onChange={(event) =>
                      setSpecialDateDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, data: event.target.value },
                      }))
                    }
                  />
                  <Input
                    aria-label={`Descrição ${item.data}`}
                    value={draft.descricao}
                    onChange={(event) =>
                      setSpecialDateDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, descricao: event.target.value },
                      }))
                    }
                    placeholder="Descrição"
                  />
                  <div className="flex items-center justify-between gap-3 lg:justify-center">
                    <Badge variant={draft.ativo ? 'default' : 'secondary'}>
                      {draft.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Switch
                      checked={draft.ativo}
                      aria-label={`Ativar data especial ${item.data}`}
                      onCheckedChange={(checked) =>
                        setSpecialDateDrafts((current) => ({
                          ...current,
                          [item.id]: { ...draft, ativo: checked },
                        }))
                      }
                    />
                  </div>
                  <div className="flex gap-2 lg:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveExistingSpecialDate(item.id)}
                      disabled={updatingSpecialDate}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSpecialDate(item.id)}
                      disabled={deletingSpecialDate}
                      className="gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}

            {datasEspeciais.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nenhuma data especial cadastrada.
              </p>
            )}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Quinta e sexta usam a taxa da semana. Sábado, domingo e datas especiais usam a taxa de feriado. Segunda a quarta sem data especial não liberam delivery.
        </p>
      </CardContent>
    </Card>
  );
}
