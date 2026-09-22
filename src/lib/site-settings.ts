export interface ConfiguracoesSite {
  id: number;
  whatsapp_numero: string;
  entregas_ativas: boolean;
  hora_abertura: string;
  hora_fechamento: string;
  dias_entrega: number[];
  mensagem_fechado: string;
  timezone: string;
  updated_at: string | null;
}

export type ConfiguracoesSiteUpdate = Partial<ConfiguracoesSite>;

export const SITE_OPEN_MESSAGE = 'Faça seu pedido, funcionamos das 11 às 22h.';
export const SITE_CLOSED_MESSAGE = 'Estamos fechados! Nosso horário é das 11 às 22h.';

export const DEFAULT_SITE_SETTINGS: ConfiguracoesSite = {
  id: 1,
  // Demo: aponta pro WhatsApp do próprio dev (mesmo número do "Desenvolvido por" no rodapé).
  // Troque para o número do restaurante antes de usar em produção.
  whatsapp_numero: '5573999099040',
  entregas_ativas: true,
  hora_abertura: '11:00:00',
  hora_fechamento: '22:00:00',
  dias_entrega: [0, 1, 2, 3, 4, 5, 6],
  mensagem_fechado: SITE_CLOSED_MESSAGE,
  timezone: 'America/Bahia',
  updated_at: new Date(0).toISOString()
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function normalizeWhatsappNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function buildWhatsAppUrl(phoneNumber: string, message?: string) {
  const normalizedNumber = normalizeWhatsappNumber(phoneNumber || DEFAULT_SITE_SETTINGS.whatsapp_numero);
  const baseUrl = `https://wa.me/${normalizedNumber}`;

  if (!message) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

export function normalizeTimeInputValue(timeValue: string) {
  return timeValue.slice(0, 5);
}

export function toDatabaseTimeValue(timeValue: string) {
  if (!timeValue) {
    return '00:00:00';
  }

  return timeValue.length === 5 ? `${timeValue}:00` : timeValue;
}

function getNowInTimezone(timezone: string, currentDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(currentDate);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);

  return {
    weekday: WEEKDAY_MAP[weekday] ?? 0,
    minutes: hour * 60 + minute
  };
}

function timeToMinutes(timeValue: string) {
  const [hours = '0', minutes = '0'] = timeValue.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isDeliveryClosed(settings: ConfiguracoesSite, currentDate = new Date()) {
  if (!settings.entregas_ativas) {
    return true;
  }

  const { weekday, minutes } = getNowInTimezone(settings.timezone || DEFAULT_SITE_SETTINGS.timezone, currentDate);
  const activeDays = settings.dias_entrega || [];

  if (!activeDays.includes(weekday)) {
    return true;
  }

  const openingMinutes = timeToMinutes(settings.hora_abertura);
  const closingMinutes = timeToMinutes(settings.hora_fechamento);

  if (closingMinutes >= openingMinutes) {
    return minutes < openingMinutes || minutes > closingMinutes;
  }

  return minutes < openingMinutes && minutes > closingMinutes;
}
