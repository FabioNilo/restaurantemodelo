export interface DeliveryFeeZone {
  taxa_quinta_sexta: number | null;
  taxa_sab_dom_feriado: number | null;
}

export interface DeliveryFeeSpecialDate {
  data: string;
  ativo: boolean | null;
}

const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatarDataLocal(data: Date | string | number) {
  return LOCAL_DATE_FORMATTER.format(new Date(data));
}

export function existeTaxaEspecialHoje(
  dataAtual: Date | string | number,
  datasEspeciais: DeliveryFeeSpecialDate[]
) {
  const localDate = formatarDataLocal(dataAtual);

  return datasEspeciais.some((item) => item.ativo !== false && item.data === localDate);
}

export function calcularTaxaEntrega(
  bairro: DeliveryFeeZone,
  dataAtual: Date | string | number,
  datasEspeciais: DeliveryFeeSpecialDate[]
) {
  const data = new Date(dataAtual);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(data);
  const isThursday = weekday === 'Thu';
  const isFriday = weekday === 'Fri';
  const isSaturday = weekday === 'Sat';
  const isSunday = weekday === 'Sun';
  const isSpecialDate = existeTaxaEspecialHoje(dataAtual, datasEspeciais);

  if (isSpecialDate || isSaturday || isSunday) {
    return bairro.taxa_sab_dom_feriado ?? null;
  }

  if (isThursday || isFriday) {
    return bairro.taxa_quinta_sexta ?? null;
  }

  return null;
}
