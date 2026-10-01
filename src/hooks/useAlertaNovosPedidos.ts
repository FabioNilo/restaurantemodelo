import { useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';

const TITULO_ORIGINAL = typeof document !== 'undefined' ? document.title : '';

// Bipe curto via Web Audio (sem arquivo de som).
function tocarBipe(context: AudioContext) {
  [0, 0.22].forEach((delay) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.3, context.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.2);
  });
}

// O contexto de áudio é compartilhado entre as páginas do painel: ativado uma
// vez (o navegador exige um clique), continua valendo ao trocar de seção.
let audioCompartilhado: AudioContext | null = null;

/**
 * Avisa quando aparecem pedidos novos: bipe (se o som estiver ativado), toast
 * e contador no título da aba. `idsNovos` = ids dos pedidos ainda não atendidos.
 * Na primeira carga só registra o que já existe, para não apitar ao abrir a tela.
 */
export function useAlertaNovosPedidos(idsNovos: string[] | undefined, rotulo: (quantidade: number) => string) {
  const vistos = useRef<Set<string> | null>(null);
  const [somAtivo, setSomAtivo] = useState(() => audioCompartilhado !== null);

  useEffect(() => {
    if (!idsNovos) return;

    if (vistos.current) {
      const chegaram = idsNovos.filter((id) => !vistos.current!.has(id));
      if (chegaram.length > 0) {
        if (audioCompartilhado) tocarBipe(audioCompartilhado);
        toast({ title: rotulo(chegaram.length) });
      }
    }

    vistos.current = new Set([...(vistos.current ?? []), ...idsNovos]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsNovos?.join(',')]);

  const quantidade = idsNovos?.length ?? 0;

  useEffect(() => {
    document.title = quantidade > 0 ? `(${quantidade}) Novos pedidos · ${TITULO_ORIGINAL}` : TITULO_ORIGINAL;
  }, [quantidade]);

  useEffect(() => () => void (document.title = TITULO_ORIGINAL), []);

  const alternarSom = () => {
    if (audioCompartilhado) {
      void audioCompartilhado.close();
      audioCompartilhado = null;
      setSomAtivo(false);
      return;
    }

    audioCompartilhado = new AudioContext();
    tocarBipe(audioCompartilhado);
    setSomAtivo(true);
  };

  return { somAtivo, alternarSom };
}
