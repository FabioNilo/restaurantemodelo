import { useCallback, useEffect, useState } from 'react';

// PWA só do painel: o manifest e o service worker moram em /admin/ e só são
// ligados quando o layout do admin está na tela. O site público não é instalável.

const MANIFEST_ID = 'manifest-painel';
export const SW_URL = '/admin/sw.js';
export const SW_ESCOPO = '/admin/';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function estaInstalado() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function ehIos() {
  if (typeof navigator === 'undefined') return false;
  // iPadOS 13+ se apresenta como Mac, mas tem tela de toque.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function registrarServiceWorkerPainel() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: SW_ESCOPO });
  } catch (error) {
    console.warn('Não foi possível registrar o service worker do painel:', error);
    return null;
  }
}

// Registro com service worker ATIVO, pronto para assinar push. Não usa navigator.serviceWorker.ready:
// ele só resolve para páginas *carregadas* dentro de /admin/, e quem entra por /auth e é levado ao
// painel sem recarregar nunca receberia a resposta.
export async function registroPainelAtivo() {
  const registro = await registrarServiceWorkerPainel();

  if (!registro || registro.active) {
    return registro;
  }

  const worker = registro.installing ?? registro.waiting;

  if (worker) {
    await new Promise<void>((resolve) => {
      const parar = setTimeout(resolve, 10000);
      const concluir = () => {
        if (worker.state === 'activated') {
          clearTimeout(parar);
          resolve();
        }
      };

      worker.addEventListener('statechange', concluir);
      concluir();
    });
  }

  return registro;
}

// Liga o manifest, registra o service worker e guarda o evento de instalação (Chrome/Edge/Android).
export function usePwaAdmin(onAbrir?: (url: string) => void) {
  const [convite, setConvite] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(estaInstalado);

  useEffect(() => {
    let link = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;

    if (!link) {
      link = document.createElement('link');
      link.id = MANIFEST_ID;
      link.rel = 'manifest';
      link.href = '/admin/manifest.webmanifest';
      document.head.appendChild(link);
    }

    void registrarServiceWorkerPainel();

    const aoConvidar = (event: Event) => {
      event.preventDefault();
      setConvite(event as BeforeInstallPromptEvent);
    };
    const aoInstalar = () => {
      setConvite(null);
      setInstalado(true);
    };

    window.addEventListener('beforeinstallprompt', aoConvidar);
    window.addEventListener('appinstalled', aoInstalar);

    return () => {
      window.removeEventListener('beforeinstallprompt', aoConvidar);
      window.removeEventListener('appinstalled', aoInstalar);
      link?.remove();
    };
  }, []);

  // Tocar na notificação com o painel aberto: o service worker pede para trocar de tela.
  useEffect(() => {
    if (!onAbrir || !('serviceWorker' in navigator)) return;

    const aoReceber = (event: MessageEvent) => {
      const dados = event.data as { tipo?: string; url?: unknown } | null;

      if (dados?.tipo === 'abrir' && typeof dados.url === 'string' && dados.url.startsWith('/admin')) {
        onAbrir(dados.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', aoReceber);
    return () => navigator.serviceWorker.removeEventListener('message', aoReceber);
  }, [onAbrir]);

  const instalar = useCallback(async () => {
    if (!convite) return;
    await convite.prompt();
    const { outcome } = await convite.userChoice;
    if (outcome === 'accepted') setInstalado(true);
    setConvite(null);
  }, [convite]);

  return { podeInstalar: convite !== null && !instalado, instalado, instalar };
}
