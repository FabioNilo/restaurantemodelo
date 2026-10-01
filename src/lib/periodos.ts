// Atalhos de período do Caixa, em datas locais da loja ("YYYY-MM-DD").

export const FUSO_LOJA = 'America/Bahia';

export function hojeLocal(agora = new Date(), timeZone = FUSO_LOJA) {
  return agora.toLocaleDateString('sv-SE', { timeZone });
}

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type AtalhoPeriodo = 'hoje' | 'ontem' | '7dias' | 'mes' | 'mes_passado';

export const ATALHOS_PERIODO: Array<{ id: AtalhoPeriodo; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: '7dias', label: '7 dias' },
  { id: 'mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
];

export function periodoDoAtalho(atalho: AtalhoPeriodo, hoje = hojeLocal()) {
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  switch (atalho) {
    case 'hoje':
      return { de: hoje, ate: hoje };
    case 'ontem':
      return { de: somarDias(hoje, -1), ate: somarDias(hoje, -1) };
    case '7dias':
      return { de: somarDias(hoje, -6), ate: hoje };
    case 'mes':
      return { de: inicioMes, ate: hoje };
    case 'mes_passado': {
      const fimAnterior = somarDias(inicioMes, -1);
      return { de: `${fimAnterior.slice(0, 7)}-01`, ate: fimAnterior };
    }
  }
}
