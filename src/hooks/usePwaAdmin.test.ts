import { afterEach, describe, expect, it, vi } from 'vitest';
import { registroPainelAtivo, SW_ESCOPO, SW_URL } from './usePwaAdmin';

type Estado = 'installing' | 'installed' | 'activating' | 'activated';

// Service worker de mentira que muda de estado como o de verdade.
function workerFalso(estado: Estado) {
  const ouvintes: Array<() => void> = [];
  const worker = {
    state: estado,
    addEventListener: (_: string, fn: () => void) => ouvintes.push(fn),
    mudarPara(novo: Estado) {
      worker.state = novo;
      ouvintes.forEach((fn) => fn());
    },
  };
  return worker;
}

function instalarNavigator(registro: unknown) {
  const ready = vi.fn();
  const register = vi.fn().mockResolvedValue(registro);
  Object.defineProperty(globalThis.navigator, 'serviceWorker', { configurable: true, value: { register, get ready() { ready(); return new Promise(() => undefined); } } });
  return { register, ready };
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
});

describe('registroPainelAtivo', () => {
  it('registra o service worker do painel só no escopo /admin/', async () => {
    const { register } = instalarNavigator({ active: {} });
    await registroPainelAtivo();
    expect(register).toHaveBeenCalledWith(SW_URL, { scope: SW_ESCOPO });
    expect(SW_URL).toBe('/admin/sw.js');
    expect(SW_ESCOPO).toBe('/admin/');
  });

  it('devolve na hora quando o service worker já está ativo', async () => {
    const registro = { active: { state: 'activated' } };
    instalarNavigator(registro);
    await expect(registroPainelAtivo()).resolves.toBe(registro);
  });

  it('espera o service worker ficar ativo, sem depender de navigator.serviceWorker.ready', async () => {
    // Regressão: ready só resolve para páginas carregadas dentro de /admin/. Quem entra por /auth
    // e vai ao painel sem recarregar ficava para sempre em "carregando", sem o botão de notificações.
    const worker = workerFalso('installing');
    const registro = { active: null, installing: worker, waiting: null };
    const { ready } = instalarNavigator(registro);

    let pronto = false;
    const espera = registroPainelAtivo().then((r) => {
      pronto = true;
      return r;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(pronto).toBe(false);

    worker.mudarPara('activating');
    await Promise.resolve();
    expect(pronto).toBe(false);

    worker.mudarPara('activated');
    await expect(espera).resolves.toBe(registro);
    expect(ready).not.toHaveBeenCalled();
  });

  it('não trava quando o navegador não tem service worker', async () => {
    await expect(registroPainelAtivo()).resolves.toBeNull();
  });
});
