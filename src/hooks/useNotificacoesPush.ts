import { useCallback, useEffect, useState } from 'react';
import { fetchPushConfig, subscribePush, testarPush, unsubscribePush } from '@/features/integrations/marmitas-api';
import { toast } from '@/hooks/use-toast';
import { estaInstalado, ehIos, registroPainelAtivo } from '@/hooks/usePwaAdmin';
import { getApiErrorMessage } from '@/lib/api';

// Notificação push de pedido novo, ativada em cada aparelho por quem usa o painel.
export type EstadoPush =
  | 'carregando'
  | 'indisponivel' // navegador sem suporte a push
  | 'sem-servidor' // o servidor ainda não tem as chaves VAPID
  | 'precisa-instalar' // iPhone/iPad: push só funciona com o app na Tela de Início
  | 'bloqueado' // permissão negada no navegador
  | 'desativado'
  | 'ativado';

function base64UrlParaBytes(base64Url: string) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

function bytesParaBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return '';
  const texto = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const suportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function dadosDaInscricao(inscricao: PushSubscription) {
  const json = inscricao.toJSON();

  return {
    endpoint: inscricao.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    user_agent: navigator.userAgent.slice(0, 250),
  };
}

export function useNotificacoesPush(habilitado = true) {
  const [estado, setEstado] = useState<EstadoPush>('carregando');
  const [chavePublica, setChavePublica] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const verificar = useCallback(async () => {
    if (!suportaPush()) {
      setEstado(ehIos() && !estaInstalado() ? 'precisa-instalar' : 'indisponivel');
      return;
    }

    let chave: string | null = null;

    try {
      chave = (await fetchPushConfig()).publicKey;
    } catch {
      setEstado('indisponivel');
      return;
    }

    setChavePublica(chave);

    if (!chave) {
      setEstado('sem-servidor');
      return;
    }

    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }

    const registro = await registroPainelAtivo();
    const inscricao = registro?.active ? await registro.pushManager.getSubscription() : null;

    if (inscricao && Notification.permission === 'granted') {
      // Mantém o servidor em dia (ex.: a inscrição foi apagada de lá) sem pedir nada à pessoa.
      await subscribePush(dadosDaInscricao(inscricao)).catch(() => undefined);
      setEstado('ativado');
      return;
    }

    setEstado('desativado');
  }, []);

  useEffect(() => {
    if (habilitado) void verificar();
  }, [habilitado, verificar]);

  const ativar = useCallback(async () => {
    if (!chavePublica) return;
    setOcupado(true);

    try {
      const permissao = await Notification.requestPermission();

      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'desativado');
        return;
      }

      const registro = await registroPainelAtivo();

      if (!registro?.active) {
        throw new Error('O serviço de notificações ainda não está pronto. Recarregue a página e tente de novo.');
      }

      let inscricao = await registro.pushManager.getSubscription();

      // Inscrição feita com outra chave (ex.: troca de chaves do servidor) precisa ser refeita.
      if (inscricao && bytesParaBase64Url(inscricao.options.applicationServerKey) !== chavePublica) {
        await inscricao.unsubscribe();
        inscricao = null;
      }

      inscricao ??= await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaBytes(chavePublica),
      });

      await subscribePush(dadosDaInscricao(inscricao));
      setEstado('ativado');
      toast({ title: 'Notificações ativadas', description: 'Este aparelho será avisado a cada pedido novo.' });
    } catch (error) {
      toast({ title: 'Não foi possível ativar as notificações', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  }, [chavePublica]);

  const desativar = useCallback(async () => {
    setOcupado(true);

    try {
      const registro = await registroPainelAtivo();
      const inscricao = (await registro?.pushManager.getSubscription()) ?? null;

      if (inscricao) {
        await unsubscribePush(inscricao.endpoint).catch(() => undefined);
        await inscricao.unsubscribe();
      }

      setEstado('desativado');
      toast({ title: 'Notificações desativadas neste aparelho' });
    } catch (error) {
      toast({ title: 'Não foi possível desativar', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  }, []);

  const testar = useCallback(async () => {
    setOcupado(true);

    try {
      const { enviados } = await testarPush();
      toast(
        enviados > 0
          ? { title: 'Teste enviado', description: 'A notificação deve aparecer em instantes.' }
          : { title: 'Nenhum aparelho recebeu', description: 'Desative e ative de novo as notificações neste aparelho.', variant: 'destructive' }
      );
    } catch (error) {
      toast({ title: 'Não foi possível enviar o teste', description: getApiErrorMessage(error), variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ocupado, ativar, desativar, testar };
}
